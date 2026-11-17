/**
 * license-expiry.service.ts
 *
 * Daily sweep service for staff law license expiry tracking.
 * Scans office staff members with license_expiry_date nearing expiry (<= LICENSE_EXPIRY_THRESHOLD_DAYS, e.g. 30 days),
 * prevents duplicate notifications within 24 hours, and creates scoped in-app
 * notifications for the office admin.
 */

import { logger } from "../../lib/logger";
import { listSupabaseUsers, type AppUser } from "../supabase.service";
import { hasRecentNotification } from "../postgres.service";
import { dispatchEventNotification } from "../notification-template.service";

export const LICENSE_EXPIRY_THRESHOLD_DAYS = 30;

export interface LicenseExpirySweepOfficeResult {
  officeId: string;
  membersChecked: number;
  expiringFound: number;
  notificationsCreated: number;
  skippedDuplicate: number;
}

export interface LicenseExpirySweepResult {
  ok: boolean;
  officesProcessed: number;
  membersChecked: number;
  notificationsCreated: number;
  offices: LicenseExpirySweepOfficeResult[];
}

export function calcDaysToDate(dateStr: string): number {
  if (!dateStr) return 9999;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return 9999;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export async function runLicenseExpirySweep(targetOfficeId?: string): Promise<LicenseExpirySweepResult> {
  const officeResults: LicenseExpirySweepOfficeResult[] = [];
  let totalMembersChecked = 0;
  let totalNotificationsCreated = 0;

  let allUsers: AppUser[] = [];
  try {
    allUsers = await listSupabaseUsers();
  } catch (err) {
    logger.error({ err }, "runLicenseExpirySweep: failed to fetch users list");
  }

  // Determine office IDs to sweep
  const officeIdsSet = new Set<string>();
  if (targetOfficeId && targetOfficeId.trim()) {
    officeIdsSet.add(targetOfficeId.trim());
  } else {
    for (const u of allUsers) {
      if (u.status === "suspended") continue;
      if (u.role === "admin") {
        officeIdsSet.add(u.id);
      } else if (u.admin_id) {
        officeIdsSet.add(u.admin_id);
      }
    }
  }

  for (const officeId of officeIdsSet) {
    const officeUsers = allUsers.filter((u) => u.id === officeId || u.admin_id === officeId);
    const adminUser =
      officeUsers.find((u) => u.role === "admin" && u.id === officeId) ||
      officeUsers.find((u) => u.role === "admin") ||
      null;

    if (!adminUser) continue;

    const staffMembers = officeUsers.filter((u) => u.role === "staff");
    let membersChecked = 0;
    let expiringFound = 0;
    let notificationsCreated = 0;
    let skippedDuplicate = 0;

    for (const member of staffMembers) {
      membersChecked++;
      const expiryDate = member.license_expiry_date || member.licenseExpiryDate;
      if (!expiryDate) continue;

      const daysRemaining = calcDaysToDate(expiryDate);
      if (daysRemaining > 0 && daysRemaining <= LICENSE_EXPIRY_THRESHOLD_DAYS) {
        expiringFound++;
        const memberIdStr = String(member.id);

        const alreadyNotified = await hasRecentNotification(
          officeId,
          "staff_license_expiring",
          "user",
          memberIdStr,
          24,
        );

        if (alreadyNotified) {
          skippedDuplicate++;
          continue;
        }

        const memberName = member.display_name || member.username;
        const licenseNumber = member.license_number || member.licenseNumber || "غير محدد";

        const res = await dispatchEventNotification({
          officeId,
          eventType: "staff_license_expiring",
          recipientUserId: adminUser.id,
          placeholderData: {
            memberName,
            licenseNumber,
            daysRemaining: String(daysRemaining),
            expiryDate,
          },
          relatedRecordType: "user",
          relatedRecordId: memberIdStr,
        });

        if (res.inAppCreated || res.whatsappSent) {
          notificationsCreated++;
        }
      }
    }

    totalMembersChecked += membersChecked;
    totalNotificationsCreated += notificationsCreated;

    officeResults.push({
      officeId,
      membersChecked,
      expiringFound,
      notificationsCreated,
      skippedDuplicate,
    });
  }

  return {
    ok: true,
    officesProcessed: officeIdsSet.size,
    membersChecked: totalMembersChecked,
    notificationsCreated: totalNotificationsCreated,
    offices: officeResults,
  };
}
