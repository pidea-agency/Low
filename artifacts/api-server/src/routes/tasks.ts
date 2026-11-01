import { Router, type IRouter } from "express";
import { attachAuthUser, requireAuth, requireActiveSubscription } from "../middlewares/auth.middleware";
import { logger } from "../lib/logger";
import {
  ensureTaskSheetReady,
  listTaskRowsWithHeaders,
  appendTaskRow,
  updateTaskRow,
  deleteTaskRow,
  TASK_SHEET_COLUMNS,
} from "../services/task.sheets.service";
import { WhatsappReminderChannel } from "../services/reminder/channels/whatsappChannel";

const router: IRouter = Router();

// Stop all Tasks Excel Sheet read/write operations if subscription is suspended or expired
router.use("/tasks", attachAuthUser, requireAuth, requireActiveSubscription);

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
}

/** Canonical column header → field key mapping */
const FIELD_KEYS: Record<string, keyof Omit<TaskRecord, "id">> = {
  "عنوان المهمة":      "title",
  "المكلف":           "assignee",
  "الأولوية":         "priority",
  "تاريخ التسليم":    "dueDate",
  "عدد الأيام المتبقية": "remainingDays",
  "الحالة":           "status",
  "ملاحظات":          "notes",
  "تاريخ الإنشاء":    "createdAt",
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
  };
}

/**
 * Converts a TaskRecord back to a row array ordered by TASK_SHEET_COLUMNS.
 * Always outputs exactly 8 values in the canonical column order.
 */
function recordToRow(record: Omit<TaskRecord, "id">): string[] {
  return [
    record.title         || "",  // A: عنوان المهمة
    record.assignee      || "",  // B: المكلف
    record.priority      || "",  // C: الأولوية
    record.dueDate       || "",  // D: تاريخ التسليم
    calcRemainingDays(record.dueDate), // E: عدد الأيام المتبقية (auto)
    record.status        || "",  // F: الحالة
    record.notes         || "",  // G: ملاحظات
    record.createdAt     || new Date().toISOString(), // H: تاريخ الإنشاء
  ];
}

/**
 * GET /api/tasks
 * Lists all Task records from the "Tasks" sheet.
 */
router.get("/tasks", attachAuthUser, requireAuth, async (req, res) => {
  try {
    await ensureTaskSheetReady();
    const forceRefresh = req.query.refresh === "true";
    const { headers, rows } = await listTaskRowsWithHeaders(forceRefresh);
    const records = rows.map(({ id, values }) => rowToRecord(id, values, headers));
    res.json(records);
  } catch (err) {
    logger.error({ err }, "Failed to list Task records");
    res.status(500).json({ error: "فشل تحميل بيانات المهام." });
  }
});

/**
 * POST /api/tasks
 * Creates a new Task record in the "Tasks" sheet.
 */
router.post("/tasks", attachAuthUser, requireAuth, async (req, res) => {
  const body = req.body as Partial<TaskRecord>;
  if (!body.title?.trim()) {
    res.status(400).json({ error: "عنوان المهمة مطلوب." });
    return;
  }
  try {
    await ensureTaskSheetReady();
    const recordPayload: Omit<TaskRecord, "id"> = {
      title:         body.title.trim(),
      assignee:      body.assignee?.trim()  || "",
      priority:      body.priority           || "عادية",
      dueDate:       body.dueDate?.trim()   || "",
      remainingDays: calcRemainingDays(body.dueDate?.trim() || ""),
      status:        body.status             || "قيد التنفيذ",
      notes:         body.notes?.trim()      || "",
      createdAt:     new Date().toISOString(),
    };
    const rowId = await appendTaskRow(recordToRow(recordPayload));
    logger.info({ rowId }, "Task record created");
    res.status(201).json({ id: rowId, ...recordPayload });
  } catch (err) {
    logger.error({ err }, "Failed to create Task record");
    res.status(500).json({ error: "فشل حفظ المهمة." });
  }
});

/**
 * PUT /api/tasks/:id
 * Updates an existing Task record. :id is the 1-based sheet row number.
 */
