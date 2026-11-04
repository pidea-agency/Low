import type { NextFunction, Request, Response } from "express";
import cookieSignature from "cookie-signature";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import {
  findUserByIdOrUsername,
  getUserSessionVersion,
  AccountSourceUnavailableError,
} from "../services/supabase.service";

export interface SessionCookiePayload {
  username: string;
  userId?: string;
  officeId?: string;
  adminId?: string;
  role?: "super_admin" | "admin" | "staff" | string;
  displayName?: string;
  issuedAt: number;
}

export interface SessionTokenPayload {
  username: string;
  userId?: string;
  sessionVersion?: number;
  issuedAt: number;
}

const SESSION_COOKIE_NAME = "court_session_auth";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function setSessionCookie(
  res: Response,
  userData: string | { username: string; userId?: string; role?: string; displayName?: string },
): void {
  const userId = typeof userData === "string" ? undefined : userData.userId;
  const username = typeof userData === "string" ? userData : userData.username;
  const sessionVersion = userId ? getUserSessionVersion(userId) : 1;

  // Store only minimal, non-role session token in the cookie with current session version
  const payload: SessionTokenPayload = {
    username,
    userId,
    sessionVersion,
    issuedAt: Date.now(),
  };

  res.cookie(SESSION_COOKIE_NAME, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    signed: true,
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  });
}

export function createSignedSessionCookie(userData: {
  username: string;
  userId?: string;
  sessionVersion?: number;
}): string {
  const version = userData.sessionVersion ?? (userData.userId ? getUserSessionVersion(userData.userId) : 1);
  const payload: SessionTokenPayload = {
    username: userData.username,
    userId: userData.userId,
    sessionVersion: version,
    issuedAt: Date.now(),
  };
  const signed = "s:" + cookieSignature.sign(JSON.stringify(payload), env.sessionSecret);
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(signed)}`;
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
}

function readSessionToken(req: Request): SessionTokenPayload | null {
  // 1. Check req.signedCookies (populated by cookieParser middleware when signed: true)
  let raw: any = req.signedCookies?.[SESSION_COOKIE_NAME];

  // If cookieParser marked it as false, it was a tampered signature
  if (raw === false) {
    return null;
  }

  // 2. Fallback to manual parsing from req.headers.cookie if not populated by cookieParser
  if (!raw && req.headers.cookie) {
    const match = req.headers.cookie
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${SESSION_COOKIE_NAME}=`));

    if (match) {
      const cookieValue = decodeURIComponent(match.slice(SESSION_COOKIE_NAME.length + 1));
      // Cookie MUST start with "s:" to indicate a signed cookie
      if (!cookieValue.startsWith("s:")) {
        // Unsigned cookie -> REJECT
        return null;
      }
      const unsigned = cookieSignature.unsign(cookieValue.slice(2), env.sessionSecret);
      if (unsigned === false) {
        // Tampered signature -> REJECT
        return null;
      }
      raw = unsigned;
    }
  }

  if (!raw || typeof raw !== "string") {
    return null;
  }

  if (raw.startsWith("j:")) {
    raw = raw.slice(2);
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (
      typeof parsed.username !== "string" ||
      typeof parsed.issuedAt !== "number"
    ) {
      return null;
    }
    if (Date.now() - parsed.issuedAt > SESSION_MAX_AGE_MS) {
      return null;
    }
    return {
      userId: parsed.userId,
      username: parsed.username,
      sessionVersion: parsed.sessionVersion,
      issuedAt: parsed.issuedAt,
    };
  } catch {
    return null;
  }
}

declare global {
  namespace Express {
    interface Request {
      authUser?: SessionCookiePayload;
    }
  }
}

/**
 * Populates `req.authUser` by verifying the signed session token and checking the
 * current account state from the trusted server-side source.
 * Fails with 503 if the account source is unreachable.
 */
