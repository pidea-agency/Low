import { describe, it, expect, vi, beforeEach } from "vitest";
import * as reminderScheduler from "../scheduler/reminderScheduler";
import * as sessionService from "../services/session.service";
import * as reminderService from "../services/reminder/reminder.service";
import * as supabaseService from "../services/supabase.service";
import { WhatsappReminderChannel } from "../services/reminder/channels/whatsappChannel";
import * as settingsStore from "../config/settings-store";
import { GoogleBindingMissingError } from "../services/googleSheets.service";
import * as hijriUtil from "../utils/hijri";
import type { Session } from "@workspace/api-client-react";

describe("Reminder Scheduler Tenant Isolation & Security", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. listSessions Requires Office Context", () => {
    it("throws an error when officeId is missing, empty, or undefined", async () => {
      // @ts-expect-error - testing missing officeId enforcement
      await expect(sessionService.listSessions()).rejects.toThrow(/officeId is required/i);
      // @ts-expect-error - testing undefined officeId enforcement
      await expect(sessionService.listSessions(undefined, undefined)).rejects.toThrow(/officeId is required/i);
      // Testing empty officeId enforcement at runtime
      await expect(sessionService.listSessions(undefined, "   ")).rejects.toThrow(/officeId is required/i);
    });
  });

  describe("2. Per-Office Processing and Recipient Isolation", () => {
    it("runs per office and sends reminders ONLY to the specific office's authorized recipient", async () => {
      const officeA: supabaseService.AppUser = {
        id: "office-a-uuid",
        username: "office_a",
        role: "staff",
        status: "active",
        phone: "+966501111111",
        has_google_service: true,
        google_spreadsheet_id: "sheet-a",
      };

      const officeB: supabaseService.AppUser = {
        id: "office-b-uuid",
        username: "office_b",
        role: "staff",
        status: "active",
        phone: "+966502222222",
        has_google_service: true,
        google_spreadsheet_id: "sheet-b",
      };

      vi.spyOn(supabaseService, "listSupabaseUsers").mockResolvedValue([officeA, officeB]);

      // Global setting with a third number that MUST NEVER be used
      vi.spyOn(settingsStore, "getSettings").mockReturnValue({
        whatsappNumber: "+966509999999",
      } as any);

      // Session in 12 hours (triggers 24h reminder)
      const now = new Date();
      const in12h = new Date(now.getTime() + 12 * 60 * 60 * 1000);
      const sessionA: Session = {
        id: 101,
        caseNumber: "CASE-A-1",
        sessionDateHijri: "15/02/1446",
        sessionTime: "12h",
        status: "Upcoming",
        reminder24: false,
        reminder6: false,
      } as Session;

      // Session in 3 hours (triggers 6h reminder)
      const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      const sessionB: Session = {
        id: 202,
        caseNumber: "CASE-B-2",
        sessionDateHijri: "15/02/1446",
        sessionTime: "3h",
        status: "Upcoming",
        reminder24: true, // 24h already sent
        reminder6: false,
      } as Session;

      vi.spyOn(hijriUtil, "computeHearingDateTime").mockImplementation((_d, t) => {
        if (t === "12h") return in12h;
        if (t === "3h") return in3h;
        return in12h;
      });

      // Mock listSessions per office
      const listSessionsSpy = vi.spyOn(sessionService, "listSessions").mockImplementation(async (arg1: any, arg2?: any) => {
        const targetOffice = typeof arg1 === "string" && !["Upcoming", "Today", "Finished", "Cancelled"].includes(arg1) ? arg1 : arg2;
        if (targetOffice === "office-a-uuid") return [sessionA];
        if (targetOffice === "office-b-uuid") return [sessionB];
        return [];
      });

      const markSentSpy = vi.spyOn(sessionService, "markReminderSent").mockResolvedValue(undefined);
      const notifySpy = vi.spyOn(reminderService, "notify").mockResolvedValue(undefined);

      const results = await reminderScheduler.runReminderSweep();

      // Must list sessions for both offices
      expect(listSessionsSpy).toHaveBeenCalledWith("office-a-uuid");
      expect(listSessionsSpy).toHaveBeenCalledWith("office-b-uuid");

      // Verify notifications sent with exact authorized recipient
      expect(notifySpy).toHaveBeenCalledTimes(2);

      // First notification must be for Office A to Office A's phone
      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          officeId: "office-a-uuid",
          recipientPhone: "+966501111111",
          sessionId: 101,
          kind: "24h",
        }),
        "office-a-uuid",
      );

      // Second notification must be for Office B to Office B's phone
      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          officeId: "office-b-uuid",
          recipientPhone: "+966502222222",
          sessionId: 202,
          kind: "6h",
        }),
        "office-b-uuid",
      );

      // Verify marks were office-scoped
      expect(markSentSpy).toHaveBeenCalledWith(101, "24h", "office-a-uuid");
      expect(markSentSpy).toHaveBeenCalledWith(202, "6h", "office-b-uuid");

      // Verify results summary
      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ officeId: "office-a-uuid", remindersFound: 1, sent: 1 }),
          expect.objectContaining({ officeId: "office-b-uuid", remindersFound: 1, sent: 1 }),
        ]),
      );
    });
  });

  describe("3. Broken / Missing Binding Handling", () => {
    it("skips office with missing or broken Google binding without stopping other offices", async () => {
      const officeBroken: supabaseService.AppUser = {
        id: "office-broken",
        username: "broken",
        role: "staff",
        status: "active",
        phone: "+966503333333",
        has_google_service: false,
        google_spreadsheet_id: null,
      };

      const officeValid: supabaseService.AppUser = {
        id: "office-valid",
        username: "valid",
        role: "staff",
        status: "active",
        phone: "+966504444444",
        has_google_service: true,
        google_spreadsheet_id: "sheet-valid",
      };

      vi.spyOn(supabaseService, "listSupabaseUsers").mockResolvedValue([officeBroken, officeValid]);

      vi.spyOn(sessionService, "listSessions").mockImplementation(async (arg1: any, arg2?: any) => {
        const targetOffice = typeof arg1 === "string" && !["Upcoming", "Today", "Finished", "Cancelled"].includes(arg1) ? arg1 : arg2;
        if (targetOffice === "office-broken") {
          throw new GoogleBindingMissingError("Binding missing for office-broken");
        }
        if (targetOffice === "office-valid") {
          return [];
        }
        return [];
      });

      const results = await reminderScheduler.runReminderSweep();

      // officeBroken should be recorded as skipped/failed due to binding
      const brokenResult = results.find((r) => r.officeId === "office-broken");
      expect(brokenResult).toBeDefined();
      expect(brokenResult?.sent).toBe(0);
      expect(brokenResult?.reason).toMatch(/Google.*binding.*missing|incomplete/i);

      // officeValid should still be processed
      const validResult = results.find((r) => r.officeId === "office-valid");
      expect(validResult).toBeDefined();
      expect(validResult?.failed).toBe(0);
    });
  });

  describe("4. Office Without Authorized Recipient Phone", () => {
    it("skips office without authorized phone number and NEVER falls back to global whatsapp number", async () => {
      const officeNoPhone: supabaseService.AppUser = {
        id: "office-no-phone",
        username: "no_phone",
        role: "staff",
        status: "active",
        phone: null, // No phone registered
        has_google_service: true,
        google_spreadsheet_id: "sheet-no-phone",
      };

      vi.spyOn(supabaseService, "listSupabaseUsers").mockResolvedValue([officeNoPhone]);
      vi.spyOn(settingsStore, "getSettings").mockReturnValue({
        whatsappNumber: "+966509999999", // Global number
      } as any);

      const in10h = new Date(Date.now() + 10 * 60 * 60 * 1000);
      vi.spyOn(hijriUtil, "computeHearingDateTime").mockReturnValue(in10h);
      vi.spyOn(sessionService, "listSessions").mockResolvedValue([
        {
          id: 303,
          caseNumber: "CASE-NO-PHONE",
          sessionDateHijri: "15/02/1446",
          sessionTime: "10:00",
          status: "Upcoming",
          reminder24: false,
          reminder6: false,
        } as Session,
      ]);

      const notifySpy = vi.spyOn(reminderService, "notify").mockResolvedValue(undefined);

      const results = await reminderScheduler.runReminderSweep();

      // Notification must NOT be sent to global number
      expect(notifySpy).not.toHaveBeenCalled();

      const res = results.find((r) => r.officeId === "office-no-phone");
      expect(res).toBeDefined();
      expect(res?.sent).toBe(0);
      expect(res?.skipped).toBeGreaterThanOrEqual(1);
      expect(res?.reason).toMatch(/recipient phone/i);
    });
  });

  describe("5. Error Isolation Between Offices", () => {
    it("unexpected error in one office does not abort processing of subsequent offices", async () => {
      const officeError: supabaseService.AppUser = {
        id: "office-err",
        username: "err_user",
        role: "staff",
        status: "active",
        phone: "+966505555555",
        has_google_service: true,
        google_spreadsheet_id: "sheet-err",
      };

      const officeOk: supabaseService.AppUser = {
        id: "office-ok",
        username: "ok_user",
        role: "staff",
        status: "active",
        phone: "+966506666666",
        has_google_service: true,
        google_spreadsheet_id: "sheet-ok",
      };

      vi.spyOn(supabaseService, "listSupabaseUsers").mockResolvedValue([officeError, officeOk]);

      vi.spyOn(sessionService, "listSessions").mockImplementation(async (arg1: any, arg2?: any) => {
        const targetOffice = typeof arg1 === "string" && !["Upcoming", "Today", "Finished", "Cancelled"].includes(arg1) ? arg1 : arg2;
        if (targetOffice === "office-err") {
          throw new Error("Network timeout contacting Google Sheets API");
        }
        return [];
      });

      const results = await reminderScheduler.runReminderSweep();

      const errRes = results.find((r) => r.officeId === "office-err");
      expect(errRes).toBeDefined();
      expect(errRes?.failed).toBe(1);

      const okRes = results.find((r) => r.officeId === "office-ok");
      expect(okRes).toBeDefined();
      expect(okRes?.failed).toBe(0);
    });
  });

  describe("6. WhatsappChannel Does Not Read Global Recipient", () => {
    it("WhatsappReminderChannel rejects or fails if recipientPhone is not provided in payload", async () => {
      vi.spyOn(settingsStore, "getSettings").mockReturnValue({
        whatsappNumber: "+966509999999", // Global number
      } as any);

      const channel = new WhatsappReminderChannel();

      // @ts-expect-error - payload missing recipientPhone
      await expect(channel.send({
        sessionId: 404,
        kind: "24h",
      })).rejects.toThrow(/recipient.*phone.*required/i);
    });
  });
});