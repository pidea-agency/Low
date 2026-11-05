import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../app";
import { getOfficeFeatures } from "../services/supabase.service";

describe("Super Admin Subscription Plans & Features Management", () => {
  let superAdminCookie: string;
  let createdPlanId: string;
  let testAdminId: string;
  const uniqueSuffix = Date.now().toString(36);

  beforeAll(async () => {
    // Authenticate super admin
    const res = await request(app)
      .post("/api/auth/admin-login")
      .send({ username: "123456", password: "123456" });
    const c = res.headers["set-cookie"];
    superAdminCookie = Array.isArray(c) ? c.join("; ") : c;
  });

  describe("GET /api/super-admin/plans", () => {
    it("lists default subscription plans with office counts", async () => {
      const res = await request(app)
        .get("/api/super-admin/plans")
        .set("Cookie", superAdminCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.plans)).toBe(true);
      expect(res.body.plans.length).toBeGreaterThanOrEqual(3);

      const plusPlan = res.body.plans.find((p: any) => p.slug === "plus");
      expect(plusPlan).toBeDefined();
      expect(plusPlan.name).toContain("بلس");
      expect(plusPlan.ai_quota_limit).toBeGreaterThan(0);
      expect(typeof plusPlan.office_count).toBe("number");
      expect(plusPlan.features).toBeDefined();
    });

    it("rejects unauthenticated requests (401)", async () => {
      const res = await request(app).get("/api/super-admin/plans");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/super-admin/plans", () => {
    it("creates a new subscription plan with custom features", async () => {
      const newPlanSlug = `test-plan-${uniqueSuffix}`;
      const res = await request(app)
        .post("/api/super-admin/plans")
        .set("Cookie", superAdminCookie)
        .send({
          name: "باقة النخبة التجريبية",
          slug: newPlanSlug,
          ai_quota_limit: 800,
          price: "799 ر.س / شهرياً",
          features: {
            google_sheets_export: true,
            whatsapp_reminders: true,
            max_members: 50,
            custom_branding: true,
            ai_assistant: true,
            court_session_analytics: true,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe("باقة النخبة التجريبية");
      expect(res.body.slug).toBe(newPlanSlug);
      expect(res.body.ai_quota_limit).toBe(800);
      expect(res.body.features.max_members).toBe(50);
      expect(res.body.features.custom_branding).toBe(true);

      createdPlanId = res.body.id;
    });

    it("rejects creating a plan with duplicate slug (400)", async () => {
      const newPlanSlug = `test-plan-${uniqueSuffix}`;
      const res = await request(app)
        .post("/api/super-admin/plans")
        .set("Cookie", superAdminCookie)
        .send({
          name: "باقة مكررة",
          slug: newPlanSlug,
          ai_quota_limit: 300,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/مسجل مسبقاً/);
    });
  });

  describe("PATCH /api/super-admin/plans/:id", () => {
    it("updates an existing plan's name, quota and price", async () => {
      const res = await request(app)
        .patch(`/api/super-admin/plans/${createdPlanId}`)
        .set("Cookie", superAdminCookie)
        .send({
          name: "باقة النخبة المحدثة",
          ai_quota_limit: 1000,
          price: "899 ر.س / شهرياً",
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("باقة النخبة المحدثة");
      expect(res.body.ai_quota_limit).toBe(1000);
      expect(res.body.price).toBe("899 ر.س / شهرياً");
    });
  });

  describe("Office Plan Assignment & Quota Resolution", () => {
    it("creates an office assigned to the plan using plan default quota", async () => {
      const username = `law_off_${uniqueSuffix}`;
      const res = await request(app)
        .post("/api/super-admin/admins")
        .set("Cookie", superAdminCookie)
        .send({
          username,
          password: "Password123!",
          office_name: "مكتب المحامي للاختبار",
          plan_id: createdPlanId,
        });

      expect(res.status).toBe(201);
      testAdminId = res.body.id;
      expect(res.body.plan_id).toBe(createdPlanId);
      // Quota should resolve to the plan's default quota (1000)
      expect(res.body.ai_quota_limit).toBe(1000);
      expect(res.body.ai_quota_limit_override).toBeNull();

      // Verify resolver output
      const features = await getOfficeFeatures(testAdminId);
      expect(features.planId).toBe(createdPlanId);
      expect(features.planName).toBe("باقة النخبة المحدثة");
      expect(features.aiQuotaLimit).toBe(1000);
      expect(features.isOverride).toBe(false);
      expect(features.features.max_members).toBe(50);
    });

    it("overrides AI quota specifically for this office", async () => {
      const res = await request(app)
        .patch(`/api/super-admin/admins/${testAdminId}`)
        .set("Cookie", superAdminCookie)
        .send({
          ai_quota_limit_override: 1500,
        });

      expect(res.status).toBe(200);
      expect(res.body.plan_id).toBe(createdPlanId);
      expect(res.body.ai_quota_limit).toBe(1500);
      expect(res.body.ai_quota_limit_override).toBe(1500);

      // Verify resolver output
      const features = await getOfficeFeatures(testAdminId);
      expect(features.aiQuotaLimit).toBe(1500);
      expect(features.aiQuotaLimitOverride).toBe(1500);
      expect(features.isOverride).toBe(true);
    });

    it("clears AI quota override and reverts back to plan default", async () => {
      const res = await request(app)
        .patch(`/api/super-admin/admins/${testAdminId}`)
        .set("Cookie", superAdminCookie)
        .send({
          ai_quota_limit_override: null,
        });

      expect(res.status).toBe(200);
      expect(res.body.ai_quota_limit).toBe(1000);
      expect(res.body.ai_quota_limit_override).toBeNull();

      const features = await getOfficeFeatures(testAdminId);
      expect(features.aiQuotaLimit).toBe(1000);
      expect(features.isOverride).toBe(false);
    });

    it("prevents deleting a plan that is in use by an office (400)", async () => {
      const res = await request(app)
        .delete(`/api/super-admin/plans/${createdPlanId}`)
        .set("Cookie", superAdminCookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/لا يمكن حذف/);
    });

    it("allows deleting the plan after moving the office to another plan", async () => {
      // Reassign office to plus plan
      const plusPlanRes = await request(app)
        .get("/api/super-admin/plans")
        .set("Cookie", superAdminCookie);
      const plusPlan = plusPlanRes.body.plans.find((p: any) => p.slug === "plus");

      await request(app)
        .patch(`/api/super-admin/admins/${testAdminId}`)
        .set("Cookie", superAdminCookie)
        .send({
          plan_id: plusPlan.id,
        });

      // Now deleting the plan should succeed
      const delRes = await request(app)
        .delete(`/api/super-admin/plans/${createdPlanId}`)
        .set("Cookie", superAdminCookie);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
    });

    it("backward compatibility: office creation still works with old plan_tier-only path", async () => {
      const legacyUser = `legacy_${uniqueSuffix}`;
      const res = await request(app)
        .post("/api/super-admin/admins")
        .set("Cookie", superAdminCookie)
        .send({
          username: legacyUser,
          password: "Password123!",
          office_name: "مكتب النظام القديم",
          plan_tier: "pro",
        });

      expect(res.status).toBe(201);
      expect(res.body.plan_tier).toBe("pro");
      expect(res.body.plan_id).toBe("plan-pro");
      expect(res.body.ai_quota_limit).toBeGreaterThan(0);
    });
  });
});

