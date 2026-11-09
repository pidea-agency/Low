import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  User,
  FileKey,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Search,
  Edit3,
  Sparkles,
  Loader2,
  RefreshCw,
  UserCog,
  Paperclip,
  Link as LinkIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useGetCurrentUser } from '@workspace/api-client-react';
import { ClientPicker } from '@/components/clients/client-picker';
import { LawyerSelect } from '@/components/clients/lawyer-select';
import { ReassignDialog } from '@/components/clients/reassign-dialog';
import { TablePagination } from '@/components/ui/table-pagination';
import { AttachmentsPanel } from '@/components/attachments/attachments-panel';
import moment from 'moment-hijri';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';

export interface PowerOfAttorney {
  id: string;
  sheetRowId?: number;
  clientName?: string;
  poaNumber: string;
  issueDateHijri: string;
  expiryDateHijri: string;
  daysRemaining: number;
  notes?: string;
  createdAt: string;
  clientId?: string | null;
  client_id?: string | null;
  assignedLawyerId?: string | null;
  assigned_lawyer_id?: string | null;
  assignedLawyer?: string;
  assigned_lawyer?: string;
}

export type HijriDateValidation =
  | { status: 'empty'; days: 0; message: string }
  | { status: 'invalid'; days: 0; message: string }
  | { status: 'valid'; days: number; message: string };

/**
 * Strictly parses and validates a Hijri date string (DD/MM/YYYY or YYYY/MM/DD).
 * Returns 'invalid' for non-dates like 99/99/1448 instead of 0 days.
 */
export function parseAndValidateHijriDate(hijriDateStr: string): HijriDateValidation {
  if (!hijriDateStr?.trim()) {
    return { status: 'empty', days: 0, message: 'أدخل تاريخ الانتهاء' };
  }
  const parts = hijriDateStr.trim().split(/[\/\.-]/);
  if (parts.length !== 3) {
    return { status: 'invalid', days: 0, message: 'تاريخ غير صالح' };
  }
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

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return { status: 'invalid', days: 0, message: 'تاريخ غير صالح' };
  }
  if (day < 1 || day > 30 || month < 1 || month > 12 || year < 1300 || year > 1550) {
    return { status: 'invalid', days: 0, message: 'تاريخ غير صالح' };
  }

  try {
    const mExpiry = moment(`${year}/${month}/${day}`, 'iYYYY/iM/iD');
    if (!mExpiry.isValid()) {
      return { status: 'invalid', days: 0, message: 'تاريخ غير صالح' };
    }
    const days = mExpiry.diff(moment().startOf('day'), 'days');
    let message = '';
    if (days < 0) {
      message = `منتهية (منذ ${Math.abs(days)} يوم)`;
    } else if (days === 0) {
      message = 'تنتهي اليوم (0 يوم)';
    } else {
      message = `${days} يوم متبقٍ`;
    }
    return { status: 'valid', days, message };
  } catch {
    return { status: 'invalid', days: 0, message: 'تاريخ غير صالح' };
  }
}

/**
 * Calculates days remaining from a Hijri date string (DD/MM/YYYY).
 */
function calculateDaysRemainingFromHijri(hijriDateStr: string): number {
  const result = parseAndValidateHijriDate(hijriDateStr);
  return result.status === 'valid' ? result.days : 0;
}

/** Refresh remaining days on all records based on current date */
function refreshDays(records: PowerOfAttorney[]): PowerOfAttorney[] {
  return records.map((r) => ({
    ...r,
    daysRemaining: r.expiryDateHijri
      ? calculateDaysRemainingFromHijri(r.expiryDateHijri)
      : r.daysRemaining,
  }));
}

