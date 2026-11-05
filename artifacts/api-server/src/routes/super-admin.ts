import { Router, type IRouter } from "express";
import { validatePassword } from "@workspace/api-zod";
import { attachAuthUser, requireSuperAdmin } from "../middlewares/auth.middleware";
import {
  listSupabaseAdmins,
  createSupabaseAdmin,
  updateSupabaseAdmin,
  deleteSupabaseAdmin,
  toggleAdminStatus,
  resetAdminAiUsage,
  listUnlinkedMembers,
  linkMemberToAdmin,
  setupFirstSuperAdmin,
  listSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  getOfficeFeatures,
} from "../services/supabase.service";
import { isSupabaseConfigured } from "../config/env";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * POST /api/super-admin/setup-first
 * Allows seeding the initial super admin account once, only if no super admin exists in the system.
 */
router.post("/super-admin/setup-first", async (req, res) => {
  try {
    const { username, password, email, display_name } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان." });
      return;
    }
    const admin = await setupFirstSuperAdmin({
      username,
      password,
      email,
      display_name,
    });
    res.status(201).json(admin);
  } catch (err: any) {
    logger.error({ err }, "Failed in setupFirstSuperAdmin");
    res.status(400).json({ error: err.message || "فشل إعداد حساب المشرف الأول." });
  }
});

// Protect all following routes with Super Admin middleware
router.use("/super-admin", attachAuthUser, requireSuperAdmin);

/**
 * GET /api/super-admin/plans
 * Returns all subscription plans with office counts.
 */
router.get("/super-admin/plans", async (_req, res) => {
  try {
    const plans = await listSubscriptionPlans();
    res.json({ plans });
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch subscription plans");
    res.status(500).json({ error: err.message || "فشل جلب باقات الاشتراك." });
  }
});

/**
 * POST /api/super-admin/plans
 * Creates a new subscription plan with feature flags and default quota.
 */
router.post("/super-admin/plans", async (req, res) => {
  try {
    const { name, slug, ai_quota_limit, price, features } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "اسم الباقة مطلوب." });
      return;
    }
    if (!slug || typeof slug !== "string" || !slug.trim()) {
      res.status(400).json({ error: "معرف الباقة (Slug) مطلوب." });
      return;
    }

    const plan = await createSubscriptionPlan({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      ai_quota_limit: ai_quota_limit !== undefined ? Number(ai_quota_limit) : 100,
      price: typeof price === "string" ? price.trim() : "",
      features: typeof features === "object" && features !== null ? features : {},
    });

    res.status(201).json(plan);
  } catch (err: any) {
    logger.error({ err }, "Failed to create subscription plan");
    res.status(400).json({ error: err.message || "فشل إنشاء باقة الاشتراك." });
  }
});

/**
 * PATCH /api/super-admin/plans/:id
 * Updates an existing subscription plan.
 */
router.patch("/super-admin/plans/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const { name, slug, ai_quota_limit, price, features } = req.body;

    const plan = await updateSubscriptionPlan(id, {
      name,
      slug,
      ai_quota_limit: ai_quota_limit !== undefined ? Number(ai_quota_limit) : undefined,
      price,
      features,
    });

    res.json(plan);
  } catch (err: any) {
    logger.error({ err, id: req.params.id }, "Failed to update subscription plan");
    res.status(400).json({ error: err.message || "فشل تعديل باقة الاشتراك." });
  }
});

/**
 * DELETE /api/super-admin/plans/:id
 * Deletes a plan only if no office is currently assigned to it.
 */
router.delete("/super-admin/plans/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    await deleteSubscriptionPlan(id);
    res.status(200).json({ success: true, message: "تم حذف باقة الاشتراك بنجاح." });
  } catch (err: any) {
    logger.error({ err, id: req.params.id }, "Failed to delete subscription plan");
    res.status(400).json({ error: err.message || "فشل حذف باقة الاشتراك." });
  }
});

/**
 * GET /api/super-admin/office-features/:officeId
 * Resolves the effective plan, features, and quotas for a given office.
 */
