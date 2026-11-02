import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../app";
import { createSignedSessionCookie } from "../middlewares/auth.middleware";
import * as judgmentService from "../services/judgment.sheets.service";
import * as googleSheetsService from "../services/googleSheets.service";
import {
  GoogleSheetsError,
  GoogleSheetsPermissionError,
  GoogleSheetsNotFoundError,
  GoogleSheetsNetworkError,
} from "../services/googleSheets.service";

describe("Judgment Save Path & Error Handling (/api/judgments)", () => {
  const testOfficeId = "local-lawyer-default";
  const authCookie = createSignedSessionCookie({
    username: "12345",
    userId: testOfficeId,
  });

  let originalAllowList: string | undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
    originalAllowList = process.env.GLOBAL_SHEET_ALLOWED_USER_IDS;
    process.env.GLOBAL_SHEET_ALLOWED_USER_IDS = testOfficeId;
  });

  afterEach(() => {
    process.env.GLOBAL_SHEET_ALLOWED_USER_IDS = originalAllowList;
  });

  describe("Validation & Required Fields", () => {
    it("rejects creation when caseNumber is empty with 400 and clear Arabic message", async () => {
      const res = await request(app)
        .post("/api/judgments")
        .set("Cookie", authCookie)
        .send({
          caseNumber: "   ",
          judgmentNumber: "443012948",
          court: "المحكمة العامة",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("رقم القضية مطلوب.");
    });

    it("rejects creation when judgmentNumber is empty with 400 and clear Arabic message", async () => {
      const res = await request(app)
        .post("/api/judgments")
        .set("Cookie", authCookie)
        .send({
          caseNumber: "44109283",
          judgmentNumber: "   ",
          court: "المحكمة العامة",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("رقم الصك مطلوب.");
    });
  });

  describe("Happy Path Save & Read-After-Write", () => {
    it("creates judgment with exact UI payload, stamps office, verifies read-after-write, and returns 201", async () => {
      const uiPayload = {
        caseNumber: "44109283",
        judgmentNumber: "443012948",
        court: "المحكمة العامة بالرياض",
        plaintiff: "شركة التقنية",
        defendant: "مؤسسة التوريد",
        assignedLawyer: "المحامي خالد",
        judgmentDate: "1447/08/10",
        summary: "إلزام المدعى عليه بسداد المستحقات",
        isFavorable: "نهائي",
      };

      const mockRowId = 15;
      const mockHeaders = [
        "رقم القضية",
        "المحكمة المختصة",
        "المدعي",
        "المدعى عليه",
        "المحامي المكلف",
        "رقم الصك",
        "تاريخ الحكم",
        "ملخص الحكم",
        "الحكم",
        "تاريخ الإنشاء",
        "معرف المكتب",
      ];
      const mockValues = [
        uiPayload.caseNumber,
        uiPayload.court,
        uiPayload.plaintiff,
        uiPayload.defendant,
        uiPayload.assignedLawyer,
        uiPayload.judgmentNumber,
        uiPayload.judgmentDate,
        uiPayload.summary,
        uiPayload.isFavorable,
        "2026-11-02T10:00:00.000Z",
        testOfficeId,
      ];

      vi.spyOn(judgmentService, "ensureJudgmentSheetReady").mockResolvedValue(undefined);
      const appendSpy = vi.spyOn(judgmentService, "appendJudgmentRow").mockResolvedValue(mockRowId);
      const getSpy = vi.spyOn(judgmentService, "getJudgmentRowById").mockResolvedValue({
        id: mockRowId,
        values: mockValues,
        headers: mockHeaders,
      });

      const res = await request(app)
        .post("/api/judgments")
        .set("Cookie", authCookie)
        .send(uiPayload);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(mockRowId);
      expect(res.body.caseNumber).toBe(uiPayload.caseNumber);
      expect(res.body.judgmentNumber).toBe(uiPayload.judgmentNumber);
      expect(res.body.court).toBe(uiPayload.court);
      expect(res.body.summary).toBe(uiPayload.summary);
      expect(res.body.officeId).toBe(testOfficeId);

      // Verify appendJudgmentRow received the row stamped with officeId in column 10 (Col K)
      expect(appendSpy).toHaveBeenCalledWith(
        testOfficeId,
        expect.arrayContaining([uiPayload.caseNumber, uiPayload.judgmentNumber, testOfficeId])
      );

      // Verify read-after-write was called to confirm judgment exists before 201 response
      expect(getSpy).toHaveBeenCalledWith(testOfficeId, mockRowId);
    });
  });

  describe("Google Sheets Failure Classification & Error Handling", () => {
    it("maps Google Permission Error to 503 with reference ID and user-facing Arabic message", async () => {
      vi.spyOn(judgmentService, "ensureJudgmentSheetReady").mockResolvedValue(undefined);
      vi.spyOn(judgmentService, "appendJudgmentRow").mockRejectedValue(
        new GoogleSheetsPermissionError("The caller does not have permission")
      );

      const res = await request(app)
        .post("/api/judgments")
        .set("Cookie", authCookie)
        .send({
          caseNumber: "44109283",
          judgmentNumber: "443012948",
          court: "المحكمة العامة",
        });

      expect(res.status).toBe(503);
      expect(res.body).toHaveProperty("refId");
      expect(res.body.refId).toMatch(/^REF-/);
      expect(res.body.error).toContain("تعذر الوصول إلى جدول البيانات");
      expect(res.body.error).toContain("رقم المرجع:");
      expect(res.body.error).toContain(res.body.refId);
    });

    it("maps Google Spreadsheet Not Found Error to 502 with reference ID", async () => {
      vi.spyOn(judgmentService, "ensureJudgmentSheetReady").mockResolvedValue(undefined);
      vi.spyOn(judgmentService, "appendJudgmentRow").mockRejectedValue(
        new GoogleSheetsNotFoundError("Requested entity was not found")
      );

      const res = await request(app)
        .post("/api/judgments")
        .set("Cookie", authCookie)
        .send({
          caseNumber: "44109283",
          judgmentNumber: "443012948",
          court: "المحكمة العامة",
        });

      expect(res.status).toBe(502);
      expect(res.body).toHaveProperty("refId");
      expect(res.body.refId).toMatch(/^REF-/);
      expect(res.body.error).toContain("جدول البيانات غير موجود");
      expect(res.body.error).toContain("رقم المرجع:");
    });

    it("maps Google Network/Timeout Error to 504 with reference ID", async () => {
      vi.spyOn(judgmentService, "ensureJudgmentSheetReady").mockResolvedValue(undefined);
      vi.spyOn(judgmentService, "appendJudgmentRow").mockRejectedValue(
        new GoogleSheetsNetworkError("ETIMEDOUT network connection failed")
      );

      const res = await request(app)
        .post("/api/judgments")
        .set("Cookie", authCookie)
        .send({
          caseNumber: "44109283",
          judgmentNumber: "443012948",
          court: "المحكمة العامة",
        });

      expect(res.status).toBe(504);
      expect(res.body).toHaveProperty("refId");
      expect(res.body.refId).toMatch(/^REF-/);
      expect(res.body.error).toContain("تعذر الاتصال بخوادم Google");
      expect(res.body.error).toContain("رقم المرجع:");
    });

    it("handles unexpected generic error by returning 500 with generated refId without leaking stack trace", async () => {
      vi.spyOn(judgmentService, "ensureJudgmentSheetReady").mockResolvedValue(undefined);
      vi.spyOn(judgmentService, "appendJudgmentRow").mockRejectedValue(
        new Error("Low level crash on row calculation with secret key ABC123XYZ")
      );

      const res = await request(app)
        .post("/api/judgments")
        .set("Cookie", authCookie)
        .send({
          caseNumber: "44109283",
          judgmentNumber: "443012948",
          court: "المحكمة العامة",
        });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("refId");
      expect(res.body.refId).toMatch(/^REF-/);
      expect(res.body.error).toContain("فشل حفظ الحكم.");
      expect(res.body.error).toContain("رقم المرجع:");
      expect(res.body.error).toContain(res.body.refId);
      // No internal crash details or secret tokens leaked
      expect(res.body.error).not.toContain("Low level crash");
      expect(res.body.error).not.toContain("ABC123XYZ");
    });
  });
});