export async function attachAuthUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = readSessionToken(req);
    if (token) {
      const identifier = token.userId || token.username;
      // Look up identity, role and account status from trusted server store on EACH request
      const trustedUser = await findUserByIdOrUsername(identifier);
      if (trustedUser) {
        // Verify session version (invalidated after password change or revocation)
        const currentVersion = getUserSessionVersion(trustedUser.id);
        const tokenVersion = token.sessionVersion ?? 1;

        if (tokenVersion === currentVersion) {
          const derivedOfficeId =
            trustedUser.role === "admin"
              ? (trustedUser.office_id || trustedUser.id)
              : trustedUser.role === "staff"
              ? (trustedUser.office_id || trustedUser.admin_id || undefined)
              : undefined;

          req.authUser = {
            userId: trustedUser.id,
            username: trustedUser.username,
            role: trustedUser.role, // Live role from server-side store
            officeId: derivedOfficeId,
            adminId: trustedUser.admin_id || undefined,
            displayName: trustedUser.display_name || trustedUser.username,
            issuedAt: token.issuedAt,
          };
        }
      }
    }
    next();
  } catch (err: any) {
    if (err instanceof AccountSourceUnavailableError || err.name === "AccountSourceUnavailableError") {
      res.status(503).json({
        error: "تعذر الاتصال بقاعدة البيانات. يرجى المحاولة لاحقاً.",
      });
      return;
    }
    res.status(503).json({
      error: "تعذر الاتصال بقاعدة البيانات. يرجى المحاولة لاحقاً.",
    });
  }
}

/** Rejects the request with 401 unless a valid session cookie is present. */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.authUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

/** Rejects the request with 403 unless the authenticated user has the 'super_admin' role. */
export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.authUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (req.authUser.role !== "super_admin") {
    res.status(403).json({ error: "هذا الإجراء يتطلب صلاحيات مدير النظام (Super Admin)." });
    return;
  }
  next();
}

/** Rejects the request with 403 unless the authenticated user has the 'admin' (Office Admin) role. */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.authUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (req.authUser.role !== "admin") {
    res.status(403).json({ error: "هذا الإجراء يتطلب صلاحيات مدير المكتب (Admin)." });
    return;
  }
  next();
}

/** Allows both 'super_admin' and 'admin'. */
export function requireAdminOrAbove(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.authUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (req.authUser.role !== "super_admin" && req.authUser.role !== "admin") {
    res.status(403).json({ error: "هذا الإجراء يتطلب صلاحيات إدارية." });
    return;
  }
  next();
}

/**
 * Blocks super_admin from accessing office-specific legal records (sessions, poa, judgments, tasks, reports, ai).
 * Super Admins only manage office accounts and subscriptions, maintaining complete privacy of office records.
 */
export function blockSuperAdminFromOfficeData(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.authUser?.role === "super_admin") {
    res.status(403).json({
      error: "غير مصرح لمشرف المنصة بالوصول إلى بيانات وقضايا المكاتب الخاصة.",
    });
    return;
  }
  next();
}

/**
 * Ensures request has an authenticated office context (admin or staff)
 * and that req.authUser.officeId is present and non-empty.
 */
export function requireOfficeContext(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.authUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (req.authUser.role === "super_admin") {
    res.status(403).json({ error: "غير مصرح لمشرف المنصة بالوصول إلى بيانات وقضايا المكاتب الخاصة." });
    return;
  }
  if (!req.authUser.officeId) {
    res.status(403).json({ error: "حساب المستخدم غير مرتبط بأي مكتب محاماة معتمد." });
    return;
  }
  next();
}

/**
 * Rejects requests with 403 if the office's subscription is suspended, expired, or invalid.
 * Rejects requests with 503 if the subscription state cannot be verified (e.g. database error).
 * Fails closed: ONLY verified active subscriptions call next().
 * - Super Admin is exempt.
 * - Office Admin is evaluated against their own subscription.
 * - Staff is evaluated against their linked Office Admin (admin_id).
 */
