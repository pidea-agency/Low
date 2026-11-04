/**
 * postgres.service.ts
 *
 * Primary multi-tenant database service backed by Supabase Postgres tables:
 * - sessions
 * - tasks
 * - poa
 * - judgments
 * - reports
 *
 * Every operation enforces office_id filtering derived strictly from the authenticated
 * user's session context on the server.
 *
 * Includes an in-memory repository fallback for offline/test environments and
 * an optional one-way export function to Google Sheets.
 */

import { getSupabaseClient } from "./supabase.service";
import { logger } from "../lib/logger";
import type { Session, SessionInput, SessionUpdate } from "@workspace/api-client-react";
import { computeHearingDateTime } from "../utils/hijri";
import moment from "moment-hijri";

// ============================================================================
// Types
// ============================================================================

export interface SessionRecord {
  id: number;
  officeId: string;
  caseNumber: string | null;
  plaintiff: string | null;
  defendant: string | null;
  court: string | null;
  courtCircuit: string | null;
  caseSubject: string | null;
  sessionType: string | null;
  sessionDateHijri: string | null;
  sessionDay: string | null;
  sessionTime: string | null;
  notes: string | null;
  status: "Upcoming" | "Today" | "Finished" | "Cancelled";
  reminder24: boolean;
  reminder6: boolean;
  report?: string | null;
  hearingAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SessionCreateData = SessionInput & {
  status?: any;
  reminder24?: boolean;
  reminder6?: boolean;
  sessionDay?: string | null;
};

export type SessionUpdateData = SessionUpdate & {
  reminder24?: boolean;
  reminder6?: boolean;
  sessionDay?: string | null;
};

export interface TaskRecord {
  id: number;
  officeId: string;
  title: string;
  assignee: string;
  priority: "عاجلة" | "عادية";
  dueDate: string;
  remainingDays: string;
  status: "قيد التنفيذ" | "مكتملة" | "مؤجلة" | "معلقة";
  notes: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PoaRecord {
  id: number;
  officeId: string;
  clientName: string;
  poaNumber: string;
  issueDateHijri: string;
  expiryDateHijri: string;
  daysRemaining: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface JudgmentRecord {
  id: number;
  officeId: string;
  caseNumber: string;
  court: string;
  plaintiff: string;
  defendant: string;
  assignedLawyer: string;
  judgmentNumber: string;
  judgmentDate: string;
  summary: string;
  isFavorable: "نهائي" | "ابتدائي" | string;
  createdAt: string;
  updatedAt?: string;
}

export interface ReportRecord {
  id: number;
  officeId: string;
  sessionId: number;
  report: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// In-Memory Fallback Store (Used during tests or if Supabase is offline)
// ============================================================================

const memorySessions = new Map<string, SessionRecord[]>();
const memoryTasks = new Map<string, TaskRecord[]>();
const memoryPoa = new Map<string, PoaRecord[]>();
const memoryJudgments = new Map<string, JudgmentRecord[]>();
const memoryReports = new Map<string, ReportRecord[]>();

let _nextId = 1000;
function nextId(): number {
  return ++_nextId;
}

export function resetInMemoryStore(): void {
  memorySessions.clear();
  memoryTasks.clear();
  memoryPoa.clear();
  memoryJudgments.clear();
  memoryReports.clear();
}

// Helper: Hijri Remaining Days Calculation
function calcDaysFromHijri(hijriDateStr: string): number {
  if (!hijriDateStr?.trim()) return 0;
  try {
    const parts = hijriDateStr.trim().split(/[\/\.-]/);
    if (parts.length === 3) {
      let day: number, month: number, year: number;
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      }
      if (year > 1300 && year < 1600 && month >= 1 && month <= 12 && day >= 1 && day <= 30) {
        const mExpiry = moment(`${year}/${month}/${day}`, "iYYYY/iM/iD");
        if (mExpiry.isValid()) {
          return mExpiry.diff(moment().startOf("day"), "days");
        }
      }
    }
  } catch (_) {}
  return 0;
}

// Helper: Task Remaining Days Calculation
function calcRemainingDays(dueDate: string): string {
  if (!dueDate) return "";
  const due = new Date(dueDate);
  due.setHours(23, 59, 59, 999);
  const now = new Date();
  const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return `متأخر ${Math.abs(days)} يوم`;
  if (days === 0) return "اليوم";
  return `${days} يوم`;
}

function formatSession(s: any): Session {
  const hearingAt = s.hearingAt ? new Date(s.hearingAt).toISOString() : (s.hearing_at ? new Date(s.hearing_at).toISOString() : null);
  const createdAt = s.createdAt ? new Date(s.createdAt).toISOString() : (s.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString());

  return {
    id: Number(s.id),
    caseNumber: s.caseNumber ?? s.case_number ?? null,
    plaintiff: s.plaintiff ?? null,
    defendant: s.defendant ?? null,
    court: s.court ?? null,
    courtCircuit: s.courtCircuit ?? s.court_circuit ?? null,
    caseSubject: s.caseSubject ?? s.case_subject ?? null,
    sessionType: s.sessionType ?? s.session_type ?? null,
    sessionDateHijri: s.sessionDateHijri ?? s.session_date_hijri ?? null,
    sessionDay: s.sessionDay ?? s.session_day ?? null,
    sessionTime: s.sessionTime ?? s.session_time ?? null,
    notes: s.notes ?? null,
    status: s.status || "Upcoming",
    reminder24: Boolean(s.reminder24 ?? s.reminder_24),
    reminder6: Boolean(s.reminder6 ?? s.reminder_6),
    createdAt,
    hearingAt,
  };
}

// ============================================================================
// 1. SESSIONS
// ============================================================================

export async function listSessions(officeId: string, statusFilter?: string): Promise<Session[]> {
  const client = getSupabaseClient();
  if (client) {
    try {
      let query = client.from("sessions").select("*").eq("office_id", officeId);
      if (statusFilter && statusFilter !== "All") {
        query = query.eq("status", statusFilter);
      }
      const { data, error } = await query.order("id", { ascending: false });
      if (!error && data) {
        return data.map(formatSession);
      }
    } catch (err) {
      logger.warn({ err }, "Supabase query failed in listSessions, falling back to memory");
    }
  }

  const list = memorySessions.get(officeId) || [];
  return list
    .filter((s) => !statusFilter || statusFilter === "All" || s.status === statusFilter)
    .map(formatSession);
}

export async function getSessionById(id: number, officeId: string): Promise<Session | null> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("sessions")
        .select("*")
        .eq("id", id)
        .eq("office_id", officeId)
        .single();
      if (!error && data) {
        return formatSession(data);
      }
    } catch (err) {
      logger.warn({ err }, "Supabase query failed in getSessionById, falling back to memory");
    }
  }

