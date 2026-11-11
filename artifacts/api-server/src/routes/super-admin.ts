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
  getSuperAdminOverview,
  recordAuditLog,
  listAuditLogs,
  getPlatformSettings,
  updatePlatformSettings,
  createPayment,
  updatePayment,
  listPayments,
  getPaymentById,
  listSuperAdminUsers,
  getSuperAdminReportsOverview,
  getSupabaseClient,
} from "../services/supabase.service";
import { env, isSupabaseConfigured } from "../config/env";
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
 * GET /api/super-admin/overview
 * Returns system-wide aggregates for offices, subscriptions, and AI usage.
 */
router.get("/super-admin/overview", async (_req, res) => {
  try {
    const overview = await getSuperAdminOverview();
    res.json(overview);
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch super admin overview");
    res.status(500).json({ error: err.message || "فشل جلب النظرة العامة." });
  }
});

/**
 * GET /api/super-admin/audit-log
 * Paginated list of audit events, optionally filtered by office_id.
 */
router.get("/super-admin/audit-log", async (req, res) => {
  try {
    const office_id = typeof req.query.office_id === "string" ? req.query.office_id : undefined;
    const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : undefined;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : undefined;

    const result = await listAuditLogs({ office_id, page, limit });
    res.json(result);
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch audit log");
    res.status(500).json({ error: err.message || "فشل جلب سجل الأحداث." });
  }
});

/**
 * GET /api/super-admin/settings
 * Returns global platform configuration.
 */
router.get("/super-admin/settings", async (_req, res) => {
  try {
    const settings = await getPlatformSettings();
    res.json(settings);
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch platform settings");
    res.status(500).json({ error: err.message || "فشل جلب إعدادات المنصة." });
  }
});

/**
 * PATCH /api/super-admin/settings
 * Updates global platform configuration.
 */
router.patch("/super-admin/settings", async (req, res) => {
  try {
    const {
      activation_link_expiry_hours,
      new_office_registration_enabled,
      support_contact_email,
      support_contact_phone,
    } = req.body;

    const updated = await updatePlatformSettings({
      activation_link_expiry_hours:
        activation_link_expiry_hours !== undefined
          ? Math.max(1, Number(activation_link_expiry_hours))
          : undefined,
      new_office_registration_enabled:
        new_office_registration_enabled !== undefined
          ? Boolean(new_office_registration_enabled)
          : undefined,
      support_contact_email:
        support_contact_email !== undefined ? String(support_contact_email).trim() : undefined,
      support_contact_phone:
        support_contact_phone !== undefined ? String(support_contact_phone).trim() : undefined,
    });

    // Record audit log
    await recordAuditLog({
      actor_id: (req as any).user?.id,
      actor_username: (req as any).user?.username,
      action: "updated_platform_settings",
      details: {
        changes: req.body,
      },
    });

    res.json(updated);
  } catch (err: any) {
    logger.error({ err }, "Failed to update platform settings");
    res.status(400).json({ error: err.message || "فشل تحديث إعدادات المنصة." });
  }
});

/**
 * POST /api/super-admin/test-db-connection
 * Tests live connectivity to Supabase database and reports status, latency, and table health.
 */
