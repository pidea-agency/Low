import { Router, type IRouter } from "express";
import { attachAuthUser, requireAuth, requireActiveSubscription, blockSuperAdminFromOfficeData } from "../middlewares/auth.middleware";
import { logger } from "../lib/logger";
import * as postgresService from "../services/postgres.service";
import type { JudgmentRecord } from "../services/postgres.service";

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
    const list = await postgresService.listJudgments(officeId);
    res.json(list);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to list judgments");
    res.status(500).json({ error: `فشل تحميل بيانات الأحكام. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * GET /api/judgments/:id
 * Gets a single Judgment record by id. Verifies office ownership, returning 404 if not found.
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
    if (!judgment) {
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
  const body = req.body as Partial<JudgmentRecord>;
  if (!body.caseNumber?.trim() || !body.judgmentNumber?.trim()) {
    res.status(400).json({ error: "رقم القضية ورقم الصك مطلوبان." });
    return;
  }

  try {
    const created = await postgresService.createJudgment(
      {
        caseNumber: body.caseNumber.trim(),
        court: body.court?.trim() || "",
        plaintiff: body.plaintiff?.trim() || "",
        defendant: body.defendant?.trim() || "",
        assignedLawyer: body.assignedLawyer?.trim() || "",
        judgmentNumber: body.judgmentNumber.trim(),
        judgmentDate: body.judgmentDate?.trim() || "",
        summary: body.summary?.trim() || "",
        isFavorable: body.isFavorable || "نهائي",
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
 * Updates an existing Judgment record. Verifies office ownership, returning 404 if not found.
 */
router.put("/judgments/:id", async (req, res) => {
  const officeId = getOfficeId(req);
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف الحكم غير صالح." });
    return;
  }

  const body = req.body as Partial<JudgmentRecord>;
  try {
    const updated = await postgresService.updateJudgment(
      id,
      {
        caseNumber: body.caseNumber?.trim(),
        court: body.court?.trim(),
        plaintiff: body.plaintiff?.trim(),
        defendant: body.defendant?.trim(),
        assignedLawyer: body.assignedLawyer?.trim(),
        judgmentNumber: body.judgmentNumber?.trim(),
        judgmentDate: body.judgmentDate?.trim(),
        summary: body.summary?.trim(),
        isFavorable: body.isFavorable,
      },
      officeId,
    );

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
 * DELETE /api/judgments/:id
 * Deletes a Judgment record by id. Verifies office ownership, returning 404 if not found.
 */
router.delete("/judgments/:id", async (req, res) => {
  const officeId = getOfficeId(req);
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف الحكم غير صالح." });
    return;
  }

  try {
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
