/**
 * assignment-notification.service.ts
 *
 * Handles notifications for case/session/poa/judgment/task assignment and reassignment.
 *
 * Rules:
 * 1. Only notify on actual reassignment to a DIFFERENT lawyer (not when assigned to the same lawyer).
 * 2. Skip if the assigning admin assigned the record to themselves.
 * 3. Create an in-app notification of type 'case_assigned' for the assigned lawyer.
 * 4. Send a WhatsApp notification (via whatsappChannel) if the lawyer has a phone number on file.
 * 5. WhatsApp failure MUST NOT block the in-app notification creation or throw an error.
 */

import { env } from "../config/env";
import { logger } from "../lib/logger";
import {
  dispatchEventNotification,
  type NotificationEventType,
} from "./notification-template.service";

export interface AssignmentNotificationParams {
  officeId: string;
  assignerId?: string | null;
  targetLawyerId: string | null;
  previousLawyerId?: string | null;
  recordType: "case" | "session" | "poa" | "judgment" | "task";
  recordTypeArabic: string;
  recordId: string | number;
  recordDescription: string;
  directLink: string;
}

export async function notifyLawyerAssignment(
  params: AssignmentNotificationParams,
): Promise<{ notified: boolean; inAppCreated: boolean; whatsappSent: boolean }> {
  const {
    officeId,
    assignerId,
    targetLawyerId,
    previousLawyerId,
    recordType,
    recordTypeArabic,
    recordId,
    recordDescription,
    directLink,
  } = params;

  // 1. If unassigning, no notification needed
  if (!targetLawyerId) {
    return { notified: false, inAppCreated: false, whatsappSent: false };
  }

  // 2. Only notify on actual reassignment to a DIFFERENT lawyer
  if (previousLawyerId && String(previousLawyerId) === String(targetLawyerId)) {
    return { notified: false, inAppCreated: false, whatsappSent: false };
  }

  // 3. Skip if the assigning admin assigned it to themselves
  if (assignerId && String(assignerId) === String(targetLawyerId)) {
    return { notified: false, inAppCreated: false, whatsappSent: false };
  }

  const eventType: NotificationEventType =
    recordType === "poa" ? "poa_assigned" : "case_assigned";

  const absoluteLink = directLink
    ? directLink.startsWith("http://") || directLink.startsWith("https://")
      ? directLink
      : `${env.frontendUrl}${directLink.startsWith("/") ? "" : "/"}${directLink}`
    : env.frontendUrl;

  const dispatchRes = await dispatchEventNotification({
    officeId,
    eventType,
    recipientUserId: targetLawyerId,
    placeholderData: {
      recordTypeArabic,
      recordDescription,
      directLink: absoluteLink,
      recordId: String(recordId),
      poaNumber: recordDescription,
      clientName: recordDescription,
    },
    relatedRecordType: recordType,
    relatedRecordId: String(recordId),
  });

  return {
    notified: true,
    inAppCreated: dispatchRes.inAppCreated,
    whatsappSent: dispatchRes.whatsappSent,
  };
}
