import { describe, it, expect } from "vitest";
import request from "supertest";
import cookieSignature from "cookie-signature";
import app from "../app";
import { env, MissingEnvVarError } from "../config/env";

describe("Auth Security & Session Cookie Protection", () => {
  it("rejects a request with a hand-made cookie claiming role=admin (401 or 403)", async () => {
    // Attacker crafts an unsigned JSON cookie claiming to be admin
    const forgedPayload = JSON.stringify({
      username: "attacker",
      userId: "attacker-id",
      role: "admin",
      displayName: "Attacker Admin",
      issuedAt: Date.now(),
    });

    const forgedCookie = `court_session_auth=${encodeURIComponent(forgedPayload)}`;

    const res = await request(app)
      .get("/api/users")
      .set("Cookie", forgedCookie);

    // Must be rejected with 401 or 403, NOT allowed through with 200
    expect([401, 403]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });

  it("rejects a tampered cookie", async () => {
    // Simulate a signed cookie where the signature is invalid/tampered
    const validData = JSON.stringify({
      username: "12345",
      userId: "local-lawyer-default",
      issuedAt: Date.now(),
    });
    // Attacker tampers with the value or creates an invalid signature
    const fakeSignature = "invalid_hmac_signature_value_12345";
    const tamperedCookie = `court_session_auth=s%3A${encodeURIComponent(validData)}.${fakeSignature}`;

    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", tamperedCookie);

    // Must be rejected with 401 Unauthorized
    expect(res.status).toBe(401);
  });

  it("creates a session on valid login and allows the user to access their own routes", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        username: "12345",
        password: "12345",
      });

    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers["set-cookie"];
    expect(setCookie).toBeDefined();

    const cookieHeader = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;
    expect(cookieHeader).toContain("court_session_auth");
    // Verify security flags on the cookie
    expect(cookieHeader).toContain("HttpOnly");
    expect(cookieHeader).toMatch(/SameSite=(Lax|Strict)/i);

    // Access /api/auth/me with the valid session cookie
    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Cookie", cookieHeader);

    expect(meRes.status).toBe(200);
    expect(meRes.body.username).toBe("12345");
    expect(meRes.body.role).toBe("staff");
  });

  it("prevents a non-admin user from accessing admin routes (403)", async () => {
    // Login as normal staff user
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        username: "12345",
        password: "12345",
      });

    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers["set-cookie"];
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;

    // Attempt to access admin-only /api/users
    const adminRes = await request(app)
      .get("/api/users")
      .set("Cookie", cookieHeader);

    expect(adminRes.status).toBe(403);
    expect(adminRes.body.error).toMatch(/صلاحيات مدير المكتب|المشرف/);
  });

  it("never trusts role from cookie: even if signed token claims role=admin, server looks up real role from DB", async () => {
    // Suppose an attacker manages to get a signed token for staff user "local-lawyer-default",
    // or crafts a token with role=admin embedded in the payload
    const deceptivePayload = JSON.stringify({
      userId: "local-lawyer-default",
      username: "12345",
      role: "admin", // Deceptive role
      issuedAt: Date.now(),
    });

    const signedToken = "s:" + cookieSignature.sign(deceptivePayload, env.sessionSecret);
    const cookieHeader = `court_session_auth=${encodeURIComponent(signedToken)}`;

    // Try accessing admin-only route /api/users
    const adminRes = await request(app)
      .get("/api/users")
      .set("Cookie", cookieHeader);

    // The server MUST look up the user in the database, discover they are 'staff', and return 403
    expect(adminRes.status).toBe(403);
  });

  it("fails startup in production if SESSION_SECRET is missing or default fallback", () => {
    const origEnv = process.env.NODE_ENV;
    const origSecret = process.env.SESSION_SECRET;

    try {
      process.env.NODE_ENV = "production";
      process.env.SESSION_SECRET = "court_session_secret_fallback_key";

      expect(() => {
        void env.sessionSecret;
      }).toThrow(MissingEnvVarError);
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origSecret !== undefined) {
        process.env.SESSION_SECRET = origSecret;
      } else {
        delete process.env.SESSION_SECRET;
      }
    }
  });

  describe("Role-Separated Login Portals", () => {
    it("POST /api/auth/login allows office admin (admin1)", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "admin1", password: "admin123" });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe("admin");
    });

    it("POST /api/auth/login allows staff (12345)", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "12345", password: "12345" });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe("staff");
    });

    it("POST /api/auth/login rejects super_admin (123456) with 403 and directs to /admin/login", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "123456", password: "123456" });
      expect(res.status).toBe(403);
      expect(res.body.error).toContain("/admin/login");
    });

    it("POST /api/auth/admin-login allows super_admin (123456)", async () => {
      const res = await request(app)
        .post("/api/auth/admin-login")
        .send({ username: "123456", password: "123456" });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe("super_admin");
    });

    it("POST /api/auth/admin-login rejects office admin (admin1) with 403", async () => {
      const res = await request(app)
        .post("/api/auth/admin-login")
        .send({ username: "admin1", password: "admin123" });
      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Super Admin");
    });

    it("POST /api/auth/admin-login rejects staff (12345) with 403", async () => {
      const res = await request(app)
        .post("/api/auth/admin-login")
        .send({ username: "12345", password: "12345" });
      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Super Admin");
    });
  });
});
