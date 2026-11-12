import type { SessionCookiePayload } from "../middlewares/auth.middleware";
import { findUserByIdOrUsername } from "../services/supabase.service";
import * as postgresService from "../services/postgres.service";

/**
 * Checks whether an authenticated user is allowed to access a specific record.
 * - Admin and Super Admin can access all records in their office.
 * - Staff can access records if assigned to them (assignedLawyerId === authUser.userId).
 * - If unassigned (assignedLawyerId is null/empty), staff can only access if they created it (createdBy === authUser.userId).
 */
export function canUserAccessRecord(record: any, authUser?: SessionCookiePayload): boolean {
  if (!authUser) return false;
  if (authUser.role === "admin" || authUser.role === "super_admin") return true;

  const assignedLawyerId = record.assignedLawyerId ?? record.assigned_lawyer_id;
  if (assignedLawyerId) {
    return assignedLawyerId === authUser.userId;
  }

  const createdBy = record.createdBy ?? record.created_by;
  return Boolean(createdBy && createdBy === authUser.userId);
}

/**
 * Validates that the specified lawyer ID belongs to the same office.
 * Returns valid: true if lawyerId is null/empty (unassigning) or belongs to office.
 */
export async function validateOfficeLawyer(
  lawyerId: string | null | undefined,
  officeId: string,
): Promise<{ valid: boolean; lawyerName?: string; error?: string }> {
  if (!lawyerId) {
    return { valid: true };
  }

  const user = await findUserByIdOrUsername(lawyerId);
  if (!user) {
    return { valid: false, error: "المحامي المحدد غير موجود." };
  }

  const userOfficeId =
    user.role === "admin"
      ? (user.office_id || user.id)
      : (user.office_id || user.admin_id);

  if (userOfficeId !== officeId) {
    return { valid: false, error: "المحامي المحدد لا ينتمي إلى هذا المكتب." };
  }

  return { valid: true, lawyerName: user.display_name || user.username };
}

/**
 * Gets all client IDs that a staff lawyer has permission to view.
 */
export async function getStaffAccessibleClientIds(
  officeId: string,
  authUser: SessionCookiePayload,
): Promise<Set<string>> {
  const [sessions, tasks, poas, judgments, cases] = await Promise.all([
    postgresService.listSessions(officeId),
    postgresService.listTasks(officeId),
    postgresService.listPoa(officeId),
    postgresService.listJudgments(officeId),
    postgresService.listCases(officeId),
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
  for (const c of cases) {
    const cId = c.clientId || (c as any).client_id;
    if (cId && canUserAccessRecord(c, authUser)) {
      set.add(cId);
    }
  }
  return set;
}

/**
 * Verifies if user has permission to view/attach files for a related record.
 */
export async function verifyRecordAccess(
  officeId: string,
  relatedRecordType: string,
  relatedRecordId: string,
  authUser: SessionCookiePayload,
): Promise<{ allowed: boolean; status?: number; error?: string; record?: any }> {
  if (!authUser) {
    return { allowed: false, status: 401, error: "يجب تسجيل الدخول أولاً." };
  }

  const isAdmin = authUser.role === "admin" || authUser.role === "super_admin";

  switch (relatedRecordType) {
    case "client": {
      const client = await postgresService.getClientById(relatedRecordId, officeId);
      if (!client) {
        return { allowed: false, status: 404, error: "العميل غير موجود." };
      }
      if (!isAdmin) {
        const accessible = await getStaffAccessibleClientIds(officeId, authUser);
        if (!accessible.has(relatedRecordId)) {
          return { allowed: false, status: 403, error: "ليس لديك صلاحية الوصول إلى هذا العميل." };
        }
      }
      return { allowed: true, record: client };
    }
    case "session": {
      const numId = Number(relatedRecordId);
      const session = Number.isInteger(numId) ? await postgresService.getSessionById(numId, officeId) : null;
      if (!session) {
        return { allowed: false, status: 404, error: "الجلسة غير موجودة." };
      }
      if (!canUserAccessRecord(session, authUser)) {
        return { allowed: false, status: 403, error: "ليس لديك صلاحية الوصول إلى هذه الجلسة." };
      }
      return { allowed: true, record: session };
    }
    case "task": {
      const numId = Number(relatedRecordId);
      const task = Number.isInteger(numId) ? await postgresService.getTaskById(numId, officeId) : null;
      if (!task) {
        return { allowed: false, status: 404, error: "المهمة غير موجودة." };
      }
      if (!canUserAccessRecord(task, authUser)) {
        return { allowed: false, status: 403, error: "ليس لديك صلاحية الوصول إلى هذه المهمة." };
      }
      return { allowed: true, record: task };
    }
    case "poa": {
      const numId = Number(relatedRecordId);
      let poa = Number.isInteger(numId) ? await postgresService.getPoaById(numId, officeId) : null;
      if (!poa) {
        const allPoas = await postgresService.listPoa(officeId);
        poa = allPoas.find((p: any) => String(p.id) === String(relatedRecordId) || String(p.sheetRowId) === String(relatedRecordId)) || null;
      }
      if (!poa) {
        return { allowed: false, status: 404, error: "الوكالة غير موجودة." };
      }
      if (!canUserAccessRecord(poa, authUser)) {
        return { allowed: false, status: 403, error: "ليس لديك صلاحية الوصول إلى هذه الوكالة." };
      }
      return { allowed: true, record: poa };
    }
    case "judgment": {
      const numId = Number(relatedRecordId);
      const judgment = Number.isInteger(numId) ? await postgresService.getJudgmentById(numId, officeId) : null;
      if (!judgment) {
        return { allowed: false, status: 404, error: "الحكم غير موجود." };
      }
      if (!canUserAccessRecord(judgment, authUser)) {
        return { allowed: false, status: 403, error: "ليس لديك صلاحية الوصول إلى هذا الحكم." };
      }
      return { allowed: true, record: judgment };
    }
    case "case": {
      const caseRecord = await postgresService.getCaseById(String(relatedRecordId), officeId);
      if (!caseRecord) {
        return { allowed: false, status: 404, error: "القضية غير موجودة." };
      }
      if (!canUserAccessRecord(caseRecord, authUser)) {
        return { allowed: false, status: 403, error: "ليس لديك صلاحية الوصول إلى هذه القضية." };
      }
      return { allowed: true, record: caseRecord };
    }
    default:
      return { allowed: false, status: 400, error: "نوع السجل غير صالح." };
  }
}


