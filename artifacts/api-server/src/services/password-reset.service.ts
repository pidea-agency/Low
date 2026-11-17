import crypto from "crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { validatePassword } from "@workspace/api-zod";
import {
  findUserByIdOrUsername,
  updateSupabaseUser,
  revokeUserSessions,
  recordAuditLog,
} from "./supabase.service";
import { WhatsappReminderChannel } from "./reminder/channels/whatsappChannel";

// ============================================================================
// Types
// ============================================================================

export interface PendingResetRecord {
  userId: string;
  username: string;
  codeHash: string;
  expiresAt: number; // ms
  attempts: number;
  createdAt: number;
  testRawCode?: string; // only populated in test environment
}

export interface ResetTokenPayload {
  userId: string;
  username: string;
  purpose: "password_reset";
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}

// In-memory active reset records, keyed by lowercase username
const pendingResets = new Map<string, PendingResetRecord>();

// Consumed reset token nonces (prevent replay attacks)
const consumedNonces = new Set<string>();

// Rate limit trackers: timestamps of requests
const ipRequestTimestamps = new Map<string, number[]>();
const userRequestTimestamps = new Map<string, number[]>();
const ipVerifyTimestamps = new Map<string, number[]>();

const ONE_HOUR_MS = 60 * 60 * 1000;
const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESET_TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_VERIFY_ATTEMPTS = 5;

// ============================================================================
// Rate Limiting Helpers
// ============================================================================

function cleanOldTimestamps(timestamps: number[], windowMs: number): number[] {
  const cutoff = Date.now() - windowMs;
  return timestamps.filter((t) => t > cutoff);
}

export function checkAndRecordRequestRateLimit(
  username: string,
  ip: string
): { allowed: boolean; reason?: "ip" | "user" } {
  const cleanUser = username.trim().toLowerCase();
  const cleanIp = ip.trim();

  // IP rate limit: max 10 per hour
  const ipHistory = cleanOldTimestamps(ipRequestTimestamps.get(cleanIp) || [], ONE_HOUR_MS);
  if (ipHistory.length >= 10) {
    ipRequestTimestamps.set(cleanIp, ipHistory);
    return { allowed: false, reason: "ip" };
  }

  // Username rate limit: max 3 per hour
  const userHistory = cleanOldTimestamps(userRequestTimestamps.get(cleanUser) || [], ONE_HOUR_MS);
  if (userHistory.length >= 3) {
    userRequestTimestamps.set(cleanUser, userHistory);
    return { allowed: false, reason: "user" };
  }

  // Record attempt
  ipHistory.push(Date.now());
  ipRequestTimestamps.set(cleanIp, ipHistory);

  userHistory.push(Date.now());
  userRequestTimestamps.set(cleanUser, userHistory);

  return { allowed: true };
}

export function checkAndRecordVerifyRateLimit(
  ip: string
): { allowed: boolean } {
  const cleanIp = ip.trim();
  const ipHistory = cleanOldTimestamps(ipVerifyTimestamps.get(cleanIp) || [], ONE_HOUR_MS);
  if (ipHistory.length >= 10) {
    ipVerifyTimestamps.set(cleanIp, ipHistory);
    return { allowed: false };
  }
  ipHistory.push(Date.now());
  ipVerifyTimestamps.set(cleanIp, ipHistory);
  return { allowed: true };
}

export function resetAllRateLimitsForTesting(): void {
  ipRequestTimestamps.clear();
  userRequestTimestamps.clear();
  ipVerifyTimestamps.clear();
  pendingResets.clear();
  consumedNonces.clear();
}

// ============================================================================
// Signed Reset Token Helpers (HMAC-SHA256)
// ============================================================================

export function signResetToken(data: { userId: string; username: string }): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload: ResetTokenPayload = {
    userId: data.userId,
    username: data.username,
    purpose: "password_reset",
    nonce,
    issuedAt: Date.now(),
    expiresAt: Date.now() + RESET_TOKEN_EXPIRY_MS,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", env.sessionSecret)
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

export function verifyResetToken(token: string): ResetTokenPayload | null {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac("sha256", env.sessionSecret)
    .update(payloadB64)
    .digest("base64url");

  // Constant-time signature comparison
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload = JSON.parse(payloadJson) as ResetTokenPayload;

    if (payload.purpose !== "password_reset") return null;
    if (!payload.userId || !payload.username || !payload.nonce) return null;
    if (Date.now() > payload.expiresAt) return null;
    if (consumedNonces.has(payload.nonce)) return null;

    return payload;
  } catch {
    return null;
  }
}

export function consumeResetTokenNonce(nonce: string): void {
  consumedNonces.add(nonce);
}

// ============================================================================
// Step 1: Request Password Reset
// ============================================================================

