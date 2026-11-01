import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";
import { AccountSourceUnavailableError } from "../services/supabase.service";

describe("Session Invalidation & Current Account State Verification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects an existing session on the very next request after a user is deleted (401)", async () => {
    const username = `temp_del_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    // 1. Create a temporary staff user
    const tempUser = await supabaseService.createSupabaseUser({
      username,
      password: "ValidPass123!",
      role: "staff",
    });

    try {
      // 2. User logs in and gets a session cookie
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({
          username,
          password: "ValidPass123!",
        });

      expect(loginRes.status).toBe(200);
      const setCookie = loginRes.headers["set-cookie"];
      const cookieHeader = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;

      // Verify session works initially
      const initialRes = await request(app)
        .get("/api/auth/me")
        .set("Cookie", cookieHeader);
      expect(initialRes.status).toBe(200);

      // 3. User is deleted
      await supabaseService.deleteSupabaseUser(tempUser.id);

      // 4. On the very next request, the existing session MUST be rejected with 401
      const afterDeleteRes = await request(app)
        .get("/api/auth/me")
        .set("Cookie", cookieHeader);

      expect(afterDeleteRes.status).toBe(401);
    } finally {
      try {
        await supabaseService.deleteSupabaseUser(tempUser.id);
      } catch {}
    }
  });

  it("immediately enforces the NEW role on an existing session after role change (admin -> staff loses admin access)", async () => {
    const username = `temp_adm_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    // 1. Create a temporary admin user
    const tempAdmin = await supabaseService.createSupabaseUser({
      username,
      password: "ValidPass123!",
      role: "admin",
    });

    try {
      // 2. Log in to get admin session
      const loginRes = await request(app)
        .post("/api/auth/admin-login")
        .send({
          username,
          password: "ValidPass123!",
        });

      expect(loginRes.status).toBe(200);
      const setCookie = loginRes.headers["set-cookie"];
      const cookieHeader = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;

      // Verify admin access works initially
      const initialAdminRes = await request(app)
        .get("/api/users")
        .set("Cookie", cookieHeader);
      expect(initialAdminRes.status).toBe(200);

      // 3. Admin demotes user to staff
      await supabaseService.updateSupabaseUser(tempAdmin.id, {
        role: "staff",
      });

      // 4. Existing session MUST immediately have the NEW role (admin access is gone -> 403)
      const demotedAdminRes = await request(app)
        .get("/api/users")
        .set("Cookie", cookieHeader);

      expect(demotedAdminRes.status).toBe(403);
      expect(demotedAdminRes.body.error).toContain("صلاحيات المشرف العام");
    } finally {
      try {
        await supabaseService.deleteSupabaseUser(tempAdmin.id);
      } catch {}
    }
  });

  it("rejects all old sessions of a user after their password is changed (401)", async () => {
    const username = `temp_pwd_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    // 1. Create a temporary user
    const tempUser = await supabaseService.createSupabaseUser({
      username,
      password: "oldpassword123",
      role: "staff",
    });

    try {
      // 2. Log in and get a session cookie
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({
          username,
          password: "oldpassword123",
        });

      expect(loginRes.status).toBe(200);
      const setCookie = loginRes.headers["set-cookie"];
      const cookieHeader = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;

      // Verify session works
      const checkRes = await request(app)
        .get("/api/auth/me")
        .set("Cookie", cookieHeader);
      expect(checkRes.status).toBe(200);

      // 3. Password is changed
      await supabaseService.updateSupabaseUser(tempUser.id, {
        password: "newpassword456",
      });

      // 4. Old session MUST be rejected on the very next request
      const afterPwdChangeRes = await request(app)
        .get("/api/auth/me")
        .set("Cookie", cookieHeader);

      expect(afterPwdChangeRes.status).toBe(401);
    } finally {
      try {
        await supabaseService.deleteSupabaseUser(tempUser.id);
      } catch {}
    }
  });

  it("keeps working normally for an unchanged active user", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        username: "12345",
        password: "12345",
      });

    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers["set-cookie"];
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;

    const meRes = await request(app)
      .get("/api/auth/me")
      .set("Cookie", cookieHeader);

    expect(meRes.status).toBe(200);
    expect(meRes.body.username).toBe("12345");
  });

  it("fails with 503 and never lets the request through if the account source cannot be reached", async () => {
    // 1. Log in normally
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({
        username: "12345",
        password: "12345",
      });

    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers["set-cookie"];
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;

    // 2. Clear short-lived cache and simulate account database going down
    supabaseService.clearUserAuthCache();
    vi.spyOn(supabaseService, "findUserByIdOrUsername").mockRejectedValue(
      new AccountSourceUnavailableError("Database unreachable: connection timed out")
    );

    // 3. Request MUST fail with 503 Service Unavailable, NEVER 200 or 401
    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", cookieHeader);

    expect(res.status).toBe(503);
    expect(res.body.error).toContain("تعذر الاتصال بقاعدة البيانات");
  });
});
