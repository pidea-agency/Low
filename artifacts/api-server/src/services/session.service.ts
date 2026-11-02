import type { Session, SessionInput, SessionUpdate, SessionStatus } from "@workspace/api-client-react";
import {
  appendRow,
  deleteRow,
  ensureSheetReady,
  listRows,
  SHEET_COLUMNS,
  updateRow,
  updateRowCells,
  type SheetRow,
} from "./googleSheets.service";
import { computeHearingDateTime, parseHijriDateString, hijriToGregorian } from "../utils/hijri";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { listPoaRows } from "./poa.sheets.service";
import { listJudgmentRowsWithHeaders } from "./judgment.sheets.service";
import { listTaskRowsWithHeaders } from "./task.sheets.service";

const COLUMN_INDEX: Record<string, number> = {
  // Arabic headers
  "رقم القضية": 0,
  "المدعي": 1,
  "المدعى عليه": 2,
  "المحكمة": 3,
  "الدائرة القضائية": 4,
  "موضوع القضية": 5,
  "نوع الجلسة": 6,
  "تاريخ الجلسة هجري": 7,
  "يوم الجلسة": 8,
  "وقت الجلسة": 9,
  "الأيام المتبقية": 10,
  "ملاحظات": 11,
  "حالة الجلسة": 12,
  "تذكير 24 ساعة": 13,
  "تذكير 6 ساعات": 14,
  "تاريخ الإنشاء": 15,
  "التقرير": 16,

  // English header aliases
  "Case Number": 0,
  "Plaintiff": 1,
  "Defendant": 2,
  "Court": 3,
  "Court Circuit": 4,
  "Case Subject": 5,
  "Session Type": 6,
  "Session Date Hijri": 7,
  "Session Day": 8,
  "Session Time": 9,
  "Days Remaining": 10,
  "Notes": 11,
  "Status": 12,
  "Reminder24": 13,
  "Reminder6": 14,
  "Created At": 15,
  "Report": 16,
};

function cell(row: SheetRow, name: string): string {
  const index = COLUMN_INDEX[name];
  if (index === undefined) return "";
  return row[index] ?? "";
}

