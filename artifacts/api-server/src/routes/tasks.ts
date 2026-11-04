import { Router, type IRouter } from "express";
import { attachAuthUser, requireAuth, requireActiveSubscription, blockSuperAdminFromOfficeData } from "../middlewares/auth.middleware";
import { logger } from "../lib/logger";
import * as postgresService from "../services/postgres.service";
import type { TaskRecord } from "../services/postgres.service";

export type { TaskRecord };

const router: IRouter = Router();

function generateRefId(): string {
  return `REF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

// Stop all Tasks operations if subscription is suspended or expired
// Super Admins are blocked from office tasks data
router.use("/tasks", attachAuthUser, requireAuth, blockSuperAdminFromOfficeData, requireActiveSubscription);

function getOfficeId(req: any): string {
  const officeId = req.authUser?.officeId || req.authUser?.userId;
  if (!officeId) {
    throw new Error("غير مصرح: معرف المكتب مفقود.");
  }
  return officeId;
}

/**
 * GET /api/tasks
 * Lists all Task records belonging to the authenticated office.
 */
router.get("/tasks", async (req, res) => {
  const officeId = getOfficeId(req);
  try {
    const tasks = await postgresService.listTasks(officeId);
    res.json(tasks);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to list tasks");
    res.status(500).json({ error: `فشل تحميل قائمة المهام. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * GET /api/tasks/:id
 * Gets a single Task record by id. Verifies office ownership, returning 404 if not found.
 */
router.get("/tasks/:id", async (req, res) => {
  const officeId = getOfficeId(req);
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف المهمة غير صالح." });
    return;
  }

  try {
    const task = await postgresService.getTaskById(id, officeId);
    if (!task) {
      res.status(404).json({ error: "المهمة غير موجودة." });
      return;
    }
    res.json(task);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err, id }, "Failed to get task");
    res.status(500).json({ error: `فشل تحميل بيانات المهمة. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * POST /api/tasks
 * Creates a new Task record stamped with the caller's office.
 */
router.post("/tasks", async (req, res) => {
  const officeId = getOfficeId(req);
  const body = req.body as Partial<TaskRecord>;
  if (!body.title?.trim()) {
    res.status(400).json({ error: "عنوان المهمة مطلوب." });
    return;
  }

  try {
    const created = await postgresService.createTask(
      {
        title: body.title.trim(),
        assignee: body.assignee?.trim() || "",
        priority: (body.priority as TaskRecord["priority"]) || "عادية",
        dueDate: body.dueDate?.trim() || "",
        status: (body.status as TaskRecord["status"]) || "قيد التنفيذ",
        notes: body.notes?.trim() || "",
      },
      officeId,
    );
    logger.info({ id: created.id, officeId }, "Task record created in database");
    res.status(201).json(created);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to create task");
    res.status(500).json({ error: `فشل حفظ المهمة. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * PUT /api/tasks/:id
 * Updates an existing Task record. Verifies office ownership, returning 404 if not found.
 */
router.put("/tasks/:id", async (req, res) => {
  const officeId = getOfficeId(req);
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف المهمة غير صالح." });
    return;
  }

  const body = req.body as Partial<TaskRecord>;
  try {
    const updated = await postgresService.updateTask(id, body, officeId);
    if (!updated) {
      res.status(404).json({ error: "المهمة غير موجودة." });
      return;
    }
    logger.info({ id, officeId }, "Task record updated in database");
    res.json(updated);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err, id }, "Failed to update task");
    res.status(500).json({ error: `فشل تحديث المهمة. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * DELETE /api/tasks/:id
 * Deletes a Task record by id. Verifies office ownership, returning 404 if not found.
 */
router.delete("/tasks/:id", async (req, res) => {
  const officeId = getOfficeId(req);
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف المهمة غير صالح." });
    return;
  }

  try {
    const deleted = await postgresService.deleteTask(id, officeId);
    if (!deleted) {
      res.status(404).json({ error: "المهمة غير موجودة." });
      return;
    }
    logger.info({ id, officeId }, "Task record deleted from database");
    res.status(204).send();
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err, id }, "Failed to delete task");
    res.status(500).json({ error: `فشل حذف المهمة. رقم المرجع: ${refId}`, refId });
  }
});

export default router;
