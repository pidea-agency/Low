import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useGetDashboardStats,
  useGetCurrentUser,
  useListSessions,
  type Session,
} from '@workspace/api-client-react';
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Sparkles,
  FileKey,
  Gavel,
  XCircle,
  CheckSquare,
  AlertTriangle,
  AlertCircle,
  Users,
  Settings,
  CreditCard,
  Building2,
  BarChart3,
  Search,
  User,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Link } from 'wouter';
import {
  StatCard,
  SessionListItem,
  UrgentTaskItem,
  AiQuotaCard,
  QuickActionCard,
  SubscriptionBanner,
  SessionsTrendChart,
  SessionsStatusDonutChart,
  TasksStatusChart,
  CourtsDistributionChart,
  TeamAiUsageChart,
  type DashboardChartsData,
} from '@/components/dashboard';

interface OfficeTask {
  id: number;
  title: string;
  assignee: string;
  priority: string;
  dueDate: string;
  status: string;
  notes?: string;
}

function deriveEffectiveStatus(storedStatus: string, hearingAt: string | null | undefined): string {
  if (storedStatus === 'Cancelled' || storedStatus === 'Finished') return storedStatus;
  if (!hearingAt) return storedStatus || 'Upcoming';
  const hearingTime = new Date(hearingAt).getTime();
  if (isNaN(hearingTime)) return storedStatus || 'Upcoming';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000;
  if (hearingTime < todayStart) return 'Finished';
  if (hearingTime >= todayStart && hearingTime < todayEnd) return 'Today';
  return 'Upcoming';
}

