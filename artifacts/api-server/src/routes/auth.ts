import { Router, type IRouter } from "express";
import { LoginBody } from "@workspace/api-zod";
import { env, isAuthConfigured, isSupabaseConfigured } from "../config/env";
import { logger } from "../lib/logger";
import {
  attachAuthUser,
  clearSessionCookie,
  requireAuth,
  requireAdmin,
  setSessionCookie,
} from "../middlewares/auth.middleware";
import { loginRateLimiter, adminLoginRateLimiter } from "../middlewares/rate-limiter.middleware";
import { verifySupabaseUser, ensureDefaultAdmin, listSupabaseUsers } from "../services/supabase.service";

const router: IRouter = Router();

router.post("/auth/login", loginRateLimiter, attachAuthUser, async (req, res) => {
  try {
    if (!isAuthConfigured()) {
      res.status(500).json({
        error: "Login is not configured yet. Set APP_USERNAME and APP_PASSWORD.",
      });
      return;
    }

    const parseResult = LoginBody.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان." });
      return;
    }

    const { username, password } = parseResult.data;

    // 1. Verify user via single trusted account source (Supabase or local store)
    let verifiedUser: any = null;
    try {
      if (isSupabaseConfigured()) {
        await ensureDefaultAdmin();
      }
      verifiedUser = await verifySupabaseUser(username, password);
    } catch (err) {
      logger.error({ err }, "Account source unavailable during login");
      res.status(503).json({
        error: "تعذر الاتصال بقاعدة البيانات. يرجى المحاولة لاحقاً.",
      });
      return;
    }

    if (!verifiedUser) {
      res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة." });
      return;
    }

    // Check if suspended
    if (verifiedUser.role === "staff") {
      if (verifiedUser.status === "suspended") {
        res.status(403).json({
          error: "تم إيقاف اشتراك هذا الحساب مؤقتاً من قِبل إدارة المنظومة. يرجى التواصل مع المشرف العام لإعادة التفعيل.",
          isSuspended: true,
        });
        return;
      }

      // Check if expired
      if (verifiedUser.subscription_end_date) {
        const expiryTime = new Date(verifiedUser.subscription_end_date).getTime();
        const now = Date.now();
        if (expiryTime < now) {
          res.status(403).json({
            error: "عذراً، انتهت فترة اشتراكك في المنظومة. يرجى التواصل مع المشرف العام لتجديد الاشتراك.",
            isExpired: true,
            subscription_end_date: verifiedUser.subscription_end_date,
          });
          return;
        }
      }
    }

    // Check 3-day reminder
    let subscriptionWarning: string | null = null;
    let daysRemaining: number | null = null;
    if (verifiedUser.subscription_end_date) {
      const diffMs = new Date(verifiedUser.subscription_end_date).getTime() - Date.now();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 3 && daysRemaining >= 0) {
        subscriptionWarning = `تنبيه: ينتهي اشتراكك خلال ${daysRemaining === 0 ? "اليوم" : `${daysRemaining} ${daysRemaining === 1 ? "يوم" : daysRemaining === 2 ? "يومين" : "أيام"}`}. يرجى التواصل مع الإدارة للتجديد.`;
      }
    }

    setSessionCookie(res, {
      username: verifiedUser.username,
      userId: verifiedUser.id,
      role: verifiedUser.role,
      displayName: verifiedUser.display_name || verifiedUser.username,
    });

    res.json({
      username: verifiedUser.username,
      role: verifiedUser.role,
      displayName: verifiedUser.display_name,
      status: verifiedUser.status || "active",
      subscription_end_date: verifiedUser.subscription_end_date,
      subscriptionWarning,
      daysRemaining,
    });
  } catch (error: any) {
    logger.error({ error }, "Unexpected error in /auth/login");
    res.status(500).json({ error: error?.message || "فشل تسجيل الدخول بسبب خطأ في الخادم." });
  }
});

