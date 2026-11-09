import { useState, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { useListSessions, useGetCurrentUser } from '@workspace/api-client-react';
import {
  FileText,
  ChevronLeft,
  CheckCircle2,
  Clock,
  Scale,
  User,
  ArrowUpDown,
  AlertCircle,
  RefreshCw,
  Download,
  CalendarDays,
  Gavel,
  CheckSquare,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { sortSessions, type SortOption } from '@/lib/session-sort';
import { getArabicDayName } from '@/lib/hijri';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function deriveEffectiveStatus(storedStatus: string, hearingAt: string | null | undefined) {
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

export default function ReportsPage() {
  const [sortBy, setSortBy] = useState<SortOption>('nearest');
  const { data: sessions, isLoading, error, refetch } = useListSessions();
  const { data: currentUser } = useGetCurrentUser();
  const isAdmin = currentUser?.role === 'admin' || (currentUser as any)?.role === 'admin';

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [isLoadingMonthly, setIsLoadingMonthly] = useState<boolean>(false);

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

  const sortedSessions = Array.isArray(sessions) ? sortSessions(sessions, sortBy) : [];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="fade-in-up flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 rounded-full bg-primary" />
            <h1 className="text-2xl font-bold tracking-tight">تقارير الجلسات</h1>
          </div>
          <p className="text-muted-foreground text-sm mr-3">
            إدارة وعرض تقارير الجلسات مرتبة حسب التوقيت الأقرب
          </p>
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="h-9 text-xs gap-1.5 bg-card border-border min-w-[170px]" data-testid="select-sort-reports">
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

      {/* Monthly Report Summary (Admin Only) */}
      {isAdmin && (
        <Card className="border border-border p-5 space-y-4 bg-card/60 shadow-sm fade-in-up">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[#C99732]"
                style={{ background: 'linear-gradient(135deg, #0B2A4A, #071D34)' }}
              >
                <CalendarDays className="w-4 h-4 text-[#C99732]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">التقرير الشهري المجمع للمكتب</h2>
                <p className="text-xs text-muted-foreground">إحصائيات إنجاز الجلسات والأحكام والمهام حسب المحامي المسؤول</p>
              </div>
            </div>

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
                className="h-8 text-xs gap-1.5 border-[#C99732]/40 text-[#C99732] hover:bg-[#C99732]/10"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصدير (CSV)</span>
              </Button>
            </div>
          </div>

          {isLoadingMonthly ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : monthlyData ? (
            <div className="space-y-4">
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
        </Card>
      )}

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
            <h3 className="text-base font-bold text-destructive">فشل تحميل قائمة تقارير الجلسات</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              تعذر الاتصال بـ Google Sheets لجلب بيانات الجلسات. يرجى التحقق من اتصال الشبكة وصلاحيات ملف الاعتماد ثم إعادة المحاولة.
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
            const isFinished = effectiveStatus === 'Finished';

            return (
              <Link key={session.id} href={`/reports/${session.id}`}>
                <div
                  className="group rounded-xl border border-border bg-card p-5 cursor-pointer transition-all duration-200 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isFinished ? 'bg-emerald-500/10 group-hover:bg-emerald-500/20' : 'bg-primary/10 group-hover:bg-primary/20'}`}>
                      <FileText className={`w-5 h-5 ${isFinished ? 'text-emerald-500' : 'text-primary'}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-base font-mono">
                            {session.caseNumber || '—'}
                          </h3>
                          {/* Report status badge */}
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            isFinished
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-muted text-muted-foreground border-border'
                          }`}>
                            {isFinished ? (
                              <><CheckCircle2 className="w-3 h-3" /> جاهزة للتقرير</>
                            ) : (
                              <><Clock className="w-3 h-3" /> لم تُعقد بعد</>
                            )}
                          </span>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
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
                          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                            📅 {getArabicDayName(session) && <span className="font-medium text-foreground">{getArabicDayName(session)} ·</span>}
                            {session.sessionDateHijri && <span className="font-mono">{session.sessionDateHijri}</span>}
                            {session.sessionTime && <span className="font-mono text-muted-foreground/70">· {session.sessionTime}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="fade-in-up fade-in-up-delay-2 rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">لا توجد جلسات</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            أضف جلسات أولاً من قسم "تحليل رسالة" ثم ادخل التقارير هنا.
          </p>
        </div>
      )}
    </div>
  );
}
