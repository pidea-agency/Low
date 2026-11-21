/**
 * google-sheets-auto-export.service.ts
 *
 * Periodic automated Google Sheets export service.
 * Sweeps offices configured with periodic auto-export ('hourly', 'every_6_hours', 'daily'),
 * enforces a strict 1-hour minimum safety floor for rate limit safety,
 * prevents concurrent exports via an in-memory lock, and tracks success/failure
 * states on the office admin settings without interrupting real data writes.
 */

import { logger } from "../../lib/logger";
import {
  listSupabaseUsers,
  getUserGoogleCredentials,
  updateOfficeAutoExportSettings,
  type AppUser,
  type AutoExportFrequency,
} from "../supabase.service";
import { exportOfficeDataToGoogleSheets } from "../postgres.service";

/**
 * Strict minimum interval allowed between automated exports (1 hour).
 * Enforced even if intervals or crons trigger more frequently.
 */
export const MIN_AUTO_EXPORT_INTERVAL_MS = 60 * 60 * 1000;

export const AUTO_EXPORT_INTERVAL_MAP: Record<AutoExportFrequency, number> = {
  manual: 0,
  hourly: 60 * 60 * 1000,
  every_6_hours: 6 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
};

// In-memory concurrency locks to prevent overlapping exports for the same office
const activeExportLocks = new Set<string>();

export function acquireExportLock(officeId: string): boolean {
  if (activeExportLocks.has(officeId)) {
    return false;
  }
  activeExportLocks.add(officeId);
  return true;
}

export function releaseExportLock(officeId: string): void {
  activeExportLocks.delete(officeId);
}

export function isExportInProgress(officeId: string): boolean {
  return activeExportLocks.has(officeId);
}

/**
 * Determines whether an office is due for an automated export.
 * Returns false for 'manual' or if the elapsed time is less than the effective interval.
 */
export function shouldTriggerAutoExport(
  frequency: AutoExportFrequency | undefined,
  lastAutoExportAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!frequency || frequency === "manual") {
    return false;
  }

  const configuredInterval = AUTO_EXPORT_INTERVAL_MAP[frequency];
  if (!configuredInterval || configuredInterval <= 0) {
    return false;
  }

  // Enforce minimum safety floor: never more frequently than 1 hour
  const effectiveInterval = Math.max(MIN_AUTO_EXPORT_INTERVAL_MS, configuredInterval);

  if (!lastAutoExportAt) {
    return true;
  }

  const lastTime = new Date(lastAutoExportAt).getTime();
  if (Number.isNaN(lastTime)) {
    return true;
  }

  return now - lastTime >= effectiveInterval;
}

export interface AutoExportOfficeResult {
  officeId: string;
  status: "success" | "failed" | "skipped_locked" | "skipped_not_due" | "skipped_no_creds";
  sessionsCount?: number;
  tasksCount?: number;
  error?: string;
}

export interface GoogleSheetsAutoExportSweepResult {
  ok: boolean;
  officesChecked: number;
  officesExported: number;
  officesFailed: number;
  officesSkipped: number;
  officesSkippedLocked: number;
  results: AutoExportOfficeResult[];
}

/**
 * Sweeps all (or targeted) office admins and performs automatic Google Sheets export
 * for offices whose configured frequency interval has elapsed.
 */
export async function runGoogleSheetsAutoExportSweep(
  targetOfficeId?: string,
): Promise<GoogleSheetsAutoExportSweepResult> {
  const results: AutoExportOfficeResult[] = [];
  let officesExported = 0;
  let officesFailed = 0;
  let officesSkipped = 0;
  let officesSkippedLocked = 0;

  let allUsers: AppUser[] = [];
  try {
    allUsers = await listSupabaseUsers();
  } catch (err: any) {
    logger.error({ err }, "runGoogleSheetsAutoExportSweep: failed to fetch users list");
    return {
      ok: false,
      officesChecked: 0,
      officesExported: 0,
      officesFailed: 0,
      officesSkipped: 0,
      officesSkippedLocked: 0,
      results: [],
    };
  }

  let admins = allUsers.filter((u) => u.role === "admin");
  if (targetOfficeId) {
    admins = admins.filter((u) => u.id === targetOfficeId);
  }

  const now = Date.now();

  for (const admin of admins) {
    // 1. Check if configured for auto-export
    const frequency = admin.auto_export_frequency || "manual";
    if (frequency === "manual") {
      officesSkipped++;
      continue;
    }

    // 2. Check if due based on interval and safety floor
    if (!shouldTriggerAutoExport(frequency, admin.last_auto_export_at, now)) {
      officesSkipped++;
      results.push({
        officeId: admin.id,
        status: "skipped_not_due",
      });
      continue;
    }

    // 3. Check credentials exist
    try {
      const creds = await getUserGoogleCredentials(admin.id);
      if (!creds?.serviceAccountJson || !creds.spreadsheetId) {
        officesSkipped++;
        results.push({
          officeId: admin.id,
          status: "skipped_no_creds",
        });
        continue;
      }
    } catch {
      officesSkipped++;
      results.push({
        officeId: admin.id,
        status: "skipped_no_creds",
      });
      continue;
    }

    // 4. Concurrency lock check
    if (!acquireExportLock(admin.id)) {
      logger.info({ officeId: admin.id }, "Auto-export skipped: export already in progress for office");
      officesSkippedLocked++;
      results.push({
        officeId: admin.id,
        status: "skipped_locked",
      });
      continue;
    }

    // 5. Execute export with throwOnError: true so errors are caught
    try {
      const exportRes = await exportOfficeDataToGoogleSheets(admin.id, { throwOnError: true });
      const nowIso = new Date().toISOString();

      await updateOfficeAutoExportSettings(admin.id, {
        last_auto_export_at: nowIso,
        last_auto_export_status: "success",
        last_auto_export_error: null,
      });

      officesExported++;
      results.push({
        officeId: admin.id,
        status: "success",
        sessionsCount: exportRes.sessionsCount,
        tasksCount: exportRes.tasksCount,
      });

      logger.info(
        { officeId: admin.id, frequency, sessions: exportRes.sessionsCount, tasks: exportRes.tasksCount },
        "Google Sheets auto-export completed successfully",
      );
    } catch (err: any) {
      const errorMessage = err?.message || "فشل تصدير البيانات تلقائياً إلى Google Sheets";
      logger.warn(
        { err, officeId: admin.id, frequency },
        "Google Sheets auto-export failed for office",
      );

      try {
        await updateOfficeAutoExportSettings(admin.id, {
          last_auto_export_status: "failed",
          last_auto_export_error: errorMessage,
        });
      } catch (updateErr: any) {
        logger.error({ updateErr, officeId: admin.id }, "Failed to update last_auto_export_status");
      }

      officesFailed++;
      results.push({
        officeId: admin.id,
        status: "failed",
        error: errorMessage,
      });
    } finally {
      releaseExportLock(admin.id);
    }
  }

  return {
    ok: true,
    officesChecked: admins.length,
    officesExported,
    officesFailed,
    officesSkipped,
    officesSkippedLocked,
    results,
  };
}
