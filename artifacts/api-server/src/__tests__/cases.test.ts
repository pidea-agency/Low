import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";
import * as postgresService from "../services/postgres.service";

describe("Cases Module: Scoping, Visibility, Detail, Reassign and Stats", { timeout: 45000 }, () => {
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
  let clientB1: any;

  let case1: any;
  let case2: any;
  let case3: any;
  let caseB: any;

  beforeAll(async () => {
    postgresService.resetInMemoryStore();

    // 1. Office A Admin
    const unameAdminA = `cases_admin_a_${Date.now()}`;
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
    const unameStaffA1 = `cases_staff_a1_${Date.now()}`;
    staffA1 = await supabaseService.createSupabaseUser({
      username: unameStaffA1,
      password: "OfficePass123!",
      role: "staff",
      status: "active",
      admin_id: adminA.id,
      display_name: "المحامي حسام",
      subscription_end_date: futureDate,
    });
    const loginStaffA1 = await request(app)
      .post("/api/auth/login")
      .send({ username: unameStaffA1, password: "OfficePass123!" });
    expect(loginStaffA1.status).toBe(200);
    const cStaffA1 = loginStaffA1.headers["set-cookie"];
    cookieStaffA1 = Array.isArray(cStaffA1) ? cStaffA1.join("; ") : cStaffA1;

    // 3. Staff A2 under Admin A
    const unameStaffA2 = `cases_staff_a2_${Date.now()}`;
    staffA2 = await supabaseService.createSupabaseUser({
      username: unameStaffA2,
      password: "OfficePass123!",
      role: "staff",
      status: "active",
      admin_id: adminA.id,
      display_name: "المحامية مريم",
      subscription_end_date: futureDate,
    });
    const loginStaffA2 = await request(app)
      .post("/api/auth/login")
      .send({ username: unameStaffA2, password: "OfficePass123!" });
    expect(loginStaffA2.status).toBe(200);
    const cStaffA2 = loginStaffA2.headers["set-cookie"];
    cookieStaffA2 = Array.isArray(cStaffA2) ? cStaffA2.join("; ") : cStaffA2;

    // 4. Office B Admin
    const unameAdminB = `cases_admin_b_${Date.now()}`;
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

    // Create clients
    const c1Res = await request(app)
      .post("/api/clients")
      .set("Cookie", cookieAdminA)
      .send({ name: "الشركة الدولية للاستثمار", phone: "0501111111" });
    expect([200, 201]).toContain(c1Res.status);
    clientA1 = c1Res.body;

    const c2Res = await request(app)
      .post("/api/clients")
      .set("Cookie", cookieAdminA)
      .send({ name: "مؤسسة الأفق العقارية", phone: "0502222222" });
    expect([200, 201]).toContain(c2Res.status);
    clientA2 = c2Res.body;

    const cbRes = await request(app)
      .post("/api/clients")
      .set("Cookie", cookieAdminB)
      .send({ name: "عميل مكتب ب", phone: "0509999999" });
    expect([200, 201]).toContain(cbRes.status);
    clientB1 = cbRes.body;
  });

  it("creates cases with required fields and office scoping", async () => {
    // 1. Case 1 created by Admin A, assigned to Staff A1
    const res1 = await request(app)
      .post("/api/cases")
      .set("Cookie", cookieAdminA)
      .send({
        clientId: clientA1.id,
        caseNumber: "2025/101",
        caseType: "تجاري",
        court: "المحكمة التجارية بالرياض",
        assignedLawyerId: staffA1.id,
        status: "open",
        opposingParty: "شركة الرواد",
      });
    expect(res1.status).toBe(201);
    expect(res1.body.caseNumber).toBe("2025/101");
    case1 = res1.body;

    // 2. Case 2 created by Staff A1 (unassigned lawyer, createdBy staffA1)
    const res2 = await request(app)
      .post("/api/cases")
      .set("Cookie", cookieStaffA1)
      .send({
        clientId: clientA1.id,
        caseNumber: "2025/102",
        caseType: "عمالي",
        court: "المحكمة العمالية",
        status: "postponed",
        opposingParty: "موظف سابق",
      });
    expect(res2.status).toBe(201);
    expect(res2.body.caseNumber).toBe("2025/102");
    case2 = res2.body;

    // 3. Case 3 created by Admin A, assigned to Staff A2
    const res3 = await request(app)
      .post("/api/cases")
      .set("Cookie", cookieAdminA)
      .send({
        clientId: clientA2.id,
        caseNumber: "2025/103",
        caseType: "عقاري",
        court: "المحكمة العامة",
        assignedLawyerId: staffA2.id,
        status: "closed",
        opposingParty: "مالك العقار",
      });
    expect(res3.status).toBe(201);
    case3 = res3.body;

    // 4. Case in Office B
    const resB = await request(app)
      .post("/api/cases")
      .set("Cookie", cookieAdminB)
      .send({
        clientId: clientB1.id,
        caseNumber: "2025/999",
        caseType: "مدني",
        court: "محكمة جدة",
        status: "open",
      });
    expect(resB.status).toBe(201);
    caseB = resB.body;
  });

  it("staff sees only their assigned cases and cases they created", async () => {
    // Staff A1 should see Case 1 (assigned to them) and Case 2 (created by them)
    const resStaff1 = await request(app)
      .get("/api/cases")
      .set("Cookie", cookieStaffA1);
    expect(resStaff1.status).toBe(200);
    const caseNumbers = resStaff1.body.map((c: any) => c.caseNumber);
    expect(caseNumbers).toContain("2025/101");
    expect(caseNumbers).toContain("2025/102");
    expect(caseNumbers).not.toContain("2025/103"); // Assigned to Staff A2
    expect(caseNumbers).not.toContain("2025/999"); // Office B
  });

  it("admin sees all cases in their office, with cross-office isolation", async () => {
    const resAdminA = await request(app)
      .get("/api/cases")
      .set("Cookie", cookieAdminA);
    expect(resAdminA.status).toBe(200);
    const caseNumbers = resAdminA.body.map((c: any) => c.caseNumber);
    expect(caseNumbers).toContain("2025/101");
    expect(caseNumbers).toContain("2025/102");
    expect(caseNumbers).toContain("2025/103");
    expect(caseNumbers).not.toContain("2025/999"); // Never Office B!
  });

  it("enforces cross-office isolation and staff permission checks on single case access", async () => {
    // Office B cannot access Office A's case
    const resCross = await request(app)
      .get(`/api/cases/${case1.id}`)
      .set("Cookie", cookieAdminB);
    expect([403, 404]).toContain(resCross.status);

    // Staff A1 cannot access Case 3 (assigned to Staff A2)
    const resForbidden = await request(app)
      .get(`/api/cases/${case3.id}`)
      .set("Cookie", cookieStaffA1);
    expect(resForbidden.status).toBe(403);

    // Staff A1 can access Case 1 (assigned to Staff A1)
    const resAllowed = await request(app)
      .get(`/api/cases/${case1.id}`)
      .set("Cookie", cookieStaffA1);
    expect(resAllowed.status).toBe(200);
    expect(resAllowed.body.id).toBe(case1.id);
  });

  it("GET /cases/stats counts match visible scope for admin vs staff", async () => {
    // Admin A sees all 3 cases: 1 open (2025/101), 1 postponed (2025/102), 1 closed (2025/103)
    const resAdminStats = await request(app)
      .get("/api/cases/stats")
      .set("Cookie", cookieAdminA);
    expect(resAdminStats.status).toBe(200);
    expect(resAdminStats.body.total).toBe(3);
    expect(resAdminStats.body.open).toBe(1);
    expect(resAdminStats.body.postponed).toBe(1);
    expect(resAdminStats.body.closed).toBe(1);

    // Staff A1 sees only Case 1 (open) and Case 2 (postponed)
    const resStaffStats = await request(app)
      .get("/api/cases/stats")
      .set("Cookie", cookieStaffA1);
    expect(resStaffStats.status).toBe(200);
    expect(resStaffStats.body.total).toBe(2);
    expect(resStaffStats.body.open).toBe(1);
    expect(resStaffStats.body.postponed).toBe(1);
    expect(resStaffStats.body.closed).toBe(0);

    // Staff A2 sees only Case 3 (closed)
    const resStaff2Stats = await request(app)
      .get("/api/cases/stats")
      .set("Cookie", cookieStaffA2);
    expect(resStaff2Stats.status).toBe(200);
    expect(resStaff2Stats.body.total).toBe(1);
    expect(resStaff2Stats.body.open).toBe(0);
    expect(resStaff2Stats.body.closed).toBe(1);
  });

  it("GET /cases/:id/detail returns case info + linked sessions + judgments + client info", async () => {
    // Link a session to Case 1
    const sessionRes = await request(app)
      .post("/api/sessions")
      .set("Cookie", cookieAdminA)
      .send({
        caseNumber: case1.caseNumber,
        caseId: case1.id,
        court: "المحكمة التجارية بالرياض",
        sessionDateHijri: "1446-08-15",
        sessionTime: "10:00",
        notes: "جلسة المرافعة الأولى",
        assignedLawyerId: staffA1.id,
      });
    expect([200, 201]).toContain(sessionRes.status);

    // Link a judgment to Case 1
    const judgmentRes = await request(app)
      .post("/api/judgments")
      .set("Cookie", cookieAdminA)
      .send({
        caseNumber: case1.caseNumber,
        caseId: case1.id,
        court: "المحكمة التجارية بالرياض",
        judgmentNumber: "J-2025/101",
        judgmentDate: "1446-08-10",
        summary: "حكم ابتدائي لصالح الموكل",
        isFavorable: "ابتدائي",
        assignedLawyerId: staffA1.id,
      });
    expect([200, 201]).toContain(judgmentRes.status);

    // Get detail
    const detailRes = await request(app)
      .get(`/api/cases/${case1.id}/detail`)
      .set("Cookie", cookieStaffA1);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.case.id).toBe(case1.id);
    expect(detailRes.body.client.id).toBe(clientA1.id);
    expect(detailRes.body.sessions.length).toBeGreaterThanOrEqual(1);
    expect(detailRes.body.judgments.length).toBeGreaterThanOrEqual(1);
  });

  it("PATCH /cases/:id/reassign is admin-only", async () => {
    // Staff A1 tries to reassign -> 403
    const resStaffReassign = await request(app)
      .patch(`/api/cases/${case1.id}/reassign`)
      .set("Cookie", cookieStaffA1)
      .send({ assignedLawyerId: staffA2.id });
    expect(resStaffReassign.status).toBe(403);

    // Admin A reassigns Case 1 from Staff A1 to Staff A2 -> 200
    const resAdminReassign = await request(app)
      .patch(`/api/cases/${case1.id}/reassign`)
      .set("Cookie", cookieAdminA)
      .send({ assignedLawyerId: staffA2.id });
    expect(resAdminReassign.status).toBe(200);
    expect(resAdminReassign.body.assignedLawyerId).toBe(staffA2.id);

    // Now Staff A2 can access Case 1
    const resStaff2Access = await request(app)
      .get(`/api/cases/${case1.id}`)
      .set("Cookie", cookieStaffA2);
    expect(resStaff2Access.status).toBe(200);
  });
});
