import { Router, type IRouter } from "express";
import {
  CreateSessionBody,
  CreateSessionResponse,
  ListSessionsQueryParams,
  ListSessionsResponse,
  UpdateSessionBody,
  UpdateSessionResponse,
  GetSessionResponse,
} from "@workspace/api-zod";
import {
  createSession,
  deleteSession,
  getSessionById,
  listSessions,
  updateSession,
  computeDaysRemainingStr,
} from "../services/session.service";
import { isGoogleSheetsConfigured } from "../config/env";
import { GoogleSheetsError, GoogleBindingMissingError, GoogleSettingsStoreError } from "../services/googleSheets.service";
import { logger } from "../lib/logger";
import { attachAuthUser, requireAuth, requireActiveSubscription, blockSuperAdminFromOfficeData } from "../middlewares/auth.middleware";
import { WhatsappReminderChannel } from "../services/reminder/channels/whatsappChannel";
import { computeHearingDateTime } from "../utils/hijri";
import { canUserAccessRecord, validateOfficeLawyer } from "../utils/record-access";
import * as postgresService from "../services/postgres.service";
import { notifyLawyerAssignment } from "../services/assignment-notification.service";
import type { Response } from "express";

const router: IRouter = Router();

function getOfficeId(req: any): string {
  const officeId = req.authUser?.officeId || req.authUser?.userId;
  if (!officeId) {
    throw new Error("غير مصرح: معرف المكتب مفقود.");
  }
  return officeId;
}

// Stop all Excel Sheet read/write operations if the user's subscription is suspended or expired
// Super Admins are blocked from office sessions data
router.use("/sessions", attachAuthUser, requireAuth, blockSuperAdminFromOfficeData, requireActiveSubscription);

function handleRouteError(res: Response, err: any, defaultMsg: string): void {
  if (
    err?.statusCode === 503 ||
    err?.code === "DATABASE_UNAVAILABLE" ||
    err?.name === "DatabaseUnavailableError" ||
    String(err?.message || "").includes("قاعدة البيانات غير متصلة")
  ) {
    res.status(503).json({
      error: "قاعدة البيانات غير متصلة حالياً",
      code: "DATABASE_UNAVAILABLE",
    });
    return;
  }
  if (err instanceof GoogleBindingMissingError) {
    res.status(409).json({
      error: "ربط المكتب غير مكتمل. تواصل مع المشرف",
      code: "GOOGLE_BINDING_INCOMPLETE",
      refId: err.refId,
    });
    return;
  }
  if (err instanceof GoogleSettingsStoreError) {
    res.status(503).json({
      error: "تعذر الوصول إلى مخزن إعدادات المكتب. يرجى المحاولة لاحقاً.",
      code: "SETTINGS_STORE_UNAVAILABLE",
      refId: err.refId,
    });
    return;
  }
  if (err instanceof GoogleSheetsError) {
    res.status(err.statusCode).json({
      error: `تعذر الاتصال بمصدر البيانات. ${err.userMessage} رقم المرجع: ${err.refId}`,
      refId: err.refId,
    });
    return;
  }
  const isClockError =
    String(err?.message || "").includes("invalid_grant") ||
    String(err?.stack || "").includes("invalid_grant");
  const errorMsg = isClockError
    ? "فشل الاتصال بـ Google Sheets بسبب عدم تزامن تاريخ وتوقيت الجهاز مع سيرفرات Google (invalid_grant)."
    : err?.message || defaultMsg;
  res.status(500).json({ error: errorMsg });
}

function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const normalized = timeStr.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632)).trim();
  const match = normalized.match(/(\d{1,2}):(\d{2})\s*(ص|م|صباحاً|مساءً|am|pm)?/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const modifier = (match[3] || '').toLowerCase();

  if (modifier === 'م' || modifier === 'مساءً' || modifier === 'pm') {
    if (hours < 12) hours += 12;
  } else if (modifier === 'ص' || modifier === 'صباحاً' || modifier === 'am') {
    if (hours === 12) hours = 0;
  }
  return hours * 60 + minutes;
}

