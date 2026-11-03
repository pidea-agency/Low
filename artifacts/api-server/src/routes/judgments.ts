import { Router, type IRouter } from "express";
import { attachAuthUser, requireAuth, requireActiveSubscription, blockSuperAdminFromOfficeData } from "../middlewares/auth.middleware";
import { logger } from "../lib/logger";
import { GoogleBindingMissingError, GoogleSettingsStoreError, GoogleSheetsError } from "../services/googleSheets.service";
import {
  ensureJudgmentSheetReady,
  listJudgmentRowsWithHeaders,
  appendJudgmentRow,
  updateJudgmentRow,
  deleteJudgmentRow,
  getJudgmentRowById,
  JUDGMENT_SHEET_COLUMNS,
} from "../services/judgment.sheets.service";

const router: IRouter = Router();

function generateRefId(): string {
  return `REF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

function handleJudgmentError(res: any, err: any, defaultMsg: string): void {
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

// Stop all Judgment Excel Sheet read/write operations if subscription is suspended or expired
// Super Admins are blocked from office judgments data
router.use("/judgments", attachAuthUser, requireAuth, blockSuperAdminFromOfficeData, requireActiveSubscription);

export interface JudgmentRecord {
  id: number;
  caseNumber: string;
  court: string;
  plaintiff: string;
  defendant: string;
  assignedLawyer: string;
  judgmentNumber: string;
  judgmentDate: string;
  summary: string;
  isFavorable: "نهائي" | "ابتدائي" | string;
  createdAt: string;
  officeId?: string;
}

function normalizeJudgmentType(val: string): "نهائي" | "ابتدائي" {
  const trimmed = (val || "").trim();
  if (trimmed === "ابتدائي" || trimmed === "لا") return "ابتدائي";
  return "نهائي";
}

/** Canonical column header → field key mapping */
const FIELD_KEYS: Record<string, keyof Omit<JudgmentRecord, "id">> = {
  "رقم القضية":      "caseNumber",
  "المحكمة المختصة": "court",
  "المدعي":          "plaintiff",
  "المدعى عليه":     "defendant",
  "المحامي المكلف":  "assignedLawyer",
  "رقم الصك":        "judgmentNumber",
  "تاريخ الحكم":     "judgmentDate",
  "ملخص الحكم":      "summary",
  "الحكم":           "isFavorable",
  "تاريخ الإنشاء":   "createdAt",
  "معرف المكتب":      "officeId",
};

/**
 * Maps a raw Google Sheets row to a JudgmentRecord using the actual sheet headers.
 */
function rowToRecord(id: number, values: string[], headers: string[]): JudgmentRecord {
  const record: Partial<Omit<JudgmentRecord, "id">> = {};
  headers.forEach((header, colIdx) => {
    const fieldKey = FIELD_KEYS[header.trim()];
    if (fieldKey) {
      (record as Record<string, string>)[fieldKey] = (values[colIdx] ?? "").trim();
    }
  });

  return {
    id,
    caseNumber:    record.caseNumber    || "",
    court:         record.court         || "",
    plaintiff:     record.plaintiff     || "",
    defendant:     record.defendant     || "",
    assignedLawyer: record.assignedLawyer || "",
    judgmentNumber: record.judgmentNumber || "",
    judgmentDate:  record.judgmentDate  || "",
    summary:       record.summary       || "",
    isFavorable:   normalizeJudgmentType(record.isFavorable || ""),
    createdAt:     record.createdAt     || new Date().toISOString(),
    officeId:      record.officeId      || "",
  };
}

/**
 * Converts a JudgmentRecord back to a row array ordered by JUDGMENT_SHEET_COLUMNS.
 */
function recordToRow(record: Omit<JudgmentRecord, "id">, officeId: string): string[] {
  return [
    record.caseNumber || "",                           // A: رقم القضية
    record.court || "",                                // B: المحكمة المختصة
    record.plaintiff || "",                            // C: المدعي
    record.defendant || "",                            // D: المدعى عليه
    record.assignedLawyer || "",                       // E: المحامي المكلف
    record.judgmentNumber || "",                       // F: رقم الصك
    record.judgmentDate || "",                         // G: تاريخ الحكم
    record.summary || "",                              // H: ملخص الحكم
    normalizeJudgmentType(record.isFavorable),         // I: الحكم
    record.createdAt || new Date().toISOString(),      // J: تاريخ الإنشاء
    officeId,                                          // K: معرف المكتب
  ];
}

/**
 * GET /api/judgments
 * Lists all Judgment records belonging to the authenticated office.
 */
router.get("/judgments", attachAuthUser, requireAuth, async (req, res) => {
  const officeId = req.authUser?.userId || req.authUser?.username;
  if (!officeId) {
    res.status(401).json({ error: "غير مصرح." });
    return;
  }

  try {
    await ensureJudgmentSheetReady(officeId);
    const forceRefresh = req.query.refresh === "true";
    const { headers, rows } = await listJudgmentRowsWithHeaders(officeId, forceRefresh);
    const records = rows.map(({ id, values }) => rowToRecord(id, values, headers));
    res.json(records);
  } catch (err) {
    handleJudgmentError(res, err, "فشل تحميل بيانات الأحكام.");
  }
});

/**
 * GET /api/judgments/:id
 * Gets a single Judgment record by row id. Verifies office ownership, returning 404 if not found or unauthorized.
 */
router.get("/judgments/:id", attachAuthUser, requireAuth, async (req, res) => {
  const officeId = req.authUser?.userId || req.authUser?.username;
  if (!officeId) {
    res.status(401).json({ error: "غير مصرح." });
    return;
  }

  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف الصف غير صالح." });
    return;
  }

  try {
    await ensureJudgmentSheetReady(officeId);
    const match = await getJudgmentRowById(officeId, id);
    if (!match) {
      res.status(404).json({ error: "الحكم غير موجود." });
      return;
    }
    res.json(rowToRecord(match.id, match.values, match.headers));
  } catch (err) {
    handleJudgmentError(res, err, "فشل تحميل بيانات الحكم.");
  }
});

/**
 * POST /api/judgments
 * Creates a new Judgment record in the "Judgment" sheet stamped with caller's office.
 */
router.post("/judgments", attachAuthUser, requireAuth, async (req, res) => {
  const officeId = req.authUser?.userId || req.authUser?.username;
  if (!officeId) {
    res.status(401).json({ error: "غير مصرح." });
    return;
  }

  const body = req.body as Partial<JudgmentRecord>;
  if (!body.caseNumber?.trim()) {
    res.status(400).json({ error: "رقم القضية مطلوب." });
    return;
  }
  if (!body.judgmentNumber?.trim()) {
    res.status(400).json({ error: "رقم الصك مطلوب." });
    return;
  }

  try {
    await ensureJudgmentSheetReady(officeId);
    const record: Omit<JudgmentRecord, "id"> = {
      caseNumber:    body.caseNumber.trim(),
      court:         body.court?.trim() || "",
      plaintiff:     body.plaintiff?.trim() || "",
      defendant:     body.defendant?.trim() || "",
      assignedLawyer: body.assignedLawyer?.trim() || "",
      judgmentNumber: body.judgmentNumber.trim(),
      judgmentDate:  body.judgmentDate?.trim() || "",
      summary:       body.summary?.trim() || "",
      isFavorable:   normalizeJudgmentType(body.isFavorable || ""),
      createdAt:     new Date().toISOString(),
      officeId, // Always use authenticated session officeId
    };

    const rowId = await appendJudgmentRow(officeId, recordToRow(record, officeId));

    // Read-after-write verification: confirm existence in sheet before replying
    const verified = await getJudgmentRowById(officeId, rowId);
    if (!verified) {
      throw new GoogleSheetsError(
        `Judgment record with rowId ${rowId} could not be confirmed upon re-reading.`,
        502,
        "تمت كتابة الحكم ولكن تعذر التحقق من وجوده في الشيت.",
      );
    }

    const createdRecord = rowToRecord(verified.id, verified.values, verified.headers);
    logger.info({ rowId, officeId }, "Judgment record created and verified");
    res.status(201).json(createdRecord);
  } catch (err) {
    handleJudgmentError(res, err, "فشل حفظ الحكم.");
  }
});

/**
 * PUT /api/judgments/:id
 * Updates an existing Judgment record. Verifies office ownership, returning 404 if not found or unauthorized.
 */
router.put("/judgments/:id", attachAuthUser, requireAuth, async (req, res) => {
  const officeId = req.authUser?.userId || req.authUser?.username;
  if (!officeId) {
    res.status(401).json({ error: "غير مصرح." });
    return;
  }

  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف الصف غير صالح." });
    return;
  }

  const body = req.body as Partial<JudgmentRecord>;
  try {
    await ensureJudgmentSheetReady(officeId);
    const existing = await getJudgmentRowById(officeId, id);
    if (!existing) {
      res.status(404).json({ error: "الحكم غير موجود." });
      return;
    }

    const current = rowToRecord(existing.id, existing.values, existing.headers);
    const updated: Omit<JudgmentRecord, "id"> = {
      caseNumber:    body.caseNumber !== undefined ? body.caseNumber.trim() : current.caseNumber,
      court:         body.court !== undefined ? body.court.trim() : current.court,
      plaintiff:     body.plaintiff !== undefined ? body.plaintiff.trim() : current.plaintiff,
      defendant:     body.defendant !== undefined ? body.defendant.trim() : current.defendant,
      assignedLawyer: body.assignedLawyer !== undefined ? body.assignedLawyer.trim() : current.assignedLawyer,
      judgmentNumber: body.judgmentNumber !== undefined ? body.judgmentNumber.trim() : current.judgmentNumber,
      judgmentDate:  body.judgmentDate !== undefined ? body.judgmentDate.trim() : current.judgmentDate,
      summary:       body.summary !== undefined ? body.summary.trim() : current.summary,
      isFavorable:   body.isFavorable !== undefined ? normalizeJudgmentType(body.isFavorable) : current.isFavorable,
      createdAt:     current.createdAt,
      officeId, // Preserve caller's office
    };

    await updateJudgmentRow(officeId, id, recordToRow(updated, officeId));
    logger.info({ id, officeId }, "Judgment record updated");
    res.json({ id, ...updated });
  } catch (err) {
    handleJudgmentError(res, err, "فشل تحديث الحكم.");
  }
});

/**
 * DELETE /api/judgments/:id
 * Deletes a Judgment record by row id. Verifies office ownership, returning 404 if not found or unauthorized.
 */
router.delete("/judgments/:id", attachAuthUser, requireAuth, async (req, res) => {
  const officeId = req.authUser?.userId || req.authUser?.username;
  if (!officeId) {
    res.status(401).json({ error: "غير مصرح." });
    return;
  }

  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف الصف غير صالح." });
    return;
  }

  try {
    const existing = await getJudgmentRowById(officeId, id);
    if (!existing) {
      res.status(404).json({ error: "الحكم غير موجود." });
      return;
    }

    await deleteJudgmentRow(officeId, id);
    logger.info({ id, officeId }, "Judgment record deleted");
    res.status(204).send();
  } catch (err) {
    handleJudgmentError(res, err, "فشل حذف الحكم.");
  }
});

export default router;