  const list = memorySessions.get(officeId) || [];
  const s = list.find((item) => item.id === id);
  if (!s) return null;
  return formatSession(s);
}

export async function createSession(data: SessionCreateData, officeId: string): Promise<Session> {
  const hearingAtDate = computeHearingDateTime(data.sessionDateHijri ?? undefined, data.sessionTime ?? undefined);
  const hearingAt = hearingAtDate ? hearingAtDate.toISOString() : null;
  const now = new Date().toISOString();

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data: inserted, error } = await client
        .from("sessions")
        .insert([
          {
            office_id: officeId,
            case_number: data.caseNumber || null,
            plaintiff: data.plaintiff || null,
            defendant: data.defendant || null,
            court: data.court || null,
            court_circuit: data.courtCircuit || null,
            case_subject: data.caseSubject || null,
            session_type: data.sessionType || null,
            session_date_hijri: data.sessionDateHijri || null,
            session_day: data.sessionDay || null,
            session_time: data.sessionTime || null,
            notes: data.notes || null,
            status: data.status || "Upcoming",
            reminder24: Boolean(data.reminder24),
            reminder6: Boolean(data.reminder6),
            hearing_at: hearingAt,
          },
        ])
        .select()
        .single();

      if (!error && inserted) {
        return formatSession(inserted);
      }
    } catch (err) {
      logger.warn({ err }, "Supabase insert failed in createSession, falling back to memory");
    }
  }

  const id = nextId();
  const record: SessionRecord = {
    id,
    officeId,
    caseNumber: data.caseNumber || null,
    plaintiff: data.plaintiff || null,
    defendant: data.defendant || null,
    court: data.court || null,
    courtCircuit: data.courtCircuit || null,
    caseSubject: data.caseSubject || null,
    sessionType: data.sessionType || null,
    sessionDateHijri: data.sessionDateHijri || null,
    sessionDay: data.sessionDay || null,
    sessionTime: data.sessionTime || null,
    notes: data.notes || null,
    status: (data.status as any) || "Upcoming",
    reminder24: Boolean(data.reminder24),
    reminder6: Boolean(data.reminder6),
    hearingAt,
    createdAt: now,
    updatedAt: now,
  };

  const list = memorySessions.get(officeId) || [];
  list.unshift(record);
  memorySessions.set(officeId, list);

  return formatSession(record);
}