export async function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.authUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Super admins are always exempt from subscription blocks
  if (req.authUser.role === "super_admin") {
    next();
    return;
  }

  const identifier = req.authUser.userId || req.authUser.username;
  const refId = `REF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  try {
    // Check real account state from trusted server source
    const current = await findUserByIdOrUsername(identifier);

    if (!current) {
      logger.warn({ refId, identifier }, "Subscription check failed: user not found in account source");
      res.status(403).json({
        error: "حساب المستخدم غير مسجل في مصدر الحسابات المعتمد.",
        refId,
      });
      return;
    }

    if (current.role === "super_admin") {
      next();
      return;
    }

    // Determine target admin whose subscription governs this request
    let officeAdmin: import("../services/supabase.service").AppUser | null = null;

    if (current.role === "admin") {
      officeAdmin = current;
    } else {
      // Role is staff -> must be linked to an office admin
      if (!current.admin_id) {
        logger.warn({ refId, identifier }, "Subscription check failed: staff user has no admin_id linked");
        res.status(403).json({
          error: "حساب المحامي غير مرتبط بأي مكتب حتى الآن. يرجى التواصل مع الإدارة لربط الحساب.",
          refId,
        });
        return;
      }

      officeAdmin = await findUserByIdOrUsername(current.admin_id);
      if (!officeAdmin || officeAdmin.role !== "admin") {
        logger.warn({ refId, identifier, adminId: current.admin_id }, "Subscription check failed: linked office admin not found");
        res.status(403).json({
          error: "تعذر العثور على مكتب المحاماة المرتبط بهذا الحساب.",
          refId,
        });
        return;
      }
    }

    // Check office suspension
    if (officeAdmin.status === "suspended") {
      const msg = current.role === "staff"
        ? "تم إيقاف اشتراك المكتب مؤقتاً من قِبل إدارة المنظومة. يرجى التواصل مع مدير المكتب."
        : "تم إيقاف اشتراك هذا المكتب مؤقتاً من قِبل إدارة المنظومة. تم إيقاف المزامنة والخدمات.";
      res.status(403).json({
        error: msg,
        isSuspended: true,
        refId,
      });
      return;
    }

    // Check office subscription date
    if (!officeAdmin.subscription_end_date) {
      logger.warn({ refId, identifier, officeAdmin: officeAdmin.username }, "Subscription check failed: missing subscription_end_date on office admin");
      const msg = current.role === "staff"
        ? "اشتراك المكتب غير مفعل. يرجى التواصل مع مدير المكتب."
        : "لم يتم تحديد تاريخ انتهاء الاشتراك لهذا المكتب. يرجى مراجعة إدارة المنظومة.";
      res.status(403).json({
        error: msg,
        refId,
      });
      return;
    }

    const expiryTime = new Date(officeAdmin.subscription_end_date).getTime();
    if (isNaN(expiryTime)) {
      logger.warn({ refId, identifier, invalidDate: officeAdmin.subscription_end_date }, "Subscription check failed: invalid subscription_end_date");
      res.status(403).json({
        error: "تاريخ انتهاء اشتراك المكتب المسجل غير صالح. يرجى مراجعة إدارة المنظومة.",
        refId,
      });
      return;
    }

    if (expiryTime < Date.now()) {
      const msg = current.role === "staff"
        ? "عذراً، انتهت فترة اشتراك المكتب في المنظومة. يرجى التواصل مع مدير المكتب لتجديد الاشتراك."
        : "عذراً، انتهت فترة اشتراك مكتبكم في المنظومة. تم إيقاف اتصال النظام بالإكسل وتوليد التقارير وتحليل الرسائل بالذكاء الاصطناعي. يرجى التواصل مع إدارة المنظومة لتجديد الاشتراك.";
      res.status(403).json({
        error: msg,
        isExpired: true,
        subscription_end_date: current.role === "admin" ? officeAdmin.subscription_end_date : undefined,
        refId,
      });
      return;
    }

    // Only reached when subscription is verified active
    next();
  } catch (err: any) {
    logger.error({ err, refId, identifier }, "Subscription verification failed due to account source error");
    res.status(503).json({
      error: "تعذر التحقق من حالة الاشتراك بسبب عدم توفر قاعدة البيانات. يرجى المحاولة لاحقاً.",
      refId,
    });
  }
}
