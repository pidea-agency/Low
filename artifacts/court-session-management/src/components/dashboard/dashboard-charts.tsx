import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Calendar, CheckCircle2, TrendingUp, BarChart3, Building2, Sparkles, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export interface DashboardChartsData {
  sessionsTrend: Array<{ month: string; total: number; finished: number; upcoming: number }>;
  sessionsStatusDistribution: Array<{ name: string; count: number; fill: string }>;
  tasksStatusDistribution: Array<{ name: string; count: number; fill: string }>;
  tasksPriorityDistribution: Array<{ priority: string; count: number; fill: string }>;
  courtsDistribution: Array<{ court: string; count: number }>;
  judgmentsDistribution: Array<{ name: string; count: number; fill: string }>;
  teamAiUsage?: Array<{ name: string; usage: number; quota: number; percentage: number }>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 shadow-md text-xs font-sans text-foreground" dir="rtl">
        {label && <p className="font-bold mb-1.5 text-foreground">{label}</p>}
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5 font-medium" style={{ color: entry.color || entry.fill }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.color || entry.fill }} />
              {entry.name}:
            </span>
            <span className="font-mono font-bold text-foreground tabular-nums">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

/**
 * Monthly Sessions Volume & Trend Area Chart
 */
export function SessionsTrendChart({
  data = [],
  isLoading = false,
}: {
  data?: DashboardChartsData['sessionsTrend'];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-60 w-full rounded-xl" />
      </div>
    );
  }

  const hasData = data && data.some((d) => d.total > 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #3F4A2C 0%, #2A321D 100%)' }}
          >
            <TrendingUp className="w-4 h-4 text-[#C9A449]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">نشاط وحركة الجلسات شهرياً</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">مقارنة إجمالي الجلسات والجلسات المنتهية</p>
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradientTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C9A449" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#C9A449" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradientFinished" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3F4A2C" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3F4A2C" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(231, 224, 203, 0.4)" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#888' }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#888' }} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="total"
                name="إجمالي الجلسات"
                stroke="#C9A449"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#gradientTotal)"
              />
              <Area
                type="monotone"
                dataKey="finished"
                name="جلسات منتهية"
                stroke="#3F4A2C"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#gradientFinished)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs border border-dashed border-border rounded-xl">
            <Calendar className="w-8 h-8 opacity-30 mb-2" />
            <p>لا توجد بيانات جلسات كافية لعرض المخطط الزمني</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-border/60 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#C9A449]" />
          <span className="text-muted-foreground font-medium">إجمالي الجلسات</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#3F4A2C]" />
          <span className="text-muted-foreground font-medium">جلسات منتهية</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Sessions Status Distribution Donut Chart
 */
export function SessionsStatusDonutChart({
  data = [],
  isLoading = false,
}: {
  data?: DashboardChartsData['sessionsStatusDistribution'];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-60 w-full rounded-xl" />
      </div>
    );
  }

  const validData = (data || []).filter((d) => d.count > 0);
  const totalCount = validData.reduce((acc, cur) => acc + cur.count, 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between">
      <div className="flex items-center gap-2.5 mb-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #C9A449 0%, #B59138 100%)' }}
        >
          <Calendar className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">حالات الجلسات القضائية</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">التوزيع النسبي حسب المرحلة الحالية</p>
        </div>
      </div>

      <div className="h-56 relative flex items-center justify-center">
        {totalCount > 0 ? (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={validData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="count"
                >
                  {validData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black font-mono tabular-nums text-foreground">{totalCount}</span>
              <span className="text-[10px] text-muted-foreground font-semibold">جلسة</span>
            </div>
          </>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground text-xs border border-dashed border-border rounded-xl">
            <AlertCircle className="w-8 h-8 opacity-30 mb-2" />
            <p>لا توجد جلسات مسجلة حالياً</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-border/60 text-xs">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between p-1.5 rounded-lg bg-muted/40">
            <span className="flex items-center gap-1.5 font-medium text-muted-foreground text-[11px]">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.fill }} />
              {item.name}
            </span>
            <span className="font-mono font-bold text-foreground tabular-nums text-xs">
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Tasks Completion and Status Distribution Chart
 */
export function TasksStatusChart({
  data = [],
  isLoading = false,
}: {
  data?: DashboardChartsData['tasksStatusDistribution'];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-60 w-full rounded-xl" />
      </div>
    );
  }

  const validData = (data || []).filter((d) => d.count > 0);
  const totalTasks = validData.reduce((acc, cur) => acc + cur.count, 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between">
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
        >
          <CheckCircle2 className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">حالات ومؤشرات إنجاز المهام</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">متابعة إتمام المهام الإدارية والقانونية</p>
        </div>
      </div>

      <div className="h-60 w-full">
        {totalTasks > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(231, 224, 203, 0.4)" />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#888' }} />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#555' }} width={80} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="عدد المهام" radius={[0, 8, 8, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`task-cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs border border-dashed border-border rounded-xl">
            <CheckCircle2 className="w-8 h-8 opacity-30 mb-2" />
            <p>لا توجد مهام مسجلة حالياً</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs pt-3 mt-2 border-t border-border/60">
        <span className="text-muted-foreground font-medium">إجمالي المهام المسجلة:</span>
        <span className="font-mono font-bold text-foreground tabular-nums text-sm">{totalTasks} مهمة</span>
      </div>
    </div>
  );
}

/**
 * Top Courts Distribution Chart
 */
export function CourtsDistributionChart({
  data = [],
  isLoading = false,
}: {
  data?: DashboardChartsData['courtsDistribution'];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-60 w-full rounded-xl" />
      </div>
    );
  }

  const hasData = data && data.length > 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between">
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #3F4A2C 0%, #333D24 100%)' }}
        >
          <Building2 className="w-4 h-4 text-[#C9A449]" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">توزيع القضايا حسب المحاكم</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">أبرز المحاكم المتداولة فيها الجلسات</p>
        </div>
      </div>

      <div className="h-60 w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(231, 224, 203, 0.4)" />
              <XAxis
                dataKey="court"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: '#555' }}
                interval={0}
                angle={-20}
                textAnchor="end"
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#888' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="عدد الجلسات" fill="#3F4A2C" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs border border-dashed border-border rounded-xl">
            <Building2 className="w-8 h-8 opacity-30 mb-2" />
            <p>لا توجد بيانات محاكم مسجلة</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Team AI Usage Comparison Bar Chart (Admin Only)
 */
export function TeamAiUsageChart({
  data = [],
  isLoading = false,
}: {
  data?: DashboardChartsData['teamAiUsage'];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-60 w-full rounded-xl" />
      </div>
    );
  }

  const hasData = data && data.length > 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between">
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #C9A449 0%, #B59138 100%)' }}
        >
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">استهلاك الذكاء الاصطناعي لفريق العمل</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">مقارنة الاستهلاك الفعلي بالرصيد المخصص لكل محامٍ</p>
        </div>
      </div>

      <div className="h-60 w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(231, 224, 203, 0.4)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#555' }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#888' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="usage" name="الاستهلاك الفعلي" fill="#C9A449" radius={[6, 6, 0, 0]} />
              <Bar dataKey="quota" name="سقف الحصة" fill="rgba(63, 74, 44, 0.25)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs border border-dashed border-border rounded-xl">
            <Sparkles className="w-8 h-8 opacity-30 mb-2" />
            <p>لا يوجد أعضاء مضافون في المكتب لعرض الاستهلاك</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-border/60 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#C9A449]" />
          <span className="text-muted-foreground font-medium">الاستهلاك الفعلي</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#3F4A2C]/30" />
          <span className="text-muted-foreground font-medium">الحصة المخصصة</span>
        </div>
      </div>
    </div>
  );
}

