import { Router, type IRouter } from "express";
import crypto from "crypto";
import { env, isGoogleSheetsConfigured } from "../config/env";
import { logger } from "../lib/logger";
import { runReminderSweep } from "../scheduler/reminderScheduler";

const router: IRouter = Router();

/**
 * Constant-time string comparison using SHA-256 and crypto.timingSafeEqual
 * to prevent timing attacks regardless of string length or characters.
 */
function safeCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * GET /api/cron/reminders
 *
 * Vercel Cron Job endpoint — invoked on the schedule defined in vercel.json.
 * Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` with every
 * cron request, so we validate that token before running the sweep.
 *
 * Can also be called manually (e.g. for testing) by passing the same bearer token.
 *
 * Fail-Closed: If CRON_SECRET is not configured or empty, requests are rejected with 500.
 * Requests without valid credentials are rejected with 401.
 */
router.get("/cron/reminders", async (req, res) => {
  // --- Authentication (Fail-Closed) ---
  const secret = env.cronSecret;
  if (!secret || !secret.trim()) {
    logger.error("Cron reminder endpoint: CRON_SECRET is not configured on the server");
    res.status(500).json({ error: "CRON_SECRET is not configured on the server." });
    return;
  }

  const authHeader = req.headers["authorization"] ?? "";
  const provided = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!provided || !safeCompare(provided, secret.trim())) {
    logger.warn({ ip: req.ip }, "Cron reminder endpoint: unauthorized request rejected");
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // --- Guard: sheets not configured yet ---
  if (!isGoogleSheetsConfigured()) {
    res
      .status(503)
      .json({ ok: false, message: "Google Sheets is not configured yet." });
    return;
  }

  // --- Run the sweep ---
  const startedAt = Date.now();
  try {
    const results = await runReminderSweep();
    const durationMs = Date.now() - startedAt;
    logger.info({ durationMs, officesCount: results?.length ?? 0 }, "Cron reminder sweep completed successfully");
    res.json({ ok: true, durationMs, results });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    logger.error({ err, durationMs }, "Cron reminder sweep failed");
    res.status(500).json({ ok: false, error: "Reminder sweep failed." });
  }
});

export default router;
