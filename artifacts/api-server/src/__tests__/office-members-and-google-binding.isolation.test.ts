import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";
import * as postgresService from "../services/postgres.service";
import { google } from "googleapis";

describe("Office Members Isolation and Google Sheets Binding Security", { timeout: 35000 }, () => {
  const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  let adminA: any;
  let cookieAdminA: string;

  let adminB: any;
  let cookieAdminB: string;

  let staffA: any;
  let cookieStaffA: string;

  let staffB: any;
  let cookieStaffB: string;

  beforeAll(async () => {
    postgresService.resetInMemoryStore();

    // 1. Create Admin A
    const unameAdminA = `admin_a_${Date.now()}`;
    adminA = await supabaseService.createSupabaseUser({
      username: unameAdminA,
      password: "OfficePass123!",
      role: "admin",
      status: "active",
      subscription_end_date: futureDate,
    });
    const loginAdminA = await request(app)
      .post("/api/auth/login")
      .send({ username: unameAdminA, password: "OfficePass123!" });
    expect(loginAdminA.status).toBe(200);
    const cA = loginAdminA.headers["set-cookie"];
    cookieAdminA = Array.isArray(cA) ? cA.join("; ") : cA;

    // 2. Create Admin B
    const unameAdminB = `admin_b_${Date.now()}`;
    adminB = await supabaseService.createSupabaseUser({
      username: unameAdminB,
      password: "OfficePass123!",
      role: "admin",
      status: "active",
      subscription_end_date: futureDate,
    });
    const loginAdminB = await request(app)
      .post("/api/auth/login")
      .send({ username: unameAdminB, password: "OfficePass123!" });
    expect(loginAdminB.status).toBe(200);
    const cB = loginAdminB.headers["set-cookie"];
    cookieAdminB = Array.isArray(cB) ? cB.join("; ") : cB;

    // 3. Admin A creates Staff A
    const createStaffARes = await request(app)
      .post("/api/users")
      .set("Cookie", cookieAdminA)
      .send({
        username: `staff_a_${Date.now()}`,
        password: "StaffPass123!",
        display_name: "محامي مكتب أ",
        email: `staff_a_${Date.now()}@law.local`,
      });
    expect(createStaffARes.status).toBe(201);
    staffA = createStaffARes.body;

    const loginStaffA = await request(app)
      .post("/api/auth/login")
      .send({ username: staffA.username, password: "StaffPass123!" });
    expect(loginStaffA.status).toBe(200);
    const cStaffA = loginStaffA.headers["set-cookie"];
    cookieStaffA = Array.isArray(cStaffA) ? cStaffA.join("; ") : cStaffA;

    // 4. Admin B creates Staff B
    const createStaffBRes = await request(app)
      .post("/api/users")
      .set("Cookie", cookieAdminB)
      .send({
        username: `staff_b_${Date.now()}`,
        password: "StaffPass123!",
        display_name: "محامي مكتب ب",
        email: `staff_b_${Date.now()}@law.local`,
      });
    expect(createStaffBRes.status).toBe(201);
    staffB = createStaffBRes.body;

    const loginStaffB = await request(app)
      .post("/api/auth/login")
      .send({ username: staffB.username, password: "StaffPass123!" });
    expect(loginStaffB.status).toBe(200);
    const cStaffB = loginStaffB.headers["set-cookie"];
    cookieStaffB = Array.isArray(cStaffB) ? cStaffB.join("; ") : cStaffB;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (staffA?.id) await supabaseService.deleteSupabaseUser(staffA.id).catch(() => {});
    if (staffB?.id) await supabaseService.deleteSupabaseUser(staffB.id).catch(() => {});
    if (adminA?.id) await supabaseService.deleteSupabaseUser(adminA.id).catch(() => {});
    if (adminB?.id) await supabaseService.deleteSupabaseUser(adminB.id).catch(() => {});
  });

  describe("Task 2: Office Members Isolation & Gating", () => {
    it("Admin A sees only their own staff member, never Admin B's staff member", async () => {
      const listA = await request(app)
        .get("/api/users")
        .set("Cookie", cookieAdminA);

      expect(listA.status).toBe(200);
      const userIds = listA.body.users.map((u: any) => u.id);
      expect(userIds).toContain(staffA.id);
      expect(userIds).not.toContain(staffB.id);

      // Verify subscription and google fields are not leaked in members list
      const member = listA.body.users.find((u: any) => u.id === staffA.id);
      expect(member.google_service_account_json).toBeUndefined();
      expect(member.google_spreadsheet_id).toBeUndefined();
      expect(member.subscription_end_date).toBeUndefined();
    });

    it("Admin B receives 404 when attempting to PATCH Admin A's member (no existence leak)", async () => {
      const patchRes = await request(app)
        .patch(`/api/users/${staffA.id}`)
        .set("Cookie", cookieAdminB)
        .send({ display_name: "محاولة اختراق مكتب آخر" });

      expect(patchRes.status).toBe(404);
      expect(patchRes.body.error).toContain("غير موجود");
    });

    it("Admin B receives 404 when attempting to toggle status of Admin A's member", async () => {
      const toggleRes = await request(app)
        .post(`/api/users/${staffA.id}/toggle-status`)
        .set("Cookie", cookieAdminB)
        .send({ status: "suspended" });

      expect(toggleRes.status).toBe(404);
      expect(toggleRes.body.error).toContain("غير موجود");
    });

    it("Admin B receives 404 when attempting to DELETE Admin A's member", async () => {
      const deleteRes = await request(app)
        .delete(`/api/users/${staffA.id}`)
        .set("Cookie", cookieAdminB);

      expect(deleteRes.status).toBe(404);
      expect(deleteRes.body.error).toContain("غير موجود");
    });

    it("Admin A cannot promote staff member to admin or super_admin via PATCH /api/users/:id", async () => {
      const patchRes = await request(app)
        .patch(`/api/users/${staffA.id}`)
        .set("Cookie", cookieAdminA)
        .send({
          display_name: "محامي معتمد",
          role: "admin", // Malicious attempt to escalate role
          plan_tier: "enterprise",
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.role).toBe("staff");

      // Verify in DB that role was not altered
      const updatedUser = await supabaseService.findUserByIdOrUsername(staffA.id);
      expect(updatedUser?.role).toBe("staff");
    });

    it("Admin A cannot delete their own admin account via /api/users/:id (400)", async () => {
      const deleteSelf = await request(app)
        .delete(`/api/users/${adminA.id}`)
        .set("Cookie", cookieAdminA);

      expect(deleteSelf.status).toBe(400);
      expect(deleteSelf.body.error).toContain("لا يمكن حذف حساب مدير المكتب");
    });
  });

  describe("Task 1 & Task 4: Staff Member Route Gating & Protection", () => {
    it("Staff member is blocked from /api/users (403)", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Cookie", cookieStaffA);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("مدير المكتب");
    });

    it("Staff member is blocked from /api/settings/google-binding (403)", async () => {
      const res = await request(app)
        .get("/api/settings/google-binding")
        .set("Cookie", cookieStaffA);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("مدير المكتب");
    });

    it("Staff member is blocked from /api/settings/google-bind (403)", async () => {
      const res = await request(app)
        .post("/api/settings/google-bind")
        .set("Cookie", cookieStaffA)
        .send({
          service_account_json: "{}",
          spreadsheet_url_or_id: "test",
        });

      expect(res.status).toBe(403);
    });

    it("Staff member is blocked from /api/settings/google-export (403)", async () => {
      const res = await request(app)
        .post("/api/settings/google-export")
        .set("Cookie", cookieStaffA);

      expect(res.status).toBe(403);
    });
  });

  describe("Cross-Office Isolation for Staff (Staff A vs Staff B)", () => {
    let sessionAId: number;
    let poaAId: number;
    let taskAId: number;
    let judgmentAId: number;

    it("Staff A creates sessions, poa, tasks, judgments in Office A", async () => {
      const sessRes = await request(app)
        .post("/api/sessions")
        .set("Cookie", cookieStaffA)
        .send({
          caseNumber: "1446/STAFF-A/01",
          court: "المحكمة العامة",
          sessionDateHijri: "15/05/1446",
        });
      expect(sessRes.status).toBe(201);
      sessionAId = sessRes.body.id;

      const poaRes = await request(app)
        .post("/api/poa")
        .set("Cookie", cookieStaffA)
        .send({
          clientName: "موكل أ",
          poaNumber: "1446/POA-A/01",
        });
      expect(poaRes.status).toBe(201);
      poaAId = poaRes.body.sheetRowId || poaRes.body.id;

      const taskRes = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookieStaffA)
        .send({
          title: "مهمة طاقم أ",
          status: "قيد التنفيذ",
        });
      expect(taskRes.status).toBe(201);
      taskAId = taskRes.body.id;

      const judgRes = await request(app)
        .post("/api/judgments")
        .set("Cookie", cookieStaffA)
        .send({
          caseNumber: "1446/STAFF-A/01",
          judgmentNumber: "JUDG-STAFF-A-01",
        });
      expect(judgRes.status).toBe(201);
      judgmentAId = judgRes.body.id;
    });

    it("Staff B cannot see Office A's records in lists", async () => {
      const sessList = await request(app).get("/api/sessions").set("Cookie", cookieStaffB);
      expect(sessList.status).toBe(200);
      expect(sessList.body.some((s: any) => s.id === sessionAId)).toBe(false);

      const poaList = await request(app).get("/api/poa").set("Cookie", cookieStaffB);
      expect(poaList.status).toBe(200);
      expect(poaList.body.some((p: any) => (p.sheetRowId || p.id) === poaAId)).toBe(false);

      const taskList = await request(app).get("/api/tasks").set("Cookie", cookieStaffB);
      expect(taskList.status).toBe(200);
      expect(taskList.body.some((t: any) => t.id === taskAId)).toBe(false);

      const judgList = await request(app).get("/api/judgments").set("Cookie", cookieStaffB);
      expect(judgList.status).toBe(200);
      expect(judgList.body.some((j: any) => j.id === judgmentAId)).toBe(false);
    });

    it("Staff B cannot read or mutate Office A's records by guessing IDs (404)", async () => {
      const sessGet = await request(app).get(`/api/sessions/${sessionAId}`).set("Cookie", cookieStaffB);
      expect(sessGet.status).toBe(404);

      const sessDelete = await request(app).delete(`/api/sessions/${sessionAId}`).set("Cookie", cookieStaffB);
      expect(sessDelete.status).toBe(404);

      const poaPut = await request(app).put(`/api/poa/${poaAId}`).set("Cookie", cookieStaffB).send({ clientName: "هجوم" });
      expect(poaPut.status).toBe(404);

      const poaDelete = await request(app).delete(`/api/poa/${poaAId}`).set("Cookie", cookieStaffB);
      expect(poaDelete.status).toBe(404);

      const taskGet = await request(app).get(`/api/tasks/${taskAId}`).set("Cookie", cookieStaffB);
      expect(taskGet.status).toBe(404);

      const taskPut = await request(app).put(`/api/tasks/${taskAId}`).set("Cookie", cookieStaffB).send({ title: "تعديل غير مصرح" });
      expect(taskPut.status).toBe(404);

      const taskDelete = await request(app).delete(`/api/tasks/${taskAId}`).set("Cookie", cookieStaffB);
      expect(taskDelete.status).toBe(404);

      const judgGet = await request(app).get(`/api/judgments/${judgmentAId}`).set("Cookie", cookieStaffB);
      expect(judgGet.status).toBe(404);

      const judgDelete = await request(app).delete(`/api/judgments/${judgmentAId}`).set("Cookie", cookieStaffB);
      expect(judgDelete.status).toBe(404);
    });
  });

  describe("Task 3 & Task 6: Google Sheets Binding & Test Validation", () => {
    it("google-bind fails on invalid JSON with 400 and never persists", async () => {
      const res = await request(app)
        .post("/api/settings/google-bind")
        .set("Cookie", cookieAdminA)
        .send({
          service_account_json: "{ malformed json",
          spreadsheet_url_or_id: "https://docs.google.com/spreadsheets/d/12345678901234567890/edit",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("JSON");

      // Verify not saved
      const bindingRes = await request(app)
        .get("/api/settings/google-binding")
        .set("Cookie", cookieAdminA);
      expect(bindingRes.body.is_connected).toBe(false);
    });

    it("google-bind fails on missing client_email/private_key with 400 and never persists", async () => {
      const res = await request(app)
        .post("/api/settings/google-bind")
        .set("Cookie", cookieAdminA)
        .send({
          service_account_json: JSON.stringify({ type: "service_account" }),
          spreadsheet_url_or_id: "https://docs.google.com/spreadsheets/d/12345678901234567890/edit",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("client_email");

      // Verify not saved
      const bindingRes = await request(app)
        .get("/api/settings/google-binding")
        .set("Cookie", cookieAdminA);
      expect(bindingRes.body.is_connected).toBe(false);
    });

    it("google-test fails cleanly with 403 when Google Sheet is unshared", async () => {
      const dummySa = {
        client_email: "unshared-bot@project.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDC68qyJ4HNS5S8\n-----END PRIVATE KEY-----\n",
      };

      // Mock googleapis spreadsheets.get to simulate 403 permission denied
      const mockSpreadsheets = {
        spreadsheets: {
          get: vi.fn().mockRejectedValue({
            status: 403,
            message: "The caller does not have permission",
          }),
        },
      };
      vi.spyOn(google, "sheets").mockReturnValue(mockSpreadsheets as any);

      const res = await request(app)
        .post("/api/settings/google-test")
        .set("Cookie", cookieAdminA)
        .send({
          service_account_json: JSON.stringify(dummySa),
          spreadsheet_url_or_id: "12345678901234567890",
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("403");
      expect(res.body.client_email).toBe(dummySa.client_email);

      // Verify google-test NEVER persists
      const checkBinding = await request(app)
        .get("/api/settings/google-binding")
        .set("Cookie", cookieAdminA);
      expect(checkBinding.body.is_connected).toBe(false);
    });

    it("google-bind fails cleanly with 404 on non-existent spreadsheet ID and never persists", async () => {
      const dummySa = {
        client_email: "missing-bot@project.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDC68qyJ4HNS5S8\n-----END PRIVATE KEY-----\n",
      };

      const mockSpreadsheets = {
        spreadsheets: {
          get: vi.fn().mockRejectedValue({
            status: 404,
            message: "Requested entity was not found",
          }),
        },
      };
      vi.spyOn(google, "sheets").mockReturnValue(mockSpreadsheets as any);

      const res = await request(app)
        .post("/api/settings/google-bind")
        .set("Cookie", cookieAdminA)
        .send({
          service_account_json: JSON.stringify(dummySa),
          spreadsheet_url_or_id: "non-existent-spreadsheet-id-404",
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("404");

      // Verify never persisted
      const checkBinding = await request(app)
        .get("/api/settings/google-binding")
        .set("Cookie", cookieAdminA);
      expect(checkBinding.body.is_connected).toBe(false);
    });

    it("google-bind successfully saves encrypted binding when sheet is accessible and verified", async () => {
      const validSa = {
        client_email: "valid-bot@project.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDC68qyJ4HNS5S8\n-----END PRIVATE KEY-----\n",
      };

      const mockSpreadsheets = {
        spreadsheets: {
          get: vi.fn().mockResolvedValue({
            data: {
              properties: { title: "Office A Sheet" },
              sheets: [{ properties: { title: "Sessions" } }],
            },
          }),
          values: {
            get: vi.fn().mockResolvedValue({ data: { values: [] } }),
          },
        },
      };
      vi.spyOn(google, "sheets").mockReturnValue(mockSpreadsheets as any);

      const res = await request(app)
        .post("/api/settings/google-bind")
        .set("Cookie", cookieAdminA)
        .send({
          service_account_json: JSON.stringify(validSa),
          spreadsheet_url_or_id: "valid-accessible-spreadsheet-id",
          sheet_name: "Sessions",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.client_email).toBe(validSa.client_email);

      // Verify connection status in settings route
      const checkBinding = await request(app)
        .get("/api/settings/google-binding")
        .set("Cookie", cookieAdminA);

      expect(checkBinding.status).toBe(200);
      expect(checkBinding.body.is_connected).toBe(true);
      expect(checkBinding.body.client_email).toBe(validSa.client_email);
      expect(checkBinding.body.spreadsheet_id).toBe("valid-accessible-spreadsheet-id");
      // Private key MUST NOT be exposed
      expect((checkBinding.body as any).private_key).toBeUndefined();
      expect((checkBinding.body as any).service_account_json).toBeUndefined();

      // Verify that Staff A resolves Admin A's bound credentials
      const staffCreds = await supabaseService.getUserGoogleCredentials(staffA.id);
      expect(staffCreds).not.toBeNull();
      expect(staffCreds?.spreadsheetId).toBe("valid-accessible-spreadsheet-id");
    });
  });
});
