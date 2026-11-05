import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../app";
import { clearRateLimits } from "../middlewares/rate-limiter.middleware";

describe("Super Admin Overview, Audit Log & Settings", () => {
  let superAdminCookie: string;
  let createdOfficeId: string;

  beforeAll(async () => {
    clearRateLimits();
    // Login as default super_admin
    const loginRes = await request(app)
      .post("/api/auth/admin-login")
      .send({ username: "123456", password: "123456" });

    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers["set-cookie"];
    superAdminCookie = Array.isArray(cookies) ? cookies.join("; ") : cookies;
  });

  describe("GET /api/super-admin/overview", () => {
    it("rejects unauthenticated requests", async () => {
      const res = await request(app).get("/api/super-admin/overview");
      expect(res.status).toBe(401);
    });

    it("returns overview aggregate stats and expiring soonest offices", async () => {
      const res = await request(app)
        .get("/api/super-admin/overview")
        .set("Cookie", superAdminCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalOffices");
      expect(typeof res.body.totalOffices).toBe("number");
      expect(res.body).toHaveProperty("activeSubscriptions");
      expect(typeof res.body.activeSubscriptions).toBe("number");
      expect(res.body).toHaveProperty("expiringIn7Days");
      expect(typeof res.body.expiringIn7Days).toBe("number");
      expect(res.body).toHaveProperty("totalAiUsage");
      expect(typeof res.body.totalAiUsage).toBe("number");
      expect(res.body).toHaveProperty("expiringSoonest");
      expect(Array.isArray(res.body.expiringSoonest)).toBe(true);
    });
  });

  describe("Platform Settings: GET & PATCH /api/super-admin/settings", () => {
    it("rejects unauthenticated requests", async () => {
      const res = await request(app).get("/api/super-admin/settings");
      expect(res.status).toBe(401);
    });

    it("returns current platform settings with defaults", async () => {
      const res = await request(app)
        .get("/api/super-admin/settings")
        .set("Cookie", superAdminCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("activation_link_expiry_hours");
      expect(typeof res.body.activation_link_expiry_hours).toBe("number");
      expect(res.body).toHaveProperty("new_office_registration_enabled");
      expect(typeof res.body.new_office_registration_enabled).toBe("boolean");
      expect(res.body).toHaveProperty("support_contact_email");
      expect(res.body).toHaveProperty("support_contact_phone");
    });

    it("updates platform settings and records audit log", async () => {
      const updatePayload = {
        activation_link_expiry_hours: 72,
        new_office_registration_enabled: true,
        support_contact_email: "support@antigravity-legal.test",
        support_contact_phone: "+966500000000",
      };

      const res = await request(app)
        .patch("/api/super-admin/settings")
        .set("Cookie", superAdminCookie)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.activation_link_expiry_hours).toBe(72);
      expect(res.body.new_office_registration_enabled).toBe(true);
      expect(res.body.support_contact_email).toBe("support@antigravity-legal.test");
      expect(res.body.support_contact_phone).toBe("+966500000000");

      // Verify audit log has the event
      const logRes = await request(app)
        .get("/api/super-admin/audit-log")
        .set("Cookie", superAdminCookie);

      expect(logRes.status).toBe(200);
      expect(Array.isArray(logRes.body.logs)).toBe(true);
      const settingsLog = logRes.body.logs.find(
        (l: any) => l.action === "updated_platform_settings",
      );
      expect(settingsLog).toBeDefined();
    });
  });

  describe("Audit Log & Office Mutations Tracking", () => {
    it("records created_office and updated_office in audit log", async () => {
      const testUsername = `audit_office_${Date.now().toString(36)}`;
      const createRes = await request(app)
        .post("/api/super-admin/admins")
        .set("Cookie", superAdminCookie)
        .send({
          username: testUsername,
          password: "Password123!",
          office_name: "مكتب التدقيق للتجربة",
          email: `${testUsername}@example.com`,
          plan_tier: "plus",
        });

      expect(createRes.status).toBe(201);
      createdOfficeId = createRes.body.id;

      // Update office
      const patchRes = await request(app)
        .patch(`/api/super-admin/admins/${createdOfficeId}`)
        .set("Cookie", superAdminCookie)
        .send({
          office_name: "مكتب التدقيق للتجربة - معدل",
          ai_quota_limit: 250,
        });

      expect(patchRes.status).toBe(200);

      // Extend subscription
      const extendRes = await request(app)
        .post(`/api/super-admin/admins/${createdOfficeId}/extend`)
        .set("Cookie", superAdminCookie)
        .send({ period: "1m" });

      expect(extendRes.status).toBe(200);

      // Fetch audit log filtered by this office
      const auditRes = await request(app)
        .get(`/api/super-admin/audit-log?office_id=${createdOfficeId}`)
        .set("Cookie", superAdminCookie);

      expect(auditRes.status).toBe(200);
      expect(auditRes.body.logs.length).toBeGreaterThanOrEqual(3);

      const actions = auditRes.body.logs.map((l: any) => l.action);
      expect(actions).toContain("created_office");
      expect(actions).toContain("updated_office");
      expect(actions).toContain("extended_subscription");
    });

    it("records delete_office when office is deleted", async () => {
      const deleteRes = await request(app)
        .delete(`/api/super-admin/admins/${createdOfficeId}`)
        .set("Cookie", superAdminCookie);

      expect(deleteRes.status).toBe(204);

      // Verify audit log has deleted_office
      const auditRes = await request(app)
        .get(`/api/super-admin/audit-log?office_id=${createdOfficeId}`)
        .set("Cookie", superAdminCookie);

      expect(auditRes.status).toBe(200);
      const deleteLog = auditRes.body.logs.find((l: any) => l.action === "deleted_office");
      expect(deleteLog).toBeDefined();
    });
  });
});
