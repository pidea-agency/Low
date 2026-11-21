import React from "react";
import {
  ArrowLeft,
  ShieldCheck,
  DatabaseBackup,
  UserCheck,
  FileSpreadsheet,
} from "lucide-react";
import type { LandingData } from "../types";

interface HeroSectionProps {
  data: LandingData | null;
  onOpenConsultation: () => void;
}

export function HeroSection({ data, onOpenConsultation }: HeroSectionProps) {
  const scrollToHowItWorks = () => {
    const el = document.querySelector("#how-it-works");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const sessions = [
    {
      id: "1446/7821-ت",
      client: "شركة الروابي التجارية",
      lawyer: "أ. فيصل السعيد",
      date: "اليوم 09:30 ص",
      status: "مؤكدة",
      statusClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    {
      id: "1446/3412-ع",
      client: "ورثة عبد الرحمن آل تركي",
      lawyer: "أ. ريم القحطاني",
      date: "غداً 11:00 ص",
      status: "قيد المرافعة",
      statusClass: "bg-slate-100 text-slate-700 border-slate-200",
    },
    {
      id: "1446/9024-ع",
      client: "مؤسسة المناهل الرقمية",
      lawyer: "أ. خالد العتيبي",
      date: "24 رجب 1446",
      status: "تقديم مذكرة",
      statusClass: "bg-amber-50 text-amber-800 border-amber-200",
    },
    {
      id: "1446/1150-ت",
      client: "مجموعة الأفق القابضة",
      lawyer: "أ. سارة الشمري",
      date: "28 رجب 1446",
      status: "مؤكدة",
      statusClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
  ];

  const trustItems = [
    {
      title: "تشفير كامل لبيانات القضايا والوكالات",
      icon: ShieldCheck,
    },
    {
      title: "نسخ احتياطي يومي تلقائي",
      icon: DatabaseBackup,
    },
    {
      title: "صلاحيات معزولة لكل محامٍ",
      icon: UserCheck,
    },
    {
      title: "مزامنة فورية مع Google Sheets",
      icon: FileSpreadsheet,
    },
  ];

  return (
    <section id="hero" dir="rtl" className="relative bg-white overflow-visible">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. Dark Top Container: Calm, Ultra-Premium Dark Hero */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="relative bg-[#0B1120] text-white pt-16 pb-32 lg:pt-24 lg:pb-44 overflow-visible">
        {/* Calm Radial Top Ambient Glow (NOT neon) */}
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-[#0B1120] to-[#0B1120] pointer-events-none"
          aria-hidden="true"
        />

        {/* Centered Copy Container */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          {/* Top Pill */}
          <div className="inline-flex items-center gap-2 border border-slate-800 bg-slate-900/80 text-slate-300 text-xs font-medium px-3.5 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            <span>نظام إدارة المكاتب القانونية الأحدث في العالم العربي</span>
          </div>

          {/* H1 Headline: Sitting cleanly on 2 lines on desktop with zero orphans */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.2] text-balance max-w-3xl mx-auto">
            أدِر مكتبك القانوني بدقة..
            <span className="block mt-1 sm:mt-2 text-white">
              بلا جلسات فائتة ولا فوضى واتساب
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto mt-6 leading-relaxed text-balance">
            منصة واحدة تجمع المحامين، الجلسات، الوكالات، والمهام — مع مزامنة فورية لـ Google Sheets وإشعارات واتساب تلقائية لعملائك.
          </p>

          {/* CTA Row */}
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onOpenConsultation}
              className="bg-white text-slate-950 hover:bg-slate-100 px-6 py-3 rounded-lg font-semibold text-sm inline-flex items-center gap-2 cursor-pointer transition-colors shadow-xs group"
            >
              <span>ابدأ تجربتك المجانية (14 يوم)</span>
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            </button>

            <button
              onClick={scrollToHowItWorks}
              className="bg-slate-900 text-white border border-slate-700 hover:bg-slate-800 px-6 py-3 rounded-lg font-medium text-sm inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <span>شاهد عرض سريع للنظام</span>
            </button>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. Overlapping Crisp Light Dashboard Mockup (Visual Anchor) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 -mt-20 lg:-mt-32 relative z-20">
        {/* Outer Frame with Calm Backdrop Glow */}
        <div className="p-2 bg-slate-800/40 backdrop-blur-sm border border-slate-700/60 rounded-2xl shadow-2xl shadow-slate-950/30">
          {/* Inner Crisp White App Window */}
          <div className="bg-white text-slate-900 rounded-xl overflow-hidden border border-slate-200 text-right">
            {/* Minimalist App Header */}
            <div className="bg-slate-50/90 border-b border-slate-200 px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
              {/* Right side in RTL: Window Dots + Title */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
                </div>
                <span className="text-xs font-bold text-slate-800 hidden sm:inline">
                  جدول الجلسات القضائية القادمة
                </span>
              </div>

              {/* Left side in RTL: Two Subtle Status Pills */}
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>متزامن مع Google Sheets</span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>واتساب متصل</span>
                </div>
              </div>
            </div>

            {/* Clean, Breathable Court Sessions Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-700 font-semibold">
                    <th className="py-3 px-4 sm:px-5">رقم القضية</th>
                    <th className="py-3 px-4 sm:px-5">الموكل</th>
                    <th className="py-3 px-4 sm:px-5">المحامي</th>
                    <th className="py-3 px-4 sm:px-5">موعد الجلسة</th>
                    <th className="py-3 px-4 sm:px-5 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-sans">
                  {sessions.map((session, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 sm:px-5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {session.id}
                      </td>
                      <td className="py-3.5 px-4 sm:px-5 text-slate-800 font-medium whitespace-nowrap">
                        {session.client}
                      </td>
                      <td className="py-3.5 px-4 sm:px-5 text-slate-700 whitespace-nowrap">
                        {session.lawyer}
                      </td>
                      <td className="py-3.5 px-4 sm:px-5 text-slate-600 whitespace-nowrap">
                        {session.date}
                      </td>
                      <td className="py-3.5 px-4 sm:px-5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${session.statusClass}`}
                        >
                          {session.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. Trust Strip Below the Dashboard (on Crisp White Surface) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-white pt-12 pb-10 border-b border-slate-200/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center">
            {trustItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-emerald-700 shadow-2xs shrink-0">
                    <Icon className="w-4 h-4 text-emerald-700" />
                  </div>
                  <span className="text-slate-600 text-xs font-medium leading-snug">
                    {item.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
