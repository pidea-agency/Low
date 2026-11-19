import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'كيف تساعد المنصة في تفادي فوات مواعيد الجلسات القضائية؟',
      a: 'تعتمد المنصة على نظام جدولة آلي متصل بمواعيد جلسات المحاكم في المملكة، يرسل إشعارات وتنبيهات مخصصة عبر تطبيق WhatsApp مباشرة للمحامي المكلف ومدير المكتب قبل 24 ساعة وقبل 6 ساعات من موعد انعقاد الجلسة، مما يضمن الجاهزية التامة وتقديم المذكرات في أوقاتها المحددة.',
    },
    {
      q: 'كيف يعمل استخراج الجلسات من نصوص الرسائل والإشعارات؟',
      a: 'تقوم الأداة الذكية بقراءة نص رسالة التبليغ الملصقة، واستخلاص رقم القضية، اسم المحكمة، الدائرة القضائية، أطراف النزاع، وتاريخ ووقت الجلسة بالتقويمين الهجري والميلادي فوراً، مما يتيح لك حفظها مباشرة دون كتابة يدوية.',
    },
    {
      q: 'هل بيانات ومستندات مكتبنا وموكلينا مؤمنة ومشفرة بالكامل؟',
      a: 'نعم، بكل تأكيد. تعتمد المنصة تشفير بيانات فائق الأمان واستضافة سحابية معتمدة مع عزل صارم لقواعد بيانات كل مكتب (Multi-Tenant Isolation)، بحيث يستحيل لأي مستخدم خارج مكتبك الوصول لأي ملف أو صك.',
    },
    {
      q: 'كيف تتم إدارة تتبع سريان الوكالات الشرعية والتراخيص؟',
      a: 'تتيح المنصة أرشفة مركزية لجميع الوكالات، وتقوم خدمة الفحص اليومي التلقائية بمسح تواريخ انتهاء الوكالات وإرسال تنبيهات استباقية قبل 7 أيام من تاريخ الانتهاء لتمكين فريقك من تجديدها قبل موعد الترافع.',
    },
    {
      q: 'هل يمكن ضبط وتوزيع صلاحيات الوصول بين المحامين في المكتب؟',
      a: 'نعم، تدعم المنصة نظام صلاحيات دقيق (Role-Based Access Control) يفصل بين الشريك المدير، المحامي الممارس، والباحث المتدرب، حيث لا يستطيع المحامي الإطلاع إلا على القضايا والملفات المكلف بها رسمياً حمايةً لسرية الموكلين.',
    },
    {
      q: 'كيف يمكن لمكتبي البدء أو تجربة المنصة؟',
      a: 'يمكنكم الضغط على زر "اطلب عرضاً تجريبياً" أو التواصل الفوري عبر الواتساب في أسفل الصفحة. سيقوم مستشارنا بالتواصل معكم وتفعيل بيئة عمل مخصصة لمكتبكم في دقائق معدودة.',
    },
  ];

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-20 sm:py-24 bg-[#FBF9F5] border-t border-[#E2E8F0]" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF4FF] border border-[#CFDFFC] text-[#0B2A4A] text-xs font-semibold">
            <HelpCircle className="w-3.5 h-3.5 text-[#C99732]" />
            <span>الأسئلة الشائعة</span>
          </div>
          <h2 className="font-sans text-3xl sm:text-4xl font-black text-[#0C1A30] tracking-tight">
            إجابات واضحة لأهم استفساراتك القانونية والتقنية
          </h2>
          <p className="text-xs sm:text-sm text-[#475569] leading-relaxed max-w-2xl mx-auto font-normal">
            كل ما تحتاج معرفته حول معايير عمل المنظومة، سرية البيانات القضائية، وآلية تفعيل الخدمة لمكتبكم.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={index}
                className="rounded-2xl border border-[#E2E8F0] bg-white transition-all shadow-2xs overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-right cursor-pointer gap-4 hover:bg-slate-50 transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="font-bold text-xs sm:text-sm text-[#0C1A30]">
                    {faq.q}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 ${
                      isOpen ? 'bg-[#0B1B3D] text-[#C99732] rotate-180' : 'bg-slate-100 text-[#64748B]'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-[#475569] leading-relaxed border-t border-slate-100 bg-[#F8FAFC]/50 animate-in fade-in-50 duration-150">
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
