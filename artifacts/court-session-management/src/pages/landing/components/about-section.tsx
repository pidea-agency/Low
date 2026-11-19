import React from 'react';
import { Globe2, ShieldCheck, Building, Landmark, ArrowLeft, ArrowUpRight } from 'lucide-react';
import type { LandingData } from '../types';

interface AboutSectionProps {
  data: LandingData | null;
  onExploreTopic: (topic: string) => void;
}

export function AboutSection({ data, onExploreTopic }: AboutSectionProps) {
  const pillars = [
    {
      id: 'cross-border',
      title: 'ممارسات استراتيجية عابرة للحدود',
      desc: 'مرافقة ومواكبة في أعقد النزاعات والتحكيم العابر للحدود، مدعومة ببنية استشارات قانونية متقدمة في الأسواق الإقليمية والدولية.',
      actionText: 'اقرأ عن الممارسة',
      icon: Globe2,
      color: 'text-[#00236f]',
      bg: 'bg-[#EFF4FF]',
    },
    {
      id: 'alliances',
      title: 'تحالفات قانونية دولية',
      desc: 'امتداد استراتيجي عبر شبكة تحالفات تضم مكاتب قانونية وخبراء دوليين، لتقديم المشورة الميدانية ومباشرة القضايا على المستوى العالمي والمحلي.',
      actionText: 'خريطة التحالفات والارتباط',
      icon: Landmark,
      color: 'text-blue-700',
      bg: 'bg-blue-50',
    },
    {
      id: 'governance',
      title: 'حوكمة ومشاريع وطنية كبرى',
      desc: 'مساندة وتمثيل استراتيجي لمشاريع رؤية المملكة 2030، والامتثال لأحدث اللوائح في النظام التجاري والشركات والبيئة الاستثمارية الجديدة.',
      actionText: 'مشاريع ومبادرات الحوكمة',
      icon: Building,
      color: 'text-amber-700',
      bg: 'bg-amber-50',
    },
    {
      id: 'confidentiality',
      title: 'استقلالية وسرية مطلقة',
      desc: 'معايير صارمة لتفادي تضارب المصالح مع توفير بيئة تشفير أمنية متكاملة لبيانات الموكلين، وحماية وثائق القضايا وفق اشتراطات الأمن السيبراني.',
      actionText: 'الامتثال والسرية المهنية',
      icon: ShieldCheck,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
    },
  ];

  return (
    <section id="about" className="py-20 bg-[#F8FAFF]" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#00236f] text-xs font-bold">
            <span>عن ديوان</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#0b1c30] tracking-tight">
            خبرة محلية راسخة بامتداد تحالفي عالمي
          </h2>
          <p className="text-xs sm:text-sm text-[#475569] leading-relaxed font-normal">
            تمتد خبراتنا وتجربتنا إلى عقود متواصلة من الأعمال القانونية والتنفيذية عبر مختلف القطاعات والأسواق،
            وصولاً إلى مشاريع الخصخصة والتنظيم التشريعي المعقد وفق الأنظمة السعودية والمعايير الدولية.
          </p>
        </div>

        {/* 4 Pillar Cards matching screenshot */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.id}
                className="bg-white rounded-2xl border border-[#D6E0EC] p-6 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div className="space-y-4">
                  <div className={`w-12 h-12 rounded-xl ${pillar.bg} ${pillar.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-[#10233F] leading-tight">
                    {pillar.title}
                  </h3>
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    {pillar.desc}
                  </p>
                </div>

                <div className="pt-5 mt-4 border-t border-[#F1F5F9]">
                  <button
                    onClick={() => onExploreTopic(pillar.title)}
                    className="text-xs font-bold text-[#00236f] group-hover:text-[#001c59] flex items-center justify-between w-full cursor-pointer"
                  >
                    <span>{pillar.actionText}</span>
                    <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
