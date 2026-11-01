import { Router, type IRouter } from "express";
import { attachAuthUser, requireAuth, requireAdmin } from "../middlewares/auth.middleware";
import {
  listSupabaseUsers,
  createSupabaseUser,
  deleteSupabaseUser,
  updateSupabaseUser,
  toggleUserStatus,
  resetUserAiUsage,
} from "../services/supabase.service";
import { isSupabaseConfigured } from "../config/env";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Require admin authentication on all user management routes
router.use("/users", attachAuthUser, requireAdmin);

/**
 * GET /api/users
 * Returns list of users and supabase connection status
 */
router.get("/users", async (_req, res) => {
  try {
    const isConfigured = isSupabaseConfigured();
    const users = await listSupabaseUsers();
    res.json({
      isSupabaseConfigured: isConfigured,
      users,
    });
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch users");
    res.status(500).json({
      error: err.message || "فشل جلب المستخدمين.",
      isSupabaseConfigured: isSupabaseConfigured(),
      users: [],
    });
  }
});

/**
 * POST /api/users
 * Creates a new user (Admin only)
 */
router.post("/users", requireAdmin, async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      role,
      display_name,
      status,
      subscription_end_date,
      subscription_notes,
      plan_tier,
      billing_cycle,
      ai_quota_limit,
      google_service_account_json,
      google_spreadsheet_id,
      google_sheet_name,
    } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان." });
      return;
    }

    const newUser = await createSupabaseUser({
      username,
      email,
      password,
      role: role === "admin" ? "admin" : "staff",
      display_name,
      status: status || "active",
      subscription_end_date: subscription_end_date || null,
      subscription_notes: subscription_notes || null,
      plan_tier: plan_tier || (role === "admin" ? "pro" : "plus"),
      billing_cycle: billing_cycle || "annual",
      ai_quota_limit: ai_quota_limit !== undefined ? Number(ai_quota_limit) : undefined,
      google_service_account_json,
      google_spreadsheet_id,
      google_sheet_name,
    });

    res.status(201).json(newUser);
  } catch (err: any) {
    logger.error({ err }, "Failed to create user");
    res.status(400).json({ error: err.message || "فشل إنشاء المستخدم." });
  }
});

/**
 * PATCH /api/users/:id
 * Updates an existing user (Admin only)
 */
router.patch("/users/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const {
      password,
      role,
      display_name,
      email,
      status,
      subscription_end_date,
      subscription_notes,
      plan_tier,
      billing_cycle,
      ai_quota_limit,
      ai_usage_count,
      google_service_account_json,
      google_spreadsheet_id,
      google_sheet_name,
    } = req.body;

    const updatedUser = await updateSupabaseUser(id, {
      password,
      role,
      display_name,
      email,
      status,
      subscription_end_date,
      subscription_notes,
      plan_tier,
      billing_cycle,
      ai_quota_limit: ai_quota_limit !== undefined ? Number(ai_quota_limit) : undefined,
      ai_usage_count: ai_usage_count !== undefined ? Number(ai_usage_count) : undefined,
      google_service_account_json,
      google_spreadsheet_id,
      google_sheet_name,
    });

    res.json(updatedUser);
  } catch (err: any) {
    logger.error({ err, id: req.params.id }, "Failed to update user");
    res.status(400).json({ error: err.message || "فشل تعديل المستخدم." });
  }
});

/**
 * POST /api/users/:id/reset-ai-usage
 * Resets user's AI quota usage counter to 0 (Admin only)
 */
router.post("/users/:id/reset-ai-usage", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const updated = await resetUserAiUsage(id);
    res.json(updated);
  } catch (err: any) {
    logger.error({ err, id: req.params.id }, "Failed to reset AI usage");
    res.status(400).json({ error: err.message || "فشل تصفير استهلاك الذكاء الاصطناعي." });
  }
});

/**
 * POST /api/users/:id/toggle-status
 * Suspends or reactivates a user's subscription (Admin only)
 */
router.post("/users/:id/toggle-status", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body;
    const updated = await toggleUserStatus(id, status);
    res.json(updated);
  } catch (err: any) {
    logger.error({ err, id: req.params.id }, "Failed to toggle user status");
    res.status(400).json({ error: err.message || "فشل تغيير حالة الاشتراك." });
  }
});

/**
 * DELETE /api/users/:id
 * Deletes a user (Admin only)
 */
router.delete("/users/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id);
    if (req.authUser?.userId === id) {
      res.status(400).json({ error: "لا يمكنك حذف الحساب الذي قمت بتسجيل الدخول به حالياً." });
      return;
    }

    await deleteSupabaseUser(id);
    res.status(204).send();
  } catch (err: any) {
    logger.error({ err, id: req.params.id }, "Failed to delete user");
    res.status(400).json({ error: err.message || "فشل حذف المستخدم." });
  }
});

export default router;
