import type { Session, SessionInput, SessionUpdate, SessionStatus } from "@workspace/api-client-react";
import * as postgresService from "./postgres.service";
import { findUserByIdOrUsername, listOfficeMembers } from "./supabase.service";
import { computeHearingDateTime, parseHijriDateString, hijriToGregorian } from "../utils/hijri";
import { env } from "../config/env";
import { logger } from "../lib/logger";

export const SHEET_COLUMNS = [
  "رقم القضية",
  "المدعي",
  "المدعى عليه",
  "المحكمة",
  "الدائرة القضائية",
  "موضوع القضية",
  "نوع الجلسة",
  "تاريخ الجلسة هجري",
  "يوم الجلسة",
  "وقت الجلسة",
  "الأيام المتبقية",
  "ملاحظات",
  "حالة الجلسة",
  "تذكير 24 ساعة",
  "تذكير 6 ساعات",
  "تاريخ الإنشاء",
  "التقرير",
];

export const COLUMN_INDEX: Record<string, number> = {
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

const ARABIC_DAYS = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

function cell(row: string[], name: string): string {
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

export function rowToSession(id: number, row: string[]): Session {
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

export function sessionInputToRow(input: SessionInput, createdAt: string): string[] {
  const daysRemaining = computeDaysRemainingStr(input.sessionDateHijri, input.sessionTime);
  const sessionDay = computeSessionDayStr(input.sessionDateHijri, input.sessionTime);
  const anyInput = input as any;
  return [
    input.caseNumber ?? "",
    input.plaintiff ?? "",
    input.defendant ?? "",
    input.court ?? "",
    input.courtCircuit ?? "",
    input.caseSubject ?? "",
    input.sessionType ?? "",
    input.sessionDateHijri ?? "",
    sessionDay,
    input.sessionTime ?? "",
    daysRemaining,
    input.notes ?? "",
    anyInput.status ?? "Upcoming",
    anyInput.reminder24 ? "true" : "false",
    anyInput.reminder6 ? "true" : "false",
    createdAt,
    "",
  ];
}

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

export function isHearingToday(
  sessionDateHijri: string | null | undefined,
  sessionTime: string | null | undefined,
): boolean {
  const hearingAt = computeHearingDateTime(sessionDateHijri, sessionTime);
  if (!hearingAt) return false;

  const offsetHours = env.courtTimezoneOffsetHours;
  const nowMecca = new Date(Date.now() + offsetHours * 3600 * 1000);
  const hearingMecca = new Date(hearingAt.getTime() + offsetHours * 3600 * 1000);

  return (
    hearingMecca.getUTCFullYear() === nowMecca.getUTCFullYear() &&
    hearingMecca.getUTCMonth() === nowMecca.getUTCMonth() &&
    hearingMecca.getUTCDate() === nowMecca.getUTCDate()
  );
}

export function deriveEffectiveStatus(session: Session): SessionStatus {
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

  if (hearingMidnight === nowMidnight) {
    return "Today";
  }
  if (hearingMidnight < nowMidnight) {
    return "Finished";
  }
  return "Upcoming";
}

async function resolveOfficeId(userIdOrOfficeId?: string): Promise<string> {
  if (!userIdOrOfficeId || !userIdOrOfficeId.trim()) {
    throw new Error("officeId is required");
  }
  try {
    const user = await findUserByIdOrUsername(userIdOrOfficeId);
    if (!user) return userIdOrOfficeId;
    if (user.role === "admin") return user.id;
    if (user.role === "staff") return user.admin_id || user.id;
    return userIdOrOfficeId;
  } catch {
    return userIdOrOfficeId;
  }
}

export async function markReminderSent(
  id: number,
  kind: "24h" | "6h",
  userIdOrOfficeId?: string,
): Promise<void> {
  const officeId = await resolveOfficeId(userIdOrOfficeId);
  const updateData = kind === "24h" ? { reminder24: true } : { reminder6: true };
  await postgresService.updateSession(id, updateData, officeId);
}

export async function listSessions(status?: string, userIdOrOfficeId?: string): Promise<Session[]> {
  const officeId = await resolveOfficeId(userIdOrOfficeId);
  let sessions = await postgresService.listSessions(officeId, status);

  // Fallback: If database returned 0 sessions, check if the office has rows in Google Sheets
  if (sessions.length === 0) {
    try {
      const { getUserGoogleCredentials } = await import("./supabase.service");
      const creds = await getUserGoogleCredentials(officeId);
      if (creds && creds.spreadsheetId && creds.serviceAccountJson) {
        const { listRows, ensureSheetReady } = await import("./googleSheets.service");
        await ensureSheetReady(officeId);
        const rows = await listRows(officeId);
        if (rows && rows.length > 0) {
          const sheetSessions = rows.map(({ id, values }) => rowToSession(id, values));
          const filtered = status && status !== "All"
            ? sheetSessions.filter((s) => s.status === status)
            : sheetSessions;
          return filtered.map((s) => ({
            ...s,
            status: deriveEffectiveStatus(s),
          }));
        }
      }
    } catch (err) {
      logger.debug({ err, officeId }, "Google Sheets fallback check skipped");
    }
  }

  return sessions.map((s) => ({
    ...s,
    status: deriveEffectiveStatus(s),
  }));
}

export async function getSessionById(id: number, userIdOrOfficeId?: string): Promise<Session | null> {
  const officeId = await resolveOfficeId(userIdOrOfficeId);
  const session = await postgresService.getSessionById(id, officeId);
  if (session) {
    return {
      ...session,
      status: deriveEffectiveStatus(session),
    };
  }

  // Fallback: check Google Sheets for this row
  try {
    const { getUserGoogleCredentials } = await import("./supabase.service");
    const creds = await getUserGoogleCredentials(officeId);
    if (creds && creds.spreadsheetId && creds.serviceAccountJson) {
      const { listRows } = await import("./googleSheets.service");
      const rows = await listRows(officeId);
      const match = rows.find((r) => r.id === id);
      if (match) {
        const s = rowToSession(match.id, match.values);
        return {
          ...s,
          status: deriveEffectiveStatus(s),
        };
      }
    }
  } catch (err) {
    logger.debug({ err, id, officeId }, "Google Sheets getSessionById fallback skipped");
  }

  return null;
}

export async function createSession(data: SessionInput, userIdOrOfficeId?: string): Promise<Session> {
  const officeId = await resolveOfficeId(userIdOrOfficeId);
  const session = await postgresService.createSession(data, officeId);

  // Sync to office Google Sheet if connected
  try {
    const { getUserGoogleCredentials } = await import("./supabase.service");
    const creds = await getUserGoogleCredentials(officeId);
    if (creds && creds.spreadsheetId && creds.serviceAccountJson) {
      const { appendRow, ensureSheetReady } = await import("./googleSheets.service");
      await ensureSheetReady(officeId).catch(() => {});
      const row = sessionInputToRow(data, session.createdAt || new Date().toISOString());
      await appendRow(row, officeId).catch((err) => {
        logger.warn({ err, officeId }, "Failed to append session to Google Sheets");
      });
    }
  } catch (err) {
    logger.debug({ err, officeId }, "Google Sheets sync skipped on createSession");
  }

  return {
    ...session,
    status: deriveEffectiveStatus(session),
  };
}

export async function updateSession(id: number, data: SessionUpdate, userIdOrOfficeId?: string): Promise<Session | null> {
  const officeId = await resolveOfficeId(userIdOrOfficeId);
  const session = await postgresService.updateSession(id, data, officeId);
  if (!session) return null;

  // Sync update to office Google Sheet if connected
  try {
    const { getUserGoogleCredentials } = await import("./supabase.service");
    const creds = await getUserGoogleCredentials(officeId);
    if (creds && creds.spreadsheetId && creds.serviceAccountJson) {
      const { updateRowCells } = await import("./googleSheets.service");
      const rowUpdates: Record<number, string> = {};
      if (data.caseNumber !== undefined) rowUpdates[COLUMN_INDEX["Case Number"]] = data.caseNumber || "";
      if (data.plaintiff !== undefined) rowUpdates[COLUMN_INDEX["Plaintiff"]] = data.plaintiff || "";
      if (data.defendant !== undefined) rowUpdates[COLUMN_INDEX["Defendant"]] = data.defendant || "";
      if (data.court !== undefined) rowUpdates[COLUMN_INDEX["Court"]] = data.court || "";
      if (data.courtCircuit !== undefined) rowUpdates[COLUMN_INDEX["Court Circuit"]] = data.courtCircuit || "";
      if (data.caseSubject !== undefined) rowUpdates[COLUMN_INDEX["Case Subject"]] = data.caseSubject || "";
      if (data.sessionType !== undefined) rowUpdates[COLUMN_INDEX["Session Type"]] = data.sessionType || "";
      if (data.sessionDateHijri !== undefined) {
        rowUpdates[COLUMN_INDEX["Session Date Hijri"]] = data.sessionDateHijri || "";
        rowUpdates[COLUMN_INDEX["Session Day"]] = computeSessionDayStr(data.sessionDateHijri, data.sessionTime || session.sessionTime);
        rowUpdates[COLUMN_INDEX["Days Remaining"]] = computeDaysRemainingStr(data.sessionDateHijri, data.sessionTime || session.sessionTime);
      }
      if (data.sessionTime !== undefined) {
        rowUpdates[COLUMN_INDEX["Session Time"]] = data.sessionTime || "";
      }
      if (data.notes !== undefined) rowUpdates[COLUMN_INDEX["Notes"]] = data.notes || "";
      if (data.status !== undefined) rowUpdates[COLUMN_INDEX["Status"]] = data.status || "Upcoming";
      const anyData = data as any;
      if (anyData.reminder24 !== undefined) rowUpdates[COLUMN_INDEX["Reminder24"]] = anyData.reminder24 ? "true" : "false";
      if (anyData.reminder6 !== undefined) rowUpdates[COLUMN_INDEX["Reminder6"]] = anyData.reminder6 ? "true" : "false";

      await updateRowCells(id, rowUpdates, officeId).catch((err) => {
        logger.warn({ err, id, officeId }, "Failed to sync session update to Google Sheets");
      });
    }
  } catch (err) {
    logger.debug({ err, id, officeId }, "Google Sheets update sync skipped");
  }

  return {
    ...session,
    status: deriveEffectiveStatus(session),
  };
}

export async function deleteSession(id: number, userIdOrOfficeId?: string): Promise<boolean> {
  const officeId = await resolveOfficeId(userIdOrOfficeId);
  const deleted = await postgresService.deleteSession(id, officeId);

  // Sync deletion to office Google Sheet if connected
  try {
    const { getUserGoogleCredentials } = await import("./supabase.service");
    const creds = await getUserGoogleCredentials(officeId);
    if (creds && creds.spreadsheetId && creds.serviceAccountJson) {
      const { deleteRow } = await import("./googleSheets.service");
      await deleteRow(id, officeId).catch((err) => {
        logger.warn({ err, id, officeId }, "Failed to sync session deletion to Google Sheets");
      });
    }
  } catch (err) {
    logger.debug({ err, id, officeId }, "Google Sheets delete sync skipped");
  }

  return deleted;
}

export async function getSessionReport(id: number, userIdOrOfficeId?: string): Promise<{ session: Session; report: string | null } | null> {
  const officeId = await resolveOfficeId(userIdOrOfficeId);
  return postgresService.getSessionReport(id, officeId);
}

export async function saveSessionReport(id: number, report: string, userIdOrOfficeId?: string): Promise<{ session: Session; report: string } | null> {
  const officeId = await resolveOfficeId(userIdOrOfficeId);
  return postgresService.saveSessionReport(id, report, officeId);
}

export async function getDashboardStats(
  userIdOrOfficeId?: string,
  assignee?: string
): Promise<{
  totalCases: number;
  todayHearings: number;
  upcomingHearings: number;
  finishedHearings: number;
  totalPoas: number;
}> {
  const officeId = await resolveOfficeId(userIdOrOfficeId);
  const [allSessions, poas] = await Promise.all([
    postgresService.listSessions(officeId),
    postgresService.listPoa(officeId),
  ]);

  const sessions = assignee
    ? allSessions.filter((s) => {
        const text = `${s.notes || ""} ${s.plaintiff || ""}`.toLowerCase();
        return text.includes(assignee.toLowerCase());
      })
    : allSessions;

  const uniqueCases = new Set(
    sessions.map((s) => s.caseNumber?.trim()).filter(Boolean),
  );

  let todayHearings = 0;
  let upcomingHearings = 0;
  let finishedHearings = 0;

  for (const s of sessions) {
    const status = deriveEffectiveStatus(s);
    if (status === "Today") todayHearings++;
    else if (status === "Upcoming") upcomingHearings++;
    else if (status === "Finished") finishedHearings++;
  }

  return {
    totalCases: uniqueCases.size,
    todayHearings,
    upcomingHearings,
    finishedHearings,
    totalPoas: poas.length,
  };
}

const ARABIC_MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export interface DashboardChartsData {
  sessionsTrend: Array<{ month: string; total: number; finished: number; upcoming: number }>;
  sessionsStatusDistribution: Array<{ name: string; count: number; fill: string }>;
  tasksStatusDistribution: Array<{ name: string; count: number; fill: string }>;
  tasksPriorityDistribution: Array<{ priority: string; count: number; fill: string }>;
  courtsDistribution: Array<{ court: string; count: number }>;
  judgmentsDistribution: Array<{ name: string; count: number; fill: string }>;
  teamAiUsage?: Array<{ name: string; usage: number; quota: number; percentage: number }>;
}

export async function getDashboardChartsData(
  userIdOrOfficeId?: string,
  assignee?: string,
  isAdmin: boolean = false
): Promise<DashboardChartsData> {
  const officeId = await resolveOfficeId(userIdOrOfficeId);

  const [allSessions, allTasks, allJudgments, officeMembers] = await Promise.all([
    postgresService.listSessions(officeId),
    postgresService.listTasks(officeId),
    postgresService.listJudgments(officeId),
    isAdmin ? listOfficeMembers(officeId).catch(() => []) : Promise.resolve([]),
  ]);

  // Filter sessions by assignee if requested
  const sessions = assignee
    ? allSessions.filter((s) => {
        const text = `${s.notes || ""} ${s.plaintiff || ""}`.toLowerCase();
        return text.includes(assignee.toLowerCase());
      })
    : allSessions;

  // Filter tasks by assignee if requested
  const tasks = assignee
    ? allTasks.filter((t) => {
        const a = (t.assignee || "").toLowerCase();
        return a.includes(assignee.toLowerCase());
      })
    : allTasks;

  // 1. Sessions Trend (6-month timeline: past 4 months, current month, next month)
  const now = new Date();
  const trendBuckets: Array<{ key: string; month: string; total: number; finished: number; upcoming: number }> = [];

  for (let i = -4; i <= 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const m = d.getMonth();
    const y = d.getFullYear();
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    trendBuckets.push({
      key,
      month: ARABIC_MONTH_NAMES[m],
      total: 0,
      finished: 0,
      upcoming: 0,
    });
  }

  for (const s of sessions) {
    if (s.hearingAt) {
      const dt = new Date(s.hearingAt);
      if (!isNaN(dt.getTime())) {
        const sKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
        const bucket = trendBuckets.find((b) => b.key === sKey);
        if (bucket) {
          bucket.total += 1;
          const status = deriveEffectiveStatus(s);
          if (status === "Finished") {
            bucket.finished += 1;
          } else {
            bucket.upcoming += 1;
          }
        }
      }
    }
  }

  const sessionsTrend = trendBuckets.map(({ month, total, finished, upcoming }) => ({
    month,
    total,
    finished,
    upcoming,
  }));

  // 2. Sessions Status Distribution
  let upcomingCount = 0;
  let todayCount = 0;
  let finishedCount = 0;
  let otherCount = 0;

  for (const s of sessions) {
    const status = deriveEffectiveStatus(s);
    if (status === "Upcoming") upcomingCount++;
    else if (status === "Today") todayCount++;
    else if (status === "Finished") finishedCount++;
    else otherCount++;
  }

  const sessionsStatusDistribution = [
    { name: "جلسات قادمة", count: upcomingCount, fill: "#C9A449" },
    { name: "جلسات اليوم", count: todayCount, fill: "#D97706" },
    { name: "جلسات منتهية", count: finishedCount, fill: "#3F4A2C" },
    { name: "ملغاة / أخرى", count: otherCount, fill: "#94A3B8" },
  ];

  // 3. Tasks Status Distribution
  let completedTasks = 0;
  let inProgressTasks = 0;
  let pendingTasks = 0;
  let overdueTasks = 0;

  const nowMs = Date.now();
  for (const t of tasks) {
    const s = String(t.status || "");
    const dueMs = t.dueDate ? new Date(t.dueDate).getTime() : NaN;
    const isOverdue = !isNaN(dueMs) && dueMs < nowMs && s !== "مكتملة";

    if (s === "مكتملة") completedTasks++;
    else if (isOverdue) overdueTasks++;
    else if (s === "قيد التنفيذ") inProgressTasks++;
    else pendingTasks++;
  }

  const tasksStatusDistribution = [
    { name: "مكتملة", count: completedTasks, fill: "#10B981" },
    { name: "قيد التنفيذ", count: inProgressTasks, fill: "#3B82F6" },
    { name: "معلقة / مؤجلة", count: pendingTasks, fill: "#C9A449" },
    { name: "متأخرة", count: overdueTasks, fill: "#EF4444" },
  ];

  // 4. Tasks Priority Distribution
  let urgentPriority = 0;
  let regularPriority = 0;

  for (const t of tasks) {
    const p = String(t.priority || "");
    if (p === "عاجلة") urgentPriority++;
    else regularPriority++;
  }

  const tasksPriorityDistribution = [
    { priority: "عاجلة", count: urgentPriority, fill: "#EF4444" },
    { priority: "عادية", count: regularPriority, fill: "#C9A449" },
  ];

  // 5. Courts Distribution (Top Courts)
  const courtFrequency: Record<string, number> = {};
  for (const s of sessions) {
    const c = s.court?.trim() || "غير محدد";
    courtFrequency[c] = (courtFrequency[c] || 0) + 1;
  }

  const sortedCourts = Object.entries(courtFrequency)
    .sort(([, a], [, b]) => b - a)
    .map(([court, count]) => ({ court, count }));

  const topCourts = sortedCourts.slice(0, 4);
  const remainingCount = sortedCourts.slice(4).reduce((sum, item) => sum + item.count, 0);
  if (remainingCount > 0) {
    topCourts.push({ court: "محاكم أخرى", count: remainingCount });
  }

  // 6. Judgments Distribution
  let favorableCount = 0;
  let preliminaryCount = 0;
  let otherJudgments = 0;

  for (const j of allJudgments) {
    const fav = String(j.isFavorable || "");
    if (fav === "نهائي" || fav.includes("نهائي") || fav.includes("قطعي")) {
      favorableCount++;
    } else if (fav === "ابتدائي" || fav.includes("ابتدائي")) {
      preliminaryCount++;
    } else {
      otherJudgments++;
    }
  }

  const judgmentsDistribution = [
    { name: "أحكام نهائية", count: favorableCount, fill: "#10B981" },
    { name: "أحكام ابتدائية", count: preliminaryCount, fill: "#3B82F6" },
    { name: "أخرى / قيد التدقيق", count: otherJudgments, fill: "#C9A449" },
  ];

  // 7. Team AI Usage (for Admin)
  const teamAiUsage = isAdmin
    ? officeMembers.map((m) => {
        const usage = m.ai_usage_count || 0;
        const quota = m.ai_quota_limit ?? 100;
        const percentage = Math.min(100, Math.round((usage / quota) * 100));
        return {
          name: m.display_name || m.username,
          usage,
          quota,
          percentage,
        };
      })
    : undefined;

  return {
    sessionsTrend,
    sessionsStatusDistribution,
    tasksStatusDistribution,
    tasksPriorityDistribution,
    courtsDistribution: topCourts,
    judgmentsDistribution,
    teamAiUsage,
  };
}