function areTimesOverlapping(t1: string | null | undefined, t2: string | null | undefined): boolean {
  if (!t1 || !t2) return false;
  const s1 = t1.trim().toLowerCase();
  const s2 = t2.trim().toLowerCase();
  if (s1 === s2) return true;

  const m1 = parseTimeToMinutes(s1);
  const m2 = parseTimeToMinutes(s2);
  if (m1 !== null && m2 !== null) {
    return Math.abs(m1 - m2) < 30;
  }
  return false;
}

async function findConflictingSession(
  officeId: string,
  assignedLawyerId: string | null | undefined,
  sessionDateHijri: string | null | undefined,
  sessionTime: string | null | undefined,
  excludeSessionId?: number,
): Promise<any | null> {
  if (!assignedLawyerId || !sessionDateHijri || !sessionTime) {
    return null;
  }

  const normDate = sessionDateHijri.trim();
  const existingSessions = await postgresService.listSessions(officeId);

  for (const s of existingSessions) {
    if (excludeSessionId && Number(s.id) === Number(excludeSessionId)) {
      continue;
    }
    if (s.status === "Cancelled") {
      continue;
    }
    const sLawyerId = (s as any).assignedLawyerId || (s as any).assigned_lawyer_id;
    if (sLawyerId !== assignedLawyerId) {
      continue;
    }
    const sDate = s.sessionDateHijri ? s.sessionDateHijri.trim() : "";
    if (sDate !== normDate) {
      continue;
    }
    if (areTimesOverlapping(s.sessionTime, sessionTime)) {
      return s;
    }
  }

  return null;
}

function unconfiguredResponse(): { error: string } {
  return {
    error:
      "Google Sheets is not configured yet. Set GOOGLE_SPREADSHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON.",
  };
}

router.get("/sessions", async (req, res) => {
  const parseResult = ListSessionsQueryParams.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid status filter." });
    return;
  }
  try {
    const officeId = req.authUser?.officeId || req.authUser?.userId;
    if (!officeId) {
      res.status(401).json({ error: "غير مصرح." });
      return;
    }
    let sessions = await listSessions(parseResult.data.status, officeId);
    if (req.authUser?.role === "staff") {
      sessions = sessions.filter((s) => canUserAccessRecord(s, req.authUser));
    }
    if (req.query.scope === "personal") {
      const username = (req.authUser?.username || "").toLowerCase();
      const displayName = ((req.authUser as any)?.displayName || "").toLowerCase();
      sessions = sessions.filter((s) => {
        const text = `${s.notes || ""} ${s.plaintiff || ""}`.toLowerCase();
        return (username && text.includes(username)) || (displayName && text.includes(displayName));
      });
    }
    const parsedList = ListSessionsResponse.parse(sessions);
    const reportStatusSet = await postgresService.getSessionReportStatusMap(officeId);
    const data = sessions.map((s: any, idx: number) => {
      const hasReport = Boolean(s.report || reportStatusSet.has(Number(s.id)));
      return {
        ...parsedList[idx],
        clientId: s.clientId || s.client_id || null,
        client_id: s.clientId || s.client_id || null,
        assignedLawyerId: s.assignedLawyerId || s.assigned_lawyer_id || null,
        assigned_lawyer_id: s.assignedLawyerId || s.assigned_lawyer_id || null,
        clientRole: s.clientRole || s.client_role || null,
        client_role: s.clientRole || s.client_role || null,
        createdBy: s.createdBy || s.created_by || null,
        created_by: s.createdBy || s.created_by || null,
        has_report: hasReport,
        hasReport: hasReport,
      };
    });
    res.json(data);
  } catch (err: any) {
    logger.error({ err }, "Failed to list sessions");
    handleRouteError(res, err, "فشل تحميل قائمة الجلسات.");
  }
});

