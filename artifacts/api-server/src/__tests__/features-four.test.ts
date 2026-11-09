import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";
import * as postgresService from "../services/postgres.service";

describe("Four Independent Features: Workload, Notes, Conflict Detection, Monthly Report", { timeout: 45000 }, () => {
  const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  let adminA: any;
  let cookieAdminA: string;

  let staffA1: any;
  let cookieStaffA1: string;

  let staffA2: any;
  let cookieStaffA2: string;

  let adminB: any;
  let cookieAdminB: string;

  let clientA1: any;
  let clientA2: any;

  beforeAll(async () => {
    postgresService.resetInMemoryStore();

    // 1. Office A Admin
    const unameAdminA = `f4_admin_a_${Date.now()}`;
    adminA = await supabaseService.createSupabaseUser({
      username: unameAdminA,
      password: "OfficePass123!",
      role: "admin",
      status: "active",
      plan_tier: "plus",
      subscription_end_date: futureDate,
    });
    const loginAdminA = await request(app)
      .post("/api/auth/login")
      .send({ username: unameAdminA, password: "OfficePass123!" });
    expect(loginAdminA.status).toBe(200);
    const cAdminA = loginAdminA.headers["set-cookie"];
    cookieAdminA = Array.isArray(cAdminA) ? cAdminA.join("; ") : cAdminA;

    // 2. Staff A1 under Admin A
    const unameStaffA1 = `f4_staff_a1_${Date.now()}`;
    staffA1 = await supabaseService.createSupabaseUser({
      username: unameStaffA1,
      password: "OfficePass123!",
      role: "staff",
      status: "active",
      admin_id: adminA.id,
      display_name: "المحامي خالد",
      subscription_end_date: futureDate,
    });
    const loginStaffA1 = await request(app)
      .post("/api/auth/login")
      .send({ username: unameStaffA1, password: "OfficePass123!" });
    expect(loginStaffA1.status).toBe(200);
    const cStaffA1 = loginStaffA1.headers["set-cookie"];
    cookieStaffA1 = Array.isArray(cStaffA1) ? cStaffA1.join("; ") : cStaffA1;

    // 3. Staff A2 under Admin A
    const unameStaffA2 = `f4_staff_a2_${Date.now()}`;
    staffA2 = await supabaseService.createSupabaseUser({
      username: unameStaffA2,
      password: "OfficePass123!",
      role: "staff",
      status: "active",
      admin_id: adminA.id,
      display_name: "المحامي طارق",
      subscription_end_date: futureDate,
    });
    const loginStaffA2 = await request(app)
      .post("/api/auth/login")
      .send({ username: unameStaffA2, password: "OfficePass123!" });
    expect(loginStaffA2.status).toBe(200);
    const cStaffA2 = loginStaffA2.headers["set-cookie"];
    cookieStaffA2 = Array.isArray(cStaffA2) ? cStaffA2.join("; ") : cStaffA2;

    // 4. Office B Admin
    const unameAdminB = `f4_admin_b_${Date.now()}`;
    adminB = await supabaseService.createSupabaseUser({
      username: unameAdminB,
      password: "OfficePass123!",
      role: "admin",
      status: "active",
      plan_tier: "plus",
      subscription_end_date: futureDate,
    });
    const loginAdminB = await request(app)
      .post("/api/auth/login")
      .send({ username: unameAdminB, password: "OfficePass123!" });
    expect(loginAdminB.status).toBe(200);
    const cAdminB = loginAdminB.headers["set-cookie"];
    cookieAdminB = Array.isArray(cAdminB) ? cAdminB.join("; ") : cAdminB;

    // Seed Clients in Office A
    clientA1 = await postgresService.createClient(
      { name: "عميل أ1 المرتبط بخالد", phone: "0550001111", notes: "خاص بخالد" },
      adminA.id,
    );
    clientA2 = await postgresService.createClient(
      { name: "عميل أ2 المرتبط بطارق", phone: "0550002222", notes: "خاص بطارق" },
      adminA.id,
    );

    // Link clientA1 to staffA1 via a session
    await postgresService.createSession(
      {
        caseNumber: "CASE-KHALID-1",
        court: "المحكمة العامة",
        sessionDateHijri: "1447/06/15",
        sessionTime: "09:00",
        clientId: clientA1.id,
        assignedLawyerId: staffA1.id,
        createdBy: staffA1.id,
        status: "Upcoming",
      } as any,
      adminA.id,
    );

    // Link clientA2 to staffA2 via a session
    await postgresService.createSession(
      {
        caseNumber: "CASE-TARIQ-1",
        court: "المحكمة التجارية",
        sessionDateHijri: "1447/06/15",
        sessionTime: "09:00",
        clientId: clientA2.id,
        assignedLawyerId: staffA2.id,
        createdBy: staffA2.id,
        status: "Upcoming",
      } as any,
      adminA.id,
    );

    // Add open POA and pending task to staffA1
    await postgresService.createPoa(
      {
        poaNumber: "POA-KHALID-100",
        clientName: "موكل خالد",
        clientId: clientA1.id,
        assignedLawyerId: staffA1.id,
        daysRemaining: 45,
      } as any,
      adminA.id,
    );

    await postgresService.createTask(
      {
        title: "مهمة إعداد مذكرة لخالد",
        clientId: clientA1.id,
        assignedLawyerId: staffA1.id,
        status: "قيد التنفيذ",
      } as any,
      adminA.id,
    );
  }, 60000);

  // =========================================================================
  // Feature 1: Workload Widget Tests
  // =========================================================================
  describe("Feature 1: Workload Widget (GET /workload)", () => {
    it("allows Office Admin to view workload counts grouped by lawyer", async () => {
      const res = await request(app)
        .get("/api/workload")
        .set("Cookie", cookieAdminA);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("members");
      expect(Array.isArray(res.body.members)).toBe(true);

      const khalid = res.body.members.find((m: any) => m.lawyerId === staffA1.id);
      expect(khalid).toBeDefined();
      expect(khalid.activeSessions).toBe(1);
      expect(khalid.openPoa).toBe(1);
      expect(khalid.pendingTasks).toBe(1);
      expect(khalid.totalWorkload).toBe(3);

      const tariq = res.body.members.find((m: any) => m.lawyerId === staffA2.id);
      expect(tariq).toBeDefined();
      expect(tariq.activeSessions).toBe(1);
      expect(tariq.openPoa).toBe(0);
      expect(tariq.pendingTasks).toBe(0);
      expect(tariq.totalWorkload).toBe(1);
    });

    it("rejects Staff users from accessing the workload endpoint with 403", async () => {
      const res = await request(app)
        .get("/api/workload")
        .set("Cookie", cookieStaffA1);

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // Feature 2: Client Activity Notes Tests
  // =========================================================================
  describe("Feature 2: Client Activity Notes (GET/POST /clients/:id/notes)", () => {
    let noteId: string;

    it("allows assigned staff to add a note to their client", async () => {
      const res = await request(app)
        .post(`/api/clients/${clientA1.id}/notes`)
        .set("Cookie", cookieStaffA1)
        .send({ body: "تم الاتصال بالعميل والاتفاق على تقديم المذكرة غداً." });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body.body).toBe("تم الاتصال بالعميل والاتفاق على تقديم المذكرة غداً.");
      expect(res.body.authorName).toBe("المحامي خالد");
      noteId = res.body.id;
    });

    it("allows assigned staff and office admin to view client notes chronologically", async () => {
      const resStaff = await request(app)
        .get(`/api/clients/${clientA1.id}/notes`)
        .set("Cookie", cookieStaffA1);

      expect(resStaff.status).toBe(200);
      expect(Array.isArray(resStaff.body)).toBe(true);
      expect(resStaff.body.length).toBeGreaterThanOrEqual(1);
      expect(resStaff.body[0].id).toBe(noteId);

      const resAdmin = await request(app)
        .get(`/api/clients/${clientA1.id}/notes`)
        .set("Cookie", cookieAdminA);

      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.some((n: any) => n.id === noteId)).toBe(true);
    });

    it("blocks unassigned staff from viewing notes of other clients", async () => {
      // Staff A2 is not assigned to clientA1
      const res = await request(app)
        .get(`/api/clients/${clientA1.id}/notes`)
        .set("Cookie", cookieStaffA2);

      expect(res.status).toBe(404);
    });

    it("blocks unassigned staff from adding notes to other clients", async () => {
      // Staff A2 attempts to add note to clientA1
      const res = await request(app)
        .post(`/api/clients/${clientA1.id}/notes`)
        .set("Cookie", cookieStaffA2)
        .send({ body: "محاولة غير مصرح بها" });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // Feature 3: Session Conflict Detection Tests
  // =========================================================================
  describe("Feature 3: Session Conflict Detection", () => {
    it("blocks creating a session with same assigned lawyer, date, and time in the same office", async () => {
      // Staff A1 already has CASE-KHALID-1 on 1447/06/15 at 09:00
      const res = await request(app)
        .post("/api/sessions")
        .set("Cookie", cookieAdminA)
        .send({
          caseNumber: "CASE-CONFLICT-TEST",
          court: "المحكمة العامة",
          sessionDateHijri: "1447/06/15",
          sessionTime: "09:00",
          assignedLawyerId: staffA1.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("تعارض في المواعيد");
      expect(res.body.error).toContain("CASE-KHALID-1");
    });

    it("allows creating a session at the exact same date and time for a DIFFERENT lawyer", async () => {
      // Staff A2 does NOT have a session at 11:30 on 1447/06/15
      // First create one for Staff A1
      const res1 = await request(app)
        .post("/api/sessions")
        .set("Cookie", cookieAdminA)
        .send({
          caseNumber: "CASE-DIFFERENT-L1",
          court: "المحكمة الجزائية",
          sessionDateHijri: "1447/07/01",
          sessionTime: "11:30",
          assignedLawyerId: staffA1.id,
        });
      expect(res1.status).toBe(201);

      // Staff A2 can have a session at the exact same time
      const res2 = await request(app)
        .post("/api/sessions")
        .set("Cookie", cookieAdminA)
        .send({
          caseNumber: "CASE-DIFFERENT-L2",
          court: "المحكمة الجزائية",
          sessionDateHijri: "1447/07/01",
          sessionTime: "11:30",
          assignedLawyerId: staffA2.id,
        });
      expect(res2.status).toBe(201);
    });

    it("allows creating a session at the exact same date and time in a DIFFERENT office", async () => {
      // Office B can schedule a session at 1447/07/01 at 11:30 without conflict
      const res = await request(app)
        .post("/api/sessions")
        .set("Cookie", cookieAdminB)
        .send({
          caseNumber: "CASE-OFFICE-B-1130",
          court: "المحكمة التجارية",
          sessionDateHijri: "1447/07/01",
          sessionTime: "11:30",
        });
      expect(res.status).toBe(201);
    });

    it("allows editing an existing session without false conflict with itself", async () => {
      const allSessions = await postgresService.listSessions(adminA.id);
      const session = allSessions.find((s: any) => s.caseNumber === "CASE-DIFFERENT-L1");
      expect(session).toBeDefined();

      const res = await request(app)
        .patch(`/api/sessions/${session!.id}`)
        .set("Cookie", cookieAdminA)
        .send({
          notes: "تحديث الملاحظات دون تغيير الموعد",
          sessionTime: "11:30",
        });

      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // Feature 4: Monthly Report Tests
  // =========================================================================
  describe("Feature 4: Monthly Report (GET /reports/monthly)", () => {
    beforeAll(async () => {
      // Seed finished session, judgment, and completed task in November 2026
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const finishedSession = await postgresService.createSession(
        {
          caseNumber: "CASE-FINISHED-NOV",
          court: "المحكمة العامة",
          sessionDateHijri: "1447/05/10",
          sessionTime: "10:00",
          assignedLawyerId: staffA1.id,
          status: "Finished",
        } as any,
        adminA.id,
      );

      await postgresService.createJudgment(
        {
          caseNumber: "JUDG-CLOSED-NOV",
          court: "المحكمة التجارية",
          assignedLawyerId: staffA1.id,
          judgmentDate: `${currentYear}-${String(currentMonth).padStart(2, "0")}-15`,
        } as any,
        adminA.id,
      );

      await postgresService.createTask(
        {
          title: "مهمة منجزة في نوفمبر",
          assignedLawyerId: staffA1.id,
          status: "مكتملة",
        } as any,
        adminA.id,
      );
    });

    it("allows Admin to fetch monthly report with overall and lawyer breakdown", async () => {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const res = await request(app)
        .get(`/api/reports/monthly?month=${currentMonth}&year=${currentYear}`)
        .set("Cookie", cookieAdminA);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("overall");
      expect(res.body).toHaveProperty("byLawyer");

      expect(res.body.overall.sessionsHeld).toBeGreaterThanOrEqual(1);
      expect(res.body.overall.judgmentsClosed).toBeGreaterThanOrEqual(1);
      expect(res.body.overall.tasksCompleted).toBeGreaterThanOrEqual(1);

      const khalid = res.body.byLawyer.find((l: any) => l.lawyerId === staffA1.id);
      expect(khalid).toBeDefined();
      expect(khalid.sessionsHeld).toBeGreaterThanOrEqual(1);
      expect(khalid.judgmentsClosed).toBeGreaterThanOrEqual(1);
      expect(khalid.tasksCompleted).toBeGreaterThanOrEqual(1);
    });

    it("rejects staff from fetching monthly reports with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/reports/monthly")
        .set("Cookie", cookieStaffA1);

      expect(res.status).toBe(403);
    });
  });
});
