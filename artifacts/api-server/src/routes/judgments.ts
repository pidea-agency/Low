import { Router, type IRouter } from "express";
import { z } from "zod";
import { attachAuthUser, requireAuth, requireActiveSubscription, blockSuperAdminFromOfficeData } from "../middlewares/auth.middleware";
import { logger } from "../lib/logger";
import * as postgresService from "../services/postgres.service";
import type { JudgmentRecord } from "../services/postgres.service";
import { canUserAccessRecord, validateOfficeLawyer } from "../utils/record-access";
import { notifyLawyerAssignment } from "../services/assignment-notification.service";

export type { JudgmentRecord };

const CreateJudgmentSchema = z.object({
  caseNumber: z.string().trim().min(1, "رقم القضية مطلوب."),
  judgmentNumber: z.string().trim().min(1, "رقم الصك مطلوب."),
  court: z.string().optional(),
  plaintiff: z.string().optional(),
  defendant: z.string().optional(),
  assignedLawyer: z.string().optional(),
  judgmentDate: z.string().optional(),
  summary: z.string().optional(),
  isFavorable: z.string().optional(),
  clientId: z.string().nullable().optional(),
  client_id: z.string().nullable().optional(),
  assignedLawyerId: z.string().nullable().optional(),
  assigned_lawyer_id: z.string().nullable().optional(),
  clientRole: z.string().nullable().optional(),
  client_role: z.string().nullable().optional(),
});

const UpdateJudgmentSchema = z.object({
  caseNumber: z.string().optional(),
  court: z.string().optional(),
  plaintiff: z.string().optional(),
  defendant: z.string().optional(),
  assignedLawyer: z.string().optional(),
  judgmentNumber: z.string().optional(),
  judgmentDate: z.string().optional(),
  summary: z.string().optional(),
  isFavorable: z.string().optional(),
  clientId: z.string().nullable().optional(),
  client_id: z.string().nullable().optional(),
  assignedLawyerId: z.string().nullable().optional(),
  assigned_lawyer_id: z.string().nullable().optional(),
  clientRole: z.string().nullable().optional(),
  client_role: z.string().nullable().optional(),
});

const ReassignJudgmentSchema = z.object({
  assignedLawyerId: z.string().nullable().optional(),
  assigned_lawyer_id: z.string().nullable().optional(),
  assignedLawyer: z.string().optional(),
});

const router: IRouter = Router();

