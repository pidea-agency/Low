import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import app from "../app";
import { env } from "../config/env";
import * as reminderScheduler from "../scheduler/reminderScheduler";
import * as envModule from "../config/env";

describe("Cron Reminders Security & Authentication (Fail-Closed)", () => {
  let sweepSpy: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    sweepSpy = vi.spyOn(reminderScheduler, "runReminderSweep").mockResolvedValue(undefined);
    // Mock sheets configured to isolate auth logic
    vi.spyOn(envModule, "isGoogleSheetsConfigured").mockReturnValue(true);
  });

  it("rejects request and never runs job when CRON_SECRET is undefined", async () => {
    vi.spyOn(env, "cronSecret", "get").mockReturnValue(undefined as any);

    const res = await request(app)
      .get("/api/cron/reminders");

    expect([401, 403, 500, 503]).toContain(res.status);
    expect(res.body.error).toBeDefined();
    expect(sweepSpy).not.toHaveBeenCalled();
  });

  it("rejects request and never runs job when CRON_SECRET is an empty string or spaces", async () => {
    vi.spyOn(env, "cronSecret", "get").mockReturnValue("   ");

    const res = await request(app)
      .get("/api/cron/reminders")
      .set("Authorization", "Bearer    ");

    expect([401, 403, 500, 503]).toContain(res.status);
    expect(res.body.error).toBeDefined();
    expect(sweepSpy).not.toHaveBeenCalled();
  });

  it("rejects with 401 when CRON_SECRET is set but request has no credentials", async () => {
    vi.spyOn(env, "cronSecret", "get").mockReturnValue("super-secure-cron-secret-123");

    const res = await request(app)
      .get("/api/cron/reminders");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
    expect(sweepSpy).not.toHaveBeenCalled();
  });

  it("rejects with 401 when CRON_SECRET is set but request has wrong credentials", async () => {
    vi.spyOn(env, "cronSecret", "get").mockReturnValue("super-secure-cron-secret-123");

    const res = await request(app)
      .get("/api/cron/reminders")
      .set("Authorization", "Bearer wrong-token-xyz");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
    expect(sweepSpy).not.toHaveBeenCalled();
  });

  it("rejects with 401 when token length differs (timing-safe check)", async () => {
    vi.spyOn(env, "cronSecret", "get").mockReturnValue("super-secure-cron-secret-123");

    const res = await request(app)
      .get("/api/cron/reminders")
      .set("Authorization", "Bearer super-secure");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
    expect(sweepSpy).not.toHaveBeenCalled();
  });

  it("allows job to run when CRON_SECRET is set and request provides the exact bearer token", async () => {
    vi.spyOn(env, "cronSecret", "get").mockReturnValue("super-secure-cron-secret-123");

    const res = await request(app)
      .get("/api/cron/reminders")
      .set("Authorization", "Bearer super-secure-cron-secret-123");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(sweepSpy).toHaveBeenCalledTimes(1);
  });
});
