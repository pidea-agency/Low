import { Router, type IRouter } from "express";
import { attachAuthUser, requireAuth, requireActiveSubscription, blockSuperAdminFromOfficeData } from "../middlewares/auth.middleware";
import { logger } from "../lib/logger";
import { GoogleBindingMissingError, GoogleSettingsStoreError, GoogleSheetsError } from "../services/googleSheets.service";
import {
  ensurePoaSheetReady,
  listPoaRows,
  appendPoaRow,
  updatePoaRow,
  deletePoaRow,
  getPoaRowById,
} from "../services/poa.sheets.service";
import moment from "moment-hijri";

const router: IRouter = Router();

function generateRefId(): string {
  return `REF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

function handlePoaError(res: any, err: any, defaultMsg: string): void {
  if (err instanceof GoogleBindingMissingError) {
    res.status(409).json({
      error: `ربط المكتب غير مكتمل. تواصل مع المشرف. رقم المرجع: ${err.refId}`,
      code: "GOOGLE_BINDING_INCOMPLETE",
      refId: err.refId,
    });
    return;
  }
  if (err instanceof GoogleSettingsStoreError) {
    res.status(503).json({
      error: `تعذر الوصول إلى مخزن إعدادات المكتب. يرجى المحاولة لاحقاً. رقم المرجع: ${err.refId}`,
      code: "SETTINGS_STORE_UNAVAILABLE",
      refId: err.refId,
    });
    return;
  }
  if (err instanceof GoogleSheetsError) {
    res.status(err.statusCode).json({
      error: `${err.userMessage} رقم المرجع: ${err.refId}`,
      refId: err.refId,
      code: err.name,
    });
    return;
  }

  const refId = generateRefId();
  logger.error(
    {
      refId,
      errName: err?.name,
      errCode: err?.code,
      message: err?.message || String(err),
    },
    defaultMsg,
  );
  res.status(500).json({
    error: `${defaultMsg} رقم المرجع: ${refId}`,
    refId,
    code: "INTERNAL_ERROR",
  });
}

// Stop all POA Excel Sheet read/write operations if subscription is suspended or expired
// Super Admins are blocked from office POA data
router.use("/poa", attachAuthUser, requireAuth, blockSuperAdminFromOfficeData, requireActiveSubscription);

interface PoaRecord {
  clientName: string;
  poaNumber: string;
  issueDateHijri: string;
  expiryDateHijri: string;
  daysRemaining: number;
  notes?: string;
  createdAt: string;
  officeId?: string;
}

/**
 * Calculates days remaining from a Hijri date string (DD/MM/YYYY or YYYY/MM/DD).
 */
function calcDaysFromHijri(hijriDateStr: string): number {
  if (!hijriDateStr?.trim()) return 0;
  try {
    const parts = hijriDateStr.trim().split(/[\/\.-]/);
    if (parts.length === 3) {
      let day: number, month: number, year: number;
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      }
      if (year > 1300 && year < 1600 && month >= 1 && month <= 12 && day >= 1 && day <= 30) {
        const mExpiry = moment(`${year}/${month}/${day}`, "iYYYY/iM/iD");
        if (mExpiry.isValid()) {
          return mExpiry.diff(moment().startOf("day"), "days");
        }
      }
    }
  } catch (_) {}
  return 0;
}

function rowToRecord(values: string[]): PoaRecord {
  return {
    clientName: values[0] || "",
    poaNumber: values[1] || "",
    issueDateHijri: values[2] || "",
    expiryDateHijri: values[3] || "",
    daysRemaining: values[4] && values[4].trim() !== ""
      ? Number(values[4])
      : calcDaysFromHijri(values[3] || ""),
    notes: values[5] || "",
    createdAt: values[6] || new Date().toISOString(),
    officeId: values[7] || "",
  };
}

function recordToRow(record: PoaRecord, officeId: string): string[] {
  return [
    record.clientName,
    record.poaNumber,
    record.issueDateHijri,
    record.expiryDateHijri,
    String(record.daysRemaining ?? 0),
    record.notes || "",
    record.createdAt || new Date().toISOString(),
    officeId,
  ];
}

/**
 * GET /api/poa
 * Lists all Power of Attorney records belonging to the authenticated office.
 */
router.get("/poa", attachAuthUser, requireAuth, async (req, res) => {
  const officeId = req.authUser?.userId || req.authUser?.username;
  if (!officeId) {
    res.status(401).json({ error: "غير مصرح." });
    return;
  }

  try {
    await ensurePoaSheetReady(officeId);
    const forceRefresh = req.query.refresh === "true";
    const rows = await listPoaRows(officeId, forceRefresh);
    const records = rows.map(({ id, values }) => ({
      ...rowToRecord(values),
      sheetRowId: id,
    }));
    res.json(records);
  } catch (err) {
    handlePoaError(res, err, "فشل تحميل بيانات الوكالات.");
  }
});

/**
 * POST /api/poa
 * Creates a new Power of Attorney record stamped with the caller's office.
 */
router.post("/poa", attachAuthUser, requireAuth, async (req, res) => {
  const officeId = req.authUser?.userId || req.authUser?.username;
  if (!officeId) {
    res.status(401).json({ error: "غير مصرح." });
    return;
  }

  const body = req.body as Partial<PoaRecord>;
  if (!body.clientName?.trim() || !body.poaNumber?.trim()) {
    res.status(400).json({ error: "اسم العميل ورقم الوكالة مطلوبان." });
    return;
  }

  try {
    await ensurePoaSheetReady(officeId);
    const record: PoaRecord = {
      clientName: body.clientName.trim(),
      poaNumber: body.poaNumber.trim(),
      issueDateHijri: body.issueDateHijri?.trim() || "",
      expiryDateHijri: body.expiryDateHijri?.trim() || "",
      daysRemaining: Number(body.daysRemaining) || 0,
      notes: body.notes?.trim() || "",
      createdAt: new Date().toISOString(),
      officeId, // Always use authenticated session officeId
    };

    const rowId = await appendPoaRow(officeId, recordToRow(record, officeId));

    // Read-after-write verification: confirm existence in sheet before replying
    const verified = await getPoaRowById(officeId, rowId);
    if (!verified) {
      throw new GoogleSheetsError(
        `POA record with rowId ${rowId} could not be confirmed upon re-reading.`,
        502,
        "تمت كتابة الوكالة ولكن تعذر التحقق من وجودها في الشيت.",
      );
    }

    const savedRecord = { ...rowToRecord(verified.values), sheetRowId: verified.id };
    logger.info({ rowId, officeId }, "POA record created and verified");
    res.status(201).json(savedRecord);
  } catch (err) {
    handlePoaError(res, err, "فشل حفظ الوكالة.");
  }
});

/**
 * PUT /api/poa/:rowId
 * Updates an existing POA record. Verifies office ownership, returning 404 if not found or unauthorized.
 */
router.put("/poa/:rowId", attachAuthUser, requireAuth, async (req, res) => {
  const officeId = req.authUser?.userId || req.authUser?.username;
  if (!officeId) {
    res.status(401).json({ error: "غير مصرح." });
    return;
  }

  const rowId = parseInt(String(req.params.rowId), 10);
  if (isNaN(rowId)) {
    res.status(400).json({ error: "معرف الصف غير صالح." });
    return;
  }

  const body = req.body as Partial<PoaRecord>;
  try {
    await ensurePoaSheetReady(officeId);
    const existing = await getPoaRowById(officeId, rowId);
    if (!existing) {
      res.status(404).json({ error: "الوكالة غير موجودة." });
      return;
    }

    const existingRecord = rowToRecord(existing.values);
    const updated: PoaRecord = {
      ...existingRecord,
      clientName: body.clientName?.trim() || existingRecord.clientName,
      poaNumber: body.poaNumber?.trim() || existingRecord.poaNumber,
      issueDateHijri: body.issueDateHijri?.trim() ?? existingRecord.issueDateHijri,
      expiryDateHijri: body.expiryDateHijri?.trim() ?? existingRecord.expiryDateHijri,
      daysRemaining: body.daysRemaining !== undefined ? Number(body.daysRemaining) : existingRecord.daysRemaining,
      notes: body.notes?.trim() ?? existingRecord.notes,
      officeId, // Preserve caller's office
    };

    await updatePoaRow(officeId, rowId, recordToRow(updated, officeId));
    logger.info({ rowId, officeId }, "POA record updated");
    res.json({ ...updated, sheetRowId: rowId });
  } catch (err) {
    handlePoaError(res, err, "فشل تحديث الوكالة.");
  }
});

/**
 * DELETE /api/poa/:rowId
 * Deletes a POA record by its 1-based sheet row id. Verifies office ownership, returning 404 if not found or unauthorized.
 */
router.delete("/poa/:rowId", attachAuthUser, requireAuth, async (req, res) => {
  const officeId = req.authUser?.userId || req.authUser?.username;
  if (!officeId) {
    res.status(401).json({ error: "غير مصرح." });
    return;
  }

  const rowId = parseInt(String(req.params.rowId), 10);
  if (isNaN(rowId)) {
    res.status(400).json({ error: "معرف الصف غير صالح." });
    return;
  }

  try {
    const existing = await getPoaRowById(officeId, rowId);
    if (!existing) {
      res.status(404).json({ error: "الوكالة غير موجودة." });
      return;
    }

    await deletePoaRow(officeId, rowId);
    logger.info({ rowId, officeId }, "POA record deleted");
    res.status(204).send();
  } catch (err) {
    handlePoaError(res, err, "فشل حذف الوكالة.");
  }
});

export default router;
