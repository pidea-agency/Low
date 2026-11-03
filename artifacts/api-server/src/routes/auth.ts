import { Router, type IRouter } from "express";
import { LoginBody } from "@workspace/api-zod";
import { env, isAuthConfigured, isSupabaseConfigured } from "../config/env";
import { logger } from "../lib/logger";
import {
  attachAuthUser,
  clearSessionCookie,
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
  requireAdminOrAbove,
  blockSuperAdminFromOfficeData,
  setSessionCookie,
} from "../middlewares/auth.middleware";
import { loginRateLimiter, adminLoginRateLimiter } from "../middlewares/rate-limiter.middleware";
import {
  verifySupabaseUser,
  ensureDefaultAdmin,
  listSupabaseUsers,
  findUserByIdOrUsername,
} from "../services/supabase.service";

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

    // 2. Role-based subscription & linkage validation
    let subscriptionWarning: string | null = null;
    let daysRemaining: number | null = null;

    if (verifiedUser.role === "staff") {
      // Must be linked to an office admin
      if (!verifiedUser.admin_id) {
        res.status(403).json({
          error: "حساب المحامي غير مرتبط بأي مكتب حتى الآن. يرجى التواصل مع الإدارة لربط الحساب بمكتبك.",
          isUnlinked: true,
        });
        return;
      }

      // Check linked office admin's subscription
      const officeAdmin = await findUserByIdOrUsername(verifiedUser.admin_id);
      if (!officeAdmin || officeAdmin.role !== "admin") {
        res.status(403).json({
          error: "تعذر العثور على مكتب المحاماة المرتبط بهذا الحساب.",
        });
        return;
      }

      if (officeAdmin.status === "suspended") {
        res.status(403).json({
          error: "تم إيقاف اشتراك المكتب مؤقتاً. يرجى التواصل مع مدير المكتب.",
          isSuspended: true,
        });
        return;
      }

      if (!officeAdmin.subscription_end_date) {
        res.status(403).json({
          error: "اشتراك المكتب غير مفعل. يرجى التواصل مع مدير المكتب.",
        });
        return;
      }

      const expiryTime = new Date(officeAdmin.subscription_end_date).getTime();
      if (expiryTime < Date.now()) {
        res.status(403).json({
          error: "عذراً، انتهت فترة اشتراك المكتب في المنظومة. يرجى التواصل مع مدير المكتب لتجديد الاشتراك.",
          isExpired: true,
        });
        return;
      }
    } else if (verifiedUser.role === "admin") {
      // Office Admin checks own subscription
      if (verifiedUser.status === "suspended") {
        res.status(403).json({
          error: "تم إيقاف اشتراك هذا المكتب مؤقتاً من قِبل إدارة المنظومة. يرجى مراجعة الدعم الفني.",
          isSuspended: true,
        });
        return;
      }

      if (verifiedUser.subscription_end_date) {
        const expiryTime = new Date(verifiedUser.subscription_end_date).getTime();
        const now = Date.now();
        if (expiryTime < now) {
          res.status(403).json({
            error: "عذراً، انتهت فترة اشتراك مكتبكم في المنظومة. يرجى التواصل مع إدارة المنظومة لتجديد الاشتراك.",
            isExpired: true,
            subscription_end_date: verifiedUser.subscription_end_date,
          });
          return;
        }

        const diffMs = expiryTime - now;
        daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        if (daysRemaining <= 3 && daysRemaining >= 0) {
          subscriptionWarning = `تنبيه: ينتهي اشتراك مكتبكم خلال ${daysRemaining === 0 ? "اليوم" : `${daysRemaining} ${daysRemaining === 1 ? "يوم" : daysRemaining === 2 ? "يومين" : "أيام"}`}. يرجى التواصل مع الإدارة للتجديد.`;
        }
      }
    }

    setSessionCookie(res, {
      username: verifiedUser.username,
      userId: verifiedUser.id,
      role: verifiedUser.role,
      displayName: verifiedUser.display_name || verifiedUser.username,
    });

    const effectiveUserId = verifiedUser.id || verifiedUser.username;
    const effectiveOfficeId = verifiedUser.admin_id || effectiveUserId;

    res.json({
      id: effectiveUserId,
      userId: effectiveUserId,
      officeId: effectiveOfficeId,
      username: verifiedUser.username,
      role: verifiedUser.role,
      adminId: verifiedUser.admin_id || null,
      officeName: verifiedUser.office_name || null,
      displayName: verifiedUser.display_name,
      status: verifiedUser.status || "active",
      subscription_end_date: verifiedUser.role === "admin" ? verifiedUser.subscription_end_date : null,
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
 * Allows users with role === 'admin' OR role === 'super_admin'
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

  if (adminUser.role !== "admin" && adminUser.role !== "super_admin") {
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

  const effectiveUserId = adminUser.id || adminUser.username;
  const effectiveOfficeId = adminUser.admin_id || effectiveUserId;

  res.json({
    id: effectiveUserId,
    userId: effectiveUserId,
    officeId: effectiveOfficeId,
    username: adminUser.username,
    role: adminUser.role,
    officeName: adminUser.office_name || null,
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
    let plan_tier: "plus" | "pro" | undefined = undefined;
    let billing_cycle: "monthly" | "annual" | undefined = undefined;
    let ai_quota_limit: number | undefined = undefined;
    let ai_usage_count: number = 0;
    let isExpired = false;
    let isSuspended = false;
    let officeName: string | null = null;
    let adminId: string | null = null;
    let user: any = null;

    try {
      const users = await listSupabaseUsers();
      user = users.find((u) => u.id === authUser.userId || u.username === authUser.username);
      if (user) {
        status = user.status || "active";
        isSuspended = status === "suspended";
        adminId = user.admin_id || null;
        officeName = user.office_name || null;

        if (user.role === "super_admin") {
          plan_tier = "pro";
          ai_quota_limit = -1;
        } else if (user.role === "admin") {
          plan_tier = user.plan_tier || "plus";
          billing_cycle = user.billing_cycle || "annual";
          ai_quota_limit = user.ai_quota_limit !== undefined ? user.ai_quota_limit : (plan_tier === "pro" ? 300 : 100);
          ai_usage_count = user.ai_usage_count || 0;
          subscription_end_date = user.subscription_end_date || null;

          if (subscription_end_date) {
            const diffMs = new Date(subscription_end_date).getTime() - Date.now();
            daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            if (daysRemaining < 0) {
              isExpired = true;
            } else if (daysRemaining <= 3) {
              subscriptionWarning = `تنبيه: ينتهي اشتراك مكتبكم خلال ${daysRemaining === 0 ? "اليوم" : `${daysRemaining} ${daysRemaining === 1 ? "يوم" : daysRemaining === 2 ? "يومين" : "أيام"}`}. يرجى التواصل مع الإدارة للتجديد.`;
            }
          }
        } else if (user.role === "staff") {
          // Resolve office admin to obtain office name and status
          if (user.admin_id) {
            const officeAdmin = users.find((u) => u.id === user.admin_id);
            if (officeAdmin) {
              officeName = officeAdmin.office_name || officeAdmin.display_name || null;
              isSuspended = officeAdmin.status === "suspended";
              if (officeAdmin.subscription_end_date) {
                isExpired = new Date(officeAdmin.subscription_end_date).getTime() < Date.now();
              }
            }
          }
        }
      }
    } catch {}

    const effectiveUserId = authUser.userId || user?.id || authUser.username;
    const effectiveOfficeId = adminId || effectiveUserId;

    res.json({
      id: effectiveUserId,
      userId: effectiveUserId,
      officeId: effectiveOfficeId,
      username: authUser.username,
      role: authUser.role || "staff",
      adminId,
      officeName,
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
export {
  attachAuthUser,
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
  requireAdminOrAbove,
  blockSuperAdminFromOfficeData,
};
