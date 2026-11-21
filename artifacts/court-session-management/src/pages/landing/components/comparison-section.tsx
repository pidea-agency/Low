import React from "react";
import { X, Check } from "lucide-react";
import type { LandingData } from "../types";

interface ComparisonSectionProps {
  data: LandingData | null;
}

export function ComparisonSection({ data }: ComparisonSectionProps) {
  const brandName = data?.office?.name || "ديوان";

  const traditionalPainPoints = [
    "ملفات Excel مبعثرة واحتمالية نسيان مواعيد الجلسات.",
    "ضياع ساعات يومياً في الرد على استفسارات الموكلين عبر الواتساب.",
    "عدم وضوح توزيع الوكالات والمهام بين محامي المكتب.",
    "صعوبة متابعة الأداء ومواعيد التسليم من خارج المكتب.",
  ];

  const platformSolutions = [
    "تقويم جلسات مركزي وتنبيهات تلقائية قبل كل موعد.",
    "إرسال تحديثات القضايا والجلسات للموكلين تلقائياً عبر واتساب.",
    "توزيع واضح للوكالات والصلاحيات والمهام لكل محامٍ.",
    "مزامنة فورية مع Google Sheets ولوحة تحكم شاملة من أي مكان.",
  ];

  return (
    <section
      id="comparison"
      dir="rtl"
      className="py-20 lg:py-24 bg-slate-50 border-b border-slate-200"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-200 bg-white text-slate-700 text-xs font-medium mb-3">
            <span>مقارنة الأداء والإنتاجية</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight text-balance">
            الفرق الجذري في إدارة مكتبك القانوني
          </h2>
          <p className="text-base text-slate-600 mt-3 leading-relaxed">
            كيف ينقل النظام روتين مكتبك من الفوضى والاعتماد على الذاكرة إلى
            الانضباط المؤسسي المؤتمت.
          </p>
        </div>

        {/* 2-Column Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Column 1: Muted / Traditional Way */}
          <div className="border border-slate-200 rounded-xl bg-white p-6 sm:p-8 flex flex-col justify-between text-right">
            <div>
              <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    إدارة المكتب بالطريقة التقليدية
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    إجراءات يدوية مجهدة ومهددة لسمعة المكتب
                  </p>
                </div>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                  معرّضة للأخطاء
                </span>
              </div>

              <ul className="space-y-4">
                {traditionalPainPoints.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 mt-0.5 border border-rose-100">
                      <X className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-sm text-slate-600 leading-relaxed">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-6 mt-8 border-t border-slate-100 text-xs text-slate-500">
              النتيجة: توتر دائم للمحامي وفقدان ثقة الموكلين عند أي تأخير غير مقصود.
            </div>
          </div>

          {/* Column 2: High-Contrast / Our Platform */}
          <div className="border-2 border-slate-900 rounded-xl bg-white p-6 sm:p-8 flex flex-col justify-between text-right shadow-xs relative">
            {/* Top Distinct Badge */}
            <div className="absolute -top-3 right-6 bg-slate-900 text-white text-[11px] font-bold px-3 py-0.5 rounded-full shadow-2xs">
              المنظومة الرقمية الحديثة
            </div>

            <div>
              <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    إدارة المكتب عبر {brandName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    أتمتة شاملة ودقة متناهية تحمي مواعيد قضاياك
                  </p>
                </div>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  انضباط كامل
                </span>
              </div>

              <ul className="space-y-4">
                {platformSolutions.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-sm font-medium text-slate-900 leading-relaxed">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-6 mt-8 border-t border-slate-100 text-xs text-emerald-700 font-medium">
              النتيجة: راحة بال تامة لمدير المكتب وانطباع احترافي فوري لدى كافة العملاء.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
