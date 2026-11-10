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
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل تحميل بيانات الوكالات");
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
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل تحميل بيانات الوكالة");
  }
});

/**
 * POST /api/poa
 * Creates a new Power of Attorney record stamped with the caller's office.
 * Requires clientId (linked client record) and poaNumber.
 */
router.post("/poa", async (req, res) => {
  const officeId = getOfficeId(req);
  const body = req.body as any;

  if (!body.poaNumber?.trim()) {
    res.status(400).json({ error: "رقم الوكالة مطلوب." });
    return;
  }

  const clientId = body.clientId || body.client_id || null;
  const caseId = body.caseId || body.case_id || null;
  if (!clientId) {
    res.status(400).json({ error: "يجب تحديد العميل المرتبط بالوكالة." });
    return;
  }

  try {
    const clientRecord = await postgresService.getClientById(clientId, officeId);
    if (!clientRecord) {
      res.status(400).json({ error: "العميل المحدد غير موجود في هذا المكتب." });
      return;
    }

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

    const created = await postgresService.createPoa(
      {
        clientName: clientRecord.name,
        poaNumber: body.poaNumber.trim(),
        issueDateHijri: body.issueDateHijri?.trim() || "",
        expiryDateHijri: body.expiryDateHijri?.trim() || "",
        daysRemaining: body.daysRemaining !== undefined ? Number(body.daysRemaining) : undefined,
        notes: body.notes?.trim() || "",
        clientId,
        caseId,
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
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل حفظ الوكالة");
  }
});

/**
 * PUT /api/poa/:rowId
 * Updates an existing POA record. Verifies office ownership and scoping, returning 404 if not found.
 * Enforces client_id on update.
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
      issueDateHijri: body.issueDateHijri?.trim(),
      expiryDateHijri: body.expiryDateHijri?.trim(),
      daysRemaining: body.daysRemaining !== undefined ? Number(body.daysRemaining) : undefined,
      notes: body.notes?.trim(),
    };

    if (body.poaNumber !== undefined) {
      if (!body.poaNumber.trim()) {
        res.status(400).json({ error: "رقم الوكالة مطلوب." });
        return;
      }
      payload.poaNumber = body.poaNumber.trim();
    }

    const targetClientId = body.clientId !== undefined
      ? body.clientId
      : body.client_id !== undefined
      ? body.client_id
      : (existing.clientId || (existing as any).client_id || null);

    if (!targetClientId) {
      res.status(400).json({ error: "يجب تحديد العميل المرتبط بالوكالة." });
      return;
    }

    const clientRecord = await postgresService.getClientById(targetClientId, officeId);
    if (!clientRecord) {
      res.status(400).json({ error: "العميل المحدد غير موجود في هذا المكتب." });
      return;
    }

    payload.clientId = targetClientId;
    payload.clientName = clientRecord.name;
    if (body.caseId !== undefined || body.case_id !== undefined) {
      payload.caseId = body.caseId !== undefined ? body.caseId : body.case_id;
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
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل تحديث الوكالة");
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
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل إعادة تعيين الوكالة");
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
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل حذف الوكالة");
  }
});

export default router;
