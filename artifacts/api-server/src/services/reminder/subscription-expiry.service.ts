/**
 * subscription-expiry.service.ts
 *
 * Daily sweep service for office subscription expiry tracking.
 * Scans active offices whose subscription_end_date is within SUBSCRIPTION_EXPIRY_THRESHOLD_DAYS (7 days),
 * prevents duplicate notifications within 24 hours, and dispatches standardized notifications
 * via dispatchEventNotification() to the office admin.
 */

import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { listSupabaseUsers, type AppUser } from "../supabase.service";
import { hasRecentNotification } from "../postgres.service";
import { dispatchEventNotification } from "../notification-template.service";

export const SUBSCRIPTION_EXPIRY_THRESHOLD_DAYS = 7;

export interface SubscriptionExpiryOfficeResult {
  officeId: string;
  adminId: string;
  daysRemaining: number;
  endDate: string;
  notified: boolean;
  skippedDuplicate: boolean;
}

export interface SubscriptionExpirySweepResult {
  ok: boolean;
  officesProcessed: number;
  expiringFound: number;
  notificationsCreated: number;
  skippedDuplicate: number;
  offices: SubscriptionExpiryOfficeResult[];
}

export async function runSubscriptionExpirySweep(
  targetOfficeId?: string,
): Promise<SubscriptionExpirySweepResult> {
  const officeResults: SubscriptionExpiryOfficeResult[] = [];
  let totalExpiringFound = 0;
  let totalNotificationsCreated = 0;
  let totalSkippedDuplicate = 0;

  let allUsers: AppUser[] = [];
  try {
    allUsers = await listSupabaseUsers();
  } catch (err) {
    logger.error({ err }, "runSubscriptionExpirySweep: failed to fetch users list");
    return {
      ok: false,
      officesProcessed: 0,
      expiringFound: 0,
      notificationsCreated: 0,
      skippedDuplicate: 0,
      offices: [],
    };
  }

  // Filter to active office admins
  const admins = allUsers.filter(
    (u) =>
      u.role === "admin" &&
      u.status !== "suspended" &&
      (!targetOfficeId || u.id === targetOfficeId || u.admin_id === targetOfficeId),
  );

  const now = Date.now();

  for (const admin of admins) {
    const officeId = admin.id;
    const endDateStr = admin.subscription_end_date;

    if (!endDateStr) {
      continue;
    }

    const endDate = new Date(endDateStr);
    if (isNaN(endDate.getTime())) {
      continue;
    }

    const diffMs = endDate.getTime() - now;
    const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

    // Threshold check: expiring within 7 days and not yet expired (> 0)
    if (daysRemaining > 0 && daysRemaining <= SUBSCRIPTION_EXPIRY_THRESHOLD_DAYS) {
      totalExpiringFound++;

      // Deduplication check: at most one notification per office every 24 hours
      const alreadyNotified = await hasRecentNotification(
        officeId,
        "subscription_expiring_soon",
        "subscription",
        officeId,
        24,
      );

      if (alreadyNotified) {
        totalSkippedDuplicate++;
        officeResults.push({
          officeId,
          adminId: admin.id,
          daysRemaining,
          endDate: endDateStr,
          notified: false,
          skippedDuplicate: true,
        });
        continue;
      }

      const dispatchResult = await dispatchEventNotification({
        officeId,
        eventType: "subscription_expiring_soon",
        recipientUserId: admin.id,
        recipientPhone: admin.phone || null,
        placeholderData: {
          planName: admin.plan_tier || "الأساسية",
          daysRemaining: String(daysRemaining),
          endDate: endDateStr.split("T")[0],
          officeName: admin.office_name || "مكتب المحاماة",
          renewLink: `${env.frontendUrl}/settings?tab=subscription`,
          directLink: `${env.frontendUrl}/settings?tab=subscription`,
        },
        relatedRecordType: "subscription",
        relatedRecordId: officeId,
      });

      if (dispatchResult.inAppCreated || dispatchResult.whatsappSent) {
        totalNotificationsCreated++;
      }

      officeResults.push({
        officeId,
        adminId: admin.id,
        daysRemaining,
        endDate: endDateStr,
        notified: dispatchResult.inAppCreated || dispatchResult.whatsappSent,
        skippedDuplicate: false,
      });
    }
  }

  return {
    ok: true,
    officesProcessed: admins.length,
    expiringFound: totalExpiringFound,
    notificationsCreated: totalNotificationsCreated,
    skippedDuplicate: totalSkippedDuplicate,
    offices: officeResults,
  };
}
