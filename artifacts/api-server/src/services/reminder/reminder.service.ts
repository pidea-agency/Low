import { logger } from "../../lib/logger";
import { ConsoleReminderChannel } from "./channels/consoleChannel";
import { WhatsappReminderChannel } from "./channels/whatsappChannel";
import type { ReminderChannel, ReminderPayload } from "./reminder.types";

/**
 * Fan-out point for reminder delivery. The scheduler calls `notify(...)`
 * once per triggered reminder; this service dispatches it to every
 * registered channel (Console & WhatsApp).
 */
const channels: ReminderChannel[] = [
  new ConsoleReminderChannel(),
  new WhatsappReminderChannel(),
];

export interface NotifyResult {
  allSucceeded: boolean;
  whatsappSuccess: boolean;
  whatsappError?: string;
}

export async function notify(payload: ReminderPayload, officeId: string): Promise<NotifyResult> {
  if (!officeId || !officeId.trim()) {
    throw new Error("officeId is required to send notifications.");
  }
  if (payload.officeId !== officeId) {
    throw new Error("Mismatched officeId between payload and notify parameter.");
  }
  let whatsappSuccess = false;
  let whatsappError: string | undefined;
  let hasAnyFailure = false;

  await Promise.all(
    channels.map(async (channel) => {
      try {
        await channel.send(payload);
        if (channel.name === "whatsapp") {
          whatsappSuccess = true;
        }
      } catch (err: any) {
        hasAnyFailure = true;
        if (channel.name === "whatsapp") {
          whatsappSuccess = false;
          whatsappError = err?.message || "فشل إرسال تذكير الواتساب.";
        }
        logger.error(
          { err, channel: channel.name, sessionId: payload.sessionId, officeId },
          "Reminder channel failed to send",
        );
      }
    }),
  );

  return {
    allSucceeded: !hasAnyFailure,
    whatsappSuccess,
    whatsappError,
  };
}
