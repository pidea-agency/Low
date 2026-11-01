import { Router, type IRouter } from "express";
import { attachAuthUser, requireAuth, requireActiveSubscription } from "../middlewares/auth.middleware";
import { logger } from "../lib/logger";
import {
  ensureJudgmentSheetReady,
  listJudgmentRowsWithHeaders,
  appendJudgmentRow,
  updateJudgmentRow,
  deleteJudgmentRow,
  JUDGMENT_SHEET_COLUMNS,
} from "../services/judgment.sheets.service";

const router: IRouter = Router();

// Stop all Judgment Excel Sheet read/write operations if subscription is suspended or expired
router.use("/judgments", attachAuthUser, requireAuth, requireActiveSubscription);

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
}

function normalizeJudgmentType(val: string): "نهائي" | "ابتدائي" {
  const trimmed = (val || "").trim();
  if (trimmed === "ابتدائي" || trimmed === "لا") return "ابتدائي";
  return "نهائي";
}

/**
 * Canonical column names in the order they appear in JUDGMENT_SHEET_COLUMNS.
 * These are used to build a lookup index from header names to column positions.
 */
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
};

/**
 * Maps a raw Google Sheets row to a JudgmentRecord using the actual sheet headers.
 * This is the ONLY correct approach — it never relies on positional heuristics.
 * @param id      1-based row number in the sheet
 * @param values  Raw cell values from the sheet row
 * @param headers Header values from Row 1 of the sheet
 */
function rowToRecord(id: number, values: string[], headers: string[]): JudgmentRecord {
  // Build an index: fieldKey → cell value, driven by the actual sheet header row.
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
  };
}

/**
 * Converts a JudgmentRecord back to a row array ordered by JUDGMENT_SHEET_COLUMNS.
 * Always outputs exactly 10 values in the canonical column order.
 */
function recordToRow(record: Omit<JudgmentRecord, "id">): string[] {
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
  ];
}

/**
 * GET /api/judgments
 * Lists all Judgment records from the "Judgment" sheet.
 */
router.get("/judgments", attachAuthUser, requireAuth, async (req, res) => {
  try {
    await ensureJudgmentSheetReady();
    const forceRefresh = req.query.refresh === "true";
    const { headers, rows } = await listJudgmentRowsWithHeaders(forceRefresh);
    const records = rows.map(({ id, values }) => rowToRecord(id, values, headers));
    res.json(records);
  } catch (err) {
    logger.error({ err }, "Failed to list Judgment records");
    res.status(500).json({ error: "فشل تحميل بيانات الأحكام." });
  }
});

/**
 * GET /api/judgments/:id
 * Gets a single Judgment record by row id.
 */
router.get("/judgments/:id", attachAuthUser, requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف الصف غير صالح." });
    return;
  }
  try {
    await ensureJudgmentSheetReady();
    const { headers, rows } = await listJudgmentRowsWithHeaders();
    const match = rows.find((r) => r.id === id);
    if (!match) {
      res.status(404).json({ error: "الحكم غير موجود." });
      return;
    }
    res.json(rowToRecord(match.id, match.values, headers));
  } catch (err) {
    logger.error({ err }, "Failed to get Judgment record");
    res.status(500).json({ error: "فشل تحميل بيانات الحكم." });
  }
});

/**
 * POST /api/judgments
 * Creates a new Judgment record in the "Judgment" sheet.
 */
router.post("/judgments", attachAuthUser, requireAuth, async (req, res) => {
  const body = req.body as Partial<JudgmentRecord>;
  if (!body.judgmentNumber?.trim()) {
    res.status(400).json({ error: "رقم الصك مطلوب." });
    return;
  }
  try {
    await ensureJudgmentSheetReady();
    const recordPayload: Omit<JudgmentRecord, "id"> = {
      caseNumber: body.caseNumber?.trim() || "",
      court: body.court?.trim() || "",
      plaintiff: body.plaintiff?.trim() || "",
      defendant: body.defendant?.trim() || "",
      assignedLawyer: body.assignedLawyer?.trim() || "",
      judgmentNumber: body.judgmentNumber.trim(),
      judgmentDate: body.judgmentDate?.trim() || "",
      summary: body.summary?.trim() || "",
      isFavorable: normalizeJudgmentType(body.isFavorable || "نهائي"),
      createdAt: new Date().toISOString(),
    };
    const rowId = await appendJudgmentRow(recordToRow(recordPayload));
    logger.info({ rowId }, "Judgment record created");
    res.status(201).json({ id: rowId, ...recordPayload });
  } catch (err) {
    logger.error({ err }, "Failed to create Judgment record");
    res.status(500).json({ error: "فشل حفظ الحكم." });
  }
});

/**
 * PUT /api/judgments/:id
 * Updates an existing Judgment record. :id is the 1-based sheet row number.
 */
router.put("/judgments/:id", attachAuthUser, requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف الصف غير صالح." });
    return;
  }
  const body = req.body as Partial<JudgmentRecord>;
  try {
    await ensureJudgmentSheetReady();
    const { headers, rows } = await listJudgmentRowsWithHeaders();
    const existing = rows.find((r) => r.id === id);
    if (!existing) {
      res.status(404).json({ error: "الحكم غير موجود." });
      return;
    }
    const existingRecord = rowToRecord(id, existing.values, headers);
    const updatedPayload: Omit<JudgmentRecord, "id"> = {
      caseNumber: body.caseNumber !== undefined ? body.caseNumber.trim() : existingRecord.caseNumber,
      court: body.court !== undefined ? body.court.trim() : existingRecord.court,
      plaintiff: body.plaintiff !== undefined ? body.plaintiff.trim() : existingRecord.plaintiff,
      defendant: body.defendant !== undefined ? body.defendant.trim() : existingRecord.defendant,
      assignedLawyer: body.assignedLawyer !== undefined ? body.assignedLawyer.trim() : existingRecord.assignedLawyer,
      judgmentNumber: body.judgmentNumber !== undefined ? body.judgmentNumber.trim() : existingRecord.judgmentNumber,
      judgmentDate: body.judgmentDate !== undefined ? body.judgmentDate.trim() : existingRecord.judgmentDate,
      summary: body.summary !== undefined ? body.summary.trim() : existingRecord.summary,
      isFavorable: body.isFavorable !== undefined ? normalizeJudgmentType(body.isFavorable) : existingRecord.isFavorable,
      createdAt: existingRecord.createdAt,
    };
    await updateJudgmentRow(id, recordToRow(updatedPayload));
    logger.info({ id }, "Judgment record updated");
    res.json({ id, ...updatedPayload });
  } catch (err) {
    logger.error({ err }, "Failed to update Judgment record");
    res.status(500).json({ error: "فشل تحديث الحكم." });
  }
});

/**
 * DELETE /api/judgments/:id
 * Deletes a Judgment record by its 1-based sheet row id.
 */
router.delete("/judgments/:id", attachAuthUser, requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف الصف غير صالح." });
    return;
  }
  try {
    await deleteJudgmentRow(id);
    logger.info({ id }, "Judgment record deleted");
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Failed to delete Judgment record");
    res.status(500).json({ error: "فشل حذف الحكم." });
  }
});

export default router;
