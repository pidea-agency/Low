import type { SessionCookiePayload } from "../middlewares/auth.middleware";
import { findUserByIdOrUsername } from "../services/supabase.service";

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

