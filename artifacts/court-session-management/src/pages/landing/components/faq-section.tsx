import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "هل بيانات القضايا والوكالات آمنة وسرية؟",
      a: "نعم، الأمان والسرية هما الركيزة الأساسية في نظام ديوان. نعتمد تشفيراً بنكياً كاملاً (AES-256) أثناء النقل والتخزين، مع عزل تام ومحكم لقواعد بيانات كل مكتب (Multi-Tenant Isolation). كما يتيح لك النظام تحديد صلاحيات صارمة لكل محامٍ، بحيث لا يطّلع أي عضو إلا على القضايا المكلف بها رسمياً.",
    },
    {
      q: "هل أحتاج إلى رقم واتساب خاص لربط الإشعارات؟",
      a: "يمكنك ربط رقم واتساب مكتبك الرسمي الحالي في خطوات بسيطة لا تتعدى دقيقتين عبر واجهة الربط المعتمدة في النظام. ترسل الإشعارات والتذكيرات باسم وهوية مكتبك مباشرة للموكلين والمحامين دون الحاجة لشراء شرائح جديدة أو أجهزة إضافية.",
    },
    {
      q: "كيف أنقل بيانات مكتبي الحالية من ملفات إكسل؟",
      a: "نوفر ميزة الربط والاستيراد الفوري عبر Google Sheets. يمكنك رفع ملفاتك الحالية ومزامنتها بنقرة زر واحدة، حيث يقوم النظام بفرز الجلسات، القضايا، والمحامين تلقائياً دون أي فقدان للبيانات أو تعطل في سير عمل المكتب.",
    },
    {
      q: "هل يمكنني إضافة محامين جدد أو تغيير الباقة لاحقاً؟",
      a: "بالتأكيد. يمكنك ترقية الباقة، أو إضافة تراخيص للمحامين الجدد بمجرد انضمامهم للمكتب، أو التبديل بين الدفع الشهري والسنوي مباشرة من لوحة تحكم مدير المكتب، مع احتساب الفارق النسبي تلقائياً وبكل شفافية.",
    },
  ];

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section
      id="faq"
      dir="rtl"
      className="py-20 lg:py-24 bg-white border-b border-slate-200"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-xs font-medium mb-3">
            <span>الأسئلة الشائعة</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight text-balance">
            إجابات واضحة لأهم تساؤلات مكاتب المحاماة
          </h2>
          <p className="text-base text-slate-600 mt-2.5 leading-relaxed">
            كل ما تحتاج معرفته عن الأمان، الخصوصية، وآلية نقل بيانات مكتبك.
          </p>
        </div>

        {/* Clean Accordion */}
        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={index} className="py-4">
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="w-full flex items-center justify-between text-right gap-4 py-2 text-slate-900 hover:text-slate-700 transition-colors cursor-pointer group"
                >
                  <span className="text-base sm:text-lg font-bold leading-snug">
                    {faq.q}
                  </span>
                  <span
                    className={`w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 bg-slate-200 text-slate-900" : "text-slate-500"
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </button>

                {isOpen && (
                  <div className="pt-2 pb-3 text-sm text-slate-600 leading-relaxed text-right animate-in fade-in-50 duration-150">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