router.put("/tasks/:id", attachAuthUser, requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف الصف غير صالح." });
    return;
  }
  const body = req.body as Partial<TaskRecord>;
  try {
    await ensureTaskSheetReady();
    const { headers, rows } = await listTaskRowsWithHeaders();
    const existing = rows.find((r) => r.id === id);
    if (!existing) {
      res.status(404).json({ error: "المهمة غير موجودة." });
      return;
    }
    const existingRecord = rowToRecord(id, existing.values, headers);
    const updatedPayload: Omit<TaskRecord, "id"> = {
      title:         body.title    !== undefined ? body.title.trim()    : existingRecord.title,
      assignee:      body.assignee !== undefined ? body.assignee.trim() : existingRecord.assignee,
      priority:      body.priority !== undefined ? body.priority        : existingRecord.priority,
      dueDate:       body.dueDate  !== undefined ? body.dueDate.trim()  : existingRecord.dueDate,
      remainingDays: calcRemainingDays(body.dueDate !== undefined ? body.dueDate.trim() : existingRecord.dueDate),
      status:        body.status   !== undefined ? body.status          : existingRecord.status,
      notes:         body.notes    !== undefined ? body.notes.trim()    : existingRecord.notes,
      createdAt:     existingRecord.createdAt,
    };
    await updateTaskRow(id, recordToRow(updatedPayload));
    logger.info({ id }, "Task record updated");
    res.json({ id, ...updatedPayload });
  } catch (err) {
    logger.error({ err }, "Failed to update Task record");
    res.status(500).json({ error: "فشل تحديث المهمة." });
  }
});

/**
 * DELETE /api/tasks/:id
 * Deletes a Task record by its 1-based sheet row id.
 */
router.delete("/tasks/:id", attachAuthUser, requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف الصف غير صالح." });
    return;
  }
  try {
    await deleteTaskRow(id);
    logger.info({ id }, "Task record deleted");
    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "Failed to delete Task record");
    res.status(500).json({ error: "فشل حذف المهمة." });
  }
});

/**
 * POST /api/tasks/:id/send-whatsapp
 * Dispatches an instant WhatsApp reminder with task details.
 */
router.post("/tasks/:id/send-whatsapp", attachAuthUser, requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف المهمة غير صالح." });
    return;
  }
  try {
    await ensureTaskSheetReady();
    const { headers, rows } = await listTaskRowsWithHeaders();
    const existing = rows.find((r) => r.id === id);
    if (!existing) {
      res.status(404).json({ error: "المهمة غير موجودة." });
      return;
    }
    const task = rowToRecord(id, existing.values, headers);

    const remainingText = calcRemainingDays(task.dueDate);
    const lines: string[] = [
      `🔔 *تذكير بموعد مهمة قانونية* (${remainingText ? remainingText : "تذكير فوري"})`,
      "",
      `📌 *عنوان المهمة:* ${task.title}`,
    ];

    if (task.assignee) lines.push(`👤 *المكلف:* ${task.assignee}`);
    if (task.status) lines.push(`📋 *الحالة:* ${task.status}`);
    if (task.priority) lines.push(`🚩 *الأولوية:* ${task.priority}`);
    if (task.dueDate) lines.push(`📅 *تاريخ التسليم:* ${task.dueDate}`);
    if (task.notes) lines.push(`📝 *ملاحظات:* ${task.notes}`);

    lines.push("", "الرجاء الإنجاز والمتابعة في الموعد المحدد.");

    const message = lines.join("\n");

    const channel = new WhatsappReminderChannel();
    await channel.sendRaw(message);

    res.json({ message: "تم إرسال تذكير المهمة عبر الواتساب بنجاح!" });
  } catch (err: any) {
    logger.error({ err, id }, "Failed to send instant WhatsApp task reminder");
    const errMsg = err?.message || "فشل إرسال تذكير الواتساب للمهمة.";
    res.status(400).json({ error: errMsg });
  }
});

export default router;
