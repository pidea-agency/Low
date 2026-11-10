import { Router, type IRouter } from "express";
import {
  attachAuthUser,
  requireAdmin,
  requireActiveSubscription,
  blockSuperAdminFromOfficeData,
} from "../middlewares/auth.middleware";
import { logger } from "../lib/logger";
import * as postgresService from "../services/postgres.service";
import { listOfficeMembers } from "../services/supabase.service";

const router: IRouter = Router();

function generateRefId(): string {
  return `REF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

router.use("/workload", attachAuthUser, requireAdmin, blockSuperAdminFromOfficeData, requireActiveSubscription);

function getOfficeId(req: any): string {
  const officeId = req.authUser?.officeId || req.authUser?.userId;
  if (!officeId) {
    throw new Error("غير مصرح: معرف المكتب مفقود.");
  }
  return officeId;
}

/**
 * GET /workload
 * Admin-only, office-scoped: returns per-member counts
 * (active sessions, open poa, pending tasks) grouped by assigned_lawyer_id.
 */
router.get("/workload", async (req, res) => {
  const officeId = getOfficeId(req);
  const adminId = req.authUser!.userId!;

  try {
    const [officeMembers, allSessions, allPoas, allTasks] = await Promise.all([
      listOfficeMembers(adminId).catch(() => []),
      postgresService.listSessions(officeId),
      postgresService.listPoa(officeId),
      postgresService.listTasks(officeId),
    ]);

    // Active sessions: status is not Finished or Cancelled
    const isActiveSession = (s: any) => s.status !== "Finished" && s.status !== "Cancelled";

    // Open POA: daysRemaining > 0
    const isOpenPoa = (p: any) => {
      const days = p.daysRemaining ?? p.days_remaining ?? 0;
      return days > 0;
    };

    // Pending tasks: status is not completed
    const isPendingTask = (t: any) => t.status !== "مكتملة";

    // Group by lawyer ID
    const membersWorkload = officeMembers.map((m: any) => {
      const mId = m.id;
      const activeSessions = allSessions.filter(
        (s: any) => (s.assignedLawyerId === mId || s.assigned_lawyer_id === mId) && isActiveSession(s),
      ).length;

      const openPoa = allPoas.filter(
        (p: any) => (p.assignedLawyerId === mId || p.assigned_lawyer_id === mId) && isOpenPoa(p),
      ).length;

      const pendingTasks = allTasks.filter(
        (t: any) => (t.assignedLawyerId === mId || t.assigned_lawyer_id === mId) && isPendingTask(t),
      ).length;

      return {
        lawyerId: mId,
        lawyerName: m.display_name || m.username,
        username: m.username,
        email: m.email,
        activeSessions,
        openPoa,
        pendingTasks,
        totalWorkload: activeSessions + openPoa + pendingTasks,
      };
    });

    // Also check unassigned records
    const unassignedSessions = allSessions.filter(
      (s: any) => !s.assignedLawyerId && !s.assigned_lawyer_id && isActiveSession(s),
    ).length;
    const unassignedPoa = allPoas.filter(
      (p: any) => !p.assignedLawyerId && !p.assigned_lawyer_id && isOpenPoa(p),
    ).length;
    const unassignedTasks = allTasks.filter(
      (t: any) => !t.assignedLawyerId && !t.assigned_lawyer_id && isPendingTask(t),
    ).length;

    res.json({
      members: membersWorkload,
      unassigned: {
        activeSessions: unassignedSessions,
        openPoa: unassignedPoa,
        pendingTasks: unassignedTasks,
        totalWorkload: unassignedSessions + unassignedPoa + unassignedTasks,
      },
    });
  } catch (err: any) {
    const refId = generateRefId();
    logger.error({ refId, err, officeId }, "Failed to fetch office workload");
    postgresService.handleDatabaseOrServerError(res, err, refId, "فشل استرجاع بيانات عبء العمل");
  }
});

export default router;
