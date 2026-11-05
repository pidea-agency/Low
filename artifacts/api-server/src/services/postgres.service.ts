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
import crypto from "crypto";

// ============================================================================
// Types
// ============================================================================

export interface ClientRecord {
  id: string;
  officeId: string;
  name: string;
  phone: string;
  notes: string;
  createdAt: string;
  updatedAt?: string;
}

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
  clientId?: string | null;
  assignedLawyerId?: string | null;
  clientRole?: "plaintiff" | "defendant" | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SessionCreateData = SessionInput & {
  status?: any;
  reminder24?: boolean;
  reminder6?: boolean;
  sessionDay?: string | null;
  clientId?: string | null;
  assignedLawyerId?: string | null;
  clientRole?: "plaintiff" | "defendant" | null;
  createdBy?: string | null;
};

export type SessionUpdateData = SessionUpdate & {
  reminder24?: boolean;
  reminder6?: boolean;
  sessionDay?: string | null;
  clientId?: string | null;
  assignedLawyerId?: string | null;
  clientRole?: "plaintiff" | "defendant" | null;
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
  clientId?: string | null;
  assignedLawyerId?: string | null;
  createdBy?: string | null;
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
  clientId?: string | null;
  assignedLawyerId?: string | null;
  createdBy?: string | null;
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
  clientId?: string | null;
  assignedLawyerId?: string | null;
  clientRole?: "plaintiff" | "defendant" | null;
  createdBy?: string | null;
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

export interface NotificationRecord {
  id: string;
  officeId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  relatedRecordType?: string | null;
  relatedRecordId?: string | null;
  isRead: boolean;
  createdAt: string;
}

// ============================================================================
// In-Memory Fallback Store (Used during tests or if Supabase is offline)
// ============================================================================

const memoryClients = new Map<string, ClientRecord[]>();
const memorySessions = new Map<string, SessionRecord[]>();
const memoryTasks = new Map<string, TaskRecord[]>();
const memoryPoa = new Map<string, PoaRecord[]>();
const memoryJudgments = new Map<string, JudgmentRecord[]>();
const memoryReports = new Map<string, ReportRecord[]>();
const memoryNotifications = new Map<string, NotificationRecord[]>();

let _nextId = 1000;
function nextId(): number {
  return ++_nextId;
}

export function resetInMemoryStore(): void {
  memoryClients.clear();
  memorySessions.clear();
  memoryTasks.clear();
  memoryPoa.clear();
  memoryJudgments.clear();
  memoryReports.clear();
  memoryNotifications.clear();
}

// Helper: Hijri Remaining Days Calculation
export function calcDaysFromHijri(hijriDateStr: string): number {
  if (!hijriDateStr?.trim()) return 0;
  try {
    const normalized = hijriDateStr.trim().replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
    const parts = normalized.split(/[\/\.-]/);
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

function formatSession(s: any): any {
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
    clientId: s.clientId ?? s.client_id ?? null,
    client_id: s.clientId ?? s.client_id ?? null,
    assignedLawyerId: s.assignedLawyerId ?? s.assigned_lawyer_id ?? null,
    assigned_lawyer_id: s.assignedLawyerId ?? s.assigned_lawyer_id ?? null,
    clientRole: s.clientRole ?? s.client_role ?? null,
    client_role: s.clientRole ?? s.client_role ?? null,
    createdBy: s.createdBy ?? s.created_by ?? null,
    created_by: s.createdBy ?? s.created_by ?? null,
  };
}

// ============================================================================
// 0. CLIENTS
// ============================================================================

export async function listClients(officeId: string): Promise<ClientRecord[]> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("clients")
        .select("*")
        .eq("office_id", officeId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        return data.map((r: any) => ({
          id: r.id,
          officeId: r.office_id,
          name: r.name,
          phone: r.phone || "",
          notes: r.notes || "",
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
      }
    } catch (err) {
      logger.warn({ err }, "Supabase listClients failed, falling back to memory");
    }
  }

  return (memoryClients.get(officeId) || []).map((c) => ({ ...c }));
}

export async function getClientById(id: string, officeId: string): Promise<ClientRecord | null> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("clients")
        .select("*")
        .eq("id", id)
        .eq("office_id", officeId)
        .single();

      if (!error && data) {
        return {
          id: data.id,
          officeId: data.office_id,
          name: data.name,
          phone: data.phone || "",
          notes: data.notes || "",
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }
    } catch (err) {
      logger.warn({ err }, "Supabase getClientById failed, falling back to memory");
    }
  }

  const list = memoryClients.get(officeId) || [];
  const found = list.find((c) => c.id === id);
  return found ? { ...found } : null;
}

