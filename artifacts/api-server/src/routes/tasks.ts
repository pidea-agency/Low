import { Router, type IRouter } from "express";
import { attachAuthUser, requireAuth, requireActiveSubscription, blockSuperAdminFromOfficeData } from "../middlewares/auth.middleware";
import { logger } from "../lib/logger";
import { GoogleBindingMissingError, GoogleSettingsStoreError, GoogleSheetsError } from "../services/googleSheets.service";
import {
  ensureTaskSheetReady,
  listTaskRowsWithHeaders,
  appendTaskRow,
  updateTaskRow,
  deleteTaskRow,
  getTaskRowById,
  TASK_SHEET_COLUMNS,
} from "../services/task.sheets.service";
import { WhatsappReminderChannel } from "../services/reminder/channels/whatsappChannel";

const router: IRouter = Router();

function generateRefId(): string {
  return `REF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

function handleTaskError(res: any, err: any, defaultMsg: string): void {
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

// Stop all Tasks Excel Sheet read/write operations if subscription is suspended or expired
// Super Admins are blocked from office tasks data
router.use("/tasks", attachAuthUser, requireAuth, blockSuperAdminFromOfficeData, requireActiveSubscription);

export interface TaskRecord {
  id: number;
  title: string;
  assignee: string;
  priority: "عاجلة" | "عادية";
  dueDate: string;
  remainingDays: string;
  status: "قيد التنفيذ" | "مكتملة" | "مؤجلة" | "معلقة";
  notes: string;
  createdAt: string;
  officeId?: string;
}

/** Canonical column header → field key mapping */
const FIELD_KEYS: Record<string, keyof Omit<TaskRecord, "id">> = {
  "عنوان المهمة":        "title",
  "المكلف":             "assignee",
  "الأولوية":           "priority",
  "تاريخ التسليم":      "dueDate",
  "عدد الأيام المتبقية": "remainingDays",
  "الحالة":             "status",
  "ملاحظات":            "notes",
  "تاريخ الإنشاء":      "createdAt",
  "معرف المكتب":         "officeId",
};

/** Calculates remaining days from a YYYY-MM-DD date string. */
function calcRemainingDays(dueDate: string): string {
  if (!dueDate) return "";
  const due = new Date(dueDate);
  due.setHours(23, 59, 59, 999);
  const now = new Date();
  const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return `متأخر ${Math.abs(days)} يوم`;
  if (days === 0) return "اليوم";
  return `${days} يوم`;
}

/**
 * Maps a raw Google Sheets row to a TaskRecord using the actual sheet headers.
 */
function rowToRecord(id: number, values: string[], headers: string[]): TaskRecord {
  const record: Partial<Omit<TaskRecord, "id">> = {};
  headers.forEach((header, colIdx) => {
    const fieldKey = FIELD_KEYS[header.trim()];
    if (fieldKey) {
      (record as Record<string, string>)[fieldKey] = (values[colIdx] ?? "").trim();
    }
  });

  return {
    id,
    title:         record.title         || "",
    assignee:      record.assignee      || "",
    priority:      (record.priority as TaskRecord["priority"]) || "عادية",
    dueDate:       record.dueDate       || "",
    remainingDays: record.remainingDays || "",
    status:        (record.status as TaskRecord["status"]) || "قيد التنفيذ",
    notes:         record.notes         || "",
    createdAt:     record.createdAt     || new Date().toISOString(),
    officeId:      record.officeId      || "",
  };
}

/**
 * Converts a TaskRecord back to a row array ordered by TASK_SHEET_COLUMNS.
 */
function recordToRow(record: Omit<TaskRecord, "id">, officeId: string): string[] {
  return [
    record.title         || "",  // A: عنوان المهمة
    record.assignee      || "",  // B: المكلف
    record.priority      || "",  // C: الأولوية
    record.dueDate       || "",  // D: تاريخ التسليم
    calcRemainingDays(record.dueDate), // E: عدد الأيام المتبقية (auto)
    record.status        || "قيد التنفيذ", // F: الحالة
    record.notes         || "",  // G: ملاحظات
    record.createdAt     || new Date().toISOString(), // H: تاريخ الإنشاء
    officeId,                    // I: معرف المكتب
  ];
}

/**
 * GET /api/tasks
 * Lists all Task records belonging to the authenticated office.
 */
router.get("/tasks", attachAuthUser, requireAuth, async (req, res) => {
  const officeId = req.authUser?.userId || req.authUser?.username;
  if (!officeId) {
    res.status(401).json({ error: "غير مصرح." });
    return;
  }

  try {
    await ensureTaskSheetReady(officeId);
    const forceRefresh = req.query.refresh === "true";
    const { headers, rows } = await listTaskRowsWithHeaders(officeId, forceRefresh);
    const records = rows.map(({ id, values }) => rowToRecord(id, values, headers));
    res.json(records);
  } catch (err) {
    handleTaskError(res, err, "فشل تحميل بيانات المهام.");
  }
});

/**
 * GET /api/tasks/:id
 * Gets a single Task record by row id. Verifies office ownership, returning 404 if not found or unauthorized.
 */
router.get("/tasks/:id", attachAuthUser, requireAuth, async (req, res) => {
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
    await ensureTaskSheetReady(officeId);
    const match = await getTaskRowById(officeId, id);
    if (!match) {
      res.status(404).json({ error: "المهمة غير موجودة." });
      return;
    }
    res.json(rowToRecord(match.id, match.values, match.headers));
  } catch (err) {
    handleTaskError(res, err, "فشل تحميل بيانات المهمة.");
  }
});

/**
 * POST /api/tasks
 * Creates a new Task record in the "Tasks" sheet stamped with caller's office.
 */
router.post("/tasks", attachAuthUser, requireAuth, async (req, res) => {
  const officeId = req.authUser?.userId || req.authUser?.username;
  if (!officeId) {
    res.status(401).json({ error: "غير مصرح." });
    return;
  }

  const body = req.body as Partial<TaskRecord>;
  if (!body.title?.trim()) {
    res.status(400).json({ error: "عنوان المهمة مطلوب." });
    return;
  }

  try {
    await ensureTaskSheetReady(officeId);
    const record: Omit<TaskRecord, "id"> = {
      title: body.title.trim(),
      assignee: body.assignee?.trim() || "",
      priority: (body.priority as TaskRecord["priority"]) || "عادية",
      dueDate: body.dueDate?.trim() || "",
      remainingDays: calcRemainingDays(body.dueDate || ""),
      status: (body.status as TaskRecord["status"]) || "قيد التنفيذ",
      notes: body.notes?.trim() || "",
      createdAt: new Date().toISOString(),
      officeId, // Always use authenticated session officeId
    };

    const rowId = await appendTaskRow(officeId, recordToRow(record, officeId));

    // Read-after-write verification: confirm existence in sheet before replying
    const verified = await getTaskRowById(officeId, rowId);
    if (!verified) {
      throw new GoogleSheetsError(
        `Task record with rowId ${rowId} could not be confirmed upon re-reading.`,
        502,
        "تمت كتابة المهمة ولكن تعذر التحقق من وجودها في الشيت.",
      );
    }

    const createdRecord = rowToRecord(verified.id, verified.values, verified.headers);
    logger.info({ rowId, officeId }, "Task record created and verified");
    res.status(201).json(createdRecord);
  } catch (err) {
    handleTaskError(res, err, "فشل حفظ المهمة.");
  }
});

/**
 * PUT /api/tasks/:id
 * Updates an existing Task record. Verifies office ownership, returning 404 if not found or unauthorized.
 */
router.put("/tasks/:id", attachAuthUser, requireAuth, async (req, res) => {
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

  const body = req.body as Partial<TaskRecord>;
  try {
    await ensureTaskSheetReady(officeId);
    const existing = await getTaskRowById(officeId, id);
    if (!existing) {
      res.status(404).json({ error: "المهمة غير موجودة." });
      return;
    }

    const current = rowToRecord(existing.id, existing.values, existing.headers);
    const updated: Omit<TaskRecord, "id"> = {
      title: body.title !== undefined ? body.title.trim() : current.title,
      assignee: body.assignee !== undefined ? body.assignee.trim() : current.assignee,
      priority: (body.priority as TaskRecord["priority"]) || current.priority,
      dueDate: body.dueDate !== undefined ? body.dueDate.trim() : current.dueDate,
      remainingDays: calcRemainingDays(body.dueDate !== undefined ? body.dueDate : current.dueDate),
      status: (body.status as TaskRecord["status"]) || current.status,
      notes: body.notes !== undefined ? body.notes.trim() : current.notes,
      createdAt: current.createdAt,
      officeId, // Preserve caller's office
    };

    await updateTaskRow(officeId, id, recordToRow(updated, officeId));
    logger.info({ id, officeId }, "Task record updated");
    res.json({ id, ...updated });
  } catch (err) {
    handleTaskError(res, err, "فشل تحديث المهمة.");
  }
});

/**
 * DELETE /api/tasks/:id
 * Deletes a Task record by row id. Verifies office ownership, returning 404 if not found or unauthorized.
 */
router.delete("/tasks/:id", attachAuthUser, requireAuth, async (req, res) => {
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
    const existing = await getTaskRowById(officeId, id);
    if (!existing) {
      res.status(404).json({ error: "المهمة غير موجودة." });
      return;
    }

    await deleteTaskRow(officeId, id);
    logger.info({ id, officeId }, "Task record deleted");
    res.status(204).send();
  } catch (err) {
    handleTaskError(res, err, "فشل حذف المهمة.");
  }
});

export default router;
