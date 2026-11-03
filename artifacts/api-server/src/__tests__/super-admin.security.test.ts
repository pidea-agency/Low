import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../app";
import { encryptSecret, decryptSecret, isEncrypted } from "../lib/encryption";

describe("Three-Tier Role Security & Super Admin Isolation Enforcement", () => {
  let superAdminCookie: string;
  let officeAdminCookie: string;
  let lawyerStaffCookie: string;

  beforeAll(async () => {
    // 1. Authenticate super admin
    const res = await request(app)
      .post("/api/auth/admin-login")
      .send({ username: "123456", password: "123456" });
    const c = res.headers["set-cookie"];
    superAdminCookie = Array.isArray(c) ? c.join("; ") : c;

    // 2. Authenticate office admin
    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin1", password: "admin123" });
    const cAdmin = adminLogin.headers["set-cookie"];
    officeAdminCookie = Array.isArray(cAdmin) ? cAdmin.join("; ") : cAdmin;

    // 3. Authenticate lawyer (staff)
    const staffLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: "12345", password: "12345" });
    const cStaff = staffLogin.headers["set-cookie"];
    lawyerStaffCookie = Array.isArray(cStaff) ? cStaff.join("; ") : cStaff;
  });

  describe("Super Admin office data isolation (blocked from viewing/mutating office legal data)", () => {
    it("Super Admin is blocked from GET /api/sessions (403)", async () => {
      const res = await request(app)
        .get("/api/sessions")
        .set("Cookie", superAdminCookie);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/مشرف المنصة|المشرف/);
    });

    it("Super Admin is blocked from GET /api/tasks (403)", async () => {
      const res = await request(app)
        .get("/api/tasks")
        .set("Cookie", superAdminCookie);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/مشرف المنصة|المشرف/);
    });

    it("Super Admin is blocked from GET /api/poa (403)", async () => {
      const res = await request(app)
        .get("/api/poa")
        .set("Cookie", superAdminCookie);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/مشرف المنصة|المشرف/);
    });

    it("Super Admin is blocked from GET /api/judgments (403)", async () => {
      const res = await request(app)
        .get("/api/judgments")
        .set("Cookie", superAdminCookie);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/مشرف المنصة|المشرف/);
    });

    it("Super Admin is blocked from GET /api/sessions/1/report (403)", async () => {
      const res = await request(app)
        .get("/api/sessions/1/report")
        .set("Cookie", superAdminCookie);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/مشرف المنصة|المشرف/);
    });

    it("Super Admin is blocked from POST /api/ai/analyze (403)", async () => {
      const res = await request(app)
        .post("/api/ai/analyze")
        .set("Cookie", superAdminCookie)
        .send({ text: "رسالة قضائية" });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/مشرف المنصة|المشرف/);
    });

    it("Super Admin is blocked from GET /api/dashboard/stats (403)", async () => {
      const res = await request(app)
        .get("/api/dashboard/stats")
        .set("Cookie", superAdminCookie);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/مشرف المنصة|المشرف/);
    });
  });

  describe("Super Admin portal protection", () => {
    it("Super Admin CAN access /api/super-admin/admins (200)", async () => {
      const res = await request(app)
        .get("/api/super-admin/admins")
        .set("Cookie", superAdminCookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.admins)).toBe(true);
    });

    it("Office Admin CANNOT access /api/super-admin/admins (403)", async () => {
      const res = await request(app)
        .get("/api/super-admin/admins")
        .set("Cookie", officeAdminCookie);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Super Admin|مدير النظام/);
    });

    it("Lawyer Staff CANNOT access /api/super-admin/admins (403)", async () => {
      const res = await request(app)
        .get("/api/super-admin/admins")
        .set("Cookie", lawyerStaffCookie);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Super Admin|مدير النظام/);
    });
  });

  describe("Office Admin users & settings boundaries", () => {
    it("Office Admin CAN access /api/users to manage office staff (200)", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Cookie", officeAdminCookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.users)).toBe(true);
    });

    it("Lawyer Staff CANNOT access /api/users (403)", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Cookie", lawyerStaffCookie);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/صلاحيات مدير المكتب|المشرف/);
    });

    it("Lawyer Staff CANNOT access /api/settings/google-binding (403)", async () => {
      const res = await request(app)
        .get("/api/settings/google-binding")
        .set("Cookie", lawyerStaffCookie);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/صلاحيات مدير المكتب|المشرف/);
    });

    it("Office Admin CAN access /api/settings/google-binding (200)", async () => {
      const res = await request(app)
        .get("/api/settings/google-binding")
        .set("Cookie", officeAdminCookie);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("is_connected");
    });
  });

  describe("Encryption & Security of Service Account Credentials", () => {
    it("encrypts and decrypts sensitive JSON correctly via AES-256-GCM", () => {
      const samplePayload = JSON.stringify({
        client_email: "secret@serviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----",
      });

      const encrypted = encryptSecret(samplePayload);
      expect(isEncrypted(encrypted)).toBe(true);
      expect(encrypted).not.toContain("secret@serviceaccount.com");

      const decrypted = decryptSecret(encrypted);
      expect(decrypted).toBe(samplePayload);
      const parsed = JSON.parse(decrypted);
      expect(parsed.client_email).toBe("secret@serviceaccount.com");
    });
  });
});
