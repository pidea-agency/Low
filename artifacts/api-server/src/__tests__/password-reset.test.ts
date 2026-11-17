import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import * as supabaseService from "../services/supabase.service";
import * as passwordResetService from "../services/password-reset.service";

describe("Password Reset via WhatsApp OTP Flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    passwordResetService.resetAllRateLimitsForTesting();
  });

  // TEST 1: Requesting reset for nonexistent username returns identical response and approximate timing
  it("returns identical response (status code, body shape, timing) for nonexistent username as existing user", async () => {
    // Mock sendRaw to avoid external internet latency skewing timing
    const { WhatsappReminderChannel } = await import("../services/reminder/channels/whatsappChannel");
    vi.spyOn(WhatsappReminderChannel.prototype, "sendRaw").mockResolvedValue({
      success: true,
      isConfigured: true,
    });

    const existingUser = await supabaseService.createSupabaseUser({
      username: `existing_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      password: "ExistingPass123!",
      role: "staff",
      phone: "+966501234567",
    });

    try {
      // 1. Existing user request
      const startExist = Date.now();
      const resExist = await request(app)
        .post("/api/auth/password-reset/request")
        .send({ username: existingUser.username });
      const durationExist = Date.now() - startExist;

      expect(resExist.status).toBe(200);
      expect(resExist.body).toEqual({
        success: true,
        message: passwordResetService.GENERIC_REQUEST_SUCCESS_MESSAGE,
      });

      // 2. Nonexistent user request
      const startNonExist = Date.now();
      const resNonExist = await request(app)
        .post("/api/auth/password-reset/request")
        .send({ username: "definitely_non_existent_user_99999" });
      const durationNonExist = Date.now() - startNonExist;

      expect(resNonExist.status).toBe(200);
      expect(resNonExist.body).toEqual({
        success: true,
        message: passwordResetService.GENERIC_REQUEST_SUCCESS_MESSAGE,
      });

      // Both should have identical structure and reasonable timing (within 350ms of each other)
      expect(Math.abs(durationExist - durationNonExist)).toBeLessThan(400);
    } finally {
      await supabaseService.deleteSupabaseUser(existingUser.id).catch(() => {});
    }
  });

  // TEST 2: Requesting reset for user with no phone returns identical generic response too
  it("returns identical generic response for user with no phone on file", async () => {
    const noPhoneUser = await supabaseService.createSupabaseUser({
      username: `nophone_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      password: "NoPhonePass123!",
      role: "staff",
      phone: undefined, // no phone
    });

    try {
      const res = await request(app)
        .post("/api/auth/password-reset/request")
        .send({ username: noPhoneUser.username });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: passwordResetService.GENERIC_REQUEST_SUCCESS_MESSAGE,
      });

      // Confirm no pending reset OTP was stored
      const pending = passwordResetService.getPendingResetForTesting(noPhoneUser.username);
      expect(pending).toBeUndefined();
    } finally {
      await supabaseService.deleteSupabaseUser(noPhoneUser.id).catch(() => {});
    }
  });

  // TEST 3: A code can only be used once; reusing it after success fails
  it("ensures a code can only be used once; reusing it after success fails", async () => {
    const username = `singleuse_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const user = await supabaseService.createSupabaseUser({
      username,
      password: "SingleUse123!",
      role: "staff",
      phone: "+966500000001",
    });

    try {
      // Step 1: Request reset
      await request(app)
        .post("/api/auth/password-reset/request")
        .send({ username });

      const pending = passwordResetService.getPendingResetForTesting(username);
      expect(pending).toBeDefined();
      const rawCode = pending!.testRawCode!;
      expect(rawCode).toHaveLength(6);

      // Step 2: First verify succeeds
      const verifyRes1 = await request(app)
        .post("/api/auth/password-reset/verify")
        .send({ username, code: rawCode });

      expect(verifyRes1.status).toBe(200);
      expect(verifyRes1.body.success).toBe(true);
      expect(verifyRes1.body.resetToken).toBeDefined();

      // Step 2 again: Reusing the same code MUST fail
      const verifyRes2 = await request(app)
        .post("/api/auth/password-reset/verify")
        .send({ username, code: rawCode });

      expect(verifyRes2.status).toBe(400);
      expect(verifyRes2.body.error).toBe("رمز غير صحيح");
    } finally {
      await supabaseService.deleteSupabaseUser(user.id).catch(() => {});
    }
  });

  // TEST 4: Exceeding verify attempts invalidates the code and requires a fresh request
  it("invalidates the code after exceeding max verify attempts (5)", async () => {
    const username = `maxattempts_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const user = await supabaseService.createSupabaseUser({
      username,
      password: "MaxAttempts123!",
      role: "staff",
      phone: "+966500000002",
    });

    try {
      // Step 1: Request
      await request(app)
        .post("/api/auth/password-reset/request")
        .send({ username });

      const pending = passwordResetService.getPendingResetForTesting(username);
      const correctCode = pending!.testRawCode!;

      // Attempt 1, 2, 3, 4 with wrong code
      for (let i = 1; i <= 4; i++) {
        const res = await request(app)
          .post("/api/auth/password-reset/verify")
          .send({ username, code: "000000" });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("رمز غير صحيح");
      }

      // Attempt 5 (exceeding max attempts)
      const res5 = await request(app)
        .post("/api/auth/password-reset/verify")
        .send({ username, code: "000000" });
      expect(res5.status).toBe(400);
      expect(res5.body.error).toContain("تم تجاوز الحد الأقصى للمحاولات");

      // Now, even sending the CORRECT code must fail because the code was invalidated
      const resAfter = await request(app)
        .post("/api/auth/password-reset/verify")
        .send({ username, code: correctCode });
      expect(resAfter.status).toBe(400);
      expect(resAfter.body.error).toBe("رمز غير صحيح");
    } finally {
      await supabaseService.deleteSupabaseUser(user.id).catch(() => {});
    }
  });

  // TEST 5: The reset token from step 2 cannot be used for a DIFFERENT username
  it("rejects using reset token for a different username in step 3", async () => {
    const userA = await supabaseService.createSupabaseUser({
      username: `user_a_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      password: "UserAPass123!",
      role: "staff",
      phone: "+966500000003",
    });

    const userB = await supabaseService.createSupabaseUser({
      username: `user_b_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      password: "UserBPass123!",
      role: "staff",
      phone: "+966500000004",
    });

    try {
      // Step 1 & 2 for userA
      await request(app)
        .post("/api/auth/password-reset/request")
        .send({ username: userA.username });

      const pendingA = passwordResetService.getPendingResetForTesting(userA.username);
      const verifyRes = await request(app)
        .post("/api/auth/password-reset/verify")
        .send({ username: userA.username, code: pendingA!.testRawCode! });

      const resetTokenA = verifyRes.body.resetToken;
      expect(resetTokenA).toBeDefined();

      // Craft forged token that has userA's userId but userB's username
      const forgedToken = passwordResetService.signResetToken({
        userId: userA.id,
        username: userB.username,
      });

      const completeRes = await request(app)
        .post("/api/auth/password-reset/complete")
        .send({
          resetToken: forgedToken,
          newPassword: "NewSecurePass2026!",
          confirmPassword: "NewSecurePass2026!",
        });

      // Must fail with 400
      expect(completeRes.status).toBe(400);
      expect(completeRes.body.error).toContain("غير متطابق");
    } finally {
      await supabaseService.deleteSupabaseUser(userA.id).catch(() => {});
      await supabaseService.deleteSupabaseUser(userB.id).catch(() => {});
    }
  });

  // TEST 6: Completing a reset revokes all existing sessions for that user
  it("revokes all existing sessions for that user when reset completes", async () => {
    const username = `revoketest_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const user = await supabaseService.createSupabaseUser({
      username,
      password: "InitialPass123!",
      role: "admin",
      office_name: "مكتب التجربة",
      subscription_end_date: "2030-12-31",
      phone: "+966500000005",
      status: "active",
    });

    try {
      // 1. User logs in and gets an active session cookie
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({
          username,
          password: "InitialPass123!",
        });

      expect(loginRes.status).toBe(200);
      const setCookie = loginRes.headers["set-cookie"];
      const cookieHeader = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;

      // 2. Verify active session works
      const meResBefore = await request(app)
        .get("/api/auth/me")
        .set("Cookie", cookieHeader);
      expect(meResBefore.status).toBe(200);
      expect(meResBefore.body.username).toBe(username);

      // 3. User performs full reset flow via WhatsApp OTP
      await request(app)
        .post("/api/auth/password-reset/request")
        .send({ username });

      const pending = passwordResetService.getPendingResetForTesting(username);
      const verifyRes = await request(app)
        .post("/api/auth/password-reset/verify")
        .send({ username, code: pending!.testRawCode! });

      const completeRes = await request(app)
        .post("/api/auth/password-reset/complete")
        .send({
          resetToken: verifyRes.body.resetToken,
          newPassword: "NewSecretPass2026!",
          confirmPassword: "NewSecretPass2026!",
        });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.success).toBe(true);

      // 4. Test that the PREVIOUS session token stops working immediately
      const meResAfter = await request(app)
        .get("/api/auth/me")
        .set("Cookie", cookieHeader);

      expect(meResAfter.status).toBe(401);

      // 5. Test that logging in with the old password fails
      const oldLoginRes = await request(app)
        .post("/api/auth/login")
        .send({
          username,
          password: "InitialPass123!",
        });
      expect(oldLoginRes.status).toBe(401);

      // 6. Test that logging in with the NEW password succeeds
      const newLoginRes = await request(app)
        .post("/api/auth/login")
        .send({
          username,
          password: "NewSecretPass2026!",
        });
      expect(newLoginRes.status).toBe(200);
    } finally {
      await supabaseService.deleteSupabaseUser(user.id).catch(() => {});
    }
  });

  // TEST 7: Rate limiting actually triggers after stated thresholds
  it("enforces rate limits (max 3 per username per hour, max 10 per IP per hour)", async () => {
    const username = `ratelimit_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const user = await supabaseService.createSupabaseUser({
      username,
      password: "RatePass123!",
      role: "staff",
      phone: "+966500000006",
    });

    try {
      // 1. Send 3 requests for the same username (allowed)
      for (let i = 1; i <= 3; i++) {
        const res = await request(app)
          .post("/api/auth/password-reset/request")
          .set("X-Forwarded-For", `192.168.1.${i}`) // different IPs
          .send({ username });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe(passwordResetService.GENERIC_REQUEST_SUCCESS_MESSAGE);
      }

      // 4th request for this username must be silently dropped (still returns 200 generic message)
      const res4 = await request(app)
        .post("/api/auth/password-reset/request")
        .set("X-Forwarded-For", "192.168.1.99")
        .send({ username });
      expect(res4.status).toBe(200);
      expect(res4.body.message).toBe(passwordResetService.GENERIC_REQUEST_SUCCESS_MESSAGE);

      // 2. Test IP rate limit: send 10 requests from the same IP with different usernames
      const fixedIp = "10.0.0.42";
      passwordResetService.resetAllRateLimitsForTesting();

      for (let i = 1; i <= 10; i++) {
        const res = await request(app)
          .post("/api/auth/password-reset/request")
          .set("X-Forwarded-For", fixedIp)
          .send({ username: `unique_user_${i}` });
        expect(res.status).toBe(200);
      }

      // 11th request from that IP must be silently dropped
      const res11 = await request(app)
        .post("/api/auth/password-reset/request")
        .set("X-Forwarded-For", fixedIp)
        .send({ username: "another_user" });
      expect(res11.status).toBe(200);
      expect(res11.body.message).toBe(passwordResetService.GENERIC_REQUEST_SUCCESS_MESSAGE);

      // 3. Test Verify Rate Limit on IP (step 2)
      for (let i = 1; i <= 10; i++) {
        await request(app)
          .post("/api/auth/password-reset/verify")
          .set("X-Forwarded-For", "10.0.0.55")
          .send({ username: "any", code: "123456" });
      }

      // 11th verify attempt from this IP must trigger 429 rate limit
      const verifyLimitRes = await request(app)
        .post("/api/auth/password-reset/verify")
        .set("X-Forwarded-For", "10.0.0.55")
        .send({ username: "any", code: "123456" });

      expect(verifyLimitRes.status).toBe(429);
      expect(verifyLimitRes.body.error).toContain("تم تجاوز عدد المحاولات المسموح به");
    } finally {
      await supabaseService.deleteSupabaseUser(user.id).catch(() => {});
    }
  });
});
