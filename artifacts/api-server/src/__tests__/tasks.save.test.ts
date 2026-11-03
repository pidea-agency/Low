import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import app from "../app";
import { createSignedSessionCookie } from "../middlewares/auth.middleware";
import * as taskService from "../services/task.sheets.service";
import * as googleSheetsService from "../services/googleSheets.service";
import {
  GoogleSheetsError,
  GoogleSheetsPermissionError,
  GoogleSheetsNotFoundError,
  GoogleSheetsNetworkError,
} from "../services/googleSheets.service";

describe("Task Save Path & Error Handling (/api/tasks)", () => {
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

  describe("Validation & Empty Title", () => {
    it("rejects task creation with empty title with 400 and clear Arabic message", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .set("Cookie", authCookie)
        .send({
          title: "   ",
          assignee: "محامي",
          priority: "عادية",
          dueDate: "2026-11-20",
          status: "قيد التنفيذ",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("عنوان المهمة مطلوب.");
    });
  });

  describe("Happy Path Save & Read-After-Write", () => {
    it("creates task with exact UI payload, stamps office, verifies read-after-write, and returns 201", async () => {
      const uiPayload = {
        title: "مهمة إعداد مذكرة دفاع QA",
        assignee: "المحامي أحمد",
        priority: "عاجلة",
        dueDate: "2026-11-25",
        status: "قيد التنفيذ",
        notes: "ملاحظة هامة",
        reminderSent: false,
      };

      const mockRowId = 42;
      const mockHeaders = [
        "عنوان المهمة",
        "المكلف",
        "الأولوية",
        "تاريخ التسليم",
        "عدد الأيام المتبقية",
        "الحالة",
        "ملاحظات",
        "تاريخ الإنشاء",
        "معرف المكتب",
      ];
      const mockValues = [
        uiPayload.title,
        uiPayload.assignee,
        uiPayload.priority,
        uiPayload.dueDate,
        "23 يوم",
        uiPayload.status,
        uiPayload.notes,
        "2026-11-02T10:00:00.000Z",
        testOfficeId,
      ];

      vi.spyOn(taskService, "ensureTaskSheetReady").mockResolvedValue(undefined);
      const appendSpy = vi.spyOn(taskService, "appendTaskRow").mockResolvedValue(mockRowId);
      const getSpy = vi.spyOn(taskService, "getTaskRowById").mockResolvedValue({
        id: mockRowId,
        values: mockValues,
        headers: mockHeaders,
      });

      const res = await request(app)
        .post("/api/tasks")
        .set("Cookie", authCookie)
        .send(uiPayload);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(mockRowId);
      expect(res.body.title).toBe(uiPayload.title);
      expect(res.body.assignee).toBe(uiPayload.assignee);
      expect(res.body.priority).toBe(uiPayload.priority);
      expect(res.body.dueDate).toBe(uiPayload.dueDate);
      expect(res.body.status).toBe(uiPayload.status);
      expect(res.body.officeId).toBe(testOfficeId);

      // Verify appendTaskRow received the row stamped with officeId in column 8 (Col I)
      expect(appendSpy).toHaveBeenCalledWith(
        testOfficeId,
        expect.arrayContaining([uiPayload.title, uiPayload.assignee, testOfficeId])
      );

      // Verify read-after-write was called to confirm task exists before 201 response
      expect(getSpy).toHaveBeenCalledWith(testOfficeId, mockRowId);
    });
  });

  describe("Google Sheets Failure Classification & Error Handling", () => {
    it("maps Google Permission Error to 503 with reference ID and user-facing Arabic message", async () => {
      vi.spyOn(taskService, "ensureTaskSheetReady").mockResolvedValue(undefined);
      vi.spyOn(taskService, "appendTaskRow").mockRejectedValue(
        new GoogleSheetsPermissionError("The caller does not have permission")
      );

      const res = await request(app)
        .post("/api/tasks")
        .set("Cookie", authCookie)
        .send({
          title: "مهمة اختبار الصلاحيات",
          assignee: "محامي",
          priority: "عادية",
          dueDate: "2026-11-20",
          status: "قيد التنفيذ",
        });

      expect(res.status).toBe(503);
      expect(res.body).toHaveProperty("refId");
      expect(res.body.refId).toMatch(/^REF-/);
      expect(res.body.error).toContain("تعذر الوصول إلى جدول البيانات");
      expect(res.body.error).toContain("رقم المرجع:");
      expect(res.body.error).toContain(res.body.refId);
    });

    it("maps Google Spreadsheet Not Found Error to 502 with reference ID", async () => {
      vi.spyOn(taskService, "ensureTaskSheetReady").mockResolvedValue(undefined);
      vi.spyOn(taskService, "appendTaskRow").mockRejectedValue(
        new GoogleSheetsNotFoundError("Requested entity was not found")
      );

      const res = await request(app)
        .post("/api/tasks")
        .set("Cookie", authCookie)
        .send({
          title: "مهمة اختبار الجدول مفقود",
          assignee: "محامي",
          priority: "عادية",
          dueDate: "2026-11-20",
          status: "قيد التنفيذ",
        });

      expect(res.status).toBe(502);
      expect(res.body).toHaveProperty("refId");
      expect(res.body.refId).toMatch(/^REF-/);
      expect(res.body.error).toContain("جدول البيانات غير موجود");
      expect(res.body.error).toContain("رقم المرجع:");
    });

    it("maps Google Network/Timeout Error to 504 with reference ID", async () => {
      vi.spyOn(taskService, "ensureTaskSheetReady").mockResolvedValue(undefined);
      vi.spyOn(taskService, "appendTaskRow").mockRejectedValue(
        new GoogleSheetsNetworkError("ETIMEDOUT network connection failed")
      );

      const res = await request(app)
        .post("/api/tasks")
        .set("Cookie", authCookie)
        .send({
          title: "مهمة اختبار انقطاع الشبكة",
          assignee: "محامي",
          priority: "عادية",
          dueDate: "2026-11-20",
          status: "قيد التنفيذ",
        });

      expect(res.status).toBe(504);
      expect(res.body).toHaveProperty("refId");
      expect(res.body.refId).toMatch(/^REF-/);
      expect(res.body.error).toContain("تعذر الاتصال بخوادم Google");
      expect(res.body.error).toContain("رقم المرجع:");
    });

    it("handles unexpected generic error by returning 500 with generated refId without leaking stack trace", async () => {
      vi.spyOn(taskService, "ensureTaskSheetReady").mockResolvedValue(undefined);
      vi.spyOn(taskService, "appendTaskRow").mockRejectedValue(
        new Error("Unexpected low-level internal crash at line 999 with secret token XYZ")
      );

      const res = await request(app)
        .post("/api/tasks")
        .set("Cookie", authCookie)
        .send({
          title: "مهمة اختبار خطأ غير متوقع",
          assignee: "محامي",
          priority: "عادية",
          dueDate: "2026-11-20",
          status: "قيد التنفيذ",
        });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("refId");
      expect(res.body.refId).toMatch(/^REF-/);
      expect(res.body.error).toContain("فشل حفظ المهمة.");
      expect(res.body.error).toContain("رقم المرجع:");
      expect(res.body.error).toContain(res.body.refId);
      // No internal crash details or secret tokens leaked
      expect(res.body.error).not.toContain("Unexpected low-level internal crash");
      expect(res.body.error).not.toContain("XYZ");
    });
  });

  describe("Service Layer Google API Classification (task.sheets.service.ts)", () => {
    it("classifyGoogleError correctly classifies raw Gaxios network/permission errors in task operations", async () => {
      const rawGaxiosError = {
        name: "Error",
        message: "request to https://oauth2.googleapis.com/token failed, reason: Client network socket disconnected",
        code: "ECONNRESET",
      };

      const classified = googleSheetsService.classifyGoogleError(
        rawGaxiosError,
        "appendTaskRow", 
        { sheetName: "Tasks", userId: testOfficeId }
      );

      expect(classified).toBeInstanceOf(GoogleSheetsNetworkError);
      expect(classified.statusCode).toBe(504);
      expect(classified.refId).toMatch(/^REF-/);
    });
  }); 
});