export async function createClient(
  data: { name: string; phone?: string; notes?: string },
  officeId: string,
): Promise<ClientRecord> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data: inserted, error } = await client
        .from("clients")
        .insert([
          {
            id,
            office_id: officeId,
            name: data.name,
            phone: data.phone || "",
            notes: data.notes || "",
            created_at: now,
            updated_at: now,
          },
        ])
        .select()
        .single();

      if (!error && inserted) {
        return {
          id: inserted.id,
          officeId: inserted.office_id,
          name: inserted.name,
          phone: inserted.phone || "",
          notes: inserted.notes || "",
          createdAt: inserted.created_at,
          updatedAt: inserted.updated_at,
        };
      }
    } catch (err) {
      logger.warn({ err }, "Supabase createClient failed, falling back to memory");
    }
  }

  const record: ClientRecord = {
    id,
    officeId,
    name: data.name,
    phone: data.phone || "",
    notes: data.notes || "",
    createdAt: now,
    updatedAt: now,
  };

  const list = memoryClients.get(officeId) || [];
  list.unshift(record);
  memoryClients.set(officeId, list);
  return { ...record };
}

export async function updateClient(
  id: string,
  data: { name?: string; phone?: string; notes?: string },
  officeId: string,
): Promise<ClientRecord | null> {
  const now = new Date().toISOString();
  const client = getSupabaseClient();
  if (client) {
    try {
      const payload: Record<string, any> = { updated_at: now };
      if (data.name !== undefined) payload.name = data.name;
      if (data.phone !== undefined) payload.phone = data.phone;
      if (data.notes !== undefined) payload.notes = data.notes;

      const { data: updated, error } = await client
        .from("clients")
        .update(payload)
        .eq("id", id)
        .eq("office_id", officeId)
        .select()
        .single();

      if (!error && updated) {
        return {
          id: updated.id,
          officeId: updated.office_id,
          name: updated.name,
          phone: updated.phone || "",
          notes: updated.notes || "",
          createdAt: updated.created_at,
          updatedAt: updated.updated_at,
        };
      }
    } catch (err) {
      logger.warn({ err }, "Supabase updateClient failed, falling back to memory");
    }
  }

  const list = memoryClients.get(officeId) || [];
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return null;

  const current = list[idx];
  const updated: ClientRecord = {
    ...current,
    name: data.name !== undefined ? data.name : current.name,
    phone: data.phone !== undefined ? data.phone : current.phone,
    notes: data.notes !== undefined ? data.notes : current.notes,
    updatedAt: now,
  };
  list[idx] = updated;
  return { ...updated };
}

export async function deleteClient(id: string, officeId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error, count } = await client
        .from("clients")
        .delete({ count: "exact" })
        .eq("id", id)
        .eq("office_id", officeId);

      if (!error && (count ?? 0) > 0) return true;
    } catch (err) {
      logger.warn({ err }, "Supabase deleteClient failed, falling back to memory");
    }
  }

  const list = memoryClients.get(officeId) || [];
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  return true;
}

// ============================================================================
// 1. SESSIONS
// ============================================================================

export async function listSessions(officeId: string, statusFilter?: string): Promise<Session[]> {
  const memList = (memorySessions.get(officeId) || [])
    .filter((s) => !statusFilter || statusFilter === "All" || s.status === statusFilter)
    .map(formatSession);

  const client = getSupabaseClient();
  if (client) {
    try {
      let query = client.from("sessions").select("*").eq("office_id", officeId);
      if (statusFilter && statusFilter !== "All") {
        query = query.eq("status", statusFilter);
      }
      const { data, error } = await query.order("id", { ascending: false });
      if (!error && data) {
        const dbSessions = data.map((d: any) => {
          const formatted = formatSession(d);
          const fromMem = (memorySessions.get(officeId) || []).find((m) => m.id === d.id);
          if (fromMem) {
            return {
              ...formatted,
              clientId: fromMem.clientId || formatted.clientId,
              client_id: fromMem.clientId || formatted.client_id,
              assignedLawyerId: fromMem.assignedLawyerId || formatted.assignedLawyerId,
              assigned_lawyer_id: fromMem.assignedLawyerId || formatted.assigned_lawyer_id,
              clientRole: fromMem.clientRole || formatted.clientRole,
              client_role: fromMem.clientRole || formatted.client_role,
              createdBy: fromMem.createdBy || formatted.createdBy,
              created_by: fromMem.createdBy || formatted.created_by,
            };
          }
          return formatted;
        });
        const dbIds = new Set(dbSessions.map((s) => s.id));
        return [...dbSessions, ...memList.filter((m) => !dbIds.has(m.id))];
      }
    } catch (err) {
      logger.warn({ err }, "Supabase query failed in listSessions, falling back to memory");
    }
  }

  return memList;
}

