import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";
import * as postgresService from "../services/postgres.service";

describe("POA Save Path & Client Link Enforcement (/api/poa)", { timeout: 45000 }, () => {
  let adminUser: any;
  let authCookie: string;
  let staffUser: any;
  let staffCookie: string;
  let officeId: string;
  let client1: any;
  let client2: any;

  beforeAll(async () => {
    postgresService.resetInMemoryStore();

    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const uname = `poa_admin_${Date.now()}`;
    adminUser = await supabaseService.createSupabaseUser({
      username: uname,
      password: "OfficePass123!",
      role: "admin",
      status: "active",
      plan_tier: "plus",
      subscription_end_date: futureDate,
    });

    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: uname, password: "OfficePass123!" });

    authCookie = loginRes.headers["set-cookie"]?.[0] || "";
    officeId = adminUser.officeId || adminUser.id;

    // Create staff user in same office
    const staffUname = `poa_staff_${Date.now()}`;
    staffUser = await supabaseService.createSupabaseUser({
      username: staffUname,
      password: "StaffPass123!",
      role: "staff",
      status: "active",
      admin_id: adminUser.id,
    });

    const staffLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: staffUname, password: "StaffPass123!" });

    staffCookie = staffLoginRes.headers["set-cookie"]?.[0] || "";

    // Create 2 clients for this office
    client1 = await postgresService.createClient({ name: "شركة الأفق للاستثمار", phone: "0501112233" }, officeId);
    client2 = await postgresService.createClient({ name: "مؤسسة النور للتجارة", phone: "0504445566" }, officeId);
  }, 30000);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Validation & Required Fields", () => {
    it("rejects POA creation with missing poaNumber with 400", async () => {
      const res = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send({
          clientId: client1.id,
          poaNumber: "",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("رقم الوكالة مطلوب.");
    });

    it("rejects POA creation with missing clientId with 400", async () => {
      const res = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send({
          poaNumber: "1446/POA/NOCLIENT",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("يجب تحديد العميل المرتبط بالوكالة.");
    });

    it("rejects POA creation with non-existent clientId with 400", async () => {
      const res = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send({
          clientId: "non-existent-client-id",
          poaNumber: "1446/POA/INVALID",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("العميل المحدد غير موجود في هذا المكتب.");
    });
  });

  describe("Happy Path Save & Client Name Derivation", () => {
    it("creates POA with valid clientId and derives clientName from linked client record without sending clientName", async () => {
      const payload = {
        clientId: client1.id,
        poaNumber: "1446/POA/9981",
        issueDateHijri: "1446/01/10",
        expiryDateHijri: "1447/01/10",
        notes: "وكالة خاصة بالمرافعة",
      };

      const res = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.clientName).toBe(client1.name);
      expect(res.body.clientId).toBe(client1.id);
      expect(res.body.poaNumber).toBe(payload.poaNumber);
      expect(res.body.officeId).toBe(officeId);

      // Verify list contains the created POA with derived client name
      const listRes = await request(app)
        .get("/api/poa")
        .set("Cookie", authCookie);

      expect(listRes.status).toBe(200);
      expect(Array.isArray(listRes.body)).toBe(true);
      const found = listRes.body.find((p: any) => p.poaNumber === payload.poaNumber);
      expect(found).toBeDefined();
      expect(found.clientName).toBe(client1.name);
      expect(found.clientId).toBe(client1.id);
    });

    it("updates existing POA, allows changing linked client and updates derived clientName", async () => {
      const createRes = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send({
          clientId: client1.id,
          poaNumber: "1446/POA/UPDATE",
        });

      const rowId = createRes.body.sheetRowId || createRes.body.id;

      const updateRes = await request(app)
        .put(`/api/poa/${rowId}`)
        .set("Cookie", authCookie)
        .send({
          clientId: client2.id,
          notes: "تم تغيير العميل المرتبط وتحديث الوكالة",
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.clientId).toBe(client2.id);
      expect(updateRes.body.clientName).toBe(client2.name);
      expect(updateRes.body.notes).toBe("تم تغيير العميل المرتبط وتحديث الوكالة");
    });

    it("deletes existing POA with 204", async () => {
      const createRes = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send({
          clientId: client1.id,
          poaNumber: "1446/POA/DELETE",
        });

      const rowId = createRes.body.sheetRowId || createRes.body.id;

      const deleteRes = await request(app)
        .delete(`/api/poa/${rowId}`)
        .set("Cookie", authCookie);

      expect(deleteRes.status).toBe(204);
    });

    it("forbids staff lawyer from editing a POA with 403", async () => {
      const createRes = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send({
          clientId: client1.id,
          poaNumber: "1446/POA/STAFF_EDIT_DENIED",
        });

      const rowId = createRes.body.sheetRowId || createRes.body.id;

      const updateRes = await request(app)
        .put(`/api/poa/${rowId}`)
        .set("Cookie", staffCookie)
        .send({
          clientId: client2.id,
          notes: "محاولة تعديل من قبل الموظف",
        });

      expect(updateRes.status).toBe(403);
      expect(updateRes.body.error).toBe("تعديل بيانات الوكالة مقتصر على مدير المكتب فقط.");
    });

    it("forbids staff lawyer from deleting a POA with 403", async () => {
      const createRes = await request(app)
        .post("/api/poa")
        .set("Cookie", authCookie)
        .send({
          clientId: client1.id,
          poaNumber: "1446/POA/STAFF_DELETE_DENIED",
        });

      const rowId = createRes.body.sheetRowId || createRes.body.id;

      const deleteRes = await request(app)
        .delete(`/api/poa/${rowId}`)
        .set("Cookie", staffCookie);

      expect(deleteRes.status).toBe(403);
      expect(deleteRes.body.error).toBe("حذف الوكالة مقتصر على مدير المكتب فقط.");
    });
  });
});
