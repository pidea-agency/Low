import React, { useState, useEffect, useMemo } from 'react';
import {
  useGetCurrentUser,
  useListSessions,
  type Session,
} from '@workspace/api-client-react';
import {
  Briefcase,
  Calendar,
  Clock,
  ArrowLeft,
  Sparkles,
  FileKey,
  Gavel,
  CheckSquare,
  AlertTriangle,
  Timer,
  Scale,
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

interface StaffTask {
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

export default function DashboardStaffPage() {
  const { data: currentUser } = useGetCurrentUser();
  const {
    data: allSessions = [],
    isLoading: isLoadingSessions,
    error: sessionsError,
    refetch: refetchSessions,
  } = useListSessions();

  const [personalTasks, setPersonalTasks] = useState<StaffTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);

  const staffUsername = (currentUser?.username || '').toLowerCase();
  const staffDisplayName = ((currentUser as any)?.displayName || (currentUser as any)?.display_name || '').toLowerCase();

  // Load personal tasks assigned to this staff member
  useEffect(() => {
    let isMounted = true;
    setIsLoadingTasks(true);

    fetch('/api/tasks?scope=personal', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted) return;
        if (Array.isArray(data)) {
          setPersonalTasks(data);
        } else {
          // Fallback filtering client-side if needed
          fetch('/api/tasks', { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : []))
            .then((allTasks: StaffTask[]) => {
              if (!isMounted) return;
              const myTasks = (allTasks || []).filter((t) => {
                const a = (t.assignee || '').toLowerCase();
                return (
                  (staffUsername && a.includes(staffUsername)) ||
                  (staffDisplayName && a.includes(staffDisplayName))
                );
              });
              setPersonalTasks(myTasks);
            })
            .catch(() => {});
        }
      })
      .catch(() => {
        try {
          const raw = localStorage.getItem('legal_tasks_v1');
          if (raw && isMounted) {
            const parsed: StaffTask[] = JSON.parse(raw);
            const myTasks = parsed.filter((t) => {
              const a = (t.assignee || '').toLowerCase();
              return (
                !t.assignee ||
                (staffUsername && a.includes(staffUsername)) ||
                (staffDisplayName && a.includes(staffDisplayName))
              );
            });
            setPersonalTasks(myTasks);
          }
        } catch {
          // ignore
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingTasks(false);
      });

    return () => {
      isMounted = false;
    };
  }, [staffUsername, staffDisplayName]);

  // Filter personal sessions (either specifically assigned or all office sessions accessible to staff)
  const personalSessions = useMemo(() => {
    return (allSessions || []).filter((s: Session) => {
      const notes = (s.notes || '').toLowerCase();
      const plaintiff = (s.plaintiff || '').toLowerCase();
      // If session notes or plaintiff mention lawyer, prioritize. Otherwise include office sessions.
      const isAssigned =
        (staffUsername && (notes.includes(staffUsername) || plaintiff.includes(staffUsername))) ||
        (staffDisplayName && (notes.includes(staffDisplayName) || plaintiff.includes(staffDisplayName)));
      return isAssigned || true;
    });
  }, [allSessions, staffUsername, staffDisplayName]);

  // Upcoming sessions for staff
  const upcomingSessions = useMemo(() => {
    return personalSessions
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
  }, [personalSessions]);

  // Personal session counts
  const sessionCounts = useMemo(() => {
    let today = 0;
    let upcoming = 0;
    let finished = 0;
    for (const s of personalSessions) {
      const eff = deriveEffectiveStatus(s.status, s.hearingAt);
      if (eff === 'Today') today++;
      else if (eff === 'Upcoming') upcoming++;
      else if (eff === 'Finished') finished++;
    }
    return { today, upcoming, finished, total: personalSessions.length };
  }, [personalSessions]);

  // Active urgent tasks
  const urgentTasks = useMemo(() => {
    return personalTasks
      .filter((t) => t.status !== 'مكتملة' && t.status !== 'ملغاة')
      .slice(0, 5);
  }, [personalTasks]);

  const inProgressTasksCount = useMemo(() => {
    return personalTasks.filter((t) => t.status === 'قيد التنفيذ' || t.status === 'قيد الانتظار').length;
  }, [personalTasks]);

  const user = currentUser as any;
  const staffAiUsage = user?.ai_usage_count || 0;
  const staffAiQuota = user?.ai_quota_limit;
  const hasIndividualCap = staffAiQuota !== null && staffAiQuota !== undefined;

  return (
    <div className="p-6 lg:p-8 space-y-8" data-testid="staff-dashboard-page">
      {/* Session Data Fetch Failure Alert */}
      {sessionsError && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 fade-in-up">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs">
              <p className="font-bold">تعذر الاتصال بـ Google Sheets لجلب جلسات المحكمة</p>
              <p className="text-muted-foreground mt-0.5">
                مؤشرات الجلسات تظهر كـ «غير متاح». الأقسام الأخرى (الوكالات، الأحكام، المهام) تعمل بشكل مستقل.
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

      {/* Staff Welcome Header */}
      <div className="fade-in-up flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-2.5 h-6 rounded-full bg-primary" />
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <span>مرحباً بك، {currentUser?.displayName || currentUser?.username} ⚖️</span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                محامي المكتب
              </span>
            </h1>
          </div>
          <p className="text-muted-foreground text-sm mr-4">
            مساحة العمل الرقمية الخاصة بك لمتابعة الجلسات الموكلة، المهام، وتحليل رسائل المحاكم
          </p>
        </div>
        <div className="flex items-center gap-2 mr-4 md:mr-0">
          <Link href="/chat">
            <div
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white shadow-xs cursor-pointer transition-all duration-200 hover:brightness-105"
              style={{ background: 'linear-gradient(135deg, #3F4A2C 0%, #2A321D 100%)' }}
            >
              <Sparkles className="w-4 h-4 text-[#C9A449]" />
              <span>تحليل رسالة جلسة جديدة</span>
            </div>
          </Link>
        </div>
      </div>

      {/* Staff AI Quota Indicator Card */}
      {currentUser && (
        <AiQuotaCard
          accountName={currentUser.displayName || currentUser.username}
          badgeLabel={hasIndividualCap ? `حصة مخصصة (${staffAiQuota})` : 'حصة مشتركة مع المكتب'}
          isUnlimited={false}
          usedCount={staffAiUsage}
          quotaLimit={staffAiQuota}
          quotaLabel="استهلاكي لاستخراج الجلسات بالـ AI"
          isSyncActive={!sessionsError}
          syncErrorMessage="مزامنة Google Drive غير متصلة"
          validityDate={currentUser.subscription_end_date}
        />
      )}

      {/* Staff Personal Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4">
        <StatCard
          label="جلساتي اليوم"
          value={sessionCounts.today}
          icon={Calendar}
          iconBg="bg-amber-500/15"
          iconColor="text-amber-500"
          dotColor="bg-amber-500"
          href="/sessions"
          isLoading={isLoadingSessions}
          isUnavailable={Boolean(sessionsError)}
          dataTestId="stat-staff-todayHearings"
        />

        <StatCard
          label="جلساتي القادمة"
          value={sessionCounts.upcoming}
          icon={Clock}
          iconBg="bg-emerald-500/15"
          iconColor="text-emerald-500"
          dotColor="bg-emerald-500"
          href="/sessions"
          isLoading={isLoadingSessions}
          isUnavailable={Boolean(sessionsError)}
          dataTestId="stat-staff-upcomingHearings"
        />

        <StatCard
          label="مهامي قيد التنفيذ"
          value={inProgressTasksCount}
          icon={Timer}
          iconBg="bg-blue-500/15"
          iconColor="text-blue-500"
          dotColor="bg-blue-500"
          href="/tasks"
          isLoading={isLoadingTasks}
          dataTestId="stat-staff-inProgressTasks"
          subtext="مهام مسندة إليك"
        />

        <StatCard
          label="إجمالي القضايا المتابعة"
          value={sessionCounts.total}
          icon={Briefcase}
          iconBg="bg-indigo-500/15"
          iconColor="text-indigo-500"
          dotColor="bg-indigo-500"
          href="/sessions"
          isLoading={isLoadingSessions}
          isUnavailable={Boolean(sessionsError)}
          dataTestId="stat-staff-totalCases"
        />
      </div>

      {/* Activity Section: Staff Upcoming Hearings & Urgent Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Staff Upcoming Court Hearings (2 Cols on LG) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #3F4A2C, #52603B)' }}
              >
                <Calendar className="w-3 h-3 text-[#C9A449]" />
              </div>
              <h2 className="text-sm font-bold text-foreground">الجلسات المجدولة القادمة واليوم</h2>
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
              <p className="text-xs text-muted-foreground">لا توجد جلسات مجدولة قادمة حالياً.</p>
              <Link href="/chat">
                <span className="inline-block text-xs font-bold text-primary hover:underline cursor-pointer">
                  + حلل رسالة محكمة جديدة لإدراجها تلقائياً
                </span>
              </Link>
            </div>
          )}
        </div>

        {/* Staff Urgent Tasks (1 Col on LG) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #C9A449, #B59138)' }}
              >
                <CheckSquare className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-sm font-bold text-foreground">مهامي العاجلة</h2>
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
              <p className="text-xs text-muted-foreground">لا توجد مهام عاجلة مسندة إليك حالياً.</p>
            </div>
          )}
        </div>
      </div>

      {/* Staff Quick Actions (Strictly lawyer tools, zero office management) */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">الوصول السريع</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickActionCard
            title="تحليل رسالة جديدة"
            description="استخراج بيانات الجلسة من الرسائل النصية تلقائياً"
            href="/chat"
            icon={Sparkles}
            iconBg="bg-primary/15"
            iconColor="text-primary"
            featured
            dataTestId="link-staff-chat"
          />

          <QuickActionCard
            title="جدول الجلسات"
            description="متابعة الجلسات، مواعيد الاستماع وتحديث التقارير"
            href="/sessions"
            icon={Calendar}
            iconBg="bg-muted"
            iconColor="text-muted-foreground"
            dataTestId="link-staff-sessions"
          />

          <QuickActionCard
            title="إدارة الوكالات"
            description="متابعة الوكالات الشرعية وتواريخ انتهائها"
            href="/poa"
            icon={FileKey}
            iconBg="bg-blue-500/10"
            iconColor="text-blue-500"
            dataTestId="link-staff-poa"
          />

          <QuickActionCard
            title="سجل الأحكام"
            description="متابعة القرارات والأحكام القضائية الصادرة"
            href="/judgments"
            icon={Gavel}
            iconBg="bg-emerald-500/10"
            iconColor="text-emerald-500"
            dataTestId="link-staff-judgments"
          />
        </div>
      </div>
    </div>
  );
}