export async function getSessionById(id: number, officeId: string): Promise<Session | null> {
  const memList = memorySessions.get(officeId) || [];
  const fromMem = memList.find((item) => item.id === id);

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
        const formatted = formatSession(data);
        if (fromMem) {
          return {
            ...formatted,
            clientId: fromMem.clientId || formatted.clientId,
            client_id: fromMem.clientId || formatted.client_id,
            assignedLawyerId: fromMem.assignedLawyerId || formatted.assignedLawyerId,
            assigned_lawyer_id: fromMem.assignedLawyerId || formatted.assigned_lawyer_id,
            clientRole: fromMem.clientRole || formatted.clientRole,
            client_role: fromMem.clientRole || formatted.client_role,
            createdBy: fromMem.createdBy || formatted.createdBy,
            created_by: fromMem.createdBy || formatted.created_by,
          };
        }
        return formatted;
      }
    } catch (err) {
      logger.warn({ err }, "Supabase query failed in getSessionById, falling back to memory");
    }
  }

  if (!fromMem) return null;
  return formatSession(fromMem);
}

export async function createSession(data: SessionCreateData, officeId: string): Promise<Session> {
  const hearingAtDate = computeHearingDateTime(data.sessionDateHijri ?? undefined, data.sessionTime ?? undefined);
  const hearingAt = hearingAtDate ? hearingAtDate.toISOString() : null;
  const now = new Date().toISOString();

  const clientId = data.clientId || (data as any).client_id || null;
  const assignedLawyerId = data.assignedLawyerId || (data as any).assigned_lawyer_id || null;
  const clientRole = data.clientRole || (data as any).client_role || null;
  const createdBy = data.createdBy || (data as any).created_by || null;

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
            client_id: clientId,
            assigned_lawyer_id: assignedLawyerId,
            client_role: clientRole,
            created_by: createdBy,
          },
        ])
        .select()
        .single();

      if (!error && inserted) {
        const formatted = formatSession(inserted);
        const memRecord: SessionRecord = {
          ...formatted,
          id: inserted.id,
          officeId,
          clientId,
          assignedLawyerId,
          clientRole,
          createdBy,
        };
        const list = memorySessions.get(officeId) || [];
        list.unshift(memRecord);
        memorySessions.set(officeId, list);
        return {
          ...formatted,
          clientId,
          client_id: clientId,
          assignedLawyerId,
          assigned_lawyer_id: assignedLawyerId,
          clientRole,
          client_role: clientRole,
          createdBy,
          created_by: createdBy,
        };
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
    clientId,
    assignedLawyerId,
    clientRole,
    createdBy,
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
      if (data.clientId !== undefined) updatePayload.client_id = data.clientId;
      if ((data as any).client_id !== undefined) updatePayload.client_id = (data as any).client_id;
      if (data.assignedLawyerId !== undefined) updatePayload.assigned_lawyer_id = data.assignedLawyerId;
      if ((data as any).assigned_lawyer_id !== undefined) updatePayload.assigned_lawyer_id = (data as any).assigned_lawyer_id;
      if (data.clientRole !== undefined) updatePayload.client_role = data.clientRole;
      if ((data as any).client_role !== undefined) updatePayload.client_role = (data as any).client_role;

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
    clientId: data.clientId !== undefined ? data.clientId : (data as any).client_id !== undefined ? (data as any).client_id : current.clientId,
    assignedLawyerId: data.assignedLawyerId !== undefined ? data.assignedLawyerId : (data as any).assigned_lawyer_id !== undefined ? (data as any).assigned_lawyer_id : current.assignedLawyerId,
    clientRole: data.clientRole !== undefined ? data.clientRole : (data as any).client_role !== undefined ? (data as any).client_role : current.clientRole,
    updatedAt: new Date().toISOString(),
  };

  list[idx] = updated;
  return formatSession(updated);
}

