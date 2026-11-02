/**
 * Contract every reminder delivery channel must implement. The scheduler
 * only ever talks to `ReminderService.notify(...)` (see reminder.service.ts)
 * — it never knows how a reminder is actually delivered. Adding WhatsApp,
 * email, SMS, or push notifications later means writing a new
 * `ReminderChannel` and registering it; the scheduler's logic never changes.
 */
export interface ReminderPayload {
  officeId: string;
  recipientPhone: string;
  sessionId: number;
  caseNumber: string | null;
  sessionDateHijri: string | null;
  sessionTime: string | null;
  /** Which threshold triggered this reminder. */
  kind: "24h" | "6h" | "instant";
  remainingText?: string | null;
  court?: string | null;
  courtCircuit?: string | null;
  plaintiff?: string | null;
  defendant?: string | null;
  caseSubject?: string | null;
}

export interface ReminderChannel {
  readonly name: string;
  send(payload: ReminderPayload): Promise<void>;
}
