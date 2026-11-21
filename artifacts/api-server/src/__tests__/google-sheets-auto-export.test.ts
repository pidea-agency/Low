import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MIN_AUTO_EXPORT_INTERVAL_MS,
  AUTO_EXPORT_INTERVAL_MAP,
  shouldTriggerAutoExport,
  acquireExportLock,
  releaseExportLock,
  isExportInProgress,
  runGoogleSheetsAutoExportSweep,
} from "../services/reminder/google-sheets-auto-export.service";
import * as supabaseService from "../services/supabase.service";
import * as postgresService from "../services/postgres.service";

describe("Google Sheets Auto-Export Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    releaseExportLock("office-1");
    releaseExportLock("office-2");
    releaseExportLock("office-3");
  });

  describe("1. Safety Floor and Trigger Logic (shouldTriggerAutoExport)", () => {
    it("never auto-exports when frequency is 'manual' or undefined", () => {
      const now = Date.now();
      const pastTime = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

      expect(shouldTriggerAutoExport("manual", pastTime, now)).toBe(false);
      expect(shouldTriggerAutoExport(undefined, pastTime, now)).toBe(false);
      expect(shouldTriggerAutoExport("manual", null, now)).toBe(false);
    });

    it("triggers immediately if never exported before (lastAutoExportAt is null)", () => {
      const now = Date.now();
      expect(shouldTriggerAutoExport("hourly", null, now)).toBe(true);
      expect(shouldTriggerAutoExport("every_6_hours", undefined, now)).toBe(true);
      expect(shouldTriggerAutoExport("daily", null, now)).toBe(true);
    });

    it("enforces minimum safety floor: 'hourly' exports at most once per hour", () => {
      const now = Date.now();
      const fiftyNineMinutesAgo = new Date(now - 59 * 60 * 1000).toISOString();
      const sixtyOneMinutesAgo = new Date(now - 61 * 60 * 1000).toISOString();

      // 59 minutes elapsed -> Not due
      expect(shouldTriggerAutoExport("hourly", fiftyNineMinutesAgo, now)).toBe(false);

      // 61 minutes elapsed -> Due
      expect(shouldTriggerAutoExport("hourly", sixtyOneMinutesAgo, now)).toBe(true);
    });

    it("respects 'every_6_hours' and 'daily' schedules", () => {
      const now = Date.now();
      const fiveHoursAgo = new Date(now - 5 * 60 * 60 * 1000).toISOString();
      const sevenHoursAgo = new Date(now - 7 * 60 * 60 * 1000).toISOString();
      const twentyThreeHoursAgo = new Date(now - 23 * 60 * 60 * 1000).toISOString();
      const twentyFiveHoursAgo = new Date(now - 25 * 60 * 60 * 1000).toISOString();

      expect(shouldTriggerAutoExport("every_6_hours", fiveHoursAgo, now)).toBe(false);
      expect(shouldTriggerAutoExport("every_6_hours", sevenHoursAgo, now)).toBe(true);

      expect(shouldTriggerAutoExport("daily", twentyThreeHoursAgo, now)).toBe(false);
      expect(shouldTriggerAutoExport("daily", twentyFiveHoursAgo, now)).toBe(true);
    });

    it("never allows interval less than 1 hour (safety floor)", () => {
      expect(MIN_AUTO_EXPORT_INTERVAL_MS).toBe(60 * 60 * 1000);
      expect(AUTO_EXPORT_INTERVAL_MAP.hourly).toBeGreaterThanOrEqual(MIN_AUTO_EXPORT_INTERVAL_MS);
      expect(AUTO_EXPORT_INTERVAL_MAP.every_6_hours).toBeGreaterThanOrEqual(MIN_AUTO_EXPORT_INTERVAL_MS);
      expect(AUTO_EXPORT_INTERVAL_MAP.daily).toBeGreaterThanOrEqual(MIN_AUTO_EXPORT_INTERVAL_MS);
    });
  });

  describe("2. Concurrency and Deduplication Locks", () => {
    it("prevents overlapping exports for the same office", () => {
      expect(isExportInProgress("office-1")).toBe(false);

      // First acquire succeeds
      expect(acquireExportLock("office-1")).toBe(true);
      expect(isExportInProgress("office-1")).toBe(true);

      // Second acquire fails
      expect(acquireExportLock("office-1")).toBe(false);

      // Other offices are not affected
      expect(acquireExportLock("office-2")).toBe(true);

      // Release office-1
      releaseExportLock("office-1");
      expect(isExportInProgress("office-1")).toBe(false);
      expect(acquireExportLock("office-1")).toBe(true);

      releaseExportLock("office-1");
      releaseExportLock("office-2");
    });
  });

  describe("3. Auto-Export Sweep Execution (runGoogleSheetsAutoExportSweep)", () => {
    it("skips offices with 'manual' frequency and only exports due offices", async () => {
      const now = Date.now();
      const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();

      const adminManual: supabaseService.AppUser = {
        id: "office-manual",
        username: "admin_manual",
        role: "admin",
        status: "active",
        auto_export_frequency: "manual",
      };

      const adminHourly: supabaseService.AppUser = {
        id: "office-hourly",
        username: "admin_hourly",
        role: "admin",
        status: "active",
        auto_export_frequency: "hourly",
        last_auto_export_at: twoHoursAgo,
      };

      vi.spyOn(supabaseService, "listSupabaseUsers").mockResolvedValue([adminManual, adminHourly]);
      vi.spyOn(supabaseService, "getUserGoogleCredentials").mockResolvedValue({
        serviceAccountJson: { client_email: "test@sa.iam.gserviceaccount.com" },
        spreadsheetId: "sheet-123",
      });

      const exportSpy = vi.spyOn(postgresService, "exportOfficeDataToGoogleSheets").mockResolvedValue({
        sessionsCount: 10,
        tasksCount: 5,
        judgmentsCount: 2,
        poaCount: 3,
        spreadsheetId: "sheet-123",
        sheetName: "Sessions",
      } as any);

      const updateSettingsSpy = vi.spyOn(supabaseService, "updateOfficeAutoExportSettings").mockResolvedValue(adminHourly);

      const result = await runGoogleSheetsAutoExportSweep();

      expect(result.ok).toBe(true);
      expect(result.officesChecked).toBe(2);
      expect(result.officesExported).toBe(1);
      expect(result.officesSkipped).toBe(1);

      // Only office-hourly was exported
      expect(exportSpy).toHaveBeenCalledTimes(1);
      expect(exportSpy).toHaveBeenCalledWith("office-hourly", { throwOnError: true });

      // Settings were updated with success status
      expect(updateSettingsSpy).toHaveBeenCalledWith(
        "office-hourly",
        expect.objectContaining({
          last_auto_export_status: "success",
          last_auto_export_error: null,
        }),
      );
    });

    it("skips office if already locked (mid-export concurrency protection)", async () => {
      const adminHourly: supabaseService.AppUser = {
        id: "office-locked",
        username: "admin_locked",
        role: "admin",
        status: "active",
        auto_export_frequency: "hourly",
        last_auto_export_at: null,
      };

      vi.spyOn(supabaseService, "listSupabaseUsers").mockResolvedValue([adminHourly]);
      vi.spyOn(supabaseService, "getUserGoogleCredentials").mockResolvedValue({
        serviceAccountJson: { client_email: "test@sa.iam.gserviceaccount.com" },
        spreadsheetId: "sheet-123",
      });

      // Acquire lock prior to sweep (simulating manual export currently running)
      acquireExportLock("office-locked");

      const exportSpy = vi.spyOn(postgresService, "exportOfficeDataToGoogleSheets");

      const result = await runGoogleSheetsAutoExportSweep();

      expect(result.officesSkippedLocked).toBe(1);
      expect(result.officesExported).toBe(0);
      expect(exportSpy).not.toHaveBeenCalled();

      releaseExportLock("office-locked");
    });

    it("isolated failure handling: failure in one office does not break sweep for other offices", async () => {
      const officeFail: supabaseService.AppUser = {
        id: "office-fail",
        username: "admin_fail",
        role: "admin",
        status: "active",
        auto_export_frequency: "hourly",
        last_auto_export_at: null,
      };

      const officeOk: supabaseService.AppUser = {
        id: "office-ok",
        username: "admin_ok",
        role: "admin",
        status: "active",
        auto_export_frequency: "hourly",
        last_auto_export_at: null,
      };

      vi.spyOn(supabaseService, "listSupabaseUsers").mockResolvedValue([officeFail, officeOk]);
      vi.spyOn(supabaseService, "getUserGoogleCredentials").mockResolvedValue({
        serviceAccountJson: { client_email: "test@sa.iam.gserviceaccount.com" },
        spreadsheetId: "sheet-123",
      });

      // Fail for officeFail, succeed for officeOk
      const exportSpy = vi.spyOn(postgresService, "exportOfficeDataToGoogleSheets").mockImplementation(async (officeId) => {
        if (officeId === "office-fail") {
          throw new Error("Google Sheets 403: The caller does not have permission");
        }
        return {
          sessionsCount: 5,
          tasksCount: 2,
          judgmentsCount: 1,
          poaCount: 1,
          spreadsheetId: "sheet-123",
          sheetName: "Sessions",
        } as any;
      });

      const updateSettingsSpy = vi.spyOn(supabaseService, "updateOfficeAutoExportSettings").mockResolvedValue(officeOk);

      const result = await runGoogleSheetsAutoExportSweep();

      expect(result.ok).toBe(true);
      expect(result.officesExported).toBe(1);
      expect(result.officesFailed).toBe(1);

      // officeFail recorded failure
      expect(updateSettingsSpy).toHaveBeenCalledWith(
        "office-fail",
        expect.objectContaining({
          last_auto_export_status: "failed",
          last_auto_export_error: "Google Sheets 403: The caller does not have permission",
        }),
      );

      // officeOk recorded success
      expect(updateSettingsSpy).toHaveBeenCalledWith(
        "office-ok",
        expect.objectContaining({
          last_auto_export_status: "success",
          last_auto_export_error: null,
        }),
      );

      // Both locks were properly released
      expect(isExportInProgress("office-fail")).toBe(false);
      expect(isExportInProgress("office-ok")).toBe(false);
    });

    it("exportOfficeDataToGoogleSheets with throwOnError false does not throw on failure (best-effort sync)", async () => {
      // Testing that the default/non-throwOnError export does not crash application operations
      vi.spyOn(supabaseService, "getUserGoogleCredentials").mockRejectedValue(new Error("Supabase unavailable"));

      const res = await postgresService.exportOfficeDataToGoogleSheets("office-test-safe", { throwOnError: false });
      expect(res).toBeDefined();
      expect(res.sessionsCount).toBe(0);
    });
  });
});
