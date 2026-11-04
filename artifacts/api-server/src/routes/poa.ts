import { Router, type IRouter } from "express";
import { attachAuthUser, requireAuth, requireActiveSubscription, blockSuperAdminFromOfficeData } from "../middlewares/auth.middleware";
import { logger } from "../lib/logger";
import * as postgresService from "../services/postgres.service";
import type { PoaRecord } from "../services/postgres.service";

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
    const list = await postgresService.listPoa(officeId);
    res.json(list.map(formatPoa));
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to list POA records");
    res.status(500).json({ error: `فشل تحميل بيانات الوكالات. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * POST /api/poa
 * Creates a new Power of Attorney record stamped with the caller's office.
 */
router.post("/poa", async (req, res) => {
  const officeId = getOfficeId(req);
  const body = req.body as Partial<PoaRecord>;
  if (!body.clientName?.trim() || !body.poaNumber?.trim()) {
    res.status(400).json({ error: "اسم العميل ورقم الوكالة مطلوبان." });
    return;
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
 * Updates an existing POA record. Verifies office ownership, returning 404 if not found.
 */
router.put("/poa/:rowId", async (req, res) => {
  const officeId = getOfficeId(req);
  const rowId = parseInt(String(req.params.rowId), 10);
  if (isNaN(rowId)) {
    res.status(400).json({ error: "معرف الوكالة غير صالح." });
    return;
  }

  const body = req.body as Partial<PoaRecord>;
  try {
    const updated = await postgresService.updatePoa(
      rowId,
      {
        clientName: body.clientName?.trim(),
        poaNumber: body.poaNumber?.trim(),
        issueDateHijri: body.issueDateHijri?.trim(),
        expiryDateHijri: body.expiryDateHijri?.trim(),
        daysRemaining: body.daysRemaining !== undefined ? Number(body.daysRemaining) : undefined,
        notes: body.notes?.trim(),
      },
      officeId,
    );

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
 * DELETE /api/poa/:rowId
 * Deletes a POA record by id. Verifies office ownership, returning 404 if not found.
 */
router.delete("/poa/:rowId", async (req, res) => {
  const officeId = getOfficeId(req);
  const rowId = parseInt(String(req.params.rowId), 10);
  if (isNaN(rowId)) {
    res.status(400).json({ error: "معرف الوكالة غير صالح." });
    return;
  }

  try {
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
