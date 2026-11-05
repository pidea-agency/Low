/**
 * notifications.ts
 *
 * Scoped in-app notifications API for office lawyers and admins.
 * Supports paginated listing with unread count, single mark-as-read,
 * and mark-all-read.
 */

import { Router, type IRouter } from "express";
import { attachAuthUser, requireAuth, blockSuperAdminFromOfficeData } from "../middlewares/auth.middleware";
import { logger } from "../lib/logger";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/postgres.service";

const router: IRouter = Router();

function getOfficeId(req: any): string {
  const officeId = req.authUser?.officeId || req.authUser?.userId;
  if (!officeId) {
    throw new Error("غير مصرح: معرف المكتب مفقود.");
  }
  return officeId;
}

function getUserId(req: any): string {
  const userId = req.authUser?.userId || req.authUser?.username;
  if (!userId) {
    throw new Error("غير مصرح: معرف المستخدم مفقود.");
  }
  return userId;
}

router.use("/notifications", attachAuthUser, requireAuth, blockSuperAdminFromOfficeData);

/**
 * GET /api/notifications
 * Lists notifications for the authenticated user, paginated, newest first.
 * Returns { notifications, unreadCount, total, page, limit }.
 */
router.get("/notifications", async (req, res) => {
  try {
    const officeId = getOfficeId(req);
    const userId = getUserId(req);

    const page = parseInt(String(req.query.page || "1"), 10) || 1;
    const limit = parseInt(String(req.query.limit || "20"), 10) || 20;

    const result = await listNotifications(officeId, userId, { page, limit });
    res.json({
      notifications: result.notifications,
      unreadCount: result.unreadCount,
      total: result.total,
      page,
      limit,
    });
  } catch (err: any) {
    logger.error({ err, userId: req.authUser?.userId }, "Failed to list notifications");
    res.status(500).json({ error: "فشل تحميل الإشعارات." });
  }
});

/**
 * POST /api/notifications/:id/read
 * Marks a specific notification as read.
 * Scoped strictly to the authenticated user's own id and office.
 */
router.post("/notifications/:id/read", async (req, res) => {
  try {
    const officeId = getOfficeId(req);
    const userId = getUserId(req);
    const notificationId = req.params.id;

    if (!notificationId) {
      res.status(400).json({ error: "معرف الإشعار مطلوب." });
      return;
    }

    const updated = await markNotificationRead(notificationId, officeId, userId);
    if (!updated) {
      res.status(404).json({ error: "الإشعار غير موجود أو لا تملك صلاحية الوصول إليه." });
      return;
    }

    res.json({ ok: true, id: notificationId });
  } catch (err: any) {
    logger.error({ err, id: req.params.id }, "Failed to mark notification as read");
    res.status(500).json({ error: "فشل تحديث حالة الإشعار." });
  }
});

/**
 * POST /api/notifications/read-all
 * Marks all notifications for the authenticated user as read.
 */
router.post("/notifications/read-all", async (req, res) => {
  try {
    const officeId = getOfficeId(req);
    const userId = getUserId(req);

    const count = await markAllNotificationsRead(officeId, userId);
    res.json({ ok: true, count });
  } catch (err: any) {
    logger.error({ err, userId: req.authUser?.userId }, "Failed to mark all notifications as read");
    res.status(500).json({ error: "فشل تحديث حالة الإشعارات." });
  }
});

export default router;