export async function reassignSession(id: number, assignedLawyerId: string | null, officeId: string): Promise<Session | null> {
  return updateSession(id, { assignedLawyerId } as any, officeId);
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

function formatTask(r: any): TaskRecord {
  return {
    id: r.id,
    officeId: r.officeId ?? r.office_id,
    title: r.title,
    assignee: r.assignee || "",
    priority: r.priority || "عادية",
    dueDate: r.dueDate ?? r.due_date ?? "",
    remainingDays: r.remainingDays ?? r.remaining_days ?? calcRemainingDays(r.dueDate || r.due_date),
    status: r.status || "قيد التنفيذ",
    notes: r.notes || "",
    clientId: r.clientId ?? r.client_id ?? null,
    assignedLawyerId: r.assignedLawyerId ?? r.assigned_lawyer_id ?? null,
    createdBy: r.createdBy ?? r.created_by ?? null,
    createdAt: r.createdAt ?? r.created_at,
    updatedAt: r.updatedAt ?? r.updated_at,
    ...(r.clientId || r.client_id ? { client_id: r.clientId ?? r.client_id } : {}),
    ...(r.assignedLawyerId || r.assigned_lawyer_id ? { assigned_lawyer_id: r.assignedLawyerId ?? r.assigned_lawyer_id } : {}),
    ...(r.createdBy || r.created_by ? { created_by: r.createdBy ?? r.created_by } : {}),
  } as any;
}

export async function listTasks(officeId: string): Promise<TaskRecord[]> {
  const memList = (memoryTasks.get(officeId) || []).map(formatTask);

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("tasks")
        .select("*")
        .eq("office_id", officeId)
        .order("id", { ascending: false });

      if (!error && data) {
        const dbTasks = data.map((d: any) => {
          const formatted = formatTask(d);
          const fromMem = (memoryTasks.get(officeId) || []).find((m) => m.id === d.id);
          if (fromMem) {
            return {
              ...formatted,
              clientId: fromMem.clientId || formatted.clientId,
              assignedLawyerId: fromMem.assignedLawyerId || formatted.assignedLawyerId,
              createdBy: fromMem.createdBy || formatted.createdBy,
            };
          }
          return formatted;
        });
        const dbIds = new Set(dbTasks.map((t) => t.id));
        return [...dbTasks, ...memList.filter((m) => !dbIds.has(m.id))];
      }
    } catch (err) {
      logger.warn({ err }, "Supabase listTasks failed, falling back to memory");
    }
  }

  return memList;
}

export async function getTaskById(id: number, officeId: string): Promise<TaskRecord | null> {
  const memList = memoryTasks.get(officeId) || [];
  const fromMem = memList.find((item) => item.id === id);

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
        const formatted = formatTask(data);
        if (fromMem) {
          return {
            ...formatted,
            clientId: fromMem.clientId || formatted.clientId,
            assignedLawyerId: fromMem.assignedLawyerId || formatted.assignedLawyerId,
            createdBy: fromMem.createdBy || formatted.createdBy,
          };
        }
        return formatted;
      }
    } catch (err) {
      logger.warn({ err }, "Supabase getTaskById failed, falling back to memory");
    }
  }

  return fromMem ? formatTask(fromMem) : null;
}

export async function createTask(
  data: {
    title: string;
    assignee?: string;
    priority?: "عاجلة" | "عادية";
    dueDate?: string;
    status?: "قيد التنفيذ" | "مكتملة" | "مؤجلة" | "معلقة";
    notes?: string;
    clientId?: string | null;
    assignedLawyerId?: string | null;
    createdBy?: string | null;
  },
  officeId: string,
): Promise<TaskRecord> {
  const remaining = calcRemainingDays(data.dueDate || "");
  const now = new Date().toISOString();
  const clientId = data.clientId || (data as any).client_id || null;
  const assignedLawyerId = data.assignedLawyerId || (data as any).assigned_lawyer_id || null;
  const createdBy = data.createdBy || (data as any).created_by || null;

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
            client_id: clientId,
            assigned_lawyer_id: assignedLawyerId,
            created_by: createdBy,
          },
        ])
        .select()
        .single();

      if (!error && inserted) {
        const formatted = formatTask(inserted);
        const memRecord: TaskRecord = {
          ...formatted,
          id: inserted.id,
          officeId,
          clientId,
          assignedLawyerId,
          createdBy,
        };
        const list = memoryTasks.get(officeId) || [];
        list.unshift(memRecord);
        memoryTasks.set(officeId, list);
        return formatTask(memRecord);
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
    clientId,
    assignedLawyerId,
    createdBy,
    createdAt: now,
  };

  const list = memoryTasks.get(officeId) || [];
  list.unshift(record);
  memoryTasks.set(officeId, list);
  return formatTask(record);
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
      if (data.clientId !== undefined) updatePayload.client_id = data.clientId;
      if ((data as any).client_id !== undefined) updatePayload.client_id = (data as any).client_id;
      if (data.assignedLawyerId !== undefined) updatePayload.assigned_lawyer_id = data.assignedLawyerId;
      if ((data as any).assigned_lawyer_id !== undefined) updatePayload.assigned_lawyer_id = (data as any).assigned_lawyer_id;

      const { data: updated, error } = await client
        .from("tasks")
        .update(updatePayload)
        .eq("id", id)
        .eq("office_id", officeId)
        .select()
        .single();

      if (!error && updated) {
        return formatTask(updated);
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
    clientId: data.clientId !== undefined ? data.clientId : (data as any).client_id !== undefined ? (data as any).client_id : current.clientId,
    assignedLawyerId: data.assignedLawyerId !== undefined ? data.assignedLawyerId : (data as any).assigned_lawyer_id !== undefined ? (data as any).assigned_lawyer_id : current.assignedLawyerId,
    updatedAt: new Date().toISOString(),
  };
  list[idx] = updated;
  return formatTask(updated);
}

