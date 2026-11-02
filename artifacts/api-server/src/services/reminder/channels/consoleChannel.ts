import { logger } from "../../../lib/logger";
import type { ReminderChannel, ReminderPayload } from "../reminder.types";

/**
 * v1 reminder channel: logs the reminder instead of sending it anywhere.
 * Swap in / add WhatsApp, email, SMS, or push channels by implementing
 * `ReminderChannel` and registering them in `reminder.service.ts` —
 * this class and the scheduler stay untouched.
 */
export class ConsoleReminderChannel implements ReminderChannel {
  readonly name = "console";

  async send(payload: ReminderPayload): Promise<void> {
    const label = payload.kind === "24h" ? "tomorrow" : "in a few hours";
    const maskedPhone = payload.recipientPhone
      ? (payload.recipientPhone.length <= 3 ? "***" : "*".repeat(payload.recipientPhone.length - 3) + payload.recipientPhone.slice(-3))
      : "";
    logger.info(
      {
        sessionId: payload.sessionId,
        caseNumber: payload.caseNumber,
        kind: payload.kind,
        recipientPhone: maskedPhone,
      },
      `Reminder:\nCase ${payload.caseNumber ?? "(unknown)"}\nHearing ${label} at ${
        payload.sessionTime ?? "(unknown time)"
      }.`,
    );
  }
}