export default function PowerOfAttorneyPage() {
  const { toast } = useToast();
  const { data: currentUser, isLoading: isUserLoading } = useGetCurrentUser();
  const userId = currentUser?.id || (currentUser as any)?.userId;
  const officeId = (currentUser as any)?.officeId || userId;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  const [records, setRecords] = useState<PowerOfAttorney[]>([]);
  const [clientsMap, setClientsMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);
  const [isOpen, setIsOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PowerOfAttorney | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PowerOfAttorney | null>(null);
  const [reassignTarget, setReassignTarget] = useState<PowerOfAttorney | null>(null);
  const [attachmentTarget, setAttachmentTarget] = useState<PowerOfAttorney | null>(null);
  const [bindingError, setBindingError] = useState<string | null>(null);

  // Unlinked POAs Triage Dialog state
  const [unlinkedDialogOpen, setUnlinkedDialogOpen] = useState(false);
  const [triageLinking, setTriageLinking] = useState<Record<string, string | null>>({});
  const [triageLawyerLinking, setTriageLawyerLinking] = useState<Record<string, string | null>>({});
  const [savingTriageId, setSavingTriageId] = useState<string | null>(null);

  // Form State
  const [formError, setFormError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [assignedLawyerId, setAssignedLawyerId] = useState<string | null>(null);
  const [poaNumber, setPoaNumber] = useState('');
  const [issueDateHijri, setIssueDateHijri] = useState('');
  const [expiryDateHijri, setExpiryDateHijri] = useState('');
  const [expiryValidation, setExpiryValidation] = useState<HijriDateValidation>({
    status: 'empty',
    days: 0,
    message: 'أدخل تاريخ الانتهاء',
  });
  const [notes, setNotes] = useState('');

  // Recalculate days live as user types expiry date
  useEffect(() => {
    setExpiryValidation(parseAndValidateHijriDate(expiryDateHijri));
  }, [expiryDateHijri]);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const map: Record<string, string> = {};
          data.forEach((c: any) => {
            if (c.id && c.name) map[c.id] = c.name;
          });
          setClientsMap(map);
        }
      }
    } catch (_) {}
  }, []);

  const loadRecords = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsLoading(true);
    try {
      const url = isManualRefresh ? '/api/poa?refresh=true' : '/api/poa';
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        setBindingError(null);
        const data: (PowerOfAttorney & { sheetRowId?: number })[] = await res.json();
        const parsed = data.map((d, idx) => ({
          ...d,
          id: d.id || `poa-${d.sheetRowId ?? idx + 2}`,
          sheetRowId: d.sheetRowId ?? idx + 2,
        }));
        const refreshed = refreshDays(parsed);
        setRecords(refreshed);
        setIsLoading(false);
        return;
      }
      if (res.status === 409) {
        const errJson = await res.json().catch(() => ({}));
        setBindingError(errJson.error || 'ربط المكتب غير مكتمل. تواصل مع المشرف');
        setIsLoading(false);
        return;
      }
      toast({
        title: 'خطأ',
        description: 'فشل تحميل بيانات الوكالات.',
        variant: 'destructive',
      });
    } catch (_) {
      toast({
        title: 'خطأ في الاتصال',
        description: 'تعذر الاتصال بالخادم لتحميل الوكالات.',
        variant: 'destructive',
      });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    if (isUserLoading || !officeId || !userId) return;
    fetchClients();
    loadRecords();
  }, [isUserLoading, officeId, userId, fetchClients, loadRecords]);

  // Derived client name helper
  const getClientDisplayName = useCallback((record: PowerOfAttorney) => {
    const cid = record.clientId || record.client_id;
    if (cid && clientsMap[cid]) {
      return clientsMap[cid];
    }
    return record.clientName || 'عميل غير محدد';
  }, [clientsMap]);

  // ── Form helpers ──────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormError(null);
    setClientId(null);
    setAssignedLawyerId(null);
    setPoaNumber('');
    setIssueDateHijri('');
    setExpiryDateHijri('');
    setExpiryValidation({ status: 'empty', days: 0, message: 'أدخل تاريخ الانتهاء' });
    setNotes('');
    setEditingRecord(null);
  };

  const handleOpenModal = (record?: PowerOfAttorney) => {
    setFormError(null);
    if (record) {
      setEditingRecord(record);
      setClientId(record.clientId || (record as any).client_id || null);
      setAssignedLawyerId(record.assignedLawyerId || (record as any).assigned_lawyer_id || null);
      setPoaNumber(record.poaNumber);
      setIssueDateHijri(record.issueDateHijri);
      setExpiryDateHijri(record.expiryDateHijri);
      setExpiryValidation(parseAndValidateHijriDate(record.expiryDateHijri));
      setNotes(record.notes || '');
    } else {
      resetForm();
    }
    setIsOpen(true);
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!clientId) {
      const msg = 'يرجى اختيار العميل المرتبط بالوكالة.';
      setFormError(msg);
      toast({ title: 'تنبيه', description: msg, variant: 'destructive' });
      return;
    }

    if (!poaNumber.trim()) {
      const msg = 'يرجى إدخال رقم الوكالة.';
      setFormError(msg);
      toast({ title: 'تنبيه', description: msg, variant: 'destructive' });
      return;
    }

    if (expiryDateHijri.trim()) {
      const val = parseAndValidateHijriDate(expiryDateHijri);
      if (val.status === 'invalid') {
        const msg = 'تاريخ الانتهاء الهجري غير صالح. يرجى إدخال تاريخ صحيح مثل (10/01/1448).';
        setFormError(msg);
        toast({
          title: 'تاريخ غير صالح',
          description: msg,
          variant: 'destructive',
        });
        return;
      }
    }

    if (issueDateHijri.trim()) {
      const issueVal = parseAndValidateHijriDate(issueDateHijri);
      if (issueVal.status === 'invalid') {
        const msg = 'تاريخ الإصدار الهجري غير صالح. يرجى إدخال تاريخ صحيح مثل (10/01/1445).';
        setFormError(msg);
        toast({
          title: 'تاريخ غير صالح',
          description: msg,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSaving(true);
    setFormError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const days = calculateDaysRemainingFromHijri(expiryDateHijri);
    const payload = {
      poaNumber: poaNumber.trim(),
      issueDateHijri: issueDateHijri.trim(),
      expiryDateHijri: expiryDateHijri.trim(),
      daysRemaining: days,
      notes: notes.trim(),
      clientId,
      assignedLawyerId: assignedLawyerId || null,
    };

    try {
      let res: Response;
      const targetId = editingRecord?.sheetRowId || editingRecord?.id;
      if (editingRecord && targetId) {
        res = await fetch(`/api/poa/${targetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
          signal: controller.signal,
        });
      } else {
        res = await fetch('/api/poa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
          signal: controller.signal,
        });
      }

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const refIdStr = errorData.refId ? ` رقم المرجع: ${errorData.refId}` : '';
        const errMsg = errorData.error
          ? (errorData.refId && errorData.error.includes(errorData.refId)
              ? errorData.error
              : `${errorData.error}${refIdStr}`)
          : 'فشل حفظ الوكالة، حاول مرة أخرى.';
        throw new Error(errMsg);
      }

      toast({
        title: editingRecord ? 'تم التحديث' : 'تمت الإضافة',
        description: editingRecord ? 'تم تحديث بيانات الوكالة بنجاح.' : 'تم حفظ الوكالة بنجاح.',
      });

      setFormError(null);
      setIsOpen(false);
      resetForm();
      await fetchClients();
      await loadRecords(true);
    } catch (err: any) {
      clearTimeout(timeoutId);
      let message = err.message || 'فشل حفظ الوكالة، حاول مرة أخرى.';
      if (err.name === 'AbortError') {
        message = 'انتهت مهلة حفظ الوكالة (20 ثانية). يرجى المحاولة مرة أخرى.';
      }
      setFormError(message);
      toast({
        title: 'خطأ في حفظ الوكالة',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    const record = deleteTarget;
    setDeleteTarget(null);
    if (!record) return;

    try {
      const id = record.sheetRowId || record.id;
      const res = await fetch(`/api/poa/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      toast({ title: 'تم الحذف', description: 'تم حذف الوكالة بنجاح.' });
      await loadRecords();
    } catch (_) {
      toast({
        title: 'خطأ',
        description: 'فشل حذف الوكالة، حاول مرة أخرى.',
        variant: 'destructive',
      });
    }
  };

  // ── Manual Link for Unlinked POAs ──────────────────────────────────────────

  const handleSaveTriageLink = async (record: PowerOfAttorney) => {
    const targetCid = triageLinking[record.id];
    if (!targetCid) {
      toast({
        title: 'تنبيه',
        description: 'يرجى اختيار العميل أولاً لربطه بالوكالة.',
        variant: 'destructive',
      });
      return;
    }

    setSavingTriageId(record.id);
    try {
      const id = record.sheetRowId || record.id;
      const targetLawyerId = triageLawyerLinking[record.id] !== undefined
        ? triageLawyerLinking[record.id]
        : (record.assignedLawyerId || (record as any).assigned_lawyer_id || null);

      const res = await fetch(`/api/poa/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: targetCid,
          assignedLawyerId: targetLawyerId || null,
        }),
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل ربط الوكالة بالعميل');
      }

      toast({
        title: 'تم الربط بنجاح',
        description: `تم ربط الوكالة ${record.poaNumber} بالعميل بنجاح.`,
      });

      await fetchClients();
      await loadRecords(true);
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message || 'فشل ربط الوكالة بالعميل، حاول مرة أخرى.',
        variant: 'destructive',
      });
    } finally {
      setSavingTriageId(null);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const unlinkedRecords = useMemo(() => {
    return records.filter((r) => !r.clientId && !r.client_id);
  }, [records]);

  const filteredRecords = records.filter((r) => {
    const clientName = getClientDisplayName(r);
    return (
      clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.poaNumber.includes(searchQuery) ||
      (r.notes && r.notes.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const totalItems = filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 space-y-6" dir="rtl">
      {/* Header */}
      <div className="fade-in-up flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 rounded-full bg-emerald-500" />
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-500" />
              إدارة الوكالات الشرعية
            </h1>
          </div>
          <p className="text-muted-foreground text-sm mr-3">
            متابعة وكالات العملاء وصلاحياتها وتواريخ انتهائها
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => loadRecords(true)} title="تحديث">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => handleOpenModal()}
                className="gap-2 bg-[#C99732] hover:bg-[#B28325] text-white rounded-xl font-bold shadow-md shadow-[#C99732]/25 border-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                + إضافة وكالة جديدة
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[550px]" dir="rtl">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold flex items-center gap-2 text-emerald-600">
                  <FileKey className="w-5 h-5" />
                  {editingRecord ? 'تعديل بيانات الوكالة' : 'إدخال بيانات وكالة جديدة'}
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4 py-2">
                {formError && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2"
                    data-testid="poa-form-error"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1 font-medium">{formError}</div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Client Picker - Required */}
                  <div className="space-y-1.5 md:col-span-2">
                    <ClientPicker
                      value={clientId}
                      onChange={(id) => {
                        setClientId(id);
                        if (formError) setFormError(null);
                      }}
                      label="العميل المرتبط"
                    />
                  </div>

                  {/* Lawyer Select */}
                  <div className="space-y-1.5 md:col-span-2">
                    <LawyerSelect
                      value={assignedLawyerId}
                      onChange={(id) => setAssignedLawyerId(id)}
                      currentRole={currentUser?.role}
                      currentUserId={currentUser?.id}
                      currentUserName={(currentUser as any)?.displayName || currentUser?.username}
                      label="المحامي المكلف"
                    />
                  </div>

                  {/* POA Number */}
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="poa-number" className="text-xs font-semibold flex items-center gap-1">
                      <FileKey className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>رقم الوكالة</span> <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="poa-number"
                      placeholder="مثال: 44589210"
                      value={poaNumber}
                      onChange={(e) => {
                        setPoaNumber(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      className="font-mono text-left"
                      dir="ltr"
                      disabled={isSaving}
                      required
                    />
                  </div>

                  {/* Issue Date */}
                  <div className="space-y-1.5">
                    <Label htmlFor="poa-issue-date" className="text-xs font-semibold flex items-center gap-1">
                      <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>تاريخ الإصدار (هجري)</span>
                    </Label>
                    <Input
                      id="poa-issue-date"
                      placeholder="مثال: 10/01/1445"
                      value={issueDateHijri}
                      onChange={(e) => {
                        setIssueDateHijri(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      className="font-mono"
                      disabled={isSaving}
                    />
                  </div>

                  {/* Expiry Date */}
                  <div className="space-y-1.5">
                    <Label htmlFor="poa-expiry-date" className="text-xs font-semibold flex items-center gap-1">
                      <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>تاريخ الانتهاء (هجري)</span>
                    </Label>
                    <Input
                      id="poa-expiry-date"
                      placeholder="مثال: 10/01/1448"
                      value={expiryDateHijri}
                      onChange={(e) => {
                        setExpiryDateHijri(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      className="font-mono"
                      disabled={isSaving}
                    />
                  </div>

                  {/* Auto-calculated days */}
                  <div className="space-y-1.5 md:col-span-2 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-semibold">حالة صلاحية الوكالة:</span>
                    </div>
                    <span
                      className={`font-mono text-sm font-bold px-3 py-0.5 rounded-full ${
                        expiryValidation.status === 'invalid'
                          ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          : expiryValidation.status === 'empty'
                          ? 'bg-muted text-muted-foreground'
                          : expiryValidation.days <= 0
                          ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                          : expiryValidation.days <= 30
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {expiryValidation.message}
                    </span>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="poa-notes" className="text-xs font-semibold">
                      ملاحظات وشروط الوكالة
                    </Label>
                    <Textarea
                      id="poa-notes"
                      placeholder="اكتب هنا صلاحيات الوكالة أو أية ملاحظات إضافية..."
                      rows={3}
                      value={notes}
                      onChange={(e) => {
                        setNotes(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      disabled={isSaving}
                    />
                  </div>

                  {editingRecord && (
                    <div className="pt-3 border-t border-border/50 md:col-span-2">
                      <AttachmentsPanel
                        relatedRecordType="poa"
                        relatedRecordId={editingRecord.sheetRowId || editingRecord.id}
                      />
                    </div>
                  )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0 mt-4">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving}>
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    data-testid="button-save-poa"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                    disabled={isSaving}
                  >
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSaving ? 'جارٍ حفظ الوكالة...' : editingRecord ? 'تحديث الوكالة' : 'حفظ الوكالة'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {bindingError && (
        <div className="fade-in-up rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-destructive flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="flex-1 font-semibold text-sm">{bindingError}</div>
        </div>
      )}

      {/* Admin Triage Banner for Unlinked POAs */}
      {isAdmin && unlinkedRecords.length > 0 && (
        <div className="fade-in-up rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-100 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm">وكالات تحتاج إلى ربط بعملاء</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                يوجد {unlinkedRecords.length} وكالة غير مرتبطة بعميل مسجل في النظام. يُرجى ربطها لضمان مطابقة الصلاحيات.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setUnlinkedDialogOpen(true)}
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm"
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>عرض وربط الوكالات ({unlinkedRecords.length})</span>
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="بحث باسم العميل، رقم الوكالة أو الملاحظات..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="pr-9"
        />
      </div>

      {/* Loading Skeletons */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : totalItems > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedRecords.map((record) => {
              const isExpired = record.daysRemaining <= 0;
              const isExpiringSoon = record.daysRemaining > 0 && record.daysRemaining <= 7;
              const isWarning = record.daysRemaining > 7 && record.daysRemaining <= 30;
              const isUnlinked = !record.clientId && !record.client_id;
              const clientDisplayName = getClientDisplayName(record);

              return (
                <div
                  key={record.id}
                  className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-all space-y-3 relative overflow-hidden"
                >
                  {/* Status bar */}
                  <div
                    className={`absolute top-0 right-0 left-0 h-1 ${
                      isExpired
                        ? 'bg-rose-500'
                        : isWarning
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                  />

                  <div className="flex items-start justify-between gap-2 pt-1">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base line-clamp-1">{clientDisplayName}</h3>
                        {isUnlinked && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium text-[11px] bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <AlertTriangle className="w-3 h-3" />
                            غير مربوطة بعميل
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                        <FileKey className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>{record.poaNumber}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isAdmin && (
                        <button
                          onClick={() => setReassignTarget(record)}
                          className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                          title="إعادة تعيين المحامي"
                        >
                          <UserCog className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setAttachmentTarget(record)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="المرفقات"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenModal(record)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="تعديل"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(record)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Days remaining */}
                  <div className="flex items-center justify-between bg-muted/50 p-2.5 rounded-lg text-xs font-semibold">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                      المتبقي:
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-xs font-semibold ${
                        isExpired
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          : isExpiringSoon
                          ? 'bg-[#C9A449]/15 text-[#C9A449] border border-[#C9A449]/40 shadow-sm animate-pulse'
                          : isWarning
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-50 text-emerald-700 dark:text-emerald-400 border border-emerald-200'
                      }`}
                    >
                      {isExpired ? (
                        <>
                          <AlertTriangle className="w-3 h-3" /> منتهية
                        </>
                      ) : isExpiringSoon ? (
                        <>
                          <AlertCircle className="w-3 h-3 text-[#C9A449]" /> {record.daysRemaining} يوم (تنتهي قريباً)
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> {record.daysRemaining} يوم
                        </>
                      )}
                    </span>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t border-border/50">
                    <div>
                      <span className="block text-[10px] text-muted-foreground/70">تاريخ الإصدار</span>
                      <span className="font-mono font-medium">{record.issueDateHijri || '—'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-muted-foreground/70">تاريخ الانتهاء</span>
                      <span className="font-mono font-medium">{record.expiryDateHijri || '—'}</span>
                    </div>
                  </div>

                  {/* Lawyer Assignment */}
                  {(record.assignedLawyer || record.assigned_lawyer) && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md">
                      <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        المحامي المعين: <strong className="text-foreground">{record.assignedLawyer || record.assigned_lawyer}</strong>
                      </span>
                    </div>
                  )}

                  {/* Notes */}
                  {record.notes && (
                    <p className="text-xs text-muted-foreground/90 bg-muted/30 p-2 rounded-md line-clamp-2 border border-border/30">
                      {record.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 mx-auto mb-4 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">لا توجد وكالات مسجلة</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-4">
            قم بإضافة وكالات العملاء لمتابعة صلاحياتها وتواريخ انتهائها.
          </p>
          <Button onClick={() => handleOpenModal()} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4" /> إضافة أول وكالة
          </Button>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ───────────────────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent dir="rtl" className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-500">
              <Trash2 className="w-5 h-5" />
              تأكيد حذف الوكالة
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
              هل أنت متأكد من حذف وكالة{' '}
              <span className="font-bold text-foreground">
                {deleteTarget ? getClientDisplayName(deleteTarget) : ''}
              </span>
              {deleteTarget?.poaNumber ? (
                <> — رقم <span className="font-mono text-foreground">{deleteTarget.poaNumber}</span></>
              ) : null}
              ؟
              <br />
              <span className="text-rose-500 font-medium">لا يمكن التراجع عن هذا الإجراء.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse">
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirmed}
              className="bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-600"
            >
              نعم، احذف الوكالة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Admin Unlinked POAs Triage Dialog ────────────────────────────── */}
      <Dialog open={unlinkedDialogOpen} onOpenChange={setUnlinkedDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <LinkIcon className="w-5 h-5" />
              ربط الوكالات غير المعينة بعملاء مسجلين
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-muted-foreground">
            توضح القائمة أدناه الوكالات الشرعية التي لا ترتبط بأي عميل مسجل. اختر العميل المناسب لكل وكالة واضغط على "حفظ الربط".
          </p>

          <div className="space-y-3 py-3">
            {unlinkedRecords.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm bg-muted/20 rounded-xl border border-dashed">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                جميع الوكالات مرتبطة بعملاء بنجاح!
              </div>
            ) : (
              unlinkedRecords.map((poa) => {
                const currentChosenCid = triageLinking[poa.id] || null;
                const isThisSaving = savingTriageId === poa.id;

                return (
                  <div
                    key={poa.id}
                    className="p-4 rounded-xl border border-border bg-card space-y-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">رقم الوكالة: {poa.poaNumber}</span>
                          {poa.clientName && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              الاسم السابق: {poa.clientName}
                            </span>
                          )}
                        </div>
                        {poa.expiryDateHijri && (
                          <div className="text-xs text-muted-foreground">
                            تاريخ الانتهاء: <span className="font-mono">{poa.expiryDateHijri}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <ClientPicker
                          value={currentChosenCid}
                          onChange={(newId) =>
                            setTriageLinking((prev) => ({ ...prev, [poa.id]: newId }))
                          }
                          label="اختر العميل لربطه بهذه الوكالة *"
                        />
                        <LawyerSelect
                          value={triageLawyerLinking[poa.id] !== undefined ? triageLawyerLinking[poa.id] : (poa.assignedLawyerId || (poa as any).assigned_lawyer_id || null)}
                          onChange={(newId) =>
                            setTriageLawyerLinking((prev) => ({ ...prev, [poa.id]: newId }))
                          }
                          label="إسناد المحامي المسؤول (اختياري)"
                        />
                      </div>
                      <div className="flex justify-end pt-1">
                        <Button
                          size="sm"
                          disabled={!currentChosenCid || isThisSaving}
                          onClick={() => handleSaveTriageLink(poa)}
                          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer"
                        >
                          {isThisSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <LinkIcon className="w-4 h-4" />
                          )}
                          <span>حفظ الربط والإسناد</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlinkedDialogOpen(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {reassignTarget && (
        <ReassignDialog
          open={!!reassignTarget}
          onOpenChange={(open) => {
            if (!open) setReassignTarget(null);
          }}
          module="poa"
          recordId={reassignTarget.sheetRowId || Number(reassignTarget.id.replace(/\D/g, '')) || 0}
          recordTitle={`وكالة ${reassignTarget.poaNumber}`}
          currentLawyerId={reassignTarget.assignedLawyerId || reassignTarget.assigned_lawyer_id}
          onSuccess={() => {
            setReassignTarget(null);
            loadRecords(true);
          }}
        />
      )}

      {/* Attachments Dialog */}
      <Dialog open={!!attachmentTarget} onOpenChange={(open) => !open && setAttachmentTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="w-5 h-5 text-primary" />
              مرفقات الوكالة: {attachmentTarget?.poaNumber || (attachmentTarget ? getClientDisplayName(attachmentTarget) : '')}
            </DialogTitle>
          </DialogHeader>
          {attachmentTarget && (
            <div className="py-2">
              <AttachmentsPanel
                relatedRecordType="poa"
                relatedRecordId={attachmentTarget.sheetRowId || attachmentTarget.id}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
