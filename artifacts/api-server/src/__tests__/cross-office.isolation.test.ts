import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";
import * as poaService from "../services/poa.sheets.service";
import * as taskService from "../services/task.sheets.service";
import * as judgmentService from "../services/judgment.sheets.service";

describe("Cross-Office Isolation for POA, Tasks, and Judgments", { timeout: 30000 }, () => {
  let officeACookie: string;
  let officeBCookie: string;
  let userA: any;
  let userB: any;
  let prevAllowed: string | undefined;

  beforeAll(async () => {
    prevAllowed = process.env.GLOBAL_SHEET_ALLOWED_USER_IDS;
    // Create two separate offices
    const usernameA = `office_a_${Date.now()}`;
    const usernameB = `office_b_${Date.now()}`;
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    userA = await supabaseService.createSupabaseUser({
      username: usernameA,
      password: "OfficePass123!",
      role: "staff",
      subscription_end_date: futureDate,
    });

    userB = await supabaseService.createSupabaseUser({
      username: usernameB,
      password: "OfficePass123!",
      role: "staff",
      subscription_end_date: futureDate,
    });

    // In cross-office multi-tenancy tests, allow both offices to share the mock sheet backend
    process.env.GLOBAL_SHEET_ALLOWED_USER_IDS = `${userA.id},${userB.id},${usernameA},${usernameB}`;

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
  });

  afterAll(async () => {
    process.env.GLOBAL_SHEET_ALLOWED_USER_IDS = prevAllowed;
    if (userA?.id) await supabaseService.deleteSupabaseUser(userA.id).catch(() => {});
    if (userB?.id) await supabaseService.deleteSupabaseUser(userB.id).catch(() => {});
  });

  describe("Unauthenticated requests", () => {
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

  describe("Power of Attorney (POA) Cross-Office Isolation", () => {
    let officeARowId: number;

    it("Office A creates a POA record; Office B cannot see it", async () => {
      // Office A creates POA
      const createRes = await request(app)
        .post("/api/poa")
        .set("Cookie", officeACookie)
        .send({
          clientName: "موكل مكتب أ",
          poaNumber: "1446/POA/A1",
          issueDateHijri: "1446/01/01",
          expiryDateHijri: "1447/01/01",
          notes: "سري للغاية لمكتب أ",
          officeId: "forged_office_b", // Forged office value in body must be ignored
        });

      expect(createRes.status).toBe(201);

      // Office A lists and sees it
      const listARes = await request(app)
        .get("/api/poa")
        .set("Cookie", officeACookie);
      expect(listARes.status).toBe(200);
      const aRecord = listARes.body.find((r: any) => r.poaNumber === "1446/POA/A1");
      expect(aRecord).toBeDefined();
      officeARowId = aRecord.sheetRowId;

      // Office B lists and MUST NOT see it
      const listBRes = await request(app)
        .get("/api/poa")
        .set("Cookie", officeBCookie);
      expect(listBRes.status).toBe(200);
      const bFound = listBRes.body.find((r: any) => r.poaNumber === "1446/POA/A1");
      expect(bFound).toBeUndefined();
    });

    it("Office B attempts to update Office A's POA record -> 404 and record is unchanged", async () => {
      const updateRes = await request(app)
        .put(`/api/poa/${officeARowId}`)
        .set("Cookie", officeBCookie)
        .send({ clientName: "مخترق من مكتب ب" });

      // Must be 404 (not 403, so existence is not revealed)
      expect(updateRes.status).toBe(404);

      // Verify Office A's record is completely unchanged
      const listARes = await request(app)
        .get("/api/poa")
        .set("Cookie", officeACookie);
      const aRecord = listARes.body.find((r: any) => r.sheetRowId === officeARowId);
      expect(aRecord.clientName).toBe("موكل مكتب أ");
    });

    it("Office B attempts to delete Office A's POA record -> 404 and record still exists", async () => {
      const deleteRes = await request(app)
        .delete(`/api/poa/${officeARowId}`)
        .set("Cookie", officeBCookie);

      expect(deleteRes.status).toBe(404);

      // Verify Office A's record still exists
      const listARes = await request(app)
        .get("/api/poa")
        .set("Cookie", officeACookie);
      const aRecord = listARes.body.find((r: any) => r.sheetRowId === officeARowId);
      expect(aRecord).toBeDefined();
    });

    it("Office A can update and delete its own POA record normally", async () => {
      // Update by owner
      const updateRes = await request(app)
        .put(`/api/poa/${officeARowId}`)
        .set("Cookie", officeACookie)
        .send({ clientName: "موكل مكتب أ - معدل" });
      expect(updateRes.status).toBe(200);

      // Delete by owner
      const deleteRes = await request(app)
        .delete(`/api/poa/${officeARowId}`)
        .set("Cookie", officeACookie);
      expect(deleteRes.status).toBe(204);

      // Verify it's gone for Office A
      const listARes = await request(app)
        .get("/api/poa")
        .set("Cookie", officeACookie);
      const aRecord = listARes.body.find((r: any) => r.sheetRowId === officeARowId);
      expect(aRecord).toBeUndefined();
    });
  });

  describe("Tasks Cross-Office Isolation", () => {
    let officeATaskId: number;

    it("Office A creates a Task; Office B cannot see or get it", async () => {
      const createRes = await request(app)
        .post("/api/tasks")
        .set("Cookie", officeACookie)
        .send({
          title: "مهمة إعداد مذكرة لمكتب أ",
          assignee: "محامي مكتب أ",
          priority: "عاجلة",
          dueDate: "2026-12-01",
          status: "قيد التنفيذ",
          officeId: "forged_b",
        });
      expect(createRes.status).toBe(201);
      officeATaskId = createRes.body.id;

      // Office B lists and does NOT see it
      const listBRes = await request(app)
        .get("/api/tasks")
        .set("Cookie", officeBCookie);
      expect(listBRes.status).toBe(200);
      const bFound = listBRes.body.find((t: any) => t.id === officeATaskId);
      expect(bFound).toBeUndefined();

      // Office B gets by ID -> 404
      const getBRes = await request(app)
        .get(`/api/tasks/${officeATaskId}`)
        .set("Cookie", officeBCookie);
      expect(getBRes.status).toBe(404);
    });

    it("Office B attempts to update or delete Office A's Task -> 404", async () => {
      // Update attempt
      const updateRes = await request(app)
        .put(`/api/tasks/${officeATaskId}`)
        .set("Cookie", officeBCookie)
        .send({ title: "تعديل غير مصرح به" });
      expect(updateRes.status).toBe(404);

      // Delete attempt
      const deleteRes = await request(app)
        .delete(`/api/tasks/${officeATaskId}`)
        .set("Cookie", officeBCookie);
      expect(deleteRes.status).toBe(404);

      // Office A still sees it intact
      const getARes = await request(app)
        .get(`/api/tasks/${officeATaskId}`)
        .set("Cookie", officeACookie);
      expect(getARes.status).toBe(200);
      expect(getARes.body.title).toBe("مهمة إعداد مذكرة لمكتب أ");
    });
  });

  describe("Judgments Cross-Office Isolation", () => {
    let officeAJudgmentId: number;

    it("Office A creates a Judgment; Office B cannot see or get it", async () => {
      const createRes = await request(app)
        .post("/api/judgments")
        .set("Cookie", officeACookie)
        .send({
          caseNumber: "1446/قضية/A1",
          court: "المحكمة العامة",
          plaintiff: "المدعي أ",
          defendant: "المدعى عليه أ",
          assignedLawyer: "محامي أ",
          judgmentNumber: "1446/حكم/01",
          judgmentDate: "1446/02/01",
          summary: "حكم خاص بمكتب أ",
          isFavorable: "نهائي",
          officeId: "forged_b",
        });
      expect(createRes.status).toBe(201);
      officeAJudgmentId = createRes.body.id;

      // Office B lists -> does NOT see it
      const listBRes = await request(app)
        .get("/api/judgments")
        .set("Cookie", officeBCookie);
      expect(listBRes.status).toBe(200);
      const bFound = listBRes.body.find((j: any) => j.id === officeAJudgmentId);
      expect(bFound).toBeUndefined();

      // Office B gets by ID -> 404
      const getBRes = await request(app)
        .get(`/api/judgments/${officeAJudgmentId}`)
        .set("Cookie", officeBCookie);
      expect(getBRes.status).toBe(404);
    });

    it("Office B attempts to update or delete Office A's Judgment -> 404", async () => {
      // Update attempt
      const updateRes = await request(app)
        .put(`/api/judgments/${officeAJudgmentId}`)
        .set("Cookie", officeBCookie)
        .send({ summary: "تعديل محظور" });
      expect(updateRes.status).toBe(404);

      // Delete attempt
      const deleteRes = await request(app)
        .delete(`/api/judgments/${officeAJudgmentId}`)
        .set("Cookie", officeBCookie);
      expect(deleteRes.status).toBe(404);

      // Office A still sees it
      const getARes = await request(app)
        .get(`/api/judgments/${officeAJudgmentId}`)
        .set("Cookie", officeACookie);
      expect(getARes.status).toBe(200);
      expect(getARes.body.summary).toBe("حكم خاص بمكتب أ");
    });
  });

  describe("Legacy / Unmigrated records visibility", () => {
    it("Unmigrated records without office are invisible to both Office A and Office B in list", async () => {
      const listTasksA = await request(app).get("/api/tasks").set("Cookie", officeACookie);
      const listTasksB = await request(app).get("/api/tasks").set("Cookie", officeBCookie);
      expect(listTasksA.body.find((t: any) => t.id === 2)).toBeUndefined();
      expect(listTasksB.body.find((t: any) => t.id === 2)).toBeUndefined();

      const listJudgmentsA = await request(app).get("/api/judgments").set("Cookie", officeACookie);
      const listJudgmentsB = await request(app).get("/api/judgments").set("Cookie", officeBCookie);
      expect(listJudgmentsA.body.find((j: any) => j.id === 2)).toBeUndefined();
      expect(listJudgmentsB.body.find((j: any) => j.id === 2)).toBeUndefined();
    });

    it("Direct access by ID to unmigrated records returns 404 for any office", async () => {
      const getTaskA = await request(app).get("/api/tasks/2").set("Cookie", officeACookie);
      const getTaskB = await request(app).get("/api/tasks/2").set("Cookie", officeBCookie);
      expect(getTaskA.status).toBe(404);
      expect(getTaskB.status).toBe(404);

      const getJudgmentA = await request(app).get("/api/judgments/2").set("Cookie", officeACookie);
      const getJudgmentB = await request(app).get("/api/judgments/2").set("Cookie", officeBCookie);
      expect(getJudgmentA.status).toBe(404);
      expect(getJudgmentB.status).toBe(404);
    });
  });
});
