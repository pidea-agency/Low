import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import app from "../app";

describe("Server Settings API Authorization Enforcement", () => {
  let lawyerCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    // 1. Authenticate lawyer
    const lawyerLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: "12345", password: "ValidPass123!" })
      .catch(() => null);

    if (lawyerLogin && lawyerLogin.status === 200) {
      const setCookie = lawyerLogin.headers["set-cookie"];
      lawyerCookie = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;
    } else {
      // Fallback default lawyer
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "12345", password: "12345" });
      const setCookie = res.headers["set-cookie"];
      lawyerCookie = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;
    }

    // 2. Authenticate office admin
    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ username: "admin1", password: "admin123" });
    const setAdminCookie = adminLogin.headers["set-cookie"];
    adminCookie = Array.isArray(setAdminCookie) ? setAdminCookie.join("; ") : setAdminCookie;
  });

  describe("Unauthenticated requests", () => {
    it("GET /api/settings returns 401", async () => {
      const res = await request(app).get("/api/settings");
      expect(res.status).toBe(401);
    });

    it("PUT /api/settings returns 401", async () => {
      const res = await request(app)
        .put("/api/settings")
        .send({ aiModel: "new-model" });
      expect(res.status).toBe(401);
    });

    it("POST /api/settings/test-whatsapp returns 401", async () => {
      const res = await request(app).post("/api/settings/test-whatsapp");
      expect(res.status).toBe(401);
    });

    it("POST /api/settings/test-whatsapp-connection returns 401", async () => {
      const res = await request(app).post("/api/settings/test-whatsapp-connection");
      expect(res.status).toBe(401);
    });
  });

  describe("Lawyer requests (Forbidden)", () => {
    it("GET /api/settings returns 403 for lawyer", async () => {
      const res = await request(app)
        .get("/api/settings")
        .set("Cookie", lawyerCookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/صلاحيات مدير المكتب|المشرف/);
    });

    it("PUT /api/settings returns 403 for lawyer", async () => {
      const res = await request(app)
        .put("/api/settings")
        .set("Cookie", lawyerCookie)
        .send({ aiModel: "unauthorized-change" });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/صلاحيات مدير المكتب|المشرف/);
    });

    it("POST /api/settings/test-whatsapp returns 403 for lawyer", async () => {
      const res = await request(app)
        .post("/api/settings/test-whatsapp")
        .set("Cookie", lawyerCookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/صلاحيات مدير المكتب|المشرف/);
    });

    it("POST /api/settings/test-whatsapp-connection returns 403 for lawyer", async () => {
      const res = await request(app)
        .post("/api/settings/test-whatsapp-connection")
        .set("Cookie", lawyerCookie)
        .send({ instanceId: "123", token: "tok" });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/صلاحيات مدير المكتب|المشرف/);
    });
  });

  describe("Admin requests (Authorized)", () => {
    it("GET /api/settings returns 200 for admin", async () => {
      const res = await request(app)
        .get("/api/settings")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("aiModel");
      expect(res.body).toHaveProperty("googleSheetName");
    });

    it("PUT /api/settings succeeds (200) for admin", async () => {
      const res = await request(app)
        .put("/api/settings")
        .set("Cookie", adminCookie)
        .send({ googleSheetName: "Sessions" });

      expect(res.status).toBe(200);
      expect(res.body.googleSheetName).toBe("Sessions");
    });

    it("POST /api/settings/test-whatsapp-connection returns 400 when instanceId or token is missing", async () => {
      const res = await request(app)
        .post("/api/settings/test-whatsapp-connection")
        .set("Cookie", adminCookie)
        .send({ instanceId: "", token: "" });

      expect(res.status).toBe(400);
      expect(res.body.connected).toBe(false);
      expect(res.body.error).toContain("معرف النسخة");
    });

    it("POST /api/settings/test-whatsapp-connection returns connected: true when Green API returns authorized", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ stateInstance: "authorized" }),
      } as any);

      try {
        const res = await request(app)
          .post("/api/settings/test-whatsapp-connection")
          .set("Cookie", adminCookie)
          .send({
            instanceId: "7103123456",
            token: "valid-secret-token",
            apiUrl: "https://api.green-api.com",
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.connected).toBe(true);
        expect(res.body.stateInstance).toBe("authorized");
        expect(res.body.message).toContain("متصل بحساب الواتساب");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("POST /api/settings/test-whatsapp-connection returns connected: false when Green API returns notAuthorized", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ stateInstance: "notAuthorized" }),
      } as any);

      try {
        const res = await request(app)
          .post("/api/settings/test-whatsapp-connection")
          .set("Cookie", adminCookie)
          .send({
            instanceId: "7103123456",
            token: "valid-secret-token",
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.connected).toBe(false);
        expect(res.body.stateInstance).toBe("notAuthorized");
        expect(res.body.message).toContain("QR Code");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("POST /api/settings/test-whatsapp-connection handles Green API 401 error gracefully", async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "Invalid token" }),
      } as any);

      try {
        const res = await request(app)
          .post("/api/settings/test-whatsapp-connection")
          .set("Cookie", adminCookie)
          .send({
            instanceId: "7103123456",
            token: "invalid-token",
          });

        expect(res.status).toBe(400);
        expect(res.body.connected).toBe(false);
        expect(res.body.error).toBe("Invalid token");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