export const GENERIC_REQUEST_SUCCESS_MESSAGE =
  "إذا كان الحساب موجوداً، سيتم إرسال رمز إلى الرقم المسجل.";

export async function requestPasswordReset(
  username: string,
  ip: string,
  options?: { targetMinDelayMs?: number }
): Promise<{ success: true; message: string; testOtp?: string }> {
  const startTime = Date.now();
  const cleanUsername = (username || "").trim();

  // Rate limiting check
  const rateLimit = checkAndRecordRequestRateLimit(cleanUsername, ip);

  let targetUser: any = null;
  if (cleanUsername) {
    try {
      targetUser = await findUserByIdOrUsername(cleanUsername);
    } catch (err) {
      logger.error({ err, username: cleanUsername }, "Error finding user for password reset");
    }
  }

  let generatedOtp: string | undefined;

  // Only proceed with sending if user exists, has phone, and rate limit is not exceeded
  if (rateLimit.allowed && targetUser && targetUser.phone) {
    // Generate 6-digit code
    const rawCode = crypto.randomInt(100000, 999999).toString();
    const codeHash = crypto.createHash("sha256").update(rawCode).digest("hex");

    const record: PendingResetRecord = {
      userId: targetUser.id,
      username: targetUser.username,
      codeHash,
      expiresAt: Date.now() + CODE_EXPIRY_MS,
      attempts: 0,
      createdAt: Date.now(),
      testRawCode: process.env.NODE_ENV === "test" ? rawCode : undefined,
    };

    pendingResets.set(targetUser.username.toLowerCase(), record);
    generatedOtp = rawCode;

    // Send via WhatsApp channel
    const message = `رمز التحقق الخاص بإعادة تعيين كلمة المرور في منصة ميزان للمحاماة هو: ${rawCode}\nصلاحية الرمز 10 دقائق. لا تشارك هذا الرمز مع أي شخص حفاظاً على أمان ملفاتك.`;

    try {
      const channel = new WhatsappReminderChannel();
      const sendResult = await channel.sendRaw(message, targetUser.phone, {
        throwIfNotConfigured: false,
      });

      if (!sendResult.success) {
        logger.error(
          {
            userId: targetUser.id,
            username: targetUser.username,
            phone: targetUser.phone,
            error: sendResult.error,
          },
          "Failed to send password reset OTP via WhatsApp"
        );
      } else {
        logger.info(
          { userId: targetUser.id, username: targetUser.username },
          "Password reset WhatsApp OTP sent successfully"
        );
      }
    } catch (sendErr: any) {
      logger.error(
        { err: sendErr, userId: targetUser.id, username: targetUser.username },
        "Exception while sending password reset OTP via WhatsApp"
      );
    }
  } else if (!rateLimit.allowed) {
    logger.warn(
      { username: cleanUsername, ip, reason: rateLimit.reason },
      "Password reset request rate-limit exceeded; silently dropping send"
    );
  }

  // Equalize timing characteristics to protect against username enumeration timing attacks
  const targetMinDelay = options?.targetMinDelayMs ?? 200;
  const elapsed = Date.now() - startTime;
  if (elapsed < targetMinDelay) {
    await new Promise((resolve) => setTimeout(resolve, targetMinDelay - elapsed));
  }

  return {
    success: true,
    message: GENERIC_REQUEST_SUCCESS_MESSAGE,
    testOtp: process.env.NODE_ENV === "test" ? generatedOtp : undefined,
  };
}

// ============================================================================
// Step 2: Verify Password Reset Code
// ============================================================================

export async function verifyPasswordResetCode(
  username: string,
  code: string,
  ip: string
): Promise<
  | { success: true; resetToken: string }
  | { success: false; error: string; statusCode: number }
