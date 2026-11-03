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

  it("allows office admin with active subscription (expiry in the future)", async () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    vi.spyOn(supabaseService, "findUserByIdOrUsername").mockResolvedValue({
      id: "admin-active-1",
      username: "office_admin",
      role: "admin",
      status: "active",
      subscription_end_date: futureDate,
    } as any);

    const cookie = createSignedSessionCookie({
      userId: "admin-active-1",
      username: "office_admin",
    });

    const res = await request(app)
      .get("/api/test-subscription-protected")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("allows staff linked to an office admin whose subscription is active", async () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    vi.spyOn(supabaseService, "findUserByIdOrUsername").mockImplementation(async (idOrUsername) => {
      if (idOrUsername === "user-staff-1" || idOrUsername === "active_lawyer") {
        return {
          id: "user-staff-1",
          username: "active_lawyer",
          role: "staff",
          status: "active",
          admin_id: "office-admin-1",
        } as any;
      }
      if (idOrUsername === "office-admin-1") {
        return {
          id: "office-admin-1",
          username: "office_boss",
          role: "admin",
          status: "active",
          subscription_end_date: futureDate,
        } as any;
      }
      return null;
    });

    const cookie = createSignedSessionCookie({
      userId: "user-staff-1",
      username: "active_lawyer",
    });

    const res = await request(app)
      .get("/api/test-subscription-protected")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("rejects staff with 403 when unlinked to any office admin", async () => {
    vi.spyOn(supabaseService, "findUserByIdOrUsername").mockResolvedValue({
      id: "user-unlinked-1",
      username: "unlinked_lawyer",
      role: "staff",
      status: "active",
      admin_id: null,
    } as any);

    const cookie = createSignedSessionCookie({
      userId: "user-unlinked-1",
      username: "unlinked_lawyer",
    });

    const res = await request(app)
      .get("/api/test-subscription-protected")
      .set("Cookie", cookie);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("غير مرتبط بأي مكتب");
  });

  it("rejects with 403 when office subscription is expired", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    vi.spyOn(supabaseService, "findUserByIdOrUsername").mockResolvedValue({
      id: "admin-expired-1",
      username: "expired_admin",
      role: "admin",
      status: "active",
      subscription_end_date: pastDate,
    } as any);

    const cookie = createSignedSessionCookie({
      userId: "admin-expired-1",
      username: "expired_admin",
    });

    const res = await request(app)
      .get("/api/test-subscription-protected")
      .set("Cookie", cookie);

    expect(res.status).toBe(403);
    expect(res.body.error).toContain("انتهت فترة اشتراك");
  });

  it("rejects request (never calls next()) when user is not found in the account source", async () => {
    vi.spyOn(supabaseService, "findUserByIdOrUsername").mockResolvedValue(null);

    const cookie = createSignedSessionCookie({
      userId: "ghost-user-id",
      username: "ghost_user",
    });

    const res = await request(app)
      .get("/api/test-subscription-protected")
      .set("Cookie", cookie);

    expect([401, 403]).toContain(res.status);
    expect(res.body.success).toBeUndefined();
  });

  it("rejects with 503 service error (never next()) when account source throws or times out", async () => {
    let nextCalled = false;
    let statusCode = 200;
    let responseBody: any = null;

    const mockReq = {
      authUser: {
        userId: "test-user-id",
        username: "test_user",
        role: "admin",
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

    vi.spyOn(supabaseService, "loadLocalUsers").mockImplementation(() => {
      throw new Error("Disk / DB read failed");
    });

    await requireActiveSubscription(mockReq, mockRes, mockNext);

    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(503);
    expect(responseBody?.error).toContain("تعذر");
  });

  it("rejects when subscription data is missing or invalid (null expiry or bad date)", async () => {
    // Case A: null subscription_end_date for admin
    vi.spyOn(supabaseService, "findUserByIdOrUsername").mockResolvedValue({
      id: "admin-no-date",
      username: "no_date_admin",
      role: "admin",
      status: "active",
      subscription_end_date: null,
    } as any);

    const cookieA = createSignedSessionCookie({
      userId: "admin-no-date",
      username: "no_date_admin",
    });

    const resA = await request(app)
      .get("/api/test-subscription-protected")
      .set("Cookie", cookieA);

    expect(resA.status).toBe(403);
    expect(resA.body.error).toBeDefined();

    // Case B: invalid date string
    vi.spyOn(supabaseService, "findUserByIdOrUsername").mockResolvedValue({
      id: "admin-bad-date",
      username: "bad_date_admin",
      role: "admin",
      status: "active",
      subscription_end_date: "invalid-date-string-xyz",
    } as any);

    const cookieB = createSignedSessionCookie({
      userId: "admin-bad-date",
      username: "bad_date_admin",
    });

    const resB = await request(app)
      .get("/api/test-subscription-protected")
      .set("Cookie", cookieB);

    expect(resB.status).toBe(403);
    expect(resB.body.error).toBeDefined();
  });

  it("allows super_admin account to keep access without subscription expiry restrictions", async () => {
    vi.spyOn(supabaseService, "findUserByIdOrUsername").mockResolvedValue({
      id: "superadmin-id-1",
      username: "superadmin",
      role: "super_admin",
      status: "active",
      subscription_end_date: null,
    } as any);

    const cookie = createSignedSessionCookie({
      userId: "superadmin-id-1",
      username: "superadmin",
    });

    const res = await request(app)
      .get("/api/test-subscription-protected")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.role).toBe("super_admin");
  });
});
