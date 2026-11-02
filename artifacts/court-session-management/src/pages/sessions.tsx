import { useState } from 'react';
import { useListSessions, useDeleteSession, useUpdateSession, getListSessionsQueryKey, getGetDashboardStatsQueryKey } from '@workspace/api-client-react';
import type { SessionStatus } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import { Calendar, ChevronLeft, Plus, Scale, Clock, User, MoreVertical, Pencil, Trash2, ArrowUpDown, AlertCircle, RefreshCw } from 'lucide-react';
import { TimeRemainingBadge } from '@/components/time-remaining';
import { sortSessions, type SortOption } from '@/lib/session-sort';
import { getArabicDayName } from '@/lib/hijri';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
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

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<SessionItem | null>(null);

  // Edit state
  const [editTarget, setEditTarget] = useState<SessionItem | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: sessions, isLoading, error, refetch } = useListSessions(
    statusFilter === 'all' ? undefined : { status: statusFilter }
  );

  const sortedSessions = Array.isArray(sessions) ? sortSessions(sessions, sortBy) : [];

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
      courtCircuit: session.courtCircuit as string || '',
      sessionDateHijri: session.sessionDateHijri || '',
      sessionTime: session.sessionTime || '',
      status: session.status,
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
          <Button size="sm" className="gap-2 shrink-0 shadow-sm" data-testid="button-add-session-header">
            <Plus className="w-4 h-4" />
            إضافة جلسة
          </Button>
        </Link>
      </div>

      {/* Filter Tabs & Sort Dropdown */}
      <div className="fade-in-up fade-in-up-delay-1 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 p-1 bg-muted rounded-xl border border-border w-fit">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setStatusFilter(option.value)}
              data-testid={`filter-${option.value}`}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                statusFilter === option.value
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
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
      ) : sortedSessions.length > 0 ? (
        <div className="space-y-3 fade-in-up fade-in-up-delay-2">
          {sortedSessions.map((session, i) => {
            const effectiveStatus = deriveEffectiveStatus(session.status, session.hearingAt);
            const style = statusStyleMap[effectiveStatus];
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
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-base font-mono" data-testid={`session-case-${session.id}`}>
                              {session.caseNumber || '—'}
                            </h3>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                              {statusLabelMap[effectiveStatus]}
                            </span>
                          </div>
                          {/* Spacer for the absolute menu button */}
                          <div className="w-8 h-8 shrink-0" />
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

                {/* Actions Dropdown — sits outside the Link to avoid navigation */}
                <div className="absolute top-4 left-4 z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-all duration-150 focus:opacity-100 focus:outline-none"
                        data-testid={`button-session-menu-${session.id}`}
                        aria-label="خيارات الجلسة"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onClick={(e) => openEdit(session as unknown as SessionItem, e)}
                        className="gap-2 cursor-pointer"
                        data-testid={`button-edit-session-${session.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        تعديل سريع
                      </DropdownMenuItem>
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
            );
          })}
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
    </div>
  );
}