function generateRefId(): string {
  return `REF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

// Stop all Judgment operations if subscription is suspended or expired
// Super Admins are blocked from office judgments data
router.use("/judgments", attachAuthUser, requireAuth, blockSuperAdminFromOfficeData, requireActiveSubscription);

function getOfficeId(req: any): string {
  const officeId = req.authUser?.officeId || req.authUser?.userId;
  if (!officeId) {
    throw new Error("غير مصرح: معرف المكتب مفقود.");
  }
  return officeId;
}

/**
 * GET /api/judgments
 * Lists all Judgment records belonging to the authenticated office.
 */
router.get("/judgments", async (req, res) => {
  const officeId = getOfficeId(req);
  try {
    let list = await postgresService.listJudgments(officeId);
    if (req.authUser?.role === "staff") {
      list = list.filter((j) => canUserAccessRecord(j, req.authUser));
    }
    res.json(list);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to list judgments");
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل تحميل بيانات الأحكام");
  }
});

/**
 * GET /api/judgments/:id
 * Gets a single Judgment record by id. Verifies office ownership and scoping, returning 404 if not found.
 */
router.get("/judgments/:id", async (req, res) => {
  const officeId = getOfficeId(req);
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف الحكم غير صالح." });
    return;
  }

  try {
    const judgment = await postgresService.getJudgmentById(id, officeId);
    if (!judgment || !canUserAccessRecord(judgment, req.authUser)) {
      res.status(404).json({ error: "الحكم غير موجود." });
      return;
    }
    res.json(judgment);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err, id }, "Failed to get judgment");
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل تحميل بيانات الحكم");
  }
});

/**
 * POST /api/judgments
 * Creates a new Judgment record stamped with the caller's office.
 */
router.post("/judgments", async (req, res) => {
  const officeId = getOfficeId(req);
  const parseResult = CreateJudgmentSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.errors[0]?.message || "رقم القضية ورقم الصك مطلوبان.";
    res.status(400).json({ error: errorMsg });
    return;
  }
  const body = req.body as any;

  const clientId = body.clientId || body.client_id || null;
  let assignedLawyerId = body.assignedLawyerId || body.assigned_lawyer_id || null;
  let assignedLawyer = body.assignedLawyer?.trim() || "";
  const clientRole = body.clientRole || body.client_role || null;
  const createdBy = req.authUser?.userId || null;

  if (req.authUser?.role === "staff") {
    assignedLawyerId = req.authUser.userId;
    assignedLawyer = req.authUser.displayName || req.authUser.username;
  } else if (assignedLawyerId) {
    const val = await validateOfficeLawyer(assignedLawyerId, officeId);
    if (!val.valid) {
      res.status(400).json({ error: val.error || "المحامي غير صالح." });
      return;
    }
    if (val.lawyerName && !assignedLawyer) {
      assignedLawyer = val.lawyerName;
    }
  }

  try {
    const created = await postgresService.createJudgment(
      {
        caseNumber: body.caseNumber.trim(),
        court: body.court?.trim() || "",
        plaintiff: body.plaintiff?.trim() || "",
        defendant: body.defendant?.trim() || "",
        assignedLawyer,
        judgmentNumber: body.judgmentNumber.trim(),
        judgmentDate: body.judgmentDate?.trim() || "",
        summary: body.summary?.trim() || "",
        isFavorable: body.isFavorable || "نهائي",
        clientId,
        assignedLawyerId,
        clientRole,
        createdBy,
      },
      officeId,
    );

    logger.info({ id: created.id, officeId }, "Judgment record created in database");
    res.status(201).json(created);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to create judgment");
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل حفظ الحكم");
  }
});

/**
 * PUT /api/judgments/:id
 * Updates an existing Judgment record. Verifies office ownership and scoping, returning 404 if not found.
 */
router.put("/judgments/:id", async (req, res) => {
  const officeId = getOfficeId(req);
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف الحكم غير صالح." });
    return;
  }

  const parseResult = UpdateJudgmentSchema.safeParse(req.body);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.errors[0]?.message || "بيانات تحديث الحكم غير صالحة.";
    res.status(400).json({ error: errorMsg });
    return;
  }

  try {
    const existing = await postgresService.getJudgmentById(id, officeId);
    if (!existing || !canUserAccessRecord(existing, req.authUser)) {
      res.status(404).json({ error: "الحكم غير موجود." });
      return;
    }

    const body = req.body as any;
    const payload: any = {
      caseNumber: body.caseNumber?.trim(),
      court: body.court?.trim(),
      plaintiff: body.plaintiff?.trim(),
      defendant: body.defendant?.trim(),
      assignedLawyer: body.assignedLawyer?.trim(),
      judgmentNumber: body.judgmentNumber?.trim(),
      judgmentDate: body.judgmentDate?.trim(),
      summary: body.summary?.trim(),
      isFavorable: body.isFavorable,
    };

    if (body.clientId !== undefined || body.client_id !== undefined) {
      payload.clientId = body.clientId !== undefined ? body.clientId : body.client_id;
    }
    if (body.clientRole !== undefined || body.client_role !== undefined) {
      payload.clientRole = body.clientRole !== undefined ? body.clientRole : body.client_role;
    }

    if (req.authUser?.role === "staff") {
      delete payload.assignedLawyerId;
      delete payload.assigned_lawyer_id;
    } else if (body.assignedLawyerId !== undefined || body.assigned_lawyer_id !== undefined) {
      const targetLawyer = body.assignedLawyerId !== undefined ? body.assignedLawyerId : body.assigned_lawyer_id;
      if (targetLawyer) {
        const val = await validateOfficeLawyer(targetLawyer, officeId);
        if (!val.valid) {
          res.status(400).json({ error: val.error || "المحامي غير صالح." });
          return;
        }
        if (val.lawyerName && !payload.assignedLawyer) {
          payload.assignedLawyer = val.lawyerName;
        }
      }
      payload.assignedLawyerId = targetLawyer;
    }

    const updated = await postgresService.updateJudgment(id, payload, officeId);

    if (!updated) {
      res.status(404).json({ error: "الحكم غير موجود." });
      return;
    }

    logger.info({ id, officeId }, "Judgment record updated in database");
    res.json(updated);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err, id }, "Failed to update judgment");
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل تحديث الحكم");
  }
});

/**
 * PATCH /api/judgments/:id/reassign
 * Admin-only: reassign a judgment to an office lawyer or unassign.
 */
router.patch("/judgments/:id/reassign", async (req, res) => {
  if (req.authUser?.role === "staff") {
    res.status(403).json({ error: "إعادة التعيين مقتصرة على مشرف المكتب." });
    return;
  }
  const officeId = getOfficeId(req);
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف الحكم غير صالح." });
    return;
  }

  const parseResult = ReassignJudgmentSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "بيانات إعادة تعيين الحكم غير صالحة." });
    return;
  }

  const targetLawyerId = req.body?.assignedLawyerId !== undefined ? req.body.assignedLawyerId : req.body?.assigned_lawyer_id;
  let lawyerName: string | undefined;

  if (targetLawyerId) {
    const val = await validateOfficeLawyer(targetLawyerId, officeId);
    if (!val.valid) {
      res.status(400).json({ error: val.error || "المحامي غير صالح." });
      return;
    }
    lawyerName = val.lawyerName;
  }

  try {
    const existing = await postgresService.getJudgmentById(id, officeId);
    if (!existing) {
      res.status(404).json({ error: "الحكم غير موجود." });
      return;
    }

    const updated = await postgresService.reassignJudgment(id, targetLawyerId || null, officeId, lawyerName);

    // Trigger assignment notification for lawyer (in-app + WhatsApp)
    if (updated && targetLawyerId) {
      void notifyLawyerAssignment({
        officeId,
        assignerId: req.authUser?.userId,
        targetLawyerId,
        previousLawyerId: existing.assignedLawyerId,
        recordType: "judgment",
        recordTypeArabic: "حكم قضائي",
        recordId: id,
        recordDescription: updated.judgmentNumber ? `حكم رقم ${updated.judgmentNumber}` : (updated.caseNumber ? `حكم قضية ${updated.caseNumber}` : `حكم #${id}`),
        directLink: `/judgments`,
      });
    }

    res.json(updated);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err, id }, "Failed to reassign judgment");
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل إعادة تعيين الحكم");
  }
});

/**
 * DELETE /api/judgments/:id
 * Deletes a Judgment record by id. Verifies office ownership and scoping, returning 404 if not found.
 */
router.delete("/judgments/:id", async (req, res) => {
  const officeId = getOfficeId(req);
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف الحكم غير صالح." });
    return;
  }

  try {
    const existing = await postgresService.getJudgmentById(id, officeId);
    if (!existing || !canUserAccessRecord(existing, req.authUser)) {
      res.status(404).json({ error: "الحكم غير موجود." });
      return;
    }

    const deleted = await postgresService.deleteJudgment(id, officeId);
    if (!deleted) {
      res.status(404).json({ error: "الحكم غير موجود." });
      return;
    }
    logger.info({ id, officeId }, "Judgment record deleted from database");
    res.status(204).send();
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err, id }, "Failed to delete judgment");
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل حذف الحكم");
  }
});

export default router;
