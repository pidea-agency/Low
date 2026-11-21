import React from "react";
import { Languages, Calendar, BellRing } from "lucide-react";
import type { LandingData } from "../types";

interface StatsBannerProps {
  data: LandingData | null;
}

export function StatsBanner({ data }: StatsBannerProps) {
  return (
    <section
      id="stats"
      dir="rtl"
      className="py-16 sm:py-20 bg-white border-y border-[#E2E8F0]"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12 text-center divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-100">
          {/* Qualitative Pillar 1: Arabic-First */}
          <div className="pt-6 sm:pt-0 space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-[#00236f] flex items-center justify-center mx-auto mb-2">
              <Languages className="w-6 h-6" />
            </div>
            <div className="font-sans text-2xl sm:text-3xl font-black text-[#0C1A30] tracking-tight">
              عربي بالكامل
            </div>
            <div className="text-sm font-semibold text-[#0C1A30]">
              مبني خصيصاً لإجراءات ومحاكم المملكة
            </div>
            <div className="text-xs text-[#64748B] max-w-xs mx-auto leading-relaxed">
              مصطلحات قضائية دقيقة: محاكم، دوائر، وكالات شرعية، أحكام، وأطراف
              دعوى
            </div>
          </div>

          {/* Qualitative Pillar 2: Hijri & Gregorian */}
          <div className="pt-6 sm:pt-0 space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center mx-auto mb-2">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="font-sans text-2xl sm:text-3xl font-black text-[#0C1A30] tracking-tight">
              تقويم هجري وميلادي
            </div>
            <div className="text-sm font-semibold text-[#0C1A30]">
              مزامنة وحساب دقيق للمهل القانونية
            </div>
            <div className="text-xs text-[#64748B] max-w-xs mx-auto leading-relaxed">
              تحويل ومطابقة آلية للتواريخ في الجلسات وصلاحيات الوكالات الشرعية
              دون أي تعارض
            </div>
          </div>

          {/* Qualitative Pillar 3: Automated WhatsApp Alerts */}
          <div className="pt-6 sm:pt-0 space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF8EB] border border-[#F3E2B8] text-[#8C6B1B] flex items-center justify-center mx-auto mb-2">
              <BellRing className="w-6 h-6" />
            </div>
            <div className="font-sans text-2xl sm:text-3xl font-black text-[#0C1A30] tracking-tight">
              إشعارات واتساب فورية
            </div>
            <div className="text-sm font-semibold text-[#0C1A30]">
              تنبيهات استباقية للجلسات والوكالات
            </div>
            <div className="text-xs text-[#64748B] max-w-xs mx-auto leading-relaxed">
              تذكير آلي قبل 24 و 6 ساعات للمحامي المكلف والإدارة، مع تنبيهات
              بقرب انتهاء الوكالات
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
