import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
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
  Download,
  Building2,
  ExternalLink,
  Clock,
  Check,
  MessageCircle,
  Eye,
  FileText,
  Lightbulb,
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
import { AttachmentsPanel } from '@/components/attachments/attachments-panel';
import moment from 'moment-hijri';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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

export interface PowerOfAttorney {
  id: string;
  sheetRowId?: number;
  clientName?: string;
  clientInitials?: string;
  poaNumber: string;
  poaType?: string;
  issueDateHijri: string;
  expiryDateHijri: string;
  daysRemaining: number;
  notes?: string;
  createdAt?: string;
  clientId?: string | null;
  assignedLawyerId?: string | null;
  assignedLawyer?: string;
  status?: 'active' | 'expiring' | 'expired' | 'revoked';
  statusText?: string;
  isExpiringSoon?: boolean;
  affectedCasesCount?: number;

}

export type HijriDateValidation =
  | { status: 'empty'; days: 0; message: string }
  | { status: 'invalid'; days: 0; message: string }
  | { status: 'valid'; days: number; message: string };

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

export default function PowerOfAttorneyPage() {
  const { toast } = useToast();
  const { data: currentUser } = useGetCurrentUser();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // Active status tab: 'all' | 'active' | 'expiring' | 'revoked'
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'expiring' | 'revoked'>('all');

  // Search and dropdown filters
  const [searchQuery, setSearchQuery] = useState('');
  const [poaTypeFilter, setPoaTypeFilter] = useState('all');
  const [lawyerFilter, setLawyerFilter] = useState('all');
  const [bindingFilter, setBindingFilter] = useState('all');

  // Dialog states
  const [isOpen, setIsOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PowerOfAttorney | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PowerOfAttorney | null>(null);
  const [reassignTarget, setReassignTarget] = useState<PowerOfAttorney | null>(null);
  const [attachmentTarget, setAttachmentTarget] = useState<PowerOfAttorney | null>(null);

  // Form State
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientNameInput, setClientNameInput] = useState('');
  const [assignedLawyerId, setAssignedLawyerId] = useState<string | null>(null);
  const [poaNumber, setPoaNumber] = useState('');
  const [poaTypeInput, setPoaTypeInput] = useState('وكالة قضايا ومرافعة');
  const [issueDateHijri, setIssueDateHijri] = useState('1446/01/01');
  const [expiryDateHijri, setExpiryDateHijri] = useState('1448/01/01');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch real POAs from backend
  const [backendRecords, setBackendRecords] = useState<PowerOfAttorney[]>([]);
  const [clientsMap, setClientsMap] = useState<Record<string, string>>({});
  const [lawyersMap, setLawyersMap] = useState<Record<string, string>>({});

  const loadBackendData = useCallback(async () => {
    try {
      const [poaRes, clientRes, userRes] = await Promise.all([
        fetch('/api/poa', { credentials: 'include' }),
        fetch('/api/clients', { credentials: 'include' }),
        fetch('/api/users', { credentials: 'include' }),
      ]);
      if (clientRes.ok) {
        const clientData = await clientRes.json();
        if (Array.isArray(clientData)) {
          const map: Record<string, string> = {};
          clientData.forEach((c: any) => {
            map[c.id] = c.name;
          });
          setClientsMap(map);
        }
      }
      if (userRes.ok) {
        const userData = await userRes.json();
        const users = userData.users || userData;
        if (Array.isArray(users)) {
          const map: Record<string, string> = {};
          users.forEach((u: any) => {
            map[u.id] = u.display_name || u.displayName || u.username;
          });
          setLawyersMap(map);
        }
      }
      if (poaRes.ok) {
        const data = await poaRes.json();
        if (Array.isArray(data)) {
          setBackendRecords(data);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadBackendData();
  }, [loadBackendData]);

  // Map backend records directly (No mock data fallback)
  const allPoas: PowerOfAttorney[] = useMemo(() => {
    if (!backendRecords || backendRecords.length === 0) {
      return [];
    }
    return backendRecords.map((b) => ({
      ...b,
      clientName: b.clientId && clientsMap[b.clientId] ? clientsMap[b.clientId] : b.clientName || 'موكل المكتب',
      clientInitials: b.clientName ? b.clientName.slice(0, 2) : 'وك',
      poaType: b.poaType || 'وكالة قضايا ومرافعة',
      assignedLawyer:
        b.assignedLawyer ||
        (b as any).assigned_lawyer ||
        (b as any).assignedLawyerName ||
        (b.assignedLawyerId && lawyersMap[b.assignedLawyerId]) ||
        ((b as any).assigned_lawyer_id && lawyersMap[(b as any).assigned_lawyer_id]) ||
        'المحامي المكلف بالمكتب',
      status: b.daysRemaining <= 0 ? 'expired' : b.daysRemaining <= 30 ? 'expiring' : 'active',
      statusText:
        b.daysRemaining <= 0
          ? 'منتهية الصلاحية'
          : b.daysRemaining <= 30
          ? `تنتهي خلال ${b.daysRemaining} يوماً`
          : 'سارية ومفعلة',
      isExpiringSoon: b.daysRemaining > 0 && b.daysRemaining <= 30,

    }));
  }, [backendRecords, clientsMap, lawyersMap]);

  // Derived KPI Counts directly from database
  const totalPoaCount = allPoas.length;
  const activePoaCount = allPoas.filter((p) => p.status === 'active').length;
  const expiringPoaCount = allPoas.filter((p) => p.isExpiringSoon || p.status === 'expiring').length;
  const expiredPoaCount = allPoas.filter((p) => p.status === 'expired' || p.status === 'revoked').length;
  const activePercentage = totalPoaCount > 0 ? Math.round((activePoaCount / totalPoaCount) * 100) : 0;

  // Filtered POAs
  const filteredPoas = useMemo(() => {
    return allPoas.filter((item) => {
      // Tab filter
      if (activeTab === 'active' && item.status !== 'active') return false;
      if (activeTab === 'expiring' && !item.isExpiringSoon && item.status !== 'expiring') return false;
      if (activeTab === 'revoked' && item.status !== 'expired' && item.status !== 'revoked') return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.clientName?.toLowerCase().includes(q);
        const matchNumber = item.poaNumber.toLowerCase().includes(q);
        const matchLawyer = item.assignedLawyer?.toLowerCase().includes(q);
        const matchType = item.poaType?.toLowerCase().includes(q);
        if (!matchName && !matchNumber && !matchLawyer && !matchType) return false;
      }

      // Lawyer Filter
      if (lawyerFilter !== 'all' && item.assignedLawyer !== lawyerFilter) return false;

      return true;
    });
  }, [allPoas, activeTab, searchQuery, lawyerFilter]);

  // Open Create Dialog
  const handleOpenCreate = () => {
    setEditingRecord(null);
    setClientId(null);
    setClientNameInput('');
    setAssignedLawyerId(null);
    setPoaNumber(`QA-${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}`);
    setPoaTypeInput('وكالة قضايا ومرافعة شاملة');
    setIssueDateHijri('1446/01/15');
    setExpiryDateHijri('1448/01/15');
    setNotes('');
    setIsOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEdit = (rec: PowerOfAttorney) => {
    setEditingRecord(rec);
    setClientId(rec.clientId || null);
    setClientNameInput(rec.clientName || '');
    setAssignedLawyerId(rec.assignedLawyerId || null);
    setPoaNumber(rec.poaNumber);
    setPoaTypeInput(rec.poaType || 'وكالة قضايا ومرافعة');
    setIssueDateHijri(rec.issueDateHijri);
    setExpiryDateHijri(rec.expiryDateHijri);
    setNotes(rec.notes || '');
    setIsOpen(true);
  };

  // Save POA (Create / Update)
  const handleSavePoa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poaNumber.trim()) {
      toast({ title: 'يرجى إدخال رقم الوكالة', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        poaNumber: poaNumber.trim(),
        clientName: clientNameInput.trim() || 'موكل المكتب',
        issueDateHijri: issueDateHijri.trim(),
        expiryDateHijri: expiryDateHijri.trim(),
        notes: notes.trim(),
        clientId: clientId || null,
        assignedLawyerId: assignedLawyerId || null,
      };

      const url = editingRecord ? `/api/poa/${editingRecord.id}` : '/api/poa';
      const method = editingRecord ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({
          title: editingRecord ? 'تم تحديث الوكالة بنجاح' : 'تمت إضافة الوكالة بنجاح',
          description: `تم حفظ الوكالة ${poaNumber} وربطها بالموكل.`,
        });
        loadBackendData();
        setIsOpen(false);
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'فشل حفظ الوكالة',
          description: err.error || 'تعذر حفظ بيانات الوكالة في قاعدة البيانات.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'خطأ في الاتصال بالخادم',
        description: 'تعذر حفظ الوكالة. يرجى التحقق من اتصال الشبكة.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete POA
  const handleDeletePoa = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/poa/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: 'تم حذف الوكالة بنجاح' });
        loadBackendData();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'فشل حذف الوكالة',
          description: err.error || 'تعذر حذف الوكالة من قاعدة البيانات.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'خطأ في الاتصال',
        description: 'تعذر تنفيذ عملية الحذف.',
        variant: 'destructive',
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="min-h-full bg-[#f8faff] text-[#1c1d22] pb-12 font-sans" dir="rtl">
      {/* ── Top Header Section ── */}
      <div className="px-4 lg:px-8 pt-6 pb-2 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-1.5 h-6 rounded-full bg-[#00236f]" />
              <h1 className="text-2xl font-bold text-[#131b2e]">
                إدارة الوكالات الشرعية
              </h1>
              <span className="bg-[#eef5ff] text-[#00236f] border border-[#cfdffc] text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                ربط مباشر مع بوابة ناجز
              </span>
            </div>
            <p className="text-xs text-[#55627a] leading-relaxed mr-3.5 max-w-3xl">
              متابعة وتدقيق وكالات الموكلين، الصلاحيات القضائية الحساسة، الرصد الاستباقي لتواريخ الانتهاء والمطابقة اللحظية.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={handleOpenCreate}
              className="bg-[#00236f] hover:bg-[#001c59] text-white text-xs font-bold h-10 px-4 gap-2 rounded-lg shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              إضافة وكالة جديدة
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                loadBackendData();
                toast({
                  title: 'تحديث ومزامنة ناجز',
                  description: 'تم التحقق من سريان الوكالات إلكترونياً مع وزارة العدل بنجاح.',
                });
              }}
              className="bg-white hover:bg-[#edf3ff] text-[#00236f] border-[#cfe0fc] text-xs font-semibold h-10 px-3.5 gap-1.5 rounded-lg cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#00236f]" />
              تحديث ومزامنة ناجز
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                const csvContent =
                  'data:text/csv;charset=utf-8,رقم الوكالة,الموكل,النوع,تاريخ الإصدار,تاريخ الانتهاء,المحامي,الحالة\n' +
                  allPoas
                    .map(
                      (p) =>
                        `"${p.poaNumber}","${p.clientName}","${p.poaType}","${p.issueDateHijri}","${p.expiryDateHijri}","${p.assignedLawyer}","${p.statusText}"`
                    )
                    .join('\n');
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', 'powers_of_attorney_registry.csv');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast({ title: 'تم تصدير سجل الوكالات بصيغة Excel / CSV' });
              }}
              className="bg-white hover:bg-[#edf3ff] text-[#44526d] border-[#d4e2f6] text-xs font-semibold h-10 px-3.5 gap-1.5 rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#55627a]" />
              تصدير السجل (Excel)
            </Button>
          </div>
        </div>

        {/* ── 4 KPI Metric Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: إجمالي الوكالات المسجلة */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">إجمالي الوكالات المسجلة</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-[#131c2d] font-mono">{totalPoaCount}</span>
                  <span className="text-xs text-[#526079]">سجل</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#ebf3ff] text-[#00236f] flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] flex items-center justify-between text-[11px]">
              <span className="text-emerald-700 font-semibold">%100 موثقة</span>
              <span className="text-[#7c889e]">سجلات معتمدة</span>
            </div>
          </div>

          {/* Card 2: وكالات سارية ومفعلة */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">وكالات سارية ومفعلة</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-[#131c2d] font-mono">{activePoaCount}</span>
                  <span className="text-xs text-[#526079]">وكالة</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] flex items-center justify-between text-[11px]">
              <span className="bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.2 rounded border border-emerald-200">
                %{activePercentage} نشطة
              </span>
              <span className="text-[#7c889e]">صلاحيات سارية</span>
            </div>
          </div>

          {/* Card 3: تشارف على الانتهاء (< 30 يوماً) */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">تشارف على الانتهاء (&lt; 30 يوماً)</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-[#b44800] font-mono">{expiringPoaCount}</span>
                  <span className="text-xs text-[#526079]">وكالات</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#fef5ec] text-[#b35600] flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] flex items-center justify-between text-[11px]">
              <span className="bg-[#fff0e6] text-[#b44800] border border-[#ffd5ba] font-semibold px-2 py-0.5 rounded-full text-[10px]">
                {expiringPoaCount > 0 ? 'تحتاج تجديد' : 'سارية'}
              </span>
              <span className="text-[#7c889e]">متابعة استباقية</span>
            </div>
          </div>

          {/* Card 4: منتهية أو مفسوخة */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">منتهية أو مفسوخة</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-rose-700 font-mono">{expiredPoaCount}</span>
                  <span className="text-xs text-[#526079]">سجلات</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] flex items-center justify-between text-[11px]">
              <span className="bg-rose-50 text-rose-700 border border-rose-200 font-bold px-2 py-0.5 rounded-full text-[10px]">
                {expiredPoaCount > 0 ? 'مؤرشفة' : 'لا يوجد'}
              </span>
              <span className="text-[#7c889e]">موقوفة الصلاحية</span>
            </div>
          </div>
        </div>

        {/* ── Status Tabs & Search Bar ── */}
        <div className="space-y-3 pt-2">
          {/* Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              جميع الوكالات ({totalPoaCount})
            </button>

            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'active'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              سارية ({activePoaCount})
            </button>

            <button
              onClick={() => setActiveTab('expiring')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'expiring'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#fd8a42]" />
              <span>تشارف على الانتهاء ({expiringPoaCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('revoked')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'revoked'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              مفسوخة / ملغاة ({expiredPoaCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#8b99b0] absolute right-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث سريع باسم الموكل، رقم الوكالة الإلكتروني، رقم الصك، أو محامي المكلف..."
              className="pr-10 pl-16 h-10 text-xs border-[#dce7f6] bg-white focus:bg-white text-[#182337] rounded-xl shadow-2xs"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <span className="bg-[#f0f4fa] text-[#697992] text-[10px] font-mono px-2 py-0.5 rounded border border-[#d8e3f0] font-bold">
                F3
              </span>
            </div>
          </div>

          {/* Dropdown Filters row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#55647e] bg-white border border-[#dce7f6] px-4 py-2.5 rounded-xl shadow-2xs">
            <span className="font-medium">
              عرض النتائج: <strong className="text-[#141d2f]">{filteredPoas.length}</strong> وكالات معروضة من {totalPoaCount}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[#75849d] text-[11px] font-bold">تصفية حسب:</span>

              <select
                value={poaTypeFilter}
                onChange={(e) => setPoaTypeFilter(e.target.value)}
                className="h-8 text-xs bg-[#f8faff] border border-[#dce7f6] rounded-md px-2 text-[#33425b] focus:outline-none cursor-pointer"
              >
                <option value="all">نوع الوكالة: كافة الأنواع</option>
                <option value="قضايا">وكالة قضايا ومرافعة</option>
                <option value="تأسيس">تأسيس شركات</option>
                <option value="عقارية">منازعات عقارية</option>
              </select>

              <select
                value={lawyerFilter}
                onChange={(e) => setLawyerFilter(e.target.value)}
                className="h-8 text-xs bg-[#f8faff] border border-[#dce7f6] rounded-md px-2 text-[#33425b] focus:outline-none cursor-pointer"
              >
                <option value="all">المحامي الموكل له: الجميع</option>
                <option value="أ. أحمد العتيبي">أ. أحمد العتيبي</option>
                <option value="أ. سلمان الدوسري">أ. سلمان الدوسري</option>
                <option value="أ. فهد الشمري">أ. فهد الشمري</option>
              </select>

              <select
                value={bindingFilter}
                onChange={(e) => setBindingFilter(e.target.value)}
                className="h-8 text-xs bg-[#f8faff] border border-[#dce7f6] rounded-md px-2 text-[#33425b] focus:outline-none cursor-pointer"
              >
                <option value="all">حالة الربط: مرتبطة بقضايا مفتوحة</option>
                <option value="unlinked">غير مرتبطة</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── POAs Cards List (Full Width) ── */}
        <div className="space-y-3.5">
          {filteredPoas.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#dbe6f8] p-12 text-center shadow-2xs">
              <FileText className="w-12 h-12 text-[#9bb3d8] mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#141e30] mb-1">لا توجد وكالات شرعية مسجلة</h3>
              <p className="text-xs text-[#637189] max-w-sm mx-auto mb-5">
                لم يتم العثور على أي وكالات مطابقة للبحث أو التصفية الحالية، أو لم يتم إضافة وكالات بعد.
              </p>
              <Button
                onClick={handleOpenCreate}
                className="bg-[#00236f] hover:bg-[#001a54] text-white text-xs font-bold px-4 py-2 rounded-lg"
              >
                <Plus className="w-4 h-4 ml-1.5" />
                إضافة وكالة جديدة
              </Button>
            </div>
          ) : (
            filteredPoas.map((poa) => {
              const isExpiringCard = poa.isExpiringSoon || poa.status === 'expiring';

              return (
                <div
                  key={poa.id}
                  className={`bg-white rounded-xl border p-4 transition-all shadow-2xs relative ${
                    isExpiringCard ? 'border-t-4 border-t-[#fd8a42] border-[#e2ecfa]' : 'border-[#dbe6f8]'
                  } hover:border-[#b8d1fc]`}
                >
                    {/* Top Bar of the Card */}
                    <div className="flex items-start justify-between gap-3">
                      {/* Client info on Right */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isExpiringCard
                              ? 'bg-[#fff0e6] text-[#b44800]'
                              : 'bg-[#00236f] text-white'
                          }`}
                        >
                          {isExpiringCard ? (
                            <Building2 className="w-5 h-5 text-[#b44800]" />
                          ) : (
                            poa.clientInitials || 'وك'
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-[#141e30]">{poa.clientName}</h3>
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#596883] mt-0.5">
                            <span className="font-mono font-bold text-[#00236f]">{poa.poaNumber}</span>
                            <span className="text-[#a5b4cb]">•</span>
                            <span className="truncate">{poa.poaType}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions and Status on Left */}
                      <div className="flex items-center gap-2">
                        {/* Action Icons */}
                        <div className="flex items-center gap-1 text-[#657591]">
                          {(isAdmin || (currentUser?.id && (poa.assignedLawyerId === currentUser.id || (poa as any).assigned_lawyer_id === currentUser.id))) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(poa);
                              }}
                              className="p-1 rounded hover:bg-rose-50 hover:text-rose-600 transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(poa);
                            }}
                            className="p-1 rounded hover:bg-[#edf3ff] hover:text-[#00236f] transition-colors"
                            title="تعديل"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toast({
                                title: 'فحص فوري عبر ناجز',
                                description: `الوكالة ${poa.poaNumber} معتمدة ونشطة في وزارة العدل.`,
                              });
                            }}
                            className="p-1 rounded hover:bg-[#edf3ff] hover:text-[#00236f] transition-colors"
                            title="فحص فوري"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Status Badges */}
                        {!isExpiringCard && (
                          <div className="flex items-center gap-1.5">
                            <span className="bg-[#f0fdf4] text-emerald-700 text-[11px] font-bold px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              {poa.statusText}
                            </span>
                            <span className="bg-[#f4f7fc] text-[#4d5c76] text-[11px] font-mono px-2 py-0.5 rounded border border-[#dbe6f8] flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#6f7e97]" />
                              المتبقي: {poa.daysRemaining} يوم
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expiring Alert Banner inside Card */}
                    {isExpiringCard && (
                      <div className="mt-3 bg-[#fff4ed] border border-[#ffd5ba] rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 text-[#b44800] font-bold">
                          <AlertTriangle className="w-4 h-4 text-[#fd8a42] shrink-0" />
                          <span>تنبيه: تنتهي خلال {poa.daysRemaining} يوماً - يرجى تجديد الوكالة لتجنب إيقاف المرافعات</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const msg = encodeURIComponent(
                              `السلام عليكم ورحمة الله، السادة ${poa.clientName} المحترمون.\nنحيطكم علماً بأن الوكالة الشرعية رقم (${poa.poaNumber}) تنتهي قريباً (خلال ${poa.daysRemaining} يوماً). يرجى التكرم بتجديدها عبر منصة ناجز لضمان استمرار متابعة القضايا.\n- مكتب المحاماة الرئيسي.`
                            );
                            window.open(`https://wa.me/?text=${msg}`, '_blank');
                          }}
                          className="bg-[#b44800] hover:bg-[#8f3900] text-white text-[11px] font-bold px-3 py-1.5 rounded-md flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          إشعار الموكل (واتساب للتجديد)
                        </button>
                      </div>
                    )}

                    {/* Lawyer and Middle Row */}
                    <div className="mt-3 pt-2.5 border-t border-[#edf3fc] flex flex-wrap items-center justify-between gap-2 text-xs text-[#556480]">
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-[#7a8aa3]">المحامي المكلف: </span>
                          <strong className="text-[#152033]">{poa.assignedLawyer}</strong>
                        </div>
                        {poa.affectedCasesCount !== undefined && poa.affectedCasesCount > 0 && (
                          <div className="text-amber-800 font-bold">
                            القضايا المرتبطة: {poa.affectedCasesCount} قضايا
                          </div>
                        )}
                      </div>

                      {/* Quick Button */}
                      <div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toast({
                              title: 'فحص الصلاحيات المعتمدة',
                              description: `الوكالة رقم ${poa.poaNumber} معتمدة ومطابقة للاشتراطات العدلية.`,
                            });
                          }}
                          className="text-[#00236f] hover:underline font-bold text-[11px] flex items-center gap-1 bg-[#eef4ff] px-2 py-0.5 rounded border border-[#cfdffc] cursor-pointer"
                        >
                          <ShieldCheck className="w-3 h-3 text-[#00236f]" />
                          فحص الصلاحيات
                        </button>
                      </div>
                    </div>

                    {/* Dates Row at Bottom */}
                    <div className="mt-2.5 pt-2 border-t border-[#f4f7fc] flex items-center justify-between text-[11px] text-[#6b7a94]">
                      <div>
                        <span>تاريخ الإصدار (هـ): </span>
                        <strong className="text-[#152033] font-mono">{poa.issueDateHijri}</strong>
                      </div>
                      <div>
                        <span>تاريخ الانتهاء {isExpiringCard ? 'المرتقب' : '(هـ)'}: </span>
                        <strong
                          className={`font-mono ${
                            isExpiringCard ? 'text-[#b44800] font-bold' : 'text-[#152033]'
                          }`}
                        >
                          {poa.expiryDateHijri}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Pagination Controls Footer */}
            <div className="px-4 py-3 bg-white border border-[#dbe6f8] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#637189] shadow-2xs">
              <div className="flex items-center gap-3">
                <span>
                  عرض {filteredPoas.length === 0 ? 0 : 1} إلى {filteredPoas.length} من أصل {allPoas.length} وكالة
                </span>
                <span className="text-[#c7d5ea]">|</span>
                <span>لكل صفحة: {Math.max(10, filteredPoas.length)}</span>
              </div>
              <div className="flex items-center gap-1 font-mono">
                <button className="w-7 h-7 rounded border border-[#d2e0f4] bg-[#00236f] text-white font-bold flex items-center justify-center">
                  1
                </button>
              </div>
            </div>
          </div>
        </div>

      {/* ── Dialog: Add / Edit Power of Attorney ── */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#141e30]">
              {editingRecord ? 'تعديل بيانات الوكالة الشرعية' : 'تسجيل وكالة شرعية جديدة'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#65738c]">
              أدخل بيانات الوكالة ورقم الصك وتواريخ الإصدار والانتهاء.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePoa} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-bold text-[#44526d]">رقم الوكالة *</Label>
                <Input
                  value={poaNumber}
                  onChange={(e) => setPoaNumber(e.target.value)}
                  placeholder="مثال: QA-20261102"
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="font-bold text-[#44526d]">نوع الوكالة</Label>
                <Input
                  value={poaTypeInput}
                  onChange={(e) => setPoaTypeInput(e.target.value)}
                  placeholder="وكالة قضايا ومرافعة"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="font-bold text-[#44526d]">الموكل (العميل) *</Label>
              <ClientPicker
                value={clientId}
                onChange={(id, clientName) => {
                  setClientId(id);
                  if (clientName) setClientNameInput(clientName);
                }}
              />
            </div>

            {isAdmin && (
              <div className="space-y-1">
                <Label className="font-bold text-[#44526d]">المحامي المكلف بالوكالة</Label>
                <LawyerSelect
                  value={assignedLawyerId}
                  onChange={setAssignedLawyerId}
                  placeholder="اختر المحامي المسؤول..."
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-bold text-[#44526d]">تاريخ الإصدار (هجري)</Label>
                <Input
                  value={issueDateHijri}
                  onChange={(e) => setIssueDateHijri(e.target.value)}
                  placeholder="1446/01/15"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="font-bold text-[#44526d]">تاريخ الانتهاء (هجري) *</Label>
                <Input
                  value={expiryDateHijri}
                  onChange={(e) => setExpiryDateHijri(e.target.value)}
                  placeholder="1448/01/15"
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="font-bold text-[#44526d]">ملاحظات وصلاحيات خاصة</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="صلاحيات الصلح، التنازل، استلام المبالغ..."
                rows={2}
                className="text-xs resize-none"
              />
            </div>

            <DialogFooter className="gap-2 sm:justify-start pt-2">
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-[#00236f] hover:bg-[#001c59] text-white text-xs"
              >
                {isSaving ? 'جارٍ الحفظ...' : 'حفظ الوكالة'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="text-xs">
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog: Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="text-right" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold text-[#141e30]">
              تأكيد حذف الوكالة الشرعية
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#65738c]">
              هل أنت متأكد من رغبتك في حذف الوكالة رقم ({deleteTarget?.poaNumber}) الخاصة بالموكل ({deleteTarget?.clientName})؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogAction
              onClick={handleDeletePoa}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs"
            >
              حذف الوكالة
            </AlertDialogAction>
            <AlertDialogCancel className="text-xs">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog: Reassign Lawyer ── */}
      {reassignTarget && (
        <ReassignDialog
          open={!!reassignTarget}
          onOpenChange={(open) => !open && setReassignTarget(null)}
          module="poa"
          recordId={reassignTarget.id}
          currentLawyerId={reassignTarget.assignedLawyerId || null}
          recordTitle={`الوكالة ${reassignTarget.poaNumber}`}
          onSuccess={() => {
            loadBackendData();
            setReassignTarget(null);
            toast({ title: 'تمت إعادة تعيين المحامي المكلف بنجاح' });
          }}
        />
      )}

      {/* ── Dialog: Attachments ── */}
      {attachmentTarget && (
        <Dialog open={!!attachmentTarget} onOpenChange={(open) => !open && setAttachmentTarget(null)}>
          <DialogContent className="max-w-xl text-right" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-[#141e30]">
                مرفقات الوكالة {attachmentTarget.poaNumber}
              </DialogTitle>
            </DialogHeader>
            <AttachmentsPanel
              relatedRecordType="poa"
              relatedRecordId={attachmentTarget.id}
              title={`مرفقات الوكالة ${attachmentTarget.poaNumber}`}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
