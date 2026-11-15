import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  attachAuthUser,
  requireAuth,
  requireAdmin,
  requireActiveSubscription,
  blockSuperAdminFromOfficeData,
} from "../middlewares/auth.middleware";
import { getSessionReport, saveSessionReport } from "../services/session.service";
import { isGoogleSheetsConfigured } from "../config/env";
import { GoogleSheetsError } from "../services/googleSheets.service";
import { logger } from "../lib/logger";
import * as postgresService from "../services/postgres.service";
import { listOfficeMembers } from "../services/supabase.service";

const UpdateSessionReportSchema = z.union([
  z.string(),
  z.record(z.any()),
]);

const MonthlyReportQuerySchema = z.object({
  month: z.string().optional(),
  year: z.string().optional(),
});

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
    const refId = `rep_get_${Date.now()}`;
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل جلب تقرير الجلسة");
  }
});

/** PUT /api/sessions/:id/report — create or update the report */
router.put("/sessions/:id/report", attachAuthUser, requireAuth, blockSuperAdminFromOfficeData, requireActiveSubscription, async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid session id." });
    return;
  }
  const parseResult = UpdateSessionReportSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "بيانات التقرير غير صالحة." });
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
    const refId = `rep_put_${Date.now()}`;
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل حفظ تقرير الجلسة");
  }
});

/**
 * GET /api/reports/monthly?month=&year=
 * Admin-only, office-scoped: returns counts (sessions held, judgments closed, tasks completed)
 * overall and per assigned lawyer.
 */
router.get("/reports/monthly", attachAuthUser, requireAdmin, blockSuperAdminFromOfficeData, requireActiveSubscription, async (req, res) => {
  const queryResult = MonthlyReportQuerySchema.safeParse(req.query);
  if (!queryResult.success) {
    res.status(400).json({ error: "معايير تصفية التقرير غير صالحة." });
    return;
  }
  const officeId = req.authUser?.officeId || req.authUser?.userId;
  if (!officeId) {
    res.status(401).json({ error: "غير مصرح: معرف المكتب مفقود." });
    return;
  }
  const adminId = req.authUser!.userId!;

  const now = new Date();
  const month = parseInt(String(req.query.month || now.getMonth() + 1), 10);
  const year = parseInt(String(req.query.year || now.getFullYear()), 10);

  if (isNaN(month) || month < 1 || month > 12 || isNaN(year) || year < 1900 || year > 2200) {
    res.status(400).json({ error: "الشهر والسنة غير صالحين." });
    return;
  }

  try {
    const [officeMembers, allSessions, allJudgments, allTasks] = await Promise.all([
      listOfficeMembers(adminId).catch(() => []),
      postgresService.listSessions(officeId),
      postgresService.listJudgments(officeId),
      postgresService.listTasks(officeId),
    ]);

    // Helper: matches target year & month
    const matchesMonthYear = (dateStr: string | null | undefined): boolean => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    };

    // Sessions held: finished and either hearingAt or createdAt in month/year
    const isSessionHeldInPeriod = (s: any): boolean => {
      if (s.status !== "Finished") return false;
      return matchesMonthYear(s.hearingAt) || matchesMonthYear(s.createdAt);
    };

    // Judgments closed: created or judgmentDate in month/year
    const isJudgmentClosedInPeriod = (j: any): boolean => {
      if (matchesMonthYear(j.createdAt)) return true;
      if (j.judgmentDate) {
        const parts = String(j.judgmentDate).split(/[-/]/);
        if (parts.length >= 2) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          if (y === year && m === month) return true;
        }
      }
      return false;
    };

    // Tasks completed: status is "مكتملة" and updated or created in month/year
    const isTaskCompletedInPeriod = (t: any): boolean => {
      if (t.status !== "مكتملة") return false;
      return matchesMonthYear(t.updatedAt) || matchesMonthYear(t.createdAt);
    };

    const periodSessions = allSessions.filter(isSessionHeldInPeriod);
    const periodJudgments = allJudgments.filter(isJudgmentClosedInPeriod);
    const periodTasks = allTasks.filter(isTaskCompletedInPeriod);

    const overall = {
      sessionsHeld: periodSessions.length,
      judgmentsClosed: periodJudgments.length,
      tasksCompleted: periodTasks.length,
    };

    const byLawyer = officeMembers.map((m: any) => {
      const mId = m.id;
      const sessionsHeld = periodSessions.filter(
        (s: any) => s.assignedLawyerId === mId || s.assigned_lawyer_id === mId,
      ).length;
      const judgmentsClosed = periodJudgments.filter(
        (j: any) => j.assignedLawyerId === mId || j.assigned_lawyer_id === mId,
      ).length;
      const tasksCompleted = periodTasks.filter(
        (t: any) => t.assignedLawyerId === mId || t.assigned_lawyer_id === mId,
      ).length;

      return {
        lawyerId: mId,
        lawyerName: m.display_name || m.username,
        username: m.username,
        sessionsHeld,
        judgmentsClosed,
        tasksCompleted,
      };
    });

    // Check if there are any unassigned completed records in the period
    const unassignedSessions = periodSessions.filter((s: any) => !s.assignedLawyerId && !s.assigned_lawyer_id).length;
    const unassignedJudgments = periodJudgments.filter((j: any) => !j.assignedLawyerId && !j.assigned_lawyer_id).length;
    const unassignedTasks = periodTasks.filter((t: any) => !t.assignedLawyerId && !t.assigned_lawyer_id).length;

    if (unassignedSessions > 0 || unassignedJudgments > 0 || unassignedTasks > 0) {
      byLawyer.push({
        lawyerId: "unassigned",
        lawyerName: "غير معيّن",
        username: "unassigned",
        sessionsHeld: unassignedSessions,
        judgmentsClosed: unassignedJudgments,
        tasksCompleted: unassignedTasks,
      });
    }

    res.json({
      month,
      year,
      overall,
      byLawyer,
    });
  } catch (err: any) {
    logger.error({ err, month, year, officeId }, "Failed to fetch monthly report");
    res.status(500).json({ error: "فشل استرجاع التقرير الشهري." });
  }
});

export default router;