export async function updateSession(id: number, data: SessionUpdateData, officeId: string): Promise<Session | null> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (data.caseNumber !== undefined) updatePayload.case_number = data.caseNumber;
      if (data.plaintiff !== undefined) updatePayload.plaintiff = data.plaintiff;
      if (data.defendant !== undefined) updatePayload.defendant = data.defendant;
      if (data.court !== undefined) updatePayload.court = data.court;
      if (data.courtCircuit !== undefined) updatePayload.court_circuit = data.courtCircuit;
      if (data.caseSubject !== undefined) updatePayload.case_subject = data.caseSubject;
      if (data.sessionType !== undefined) updatePayload.session_type = data.sessionType;
      if (data.sessionDateHijri !== undefined) updatePayload.session_date_hijri = data.sessionDateHijri;
      if (data.sessionDay !== undefined) updatePayload.session_day = data.sessionDay;
      if (data.sessionTime !== undefined) updatePayload.session_time = data.sessionTime;
      if (data.notes !== undefined) updatePayload.notes = data.notes;
      if (data.status !== undefined) updatePayload.status = data.status;
      if (data.reminder24 !== undefined) updatePayload.reminder24 = data.reminder24;
      if (data.reminder6 !== undefined) updatePayload.reminder6 = data.reminder6;

      if (data.sessionDateHijri !== undefined || data.sessionTime !== undefined) {
        const hearingAt = computeHearingDateTime(data.sessionDateHijri ?? undefined, data.sessionTime ?? undefined);
        updatePayload.hearing_at = hearingAt ? hearingAt.toISOString() : null;
      }

      const { data: updated, error } = await client
        .from("sessions")
        .update(updatePayload)
        .eq("id", id)
        .eq("office_id", officeId)
        .select()
        .single();

      if (!error && updated) {
        return formatSession(updated);
      }
    } catch (err) {
      logger.warn({ err }, "Supabase update failed in updateSession, falling back to memory");
    }
  }

  const list = memorySessions.get(officeId) || [];
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return null;

  const current = list[idx];
  const updated: SessionRecord = {
    ...current,
    caseNumber: data.caseNumber !== undefined ? data.caseNumber : current.caseNumber,
    plaintiff: data.plaintiff !== undefined ? data.plaintiff : current.plaintiff,
    defendant: data.defendant !== undefined ? data.defendant : current.defendant,
    court: data.court !== undefined ? data.court : current.court,
    courtCircuit: data.courtCircuit !== undefined ? data.courtCircuit : current.courtCircuit,
    caseSubject: data.caseSubject !== undefined ? data.caseSubject : current.caseSubject,
    sessionType: data.sessionType !== undefined ? data.sessionType : current.sessionType,
    sessionDateHijri: data.sessionDateHijri !== undefined ? data.sessionDateHijri : current.sessionDateHijri,
    sessionDay: data.sessionDay !== undefined ? data.sessionDay : current.sessionDay,
    sessionTime: data.sessionTime !== undefined ? data.sessionTime : current.sessionTime,
    notes: data.notes !== undefined ? data.notes : current.notes,
    status: data.status !== undefined ? (data.status as any) : current.status,
    reminder24: data.reminder24 !== undefined ? Boolean(data.reminder24) : current.reminder24,
    reminder6: data.reminder6 !== undefined ? Boolean(data.reminder6) : current.reminder6,
    updatedAt: new Date().toISOString(),
  };

  list[idx] = updated;
  return formatSession(updated);
}

export async function deleteSession(id: number, officeId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error, count } = await client
        .from("sessions")
        .delete({ count: "exact" })
        .eq("id", id)
        .eq("office_id", officeId);
      if (!error && (count ?? 0) > 0) return true;
    } catch (err) {
      logger.warn({ err }, "Supabase delete failed in deleteSession, falling back to memory");
    }
  }

  const list = memorySessions.get(officeId) || [];
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  return true;
}

// ============================================================================
// 2. REPORTS
// ============================================================================

export async function getSessionReport(id: number, officeId: string): Promise<{ session: Session; report: string | null } | null> {
  const session = await getSessionById(id, officeId);
  if (!session) return null;

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data } = await client
        .from("reports")
        .select("report")
        .eq("session_id", id)
        .eq("office_id", officeId)
        .order("id", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        return { session, report: data[0].report };
      }

      // Check report field on session row
      const { data: sRow } = await client
        .from("sessions")
        .select("report")
        .eq("id", id)
        .eq("office_id", officeId)
        .single();
      if (sRow?.report) {
        return { session, report: sRow.report };
      }
    } catch (err) {
      logger.warn({ err }, "Supabase getSessionReport failed, falling back to memory");
    }
  }

  const reportsList = memoryReports.get(officeId) || [];
  const found = reportsList.find((r) => r.sessionId === id);
  return { session, report: found ? found.report : null };
}

