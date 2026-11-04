import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";
import * as postgresService from "../services/postgres.service";

describe("Dashboard Role-based Data Scoping & Multi-tenant Isolation", { timeout: 35000 }, () => {
  const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  let adminA: any;
  let cookieAdminA: string;

  let staffA1: any;
  let cookieStaffA1: string;

  let staffA2: any;
  let cookieStaffA2: string;

  let adminB: any;
  let cookieAdminB: string;

  let superAdmin: any;
  let cookieSuperAdmin: string;

  beforeAll(async () => {
    postgresService.resetInMemoryStore();

    // 1. Office A Admin
    const unameAdminA = `dash_admin_a_${Date.now()}`;
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
    const unameStaffA1 = `dash_staff_a1_${Date.now()}`;
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
    const unameStaffA2 = `dash_staff_a2_${Date.now()}`;
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
    const unameAdminB = `dash_admin_b_${Date.now()}`;
    adminB = await supabaseService.createSupabaseUser({
      username: unameAdminB,
      password: "OfficePass123!",
      role: "admin",
      status: "active",
      plan_tier: "pro",
      subscription_end_date: futureDate,
    });
    const loginAdminB = await request(app)
      .post("/api/auth/login")
      .send({ username: unameAdminB, password: "OfficePass123!" });
    expect(loginAdminB.status).toBe(200);
    const cAdminB = loginAdminB.headers["set-cookie"];
    cookieAdminB = Array.isArray(cAdminB) ? cAdminB.join("; ") : cAdminB;

    // 5. Super Admin
    const unameSuper = `dash_super_${Date.now()}`;
    superAdmin = await supabaseService.createSupabaseUser({
      username: unameSuper,
      password: "OfficePass123!",
      role: "super_admin",
      status: "active",
    });
    const loginSuper = await request(app)
      .post("/api/auth/admin-login")
      .send({ username: unameSuper, password: "OfficePass123!" });
    expect(loginSuper.status).toBe(200);
    const cSuper = loginSuper.headers["set-cookie"];
    cookieSuperAdmin = Array.isArray(cSuper) ? cSuper.join("; ") : cSuper;

    // Seed tasks for Office A
    await postgresService.createTask(
      {
        title: "مهمة خالد 1",
        assignee: staffA1.username,
        priority: "عاجلة",
        dueDate: "2026-12-01",
        status: "قيد التنفيذ",
        notes: "مهمة لخالد",
      },
      adminA.id
    );
    await postgresService.createTask(
      {
        title: "مهمة مريم 1",
        assignee: staffA2.username,
        priority: "عادية",
        dueDate: "2026-12-05",
        status: "قيد التنفيذ",
        notes: "مهمة لمريم",
      },
      adminA.id
    );

    // Seed tasks for Office B
    await postgresService.createTask(
      {
        title: "مهمة مكتب ب الخاصة",
        assignee: "lawyer_b",
        priority: "عاجلة",
        dueDate: "2026-12-10",
        status: "قيد التنفيذ",
        notes: "خاص بمكتب ب",
      },
      adminB.id
    );
  }, 40000);

  afterAll(async () => {
    postgresService.resetInMemoryStore();
  });

  describe("1. Admin Dashboard Endpoint Scoping", () => {
    it("Admin A gets office-wide stats for Office A", async () => {
      const res = await request(app)
        .get("/api/dashboard/stats")
        .set("Cookie", cookieAdminA);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalCases");
      expect(res.body).toHaveProperty("todayHearings");
      expect(res.body).toHaveProperty("upcomingHearings");
      expect(res.body).toHaveProperty("finishedHearings");
      expect(res.body).toHaveProperty("totalPoas");
    });

    it("Admin A sees all tasks for Office A (both staff A1 and A2) but never Office B", async () => {
      const res = await request(app)
        .get("/api/tasks")
        .set("Cookie", cookieAdminA);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const titles = res.body.map((t: any) => t.title);
      expect(titles).toContain("مهمة خالد 1");
      expect(titles).toContain("مهمة مريم 1");
      expect(titles).not.toContain("مهمة مكتب ب الخاصة");
    });

    it("Admin B sees only Office B tasks and never Office A", async () => {
      const res = await request(app)
        .get("/api/tasks")
        .set("Cookie", cookieAdminB);

      expect(res.status).toBe(200);
      const titles = res.body.map((t: any) => t.title);
      expect(titles).toContain("مهمة مكتب ب الخاصة");
      expect(titles).not.toContain("مهمة خالد 1");
      expect(titles).not.toContain("مهمة مريم 1");
    });
  });

  describe("2. Staff Personal Dashboard Scoping", () => {
    it("Staff A1 querying personal tasks gets only tasks assigned to them", async () => {
      const res = await request(app)
        .get("/api/tasks?scope=personal")
        .set("Cookie", cookieStaffA1);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const titles = res.body.map((t: any) => t.title);
      expect(titles).toContain("مهمة خالد 1");
      expect(titles).not.toContain("مهمة مريم 1");
      expect(titles).not.toContain("مهمة مكتب ب الخاصة");
    });

    it("Staff A2 querying personal tasks gets only tasks assigned to them", async () => {
      const res = await request(app)
        .get("/api/tasks?scope=personal")
        .set("Cookie", cookieStaffA2);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const titles = res.body.map((t: any) => t.title);
      expect(titles).toContain("مهمة مريم 1");
      expect(titles).not.toContain("مهمة خالد 1");
      expect(titles).not.toContain("مهمة مكتب ب الخاصة");
    });
  });

  describe("3. Staff Cannot Access Admin-Only Management Endpoints", () => {
    it("Staff A1 cannot access /api/users (office member management)", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Cookie", cookieStaffA1);

      expect(res.status).toBe(403);
    });

    it("Staff A1 cannot access /api/subscription/overview", async () => {
      const res = await request(app)
        .get("/api/subscription/overview")
        .set("Cookie", cookieStaffA1);

      expect(res.status).toBe(403);
    });

    it("Staff A1 cannot access /api/settings/google-bind", async () => {
      const res = await request(app)
        .post("/api/settings/google-bind")
        .set("Cookie", cookieStaffA1)
        .send({
          google_spreadsheet_id: "test",
          google_sheet_name: "Sheet1",
          google_service_account_json: "{}",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("4. SuperAdmin Blocked from Office Dashboard & Data", () => {
    it("Super Admin is blocked (403) from /api/dashboard/stats", async () => {
      const res = await request(app)
        .get("/api/dashboard/stats")
        .set("Cookie", cookieSuperAdmin);

      expect(res.status).toBe(403);
    });

    it("Super Admin is blocked (403) from /api/tasks", async () => {
      const res = await request(app)
        .get("/api/tasks")
        .set("Cookie", cookieSuperAdmin);

      expect(res.status).toBe(403);
    });
  });
});
