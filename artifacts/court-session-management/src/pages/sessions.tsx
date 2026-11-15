import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  useListSessions,
  useDeleteSession,
  useUpdateSession,
  useCreateSession,
  useGetCurrentUser,
  getListSessionsQueryKey,
  getGetDashboardStatsQueryKey,
} from '@workspace/api-client-react';
import type { SessionStatus } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'wouter';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Scale,
  Clock,
  User,
  MoreVertical,
  Pencil,
  Trash2,
  ArrowUpDown,
  AlertCircle,
  RefreshCw,
  UserCog,
  Download,
  CalendarDays,
  Gavel,
  CheckSquare,
  FileText,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Search,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  Share2,
  Table,
  Eye,
  SlidersHorizontal,
  CalendarCheck,
  FileSignature,
  BellRing,
  Laptop,
  CalendarX,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ClientPicker } from '@/components/clients/client-picker';
import { LawyerSelect } from '@/components/clients/lawyer-select';
import { ReassignDialog } from '@/components/clients/reassign-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

type ExtendedFilterStatus = 'all' | 'Today' | 'Upcoming' | 'needs_report' | 'Finished' | 'Cancelled';

function deriveEffectiveStatus(storedStatus: SessionStatus, hearingAt: string | null | undefined): SessionStatus {
  if (storedStatus === 'Cancelled' || storedStatus === 'Finished') return storedStatus;
  if (!hearingAt) return storedStatus;
  const hearing = new Date(hearingAt);
  const now = new Date();
  if (hearing.getTime() < now.getTime()) return 'Finished';
  const sameDay =
    hearing.getUTCFullYear() === now.getUTCFullYear() &&
    hearing.getUTCMonth() === now.getUTCMonth() &&
    hearing.getUTCDate() === now.getUTCDate();
  return sameDay ? 'Today' : 'Upcoming';
}

type SessionItem = {
  id: number;
  caseNumber?: string | null;
  caseType?: string | null;
  plaintiff?: string | null;
  defendant?: string | null;
  court?: string | null;
  courtCircuit?: string | null;
  sessionDateHijri?: string | null;
  sessionDay?: string | null;
  sessionTime?: string | null;
  status: SessionStatus;
  hearingAt?: string | null;
  notes?: string | null;
  reportStatus?: string | null;
  assignedLawyer?: string | null;
  isRemote?: boolean;
  registrationNumber?: string | null;
  [key: string]: unknown;
};

