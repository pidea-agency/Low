import React from 'react';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LandingData } from '../types';

interface CtaSectionProps {
  data: LandingData | null;
  onOpenConsultation: () => void;
}

export function CtaSection({ data, onOpenConsultation }: CtaSectionProps) {
  const whatsappUrl = data?.office?.whatsappUrl || 'https://wa.me/970567603295';
  const whatsappFormatted = data?.office?.whatsappFormatted || '+970 56 760 3295';

  return (
    <section id="contact" dir="rtl" className="py-20 sm:py-28 bg-white border-t border-[#E2E8F0]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <span className="text-xs sm:text-sm font-bold text-[#C99732] uppercase tracking-wider font-sans block">
          ابدأ تنظيم عمل مكتبك
        </span>

        <h2 className="font-sans text-3xl sm:text-5xl font-black text-[#0C1A30] tracking-tight">
          جاهز لإنهاء تشتت المواعيد وضياع تفاصيل الجلسات؟
        </h2>

        <p className="text-sm sm:text-base text-[#475569] leading-relaxed max-w-2xl mx-auto">
          تحدث معنا لاستعراض تجربة حية لكيفية إدارة جلساتك، قضاياك، والوكالات الشرعية لفريقك في منصة واحدة منظمة مع تنبيهات واتساب استباقية.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Button
            onClick={onOpenConsultation}
            className="h-11 px-7 rounded-xl bg-[#0B1B3D] hover:bg-[#071328] text-white text-xs sm:text-sm font-semibold shadow-xs transition-all hover:scale-102 border border-[#C99732]/30 cursor-pointer"
          >
            <span>اطلب عرضاً تجريبياً</span>
            <ArrowLeft className="w-3.5 h-3.5 mr-1 text-[#C99732]" />
          </Button>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="h-11 px-6 rounded-xl border border-[#D6E0EC] bg-white hover:bg-slate-50 text-[#0C1A30] text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-2xs"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600" />
            <span>محادثة عبر الواتساب ({whatsappFormatted})</span>
          </a>
        </div>
      </div>
    </section>
  );
}
