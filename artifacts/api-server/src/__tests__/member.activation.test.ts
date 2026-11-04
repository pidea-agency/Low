import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";
import * as emailService from "../services/email.service";

describe("Office Member Creation & Self-Activation Security Flow", { timeout: 35000 }, () => {
  const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  let adminA: any;
  let cookieAdminA: string;

  let adminB: any;
  let cookieAdminB: string;

  beforeAll(async () => {
    emailService.clearSentEmailsHistory();

    // 1. Create Office Admin A
    const unameAdminA = `act_admin_a_${Date.now()}`;
    adminA = await supabaseService.createSupabaseUser({
      username: unameAdminA,
      password: "AdminPass123!",
      role: "admin",
      office_name: "مكتب المحامي أ. أحمد",
      status: "active",
      plan_tier: "plus",
      billing_cycle: "annual",
      ai_quota_limit: 100,
      subscription_end_date: futureDate,
    });
    const loginA = await request(app)
      .post("/api/auth/login")
      .send({ username: unameAdminA, password: "AdminPass123!" });
    expect(loginA.status).toBe(200);
    const cA = loginA.headers["set-cookie"];
    cookieAdminA = Array.isArray(cA) ? cA.join("; ") : cA;

    // 2. Create Office Admin B
    const unameAdminB = `act_admin_b_${Date.now()}`;
    adminB = await supabaseService.createSupabaseUser({
      username: unameAdminB,
      password: "AdminPass123!",
      role: "admin",
      office_name: "مكتب المحامي أ. باسل",
      status: "active",
      plan_tier: "plus",
      billing_cycle: "annual",
      ai_quota_limit: 100,
      subscription_end_date: futureDate,
    });
    const loginB = await request(app)
      .post("/api/auth/login")
      .send({ username: unameAdminB, password: "AdminPass123!" });
    expect(loginB.status).toBe(200);
    const cB = loginB.headers["set-cookie"];
    cookieAdminB = Array.isArray(cB) ? cB.join("; ") : cB;
  });

  afterAll(async () => {
    if (adminA?.id) await supabaseService.deleteSupabaseUser(adminA.id).catch(() => {});
    if (adminB?.id) await supabaseService.deleteSupabaseUser(adminB.id).catch(() => {});
  });

  describe("Member Creation (No Admin-Set Password)", () => {
    it("Admin creates a staff member without password; status is pending_activation and email is sent", async () => {
      const staffUname = `pending_staff_${Date.now()}`;
      const res = await request(app)
        .post("/api/users")
        .set("Cookie", cookieAdminA)
        .send({
          username: staffUname,
          email: "lawyer.pending@example.com",
          display_name: "أ. طارق المحامي",
          phone: "0599123456",
        });

      expect(res.status).toBe(201);
      expect(res.body.username).toBe(staffUname);
      expect(res.body.status).toBe("pending_activation");
      expect(res.body.password).toBeUndefined();
      expect(res.body.password_hash).toBeUndefined();
      expect(res.body).toHaveProperty("emailSent");

      // Verify email was generated with activation token
      const history = emailService.getSentEmailsHistory();
      const sent = history.find((e) => e.to === "lawyer.pending@example.com");
      expect(sent).toBeDefined();
      expect(sent!.token).toBeDefined();
      expect(sent!.token.length).toBeGreaterThanOrEqual(32);
      expect(sent!.activationUrl).toContain(`/activate?token=${sent!.token}`);

      // Clean up
      await supabaseService.deleteSupabaseUser(res.body.id).catch(() => {});
    });

    it("Rejects member creation when email is missing", async () => {
      const res = await request(app)
        .post("/api/users")
        .set("Cookie", cookieAdminA)
        .send({
          username: `no_email_${Date.now()}`,
          display_name: "مستخدم بدون بريد",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("البريد الإلكتروني مطلوب");
    });
  });

  describe("Pending Member Login Lockout", () => {
    let pendingMember: any;
    let pendingUsername: string;

    beforeAll(async () => {
      pendingUsername = `lock_staff_${Date.now()}`;
      const creation = await supabaseService.createOfficeMember(adminA.id, {
        username: pendingUsername,
        email: "locked.staff@example.com",
        display_name: "محامي بانتظار التفعيل",
      });
      pendingMember = creation.member;
    });

    afterAll(async () => {
      if (pendingMember?.id) {
        await supabaseService.deleteSupabaseUser(pendingMember.id).catch(() => {});
      }
    });

    it("Pending member CANNOT log in under any password (returns 403 with activation message)", async () => {
      const passwordsToTest = ["password123", "AdminPass123!", "123456", "!LOCKED:pending_activation!"];
      for (const pwd of passwordsToTest) {
        const res = await request(app)
          .post("/api/auth/login")
          .send({ username: pendingUsername, password: pwd });

        expect(res.status).toBe(403);
        expect(res.body.error).toContain("يجب إكمال التسجيل أولاً عبر الرابط المرسل إلى بريدك");
        expect(res.body.isPendingActivation).toBe(true);
      }
    });
  });

  describe("Public Activation Flow (/auth/activate)", () => {
    let rawToken: string;
    let staffUser: any;
    const staffUname = `activate_flow_${Date.now()}`;

    beforeAll(async () => {
      emailService.clearSentEmailsHistory();
      const res = await supabaseService.createOfficeMember(adminA.id, {
        username: staffUname,
        email: "flow.staff@example.com",
        display_name: "أ. خليل الناصر",
      });
      staffUser = res.member;
      rawToken = res.rawToken!;
    });

    afterAll(async () => {
      if (staffUser?.id) {
        await supabaseService.deleteSupabaseUser(staffUser.id).catch(() => {});
      }
    });

    it("GET /auth/activate/:token returns member and office details for a valid token", async () => {
      const res = await request(app).get(`/api/auth/activate/${rawToken}`);
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.username).toBe(staffUname);
      expect(res.body.displayName).toBe("أ. خليل الناصر");
      expect(res.body.officeName).toBe("مكتب المحامي أ. أحمد");
    });

    it("GET /auth/activate/:token rejects an invalid or bogus token with 400", async () => {
      const res = await request(app).get("/api/auth/activate/bogus_fake_token_12345");
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("غير صالح");
    });

    it("GET /auth/activate/:token rejects an expired token with 410", async () => {
      // Create a user with an expired token
      const expiredUname = `expired_${Date.now()}`;
      const expiredToken = "expired_raw_token_abcdef12345678901234567890";
      const tokenHash = (await import("crypto")).createHash("sha256").update(expiredToken).digest("hex");
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday

      const expiredUser = await supabaseService.createSupabaseUser({
        username: expiredUname,
        email: "expired@example.com",
        password_hash: "!LOCKED:pending_activation!",
        role: "staff",
        admin_id: adminA.id,
        status: "pending_activation",
        activation_token_hash: tokenHash,
        activation_token_expires_at: pastDate.toISOString(),
      });
      supabaseService.saveFallbackActivationToken(expiredUser.id, tokenHash, pastDate);

      const res = await request(app).get(`/api/auth/activate/${expiredToken}`);
      expect([400, 410]).toContain(res.status);
      expect(res.body.error).toContain("انتهت صلاحية");

      await supabaseService.deleteSupabaseUser(expiredUser.id).catch(() => {});
    });

    it("POST /auth/activate validates password strength and mismatch", async () => {
      // Mismatched confirmation
      const resMismatch = await request(app)
        .post("/api/auth/activate")
        .send({
          token: rawToken,
          password: "SecurePassword123!",
          password_confirmation: "DifferentPassword123!",
        });
      expect(resMismatch.status).toBe(400);
      expect(resMismatch.body.error).toContain("غير متطابقين");

      // Weak password
      const resWeak = await request(app)
        .post("/api/auth/activate")
        .send({
          token: rawToken,
          password: "123",
          password_confirmation: "123",
        });
      expect(resWeak.status).toBe(400);
    });

    it("POST /auth/activate successfully sets password, flips status to active, and invalidates token (single-use)", async () => {
      const newSecret = "KhalilPassword2026!";
      const res = await request(app)
        .post("/api/auth/activate")
        .send({
          token: rawToken,
          password: newSecret,
          password_confirmation: newSecret,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("تم تفعيل حسابك بنجاح");

      // Single-use: Reusing the exact token MUST fail now
      const reuseRes = await request(app)
        .post("/api/auth/activate")
        .send({
          token: rawToken,
          password: "AnotherPassword123!",
          password_confirmation: "AnotherPassword123!",
        });
      expect(reuseRes.status).toBe(400);

      // GET with the old token also reports invalid / already used
      const getOld = await request(app).get(`/api/auth/activate/${rawToken}`);
      expect(getOld.status).toBe(400);

      // Now the activated member can log in with their newly set password
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ username: staffUname, password: newSecret });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.username).toBe(staffUname);
      expect(loginRes.body.role).toBe("staff");
    });
  });

  describe("Resend Activation Flow & Office Scoping", () => {
    let pendingA: any;
    let pendingB: any;
    let initialTokenA: string;

    beforeAll(async () => {
      emailService.clearSentEmailsHistory();

      // Member under Admin A
      const createA = await supabaseService.createOfficeMember(adminA.id, {
        username: `resend_a_${Date.now()}`,
        email: "resend.a@example.com",
        display_name: "محامي مكتب أ",
      });
      pendingA = createA.member;
      initialTokenA = createA.rawToken!;

      // Member under Admin B
      const createB = await supabaseService.createOfficeMember(adminB.id, {
        username: `resend_b_${Date.now()}`,
        email: "resend.b@example.com",
        display_name: "محامي مكتب ب",
      });
      pendingB = createB.member;
    });

    afterAll(async () => {
      if (pendingA?.id) await supabaseService.deleteSupabaseUser(pendingA.id).catch(() => {});
      if (pendingB?.id) await supabaseService.deleteSupabaseUser(pendingB.id).catch(() => {});
    });

    it("Admin A CANNOT resend activation for Admin B's member (returns 404, no existence leak)", async () => {
      const res = await request(app)
        .post(`/api/users/${pendingB.id}/resend-activation`)
        .set("Cookie", cookieAdminA);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("غير موجود");
    });

    it("Admin A successfully resends activation for their own member, invalidating previous token", async () => {
      const res = await request(app)
        .post(`/api/users/${pendingA.id}/resend-activation`)
        .set("Cookie", cookieAdminA);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Previous token MUST now be invalid
      const prevCheck = await request(app).get(`/api/auth/activate/${initialTokenA}`);
      expect(prevCheck.status).toBe(400);

      // Check newest token in email history works
      const history = emailService.getSentEmailsHistory();
      const latestEmail = history.filter((h) => h.to === "resend.a@example.com").pop();
      expect(latestEmail).toBeDefined();
      expect(latestEmail!.token).not.toBe(initialTokenA);

      const newCheck = await request(app).get(`/api/auth/activate/${latestEmail!.token}`);
      expect(newCheck.status).toBe(200);
      expect(newCheck.body.valid).toBe(true);
    });

    it("Resend is rate-limited on immediate re-attempt (cooldown)", async () => {
      const res = await request(app)
        .post(`/api/users/${pendingA.id}/resend-activation`)
        .set("Cookie", cookieAdminA);

      expect(res.status).toBe(429);
      expect(res.body.error).toContain("يرجى الانتظار");
    });
  });
});