router.post("/sessions", attachAuthUser, requireAuth, async (req, res) => {
  const parseResult = CreateSessionBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "بيانات الجلسة غير صالحة." });
    return;
  }
  const { caseNumber, court, sessionDateHijri } = parseResult.data;
  if (!caseNumber?.trim() || !court?.trim() || !sessionDateHijri?.trim()) {
    res.status(400).json({
      error: "رقم القضية، المحكمة، وتاريخ الجلسة حقول إلزامية لحفظ الجلسة في النظام.",
    });
    return;
  }
  try {
    const officeId = getOfficeId(req);
    const body = req.body || {};
    const clientId = body.clientId || body.client_id || null;
    let assignedLawyerId = body.assignedLawyerId || body.assigned_lawyer_id || null;
    const clientRole = body.clientRole || body.client_role || null;
    const createdBy = req.authUser?.userId || null;

    if (req.authUser?.role === "staff") {
      assignedLawyerId = req.authUser.userId;
    } else if (assignedLawyerId) {
      const val = await validateOfficeLawyer(assignedLawyerId, officeId);
      if (!val.valid) {
        res.status(400).json({ error: val.error || "المحامي غير صالح." });
        return;
      }
    }

    // Check for session conflict for the same assigned lawyer
    const conflict = await findConflictingSession(
      officeId,
      assignedLawyerId,
      parseResult.data.sessionDateHijri,
      parseResult.data.sessionTime,
    );
    if (conflict) {
      const caseLabel = conflict.caseNumber ? `قضية رقم ${conflict.caseNumber}` : `جلسة #${conflict.id}`;
      res.status(400).json({
        error: `تعارض في المواعيد: لدى المحامي جلسة أخرى في نفس التاريخ والوقت (${caseLabel}).`,
      });
      return;
    }

    const session = await createSession(
      {
        ...parseResult.data,
        clientId,
        assignedLawyerId,
        clientRole,
        createdBy,
      } as any,
      officeId,
    );
    const data = {
      ...CreateSessionResponse.parse(session),
      clientId: (session as any).clientId || (session as any).client_id || null,
      client_id: (session as any).clientId || (session as any).client_id || null,
      assignedLawyerId: (session as any).assignedLawyerId || (session as any).assigned_lawyer_id || null,
      assigned_lawyer_id: (session as any).assignedLawyerId || (session as any).assigned_lawyer_id || null,
      clientRole: (session as any).clientRole || (session as any).client_role || null,
      client_role: (session as any).clientRole || (session as any).client_role || null,
      createdBy: (session as any).createdBy || (session as any).created_by || null,
      created_by: (session as any).createdBy || (session as any).created_by || null,
    };
    res.status(201).json(data);
  } catch (err: any) {
    logger.error({ err }, "Failed to create session");
    handleRouteError(res, err, "فشل إنشاء الجلسة.");
  }
});

router.get("/sessions/:id", attachAuthUser, requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid session id." });
    return;
  }
  if (!req.authUser) {
    res.status(401).json({ error: "غير مصرح." });
    return;
  }
  const officeId = req.authUser.officeId || req.authUser.userId;
  if (!officeId) {
    res.status(401).json({ error: "غير مصرح." });
    return;
  }
  try {
    const session = await getSessionById(id, officeId);
    if (!session || !canUserAccessRecord(session, req.authUser)) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    const reportData = await postgresService.getSessionReport(id, officeId);
    const hasReport = Boolean((session as any).report || reportData?.report);
    const data = {
      ...GetSessionResponse.parse(session),
      clientId: (session as any).clientId || (session as any).client_id || null,
      client_id: (session as any).clientId || (session as any).client_id || null,
      assignedLawyerId: (session as any).assignedLawyerId || (session as any).assigned_lawyer_id || null,
      assigned_lawyer_id: (session as any).assignedLawyerId || (session as any).assigned_lawyer_id || null,
      clientRole: (session as any).clientRole || (session as any).client_role || null,
      client_role: (session as any).clientRole || (session as any).client_role || null,
      createdBy: (session as any).createdBy || (session as any).created_by || null,
      created_by: (session as any).createdBy || (session as any).created_by || null,
      has_report: hasReport,
      hasReport: hasReport,
    };
    res.json(data);
  } catch (err: any) {
    logger.error({ err }, "Failed to load session");
    handleRouteError(res, err, "فشل تحميل الجلسة.");
  }
});