export async function reassignTask(
  id: number,
  assignedLawyerId: string | null,
  officeId: string,
  lawyerName?: string,
): Promise<TaskRecord | null> {
  const payload: any = { assignedLawyerId };
  if (lawyerName !== undefined) payload.assignee = lawyerName;
  return updateTask(id, payload, officeId);
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

function formatPoa(r: any): PoaRecord {
  return {
    id: r.id,
    officeId: r.officeId ?? r.office_id,
    clientName: r.clientName ?? r.client_name,
    poaNumber: r.poaNumber ?? r.poa_number,
    issueDateHijri: r.issueDateHijri ?? r.issue_date_hijri ?? "",
    expiryDateHijri: r.expiryDateHijri ?? r.expiry_date_hijri ?? "",
    daysRemaining: r.daysRemaining ?? r.days_remaining ?? calcDaysFromHijri(r.expiryDateHijri || r.expiry_date_hijri),
    notes: r.notes || "",
    clientId: r.clientId ?? r.client_id ?? null,
    assignedLawyerId: r.assignedLawyerId ?? r.assigned_lawyer_id ?? null,
    createdBy: r.createdBy ?? r.created_by ?? null,
    createdAt: r.createdAt ?? r.created_at,
    updatedAt: r.updatedAt ?? r.updated_at,
    ...(r.clientId || r.client_id ? { client_id: r.clientId ?? r.client_id } : {}),
    ...(r.assignedLawyerId || r.assigned_lawyer_id ? { assigned_lawyer_id: r.assignedLawyerId ?? r.assigned_lawyer_id } : {}),
    ...(r.createdBy || r.created_by ? { created_by: r.createdBy ?? r.created_by } : {}),
  } as any;
}

export async function listPoa(officeId: string): Promise<PoaRecord[]> {
  const memList = (memoryPoa.get(officeId) || []).map(formatPoa);

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("poa")
        .select("*")
        .eq("office_id", officeId)
        .order("id", { ascending: false });

      if (!error && data) {
        const dbPoa = data.map((d: any) => {
          const formatted = formatPoa(d);
          const fromMem = (memoryPoa.get(officeId) || []).find((m) => m.id === d.id);
          if (fromMem) {
            return {
              ...formatted,
              clientId: fromMem.clientId || formatted.clientId,
              assignedLawyerId: fromMem.assignedLawyerId || formatted.assignedLawyerId,
              createdBy: fromMem.createdBy || formatted.createdBy,
            };
          }
          return formatted;
        });
        const dbIds = new Set(dbPoa.map((p) => p.id));
        return [...dbPoa, ...memList.filter((m) => !dbIds.has(m.id))];
      }
    } catch (err) {
      logger.warn({ err }, "Supabase listPoa failed, falling back to memory");
    }
  }

  return memList;
}

export async function getPoaById(id: number, officeId: string): Promise<PoaRecord | null> {
  const memList = memoryPoa.get(officeId) || [];
  const fromMem = memList.find((item) => item.id === id);

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
        const formatted = formatPoa(data);
        if (fromMem) {
          return {
            ...formatted,
            clientId: fromMem.clientId || formatted.clientId,
            assignedLawyerId: fromMem.assignedLawyerId || formatted.assignedLawyerId,
            createdBy: fromMem.createdBy || formatted.createdBy,
          };
        }
        return formatted;
      }
    } catch (err) {
      logger.warn({ err }, "Supabase getPoaById failed, falling back to memory");
    }
  }

  return fromMem ? formatPoa(fromMem) : null;
}

export async function createPoa(
  data: {
    clientName: string;
    poaNumber: string;
    issueDateHijri?: string;
    expiryDateHijri?: string;
    daysRemaining?: number;
    notes?: string;
    clientId?: string | null;
    assignedLawyerId?: string | null;
    createdBy?: string | null;
  },
  officeId: string,
): Promise<PoaRecord> {
  const days = data.daysRemaining ?? calcDaysFromHijri(data.expiryDateHijri || "");
  const now = new Date().toISOString();
  const clientId = data.clientId || (data as any).client_id || null;
  const assignedLawyerId = data.assignedLawyerId || (data as any).assigned_lawyer_id || null;
  const createdBy = data.createdBy || (data as any).created_by || null;

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
            client_id: clientId,
            assigned_lawyer_id: assignedLawyerId,
            created_by: createdBy,
          },
        ])
        .select()
        .single();

      if (!error && inserted) {
        const formatted = formatPoa(inserted);
        const memRecord: PoaRecord = {
          ...formatted,
          id: inserted.id,
          officeId,
          clientId,
          assignedLawyerId,
          createdBy,
        };
        const list = memoryPoa.get(officeId) || [];
        list.unshift(memRecord);
        memoryPoa.set(officeId, list);
        return formatPoa(memRecord);
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
    clientId,
    assignedLawyerId,
    createdBy,
    createdAt: now,
  };

  const list = memoryPoa.get(officeId) || [];
  list.unshift(record);
  memoryPoa.set(officeId, list);
  return formatPoa(record);
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
      if (data.clientId !== undefined) updatePayload.client_id = data.clientId;
      if ((data as any).client_id !== undefined) updatePayload.client_id = (data as any).client_id;
      if (data.assignedLawyerId !== undefined) updatePayload.assigned_lawyer_id = data.assignedLawyerId;
      if ((data as any).assigned_lawyer_id !== undefined) updatePayload.assigned_lawyer_id = (data as any).assigned_lawyer_id;

      const { data: updated, error } = await client
        .from("poa")
        .update(updatePayload)
        .eq("id", id)
        .eq("office_id", officeId)
        .select()
        .single();

      if (!error && updated) {
        return formatPoa(updated);
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
    clientId: data.clientId !== undefined ? data.clientId : (data as any).client_id !== undefined ? (data as any).client_id : current.clientId,
    assignedLawyerId: data.assignedLawyerId !== undefined ? data.assignedLawyerId : (data as any).assigned_lawyer_id !== undefined ? (data as any).assigned_lawyer_id : current.assignedLawyerId,
    updatedAt: new Date().toISOString(),
  };
  list[idx] = updated;
  return formatPoa(updated);
}

