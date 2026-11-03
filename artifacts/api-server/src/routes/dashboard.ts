import { Router, type IRouter } from "express";
import { GetDashboardStatsResponse } from "@workspace/api-zod";
import { getDashboardStats } from "../services/session.service";
import { isGoogleSheetsConfigured } from "../config/env";
import { logger } from "../lib/logger";
import { attachAuthUser, requireAuth, blockSuperAdminFromOfficeData } from "../middlewares/auth.middleware";

const router: IRouter = Router();

router.get("/dashboard/stats", attachAuthUser, requireAuth, blockSuperAdminFromOfficeData, async (req, res) => {
  try {
    const userId = req.authUser?.userId;
    const stats = await getDashboardStats(userId);
    const data = GetDashboardStatsResponse.parse(stats);
    res.json(data);
  } catch (err: any) {
    logger.error({ err }, "Failed to load dashboard stats");
    const isClockError = String(err?.message || "").includes("invalid_grant") || String(err?.stack || "").includes("invalid_grant");
    const errorMsg = isClockError
      ? "فشل الاتصال بـ Google Sheets بسبب عدم تزامن تاريخ وتوقيت الجهاز مع سيرفرات Google (invalid_grant)."
      : "فشل تحميل إحصائيات لوحة التحكم.";
    res.status(500).json({ error: errorMsg });
  }
});

export default router;