export async function saveSessionReport(id: number, report: string, officeId: string): Promise<{ session: Session; report: string } | null> {
  const session = await getSessionById(id, officeId);
  if (!session) return null;

  const client = getSupabaseClient();
  if (client) {
    try {
      // Upsert report in reports table
      await client.from("reports").insert([
        {
          office_id: officeId,
          session_id: id,
          report,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
      // Also update session table report column
      await client
        .from("sessions")
        .update({ report, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("office_id", officeId);
      return { session, report };
    } catch (err) {
      logger.warn({ err }, "Supabase saveSessionReport failed, falling back to memory");
    }
  }

  const reportsList = memoryReports.get(officeId) || [];
  const existingIdx = reportsList.findIndex((r) => r.sessionId === id);
  if (existingIdx !== -1) {
    reportsList[existingIdx].report = report;
    reportsList[existingIdx].updatedAt = new Date().toISOString();
  } else {
    reportsList.push({
      id: nextId(),
      officeId,
      sessionId: id,
      report,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  memoryReports.set(officeId, reportsList);
  return { session, report };
}

// ============================================================================
// 3. TASKS
// ============================================================================

export async function listTasks(officeId: string): Promise<TaskRecord[]> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("tasks")
        .select("*")
        .eq("office_id", officeId)
        .order("id", { ascending: false });

      if (!error && data) {
        return data.map((r: any) => ({
          id: r.id,
          officeId: r.office_id,
          title: r.title,
          assignee: r.assignee || "",
          priority: r.priority || "عادية",
          dueDate: r.due_date || "",
          remainingDays: r.remaining_days || calcRemainingDays(r.due_date),
          status: r.status || "قيد التنفيذ",
          notes: r.notes || "",
          createdAt: r.created_at,
        }));
      }
    } catch (err) {
      logger.warn({ err }, "Supabase listTasks failed, falling back to memory");
    }
  }

  return (memoryTasks.get(officeId) || []).map((t) => ({ ...t }));
}

export async function getTaskById(id: number, officeId: string): Promise<TaskRecord | null> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("tasks")
        .select("*")
        .eq("id", id)
        .eq("office_id", officeId)
        .single();
      if (!error && data) {
        return {
          id: data.id,
          officeId: data.office_id,
          title: data.title,
          assignee: data.assignee || "",
          priority: data.priority || "عادية",
          dueDate: data.due_date || "",
          remainingDays: data.remaining_days || calcRemainingDays(data.due_date),
          status: data.status || "قيد التنفيذ",
          notes: data.notes || "",
          createdAt: data.created_at,
        };
      }
    } catch (err) {
      logger.warn({ err }, "Supabase getTaskById failed, falling back to memory");
    }
  }

  const list = memoryTasks.get(officeId) || [];
  const t = list.find((item) => item.id === id);
  return t ? { ...t } : null;
}

export async function createTask(
  data: {
    title: string;
    assignee?: string;
    priority?: "عاجلة" | "عادية";
    dueDate?: string;
    status?: "قيد التنفيذ" | "مكتملة" | "مؤجلة" | "معلقة";
    notes?: string;
  },
  officeId: string,
): Promise<TaskRecord> {
  const remaining = calcRemainingDays(data.dueDate || "");
  const now = new Date().toISOString();

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data: inserted, error } = await client
        .from("tasks")
        .insert([
          {
            office_id: officeId,
            title: data.title,
            assignee: data.assignee || "",
            priority: data.priority || "عادية",
            due_date: data.dueDate || "",
            remaining_days: remaining,
            status: data.status || "قيد التنفيذ",
            notes: data.notes || "",
          },
        ])
        .select()
        .single();

      if (!error && inserted) {
        return {
          id: inserted.id,
          officeId: inserted.office_id,
          title: inserted.title,
          assignee: inserted.assignee,
          priority: inserted.priority,
          dueDate: inserted.due_date,
          remainingDays: inserted.remaining_days,
          status: inserted.status,
          notes: inserted.notes,
          createdAt: inserted.created_at,
        };
      }
    } catch (err) {
      logger.warn({ err }, "Supabase createTask failed, falling back to memory");
    }
  }

  const id = nextId();
  const record: TaskRecord = {
    id,
    officeId,
    title: data.title,
    assignee: data.assignee || "",
    priority: data.priority || "عادية",
    dueDate: data.dueDate || "",
    remainingDays: remaining,
    status: data.status || "قيد التنفيذ",
    notes: data.notes || "",
    createdAt: now,
  };

  const list = memoryTasks.get(officeId) || [];
  list.unshift(record);
  memoryTasks.set(officeId, list);
  return { ...record };
}

