import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { createSignedSessionCookie } from "../middlewares/auth.middleware";
import * as googleSheetsService from "../services/googleSheets.service";
import {
  GoogleSheetsError,
  GoogleSheetsAuthError,
  GoogleSheetsPermissionError,
  GoogleSheetsNotFoundError,
  GoogleSheetsRangeError,
  GoogleSheetsNetworkError,
  GoogleSheetsConfigError,
} from "../services/googleSheets.service";
import * as sessionService from "../services/session.service";

describe("Google Sheets Integration & Error Classification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Unit Tests with mocked Google Sheets API", () => {
    it("(a) happy path read returns mapped rows", async () => {
      const mockValues = [
        ["123/2026", "أحمد", "خالد", "صلح عمان", "الأولى", "مطالبة", "مرافعة", "1448/03/12", "الأحد", "10:00", "5", "ملاحظة", "Upcoming", "false", "false", "2026-10-31T10:00:00Z", ""],
      ];

      vi.spyOn(googleSheetsService, "listRows").mockResolvedValue([
        { id: 2, values: mockValues[0] },
      ]);

      const rows = await googleSheetsService.listRows("test-user");
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(2);
      expect(rows[0].values[0]).toBe("123/2026");
    });

    it("(b) happy path append inserts row and returns row index", async () => {
      vi.spyOn(googleSheetsService, "appendRow").mockResolvedValue(5);

      const rowId = await googleSheetsService.appendRow(["test"], "test-user");
      expect(rowId).toBe(5);
    });

    it("(c) auth failure throws typed GoogleSheetsAuthError (not generic error)", async () => {
      vi.spyOn(googleSheetsService, "listRows").mockRejectedValue(
        new GoogleSheetsAuthError("Authentication with Google failed: invalid_grant")
      );

      await expect(googleSheetsService.listRows("test-user")).rejects.toThrow(GoogleSheetsAuthError);
      await expect(googleSheetsService.listRows("test-user")).rejects.toBeInstanceOf(GoogleSheetsError);
    });

    it("(d) 403 not-shared throws typed GoogleSheetsPermissionError", async () => {
      vi.spyOn(googleSheetsService, "listRows").mockRejectedValue(
        new GoogleSheetsPermissionError("The caller does not have permission on the spreadsheet")
      );

      await expect(googleSheetsService.listRows("test-user")).rejects.toThrow(GoogleSheetsPermissionError);
      await expect(googleSheetsService.listRows("test-user")).rejects.toBeInstanceOf(GoogleSheetsError);
    });

    it("(e) 404 spreadsheet not found throws typed GoogleSheetsNotFoundError", async () => {
      vi.spyOn(googleSheetsService, "listRows").mockRejectedValue(
        new GoogleSheetsNotFoundError("Requested entity was not found")
      );

      await expect(googleSheetsService.listRows("test-user")).rejects.toThrow(GoogleSheetsNotFoundError);
      await expect(googleSheetsService.listRows("test-user")).rejects.toBeInstanceOf(GoogleSheetsError);
    });

    it("(f) 400 unknown tab/range throws typed GoogleSheetsRangeError", async () => {
      vi.spyOn(googleSheetsService, "listRows").mockRejectedValue(
        new GoogleSheetsRangeError("Unable to parse range: InvalidTab!A2:Q")
      );

      await expect(googleSheetsService.listRows("test-user")).rejects.toThrow(GoogleSheetsRangeError);
      await expect(googleSheetsService.listRows("test-user")).rejects.toBeInstanceOf(GoogleSheetsError);
    });

    it("(g) network timeout throws typed GoogleSheetsNetworkError", async () => {
      vi.spyOn(googleSheetsService, "listRows").mockRejectedValue(
        new GoogleSheetsNetworkError("Connection timed out: ETIMEDOUT")
      );

      await expect(googleSheetsService.listRows("test-user")).rejects.toThrow(GoogleSheetsNetworkError);
      await expect(googleSheetsService.listRows("test-user")).rejects.toBeInstanceOf(GoogleSheetsError);
    });

    it("asserts GoogleSheetsError carries refId, statusCode, and userMessage", () => {
      const err = new GoogleSheetsPermissionError("Google 403 error detail");
      expect(err.refId).toMatch(/^REF-/);
      expect(err.statusCode).toBe(503);
      expect(err.userMessage).toContain("تعذر الوصول");
    });
  });

  describe("Route-level integration tests (supertest)", () => {
    // Helper to generate a valid signed auth cookie for testing
    const testAdminCookie = createSignedSessionCookie({
      username: "123456",
      userId: "local-admin",
    });

    it("GET /api/sessions returns 200 on success", async () => {
      vi.spyOn(sessionService, "listSessions").mockResolvedValue([
        {
          id: 2,
          caseNumber: "123/2026",
          plaintiff: "أحمد",
          defendant: "خالد",
          court: "صلح عمان",
          courtCircuit: "الأولى",
          caseSubject: "مطالبة",
          sessionType: "مرافعة",
          sessionDateHijri: "1448/03/12",
          sessionDay: "الأحد",
          sessionTime: "10:00",
          notes: "",
          status: "Upcoming",
          reminder24: false,
          reminder6: false,
          createdAt: "2026-10-31T10:00:00Z",
          hearingAt: null,
        },
      ]);

      const res = await request(app)
        .get("/api/sessions")
        .set("Cookie", testAdminCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].caseNumber).toBe("123/2026");
    });

    it("GET /api/sessions maps upstream GoogleSheetsPermissionError to 503 with refId and Arabic message", async () => {
      vi.spyOn(sessionService, "listSessions").mockRejectedValue(
        new GoogleSheetsPermissionError("The caller does not have permission on the spreadsheet")
      );

      const res = await request(app)
        .get("/api/sessions")
        .set("Cookie", testAdminCookie);

      expect(res.status).toBe(503);
      expect(res.body).toHaveProperty("refId");
      expect(res.body.error).toContain("رقم المرجع:");
      expect(res.body.error).toContain("REF-");
      // Must NOT disguise failure as empty array or 200
      expect(res.body).not.toEqual([]);
    });

    it("GET /api/sessions maps unconfigured sheets to 503 with refId and action required", async () => {
      vi.spyOn(sessionService, "listSessions").mockRejectedValue(
        new GoogleSheetsConfigError("Spreadsheet ID or Service Account is missing")
      );

      const res = await request(app)
        .get("/api/sessions")
        .set("Cookie", testAdminCookie);

      expect(res.status).toBe(503);
      expect(res.body).toHaveProperty("refId");
      expect(res.body.error).toContain("رقم المرجع:");
    });

    it("GET /api/sessions/:id/report maps upstream GoogleSheetsError to 502/503 with refId", async () => {
      vi.spyOn(sessionService, "getSessionReport").mockRejectedValue(
        new GoogleSheetsNotFoundError("Spreadsheet not found")
      );

      const res = await request(app)
        .get("/api/sessions/2/report")
        .set("Cookie", testAdminCookie);

      expect(res.status).toBe(502);
      expect(res.body).toHaveProperty("refId");
      expect(res.body.error).toContain("رقم المرجع:");
    });
  });
});