export default function SessionsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<ExtendedFilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [courtFilter, setCourtFilter] = useState<string>('all');
  const [sessionTypeFilter, setSessionTypeFilter] = useState<string>('all');
  const [lawyerFilter, setLawyerFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('nearest');
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const { data: currentUser } = useGetCurrentUser();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // API Queries
  const {
    data: sessionsData = [],
    isLoading,
    refetch: refetchSessions,
  } = useListSessions();

  const deleteSessionMutation = useDeleteSession({
    mutation: {
      onSuccess: () => {
        toast({ title: 'تم الحذف بنجاح', description: 'تم حذف الجلسة المحددة' });
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        setDeleteTarget(null);
      },
    },
  });

  const updateSessionMutation = useUpdateSession({
    mutation: {
      onSuccess: () => {
        toast({ title: 'تم التحديث بنجاح', description: 'تم تعديل بيانات الجلسة' });
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        setEditTarget(null);
      },
    },
  });

  const createSessionMutation = useCreateSession({
    mutation: {
      onSuccess: () => {
        toast({ title: 'تمت إضافة الجلسة بنجاح', description: 'تم إدراج الجلسة في التقويم القضائي للمكتب' });
        queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
        setIsAddSessionOpen(false);
      },
      onError: (err: any) => {
        toast({
          title: 'فشل إضافة الجلسة',
          description: err?.message || 'تعذر حفظ الجلسة في قاعدة البيانات.',
          variant: 'destructive',
        });
      },
    },
  });

  // Dialogs
  const [deleteTarget, setDeleteTarget] = useState<SessionItem | null>(null);
  const [editTarget, setEditTarget] = useState<SessionItem | null>(null);
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<SessionItem | null>(null);

  // New session form state
  const [newSessionForm, setNewSessionForm] = useState({
    caseNumber: '',
    court: 'المحكمة التجارية بالرياض',
    courtCircuit: 'الدائرة الحقوقية الثالثة',
    plaintiff: '',
    defendant: '',
    hearingAt: new Date().toISOString().split('T')[0],
    sessionTime: '10:30',
    caseType: 'تجارية',
    assignedLawyer: '',
    isRemote: true,
  });

  // Real sessions list
  const allSessionsList = useMemo(() => {
    if (sessionsData && sessionsData.length > 0) {
      return sessionsData.map((s) => ({
        id: s.id,
        caseNumber: s.caseNumber || 'بدون رقم',
        caseType: (s as any).caseType || 'دعوى قضائية',
        registrationNumber: (s as any).registrationNumber || '—',
        court: s.court || 'المحكمة المختصة',
        courtCircuit: s.courtCircuit || 'الدائرة القضائية',
        isRemote: (s as any).isRemote ?? true,
        plaintiff: s.plaintiff || '—',
        defendant: s.defendant || '—',
        sessionDateHijri: s.sessionDateHijri || (s.hearingAt ? new Date(s.hearingAt).toLocaleDateString('ar-SA') : 'محدد قريباً'),
        sessionDay: s.sessionDay || 'اليوم',
        sessionTime: s.sessionTime || (s.hearingAt ? new Date(s.hearingAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '10:00 ص'),
        hearingAt: s.hearingAt,
        status: s.status,
        reportStatus: !s.notes ? 'تدوين التقرير' : s.status === 'Finished' ? 'عرض الضبط القضائي' : 'بانتظار الانعقاد',
        assignedLawyer: (s as any).assignedLawyer || 'غير محدد',
        notes: s.notes || 'جلسة قضائية مسجلة في النظام',
      }));
    }
    return [];
  }, [sessionsData]);

  // Counts
  const counts = useMemo(() => {
    const total = allSessionsList.length;
    const today = allSessionsList.filter((s) => deriveEffectiveStatus(s.status, s.hearingAt) === 'Today').length;
    const upcoming = allSessionsList.filter((s) => deriveEffectiveStatus(s.status, s.hearingAt) === 'Upcoming').length;
    const needsReport = allSessionsList.filter((s) => s.reportStatus === 'تدوين التقرير' || (!s.notes && s.status === 'Finished')).length;
    const finished = allSessionsList.filter((s) => s.status === 'Finished').length;
    const cancelled = allSessionsList.filter((s) => s.status === 'Cancelled').length;
    return { total, today, upcoming, needsReport, finished, cancelled };
  }, [allSessionsList]);

  // Lawyer performance stats derived from real sessions
  const lawyerPerformance = useMemo(() => {
    const map = new Map<string, { total: number; needsReport: number; finished: number }>();
    allSessionsList.forEach((s) => {
      const lawyer = s.assignedLawyer || 'محامي المكتب';
      const cur = map.get(lawyer) || { total: 0, needsReport: 0, finished: 0 };
      cur.total++;
      if (s.reportStatus === 'تدوين التقرير' || (!s.notes && s.status === 'Finished')) cur.needsReport++;
      if (s.status === 'Finished') cur.finished++;
      map.set(lawyer, cur);
    });
    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      total: data.total,
      needsReport: data.needsReport,
      pct: data.total > 0 ? (((data.total - data.needsReport) / data.total) * 100).toFixed(1) : '100',
    }));
  }, [allSessionsList]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return allSessionsList.filter((s) => {
      const eff = deriveEffectiveStatus(s.status, s.hearingAt);
      if (statusFilter === 'Today' && eff !== 'Today') return false;
      if (statusFilter === 'Upcoming' && eff !== 'Upcoming') return false;
      if (statusFilter === 'Finished' && s.status !== 'Finished') return false;
      if (statusFilter === 'Cancelled' && s.status !== 'Cancelled') return false;
      if (statusFilter === 'needs_report' && s.reportStatus !== 'تدوين التقرير') return false;

      if (courtFilter !== 'all' && !s.court?.includes(courtFilter)) return false;
      if (sessionTypeFilter !== 'all' && s.caseType !== sessionTypeFilter) return false;
      if (lawyerFilter !== 'all' && !s.assignedLawyer?.includes(lawyerFilter)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const text = `${s.caseNumber} ${s.court} ${s.courtCircuit} ${s.plaintiff} ${s.defendant} ${s.assignedLawyer} ${s.caseType}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });
  }, [allSessionsList, statusFilter, courtFilter, sessionTypeFilter, lawyerFilter, searchQuery]);

  // Paginated Slice
  const totalPages = Math.ceil(filteredSessions.length / pageSize) || 1;
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSessions.slice(start, start + pageSize);
  }, [filteredSessions, currentPage, pageSize]);

  // Export to CSV
  const handleExport = () => {
    const headers = ['رقم القضية', 'نوع الجلسة', 'المحكمة', 'الدائرة', 'المدعي', 'المدعى عليه', 'التاريخ', 'الوقت', 'المحامي المكلف', 'الحالة'];
    const rows = filteredSessions.map((s) => [
      s.caseNumber,
      s.caseType,
      s.court,
      s.courtCircuit,
      s.plaintiff,
      s.defendant,
      s.sessionDateHijri,
      s.sessionTime,
      s.assignedLawyer,
      s.status,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `جدول_الجلسات_القضائية_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast({ title: 'تم التصدير بنجاح' });
  };

  const handleCreateSession = () => {
    if (!newSessionForm.caseNumber.trim() || !newSessionForm.court.trim()) {
      toast({ title: 'يرجى إدخال رقم القضية والمحكمة', variant: 'destructive' });
      return;
    }
    createSessionMutation.mutate({
      data: {
        caseNumber: newSessionForm.caseNumber.trim(),
        court: newSessionForm.court.trim(),
        courtCircuit: newSessionForm.courtCircuit.trim(),
        plaintiff: newSessionForm.plaintiff.trim(),
        defendant: newSessionForm.defendant.trim(),
        caseSubject: newSessionForm.caseType,
        sessionTime: newSessionForm.sessionTime,
        sessionDateHijri: newSessionForm.hearingAt,
        notes: 'جلسة مجدولة جديدة',
      },
    });
  };

  return (
    <div className="w-full min-h-screen bg-[#f8f9ff] text-[#0b1c30] p-4 sm:p-6 lg:p-8 space-y-6" dir="rtl">
      {/* ── Breadcrumb & Top Page Header ── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-2">
        <div className="flex flex-col gap-1 text-right">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs text-[#757682]">
            <span>لوحة المكتب</span>
            <ChevronLeft className="w-3.5 h-3.5 text-[#757682]" />
            <span>السجلات القضائية</span>
            <ChevronLeft className="w-3.5 h-3.5 text-[#757682]" />
            <span className="text-[#00236f] font-semibold">الجلسات والمواعيد</span>
          </div>

          <div className="flex items-center gap-2.5 mt-1">
            <h1 className="text-2xl font-bold text-[#00236f]">
              الجلسات والمواعيد القضائية
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#dce1ff] text-[#00236f]">
              مباشر 1446-1447هـ
            </span>
          </div>

          <p className="text-xs text-[#757682] max-w-3xl leading-relaxed">
            متابعة ومراقبة جلسات المحاكم الشرعية والتجارية، التحقق من إنجاز وتدوين الضبوط والتقارير، وتوزيع المهام الترافعية لفريق المحامين المعتمدين.
          </p>
        </div>

        {/* Action Buttons Top-Left */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Toggle View */}
          <div className="flex items-center bg-white rounded-lg border border-[#dce9ff] p-0.5 shadow-2xs">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-[#00236f] text-white' : 'text-[#757682] hover:text-[#0b1c30]'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>جدول الجلسات</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'calendar' ? 'bg-[#00236f] text-white' : 'text-[#757682] hover:text-[#0b1c30]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>التقويم</span>
            </button>
          </div>

          <button
            onClick={() => refetchSessions()}
            className="inline-flex items-center gap-2 px-3.5 h-10 rounded-lg bg-white hover:bg-[#eff4ff] text-[#0b1c30] text-xs font-semibold border border-[#dce9ff] shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-[#00236f]" />
            <span>مزامنة فور وعين</span>
          </button>

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-3.5 h-10 rounded-lg bg-white hover:bg-[#eff4ff] text-[#0b1c30] text-xs font-semibold border border-[#dce9ff] shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#00236f]" />
            <span>تصدير (Excel/PDF)</span>
          </button>

          <button
            onClick={() => setIsAddSessionOpen(true)}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>إضافة جلسة جديدة</span>
          </button>
        </div>
      </div>

      {/* ── Top 4 Primary KPI Metrics Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Today Sessions */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-[#e5eeff] flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col text-right">
              <span className="text-xs font-medium text-[#757682]">جلسات اليوم المجدولة</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-[#0b1c30]">{counts.today}</span>
                <span className="text-xs text-[#757682]">جلسة معتمدة</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#dce1ff] flex items-center justify-center text-[#00236f]">
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 flex items-center justify-between bg-[#eff4ff] px-2.5 py-1.5 rounded-lg text-xs">
            <span className="text-[#444651]">{counts.today > 0 ? 'جلسات نشطة اليوم' : 'لا توجد جلسات اليوم'}</span>
            <span className="font-semibold text-[#00236f]">{counts.today > 0 ? 'متابعة مباشرة' : 'جاهزية كاملة'}</span>
          </div>
        </div>

        {/* Card 2: Upcoming Sessions */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-[#e5eeff] flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col text-right">
              <span className="text-xs font-medium text-[#757682]">الجلسات القادمة</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-[#0b1c30]">{counts.upcoming}</span>
                <span className="text-xs text-[#757682]">جلسة مرافعة</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#dce9ff] flex items-center justify-center text-[#00236f]">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 flex items-center justify-between bg-[#eff4ff] px-2.5 py-1.5 rounded-lg text-xs">
            <span className="text-[#444651]">{counts.upcoming} جلسة مجدولة قادمة</span>
            <span className="font-semibold text-[#00236f]">موزعة بالكامل</span>
          </div>
        </div>

        {/* Card 3: Needs Report */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-[#e5eeff] flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col text-right">
              <span className="text-xs font-medium text-[#757682]">تتطلب تقريراً / ضبطاً قضائياً</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-[#ba1a1a]">{counts.needsReport}</span>
                <span className="text-xs text-[#757682]">جلسات تحتاج تدوين</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#ffdbca] flex items-center justify-center text-[#9b4500]">
              <FileSignature className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 flex items-center justify-between bg-[#eff4ff] px-2.5 py-1.5 rounded-lg text-xs">
            <span className="text-[#444651]">مهلة الإنجاز: 24 ساعة</span>
            <span className="font-bold text-[#ba1a1a]">التدوين السريع +</span>
          </div>
        </div>

        {/* Card 4: Monthly Sessions */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-[#e5eeff] flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col text-right">
              <span className="text-xs font-medium text-[#757682]">إجمالي الجلسات المسجلة شهرياً</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-[#0b1c30]">{counts.total}</span>
                <span className="text-xs text-[#757682]">جلسة مسجلة</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#dce1ff] flex items-center justify-center text-[#00236f]">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 flex items-center justify-between bg-[#eff4ff] px-2.5 py-1.5 rounded-lg text-xs">
            <span className="text-[#444651]">نسبة الحضور والترافع</span>
            <span className="font-bold text-[#00236f]">{counts.total > 0 ? ((counts.finished / counts.total) * 100).toFixed(1) : '100'}%</span>
          </div>
        </div>
      </div>

      {/* ── Urgent Judicial Hearing Alert Banner ── */}
      {counts.today > 0 && allSessionsList.find((s) => deriveEffectiveStatus(s.status, s.hearingAt) === 'Today') && (() => {
        const urgentSession = allSessionsList.find((s) => deriveEffectiveStatus(s.status, s.hearingAt) === 'Today')!;
        return (
          <div className="bg-[#ffdbca]/40 rounded-xl p-4 sm:p-5 border border-[#fd8a42]/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-[#fd8a42] text-white flex items-center justify-center shrink-0 shadow-xs">
                <BellRing className="w-5 h-5" />
              </div>
              <div className="flex flex-col text-right">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#9b4500] text-white">تنبيه انعقاد وشيك:</span>
                  <span className="text-xs font-bold text-[#0b1c30]">{urgentSession.court} ({urgentSession.courtCircuit})</span>
                  <span className="text-xs font-bold text-[#00236f]">القضية #{urgentSession.caseNumber}</span>
                </div>
                <p className="text-xs text-[#444651] font-medium mt-1">
                  جلسة مرافعة مجدولة اليوم الساعة {urgentSession.sessionTime} - المحامي المكلف: <span className="font-bold text-[#0b1c30]">{urgentSession.assignedLawyer}</span> • الموكل: {urgentSession.plaintiff}.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => window.open('https://najiz.sa', '_blank')}
                className="px-4 h-9 rounded-lg bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <Laptop className="w-4 h-4" />
                <span>دخول الجلسة (ناجز)</span>
              </button>
              <Link href="/chat">
                <button className="px-3.5 h-9 rounded-lg bg-white hover:bg-[#eff4ff] text-[#00236f] text-xs font-semibold border border-[#dce9ff] flex items-center gap-1.5 transition-colors cursor-pointer">
                  <FileText className="w-4 h-4" />
                  <span>مذكرة الجلسة</span>
                </button>
              </Link>
            </div>
          </div>
        );
      })()}

      {/* ── Status Tabs Bar ── */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-[#e5eeff] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#eff4ff]">
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-[#eff4ff] text-[#444651] hover:bg-[#dce9ff]'
              }`}
            >
              كافة الجلسات ({counts.total})
            </button>
            <button
              onClick={() => { setStatusFilter('Today'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'Today'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-[#eff4ff] text-[#444651] hover:bg-[#dce9ff]'
              }`}
            >
              جلسات اليوم ({counts.today})
            </button>
            <button
              onClick={() => { setStatusFilter('Upcoming'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'Upcoming'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-[#eff4ff] text-[#444651] hover:bg-[#dce9ff]'
              }`}
            >
              القادمة ({counts.upcoming})
            </button>
            <button
              onClick={() => { setStatusFilter('needs_report'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'needs_report'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-[#eff4ff] text-[#444651] hover:bg-[#dce9ff]'
              }`}
            >
              <span>تتطلب تقريراً</span>
              <span className="w-5 h-5 rounded-full bg-[#fd8a42] text-white flex items-center justify-center text-[10px] font-bold">
                {counts.needsReport}
              </span>
            </button>
            <button
              onClick={() => { setStatusFilter('Finished'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'Finished'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-[#eff4ff] text-[#444651] hover:bg-[#dce9ff]'
              }`}
            >
              المنتهية ({counts.finished})
            </button>
            <button
              onClick={() => { setStatusFilter('Cancelled'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'Cancelled'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-[#eff4ff] text-[#444651] hover:bg-[#dce9ff]'
              }`}
            >
              المؤجلة / الملغاة ({counts.cancelled})
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#757682]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>تحديث تلقائي: كل 5 دقائق</span>
          </div>
        </div>

        {/* ── Advanced Search & Filter Toolbar ── */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#757682]" />
            <input
              type="text"
              placeholder="بحث برقم القضية، الموكل، الخصم، اسم المحكمة، أو المحامي..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full h-9 pr-9 pl-3 rounded-lg bg-[#eff4ff] text-xs font-medium text-[#0b1c30] placeholder:text-[#757682] border border-transparent focus:outline-none focus:ring-1 focus:ring-[#00236f] transition-all"
            />
          </div>

          {/* Court Filter */}
          <select
            value={courtFilter}
            onChange={(e) => { setCourtFilter(e.target.value); setCurrentPage(1); }}
            className="h-9 px-3 rounded-lg bg-[#eff4ff] text-xs font-medium text-[#0b1c30] border border-transparent focus:outline-none cursor-pointer"
          >
            <option value="all">كافة المحاكم والدوائر</option>
            <option value="تجارية">المحاكم التجارية</option>
            <option value="استئناف">محاكم الاستئناف</option>
            <option value="عمالية">المحاكم العمالية</option>
            <option value="عامة">المحاكم العامة</option>
            <option value="ديوان المظالم">ديوان المظالم</option>
          </select>

          {/* Session Type Filter */}
          <select
            value={sessionTypeFilter}
            onChange={(e) => { setSessionTypeFilter(e.target.value); setCurrentPage(1); }}
            className="h-9 px-3 rounded-lg bg-[#eff4ff] text-xs font-medium text-[#0b1c30] border border-transparent focus:outline-none cursor-pointer"
          >
            <option value="all">نوع الجلسة</option>
            <option value="تجارية">تجارية</option>
            <option value="استئناف">استئناف</option>
            <option value="عمالية">عمالية</option>
            <option value="عامة">عامة</option>
            <option value="ديوان المظالم">ديوان المظالم</option>
          </select>

          {/* Lawyer Filter */}
          <select
            value={lawyerFilter}
            onChange={(e) => { setLawyerFilter(e.target.value); setCurrentPage(1); }}
            className="h-9 px-3 rounded-lg bg-[#eff4ff] text-xs font-medium text-[#0b1c30] border border-transparent focus:outline-none cursor-pointer"
          >
            <option value="all">المحامي المكلف</option>
            <option value="أحمد">أ. أحمد خالد العتيبي</option>
            <option value="سارة">أ. سارة الهاشمي</option>
            <option value="محمود">أ. محمود عز الدين</option>
            <option value="محمد">أ. محمد الجزار</option>
          </select>

          {/* Sorting */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-9 px-3 rounded-lg bg-[#eff4ff] text-xs font-medium text-[#0b1c30] border border-transparent focus:outline-none cursor-pointer"
          >
            <option value="nearest">الأقرب زمنيّاً (تلقائي)</option>
            <option value="latest">الأحدث تسجيلاً</option>
          </select>
        </div>

        {/* ── Main Ledger Table ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#757682] text-xs">
                <th className="py-3 px-4 rounded-r-lg font-semibold">رقم القضية ونوعها</th>
                <th className="py-3 px-4 font-semibold">المحكمة والدائرة القضائية</th>
                <th className="py-3 px-4 font-semibold">أطراف الدعوى (الموكل ضد الخصم)</th>
                <th className="py-3 px-4 font-semibold text-center">الموعد والتوقيت</th>
                <th className="py-3 px-4 font-semibold">المحامي المكلف</th>
                <th className="py-3 px-4 font-semibold text-center">حالة الجلسة</th>
                <th className="py-3 px-4 font-semibold text-center">تقرير وضبط الجلسة</th>
                <th className="py-3 px-4 rounded-l-lg font-semibold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eff4ff]">
              {paginatedSessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#757682]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CalendarX className="w-10 h-10 text-[#757682]" />
                      <p className="text-sm font-semibold text-[#0b1c30]">لا توجد جلسات مسجلة تطابق البحث</p>
                      <p className="text-xs text-[#757682]">يمكنك إضافة جلسة قضائية جديدة أو إعادة ضبط الفلاتر</p>
                      <button
                        onClick={() => setIsAddSessionOpen(true)}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00236f] text-white text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة جلسة جديدة</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedSessions.map((s, idx) => {
                const eff = deriveEffectiveStatus(s.status, s.hearingAt);

                return (
                  <tr key={s.id} className="hover:bg-[#eff4ff]/50 transition-colors group">
                    {/* Case Number & Type */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col text-right">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[#00236f] text-sm">{s.caseNumber}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#dce1ff] text-[#00236f]">
                            {s.caseType || 'تجارية'}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#444651] mt-0.5">{s.notes}</span>
                        <span className="text-[10px] text-[#757682]">قيد إلكتروني: {s.registrationNumber || '14460921'}</span>
                      </div>
                    </td>

                    {/* Court & Circuit */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col text-right max-w-[200px]">
                        <span className="font-bold text-[#0b1c30]">{s.court}</span>
                        <span className="text-[11px] text-[#757682] mt-0.5">{s.courtCircuit}</span>
                        {s.isRemote ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-medium mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            عن بعد (بوابة ناجز)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[#00236f] font-medium mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00236f]"></span>
                            حضور بالمحكمة
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Parties */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col text-right max-w-[210px]">
                        <span className="font-bold text-[#0b1c30] truncate">
                          الموكل: {s.plaintiff}
                        </span>
                        <span className="text-[11px] text-[#757682] truncate mt-0.5">
                          الخصم: {s.defendant}
                        </span>
                      </div>
                    </td>

                    {/* Date & Time */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-[#0b1c30]">{s.sessionDateHijri}</span>
                        <span className="text-[11px] text-[#757682] mt-0.5">{s.sessionTime}</span>
                        {eff === 'Today' ? (
                          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#dce1ff] text-[#00236f] animate-pulse">
                            متبقي 2 ساعات
                          </span>
                        ) : eff === 'Finished' ? (
                          <span className="mt-1 text-[10px] text-[#9b4500] font-semibold bg-[#ffdbca] px-2 py-0.5 rounded-full">
                            انتهت الجلسة
                          </span>
                        ) : (
                          <span className="mt-1 text-[10px] text-[#00236f] font-semibold bg-[#eff4ff] px-2 py-0.5 rounded-full">
                            قادمة
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Assigned Lawyer */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-xs shrink-0 ${
                            s.assignedLawyer?.includes('سارة')
                              ? 'bg-[#9b4500]'
                              : s.assignedLawyer?.includes('محمد')
                              ? 'bg-[#475569]'
                              : 'bg-[#00236f]'
                          }`}
                        >
                          {s.assignedLawyer?.includes('سارة') ? 'سه' : s.assignedLawyer?.includes('محمد') ? 'مج' : 'أع'}
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="font-semibold text-[#0b1c30]">{s.assignedLawyer}</span>
                          <span className="text-[10px] text-[#757682]">محامي ممارس</span>
                        </div>
                      </div>
                    </td>

                    {/* Session Status */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {eff === 'Today' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#dce1ff] text-[#00236f]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00236f] animate-pulse"></span>
                          مجدولة اليوم
                        </span>
                      ) : s.status === 'Cancelled' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#ffdbca] text-[#9b4500]">
                          مؤجلة رسمياً
                        </span>
                      ) : s.status === 'Finished' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#eff4ff] text-[#444651]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#00236f]" />
                          منتهية ومكتملة
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#eff4ff] text-[#00236f]">
                          قادمة
                        </span>
                      )}
                    </td>

                    {/* Report Status / Action */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {s.reportStatus === 'تدوين التقرير' ? (
                        <Link href={`/reports/${s.id}`}>
                          <button className="px-3.5 py-1.5 rounded-lg bg-[#9b4500] hover:bg-[#763300] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer">
                            تدوين التقرير
                          </button>
                        </Link>
                      ) : s.reportStatus === 'عرض الضبط القضائي' ? (
                        <Link href={`/reports/${s.id}`}>
                          <button className="px-3 py-1 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] text-[#00236f] text-xs font-semibold border border-[#dce9ff] transition-colors cursor-pointer">
                            عرض الضبط القضائي
                          </button>
                        </Link>
                      ) : (
                        <span className="text-[11px] text-[#757682] font-medium">
                          {s.reportStatus}
                        </span>
                      )}
                    </td>

                    {/* Actions Menu */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <Link href={`/sessions/${s.id}`}>
                          <button
                            title="عرض التفاصيل الكاملة"
                            className="w-7 h-7 rounded hover:bg-[#eff4ff] flex items-center justify-center text-[#757682] transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4 text-[#00236f]" />
                          </button>
                        </Link>

                        <button
                          onClick={() => {
                            const text = `تذكير بجلسة القضية ${s.caseNumber} بالمحكمة ${s.court} يوم ${s.sessionDateHijri}`;
                            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                          }}
                          title="إرسال تذكير واتساب"
                          className="w-7 h-7 rounded hover:bg-[#eff4ff] flex items-center justify-center text-[#757682] transition-colors cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4 text-emerald-600" />
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-7 h-7 rounded hover:bg-[#eff4ff] flex items-center justify-center text-[#757682] transition-colors cursor-pointer">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-40 text-right text-xs">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditTarget(s);
                              }}
                              className="cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5 ml-1.5" />
                              تعديل البيانات
                            </DropdownMenuItem>
                            {isAdmin && (
                              <DropdownMenuItem
                                onClick={() => setReassignTarget(s)}
                                className="cursor-pointer"
                              >
                                <UserCog className="w-3.5 h-3.5 ml-1.5 text-[#00236f]" />
                                إعادة تعيين المحامي
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteTarget(s)}
                              className="text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 ml-1.5" />
                              حذف الجلسة
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>

        {/* ── Table Footer & Pagination ── */}
        <div className="pt-4 mt-2 border-t border-[#eff4ff] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#757682]">
          <div className="flex items-center gap-2">
            <span>
              عرض 1 إلى {paginatedSessions.length} من أصل {filteredSessions.length} جلسة مسجلة
            </span>
            <span>|</span>
            <span>لكل صفحة:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-[#eff4ff] text-[#0b1c30] px-2 py-1 rounded border border-[#dce9ff] cursor-pointer"
            >
              <option value={5}>5 جلسات</option>
              <option value={10}>10 جلسات</option>
              <option value={20}>20 جلسة</option>
            </select>
          </div>

          {/* Page Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-7 h-7 rounded border border-[#dce9ff] flex items-center justify-center disabled:opacity-30 hover:bg-[#eff4ff]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                  currentPage === i + 1
                    ? 'bg-[#00236f] text-white shadow-2xs'
                    : 'border border-[#dce9ff] text-[#757682] hover:bg-[#eff4ff]'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-7 h-7 rounded border border-[#dce9ff] flex items-center justify-center disabled:opacity-30 hover:bg-[#eff4ff]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom Analytical Split (Two Panels) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Upcoming Days Schedule (جدول الأيام القادمة) */}
        <div className="lg:col-span-4 bg-white rounded-xl shadow-sm p-4 sm:p-5 border border-[#e5eeff] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#eff4ff]">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-[#00236f]" />
                <h3 className="text-sm font-bold text-[#0b1c30]">جدول الأيام القادمة</h3>
              </div>
              <span className="text-xs font-semibold text-[#00236f]">شهر رجب 1447</span>
            </div>

            <div className="space-y-3.5 pt-3.5 text-xs">
              {/* Day 1 */}
              <div className="p-3 bg-[#eff4ff] rounded-lg flex items-center justify-between">
                <div className="flex flex-col text-right">
                  <span className="font-bold text-[#0b1c30]">الأحد - 29 رجب</span>
                  <span className="text-[11px] text-[#757682]">2 جلسات تجارية وعمالية</span>
                </div>
                <span className="font-bold text-[#00236f] bg-white px-2 py-1 rounded border border-[#dce9ff]">
                  09:30 ص
                </span>
              </div>

              {/* Day 2 */}
              <div className="p-3 bg-[#eff4ff] rounded-lg flex items-center justify-between">
                <div className="flex flex-col text-right">
                  <span className="font-bold text-[#0b1c30]">الإثنين - 30 رجب</span>
                  <span className="text-[11px] text-[#757682]">4 جلسات استئناف ودفاع</span>
                </div>
                <span className="font-bold text-[#00236f] bg-white px-2 py-1 rounded border border-[#dce9ff]">
                  10:00 ص
                </span>
              </div>

              {/* Day 3 */}
              <div className="p-3 bg-[#eff4ff] rounded-lg flex items-center justify-between">
                <div className="flex flex-col text-right">
                  <span className="font-bold text-[#0b1c30]">الثلاثاء - 01 شعبان</span>
                  <span className="text-[11px] text-[#757682]">2 جلسات محكمة التنفيذ</span>
                </div>
                <span className="font-bold text-[#00236f] bg-white px-2 py-1 rounded border border-[#dce9ff]">
                  11:15 ص
                </span>
              </div>
            </div>
          </div>

          {/* AI Helper Banner */}
          <div className="mt-5 p-3.5 bg-[#dce1ff]/50 rounded-xl border border-[#dce1ff] text-right space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#00236f]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>مساعد الترافع الذكي</span>
            </div>
            <p className="text-[11px] text-[#444651] leading-relaxed">
              تم فحص لوائح الجلسة القادمة للقضية <span className="font-bold">#4821</span> بنجاح، تم تجهيز ملخص البينات وسوابق ديوان المظالم للمماثلة القضائية.
            </p>
            <Link href="/chat">
              <span className="text-[11px] text-[#00236f] font-bold hover:underline inline-flex items-center gap-1 mt-1 cursor-pointer">
                فتح حزمة التحليل والمرافعة ←
              </span>
            </Link>
          </div>
        </div>

        {/* Right Side: Monthly Performance Report (التقرير الشهري لإنجاز الجلسات) */}
        <div className="lg:col-span-8 bg-white rounded-xl shadow-sm p-4 sm:p-5 border border-[#e5eeff] flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#eff4ff] gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#00236f]" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#0b1c30]">التقرير الشهري لإنجاز الجلسات والمرافعات</h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#dce1ff] text-[#00236f]">
                      خاص بالإدارة
                    </span>
                  </div>
                  <p className="text-xs text-[#757682]">مؤشرات عقد الجلسات، الأحكام الصادرة، ونسب إنجاز التقارير حسب المحامي المكلف</p>
                </div>
              </div>

              <button
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] text-[#00236f] text-xs font-semibold cursor-pointer border border-[#dce9ff]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصدير (CSV)</span>
              </button>
            </div>

            <div className="space-y-4 pt-4 text-xs">
              {lawyerPerformance.length === 0 ? (
                <div className="py-8 text-center text-[#757682]">
                  لا توجد جلسات مسجلة للمحامين حالياً
                </div>
              ) : (
                lawyerPerformance.map((lp, idx) => (
                  <div key={lp.name} className="p-3.5 bg-[#eff4ff] rounded-xl flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs shrink-0 ${
                            idx === 0 ? 'bg-[#00236f]' : idx === 1 ? 'bg-[#9b4500]' : 'bg-[#475569]'
                          }`}
                        >
                          {lp.name.slice(0, 2)}
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="font-bold text-[#0b1c30]">{lp.name}</span>
                          <span className="text-[11px] text-[#757682]">
                            {lp.total} جلسة ترافع • {lp.needsReport > 0 ? `${lp.needsReport} يتطلب تقرير` : 'مكتملة بالكامل'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-[#00236f] text-sm">{lp.pct}%</span>
                        <span className="text-[10px] text-[#757682]">معدل الإنجاز القضائي</span>
                      </div>
                    </div>
                    <div className="w-full bg-white h-2 rounded-full overflow-hidden">
                      <div className="bg-[#00236f] h-full rounded-full" style={{ width: `${lp.pct}%` }}></div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Dialog: Add Session ── */}
      <Dialog open={isAddSessionOpen} onOpenChange={setIsAddSessionOpen}>
        <DialogContent className="max-w-lg w-full bg-white text-[#0b1c30] p-6 rounded-xl border border-[#e5eeff]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-[#00236f] flex items-center gap-2">
              <CalendarCheck className="w-5 h-5" />
              <span>إضافة جلسة قضائية جديدة</span>
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateSession();
            }}
            className="space-y-4 pt-2 text-right text-xs"
          >
            <div className="space-y-1">
              <Label className="text-xs font-semibold">رقم القضية *</Label>
              <Input
                placeholder="مثال: 4821/2026"
                value={newSessionForm.caseNumber}
                onChange={(e) => setNewSessionForm({ ...newSessionForm, caseNumber: e.target.value })}
                required
                className="bg-[#eff4ff] border-transparent text-xs h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">المحكمة *</Label>
                <Input
                  value={newSessionForm.court}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, court: e.target.value })}
                  required
                  className="bg-[#eff4ff] border-transparent text-xs h-10"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">الدائرة القضائية *</Label>
                <Input
                  value={newSessionForm.courtCircuit}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, courtCircuit: e.target.value })}
                  required
                  className="bg-[#eff4ff] border-transparent text-xs h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">المدعي *</Label>
                <Input
                  placeholder="اسم المدعي / الموكل"
                  value={newSessionForm.plaintiff}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, plaintiff: e.target.value })}
                  required
                  className="bg-[#eff4ff] border-transparent text-xs h-10"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">المدعى عليه *</Label>
                <Input
                  placeholder="اسم المدعى عليه / الخصم"
                  value={newSessionForm.defendant}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, defendant: e.target.value })}
                  required
                  className="bg-[#eff4ff] border-transparent text-xs h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">تاريخ الجلسة *</Label>
                <Input
                  type="date"
                  value={newSessionForm.hearingAt}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, hearingAt: e.target.value })}
                  required
                  className="bg-[#eff4ff] border-transparent text-xs h-10"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">الوقت *</Label>
                <Input
                  type="time"
                  value={newSessionForm.sessionTime}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, sessionTime: e.target.value })}
                  required
                  className="bg-[#eff4ff] border-transparent text-xs h-10"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:justify-start">
              <Button type="submit" className="bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs h-10 px-5">
                حفظ الجلسة
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsAddSessionOpen(false)} className="text-xs h-10">
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="bg-white text-[#0b1c30]" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right text-[#ba1a1a]">تأكيد حذف الجلسة</AlertDialogTitle>
            <AlertDialogDescription className="text-right text-xs text-[#757682]">
              هل أنت متأكد من رغبتك في حذف جلسة القضية {deleteTarget?.caseNumber}؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogAction
              onClick={() => deleteTarget && deleteSessionMutation.mutate({ id: Number(deleteTarget.id) })}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs"
            >
              حذف
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
          module="sessions"
          recordId={reassignTarget.id}
          currentLawyerId={(reassignTarget as any).assignedLawyerId || (reassignTarget as any).assigned_lawyer_id}
          recordTitle={`جلسة القضية ${reassignTarget.caseNumber || ''}`}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
            setReassignTarget(null);
            toast({ title: 'تمت إعادة تعيين المحامي بنجاح' });
          }}
        />
      )}
    </div>
  );
}
