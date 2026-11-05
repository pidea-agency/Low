import { Router, type IRouter } from "express";
import { attachAuthUser, requireAuth, requireActiveSubscription, blockSuperAdminFromOfficeData } from "../middlewares/auth.middleware";
import { logger } from "../lib/logger";
import * as postgresService from "../services/postgres.service";
import type { PoaRecord } from "../services/postgres.service";
import { canUserAccessRecord, validateOfficeLawyer } from "../utils/record-access";

const router: IRouter = Router();

function generateRefId(): string {
  return `REF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

// Stop all POA operations if subscription is suspended or expired
// Super Admins are blocked from office POA data
router.use("/poa", attachAuthUser, requireAuth, blockSuperAdminFromOfficeData, requireActiveSubscription);

function getOfficeId(req: any): string {
  const officeId = req.authUser?.officeId || req.authUser?.userId;
  if (!officeId) {
    throw new Error("غير مصرح: معرف المكتب مفقود.");
  }
  return officeId;
}

function formatPoa(p: PoaRecord) {
  return {
    ...p,
    sheetRowId: p.id,
  };
}

/**
 * GET /api/poa
 * Lists all Power of Attorney records belonging to the authenticated office.
 */
router.get("/poa", async (req, res) => {
  const officeId = getOfficeId(req);
  try {
    let list = await postgresService.listPoa(officeId);
    if (req.authUser?.role === "staff") {
      list = list.filter((p) => canUserAccessRecord(p, req.authUser));
    }
    res.json(list.map(formatPoa));
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to list POA records");
    res.status(500).json({ error: `فشل تحميل بيانات الوكالات. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * GET /api/poa/:rowId
 * Gets a single POA record by id.
 */
router.get("/poa/:rowId", async (req, res) => {
  const officeId = getOfficeId(req);
  const rowId = parseInt(String(req.params.rowId), 10);
  if (isNaN(rowId)) {
    res.status(400).json({ error: "معرف الوكالة غير صالح." });
    return;
  }

  try {
    const poa = await postgresService.getPoaById(rowId, officeId);
    if (!poa || !canUserAccessRecord(poa, req.authUser)) {
      res.status(404).json({ error: "الوكالة غير موجودة." });
      return;
    }
    res.json(formatPoa(poa));
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err, rowId }, "Failed to get POA record");
    res.status(500).json({ error: `فشل تحميل بيانات الوكالة. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * POST /api/poa
 * Creates a new Power of Attorney record stamped with the caller's office.
 */
router.post("/poa", async (req, res) => {
  const officeId = getOfficeId(req);
  const body = req.body as any;
  if (!body.clientName?.trim() || !body.poaNumber?.trim()) {
    res.status(400).json({ error: "اسم العميل ورقم الوكالة مطلوبان." });
    return;
  }

  const clientId = body.clientId || body.client_id || null;
  let assignedLawyerId = body.assignedLawyerId || body.assigned_lawyer_id || null;
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

  try {
    const created = await postgresService.createPoa(
      {
        clientName: body.clientName.trim(),
        poaNumber: body.poaNumber.trim(),
        issueDateHijri: body.issueDateHijri?.trim() || "",
        expiryDateHijri: body.expiryDateHijri?.trim() || "",
        daysRemaining: body.daysRemaining !== undefined ? Number(body.daysRemaining) : undefined,
        notes: body.notes?.trim() || "",
        clientId,
        assignedLawyerId,
        createdBy,
      },
      officeId,
    );
    logger.info({ id: created.id, officeId }, "POA record created in database");
    res.status(201).json(formatPoa(created));
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to create POA record");
    res.status(500).json({ error: `فشل حفظ الوكالة. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * PUT /api/poa/:rowId
 * Updates an existing POA record. Verifies office ownership and scoping, returning 404 if not found.
 */
router.put("/poa/:rowId", async (req, res) => {
  const officeId = getOfficeId(req);
  const rowId = parseInt(String(req.params.rowId), 10);
  if (isNaN(rowId)) {
    res.status(400).json({ error: "معرف الوكالة غير صالح." });
    return;
  }

  try {
    const existing = await postgresService.getPoaById(rowId, officeId);
    if (!existing || !canUserAccessRecord(existing, req.authUser)) {
      res.status(404).json({ error: "الوكالة غير موجودة." });
      return;
    }

    const body = req.body as any;
    const payload: any = {
      clientName: body.clientName?.trim(),
      poaNumber: body.poaNumber?.trim(),
      issueDateHijri: body.issueDateHijri?.trim(),
      expiryDateHijri: body.expiryDateHijri?.trim(),
      daysRemaining: body.daysRemaining !== undefined ? Number(body.daysRemaining) : undefined,
      notes: body.notes?.trim(),
    };

    if (body.clientId !== undefined || body.client_id !== undefined) {
      payload.clientId = body.clientId !== undefined ? body.clientId : body.client_id;
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
      payload.assignedLawyerId = targetLawyer;
    }

    const updated = await postgresService.updatePoa(rowId, payload, officeId);

    if (!updated) {
      res.status(404).json({ error: "الوكالة غير موجودة." });
      return;
    }

    logger.info({ id: rowId, officeId }, "POA record updated in database");
    res.json(formatPoa(updated));
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err, rowId }, "Failed to update POA record");
    res.status(500).json({ error: `فشل تحديث الوكالة. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * PATCH /api/poa/:id/reassign
 * Admin-only: reassign a POA record to an office lawyer or unassign.
 */
router.patch("/poa/:id/reassign", async (req, res) => {
  if (req.authUser?.role === "staff") {
    res.status(403).json({ error: "إعادة التعيين مقتصرة على مشرف المكتب." });
    return;
  }
  const officeId = getOfficeId(req);
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف الوكالة غير صالح." });
    return;
  }

  const targetLawyerId = req.body?.assignedLawyerId !== undefined ? req.body.assignedLawyerId : req.body?.assigned_lawyer_id;

  if (targetLawyerId) {
    const val = await validateOfficeLawyer(targetLawyerId, officeId);
    if (!val.valid) {
      res.status(400).json({ error: val.error || "المحامي غير صالح." });
      return;
    }
  }

  try {
    const existing = await postgresService.getPoaById(id, officeId);
    if (!existing) {
      res.status(404).json({ error: "الوكالة غير موجودة." });
      return;
    }

    const updated = await postgresService.reassignPoa(id, targetLawyerId || null, officeId);
    if (!updated) {
      res.status(404).json({ error: "الوكالة غير موجودة." });
      return;
    }
    res.json(formatPoa(updated));
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err, id }, "Failed to reassign POA");
    res.status(500).json({ error: `فشل إعادة تعيين الوكالة. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * DELETE /api/poa/:rowId
 * Deletes a POA record by id. Verifies office ownership and scoping, returning 404 if not found.
 */
router.delete("/poa/:rowId", async (req, res) => {
  const officeId = getOfficeId(req);
  const rowId = parseInt(String(req.params.rowId), 10);
  if (isNaN(rowId)) {
    res.status(400).json({ error: "معرف الوكالة غير صالح." });
    return;
  }

  try {
    const existing = await postgresService.getPoaById(rowId, officeId);
    if (!existing || !canUserAccessRecord(existing, req.authUser)) {
      res.status(404).json({ error: "الوكالة غير موجودة." });
      return;
    }

    const deleted = await postgresService.deletePoa(rowId, officeId);
    if (!deleted) {
      res.status(404).json({ error: "الوكالة غير موجودة." });
      return;
    }
    logger.info({ id: rowId, officeId }, "POA record deleted from database");
    res.status(204).send();
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err, rowId }, "Failed to delete POA record");
    res.status(500).json({ error: `فشل حذف الوكالة. رقم المرجع: ${refId}`, refId });
  }
});

export default router;