router.post("/super-admin/test-db-connection", async (_req, res) => {
  const startTime = Date.now();
  const client = getSupabaseClient();

  if (!client) {
    res.status(503).json({
      connected: false,
      configured: false,
      latencyMs: 0,
      error: "قاعدة البيانات غير متصلة حالياً. لم يتم ضبط إعدادات الاتصال بـ Supabase.",
      message: "تعذر الاتصال بقاعدة البيانات.",
    });
    return;
  }

  try {
    const tableName = env.supabaseTableName || "app_users";
    const { count, error } = await client
      .from(tableName)
      .select("id", { count: "exact", head: true })
      .limit(1);

    const latencyMs = Date.now() - startTime;

    if (error) {
      res.status(500).json({
        connected: false,
        configured: true,
        latencyMs,
        error: `فشل الاستعلام من قاعدة البيانات: ${error.message} (رمز الخطأ: ${error.code || "unknown"})`,
        message: "تم الوصول إلى الخادم لكن حدث خطأ أثناء تنفيذ الاستعلام.",
      });
      return;
    }

    const host = env.supabaseUrl ? new URL(env.supabaseUrl).hostname : "Supabase";

    res.json({
      connected: true,
      configured: true,
      latencyMs,
      host,
      tableName,
      userCount: count ?? 0,
      message: `الاتصال بقاعدة البيانات (${host}) نشط وسليم تماماً!`,
    });
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    logger.error({ err }, "Super Admin test-db-connection failed");
    res.status(500).json({
      connected: false,
      configured: true,
      latencyMs,
      error: err?.message || "تعذر إتمام الاتصال بقاعدة البيانات.",
      message: "حدث خطأ غير متوقع أثناء فحص الاتصال.",
    });
  }
});

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

    await recordAuditLog({
      actor_id: (req as any).user?.id,
      actor_username: (req as any).user?.username,
      action: "created_plan",
      details: {
        plan_id: plan.id,
        name: plan.name,
        slug: plan.slug,
      },
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

    await recordAuditLog({
      actor_id: (req as any).user?.id,
      actor_username: (req as any).user?.username,
      action: "updated_plan",
      details: {
        plan_id: id,
        changes: req.body,
      },
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

    await recordAuditLog({
      actor_id: (req as any).user?.id,
      actor_username: (req as any).user?.username,
      action: "deleted_plan",
      details: {
        plan_id: id,
      },
    });

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

    await recordAuditLog({
      actor_id: (req as any).user?.id,
      actor_username: (req as any).user?.username,
      action: "created_office",
      target_office_id: newAdmin.id,
      details: {
        office_name: newAdmin.office_name,
        username: newAdmin.username,
        plan_tier: newAdmin.plan_tier,
        plan_id: newAdmin.plan_id,
      },
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

    await recordAuditLog({
      actor_id: (req as any).user?.id,
      actor_username: (req as any).user?.username,
      action: "updated_office",
      target_office_id: id,
      details: {
        office_name: updated.office_name,
        changes: req.body,
      },
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

    await recordAuditLog({
      actor_id: (req as any).user?.id,
      actor_username: (req as any).user?.username,
      action: "extended_subscription",
      target_office_id: id,
      details: {
        office_name: updated.office_name,
        period,
        subscription_end_date: updated.subscription_end_date,
      },
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

    await recordAuditLog({
      actor_id: (req as any).user?.id,
      actor_username: (req as any).user?.username,
      action: status === "suspended" ? "suspended_office" : "activated_office",
      target_office_id: id,
      details: {
        office_name: updated.office_name,
        new_status: status,
      },
    });

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

    await recordAuditLog({
      actor_id: (req as any).user?.id,
      actor_username: (req as any).user?.username,
      action: "reset_ai_usage",
      target_office_id: id,
      details: {
        office_name: updated.office_name,
      },
    });

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

    await recordAuditLog({
      actor_id: (req as any).user?.id,
      actor_username: (req as any).user?.username,
      action: "deleted_office",
      target_office_id: id,
      details: {
        office_id: id,
      },
    });

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

    await recordAuditLog({
      actor_id: (req as any).user?.id,
      actor_username: (req as any).user?.username,
      action: "linked_member",
      target_office_id: adminId,
      details: {
        member_id: memberId,
        admin_id: adminId,
      },
    });

    res.json({ success: true, member: linked });
  } catch (err: any) {
    logger.error({ err }, "Failed to link member to admin");
    res.status(400).json({ error: err.message || "فشل ربط العضو بالمكتب." });
  }
});

/**
 * GET /api/super-admin/users
 * Lists all users across all offices (office admins, staff/lawyers, super admins) with office association.
 */
router.get("/super-admin/users", async (_req, res) => {
  try {
    const users = await listSuperAdminUsers();
    res.json(users);
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch super admin users");
    res.status(500).json({ error: err.message || "فشل جلب قائمة المستخدمين." });
  }
});

/**
 * GET /api/super-admin/payments
 * Lists manual payment records, optionally filterable by office_id and status.
 */
router.get("/super-admin/payments", async (req, res) => {
  try {
    const office_id = typeof req.query.office_id === "string" ? req.query.office_id.trim() : undefined;
    const status = typeof req.query.status === "string" ? req.query.status.trim() : undefined;
    const payments = await listPayments({ office_id, status });
    res.json(payments);
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch payments");
    res.status(500).json({ error: err.message || "فشل جلب قائمة المدفوعات." });
  }
});

/**
 * POST /api/super-admin/payments
 * Manually records a payment for an office and writes an audit log entry.
 */
router.post("/super-admin/payments", async (req, res) => {
  try {
    const { office_id, amount, currency, payment_date, method, status, notes } = req.body;
    if (!office_id) {
      res.status(400).json({ error: "معرف المكتب مطلوب." });
      return;
    }
    if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) <= 0) {
      res.status(400).json({ error: "المبلغ غير صالح." });
      return;
    }

    const recorded_by = (req as any).user?.id || req.authUser?.userId || null;
    const payment = await createPayment({
      office_id,
      amount: Number(amount),
      currency,
      payment_date,
      method,
      status,
      notes,
      recorded_by,
    });

    await recordAuditLog({
      actor_id: (req as any).user?.id || req.authUser?.userId || "super_admin",
      actor_username: (req as any).user?.username || req.authUser?.username || "مشرف المنصة",
      action: "create_payment",
      target_office_id: office_id,
      details: {
        payment_id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        payment_date: payment.payment_date,
      },
    });

    res.status(201).json(payment);
  } catch (err: any) {
    logger.error({ err }, "Failed to create payment");
    res.status(500).json({ error: err.message || "فشل تسجيل الدفعة." });
  }
});

/**
 * PATCH /api/super-admin/payments/:id
 * Updates payment status and/or notes and records an audit log.
 */
router.patch("/super-admin/payments/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { status, notes, amount, method, payment_date } = req.body;

    const updated = await updatePayment(id, {
      status,
      notes,
      amount: amount !== undefined ? Number(amount) : undefined,
      method,
      payment_date,
    });

    if (!updated) {
      res.status(404).json({ error: "سجل الدفعة غير موجود." });
      return;
    }

    await recordAuditLog({
      actor_id: (req as any).user?.id || req.authUser?.userId || "super_admin",
      actor_username: (req as any).user?.username || req.authUser?.username || "مشرف المنصة",
      action: "update_payment",
      target_office_id: updated.office_id,
      details: {
        payment_id: id,
        new_status: updated.status,
        notes: updated.notes,
        amount: updated.amount,
      },
    });

    res.json(updated);
  } catch (err: any) {
    logger.error({ err }, "Failed to update payment");
    res.status(500).json({ error: err.message || "فشل تحديث الدفعة." });
  }
});

/**
 * GET /api/super-admin/reports/overview
 * Returns general platform reports: total revenue, active subscriptions, total users, total offices,
 * 6-month monthly revenue trend, and subscription distribution by plan.
 */
router.get("/super-admin/reports/overview", async (_req, res) => {
  try {
    const reports = await getSuperAdminReportsOverview();
    res.json(reports);
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch super admin reports overview");
    res.status(500).json({ error: err.message || "فشل جلب ملخص التقارير." });
  }
});

export default router;

