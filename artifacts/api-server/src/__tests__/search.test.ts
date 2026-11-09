import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";
import * as postgresService from "../services/postgres.service";

describe("Global Search Endpoint & Scoping Rules", { timeout: 35000 }, () => {
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
  let clientB1: any;

  beforeAll(async () => {
    postgresService.resetInMemoryStore();

    // 1. Office A Admin
    const unameAdminA = `srch_admin_a_${Date.now()}`;
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
    const unameStaffA1 = `srch_staff_a1_${Date.now()}`;
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
    const unameStaffA2 = `srch_staff_a2_${Date.now()}`;
    staffA2 = await supabaseService.createSupabaseUser({
      username: unameStaffA2,
      password: "OfficePass123!",
      role: "staff",
      status: "active",
      admin_id: adminA.id,
      display_name: "المحامي عمر",
      subscription_end_date: futureDate,
    });
    const loginStaffA2 = await request(app)
      .post("/api/auth/login")
      .send({ username: unameStaffA2, password: "OfficePass123!" });
    expect(loginStaffA2.status).toBe(200);
    const cStaffA2 = loginStaffA2.headers["set-cookie"];
    cookieStaffA2 = Array.isArray(cStaffA2) ? cStaffA2.join("; ") : cStaffA2;

    // 4. Office B Admin
    const unameAdminB = `srch_admin_b_${Date.now()}`;
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
    const unameStaffB1 = `srch_staff_b1_${Date.now()}`;
    staffB1 = await supabaseService.createSupabaseUser({
      username: unameStaffB1,
      password: "OfficePass123!",
      role: "staff",
      status: "active",
      admin_id: adminB.id,
      display_name: "محامي مكتب ب",
      subscription_end_date: futureDate,
    });
    const loginStaffB1 = await request(app)
      .post("/api/auth/login")
      .send({ username: unameStaffB1, password: "OfficePass123!" });
    expect(loginStaffB1.status).toBe(200);
    const cStaffB1 = loginStaffB1.headers["set-cookie"];
    cookieStaffB1 = Array.isArray(cStaffB1) ? cStaffB1.join("; ") : cStaffB1;

    // Seed Data in Office A
    clientA1 = await postgresService.createClient(
      { name: "شركة الأمل للتجارة", phone: "0551112222", notes: "عميل قديم" },
      adminA.id,
    );
    clientA2 = await postgresService.createClient(
      { name: "مؤسسة النور الدولية", phone: "0553334444", notes: "عميل تجاري" },
      adminA.id,
    );

    // Sessions in Office A
    await postgresService.createSession(
      {
        caseNumber: "CASE-A1-100",
        plaintiff: "خالد سعيد",
        defendant: "شركة الأمل للتجارة",
        court: "المحكمة العامة",
        clientId: clientA1.id,
        assignedLawyerId: staffA1.id,
        createdBy: staffA1.id,
      } as any,
      adminA.id,
    );
    await postgresService.createSession(
      {
        caseNumber: "CASE-A2-200",
        plaintiff: "سالم محمود",
        defendant: "مؤسسة النور الدولية",
        court: "المحكمة العمالية",
        clientId: clientA2.id,
        assignedLawyerId: staffA2.id,
        createdBy: staffA2.id,
      } as any,
      adminA.id,
    );

    // POA in Office A
    await postgresService.createPoa(
      {
        poaNumber: "POA-A1-111",
        clientName: "أحمد بن عبد الله الأمل",
        clientId: clientA1.id,
        assignedLawyerId: staffA1.id,
        createdBy: staffA1.id,
      } as any,
      adminA.id,
    );
    await postgresService.createPoa(
      {
        poaNumber: "POA-A2-222",
        clientName: "سعد بن محمد النور",
        clientId: clientA2.id,
        assignedLawyerId: staffA2.id,
        createdBy: staffA2.id,
      } as any,
      adminA.id,
    );

    // Judgments in Office A
    await postgresService.createJudgment(
      {
        caseNumber: "JUDG-A1-333",
        plaintiff: "شركة الأمل للتجارة",
        defendant: "الطرف الآخر",
        court: "المحكمة التجارية",
        clientId: clientA1.id,
        assignedLawyerId: staffA1.id,
        createdBy: staffA1.id,
      } as any,
      adminA.id,
    );
    await postgresService.createJudgment(
      {
        caseNumber: "JUDG-A2-444",
        plaintiff: "مؤسسة النور الدولية",
        defendant: "الطرف الثاني",
        court: "المحكمة التجارية",
        clientId: clientA2.id,
        assignedLawyerId: staffA2.id,
        createdBy: staffA2.id,
      } as any,
      adminA.id,
    );

    // Tasks in Office A
    await postgresService.createTask(
      {
        title: "إعداد مذكرة دفاع الأمل",
        clientId: clientA1.id,
        assignedLawyerId: staffA1.id,
        createdBy: staffA1.id,
      } as any,
      adminA.id,
    );
    await postgresService.createTask(
      {
        title: "مراجعة عقد مؤسسة النور",
        clientId: clientA2.id,
        assignedLawyerId: staffA2.id,
        createdBy: staffA2.id,
      } as any,
      adminA.id,
    );

    // Seed Data in Office B (Cross-office isolation check)
    clientB1 = await postgresService.createClient(
      { name: "شركة الأمل فرع الرياض", phone: "0559998888", notes: "مكتب ب" },
      adminB.id,
    );
    await postgresService.createSession(
      {
        caseNumber: "CASE-B-999",
        plaintiff: "شركة الأمل فرع الرياض",
        clientId: clientB1.id,
        assignedLawyerId: staffB1.id,
        createdBy: staffB1.id,
      } as any,
      adminB.id,
    );
    await postgresService.createPoa(
      {
        poaNumber: "POA-B-999",
        clientName: "شركة الأمل فرع الرياض",
        clientId: clientB1.id,
        assignedLawyerId: staffB1.id,
        createdBy: staffB1.id,
      } as any,
      adminB.id,
    );
    await postgresService.createTask(
      {
        title: "مهمة فرع الرياض الأمل",
        clientId: clientB1.id,
        assignedLawyerId: staffB1.id,
        createdBy: staffB1.id,
      } as any,
      adminB.id,
    );
  }, 60000);

  it("returns empty result structure when query is empty", async () => {
    const res = await request(app)
      .get("/api/search?q=")
      .set("Cookie", cookieAdminA);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      clients: [],
      poa: [],
      judgments: [],
      sessions: [],
      tasks: [],
    });
  });

  it("Office Admin sees all matching records in their office, but zero from another office", async () => {
    const res = await request(app)
      .get("/api/search?q=الأمل")
      .set("Cookie", cookieAdminA);

    expect(res.status).toBe(200);
    const { clients, poa, judgments, sessions, tasks } = res.body;

    // Clients: should match Client A1 (شركة الأمل للتجارة)
    expect(clients.some((c: any) => c.name === "شركة الأمل للتجارة")).toBe(true);
    // Should NOT see Client B1 from Office B
    expect(clients.some((c: any) => c.name.includes("الرياض"))).toBe(false);

    // Sessions: should match Session 1 (defendant: شركة الأمل للتجارة)
    expect(sessions.some((s: any) => s.caseNumber === "CASE-A1-100")).toBe(true);
    expect(sessions.some((s: any) => s.caseNumber === "CASE-B-999")).toBe(false);

    // POA: should match POA 1
    expect(poa.some((p: any) => p.poaNumber === "POA-A1-111")).toBe(true);
    expect(poa.some((p: any) => p.poaNumber === "POA-B-999")).toBe(false);

    // Judgments: should match Judgment 1
    expect(judgments.some((j: any) => j.caseNumber === "JUDG-A1-333")).toBe(true);

    // Tasks: should match Task 1
    expect(tasks.some((t: any) => t.title === "إعداد مذكرة دفاع الأمل")).toBe(true);
    expect(tasks.some((t: any) => t.title.includes("الرياض"))).toBe(false);
  });

  it("Staff Lawyer 1 sees only records assigned to them (or created by them)", async () => {
    const res = await request(app)
      .get("/api/search?q=الأمل")
      .set("Cookie", cookieStaffA1);

    expect(res.status).toBe(200);
    const { clients, poa, judgments, sessions, tasks } = res.body;

    // Staff A1 is assigned to Session 1, POA 1, Judgment 1, Task 1
    expect(clients.some((c: any) => c.name === "شركة الأمل للتجارة")).toBe(true);
    expect(sessions.some((s: any) => s.caseNumber === "CASE-A1-100")).toBe(true);
    expect(poa.some((p: any) => p.poaNumber === "POA-A1-111")).toBe(true);
    expect(judgments.some((j: any) => j.caseNumber === "JUDG-A1-333")).toBe(true);
    expect(tasks.some((t: any) => t.title === "إعداد مذكرة دفاع الأمل")).toBe(true);

    // Zero leakage from Office B
    expect(clients.some((c: any) => c.name.includes("الرياض"))).toBe(false);
    expect(sessions.some((s: any) => s.caseNumber === "CASE-B-999")).toBe(false);
  });

  it("Staff Lawyer 2 cannot see Lawyer 1's records when searching", async () => {
    // Staff A2 searches "الأمل" - which only belongs to Staff A1
    const res = await request(app)
      .get("/api/search?q=الأمل")
      .set("Cookie", cookieStaffA2);

    expect(res.status).toBe(200);
    const { clients, poa, judgments, sessions, tasks } = res.body;

    // Should NOT see Staff A1's records or clients
    expect(clients.length).toBe(0);
    expect(poa.length).toBe(0);
    expect(judgments.length).toBe(0);
    expect(sessions.length).toBe(0);
    expect(tasks.length).toBe(0);
  });

  it("Staff Lawyer 2 sees their own assigned records when searching", async () => {
    const res = await request(app)
      .get("/api/search?q=النور")
      .set("Cookie", cookieStaffA2);

    expect(res.status).toBe(200);
    const { clients, poa, judgments, sessions, tasks } = res.body;

    expect(clients.some((c: any) => c.name === "مؤسسة النور الدولية")).toBe(true);
    expect(sessions.some((s: any) => s.caseNumber === "CASE-A2-200")).toBe(true);
    expect(poa.some((p: any) => p.poaNumber === "POA-A2-222")).toBe(true);
    expect(judgments.some((j: any) => j.caseNumber === "JUDG-A2-444")).toBe(true);
    expect(tasks.some((t: any) => t.title === "مراجعة عقد مؤسسة النور")).toBe(true);

    // Staff A1 should NOT see these when searching "النور"
    const resStaff1 = await request(app)
      .get("/api/search?q=النور")
      .set("Cookie", cookieStaffA1);

    expect(resStaff1.body.clients.length).toBe(0);
    expect(resStaff1.body.sessions.length).toBe(0);
    expect(resStaff1.body.poa.length).toBe(0);
    expect(resStaff1.body.judgments.length).toBe(0);
    expect(resStaff1.body.tasks.length).toBe(0);
  });

  it("Staff sees unassigned records if created by them", async () => {
    const unassignedSession = await postgresService.createSession(
      {
        caseNumber: "CASE-UNASSIGNED-555",
        plaintiff: "طرف تجريبي غير معين",
        court: "المحكمة العامة",
        assignedLawyerId: null,
        createdBy: staffA1.id,
      } as any,
      adminA.id,
    );

    // Staff A1 (creator) should see it
    const resStaffA1 = await request(app)
      .get("/api/search?q=CASE-UNASSIGNED-555")
      .set("Cookie", cookieStaffA1);
    expect(resStaffA1.status).toBe(200);
    expect(resStaffA1.body.sessions.some((s: any) => s.caseNumber === "CASE-UNASSIGNED-555")).toBe(true);

    // Staff A2 (non-creator, not assigned) should NOT see it
    const resStaffA2 = await request(app)
      .get("/api/search?q=CASE-UNASSIGNED-555")
      .set("Cookie", cookieStaffA2);
    expect(resStaffA2.status).toBe(200);
    expect(resStaffA2.body.sessions.length).toBe(0);
  });

  it("Search enforces limit of ~5 per category", async () => {
    // Seed 7 tasks matching "اختبار الحد" assigned to Staff A1
    for (let i = 1; i <= 7; i++) {
      await postgresService.createTask(
        {
          title: `اختبار الحد مهمة ${i}`,
          assignedLawyerId: staffA1.id,
          createdBy: staffA1.id,
        } as any,
        adminA.id,
      );
    }

    const res = await request(app)
      .get("/api/search?q=اختبار الحد")
      .set("Cookie", cookieStaffA1);

    expect(res.status).toBe(200);
    expect(res.body.tasks.length).toBe(5);
  });
});
