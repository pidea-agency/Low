import { Router, type IRouter } from "express";
import {
  attachAuthUser,
  requireAuth,
  requireActiveSubscription,
  blockSuperAdminFromOfficeData,
} from "../middlewares/auth.middleware";
import { logger } from "../lib/logger";
import * as postgresService from "../services/postgres.service";
import { canUserAccessRecord, validateOfficeLawyer } from "../utils/record-access";
import { notifyLawyerAssignment } from "../services/assignment-notification.service";

const router: IRouter = Router();

function generateRefId(): string {
  return `REF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

router.use("/cases", attachAuthUser, requireAuth, blockSuperAdminFromOfficeData, requireActiveSubscription);

function getOfficeId(req: any): string {
  const officeId = req.authUser?.officeId || req.authUser?.userId;
  if (!officeId) {
    throw new Error("غير مصرح: معرف المكتب مفقود.");
  }
  return officeId;
}

/**
 * GET /api/cases/stats
 * Returns counts by status (open, closed, postponed, total) for summary cards.
 * Admin sees office-wide, staff sees their own assigned subset.
 */
router.get("/cases/stats", async (req, res) => {
  const officeId = getOfficeId(req);
  try {
    const isStaff = req.authUser?.role === "staff";
    const stats = await postgresService.getCaseStats(
      officeId,
      isStaff ? (c) => canUserAccessRecord(c, req.authUser) : undefined
    );
    res.json(stats);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to get cases stats");
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل استرجاع إحصائيات القضايا");
  }
});

/**
 * GET /api/cases
 * List cases with optional filters: status, court, client_id, case_number/q, date_from, date_to.
 * Scoped by office and respects staff assignment-based visibility.
 */
router.get("/cases", async (req, res) => {
  const officeId = getOfficeId(req);
  try {
    const { status, court, client_id, clientId, case_number, q, date_from, date_to } = req.query;
    const filters = {
      status: status ? String(status) : undefined,
      court: court ? String(court) : undefined,
      clientId: (clientId || client_id) ? String(clientId || client_id) : undefined,
      caseNumber: (case_number || q) ? String(case_number || q) : undefined,
      dateFrom: date_from ? String(date_from) : undefined,
      dateTo: date_to ? String(date_to) : undefined,
    };

    let cases = await postgresService.listCases(officeId, filters);

    if (req.authUser?.role === "staff") {
      cases = cases.filter((c) => canUserAccessRecord(c, req.authUser));
    }

    res.json(cases);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to list cases");
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل تحميل قائمة القضايا");
  }
});

/**
 * POST /api/cases
 * Creates a new case in the office. Requires client_id and case_number.
 */
router.post("/cases", async (req, res) => {
  const officeId = getOfficeId(req);
  const body = req.body || {};
  const clientId = body.clientId || body.client_id;
  const caseNumber = body.caseNumber || body.case_number;

  if (!clientId || !String(clientId).trim()) {
    res.status(400).json({ error: "العميل مطلوب لإنشاء القضية." });
    return;
  }

  if (!caseNumber || !String(caseNumber).trim()) {
    res.status(400).json({ error: "رقم القضية مطلوب." });
    return;
  }

  // Verify client belongs to office
  const client = await postgresService.getClientById(String(clientId).trim(), officeId);
  if (!client) {
    res.status(400).json({ error: "العميل المحدد غير موجود في هذا المكتب." });
    return;
  }

  const assignedLawyerId = body.assignedLawyerId || body.assigned_lawyer_id || null;
  if (assignedLawyerId) {
    const lawyerVal = await validateOfficeLawyer(assignedLawyerId, officeId);
    if (!lawyerVal.valid) {
      res.status(400).json({ error: lawyerVal.error || "المحامي المحدد غير صالح." });
      return;
    }
  }

  const status = body.status || "open";
  if (!["open", "closed", "postponed"].includes(status)) {
    res.status(400).json({ error: "حالة القضية غير صالحة. الحالات المسموحة: open, closed, postponed." });
    return;
  }

  try {
    const newCase = await postgresService.createCase(
      {
        clientId: String(clientId).trim(),
        caseNumber: String(caseNumber).trim(),
        caseType: body.caseType || body.case_type || "",
        court: body.court || "",
        assignedLawyerId,
        status,
        opposingParty: body.opposingParty || body.opposing_party || "",
        createdBy: req.authUser?.userId || null,
      },
      officeId
    );
    res.status(201).json(newCase);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to create case");
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل إنشاء القضية");
  }
});

/**
 * GET /api/cases/:id/detail
 * Returns case info + linked sessions + judgments + attachments + client info, respecting visibility.
 */
router.get("/cases/:id/detail", async (req, res) => {
  const officeId = getOfficeId(req);
  const { id } = req.params;

  try {
    const caseRecord = await postgresService.getCaseById(id, officeId);
    if (!caseRecord) {
      res.status(404).json({ error: "القضية غير موجودة." });
      return;
    }

    if (!canUserAccessRecord(caseRecord, req.authUser)) {
      res.status(403).json({ error: "ليس لديك صلاحية الوصول إلى هذه القضية." });
      return;
    }

    const detail = await postgresService.getCaseDetail(id, officeId);
    if (!detail) {
      res.status(404).json({ error: "تعذر العثور على تفاصيل القضية." });
      return;
    }

    // Filter sessions & judgments for staff
    if (req.authUser?.role === "staff") {
      detail.sessions = detail.sessions.filter((s) => canUserAccessRecord(s, req.authUser));
      detail.judgments = detail.judgments.filter((j) => canUserAccessRecord(j, req.authUser));
    }

    res.json(detail);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to get case detail");
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل استرجاع تفاصيل القضية");
  }
});

/**
 * GET /api/cases/:id
 * Returns a single case if in office and accessible.
 */
router.get("/cases/:id", async (req, res) => {
  const officeId = getOfficeId(req);
  const { id } = req.params;

  try {
    const caseRecord = await postgresService.getCaseById(id, officeId);
    if (!caseRecord) {
      res.status(404).json({ error: "القضية غير موجودة." });
      return;
    }

    if (!canUserAccessRecord(caseRecord, req.authUser)) {
      res.status(403).json({ error: "ليس لديك صلاحية الوصول إلى هذه القضية." });
      return;
    }

    res.json(caseRecord);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to get case");
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل استرجاع القضية");
  }
});

/**
 * PATCH /api/cases/:id
 * Updates case fields.
 */
router.patch("/cases/:id", async (req, res) => {
  const officeId = getOfficeId(req);
  const { id } = req.params;
  const body = req.body || {};

  try {
    const existing = await postgresService.getCaseById(id, officeId);
    if (!existing) {
      res.status(404).json({ error: "القضية غير موجودة." });
      return;
    }

    if (!canUserAccessRecord(existing, req.authUser)) {
      res.status(403).json({ error: "ليس لديك صلاحية تعديل هذه القضية." });
      return;
    }

    const payload: any = {};
    if (body.caseNumber !== undefined || body.case_number !== undefined) {
      payload.caseNumber = String(body.caseNumber ?? body.case_number).trim();
    }
    if (body.caseType !== undefined || body.case_type !== undefined) {
      payload.caseType = String(body.caseType ?? body.case_type).trim();
    }
    if (body.court !== undefined) {
      payload.court = String(body.court).trim();
    }
    if (body.opposingParty !== undefined || body.opposing_party !== undefined) {
      payload.opposingParty = body.opposingParty ?? body.opposing_party;
    }
    if (body.status !== undefined) {
      if (!["open", "closed", "postponed"].includes(body.status)) {
        res.status(400).json({ error: "حالة القضية غير صالحة." });
        return;
      }
      payload.status = body.status;
    }
    const clientId = body.clientId ?? body.client_id;
    if (clientId !== undefined) {
      const client = await postgresService.getClientById(clientId, officeId);
      if (!client) {
        res.status(400).json({ error: "العميل المحدد غير موجود في هذا المكتب." });
        return;
      }
      payload.clientId = clientId;
    }
    const lawyerId = body.assignedLawyerId ?? body.assigned_lawyer_id;
    if (lawyerId !== undefined) {
      if (req.authUser?.role === "staff") {
        res.status(403).json({ error: "فقط مدير المكتب يمكنه تغيير المحامي المعين." });
        return;
      }
      if (lawyerId) {
        const val = await validateOfficeLawyer(lawyerId, officeId);
        if (!val.valid) {
          res.status(400).json({ error: val.error || "المحامي غير صالح." });
          return;
        }
      }
      payload.assignedLawyerId = lawyerId || null;
    }

    const updated = await postgresService.updateCase(id, payload, officeId);
    res.json(updated);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to update case");
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل تعديل القضية");
  }
});

/**
 * PATCH /api/cases/:id/reassign
 * Admin-only: reassign case to another lawyer in the office.
 */
router.patch("/cases/:id/reassign", async (req, res) => {
  if (req.authUser?.role === "staff") {
    res.status(403).json({ error: "غير مصرح لك بإعادة إسناد القضايا. هذه العملية خاصة بمدير المكتب فقط." });
    return;
  }

  const officeId = getOfficeId(req);
  const { id } = req.params;
  const body = req.body || {};
  const assignedLawyerId = body.assignedLawyerId ?? body.assigned_lawyer_id ?? null;

  if (assignedLawyerId) {
    const val = await validateOfficeLawyer(assignedLawyerId, officeId);
    if (!val.valid) {
      res.status(400).json({ error: val.error || "المحامي المحدد غير صالح." });
      return;
    }
  }

  try {
    const existing = await postgresService.getCaseById(id, officeId);
    if (!existing) {
      res.status(404).json({ error: "القضية غير موجودة." });
      return;
    }

    const updated = await postgresService.reassignCase(id, assignedLawyerId, officeId);
    if (!updated) {
      res.status(404).json({ error: "القضية غير موجودة." });
      return;
    }

    // Trigger assignment notification for lawyer (in-app + WhatsApp)
    if (assignedLawyerId) {
      void notifyLawyerAssignment({
        officeId,
        assignerId: req.authUser?.userId,
        targetLawyerId: assignedLawyerId,
        previousLawyerId: existing.assignedLawyerId,
        recordType: "case",
        recordTypeArabic: "قضية",
        recordId: id,
        recordDescription: updated.caseNumber ? `قضية رقم ${updated.caseNumber}` : `قضية #${id}`,
        directLink: `/cases`,
      });
    }

    res.json(updated);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to reassign case");
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل إعادة إسناد القضية");
  }
});

/**
 * DELETE /api/cases/:id
 * Delete a case if accessible.
 */
router.delete("/cases/:id", async (req, res) => {
  const officeId = getOfficeId(req);
  const { id } = req.params;

  try {
    const existing = await postgresService.getCaseById(id, officeId);
    if (!existing) {
      res.status(404).json({ error: "القضية غير موجودة." });
      return;
    }

    if (!canUserAccessRecord(existing, req.authUser)) {
      res.status(403).json({ error: "ليس لديك صلاحية حذف هذه القضية." });
      return;
    }

    const ok = await postgresService.deleteCase(id, officeId);
    res.json({ success: ok });
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to delete case");
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل حذف القضية");
  }
});

export default router;
