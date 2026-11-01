import type { NextFunction, Request, Response } from "express";
import cookieSignature from "cookie-signature";
import { env } from "../config/env";
import {
  findUserByIdOrUsername,
  getUserSessionVersion,
  AccountSourceUnavailableError,
} from "../services/supabase.service";

export interface SessionCookiePayload {
  username: string;
  userId?: string;
  role?: string;
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
          req.authUser = {
            userId: trustedUser.id,
            username: trustedUser.username,
            role: trustedUser.role, // Live role from server-side store
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

/** Rejects the request with 403 unless the authenticated user has the 'admin' role. */
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
    res.status(403).json({ error: "هذا الإجراء يتطلب صلاحيات المشرف العام (Admin)." });
    return;
  }
  next();
}

/**
 * Rejects requests with 403 if the user's subscription is suspended or expired.
 * Stops access to:
 * - Excel data read/write (sessions, tasks, poa, judgments)
 * - Report generation and saving
 * - AI message extraction
 */
export function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.authUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // Admins always have access
  if (req.authUser.role === "admin") {
    return next();
  }

  try {
    const { loadLocalUsers } = require("../services/supabase.service");
    const users = loadLocalUsers();
    const current = users.find(
      (u: any) => u.id === req.authUser?.userId || u.username === req.authUser?.username,
    );

    if (current) {
      if (current.status === "suspended") {
        res.status(403).json({
          error: "تم إيقاف اشتراك هذا الحساب مؤقتاً من قِبل إدارة المنظومة. تم إيقاف المزامنة مع الإكسل والتقارير والذكاء الاصطناعي.",
          isSuspended: true,
        });
        return;
      }

      if (current.subscription_end_date) {
        const expiry = new Date(current.subscription_end_date).getTime();
        if (expiry < Date.now()) {
          res.status(403).json({
            error: "عذراً، انتهت فترة اشتراكك في المنظومة. تم إيقاف اتصال النظام بالإكسل وتوليد التقارير وتحليل الرسائل بالذكاء الاصطناعي. يرجى التواصل مع المشرف العام لتجديد الاشتراك.",
            isExpired: true,
            subscription_end_date: current.subscription_end_date,
          });
          return;
        }
      }
    }
  } catch (err) {
    // If lookup fails, allow next
  }

  next();
}

