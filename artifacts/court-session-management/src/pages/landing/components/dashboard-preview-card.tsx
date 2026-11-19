import React, { useState } from 'react';
import { Calendar, FileText, CheckCircle2, AlertCircle, ArrowUpRight, Scale, Shield, Users, Clock, Building2 } from 'lucide-react';
import type { LandingData } from '../types';

interface DashboardPreviewCardProps {
  data: LandingData | null;
  onExplore: () => void;
}

export function DashboardPreviewCard({ data, onExplore }: DashboardPreviewCardProps) {
  const [activeTab, setActiveTab] = useState<'hearings' | 'cases' | 'tasks'>('hearings');

  const todayCount = data?.preview?.todaySessionsCount ?? 0;
  const casesCount = data?.stats?.totalCases ?? 21;
  const tasksCount = data?.preview?.urgentTasksCount ?? 8;
  const sessionsCount = data?.stats?.totalSessions ?? 106;

  const featured = data?.preview?.featuredSessions?.[0];

  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl bg-[#0b1329] p-3 sm:p-5 shadow-2xl border border-white/10 text-white relative overflow-hidden" dir="rtl">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#00236f]/40 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Frame Top Header */}
      <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-white/10 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 pl-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="text-white/60 font-mono text-[11px] hidden sm:inline" dir="ltr">
            diwan.app/workspace/overview
          </span>
        </div>

        <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white/80 font-semibold text-[11px]">لوحة التحكم المؤسسية المتكاملة (Live)</span>
        </div>

        <button
          onClick={onExplore}
          className="text-white/70 hover:text-white flex items-center gap-1 text-[11px] transition-colors cursor-pointer"
        >
          <span>استعراض النظام</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Inner Split Layout matching screenshot visual */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Interactive metric cards */}
        <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
          {/* Widget 1: جلسات اليوم والجلسات */}
          <div
            onClick={() => setActiveTab('hearings')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'hearings'
                ? 'bg-white/10 border-white/30 shadow-md ring-1 ring-white/20'
                : 'bg-white/5 border-white/10 hover:bg-white/[0.08]'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs text-white/70 font-medium block">جلسات اليوم ومواعيد الدوائر</span>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-extrabold text-white font-mono">{todayCount}</span>
                  <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    مجموع {sessionsCount} جلسة موثقة
                  </span>
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed pt-0.5">
                  أرشفة وتتبع وقائع المحاكمات إلكترونياً مع تنبيهات الواتساب الآلية.
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Widget 2: القضايا النشطة */}
          <div
            onClick={() => setActiveTab('cases')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'cases'
                ? 'bg-white/10 border-white/30 shadow-md ring-1 ring-white/20'
                : 'bg-white/5 border-white/10 hover:bg-white/[0.08]'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs text-white/70 font-medium block">القضايا النشطة المتداولة</span>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-extrabold text-white font-mono">{casesCount}</span>
                  <span className="text-[11px] text-blue-400 font-semibold bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                    قضايا متداولة رسمياً
                  </span>
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed pt-0.5">
                  ربط وقائع المرافعة وصحف الدعاوى وفق تصنيفات القضاء التجاري والعام.
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Widget 3: المهام القضائية والوكالات */}
          <div
            onClick={() => setActiveTab('tasks')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'tasks'
                ? 'bg-white/10 border-white/30 shadow-md ring-1 ring-white/20'
                : 'bg-white/5 border-white/10 hover:bg-white/[0.08]'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs text-white/70 font-medium block">المهام القضائية والوكالات المعتمدة</span>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-extrabold text-white font-mono">{tasksCount}</span>
                  <span className="text-[11px] text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    أولوية متابعة
                  </span>
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed pt-0.5">
                  صلاحيات ممارسين وإسناد المهام لفرق المرافعة مع أمان التحقق.
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Stage / Office Boardroom scene */}
        <div className="lg:col-span-7 rounded-2xl bg-gradient-to-br from-slate-900 to-[#10233F] border border-white/15 p-4 sm:p-6 relative overflow-hidden flex flex-col justify-between min-h-[340px]">
          {/* Subtle boardroom architectural background */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity pointer-events-none"
            style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80')`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1329] via-[#0b1329]/70 to-transparent pointer-events-none" />

          {/* Top Stage Badges */}
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#C49A45]" />
              <span>مجلس التمثيل القضائي • Diwan Chamber</span>
            </span>
            <span className="text-[11px] text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full font-mono border border-emerald-500/30">
              جلسة متزامنة نشطة
            </span>
          </div>

          {/* Center/Bottom Info overlay from real case */}
          <div className="relative z-10 mt-auto pt-8 space-y-3">
            <div className="p-3.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/15 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#C49A45] font-bold">
                  {featured?.caseNumber || 'رقم القضية: 4821/2026'}
                </span>
                <span className="text-white/60 font-mono text-[11px]">
                  {featured?.court || 'المحكمة التجارية بالرياض'}
                </span>
              </div>
              <h4 className="text-sm font-bold text-white">
                {featured?.subject || 'دعوى تجارية كبرى ومطالبة استثمارية متوافقة مع الأنظمة'}
              </h4>
              <div className="flex items-center justify-between text-[11px] text-white/70 pt-1 border-t border-white/10">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-white/50" />
                  <span>الموعد: {featured?.time || '10:30 ص'}</span>
                </span>
                <span className="text-emerald-400 font-medium">
                  {featured?.circuit || 'الدائرة الحقوقية الثالثة'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-white/60 text-[11px]">
                نظام مشفر سحابياً وفق اشتراطات الأمن السيبراني بالمملكة
              </span>
              <button
                onClick={onExplore}
                className="px-3.5 py-1.5 rounded-lg bg-[#C49A45] hover:bg-[#a87f2e] text-[#0b1329] font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>معاينة الجلسة</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
