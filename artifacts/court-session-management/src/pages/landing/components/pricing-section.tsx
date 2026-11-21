import React, { useState } from "react";
import { Check, ArrowLeft, Sparkles } from "lucide-react";
import type { LandingData } from "../types";

interface PricingSectionProps {
  data: LandingData | null;
  onOpenConsultation: () => void;
}

export function PricingSection({ data, onOpenConsultation }: PricingSectionProps) {
  const [isAnnual, setIsAnnual] = useState(true);

  const tiers = [
    {
      id: "solo",
      name: "باقة المكتب الفردي",
      englishName: "Solo / Starter",
      target: "للمحامين المستقلين والمكاتب الناشئة",
      monthlyPrice: "199",
      annualPrice: "159",
      highlighted: false,
      ctaText: "ابدأ تجربتك المجانية",
      features: [
        "حتى 3 محامين للمكتب",
        "إدارة غير محدودة للجلسات والوكالات",
        "نظام متكامل لإدارة المهام والمواعيد",
        "مزامنة فورية مع Google Sheets",
        "تقويم تفاعلي للمواعيد القضائية",
      ],
    },
    {
      id: "growth",
      name: "باقة المكتب المتكامل",
      englishName: "Growth",
      target: "لمكاتب المحاماة النشطة والمتوسطة",
      monthlyPrice: "499",
      annualPrice: "399",
      highlighted: true,
      badge: "الأكثر طلباً",
      ctaText: "ابدأ تجربتك المجانية لـ 14 يوم",
      features: [
        "حتى 15 محامياً ومستشاراً",
        "ربط وأتمتة رسائل واتساب للموكلين",
        "صلاحيات متقدمة وإدارة أدوار الفريق",
        "مزامنة ثنائية تلقائية مع Google Sheets",
        "إدارة وتوثيق مذكرات الجلسات والأحكام",
        "دعم فني مخصص ذو أولوية عبر واتساب",
      ],
    },
    {
      id: "enterprise",
      name: "باقة الشركات القانونية",
      englishName: "Enterprise",
      target: "لشركات المحاماة الكبرى متعددة الفروع",
      monthlyPrice: "مخصص",
      annualPrice: "مخصص",
      isCustomPrice: true,
      highlighted: false,
      ctaText: "تواصل مع المبيعات",
      features: [
        "عدد غير محدود من المحامين والشركاء",
        "ربط مخصص للمنظومة (Custom API & Webhooks)",
        "تدريب مخصص وورش عمل لفريق المكتب",
        "مدير حساب قانوني وتقني خاص",
        "اتفاقية مستوى الخدمة وضمان استمرارية (SLA)",
        "خوادم مخصصة أو تثبيت محلي عند الطلب",
      ],
    },
  ];

  return (
    <section
      id="pricing"
      dir="rtl"
      className="py-20 lg:py-28 bg-white border-b border-slate-200"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-xs font-medium mb-3">
            <span>الباقات والاشتراكات</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight text-balance">
            خطط واضحة تناسب حجم ونمو مكتبك
          </h2>
          <p className="text-base text-slate-600 mt-3 leading-relaxed text-balance">
            ابدأ بتجربة مجانية لـ 14 يوماً مع كافة المميزات، وبلا حاجة لبطاقة ائتمانية.
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="mt-8 inline-flex items-center p-1 rounded-lg border border-slate-200 bg-slate-50">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                !isAnnual
                  ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              شهري
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                isAnnual
                  ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>سنوي</span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                وفر 20%
              </span>
            </button>
          </div>
        </div>

        {/* 3-Tier Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {tiers.map((tier) => {
            const price = isAnnual ? tier.annualPrice : tier.monthlyPrice;

            return (
              <div
                key={tier.id}
                className={`rounded-xl p-6 sm:p-7 flex flex-col justify-between text-right transition-all ${
                  tier.highlighted
                    ? "border-2 border-slate-900 bg-white shadow-sm relative lg:-translate-y-1.5"
                    : "border border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                {/* Popular Badge */}
                {tier.badge && (
                  <div className="absolute -top-3 right-6 bg-slate-900 text-white text-[11px] font-bold px-3 py-0.5 rounded-full shadow-2xs">
                    {tier.badge}
                  </div>
                )}

                <div>
                  {/* Fixed min-h header block to align feature checklists horizontally */}
                  <div className="pb-5 border-b border-slate-100 min-h-[190px] flex flex-col justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {tier.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 leading-normal">
                        {tier.target}
                      </p>
                    </div>

                    {/* Price Block */}
                    <div className="mt-5">
                      <div className="flex items-baseline gap-1">
                        {tier.isCustomPrice ? (
                          <span className="text-3xl font-extrabold text-slate-900">
                            باقة مخصصة
                          </span>
                        ) : (
                          <>
                            <span className="text-4xl font-extrabold text-slate-900 tracking-tight font-mono">
                              {price}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              ر.س / شهرياً
                            </span>
                          </>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-1 min-h-[18px]">
                        {tier.isCustomPrice
                          ? "تكامل مخصص وخوادم خاصة مع اتفاقية SLA"
                          : isAnnual
                          ? "تُدفع سنوياً مع خصم 20%"
                          : "تُدفع شهرياً مع إمكانية الإلغاء بأي وقت"}
                      </span>
                    </div>
                  </div>

                  {/* Feature List */}
                  <ul className="space-y-3.5 my-6">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                        <span className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200">
                          <Check className="w-3 h-3" />
                        </span>
                        <span className="leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Card Button */}
                <button
                  onClick={onOpenConsultation}
                  className={`w-full h-11 rounded-lg text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                    tier.highlighted
                      ? "bg-slate-900 hover:bg-slate-800 text-white"
                      : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-800"
                  }`}
                >
                  <span>{tier.ctaText}</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Pricing Subtext */}
        <div className="mt-10 text-center text-xs text-slate-500">
          هل تحتاج إلى تخصيص معين أو عدد رخص أكبر لمكتبك؟{" "}
          <button
            onClick={onOpenConsultation}
            className="text-slate-900 underline font-semibold hover:text-slate-700 cursor-pointer"
          >
            تحدث مع فريقنا القانوني التقني مباشرة
          </button>
        </div>
      </div>
    </section>
  );
}
