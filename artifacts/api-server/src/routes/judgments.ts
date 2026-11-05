import { Router, type IRouter } from "express";
import { attachAuthUser, requireAuth, requireActiveSubscription, blockSuperAdminFromOfficeData } from "../middlewares/auth.middleware";
import { logger } from "../lib/logger";
import * as postgresService from "../services/postgres.service";
import type { JudgmentRecord } from "../services/postgres.service";
import { canUserAccessRecord, validateOfficeLawyer } from "../utils/record-access";

export type { JudgmentRecord };

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
    res.status(500).json({ error: `فشل تحميل بيانات الأحكام. رقم المرجع: ${refId}`, refId });
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
    res.status(500).json({ error: `فشل تحميل بيانات الحكم. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * POST /api/judgments
 * Creates a new Judgment record stamped with the caller's office.
 */
router.post("/judgments", async (req, res) => {
  const officeId = getOfficeId(req);
  const body = req.body as any;
  if (!body.caseNumber?.trim() || !body.judgmentNumber?.trim()) {
    res.status(400).json({ error: "رقم القضية ورقم الصك مطلوبان." });
    return;
  }

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
    res.status(500).json({ error: `فشل حفظ الحكم. رقم المرجع: ${refId}`, refId });
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
    res.status(500).json({ error: `فشل تحديث الحكم. رقم المرجع: ${refId}`, refId });
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
    res.json(updated);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err, id }, "Failed to reassign judgment");
    res.status(500).json({ error: `فشل إعادة تعيين الحكم. رقم المرجع: ${refId}`, refId });
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
    res.status(500).json({ error: `فشل حذف الحكم. رقم المرجع: ${refId}`, refId });
  }
});

export default router;
