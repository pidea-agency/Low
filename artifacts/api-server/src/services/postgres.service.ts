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
  caseId?: string | null;
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
  caseId?: string | null;
  assignedLawyerId?: string | null;
  clientRole?: "plaintiff" | "defendant" | null;
  createdBy?: string | null;
};

export type SessionUpdateData = SessionUpdate & {
  reminder24?: boolean;
  reminder6?: boolean;
  sessionDay?: string | null;
  clientId?: string | null;
  caseId?: string | null;
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
  caseId?: string | null;
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
  caseId?: string | null;
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
  caseId?: string | null;
  assignedLawyerId?: string | null;
  clientRole?: "plaintiff" | "defendant" | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CaseRecord {
  id: string;
  officeId: string;
  clientId: string;
  caseNumber: string;
  caseType: string;
  court: string;
  assignedLawyerId?: string | null;
  status: "open" | "closed" | "postponed";
  opposingParty?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  clientName?: string;
  assignedLawyerName?: string;
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

export interface AttachmentRecord {
  id: string;
  officeId: string;
  uploadedBy: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  relatedRecordType: 'client' | 'poa' | 'judgment' | 'session' | 'task' | 'case';
  relatedRecordId: string;
  createdAt: string;
  uploaderName?: string;
}

export interface ClientNoteRecord {
  id: string;
  officeId: string;
  clientId: string;
  authorId: string;
  body: string;
  createdAt: string;
  authorName?: string;
}

export interface BroadcastRecord {
  id: string;
  officeId: string;
  senderId: string;
  title: string;
  body: string;
  inAppSentCount: number;
  whatsappSentCount: number;
  whatsappFailedCount: number;
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
const memoryAttachments = new Map<string, AttachmentRecord[]>();
const memoryClientNotes = new Map<string, ClientNoteRecord[]>();
const memoryCases = new Map<string, CaseRecord[]>();
const memoryBroadcasts = new Map<string, BroadcastRecord[]>();

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
  memoryAttachments.clear();
  memoryClientNotes.clear();
  memoryCases.clear();
  memoryBroadcasts.clear();
}

export class DatabaseUnavailableError extends Error {
  public statusCode = 503;
  public code = "DATABASE_UNAVAILABLE";
  constructor(message = "قاعدة البيانات غير متصلة حالياً") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

let _forceDisableMemoryStoreForTesting = false;

export function setForceDisableMemoryStoreForTesting(disabled: boolean): void {
  _forceDisableMemoryStoreForTesting = disabled;
}

export function isInMemoryFallbackAllowed(): boolean {
  if (process.env.NODE_ENV !== "test") {
    return false;
  }
  return !_forceDisableMemoryStoreForTesting;
}

export function handleSupabaseFailure(operation: string, err?: any): void {
  if (err instanceof DatabaseUnavailableError) throw err;
  logger.error({ err, operation }, `Supabase ${operation} failed`);
  if (!isInMemoryFallbackAllowed()) {
    throw new DatabaseUnavailableError(
      `قاعدة البيانات غير متصلة حالياً (${operation}): ${err?.message || "فشل الاتصال بـ Supabase"}`
    );
  }
}

export function handleDatabaseOrServerError(
  res: any,
  err: any,
  refId: string,
  defaultMsg: string
): void {
  if (
    err instanceof DatabaseUnavailableError ||
    (err as any)?.statusCode === 503 ||
    (err as any)?.code === "DATABASE_UNAVAILABLE" ||
    String(err?.message || "").includes("قاعدة البيانات غير متصلة")
  ) {
    res.status(503).json({
      error: "قاعدة البيانات غير متصلة حالياً",
      code: "DATABASE_UNAVAILABLE",
      refId,
    });
    return;
  }
  res.status(500).json({ error: `${defaultMsg}. رقم المرجع: ${refId}`, refId });
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
    caseId: s.caseId ?? s.case_id ?? null,
    case_id: s.caseId ?? s.case_id ?? null,
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
      if (error) {
        handleSupabaseFailure("listClients", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("listClients", err);
    }
  } else {
    handleSupabaseFailure("listClients", new Error("Supabase client is not configured"));
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
      if (error && error.code === "PGRST116") {
        if (isInMemoryFallbackAllowed()) {
          const list = memoryClients.get(officeId) || [];
          const found = list.find((c) => c.id === id);
          if (found) return { ...found };
        }
        return null;
      }
      if (error) {
        handleSupabaseFailure("getClientById", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("getClientById", err);
    }
  } else {
    handleSupabaseFailure("getClientById", new Error("Supabase client is not configured"));
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
      if (error) {
        handleSupabaseFailure("createClient", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("createClient", err);
    }
  } else {
    handleSupabaseFailure("createClient", new Error("Supabase client is not configured"));
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
      if (error && error.code === "PGRST116") {
        if (!isInMemoryFallbackAllowed()) return null;
      }
      if (error) {
        handleSupabaseFailure("updateClient", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("updateClient", err);
    }
  } else {
    handleSupabaseFailure("updateClient", new Error("Supabase client is not configured"));
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

      if (!error) {
        return (count ?? 0) > 0;
      }
      if (error) {
        handleSupabaseFailure("deleteClient", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("deleteClient", err);
    }
  } else {
    handleSupabaseFailure("deleteClient", new Error("Supabase client is not configured"));
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
      if (error) {
        handleSupabaseFailure("listSessions", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("listSessions", err);
    }
  } else {
    handleSupabaseFailure("listSessions", new Error("Supabase client is not configured"));
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
      if (error && error.code === "PGRST116") {
        if (isInMemoryFallbackAllowed() && fromMem) {
          return formatSession(fromMem);
        }
        return null;
      }
      if (error) {
        handleSupabaseFailure("getSessionById", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("getSessionById", err);
    }
  } else {
    handleSupabaseFailure("getSessionById", new Error("Supabase client is not configured"));
  }

  if (!fromMem) return null;
  return formatSession(fromMem);
}

export async function createSession(data: SessionCreateData, officeId: string): Promise<Session> {
  const hearingAtDate = computeHearingDateTime(data.sessionDateHijri ?? undefined, data.sessionTime ?? undefined);
  const hearingAt = hearingAtDate ? hearingAtDate.toISOString() : null;
  const now = new Date().toISOString();

  const clientId = data.clientId || (data as any).client_id || null;
  const caseId = data.caseId || (data as any).case_id || null;
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
            case_id: caseId,
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
          caseId,
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
          caseId,
          case_id: caseId,
          assignedLawyerId,
          assigned_lawyer_id: assignedLawyerId,
          clientRole,
          client_role: clientRole,
          createdBy,
          created_by: createdBy,
        };
      }
      if (error) {
        handleSupabaseFailure("createSession", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("createSession", err);
    }
  } else {
    handleSupabaseFailure("createSession", new Error("Supabase client is not configured"));
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
    caseId,
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
      if (data.caseId !== undefined) updatePayload.case_id = data.caseId;
      if ((data as any).case_id !== undefined) updatePayload.case_id = (data as any).case_id;
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
      if (error && error.code === "PGRST116") {
        if (!isInMemoryFallbackAllowed()) return null;
      }
      if (error) {
        handleSupabaseFailure("updateSession", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("updateSession", err);
    }
  } else {
    handleSupabaseFailure("updateSession", new Error("Supabase client is not configured"));
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
    caseId: data.caseId !== undefined ? data.caseId : (data as any).case_id !== undefined ? (data as any).case_id : current.caseId,
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
      if (!error) {
        if (isInMemoryFallbackAllowed()) {
          const list = memorySessions.get(officeId) || [];
          const idx = list.findIndex((s) => s.id === id);
          if (idx !== -1) list.splice(idx, 1);
        }
        if ((count ?? 0) > 0) return true;
        if (isInMemoryFallbackAllowed()) return true;
        return false;
      }
      if (error) {
        handleSupabaseFailure("deleteSession", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("deleteSession", err);
    }
  } else {
    handleSupabaseFailure("deleteSession", new Error("Supabase client is not configured"));
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
      const { data, error } = await client
        .from("reports")
        .select("report")
        .eq("session_id", id)
        .eq("office_id", officeId)
        .order("id", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        return { session, report: data[0].report };
      }

      if (error) {
        handleSupabaseFailure("getSessionReport", error);
      } else {
        // Check report field on session row
        const { data: sRow, error: sErr } = await client
          .from("sessions")
          .select("report")
          .eq("id", id)
          .eq("office_id", officeId)
          .single();
        if (sErr && sErr.code !== "PGRST116") {
          handleSupabaseFailure("getSessionReport:sRow", sErr);
        } else if (sRow?.report) {
          return { session, report: sRow.report };
        } else {
          if (isInMemoryFallbackAllowed()) {
            const reportsList = memoryReports.get(officeId) || [];
            const found = reportsList.find((r) => r.sessionId === id);
            if (found) return { session, report: found.report };
            if ((session as any).report) return { session, report: (session as any).report };
          }
          return { session, report: null };
        }
      }
    } catch (err: any) {
      handleSupabaseFailure("getSessionReport", err);
    }
  } else {
    handleSupabaseFailure("getSessionReport", new Error("Supabase client is not configured"));
  }

  const reportsList = memoryReports.get(officeId) || [];
  const found = reportsList.find((r) => r.sessionId === id);
  return { session, report: found ? found.report : null };
}

export async function getSessionReportStatusMap(officeId: string): Promise<Set<number>> {
  const reportedSet = new Set<number>();

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data: rData, error: rErr } = await client
        .from("reports")
        .select("session_id, report")
        .eq("office_id", officeId);
      if (rErr) {
        handleSupabaseFailure("getSessionReportStatusMap:reports", rErr);
      } else if (rData) {
        for (const row of rData) {
          if (row.report && row.session_id) {
            reportedSet.add(Number(row.session_id));
          }
        }
      }

      const { data: sData, error: sErr } = await client
        .from("sessions")
        .select("id, report")
        .eq("office_id", officeId)
        .not("report", "is", null);
      if (sErr) {
        handleSupabaseFailure("getSessionReportStatusMap:sessions", sErr);
      } else if (sData) {
        for (const row of sData) {
          if (row.report && row.id) {
            reportedSet.add(Number(row.id));
          }
        }
      }

      if (isInMemoryFallbackAllowed()) {
        const memReports = memoryReports.get(officeId) || [];
        for (const r of memReports) {
          if (r.report && r.sessionId) {
            reportedSet.add(Number(r.sessionId));
          }
        }
        const memSessions = memorySessions.get(officeId) || [];
        for (const s of memSessions) {
          if ((s as any).report && s.id) {
            reportedSet.add(Number(s.id));
          }
        }
      }

      return reportedSet;
    } catch (err: any) {
      handleSupabaseFailure("getSessionReportStatusMap", err);
    }
  } else {
    handleSupabaseFailure("getSessionReportStatusMap", new Error("Supabase client is not configured"));
  }

  const memReports = memoryReports.get(officeId) || [];
  for (const r of memReports) {
    if (r.report && r.sessionId) {
      reportedSet.add(Number(r.sessionId));
    }
  }

  return reportedSet;
}

export async function saveSessionReport(id: number, report: string, officeId: string): Promise<{ session: Session; report: string } | null> {
  const session = await getSessionById(id, officeId);
  if (!session) return null;

  const client = getSupabaseClient();
  if (client) {
    try {
      // Upsert report in reports table
      const { error: rErr } = await client.from("reports").insert([
        {
          office_id: officeId,
          session_id: id,
          report,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);
      if (rErr) {
        handleSupabaseFailure("saveSessionReport:reports", rErr);
      }

      // Also update session table report column
      const { error: sErr } = await client
        .from("sessions")
        .update({ report, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("office_id", officeId);
      if (sErr) {
        handleSupabaseFailure("saveSessionReport:sessions", sErr);
      }

      if (isInMemoryFallbackAllowed()) {
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

        const sList = memorySessions.get(officeId) || [];
        const sIdx = sList.findIndex((s) => s.id === id);
        if (sIdx !== -1) {
          (sList[sIdx] as any).report = report;
        }
      }

      return { session: { ...(session as any), report } as Session, report };
    } catch (err: any) {
      handleSupabaseFailure("saveSessionReport", err);
    }
  } else {
    handleSupabaseFailure("saveSessionReport", new Error("Supabase client is not configured"));
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

  const sList = memorySessions.get(officeId) || [];
  const sIdx = sList.findIndex((s) => s.id === id);
  if (sIdx !== -1) {
    (sList[sIdx] as any).report = report;
  }

  return { session: { ...(session as any), report } as Session, report };
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
    caseId: r.caseId ?? r.case_id ?? null,
    assignedLawyerId: r.assignedLawyerId ?? r.assigned_lawyer_id ?? null,
    createdBy: r.createdBy ?? r.created_by ?? null,
    createdAt: r.createdAt ?? r.created_at,
    updatedAt: r.updatedAt ?? r.updated_at,
    ...(r.clientId || r.client_id ? { client_id: r.clientId ?? r.client_id } : {}),
    ...(r.caseId || r.case_id ? { case_id: r.caseId ?? r.case_id } : {}),
    ...(r.assignedLawyerId || r.assigned_lawyer_id ? { assigned_lawyer_id: r.assignedLawyerId ?? r.assigned_lawyer_id } : {}),
    ...(r.createdBy || r.created_by ? { created_by: r.createdBy ?? r.created_by } : {}),
  } as any;
}

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
        if (isInMemoryFallbackAllowed()) {
          const mem = memoryTasks.get(officeId) || [];
          if (mem.length > 0) {
            const dbIds = new Set(data.map((d: any) => d.id));
            const extra = mem.filter((m) => !dbIds.has(m.id)).map(formatTask);
            return [...data.map(formatTask), ...extra];
          }
        }
        return data.map(formatTask);
      }
      if (error) {
        handleSupabaseFailure("listTasks", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("listTasks", err);
    }
  } else {
    handleSupabaseFailure("listTasks", new Error("Supabase client is not configured"));
  }

  return (memoryTasks.get(officeId) || []).map(formatTask);
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
        return formatTask(data);
      }
      if (error && error.code === "PGRST116") {
        if (isInMemoryFallbackAllowed()) {
          const memList = memoryTasks.get(officeId) || [];
          const fromMem = memList.find((item) => item.id === id);
          if (fromMem) return formatTask(fromMem);
        }
        return null;
      }
      if (error) {
        handleSupabaseFailure("getTaskById", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("getTaskById", err);
    }
  } else {
    handleSupabaseFailure("getTaskById", new Error("Supabase client is not configured"));
  }

  const memList = memoryTasks.get(officeId) || [];
  const fromMem = memList.find((item) => item.id === id);
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
    caseId?: string | null;
    assignedLawyerId?: string | null;
    createdBy?: string | null;
  },
  officeId: string,
): Promise<TaskRecord> {
  const remaining = calcRemainingDays(data.dueDate || "");
  const now = new Date().toISOString();
  const clientId = data.clientId || (data as any).client_id || null;
  const caseId = data.caseId || (data as any).case_id || null;
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
            case_id: caseId,
            assigned_lawyer_id: assignedLawyerId,
            created_by: createdBy,
          },
        ])
        .select()
        .single();

      if (!error && inserted) {
        const formatted = formatTask(inserted);
        if (isInMemoryFallbackAllowed()) {
          const list = memoryTasks.get(officeId) || [];
          list.unshift(formatted);
          memoryTasks.set(officeId, list);
        }
        return formatted;
      }
      if (error) {
        handleSupabaseFailure("createTask", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("createTask", err);
    }
  } else {
    handleSupabaseFailure("createTask", new Error("Supabase client is not configured"));
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
    caseId,
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
      if (data.caseId !== undefined) updatePayload.case_id = data.caseId;
      if ((data as any).case_id !== undefined) updatePayload.case_id = (data as any).case_id;
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
        const formatted = formatTask(updated);
        if (isInMemoryFallbackAllowed()) {
          const list = memoryTasks.get(officeId) || [];
          const idx = list.findIndex((t) => t.id === id);
          if (idx !== -1) list[idx] = { ...list[idx], ...formatted };
        }
        return formatted;
      }
      if (error && error.code === "PGRST116") {
        if (!isInMemoryFallbackAllowed()) return null;
      }
      if (error && error.code !== "PGRST116") {
        handleSupabaseFailure("updateTask", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("updateTask", err);
    }
  } else {
    handleSupabaseFailure("updateTask", new Error("Supabase client is not configured"));
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
    caseId: data.caseId !== undefined ? data.caseId : (data as any).case_id !== undefined ? (data as any).case_id : current.caseId,
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
      if (!error) {
        if (isInMemoryFallbackAllowed()) {
          const list = memoryTasks.get(officeId) || [];
          const idx = list.findIndex((t) => t.id === id);
          if (idx !== -1) list.splice(idx, 1);
        }
        if ((count ?? 0) > 0) return true;
        if (isInMemoryFallbackAllowed()) return true;
        return false;
      }
      handleSupabaseFailure("deleteTask", error);
    } catch (err: any) {
      handleSupabaseFailure("deleteTask", err);
    }
  } else {
    handleSupabaseFailure("deleteTask", new Error("Supabase client is not configured"));
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
    caseId: r.caseId ?? r.case_id ?? null,
    assignedLawyerId: r.assignedLawyerId ?? r.assigned_lawyer_id ?? null,
    createdBy: r.createdBy ?? r.created_by ?? null,
    createdAt: r.createdAt ?? r.created_at,
    updatedAt: r.updatedAt ?? r.updated_at,
    ...(r.clientId || r.client_id ? { client_id: r.clientId ?? r.client_id } : {}),
    ...(r.caseId || r.case_id ? { case_id: r.caseId ?? r.case_id } : {}),
    ...(r.assignedLawyerId || r.assigned_lawyer_id ? { assigned_lawyer_id: r.assignedLawyerId ?? r.assigned_lawyer_id } : {}),
    ...(r.createdBy || r.created_by ? { created_by: r.createdBy ?? r.created_by } : {}),
  } as any;
}

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
        if (isInMemoryFallbackAllowed()) {
          const mem = memoryPoa.get(officeId) || [];
          if (mem.length > 0) {
            const dbIds = new Set(data.map((d: any) => d.id));
            const extra = mem.filter((m) => !dbIds.has(m.id)).map(formatPoa);
            return [...data.map(formatPoa), ...extra];
          }
        }
        return data.map(formatPoa);
      }
      if (error) {
        handleSupabaseFailure("listPoa", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("listPoa", err);
    }
  } else {
    handleSupabaseFailure("listPoa", new Error("Supabase client is not configured"));
  }

  return (memoryPoa.get(officeId) || []).map(formatPoa);
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
        return formatPoa(data);
      }
      if (error && error.code === "PGRST116") {
        if (isInMemoryFallbackAllowed()) {
          const memList = memoryPoa.get(officeId) || [];
          const fromMem = memList.find((item) => item.id === id);
          if (fromMem) return formatPoa(fromMem);
        }
        return null;
      }
      if (error) {
        handleSupabaseFailure("getPoaById", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("getPoaById", err);
    }
  } else {
    handleSupabaseFailure("getPoaById", new Error("Supabase client is not configured"));
  }

  const memList = memoryPoa.get(officeId) || [];
  const fromMem = memList.find((item) => item.id === id);
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
    caseId?: string | null;
    assignedLawyerId?: string | null;
    createdBy?: string | null;
  },
  officeId: string,
): Promise<PoaRecord> {
  const days = data.daysRemaining ?? calcDaysFromHijri(data.expiryDateHijri || "");
  const now = new Date().toISOString();
  const clientId = data.clientId || (data as any).client_id || null;
  const caseId = data.caseId || (data as any).case_id || null;
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
            case_id: caseId,
            assigned_lawyer_id: assignedLawyerId,
            created_by: createdBy,
          },
        ])
        .select()
        .single();

      if (!error && inserted) {
        const formatted = formatPoa(inserted);
        if (isInMemoryFallbackAllowed()) {
          const list = memoryPoa.get(officeId) || [];
          list.unshift(formatted);
          memoryPoa.set(officeId, list);
        }
        return formatted;
      }
      if (error) {
        handleSupabaseFailure("createPoa", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("createPoa", err);
    }
  } else {
    handleSupabaseFailure("createPoa", new Error("Supabase client is not configured"));
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
    caseId,
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
      if (data.caseId !== undefined) updatePayload.case_id = data.caseId;
      if ((data as any).case_id !== undefined) updatePayload.case_id = (data as any).case_id;
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
        const formatted = formatPoa(updated);
        if (isInMemoryFallbackAllowed()) {
          const list = memoryPoa.get(officeId) || [];
          const idx = list.findIndex((p) => p.id === id);
          if (idx !== -1) list[idx] = { ...list[idx], ...formatted };
        }
        return formatted;
      }
      if (error && error.code === "PGRST116") {
        if (!isInMemoryFallbackAllowed()) return null;
      }
      if (error && error.code !== "PGRST116") {
        handleSupabaseFailure("updatePoa", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("updatePoa", err);
    }
  } else {
    handleSupabaseFailure("updatePoa", new Error("Supabase client is not configured"));
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
    caseId: data.caseId !== undefined ? data.caseId : (data as any).case_id !== undefined ? (data as any).case_id : current.caseId,
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
      if (!error) {
        if (isInMemoryFallbackAllowed()) {
          const list = memoryPoa.get(officeId) || [];
          const idx = list.findIndex((p) => p.id === id);
          if (idx !== -1) list.splice(idx, 1);
        }
        if ((count ?? 0) > 0) return true;
        if (isInMemoryFallbackAllowed()) return true;
        return false;
      }
      handleSupabaseFailure("deletePoa", error);
    } catch (err: any) {
      handleSupabaseFailure("deletePoa", err);
    }
  } else {
    handleSupabaseFailure("deletePoa", new Error("Supabase client is not configured"));
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
    caseId: r.caseId ?? r.case_id ?? null,
    assignedLawyerId: r.assignedLawyerId ?? r.assigned_lawyer_id ?? null,
    clientRole: r.clientRole ?? r.client_role ?? null,
    createdBy: r.createdBy ?? r.created_by ?? null,
    createdAt: r.createdAt ?? r.created_at,
    updatedAt: r.updatedAt ?? r.updated_at,
    ...(r.clientId || r.client_id ? { client_id: r.clientId ?? r.client_id } : {}),
    ...(r.caseId || r.case_id ? { case_id: r.caseId ?? r.case_id } : {}),
    ...(r.assignedLawyerId || r.assigned_lawyer_id ? { assigned_lawyer_id: r.assignedLawyerId ?? r.assigned_lawyer_id } : {}),
    ...(r.clientRole || r.client_role ? { client_role: r.clientRole ?? r.client_role } : {}),
    ...(r.createdBy || r.created_by ? { created_by: r.createdBy ?? r.created_by } : {}),
  } as any;
}

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
        if (isInMemoryFallbackAllowed()) {
          const mem = memoryJudgments.get(officeId) || [];
          if (mem.length > 0) {
            const dbIds = new Set(data.map((d: any) => d.id));
            const extra = mem.filter((m) => !dbIds.has(m.id)).map(formatJudgment);
            return [...data.map(formatJudgment), ...extra];
          }
        }
        return data.map(formatJudgment);
      }
      if (error) {
        handleSupabaseFailure("listJudgments", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("listJudgments", err);
    }
  } else {
    handleSupabaseFailure("listJudgments", new Error("Supabase client is not configured"));
  }

  return (memoryJudgments.get(officeId) || []).map(formatJudgment);
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
        return formatJudgment(data);
      }
      if (error && error.code === "PGRST116") {
        if (isInMemoryFallbackAllowed()) {
          const memList = memoryJudgments.get(officeId) || [];
          const fromMem = memList.find((item) => item.id === id);
          if (fromMem) return formatJudgment(fromMem);
        }
        return null;
      }
      if (error) {
        handleSupabaseFailure("getJudgmentById", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("getJudgmentById", err);
    }
  } else {
    handleSupabaseFailure("getJudgmentById", new Error("Supabase client is not configured"));
  }

  const memList = memoryJudgments.get(officeId) || [];
  const fromMem = memList.find((item) => item.id === id);
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
  const caseId = (data as any).caseId || (data as any).case_id || null;
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
            case_id: caseId,
            assigned_lawyer_id: assignedLawyerId,
            client_role: clientRole,
            created_by: createdBy,
          },
        ])
        .select()
        .single();

      if (!error && inserted) {
        const formatted = formatJudgment(inserted);
        if (isInMemoryFallbackAllowed()) {
          const list = memoryJudgments.get(officeId) || [];
          list.unshift(formatted);
          memoryJudgments.set(officeId, list);
        }
        return formatted;
      }
      if (error) {
        handleSupabaseFailure("createJudgment", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("createJudgment", err);
    }
  } else {
    handleSupabaseFailure("createJudgment", new Error("Supabase client is not configured"));
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
    caseId,
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
      if (data.caseId !== undefined) updatePayload.case_id = data.caseId;
      if ((data as any).case_id !== undefined) updatePayload.case_id = (data as any).case_id;
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
        const formatted = formatJudgment(updated);
        if (isInMemoryFallbackAllowed()) {
          const list = memoryJudgments.get(officeId) || [];
          const idx = list.findIndex((j) => j.id === id);
          if (idx !== -1) list[idx] = { ...list[idx], ...formatted };
        }
        return formatted;
      }
      if (error && error.code === "PGRST116") {
        if (!isInMemoryFallbackAllowed()) return null;
      }
      if (error && error.code !== "PGRST116") {
        handleSupabaseFailure("updateJudgment", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("updateJudgment", err);
    }
  } else {
    handleSupabaseFailure("updateJudgment", new Error("Supabase client is not configured"));
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
    caseId: data.caseId !== undefined ? data.caseId : (data as any).case_id !== undefined ? (data as any).case_id : current.caseId,
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
      if (!error) {
        if (isInMemoryFallbackAllowed()) {
          const list = memoryJudgments.get(officeId) || [];
          const idx = list.findIndex((j) => j.id === id);
          if (idx !== -1) list.splice(idx, 1);
        }
        if ((count ?? 0) > 0) return true;
        if (isInMemoryFallbackAllowed()) return true;
        return false;
      }
      handleSupabaseFailure("deleteJudgment", error);
    } catch (err: any) {
      handleSupabaseFailure("deleteJudgment", err);
    }
  } else {
    handleSupabaseFailure("deleteJudgment", new Error("Supabase client is not configured"));
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
      const { count: totalCount, error: countErr } = await client
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("office_id", officeId)
        .eq("user_id", userId);

      if (countErr) {
        handleSupabaseFailure("listNotifications:totalCount", countErr);
      }

      const { count: unreadCount, error: unreadErr } = await client
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("office_id", officeId)
        .eq("user_id", userId)
        .eq("is_read", false);

      if (unreadErr) {
        handleSupabaseFailure("listNotifications:unreadCount", unreadErr);
      }

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
      if (error) {
        handleSupabaseFailure("listNotifications", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("listNotifications", err);
    }
  } else {
    handleSupabaseFailure("listNotifications", new Error("Supabase client is not configured"));
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
        if (isInMemoryFallbackAllowed()) {
          const officeList = memoryNotifications.get(data.officeId) || [];
          officeList.unshift(formatted);
          memoryNotifications.set(data.officeId, officeList);
        }
        return formatted;
      }
      if (error) {
        handleSupabaseFailure("createNotification", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("createNotification", err);
    }
  } else {
    handleSupabaseFailure("createNotification", new Error("Supabase client is not configured"));
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
      if (error) {
        handleSupabaseFailure("markNotificationRead", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("markNotificationRead", err);
    }
  } else {
    handleSupabaseFailure("markNotificationRead", new Error("Supabase client is not configured"));
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
      if (error) {
        handleSupabaseFailure("markAllNotificationsRead", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("markAllNotificationsRead", err);
    }
  } else {
    handleSupabaseFailure("markAllNotificationsRead", new Error("Supabase client is not configured"));
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
      if (error) {
        handleSupabaseFailure("hasRecentNotification", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("hasRecentNotification", err);
    }
  } else {
    handleSupabaseFailure("hasRecentNotification", new Error("Supabase client is not configured"));
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

// ============================================================================
// Attachments (Supabase table: attachments)
// ============================================================================

function formatAttachment(row: any): AttachmentRecord {
  return {
    id: row.id,
    officeId: row.officeId ?? row.office_id,
    uploadedBy: row.uploadedBy ?? row.uploaded_by,
    fileName: row.fileName ?? row.file_name,
    filePath: row.filePath ?? row.file_path,
    fileSize: Number(row.fileSize ?? row.file_size ?? 0),
    mimeType: row.mimeType ?? row.mime_type,
    relatedRecordType: row.relatedRecordType ?? row.related_record_type,
    relatedRecordId: String(row.relatedRecordId ?? row.related_record_id),
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    uploaderName: row.uploaderName ?? row.uploader_name,
  };
}

export async function createAttachment(data: {
  officeId: string;
  uploadedBy: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  relatedRecordType: 'client' | 'poa' | 'judgment' | 'session' | 'task' | 'case';
  relatedRecordId: string;
  uploaderName?: string;
}): Promise<AttachmentRecord> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const record: AttachmentRecord = {
    id,
    officeId: data.officeId,
    uploadedBy: data.uploadedBy,
    fileName: data.fileName,
    filePath: data.filePath,
    fileSize: data.fileSize,
    mimeType: data.mimeType,
    relatedRecordType: data.relatedRecordType,
    relatedRecordId: String(data.relatedRecordId),
    createdAt: now,
    uploaderName: data.uploaderName,
  };

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data: inserted, error } = await client
        .from("attachments")
        .insert([
          {
            id: record.id,
            office_id: record.officeId,
            uploaded_by: record.uploadedBy,
            file_name: record.fileName,
            file_path: record.filePath,
            file_size: record.fileSize,
            mime_type: record.mimeType,
            related_record_type: record.relatedRecordType,
            related_record_id: record.relatedRecordId,
            created_at: record.createdAt,
          },
        ])
        .select()
        .single();

      if (!error && inserted) {
        const formatted = formatAttachment({ ...inserted, uploaderName: data.uploaderName });
        if (isInMemoryFallbackAllowed()) {
          const list = memoryAttachments.get(data.officeId) || [];
          list.unshift(formatted);
          memoryAttachments.set(data.officeId, list);
        }
        return formatted;
      }
      if (error) {
        handleSupabaseFailure("createAttachment", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("createAttachment", err);
    }
  } else {
    handleSupabaseFailure("createAttachment", new Error("Supabase client is not configured"));
  }

  const list = memoryAttachments.get(data.officeId) || [];
  list.unshift(record);
  memoryAttachments.set(data.officeId, list);
  return record;
}

export async function listAttachments(
  officeId: string,
  relatedRecordType: string,
  relatedRecordId: string,
): Promise<AttachmentRecord[]> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("attachments")
        .select("*")
        .eq("office_id", officeId)
        .eq("related_record_type", relatedRecordType)
        .eq("related_record_id", String(relatedRecordId))
        .order("created_at", { ascending: false });

      if (!error && data) {
        return data.map(formatAttachment);
      }
      if (error) {
        handleSupabaseFailure("listAttachments", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("listAttachments", err);
    }
  } else {
    handleSupabaseFailure("listAttachments", new Error("Supabase client is not configured"));
  }

  const list = memoryAttachments.get(officeId) || [];
  return list
    .filter(
      (a) =>
        a.relatedRecordType === relatedRecordType &&
        String(a.relatedRecordId) === String(relatedRecordId),
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getAttachmentById(
  id: string,
  officeId: string,
): Promise<AttachmentRecord | null> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("attachments")
        .select("*")
        .eq("id", id)
        .eq("office_id", officeId)
        .single();

      if (!error && data) {
        return formatAttachment(data);
      }
      if (error && error.code === "PGRST116") {
        if (!isInMemoryFallbackAllowed()) return null;
      }
      if (error) {
        handleSupabaseFailure("getAttachmentById", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("getAttachmentById", err);
    }
  } else {
    handleSupabaseFailure("getAttachmentById", new Error("Supabase client is not configured"));
  }

  const list = memoryAttachments.get(officeId) || [];
  const found = list.find((a) => a.id === id);
  return found || null;
}

export async function deleteAttachment(id: string, officeId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error, count } = await client
        .from("attachments")
        .delete({ count: "exact" })
        .eq("id", id)
        .eq("office_id", officeId);

      if (!error) {
        if (isInMemoryFallbackAllowed()) {
          const list = memoryAttachments.get(officeId) || [];
          const updated = list.filter((a) => a.id !== id);
          memoryAttachments.set(officeId, updated);
        }
        return (count ?? 0) > 0;
      }
      handleSupabaseFailure("deleteAttachment", error);
    } catch (err: any) {
      handleSupabaseFailure("deleteAttachment", err);
    }
  } else {
    handleSupabaseFailure("deleteAttachment", new Error("Supabase client is not configured"));
  }

  const list = memoryAttachments.get(officeId) || [];
  const updated = list.filter((a) => a.id !== id);
  memoryAttachments.set(officeId, updated);

  return list.length !== updated.length;
}

