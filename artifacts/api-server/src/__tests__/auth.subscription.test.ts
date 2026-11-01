import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { env } from "../config/env";
import {
  attachAuthUser,
  requireAuth,
  requireActiveSubscription,
  createSignedSessionCookie,
} from "../middlewares/auth.middleware";
import * as supabaseService from "../services/supabase.service";
import { AccountSourceUnavailableError } from "../services/supabase.service";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser(env.sessionSecret));

  // Protected route simulating subscription-locked endpoints (e.g. sessions, tasks, AI)
  app.get(
    "/api/test-subscription-protected",
    attachAuthUser,
    requireAuth,
    requireActiveSubscription,
    (req, res) => {
      res.json({ success: true, user: req.authUser });
    },
  );

  return app;
}

describe("Subscription Middleware Fail-Closed Enforcement (requireActiveSubscription)", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.restoreAllMocks();
    app = createTestApp();
  });

  it("allows request to continue when user has an active subscription (expiry in the future)", async () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    vi.spyOn(supabaseService, "findUserByIdOrUsername").mockResolvedValue({
      id: "user-active-1",
      username: "active_lawyer",
      role: "staff",
      status: "active",
      subscription_end_date: futureDate,
    } as any);

    const cookie = createSignedSessionCookie({
      userId: "user-active-1",
      username: "active_lawyer",
    });

    const res = await request(app)
      .get("/api/test-subscription-protected")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("rejects with 403 and a clear Arabic message when subscription is expired", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    vi.spyOn(supabaseService, "findUserByIdOrUsername").mockResolvedValue({
      id: "user-expired-1",
      username: "expired_lawyer",
      role: "staff",
      status: "active",
      subscription_end_date: pastDate,
    } as any);

    const cookie = createSignedSessionCookie({
      userId: "user-expired-1",
      username: "expired_lawyer",
    });

    const res = await request(app)
      .get("/api/test-subscription-protected")
      .set("Cookie", cookie);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("انتهت فترة اشتراكك");
  });

  it("rejects request (never calls next()) when user is not found in the account source", async () => {
    // When user cannot be found in trusted account source
    vi.spyOn(supabaseService, "findUserByIdOrUsername").mockResolvedValue(null);

    const cookie = createSignedSessionCookie({
      userId: "ghost-user-id",
      username: "ghost_user",
    });

    const res = await request(app)
      .get("/api/test-subscription-protected")
      .set("Cookie", cookie);

    // Must be rejected (401 or 403), NEVER 200
    expect([401, 403]).toContain(res.status);
    expect(res.body.success).toBeUndefined();
  });

  it("rejects with 503 service error (never next()) when account source throws or times out", async () => {
    // Direct middleware test to ensure requireActiveSubscription itself handles errors and returns 503
    let nextCalled = false;
    let statusCode = 200;
    let responseBody: any = null;

    const mockReq = {
      authUser: {
        userId: "test-user-id",
        username: "test_user",
        role: "staff",
      },
    } as any;

    const mockRes = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: any) {
        responseBody = body;
        return this;
      },
    } as any;

    const mockNext = () => {
      nextCalled = true;
    };

    vi.spyOn(supabaseService, "findUserByIdOrUsername").mockRejectedValue(
      new AccountSourceUnavailableError("Database connection timeout"),
    );

    // Also spy loadLocalUsers to simulate exception in existing code
    vi.spyOn(supabaseService, "loadLocalUsers").mockImplementation(() => {
      throw new Error("Disk / DB read failed");
    });

    await requireActiveSubscription(mockReq, mockRes, mockNext);

    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(503);
    expect(responseBody?.error).toContain("تعذر");
  });

  it("rejects when subscription data is missing or invalid (null expiry or bad date)", async () => {
    // Case A: null subscription_end_date
    vi.spyOn(supabaseService, "findUserByIdOrUsername").mockResolvedValue({
      id: "user-no-date",
      username: "no_date_lawyer",
      role: "staff",
      status: "active",
      subscription_end_date: null,
    } as any);

    const cookieA = createSignedSessionCookie({
      userId: "user-no-date",
      username: "no_date_lawyer",
    });

    const resA = await request(app)
      .get("/api/test-subscription-protected")
      .set("Cookie", cookieA);

    expect(resA.status).toBe(403);
    expect(resA.body.error).toBeDefined();
    expect(resA.body.success).toBeUndefined();

    // Case B: invalid date string
    vi.spyOn(supabaseService, "findUserByIdOrUsername").mockResolvedValue({
      id: "user-bad-date",
      username: "bad_date_lawyer",
      role: "staff",
      status: "active",
      subscription_end_date: "invalid-date-string-xyz",
    } as any);

    const cookieB = createSignedSessionCookie({
      userId: "user-bad-date",
      username: "bad_date_lawyer",
    });

    const resB = await request(app)
      .get("/api/test-subscription-protected")
      .set("Cookie", cookieB);

    expect(resB.status).toBe(403);
    expect(resB.body.error).toBeDefined();
    expect(resB.body.success).toBeUndefined();
  });

  it("allows admin account to keep access without subscription expiry restrictions", async () => {
    vi.spyOn(supabaseService, "findUserByIdOrUsername").mockResolvedValue({
      id: "admin-id-1",
      username: "superadmin",
      role: "admin",
      status: "active",
      subscription_end_date: null, // Admins don't have expiry
    } as any);

    const cookie = createSignedSessionCookie({
      userId: "admin-id-1",
      username: "superadmin",
    });

    const res = await request(app)
      .get("/api/test-subscription-protected")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.role).toBe("admin");
  });
});
