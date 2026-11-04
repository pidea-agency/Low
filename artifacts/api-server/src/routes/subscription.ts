import { Router, type IRouter } from "express";
import { attachAuthUser, requireAdmin } from "../middlewares/auth.middleware";
import {
  getOfficeSubscriptionOverview,
  updateOfficeMemberQuota,
  OfficeMemberNotFoundError,
  QuotaExceededError,
} from "../services/supabase.service";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Strictly require Office Admin role on all subscription endpoints
router.use("/subscription", attachAuthUser, requireAdmin);

/**
 * GET /api/subscription/overview
 * Returns office-wide subscription status, overall AI quota and per-member usage breakdown.
 */
router.get("/subscription/overview", async (req, res) => {
  try {
    const adminId = req.authUser!.userId!;
    const overview = await getOfficeSubscriptionOverview(adminId);
    res.json(overview);
  } catch (err: any) {
    logger.error({ err }, "Failed to fetch office subscription overview");
    res.status(500).json({ error: err.message || "فشل جلب تفاصيل الاشتراك والاستهلاك." });
  }
});

/**
 * PATCH /api/subscription/members/:id/quota
 * Sets or clears an individual staff member's AI quota limit.
 * Rejects if allocation exceeds office headroom (400) or touches a member outside this office (404).
 */
router.patch("/subscription/members/:id/quota", async (req, res) => {
  try {
    const adminId = req.authUser!.userId!;
    const memberId = req.params.id;
    const { ai_quota_limit } = req.body;

    const result = await updateOfficeMemberQuota(adminId, memberId, ai_quota_limit);
    res.json(result);
  } catch (err: any) {
    if (err instanceof OfficeMemberNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof QuotaExceededError) {
      res.status(400).json({
        error: err.message,
        remainingHeadroom: err.remainingHeadroom,
      });
      return;
    }
    logger.error({ err }, "Failed to update member AI quota");
    res.status(400).json({ error: err.message || "فشل تحديث حصة الاستهلاك للمحامي." });
  }
});

export default router;