/**
 * Dedicated Admin Portal Login
 * Only users with role === 'admin' are permitted
 */
router.post("/auth/admin-login", adminLoginRateLimiter, attachAuthUser, async (req, res) => {
  const parseResult = LoginBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان." });
    return;
  }

  const { username, password } = parseResult.data;

  logger.info({ username, supabaseConfigured: isSupabaseConfigured() }, "Admin login attempt");

  // Verify admin user via single trusted account source (Supabase or local store)
  let adminUser: any = null;
  try {
    if (isSupabaseConfigured()) {
      await ensureDefaultAdmin();
    }
    adminUser = await verifySupabaseUser(username, password);
  } catch (err) {
    logger.error({ err }, "Account source unavailable during admin login");
    res.status(503).json({
      error: "تعذر الاتصال بقاعدة البيانات. يرجى المحاولة لاحقاً.",
    });
    return;
  }

  if (!adminUser) {
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة." });
    return;
  }

  if (adminUser.role !== "admin") {
    res.status(403).json({
      error: "عذراً، هذا الحساب ليس لديه صلاحيات الإدارة للدخول لبوابة المشرف.",
    });
    return;
  }

  setSessionCookie(res, {
    username: adminUser.username,
    userId: adminUser.id,
    role: adminUser.role,
    displayName: adminUser.display_name || adminUser.username,
  });

  res.json({
    username: adminUser.username,
    role: adminUser.role,
    displayName: adminUser.display_name,
  });
});

router.post("/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(204).send();
});

router.get("/auth/me", attachAuthUser, requireAuth, async (req, res) => {
  try {
    const authUser = req.authUser!;
    let subscription_end_date: string | null = null;
    let subscriptionWarning: string | null = null;
    let daysRemaining: number | null = null;
    let status: "active" | "suspended" = "active";
    let plan_tier: "plus" | "pro" = "plus";
    let billing_cycle: "monthly" | "annual" = "annual";
    let ai_quota_limit: number = 50;
    let ai_usage_count: number = 0;
    let isExpired = false;
    let isSuspended = false;

    try {
      const users = await listSupabaseUsers();
      const user = users.find((u) => u.id === authUser.userId || u.username === authUser.username);
      if (user) {
        status = user.status || "active";
        isSuspended = status === "suspended";
        plan_tier = user.plan_tier || (user.role === "admin" ? "pro" : "plus");
        billing_cycle = user.billing_cycle || "annual";
        ai_quota_limit = user.ai_quota_limit !== undefined
          ? user.ai_quota_limit
          : (user.role === "admin" ? -1 : (plan_tier === "pro" ? 300 : 50));
        ai_usage_count = user.ai_usage_count || 0;
        subscription_end_date = user.subscription_end_date || null;

        if (subscription_end_date) {
          const diffMs = new Date(subscription_end_date).getTime() - Date.now();
          daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          if (daysRemaining < 0) {
            isExpired = true;
          } else if (daysRemaining <= 3) {
            subscriptionWarning = `تنبيه: ينتهي اشتراكك خلال ${daysRemaining === 0 ? "اليوم" : `${daysRemaining} ${daysRemaining === 1 ? "يوم" : daysRemaining === 2 ? "يومين" : "أيام"}`}. يرجى التواصل مع الإدارة للتجديد.`;
          }
        }
      }
    } catch {}

    res.json({
      username: authUser.username,
      role: authUser.role || "staff",
      displayName: authUser.displayName || authUser.username,
      status,
      isSuspended,
      isExpired,
      subscription_end_date,
      subscriptionWarning,
      daysRemaining,
      plan_tier,
      billing_cycle,
      ai_quota_limit,
      ai_usage_count,
      isSupabase: isSupabaseConfigured(),
    });
  } catch (err) {
    logger.error({ err }, "Failed to serialize current user");
    res.status(500).json({ error: "Failed to load current user." });
  }
});

export default router;
export { attachAuthUser, requireAuth, requireAdmin };
