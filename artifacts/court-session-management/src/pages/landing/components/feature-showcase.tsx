import React from 'react';
import {
  MessageSquare,
  FileCheck2,
  CalendarClock,
  Users2,
  Bot,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  Scale,
  Sparkles,
  Shield,
  Send,
  Eye,
  FileText,
  UserCheck,
  CheckCircle2,
  FolderOpen,
  ArrowRight,
} from 'lucide-react';
import type { LandingData } from '../types';

interface FeatureShowcaseProps {
  data: LandingData | null;
  onOpenConsultation: () => void;
}

export function FeatureShowcase({ data, onOpenConsultation }: FeatureShowcaseProps) {
  return (
    <section id="features" dir="rtl" className="py-20 sm:py-28 bg-[#FBF9F5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24 sm:space-y-32">
        {/* =========================================================================
            Section Header: AI-Assisted Session Extraction
           ========================================================================= */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="text-xs font-bold text-[#C99732] uppercase tracking-wider font-sans">
            ذكاء اصطناعي عملي وموجّه
          </span>
          <h2 className="font-sans text-3xl sm:text-5xl font-black text-[#0C1A30] tracking-tight">
            استخراج فوري لبيانات الجلسات من رسائل المحاكم
          </h2>
          <p className="text-base sm:text-lg text-[#475569] font-normal leading-relaxed">
            الذكاء الاصطناعي في المنصة مصمم لمهمة عملية محددة: قراءة نصوص رسائل وإشعارات المحاكم، واستخراج رقم القضية، أسماء الأطراف، المحكمة والدائرة، وموعد الجلسة بالهجري والميلادي آلياً، لتوفير وقت الإدخال اليدوي وتفادي أخطاء النقل.
          </p>
        </div>

        {/* =========================================================================
            BLOCK 1: AI SMS-parsing (من رسالة إلى جلسة منظمة)
            Text Right, Mockup Left
           ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          {/* Text Column (5 cols) */}
          <div className="lg:col-span-5 space-y-4 text-right">
            <span className="text-xs font-bold text-[#C99732] uppercase tracking-wider font-sans">
              معالجة الرسائل بالذكاء الاصطناعي • AI Session Extraction
            </span>
            <h3 className="font-sans text-2xl sm:text-4xl font-extrabold text-[#0C1A30] leading-tight">
              من رسالة نصية خام إلى جلسة مجدولة في ثوانٍ.
            </h3>
            <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
              انسخ نص رسالة تبليغ الجلسة القضائية من هاتفك أو منصة القضاء والصقها في النظام. يتعرف الذكاء الاصطناعي فوراً على رقم القضية، المحكمة، الدائرة القضائية، المدعي والمدعى عليه، ويحدد تاريخ الجلسة ووقتها بالتقويمين الهجري والميلادي معاً دون إدخال يدوي مجهد.
            </p>
          </div>

          {/* Mockup Column (7 cols) - Real SMS Parsing UI */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-[#D6E0EC] bg-slate-50/70 p-4 sm:p-6 shadow-sm">
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 sm:p-5 shadow-xs space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#0B1B3D] text-white flex items-center justify-center">
                      <Bot className="w-4 h-4 text-[#C99732]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#0C1A30]">استخراج الجلسة من نص رسالة التبليغ</div>
                      <div className="text-[10px] text-emerald-700 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        التقاط تلقائي لبيانات القضية والموعد
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-[#0B2A4A] bg-[#EFF4FF] px-2.5 py-1 rounded-full border border-[#CFDFFC]">
                    وفر 100% من الإدخال اليدوي
                  </span>
                </div>

                {/* Step 1: Raw SMS Input Preview */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-[#64748B]">نص الرسالة الخام الملصق:</div>
                  <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#334155] leading-relaxed font-mono">
                    «تم قيد موعد جلسة في المحكمة التجارية بالرياض - الدائرة الحقوقية الأولى للدعوى رقم 4821 المقامة من شركة الأفق ضد مؤسسة البناء بتاريخ 1448/03/15 هـ الساعة 10:30 ص»
                  </div>
                </div>

                {/* Step 2: Extracted Structured Result Preview */}
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#0C1A30]">
                    <span className="flex items-center gap-1 text-[#C99732]">
                      <Sparkles className="w-3.5 h-3.5" />
                      الحقول المستخرجة آلياً:
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      جاهز للحفظ بملف القضية
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                      <span className="block text-[9px] text-[#64748B]">رقم القضية والمحكمة</span>
                      <span className="font-bold text-[11px] text-[#0C1A30]">4821 • المحكمة التجارية (الدائرة 1)</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                      <span className="block text-[9px] text-[#64748B]">أطراف الدعوى</span>
                      <span className="font-bold text-[11px] text-[#0C1A30]">شركة الأفق ضد مؤسسة البناء</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                      <span className="block text-[9px] text-[#64748B]">التاريخ الهجري</span>
                      <span className="font-bold text-[11px] text-[#0C1A30]">15 ربيع الأول 1448 هـ</span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                      <span className="block text-[9px] text-[#64748B]">التاريخ الميلادي والوقت</span>
                      <span className="font-bold text-[11px] text-[#0C1A30]">27 أغسطس 2026 • 10:30 صباحاً</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            BLOCK 2: Global Search across cases/clients/POAs/documents
            Mockup Right, Text Left
           ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          {/* Mockup Column (7 cols) - Global Search UI */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <div className="rounded-2xl border border-[#D6E0EC] bg-slate-50/70 p-4 sm:p-6 shadow-sm">
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute right-3 top-3 text-[#94A3B8]" />
                  <input
                    disabled
                    readOnly
                    type="text"
                    value="شركة الأفق"
                    className="w-full pr-9 pl-3 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0C1A30]"
                  />
                  <span className="absolute left-3 top-2.5 text-[10px] text-[#64748B] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                    4 نتائج مطابقة
                  </span>
                </div>

                {/* Instant Results across 4 record types */}
                <div className="space-y-2 text-xs">
                  {/* Result 1: Case */}
                  <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-[10px] border border-blue-200">
                        قضية
                      </div>
                      <div>
                        <div className="font-bold text-[#0C1A30] text-[11px]">قضية رقم 4821/2026 • مطالبة مالية</div>
                        <div className="text-[10px] text-[#64748B]">الموكل: شركة الأفق • المحامي المكلف: أ. المنصوري</div>
                      </div>
                    </div>
                    <span className="text-[9px] font-semibold text-blue-800 bg-blue-100/70 px-2 py-0.5 rounded-full border border-blue-200">
                      جلسة قادمة
                    </span>
                  </div>

                  {/* Result 2: POA */}
                  <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-[10px] border border-emerald-200">
                        وكالة
                      </div>
                      <div>
                        <div className="font-bold text-[#0C1A30] text-[11px]">وكالة شرعية رقم 451029381</div>
                        <div className="text-[10px] text-[#64748B]">الموكل: شركة الأفق للاستثمار • سارية حتى 1448/08/10 هـ</div>
                      </div>
                    </div>
                    <span className="text-[9px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-200">
                      سارية
                    </span>
                  </div>

                  {/* Result 3: Client */}
                  <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-[10px] border border-amber-200">
                        عميل
                      </div>
                      <div>
                        <div className="font-bold text-[#0C1A30] text-[11px]">شركة الأفق للتطوير والاستثمار العقاري</div>
                        <div className="text-[10px] text-[#64748B]">سجل تجاري: 1010****** • 3 قضايا نشطة</div>
                      </div>
                    </div>
                    <span className="text-[9px] font-semibold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-full border border-amber-200">
                      ملف نشط
                    </span>
                  </div>

                  {/* Result 4: Document */}
                  <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-[10px] border border-purple-200">
                        مرفق
                      </div>
                      <div>
                        <div className="font-bold text-[#0C1A30] text-[11px]">مذكرة_الدفاع_الجوابية_النهائية.pdf</div>
                        <div className="text-[10px] text-[#64748B]">مرفوعة على جلسة 15 ربيع الأول • بحجم 2.4 MB</div>
                      </div>
                    </div>
                    <span className="text-[9px] font-semibold text-purple-800 bg-purple-100/70 px-2 py-0.5 rounded-full border border-purple-200">
                      PDF
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Text Column (5 cols) */}
          <div className="lg:col-span-5 space-y-4 text-right order-1 lg:order-2">
            <span className="text-xs font-bold text-[#C99732] uppercase tracking-wider font-sans">
              البحث والأرشفة المركزية • Global Office Search
            </span>
            <h3 className="font-sans text-2xl sm:text-4xl font-extrabold text-[#0C1A30] leading-tight">
              ابحث عن أي قضية، موكل، أو وكالة بلمح البصر.
            </h3>
            <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
              محرك بحث فوري وشامل عبر كافة ملفات وسجلات المكتب: اكتب رقم القضية، اسم الموكل، رقم السجل، رقم الوكالة، أو اسم المستند لتصل إلى كافة التفاصيل والجلسات والأحكام المرتبطة في ثانية واحدة، دون البحث اليدوي في الملفات والأوراق.
            </p>
          </div>
        </div>

        {/* =========================================================================
            BLOCK 3: Real Reminder System: WhatsApp + In-App Alerts
            Text Right, Mockup Left
           ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          {/* Text Column (5 cols) */}
          <div className="lg:col-span-5 space-y-4 text-right">
            <span className="text-xs font-bold text-[#C99732] uppercase tracking-wider font-sans">
              نظام التنبيهات المباشر • WhatsApp & In-App Alerts
            </span>
            <h3 className="font-sans text-2xl sm:text-4xl font-extrabold text-[#0C1A30] leading-tight">
              تنبيهات واتساب استباقية تحمي مواعيد مكتبك من السهو.
            </h3>
            <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
              إرسال آلي لتذكيرات الجلسات عبر الواتساب للمحامي المكلف ومدير المكتب قبل موعد الجلسة بـ 24 ساعة وبـ 6 ساعات، مع تنبيهات دورية عند اقتراب انتهاء سريان الوكالات الشرعية، وعند تعيين أي مهمة أو قضية جديدة في النظام.
            </p>
          </div>

          {/* Mockup Column (7 cols) - Real WhatsApp & System Alerts */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-[#D6E0EC] bg-slate-50/70 p-4 sm:p-6 shadow-sm">
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-[#C99732]" />
                    <span className="font-bold text-xs text-[#0C1A30]">رسائل التنبيه الآلية عبر الواتساب وداخل التطبيق</span>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    مباشر وقيد التشغيل
                  </span>
                </div>

                {/* Alert Cards */}
                <div className="space-y-2.5 text-xs">
                  {/* WhatsApp Message Preview */}
                  <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-1.5 font-sans">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-950 text-[11px] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        رسالة WhatsApp واردة للمحامي المكلف (متبقي 24 ساعة)
                      </span>
                      <span className="text-[9px] text-emerald-700 font-mono">08:00 ص</span>
                    </div>
                    <div className="text-[11px] text-[#0C1A30] leading-relaxed bg-white p-2.5 rounded-lg border border-emerald-200/80 font-mono">
                      🔔 *تذكير بموعد جلسة قضائية (متبقي 24 ساعة)*<br />
                      📋 *رقم القضية:* 4821/2026<br />
                      ⚖️ *المحكمة:* المحكمة التجارية بالرياض<br />
                      🏛️ *الدائرة:* الدائرة الحقوقية الأولى<br />
                      📅 *التاريخ الهجري:* 15 ربيع الأول 1448 هـ<br />
                      ⏰ *الوقت:* 10:30 ص<br />
                      🔗 *رابط الجلسة والمرفقات:* https://app.../sessions/4821
                    </div>
                  </div>

                  {/* POA Expiry Warning */}
                  <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <div className="font-bold text-[#0C1A30] text-[11px]">تنبيه سريان وكالة: موكل الشيخ عبد الله</div>
                        <div className="text-[10px] text-[#64748B]">تنتهي الوكالة رقم 448102947 خلال 7 أيام - يرجى التجديد</div>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 shrink-0">
                      إشعار استباقي
                    </span>
                  </div>

                  {/* Task Assignment Alert */}
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <div className="font-bold text-[#0C1A30] text-[11px]">تكليف بمهمة جديدة: إعداد المذكرة الجوابية</div>
                        <div className="text-[10px] text-[#64748B]">أسندها مدير المكتب للمحامي المكلف • الموعد النهائي: الخميس</div>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded border border-blue-300 shrink-0">
                      مهمة مكلفة
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            BLOCK 4: Multi-Lawyer Office Structure (Multi-Tenant & Roles)
            Mockup Right, Text Left
           ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          {/* Mockup Column (7 cols) - Office Hierarchy UI */}
          <div className="lg:col-span-7 order-2 lg:order-1">
            <div className="rounded-2xl border border-[#D6E0EC] bg-slate-50/70 p-4 sm:p-6 shadow-sm">
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Users2 className="w-4 h-4 text-[#0B1B3D]" />
                    <span className="font-bold text-xs text-[#0C1A30]">صلاحيات الأدوار وعزل البيانات بين المحامين</span>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    عزل كامل لكل مكتب
                  </span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {/* Admin View */}
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0C1A30] text-[11px] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#0B1B3D]" />
                        رؤية مدير المكتب (الشريك / Admin)
                      </span>
                      <span className="text-[9px] text-[#64748B] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                        رؤية شاملة للمكتب
                      </span>
                    </div>
                    <p className="text-[10px] text-[#475569]">
                      يرى جميع القضايا (38 قضية)، وجدول جلسات جميع المحامين، وجميع الوكالات، وسجل الأحكام، مع إمكانية إسناد وإعادة توزيع القضايا والمهام.
                    </p>
                  </div>

                  {/* Assigned Lawyer View */}
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0C1A30] text-[11px] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#C99732]" />
                        مساحة عمل المحامي المكلف (Staff Lawyer)
                      </span>
                      <span className="text-[9px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        مساحة مخصصة
                      </span>
                    </div>
                    <p className="text-[10px] text-[#475569]">
                      يرى حصراً القضايا والجلسات والمهام المسندة إليه شخصياً (مثلاً 7 قضايا وجلستان هذا الأسبوع)، دون تشتت ودون الإطلاع على قضايا الزملاء الآخرين حمايةً للسرية.
                    </p>
                  </div>

                  {/* Multi-Tenant Security */}
                  <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-dashed border-[#CBD5E1] text-center text-[10px] text-[#64748B]">
                    🔒 <strong>عزل تام للبيانات:</strong> كل مكتب محاماة يملك مساحة منفصلة تماماً ومحمية برقم معرف مستقل، ولا يشارك أي بيانات مع أي مكتب آخر.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Text Column (5 cols) */}
          <div className="lg:col-span-5 space-y-4 text-right order-1 lg:order-2">
            <span className="text-xs font-bold text-[#C99732] uppercase tracking-wider font-sans">
              حوكمة الفريق وتوزيع الأدوار • Multi-Lawyer Offices
            </span>
            <h3 className="font-sans text-2xl sm:text-4xl font-extrabold text-[#0C1A30] leading-tight">
              لوحة تحكم للإدارة، ومساحة عمل مخصصة لكل محامٍ.
            </h3>
            <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
              نظام مصمم لخدمة مكاتب المحاماة بكافة أحجامها: يرى مدير المكتب المشهد كاملاً (جميع القضايا، الجلسات، ونشاط الفريق)، بينما يركز كل محامٍ على ملفاته ومهامه المكلف بها مباشرة، مع حماية تامة لسرية البيانات وعزل كامل لكل ملف.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