export async function reassignPoa(
  id: number,
  assignedLawyerId: string | null,
  officeId: string,
): Promise<PoaRecord | null> {
  return updatePoa(id, { assignedLawyerId } as any, officeId);
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

function formatJudgment(r: any): JudgmentRecord {
  return {
    id: r.id,
    officeId: r.officeId ?? r.office_id,
    caseNumber: r.caseNumber ?? r.case_number ?? "",
    court: r.court || "",
    plaintiff: r.plaintiff || "",
    defendant: r.defendant || "",
    assignedLawyer: r.assignedLawyer ?? r.assigned_lawyer ?? "",
    judgmentNumber: r.judgmentNumber ?? r.judgment_number ?? "",
    judgmentDate: r.judgmentDate ?? r.judgment_date ?? "",
    summary: r.summary || "",
    isFavorable: r.isFavorable ?? r.is_favorable ?? "نهائي",
    clientId: r.clientId ?? r.client_id ?? null,
    assignedLawyerId: r.assignedLawyerId ?? r.assigned_lawyer_id ?? null,
    clientRole: r.clientRole ?? r.client_role ?? null,
    createdBy: r.createdBy ?? r.created_by ?? null,
    createdAt: r.createdAt ?? r.created_at,
    updatedAt: r.updatedAt ?? r.updated_at,
    ...(r.clientId || r.client_id ? { client_id: r.clientId ?? r.client_id } : {}),
    ...(r.assignedLawyerId || r.assigned_lawyer_id ? { assigned_lawyer_id: r.assignedLawyerId ?? r.assigned_lawyer_id } : {}),
    ...(r.clientRole || r.client_role ? { client_role: r.clientRole ?? r.client_role } : {}),
    ...(r.createdBy || r.created_by ? { created_by: r.createdBy ?? r.created_by } : {}),
  } as any;
}

export async function listJudgments(officeId: string): Promise<JudgmentRecord[]> {
  const memList = (memoryJudgments.get(officeId) || []).map(formatJudgment);

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("judgments")
        .select("*")
        .eq("office_id", officeId)
        .order("id", { ascending: false });

      if (!error && data) {
        const dbJudgments = data.map((d: any) => {
          const formatted = formatJudgment(d);
          const fromMem = (memoryJudgments.get(officeId) || []).find((m) => m.id === d.id);
          if (fromMem) {
            return {
              ...formatted,
              clientId: fromMem.clientId || formatted.clientId,
              assignedLawyerId: fromMem.assignedLawyerId || formatted.assignedLawyerId,
              clientRole: fromMem.clientRole || formatted.clientRole,
              createdBy: fromMem.createdBy || formatted.createdBy,
            };
          }
          return formatted;
        });
        const dbIds = new Set(dbJudgments.map((j) => j.id));
        return [...dbJudgments, ...memList.filter((m) => !dbIds.has(m.id))];
      }
    } catch (err) {
      logger.warn({ err }, "Supabase listJudgments failed, falling back to memory");
    }
  }

  return memList;
}

