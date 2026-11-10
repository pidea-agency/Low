import { useState, useEffect, useCallback } from 'react';
import { useListSessions, useDeleteSession, useUpdateSession, useGetCurrentUser, getListSessionsQueryKey, getGetDashboardStatsQueryKey } from '@workspace/api-client-react';
import type { SessionStatus } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import {
  Calendar,
  ChevronLeft,
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
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { TimeRemainingBadge } from '@/components/time-remaining';
import { sortSessions, type SortOption } from '@/lib/session-sort';
import { getArabicDayName } from '@/lib/hijri';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ClientPicker } from '@/components/clients/client-picker';
import { LawyerSelect } from '@/components/clients/lawyer-select';
import { ReassignDialog } from '@/components/clients/reassign-dialog';
import { TablePagination } from '@/components/ui/table-pagination';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const statusOptions: { value: SessionStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'Today', label: 'اليوم' },
  { value: 'Upcoming', label: 'قادمة' },
  { value: 'Finished', label: 'منتهية' },
  { value: 'Cancelled', label: 'ملغية' },
];

/**
 * Derives the effective display status using hearingAt date so that sessions
 * whose stored status is still "Upcoming" correctly show as "Finished" or "Today".
 */
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

const statusLabelMap: Record<SessionStatus, string> = {
  Today: 'اليوم',
  Upcoming: 'قادمة',
  Finished: 'منتهية',
  Cancelled: 'ملغية',
};

const statusStyleMap: Record<SessionStatus, { badge: string; dot: string }> = {
  Today: {
    badge: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/20',
    dot: 'bg-emerald-600',
  },
  Upcoming: {
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-500',
  },
  Finished: {
    badge: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground',
  },
  Cancelled: {
    badge: 'bg-destructive/10 text-destructive border-destructive/20',
    dot: 'bg-destructive',
  },
};

const quickEditFields = [
  { key: 'caseNumber', label: 'رقم القضية', dir: 'ltr' as const, mono: true },
  { key: 'plaintiff', label: 'المدّعي', dir: 'rtl' as const },
  { key: 'defendant', label: 'المدّعى عليه', dir: 'rtl' as const },
  { key: 'court', label: 'المحكمة', dir: 'rtl' as const },
  { key: 'sessionDateHijri', label: 'تاريخ الجلسة (هجري)', dir: 'ltr' as const, mono: true },
  { key: 'sessionTime', label: 'وقت الجلسة', dir: 'ltr' as const, mono: true },
];

type SessionItem = {
  id: number;
  caseNumber?: string | null;
  plaintiff?: string | null;
  defendant?: string | null;
  court?: string | null;
  courtCircuit?: string | null;
  sessionDateHijri?: string | null;
  sessionDay?: string | null;
  sessionTime?: string | null;
  status: SessionStatus;
  hearingAt?: string | null;
  [key: string]: unknown;
};

