import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";

describe("Auth Backdoor Removal & Single Source of Truth", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects login with a fallback username/password that has no real account (401)", async () => {
    // Attempt lawyer login with static fallback credentials that have no account in DB
    const lawyerRes = await request(app)
      .post("/api/auth/login")
      .send({
        username: "5128",
        password: "5128",
      });

    expect(lawyerRes.status).toBe(401);
    expect(lawyerRes.body.error).toBe("اسم المستخدم أو كلمة المرور غير صحيحة.");

    // Attempt admin login with static fallback credentials that have no account in DB
    const adminRes = await request(app)
      .post("/api/auth/admin-login")
      .send({
        username: "407171248",
        password: "407171248",
      });

    expect(adminRes.status).toBe(401);
    expect(adminRes.body.error).toBe("اسم المستخدم أو كلمة المرور غير صحيحة.");
  });

  it("allows login with a real account and correct password", async () => {
    // Valid lawyer account
    const lawyerRes = await request(app)
      .post("/api/auth/login")
      .send({
        username: "12345",
        password: "12345",
      });

    expect(lawyerRes.status).toBe(200);
    expect(lawyerRes.body.username).toBe("12345");
    expect(lawyerRes.body.role).toBe("staff");

    // Valid admin account
    const adminRes = await request(app)
      .post("/api/auth/admin-login")
      .send({
        username: "123456",
        password: "123456",
      });

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.username).toBe("123456");
    expect(adminRes.body.role).toBe("admin");
  });

  it("rejects a real account with a wrong password, even if password is in the old fallback list", async () => {
    // Real username "12345", but wrong password "5128" from old fallback list
    const lawyerRes = await request(app)
      .post("/api/auth/login")
      .send({
        username: "12345",
        password: "5128",
      });

    expect(lawyerRes.status).toBe(401);
    expect(lawyerRes.body.error).toBe("اسم المستخدم أو كلمة المرور غير صحيحة.");

    // Real admin username "123456", but wrong password "407171248" from old fallback list
    const adminRes = await request(app)
      .post("/api/auth/admin-login")
      .send({
        username: "123456",
        password: "407171248",
      });

    expect(adminRes.status).toBe(401);
    expect(adminRes.body.error).toBe("اسم المستخدم أو كلمة المرور غير صحيحة.");
  });

  it("returns a service error (503) and never falls back when the account source is down", async () => {
    // Simulate Supabase/account store failure
    vi.spyOn(supabaseService, "verifySupabaseUser").mockRejectedValue(
      new Error("Database connection timeout: Supabase is unreachable")
    );

    // Attempt login with credentials during database outage
    const lawyerRes = await request(app)
      .post("/api/auth/login")
      .send({
        username: "12345",
        password: "12345",
      });

    expect(lawyerRes.status).toBe(503);
    expect(lawyerRes.body.error).toContain("تعذر الاتصال بقاعدة البيانات");

    const adminRes = await request(app)
      .post("/api/auth/admin-login")
      .send({
        username: "123456",
        password: "123456",
      });

    expect(adminRes.status).toBe(503);
    expect(adminRes.body.error).toContain("تعذر الاتصال بقاعدة البيانات");
  });
});

