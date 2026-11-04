import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";
import * as googleSheetsService from "../services/googleSheets.service";
import * as postgresService from "../services/postgres.service";

describe("Optional Google Export Binding & Postgres Primary Storage Independence", { timeout: 30000 }, () => {
  const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  let userNoBinding: any;
  let cookieNoBinding: string;

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
    postgresService.resetInMemoryStore();

    // 1. Office Admin with NO Google binding
    const unameNoBinding = `nobind_${Date.now()}`;
    userNoBinding = await supabaseService.createSupabaseUser({
      username: unameNoBinding,
      password: "OfficePass123!",
      role: "admin",
      status: "active",
      subscription_end_date: futureDate,
    });
    const loginNo = await request(app)
      .post("/api/auth/login")
      .send({ username: unameNoBinding, password: "OfficePass123!" });
    const cNo = loginNo.headers["set-cookie"];
    cookieNoBinding = Array.isArray(cNo) ? cNo.join("; ") : cNo;

    // 2. Office Admin with COMPLETE Google binding
    const unameComplete = `complete_${Date.now()}`;
    userCompleteBinding = await supabaseService.createSupabaseUser({
      username: unameComplete,
      password: "OfficePass123!",
      role: "admin",
      status: "active",
      subscription_end_date: futureDate,
      google_spreadsheet_id: "custom-user-spreadsheet-id-9999",
      google_sheet_name: "Sessions",
    });
    await supabaseService.saveOfficeGoogleBinding(userCompleteBinding.id, {
      service_account_json: JSON.stringify(validServiceAccount),
      spreadsheet_id: "custom-user-spreadsheet-id-9999",
      sheet_name: "Sessions",
    });
    const loginComplete = await request(app)
      .post("/api/auth/login")
      .send({ username: unameComplete, password: "OfficePass123!" });
    const cComplete = loginComplete.headers["set-cookie"];
    cookieCompleteBinding = Array.isArray(cComplete) ? cComplete.join("; ") : cComplete;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (userNoBinding?.id) await supabaseService.deleteSupabaseUser(userNoBinding.id).catch(() => {});
    if (userCompleteBinding?.id) await supabaseService.deleteSupabaseUser(userCompleteBinding.id).catch(() => {});
  });

  describe("Postgres Independence (No Google Binding Required for Primary Storage)", () => {
    it("allows user without Google binding to read and create sessions in Postgres (no 409)", async () => {
      // Create session in Postgres
      const createRes = await request(app)
        .post("/api/sessions")
        .set("Cookie", cookieNoBinding)
        .send({
          caseNumber: "1446/ق/PG-01",
          court: "المحكمة التجارية",
          sessionDateHijri: "20/02/1446",
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.caseNumber).toBe("1446/ق/PG-01");

      // List sessions
      const listRes = await request(app)
        .get("/api/sessions")
        .set("Cookie", cookieNoBinding);

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
      expect(listRes.body.some((s: any) => s.caseNumber === "1446/ق/PG-01")).toBe(true);
    });

    it("allows user without Google binding to read and create tasks in Postgres", async () => {
      const createRes = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookieNoBinding)
        .send({
          title: "مهمة قاعدة البيانات",
          status: "قيد التنفيذ",
        });

      expect(createRes.status).toBe(201);

      const listRes = await request(app)
        .get("/api/tasks")
        .set("Cookie", cookieNoBinding);

      expect(listRes.status).toBe(200);
      expect(listRes.body.some((t: any) => t.title === "مهمة قاعدة البيانات")).toBe(true);
    });

    it("allows user without Google binding to read and create POA in Postgres", async () => {
      const createRes = await request(app)
        .post("/api/poa")
        .set("Cookie", cookieNoBinding)
        .send({
          clientName: "عميل مستقل",
          poaNumber: "1446/POA/PG-99",
        });

      expect(createRes.status).toBe(201);

      const listRes = await request(app)
        .get("/api/poa")
        .set("Cookie", cookieNoBinding);

      expect(listRes.status).toBe(200);
      expect(listRes.body.some((p: any) => p.poaNumber === "1446/POA/PG-99")).toBe(true);
    });
  });

  describe("Optional Google Export Endpoint", () => {
    it("handles export endpoint for user with complete binding", async () => {
      const res = await request(app)
        .post("/api/settings/google-export")
        .set("Cookie", cookieCompleteBinding);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.sessionsCount).toBeDefined();
    });
  });
});
