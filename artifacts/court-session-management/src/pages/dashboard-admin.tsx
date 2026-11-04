import React, { useState, useEffect } from 'react';
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
  Users,
  Settings,
  CreditCard,
  Building2,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import {
  StatCard,
  SessionListItem,
  UrgentTaskItem,
  AiQuotaCard,
  QuickActionCard,
  SubscriptionBanner,
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

  const [urgentTasks, setUrgentTasks] = useState<OfficeTask[]>([]);
  const [membersCount, setMembersCount] = useState<number | null>(null);

  // Load office members count
  useEffect(() => {
    let isMounted = true;
    fetch('/api/users', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.users) {
          setMembersCount(data.users.length);
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
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2.5 h-6 rounded-full bg-primary" />
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <span>لوحة الإدارة والمكتب</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                مشرف المكتب
              </span>
            </h1>
          </div>
          <p className="text-muted-foreground text-sm mr-4">
            نظرة شاملة وموحدة على أداء مكتب المحاماة، الجلسات، الفريق وحصص الذكاء الاصطناعي
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
                <SessionListItem key={session.id} session={session} />
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
