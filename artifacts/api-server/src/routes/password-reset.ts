import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import {
  requestPasswordReset,
  verifyPasswordResetCode,
  completePasswordReset,
} from "../services/password-reset.service";

const router: IRouter = Router();

function getClientIp(req: any): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || "127.0.0.1";
}

/**
 * STEP 1: POST /auth/password-reset/request
 * Initiates WhatsApp OTP password reset request.
 * Enforces username enumeration protection: returns identical 200 message in all cases.
 */
router.post("/auth/password-reset/request", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const ip = getClientIp(req);

    const result = await requestPasswordReset(username, ip);
    res.json({
      success: true,
      message: result.message,
    });
  } catch (err: any) {
    logger.error({ err }, "Error in /auth/password-reset/request");
    // Even on error, preserve generic response to prevent information leakage
    res.json({
      success: true,
      message: "إذا كان الحساب موجوداً، سيتم إرسال رمز إلى الرقم المسجل.",
    });
  }
});

/**
 * STEP 2: POST /auth/password-reset/verify
 * Verifies 6-digit WhatsApp OTP code and issues a short-lived scoped reset session token.
 */
router.post("/auth/password-reset/verify", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const code = String(req.body?.code || "").trim();
    const ip = getClientIp(req);

    const result = await verifyPasswordResetCode(username, code, ip);
    if (!result.success) {
      res.status(result.statusCode).json({ error: result.error });
      return;
    }

    res.json(result);
  } catch (err: any) {
    logger.error({ err }, "Error in /auth/password-reset/verify");
    res.status(400).json({ error: "رمز غير صحيح" });
  }
});

/**
 * STEP 3: POST /auth/password-reset/complete
 * Validates resetToken, validates password policy, saves new bcrypt hash,
 * invalidates reset token & OTP, revokes all user sessions, and writes audit log.
 */
router.post("/auth/password-reset/complete", async (req, res) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body || {};

    const result = await completePasswordReset({
      resetToken,
      newPassword,
      confirmPassword,
    });

    if (!result.success) {
      res.status(result.statusCode).json({ error: result.error });
      return;
    }

    res.json(result);
  } catch (err: any) {
    logger.error({ err }, "Error in /auth/password-reset/complete");
    res.status(400).json({ error: err?.message || "فشل تعيين كلمة المرور الجديدة." });
  }
});

export default router;