router.get("/super-admin/office-features/:officeId", async (req, res) => {
  try {
    const officeId = String(req.params.officeId);
    const resolved = await getOfficeFeatures(officeId);
    res.json(resolved);
  } catch (err: any) {
    logger.error({ err, officeId: req.params.officeId }, "Failed to resolve office features");
    res.status(500).json({ error: err.message || "فشل جلب ميزات المكتب." });
  }
});

/**
 * GET /api/super-admin/admins
 * Returns all office admins with their subscription details and member counts.
 */
router.get("/super-admin/admins", async (_req, res) => {
  try {
    const admins = await listSupabaseAdmins();
    res.json({
      isSupabaseConfigured: isSupabaseConfigured(),
      admins,
    });
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch office admins");
    res.status(500).json({
      error: err.message || "فشل جلب قائمة المكاتب.",
      admins: [],
    });
  }
});

/**
 * POST /api/super-admin/admins
 * Creates a new Office Admin (Buyer) account with subscription and quota settings.
 */
router.post("/super-admin/admins", async (req, res) => {
  try {
    const {
      username,
      password,
      office_name,
      email,
      display_name,
      phone,
      plan_id,
      plan_tier,
      billing_cycle,
      subscription_end_date,
      subscription_notes,
      ai_quota_limit,
      ai_quota_limit_override,
    } = req.body;

    if (!username || !password || !office_name) {
      res.status(400).json({ error: "اسم المستخدم، كلمة المرور، واسم المكتب جميعها مطلوبة." });
      return;
    }

    const passwordValidation = validatePassword(password, { username, email });
    if (!passwordValidation.isValid) {
      res.status(400).json({ error: passwordValidation.message, code: passwordValidation.reason });
      return;
    }

    const newAdmin = await createSupabaseAdmin({
      username,
      password,
      office_name,
      email,
      display_name,
      phone,
      plan_id,
      plan_tier,
      billing_cycle,
      subscription_end_date,
      subscription_notes,
      ai_quota_limit: ai_quota_limit !== undefined ? Number(ai_quota_limit) : undefined,
      ai_quota_limit_override:
        ai_quota_limit_override !== undefined && ai_quota_limit_override !== null
          ? Number(ai_quota_limit_override)
          : undefined,
    });

    res.status(201).json(newAdmin);
  } catch (err: any) {
    logger.error({ err }, "Failed to create office admin");
    res.status(400).json({ error: err.message || "فشل إنشاء حساب مدير المكتب." });
  }
});

/**
 * PATCH /api/super-admin/admins/:id
 * Updates an office admin's subscription, plan, status, notes or quota.
 */
router.patch("/super-admin/admins/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    const {
      password,
      office_name,
      display_name,
      email,
      phone,
      status,
      plan_id,
      plan_tier,
      billing_cycle,
      subscription_end_date,
      subscription_notes,
      ai_quota_limit,
      ai_quota_limit_override,
      ai_usage_count,
    } = req.body;

    if (password !== undefined && typeof password === "string" && password.trim() !== "") {
      const passwordValidation = validatePassword(password, { email });
      if (!passwordValidation.isValid) {
        res.status(400).json({ error: passwordValidation.message, code: passwordValidation.reason });
        return;
      }
    }

    const updated = await updateSupabaseAdmin(id, {
      password,
      office_name,
      display_name,
      email,
      phone,
      status,
      plan_id,
      plan_tier,
      billing_cycle,
      subscription_end_date,
      subscription_notes,
      ai_quota_limit: ai_quota_limit !== undefined ? Number(ai_quota_limit) : undefined,
      ai_quota_limit_override:
        ai_quota_limit_override !== undefined
          ? ai_quota_limit_override === null
            ? null
            : Number(ai_quota_limit_override)
          : undefined,
      ai_usage_count: ai_usage_count !== undefined ? Number(ai_usage_count) : undefined,
    });

    res.json(updated);
  } catch (err: any) {
    logger.error({ err, id: req.params.id }, "Failed to update office admin");
    res.status(400).json({ error: err.message || "فشل تعديل بيانات المكتب." });
  }
});

