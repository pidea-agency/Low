/**
 * poa-expiry.service.ts
 *
 * Daily sweep service for POA (وكالات) expiry tracking.
 * Scans POAs per office that expire within POA_EXPIRY_THRESHOLD_DAYS (7 days),
 * prevents duplicate notifications within 24 hours, and creates scoped in-app
 * notifications for the assigned lawyer and office admin.
 */

import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { listSupabaseUsers, type AppUser } from "../supabase.service";
import {
  listPoa,
  calcDaysFromHijri,
  hasRecentNotification,
} from "../postgres.service";
import { dispatchEventNotification } from "../notification-template.service";

export const POA_EXPIRY_THRESHOLD_DAYS = 7;

export interface PoaExpirySweepOfficeResult {
  officeId: string;
  poasChecked: number;
  expiringFound: number;
  notificationsCreated: number;
  skippedDuplicate: number;
}

export interface PoaExpirySweepResult {
  ok: boolean;
  officesProcessed: number;
  poasChecked: number;
  notificationsCreated: number;
  offices: PoaExpirySweepOfficeResult[];
}

export async function runPoaExpirySweep(targetOfficeId?: string): Promise<PoaExpirySweepResult> {
  const officeResults: PoaExpirySweepOfficeResult[] = [];
  let totalPoasChecked = 0;
  let totalNotificationsCreated = 0;

  let allUsers: AppUser[] = [];
  try {
    allUsers = await listSupabaseUsers();
  } catch (err) {
    logger.error({ err }, "runPoaExpirySweep: failed to fetch users list");
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
    const officeUsers = allUsers.filter(
      (u) => u.id === officeId || u.admin_id === officeId,
    );
    const adminUser =
      officeUsers.find((u) => u.role === "admin" && u.id === officeId) ||
      officeUsers.find((u) => u.role === "admin") ||
      officeUsers.find((u) => u.id === officeId) ||
      null;

    let poas: any[] = [];
    try {
      poas = await listPoa(officeId);
    } catch (err) {
      logger.error({ err, officeId }, "runPoaExpirySweep: failed to list POAs for office");
      continue;
    }

    let poasChecked = 0;
    let expiringFound = 0;
    let notificationsCreated = 0;
    let skippedDuplicate = 0;

    for (const poa of poas) {
      poasChecked++;
      const expiryHijri = poa.expiryDateHijri || poa.expiry_date_hijri;
      if (!expiryHijri) continue;

      const daysRemaining = calcDaysFromHijri(expiryHijri);

      // We track POAs expiring within threshold that are not already past (> 0 and <= threshold)
      if (daysRemaining > 0 && daysRemaining <= POA_EXPIRY_THRESHOLD_DAYS) {
        expiringFound++;

        const poaIdStr = String(poa.id);
        const alreadyNotified = await hasRecentNotification(
          officeId,
          "poa_expiring",
          "poa",
          poaIdStr,
          24,
        );

        if (alreadyNotified) {
          skippedDuplicate++;
          continue;
        }

        const clientName = poa.clientName || poa.client_name || "بدون اسم";
        const poaNumber = poa.poaNumber || poa.poa_number || "---";
        const assignedLawyerId = poa.assignedLawyerId || poa.assigned_lawyer_id;

        if (assignedLawyerId) {
          const lawyer = officeUsers.find((u) => u.id === assignedLawyerId);
          const lawyerName = lawyer?.display_name || lawyer?.username || "محامٍ";

          // Notify assigned lawyer via template system
          const res1 = await dispatchEventNotification({
            officeId,
            eventType: "poa_expiring",
            recipientUserId: assignedLawyerId,
            placeholderData: {
              poaNumber,
              clientName,
              daysRemaining: String(daysRemaining),
              expiryDate: expiryHijri,
              lawyerName,
              directLink: `${env.frontendUrl}/poa`,
            },
            relatedRecordType: "poa",
            relatedRecordId: poaIdStr,
          });
          if (res1.inAppCreated || res1.whatsappSent) {
            notificationsCreated++;
          }

          // Also notify admin if admin exists and is not the same person as assigned lawyer
          if (adminUser && adminUser.id !== assignedLawyerId) {
            const res2 = await dispatchEventNotification({
              officeId,
              eventType: "poa_expiring",
              recipientUserId: adminUser.id,
              placeholderData: {
                poaNumber,
                clientName,
                daysRemaining: String(daysRemaining),
                expiryDate: expiryHijri,
                lawyerName,
                directLink: `${env.frontendUrl}/poa`,
              },
              relatedRecordType: "poa",
              relatedRecordId: poaIdStr,
            });
            if (res2.inAppCreated || res2.whatsappSent) {
              notificationsCreated++;
            }
          }
        } else {
          // Unassigned POA: notify admin only with a note that it's unassigned
          if (adminUser) {
            const res3 = await dispatchEventNotification({
              officeId,
              eventType: "poa_expiring",
              recipientUserId: adminUser.id,
              placeholderData: {
                poaNumber,
                clientName,
                daysRemaining: String(daysRemaining),
                expiryDate: expiryHijri,
                lawyerName: "غير معين",
                directLink: `${env.frontendUrl}/poa`,
              },
              relatedRecordType: "poa",
              relatedRecordId: poaIdStr,
            });
            if (res3.inAppCreated || res3.whatsappSent) {
              notificationsCreated++;
            }
          }
        }
      }
    }

    totalPoasChecked += poasChecked;
    totalNotificationsCreated += notificationsCreated;
    officeResults.push({
      officeId,
      poasChecked,
      expiringFound,
      notificationsCreated,
      skippedDuplicate,
    });
  }

  logger.info(
    {
      officesCount: officeResults.length,
      totalPoasChecked,
      totalNotificationsCreated,
    },
    "POA expiry sweep completed successfully",
  );

  return {
    ok: true,
    officesProcessed: officeResults.length,
    poasChecked: totalPoasChecked,
    notificationsCreated: totalNotificationsCreated,
    offices: officeResults,
  };
}

