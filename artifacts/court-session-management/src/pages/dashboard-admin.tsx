import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useGetDashboardStats,
  useGetCurrentUser,
  useListSessions,
  type Session,
} from '@workspace/api-client-react';
import { Link } from 'wouter';
import {
  Calendar,
  FilePlus,
  BrainCircuit,
  PlusCircle,
  Gavel,
  FolderOpen,
  AlertCircle,
  CalendarCheck,
  FileText,
  Clock,
  CheckCircle2,
  Users,
  ChevronRight,
  ChevronLeft,
  CheckCheck,
  Table,
  MessageSquare,
  UserPlus,
  Sliders,
  CreditCard,
  Sparkles,
} from 'lucide-react';

interface OfficeTask {
  id: number;
  title: string;
  assignee: string;
  priority: string;
  dueDate: string;
  status: string;
  notes?: string;
}

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const WEEKDAY_NAMES = ['سبت', 'أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];

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

function formatArabicTime(hearingAt: string | null | undefined, timeStr?: string | null): string {
  if (timeStr) {
    const parts = timeStr.trim().split(':');
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parts[1].replace(/[^0-9]/g, '').slice(0, 2);
      if (!isNaN(h)) {
        const period = h >= 12 ? 'م' : 'ص';
        const formattedH = h % 12 === 0 ? 12 : h % 12;
        return `${String(formattedH).padStart(2, '0')}:${m || '00'} ${period}`;
      }
    }
    return timeStr;
  }
  if (!hearingAt) return '10:30 ص';
  try {
    const d = new Date(hearingAt);
    if (isNaN(d.getTime())) return '10:30 ص';
    const h = d.getHours();
    const m = d.getMinutes();
    const period = h >= 12 ? 'م' : 'ص';
    const formattedH = h % 12 === 0 ? 12 : h % 12;
    return `${String(formattedH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
  } catch {
    return '10:30 ص';
  }
}

export default function DashboardAdminPage() {
  const { data: statsData } = useGetDashboardStats();
  const { data: currentUser } = useGetCurrentUser();
  const { data: allSessions = [] } = useListSessions();

  const user = currentUser as any;
  const userDisplayName = user?.displayName || user?.name || user?.username || 'أ. عبدالله المنصوري';

  // Calendar State
  const now = useMemo(() => new Date(), []);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number>(new Date().getDate());

  // Arabic and Hijri date formatting
  const gregorianDateStr = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('ar-SA', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(now);
    } catch {
      return now.toLocaleDateString('ar-SA');
    }
  }, [now]);

  const hijriDateStr = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(now);
    } catch {
      return '';
    }
  }, [now]);

  // Table active filter tab
  const [activeSessionTab, setActiveSessionTab] = useState<'today' | 'week' | 'report'>('today');

  // Fetch Cases Statistics for live Case Status Donut breakdown
  const { data: caseStats } = useQuery<{
    total: number;
    open: number;
    closed: number;
    postponed: number;
  }>({
    queryKey: ['/api/cases/stats'],
    queryFn: async () => {
      const res = await fetch('/api/cases/stats', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Load office members workload
  const { data: workloadData } = useQuery<{
    members: Array<{
      lawyerId: string;
      lawyerName: string;
      username: string;
      activeSessions: number;
      openPoa: number;
      pendingTasks: number;
      totalWorkload: number;
    }>;
  }>({
    queryKey: ['/api/workload'],
    queryFn: async () => {
      const res = await fetch('/api/workload', { credentials: 'include' });
      if (!res.ok) return { members: [] };
      return res.json();
    },
  });

  const [officeMembers, setOfficeMembers] = useState<Array<{ id: string; username: string; displayName?: string }>>([]);
  const [urgentTasks, setUrgentTasks] = useState<OfficeTask[]>([]);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/users', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.users) {
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

  useEffect(() => {
    let isMounted = true;
    fetch('/api/tasks', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && Array.isArray(data)) {
          const urgent = data.filter((t: OfficeTask) => t.status !== 'مكتملة' && t.status !== 'ملغاة');
          setUrgentTasks(urgent);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Sessions Calculations
  const todaySessions = useMemo(() => {
    return (allSessions || []).filter((s: Session) => {
      const eff = deriveEffectiveStatus(s.status, s.hearingAt);
      return eff === 'Today';
    });
  }, [allSessions]);

  const todayCount = statsData?.todayHearings ?? todaySessions.length;
  const weekCount = statsData?.upcomingHearings ?? allSessions.length;
  const reportCount = useMemo(() => {
    return (allSessions || []).filter((s: Session) => !s.notes && s.status === 'Finished').length;
  }, [allSessions]);

  const completedToday = useMemo(() => {
    return (allSessions || []).filter((s: Session) => {
      const eff = deriveEffectiveStatus(s.status, s.hearingAt);
      if (eff === 'Finished' && s.hearingAt) {
        const d = new Date(s.hearingAt);
        return d.toDateString() === now.toDateString();
      }
      return false;
    }).length;
  }, [allSessions, now]);
  const remainingToday = Math.max(0, todayCount - completedToday);

  const activeCasesCount = caseStats?.open ?? (statsData?.totalCases ?? 0);
  const postponedCasesCount = caseStats?.postponed ?? 0;
  const closedCasesCount = caseStats?.closed ?? 0;
  const totalCasesCalculated = caseStats?.total ?? (activeCasesCount + postponedCasesCount + closedCasesCount);

  const urgentTasksCount = urgentTasks.length;
  const urgentDueToday = useMemo(() => {
    return urgentTasks.filter((t) => {
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      return due.toDateString() === now.toDateString();
    }).length;
  }, [urgentTasks, now]);

  // AI Quota real calculation
  const aiUsageCount = user?.ai_usage_count || 0;
  const aiQuotaLimit = user?.ai_quota_limit;
  const isUnlimitedAi = user?.role === 'admin' || user?.role === 'super_admin' || aiQuotaLimit === -1 || !aiQuotaLimit;
  const aiRemaining = isUnlimitedAi ? 'غير محدود' : Math.max(0, (aiQuotaLimit || 50) - aiUsageCount);
  const aiPercentage = !isUnlimitedAi && aiQuotaLimit && aiQuotaLimit > 0
    ? Math.min(100, Math.round((aiUsageCount / aiQuotaLimit) * 100))
    : (aiUsageCount > 0 ? 100 : 0);

  // Filtered Sessions for Table
  const ledgerSessions = useMemo(() => {
    if (!allSessions || allSessions.length === 0) {
      return [];
    }

    let filtered = allSessions;
    if (activeSessionTab === 'today') {
      filtered = allSessions.filter((s) => deriveEffectiveStatus(s.status, s.hearingAt) === 'Today');
    } else if (activeSessionTab === 'week') {
      filtered = allSessions.filter((s) => deriveEffectiveStatus(s.status, s.hearingAt) === 'Upcoming');
    } else if (activeSessionTab === 'report') {
      filtered = allSessions.filter((s) => !s.notes && s.status === 'Finished');
    }

    return filtered.map((s) => ({
      id: s.id,
      caseNumber: s.caseNumber || `قضية #${s.id}`,
      court: s.court || 'المحكمة المختصة',
      circuit: s.courtCircuit || 'الدائرة القضائية',
      parties: s.plaintiff && s.defendant ? `${s.plaintiff} ضد ${s.defendant}` : (s.plaintiff || s.defendant || 'أطراف الدعوى'),
      plaintiff: s.plaintiff || 'المدعي',
      defendant: s.defendant || 'المدعى عليه',
      lawyer: (s as any).assignedLawyer || 'غير محدد',
      avatarInitial: ((s as any).assignedLawyer || 'م').charAt(0),
      time: `${formatArabicTime(s.hearingAt, s.sessionTime)}${(s as any).courtRoom ? ' • ' + (s as any).courtRoom : ''}`,
      statusText: s.status === 'Finished' ? 'تم تدوين المحضر' : 'جارية الآن بالمحكمة',
      statusType: s.status === 'Finished' ? 'recorded' : 'in_progress',
    }));
  }, [allSessions, activeSessionTab]);

  // Lawyers Workload rows
  const lawyerRows = useMemo(() => {
    if (workloadData?.members && workloadData.members.length > 0) {
      return workloadData.members.map((m) => {
        const total = m.totalWorkload || 0;
        const specialty = (m as any).legalSpecialty || (m as any).legal_specialty || null;
        return {
          id: m.lawyerId || m.username,
          name: m.lawyerName || m.username,
          role: m.username === 'superadmin' ? 'مشرف عام' : 'محامٍ ممارس',
          specialty,
          avatarInitial: (m.lawyerName || m.username).charAt(0).toUpperCase(),
          assignedCases: total,
          activeSessions: m.activeSessions || 0,
          activePoa: m.openPoa || 0,
          aiUsed: m.activeSessions + m.pendingTasks,
          aiTotal: 50,
          aiPercent: Math.min(100, (m.activeSessions + m.pendingTasks) * 10),
          status: m.activeSessions > 0 ? 'in_hearing' : 'available',
          statusLabel: m.activeSessions > 0 ? 'في جلسة محكمة' : 'متاح للمرافعة',
        };
      });
    }

    return [];
  }, [workloadData]);

  // Dynamic Case Distribution Percentages for Donut
  const totalCasesForDonut = (caseStats?.total || (caseStats?.open || 0) + (caseStats?.postponed || 0) + (caseStats?.closed || 0)) || 0;
  const pOpen = totalCasesForDonut > 0 ? (((caseStats?.open || 0) / totalCasesForDonut) * 100).toFixed(1) : '0';
  const pPostponed = totalCasesForDonut > 0 ? (((caseStats?.postponed || 0) / totalCasesForDonut) * 100).toFixed(1) : '0';
  const pClosed = totalCasesForDonut > 0 ? (((caseStats?.closed || 0) / totalCasesForDonut) * 100).toFixed(1) : '0';
  const pJudged = totalCasesForDonut > 0 ? Math.max(0, 100 - Number(pOpen) - Number(pPostponed) - Number(pClosed)).toFixed(1) : '0';

  // Calendar calculations
  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const calMonthName = ARABIC_MONTHS[calMonth];

  const sessionDaysInMonth = useMemo(() => {
    const days = new Set<number>();
    (allSessions || []).forEach((s) => {
      if (s.hearingAt) {
        const d = new Date(s.hearingAt);
        if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
          days.add(d.getDate());
        }
      }
    });
    return days;
  }, [allSessions, calYear, calMonth]);

  return (
    <div className="w-full min-h-screen bg-[#f8f9ff] text-[#0b1c30] p-4 sm:p-6 lg:p-8 space-y-6" dir="rtl">
      {/* ── 1. Executive Welcome & Quick Action Bar ── */}
      <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4 border border-[#e5eeff]">
        {/* Welcome Info */}
        <div className="flex flex-col gap-1.5 text-right">
          <div className="flex items-center flex-wrap gap-2.5">
            <h1 className="text-2xl font-bold text-[#00236f]">
              مرحباً بك مجدداً، {userDisplayName}
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#dce1ff] text-[#00164e]">
              مدير المكتب الرئيسي
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#eff4ff] text-[#444651]">
              <span className="w-2 h-2 rounded-full bg-[#fd8a42] animate-pulse"></span>
                  عدد المحامين داخل المكتب  {officeMembers.length}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#757682]">
            <Calendar className="w-4 h-4 text-[#757682]" />
            <span>{hijriDateStr ? `${hijriDateStr} هـ` : 'التقويم القضائي'}</span>
            <span className="text-[#757682]">/</span>
            <span>{gregorianDateStr}</span>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <Link href="/cases">
            <button className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-[#e5eeff] hover:bg-[#dce9ff] text-[#0b1c30] transition-colors text-xs font-semibold cursor-pointer shadow-2xs">
              <FilePlus className="w-4.5 h-4.5 text-[#00236f]" />
              <span>تسجيل قضية جديدة</span>
            </button>
          </Link>

          <Link href="/chat">
            <button className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-[#dae2fd] hover:bg-[#bec6e0] text-[#131b2e] transition-colors text-xs font-semibold cursor-pointer shadow-2xs">
              <BrainCircuit className="w-4.5 h-4.5 text-[#9b4500]" />
              <span>تحليل حكم بالذكاء الاصطناعي</span>
            </button>
          </Link>

          <Link href="/sessions">
            <button className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-[#00236f] hover:bg-[#1e3a8a] text-white transition-all shadow-sm text-xs font-bold cursor-pointer">
              <PlusCircle className="w-4.5 h-4.5" />
              <span>إضافة جلسة فورية</span>
            </button>
          </Link>
        </div>
      </div>

      {/* ── 2. Top Primary KPI Metrics Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Today Sessions */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-[#e5eeff] flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col text-right">
              <span className="text-xs font-medium text-[#757682]">الجلسات القضائية اليوم</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-[#0b1c30]">{todayCount}</span>
                <span className="text-xs text-[#757682]">جلسات مجدولة</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#dce1ff] flex items-center justify-center text-[#00236f]">
              <Gavel className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 flex items-center justify-between bg-[#eff4ff] px-2.5 py-1.5 rounded-lg">
            <span className="text-xs text-[#444651]">
              {remainingToday} متبقية • {completedToday} مكتملة
            </span>
            <span className="text-xs font-semibold text-[#00236f]">
              {todayCount > 0 ? `${Math.round((completedToday / todayCount) * 100)}% اليوم` : '0%'}
            </span>
          </div>
        </div>

        {/* Card 2: Active Cases */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-[#e5eeff] flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col text-right">
              <span className="text-xs font-medium text-[#757682]">القضايا المتداولة والنشطة</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-[#0b1c30]">{activeCasesCount}</span>
                <span className="text-xs text-[#757682]">ملف قضائي سارٍ</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#dce9ff] flex items-center justify-center text-[#00236f]">
              <FolderOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 flex items-center justify-between bg-[#eff4ff] px-2.5 py-1.5 rounded-lg">
            <span className="text-xs text-[#444651]">
              {activeCasesCount} قيد المرافعة • {postponedCasesCount} مؤجلة
            </span>
            <span className="text-xs font-semibold text-[#9b4500]">
              إجمالي {totalCasesCalculated} قضية
            </span>
          </div>
        </div>

        {/* Card 3: Urgent Tasks */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-[#e5eeff] flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col text-right">
              <span className="text-xs font-medium text-[#757682]">المهام والمواعيد الإجرائية</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-[#9b4500]">{urgentTasksCount}</span>
                <span className="text-xs text-[#757682]">إجراءات حرجة</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#ffdbca] flex items-center justify-center text-[#9b4500]">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 flex items-center justify-between bg-[#eff4ff] px-2.5 py-1.5 rounded-lg">
            <span className="text-xs text-[#444651]">
              {urgentDueToday} إجراء مطلوب إنجازه اليوم
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#fd8a42] text-white">
              عاجل
            </span>
          </div>
        </div>

        {/* Card 4: AI Usage Quota */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-[#e5eeff] flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col text-right">
              <span className="text-xs font-medium text-[#757682]">رصيد معالجة الذكاء الاصطناعي</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-[#00236f]">
                  {isUnlimitedAi ? `${aiUsageCount} طلب` : `${aiRemaining} / ${aiQuotaLimit}`}
                </span>
                <span className="text-xs text-[#757682]">
                  {isUnlimitedAi ? 'طلب مستهلك' : 'طلب متوفر'}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#dae2fd] flex items-center justify-center text-[#131b2e]">
              <BrainCircuit className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-[#444651] mb-1 font-medium">
              <span>الاستهلاك: {isUnlimitedAi ? `${aiUsageCount} عملية` : `${aiPercentage}%`}</span>
              <span>{user?.plan_tier ? `باقة ${user.plan_tier}` : 'حساب المكتب'}</span>
            </div>
            <div className="w-full bg-[#e5eeff] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#00236f] h-full rounded-full transition-all"
                style={{ width: `${isUnlimitedAi ? Math.min(100, aiUsageCount * 5) : aiPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Main Workspace (8 Col / 4 Col Split) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* ── Right Main Column (8 cols): Tables & Operations ── */}
        <div className="xl:col-span-8 space-y-6">
          {/* Table 1: Court Sessions Ledger */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 border border-[#e5eeff] flex flex-col">
            {/* Header with Title and Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#dce1ff] flex items-center justify-center text-[#00236f]">
                  <CalendarCheck className="w-4.5 h-4.5" />
                </div>
                <h2 className="text-lg font-bold text-[#0b1c30]">جدول الجلسات القادمة والمستعجلة</h2>
              </div>

              {/* Tabs */}
              <div className="flex items-center bg-[#eff4ff] p-1 rounded-lg gap-1 text-xs">
                <button
                  onClick={() => setActiveSessionTab('today')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    activeSessionTab === 'today'
                      ? 'bg-white text-[#00236f] shadow-xs'
                      : 'text-[#444651] hover:text-[#0b1c30]'
                  }`}
                >
                  جلسات اليوم ({todayCount})
                </button>
                <button
                  onClick={() => setActiveSessionTab('week')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    activeSessionTab === 'week'
                      ? 'bg-white text-[#00236f] shadow-xs'
                      : 'text-[#444651] hover:text-[#0b1c30]'
                  }`}
                >
                  هذا الأسبوع ({weekCount})
                </button>
                <button
                  onClick={() => setActiveSessionTab('report')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    activeSessionTab === 'report'
                      ? 'bg-white text-[#00236f] shadow-xs'
                      : 'text-[#444651] hover:text-[#0b1c30]'
                  }`}
                >
                  تتطلب تقرير ({reportCount})
                </button>
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-[#eff4ff] text-[#757682] text-xs">
                    <th className="py-3 px-4 rounded-r-lg font-semibold">رقم القضية</th>
                    <th className="py-3 px-4 font-semibold">المحكمة والدائرة</th>
                    <th className="py-3 px-4 font-semibold">أطراف الدعوى</th>
                    <th className="py-3 px-4 font-semibold">المحامي المكلف</th>
                    <th className="py-3 px-4 font-semibold">التوقيت والقاعة</th>
                    <th className="py-3 px-4 rounded-l-lg font-semibold text-center">الإجراء / الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eff4ff]">
                  {ledgerSessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#757682] text-xs">
                        لا توجد جلسات مسجلة في هذا الأسبوع
                      </td>
                    </tr>
                  ) : (
                    ledgerSessions.map((row) => (
                    <tr key={row.id} className="hover:bg-[#eff4ff]/50 transition-colors">
                      {/* Case Number */}
                      <td className="py-3.5 px-4 font-semibold text-[#00236f] whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-[#757682]" />
                          {row.caseNumber}
                        </span>
                      </td>

                      {/* Court & Circuit */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-[#0b1c30]">{row.court}</span>
                          <span className="text-[11px] text-[#757682]">{row.circuit}</span>
                        </div>
                      </td>

                      {/* Parties */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col max-w-[190px]">
                          <span className="font-medium text-[#0b1c30] truncate">{row.plaintiff}</span>
                          <span className="text-[11px] text-[#757682] truncate">ضد: {row.defendant}</span>
                        </div>
                      </td>

                      {/* Lawyer */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#dce1ff] text-[#00236f] flex items-center justify-center font-bold text-[10px]">
                            {row.avatarInitial}
                          </div>
                          <span className="text-[#0b1c30] font-medium">{row.lawyer}</span>
                        </div>
                      </td>

                      {/* Time & Room */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-[#0b1c30]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#757682]" />
                          <span>{row.time}</span>
                        </div>
                      </td>

                      {/* Status / Action */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {row.statusType === 'in_progress' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#ffdbca] text-[#9b4500]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#fd8a42] animate-pulse"></span>
                            {row.statusText}
                          </span>
                        ) : row.statusType === 'recorded' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#dce1ff] text-[#00236f]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {row.statusText}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#e5eeff] text-[#444651]">
                            {row.statusText}
                          </span>
                        )}
                      </td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="pt-3 mt-2 border-t border-[#eff4ff] flex items-center justify-between text-xs text-[#757682]">
              <span>عرض {ledgerSessions.length} من أصل {weekCount} جلسة مسجلة في هذا الأسبوع</span>
              <Link href="/sessions">
                <span className="text-[#00236f] font-bold hover:underline cursor-pointer flex items-center gap-1">
                  عرض جميع الجلسات والتقارير القضائية ←
                </span>
              </Link>
            </div>
          </div>

          {/* Table 2: Lawyer Workload & Allocation */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 border border-[#e5eeff] flex flex-col">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#e5eeff] flex items-center justify-center text-[#00236f]">
                  <Users className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#0b1c30]">توزيع عبء العمل والمهام على المحامين</h2>
                  <p className="text-xs text-[#757682]">متابعة إشغال الفريق، القضايا النشطة، وحصص الذكاء الاصطناعي</p>
                </div>
              </div>

              <Link href="/users">
                <button className="px-3 py-1.5 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] text-[#00236f] text-xs font-semibold cursor-pointer border border-[#dce9ff]/60 transition-colors">
                  إعادة توزيع المهام
                </button>
              </Link>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-[#eff4ff] text-[#757682] text-xs">
                    <th className="py-3 px-4 rounded-r-lg font-semibold">المحامي</th>
                    <th className="py-3 px-4 font-semibold text-center">القضايا المسندة</th>
                    <th className="py-3 px-4 font-semibold text-center">الجلسات النشطة</th>
                    <th className="py-3 px-4 font-semibold text-center">الوكالات السارية</th>
                    <th className="py-3 px-4 font-semibold">استهلاك الـ AI</th>
                    <th className="py-3 px-4 rounded-l-lg font-semibold text-center">الحالة الحالية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eff4ff]">
                  {lawyerRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#757682] text-xs">
                        لا توجد بيانات عبء عمل متاحة حالياً
                      </td>
                    </tr>
                  ) : (
                    lawyerRows.map((lawyer) => (
                    <tr key={lawyer.id} className="hover:bg-[#eff4ff]/50 transition-colors">
                      {/* Name & Specialty */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#dce1ff] text-[#00236f] flex items-center justify-center font-bold text-xs shrink-0">
                            {lawyer.avatarInitial}
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-[#0b1c30]">{lawyer.name}</span>
                              {lawyer.specialty && (
                                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold px-1.5 py-0.2 rounded">
                                  {lawyer.specialty}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#757682]">{lawyer.role}</span>
                          </div>
                        </div>
                      </td>

                      {/* Assigned Cases */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap font-medium text-[#0b1c30]">
                        <div className="flex flex-col items-center">
                          <span className="font-bold">{lawyer.assignedCases}</span>
                          <span className="text-[10px] text-[#757682]">قضايا</span>
                        </div>
                      </td>

                      {/* Active Sessions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap font-medium text-[#0b1c30]">
                        <div className="flex flex-col items-center">
                          <span className="font-bold">{lawyer.activeSessions}</span>
                          <span className="text-[10px] text-[#757682]">جلسات</span>
                        </div>
                      </td>

                      {/* Active POAs */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap font-medium text-[#0b1c30]">
                        <div className="flex flex-col items-center">
                          <span className="font-bold">{lawyer.activePoa}</span>
                          <span className="text-[10px] text-[#757682]">وكالة</span>
                        </div>
                      </td>

                      {/* AI Usage */}
                      <td className="py-3.5 px-4 whitespace-nowrap min-w-[130px]">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-[#0b1c30]">{lawyer.aiUsed}/{lawyer.aiTotal}</span>
                            <span className="text-[#757682]">{lawyer.aiPercent}%</span>
                          </div>
                          <div className="w-full bg-[#e5eeff] h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                lawyer.aiPercent > 20 ? 'bg-[#fd8a42]' : 'bg-[#00236f]'
                              }`}
                              style={{ width: `${lawyer.aiPercent}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {lawyer.status === 'in_hearing' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#ffdbca] text-[#9b4500]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#fd8a42] animate-pulse"></span>
                            {lawyer.statusLabel}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#e5eeff] text-[#00236f]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00236f]"></span>
                            {lawyer.statusLabel}
                          </span>
                        )}
                      </td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Left Analytical Column (4 cols): Calendar & Metrics Widgets ── */}
        <div className="xl:col-span-4 space-y-6">
          {/* Widget 1: Smart Court Calendar Widget */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 border border-[#e5eeff] flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-2 border-b-0">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#00236f]" />
                <h3 className="text-base font-bold text-[#0b1c30]">التقويم القضائي الذكي</h3>
              </div>
              <div className="flex items-center gap-1 text-[#0b1c30]">
                <button onClick={() => setSelectedCalendarDay(Math.max(1, selectedCalendarDay - 1))} className="p-1 hover:bg-[#e5eeff] rounded transition-colors text-[#757682]">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-[#00236f]">{calMonthName} {calYear}</span>
                <button onClick={() => setSelectedCalendarDay(Math.min(31, selectedCalendarDay + 1))} className="p-1 hover:bg-[#e5eeff] rounded transition-colors text-[#757682]">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="w-full">
              <div className="grid grid-cols-7 text-center text-xs text-[#757682] mb-2 font-medium">
                {WEEKDAY_NAMES.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {Array.from({ length: new Date(calYear, calMonth + 1, 0).getDate() }, (_, i) => {
                  const day = i + 1;
                  const isSelected = selectedCalendarDay === day;
                  const hasSessions = sessionDaysInMonth.has(day);
                  const isCurrentDay = now.getDate() === day && now.getMonth() === calMonth && now.getFullYear() === calYear;

                  return (
                    <span
                      key={day}
                      onClick={() => setSelectedCalendarDay(day)}
                      className={`py-1 rounded-full cursor-pointer relative transition-all ${
                        isSelected
                          ? 'bg-[#00236f] text-white font-bold shadow-xs'
                          : isCurrentDay
                          ? 'bg-[#edf4ff] text-[#00236f] font-bold border border-[#bcd5fc]'
                          : 'hover:bg-[#e5eeff] text-[#0b1c30]'
                      }`}
                    >
                      {day}
                      {hasSessions && !isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#fd8a42] absolute bottom-0.5 left-1/2 -translate-x-1/2"></span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Calendar Footer */}
            <div className="mt-4 pt-3 border-t border-[#eff4ff] flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-[#0b1c30] font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#00236f]"></span>
                <span>مواعيد جلسات اليوم: {todayCount} جلسات</span>
              </div>
              <Link href="/sessions">
                <span className="text-[#00236f] font-bold hover:underline cursor-pointer">
                  عرض المخطط
                </span>
              </Link>
            </div>
          </div>

          {/* Widget 2: Case Status Distribution (Donut Breakdown) */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 border border-[#e5eeff] flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-2">
              <h3 className="text-base font-bold text-[#0b1c30]">توزيع حالات القضايا</h3>
              <span className="text-xs text-[#757682]">إجمالي {totalCasesCalculated} قضية</span>
            </div>

            {/* Donut Chart & Legends */}
            <div className="flex items-center justify-between py-2">
              {/* Inline Mini Donut SVG */}
              <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Background Circle */}
                  <circle cx="50" cy="50" r="38" fill="transparent" stroke="#eff4ff" strokeWidth="12" />
                  {totalCasesForDonut > 0 && (
                    <>
                      {/* Active Primary */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke="#00236f"
                        strokeWidth="12"
                        strokeDasharray={`${Math.round((Number(pOpen) / 100) * 238)} 238`}
                        strokeDashoffset="0"
                      />
                      {/* Postponed Secondary */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke="#fd8a42"
                        strokeWidth="12"
                        strokeDasharray={`${Math.round((Number(pPostponed) / 100) * 238)} 238`}
                        strokeDashoffset={`-${Math.round((Number(pOpen) / 100) * 238)}`}
                      />
                      {/* Judged */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke="#10b981"
                        strokeWidth="12"
                        strokeDasharray={`${Math.round((Number(pJudged) / 100) * 238)} 238`}
                        strokeDashoffset={`-${Math.round(((Number(pOpen) + Number(pPostponed)) / 100) * 238)}`}
                      />
                      {/* Closed */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke="#94a3b8"
                        strokeWidth="12"
                        strokeDasharray={`${Math.round((Number(pClosed) / 100) * 238)} 238`}
                        strokeDashoffset={`-${Math.round(((Number(pOpen) + Number(pPostponed) + Number(pJudged)) / 100) * 238)}`}
                      />
                    </>
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-lg font-bold text-[#0b1c30] leading-tight">{activeCasesCount}</span>
                  <span className="text-[10px] text-[#757682]">قضية نشطة</span>
                </div>
              </div>

              {/* Legends */}
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#00236f]"></span>
                    <span className="text-[#444651]">قيد النظر</span>
                  </div>
                  <span className="font-bold text-[#0b1c30]">{pOpen}%</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#fd8a42]"></span>
                    <span className="text-[#444651]">مؤجلة لحكم</span>
                  </div>
                  <span className="font-bold text-[#0b1c30]">{pPostponed}%</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></span>
                    <span className="text-[#444651]">محكوم بها</span>
                  </div>
                  <span className="font-bold text-[#0b1c30]">{pJudged}%</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#94a3b8]"></span>
                    <span className="text-[#444651]">مغلقة نهائياً</span>
                  </div>
                  <span className="font-bold text-[#0b1c30]">{pClosed}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Widget 3: Integration & Sync Status Widget */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 border border-[#e5eeff] flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-2 border-b-0">
              <CheckCheck className="w-5 h-5 text-[#00236f]" />
              <h3 className="text-base font-bold text-[#0b1c30]">مزامنة البيانات والخدمات</h3>
            </div>

            {/* Google Sheets */}
            <div className="p-3 rounded-lg bg-[#eff4ff] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#dce1ff] flex items-center justify-center text-[#00236f]">
                  <Table className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold text-[#0b1c30]">ربط Google Sheets</span>
                  <span className="text-[10px] text-[#757682]">آخر مزامنة قبل 5 دقائق</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#00236f]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00236f]"></span>
                متصل
              </span>
            </div>

            {/* WhatsApp Notifications */}
            <div className="p-3 rounded-lg bg-[#eff4ff] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#ffdbca] flex items-center justify-center text-[#9b4500]">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold text-[#0b1c30]">إشعارات الواتساب للموكلين</span>
                  <span className="text-[10px] text-[#757682]">تسليم 98% بنجاح</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#9b4500]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#fd8a42]"></span>
                فعال
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Quick Shortcuts & System Services Ribbon ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        {/* Service 1: Team Members */}
        <Link href="/users">
          <div className="bg-white p-4 rounded-xl shadow-sm hover:shadow transition-shadow flex items-center gap-3 group border border-[#e5eeff] cursor-pointer">
            <div className="w-10 h-10 rounded-lg bg-[#dce1ff] flex items-center justify-center text-[#00236f] group-hover:scale-105 transition-transform shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-[#0b1c30] group-hover:text-[#00236f] transition-colors">
                إدارة أعضاء المكتب
              </span>
              <span className="text-[11px] text-[#757682]">
                إضافة محامين وتعيين الصلاحيات
              </span>
            </div>
          </div>
        </Link>

        {/* Service 2: Case Integration Settings */}
        <Link href="/settings">
          <div className="bg-white p-4 rounded-xl shadow-sm hover:shadow transition-shadow flex items-center gap-3 group border border-[#e5eeff] cursor-pointer">
            <div className="w-10 h-10 rounded-lg bg-[#dce9ff] flex items-center justify-center text-[#00236f] group-hover:scale-105 transition-transform shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-[#0b1c30] group-hover:text-[#00236f] transition-colors">
                إعدادات ربط القضايا
              </span>
              <span className="text-[11px] text-[#757682]">
                إدارة الجداول والتصدير الفوري
              </span>
            </div>
          </div>
        </Link>

        {/* Service 3: Subscription & Quotas */}
        <Link href="/subscription">
          <div className="bg-white p-4 rounded-xl shadow-sm hover:shadow transition-shadow flex items-center gap-3 group border border-[#e5eeff] cursor-pointer">
            <div className="w-10 h-10 rounded-lg bg-[#ffdbca] flex items-center justify-center text-[#9b4500] group-hover:scale-105 transition-transform shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-[#0b1c30] group-hover:text-[#00236f] transition-colors">
                الاشتراك والحصص
              </span>
              <span className="text-[11px] text-[#757682]">
                متابعة حصص الـ AI وتجديد الباقة
              </span>
            </div>
          </div>
        </Link>

        {/* Service 4: Legal AI Analysis */}
        <Link href="/chat">
          <div className="bg-white p-4 rounded-xl shadow-sm hover:shadow transition-shadow flex items-center gap-3 group border border-[#e5eeff] cursor-pointer">
            <div className="w-10 h-10 rounded-lg bg-[#dae2fd] flex items-center justify-center text-[#131b2e] group-hover:scale-105 transition-transform shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold text-[#0b1c30] group-hover:text-[#00236f] transition-colors">
                التحليل القانوني الذكي
              </span>
              <span className="text-[11px] text-[#757682]">
                استخراج البيانات من الرسائل النصية
              </span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
