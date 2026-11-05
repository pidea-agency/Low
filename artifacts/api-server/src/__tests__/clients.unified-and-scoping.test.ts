import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";
import * as postgresService from "../services/postgres.service";

describe("Clients Entity & Lawyer Scoping across Sessions, Tasks, POA, Judgments", { timeout: 35000 }, () => {
  const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  let adminA: any;
  let cookieAdminA: string;

  let staffA1: any;
  let cookieStaffA1: string;

  let staffA2: any;
  let cookieStaffA2: string;

  let adminB: any;
  let cookieAdminB: string;

  let staffB1: any;
  let cookieStaffB1: string;

  let clientA1: any;
  let clientA2: any;

  beforeAll(async () => {
    postgresService.resetInMemoryStore();

    // 1. Office A Admin
    const unameAdminA = `cl_admin_a_${Date.now()}`;
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
    const unameStaffA1 = `cl_staff_a1_${Date.now()}`;
    staffA1 = await supabaseService.createSupabaseUser({
      username: unameStaffA1,
      password: "OfficePass123!",
      role: "staff",
      status: "active",
      admin_id: adminA.id,
      display_name: "المحامي زيد",
      subscription_end_date: futureDate,
    });
    const loginStaffA1 = await request(app)
      .post("/api/auth/login")
      .send({ username: unameStaffA1, password: "OfficePass123!" });
    expect(loginStaffA1.status).toBe(200);
    const cStaffA1 = loginStaffA1.headers["set-cookie"];
    cookieStaffA1 = Array.isArray(cStaffA1) ? cStaffA1.join("; ") : cStaffA1;

    // 3. Staff A2 under Admin A
    const unameStaffA2 = `cl_staff_a2_${Date.now()}`;
    staffA2 = await supabaseService.createSupabaseUser({
      username: unameStaffA2,
      password: "OfficePass123!",
      role: "staff",
      status: "active",
      admin_id: adminA.id,
      display_name: "المحامي عمرو",
      subscription_end_date: futureDate,
    });
    const loginStaffA2 = await request(app)
      .post("/api/auth/login")
      .send({ username: unameStaffA2, password: "OfficePass123!" });
    expect(loginStaffA2.status).toBe(200);
    const cStaffA2 = loginStaffA2.headers["set-cookie"];
    cookieStaffA2 = Array.isArray(cStaffA2) ? cStaffA2.join("; ") : cStaffA2;

    // 4. Office B Admin
    const unameAdminB = `cl_admin_b_${Date.now()}`;
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

    // 5. Staff B1 under Admin B
    const unameStaffB1 = `cl_staff_b1_${Date.now()}`;
    staffB1 = await supabaseService.createSupabaseUser({
      username: unameStaffB1,
      password: "OfficePass123!",
      role: "staff",
      status: "active",
      admin_id: adminB.id,
      display_name: "المحامي سعيد",
      subscription_end_date: futureDate,
    });
    const loginStaffB1 = await request(app)
      .post("/api/auth/login")
      .send({ username: unameStaffB1, password: "OfficePass123!" });
    expect(loginStaffB1.status).toBe(200);
    const cStaffB1 = loginStaffB1.headers["set-cookie"];
    cookieStaffB1 = Array.isArray(cStaffB1) ? cStaffB1.join("; ") : cStaffB1;
  });

  describe("Unified Client Management (/api/clients)", () => {
    it("Admin can create clients in their office", async () => {
      const res = await request(app)
        .post("/api/clients")
        .set("Cookie", cookieAdminA)
        .send({ name: "شركة النور للمقاولات", phone: "0501112223", notes: "عميل مهم" });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe("شركة النور للمقاولات");
      clientA1 = res.body;

      const res2 = await request(app)
        .post("/api/clients")
        .set("Cookie", cookieAdminA)
        .send({ name: "مؤسسة الأفق للتجارة", phone: "0509998887" });
      expect(res2.status).toBe(201);
      clientA2 = res2.body;
    });

    it("Admin sees all clients in their office", async () => {
      const res = await request(app)
        .get("/api/clients")
        .set("Cookie", cookieAdminA);

      expect(res.status).toBe(200);
      const names = res.body.map((c: any) => c.name);
      expect(names).toContain("شركة النور للمقاولات");
      expect(names).toContain("مؤسسة الأفق للتجارة");
    });

    it("Staff sees only clients with records assigned to them", async () => {
      // Before any records assigned to Staff A1, Staff A1 sees empty clients
      const resBefore = await request(app)
        .get("/api/clients")
        .set("Cookie", cookieStaffA1);
      expect(resBefore.status).toBe(200);
      expect(resBefore.body.length).toBe(0);

      // Staff A1 cannot access clientA1 via direct ID yet (returns 404)
      const resDetailBefore = await request(app)
        .get(`/api/clients/${clientA1.id}`)
        .set("Cookie", cookieStaffA1);
      expect(resDetailBefore.status).toBe(404);
    });
  });

  describe("Record Creation & Scoping (Staff A1 vs Staff A2 vs Admin)", () => {
    let sessionA1: any;
    let taskA1: any;
    let poaA1: any;
    let judgmentA1: any;

    it("Staff creating a session defaults assignedLawyerId to themselves", async () => {
      const res = await request(app)
        .post("/api/sessions")
        .set("Cookie", cookieStaffA1)
        .send({
          caseNumber: "CASE-101",
          court: "المحكمة العامة",
          sessionDateHijri: "1446/08/15",
          sessionTime: "10:00",
          clientId: clientA1.id,
          clientRole: "plaintiff",
        });

      expect(res.status).toBe(201);
      sessionA1 = res.body;
      expect(sessionA1.assignedLawyerId || sessionA1.assigned_lawyer_id).toBe(staffA1.id);
    });

    it("Staff creating a task defaults assignedLawyerId to themselves", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookieStaffA1)
        .send({
          title: "إعداد مذكرة الرد",
          priority: "عاجلة",
          clientId: clientA1.id,
        });

      expect(res.status).toBe(201);
      taskA1 = res.body;
      expect(taskA1.assignedLawyerId || taskA1.assigned_lawyer_id).toBe(staffA1.id);
    });

    it("Staff creating a POA defaults assignedLawyerId to themselves", async () => {
      const res = await request(app)
        .post("/api/poa")
        .set("Cookie", cookieStaffA1)
        .send({
          clientName: clientA1.name,
          poaNumber: "POA-9988",
          expiryDateHijri: "1447/01/01",
          clientId: clientA1.id,
        });

      expect(res.status).toBe(201);
      poaA1 = res.body;
      expect(poaA1.assignedLawyerId || poaA1.assigned_lawyer_id).toBe(staffA1.id);
    });

    it("Staff creating a judgment defaults assignedLawyerId to themselves", async () => {
      const res = await request(app)
        .post("/api/judgments")
        .set("Cookie", cookieStaffA1)
        .send({
          caseNumber: "CASE-101",
          judgmentNumber: "JDG-5544",
          clientId: clientA1.id,
          clientRole: "plaintiff",
        });

      expect(res.status).toBe(201);
      judgmentA1 = res.body;
      expect(judgmentA1.assignedLawyerId || judgmentA1.assigned_lawyer_id).toBe(staffA1.id);
    });

    it("Now Staff A1 can see clientA1 in GET /api/clients and GET /api/clients/:id", async () => {
      const resList = await request(app)
        .get("/api/clients")
        .set("Cookie", cookieStaffA1);
      expect(resList.status).toBe(200);
      expect(resList.body.length).toBe(1);
      expect(resList.body[0].id).toBe(clientA1.id);

      const resDetail = await request(app)
        .get(`/api/clients/${clientA1.id}`)
        .set("Cookie", cookieStaffA1);
      expect(resDetail.status).toBe(200);
      expect(resDetail.body.id).toBe(clientA1.id);
    });

    it("Staff A2 cannot see Staff A1's records even via direct ID (returns 404)", async () => {
      // Sessions
      const resSessList = await request(app)
        .get("/api/sessions")
        .set("Cookie", cookieStaffA2);
      expect(resSessList.body.some((s: any) => s.id === sessionA1.id)).toBe(false);

      const resSessDirect = await request(app)
        .get(`/api/sessions/${sessionA1.id}`)
        .set("Cookie", cookieStaffA2);
      expect(resSessDirect.status).toBe(404);

      // Tasks
      const resTaskList = await request(app)
        .get("/api/tasks")
        .set("Cookie", cookieStaffA2);
      expect(resTaskList.body.some((t: any) => t.id === taskA1.id)).toBe(false);

      const resTaskDirect = await request(app)
        .get(`/api/tasks/${taskA1.id}`)
        .set("Cookie", cookieStaffA2);
      expect(resTaskDirect.status).toBe(404);

      // POA
      const resPoaList = await request(app)
        .get("/api/poa")
        .set("Cookie", cookieStaffA2);
      expect(resPoaList.body.some((p: any) => p.id === poaA1.id)).toBe(false);

      const resPoaDirect = await request(app)
        .get(`/api/poa/${poaA1.id}`)
        .set("Cookie", cookieStaffA2);
      expect(resPoaDirect.status).toBe(404);

      // Judgments
      const resJdgList = await request(app)
        .get("/api/judgments")
        .set("Cookie", cookieStaffA2);
      expect(resJdgList.body.some((j: any) => j.id === judgmentA1.id)).toBe(false);

      const resJdgDirect = await request(app)
        .get(`/api/judgments/${judgmentA1.id}`)
        .set("Cookie", cookieStaffA2);
      expect(resJdgDirect.status).toBe(404);
    });

    it("Admin sees everything in their office", async () => {
      const resS = await request(app).get("/api/sessions").set("Cookie", cookieAdminA);
      expect(resS.body.some((s: any) => s.id === sessionA1.id)).toBe(true);

      const resT = await request(app).get("/api/tasks").set("Cookie", cookieAdminA);
      expect(resT.body.some((t: any) => t.id === taskA1.id)).toBe(true);

      const resP = await request(app).get("/api/poa").set("Cookie", cookieAdminA);
      expect(resP.body.some((p: any) => p.id === poaA1.id)).toBe(true);

      const resJ = await request(app).get("/api/judgments").set("Cookie", cookieAdminA);
      expect(resJ.body.some((j: any) => j.id === judgmentA1.id)).toBe(true);
    });

    it("Client timeline scoping (/api/clients/:id/timeline)", async () => {
      // Admin sees all 4 modules on timeline
      const resAdmin = await request(app)
        .get(`/api/clients/${clientA1.id}/timeline`)
        .set("Cookie", cookieAdminA);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.sessions.length).toBe(1);
      expect(resAdmin.body.tasks.length).toBe(1);
      expect(resAdmin.body.poa.length).toBe(1);
      expect(resAdmin.body.judgments.length).toBe(1);

      // Staff A1 sees them because they are assigned to Staff A1
      const resStaffA1 = await request(app)
        .get(`/api/clients/${clientA1.id}/timeline`)
        .set("Cookie", cookieStaffA1);
      expect(resStaffA1.status).toBe(200);
      expect(resStaffA1.body.sessions.length).toBe(1);

      // Staff A2 gets 404 because no records are assigned to Staff A2
      const resStaffA2 = await request(app)
        .get(`/api/clients/${clientA1.id}/timeline`)
        .set("Cookie", cookieStaffA2);
      expect(resStaffA2.status).toBe(404);
    });

    it("Admin can reassign records to another lawyer in the office", async () => {
      // Reassign task to Staff A2
      const resReassign = await request(app)
        .patch(`/api/tasks/${taskA1.id}/reassign`)
        .set("Cookie", cookieAdminA)
        .send({ assignedLawyerId: staffA2.id });

      expect(resReassign.status).toBe(200);
      expect(resReassign.body.assignedLawyerId || resReassign.body.assigned_lawyer_id).toBe(staffA2.id);

      // Now Staff A2 can see this task
      const resStaffA2Task = await request(app)
        .get(`/api/tasks/${taskA1.id}`)
        .set("Cookie", cookieStaffA2);
      expect(resStaffA2Task.status).toBe(200);

      // And Staff A1 can NO LONGER see this task
      const resStaffA1Task = await request(app)
        .get(`/api/tasks/${taskA1.id}`)
        .set("Cookie", cookieStaffA1);
      expect(resStaffA1Task.status).toBe(404);
    });

    it("Reassign rejects lawyers outside the office (returns 400)", async () => {
      const resCrossLawyer = await request(app)
        .patch(`/api/tasks/${taskA1.id}/reassign`)
        .set("Cookie", cookieAdminA)
        .send({ assignedLawyerId: staffB1.id });

      expect(resCrossLawyer.status).toBe(400);
      expect(resCrossLawyer.body.error).toContain("لا ينتمي إلى هذا المكتب");
    });

    it("Staff cannot reassign records (returns 403)", async () => {
      const resForbidden = await request(app)
        .patch(`/api/tasks/${taskA1.id}/reassign`)
        .set("Cookie", cookieStaffA2)
        .send({ assignedLawyerId: staffA1.id });

      expect(resForbidden.status).toBe(403);
    });

    it("Reassigning records across offices returns 404", async () => {
      const resCrossOffice = await request(app)
        .patch(`/api/tasks/${taskA1.id}/reassign`)
        .set("Cookie", cookieAdminB)
        .send({ assignedLawyerId: staffB1.id });

      expect(resCrossOffice.status).toBe(404);
    });
  });

  describe("Admin Legacy Triage View & Triage Link", () => {
    let unassignedSession: any;

    beforeAll(async () => {
      // Create an unassigned session directly
      unassignedSession = await postgresService.createSession(
        {
          caseNumber: "LEGACY-CASE-1",
          court: "المحكمة التجارية",
          sessionDateHijri: "1446/09/01",
          sessionTime: "11:00",
          clientId: null,
          assignedLawyerId: null,
        } as any,
        adminA.id,
      );
    });

    it("Admin can view unassigned legacy records", async () => {
      const res = await request(app)
        .get("/api/clients/legacy-unassigned")
        .set("Cookie", cookieAdminA);

      expect(res.status).toBe(200);
      expect(res.body.sessions).toBeDefined();
      expect(res.body.sessions.some((s: any) => s.id === unassignedSession.id)).toBe(true);
      expect(res.body.totalUnassigned).toBeGreaterThan(0);
    });

    it("Staff cannot access legacy triage view (returns 403)", async () => {
      const res = await request(app)
        .get("/api/clients/legacy-unassigned")
        .set("Cookie", cookieStaffA1);

      expect(res.status).toBe(403);
    });

    it("Admin can triage-link a legacy record to a client and lawyer", async () => {
      const res = await request(app)
        .post("/api/clients/triage-link")
        .set("Cookie", cookieAdminA)
        .send({
          module: "sessions",
          id: unassignedSession.id,
          clientId: clientA2.id,
          assignedLawyerId: staffA1.id,
        });

      expect(res.status).toBe(200);
      expect(res.body.clientId || res.body.client_id).toBe(clientA2.id);
      expect(res.body.assignedLawyerId || res.body.assigned_lawyer_id).toBe(staffA1.id);

      // Now Staff A1 can see this session
      const resStaff = await request(app)
        .get(`/api/sessions/${unassignedSession.id}`)
        .set("Cookie", cookieStaffA1);
      expect(resStaff.status).toBe(200);
    });
  });
});

