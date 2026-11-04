import type { Session, SessionInput, SessionUpdate, SessionStatus } from "@workspace/api-client-react";
import * as postgresService from "./postgres.service";
import { findUserByIdOrUsername } from "./supabase.service";
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
  const sessions = await postgresService.listSessions(officeId, status);
  return sessions.map((s) => ({
    ...s,
    status: deriveEffectiveStatus(s),
  }));
}

export async function getSessionById(id: number, userIdOrOfficeId?: string): Promise<Session | null> {
  const officeId = await resolveOfficeId(userIdOrOfficeId);
  const session = await postgresService.getSessionById(id, officeId);
  if (!session) return null;
  return {
    ...session,
    status: deriveEffectiveStatus(session),
  };
}

export async function createSession(data: SessionInput, userIdOrOfficeId?: string): Promise<Session> {
  const officeId = await resolveOfficeId(userIdOrOfficeId);
  const session = await postgresService.createSession(data, officeId);
  return {
    ...session,
    status: deriveEffectiveStatus(session),
  };
}

export async function updateSession(id: number, data: SessionUpdate, userIdOrOfficeId?: string): Promise<Session | null> {
  const officeId = await resolveOfficeId(userIdOrOfficeId);
  const session = await postgresService.updateSession(id, data, officeId);
  if (!session) return null;
  return {
    ...session,
    status: deriveEffectiveStatus(session),
  };
}

export async function deleteSession(id: number, userIdOrOfficeId?: string): Promise<boolean> {
  const officeId = await resolveOfficeId(userIdOrOfficeId);
  return postgresService.deleteSession(id, officeId);
}

export async function getSessionReport(id: number, userIdOrOfficeId?: string): Promise<{ session: Session; report: string | null } | null> {
  const officeId = await resolveOfficeId(userIdOrOfficeId);
  return postgresService.getSessionReport(id, officeId);
}

export async function saveSessionReport(id: number, report: string, userIdOrOfficeId?: string): Promise<{ session: Session; report: string } | null> {
  const officeId = await resolveOfficeId(userIdOrOfficeId);
  return postgresService.saveSessionReport(id, report, officeId);
}

export async function getDashboardStats(userIdOrOfficeId?: string): Promise<{
  totalCases: number;
  todayHearings: number;
  upcomingHearings: number;
  finishedHearings: number;
  totalPoas: number;
}> {
  const officeId = await resolveOfficeId(userIdOrOfficeId);
  const [sessions, poas] = await Promise.all([
    postgresService.listSessions(officeId),
    postgresService.listPoa(officeId),
  ]);

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
