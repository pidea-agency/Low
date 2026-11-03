import { Router, type IRouter } from "express";
import { AnalyzeMessageBody } from "@workspace/api-zod";
import { analyzeCourtMessage, AiExtractionError, InsufficientSessionDataError } from "../services/ai.service";
import { logger } from "../lib/logger";
import { attachAuthUser, requireAuth, requireActiveSubscription, blockSuperAdminFromOfficeData } from "../middlewares/auth.middleware";

const router: IRouter = Router();

/**
 * POST /api/ai/analyze
 * Analyzes a raw court SMS using the Admin's central AI key (with smart rule-based fallback).
 * Requires an active (non-expired, non-suspended) subscription.
 * Strictly isolates and increments the user's AI quota.
 */
router.post(
  "/ai/analyze",
  attachAuthUser,
  requireAuth,
  blockSuperAdminFromOfficeData,
  requireActiveSubscription,
  async (req, res) => {
    const parseResult = AnalyzeMessageBody.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: "يرجى تزويد نص الرسالة للتحليل." });
      return;
    }

    try {
      const userId = req.authUser?.userId;
      const extraction = await analyzeCourtMessage(parseResult.data.message, userId);
      res.json(extraction);
    } catch (err: any) {
      if (err instanceof InsufficientSessionDataError) {
        res.status(422).json({ error: err.message, isInsufficientData: true });
        return;
      }
      if (err instanceof AiExtractionError) {
        res.status(403).json({ error: err.message, isQuotaExceeded: true });
        return;
      }
      logger.error({ err }, "Unexpected error during AI extraction");
      res.status(500).json({ error: err?.message || "فشل تحليل الرسالة بواسطة الذكاء الاصطناعي." });
    }
  },
);

export default router;
