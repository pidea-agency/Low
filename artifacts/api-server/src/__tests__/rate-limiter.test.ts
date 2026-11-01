import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import app from "../app";
import {
  createSharedRateLimiter,
  MemoryRateLimitStore,
  setGlobalRateLimitStore,
  getGlobalRateLimitStore,
  getClientIp,
  clearRateLimits,
  type RateLimitStore,
} from "../middlewares/rate-limiter.middleware";

describe("Rate Limiter & Brute-Force Protection", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    setGlobalRateLimitStore(null);
    await clearRateLimits();
  });

  afterEach(async () => {
    setGlobalRateLimitStore(null);
    await clearRateLimits();
  });

  it("after N failed login attempts within window, the next attempt gets 429 with Retry-After header", async () => {
    const store = new MemoryRateLimitStore();
    setGlobalRateLimitStore(store);

    const testApp = express();
    testApp.set("trust proxy", 1);
    testApp.use(express.json());

    const limiter = createSharedRateLimiter({
      windowMs: 60 * 1000,
      maxPerAccount: 3,
      maxPerIp: 10,
    });

    testApp.post("/api/login", limiter, (req, res) => {
      const { username, password } = req.body;
      if (password !== "correct-secret-123") {
        return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة." });
      }
      return res.status(200).json({ ok: true, username });
    });

    // 3 failed attempts
    for (let i = 0; i < 3; i++) {
      const res = await request(testApp)
        .post("/api/login")
        .send({ username: "lawyer_test", password: "wrong_password" });
      expect(res.status).toBe(401);
    }

    // 4th attempt should be blocked with 429 and Retry-After
    const blockedRes = await request(testApp)
      .post("/api/login")
      .send({ username: "lawyer_test", password: "wrong_password" });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers["retry-after"]).toBeDefined();
    expect(Number(blockedRes.headers["retry-after"])).toBeGreaterThan(0);
    expect(blockedRes.body.error).toMatch(/تم تجاوز عدد المحاولات/);
  });

  it("counter is shared: an attempt on instance A is counted when instance B checks it", async () => {
    const sharedStore = new MemoryRateLimitStore();

    const limiterA = createSharedRateLimiter({
      windowMs: 60 * 1000,
      maxPerAccount: 2,
      maxPerIp: 10,
      store: sharedStore,
    });

    const limiterB = createSharedRateLimiter({
      windowMs: 60 * 1000,
      maxPerAccount: 2,
      maxPerIp: 10,
      store: sharedStore,
    });

    const appA = express();
    appA.use(express.json());
    appA.post("/login", limiterA, (_req, res) => res.status(401).json({ error: "failed" }));

    const appB = express();
    appB.use(express.json());
    appB.post("/login", limiterB, (_req, res) => res.status(401).json({ error: "failed" }));

    // 1st attempt on Instance A
    const res1 = await request(appA).post("/login").send({ username: "shared_user", password: "bad" });
    expect(res1.status).toBe(401);

    // 2nd attempt on Instance B
    const res2 = await request(appB).post("/login").send({ username: "shared_user", password: "bad" });
    expect(res2.status).toBe(401);

    // 3rd attempt on Instance A should be blocked because Instance B shared the count
    const res3 = await request(appA).post("/login").send({ username: "shared_user", password: "bad" });
    expect(res3.status).toBe(429);

    // Instance B also immediately blocks it
    const res4 = await request(appB).post("/login").send({ username: "shared_user", password: "bad" });
    expect(res4.status).toBe(429);
  });

  it("the counter resets after the window passes", async () => {
    const store = new MemoryRateLimitStore();
    const limiter = createSharedRateLimiter({
      windowMs: 1000, // 1 second window
      maxPerAccount: 2,
      maxPerIp: 10,
      store,
    });

    const testApp = express();
    testApp.use(express.json());
    testApp.post("/login", limiter, (_req, res) => res.status(401).json({ error: "failed" }));

    // 2 failures
    await request(testApp).post("/login").send({ username: "expire_user", password: "bad" });
    await request(testApp).post("/login").send({ username: "expire_user", password: "bad" });

    // Blocked
    const blockedRes = await request(testApp).post("/login").send({ username: "expire_user", password: "bad" });
    expect(blockedRes.status).toBe(429);

    // Advance time beyond window
    vi.setSystemTime(Date.now() + 2000);

    // Next attempt should be allowed through again (returning 401 instead of 429)
    const allowedRes = await request(testApp).post("/login").send({ username: "expire_user", password: "bad" });
    expect(allowedRes.status).toBe(401);

    vi.useRealTimers();
  });

  it("successful login does not lock out legitimate user, but failed attempts still count", async () => {
    const store = new MemoryRateLimitStore();
    const limiter = createSharedRateLimiter({
      windowMs: 60 * 1000,
      maxPerAccount: 3,
      maxPerIp: 10,
      store,
    });

    const testApp = express();
    testApp.use(express.json());
    testApp.post("/login", limiter, (req, res) => {
      if (req.body.password === "secret_password") {
        return res.status(200).json({ success: true });
      }
      return res.status(401).json({ error: "invalid" });
    });

    // 2 failed attempts
    await request(testApp).post("/login").send({ username: "legit_user", password: "wrong1" });
    await request(testApp).post("/login").send({ username: "legit_user", password: "wrong2" });

    // 3rd attempt is SUCCESSFUL
    const successRes = await request(testApp).post("/login").send({ username: "legit_user", password: "secret_password" });
    expect(successRes.status).toBe(200);

    // The user should not be locked out and can log in again
    const nextSuccess = await request(testApp).post("/login").send({ username: "legit_user", password: "secret_password" });
    expect(nextSuccess.status).toBe(200);
  });

  it("changing or faking X-Forwarded-For header does NOT bypass the limit", async () => {
    const store = new MemoryRateLimitStore();
    const limiter = createSharedRateLimiter({
      windowMs: 60 * 1000,
      maxPerAccount: 2,
      maxPerIp: 10,
      store,
    });

    const testApp = express();
    testApp.set("trust proxy", 1);
    testApp.use(express.json());
    testApp.post("/login", limiter, (_req, res) => res.status(401).json({ error: "failed" }));

    // Attacker tries with fake IP 1.1.1.1
    const res1 = await request(testApp)
      .post("/login")
      .set("X-Forwarded-For", "1.1.1.1")
      .send({ username: "target_account", password: "wrong" });
    expect(res1.status).toBe(401);

    // Attacker rotates spoofed header to 2.2.2.2 on attempt 2
    const res2 = await request(testApp)
      .post("/login")
      .set("X-Forwarded-For", "2.2.2.2")
      .send({ username: "target_account", password: "wrong" });
    expect(res2.status).toBe(401);

    // Attempt 3 with spoofed 3.3.3.3: should STILL be blocked because account limit is reached
    const res3 = await request(testApp)
      .post("/login")
      .set("X-Forwarded-For", "3.3.3.3")
      .send({ username: "target_account", password: "wrong" });
    expect(res3.status).toBe(429);
  });

  it("limits apply per IP (protecting against credential stuffing across multiple accounts)", async () => {
    const store = new MemoryRateLimitStore();
    const limiter = createSharedRateLimiter({
      windowMs: 60 * 1000,
      maxPerAccount: 5,
      maxPerIp: 3, // IP allows only 3 failed attempts overall
      store,
    });

    const testApp = express();
    testApp.set("trust proxy", 1);
    testApp.use(express.json());
    testApp.post("/login", limiter, (_req, res) => res.status(401).json({ error: "failed" }));

    // Attacker from same IP attacks different accounts
    await request(testApp).post("/login").send({ username: "account_1", password: "wrong" });
    await request(testApp).post("/login").send({ username: "account_2", password: "wrong" });
    await request(testApp).post("/login").send({ username: "account_3", password: "wrong" });

    // 4th attempt with another new username should be blocked by IP limit
    const blockedRes = await request(testApp).post("/login").send({ username: "account_4", password: "wrong" });
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error).toMatch(/تم تجاوز عدد المحاولات/);
  });

  it("fails closed (returns 503) if the shared store can't be reached", async () => {
    const brokenStore: RateLimitStore = {
      async get() {
        throw new Error("Supabase rate_limits connection timeout");
      },
      async increment() {
        throw new Error("Supabase rate_limits connection timeout");
      },
      async reset() {
        throw new Error("Supabase rate_limits connection timeout");
      },
      async clear() {
        throw new Error("Supabase rate_limits connection timeout");
      },
    };

    const limiter = createSharedRateLimiter({
      windowMs: 60 * 1000,
      maxPerAccount: 5,
      maxPerIp: 10,
      store: brokenStore,
    });

    const testApp = express();
    testApp.use(express.json());
    testApp.post("/login", limiter, (_req, res) => res.status(200).json({ ok: true }));

    const res = await request(testApp).post("/login").send({ username: "user1", password: "bad" });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/تعذر|خدمة/);
  });

  it("blocks /api/auth/login after exceeding failed login attempts on real Express app", async () => {
    // 5 failed attempts against real app /api/auth/login
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "brute_target", password: "wrong_password_attempt" });
      expect(res.status).toBe(401);
    }

    // 6th attempt should be blocked with 429
    const blockedRes = await request(app)
      .post("/api/auth/login")
      .send({ username: "brute_target", password: "wrong_password_attempt" });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers["retry-after"]).toBeDefined();
    expect(blockedRes.body.error).toMatch(/تم تجاوز عدد المحاولات/);

    // Verify clearing block restores access
    await clearRateLimits({ username: "brute_target" });
    const retryRes = await request(app)
      .post("/api/auth/login")
      .send({ username: "brute_target", password: "wrong_password_attempt" });
    expect(retryRes.status).toBe(401); // back to normal 401 instead of 429
  });
});