> {
  const cleanIp = ip.trim();
  const rateLimit = checkAndRecordVerifyRateLimit(cleanIp);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: "تم تجاوز عدد المحاولات المسموح به. يرجى المحاولة لاحقاً.",
      statusCode: 429,
    };
  }

  const cleanUser = (username || "").trim().toLowerCase();
  const cleanCode = (code || "").trim();

  if (!cleanUser || !cleanCode) {
    return {
      success: false,
      error: "رمز غير صحيح",
      statusCode: 400,
    };
  }

  const record = pendingResets.get(cleanUser);
  if (!record) {
    return {
      success: false,
      error: "رمز غير صحيح",
      statusCode: 400,
    };
  }

  // Check expiration
  if (Date.now() > record.expiresAt) {
    pendingResets.delete(cleanUser);
    return {
      success: false,
      error: "رمز غير صحيح",
      statusCode: 400,
    };
  }

  // Check attempt limit
  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    pendingResets.delete(cleanUser);
    return {
      success: false,
      error: "تم تجاوز الحد الأقصى للمحاولات. يرجى طلب رمز جديد.",
      statusCode: 400,
    };
  }

  // Hash input code with sha256
  const inputHash = crypto.createHash("sha256").update(cleanCode).digest("hex");

  // Constant-time comparison
  const expectedBuf = Buffer.from(record.codeHash, "hex");
  const actualBuf = Buffer.from(inputHash, "hex");
  const isMatch =
    expectedBuf.length === actualBuf.length &&
    crypto.timingSafeEqual(expectedBuf, actualBuf);

  if (!isMatch) {
    record.attempts += 1;
    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      pendingResets.delete(cleanUser);
      return {
        success: false,
        error: "تم تجاوز الحد الأقصى للمحاولات. يرجى طلب رمز جديد.",
        statusCode: 400,
      };
    }
    return {
      success: false,
      error: "رمز غير صحيح",
      statusCode: 400,
    };
  }

  // On correct code: invalidate pending code (single use)
  pendingResets.delete(cleanUser);

  // Issue short-lived signed reset token
  const resetToken = signResetToken({
    userId: record.userId,
    username: record.username,
  });

  return {
    success: true,
    resetToken,
  };
}

// ============================================================================
// Step 3: Complete Password Reset
// ============================================================================

export async function completePasswordReset(input: {
  resetToken: string;
  newPassword?: string;
  confirmPassword?: string;
}): Promise<
  | { success: true; message: string; username: string }
  | { success: false; error: string; statusCode: number }
> {
  const { resetToken, newPassword, confirmPassword } = input;

  if (!resetToken || typeof resetToken !== "string") {
    return {
      success: false,
      error: "رمز إعادة التعيين مطلوب.",
      statusCode: 400,
    };
  }

  const tokenPayload = verifyResetToken(resetToken);
  if (!tokenPayload) {
    return {
      success: false,
      error: "رمز إعادة التعيين غير صالح أو منتهي الصلاحية.",
      statusCode: 400,
    };
  }

  if (!newPassword || typeof newPassword !== "string") {
    return {
      success: false,
      error: "كلمة المرور الجديدة مطلوبة.",
      statusCode: 400,
    };
  }

  if (!confirmPassword || typeof confirmPassword !== "string") {
    return {
      success: false,
      error: "تأكيد كلمة المرور مطلوب.",
      statusCode: 400,
    };
  }

  if (newPassword !== confirmPassword) {
    return {
      success: false,
      error: "كلمة المرور وتأكيدها غير متطابقين.",
      statusCode: 400,
    };
  }

  // Fetch trusted user
  const user = await findUserByIdOrUsername(tokenPayload.userId);
  if (!user || user.username.toLowerCase() !== tokenPayload.username.toLowerCase()) {
    return {
      success: false,
      error: "المستخدم غير موجود أو غير متطابق مع جلسة إعادة التعيين.",
      statusCode: 400,
    };
  }

  // Enforce password policy
  const passwordValidation = validatePassword(newPassword, {
    username: user.username,
    email: user.email || undefined,
  });

  if (!passwordValidation.isValid) {
    return {
      success: false,
      error: passwordValidation.message || "كلمة المرور لا تستوفي شروط الأمان.",
      statusCode: 400,
    };
  }

  // Hash new password using bcrypt pattern (10 rounds)
  const password_hash = await bcrypt.hash(newPassword.trim(), 10);

  // Update password in database
  await updateSupabaseUser(user.id, {
    password_hash,
  });

  // Consume reset token nonce (single use)
  consumeResetTokenNonce(tokenPayload.nonce);

  // Clear any leftover pending reset records for this user
  pendingResets.delete(user.username.toLowerCase());

  // Revoke all existing sessions for this user across all devices
  revokeUserSessions(user.id);

  // Record audit log
  try {
    await recordAuditLog({
      actor_id: user.id,
      actor_username: user.username,
      action: "password_reset_via_whatsapp",
      target_office_id: user.office_id || user.admin_id || user.id,
      details: {
        method: "whatsapp_otp",
        target_user_id: user.id,
        target_username: user.username,
      },
    });
  } catch (auditErr) {
    logger.warn({ err: auditErr }, "Failed to write audit log for password reset");
  }

  logger.info(
    { userId: user.id, username: user.username },
    "Password reset completed successfully via WhatsApp OTP"
  );

  return {
    success: true,
    message: "تم تحديث كلمة المرور بنجاح. يرجى تسجيل الدخول بكلمة المرور الجديدة.",
    username: user.username,
  };
}

// Test inspection helper
export function getPendingResetForTesting(username: string): PendingResetRecord | undefined {
  return pendingResets.get(username.trim().toLowerCase());
}
