import { Router, type IRouter } from "express";
import {
  attachAuthUser,
  requireAuth,
  requireActiveSubscription,
  blockSuperAdminFromOfficeData,
} from "../middlewares/auth.middleware";
import { logger } from "../lib/logger";
import * as postgresService from "../services/postgres.service";
import type { ClientRecord } from "../services/postgres.service";
import { canUserAccessRecord, validateOfficeLawyer } from "../utils/record-access";

const router: IRouter = Router();

function generateRefId(): string {
  return `REF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

// Stop all Clients operations if subscription is suspended or expired
// Super Admins are blocked from office clients data
router.use("/clients", attachAuthUser, requireAuth, blockSuperAdminFromOfficeData, requireActiveSubscription);

function getOfficeId(req: any): string {
  const officeId = req.authUser?.officeId || req.authUser?.userId;
  if (!officeId) {
    throw new Error("غير مصرح: معرف المكتب مفقود.");
  }
  return officeId;
}

async function getStaffAccessibleClientIds(officeId: string, authUser: any): Promise<Set<string>> {
  const [sessions, tasks, poas, judgments] = await Promise.all([
    postgresService.listSessions(officeId),
    postgresService.listTasks(officeId),
    postgresService.listPoa(officeId),
    postgresService.listJudgments(officeId),
  ]);

  const set = new Set<string>();
  for (const s of sessions) {
    const cId = (s as any).clientId || (s as any).client_id;
    if (cId && canUserAccessRecord(s, authUser)) {
      set.add(cId);
    }
  }
  for (const t of tasks) {
    const cId = t.clientId || (t as any).client_id;
    if (cId && canUserAccessRecord(t, authUser)) {
      set.add(cId);
    }
  }
  for (const p of poas) {
    const cId = p.clientId || (p as any).client_id;
    if (cId && canUserAccessRecord(p, authUser)) {
      set.add(cId);
    }
  }
  for (const j of judgments) {
    const cId = j.clientId || (j as any).client_id;
    if (cId && canUserAccessRecord(j, authUser)) {
      set.add(cId);
    }
  }
  return set;
}

/**
 * GET /api/clients/legacy-unassigned
 * Admin-only: list records across poa, sessions, judgments, tasks missing client_id or assigned_lawyer_id.
 */
router.get("/clients/legacy-unassigned", async (req, res) => {
  if (req.authUser?.role === "staff") {
    res.status(403).json({ error: "غير مصرح لك بالوصول إلى سجلات الفرز." });
    return;
  }
  const officeId = getOfficeId(req);
  try {
    const [sessions, tasks, poas, judgments] = await Promise.all([
      postgresService.listSessions(officeId),
      postgresService.listTasks(officeId),
      postgresService.listPoa(officeId),
      postgresService.listJudgments(officeId),
    ]);

    const unassignedSessions = sessions.filter(
      (s: any) => (!s.clientId && !s.client_id) || (!s.assignedLawyerId && !s.assigned_lawyer_id),
    );
    const unassignedTasks = tasks.filter(
      (t: any) => (!t.clientId && !t.client_id) || (!t.assignedLawyerId && !t.assigned_lawyer_id),
    );
    const unassignedPoas = poas.filter(
      (p: any) => (!p.clientId && !p.client_id) || (!p.assignedLawyerId && !p.assigned_lawyer_id),
    );
    const unassignedJudgments = judgments.filter(
      (j: any) => (!j.clientId && !j.client_id) || (!j.assignedLawyerId && !j.assigned_lawyer_id),
    );

    res.json({
      sessions: unassignedSessions,
      tasks: unassignedTasks,
      poa: unassignedPoas,
      judgments: unassignedJudgments,
      totalUnassigned:
        unassignedSessions.length +
        unassignedTasks.length +
        unassignedPoas.length +
        unassignedJudgments.length,
    });
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to get legacy unassigned records");
    res.status(500).json({ error: `فشل استرجاع السجلات غير المعينة. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * POST /api/clients/triage-link
 * Admin-only: links a legacy record to a client and/or assigns a lawyer.
 */
router.post("/clients/triage-link", async (req, res) => {
  if (req.authUser?.role === "staff") {
    res.status(403).json({ error: "غير مصرح لك بربط السجلات القديمة." });
    return;
  }
  const officeId = getOfficeId(req);
  const { module, id, clientId, client_id, assignedLawyerId, assigned_lawyer_id } = req.body || {};

  const targetClientId = clientId !== undefined ? clientId : client_id;
  const targetLawyerId = assignedLawyerId !== undefined ? assignedLawyerId : assigned_lawyer_id;

  if (!module || !id) {
    res.status(400).json({ error: "الوحدة ومعرف السجل مطلوبان." });
    return;
  }

  // Validate lawyer if provided
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
    let updated: any = null;
    const numId = Number(id);

    if (module === "sessions") {
      const payload: any = {};
      if (targetClientId !== undefined) payload.clientId = targetClientId;
      if (targetLawyerId !== undefined) payload.assignedLawyerId = targetLawyerId;
      updated = await postgresService.updateSession(numId, payload, officeId);
    } else if (module === "tasks") {
      const payload: any = {};
      if (targetClientId !== undefined) payload.clientId = targetClientId;
      if (targetLawyerId !== undefined) {
        payload.assignedLawyerId = targetLawyerId;
        if (lawyerName) payload.assignee = lawyerName;
      }
      updated = await postgresService.updateTask(numId, payload, officeId);
    } else if (module === "poa") {
      const payload: any = {};
      if (targetClientId !== undefined) payload.clientId = targetClientId;
      if (targetLawyerId !== undefined) payload.assignedLawyerId = targetLawyerId;
      updated = await postgresService.updatePoa(numId, payload, officeId);
    } else if (module === "judgments") {
      const payload: any = {};
      if (targetClientId !== undefined) payload.clientId = targetClientId;
      if (targetLawyerId !== undefined) {
        payload.assignedLawyerId = targetLawyerId;
        if (lawyerName) payload.assignedLawyer = lawyerName;
      }
      updated = await postgresService.updateJudgment(numId, payload, officeId);
    } else {
      res.status(400).json({ error: "وحدة غير معروفة." });
      return;
    }

    if (!updated) {
      res.status(404).json({ error: "السجل غير موجود." });
      return;
    }

    res.json(updated);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to triage link record");
    res.status(500).json({ error: `فشل ربط السجل. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * GET /api/clients
 * Lists clients for the authenticated office. Staff sees only clients with assigned records.
 */
router.get("/clients", async (req, res) => {
  const officeId = getOfficeId(req);
  try {
    let clients = await postgresService.listClients(officeId);

    if (req.authUser?.role === "staff") {
      const accessibleIds = await getStaffAccessibleClientIds(officeId, req.authUser);
      clients = clients.filter((c) => accessibleIds.has(c.id));
    }

    res.json(clients);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to list clients");
    res.status(500).json({ error: `فشل تحميل قائمة العملاء. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * POST /api/clients
 * Creates a new client in the authenticated office.
 */
router.post("/clients", async (req, res) => {
  const officeId = getOfficeId(req);
  const body = req.body || {};
  if (!body.name?.trim()) {
    res.status(400).json({ error: "اسم العميل مطلوب." });
    return;
  }

  try {
    const client = await postgresService.createClient(
      {
        name: body.name.trim(),
        phone: body.phone?.trim() || "",
        notes: body.notes?.trim() || "",
      },
      officeId,
    );
    res.status(201).json(client);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err }, "Failed to create client");
    res.status(500).json({ error: `فشل حفظ العميل. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * GET /api/clients/:id
 * Gets basic info for a client. Staff gets 404 if no assigned records for this client.
 */
router.get("/clients/:id", async (req, res) => {
  const officeId = getOfficeId(req);
  const id = String(req.params.id);

  try {
    const client = await postgresService.getClientById(id, officeId);
    if (!client) {
      res.status(404).json({ error: "العميل غير موجود." });
      return;
    }

    if (req.authUser?.role === "staff") {
      const accessibleIds = await getStaffAccessibleClientIds(officeId, req.authUser);
      if (!accessibleIds.has(client.id)) {
        res.status(404).json({ error: "العميل غير موجود." });
        return;
      }
    }

    res.json(client);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err, id }, "Failed to get client");
    res.status(500).json({ error: `فشل استرجاع بيانات العميل. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * PATCH /api/clients/:id
 * Updates client info.
 */
router.patch("/clients/:id", async (req, res) => {
  const officeId = getOfficeId(req);
  const id = String(req.params.id);
  const body = req.body || {};

  try {
    if (req.authUser?.role === "staff") {
      const accessibleIds = await getStaffAccessibleClientIds(officeId, req.authUser);
      if (!accessibleIds.has(id)) {
        res.status(404).json({ error: "العميل غير موجود." });
        return;
      }
    }

    const updated = await postgresService.updateClient(
      id,
      {
        name: body.name !== undefined ? body.name.trim() : undefined,
        phone: body.phone !== undefined ? body.phone.trim() : undefined,
        notes: body.notes !== undefined ? body.notes.trim() : undefined,
      },
      officeId,
    );

    if (!updated) {
      res.status(404).json({ error: "العميل غير موجود." });
      return;
    }

    res.json(updated);
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err, id }, "Failed to update client");
    res.status(500).json({ error: `فشل تحديث بيانات العميل. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * DELETE /api/clients/:id
 * Deletes a client.
 */
router.delete("/clients/:id", async (req, res) => {
  const officeId = getOfficeId(req);
  const id = String(req.params.id);

  try {
    if (req.authUser?.role === "staff") {
      const accessibleIds = await getStaffAccessibleClientIds(officeId, req.authUser);
      if (!accessibleIds.has(id)) {
        res.status(404).json({ error: "العميل غير موجود." });
        return;
      }
    }

    const deleted = await postgresService.deleteClient(id, officeId);
    if (!deleted) {
      res.status(404).json({ error: "العميل غير موجود." });
      return;
    }

    res.status(204).send();
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err, id }, "Failed to delete client");
    res.status(500).json({ error: `فشل حذف العميل. رقم المرجع: ${refId}`, refId });
  }
});

/**
 * GET /api/clients/:id/timeline
 * Aggregates client's sessions, poa, judgments, tasks respecting lawyer scoping.
 */
router.get("/clients/:id/timeline", async (req, res) => {
  const officeId = getOfficeId(req);
  const id = String(req.params.id);

  try {
    const client = await postgresService.getClientById(id, officeId);
    if (!client) {
      res.status(404).json({ error: "العميل غير موجود." });
      return;
    }

    const [allSessions, allTasks, allPoas, allJudgments] = await Promise.all([
      postgresService.listSessions(officeId),
      postgresService.listTasks(officeId),
      postgresService.listPoa(officeId),
      postgresService.listJudgments(officeId),
    ]);

    // Filter to this client
    let sessions = allSessions.filter((s: any) => (s.clientId || s.client_id) === id);
    let tasks = allTasks.filter((t: any) => (t.clientId || t.client_id) === id);
    let poa = allPoas.filter((p: any) => (p.clientId || p.client_id) === id);
    let judgments = allJudgments.filter((j: any) => (j.clientId || j.client_id) === id);

    // Apply scoping if staff
    if (req.authUser?.role === "staff") {
      sessions = sessions.filter((s) => canUserAccessRecord(s, req.authUser));
      tasks = tasks.filter((t) => canUserAccessRecord(t, req.authUser));
      poa = poa.filter((p) => canUserAccessRecord(p, req.authUser));
      judgments = judgments.filter((j) => canUserAccessRecord(j, req.authUser));

      if (sessions.length === 0 && tasks.length === 0 && poa.length === 0 && judgments.length === 0) {
        res.status(404).json({ error: "العميل غير موجود." });
        return;
      }
    }

    res.json({
      client,
      sessions,
      tasks,
      poa,
      judgments,
    });
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err, id }, "Failed to get client timeline");
    res.status(500).json({ error: `فشل استرجاع سجل العميل. رقم المرجع: ${refId}`, refId });
  }
});

export default router;