export async function getJudgmentById(id: number, officeId: string): Promise<JudgmentRecord | null> {
  const memList = memoryJudgments.get(officeId) || [];
  const fromMem = memList.find((item) => item.id === id);

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
        const formatted = formatJudgment(data);
        if (fromMem) {
          return {
            ...formatted,
            clientId: fromMem.clientId || formatted.clientId,
            assignedLawyerId: fromMem.assignedLawyerId || formatted.assignedLawyerId,
            clientRole: fromMem.clientRole || formatted.clientRole,
            createdBy: fromMem.createdBy || formatted.createdBy,
          };
        }
        return formatted;
      }
    } catch (err) {
      logger.warn({ err }, "Supabase getJudgmentById failed, falling back to memory");
    }
  }

  return fromMem ? formatJudgment(fromMem) : null;
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
    clientId?: string | null;
    assignedLawyerId?: string | null;
    clientRole?: "plaintiff" | "defendant" | null;
    createdBy?: string | null;
  },
  officeId: string,
): Promise<JudgmentRecord> {
  const now = new Date().toISOString();
  const clientId = data.clientId || (data as any).client_id || null;
  const assignedLawyerId = data.assignedLawyerId || (data as any).assigned_lawyer_id || null;
  const clientRole = data.clientRole || (data as any).client_role || null;
  const createdBy = data.createdBy || (data as any).created_by || null;

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
            client_id: clientId,
            assigned_lawyer_id: assignedLawyerId,
            client_role: clientRole,
            created_by: createdBy,
          },
        ])
        .select()
        .single();

      if (!error && inserted) {
        const formatted = formatJudgment(inserted);
        const memRecord: JudgmentRecord = {
          ...formatted,
          id: inserted.id,
          officeId,
          clientId,
          assignedLawyerId,
          clientRole,
          createdBy,
        };
        const list = memoryJudgments.get(officeId) || [];
        list.unshift(memRecord);
        memoryJudgments.set(officeId, list);
        return formatJudgment(memRecord);
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
    clientId,
    assignedLawyerId,
    clientRole,
    createdBy,
    createdAt: now,
  };

  const list = memoryJudgments.get(officeId) || [];
  list.unshift(record);
  memoryJudgments.set(officeId, list);
  return formatJudgment(record);
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
      if (data.clientId !== undefined) updatePayload.client_id = data.clientId;
      if ((data as any).client_id !== undefined) updatePayload.client_id = (data as any).client_id;
      if (data.assignedLawyerId !== undefined) updatePayload.assigned_lawyer_id = data.assignedLawyerId;
      if ((data as any).assigned_lawyer_id !== undefined) updatePayload.assigned_lawyer_id = (data as any).assigned_lawyer_id;
      if (data.clientRole !== undefined) updatePayload.client_role = data.clientRole;
      if ((data as any).client_role !== undefined) updatePayload.client_role = (data as any).client_role;

      const { data: updated, error } = await client
        .from("judgments")
        .update(updatePayload)
        .eq("id", id)
        .eq("office_id", officeId)
        .select()
        .single();

      if (!error && updated) {
        return formatJudgment(updated);
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
    clientId: data.clientId !== undefined ? data.clientId : (data as any).client_id !== undefined ? (data as any).client_id : current.clientId,
    assignedLawyerId: data.assignedLawyerId !== undefined ? data.assignedLawyerId : (data as any).assigned_lawyer_id !== undefined ? (data as any).assigned_lawyer_id : current.assignedLawyerId,
    clientRole: data.clientRole !== undefined ? data.clientRole : (data as any).client_role !== undefined ? (data as any).client_role : current.clientRole,
    updatedAt: new Date().toISOString(),
  };
  list[idx] = updated;
  return formatJudgment(updated);
}

