import { Router, type IRouter } from "express";
import { attachAuthUser, requireAuth, requireActiveSubscription, blockSuperAdminFromOfficeData } from "../middlewares/auth.middleware";
import { logger } from "../lib/logger";
import * as postgresService from "../services/postgres.service";
import type { TaskRecord } from "../services/postgres.service";
import { canUserAccessRecord, validateOfficeLawyer } from "../utils/record-access";

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
    let tasks = await postgresService.listTasks(officeId);
    if (req.authUser?.role === "staff") {
      tasks = tasks.filter((t) => canUserAccessRecord(t, req.authUser));
    }
    if (req.query.scope === "personal") {
      const username = (req.authUser?.username || "").toLowerCase();
      const displayName = ((req.authUser as any)?.displayName || "").toLowerCase();
      tasks = tasks.filter((t) => {
        const a = (t.assignee || "").toLowerCase();
        return (username && a.includes(username)) || (displayName && a.includes(displayName));
      });
    } else if (req.query.assignee && typeof req.query.assignee === "string") {
      const q = req.query.assignee.toLowerCase();
      tasks = tasks.filter((t) => (t.assignee || "").toLowerCase().includes(q));
    }
    res.json(tasks);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to list tasks");
    res.status(500).json({ error: `فشل تحميل قائمة المهام. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * GET /api/tasks/:id
 * Gets a single Task record by id. Verifies office ownership and scoping, returning 404 if not found.
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
    if (!task || !canUserAccessRecord(task, req.authUser)) {
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
  const body = req.body as any;
  if (!body.title?.trim()) {
    res.status(400).json({ error: "عنوان المهمة مطلوب." });
    return;
  }

  const clientId = body.clientId || body.client_id || null;
  let assignedLawyerId = body.assignedLawyerId || body.assigned_lawyer_id || null;
  let assignee = body.assignee?.trim() || "";
  const createdBy = req.authUser?.userId || null;

  if (req.authUser?.role === "staff") {
    assignedLawyerId = req.authUser.userId;
    assignee = req.authUser.displayName || req.authUser.username;
  } else if (assignedLawyerId) {
    const val = await validateOfficeLawyer(assignedLawyerId, officeId);
    if (!val.valid) {
      res.status(400).json({ error: val.error || "المحامي غير صالح." });
      return;
    }
    if (val.lawyerName && !assignee) {
      assignee = val.lawyerName;
    }
  }

  try {
    const created = await postgresService.createTask(
      {
        title: body.title.trim(),
        assignee,
        priority: (body.priority as TaskRecord["priority"]) || "عادية",
        dueDate: body.dueDate?.trim() || "",
        status: (body.status as TaskRecord["status"]) || "قيد التنفيذ",
        notes: body.notes?.trim() || "",
        clientId,
        assignedLawyerId,
        createdBy,
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
 * Updates an existing Task record. Verifies office ownership and scoping, returning 404 if not found.
 */
router.put("/tasks/:id", async (req, res) => {
  const officeId = getOfficeId(req);
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف المهمة غير صالح." });
    return;
  }

  try {
    const existing = await postgresService.getTaskById(id, officeId);
    if (!existing || !canUserAccessRecord(existing, req.authUser)) {
      res.status(404).json({ error: "المهمة غير موجودة." });
      return;
    }

    const body = req.body as any;
    const payload: any = { ...body };
    if (body.clientId !== undefined || body.client_id !== undefined) {
      payload.clientId = body.clientId !== undefined ? body.clientId : body.client_id;
    }
    if (req.authUser?.role === "staff") {
      delete payload.assignedLawyerId;
      delete payload.assigned_lawyer_id;
    } else if (body.assignedLawyerId !== undefined || body.assigned_lawyer_id !== undefined) {
      const targetLawyer = body.assignedLawyerId !== undefined ? body.assignedLawyerId : body.assigned_lawyer_id;
      if (targetLawyer) {
        const val = await validateOfficeLawyer(targetLawyer, officeId);
        if (!val.valid) {
          res.status(400).json({ error: val.error || "المحامي غير صالح." });
          return;
        }
        if (val.lawyerName && !payload.assignee) {
          payload.assignee = val.lawyerName;
        }
      }
      payload.assignedLawyerId = targetLawyer;
    }

    const updated = await postgresService.updateTask(id, payload, officeId);
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
 * PATCH /api/tasks/:id/reassign
 * Admin-only: reassign a task to an office lawyer or unassign.
 */
router.patch("/tasks/:id/reassign", async (req, res) => {
  if (req.authUser?.role === "staff") {
    res.status(403).json({ error: "إعادة التعيين مقتصرة على مشرف المكتب." });
    return;
  }
  const officeId = getOfficeId(req);
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف المهمة غير صالح." });
    return;
  }

  const targetLawyerId = req.body?.assignedLawyerId !== undefined ? req.body.assignedLawyerId : req.body?.assigned_lawyer_id;
  let lawyerName: string | undefined;

  if (targetLawyerId) {
    const val = await validateOfficeLawyer(targetLawyerId, officeId);
    if (!val.valid) {
      res.status(400).json({ error: val.error || "المحامي غير صالح." });
      return;
    }
    lawyerName = val.lawyerName;
  }

  try {
    const existing = await postgresService.getTaskById(id, officeId);
    if (!existing) {
      res.status(404).json({ error: "المهمة غير موجودة." });
      return;
    }

    const updated = await postgresService.reassignTask(id, targetLawyerId || null, officeId, lawyerName);
    res.json(updated);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err, id }, "Failed to reassign task");
    res.status(500).json({ error: `فشل إعادة تعيين المهمة. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * DELETE /api/tasks/:id
 * Deletes a Task record by id. Verifies office ownership and scoping, returning 404 if not found.
 */
router.delete("/tasks/:id", async (req, res) => {
  const officeId = getOfficeId(req);
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "معرف المهمة غير صالح." });
    return;
  }

  try {
    const existing = await postgresService.getTaskById(id, officeId);
    if (!existing || !canUserAccessRecord(existing, req.authUser)) {
      res.status(404).json({ error: "المهمة غير موجودة." });
      return;
    }

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