export default function DashboardAdminPage() {
  const { data: statsData, isLoading: isLoadingStats, error: statsError } = useGetDashboardStats();
  const { data: currentUser } = useGetCurrentUser();
  const {
    data: allSessions = [],
    isLoading: isLoadingSessions,
    error: sessionsError,
    refetch: refetchSessions,
  } = useListSessions();

  const [chartsData, setChartsData] = useState<DashboardChartsData | null>(null);
  const [isLoadingCharts, setIsLoadingCharts] = useState(true);

  const { data: poas = [], isLoading: isLoadingPoas } = useQuery<any[]>({
    queryKey: ['/api/poa'],
    queryFn: async () => {
      const res = await fetch('/api/poa', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const expiringPoasCount = useMemo(() => {
    if (!Array.isArray(poas)) return 0;
    return poas.filter((p) => {
      const days = p.daysRemaining ?? 0;
      return days > 0 && days <= 7;
    }).length;
  }, [poas]);

  // Load office dashboard charts
  useEffect(() => {
    let isMounted = true;
    setIsLoadingCharts(true);
    fetch('/api/dashboard/charts', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) {
          setChartsData(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoadingCharts(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const [urgentTasks, setUrgentTasks] = useState<OfficeTask[]>([]);
  const [allOfficeTasks, setAllOfficeTasks] = useState<OfficeTask[]>([]);
  const [officeMembers, setOfficeMembers] = useState<Array<{ id: string; username: string; displayName?: string }>>([]);
  const [membersCount, setMembersCount] = useState<number | null>(null);

  // Filter state for Office Team Oversight
  const [selectedLawyerFilter, setSelectedLawyerFilter] = useState<string>('all');
  const [sessionStatusFilter, setSessionStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeOversightTab, setActiveOversightTab] = useState<'sessions' | 'tasks' | 'poas'>('sessions');

  const lawyerNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    officeMembers.forEach((m) => {
      map[m.id] = m.displayName || m.username;
    });
    return map;
  }, [officeMembers]);

  const getLawyerName = useCallback(
    (record: any): string | null => {
      if (!record) return null;
      const id = record.assignedLawyerId || record.assigned_lawyer_id;
      if (id && lawyerNameMap[id]) return lawyerNameMap[id];
      if (record.assignedLawyer) return record.assignedLawyer;
      if (record.assigned_lawyer) return record.assigned_lawyer;
      if (record.assignee) return record.assignee;
      return null;
    },
    [lawyerNameMap]
  );

  // Load office members
  useEffect(() => {
    let isMounted = true;
    fetch('/api/users', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.users) {
          setMembersCount(data.users.length);
          setOfficeMembers(
            data.users.map((u: any) => ({
              id: u.id,
              username: u.username,
              displayName: u.displayName || u.display_name || u.username,
            }))
          );
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Load office tasks
  useEffect(() => {
    let isMounted = true;
    fetch('/api/tasks', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          setAllOfficeTasks(data);
          const urgent = data
            .filter((t: OfficeTask) => t.status !== 'مكتملة' && t.status !== 'ملغاة')
            .slice(0, 5);
          setUrgentTasks(urgent);
        }
      })
      .catch(() => {
        try {
          const raw = localStorage.getItem('legal_tasks_v1');
          if (raw && isMounted) {
            const parsed = JSON.parse(raw);
            setAllOfficeTasks(parsed);
            const filtered = parsed
              .filter((t: any) => t.status !== 'مكتملة' && t.status !== 'ملغاة')
              .slice(0, 5);
            setUrgentTasks(filtered);
          }
        } catch {
          // ignore
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Computed: Filtered Office Sessions
  const filteredOfficeSessions = useMemo(() => {
    return (allSessions || []).filter((s: Session) => {
      // 1. Status filter
      if (sessionStatusFilter !== 'all') {
        const eff = deriveEffectiveStatus(s.status, s.hearingAt);
        if (eff !== sessionStatusFilter) return false;
      }
      const lawyer = getLawyerName(s) || '';
      // 2. Lawyer filter
      if (selectedLawyerFilter !== 'all') {
        const text = `${s.notes || ''} ${s.plaintiff || ''} ${s.defendant || ''} ${s.courtCircuit || ''} ${lawyer}`.toLowerCase();
        if (!text.includes(selectedLawyerFilter.toLowerCase())) return false;
      }
      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const text = `${s.caseNumber || ''} ${s.court || ''} ${s.plaintiff || ''} ${s.defendant || ''} ${s.notes || ''} ${lawyer}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [allSessions, sessionStatusFilter, selectedLawyerFilter, searchQuery, getLawyerName]);

  // Computed: Filtered Office Tasks
  const filteredOfficeTasks = useMemo(() => {
    return (allOfficeTasks || []).filter((t: OfficeTask) => {
      const lawyer = getLawyerName(t) || t.assignee || '';
      // 1. Lawyer filter
      if (selectedLawyerFilter !== 'all') {
        if (!lawyer.toLowerCase().includes(selectedLawyerFilter.toLowerCase())) return false;
      }
      // 2. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const text = `${t.title || ''} ${lawyer} ${t.notes || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [allOfficeTasks, selectedLawyerFilter, searchQuery, getLawyerName]);

  // Computed: Filtered Office POAs (وكالات المكتب)
  const filteredOfficePoas = useMemo(() => {
    if (!Array.isArray(poas)) return [];
    return poas.filter((p: any) => {
      const lawyer = getLawyerName(p) || p.assignedLawyer || p.assigned_lawyer || '';
      // 1. Lawyer filter
      if (selectedLawyerFilter !== 'all') {
        if (!lawyer.toLowerCase().includes(selectedLawyerFilter.toLowerCase())) return false;
      }
      // 2. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const text = `${p.clientName || ''} ${p.poaNumber || ''} ${p.notes || ''} ${lawyer}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [poas, selectedLawyerFilter, searchQuery, getLawyerName]);

  // Filter today and upcoming sessions, sorted chronologically
  const upcomingSessions = (allSessions || [])
    .filter((s: Session) => {
      const eff = deriveEffectiveStatus(s.status, s.hearingAt);
      return eff === 'Today' || eff === 'Upcoming';
    })
    .sort((a: Session, b: Session) => {
      const tA = a.hearingAt ? new Date(a.hearingAt).getTime() : Infinity;
      const tB = b.hearingAt ? new Date(b.hearingAt).getTime() : Infinity;
      return tA - tB;
    })
    .slice(0, 5);

  if (statsError) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-destructive/30 bg-destructive/8 p-5 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-destructive shrink-0" />
          <p className="text-sm text-destructive font-medium">فشل تحميل إحصائيات لوحة الإدارة العامة</p>
        </div>
      </div>
    );
  }

  const user = currentUser as any;
  const isUnlimited = user?.ai_quota_limit === -1 || user?.plan_tier === 'unlimited';
  const aiUsed = user?.ai_usage_count || 0;
  const aiQuota = user?.ai_quota_limit ?? 100;

  return (
    <div className="p-6 lg:p-8 space-y-8" data-testid="admin-dashboard-page">
      {/* Session Data Fetch Failure Alert */}
      {sessionsError && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 fade-in-up">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs">
              <p className="font-bold">تعذر الاتصال بـ Google Sheets لجلب جلسات المحكمة</p>
              <p className="text-muted-foreground mt-0.5">
                مؤشرات القضايا والجلسات تظهر كـ «غير متاح». يمكنك فحص إعدادات ربط الجدول من صفحة الإعدادات.
              </p>
            </div>
          </div>
          <button
            onClick={() => refetchSessions()}
            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-amber-500/40 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 cursor-pointer shrink-0"
          >
            إعادة محاولة الربط
          </button>
        </div>
      )}

      {/* Subscription Expiration Reminder Banner */}
      <SubscriptionBanner
        warning={currentUser?.subscriptionWarning}
        daysRemaining={currentUser?.daysRemaining}
        subscriptionEndDate={currentUser?.subscription_end_date}
      />

      {/* Admin Header with Office Status */}
      <div className="fade-in-up flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <div className="w-2.5 h-6 rounded-full bg-[#C9A449]" />
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2 flex-wrap">
              <span>{(currentUser as any)?.officeName || (currentUser as any)?.office_name || currentUser?.displayName || 'مكتب المحاماة'}</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#C9A449]/15 text-[#C9A449] border border-[#C9A449]/30">
                لوحة الإدارة والمكتب
              </span>
            </h1>
          </div>
          <p className="text-muted-foreground text-sm mr-4">
            نظرة شاملة وموحدة على أداء فريق العمل، الجلسات، الوكالات، المهام وحصص الذكاء الاصطناعي
          </p>
        </div>
        <div className="flex items-center gap-2 mr-4 md:mr-0 flex-wrap">
          <Link href="/users">
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs bg-card border border-border text-foreground hover:bg-accent cursor-pointer transition-all">
              <Users className="w-4 h-4 text-primary" />
              <span>إدارة المحامين ({membersCount ?? '—'})</span>
            </div>
          </Link>
          <Link href="/subscription">
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold text-xs bg-card border border-border text-foreground hover:bg-accent cursor-pointer transition-all">
              <CreditCard className="w-4 h-4 text-[#C9A449]" />
              <span>الاشتراك والحصص</span>
            </div>
          </Link>
          <Link href="/chat">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs text-white shadow-xs cursor-pointer transition-all duration-200 hover:brightness-105"
              style={{ background: 'linear-gradient(135deg, #3F4A2C 0%, #2A321D 100%)' }}
            >
              <Sparkles className="w-4 h-4 text-[#C9A449]" />
              <span>تحليل رسالة جديدة</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Office Account & Global AI Quota */}
      {currentUser && (
        <AiQuotaCard
          accountName={`مكتب: ${currentUser.displayName || currentUser.username}`}
          badgeLabel={
            isUnlimited
              ? 'باقة مفتوحة (مشرف)'
              : user?.plan_tier === 'pro'
              ? 'باقة برو للمكتب (Pro)'
              : 'باقة بلس للمكتب (Plus)'
          }
          isUnlimited={isUnlimited}
          usedCount={aiUsed}
          quotaLimit={aiQuota}
          quotaLabel="إجمالي استهلاك المكتب للذكاء الاصطناعي"
          isSyncActive={!sessionsError}
          syncErrorMessage="مزامنة Google Drive غير متصلة"
          validityDate={currentUser.subscription_end_date}
        />
      )}

      {/* Expiring POAs Office Alert */}
      {expiringPoasCount > 0 && (
        <div className="flex items-center justify-between p-4 rounded-xl border border-[#C9A449]/40 bg-[#C9A449]/10 text-foreground">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#C9A449]/20 flex items-center justify-center text-[#C9A449] shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-xs">
                يوجد {expiringPoasCount} وكالة بالمكتب تنتهي صلاحيتها خلال 7 أيام
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                يرجى مراجعة المحامين المعنيين والموكلين لتجديد الوكالات في موعدها.
              </p>
            </div>
          </div>
          <Link href="/poa">
            <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#C9A449] text-white hover:brightness-110 transition-all cursor-pointer inline-flex items-center gap-1 shrink-0">
              متابعة الوكالات
            </span>
          </Link>
        </div>
      )}

      {/* Office-wide Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4">
        <StatCard
          label="إجمالي قضايا المكتب"
          value={statsData?.totalCases}
          icon={Briefcase}
          iconBg="bg-emerald-600/15"
          iconColor="text-emerald-700 dark:text-emerald-400"
          dotColor="bg-emerald-600"
          href="/sessions"
          isLoading={isLoadingStats}
          isUnavailable={Boolean(sessionsError)}
          dataTestId="stat-totalCases"
        />

        <StatCard
          label="جلسات اليوم (المكتب)"
          value={statsData?.todayHearings}
          icon={Calendar}
          iconBg="bg-amber-500/15"
          iconColor="text-amber-500"
          dotColor="bg-amber-500"
          href="/sessions"
          isLoading={isLoadingStats}
          isUnavailable={Boolean(sessionsError)}
          dataTestId="stat-todayHearings"
        />

        <StatCard
          label="جلسات قادمة"
          value={statsData?.upcomingHearings}
          icon={Clock}
          iconBg="bg-emerald-500/15"
          iconColor="text-emerald-500"
          dotColor="bg-emerald-500"
          href="/sessions"
          isLoading={isLoadingStats}
          isUnavailable={Boolean(sessionsError)}
          dataTestId="stat-upcomingHearings"
        />

        <StatCard
          label="أعضاء الفريق والمحامين"
          value={membersCount ?? 0}
          icon={Users}
          iconBg="bg-indigo-500/15"
          iconColor="text-indigo-500"
          dotColor="bg-indigo-500"
          href="/users"
          isLoading={membersCount === null}
          dataTestId="stat-officeMembers"
          subtext="فريق العمل المسجل بالمكتب"
        />

        <StatCard
          label="إجمالي الوكالات"
          value={statsData?.totalPoas}
          icon={FileKey}
          iconBg="bg-blue-500/15"
          iconColor="text-blue-500"
          dotColor="bg-blue-500"
          href="/poa"
          isLoading={isLoadingStats}
          dataTestId="stat-totalPoas"
        />

        <StatCard
          label="وكالات توشك على الانتهاء"
          value={expiringPoasCount}
          icon={AlertCircle}
          iconBg={expiringPoasCount > 0 ? "bg-[#C9A449]/20" : "bg-muted"}
          iconColor={expiringPoasCount > 0 ? "text-[#C9A449]" : "text-muted-foreground"}
          dotColor={expiringPoasCount > 0 ? "bg-[#C9A449]" : "bg-muted-foreground"}
          href="/poa"
          isLoading={isLoadingPoas}
          subtext="خلال 7 أيام بالمكتب"
          dataTestId="stat-expiringPoas"
        />

        <StatCard
          label="أحكام نهائية"
          value={(statsData as any)?.favorableJudgments ?? 0}
          icon={Gavel}
          iconBg="bg-emerald-600/20"
          iconColor="text-emerald-600 dark:text-emerald-400"
          dotColor="bg-emerald-600"
          href="/judgments"
          isLoading={isLoadingStats}
          dataTestId="stat-favorableJudgments"
        />

        <StatCard
          label="أحكام ابتدائية"
          value={(statsData as any)?.unfavorableJudgments ?? 0}
          icon={XCircle}
          iconBg="bg-blue-600/20"
          iconColor="text-blue-600 dark:text-blue-400"
          dotColor="bg-blue-600"
          href="/judgments"
          isLoading={isLoadingStats}
          dataTestId="stat-unfavorableJudgments"
        />

        <StatCard
          label="جلسات منتهية"
          value={statsData?.finishedHearings}
          icon={CheckCircle2}
          iconBg="bg-purple-500/15"
          iconColor="text-purple-500"
          dotColor="bg-purple-500"
          href="/sessions"
          isLoading={isLoadingStats}
          isUnavailable={Boolean(sessionsError)}
          dataTestId="stat-finishedHearings"
        />
      </div>

      {/* Visual Analytics & Charts Section */}
      <div className="space-y-4 fade-in-up">
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #3F4A2C, #52603B)' }}
          >
            <BarChart3 className="w-3 h-3 text-[#C9A449]" />
          </div>
          <h2 className="text-sm font-bold text-foreground">التحليلات والمخططات البيانية للمكتب</h2>
        </div>

        {/* Top Charts Row: Sessions Trend (2 cols on LG) & Sessions Status Donut (1 col) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SessionsTrendChart data={chartsData?.sessionsTrend} isLoading={isLoadingCharts} />
          </div>
          <div>
            <SessionsStatusDonutChart data={chartsData?.sessionsStatusDistribution} isLoading={isLoadingCharts} />
          </div>
        </div>

        {/* Bottom Charts Row: Tasks Status, Courts Distribution, Team AI Usage */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <TasksStatusChart data={chartsData?.tasksStatusDistribution} isLoading={isLoadingCharts} />
          <CourtsDistributionChart data={chartsData?.courtsDistribution} isLoading={isLoadingCharts} />
          <TeamAiUsageChart data={chartsData?.teamAiUsage} isLoading={isLoadingCharts} />
        </div>
      </div>

      {/* Activity Section: Upcoming Hearings & Urgent Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Court Hearings (2 Cols on LG) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #3F4A2C, #52603B)' }}
              >
                <Calendar className="w-3 h-3 text-[#C9A449]" />
              </div>
              <h2 className="text-sm font-bold text-foreground">جلسات المحكمة القادمة في المكتب</h2>
            </div>
            <Link
              href="/sessions"
              className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
            >
              <span>عرض جدول الجلسات</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isLoadingSessions ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="rounded-xl border border-border bg-card p-4">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-48" />
                </div>
              ))}
            </div>
          ) : upcomingSessions.length > 0 ? (
            <div className="space-y-3">
              {upcomingSessions.map((session: Session) => (
                <SessionListItem
                  key={session.id}
                  session={session}
                  lawyerName={getLawyerName(session) || undefined}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center space-y-3">
              <Calendar className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
              <p className="text-xs text-muted-foreground">لا توجد جلسات مجدولة حالياً.</p>
            </div>
          )}
        </div>

        {/* Urgent Office Tasks (1 Col on LG) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #C9A449, #B59138)' }}
              >
                <CheckSquare className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-sm font-bold text-foreground">مهام المكتب العاجلة</h2>
            </div>
            <Link
              href="/tasks"
              className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
            >
              <span>جميع المهام</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>

          {urgentTasks.length > 0 ? (
            <div className="space-y-2.5">
              {urgentTasks.map((task) => (
                <UrgentTaskItem key={task.id} task={task} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center space-y-2">
              <CheckSquare className="w-6 h-6 text-muted-foreground mx-auto opacity-40" />
              <p className="text-xs text-muted-foreground">لا توجد مهام عاجلة قيد الانتظار.</p>
            </div>
          )}
        </div>
      </div>

      {/* Comprehensive Office Team Sessions & Tasks Oversight Section */}
      <div className="space-y-4 fade-in-up">
        {/* Section Header with Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-border bg-card shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #3F4A2C 0%, #2A321D 100%)' }}
              >
                <Briefcase className="w-4 h-4 text-[#C9A449]" />
              </div>
              <h2 className="text-base font-bold text-foreground">
                سجل جلسات ومهام فريق عمل المكتب
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1 mr-9">
              متابعة شاملة لجميع الجلسات القضائية والمهام الموزعة على محامي المكتب
            </p>
          </div>

          {/* Tab Switcher Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60 self-start sm:self-auto flex-wrap">
            <button
              onClick={() => setActiveOversightTab('sessions')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                activeOversightTab === 'sessions'
                  ? 'bg-card text-foreground shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>جلسات القضايا ({filteredOfficeSessions.length})</span>
            </button>
            <button
              onClick={() => setActiveOversightTab('tasks')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                activeOversightTab === 'tasks'
                  ? 'bg-card text-foreground shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 text-[#C9A449]" />
              <span>مهام المحامين ({filteredOfficeTasks.length})</span>
            </button>
            <button
              onClick={() => setActiveOversightTab('poas')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                activeOversightTab === 'poas'
                  ? 'bg-card text-foreground shadow-xs border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileKey className="w-3.5 h-3.5 text-emerald-500" />
              <span>وكالات المكتب ({filteredOfficePoas.length})</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl border border-border bg-card/60">
          {/* Search Box */}
          <div className="relative lg:col-span-2">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={
                activeOversightTab === 'sessions'
                  ? 'بحث برقم القضية، المحكمة، الموكل...'
                  : activeOversightTab === 'tasks'
                  ? 'بحث بعنوان المهمة، التفاصيل...'
                  : 'بحث باسم العميل، رقم الوكالة...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 h-10 text-xs rounded-xl bg-card border-border"
            />
          </div>

          {/* Lawyer Filter Selector */}
          <div>
            <select
              value={selectedLawyerFilter}
              onChange={(e) => setSelectedLawyerFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-xs font-medium bg-card border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">جميع محامي المكتب</option>
              {officeMembers.map((m) => (
                <option key={m.id} value={m.displayName || m.username}>
                  المحامي: {m.displayName || m.username}
                </option>
              ))}
            </select>
          </div>

          {/* Sessions Status Filter / Quick Links */}
          {activeOversightTab === 'sessions' ? (
            <div>
              <select
                value={sessionStatusFilter}
                onChange={(e) => setSessionStatusFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-xl text-xs font-medium bg-card border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="all">كافة الحالات</option>
                <option value="Today">جلسات اليوم</option>
                <option value="Upcoming">جلسات قادمة</option>
                <option value="Finished">جلسات منتهية</option>
              </select>
            </div>
          ) : activeOversightTab === 'tasks' ? (
            <div className="flex items-center justify-end">
              <Link
                href="/tasks"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>فتح صفحة المهام الكاملة</span>
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-end">
              <Link
                href="/poa"
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
              >
                <FileKey className="w-3.5 h-3.5" />
                <span>فتح صفحة الوكالات الكاملة</span>
              </Link>
            </div>
          )}
        </div>

        {/* Content View: Sessions, Tasks or POAs */}
        {activeOversightTab === 'sessions' ? (
          <div className="space-y-3">
            {isLoadingSessions ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="rounded-xl border border-border bg-card p-4">
                    <Skeleton className="h-4 w-40 mb-2" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                ))}
              </div>
            ) : filteredOfficeSessions.length > 0 ? (
              <div className="space-y-2.5">
                {filteredOfficeSessions.slice(0, 10).map((session: Session) => (
                  <SessionListItem
                    key={session.id}
                    session={session}
                    lawyerName={getLawyerName(session) || undefined}
                  />
                ))}
                {filteredOfficeSessions.length > 10 && (
                  <div className="text-center pt-2">
                    <Link
                      href="/sessions"
                      className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <span>عرض باقي الجلسات في جدول الجلسات الكامل ({filteredOfficeSessions.length - 10} جلسة إضافية)</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center space-y-2">
                <Calendar className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
                <p className="text-xs text-muted-foreground font-medium">لا توجد جلسات تطابق خيارات التصفية المحددة.</p>
              </div>
            )}
          </div>
        ) : activeOversightTab === 'tasks' ? (
          <div className="space-y-3">
            {filteredOfficeTasks.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredOfficeTasks.slice(0, 10).map((task) => (
                  <div
                    key={task.id}
                    className="rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-xs flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="font-bold text-xs text-foreground line-clamp-1">{task.title}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            task.status === 'مكتملة'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : task.status === 'قيد التنفيذ'
                              ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {task.status || 'جديدة'}
                        </span>
                      </div>
                      {task.notes && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{task.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-border/60">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="w-3.5 h-3.5 text-primary" />
                        <span className="font-semibold text-foreground">
                          المحامي المعين: {getLawyerName(task) || task.assignee || 'غير محدد'}
                        </span>
                      </div>
                      {task.dueDate && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          الاستحقاق: {task.dueDate}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center space-y-2">
                <CheckSquare className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
                <p className="text-xs text-muted-foreground font-medium">لا توجد مهام تطابق خيارات التصفية المحددة.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {isLoadingPoas ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="rounded-xl border border-border bg-card p-4 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                ))}
              </div>
            ) : filteredOfficePoas.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredOfficePoas.slice(0, 9).map((poa: any) => {
                  const days = poa.daysRemaining ?? 0;
                  const isExpired = days <= 0;
                  const isExpiringSoon = days > 0 && days <= 7;
                  const lawyer = getLawyerName(poa) || poa.assignedLawyer || poa.assigned_lawyer;

                  return (
                    <div
                      key={poa.id}
                      className="rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-emerald-500/40 hover:shadow-xs flex flex-col justify-between gap-3 relative overflow-hidden"
                    >
                      <div
                        className={`absolute top-0 right-0 left-0 h-1 ${
                          isExpired
                            ? 'bg-rose-500'
                            : isExpiringSoon
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                      />
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5 pt-1">
                          <span className="font-bold text-xs text-foreground line-clamp-1">{poa.clientName}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              isExpired
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                : isExpiringSoon
                                ? 'bg-[#C9A449]/20 text-[#C9A449]'
                                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {isExpired ? 'منتهية' : `${days} يوم متبقٍ`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                          <FileKey className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>رقم الوكالة: {poa.poaNumber}</span>
                        </div>
                        {poa.expiryDateHijri && (
                          <div className="text-[10px] text-muted-foreground/80 mt-1">
                            الانتهاء (هجري): <span className="font-mono font-medium">{poa.expiryDateHijri}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-border/60">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="font-semibold text-foreground">
                            المحامي المعين: {lawyer || 'غير محدد'}
                          </span>
                        </div>
                        <Link
                          href="/poa"
                          className="text-[10px] text-primary hover:underline font-semibold"
                        >
                          تفاصيل الوكالة
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center space-y-2">
                <FileKey className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
                <p className="text-xs text-muted-foreground font-medium">لا توجد وكالات تطابق خيارات التصفية المحددة.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Admin Quick Action Shortcuts */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">روابط الإدارة السريعة</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickActionCard
            title="إدارة أعضاء المكتب"
            description="إضافة محامين جدد، إرسال روابط التفعيل وإدارة الصلاحيات"
            href="/users"
            icon={Users}
            iconBg="bg-indigo-500/15"
            iconColor="text-indigo-600 dark:text-indigo-400"
            dataTestId="link-admin-users"
          />

          <QuickActionCard
            title="الاشتراك وحصص الاستهلاك"
            description="متابعة باقة المكتب وتخصيص حصص الذكاء الاصطناعي لكل محامٍ"
            href="/subscription"
            icon={CreditCard}
            iconBg="bg-amber-500/15"
            iconColor="text-amber-600 dark:text-amber-400"
            dataTestId="link-admin-subscription"
          />

          <QuickActionCard
            title="إعدادات وربط Google Sheets"
            description="ربط جدول المكتب السحابي، فحص الاتصال وتصدير البيانات"
            href="/settings"
            icon={Settings}
            iconBg="bg-emerald-500/15"
            iconColor="text-emerald-600 dark:text-emerald-400"
            dataTestId="link-admin-settings"
          />

          <QuickActionCard
            title="تحليل رسالة جديدة بالـ AI"
            description="استخراج بيانات الجلسة من الرسائل النصية تلقائياً"
            href="/chat"
            icon={Sparkles}
            iconBg="bg-primary/15"
            iconColor="text-primary"
            featured
            dataTestId="link-admin-chat"
          />
        </div>
      </div>
    </div>
  );
}