export async function reassignJudgment(
  id: number,
  assignedLawyerId: string | null,
  officeId: string,
  lawyerName?: string,
): Promise<JudgmentRecord | null> {
  const payload: any = { assignedLawyerId };
  if (lawyerName !== undefined) payload.assignedLawyer = lawyerName;
  return updateJudgment(id, payload, officeId);
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

// ============================================================================
// 7. NOTIFICATIONS
// ============================================================================

function formatNotification(r: any): NotificationRecord {
  return {
    id: String(r.id),
    officeId: r.officeId ?? r.office_id,
    userId: r.userId ?? r.user_id,
    type: r.type,
    title: r.title,
    body: r.body,
    relatedRecordType: r.relatedRecordType ?? r.related_record_type ?? null,
    relatedRecordId: r.relatedRecordId ? String(r.relatedRecordId) : (r.related_record_id ? String(r.related_record_id) : null),
    isRead: Boolean(r.isRead ?? r.is_read),
    createdAt: r.createdAt ?? r.created_at ?? new Date().toISOString(),
  };
}

export async function listNotifications(
  officeId: string,
  userId: string,
  options?: { page?: number; limit?: number },
): Promise<{ notifications: NotificationRecord[]; unreadCount: number; total: number }> {
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.max(1, Math.min(100, options?.limit ?? 20));
  const offset = (page - 1) * limit;

  const client = getSupabaseClient();
  if (client) {
    try {
      const { count: totalCount } = await client
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("office_id", officeId)
        .eq("user_id", userId);

      const { count: unreadCount } = await client
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("office_id", officeId)
        .eq("user_id", userId)
        .eq("is_read", false);

      const { data, error } = await client
        .from("notifications")
        .select("*")
        .eq("office_id", officeId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (!error && data) {
        return {
          notifications: data.map(formatNotification),
          unreadCount: unreadCount ?? 0,
          total: totalCount ?? data.length,
        };
      }
    } catch (err) {
      logger.warn({ err }, "Supabase listNotifications failed, falling back to memory");
    }
  }

  const officeList = memoryNotifications.get(officeId) || [];
  const userList = officeList.filter((n) => n.userId === userId);
  const unreadCount = userList.filter((n) => !n.isRead).length;
  const paginated = userList.slice(offset, offset + limit);

  return {
    notifications: paginated.map(formatNotification),
    unreadCount,
    total: userList.length,
  };
}

export async function createNotification(data: {
  officeId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  relatedRecordType?: string | null;
  relatedRecordId?: string | null;
}): Promise<NotificationRecord> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const newRecord: NotificationRecord = {
    id,
    officeId: data.officeId,
    userId: data.userId,
    type: data.type,
    title: data.title,
    body: data.body,
    relatedRecordType: data.relatedRecordType ?? null,
    relatedRecordId: data.relatedRecordId ? String(data.relatedRecordId) : null,
    isRead: false,
    createdAt: now,
  };

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data: inserted, error } = await client
        .from("notifications")
        .insert([
          {
            id: newRecord.id,
            office_id: newRecord.officeId,
            user_id: newRecord.userId,
            type: newRecord.type,
            title: newRecord.title,
            body: newRecord.body,
            related_record_type: newRecord.relatedRecordType,
            related_record_id: newRecord.relatedRecordId,
            is_read: false,
            created_at: newRecord.createdAt,
          },
        ])
        .select()
        .single();

      if (!error && inserted) {
        const formatted = formatNotification(inserted);
        const officeList = memoryNotifications.get(data.officeId) || [];
        officeList.unshift(formatted);
        memoryNotifications.set(data.officeId, officeList);
        return formatted;
      }
    } catch (err) {
      logger.warn({ err }, "Supabase createNotification failed, falling back to memory");
    }
  }

  const officeList = memoryNotifications.get(data.officeId) || [];
  officeList.unshift(newRecord);
  memoryNotifications.set(data.officeId, officeList);
  return formatNotification(newRecord);
}

export async function markNotificationRead(
  id: string,
  officeId: string,
  userId: string,
): Promise<boolean> {
  let dbSuccess = false;
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("office_id", officeId)
        .eq("user_id", userId)
        .select("id");

      if (!error && data && data.length > 0) {
        dbSuccess = true;
      }
    } catch (err) {
      logger.warn({ err }, "Supabase markNotificationRead failed");
    }
  }

  const officeList = memoryNotifications.get(officeId) || [];
  const item = officeList.find((n) => n.id === id && n.userId === userId);
  if (item) {
    item.isRead = true;
    return true;
  }

  return dbSuccess;
}

export async function markAllNotificationsRead(
  officeId: string,
  userId: string,
): Promise<number> {
  let countUpdated = 0;
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("notifications")
        .update({ is_read: true })
        .eq("office_id", officeId)
        .eq("user_id", userId)
        .eq("is_read", false)
        .select("id");

      if (!error && data) {
        countUpdated = data.length;
      }
    } catch (err) {
      logger.warn({ err }, "Supabase markAllNotificationsRead failed");
    }
  }

  const officeList = memoryNotifications.get(officeId) || [];
  let memCount = 0;
  for (const item of officeList) {
    if (item.userId === userId && !item.isRead) {
      item.isRead = true;
      memCount++;
    }
  }

  return countUpdated || memCount;
}

export async function hasRecentNotification(
  officeId: string,
  type: string,
  relatedRecordType: string,
  relatedRecordId: string,
  withinHours: number = 24,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - withinHours * 3600 * 1000).toISOString();
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("notifications")
        .select("id")
        .eq("office_id", officeId)
        .eq("type", type)
        .eq("related_record_type", relatedRecordType)
        .eq("related_record_id", String(relatedRecordId))
        .gte("created_at", cutoff)
        .limit(1);

      if (!error && data && data.length > 0) {
        return true;
      }
    } catch (err) {
      logger.warn({ err }, "Supabase hasRecentNotification failed, checking memory");
    }
  }

  const officeList = memoryNotifications.get(officeId) || [];
  const cutoffTime = Date.now() - withinHours * 3600 * 1000;
  return officeList.some(
    (n) =>
      n.type === type &&
      n.relatedRecordType === relatedRecordType &&
      String(n.relatedRecordId) === String(relatedRecordId) &&
      new Date(n.createdAt).getTime() >= cutoffTime,
  );
}


