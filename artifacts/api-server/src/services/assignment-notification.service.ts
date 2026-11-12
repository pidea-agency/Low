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

import { logger } from "../lib/logger";
import { findUserByIdOrUsername } from "./supabase.service";
import { createNotification } from "./postgres.service";
import { WhatsappReminderChannel } from "./reminder/channels/whatsappChannel";

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

  const title = `تكليف جديد: ${recordTypeArabic}`;
  const body = `تم تكليفك بـ${recordTypeArabic} جديد: ${recordDescription}. لمتابعتها: ${directLink}.`;

  let inAppCreated = false;
  let whatsappSent = false;

  // 4. Create in-app notification
  try {
    await createNotification({
      officeId,
      userId: targetLawyerId,
      type: "case_assigned",
      title,
      body,
      relatedRecordType: recordType,
      relatedRecordId: String(recordId),
    });
    inAppCreated = true;
  } catch (err) {
    logger.error({ err, targetLawyerId, recordType, recordId }, "Failed to create in-app assignment notification");
  }

  // 5. Lookup assigned lawyer for WhatsApp dispatch
  try {
    const lawyer = await findUserByIdOrUsername(targetLawyerId);
    const phone = lawyer?.phone?.trim();

    if (phone) {
      const whatsappMessage = `تم تكليفك بـ${recordTypeArabic} جديد: ${recordDescription}. لمتابعتها: ${directLink}.`;
      const channel = new WhatsappReminderChannel();
      await channel.sendRaw(whatsappMessage, phone);
      whatsappSent = true;
      logger.info({ phone, targetLawyerId, recordType, recordId }, "Assignment WhatsApp message dispatched successfully");
    }
  } catch (err) {
    // WhatsApp failures must NEVER block in-app notifications or fail the reassign operation
    logger.warn({ err, targetLawyerId, recordType, recordId }, "Failed to send assignment WhatsApp message (non-blocking)");
  }

  return { notified: true, inAppCreated, whatsappSent };
}