export default function SessionsPage() {
  const [statusFilter, setStatusFilter] = useState<SessionStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('nearest');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: currentUser } = useGetCurrentUser();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // Monthly Report Summary State (Admin-only)
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [isLoadingMonthly, setIsLoadingMonthly] = useState<boolean>(false);
  const [isMonthlyCollapsed, setIsMonthlyCollapsed] = useState<boolean>(false);

  const loadMonthlyReport = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingMonthly(true);
    try {
      const res = await fetch(`/api/reports/monthly?month=${selectedMonth}&year=${selectedYear}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        setMonthlyData(json);
      }
    } catch (err) {
      console.error('Failed to load monthly report', err);
    } finally {
      setIsLoadingMonthly(false);
    }
  }, [isAdmin, selectedMonth, selectedYear]);

  useEffect(() => {
    loadMonthlyReport();
  }, [loadMonthlyReport]);

  const handleExportCsv = () => {
    if (!monthlyData) return;
    const headers = ['المحامي', 'الجلسات المعقودة', 'الأحكام الصادرة', 'المهام المنجزة'];
    const rows = [
      ['الإجمالي العام للمكتب', monthlyData.overall.sessionsHeld, monthlyData.overall.judgmentsClosed, monthlyData.overall.tasksCompleted],
      ...monthlyData.byLawyer.map((l: any) => [
        `"${l.lawyerName}"`,
        l.sessionsHeld,
        l.judgmentsClosed,
        l.tasksCompleted,
      ]),
    ];
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monthly-report-${selectedYear}-${selectedMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<SessionItem | null>(null);

  // Edit state
  const [editTarget, setEditTarget] = useState<SessionItem | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [reassignTarget, setReassignTarget] = useState<SessionItem | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: sessions, isLoading, error, refetch } = useListSessions(
    statusFilter === 'all' ? undefined : { status: statusFilter }
  );

  const sortedSessions = Array.isArray(sessions) ? sortSessions(sessions, sortBy) : [];
  const totalItems = sortedSessions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedSessions = sortedSessions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const deleteMutation = useDeleteSession();
  const updateMutation = useUpdateSession();

  const openEdit = (session: SessionItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditForm({
      caseNumber: session.caseNumber || '',
      plaintiff: session.plaintiff || '',
      defendant: session.defendant || '',
      court: session.court || '',
      courtCircuit: (session.courtCircuit as string) || '',
      sessionDateHijri: session.sessionDateHijri || '',
      sessionTime: session.sessionTime || '',
      status: session.status,
      clientId: ((session as any).clientId || (session as any).client_id || '') as string,
      clientRole: ((session as any).clientRole || (session as any).client_role || '') as string,
      assignedLawyerId: ((session as any).assignedLawyerId || (session as any).assigned_lawyer_id || '') as string,
    });
    setEditTarget(session);
  };

  const openDelete = (session: SessionItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget(session);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          toast({ title: 'تم الحذف', description: 'تم حذف الجلسة بنجاح' });
          setDeleteTarget(null);
        },
        onError: (err: any) => {
          toast({ title: 'فشل الحذف', description: err?.message || 'تعذّر حذف الجلسة', variant: 'destructive' });
          setDeleteTarget(null);
        },
      }
    );
  };

  const handleEditSave = () => {
    if (!editTarget) return;
    updateMutation.mutate(
      { id: editTarget.id, data: editForm },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          toast({ title: 'تم الحفظ', description: 'تم تحديث الجلسة بنجاح' });
          setEditTarget(null);
        },
        onError: (err: any) => {
          toast({ title: 'فشل الحفظ', description: err?.message || 'تعذّر تحديث الجلسة', variant: 'destructive' });
        },
      }
    );
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="fade-in-up flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 rounded-full bg-primary" />
            <h1 className="text-2xl font-bold tracking-tight">جلسات المحكمة</h1>
          </div>
          <p className="text-muted-foreground text-sm mr-3">عرض وإدارة جميع جلسات الاستماع مرتبة بالتوقيت الأقرب</p>
        </div>
        <Link href="/chat">
          <Button size="sm" className="gap-2 shrink-0 shadow-md shadow-[#C99732]/25 bg-[#C99732] hover:bg-[#B28325] text-white rounded-xl font-bold border-0" data-testid="button-add-session-header">
            <Plus className="w-4 h-4" />
            + إضافة جلسة
          </Button>
        </Link>
      </div>

      {/* Monthly Report Summary (Admin Only) */}
      {isAdmin && (
        <Card className="border border-border p-5 space-y-4 bg-card/60 shadow-sm fade-in-up">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setIsMonthlyCollapsed(!isMonthlyCollapsed)}
              className="flex items-center gap-2 cursor-pointer text-right group focus:outline-none"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#C99732] shrink-0"
                style={{ background: 'linear-gradient(135deg, #0B2A4A, #071D34)' }}
              >
                <CalendarDays className="w-4 h-4 text-[#C99732]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                    التقرير الشهري المجمع للمكتب
                  </h2>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#C99732]/15 text-[#C99732] font-semibold border border-[#C99732]/30">
                    خاص بالمدير
                  </span>
                  {isMonthlyCollapsed ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  إحصائيات إنجاز الجلسات والأحكام والمهام حسب المحامي المسؤول
                </p>
              </div>
            </button>

            {/* Filter controls + Export CSV */}
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={String(selectedMonth)}
                onValueChange={(v) => setSelectedMonth(parseInt(v, 10))}
              >
                <SelectTrigger className="h-8 text-xs bg-card border-border w-[110px]">
                  <SelectValue placeholder="الشهر" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      شهر {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={String(selectedYear)}
                onValueChange={(v) => setSelectedYear(parseInt(v, 10))}
              >
                <SelectTrigger className="h-8 text-xs bg-card border-border w-[90px]">
                  <SelectValue placeholder="السنة" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={!monthlyData || isLoadingMonthly}
                className="h-8 text-xs gap-1.5 border-[#C99732]/40 text-[#C99732] hover:bg-[#C99732]/10 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصدير (CSV)</span>
              </Button>
            </div>
          </div>

          {!isMonthlyCollapsed && (
            <>
              {isLoadingMonthly ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : monthlyData ? (
                <div className="space-y-4 pt-1">
                  {/* Overall KPI cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-blue-600" />
                        <span className="text-xs text-muted-foreground font-medium">جلسات معقودة</span>
                      </div>
                      <span className="font-bold text-base font-mono text-blue-700 dark:text-blue-400">
                        {monthlyData.overall.sessionsHeld}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gavel className="w-4 h-4 text-amber-600" />
                        <span className="text-xs text-muted-foreground font-medium">أحكام صادرة</span>
                      </div>
                      <span className="font-bold text-base font-mono text-amber-700 dark:text-amber-400">
                        {monthlyData.overall.judgmentsClosed}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs text-muted-foreground font-medium">مهام مكتملة</span>
                      </div>
                      <span className="font-bold text-base font-mono text-emerald-700 dark:text-emerald-400">
                        {monthlyData.overall.tasksCompleted}
                      </span>
                    </div>
                  </div>

                  {/* Per-Lawyer Breakdown */}
                  {monthlyData.byLawyer && monthlyData.byLawyer.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="border-b border-border/60 text-muted-foreground">
                            <th className="pb-2 font-medium">المحامي</th>
                            <th className="pb-2 font-medium text-center">الجلسات المنعقدة</th>
                            <th className="pb-2 font-medium text-center">الأحكام الصادرة</th>
                            <th className="pb-2 font-medium text-center">المهام المكتملة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {monthlyData.byLawyer.map((l: any) => (
                            <tr key={l.lawyerId} className="hover:bg-muted/40 transition-colors">
                              <td className="py-2.5 font-semibold text-foreground">
                                {l.lawyerName}
                              </td>
                              <td className="py-2.5 text-center font-mono font-medium">
                                {l.sessionsHeld}
                              </td>
                              <td className="py-2.5 text-center font-mono font-medium">
                                {l.judgmentsClosed}
                              </td>
                              <td className="py-2.5 text-center font-mono font-medium">
                                {l.tasksCompleted}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </Card>
      )}

      {/* Filter Tabs & Sort Dropdown */}
      <div className="fade-in-up fade-in-up-delay-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 p-1 bg-white rounded-2xl border border-[#D6E0EC] w-fit shadow-xs">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                setStatusFilter(option.value);
                setCurrentPage(1);
              }}
              data-testid={`filter-${option.value}`}
              className={`px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-150 cursor-pointer ${
                statusFilter === option.value
                  ? 'bg-[#C99732] text-white shadow-xs'
                  : 'text-[#64748B] hover:text-[#10233F] hover:bg-slate-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2">
          <Select
            value={sortBy}
            onValueChange={(v) => {
              setSortBy(v as SortOption);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-xs gap-1.5 bg-card border-border min-w-[170px]" data-testid="select-sort-sessions">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="الترتيب" />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="nearest">الأقرب زمناً (تلقائي)</SelectItem>
              <SelectItem value="furthest">الأبعد زمناً</SelectItem>
              <SelectItem value="newest">أحدث مضافاً</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content Rendering: Loading -> Error -> List -> Empty */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start gap-4">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="fade-in-up rounded-2xl border border-destructive/30 bg-destructive/8 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-destructive/15 text-destructive flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-destructive">
              {(error as any)?.status === 409 ? 'تنبيه إعدادات المكتب' : 'فشل تحميل قائمة الجلسات'}
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              {(error as any)?.data?.error || (error as any)?.message || 'تعذر الاتصال بـ Google Sheets لجلب بيانات الجلسات. يرجى التحقق من اتصال الشبكة وصلاحيات ملف الاعتماد ثم إعادة المحاولة.'}
            </p>
          </div>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            إعادة محاولة التحميل
          </Button>
        </div>
      ) : totalItems > 0 ? (
        <div className="space-y-3 fade-in-up fade-in-up-delay-2">
          {paginatedSessions.map((session, i) => {
            const effectiveStatus = deriveEffectiveStatus(session.status, session.hearingAt);
            const style = statusStyleMap[effectiveStatus];
            const hasReport = Boolean(
              (session as any).has_report ?? (session as any).hasReport ?? (session as any).report
            );

            return (
              <div key={session.id} className="relative group" style={{ animationDelay: `${i * 0.04}s` }}>
                <Link href={`/sessions/${session.id}`}>
                  <div className="rounded-xl border border-border bg-card p-5 cursor-pointer transition-all duration-200 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <Scale className="w-5 h-5 text-primary" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-base font-mono" data-testid={`session-case-${session.id}`}>
                              {session.caseNumber || '—'}
                            </h3>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                              {statusLabelMap[effectiveStatus]}
                            </span>
                            {/* "حالة التقرير" badge */}
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                hasReport
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                              }`}
                              data-testid={`session-report-status-${session.id}`}
                            >
                              <FileText className="w-3 h-3" />
                              {hasReport ? 'مكتمل' : 'لم يُكتب بعد'}
                            </span>
                          </div>

                          {/* Inline Actions: "التقرير" button + Actions Dropdown */}
                          <div className="flex items-center gap-2 shrink-0">
                            <Link
                              href={`/reports/${session.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#C99732]/10 text-[#C99732] hover:bg-[#C99732]/20 border border-[#C99732]/30 transition-colors cursor-pointer"
                              data-testid={`button-view-report-${session.id}`}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>التقرير</span>
                            </Link>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150 focus:outline-none cursor-pointer"
                                  data-testid={`button-session-menu-${session.id}`}
                                  aria-label="خيارات الجلسة"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/reports/${session.id}`}
                                    className="gap-2 cursor-pointer flex items-center text-foreground"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-[#C99732]" />
                                    <span>كتابة / عرض التقرير</span>
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => openEdit(session as unknown as SessionItem, e)}
                                  className="gap-2 cursor-pointer"
                                  data-testid={`button-edit-session-${session.id}`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  تعديل سريع
                                </DropdownMenuItem>
                                {isAdmin && (
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setReassignTarget(session as unknown as SessionItem);
                                    }}
                                    className="gap-2 cursor-pointer text-primary focus:text-primary focus:bg-primary/10"
                                  >
                                    <UserCog className="w-3.5 h-3.5" />
                                    إعادة تعيين المحامي
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => openDelete(session as unknown as SessionItem, e)}
                                  className="gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                                  data-testid={`button-delete-session-${session.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  حذف الجلسة
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                          {session.plaintiff && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <User className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{session.plaintiff}</span>
                              {session.defendant && <span className="text-muted-foreground/50">←</span>}
                              {session.defendant && <span className="truncate">{session.defendant}</span>}
                            </div>
                          )}
                          {session.court && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Scale className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{session.court}</span>
                            </div>
                          )}
                          {(session.sessionDateHijri || session.hearingAt) && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Calendar className="w-3.5 h-3.5 shrink-0" />
                              {getArabicDayName(session) && (
                                <span className="font-medium text-foreground">{getArabicDayName(session)}</span>
                              )}
                              {getArabicDayName(session) && session.sessionDateHijri && (
                                <span className="text-muted-foreground/50">·</span>
                              )}
                              {session.sessionDateHijri && <span className="font-mono">{session.sessionDateHijri}</span>}
                              {session.sessionTime && (
                                <span className="font-mono text-muted-foreground/70">· {session.sessionTime}</span>
                              )}
                            </div>
                          )}
                          {session.hearingAt && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <TimeRemainingBadge hearingAt={session.hearingAt} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>


              </div>
            );
          })}

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
        </div>
      ) : (
        <div className="fade-in-up fade-in-up-delay-2 rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
            <Calendar className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">لا توجد جلسات</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
            {statusFilter === 'all'
              ? 'لم يتم إضافة أي جلسات بعد. ابدأ بتحليل رسالة محكمة.'
              : `لا توجد جلسات بحالة "${statusLabelMap[statusFilter as SessionStatus] ?? statusFilter}"`}
          </p>
          <Link href="/chat">
            <Button className="gap-2" data-testid="button-add-session">
              <Plus className="w-4 h-4" />
              إضافة جلسة جديدة
            </Button>
          </Link>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الجلسة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف الجلسة{' '}
              {deleteTarget?.caseNumber ? (
                <span className="font-mono font-semibold">{deleteTarget.caseNumber}</span>
              ) : (
                'هذه'
              )}
              ؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? 'جارٍ الحذف...' : 'تأكيد الحذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Quick Edit Dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Pencil className="w-4 h-4 text-primary" />
              </div>
              تعديل الجلسة
              {editTarget?.caseNumber && (
                <span className="font-mono text-sm text-muted-foreground font-normal">— {editTarget.caseNumber}</span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Status Select */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                الحالة
              </Label>
              <Select
                value={editForm.status}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="h-9 text-sm" data-testid="quick-edit-select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Upcoming">قادمة</SelectItem>
                  <SelectItem value="Today">اليوم</SelectItem>
                  <SelectItem value="Finished">منتهية</SelectItem>
                  <SelectItem value="Cancelled">ملغية</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Client & Lawyer Linking */}
            <div className="space-y-3 p-3 rounded-xl border border-border/60 bg-muted/20">
              <div className="space-y-1.5">
                <ClientPicker
                  value={editForm.clientId || null}
                  onChange={(cid) => setEditForm((prev) => ({ ...prev, clientId: cid || '' }))}
                  label="العميل المرتبط"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  طرف موكلنا في الدعوى
                </Label>
                <Select
                  value={editForm.clientRole || 'none'}
                  onValueChange={(val) => setEditForm((prev) => ({ ...prev, clientRole: val === 'none' ? '' : val }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="اختر صفة الموكل" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">غير محدد</SelectItem>
                    <SelectItem value="plaintiff">المدّعي</SelectItem>
                    <SelectItem value="defendant">المدّعى عليه</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <LawyerSelect
                  value={editForm.assignedLawyerId || null}
                  onChange={(lid, lawyerName) =>
                    setEditForm((prev) => ({
                      ...prev,
                      assignedLawyerId: lid || '',
                      assignedLawyer: lawyerName || prev.assignedLawyer || '',
                    }))
                  }
                  currentRole={currentUser?.role}
                  currentUserId={currentUser?.id}
                  currentUserName={(currentUser as any)?.displayName || currentUser?.username}
                  label="المحامي المكلف"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {quickEditFields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label
                    htmlFor={`quick-edit-${f.key}`}
                    className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                  >
                    {f.label}
                  </Label>
                  <Input
                    id={`quick-edit-${f.key}`}
                    value={editForm[f.key] || ''}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    className={`${f.mono ? 'font-mono' : ''} h-9 text-sm`}
                    dir={f.dir}
                    data-testid={`quick-edit-input-${f.key}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 flex-row-reverse">
            <Button
              onClick={handleEditSave}
              disabled={updateMutation.isPending}
              className="gap-2 flex-1"
              data-testid="button-quick-edit-save"
            >
              {updateMutation.isPending ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={updateMutation.isPending}
              data-testid="button-quick-edit-cancel"
            >
              إلغاء
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
          module="sessions"
          recordId={reassignTarget.id}
          recordTitle={`جلسة ${reassignTarget.caseNumber || reassignTarget.id}`}
          currentLawyerId={(reassignTarget as any).assignedLawyerId || (reassignTarget as any).assigned_lawyer_id}
          onSuccess={() => {
            setReassignTarget(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
