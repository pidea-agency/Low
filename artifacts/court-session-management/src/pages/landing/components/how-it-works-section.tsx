import React from "react";
import { UserPlus, FolderInput, BellRing } from "lucide-react";
import type { LandingData } from "../types";

interface HowItWorksSectionProps {
  data: LandingData | null;
}

export function HowItWorksSection({ data }: HowItWorksSectionProps) {
  const steps = [
    {
      number: "01",
      title: "أنشئ مكتبك وأضف فريقك",
      description: "أضف المحامين وحدد صلاحيات كل عضو في أقل من دقيقتين.",
      icon: UserPlus,
    },
    {
      number: "02",
      title: "أدخل القضايا والوكالات والمهام",
      description:
        "اربط الجلسات بالمواعيد، أو استورد بياناتك الحالية مباشرة من Google Sheets.",
      icon: FolderInput,
    },
    {
      number: "03",
      title: "فعّل الأتمتة وراقب الإنجاز",
      description:
        "يتولى النظام تذكير المحامين بالمهام وإرسال تحديثات الجلسات للموكلين عبر واتساب تلقائياً.",
      icon: BellRing,
    },
  ];

  return (
    <section
      id="how-it-works"
      dir="rtl"
      className="py-20 lg:py-28 bg-slate-950 text-white border-b border-slate-900 relative overflow-hidden"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-800 bg-slate-900 text-slate-300 text-xs font-medium mb-3">
            <span>آلية العمل</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight text-balance">
            الانتقال إلى النظام أسهل مما تتوقع
          </h2>
          <p className="text-base text-slate-400 mt-3 leading-relaxed text-balance">
            3 خطوات بسيطة تفصل مكتبك عن الانضباط الرقمي الكامل دون تعقيد تقني أو انقطاع لسير العمل.
          </p>
        </div>

        {/* 3-Column Horizontal Flow */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={index}
                className="border border-slate-800 rounded-xl bg-slate-900 p-6 sm:p-7 flex flex-col justify-between text-right shadow-sm hover:border-slate-700 transition-colors group"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-mono text-5xl font-bold text-slate-800 tracking-tighter group-hover:text-slate-700 transition-colors">
                      {step.number}
                    </span>
                    <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-slate-200" />
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-white leading-snug">
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-400 mt-2.5 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                <div className="pt-5 mt-6 border-t border-slate-800/80 flex items-center gap-2 text-xs font-medium text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>خطوة مؤتمتة وسريعة</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
