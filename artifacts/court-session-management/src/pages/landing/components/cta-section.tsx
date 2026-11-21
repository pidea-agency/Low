import React from "react";
import { ArrowLeft, MessageCircle, CheckCircle2 } from "lucide-react";
import type { LandingData } from "../types";

interface CtaSectionProps {
  data: LandingData | null;
  onOpenConsultation: () => void;
}

export function CtaSection({ data, onOpenConsultation }: CtaSectionProps) {
  const whatsappUrl = data?.office?.whatsappUrl || "https://wa.me/970567603295";

  return (
    <section id="contact" dir="rtl" className="py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* High-Contrast Dark Block */}
        <div className="bg-slate-900 text-white rounded-2xl p-10 sm:p-14 text-center max-w-5xl mx-auto shadow-md relative overflow-hidden">
          {/* Subtle Accent Glow */}
          <div className="absolute top-0 right-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-0" />

          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700/80 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>جاهز لتطوير أداء مكتبك؟</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight text-balance">
              ارتقِ بإدارة مكتبك القانوني اليوم
            </h2>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
              انضم لمكاتب المحاماة التي وفرت ساعات من العمل الإداري اليومي،
              واحمِ قضايا موكليك من مخاطر المواعيد الفائتة.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4">
              <button
                onClick={onOpenConsultation}
                className="w-full sm:w-auto h-12 px-7 rounded-lg bg-white hover:bg-slate-100 text-slate-900 text-base font-bold transition-all inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs group"
              >
                <span>ابدأ تجربتك المجانية الآن</span>
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              </button>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto h-12 px-5 rounded-lg border border-slate-700 hover:bg-slate-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                <span>محادثة فورية مع المستشار</span>
              </a>
            </div>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-5 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                تجربة مجانية كاملة لـ 14 يوماً
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                تفعيل فوري ودعم إعداد مجاني
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
