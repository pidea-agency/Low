import cron from "node-cron";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { listSessions, markReminderSent } from "../services/session.service";
import { notify } from "../services/reminder/reminder.service";
import { runPoaExpirySweep } from "../services/reminder/poa-expiry.service";
import { computeHearingDateTime } from "../utils/hijri";
import { listSupabaseUsers, type AppUser } from "../services/supabase.service";
import { GoogleBindingMissingError } from "../services/googleSheets.service";
import type { Session } from "@workspace/api-client-react";
import type { ReminderPayload } from "../services/reminder/reminder.types";

const MS_PER_HOUR = 60 * 60 * 1000;

export interface OfficeReminderResult {
  officeId: string;
  remindersFound: number;
  sent: number;
  skipped: number;
  failed: number;
  reason?: string;
}

/**
 * Masks phone numbers for secure logging (masks all characters except the last 3 digits).
 */
export function maskPhone(phone?: string | null): string {
  if (!phone) return "";
  const cleaned = phone.trim();
  if (cleaned.length <= 3) return "***";
  return "*".repeat(cleaned.length - 3) + cleaned.slice(-3);
}

/**
 * Formats the exact remaining time as a human-readable Arabic string.
 * e.g. "يوم و 3 ساعات و 25 دقيقة" or "5 ساعات و 12 دقيقة" or "45 دقيقة"
 */
function formatRemainingTime(diffMs: number): string {
  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(days === 1 ? "يوم" : days === 2 ? "يومين" : `${days} أيام`);
  }
  if (hours > 0) {
    parts.push(
      hours === 1 ? "ساعة"
      : hours === 2 ? "ساعتين"
      : hours <= 10 ? `${hours} ساعات`
      : `${hours} ساعة`,
    );
  }
  if (minutes > 0 || parts.length === 0) {
    parts.push(
      minutes === 1 ? "دقيقة"
      : minutes === 2 ? "دقيقتين"
      : minutes <= 10 ? `${minutes} دقائق`
      : `${minutes} دقيقة`,
    );
  }

  return `متبقي ${parts.join(" و ")}`;
}

/**
 * Runs reminder processing isolated per office tenant.
 * - Iterates over active offices
 * - Skips offices with missing/partial bindings without aborting others
 * - Skips offices without registered authorized recipient phone (never falls back to global numbers)
 * - Returns a per-office result summary
 */
export async function runReminderSweep(): Promise<OfficeReminderResult[]> {
  const results: OfficeReminderResult[] = [];
  let offices: AppUser[] = [];

  try {
    const users = await listSupabaseUsers();
    // Process active accounts (suspended offices do not receive automated reminders)
    offices = users.filter((u) => u.status !== "suspended");
  } catch (err: any) {
    logger.error({ err }, "Failed to list offices for reminder sweep");
    return results;
  }

  const now = new Date();

  for (const office of offices) {
    const officeId = office.id;
    const recipientPhone = office.phone?.trim() || null;

    // Fast check: verify if office has sheets credentials configured
    const hasBinding = Boolean(
      (office.has_google_service || office.google_service_account_json) &&
      office.google_spreadsheet_id
    );

    if (!hasBinding && !office.has_google_service && !office.google_spreadsheet_id) {
      results.push({
        officeId,
        remindersFound: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        reason: "Google Sheets binding missing or incomplete",
      });
      continue;
    }

    try {
      let sessions: Session[] = [];
      try {
        sessions = await listSessions(officeId);
      } catch (err: any) {
        if (
          err instanceof GoogleBindingMissingError ||
          String(err?.message || "").toLowerCase().includes("binding")
        ) {
          results.push({
            officeId,
            remindersFound: 0,
            sent: 0,
            skipped: 0,
            failed: 0,
            reason: "Google Sheets binding missing or incomplete",
          });
          continue;
        }
        throw err;
      }

      let remindersFound = 0;
      let sent = 0;
      let skipped = 0;

      for (const session of sessions) {
        if (session.status === "Cancelled" || session.status === "Finished") {
          continue;
        }
        const hearingAt = computeHearingDateTime(
          session.sessionDateHijri,
          session.sessionTime,
        );
        if (!hearingAt) {
          continue;
        }

        const diffMs = hearingAt.getTime() - now.getTime();
        const hoursLeft = diffMs / MS_PER_HOUR;
        const remainingText = formatRemainingTime(diffMs);

        // Check 24-hour reminder threshold
        if (!session.reminder24 && hoursLeft <= 24 && hoursLeft > 0) {
          remindersFound++;
          if (!recipientPhone) {
            skipped++;
          } else {
            const payload: ReminderPayload = {
              officeId,
              recipientPhone,
              sessionId: session.id,
              caseNumber: session.caseNumber,
              sessionDateHijri: session.sessionDateHijri,
              sessionTime: session.sessionTime,
              kind: "24h",
              remainingText,
              court: session.court,
              courtCircuit: session.courtCircuit,
              plaintiff: session.plaintiff,
              defendant: session.defendant,
              caseSubject: session.caseSubject,
            };

            await notify(payload, officeId);
            await markReminderSent(session.id, "24h", officeId);
            sent++;
          }
        }

        // Check 6-hour reminder threshold
        if (!session.reminder6 && hoursLeft <= 6 && hoursLeft > 0) {
          remindersFound++;
          if (!recipientPhone) {
            skipped++;
          } else {
            const payload: ReminderPayload = {
              officeId,
              recipientPhone,
              sessionId: session.id,
              caseNumber: session.caseNumber,
              sessionDateHijri: session.sessionDateHijri,
              sessionTime: session.sessionTime,
              kind: "6h",
              remainingText,
              court: session.court,
              courtCircuit: session.courtCircuit,
              plaintiff: session.plaintiff,
              defendant: session.defendant,
              caseSubject: session.caseSubject,
            };

            await notify(payload, officeId);
            await markReminderSent(session.id, "6h", officeId);
            sent++;
          }
        }
      }

      const officeResult: OfficeReminderResult = {
        officeId,
        remindersFound,
        sent,
        skipped,
        failed: 0,
        ...(!recipientPhone
          ? { reason: "No authorized recipient phone registered for office" }
          : {}),
      };

      logger.info(
        {
          officeId,
          recipientPhone: maskPhone(recipientPhone),
          remindersFound,
          sent,
          skipped,
        },
        "Office reminder sweep completed",
      );

      results.push(officeResult);
    } catch (err: any) {
      logger.error(
        { officeId, err: err?.message || err },
        "Error processing reminders for office",
      );
      results.push({
        officeId,
        remindersFound: 0,
        sent: 0,
        skipped: 0,
        failed: 1,
        reason: err?.message || "Unknown error",
      });
    }
  }

  return results;
}

let started = false;

/** Starts the recurring reminder scheduler. Runs every 1 minute or configured cron schedule. */
export function startReminderScheduler(): void {
  if (started) {
    return;
  }

  started = true;
  // Run an immediate sweep on server startup
  runReminderSweep().catch((err) => {
    logger.error({ err }, "Initial reminder sweep failed");
  });

  cron.schedule(env.reminderCronExpression, () => {
    runReminderSweep().catch((err) => {
      logger.error({ err }, "Reminder sweep failed");
    });
  });

  // Daily POA expiry sweep
  cron.schedule("0 2 * * *", () => {
    runPoaExpirySweep().catch((err) => {
      logger.error({ err }, "Daily POA expiry sweep failed");
    });
  });
  logger.info(
    { cron: env.reminderCronExpression },
    "Tenant-isolated reminder scheduler started successfully",
  );
}