router.patch("/sessions/:id", attachAuthUser, requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid session id." });
    return;
  }
  const parseResult = UpdateSessionBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid session data." });
    return;
  }
  try {
    const officeId = getOfficeId(req);
    const existing = await getSessionById(id, officeId);
    if (!existing || !canUserAccessRecord(existing, req.authUser)) {
      res.status(404).json({ error: "Session not found." });
      return;
    }

    const body = req.body || {};
    const extraPayload: any = {};
    if (body.clientId !== undefined || body.client_id !== undefined) {
      extraPayload.clientId = body.clientId !== undefined ? body.clientId : body.client_id;
    }
    if (body.clientRole !== undefined || body.client_role !== undefined) {
      extraPayload.clientRole = body.clientRole !== undefined ? body.clientRole : body.client_role;
    }
    if (req.authUser?.role !== "staff" && (body.assignedLawyerId !== undefined || body.assigned_lawyer_id !== undefined)) {
      const targetLawyer = body.assignedLawyerId !== undefined ? body.assignedLawyerId : body.assigned_lawyer_id;
      if (targetLawyer) {
        const val = await validateOfficeLawyer(targetLawyer, officeId);
        if (!val.valid) {
          res.status(400).json({ error: val.error || "المحامي غير صالح." });
          return;
        }
      }
      extraPayload.assignedLawyerId = targetLawyer;
    }

    // Check for session conflict on update
    const targetLawyer = extraPayload.assignedLawyerId !== undefined
      ? extraPayload.assignedLawyerId
      : ((existing as any).assignedLawyerId || (existing as any).assigned_lawyer_id);
    const targetDate = parseResult.data.sessionDateHijri !== undefined
      ? parseResult.data.sessionDateHijri
      : existing.sessionDateHijri;
    const targetTime = parseResult.data.sessionTime !== undefined
      ? parseResult.data.sessionTime
      : existing.sessionTime;

    const conflict = await findConflictingSession(
      officeId,
      targetLawyer,
      targetDate,
      targetTime,
      id,
    );
    if (conflict) {
      const caseLabel = conflict.caseNumber ? `قضية رقم ${conflict.caseNumber}` : `جلسة #${conflict.id}`;
      res.status(400).json({
        error: `تعارض في المواعيد: لدى المحامي جلسة أخرى في نفس التاريخ والوقت (${caseLabel}).`,
      });
      return;
    }

    const session = await updateSession(id, { ...parseResult.data, ...extraPayload }, officeId);
    if (!session) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    const data = {
      ...UpdateSessionResponse.parse(session),
      clientId: (session as any).clientId || (session as any).client_id || null,
      client_id: (session as any).clientId || (session as any).client_id || null,
      assignedLawyerId: (session as any).assignedLawyerId || (session as any).assigned_lawyer_id || null,
      assigned_lawyer_id: (session as any).assignedLawyerId || (session as any).assigned_lawyer_id || null,
      clientRole: (session as any).clientRole || (session as any).client_role || null,
      client_role: (session as any).clientRole || (session as any).client_role || null,
      createdBy: (session as any).createdBy || (session as any).created_by || null,
      created_by: (session as any).createdBy || (session as any).created_by || null,
    };
    res.json(data);
  } catch (err: any) {
    logger.error({ err }, "Failed to update session");
    handleRouteError(res, err, "فشل تحديث الجلسة.");
  }
});