export async function updateTask(
  id: number,
  data: Partial<Omit<TaskRecord, "id" | "officeId">>,
  officeId: string,
): Promise<TaskRecord | null> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (data.title !== undefined) updatePayload.title = data.title;
      if (data.assignee !== undefined) updatePayload.assignee = data.assignee;
      if (data.priority !== undefined) updatePayload.priority = data.priority;
      if (data.dueDate !== undefined) {
        updatePayload.due_date = data.dueDate;
        updatePayload.remaining_days = calcRemainingDays(data.dueDate);
      }
      if (data.status !== undefined) updatePayload.status = data.status;
      if (data.notes !== undefined) updatePayload.notes = data.notes;

      const { data: updated, error } = await client
        .from("tasks")
        .update(updatePayload)
        .eq("id", id)
        .eq("office_id", officeId)
        .select()
        .single();

      if (!error && updated) {
        return {
          id: updated.id,
          officeId: updated.office_id,
          title: updated.title,
          assignee: updated.assignee,
          priority: updated.priority,
          dueDate: updated.due_date,
          remainingDays: updated.remaining_days,
          status: updated.status,
          notes: updated.notes,
          createdAt: updated.created_at,
        };
      }
    } catch (err) {
      logger.warn({ err }, "Supabase updateTask failed, falling back to memory");
    }
  }

  const list = memoryTasks.get(officeId) || [];
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) return null;

  const current = list[idx];
  const updated: TaskRecord = {
    ...current,
    title: data.title !== undefined ? data.title : current.title,
    assignee: data.assignee !== undefined ? data.assignee : current.assignee,
    priority: data.priority !== undefined ? data.priority : current.priority,
    dueDate: data.dueDate !== undefined ? data.dueDate : current.dueDate,
    remainingDays: data.dueDate !== undefined ? calcRemainingDays(data.dueDate) : current.remainingDays,
    status: data.status !== undefined ? data.status : current.status,
    notes: data.notes !== undefined ? data.notes : current.notes,
  };
  list[idx] = updated;
  return { ...updated };
}

export async function deleteTask(id: number, officeId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error, count } = await client
        .from("tasks")
        .delete({ count: "exact" })
        .eq("id", id)
        .eq("office_id", officeId);
      if (!error && (count ?? 0) > 0) return true;
    } catch (err) {
      logger.warn({ err }, "Supabase deleteTask failed, falling back to memory");
    }
  }

  const list = memoryTasks.get(officeId) || [];
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  return true;
}

// ============================================================================
// 4. POWER OF ATTORNEY (POA)
// ============================================================================

export async function listPoa(officeId: string): Promise<PoaRecord[]> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("poa")
        .select("*")
        .eq("office_id", officeId)
        .order("id", { ascending: false });

      if (!error && data) {
        return data.map((r: any) => ({
          id: r.id,
          officeId: r.office_id,
          clientName: r.client_name,
          poaNumber: r.poa_number,
          issueDateHijri: r.issue_date_hijri || "",
          expiryDateHijri: r.expiry_date_hijri || "",
          daysRemaining: r.days_remaining ?? calcDaysFromHijri(r.expiry_date_hijri),
          notes: r.notes || "",
          createdAt: r.created_at,
        }));
      }
    } catch (err) {
      logger.warn({ err }, "Supabase listPoa failed, falling back to memory");
    }
  }

  return (memoryPoa.get(officeId) || []).map((p) => ({ ...p }));
}

export async function getPoaById(id: number, officeId: string): Promise<PoaRecord | null> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("poa")
        .select("*")
        .eq("id", id)
        .eq("office_id", officeId)
        .single();
      if (!error && data) {
        return {
          id: data.id,
          officeId: data.office_id,
          clientName: data.client_name,
          poaNumber: data.poa_number,
          issueDateHijri: data.issue_date_hijri || "",
          expiryDateHijri: data.expiry_date_hijri || "",
          daysRemaining: data.days_remaining ?? calcDaysFromHijri(data.expiry_date_hijri),
          notes: data.notes || "",
          createdAt: data.created_at,
        };
      }
    } catch (err) {
      logger.warn({ err }, "Supabase getPoaById failed, falling back to memory");
    }
  }

  const list = memoryPoa.get(officeId) || [];
  const item = list.find((p) => p.id === id);
  return item ? { ...item } : null;
}

