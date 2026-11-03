import { Router, type IRouter } from "express";
import { validatePassword } from "@workspace/api-zod";
import { attachAuthUser, requireAdmin } from "../middlewares/auth.middleware";
import {
  listOfficeMembers,
  createOfficeMember,
  updateOfficeMember,
  deleteOfficeMember,
  toggleOfficeMemberStatus,
} from "../services/supabase.service";
import { isSupabaseConfigured } from "../config/env";
import { logger } from "../lib/logger";

const router: IRouter = Router();

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
 * Creates a new office member (staff) linked to this Office Admin.
 */
router.post("/users", async (req, res) => {
  try {
    const adminId = req.authUser!.userId!;
    const { username, email, password, display_name, status, phone } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان." });
      return;
    }

    const passwordValidation = validatePassword(password, { username, email });
    if (!passwordValidation.isValid) {
      res.status(400).json({ error: passwordValidation.message, code: passwordValidation.reason });
      return;
    }

    const newMember = await createOfficeMember(adminId, {
      username,
      email,
      password,
      display_name,
      status: status || "active",
      phone: phone?.trim() || null,
    });

    res.status(201).json(newMember);
  } catch (err: any) {
    logger.error({ err }, "Failed to create office member");
    res.status(400).json({ error: err.message || "فشل إنشاء حساب عضو المكتب." });
  }
});

/**
 * PATCH /api/users/:id
 * Updates an existing office member (must belong to this Office Admin).
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
    res.status(400).json({ error: err.message || "فشل تعديل بيانات عضو المكتب." });
  }
});

/**
 * POST /api/users/:id/toggle-status
 * Suspends or reactivates an office member.
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
    res.status(400).json({ error: err.message || "فشل تغيير حالة حساب العضو." });
  }
});

/**
 * DELETE /api/users/:id
 * Deletes an office member belonging to this office.
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
    res.status(400).json({ error: err.message || "فشل حذف عضو المكتب." });
  }
});

export default router;