router.delete("/sessions/:id", attachAuthUser, requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid session id." });
    return;
  }
  try {
    const officeId = getOfficeId(req);
    const existing = await getSessionById(id, officeId);
    if (!existing || !canUserAccessRecord(existing, req.authUser)) {
      res.status(404).json({ error: "Session not found." });
      return;
    }

    const deleted = await deleteSession(id, officeId);
    if (!deleted) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    res.status(204).send();
  } catch (err: any) {
    logger.error({ err }, "Failed to delete session");
    handleRouteError(res, err, "فشل حذف الجلسة.");
  }
});

/**
 * PATCH /sessions/:id/reassign
 * Admin-only: reassign a session to an office lawyer or unassign.
 */
router.patch("/sessions/:id/reassign", attachAuthUser, requireAuth, async (req, res) => {
  if (req.authUser?.role === "staff") {
    res.status(403).json({ error: "إعادة التعيين مقتصرة على مشرف المكتب." });
    return;
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid session id." });
    return;
  }

  const officeId = getOfficeId(req);
  const targetLawyerId = req.body?.assignedLawyerId !== undefined ? req.body.assignedLawyerId : req.body?.assigned_lawyer_id;

  if (targetLawyerId) {
    const val = await validateOfficeLawyer(targetLawyerId, officeId);
    if (!val.valid) {
      res.status(400).json({ error: val.error || "المحامي غير صالح." });
      return;
    }
  }

  try {
    const existing = await getSessionById(id, officeId);
    if (!existing) {
      res.status(404).json({ error: "Session not found." });
      return;
    }

    if (targetLawyerId) {
      const conflict = await findConflictingSession(
        officeId,
        targetLawyerId,
        existing.sessionDateHijri,
        existing.sessionTime,
        id,
      );
      if (conflict) {
        const caseLabel = conflict.caseNumber ? `قضية رقم ${conflict.caseNumber}` : `جلسة #${conflict.id}`;
        res.status(400).json({
          error: `تعارض في المواعيد: لدى المحامي جلسة أخرى في نفس التاريخ والوقت (${caseLabel}).`,
        });
        return;
      }
    }

    const updated = await updateSession(id, { assignedLawyerId: targetLawyerId || null } as any, officeId);

    // Trigger assignment notification for lawyer (in-app + WhatsApp)
    if (updated && targetLawyerId) {
      void notifyLawyerAssignment({
        officeId,
        assignerId: req.authUser?.userId,
        targetLawyerId,
        previousLawyerId: (existing as any).assignedLawyerId ?? (existing as any).assigned_lawyer_id ?? null,
        recordType: "session",
        recordTypeArabic: "جلسة",
        recordId: id,
        recordDescription: updated.caseNumber ? `قضية رقم ${updated.caseNumber}` : `جلسة #${id}`,
        directLink: `/sessions/${id}`,
      });
    }

    res.json(updated);
  } catch (err: any) {
    logger.error({ err }, "Failed to reassign session");
    handleRouteError(res, err, "فشل إعادة تعيين الجلسة.");
  }
});

/**
 * POST /api/sessions/:id/send-whatsapp
 * Dispatches an instant WhatsApp reminder with session details and calculated remaining time.
 */
