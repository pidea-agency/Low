import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../app";
import { createSignedSessionCookie } from "../middlewares/auth.middleware";
import * as poaService from "../services/poa.sheets.service";
import * as googleSheetsService from "../services/googleSheets.service";
import {
  GoogleSheetsError,
  GoogleSheetsPermissionError,
  GoogleSheetsNotFoundError,
  GoogleSheetsNetworkError,
} from "../services/googleSheets.service";

describe("Power of Attorney (POA) Save Path & Error Handling (/api/poa)", () => {
  const testOfficeId = "local-lawyer-default";
  const authCookie = createSignedSessionCookie({
    username: "12345",
    userId: testOfficeId,
  });

  const officeBCookie = createSignedSessionCookie({
    username: "admin1",
    userId: "local-office-admin",
  });

  let originalAllowList: string | undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
    originalAllowList = process.env.GLOBAL_SHEET_ALLOWED_USER_IDS;
    process.env.GLOBAL_SHEET_ALLOWED_USER_IDS = `${testOfficeId},local-admin,12345,123456`;
  });

  afterEach(() => {
    process.env.GLOBAL_SHEET_ALLOWED_USER_IDS = originalAllowList;
  });

  describe("Validation & Required Fields", () => {
    it("rejects creation when clientName is empty with 400 and clear Arabic message", async () => {
      const res = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send({
          clientName: "   ",
          poaNumber: "4500123",
          issueDateHijri: "1446/01/01",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("اسم العميل");
    });

    it("rejects creation when poaNumber is empty with 400 and clear Arabic message", async () => {
      const res = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send({
          clientName: "أحمد محمد",
          poaNumber: "   ",
          issueDateHijri: "1446/01/01",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("رقم الوكالة");
    });
  });

  describe("Happy Path Save & Read-After-Write", () => {
    it("creates POA with exact UI payload, stamps office, verifies read-after-write, and returns 201", async () => {
      const uiPayload = {
        clientName: "شركة الفحص القانوني",
        poaNumber: "QA-DIAG-998877",
        issueDateHijri: "1446/02/15",
        expiryDateHijri: "1447/02/15",
        daysRemaining: 350,
        notes: "وكالة عامة للمرافعة والمدافعة",
      };

      const mockRowId = 22;
      const mockValues = [
        uiPayload.clientName,
        uiPayload.poaNumber,
        uiPayload.issueDateHijri,
        uiPayload.expiryDateHijri,
        String(uiPayload.daysRemaining),
        uiPayload.notes,
        "2026-11-02T10:00:00.000Z",
        testOfficeId,
      ];

      vi.spyOn(poaService, "ensurePoaSheetReady").mockResolvedValue(undefined);
      const appendSpy = vi.spyOn(poaService, "appendPoaRow").mockResolvedValue(mockRowId);
      const getSpy = vi.spyOn(poaService, "getPoaRowById").mockResolvedValue({
        id: mockRowId,
        values: mockValues,
      });

      const res = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send(uiPayload);

      expect(res.status).toBe(201);
      expect(res.body.sheetRowId).toBe(mockRowId);
      expect(res.body.clientName).toBe(uiPayload.clientName);
      expect(res.body.poaNumber).toBe(uiPayload.poaNumber);
      expect(res.body.issueDateHijri).toBe(uiPayload.issueDateHijri);
      expect(res.body.expiryDateHijri).toBe(uiPayload.expiryDateHijri);
      expect(res.body.notes).toBe(uiPayload.notes);
      expect(res.body.officeId).toBe(testOfficeId);

      // Verify appendPoaRow received the row stamped with officeId
      expect(appendSpy).toHaveBeenCalledWith(
        testOfficeId,
        expect.arrayContaining([uiPayload.clientName, uiPayload.poaNumber, testOfficeId])
      );

      // Verify read-after-write was called to confirm POA exists before replying with 201
      expect(getSpy).toHaveBeenCalledWith(testOfficeId, mockRowId);
    });

    it("fails with 502 if read-after-write verification fails to confirm row existence", async () => {
      vi.spyOn(poaService, "ensurePoaSheetReady").mockResolvedValue(undefined);
      vi.spyOn(poaService, "appendPoaRow").mockResolvedValue(99);
      // getPoaRowById returns null -> write confirmation failed
      vi.spyOn(poaService, "getPoaRowById").mockResolvedValue(null);

      const res = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send({
          clientName: "شركة وهمية",
          poaNumber: "QA-GHOST-1",
        });

      expect(res.status).toBe(502);
      expect(res.body).toHaveProperty("refId");
      expect(res.body.error).toContain("تعذر التحقق من وجودها في الشيت");
    });

    it("ensures record of Office A never appears in Office B's list", async () => {
      const officeARow = {
        id: 10,
        values: [
          "موكل خاص بمكتب أ",
          "POA-A-1",
          "1446/01/01",
          "1447/01/01",
          "300",
          "سري للغاية",
          "2026-11-02T10:00:00.000Z",
          testOfficeId,
        ],
      };

      vi.spyOn(poaService, "ensurePoaSheetReady").mockResolvedValue(undefined);
      vi.spyOn(poaService, "listPoaRows").mockImplementation(async (officeId: string) => {
        if (officeId === testOfficeId) {
          return [officeARow];
        }
        return []; // Office B gets only Office B records
      });

      // Office A requests list
      const resA = await request(app).get("/api/poa").set("Cookie", authCookie);
      expect(resA.status).toBe(200);
      expect(resA.body).toHaveLength(1);
      expect(resA.body[0].poaNumber).toBe("POA-A-1");

      // Office B requests list
      const resB = await request(app).get("/api/poa").set("Cookie", officeBCookie);
      expect(resB.status).toBe(200);
      expect(resB.body).toHaveLength(0);
    });
  });

  describe("Google Sheets Failure Classification & Error Handling", () => {
    it("maps Google Permission Error to 503 with reference ID and user-facing Arabic message", async () => {
      vi.spyOn(poaService, "ensurePoaSheetReady").mockResolvedValue(undefined);
      vi.spyOn(poaService, "appendPoaRow").mockRejectedValue(
        new GoogleSheetsPermissionError("The caller does not have permission")
      );

      const res = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send({
          clientName: "شركة تجريبية",
          poaNumber: "QA-PERM-1",
        });

      expect(res.status).toBe(503);
      expect(res.body).toHaveProperty("refId");
      expect(res.body.refId).toMatch(/^REF-/);
      expect(res.body.error).toContain("تعذر الوصول إلى جدول البيانات");
      expect(res.body.error).toContain("رقم المرجع:");
      expect(res.body.error).toContain(res.body.refId);
    });

    it("maps Google Spreadsheet Not Found Error to 502 with reference ID", async () => {
      vi.spyOn(poaService, "ensurePoaSheetReady").mockResolvedValue(undefined);
      vi.spyOn(poaService, "appendPoaRow").mockRejectedValue(
        new GoogleSheetsNotFoundError("Requested entity was not found")
      );

      const res = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send({
          clientName: "شركة تجريبية",
          poaNumber: "QA-NOTFOUND-1",
        });

      expect(res.status).toBe(502);
      expect(res.body).toHaveProperty("refId");
      expect(res.body.refId).toMatch(/^REF-/);
      expect(res.body.error).toContain("رقم المرجع:");
    });

    it("maps Google Network/Timeout Error to 504 with reference ID", async () => {
      vi.spyOn(poaService, "ensurePoaSheetReady").mockResolvedValue(undefined);
      vi.spyOn(poaService, "appendPoaRow").mockRejectedValue(
        new GoogleSheetsNetworkError("ETIMEDOUT: Connection to googleapis.com timed out")
      );

      const res = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send({
          clientName: "شركة تجريبية",
          poaNumber: "QA-TIMEOUT-1",
        });

      expect(res.status).toBe(504);
      expect(res.body).toHaveProperty("refId");
      expect(res.body.refId).toMatch(/^REF-/);
      expect(res.body.error).toContain("انتهاء المهلة");
      expect(res.body.error).toContain("رقم المرجع:");
    });

    it("handles unexpected generic error by returning 500 with generated refId without leaking stack trace", async () => {
      vi.spyOn(poaService, "ensurePoaSheetReady").mockResolvedValue(undefined);
      vi.spyOn(poaService, "appendPoaRow").mockRejectedValue(
        new Error("Low level crash on row calculation with secret key ABC123XYZ")
      );

      const res = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send({
          clientName: "شركة تجريبية",
          poaNumber: "QA-CRASH-1",
        });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("refId");
      expect(res.body.refId).toMatch(/^REF-/);
      expect(res.body.error).toContain("فشل حفظ الوكالة.");
      expect(res.body.error).toContain("رقم المرجع:");
      expect(res.body.error).not.toContain("ABC123XYZ");
      expect(res.body.error).not.toContain("stack");
    });
  });
});