function nullableString(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseStatus(raw: string): SessionStatus {
  const normalized = raw.trim();
  if (normalized === "Upcoming" || normalized === "قادمة") return "Upcoming";
  if (normalized === "Today" || normalized === "اليوم") return "Today";
  if (normalized === "Finished" || normalized === "منتهية") return "Finished";
  if (normalized === "Cancelled" || normalized === "ملغاة") return "Cancelled";
  return "Upcoming";
}

const ARABIC_DAYS = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

export function computeSessionDayStr(
  sessionDateHijri: string | null | undefined,
  sessionTime: string | null | undefined,
): string {
  const hearingAt = computeHearingDateTime(sessionDateHijri, sessionTime);
  if (hearingAt) {
    return ARABIC_DAYS[hearingAt.getUTCDay()] ?? "—";
  }
  const hijri = parseHijriDateString(sessionDateHijri);
  if (!hijri) return "—";
  const greg = hijriToGregorian(hijri);
  if (!greg) return "—";
  const date = new Date(Date.UTC(greg.year, greg.month - 1, greg.day));
  return ARABIC_DAYS[date.getUTCDay()] ?? "—";
}

function rowToSession(id: number, row: SheetRow): Session {
  const sessionDateHijri = nullableString(cell(row, "Session Date Hijri"));
  const sessionTime = nullableString(cell(row, "Session Time"));
  const hearingDate = computeHearingDateTime(sessionDateHijri, sessionTime);
  const rawSessionDay = nullableString(cell(row, "Session Day"));
  const sessionDay = rawSessionDay || computeSessionDayStr(sessionDateHijri, sessionTime);
  return {
    id,
    caseNumber: nullableString(cell(row, "Case Number")),
    plaintiff: nullableString(cell(row, "Plaintiff")),
    defendant: nullableString(cell(row, "Defendant")),
    court: nullableString(cell(row, "Court")),
    courtCircuit: nullableString(cell(row, "Court Circuit")),
    caseSubject: nullableString(cell(row, "Case Subject")),
    sessionType: nullableString(cell(row, "Session Type")),
    sessionDateHijri,
    sessionDay: sessionDay && sessionDay !== "—" ? sessionDay : null,
    sessionTime,
    notes: nullableString(cell(row, "Notes")),
    status: parseStatus(cell(row, "Status")),
    reminder24: cell(row, "Reminder24") === "true",
    reminder6: cell(row, "Reminder6") === "true",
    createdAt: cell(row, "Created At") || new Date().toISOString(),
    hearingAt: hearingDate ? hearingDate.toISOString() : null,
  };
}

export function computeDaysRemainingStr(
  sessionDateHijri: string | null | undefined,
  sessionTime: string | null | undefined,
): string {
  let hearingAt = computeHearingDateTime(sessionDateHijri, sessionTime);
  if (!hearingAt) {
    const hijri = parseHijriDateString(sessionDateHijri);
    if (!hijri) return "—";
    const greg = hijriToGregorian(hijri);
    if (!greg) return "—";
    hearingAt = new Date(Date.UTC(greg.year, greg.month - 1, greg.day));
  }

  const offsetHours = env.courtTimezoneOffsetHours;
  const nowMecca = new Date(Date.now() + offsetHours * 3600 * 1000);
  const hearingMecca = new Date(hearingAt.getTime() + offsetHours * 3600 * 1000);

  const hearingYear = hearingMecca.getUTCFullYear();
  const hearingMonth = hearingMecca.getUTCMonth();
  const hearingDay = hearingMecca.getUTCDate();

  const nowYear = nowMecca.getUTCFullYear();
  const nowMonth = nowMecca.getUTCMonth();
  const nowDay = nowMecca.getUTCDate();

  const hearingMidnight = Date.UTC(hearingYear, hearingMonth, hearingDay);
  const nowMidnight = Date.UTC(nowYear, nowMonth, nowDay);

  const diffMs = hearingMidnight - nowMidnight;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "اليوم";
  if (diffDays < 0) return `انتهت (منذ ${Math.abs(diffDays)} يوم)`;
  return `${diffDays} يوم`;
}

function sessionInputToRow(input: SessionInput, createdAt: string): SheetRow {
  const daysRemaining = computeDaysRemainingStr(input.sessionDateHijri, input.sessionTime);
  const sessionDay = computeSessionDayStr(input.sessionDateHijri, input.sessionTime);
  return [
    input.caseNumber ?? "",              // 0: رقم القضية
    input.plaintiff ?? "",               // 1: المدعي
    input.defendant ?? "",               // 2: المدعى عليه
    input.court ?? "",                   // 3: المحكمة
    input.courtCircuit ?? "",            // 4: الدائرة القضائية
    input.caseSubject ?? "",             // 5: موضوع القضية
    input.sessionType ?? "",             // 6: نوع الجلسة
    input.sessionDateHijri ?? "",        // 7: تاريخ الجلسة هجري
    sessionDay,                          // 8: يوم الجلسة
    input.sessionTime ?? "",             // 9: وقت الجلسة
    daysRemaining,                       // 10: الأيام المتبقية
    input.notes ?? "",                    // 11: ملاحظات
    "Upcoming",                          // 12: حالة الجلسة
    "false",                             // 13: تذكير 24 ساعة
    "false",                             // 14: تذكير 6 ساعات
    createdAt,                           // 15: تاريخ الإنشاء
    "",                                  // 16: التقرير
  ];
}

/** Derives dashboard-facing status from the stored status + parsed hearing date, without persisting anything. */
function deriveEffectiveStatus(session: Session): SessionStatus {
  if (session.status === "Cancelled" || session.status === "Finished") {
    return session.status;
  }
  const hearingAt = computeHearingDateTime(
    session.sessionDateHijri,
    session.sessionTime,
  );
  if (!hearingAt) {
    return session.status;
  }
  const now = new Date();
  if (hearingAt.getTime() < now.getTime()) {
    return "Finished";
  }
  const offsetHours = env.courtTimezoneOffsetHours;
  const meccaHearing = new Date(hearingAt.getTime() + offsetHours * 3600 * 1000);
  const meccaNow = new Date(now.getTime() + offsetHours * 3600 * 1000);
  const isSameDay =
    meccaHearing.getUTCFullYear() === meccaNow.getUTCFullYear() &&
    meccaHearing.getUTCMonth() === meccaNow.getUTCMonth() &&
    meccaHearing.getUTCDate() === meccaNow.getUTCDate();
  return isSameDay ? "Today" : "Upcoming";
}

export function sortSessionsByNearestTime(sessions: Session[]): Session[] {
  const now = Date.now();

  return [...sessions].sort((a, b) => {
    const timeA = a.hearingAt ? new Date(a.hearingAt).getTime() : null;
    const timeB = b.hearingAt ? new Date(b.hearingAt).getTime() : null;

    const validA = timeA !== null && !isNaN(timeA);
    const validB = timeB !== null && !isNaN(timeB);

    if (validA && validB) {
      const isPastA = timeA! < now;
      const isPastB = timeB! < now;

      if (!isPastA && isPastB) return -1;
      if (isPastA && !isPastB) return 1;

      if (!isPastA && !isPastB) {
        return timeA! - timeB!;
      }

      if (isPastA && isPastB) {
        return timeB! - timeA!;
      }
    }

    if (validA && !validB) return -1;
    if (!validA && validB) return 1;

    return (b.id ?? 0) - (a.id ?? 0);
  });
}

export async function listSessions(statusFilter?: SessionStatus, userId?: string): Promise<Session[]> {
  await ensureSheetReady(userId);
  const rows = await listRows(userId);
  let sessions = rows
    .map(({ id, values }) => {
      const s = rowToSession(id, values);
      const expectedDay = computeSessionDayStr(s.sessionDateHijri, s.sessionTime);
      const expectedRemaining = computeDaysRemainingStr(s.sessionDateHijri, s.sessionTime);

      const currentDayCell = cell(values, "Session Day");
      const currentRemainingCell = cell(values, "Days Remaining");

      if (currentDayCell !== expectedDay || currentRemainingCell !== expectedRemaining) {
        updateRowCells(id, {
          [COLUMN_INDEX["Days Remaining"]]: expectedRemaining,
          [COLUMN_INDEX["Session Day"]]: expectedDay,
        }, userId).catch((err) => logger.warn({ err, id, userId }, "Failed to auto-sync row cells"));
      }
      return s;
    });

  if (statusFilter) {
    sessions = sessions.filter((s) => deriveEffectiveStatus(s) === statusFilter);
  }

  return sortSessionsByNearestTime(sessions);
}

export async function getSessionById(id: number, userId?: string): Promise<Session | null> {
  const rows = await listRows(userId);
  const match = rows.find((r) => r.id === id);
  return match ? rowToSession(match.id, match.values) : null;
}

export async function createSession(input: SessionInput, userId?: string): Promise<Session> {
  await ensureSheetReady(userId);
  const createdAt = new Date().toISOString();
  const row = sessionInputToRow(input, createdAt);
  const id = await appendRow(row, userId);
  return rowToSession(id, row);
}

export async function updateSession(
  id: number,
  patch: SessionUpdate,
  userId?: string,
): Promise<Session | null> {
  const rows = await listRows(userId);
  const match = rows.find((r) => r.id === id);
  if (!match) {
    return null;
  }
  const existing = rowToSession(id, match.values);
  const existingReport = match.values[COLUMN_INDEX["Report"]] ?? "";

  const merged: Session = {
    ...existing,
    ...Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ),
  };
  const daysRemaining = computeDaysRemainingStr(merged.sessionDateHijri, merged.sessionTime);
  const sessionDay = computeSessionDayStr(merged.sessionDateHijri, merged.sessionTime);
  const row: SheetRow = [
    merged.caseNumber ?? "",             // 0: رقم القضية
    merged.plaintiff ?? "",              // 1: المدعي
    merged.defendant ?? "",              // 2: المدعى عليه
    merged.court ?? "",                  // 3: المحكمة
    merged.courtCircuit ?? "",           // 4: الدائرة القضائية
    merged.caseSubject ?? "",            // 5: موضوع القضية
    merged.sessionType ?? "",            // 6: نوع الجلسة
    merged.sessionDateHijri ?? "",       // 7: تاريخ الجلسة هجري
    sessionDay,                          // 8: يوم الجلسة
    merged.sessionTime ?? "",            // 9: وقت الجلسة
    daysRemaining,                       // 10: الأيام المتبقية
    merged.notes ?? "",                  // 11: ملاحظات
    merged.status,                       // 12: حالة الجلسة
    String(merged.reminder24),           // 13: تذكير 24 ساعة
    String(merged.reminder6),            // 14: تذكير 6 ساعات
    merged.createdAt,                    // 15: تاريخ الإنشاء
    existingReport,                      // 16: التقرير
  ];
  await updateRow(id, row, userId);
  return merged;
}

