import { Router, type IRouter } from "express";
import { validatePassword } from "@workspace/api-zod";
import { attachAuthUser, requireAdmin } from "../middlewares/auth.middleware";
import {
  listOfficeMembers,
  createOfficeMember,
  updateOfficeMember,
  deleteOfficeMember,
  toggleOfficeMemberStatus,
  resendOfficeMemberActivation,
  OfficeMemberNotFoundError,
} from "../services/supabase.service";
import { isSupabaseConfigured } from "../config/env";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Per-member resend activation cooldown tracking (60 seconds)
const resendCooldowns = new Map<string, number>();
const RESEND_COOLDOWN_MS = 60_000;

// Strictly require Office Admin authentication on all office member management routes
router.use("/users", attachAuthUser, requireAdmin);

/**
 * GET /api/users
 * Returns list of office members belonging exclusively to this Office Admin.
 * Subscription and Google fields are completely omitted.
 */
router.get("/users", async (req, res) => {
  try {
    const adminId = req.authUser!.userId!;
    const users = await listOfficeMembers(adminId);
    res.json({
      isSupabaseConfigured: isSupabaseConfigured(),
      users,
    });
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch office members");
    res.status(500).json({
      error: err.message || "فشل جلب أعضاء المكتب.",
      isSupabaseConfigured: isSupabaseConfigured(),
      users: [],
    });
  }
});

/**
 * POST /api/users
 * Creates a new office member (staff) linked to this Office Admin in pending_activation state.
 * Email is required to deliver activation. Password is not accepted here.
 */
router.post("/users", async (req, res) => {
  try {
    const adminId = req.authUser!.userId!;
    const { username, email, display_name, phone } = req.body;

    if (!username || !username.trim()) {
      res.status(400).json({ error: "اسم المستخدم مطلوب." });
      return;
    }

    if (!email || !email.trim()) {
      res.status(400).json({ error: "البريد الإلكتروني مطلوب لإرسال رابط تفعيل الحساب." });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      res.status(400).json({ error: "صيغة البريد الإلكتروني غير صحيحة." });
      return;
    }

    const result = await createOfficeMember(adminId, {
      username: username.trim(),
      email: email.trim(),
      display_name: display_name?.trim() || username.trim(),
      phone: phone?.trim() || null,
    });

    res.status(201).json({
      ...result.member,
      emailSent: result.emailSent,
      emailError: result.emailError,
    });
  } catch (err: any) {
    logger.error({ err }, "Failed to create office member");
    res.status(400).json({ error: err.message || "فشل إنشاء حساب عضو المكتب." });
  }
});

/**
 * POST /api/users/:id/resend-activation
 * Generates a new activation token and resends the invite email to a pending member.
 * Only Office Admin can invoke this, strictly for members belonging to their office.
 */
router.post("/users/:id/resend-activation", async (req, res) => {
  try {
    const adminId = req.authUser!.userId!;
    const memberId = String(req.params.id);

    // Rate-limit resend per member
    const now = Date.now();
    const lastSent = resendCooldowns.get(memberId) || 0;
    if (now - lastSent < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - lastSent)) / 1000);
      res.status(429).json({
        error: `يرجى الانتظار ${waitSeconds} ثانية قبل إعادة إرسال رابط التفعيل مرة أخرى.`,
        retryAfterSeconds: waitSeconds,
      });
      return;
    }

    const result = await resendOfficeMemberActivation(adminId, memberId);
    resendCooldowns.set(memberId, now);

    res.json({
      success: true,
      emailSent: result.emailSent,
      emailError: result.emailError,
      message: result.emailSent
        ? "تم إرسال رابط التفعيل الجديد بنجاح إلى البريد الإلكتروني."
        : `تم تجديد رابط التفعيل ولكن تعذر إرسال البريد: ${result.emailError || "خطأ غير معروف"}`,
    });
  } catch (err: any) {
    logger.error({ err, id: req.params.id }, "Failed to resend activation link");
    if (err instanceof OfficeMemberNotFoundError || err?.statusCode === 404 || err?.message?.includes("غير موجود")) {
      res.status(404).json({ error: "عضو المكتب غير موجود." });
      return;
    }
    res.status(400).json({ error: err.message || "فشل إعادة إرسال رابط التفعيل." });
  }
});

/**
 * PATCH /api/users/:id
 * Updates an existing office member (must belong to this Office Admin).
 * Returns 404 if member is not found or belongs to another office.
 */
router.patch("/users/:id", async (req, res) => {
  try {
    const adminId = req.authUser!.userId!;
    const id = String(req.params.id);
    const { password, display_name, email, status, phone } = req.body;

    if (password !== undefined && typeof password === "string" && password.trim() !== "") {
      const passwordValidation = validatePassword(password, { email });
      if (!passwordValidation.isValid) {
        res.status(400).json({ error: passwordValidation.message, code: passwordValidation.reason });
        return;
      }
    }

    const updated = await updateOfficeMember(adminId, id, {
      password,
      display_name,
      email,
      status,
      phone,
    });

    res.json(updated);
  } catch (err: any) {
    logger.error({ err, id: req.params.id }, "Failed to update office member");
    if (err instanceof OfficeMemberNotFoundError || err?.statusCode === 404 || err?.message?.includes("غير موجود")) {
      res.status(404).json({ error: "عضو المكتب غير موجود." });
      return;
    }
    res.status(400).json({ error: err.message || "فشل تعديل بيانات عضو المكتب." });
  }
});

/**
 * POST /api/users/:id/toggle-status
 * Suspends or reactivates an office member.
 * Returns 404 if member is not found or belongs to another office.
 */
router.post("/users/:id/toggle-status", async (req, res) => {
  try {
    const adminId = req.authUser!.userId!;
    const id = String(req.params.id);
    const { status } = req.body;
    const updated = await toggleOfficeMemberStatus(adminId, id, status);
    res.json(updated);
  } catch (err: any) {
    logger.error({ err, id: req.params.id }, "Failed to toggle member status");
    if (err instanceof OfficeMemberNotFoundError || err?.statusCode === 404 || err?.message?.includes("غير موجود")) {
      res.status(404).json({ error: "عضو المكتب غير موجود." });
      return;
    }
    res.status(400).json({ error: err.message || "فشل تغيير حالة حساب العضو." });
  }
});

/**
 * DELETE /api/users/:id
 * Deletes an office member belonging to this office.
 * Returns 404 if member is not found or belongs to another office.
 */
router.delete("/users/:id", async (req, res) => {
  try {
    const adminId = req.authUser!.userId!;
    const id = String(req.params.id);

    if (adminId === id) {
      res.status(400).json({ error: "لا يمكن حذف حساب مدير المكتب من قائمة الأعضاء." });
      return;
    }

    await deleteOfficeMember(adminId, id);
    res.status(204).send();
  } catch (err: any) {
    logger.error({ err, id: req.params.id }, "Failed to delete office member");
    if (err instanceof OfficeMemberNotFoundError || err?.statusCode === 404 || err?.message?.includes("غير موجود")) {
      res.status(404).json({ error: "عضو المكتب غير موجود." });
      return;
    }
    res.status(400).json({ error: err.message || "فشل حذف عضو المكتب." });
  }
});

export default router;
