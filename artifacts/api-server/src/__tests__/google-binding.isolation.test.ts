import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";
import * as googleSheetsService from "../services/googleSheets.service";
import * as sessionService from "../services/session.service";
import * as poaService from "../services/poa.sheets.service";
import * as taskService from "../services/task.sheets.service";
import * as judgmentService from "../services/judgment.sheets.service";
import { env } from "../config/env";

describe("Office Google Binding Enforcement and Global Sheet Isolation", { timeout: 30000 }, () => {
  const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  let userNoBinding: any;
  let cookieNoBinding: string;

  let userPartialBinding: any;
  let cookiePartialBinding: string;

  let userAllowedGlobal: any;
  let cookieAllowedGlobal: string;

  let userCompleteBinding: any;
  let cookieCompleteBinding: string;

  const validServiceAccount = {
    type: "service_account",
    project_id: "test-user-project",
    private_key_id: "12345",
    private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDC68qyJ4HNS5S8\n-----END PRIVATE KEY-----\n",
    client_email: "custom-user@test-user-project.iam.gserviceaccount.com",
    client_id: "123456789",
  };

  beforeAll(async () => {
    // 1. User with NO Google binding
    const unameNoBinding = `nobind_${Date.now()}`;
    userNoBinding = await supabaseService.createSupabaseUser({
      username: unameNoBinding,
      password: "OfficePass123!",
      role: "staff",
      subscription_end_date: futureDate,
    });
    const loginNo = await request(app)
      .post("/api/auth/login")
      .send({ username: unameNoBinding, password: "OfficePass123!" });
    const cNo = loginNo.headers["set-cookie"];
    cookieNoBinding = Array.isArray(cNo) ? cNo.join("; ") : cNo;

    // 2. User with PARTIAL binding (spreadsheetId only, no service account)
    const unamePartial = `partial_${Date.now()}`;
    userPartialBinding = await supabaseService.createSupabaseUser({
      username: unamePartial,
      password: "OfficePass123!",
      role: "staff",
      subscription_end_date: futureDate,
      google_spreadsheet_id: "partial-spreadsheet-id-12345",
    });
    const loginPart = await request(app)
      .post("/api/auth/login")
      .send({ username: unamePartial, password: "OfficePass123!" });
    const cPart = loginPart.headers["set-cookie"];
    cookiePartialBinding = Array.isArray(cPart) ? cPart.join("; ") : cPart;

    // 3. User explicitly on GLOBAL allow-list
    const unameAllowed = `allowed_${Date.now()}`;
    userAllowedGlobal = await supabaseService.createSupabaseUser({
      username: unameAllowed,
      password: "OfficePass123!",
      role: "staff",
      subscription_end_date: futureDate,
    });
    const loginAllowed = await request(app)
      .post("/api/auth/login")
      .send({ username: unameAllowed, password: "OfficePass123!" });
    const cAllowed = loginAllowed.headers["set-cookie"];
    cookieAllowedGlobal = Array.isArray(cAllowed) ? cAllowed.join("; ") : cAllowed;

    // 4. User with COMPLETE binding
    const unameComplete = `complete_${Date.now()}`;
    userCompleteBinding = await supabaseService.createSupabaseUser({
      username: unameComplete,
      password: "OfficePass123!",
      role: "staff",
      subscription_end_date: futureDate,
      google_spreadsheet_id: "custom-user-spreadsheet-id-9999",
      google_service_account_json: JSON.stringify(validServiceAccount),
      google_sheet_name: "Sessions",
    });
    const loginComp = await request(app)
      .post("/api/auth/login")
      .send({ username: unameComplete, password: "OfficePass123!" });
    const cComp = loginComp.headers["set-cookie"];
    cookieCompleteBinding = Array.isArray(cComp) ? cComp.join("; ") : cComp;
  });

  afterAll(async () => {
    if (userNoBinding?.id) await supabaseService.deleteSupabaseUser(userNoBinding.id).catch(() => {});
    if (userPartialBinding?.id) await supabaseService.deleteSupabaseUser(userPartialBinding.id).catch(() => {});
    if (userAllowedGlobal?.id) await supabaseService.deleteSupabaseUser(userAllowedGlobal.id).catch(() => {});
    if (userCompleteBinding?.id) await supabaseService.deleteSupabaseUser(userCompleteBinding.id).catch(() => {});
  });

  describe("getGoogleContext Unit Level Checks", () => {
    it("throws GoogleBindingMissingError when user has NO binding, never returns global fallback", async () => {
      // Must throw GoogleBindingMissingError and NOT return global context
      await expect(googleSheetsService.getGoogleContext(userNoBinding.id)).rejects.toThrow(
        /GoogleBindingMissingError|ربط المكتب غير مكتمل/,
      );
    });

    it("throws GoogleBindingMissingError when user has PARTIAL binding (missing credentials)", async () => {
      await expect(googleSheetsService.getGoogleContext(userPartialBinding.id)).rejects.toThrow(
        /GoogleBindingMissingError|ربط المكتب غير مكتمل/,
      );
    });

    it("throws 503 error when settings store / database is unreachable during lookup", async () => {
      vi.spyOn(supabaseService, "getUserGoogleCredentials").mockRejectedValueOnce(
        new Error("Database connection timeout"),
      );

      await expect(googleSheetsService.getGoogleContext("any-user-id")).rejects.toThrow();
    });

    it("builds context from user's own settings when binding is complete", async () => {
      const ctx = await googleSheetsService.getGoogleContext(userCompleteBinding.id);
      expect(ctx.spreadsheetId).toBe("custom-user-spreadsheet-id-9999");
      expect(ctx.sheets).toBeDefined();
    });

    it("allows global sheet context ONLY for accounts on GLOBAL_SHEET_ALLOWED_USER_IDS allow-list", async () => {
      // Temporarily mock allow-list to include userAllowedGlobal.id
      vi.spyOn(env, "globalSheetAllowedUserIds", "get").mockReturnValue([userAllowedGlobal.id]);

      const ctx = await googleSheetsService.getGoogleContext(userAllowedGlobal.id);
      expect(ctx.spreadsheetId).toBe(env.googleSpreadsheetId);
    });

    it("rejects an account NOT on the allow-list even if global fallback exists", async () => {
      vi.spyOn(env, "globalSheetAllowedUserIds", "get").mockReturnValue(["some-other-id"]);

      await expect(googleSheetsService.getGoogleContext(userNoBinding.id)).rejects.toThrow(
        /GoogleBindingMissingError|ربط المكتب غير مكتمل/,
      );
    });
  });

  describe("Route-level enforcement (HTTP 409 and Arabic error message)", () => {
    it("GET /api/sessions returns 409 with Arabic message for user without binding", async () => {
      const res = await request(app)
        .get("/api/sessions")
        .set("Cookie", cookieNoBinding);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("ربط المكتب غير مكتمل. تواصل مع المشرف");
      expect(res.body.refId).toBeDefined();
    });

    it("GET /api/poa returns 409 with Arabic message for user without binding", async () => {
      const res = await request(app)
        .get("/api/poa")
        .set("Cookie", cookieNoBinding);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("ربط المكتب غير مكتمل. تواصل مع المشرف");
    });

    it("GET /api/tasks returns 409 with Arabic message for user without binding", async () => {
      const res = await request(app)
        .get("/api/tasks")
        .set("Cookie", cookieNoBinding);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("ربط المكتب غير مكتمل. تواصل مع المشرف");
    });

    it("GET /api/judgments returns 409 with Arabic message for user without binding", async () => {
      const res = await request(app)
        .get("/api/judgments")
        .set("Cookie", cookieNoBinding);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("ربط المكتب غير مكتمل. تواصل مع المشرف");
    });

    it("allows allow-listed user to access /api/sessions using global sheet", async () => {
      vi.spyOn(env, "globalSheetAllowedUserIds", "get").mockReturnValue([userAllowedGlobal.id]);

      const res = await request(app)
        .get("/api/sessions")
        .set("Cookie", cookieAllowedGlobal);

      // Must never be 409 (GoogleBindingMissingError)
      expect(res.status).not.toBe(409);
      expect([200, 502]).toContain(res.status);
    });
  });

  describe("Callers do not swallow error into empty array []", () => {
    it("listSessions rejects instead of returning [] when binding is missing", async () => {
      await expect(sessionService.listSessions(undefined, userNoBinding.id)).rejects.toThrow();
    });

    it("listPoaRows rejects instead of returning [] when binding is missing", async () => {
      await expect(poaService.listPoaRows(userNoBinding.id)).rejects.toThrow();
    });

    it("listTaskRowsWithHeaders rejects instead of returning [] when binding is missing", async () => {
      await expect(taskService.listTaskRowsWithHeaders(userNoBinding.id)).rejects.toThrow();
    });

    it("listJudgmentRowsWithHeaders rejects instead of returning [] when binding is missing", async () => {
      await expect(judgmentService.listJudgmentRowsWithHeaders(userNoBinding.id)).rejects.toThrow();
    });
  });
});