export async function createPoa(
  data: {
    clientName: string;
    poaNumber: string;
    issueDateHijri?: string;
    expiryDateHijri?: string;
    daysRemaining?: number;
    notes?: string;
  },
  officeId: string,
): Promise<PoaRecord> {
  const days = data.daysRemaining ?? calcDaysFromHijri(data.expiryDateHijri || "");
  const now = new Date().toISOString();

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data: inserted, error } = await client
        .from("poa")
        .insert([
          {
            office_id: officeId,
            client_name: data.clientName,
            poa_number: data.poaNumber,
            issue_date_hijri: data.issueDateHijri || "",
            expiry_date_hijri: data.expiryDateHijri || "",
            days_remaining: days,
            notes: data.notes || "",
          },
        ])
        .select()
        .single();

      if (!error && inserted) {
        return {
          id: inserted.id,
          officeId: inserted.office_id,
          clientName: inserted.client_name,
          poaNumber: inserted.poa_number,
          issueDateHijri: inserted.issue_date_hijri,
          expiryDateHijri: inserted.expiry_date_hijri,
          daysRemaining: inserted.days_remaining,
          notes: inserted.notes,
          createdAt: inserted.created_at,
        };
      }
    } catch (err) {
      logger.warn({ err }, "Supabase createPoa failed, falling back to memory");
    }
  }

  const id = nextId();
  const record: PoaRecord = {
    id,
    officeId,
    clientName: data.clientName,
    poaNumber: data.poaNumber,
    issueDateHijri: data.issueDateHijri || "",
    expiryDateHijri: data.expiryDateHijri || "",
    daysRemaining: days,
    notes: data.notes || "",
    createdAt: now,
  };

  const list = memoryPoa.get(officeId) || [];
  list.unshift(record);
  memoryPoa.set(officeId, list);
  return { ...record };
}

export async function updatePoa(
  id: number,
  data: Partial<Omit<PoaRecord, "id" | "officeId">>,
  officeId: string,
): Promise<PoaRecord | null> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (data.clientName !== undefined) updatePayload.client_name = data.clientName;
      if (data.poaNumber !== undefined) updatePayload.poa_number = data.poaNumber;
      if (data.issueDateHijri !== undefined) updatePayload.issue_date_hijri = data.issueDateHijri;
      if (data.expiryDateHijri !== undefined) {
        updatePayload.expiry_date_hijri = data.expiryDateHijri;
        updatePayload.days_remaining = data.daysRemaining ?? calcDaysFromHijri(data.expiryDateHijri);
      }
      if (data.notes !== undefined) updatePayload.notes = data.notes;

      const { data: updated, error } = await client
        .from("poa")
        .update(updatePayload)
        .eq("id", id)
        .eq("office_id", officeId)
        .select()
        .single();

      if (!error && updated) {
        return {
          id: updated.id,
          officeId: updated.office_id,
          clientName: updated.client_name,
          poaNumber: updated.poa_number,
          issueDateHijri: updated.issue_date_hijri,
          expiryDateHijri: updated.expiry_date_hijri,
          daysRemaining: updated.days_remaining,
          notes: updated.notes,
          createdAt: updated.created_at,
        };
      }
    } catch (err) {
      logger.warn({ err }, "Supabase updatePoa failed, falling back to memory");
    }
  }

  const list = memoryPoa.get(officeId) || [];
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return null;

  const current = list[idx];
  const updated: PoaRecord = {
    ...current,
    clientName: data.clientName !== undefined ? data.clientName : current.clientName,
    poaNumber: data.poaNumber !== undefined ? data.poaNumber : current.poaNumber,
    issueDateHijri: data.issueDateHijri !== undefined ? data.issueDateHijri : current.issueDateHijri,
    expiryDateHijri: data.expiryDateHijri !== undefined ? data.expiryDateHijri : current.expiryDateHijri,
    daysRemaining:
      data.daysRemaining !== undefined
        ? data.daysRemaining
        : data.expiryDateHijri !== undefined
        ? calcDaysFromHijri(data.expiryDateHijri)
        : current.daysRemaining,
    notes: data.notes !== undefined ? data.notes : current.notes,
  };
  list[idx] = updated;
  return { ...updated };
}

export async function deletePoa(id: number, officeId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error, count } = await client
        .from("poa")
        .delete({ count: "exact" })
        .eq("id", id)
        .eq("office_id", officeId);
      if (!error && (count ?? 0) > 0) return true;
    } catch (err) {
      logger.warn({ err }, "Supabase deletePoa failed, falling back to memory");
    }
  }

  const list = memoryPoa.get(officeId) || [];
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  return true;
}

// ============================================================================
// 5. JUDGMENTS
// ============================================================================