// ============================================================================
// 9. GLOBAL SEARCH
// ============================================================================

export async function searchClients(officeId: string, query: string): Promise<ClientRecord[]> {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  const client = getSupabaseClient();
  if (client) {
    try {
      const sanitized = term.replace(/[%_,()]/g, " ").trim();
      let dbQuery = client.from("clients").select("*").eq("office_id", officeId);
      if (sanitized) {
        dbQuery = dbQuery.or(`name.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`);
      }
      const { data, error } = await dbQuery.order("created_at", { ascending: false }).limit(50);
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
      if (error) {
        handleSupabaseFailure("searchClients", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("searchClients", err);
    }
  } else {
    handleSupabaseFailure("searchClients", new Error("Supabase client is not configured"));
  }

  const memMatches = (memoryClients.get(officeId) || []).filter(
    (c) => (c.name && c.name.toLowerCase().includes(term)) || (c.phone && c.phone.toLowerCase().includes(term)),
  );
  return memMatches;
}

export async function searchSessions(officeId: string, query: string): Promise<Session[]> {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  const client = getSupabaseClient();
  if (client) {
    try {
      const sanitized = term.replace(/[%_,()]/g, " ").trim();
      let dbQuery = client.from("sessions").select("*").eq("office_id", officeId);
      if (sanitized) {
        dbQuery = dbQuery.or(`case_number.ilike.%${sanitized}%,plaintiff.ilike.%${sanitized}%,defendant.ilike.%${sanitized}%`);
      }
      const { data, error } = await dbQuery.order("id", { ascending: false }).limit(50);
      if (!error && data) {
        if (isInMemoryFallbackAllowed()) {
          const memMatches = (memorySessions.get(officeId) || [])
            .filter(
              (s) =>
                (s.caseNumber && s.caseNumber.toLowerCase().includes(term)) ||
                (s.plaintiff && s.plaintiff.toLowerCase().includes(term)) ||
                (s.defendant && s.defendant.toLowerCase().includes(term)),
            )
            .map(formatSession);
          const dbIds = new Set(data.map((d: any) => d.id));
          const extra = memMatches.filter((m) => !dbIds.has(m.id));
          return [...data.map(formatSession), ...extra];
        }
        return data.map(formatSession);
      }
      if (error) {
        handleSupabaseFailure("searchSessions", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("searchSessions", err);
    }
  } else {
    handleSupabaseFailure("searchSessions", new Error("Supabase client is not configured"));
  }

  const memMatches = (memorySessions.get(officeId) || [])
    .filter(
      (s) =>
        (s.caseNumber && s.caseNumber.toLowerCase().includes(term)) ||
        (s.plaintiff && s.plaintiff.toLowerCase().includes(term)) ||
        (s.defendant && s.defendant.toLowerCase().includes(term)),
    )
    .map(formatSession);
  return memMatches;
}

export async function searchPoa(officeId: string, query: string): Promise<PoaRecord[]> {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  const client = getSupabaseClient();
  if (client) {
    try {
      const sanitized = term.replace(/[%_,()]/g, " ").trim();
      let dbQuery = client.from("poa").select("*").eq("office_id", officeId);
      if (sanitized) {
        dbQuery = dbQuery.or(`client_name.ilike.%${sanitized}%,poa_number.ilike.%${sanitized}%`);
      }
      const { data, error } = await dbQuery.order("id", { ascending: false }).limit(50);
      if (!error && data) {
        if (isInMemoryFallbackAllowed()) {
          const memMatches = (memoryPoa.get(officeId) || [])
            .filter(
              (p) =>
                (p.clientName && p.clientName.toLowerCase().includes(term)) ||
                (p.poaNumber && p.poaNumber.toLowerCase().includes(term)),
            )
            .map(formatPoa);
          const dbIds = new Set(data.map((d: any) => d.id));
          const extra = memMatches.filter((m) => !dbIds.has(m.id));
          return [...data.map(formatPoa), ...extra];
        }
        return data.map(formatPoa);
      }
      if (error) {
        handleSupabaseFailure("searchPoa", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("searchPoa", err);
    }
  } else {
    handleSupabaseFailure("searchPoa", new Error("Supabase client is not configured"));
  }

  const memMatches = (memoryPoa.get(officeId) || [])
    .filter(
      (p) =>
        (p.clientName && p.clientName.toLowerCase().includes(term)) ||
        (p.poaNumber && p.poaNumber.toLowerCase().includes(term)),
    )
    .map(formatPoa);
  return memMatches;
}

export async function searchJudgments(officeId: string, query: string): Promise<JudgmentRecord[]> {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  const client = getSupabaseClient();
  if (client) {
    try {
      const sanitized = term.replace(/[%_,()]/g, " ").trim();
      let dbQuery = client.from("judgments").select("*").eq("office_id", officeId);
      if (sanitized) {
        dbQuery = dbQuery.or(`case_number.ilike.%${sanitized}%,plaintiff.ilike.%${sanitized}%,defendant.ilike.%${sanitized}%`);
      }
      const { data, error } = await dbQuery.order("id", { ascending: false }).limit(50);
      if (!error && data) {
        if (isInMemoryFallbackAllowed()) {
          const memMatches = (memoryJudgments.get(officeId) || [])
            .filter(
              (j) =>
                (j.caseNumber && j.caseNumber.toLowerCase().includes(term)) ||
                (j.plaintiff && j.plaintiff.toLowerCase().includes(term)) ||
                (j.defendant && j.defendant.toLowerCase().includes(term)),
            )
            .map(formatJudgment);
          const dbIds = new Set(data.map((d: any) => d.id));
          const extra = memMatches.filter((m) => !dbIds.has(m.id));
          return [...data.map(formatJudgment), ...extra];
        }
        return data.map(formatJudgment);
      }
      if (error) {
        handleSupabaseFailure("searchJudgments", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("searchJudgments", err);
    }
  } else {
    handleSupabaseFailure("searchJudgments", new Error("Supabase client is not configured"));
  }

  const memMatches = (memoryJudgments.get(officeId) || [])
    .filter(
      (j) =>
        (j.caseNumber && j.caseNumber.toLowerCase().includes(term)) ||
        (j.plaintiff && j.plaintiff.toLowerCase().includes(term)) ||
        (j.defendant && j.defendant.toLowerCase().includes(term)),
    )
    .map(formatJudgment);
  return memMatches;
}

export async function searchTasks(officeId: string, query: string): Promise<TaskRecord[]> {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  const client = getSupabaseClient();
  if (client) {
    try {
      const sanitized = term.replace(/[%_,()]/g, " ").trim();
      let dbQuery = client.from("tasks").select("*").eq("office_id", officeId);
      if (sanitized) {
        dbQuery = dbQuery.ilike("title", `%${sanitized}%`);
      }
      const { data, error } = await dbQuery.order("id", { ascending: false }).limit(50);
      if (!error && data) {
        if (isInMemoryFallbackAllowed()) {
          const memMatches = (memoryTasks.get(officeId) || [])
            .filter((t) => t.title && t.title.toLowerCase().includes(term))
            .map(formatTask);
          const dbIds = new Set(data.map((d: any) => d.id));
          const extra = memMatches.filter((m) => !dbIds.has(m.id));
          return [...data.map(formatTask), ...extra];
        }
        return data.map(formatTask);
      }
      if (error) {
        handleSupabaseFailure("searchTasks", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("searchTasks", err);
    }
  } else {
    handleSupabaseFailure("searchTasks", new Error("Supabase client is not configured"));
  }

  const memMatches = (memoryTasks.get(officeId) || [])
    .filter((t) => t.title && t.title.toLowerCase().includes(term))
    .map(formatTask);
  return memMatches;
}

// ============================================================================
// 10. CLIENT ACTIVITY NOTES
// ============================================================================

export async function listClientNotes(clientId: string, officeId: string): Promise<ClientNoteRecord[]> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("client_notes")
        .select("*")
        .eq("office_id", officeId)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        return data.map((r: any) => ({
          id: r.id,
          officeId: r.office_id,
          clientId: r.client_id,
          authorId: r.author_id,
          body: r.body,
          createdAt: r.created_at,
        }));
      }
      if (error) {
        handleSupabaseFailure("listClientNotes", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("listClientNotes", err);
    }
  } else {
    handleSupabaseFailure("listClientNotes", new Error("Supabase client is not configured"));
  }

  const memList = (memoryClientNotes.get(officeId) || []).filter((n) => n.clientId === clientId);
  return [...memList].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createClientNote(data: {
  clientId: string;
  officeId: string;
  authorId: string;
  body: string;
}): Promise<ClientNoteRecord> {
  const noteId = crypto.randomUUID ? crypto.randomUUID() : `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const newNote: ClientNoteRecord = {
    id: noteId,
    officeId: data.officeId,
    clientId: data.clientId,
    authorId: data.authorId,
    body: data.body,
    createdAt: now,
  };

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data: dbData, error } = await client
        .from("client_notes")
        .insert({
          id: noteId,
          office_id: data.officeId,
          client_id: data.clientId,
          author_id: data.authorId,
          body: data.body,
          created_at: now,
        })
        .select()
        .single();

      if (!error && dbData) {
        const result: ClientNoteRecord = {
          id: dbData.id,
          officeId: data.officeId,
          clientId: data.clientId,
          authorId: data.authorId,
          body: data.body,
          createdAt: dbData.created_at,
        };
        if (isInMemoryFallbackAllowed()) {
          const existing = memoryClientNotes.get(data.officeId) || [];
          existing.unshift(result);
          memoryClientNotes.set(data.officeId, existing);
        }
        return result;
      }
      if (error) {
        handleSupabaseFailure("createClientNote", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("createClientNote", err);
    }
  } else {
    handleSupabaseFailure("createClientNote", new Error("Supabase client is not configured"));
  }

  const existing = memoryClientNotes.get(data.officeId) || [];
  existing.unshift(newNote);
  memoryClientNotes.set(data.officeId, existing);

  return newNote;
}

// ============================================================================
// CASES (Central Case Entity)
// ============================================================================

function formatCase(r: any): CaseRecord {
  return {
    id: String(r.id),
    officeId: r.officeId ?? r.office_id,
    clientId: String(r.clientId ?? r.client_id),
    caseNumber: String(r.caseNumber ?? r.case_number ?? ""),
    caseType: String(r.caseType ?? r.case_type ?? ""),
    court: String(r.court ?? ""),
    assignedLawyerId: r.assignedLawyerId ?? r.assigned_lawyer_id ?? null,
    status: (r.status === "closed" || r.status === "postponed" ? r.status : "open") as "open" | "closed" | "postponed",
    opposingParty: r.opposingParty ?? r.opposing_party ?? null,
    createdBy: r.createdBy ?? r.created_by ?? null,
    createdAt: r.createdAt ?? r.created_at ?? new Date().toISOString(),
    updatedAt: r.updatedAt ?? r.updated_at ?? new Date().toISOString(),
    clientName: r.clientName ?? r.client_name,
    assignedLawyerName: r.assignedLawyerName ?? r.assigned_lawyer_name,
  };
}

export async function listCases(
  officeId: string,
  filters?: {
    status?: string;
    court?: string;
    clientId?: string;
    caseNumber?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<CaseRecord[]> {
  let allCases: CaseRecord[] = [];

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("cases")
        .select("*")
        .eq("office_id", officeId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        allCases = data.map(formatCase);
      } else if (error) {
        handleSupabaseFailure("listCases", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("listCases", err);
    }
  } else {
    handleSupabaseFailure("listCases", new Error("Supabase client is not configured"));
  }

  if (allCases.length === 0 && isInMemoryFallbackAllowed()) {
    allCases = (memoryCases.get(officeId) || []).map(formatCase);
  }

  // Resolve client names
  const clients = await listClients(officeId);
  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  let result = allCases.map((c) => ({
    ...c,
    clientName: c.clientName || clientMap.get(c.clientId) || "—",
  }));

  // Apply filters
  if (filters?.status && filters.status !== "all") {
    result = result.filter((c) => c.status === filters.status);
  }
  if (filters?.court && filters.court !== "all") {
    result = result.filter((c) => c.court.toLowerCase().includes(filters.court!.toLowerCase()));
  }
  if (filters?.clientId && filters.clientId !== "all") {
    result = result.filter((c) => c.clientId === filters.clientId);
  }
  if (filters?.caseNumber) {
    const q = filters.caseNumber.toLowerCase();
    result = result.filter(
      (c) =>
        c.caseNumber.toLowerCase().includes(q) ||
        (c.clientName && c.clientName.toLowerCase().includes(q)) ||
        (c.opposingParty && c.opposingParty.toLowerCase().includes(q)) ||
        c.caseType.toLowerCase().includes(q)
    );
  }
  if (filters?.dateFrom) {
    const fromTime = new Date(filters.dateFrom).getTime();
    result = result.filter((c) => new Date(c.createdAt).getTime() >= fromTime);
  }
  if (filters?.dateTo) {
    const toTime = new Date(filters.dateTo).getTime() + 24 * 60 * 60 * 1000;
    result = result.filter((c) => new Date(c.createdAt).getTime() <= toTime);
  }

  return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getCaseById(id: string, officeId: string): Promise<CaseRecord | null> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("cases")
        .select("*")
        .eq("id", id)
        .eq("office_id", officeId)
        .single();

      if (!error && data) {
        return formatCase(data);
      }
      if (error && error.code === "PGRST116") {
        if (!isInMemoryFallbackAllowed()) return null;
      }
      if (error) {
        handleSupabaseFailure("getCaseById", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("getCaseById", err);
    }
  } else {
    handleSupabaseFailure("getCaseById", new Error("Supabase client is not configured"));
  }

  const memList = memoryCases.get(officeId) || [];
  const fromMem = memList.find((c) => c.id === id);
  return fromMem ? formatCase(fromMem) : null;
}

export async function createCase(
  data: {
    clientId: string;
    caseNumber: string;
    caseType?: string;
    court?: string;
    assignedLawyerId?: string | null;
    status?: "open" | "closed" | "postponed";
    opposingParty?: string | null;
    createdBy?: string | null;
  },
  officeId: string
): Promise<CaseRecord> {
  const id = crypto.randomUUID ? crypto.randomUUID() : `case-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const status = data.status || "open";

  const record: CaseRecord = {
    id,
    officeId,
    clientId: data.clientId,
    caseNumber: data.caseNumber,
    caseType: data.caseType || "",
    court: data.court || "",
    assignedLawyerId: data.assignedLawyerId || null,
    status,
    opposingParty: data.opposingParty || null,
    createdBy: data.createdBy || null,
    createdAt: now,
    updatedAt: now,
  };

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data: inserted, error } = await client
        .from("cases")
        .insert({
          id,
          office_id: officeId,
          client_id: data.clientId,
          case_number: data.caseNumber,
          case_type: data.caseType || "",
          court: data.court || "",
          assigned_lawyer_id: data.assignedLawyerId || null,
          status,
          opposing_party: data.opposingParty || null,
          created_by: data.createdBy || null,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (!error && inserted) {
        const formatted = formatCase(inserted);
        if (isInMemoryFallbackAllowed()) {
          const list = memoryCases.get(officeId) || [];
          list.unshift(record);
          memoryCases.set(officeId, list);
        }
        return formatted;
      }
      if (error) {
        handleSupabaseFailure("createCase", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("createCase", err);
    }
  } else {
    handleSupabaseFailure("createCase", new Error("Supabase client is not configured"));
  }

  const list = memoryCases.get(officeId) || [];
  list.unshift(record);
  memoryCases.set(officeId, list);
  return record;
}

export async function updateCase(
  id: string,
  data: Partial<Omit<CaseRecord, "id" | "officeId">>,
  officeId: string
): Promise<CaseRecord | null> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (data.caseNumber !== undefined) updatePayload.case_number = data.caseNumber;
      if (data.caseType !== undefined) updatePayload.case_type = data.caseType;
      if (data.court !== undefined) updatePayload.court = data.court;
      if (data.status !== undefined) updatePayload.status = data.status;
      if (data.opposingParty !== undefined) updatePayload.opposing_party = data.opposingParty;
      if (data.clientId !== undefined) updatePayload.client_id = data.clientId;
      if (data.assignedLawyerId !== undefined) updatePayload.assigned_lawyer_id = data.assignedLawyerId;

      const { data: updated, error } = await client
        .from("cases")
        .update(updatePayload)
        .eq("id", id)
        .eq("office_id", officeId)
        .select()
        .single();

      if (!error && updated) {
        const formatted = formatCase(updated);
        if (isInMemoryFallbackAllowed()) {
          const list = memoryCases.get(officeId) || [];
          const idx = list.findIndex((c) => c.id === id);
          if (idx !== -1) list[idx] = { ...list[idx], ...formatted };
        }
        return formatted;
      }
      if (error && error.code === "PGRST116") {
        if (!isInMemoryFallbackAllowed()) return null;
      }
      if (error) {
        handleSupabaseFailure("updateCase", error);
      }
    } catch (err: any) {
      handleSupabaseFailure("updateCase", err);
    }
  } else {
    handleSupabaseFailure("updateCase", new Error("Supabase client is not configured"));
  }

  const list = memoryCases.get(officeId) || [];
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return null;

  const current = list[idx];
  const updatedRecord: CaseRecord = {
    ...current,
    caseNumber: data.caseNumber !== undefined ? data.caseNumber : current.caseNumber,
    caseType: data.caseType !== undefined ? data.caseType : current.caseType,
    court: data.court !== undefined ? data.court : current.court,
    status: data.status !== undefined ? data.status : current.status,
    opposingParty: data.opposingParty !== undefined ? data.opposingParty : current.opposingParty,
    clientId: data.clientId !== undefined ? data.clientId : current.clientId,
    assignedLawyerId: data.assignedLawyerId !== undefined ? data.assignedLawyerId : current.assignedLawyerId,
    updatedAt: new Date().toISOString(),
  };

  list[idx] = updatedRecord;
  return updatedRecord;
}

export async function reassignCase(
  id: string,
  assignedLawyerId: string | null,
  officeId: string
): Promise<CaseRecord | null> {
  return updateCase(id, { assignedLawyerId }, officeId);
}

export async function deleteCase(id: string, officeId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error, count } = await client
        .from("cases")
        .delete({ count: "exact" })
        .eq("id", id)
        .eq("office_id", officeId);
      if (!error) {
        if (isInMemoryFallbackAllowed()) {
          const list = memoryCases.get(officeId) || [];
          const idx = list.findIndex((c) => c.id === id);
          if (idx !== -1) list.splice(idx, 1);
        }
        return (count ?? 0) > 0;
      }
      handleSupabaseFailure("deleteCase", error);
    } catch (err: any) {
      handleSupabaseFailure("deleteCase", err);
    }
  } else {
    handleSupabaseFailure("deleteCase", new Error("Supabase client is not configured"));
  }

  const list = memoryCases.get(officeId) || [];
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  return true;
}

export async function getCaseDetail(
  id: string,
  officeId: string
): Promise<{
  case: CaseRecord;
  client: ClientRecord | null;
  sessions: Session[];
  judgments: JudgmentRecord[];
  attachments: AttachmentRecord[];
} | null> {
  const caseRecord = await getCaseById(id, officeId);
  if (!caseRecord) return null;

  const [allSessions, allJudgments, allAttachments, client] = await Promise.all([
    listSessions(officeId),
    listJudgments(officeId),
    listAttachments(officeId, "case", id),
    caseRecord.clientId ? getClientById(caseRecord.clientId, officeId) : Promise.resolve(null),
  ]);

  const linkedSessions = allSessions
    .filter((s) => {
      const cId = (s as any).caseId || (s as any).case_id;
      return (cId && cId === id) || (s.caseNumber && s.caseNumber === caseRecord.caseNumber);
    })
    .sort((a, b) => {
      const tA = a.hearingAt ? new Date(a.hearingAt).getTime() : 0;
      const tB = b.hearingAt ? new Date(b.hearingAt).getTime() : 0;
      return tA - tB;
    });

  const linkedJudgments = allJudgments.filter((j) => {
    const cId = (j as any).caseId || (j as any).case_id;
    return (cId && cId === id) || (j.caseNumber && j.caseNumber === caseRecord.caseNumber);
  });

  return {
    case: {
      ...caseRecord,
      clientName: client ? client.name : caseRecord.clientName || "—",
    },
    client,
    sessions: linkedSessions,
    judgments: linkedJudgments,
    attachments: allAttachments,
  };
}

export async function getCaseStats(
  officeId: string,
  filterRecords?: (c: CaseRecord) => boolean
): Promise<{ total: number; open: number; closed: number; postponed: number }> {
  let cases = await listCases(officeId);
  if (filterRecords) {
    cases = cases.filter(filterRecords);
  }

  let open = 0;
  let closed = 0;
  let postponed = 0;

  for (const c of cases) {
    if (c.status === "closed") closed++;
    else if (c.status === "postponed") postponed++;
    else open++;
  }

  return {
    total: cases.length,
    open,
    closed,
    postponed,
  };
}






