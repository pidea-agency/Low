import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";
import * as postgresService from "../services/postgres.service";

describe("Super Admin Extended Sections: Users, Payments, Reports & Audit", { timeout: 45000 }, () => {
  const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  let superAdminCookie: string;
  let superAdminUser: any;

  let officeAdminCookie: string;
  let officeAdminUser: any;

  let staffCookie: string;
  let staffUser: any;

  let officeA: any;
  let officeB: any;

  beforeAll(async () => {
    postgresService.resetInMemoryStore();
    supabaseService.resetInMemoryPayments();

    // 1. Create Super Admin
    const superUname = `sa_ext_${Date.now()}`;
    superAdminUser = await supabaseService.createSupabaseUser({
      username: superUname,
      password: "SuperPassword123!",
      role: "super_admin",
      status: "active",
    });

    const saLogin = await request(app)
      .post("/api/auth/admin-login")
      .send({ username: superUname, password: "SuperPassword123!" });
    superAdminCookie = saLogin.headers["set-cookie"]?.[0] || "";

    // 2. Create Office Admin A
    const officeAUname = `off_a_${Date.now()}`;
    officeA = await supabaseService.createSupabaseAdmin({
      username: officeAUname,
      password: "OfficePass123!",
      office_name: "مكتب الرياض القانوني",
      subscription_end_date: futureDate,
      plan_tier: "plus",
    });

    const offALogin = await request(app)
      .post("/api/auth/login")
      .send({ username: officeAUname, password: "OfficePass123!" });
    officeAdminCookie = offALogin.headers["set-cookie"]?.[0] || "";
    officeAdminUser = officeA;

    // 3. Create Staff under Office A
    const staffUname = `staff_a_${Date.now()}`;
    staffUser = await supabaseService.createSupabaseUser({
      username: staffUname,
      password: "StaffPass123!",
      role: "staff",
      status: "active",
      admin_id: officeA.id,
    });

    const staffLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: staffUname, password: "StaffPass123!" });
    staffCookie = staffLogin.headers["set-cookie"]?.[0] || "";

    // 4. Create Office Admin B
    const officeBUname = `off_b_${Date.now()}`;
    officeB = await supabaseService.createSupabaseAdmin({
      username: officeBUname,
      password: "OfficePass123!",
      office_name: "مكتب جدة للمحاماة",
      subscription_end_date: futureDate,
      plan_tier: "pro",
    });
  });

  describe("Access Control & Protection", () => {
    it("users list is only accessible to super_admin (rejects unauthenticated and staff/admin)", async () => {
      // Unauthenticated
      const unauthRes = await request(app).get("/api/super-admin/users");
      expect(unauthRes.status).toBe(401);

      // Staff user
      const staffRes = await request(app)
        .get("/api/super-admin/users")
        .set("Cookie", staffCookie);
      expect(staffRes.status).toBe(403);

      // Office admin user
      const adminRes = await request(app)
        .get("/api/super-admin/users")
        .set("Cookie", officeAdminCookie);
      expect(adminRes.status).toBe(403);

      // Super Admin
      const saRes = await request(app)
        .get("/api/super-admin/users")
        .set("Cookie", superAdminCookie);
      expect(saRes.status).toBe(200);
      expect(Array.isArray(saRes.body)).toBe(true);
      expect(saRes.body.length).toBeGreaterThan(0);

      // Check user fields and office mapping
      const staffInList = saRes.body.find((u: any) => u.id === staffUser.id);
      expect(staffInList).toBeDefined();
      expect(staffInList.office_name).toBe("مكتب الرياض القانوني");
      expect(staffInList.role).toBe("staff");
    });

    it("payments endpoint is only accessible to super_admin", async () => {
      const staffRes = await request(app)
        .get("/api/super-admin/payments")
        .set("Cookie", staffCookie);
      expect(staffRes.status).toBe(403);

      const saRes = await request(app)
        .get("/api/super-admin/payments")
        .set("Cookie", superAdminCookie);
      expect(saRes.status).toBe(200);
    });
  });

  describe("Payments Management & Scoping", () => {
    let paymentA1: any;
    let paymentA2: any;
    let paymentB1: any;

    it("records payments manually with audit log", async () => {
      // Payment 1 for Office A (Paid 1500 SAR)
      const res1 = await request(app)
        .post("/api/super-admin/payments")
        .set("Cookie", superAdminCookie)
        .send({
          office_id: officeA.id,
          amount: 1500,
          currency: "SAR",
          method: "bank_transfer",
          status: "paid",
          notes: "اشتراك باقة بلس سنوي",
        });

      expect(res1.status).toBe(201);
      expect(res1.body.office_id).toBe(officeA.id);
      expect(res1.body.amount).toBe(1500);
      expect(res1.body.status).toBe("paid");
      paymentA1 = res1.body;

      // Payment 2 for Office A (Pending 500 SAR)
      const res2 = await request(app)
        .post("/api/super-admin/payments")
        .set("Cookie", superAdminCookie)
        .send({
          office_id: officeA.id,
          amount: 500,
          currency: "SAR",
          method: "cash",
          status: "pending",
          notes: "دفعة متبقية قيد التحصيل",
        });
      expect(res2.status).toBe(201);
      paymentA2 = res2.body;

      // Payment 3 for Office B (Paid 3000 SAR)
      const res3 = await request(app)
        .post("/api/super-admin/payments")
        .set("Cookie", superAdminCookie)
        .send({
          office_id: officeB.id,
          amount: 3000,
          currency: "SAR",
          method: "bank_transfer",
          status: "paid",
          notes: "اشتراك باقة برو",
        });
      expect(res3.status).toBe(201);
      paymentB1 = res3.body;
    });

    it("payments are office-scoped correctly when filtered by office_id", async () => {
      // Filter by Office A
      const resA = await request(app)
        .get(`/api/super-admin/payments?office_id=${officeA.id}`)
        .set("Cookie", superAdminCookie);

      expect(resA.status).toBe(200);
      expect(resA.body.length).toBe(2);
      expect(resA.body.every((p: any) => p.office_id === officeA.id)).toBe(true);

      // Filter by Office B
      const resB = await request(app)
        .get(`/api/super-admin/payments?office_id=${officeB.id}`)
        .set("Cookie", superAdminCookie);

      expect(resB.status).toBe(200);
      expect(resB.body.length).toBe(1);
      expect(resB.body[0].office_id).toBe(officeB.id);
      expect(resB.body[0].amount).toBe(3000);
    });

    it("payment status update is logged to audit_log", async () => {
      // Update paymentA2 from pending to paid
      const updateRes = await request(app)
        .patch(`/api/super-admin/payments/${paymentA2.id}`)
        .set("Cookie", superAdminCookie)
        .send({
          status: "paid",
          notes: "تم استلام الدفعة النقدية وإيداعها",
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.status).toBe("paid");

      // Verify audit log has recorded the action
      const auditRes = await request(app)
        .get(`/api/super-admin/audit-log?office_id=${officeA.id}`)
        .set("Cookie", superAdminCookie);

      expect(auditRes.status).toBe(200);
      const updateLog = auditRes.body.logs.find(
        (l: any) => l.action === "update_payment" && l.details?.payment_id === paymentA2.id
      );
      expect(updateLog).toBeDefined();
      expect(updateLog.target_office_id).toBe(officeA.id);
      expect(updateLog.details.new_status).toBe("paid");
    });
  });

  describe("Reports & Revenue Calculations", () => {
    it("revenue calculations only count 'paid' status and return 6-month trend and plan distribution", async () => {
      // Add an overdue payment that must NOT be counted in revenue
      await request(app)
        .post("/api/super-admin/payments")
        .set("Cookie", superAdminCookie)
        .send({
          office_id: officeB.id,
          amount: 9999,
          status: "overdue",
          notes: "فاتورة متأخرة لا يجب أن تدخل في الإيراد المحصل",
        });

      // Add a pending payment that must NOT be counted in revenue
      await request(app)
        .post("/api/super-admin/payments")
        .set("Cookie", superAdminCookie)
        .send({
          office_id: officeA.id,
          amount: 8888,
          status: "pending",
          notes: "فاتورة معلقة لا يجب أن تدخل في الإيراد المحصل",
        });

      const res = await request(app)
        .get("/api/super-admin/reports/overview")
        .set("Cookie", superAdminCookie);

      expect(res.status).toBe(200);
      const data = res.body;

      // Paid payments so far: 1500 (A1) + 500 (A2 updated to paid) + 3000 (B1) = 5000
      expect(data.totalRevenue).toBe(5000);

      // Verify trend structure
      expect(Array.isArray(data.monthlyRevenueTrend)).toBe(true);
      expect(data.monthlyRevenueTrend.length).toBe(6);

      // Verify distribution structure
      expect(Array.isArray(data.subscriptionDistribution)).toBe(true);
      expect(data.subscriptionDistribution.length).toBeGreaterThan(0);

      // Verify total users and offices counts
      expect(data.totalUsers).toBeGreaterThanOrEqual(4); // SA + OfficeA + OfficeB + Staff
      expect(data.totalOffices).toBeGreaterThanOrEqual(2);
      expect(data.activeSubscriptions).toBeGreaterThanOrEqual(2);
    });
  });
});
