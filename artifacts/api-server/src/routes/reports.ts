import { Router, type IRouter } from "express";
import { attachAuthUser, requireAuth, requireActiveSubscription, blockSuperAdminFromOfficeData } from "../middlewares/auth.middleware";
import { getSessionReport, saveSessionReport } from "../services/session.service";
import { isGoogleSheetsConfigured } from "../config/env";
import { GoogleSheetsError } from "../services/googleSheets.service";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/** GET /api/sessions/:id/report — fetch the saved report (null if none) */
router.get("/sessions/:id/report", attachAuthUser, requireAuth, blockSuperAdminFromOfficeData, requireActiveSubscription, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid session id." });
    return;
  }
  try {
    const officeId = req.authUser?.officeId || req.authUser?.userId;
    const report = await getSessionReport(id, officeId);
    if (!report) {
      // Return 200 with null instead of 404 so the frontend can show an empty form
      res.status(200).json(null);
      return;
    }
    res.json(report);
  } catch (err: any) {
    if (err instanceof GoogleSheetsError) {
      logger.error({ err, refId: err.refId, id }, "Google Sheets failure in GET /sessions/:id/report");
      res.status(err.statusCode).json({
        error: `تعذر الاتصال بمصدر البيانات. ${err.userMessage} رقم المرجع: ${err.refId}`,
        refId: err.refId,
      });
      return;
    }
    logger.error({ err }, "Failed to fetch session report");
    res.status(500).json({ error: err?.message || "Failed to fetch session report." });
  }
});

/** PUT /api/sessions/:id/report — create or update the report */
router.put("/sessions/:id/report", attachAuthUser, requireAuth, blockSuperAdminFromOfficeData, requireActiveSubscription, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid session id." });
    return;
  }
  try {
    logger.info({ id, body: req.body }, "Saving session report...");
    const officeId = req.authUser?.officeId || req.authUser?.userId;
    const reportText = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const updated = await saveSessionReport(id, reportText, officeId);
    if (!updated) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    logger.info({ id }, "Session report saved successfully");
    res.json(updated);
  } catch (err: any) {
    if (err instanceof GoogleSheetsError) {
      logger.error({ err, refId: err.refId, id }, "Google Sheets failure in PUT /sessions/:id/report");
      res.status(err.statusCode).json({
        error: `تعذر الاتصال بمصدر البيانات. ${err.userMessage} رقم المرجع: ${err.refId}`,
        refId: err.refId,
      });
      return;
    }
    logger.error({ err }, "Failed to save session report");
    res.status(500).json({ error: err?.message || "Failed to save session report." });
  }
});

export default router;
