import { Router, type IRouter } from "express";
import {
  attachAuthUser,
  requireAuth,
  requireActiveSubscription,
  blockSuperAdminFromOfficeData,
} from "../middlewares/auth.middleware";
import { logger } from "../lib/logger";
import * as postgresService from "../services/postgres.service";
import { canUserAccessRecord, getStaffAccessibleClientIds } from "../utils/record-access";

const router: IRouter = Router();

function generateRefId(): string {
  return `REF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

router.use("/search", attachAuthUser, requireAuth, blockSuperAdminFromOfficeData, requireActiveSubscription);

function getOfficeId(req: any): string {
  const officeId = req.authUser?.officeId || req.authUser?.userId;
  if (!officeId) {
    throw new Error("غير مصرح: معرف المكتب مفقود.");
  }
  return officeId;
}

/**
 * GET /search?q=...
 * Authenticated, office-scoped global search across:
 * - clients (name, phone)
 * - poa (client_name, poa_number)
 * - judgments (case_number, plaintiff, defendant)
 * - sessions (case_number, plaintiff, defendant)
 * - tasks (title)
 *
 * Enforces staff vs admin visibility:
 * - Staff sees only records assigned to them or unassigned-and-created-by-them.
 * - For clients, staff sees only clients attached to their accessible records.
 * - Admin sees all records in their office.
 * Limits each category to ~5 results.
 */
router.get("/search", async (req, res) => {
  const officeId = getOfficeId(req);
  const q = String(req.query.q || "").trim();

  if (!q) {
    res.json({
      clients: [],
      poa: [],
      judgments: [],
      sessions: [],
      tasks: [],
    });
    return;
  }

  try {
    const isStaff = req.authUser?.role === "staff";

    // Run search queries across all 5 modules in parallel
    const [rawClients, rawPoa, rawJudgments, rawSessions, rawTasks, accessibleClientIds] =
      await Promise.all([
        postgresService.searchClients(officeId, q),
        postgresService.searchPoa(officeId, q),
        postgresService.searchJudgments(officeId, q),
        postgresService.searchSessions(officeId, q),
        postgresService.searchTasks(officeId, q),
        isStaff ? getStaffAccessibleClientIds(officeId, req.authUser!) : Promise.resolve(null),
      ]);

    // Apply scoping/visibility filters
    const clients = isStaff
      ? rawClients.filter((c) => accessibleClientIds?.has(c.id)).slice(0, 5)
      : rawClients.slice(0, 5);

    const poa = isStaff
      ? rawPoa.filter((p) => canUserAccessRecord(p, req.authUser)).slice(0, 5)
      : rawPoa.slice(0, 5);

    const judgments = isStaff
      ? rawJudgments.filter((j) => canUserAccessRecord(j, req.authUser)).slice(0, 5)
      : rawJudgments.slice(0, 5);

    const sessions = isStaff
      ? rawSessions.filter((s) => canUserAccessRecord(s, req.authUser)).slice(0, 5)
      : rawSessions.slice(0, 5);

    const tasks = isStaff
      ? rawTasks.filter((t) => canUserAccessRecord(t, req.authUser)).slice(0, 5)
      : rawTasks.slice(0, 5);

    res.json({
      clients,
      poa,
      judgments,
      sessions,
      tasks,
    });
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err, officeId, q }, "Failed to execute global search");
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل البحث في النظام");
  }
});

export default router;