router.post("/sessions/:id/send-whatsapp", attachAuthUser, requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid session id." });
    return;
  }
  try {
    const officeId = req.authUser?.officeId || req.authUser?.userId;
    if (!officeId) {
      res.status(401).json({ error: "غير مصرح." });
      return;
    }
    const session = await getSessionById(id, officeId);
    if (!session) {
      res.status(404).json({ error: "الجلسة غير موجودة." });
      return;
    }

    const { listSupabaseUsers, getPlatformSettings } = await import("../services/supabase.service");
    const users = await listSupabaseUsers().catch(() => []);
    const officeUser = users.find((u) => u.id === officeId || u.username === officeId || u.id === req.authUser?.userId);

    // 1. Resolve Client phone
    let clientPhone: string | null = null;
    const sessionAny = session as any;
    const clientId = sessionAny.clientId || sessionAny.client_id;
    if (clientId) {
      try {
        const client = await postgresService.getClientById(clientId, officeId);
        if (client?.phone?.trim()) {
          clientPhone = client.phone.trim();
        }
      } catch {}
    }

    // 2. Resolve Assigned Lawyer phone
    let lawyerPhone: string | null = null;
    const assignedLawyerId = sessionAny.assignedLawyerId || sessionAny.assigned_lawyer_id;
    if (assignedLawyerId) {
      const lawyer = users.find((u) => u.id === assignedLawyerId);
      if (lawyer?.phone?.trim()) {
        lawyerPhone = lawyer.phone.trim();
      }
    }
    if (!lawyerPhone && officeUser?.phone?.trim()) {
      lawyerPhone = officeUser.phone.trim();
    }

    // Fallback: check platform settings or direct input
    const directPhone = (req.body as any)?.recipientPhone?.trim();
    if (directPhone) {
      if (!clientPhone) clientPhone = directPhone;
      else if (!lawyerPhone) lawyerPhone = directPhone;
    }

    if (!clientPhone && !lawyerPhone) {
      try {
        const settings = await getPlatformSettings();
        if ((settings as any)?.whatsapp_default_phone?.trim()) {
          lawyerPhone = (settings as any).whatsapp_default_phone.trim();
        }
      } catch {}
    }

    const recipients: Array<{ phone: string; label: string }> = [];
    if (clientPhone) {
      recipients.push({ phone: clientPhone, label: "الموكل" });
    }
    if (lawyerPhone && lawyerPhone !== clientPhone) {
      recipients.push({ phone: lawyerPhone, label: "المحامي المكلف" });
    }

    if (recipients.length === 0) {
      res.status(400).json({
        error: "لا يوجد رقم واتساب مسجل للمكتب أو للموكل أو للمحامي لإرسال التذكير إليه.",
      });
      return;
    }

    const hearingAt = computeHearingDateTime(session.sessionDateHijri, session.sessionTime);
    let remainingText = "تذكير فوري";

    if (hearingAt) {
      const diffMs = hearingAt.getTime() - Date.now();
      if (diffMs > 0) {
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        if (hours >= 24) {
          const days = Math.floor(hours / 24);
          const remHours = hours % 24;
          remainingText = `متبقي ${days} يوم و ${remHours} ساعة`;
        } else if (hours > 0) {
          remainingText = `متبقي ${hours} ساعة و ${minutes} دقيقة`;
        } else {
          remainingText = `متبقي ${minutes} دقيقة`;
        }
      } else {
        remainingText = "موعد الجلسة الآن أو انتهى";
      }
    } else {
      const daysStr = computeDaysRemainingStr(session.sessionDateHijri, session.sessionTime);
      remainingText = `متبقي ${daysStr}`;
    }

    const channel = new WhatsappReminderChannel();
    const sentLabels: string[] = [];

    for (const recipient of recipients) {
      await channel.send({
        officeId,
        recipientPhone: recipient.phone,
        sessionId: session.id,
        caseNumber: session.caseNumber,
        sessionDateHijri: session.sessionDateHijri,
        sessionTime: session.sessionTime,
        kind: "instant",
        remainingText,
        court: session.court,
        courtCircuit: session.courtCircuit,
        plaintiff: session.plaintiff,
        defendant: session.defendant,
        caseSubject: session.caseSubject,
      });
      sentLabels.push(recipient.label);
    }

    const summaryText = sentLabels.length > 1
      ? `تم إرسال تذكير الجلسة عبر الواتساب بنجاح إلى (${sentLabels.join(" و ")})`
      : `تم إرسال تذكير الجلسة عبر الواتساب بنجاح إلى ${sentLabels[0]}`;

    res.json({ message: summaryText, recipients: sentLabels });
  } catch (err: any) {
    logger.error({ err, id }, "Failed to send instant WhatsApp reminder");
    const errMsg = err?.message || "فشل إرسال تذكير الواتساب.";
    res.status(400).json({ error: errMsg });
  }
});

export default router;
