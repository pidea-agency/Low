import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";
import * as postgresService from "../services/postgres.service";

describe("Office Subscription & Usage Allocation Isolation", { timeout: 35000 }, () => {
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

    // 1. Create Admin A with 10 requests quota
    const unameAdminA = `sub_admin_a_${Date.now()}`;
    adminA = await supabaseService.createSupabaseUser({
      username: unameAdminA,
      password: "OfficePass123!",
      role: "admin",
      status: "active",
      plan_tier: "plus",
      billing_cycle: "annual",
      ai_quota_limit: 10,
      subscription_end_date: futureDate,
    });
    const loginAdminA = await request(app)
      .post("/api/auth/login")
      .send({ username: unameAdminA, password: "OfficePass123!" });
    expect(loginAdminA.status).toBe(200);
    const cA = loginAdminA.headers["set-cookie"];
    cookieAdminA = Array.isArray(cA) ? cA.join("; ") : cA;

    // 2. Create Admin B with 10 requests quota
    const unameAdminB = `sub_admin_b_${Date.now()}`;
    adminB = await supabaseService.createSupabaseUser({
      username: unameAdminB,
      password: "OfficePass123!",
      role: "admin",
      status: "active",
      plan_tier: "pro",
      billing_cycle: "monthly",
      ai_quota_limit: 20,
      subscription_end_date: futureDate,
    });
    const loginAdminB = await request(app)
      .post("/api/auth/login")
      .send({ username: unameAdminB, password: "OfficePass123!" });
    expect(loginAdminB.status).toBe(200);
    const cB = loginAdminB.headers["set-cookie"];
    cookieAdminB = Array.isArray(cB) ? cB.join("; ") : cB;

    // 3. Admin A creates Staff A
    const unameStaffA = `sub_staff_a_${Date.now()}`;
    const createStaffARes = await request(app)
      .post("/api/users")
      .set("Cookie", cookieAdminA)
      .send({
        username: unameStaffA,
        password: "StaffPass123!",
        display_name: "محامي مكتب أ",
        email: `${unameStaffA}@law.local`,
      });
    expect(createStaffARes.status).toBe(201);
    staffA = createStaffARes.body;

    const loginStaffA = await request(app)
      .post("/api/auth/login")
      .send({ username: unameStaffA, password: "StaffPass123!" });
    expect(loginStaffA.status).toBe(200);
    const cStaffA = loginStaffA.headers["set-cookie"];
    cookieStaffA = Array.isArray(cStaffA) ? cStaffA.join("; ") : cStaffA;

    // 4. Admin B creates Staff B
    const unameStaffB = `sub_staff_b_${Date.now()}`;
    const createStaffBRes = await request(app)
      .post("/api/users")
      .set("Cookie", cookieAdminB)
      .send({
        username: unameStaffB,
        password: "StaffPass123!",
        display_name: "محامي مكتب ب",
        email: `${unameStaffB}@law.local`,
      });
    expect(createStaffBRes.status).toBe(201);
    staffB = createStaffBRes.body;

    const loginStaffB = await request(app)
      .post("/api/auth/login")
      .send({ username: unameStaffB, password: "StaffPass123!" });
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

  describe("Gating & Role Authorization", () => {
    it("blocks staff members from accessing GET /api/subscription/overview (403)", async () => {
      const res = await request(app)
        .get("/api/subscription/overview")
        .set("Cookie", cookieStaffA);

      expect(res.status).toBe(403);
    });

    it("blocks staff members from accessing PATCH /api/subscription/members/:id/quota (403)", async () => {
      const res = await request(app)
        .patch(`/api/subscription/members/${staffA.id}/quota`)
        .set("Cookie", cookieStaffA)
        .send({ ai_quota_limit: 5 });

      expect(res.status).toBe(403);
    });
  });

  describe("Office Subscription Overview", () => {
    it("allows office admin to fetch their office subscription overview and member breakdown", async () => {
      const res = await request(app)
        .get("/api/subscription/overview")
        .set("Cookie", cookieAdminA);

      expect(res.status).toBe(200);
      expect(res.body.office).toBeDefined();
      expect(res.body.office.id).toBe(adminA.id);
      expect(res.body.office.plan_tier).toBe("plus");
      expect(res.body.office.ai_quota_limit).toBe(10);
      expect(res.body.office.ai_usage_count).toBe(0);
      expect(res.body.office.allocated_quota).toBe(0);
      expect(res.body.office.unallocated_quota).toBe(10);

      expect(Array.isArray(res.body.members)).toBe(true);
      const foundStaffA = res.body.members.find((m: any) => m.id === staffA.id);
      expect(foundStaffA).toBeDefined();
      expect(foundStaffA.username).toBe(staffA.username);
      expect(foundStaffA.ai_quota_limit).toBeNull();
      expect(foundStaffA.ai_usage_count).toBe(0);

      // Must not contain any members of Admin B
      const foundStaffB = res.body.members.find((m: any) => m.id === staffB.id);
      expect(foundStaffB).toBeUndefined();
    });
  });

  describe("Per-Member Quota Allocation & Strict Validation", () => {
    it("allows Admin A to set an individual quota for Staff A within available headroom", async () => {
      const res = await request(app)
        .patch(`/api/subscription/members/${staffA.id}/quota`)
        .set("Cookie", cookieAdminA)
        .send({ ai_quota_limit: 6 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.ai_quota_limit).toBe(6);
      expect(res.body.allocated_quota).toBe(6);
      expect(res.body.unallocated_quota).toBe(4);

      // Verify in overview
      const overviewRes = await request(app)
        .get("/api/subscription/overview")
        .set("Cookie", cookieAdminA);
      expect(overviewRes.status).toBe(200);
      expect(overviewRes.body.office.allocated_quota).toBe(6);
      expect(overviewRes.body.office.unallocated_quota).toBe(4);
      const member = overviewRes.body.members.find((m: any) => m.id === staffA.id);
      expect(member.ai_quota_limit).toBe(6);
    });

    it("rejects allocating more than the office total quota with 400 and clear headroom info", async () => {
      // Office limit is 10. Staff A already has 6. Setting to 15 would exceed 10.
      const res = await request(app)
        .patch(`/api/subscription/members/${staffA.id}/quota`)
        .set("Cookie", cookieAdminA)
        .send({ ai_quota_limit: 15 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("الحصة المتاحة للتخصيص المتبقية");
      expect(res.body.remainingHeadroom).toBe(10); // Since staffA's own current limit is replaced
    });

    it("rejects Admin A attempting to set quota on Admin B's staff member with 404 (no existence leak)", async () => {
      const res = await request(app)
        .patch(`/api/subscription/members/${staffB.id}/quota`)
        .set("Cookie", cookieAdminA)
        .send({ ai_quota_limit: 5 });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe("عضو المكتب غير موجود.");
    });

    it("keeps super-admin subscription fields strictly read-only and ignores them if submitted", async () => {
      const res = await request(app)
        .patch(`/api/subscription/members/${staffA.id}/quota`)
        .set("Cookie", cookieAdminA)
        .send({
          ai_quota_limit: 4,
          plan_tier: "pro", // Attempt privilege escalation
          billing_cycle: "monthly",
          subscription_end_date: "2099-01-01",
          status: "suspended",
        });

      expect(res.status).toBe(200);

      // Verify that office-level admin record remained unchanged
      const overview = await request(app)
        .get("/api/subscription/overview")
        .set("Cookie", cookieAdminA);
      expect(overview.body.office.plan_tier).toBe("plus");
      expect(overview.body.office.billing_cycle).toBe("annual");
      expect(overview.body.office.status).toBe("active");
      expect(overview.body.office.ai_quota_limit).toBe(10);
    });

    it("allows clearing individual limit back to null (shared pool)", async () => {
      const res = await request(app)
        .patch(`/api/subscription/members/${staffA.id}/quota`)
        .set("Cookie", cookieAdminA)
        .send({ ai_quota_limit: null });

      expect(res.status).toBe(200);
      expect(res.body.ai_quota_limit).toBeNull();
      expect(res.body.allocated_quota).toBe(0);
      expect(res.body.unallocated_quota).toBe(10);
    });
  });

  describe("Enforcement during AI Usage Increment", () => {
    it("blocks AI action when member reaches individual quota cap even if office has room", async () => {
      // Set Staff A individual limit to 2
      await supabaseService.updateOfficeMemberQuota(adminA.id, staffA.id, 2);
      // Ensure usage counts are reset
      await supabaseService.updateSupabaseUser(adminA.id, { ai_usage_count: 0 });
      await supabaseService.updateSupabaseUser(staffA.id, { ai_usage_count: 0 });

      // Request 1: allowed
      const res1 = await supabaseService.checkAndIncrementOfficeAiUsage(staffA.id);
      expect(res1.allowed).toBe(true);
      expect(res1.currentUsage).toBe(1);

      // Request 2: allowed
      const res2 = await supabaseService.checkAndIncrementOfficeAiUsage(staffA.id);
      expect(res2.allowed).toBe(true);
      expect(res2.currentUsage).toBe(2);

      // Request 3: blocked by individual cap
      const res3 = await supabaseService.checkAndIncrementOfficeAiUsage(staffA.id);
      expect(res3.allowed).toBe(false);
      expect(res3.error).toContain("تم استهلاك حد الذكاء الاصطناعي المخصص لك");
      expect(res3.error).toContain("(2/2 طلب)");

      // Check that office overall usage is only 2 (office still has 8 remaining)
      const adminRecord = await supabaseService.findUserByIdOrUsername(adminA.id);
      expect(adminRecord?.ai_usage_count).toBe(2);
    });

    it("blocks AI action when office-wide quota is exhausted even if member has individual room", async () => {
      // Set Staff A limit to 8
      await supabaseService.updateOfficeMemberQuota(adminA.id, staffA.id, 8);
      // Exhaust office limit (adminA quota limit is 10)
      await supabaseService.updateSupabaseUser(adminA.id, { ai_usage_count: 10 });
      await supabaseService.updateSupabaseUser(staffA.id, { ai_usage_count: 2 });

      const res = await supabaseService.checkAndIncrementOfficeAiUsage(staffA.id);
      expect(res.allowed).toBe(false);
      expect(res.error).toContain("تم استهلاك رصيد تحليلات الذكاء الاصطناعي للمكتب لهذا الشهر بالكامل");
    });
  });
});

