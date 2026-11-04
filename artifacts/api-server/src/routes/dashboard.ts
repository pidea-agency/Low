import { Router, type IRouter } from "express";
import { GetDashboardStatsResponse } from "@workspace/api-zod";
import { getDashboardStats } from "../services/session.service";
import { isGoogleSheetsConfigured } from "../config/env";
import { logger } from "../lib/logger";
import { attachAuthUser, requireAuth, blockSuperAdminFromOfficeData } from "../middlewares/auth.middleware";

const router: IRouter = Router();

router.get("/dashboard/stats", attachAuthUser, requireAuth, blockSuperAdminFromOfficeData, async (req, res) => {
  try {
    const officeId = req.authUser?.officeId || req.authUser?.userId;
    const isPersonal = req.query.scope === "personal";
    const assignee = isPersonal ? (req.authUser?.displayName || req.authUser?.username) : undefined;
    const stats = await getDashboardStats(officeId, assignee);
    const data = GetDashboardStatsResponse.parse(stats);
    res.json(data);
  } catch (err: any) {
    logger.error({ err }, "Failed to load dashboard stats");
    res.status(500).json({ error: "فشل تحميل إحصائيات لوحة التحكم." });
  }
});

export default router;
