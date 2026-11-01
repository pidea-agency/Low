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
import { GoogleSheetsError } from "../services/googleSheets.service";
import { logger } from "../lib/logger";
import { attachAuthUser, requireAuth, requireActiveSubscription } from "../middlewares/auth.middleware";
import { WhatsappReminderChannel } from "../services/reminder/channels/whatsappChannel";
import { computeHearingDateTime } from "../utils/hijri";
import type { Response } from "express";

const router: IRouter = Router();

// Stop all Excel Sheet read/write operations if the user's subscription is suspended or expired
router.use(attachAuthUser, requireAuth, requireActiveSubscription);

function handleRouteError(res: Response, err: any, defaultMsg: string): void {
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
    const userId = req.authUser?.userId;
    const sessions = await listSessions(parseResult.data.status, userId);
    const data = ListSessionsResponse.parse(sessions);
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
    const userId = req.authUser?.userId;
    const session = await createSession(parseResult.data, userId);
    const data = CreateSessionResponse.parse(session);
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
  try {
    const userId = req.authUser?.userId;
    const session = await getSessionById(id, userId);
    if (!session) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    const data = GetSessionResponse.parse(session);
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
    const userId = req.authUser?.userId;
    const session = await updateSession(id, parseResult.data, userId);
    if (!session) {
      res.status(404).json({ error: "Session not found." });
      return;
    }
    const data = UpdateSessionResponse.parse(session);
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
    const userId = req.authUser?.userId;
    const deleted = await deleteSession(id, userId);
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
    const userId = req.authUser?.userId;
    const session = await getSessionById(id, userId);
    if (!session) {
      res.status(404).json({ error: "الجلسة غير موجودة." });
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
    await channel.send({
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

    res.json({ message: "تم إرسال تذكير الواتساب بنجاح!" });
  } catch (err: any) {
    logger.error({ err, id }, "Failed to send instant WhatsApp reminder");
    const errMsg = err?.message || "فشل إرسال تذكير الواتساب.";
    res.status(400).json({ error: errMsg });
  }
});

export default router;
