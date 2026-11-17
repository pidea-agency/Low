import { Router, type IRouter } from "express";
import { z } from "zod";
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
import { dispatchEventNotification } from "../services/notification-template.service";

const CreateOfficeMemberSchema = z.object({
  username: z.string().trim().min(1, "اسم المستخدم مطلوب."),
  email: z.string().trim().email("صيغة البريد الإلكتروني غير صحيحة."),
  display_name: z.string().optional(),
  displayName: z.string().optional(),
  phone: z.string().nullable().optional(),
  role_title: z.string().nullable().optional(),
  roleTitle: z.string().nullable().optional(),
  legal_specialty: z.string().nullable().optional(),
  legalSpecialty: z.string().nullable().optional(),
  license_number: z.string().nullable().optional(),
  licenseNumber: z.string().nullable().optional(),
  license_expiry_date: z.string().nullable().optional(),
  licenseExpiryDate: z.string().nullable().optional(),
  joined_office_at: z.string().nullable().optional(),
  joinedOfficeAt: z.string().nullable().optional(),
});

const UpdateOfficeMemberSchema = z.object({
  password: z.string().optional(),
  display_name: z.string().optional(),
  displayName: z.string().optional(),
  email: z.string().trim().email("صيغة البريد الإلكتروني غير صحيحة.").optional(),
  status: z.enum(["active", "suspended", "pending_activation"]).optional(),
  phone: z.string().nullable().optional(),
  role_title: z.string().nullable().optional(),
  roleTitle: z.string().nullable().optional(),
  legal_specialty: z.string().nullable().optional(),
  legalSpecialty: z.string().nullable().optional(),
  license_number: z.string().nullable().optional(),
  licenseNumber: z.string().nullable().optional(),
  license_expiry_date: z.string().nullable().optional(),
  licenseExpiryDate: z.string().nullable().optional(),
  joined_office_at: z.string().nullable().optional(),
  joinedOfficeAt: z.string().nullable().optional(),
});

const ToggleMemberStatusSchema = z.object({
  status: z.enum(["active", "suspended"]).optional(),
});

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
    const parseResult = CreateOfficeMemberSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors[0]?.message || "بيانات عضو المكتب غير صالحة.";
      res.status(400).json({ error: errorMsg });
      return;
    }
    const {
      username,
      email,
      display_name,
      displayName,
      phone,
      role_title,
      roleTitle,
      legal_specialty,
      legalSpecialty,
      license_number,
      licenseNumber,
      license_expiry_date,
      licenseExpiryDate,
      joined_office_at,
      joinedOfficeAt,
    } = req.body;

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
      display_name: display_name?.trim() || displayName?.trim() || username.trim(),
      phone: phone?.trim() || null,
      role_title: role_title?.trim() || roleTitle?.trim() || null,
      legal_specialty: legal_specialty?.trim() || legalSpecialty?.trim() || null,
      license_number: license_number?.trim() || licenseNumber?.trim() || null,
      license_expiry_date: license_expiry_date?.trim() || licenseExpiryDate?.trim() || null,
      joined_office_at: joined_office_at?.trim() || joinedOfficeAt?.trim() || null,
    });

    res.status(201).json({
      ...result.member,
      emailSent: result.emailSent,
      emailError: result.emailError,
      deliveryChannel: result.deliveryChannel,
      whatsappSent: result.whatsappSent,
      whatsappError: result.whatsappError,
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

    let message = "تم تجديد رابط التفعيل بنجاح.";
    if (result.deliveryChannel === "whatsapp") {
      message = "تم إرسال رابط التفعيل بنجاح عبر تطبيق واتساب.";
    } else if (result.deliveryChannel === "email") {
      message = "تم إرسال رابط التفعيل الجديد بنجاح إلى البريد الإلكتروني.";
    } else {
      message = `تم تجديد رابط التفعيل ولكن تعذر الإرسال: ${result.emailError || result.whatsappError || "خطأ غير معروف"}`;
    }

    res.json({
      success: true,
      emailSent: result.emailSent,
      emailError: result.emailError,
      deliveryChannel: result.deliveryChannel,
      whatsappSent: result.whatsappSent,
      whatsappError: result.whatsappError,
      message,
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

    const parseResult = UpdateOfficeMemberSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.errors[0]?.message || "بيانات تحديث عضو المكتب غير صالحة.";
      res.status(400).json({ error: errorMsg });
      return;
    }
    const {
      password,
      display_name,
      displayName,
      email,
      status,
      phone,
      role_title,
      roleTitle,
      legal_specialty,
      legalSpecialty,
      license_number,
      licenseNumber,
      license_expiry_date,
      licenseExpiryDate,
      joined_office_at,
      joinedOfficeAt,
    } = req.body;

    if (password !== undefined && typeof password === "string" && password.trim() !== "") {
      const passwordValidation = validatePassword(password, { email });
      if (!passwordValidation.isValid) {
        res.status(400).json({ error: passwordValidation.message, code: passwordValidation.reason });
        return;
      }
    }

    const updated = await updateOfficeMember(adminId, id, {
      password,
      display_name: display_name || displayName,
      email,
      status,
      phone,
      role_title: role_title !== undefined ? role_title : roleTitle,
      legal_specialty: legal_specialty !== undefined ? legal_specialty : legalSpecialty,
      license_number: license_number !== undefined ? license_number : licenseNumber,
      license_expiry_date: license_expiry_date !== undefined ? license_expiry_date : licenseExpiryDate,
      joined_office_at: joined_office_at !== undefined ? joined_office_at : joinedOfficeAt,
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

    const parseResult = ToggleMemberStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: "حالة الحساب غير صالحة." });
      return;
    }
    const { status } = req.body;
    const updated = await toggleOfficeMemberStatus(adminId, id, status);
    if (updated) {
      const officeId = req.authUser!.officeId || adminId;
      const officeName = (req.authUser as any)?.officeName || (req.authUser as any)?.office_name || "مكتب المحاماة";
      const eventType = updated.status === "suspended" ? "member_account_suspended" : "member_account_reactivated";
      dispatchEventNotification({
        officeId,
        eventType,
        recipientUserId: updated.id,
        recipientPhone: updated.phone || null,
        placeholderData: {
          officeName,
          memberName: updated.display_name || updated.username,
        },
        relatedRecordType: "user",
        relatedRecordId: updated.id,
      }).catch((e) => logger.warn({ e }, "Failed to dispatch member status notification"));
    }
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

/**
 * GET /api/users/activity-log
 * Returns real office audit logs and member activity events.
 */
router.get("/users/activity-log", async (req, res) => {
  try {
    const adminId = req.authUser!.userId!;
    const officeId = req.authUser!.officeId || adminId;
    const { listAuditLogs } = await import("../services/supabase.service");
    const auditRes = await listAuditLogs({ office_id: officeId, limit: 30 }).catch(() => ({ logs: [] }));

    const logs = (auditRes.logs || []).map((l: any) => ({
      id: l.id,
      actorName: l.actor_display_name || l.actor_username || "مستخدم المكتب",
      action: l.action,
      details: l.details
        ? typeof l.details === "object"
          ? (l.details.description || l.details.message || JSON.stringify(l.details))
          : String(l.details)
        : l.action,
      createdAt: l.created_at,
    }));

    res.json({ logs });
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch office activity log");
    res.status(500).json({ error: "فشل جلب سجل النشاط.", logs: [] });
  }
});

export default router;