export async function deleteSession(id: number, userId?: string): Promise<boolean> {
  const existing = await getSessionById(id, userId);
  if (!existing) {
    return false;
  }
  await deleteRow(id, userId);
  return true;
}

export async function markReminderSent(
  id: number,
  kind: "24h" | "6h",
  userId?: string,
): Promise<void> {
  const colIndex = kind === "24h" ? COLUMN_INDEX["Reminder24"] : COLUMN_INDEX["Reminder6"];
  await updateRowCells(id, { [colIndex]: "true" }, userId);
}

export interface DashboardStats {
  totalCases: number;
  todayHearings: number;
  upcomingHearings: number;
  finishedHearings: number;
  totalPoas: number;
  favorableJudgments: number;
  unfavorableJudgments: number;
  totalTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  urgentTasks: number;
}

export async function getDashboardStats(userId?: string): Promise<DashboardStats> {
  const [sessionsRes, poaRes, judgmentRes, taskRes] = await Promise.allSettled([
    listSessions(undefined, userId),
    userId ? listPoaRows(userId) : Promise.resolve([]),
    userId ? listJudgmentRowsWithHeaders(userId) : Promise.resolve({ headers: [], rows: [] }),
    userId ? listTaskRowsWithHeaders(userId) : Promise.resolve({ headers: [], rows: [] }),
  ]);

  const sessions = sessionsRes.status === "fulfilled" ? sessionsRes.value : [];
  const poas = poaRes.status === "fulfilled" ? poaRes.value : [];
  const judgmentData = judgmentRes.status === "fulfilled" ? judgmentRes.value : { headers: [], rows: [] };
  const taskData = taskRes.status === "fulfilled" ? taskRes.value : { headers: [], rows: [] };

  const uniqueCases = new Set<string>();
  let todayHearings = 0;
  let upcomingHearings = 0;
  let finishedHearings = 0;

  for (const s of sessions) {
    if (s.caseNumber && s.caseNumber.trim()) {
      uniqueCases.add(s.caseNumber.trim());
    }
    const status = deriveEffectiveStatus(s);
    if (status === "Today") todayHearings++;
    else if (status === "Upcoming") upcomingHearings++;
    else if (status === "Finished") finishedHearings++;
  }

  for (const j of judgmentData.rows) {
    const caseNumber = j.values[0];
    if (caseNumber && caseNumber.trim()) {
      uniqueCases.add(caseNumber.trim());
    }
  }

  let favorableJudgments = 0;
  let unfavorableJudgments = 0;
  for (const j of judgmentData.rows) {
    const ruling = (j.values[8] || "").trim();
    if (ruling === "لصالحنا" || ruling.toLowerCase() === "favorable") {
      favorableJudgments++;
    } else if (ruling === "ضدنا" || ruling.toLowerCase() === "unfavorable") {
      unfavorableJudgments++;
    }
  }

  let inProgressTasks = 0;
  let completedTasks = 0;
  let urgentTasks = 0;
  for (const t of taskData.rows) {
    const status = (t.values[4] || "").trim();
    const priority = (t.values[3] || "").trim();

    if (status === "قيد التنفيذ" || status === "جديدة" || status === "قيد المراجعة") {
      inProgressTasks++;
    } else if (status === "مكتملة") {
      completedTasks++;
    }

    if (priority === "عاجلة" || priority === "عالية") {
      urgentTasks++;
    }
  }

  return {
    totalCases: uniqueCases.size,
    todayHearings,
    upcomingHearings,
    finishedHearings,
    totalPoas: poas.length,
    favorableJudgments,
    unfavorableJudgments,
    totalTasks: taskData.rows.length,
    inProgressTasks,
    completedTasks,
    urgentTasks,
  };
}

export async function getSessionReport(id: number, userId?: string): Promise<{ session: Session; report: string | null } | null> {
  const rows = await listRows(userId);
  const match = rows.find((r) => r.id === id);
  if (!match) {
    return null;
  }
  const session = rowToSession(match.id, match.values);
  const rawReport = match.values[COLUMN_INDEX["Report"]];
  const report = rawReport && rawReport.trim().length > 0 ? rawReport.trim() : null;
  return { session, report };
}

export async function saveSessionReport(id: number, report: string, userId?: string): Promise<{ session: Session; report: string } | null> {
  const rows = await listRows(userId);
  const match = rows.find((r) => r.id === id);
  if (!match) {
    return null;
  }
  await updateRowCells(id, { [COLUMN_INDEX["Report"]]: report }, userId);
  const session = rowToSession(match.id, match.values);
  return { session, report };
}

export {
  SHEET_COLUMNS,
  COLUMN_INDEX,
  cell,
  nullableString,
  parseStatus,
  deriveEffectiveStatus,
  rowToSession,
  sessionInputToRow,
};
