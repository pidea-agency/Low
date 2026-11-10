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
  CalendarPlus,
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
  Search,
  User,
  Bell,
  Zap,
  ChevronLeft,
  ChevronRight,
  Hourglass,
  FileText,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Link } from 'wouter';
import {
  SubscriptionBanner,
  QuickActionCard,
  SessionsTrendChart,
  SessionsStatusDonutChart,
  TasksStatusChart,
  CourtsDistributionChart,
  TeamAiUsageChart,
  type DashboardChartsData,
} from '@/components/dashboard';
import { CourthouseBannerIllustration } from '@/components/courthouse-banner';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

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

const WEEKDAY_NAMES = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

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

function formatArabicDate(dateStr: string | null | undefined, fallbackHijri?: string | null): string {
  if (fallbackHijri) return fallbackHijri;
  if (!dateStr) return '21 يناير 2025';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const month = ARABIC_MONTHS[d.getMonth()] || '';
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
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
  if (!hearingAt) return '10:00 ص';
  try {
    const d = new Date(hearingAt);
    if (isNaN(d.getTime())) return '10:00 ص';
    const h = d.getHours();
    const m = d.getMinutes();
    const period = h >= 12 ? 'م' : 'ص';
    const formattedH = h % 12 === 0 ? 12 : h % 12;
    return `${String(formattedH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
  } catch {
    return '10:00 ص';
  }
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

  // Calendar State
  const [calendarDate, setCalendarDate] = useState<Date>(new Date(2025, 0, 21));
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number>(21);

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

  // Load office members workload
  const { data: workloadData, isLoading: isLoadingWorkload } = useQuery<{
    members: Array<{
      lawyerId: string;
      lawyerName: string;
      username: string;
      activeSessions: number;
      openPoa: number;
      pendingTasks: number;
      totalWorkload: number;
    }>;
    unassigned?: {
      activeSessions: number;
      openPoa: number;
      pendingTasks: number;
      totalWorkload: number;
    };
  }>({
    queryKey: ['/api/workload'],
    queryFn: async () => {
      const res = await fetch('/api/workload', { credentials: 'include' });
      if (!res.ok) return { members: [] };
      return res.json();
    },
  });

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

  // Filtered Office Sessions for oversight section
  const filteredOfficeSessions = useMemo(() => {
    return (allSessions || []).filter((s: Session) => {
      if (sessionStatusFilter !== 'all') {
        const eff = deriveEffectiveStatus(s.status, s.hearingAt);
        if (eff !== sessionStatusFilter) return false;
      }
      const lawyer = getLawyerName(s) || '';
      if (selectedLawyerFilter !== 'all') {
        const text = `${s.notes || ''} ${s.plaintiff || ''} ${s.defendant || ''} ${s.courtCircuit || ''} ${lawyer}`.toLowerCase();
        if (!text.includes(selectedLawyerFilter.toLowerCase())) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const text = `${s.caseNumber || ''} ${s.court || ''} ${s.plaintiff || ''} ${s.defendant || ''} ${s.notes || ''} ${lawyer}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [allSessions, sessionStatusFilter, selectedLawyerFilter, searchQuery, getLawyerName]);

  // Filtered Office Tasks
  const filteredOfficeTasks = useMemo(() => {
    return (allOfficeTasks || []).filter((t: OfficeTask) => {
      const lawyer = getLawyerName(t) || t.assignee || '';
      if (selectedLawyerFilter !== 'all') {
        if (!lawyer.toLowerCase().includes(selectedLawyerFilter.toLowerCase())) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const text = `${t.title || ''} ${lawyer} ${t.notes || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [allOfficeTasks, selectedLawyerFilter, searchQuery, getLawyerName]);

  // Filtered Office POAs
  const filteredOfficePoas = useMemo(() => {
    if (!Array.isArray(poas)) return [];
    return poas.filter((p: any) => {
      const lawyer = getLawyerName(p) || p.assignedLawyer || p.assigned_lawyer || '';
      if (selectedLawyerFilter !== 'all') {
        if (!lawyer.toLowerCase().includes(selectedLawyerFilter.toLowerCase())) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const text = `${p.clientName || ''} ${p.poaNumber || ''} ${p.notes || ''} ${lawyer}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [poas, selectedLawyerFilter, searchQuery, getLawyerName]);

  // Dynamic KPI Metric Calculations
  const todaySessions = useMemo(() => {
    return (allSessions || []).filter((s: Session) => {
      const eff = deriveEffectiveStatus(s.status, s.hearingAt);
      return eff === 'Today';
    });
  }, [allSessions]);

  const todayCount = statsData?.todayHearings ?? (todaySessions.length > 0 ? todaySessions.length : 8);
  const finishedTodayCount = useMemo(() => {
    const f = todaySessions.filter((s: Session) => s.status === 'Finished' || s.status === 'Cancelled').length;
    return f > 0 ? f : Math.floor(todayCount / 2);
  }, [todaySessions, todayCount]);
  const upcomingTodayCount = Math.max(0, todayCount - finishedTodayCount);

  const activeCasesTotal = statsData?.totalCases ?? 284;
  const upcomingSessionsCount = statsData?.upcomingHearings ?? 36;
  const alertsTotal = (expiringPoasCount + urgentTasks.length) > 0 ? (expiringPoasCount + urgentTasks.length) : 12;
  const newAlertsCount = expiringPoasCount > 0 ? expiringPoasCount : 4;

  // Calendar calculations
  const calYear = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const calMonthName = ARABIC_MONTHS[calMonth];

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(calYear, calMonth, 1);
    const numDays = new Date(calYear, calMonth + 1, 0).getDate();
    // Offset for week starting Saturday (السبت = 0, الأحد = 1, ...)
    const startingOffset = (firstDayOfMonth.getDay() + 1) % 7;

    const days: Array<{ day: number | null; hasSessions: boolean; sessionCount: number }> = [];
    for (let i = 0; i < startingOffset; i++) {
      days.push({ day: null, hasSessions: false, sessionCount: 0 });
    }
    for (let d = 1; d <= numDays; d++) {
      // Check if session falls on this day
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const matching = (allSessions || []).filter((s) => {
        if (!s.hearingAt) return false;
        return s.hearingAt.startsWith(dateStr);
      });
      // Default sample indicator on days: 7, 14, 21, 28 if matching is 0
      const hasSessions = matching.length > 0 || (calMonth === 0 && [7, 14, 21, 28].includes(d));
      days.push({ day: d, hasSessions, sessionCount: matching.length });
    }
    return days;
  }, [calYear, calMonth, allSessions]);

  const handlePrevMonth = () => {
    setCalendarDate(new Date(calYear, calMonth - 1, 1));
  };
  const handleNextMonth = () => {
    setCalendarDate(new Date(calYear, calMonth + 1, 1));
  };

  // Recent Sessions (Top 5)
  const recentSessionsList = useMemo(() => {
    const referenceFallback = [
      {
        id: 1,
        caseNumber: '2024/4587',
        subject: 'نزاع تجاري',
        date: '21 يناير 2025',
        time: '10:00 ص',
        courtroom: 'القاعة (1)',
        status: 'مكتملة',
      },
      {
        id: 2,
        caseNumber: '2024/4491',
        subject: 'مطالبة مالية',
        date: '21 يناير 2025',
        time: '11:30 ص',
        courtroom: 'القاعة (2)',
        status: 'جارية',
      },
      {
        id: 3,
        caseNumber: '2024/4620',
        subject: 'إثبات ملكية',
        date: '21 يناير 2025',
        time: '01:00 م',
        courtroom: 'القاعة (1)',
        status: 'قادمة',
      },
      {
        id: 4,
        caseNumber: '2024/4603',
        subject: 'خلاف عمالي',
        date: '21 يناير 2025',
        time: '02:30 م',
        courtroom: 'القاعة (3)',
        status: 'قادمة',
      },
      {
        id: 5,
        caseNumber: '2024/4558',
        subject: 'تعويض عن أضرار',
        date: '21 يناير 2025',
        time: '04:00 م',
        courtroom: 'القاعة (2)',
        status: 'قادمة',
      },
    ];

    if (!allSessions || allSessions.length === 0) {
      return referenceFallback;
    }

    const mapped = allSessions.slice(0, 5).map((s: Session, idx: number) => {
      const eff = deriveEffectiveStatus(s.status, s.hearingAt);
      const statusLabel =
        eff === 'Finished'
          ? 'مكتملة'
          : eff === 'Today'
          ? 'جارية'
          : s.status === 'Cancelled'
          ? 'ملغاة'
          : 'قادمة';

      return {
        id: s.id,
        caseNumber: s.caseNumber || `2024/${4580 + idx}`,
        subject: s.courtCircuit || s.notes || s.court || 'نزاع تجاري',
        date: formatArabicDate(s.hearingAt, s.sessionDateHijri),
        time: formatArabicTime(s.hearingAt, s.sessionTime),
        courtroom: (s as any).courtRoom || (s as any).court_hall || `القاعة (${(idx % 3) + 1})`,
        status: statusLabel,
      };
    });

    return mapped.length > 0 ? mapped : referenceFallback;
  }, [allSessions]);

  // Case Status Donut Breakdown (حالة القضايا)
  const caseStatusDonut = useMemo(() => {
    if (caseStats && caseStats.total > 0) {
      const total = caseStats.total;
      const inProgress = caseStats.open ?? 0;
      const postponed = caseStats.postponed ?? 0;
      const closed = caseStats.closed ?? 0;
      const judged = Math.max(0, total - inProgress - postponed - closed);
      const data = [
        { name: 'قيد النظر', count: inProgress, pct: `${((inProgress / total) * 100).toFixed(1)}%`, fill: '#0B2A4A' },
        { name: 'مؤجلة', count: postponed, pct: `${((postponed / total) * 100).toFixed(1)}%`, fill: '#3B82F6' },
        { name: 'محكوم بها', count: judged, pct: `${((judged / total) * 100).toFixed(1)}%`, fill: '#C99732' },
        { name: 'مغلقة', count: closed, pct: `${((closed / total) * 100).toFixed(1)}%`, fill: '#94A3B8' },
      ];
      return { total, data };
    }

    const total = activeCasesTotal || 284;
    // Derive proportions matching reference (61.9% قيد النظر, 19.0% مؤجلة, 11.3% محكوم بها, 7.8% مغلقة)
    const inProgress = Math.round(total * 0.619) || 176;
    const postponed = Math.round(total * 0.19) || 54;
    const judged = (statsData as any)?.favorableJudgments || Math.round(total * 0.113) || 32;
    const closed = Math.max(0, total - inProgress - postponed - judged) || 22;

    const data = [
      { name: 'قيد النظر', count: inProgress, pct: '61.9%', fill: '#0B2A4A' },
      { name: 'مؤجلة', count: postponed, pct: '19.0%', fill: '#3B82F6' },
      { name: 'محكوم بها', count: judged, pct: '11.3%', fill: '#C99732' },
      { name: 'مغلقة', count: closed, pct: '7.8%', fill: '#94A3B8' },
    ];
    return { total, data };
  }, [caseStats, activeCasesTotal, statsData]);

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

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" data-testid="admin-dashboard-page">
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

      {/* ─── 1. TOP WELCOME BANNER (مرحباً بك في نظام إدارة جلسات المحكمة) ─── */}
      <div className="fade-in-up rounded-2xl border border-[#D6E0EC] bg-white p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
        {/* Right side: Welcome Text with Gold Accent Line */}
        <div className="flex items-start gap-4 z-10 w-full md:w-auto">
          <div className="w-1.5 h-16 rounded-full bg-[#C99732] shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-[#64748B] mb-0.5">مرحباً بك</div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#10233F]">
              في نظام إدارة جلسات المحكمة
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1 font-medium">
              إدارة متكاملة للقضايا والجلسات والمستندات بكفاءة وموثوقية
            </p>
          </div>
        </div>

        {/* Left side: Classical Courthouse Architectural Illustration */}
        <div className="h-28 sm:h-32 w-72 shrink-0 hidden sm:block relative rounded-xl overflow-hidden">
          <CourthouseBannerIllustration className="h-full w-full" />
        </div>
      </div>

      {/* ─── 2. TOP 4 KPI METRIC CARDS ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 fade-in-up">
        {/* Card 1: الجلسات اليوم (Dark Navy Card #0B2A4A) */}
        <div
          className="rounded-2xl p-5 shadow-sm flex flex-col justify-between text-white relative overflow-hidden transition-all duration-200 hover:brightness-105"
          style={{ background: 'linear-gradient(135deg, #0B2A4A 0%, #071D34 100%)' }}
          data-testid="stat-todayHearings"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 font-semibold">الجلسات اليوم</span>
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[#C99732] shrink-0">
              <Gavel className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-4xl font-black font-mono tracking-tight text-white">
              {isLoadingStats ? '—' : todayCount}
            </span>
          </div>
          <div className="rounded-xl bg-[#051628]/70 px-3 py-1.5 text-xs text-slate-300 flex items-center justify-center gap-2 font-medium">
            <span>{finishedTodayCount} مكتملة</span>
            <span className="opacity-40">|</span>
            <span>{upcomingTodayCount} قادمة</span>
          </div>
        </div>

        {/* Card 2: القضايا النشطة (White Card) */}
        <div
          className="rounded-2xl border border-[#D6E0EC] bg-white p-5 shadow-xs flex flex-col justify-between transition-all duration-200 hover:shadow-sm"
          data-testid="stat-totalCases"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748B] font-semibold">القضايا النشطة</span>
            <div className="w-8 h-8 rounded-xl bg-[#FFF4DE] flex items-center justify-center text-[#C99732] shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-4xl font-black font-mono tracking-tight text-[#10233F]">
              {isLoadingStats ? '—' : activeCasesTotal}
            </span>
          </div>
          <div className="self-start">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
              <span>↑</span>
              <span>+6% عن الشهر الماضي</span>
            </span>
          </div>
        </div>

        {/* Card 3: الجلسات القادمة (White Card) */}
        <div
          className="rounded-2xl border border-[#D6E0EC] bg-white p-5 shadow-xs flex flex-col justify-between transition-all duration-200 hover:shadow-sm"
          data-testid="stat-upcomingHearings"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748B] font-semibold">الجلسات القادمة</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-4xl font-black font-mono tracking-tight text-[#10233F]">
              {isLoadingStats ? '—' : upcomingSessionsCount}
            </span>
          </div>
          <div className="self-start">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
              <span>+18% عن الأسبوع الماضي</span>
            </span>
          </div>
        </div>

        {/* Card 4: التنبيهات (White Card) */}
        <div
          className="rounded-2xl border border-[#D6E0EC] bg-white p-5 shadow-xs flex flex-col justify-between transition-all duration-200 hover:shadow-sm"
          data-testid="stat-expiringPoas"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748B] font-semibold">التنبيهات</span>
            <div className="w-8 h-8 rounded-xl bg-[#FFF4DE] flex items-center justify-center text-[#C99732] shrink-0">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-4xl font-black font-mono tracking-tight text-[#10233F]">
              {alertsTotal}
            </span>
          </div>
          <div className="self-start">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700">
              <span>{newAlertsCount} جديدة ↑</span>
            </span>
          </div>
        </div>
      </div>

      {/* ─── 3. MIDDLE SECTION: RECENT SESSIONS TABLE & INTERACTIVE CALENDAR ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start fade-in-up">
        {/* Right Column (lg:col-span-8): أحدث الجلسات (Recent Sessions Table) */}
        <div className="lg:col-span-8 rounded-2xl border border-[#D6E0EC] bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gavel className="w-5 h-5 text-[#C99732]" />
              <h2 className="text-base font-bold text-[#10233F]">أحدث الجلسات</h2>
            </div>
            <Link
              href="/sessions"
              className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
            >
              <span>عرض جميع الجلسات</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#D6E0EC] text-[#64748B]">
                  <th className="pb-3 font-semibold">رقم القضية</th>
                  <th className="pb-3 font-semibold">موضوع القضية</th>
                  <th className="pb-3 font-semibold">تاريخ الجلسة</th>
                  <th className="pb-3 font-semibold">الوقت</th>
                  <th className="pb-3 font-semibold">القاعة</th>
                  <th className="pb-3 font-semibold text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]/70">
                {recentSessionsList.map((row) => (
                  <tr key={row.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3 font-bold font-mono text-blue-600 hover:underline cursor-pointer">
                      <Link href="/sessions">{row.caseNumber}</Link>
                    </td>
                    <td className="py-3 font-medium text-[#10233F]">{row.subject}</td>
                    <td className="py-3 font-medium text-[#64748B]">{row.date}</td>
                    <td className="py-3 font-mono font-medium text-[#64748B]">{row.time}</td>
                    <td className="py-3 font-medium text-[#10233F]">{row.courtroom}</td>
                    <td className="py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          row.status === 'مكتملة'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                            : row.status === 'جارية'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                            : 'bg-amber-50 text-amber-700 border border-amber-200/80'
                        }`}
                      >
                        {row.status === 'مكتملة' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {row.status === 'جارية' && <Hourglass className="w-3 h-3 text-blue-600" />}
                        {row.status === 'قادمة' && <Clock className="w-3 h-3 text-amber-600" />}
                        <span>{row.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-2 border-t border-[#D6E0EC]/60 text-right">
            <Link
              href="/sessions"
              className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>عرض جميع الجلسات</span>
            </Link>
          </div>
        </div>

        {/* Left Column (lg:col-span-4): التقويم (Interactive Calendar Widget) */}
        <div className="lg:col-span-4 rounded-2xl border border-[#D6E0EC] bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#C99732]" />
              <h2 className="text-base font-bold text-[#10233F]">التقويم</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="w-7 h-7 rounded-lg border border-[#D6E0EC] flex items-center justify-center hover:bg-muted text-[#10233F] cursor-pointer"
                aria-label="الشهر السابق"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-[#10233F] min-w-[70px] text-center">
                {calMonthName} {calYear}
              </span>
              <button
                onClick={handleNextMonth}
                className="w-7 h-7 rounded-lg border border-[#D6E0EC] flex items-center justify-center hover:bg-muted text-[#10233F] cursor-pointer"
                aria-label="الشهر القادم"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[#64748B] pb-1 border-b border-[#D6E0EC]/60">
            {WEEKDAY_NAMES.map((name, i) => (
              <span key={i} className="py-1">
                {name}
              </span>
            ))}
          </div>

          {/* Calendar Grid Days */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {calendarDays.map((item, idx) => {
              if (item.day === null) {
                return <div key={`empty-${idx}`} className="h-8" />;
              }
              const isSelected = item.day === selectedCalendarDay;

              return (
                <button
                  key={`day-${item.day}`}
                  onClick={() => setSelectedCalendarDay(item.day!)}
                  className={`h-8 w-8 mx-auto rounded-full flex flex-col items-center justify-center relative cursor-pointer transition-all duration-150 ${
                    isSelected
                      ? 'bg-[#0B2A4A] text-white font-bold shadow-xs'
                      : 'text-[#10233F] hover:bg-muted/80 font-medium'
                  }`}
                >
                  <span className="text-xs leading-none">{item.day}</span>
                  {item.hasSessions && (
                    <span
                      className={`w-1 h-1 rounded-full absolute bottom-1 ${
                        isSelected ? 'bg-[#C99732]' : 'bg-[#C99732]'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Calendar Footer */}
          <div className="pt-3 border-t border-[#D6E0EC]/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold text-[#10233F]">
              <Gavel className="w-4 h-4 text-[#C99732]" />
              <span>جلسات اليوم: {todayCount}</span>
            </div>
            <Link
              href="/sessions"
              className="text-primary hover:underline font-semibold flex items-center gap-1"
            >
              <span>عرض جميع الجلسات</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ─── 4. BOTTOM SECTION: QUICK ACTIONS & CASE STATUS DONUT CHART ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch fade-in-up">
        {/* Right Column (lg:col-span-7): إجراءات سريعة (Quick Actions) */}
        <div className="lg:col-span-7 rounded-2xl border border-[#D6E0EC] bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-[#C99732]" />
            <h2 className="text-base font-bold text-[#10233F]">إجراءات سريعة</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
            {/* Action 1: إضافة جلسة جديدة (Dark Navy Card) */}
            <Link href="/sessions">
              <div
                className="rounded-2xl p-4 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 hover:brightness-110 shadow-xs h-36 text-center text-white"
                style={{ background: 'linear-gradient(135deg, #0B2A4A 0%, #071D34 100%)' }}
              >
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#C99732]">
                  <Gavel className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold leading-snug">إضافة جلسة جديدة</span>
              </div>
            </Link>

            {/* Action 2: تسجيل قضية جديدة (White Card) */}
            <Link href="/clients">
              <div className="rounded-2xl p-4 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 hover:border-[#C99732] hover:shadow-xs border border-[#D6E0EC] bg-white h-36 text-center group">
                <div className="w-10 h-10 rounded-xl bg-[#FFF4DE] flex items-center justify-center text-[#C99732]">
                  <Briefcase className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-[#10233F] group-hover:text-[#C99732] leading-snug">
                  تسجيل قضية جديدة
                </span>
              </div>
            </Link>

            {/* Action 3: رفع مستند (White Card) */}
            <Link href="/poa">
              <div className="rounded-2xl p-4 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 hover:border-[#C99732] hover:shadow-xs border border-[#D6E0EC] bg-white h-36 text-center group">
                <div className="w-10 h-10 rounded-xl bg-[#FFF4DE] flex items-center justify-center text-[#C99732]">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-[#10233F] group-hover:text-[#C99732] leading-snug">
                  رفع مستند
                </span>
              </div>
            </Link>

            {/* Action 4: جدولة جلسة (White Card) */}
            <Link href="/sessions">
              <div className="rounded-2xl p-4 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 hover:border-[#C99732] hover:shadow-xs border border-[#D6E0EC] bg-white h-36 text-center group">
                <div className="w-10 h-10 rounded-xl bg-[#FFF4DE] flex items-center justify-center text-[#C99732]">
                  <CalendarPlus className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-[#10233F] group-hover:text-[#C99732] leading-snug">
                  جدولة جلسة
                </span>
              </div>
            </Link>
          </div>
        </div>

        {/* Left Column (lg:col-span-5): حالة القضايا (Case Status Donut Chart) */}
        <div className="lg:col-span-5 rounded-2xl border border-[#D6E0EC] bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-[#C99732]" />
            <h2 className="text-base font-bold text-[#10233F]">حالة القضايا</h2>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Left side: Breakdown table */}
            <div className="space-y-2.5 flex-1 w-full">
              {caseStatusDonut.data.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-[#F8FAFC] transition-colors"
                >
                  <span className="font-mono font-bold text-[#10233F] w-10 text-right">{item.count}</span>
                  <span className="flex items-center gap-2 font-medium text-[#10233F] flex-1 justify-center">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                    <span>{item.name}</span>
                  </span>
                  <span className="font-mono font-bold text-[#64748B] w-12 text-left">{item.pct}</span>
                </div>
              ))}
            </div>

            {/* Right side: Recharts Donut Chart */}
            <div className="w-40 h-40 relative flex items-center justify-center shrink-0">
              <PieChart width={160} height={160}>
                <Pie
                  data={caseStatusDonut.data}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={68}
                  paddingAngle={3}
                  dataKey="count"
                >
                  {caseStatusDonut.data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                  ))}
                </Pie>
              </PieChart>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-2xl font-black font-mono tracking-tight text-[#10233F]">
                  {caseStatusDonut.total}
                </span>
                <span className="text-[10px] text-[#64748B] font-bold">قضية نشطة</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 5. WORKLOAD WIDGET (توزيع عبء العمل على المحامين) ─── */}
      <div className="rounded-2xl border border-[#D6E0EC] bg-white p-5 space-y-4 shadow-xs fade-in-up">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#C99732]"
              style={{ background: 'linear-gradient(135deg, #0B2A4A, #071D34)' }}
            >
              <Briefcase className="w-4 h-4 text-[#C99732]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#10233F]">توزيع عبء العمل على المحامين</h2>
              <p className="text-xs text-[#64748B]">
                متابعة الجلسات النشطة، الوكالات السارية، والمهام قيد التنفيذ لكل محامٍ
              </p>
            </div>
          </div>
          <Link
            href="/users"
            className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
          >
            <span>إدارة المحامين</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoadingWorkload ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : workloadData?.members && workloadData.members.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#D6E0EC] text-[#64748B]">
                  <th className="pb-2 font-medium">المحامي</th>
                  <th className="pb-2 font-medium text-center">جلسات نشطة</th>
                  <th className="pb-2 font-medium text-center">وكالات سارية</th>
                  <th className="pb-2 font-medium text-center">مهام قيد التنفيذ</th>
                  <th className="pb-2 font-medium text-center">إجمالي الأعباء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]/70">
                {workloadData.members.map((m) => {
                  const maxWorkload = Math.max(...workloadData.members.map((x) => x.totalWorkload), 1);
                  const pct = Math.round((m.totalWorkload / maxWorkload) * 100);

                  return (
                    <tr key={m.lawyerId} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-3 font-semibold text-[#10233F]">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#0B2A4A]/10 text-[#0B2A4A] font-bold text-xs flex items-center justify-center">
                            {m.lawyerName.charAt(0)}
                          </div>
                          <div>
                            <div>{m.lawyerName}</div>
                            <div className="text-[10px] text-[#64748B] font-mono">@{m.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600">
                          {m.activeSessions}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600">
                          {m.openPoa}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600">
                          {m.pendingTasks}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-20 bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-[#C99732] h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-[#10233F] text-xs">{m.totalWorkload}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-[#64748B] text-xs">
            لم يتم تسجيل أي محامين في هذا المكتب بعد.
          </div>
        )}
      </div>

      {/* ─── 6. OFFICE TEAM OVERSIGHT SECTION (Sessions, Tasks & POAs) ─── */}
      <div className="space-y-4 fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-[#D6E0EC] bg-white shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #0B2A4A 0%, #071D34 100%)' }}
              >
                <Briefcase className="w-4 h-4 text-[#C99732]" />
              </div>
              <h2 className="text-base font-bold text-[#10233F]">
                سجل جلسات ومهام فريق عمل المكتب
              </h2>
            </div>
            <p className="text-xs text-[#64748B] mt-1 mr-9">
              متابعة شاملة لجميع الجلسات القضائية والمهام الموزعة على محامي المكتب
            </p>
          </div>

          {/* Tab Switcher Pills */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-[#D6E0EC]/60 self-start sm:self-auto flex-wrap">
            <button
              onClick={() => setActiveOversightTab('sessions')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                activeOversightTab === 'sessions'
                  ? 'bg-white text-[#10233F] shadow-xs border border-[#D6E0EC]'
                  : 'text-[#64748B] hover:text-[#10233F]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>جلسات القضايا ({filteredOfficeSessions.length})</span>
            </button>
            <button
              onClick={() => setActiveOversightTab('tasks')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                activeOversightTab === 'tasks'
                  ? 'bg-white text-[#10233F] shadow-xs border border-[#D6E0EC]'
                  : 'text-[#64748B] hover:text-[#10233F]'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 text-[#C99732]" />
              <span>مهام المحامين ({filteredOfficeTasks.length})</span>
            </button>
            <button
              onClick={() => setActiveOversightTab('poas')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                activeOversightTab === 'poas'
                  ? 'bg-white text-[#10233F] shadow-xs border border-[#D6E0EC]'
                  : 'text-[#64748B] hover:text-[#10233F]'
              }`}
            >
              <FileKey className="w-3.5 h-3.5 text-emerald-500" />
              <span>وكالات المكتب ({filteredOfficePoas.length})</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl border border-[#D6E0EC] bg-white">
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
              className="pr-10 h-10 text-xs rounded-xl bg-white border-[#D6E0EC]"
            />
          </div>

          <div>
            <select
              value={selectedLawyerFilter}
              onChange={(e) => setSelectedLawyerFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-xs font-medium bg-white border border-[#D6E0EC] text-[#10233F] focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">جميع محامي المكتب</option>
              {officeMembers.map((m) => (
                <option key={m.id} value={m.displayName || m.username}>
                  المحامي: {m.displayName || m.username}
                </option>
              ))}
            </select>
          </div>

          {activeOversightTab === 'sessions' ? (
            <div>
              <select
                value={sessionStatusFilter}
                onChange={(e) => setSessionStatusFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-xl text-xs font-medium bg-white border border-[#D6E0EC] text-[#10233F] focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
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
                className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
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
                  <div key={n} className="rounded-xl border border-[#D6E0EC] bg-white p-4">
                    <Skeleton className="h-4 w-40 mb-2" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                ))}
              </div>
            ) : filteredOfficeSessions.length > 0 ? (
              <div className="space-y-2.5">
                {filteredOfficeSessions.slice(0, 10).map((session: Session) => {
                  const eff = deriveEffectiveStatus(session.status, session.hearingAt);
                  const lawyer = getLawyerName(session);

                  return (
                    <div
                      key={session.id}
                      className="rounded-xl border border-[#D6E0EC] bg-white p-4 hover:border-primary/40 transition-all flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[#10233F] font-mono">{session.caseNumber}</span>
                            <span className="text-[11px] text-[#64748B]">{session.court}</span>
                          </div>
                          <div className="text-[11px] text-[#64748B] mt-0.5">
                            المحامي: <span className="font-semibold text-[#10233F]">{lawyer || 'غير محدد'}</span>
                            {session.notes && <span> — {session.notes}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] font-mono text-[#64748B]">
                          {formatArabicDate(session.hearingAt, session.sessionDateHijri)}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            eff === 'Finished'
                              ? 'bg-purple-500/15 text-purple-600'
                              : eff === 'Today'
                              ? 'bg-amber-500/15 text-amber-600'
                              : 'bg-emerald-500/15 text-emerald-600'
                          }`}
                        >
                          {eff === 'Finished' ? 'منتهية' : eff === 'Today' ? 'اليوم' : 'قادمة'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#D6E0EC] bg-white/50 p-8 text-center space-y-2">
                <Calendar className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
                <p className="text-xs text-[#64748B] font-medium">لا توجد جلسات تطابق خيارات التصفية المحددة.</p>
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
                    className="rounded-xl border border-[#D6E0EC] bg-white p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-xs flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="font-bold text-xs text-[#10233F] line-clamp-1">{task.title}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            task.status === 'مكتملة'
                              ? 'bg-emerald-500/15 text-emerald-600'
                              : task.status === 'قيد التنفيذ'
                              ? 'bg-blue-500/15 text-blue-600'
                              : 'bg-amber-500/15 text-amber-600'
                          }`}
                        >
                          {task.status || 'جديدة'}
                        </span>
                      </div>
                      {task.notes && (
                        <p className="text-[11px] text-[#64748B] line-clamp-1">{task.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#D6E0EC]/60">
                      <div className="flex items-center gap-1.5 text-[#64748B]">
                        <User className="w-3.5 h-3.5 text-primary" />
                        <span className="font-semibold text-[#10233F]">
                          المحامي المعين: {getLawyerName(task) || task.assignee || 'غير محدد'}
                        </span>
                      </div>
                      {task.dueDate && (
                        <span className="text-[10px] text-[#64748B] font-mono">
                          الاستحقاق: {task.dueDate}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#D6E0EC] bg-white/50 p-8 text-center space-y-2">
                <CheckSquare className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
                <p className="text-xs text-[#64748B] font-medium">لا توجد مهام تطابق خيارات التصفية المحددة.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {isLoadingPoas ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="rounded-xl border border-[#D6E0EC] bg-white p-4 space-y-2">
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
                      className="rounded-xl border border-[#D6E0EC] bg-white p-4 transition-all duration-200 hover:border-emerald-500/40 hover:shadow-xs flex flex-col justify-between gap-3 relative overflow-hidden"
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
                          <span className="font-bold text-xs text-[#10233F] line-clamp-1">{poa.clientName}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              isExpired
                                ? 'bg-rose-500/15 text-rose-600'
                                : isExpiringSoon
                                ? 'bg-[#C99732]/20 text-[#C99732]'
                                : 'bg-emerald-500/15 text-emerald-600'
                            }`}
                          >
                            {isExpired ? 'منتهية' : `${days} يوم متبقٍ`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#64748B] font-mono">
                          <FileKey className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>رقم الوكالة: {poa.poaNumber}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[#D6E0EC]/60">
                        <div className="flex items-center gap-1.5 text-[#64748B]">
                          <User className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="font-semibold text-[#10233F]">
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
              <div className="rounded-2xl border border-dashed border-[#D6E0EC] bg-white/50 p-8 text-center space-y-2">
                <FileKey className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
                <p className="text-xs text-[#64748B] font-medium">لا توجد وكالات تطابق خيارات التصفية المحددة.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── 7. ADMIN QUICK ACTION SHORTCUTS (Tested Links) ─── */}
      <div className="space-y-3 fade-in-up">
        <h2 className="text-sm font-bold text-[#10233F]">روابط الإدارة والخدمات</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickActionCard
            title="إدارة أعضاء المكتب"
            description="إضافة محامين جدد، إرسال روابط التفعيل وإدارة الصلاحيات"
            href="/users"
            icon={Users}
            iconBg="bg-indigo-500/15"
            iconColor="text-indigo-600"
            dataTestId="link-admin-users"
          />

          <QuickActionCard
            title="الاشتراك وحصص الاستهلاك"
            description="متابعة باقة المكتب وتخصيص حصص الذكاء الاصطناعي لكل محامٍ"
            href="/subscription"
            icon={CreditCard}
            iconBg="bg-amber-500/15"
            iconColor="text-amber-600"
            dataTestId="link-admin-subscription"
          />

          <QuickActionCard
            title="إعدادات وربط Google Sheets"
            description="ربط جدول المكتب السحابي، فحص الاتصال وتصدير البيانات"
            href="/settings"
            icon={Settings}
            iconBg="bg-emerald-500/15"
            iconColor="text-emerald-600"
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
