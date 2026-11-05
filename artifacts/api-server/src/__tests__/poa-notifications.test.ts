import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../app";
import moment from "moment-hijri";
import * as supabaseService from "../services/supabase.service";
import * as postgresService from "../services/postgres.service";
import { runPoaExpirySweep, POA_EXPIRY_THRESHOLD_DAYS } from "../services/reminder/poa-expiry.service";
import { env } from "../config/env";
import { setGlobalRateLimitStore, MemoryRateLimitStore } from "../middlewares/rate-limiter.middleware";

describe("POA Expiry Tracking & In-App Notifications", { timeout: 35000 }, () => {
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

  let poaExpiringAssigned: any;
  let poaExpiringUnassigned: any;
  let poaFarFuture: any;
  let poaExpired: any;

  beforeAll(async () => {
    setGlobalRateLimitStore(new MemoryRateLimitStore());
    postgresService.resetInMemoryStore();

    // 1. Office A Admin
    const unameAdminA = `notif_admin_a_${Date.now()}`;
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
    const unameStaffA1 = `notif_staff_a1_${Date.now()}`;
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
    const unameStaffA2 = `notif_staff_a2_${Date.now()}`;
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
    const unameAdminB = `notif_admin_b_${Date.now()}`;
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
    const unameStaffB1 = `notif_staff_b1_${Date.now()}`;
    staffB1 = await supabaseService.createSupabaseUser({
      username: unameStaffB1,
      password: "OfficePass123!",
      role: "staff",
      status: "active",
      admin_id: adminB.id,
      display_name: "المحامي فارس",
      subscription_end_date: futureDate,
    });
    const loginStaffB1 = await request(app)
      .post("/api/auth/login")
      .send({ username: unameStaffB1, password: "OfficePass123!" });
    expect(loginStaffB1.status).toBe(200);
    const cStaffB1 = loginStaffB1.headers["set-cookie"];
    cookieStaffB1 = Array.isArray(cStaffB1) ? cStaffB1.join("; ") : cStaffB1;

    // Create POAs with different Hijri dates
    // 1. Expiring in 4 days (within 7d threshold), assigned to Staff A1
    const expiryIn4Days = moment().add(4, "days").format("iYYYY/iMM/iDD");
    poaExpiringAssigned = await postgresService.createPoa(
      {
        clientName: "شركة الفجر للتجارة",
        poaNumber: "POA-1001",
        expiryDateHijri: expiryIn4Days,
        assignedLawyerId: staffA1.id,
      },
      adminA.id,
    );

    // 2. Expiring in 2 days (within 7d threshold), unassigned
    const expiryIn2Days = moment().add(2, "days").format("iYYYY/iMM/iDD");
    poaExpiringUnassigned = await postgresService.createPoa(
      {
        clientName: "خالد المحمود",
        poaNumber: "POA-1002",
        expiryDateHijri: expiryIn2Days,
      },
      adminA.id,
    );

    // 3. Expiring in 25 days (> 7d threshold)
    const expiryIn25Days = moment().add(25, "days").format("iYYYY/iMM/iDD");
    poaFarFuture = await postgresService.createPoa(
      {
        clientName: "سعد التميمي",
        poaNumber: "POA-1003",
        expiryDateHijri: expiryIn25Days,
        assignedLawyerId: staffA2.id,
      },
      adminA.id,
    );

    // 4. Expired 3 days ago (< 0)
    const expired3DaysAgo = moment().subtract(3, "days").format("iYYYY/iMM/iDD");
    poaExpired = await postgresService.createPoa(
      {
        clientName: "مؤسسة النور",
        poaNumber: "POA-1004",
        expiryDateHijri: expired3DaysAgo,
        assignedLawyerId: staffA1.id,
      },
      adminA.id,
    );
  }, 40000);

  it("threshold constant is strictly 7 days", () => {
    expect(POA_EXPIRY_THRESHOLD_DAYS).toBe(7);
  });

  it("runs POA expiry sweep and creates notifications correctly", async () => {
    const sweepResult = await runPoaExpirySweep(adminA.id);
    expect(sweepResult.ok).toBe(true);
    // 2 POAs are expiring:
    // - POA 1: assigned to Staff A1 -> 1 notif for Staff A1 + 1 notif for Admin A = 2
    // - POA 2: unassigned -> 1 notif for Admin A = 1
    // Total notifications created = 3
    expect(sweepResult.notificationsCreated).toBe(3);
  });

  it("prevents duplicate spam within 24 hours when sweep is rerun", async () => {
    const secondSweep = await runPoaExpirySweep(adminA.id);
    expect(secondSweep.ok).toBe(true);
    expect(secondSweep.notificationsCreated).toBe(0);
    const officeStats = secondSweep.offices.find((o) => o.officeId === adminA.id);
    expect(officeStats?.skippedDuplicate).toBe(2);
  });

  it("staff only sees their own notifications, not others", async () => {
    // Staff A1 should see 1 notification
    const resA1 = await request(app)
      .get("/api/notifications")
      .set("Cookie", cookieStaffA1);
    expect(resA1.status).toBe(200);
    expect(resA1.body.notifications.length).toBe(1);
    expect(resA1.body.unreadCount).toBe(1);
    expect(resA1.body.notifications[0].relatedRecordId).toBe(String(poaExpiringAssigned.id));
    expect(resA1.body.notifications[0].title).toContain("شركة الفجر للتجارة");

    // Staff A2 has no expiring POAs -> should see 0 notifications
    const resA2 = await request(app)
      .get("/api/notifications")
      .set("Cookie", cookieStaffA2);
    expect(resA2.status).toBe(200);
    expect(resA2.body.notifications.length).toBe(0);
    expect(resA2.body.unreadCount).toBe(0);

    // Staff B1 (other office) -> 0 notifications
    const resB1 = await request(app)
      .get("/api/notifications")
      .set("Cookie", cookieStaffB1);
    expect(resB1.status).toBe(200);
    expect(resB1.body.notifications.length).toBe(0);
  });

  it("admin sees both assigned and unassigned notifications for their office", async () => {
    const resAdmin = await request(app)
      .get("/api/notifications")
      .set("Cookie", cookieAdminA);
    expect(resAdmin.status).toBe(200);
    expect(resAdmin.body.notifications.length).toBe(2);
    expect(resAdmin.body.unreadCount).toBe(2);

    const titles = resAdmin.body.notifications.map((n: any) => n.title);
    expect(titles.some((t: string) => t.includes("شركة الفجر للتجارة"))).toBe(true);
    expect(titles.some((t: string) => t.includes("خالد المحمود"))).toBe(true);
  });

  it("mark-read is strictly scoped to owner (404 otherwise)", async () => {
    // Get Staff A1's notification id
    const resA1 = await request(app)
      .get("/api/notifications")
      .set("Cookie", cookieStaffA1);
    const notifId = resA1.body.notifications[0].id;

    // Staff A2 tries to mark Staff A1's notification as read -> 404
    const forbiddenRes = await request(app)
      .post(`/api/notifications/${notifId}/read`)
      .set("Cookie", cookieStaffA2);
    expect(forbiddenRes.status).toBe(404);

    // Staff A1 marks own notification read -> 200
    const okRes = await request(app)
      .post(`/api/notifications/${notifId}/read`)
      .set("Cookie", cookieStaffA1);
    expect(okRes.status).toBe(200);
    expect(okRes.body.ok).toBe(true);

    // Check that unread count updated for Staff A1
    const resA1After = await request(app)
      .get("/api/notifications")
      .set("Cookie", cookieStaffA1);
    expect(resA1After.body.unreadCount).toBe(0);
    expect(resA1After.body.notifications[0].isRead).toBe(true);
  });

  it("mark-all-read updates all unread notifications for current user", async () => {
    // Admin A currently has 2 unread notifications
    const markAllRes = await request(app)
      .post("/api/notifications/read-all")
      .set("Cookie", cookieAdminA);
    expect(markAllRes.status).toBe(200);
    expect(markAllRes.body.ok).toBe(true);
    expect(markAllRes.body.count).toBe(2);

    // Verify unread count is now 0
    const resAdminAfter = await request(app)
      .get("/api/notifications")
      .set("Cookie", cookieAdminA);
    expect(resAdminAfter.body.unreadCount).toBe(0);
    expect(resAdminAfter.body.notifications.every((n: any) => n.isRead === true)).toBe(true);
  });

  it("cron endpoint /api/cron/poa-expiry requires CRON_SECRET", async () => {
    // Missing token -> 401
    const unauthorizedRes = await request(app).get("/api/cron/poa-expiry");
    expect(unauthorizedRes.status).toBe(401);

    // Wrong token -> 401
    const wrongRes = await request(app)
      .get("/api/cron/poa-expiry")
      .set("Authorization", "Bearer invalid-secret");
    expect(wrongRes.status).toBe(401);

    // Valid token -> 200
    const validRes = await request(app)
      .get("/api/cron/poa-expiry")
      .set("Authorization", `Bearer ${env.cronSecret}`);
    expect(validRes.status).toBe(200);
    expect(validRes.body.ok).toBe(true);
  });
});