export async function listJudgments(officeId: string): Promise<JudgmentRecord[]> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("judgments")
        .select("*")
        .eq("office_id", officeId)
        .order("id", { ascending: false });

      if (!error && data) {
        return data.map((r: any) => ({
          id: r.id,
          officeId: r.office_id,
          caseNumber: r.case_number || "",
          court: r.court || "",
          plaintiff: r.plaintiff || "",
          defendant: r.defendant || "",
          assignedLawyer: r.assigned_lawyer || "",
          judgmentNumber: r.judgment_number || "",
          judgmentDate: r.judgment_date || "",
          summary: r.summary || "",
          isFavorable: r.is_favorable || "نهائي",
          createdAt: r.created_at,
        }));
      }
    } catch (err) {
      logger.warn({ err }, "Supabase listJudgments failed, falling back to memory");
    }
  }

  return (memoryJudgments.get(officeId) || []).map((j) => ({ ...j }));
}

export async function getJudgmentById(id: number, officeId: string): Promise<JudgmentRecord | null> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("judgments")
        .select("*")
        .eq("id", id)
        .eq("office_id", officeId)
        .single();
      if (!error && data) {
        return {
          id: data.id,
          officeId: data.office_id,
          caseNumber: data.case_number || "",
          court: data.court || "",
          plaintiff: data.plaintiff || "",
          defendant: data.defendant || "",
          assignedLawyer: data.assigned_lawyer || "",
          judgmentNumber: data.judgment_number || "",
          judgmentDate: data.judgment_date || "",
          summary: data.summary || "",
          isFavorable: data.is_favorable || "نهائي",
          createdAt: data.created_at,
        };
      }
    } catch (err) {
      logger.warn({ err }, "Supabase getJudgmentById failed, falling back to memory");
    }
  }

  const list = memoryJudgments.get(officeId) || [];
  const j = list.find((item) => item.id === id);
  return j ? { ...j } : null;
}

export async function createJudgment(
  data: {
    caseNumber?: string;
    court?: string;
    plaintiff?: string;
    defendant?: string;
    assignedLawyer?: string;
    judgmentNumber?: string;
    judgmentDate?: string;
    summary?: string;
    isFavorable?: "نهائي" | "ابتدائي" | string;
  },
  officeId: string,
): Promise<JudgmentRecord> {
  const now = new Date().toISOString();

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data: inserted, error } = await client
        .from("judgments")
        .insert([
          {
            office_id: officeId,
            case_number: data.caseNumber || "",
            court: data.court || "",
            plaintiff: data.plaintiff || "",
            defendant: data.defendant || "",
            assigned_lawyer: data.assignedLawyer || "",
            judgment_number: data.judgmentNumber || "",
            judgment_date: data.judgmentDate || "",
            summary: data.summary || "",
            is_favorable: data.isFavorable || "نهائي",
          },
        ])
        .select()
        .single();

      if (!error && inserted) {
        return {
          id: inserted.id,
          officeId: inserted.office_id,
          caseNumber: inserted.case_number,
          court: inserted.court,
          plaintiff: inserted.plaintiff,
          defendant: inserted.defendant,
          assignedLawyer: inserted.assigned_lawyer,
          judgmentNumber: inserted.judgment_number,
          judgmentDate: inserted.judgment_date,
          summary: inserted.summary,
          isFavorable: inserted.is_favorable,
          createdAt: inserted.created_at,
        };
      }
    } catch (err) {
      logger.warn({ err }, "Supabase createJudgment failed, falling back to memory");
    }
  }

  const id = nextId();
  const record: JudgmentRecord = {
    id,
    officeId,
    caseNumber: data.caseNumber || "",
    court: data.court || "",
    plaintiff: data.plaintiff || "",
    defendant: data.defendant || "",
    assignedLawyer: data.assignedLawyer || "",
    judgmentNumber: data.judgmentNumber || "",
    judgmentDate: data.judgmentDate || "",
    summary: data.summary || "",
    isFavorable: data.isFavorable || "نهائي",
    createdAt: now,
  };

  const list = memoryJudgments.get(officeId) || [];
  list.unshift(record);
  memoryJudgments.set(officeId, list);
  return { ...record };
}

