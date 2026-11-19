import React from 'react';
import { ArrowLeft, Sparkles, CheckCircle2, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LandingData } from '../types';

interface HeroSectionProps {
  data: LandingData | null;
  onOpenConsultation: () => void;
}

export function HeroSection({ data, onOpenConsultation }: HeroSectionProps) {
  return (
    <section
      id="hero"
      dir="rtl"
      className="relative pt-32 sm:pt-40 pb-0 overflow-hidden bg-gradient-to-b from-[#F2F6FA] via-[#F8FAFC] to-[#FBF9F5]"
    >
      {/* Decorative ambient judicial glow */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 w-full max-w-5xl h-80 bg-gradient-to-b from-[#0B2A4A]/5 to-transparent blur-3xl pointer-events-none -z-10" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        {/* Judicial Blue Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EFF4FF] border border-[#CFDFFC] text-[#0B2A4A] text-xs font-semibold shadow-2xs backdrop-blur-xs">
          <Scale className="w-3.5 h-3.5 text-[#C99732]" />
          <span>نظام إدارة القضايا وجلسات المحاكم لمكاتب المحاماة</span>
        </div>

        {/* Grand Headline with Login Page's Navy & Gold Elegance */}
        <div className="space-y-4 max-w-4xl mx-auto">
          <h1 className="font-sans text-3xl sm:text-5xl lg:text-6xl font-black text-[#0C1A30] tracking-tight leading-[1.2] sm:leading-[1.15]">
            تتبّع مسار قضاياك،
            <span className="block text-[#C99732] font-black mt-1 sm:mt-2">
              مش أرقامها المشتتة.
            </span>
          </h1>

          <p className="text-base sm:text-lg lg:text-xl text-[#475569] leading-relaxed max-w-3xl mx-auto font-sans font-normal pt-1">
            تنظيم شامل لجلسات المحاكم، ملفات القضايا، الوكالات، الأحكام، والمهام لفريق مكتبك بالكامل في منصة واحدة، مع تذكيرات واتساب استباقية لضمان عدم فوات أي موعد أو مهلة.
          </p>
        </div>

        {/* Primary Action Button */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            onClick={onOpenConsultation}
            className="h-12 px-8 rounded-xl bg-[#0B1B3D] hover:bg-[#071328] text-white text-sm sm:text-base font-semibold shadow-md flex items-center gap-2 transition-all hover:scale-103 border border-[#C99732]/30"
          >
            <span>اطلب عرضاً تجريبياً</span>
            <ArrowLeft className="w-4 h-4 text-[#C99732]" />
          </Button>
          <a
            href="#features"
            className="text-xs sm:text-sm font-semibold text-[#475569] hover:text-[#0B1B3D] px-4 py-2.5 transition-colors"
          >
            استكشف إمكانيات المنصة ↓
          </a>
        </div>

        {/* Real functional capability badges */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-[11px] sm:text-xs text-[#64748B] pt-2">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            عربي بالكامل ومخصص لإجراءات المحاكم
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            دعم متزامن للتقويمين الهجري والميلادي
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            تنبيهات فورية للمحامين عبر الواتساب
          </span>
        </div>
      </div>

     
    </section>
  );
}
