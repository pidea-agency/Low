import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";
import * as postgresService from "../services/postgres.service";

describe("Cross-Office Isolation for Sessions, Tasks, POA, and Judgments (Postgres Multitenancy)", { timeout: 30000 }, () => {
  let officeACookie: string;
  let officeBCookie: string;
  let superAdminCookie: string;
  let userA: any;
  let userB: any;
  let superAdmin: any;

  beforeAll(async () => {
    postgresService.resetInMemoryStore();

    // 1. Create two separate office admins
    const usernameA = `office_a_${Date.now()}`;
    const usernameB = `office_b_${Date.now()}`;
    const superUser = `super_${Date.now()}`;
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    userA = await supabaseService.createSupabaseUser({
      username: usernameA,
      password: "OfficePass123!",
      role: "admin",
      status: "active",
      subscription_end_date: futureDate,
    });

    userB = await supabaseService.createSupabaseUser({
      username: usernameB,
      password: "OfficePass123!",
      role: "admin",
      status: "active",
      subscription_end_date: futureDate,
    });

    superAdmin = await supabaseService.createSupabaseUser({
      username: superUser,
      password: "SuperPass123!",
      role: "super_admin",
      status: "active",
    });

    // Login Office A
    const loginA = await request(app)
      .post("/api/auth/login")
      .send({ username: usernameA, password: "OfficePass123!" });
    expect(loginA.status).toBe(200);
    const cookieA = loginA.headers["set-cookie"];
    officeACookie = Array.isArray(cookieA) ? cookieA.join("; ") : cookieA;

    // Login Office B
    const loginB = await request(app)
      .post("/api/auth/login")
      .send({ username: usernameB, password: "OfficePass123!" });
    expect(loginB.status).toBe(200);
    const cookieB = loginB.headers["set-cookie"];
    officeBCookie = Array.isArray(cookieB) ? cookieB.join("; ") : cookieB;

    // Login Super Admin
    const loginSuper = await request(app)
      .post("/api/auth/admin-login")
      .send({ username: superUser, password: "SuperPass123!" });
    expect(loginSuper.status).toBe(200);
    const cookieSuper = loginSuper.headers["set-cookie"];
    superAdminCookie = Array.isArray(cookieSuper) ? cookieSuper.join("; ") : cookieSuper;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (userA?.id) await supabaseService.deleteSupabaseUser(userA.id).catch(() => {});
    if (userB?.id) await supabaseService.deleteSupabaseUser(userB.id).catch(() => {});
    if (superAdmin?.id) await supabaseService.deleteSupabaseUser(superAdmin.id).catch(() => {});
  });

  describe("Unauthenticated requests", () => {
    it("rejects unauthenticated requests to /api/sessions with 401", async () => {
      const res = await request(app).get("/api/sessions");
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated requests to /api/poa with 401", async () => {
      const res = await request(app).get("/api/poa");
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated requests to /api/tasks with 401", async () => {
      const res = await request(app).get("/api/tasks");
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated requests to /api/judgments with 401", async () => {
      const res = await request(app).get("/api/judgments");
      expect(res.status).toBe(401);
    });
  });

  describe("Super Admin office privacy isolation", () => {
    it("blocks Super Admin from reading office sessions (403)", async () => {
      const res = await request(app)
        .get("/api/sessions")
        .set("Cookie", superAdminCookie);
      expect(res.status).toBe(403);
    });

    it("blocks Super Admin from reading office tasks (403)", async () => {
      const res = await request(app)
        .get("/api/tasks")
        .set("Cookie", superAdminCookie);
      expect(res.status).toBe(403);
    });

    it("blocks Super Admin from reading office POA records (403)", async () => {
      const res = await request(app)
        .get("/api/poa")
        .set("Cookie", superAdminCookie);
      expect(res.status).toBe(403);
    });

    it("blocks Super Admin from reading office judgments (403)", async () => {
      const res = await request(app)
        .get("/api/judgments")
        .set("Cookie", superAdminCookie);
      expect(res.status).toBe(403);
    });
  });

  describe("Sessions Cross-Office Isolation", () => {
    let officeASessionId: number;

    it("Office A creates a session; Office B cannot see it", async () => {
      const createRes = await request(app)
        .post("/api/sessions")
        .set("Cookie", officeACookie)
        .send({
          caseNumber: "1446/ق/A-001",
          court: "المحكمة العامة بالرياض",
          sessionDateHijri: "15/02/1446",
          sessionTime: "09:00 صباحا",
          caseSubject: "قضية خاصة بمكتب أ",
        });

      expect(createRes.status).toBe(201);
      officeASessionId = createRes.body.id;

      // Office A lists and sees it
      const listA = await request(app)
        .get("/api/sessions")
        .set("Cookie", officeACookie);
      expect(listA.status).toBe(200);
      expect(listA.body.some((s: any) => s.id === officeASessionId)).toBe(true);

      // Office B lists and does NOT see it
      const listB = await request(app)
        .get("/api/sessions")
        .set("Cookie", officeBCookie);
      expect(listB.status).toBe(200);
      expect(listB.body.some((s: any) => s.id === officeASessionId)).toBe(false);
    });

    it("Office B cannot GET, UPDATE, or DELETE Office A's session (404)", async () => {
      // Office B attempts GET
      const getRes = await request(app)
        .get(`/api/sessions/${officeASessionId}`)
        .set("Cookie", officeBCookie);
      expect(getRes.status).toBe(404);

      // Office B attempts PATCH
      const patchRes = await request(app)
        .patch(`/api/sessions/${officeASessionId}`)
        .set("Cookie", officeBCookie)
        .send({ caseSubject: "محاولة اختراق" });
      expect(patchRes.status).toBe(404);

      // Office B attempts DELETE
      const deleteRes = await request(app)
        .delete(`/api/sessions/${officeASessionId}`)
        .set("Cookie", officeBCookie);
      expect(deleteRes.status).toBe(404);
    });

    it("Office B cannot access Office A's session report (null or 404)", async () => {
      // Office A saves a report
      await request(app)
        .put(`/api/sessions/${officeASessionId}/report`)
        .set("Cookie", officeACookie)
        .send({ summary: "تقرير سري لمكتب أ" });

      // Office B attempts GET
      const getReportB = await request(app)
        .get(`/api/sessions/${officeASessionId}/report`)
        .set("Cookie", officeBCookie);
      expect([200, 404]).toContain(getReportB.status);
      if (getReportB.status === 200) {
        expect(getReportB.body).toBeNull();
      }
    });
  });

  describe("Power of Attorney (POA) Cross-Office Isolation", () => {
    let officeAPoaId: number;

    it("Office A creates a POA record; Office B cannot see it", async () => {
      const createRes = await request(app)
        .post("/api/poa")
        .set("Cookie", officeACookie)
        .send({
          clientName: "موكل مكتب أ",
          poaNumber: "1446/POA/A1",
          issueDateHijri: "1446/01/01",
          expiryDateHijri: "1447/01/01",
          notes: "سري للغاية لمكتب أ",
          officeId: "forged_office_b", // Ignored on server
        });

      expect(createRes.status).toBe(201);
      officeAPoaId = createRes.body.sheetRowId || createRes.body.id;

      // Office A sees it
      const listA = await request(app)
        .get("/api/poa")
        .set("Cookie", officeACookie);
      expect(listA.status).toBe(200);
      expect(listA.body.some((p: any) => p.poaNumber === "1446/POA/A1")).toBe(true);

      // Office B cannot see it
      const listB = await request(app)
        .get("/api/poa")
        .set("Cookie", officeBCookie);
      expect(listB.status).toBe(200);
      expect(listB.body.some((p: any) => p.poaNumber === "1446/POA/A1")).toBe(false);
    });

    it("Office B cannot PUT or DELETE Office A's POA record (404)", async () => {
      const putRes = await request(app)
        .put(`/api/poa/${officeAPoaId}`)
        .set("Cookie", officeBCookie)
        .send({ clientName: "محاولة تعديل غير مصرح بها" });
      expect(putRes.status).toBe(404);

      const deleteRes = await request(app)
        .delete(`/api/poa/${officeAPoaId}`)
        .set("Cookie", officeBCookie);
      expect(deleteRes.status).toBe(404);
    });
  });

  describe("Tasks Cross-Office Isolation", () => {
    let officeATaskId: number;

    it("Office A creates a Task; Office B cannot see it", async () => {
      const createRes = await request(app)
        .post("/api/tasks")
        .set("Cookie", officeACookie)
        .send({
          title: "مهمة إعداد رد مكتب أ",
          assignee: "محامي أ",
          priority: "عاجلة",
          status: "قيد التنفيذ",
          officeId: "forged_office_b",
        });

      expect(createRes.status).toBe(201);
      officeATaskId = createRes.body.id;

      // Office A sees it
      const listA = await request(app)
        .get("/api/tasks")
        .set("Cookie", officeACookie);
      expect(listA.status).toBe(200);
      expect(listA.body.some((t: any) => t.id === officeATaskId)).toBe(true);

      // Office B does NOT see it
      const listB = await request(app)
        .get("/api/tasks")
        .set("Cookie", officeBCookie);
      expect(listB.status).toBe(200);
      expect(listB.body.some((t: any) => t.id === officeATaskId)).toBe(false);
    });

    it("Office B cannot GET, PUT, or DELETE Office A's Task (404)", async () => {
      const getRes = await request(app)
        .get(`/api/tasks/${officeATaskId}`)
        .set("Cookie", officeBCookie);
      expect(getRes.status).toBe(404);

      const putRes = await request(app)
        .put(`/api/tasks/${officeATaskId}`)
        .set("Cookie", officeBCookie)
        .send({ title: "تعديل غير مصرح به" });
      expect(putRes.status).toBe(404);

      const deleteRes = await request(app)
        .delete(`/api/tasks/${officeATaskId}`)
        .set("Cookie", officeBCookie);
      expect(deleteRes.status).toBe(404);
    });
  });

  describe("Judgments Cross-Office Isolation", () => {
    let officeAJudgmentId: number;

    it("Office A creates a Judgment; Office B cannot see it", async () => {
      const createRes = await request(app)
        .post("/api/judgments")
        .set("Cookie", officeACookie)
        .send({
          caseNumber: "1446/قضية/A99",
          court: "المحكمة العامة",
          plaintiff: "مدعي مكتب أ",
          judgmentNumber: "JUDG-A99",
          summary: "حكم خاص بمكتب أ",
          officeId: "forged_office_b",
        });

      expect(createRes.status).toBe(201);
      officeAJudgmentId = createRes.body.id;

      // Office A sees it
      const listA = await request(app)
        .get("/api/judgments")
        .set("Cookie", officeACookie);
      expect(listA.status).toBe(200);
      expect(listA.body.some((j: any) => j.id === officeAJudgmentId)).toBe(true);

      // Office B does NOT see it
      const listB = await request(app)
        .get("/api/judgments")
        .set("Cookie", officeBCookie);
      expect(listB.status).toBe(200);
      expect(listB.body.some((j: any) => j.id === officeAJudgmentId)).toBe(false);
    });

    it("Office B cannot GET, PUT, or DELETE Office A's Judgment (404)", async () => {
      const getRes = await request(app)
        .get(`/api/judgments/${officeAJudgmentId}`)
        .set("Cookie", officeBCookie);
      expect(getRes.status).toBe(404);

      const putRes = await request(app)
        .put(`/api/judgments/${officeAJudgmentId}`)
        .set("Cookie", officeBCookie)
        .send({ summary: "تعديل غير مصرح به" });
      expect(putRes.status).toBe(404);

      const deleteRes = await request(app)
        .delete(`/api/judgments/${officeAJudgmentId}`)
        .set("Cookie", officeBCookie);
      expect(deleteRes.status).toBe(404);
    });
  });
});