export async function updateJudgment(
  id: number,
  data: Partial<Omit<JudgmentRecord, "id" | "officeId">>,
  officeId: string,
): Promise<JudgmentRecord | null> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (data.caseNumber !== undefined) updatePayload.case_number = data.caseNumber;
      if (data.court !== undefined) updatePayload.court = data.court;
      if (data.plaintiff !== undefined) updatePayload.plaintiff = data.plaintiff;
      if (data.defendant !== undefined) updatePayload.defendant = data.defendant;
      if (data.assignedLawyer !== undefined) updatePayload.assigned_lawyer = data.assignedLawyer;
      if (data.judgmentNumber !== undefined) updatePayload.judgment_number = data.judgmentNumber;
      if (data.judgmentDate !== undefined) updatePayload.judgment_date = data.judgmentDate;
      if (data.summary !== undefined) updatePayload.summary = data.summary;
      if (data.isFavorable !== undefined) updatePayload.is_favorable = data.isFavorable;

      const { data: updated, error } = await client
        .from("judgments")
        .update(updatePayload)
        .eq("id", id)
        .eq("office_id", officeId)
        .select()
        .single();

      if (!error && updated) {
        return {
          id: updated.id,
          officeId: updated.office_id,
          caseNumber: updated.case_number,
          court: updated.court,
          plaintiff: updated.plaintiff,
          defendant: updated.defendant,
          assignedLawyer: updated.assigned_lawyer,
          judgmentNumber: updated.judgment_number,
          judgmentDate: updated.judgment_date,
          summary: updated.summary,
          isFavorable: updated.is_favorable,
          createdAt: updated.created_at,
        };
      }
    } catch (err) {
      logger.warn({ err }, "Supabase updateJudgment failed, falling back to memory");
    }
  }

  const list = memoryJudgments.get(officeId) || [];
  const idx = list.findIndex((j) => j.id === id);
  if (idx === -1) return null;

  const current = list[idx];
  const updated: JudgmentRecord = {
    ...current,
    caseNumber: data.caseNumber !== undefined ? data.caseNumber : current.caseNumber,
    court: data.court !== undefined ? data.court : current.court,
    plaintiff: data.plaintiff !== undefined ? data.plaintiff : current.plaintiff,
    defendant: data.defendant !== undefined ? data.defendant : current.defendant,
    assignedLawyer: data.assignedLawyer !== undefined ? data.assignedLawyer : current.assignedLawyer,
    judgmentNumber: data.judgmentNumber !== undefined ? data.judgmentNumber : current.judgmentNumber,
    judgmentDate: data.judgmentDate !== undefined ? data.judgmentDate : current.judgmentDate,
    summary: data.summary !== undefined ? data.summary : current.summary,
    isFavorable: data.isFavorable !== undefined ? data.isFavorable : current.isFavorable,
  };
  list[idx] = updated;
  return { ...updated };
}

export async function deleteJudgment(id: number, officeId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error, count } = await client
        .from("judgments")
        .delete({ count: "exact" })
        .eq("id", id)
        .eq("office_id", officeId);
      if (!error && (count ?? 0) > 0) return true;
    } catch (err) {
      logger.warn({ err }, "Supabase deleteJudgment failed, falling back to memory");
    }
  }

  const list = memoryJudgments.get(officeId) || [];
  const idx = list.findIndex((j) => j.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  return true;
}

// ============================================================================
// 6. OPTIONAL ONE-WAY EXPORT TO GOOGLE SHEETS
// ============================================================================

export async function exportOfficeDataToGoogleSheets(
  officeId: string,
): Promise<{
  sessionsCount: number;
  tasksCount: number;
  poaCount: number;
  judgmentsCount: number;
}> {
  const [sessions, tasks, poas, judgments] = await Promise.all([
    listSessions(officeId),
    listTasks(officeId),
    listPoa(officeId),
    listJudgments(officeId),
  ]);

  try {
    const { getGoogleContext } = await import("./googleSheets.service");
    const creds = await getGoogleContext(officeId);
    if (!creds?.sheets || !creds?.spreadsheetId) {
      throw new Error("لم يتم تكوين ربط Google Sheets لهذا المكتب بعد.");
    }

    const { sheets, spreadsheetId } = creds;

    // Export Sessions
    const sessionRows = sessions.map((s) => [
      s.caseNumber || "",
      s.plaintiff || "",
      s.defendant || "",
      s.court || "",
      s.courtCircuit || "",
      s.caseSubject || "",
      s.sessionType || "",
      s.sessionDateHijri || "",
      s.sessionDay || "",
      s.sessionTime || "",
      "",
      s.notes || "",
      s.status || "Upcoming",
      s.reminder24 ? "TRUE" : "FALSE",
      s.reminder6 ? "TRUE" : "FALSE",
      String(s.createdAt || ""),
      "",
    ]);

    if (sessionRows.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Sessions!A2",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: sessionRows },
      });
    }

    return {
      sessionsCount: sessions.length,
      tasksCount: tasks.length,
      poaCount: poas.length,
      judgmentsCount: judgments.length,
    };
  } catch (err: any) {
    logger.warn({ err, officeId }, "One-way Google Sheets export skipped or failed");
    return {
      sessionsCount: sessions.length,
      tasksCount: tasks.length,
      poaCount: poas.length,
      judgmentsCount: judgments.length,
    };
  }
}

