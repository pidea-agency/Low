import React, { useState } from 'react';
import { CheckCircle2, ArrowLeft, ArrowUpRight, Scale, Briefcase, Building, Coins, ShieldAlert, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LandingData } from '../types';

interface PracticeAreasSectionProps {
  data: LandingData | null;
  onSelectArea: (areaTitle: string) => void;
}

export function PracticeAreasSection({ data, onSelectArea }: PracticeAreasSectionProps) {
  const [activeTabId, setActiveTabId] = useState('m-and-a');

  const practiceAreas = [
    {
      id: 'arbitration',
      tabLabel: 'النزاعات والتحكيم',
      sector: 'المنازعات والوساطة القضائية',
      title: 'التحكيم المؤسسي والنزاعات الكبرى',
      desc: 'إدارة استراتيجية لأعقد النزاعات القضائية وجلسات التحكيم المحلي والدولي، وصياغة مذكرات الدفوع والمرافعة المعتمدة على أدق السوابق والأنظمة القضائية.',
      imageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1000&q=80',
      bullets: [
        'تمثيل الموكلين أمام مراكز التحكيم المحلية (SCCA) والدولية المعتمدة',
        'صياغة شرط ومشارطة التحكيم وفق نظام التحكيم السعودي ولائحته التنفيذية',
        'متابعة تنفيذ أحكام المحكمين الأجنبية والمحلية عبر محاكم التنفيذ',
        'إدارة المفاوضات القضائية والتسويات الودية لإنهاء النزاعات قبل التصعيد',
      ],
    },
    {
      id: 'commercial',
      tabLabel: 'المحاكم التجارية',
      sector: 'القضاء التجاري والمالي',
      title: 'الدعاوى التجارية والنزاعات الاستثمارية',
      desc: 'تمثيل الشركات والمؤسسات أمام الدوائر التجارية بالمملكة، ومتابعة قضايا العقود التجارية، المنافسة غير المشروعة، وحماية حقوق المساهمين والشركاء.',
      imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=80',
      bullets: [
        'صياغة صحف الدعاوى والمذكرات الجوابية في نزاعات العقود التجارية',
        'تمثيل الشركات في قضايا الإفلاس وإعادة التنظيم المالي المعتمدة',
        'استصدار الأوامر الوقتية والتحفظية العاجلة لحماية أصول الموكلين',
        'الترافع أمام دوائر الاستئناف والمحكمة العليا وفق المعايير القضائية',
      ],
    },
    {
      id: 'm-and-a',
      tabLabel: 'الشركات والاستحواذ (M&A)',
      sector: 'القطاع التجاري والاستثماري',
      title: 'الاندماج والاستحواذ (M&A) وحوكمة الشركات',
      desc: 'نرافق المستثمرين والمبتكرين والشركات في مختلف صفقات الاستحواذ والتخارج الاستثماري والمشاريع المشتركة، بدءاً من تقييم المخاطر وهيكلة الصفقات وانتهاءً بالتفاوض والإغلاق وحيازة الحصص وفق متطلبات هيئة المنافسة وسوق المال.',
      imageUrl: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1000&q=80',
      bullets: [
        'إعداد المستندات واتفاقيات الشراكة وفق الأنظمة التجارية السعودية',
        'الفحص النافي للجهالة (Due Diligence) وتحديد وتحييد المخاطر القانونية',
        'التفاوض وتمثيل الشركات لصياغة صفقات استراتيجية متوافقة بعد المراجعة',
        'الحصول على الموافقات وتجنب المخالفات من الهيئة العامة للمنافسة وهيئة السوق المالية',
      ],
    },
    {
      id: 'tax',
      tabLabel: 'الضرائب والزكاة والجمارك',
      sector: 'الامتثال المالي والضريبي',
      title: 'نزاعات الزكاة والضرائب والجمارك',
      desc: 'حلول متقدمة للتعامل مع الاعتراضات الزكوية والضريبية أمام اللجان شبه القضائية ولجان الفصل في المخالفات والمنازعات التابعة للأمانة العامة للجان الضريبية.',
      imageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1000&q=80',
      bullets: [
        'دراسة الربوط الزكوية والضريبية وإعداد لوائح الاعتراض المسببة',
        'الترافع أمام اللجان الابتدائية والاستئنافية للمنازعات والمخالفات الزكوية',
        'استشارات ضريبة القيمة المضافة والتصرفات العقارية للشركات الكبرى',
        'تحقيق الامتثال الوقائي لتجنب الغرامات والجزاءات التراكمية',
      ],
    },
    {
      id: 'real-estate',
      tabLabel: 'المشاريع والتطوير العقاري',
      sector: 'العقارات والإنشاءات الكبرى',
      title: 'النزاعات العقارية وتطوير المشاريع',
      desc: 'حماية وتوثيق حقوق المطورين والمستثمرين في الصفقات العقارية الكبرى، معالجة قضايا المساهمات العقارية المتعثرة، والامتثال للوائح الهيئة العامة للعقار.',
      imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80',
      bullets: [
        'صياغة عقود التطوير والتسويق العقاري واتفاقيات المقاولات الفيديك (FIDIC)',
        'معالجة نزاعات الإفراغ وإثبات الملكية وتداخل الصكوك العقارية',
        'تأسيس الصناديق العقارية المتوافقة مع لوائح هيئة السوق المالية',
        'التمثيل القانوني في نزاعات البيع على الخارطة (وافي)',
      ],
    },
    {
      id: 'ip',
      tabLabel: 'الملكية الفكرية',
      sector: 'الابتكار والتقنية',
      title: 'حماية الملكية الفكرية والعلامات التجارية',
      desc: 'تسجيل وحماية الأصول غير الملموسة للشركات، والتصدي للتعديات على العلامات وبراءات الاختراع والبرمجيات أمام الهيئة السعودية للملكية الفكرية والمحاكم المختصة.',
      imageUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1000&q=80',
      bullets: [
        'تسجيل وحماية العلامات التجارية والنماذج الصناعية محلياً ودولياً',
        'مباشرة دعاوى التقليد والمنافسة غير المشروعة ومصادرة البضائع المقلدة',
        'صياغة عقود الامتياز التجاري (Franchise) واتفاقيات ترخيص الاستخدام',
        'حماية أسرار العمل والبرمجيات والبيانات والخوارزميات التقنية',
      ],
    },
  ];

  const currentArea = practiceAreas.find((a) => a.id === activeTabId) || practiceAreas[2];

  return (
    <section id="practice-areas" className="py-20 bg-white" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header matching screenshot */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#00236f] text-xs font-bold">
            <span>مجالات الاختصاص</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#0b1c30] tracking-tight">
            خبرة مركزة وحلول مصممة لأدق المسائل القضائية
          </h2>
          <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
            نظام مصمم لخدمة وتمثيل أدق المسائل القانونية ومتابعة المحاكمات المعقدة في مختلف التخصصات النظامية.
          </p>
        </div>

        {/* Filter Tabs Bar matching screenshot */}
        <div className="flex items-center justify-start lg:justify-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {practiceAreas.map((area) => (
            <button
              key={area.id}
              onClick={() => setActiveTabId(area.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTabId === area.id
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#EFF4FF] hover:text-[#00236f] border border-[#E2E8F0]'
              }`}
            >
              {area.tabLabel}
            </button>
          ))}
        </div>

        {/* Detailed Showcase Card matching screenshot */}
        <div className="rounded-3xl border border-[#D6E0EC] bg-[#FAFCFF] p-6 sm:p-8 shadow-xs overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Visual Column */}
            <div className="lg:col-span-5 rounded-2xl overflow-hidden shadow-md border border-[#E2E8F0] relative aspect-[4/3] bg-slate-100">
              <img
                src={currentArea.imageUrl}
                alt={currentArea.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-3 right-3 left-3 bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-white/40 text-right">
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mb-1">
                  فريق إدارة القضايا والصفقات
                </span>
                <p className="text-xs font-bold text-[#10233F] truncate">
                  إشراف مستشارين ومحامين ممارسين مرخصين لدى وزارة العدل
                </p>
              </div>
            </div>

            {/* Content Column */}
            <div className="lg:col-span-7 space-y-5 text-right">
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#00236f] bg-blue-50 px-3 py-1 rounded-full border border-blue-200 inline-block">
                  {currentArea.sector}
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-[#0b1c30]">
                  {currentArea.title}
                </h3>
                <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                  {currentArea.desc}
                </p>
              </div>

              {/* Bullet checklist */}
              <div className="space-y-2.5 pt-2">
                <span className="text-xs font-bold text-[#10233F] block">
                  أبرز مخرجات الخدمة في هذا المجال:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#334155]">
                  {currentArea.bullets.map((bullet, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-[#E2ECFA]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="leading-snug">{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTAs */}
              <div className="pt-4 flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => onSelectArea(currentArea.title)}
                  className="bg-[#00236f] hover:bg-[#001c59] text-white text-xs font-bold h-10 px-5 rounded-xl shadow-xs gap-2 cursor-pointer"
                >
                  <span>استكشف هذا المجال</span>
                  <ArrowLeft className="w-4 h-4" />
                </Button>

                <a
                  href={data?.office?.whatsappUrl || 'https://wa.me/970567603295'}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#EFF4FF] border border-[#CFDFFC] text-[#00236f] text-xs font-bold transition-colors cursor-pointer"
                >
                  تواصل مع خبير قانوني في هذا القطاع
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