/**
 * POST /api/super-admin/admins/:id/extend
 * Fast subscription extension (+1 month or +1 year).
 */
router.post("/super-admin/admins/:id/extend", async (req, res) => {
  try {
    const id = String(req.params.id);
    const { period } = req.body; // '1m' | '1y'

    const admins = await listSupabaseAdmins();
    const admin = admins.find((a) => a.id === id);
    if (!admin) {
      res.status(404).json({ error: "المكتب غير موجود." });
      return;
    }

    // Determine base date (either current expiry if in future, or now)
    const now = new Date();
    let baseDate = now;
    if (admin.subscription_end_date) {
      const existing = new Date(admin.subscription_end_date);
      if (existing > now) {
        baseDate = existing;
      }
    }

    const newDate = new Date(baseDate);
    if (period === "1m") {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }

    const updated = await updateSupabaseAdmin(id, {
      subscription_end_date: newDate.toISOString(),
      status: "active", // Automatically reactivate if suspended
    });

    res.json(updated);
  } catch (err: any) {
    logger.error({ err, id: req.params.id }, "Failed to extend subscription");
    res.status(400).json({ error: err.message || "فشل تمديد الاشتراك." });
  }
});

/**
 * POST /api/super-admin/admins/:id/toggle-status
 * Suspends or reactivates an office admin (and revokes sessions).
 */
router.post("/super-admin/admins/:id/toggle-status", async (req, res) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body;
    const updated = await toggleAdminStatus(id, status);
    res.json(updated);
  } catch (err: any) {
    logger.error({ err, id: req.params.id }, "Failed to toggle office admin status");
    res.status(400).json({ error: err.message || "فشل تغيير حالة المكتب." });
  }
});

/**
 * POST /api/super-admin/admins/:id/reset-ai-usage
 * Resets an office's AI usage counter to 0.
 */
router.post("/super-admin/admins/:id/reset-ai-usage", async (req, res) => {
  try {
    const id = String(req.params.id);
    const updated = await resetAdminAiUsage(id);
    res.json(updated);
  } catch (err: any) {
    logger.error({ err, id: req.params.id }, "Failed to reset office AI usage");
    res.status(400).json({ error: err.message || "فشل تصفير استهلاك الذكاء الاصطناعي للمكتب." });
  }
});

/**
 * DELETE /api/super-admin/admins/:id
 * Deletes an office admin account and handles unlinking linked staff members.
 */
router.delete("/super-admin/admins/:id", async (req, res) => {
  try {
    const id = String(req.params.id);
    await deleteSupabaseAdmin(id);
    res.status(204).send();
  } catch (err: any) {
    logger.error({ err, id: req.params.id }, "Failed to delete office admin");
    res.status(400).json({ error: err.message || "فشل حذف حساب المكتب." });
  }
});

/**
 * GET /api/super-admin/unlinked-members
 * Lists staff members who have no linked office admin.
 */
router.get("/super-admin/unlinked-members", async (_req, res) => {
  try {
    const unlinked = await listUnlinkedMembers();
    res.json({ unlinked });
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch unlinked members");
    res.status(500).json({ error: err.message || "فشل جلب الأعضاء غير المرتبطين." });
  }
});

/**
 * POST /api/super-admin/link-member
 * Links an unlinked staff member to a designated office admin.
 */
router.post("/super-admin/link-member", async (req, res) => {
  try {
    const { memberId, adminId } = req.body;
    if (!memberId || !adminId) {
      res.status(400).json({ error: "معرف العضو ومعرف مدير المكتب مطلوبان." });
      return;
    }
    const linked = await linkMemberToAdmin(memberId, adminId);
    res.json({ success: true, member: linked });
  } catch (err: any) {
    logger.error({ err }, "Failed to link member to admin");
    res.status(400).json({ error: err.message || "فشل ربط العضو بالمكتب." });
  }
});

export default router;

