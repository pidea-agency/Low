import React from "react";
import {
  FileText,
  MessageCircle,
  Database,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Check,
  Sparkles,
  Scale,
} from "lucide-react";
import type { LandingData } from "../types";

interface FeatureShowcaseProps {
  data: LandingData | null;
  onOpenConsultation: () => void;
}

export function FeatureShowcase({ data, onOpenConsultation }: FeatureShowcaseProps) {
  const brandName = data?.office?.name || "ديوان";

  return (
    <section
      id="features"
      dir="rtl"
      className="py-20 lg:py-28 bg-white border-b border-slate-200"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-xs font-medium mb-3">
            <span>المميزات الجوهرية للنظام</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight text-balance">
            كل ما تحتاجه لإدارة مكتبك القانوني باحترافية
          </h2>
          <p className="text-base text-slate-600 mt-3 leading-relaxed text-balance">
            أدوات صممت خصيصاً لتلائم طبيعة العمل القضائي وحساسية المواعيد والوكالات.
          </p>
        </div>

        {/* Bento Grid (6 Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* ───────────────────────────────────────────────────────────── */}
          {/* Card 1 (col-span-4): إدارة الجلسات والوكالات */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div className="md:col-span-4 border border-slate-200 rounded-xl bg-white p-6 sm:p-7 flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-800">
                  القضايا والمواعيد
                </span>
                <span className="text-xs text-slate-400 font-mono">01</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 leading-snug">
                توكيل الوكالات ومتابعة الجلسات دون ثغرات
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed max-w-xl">
                اربط كل وكالة بملف قضيتها، وحدد المحامي المسؤول عن كل جلسة مع
                سجل كامل للقرارات والتأجيلات والإجراءات المتخذة.
              </p>
            </div>

            {/* Rich Mini UI: 3 Realistic Case/POA Rows with Status Pills */}
            <div className="mt-6 pt-4 border-t border-slate-100 space-y-2.5">
              {/* Row 1: Commercial Court */}
              <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0 shadow-2xs">
                    <Scale className="w-4 h-4 text-slate-700" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-slate-900">1446/7821-ت</span>
                      <span className="text-[11px] text-slate-700 font-medium">شركة الروابي ضد مؤسسة الإعمار</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                      <span>المحكمة التجارية بالرياض</span>
                      <span>•</span>
                      <span>صك وكالة: 4612980</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <span className="text-[11px] text-slate-700 font-medium bg-white px-2 py-0.5 rounded border border-slate-200">
                    أ. فيصل السعيد
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    جلسة مؤكدة
                  </span>
                </div>
              </div>

              {/* Row 2: Appeal Court */}
              <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0 shadow-2xs">
                    <FileText className="w-4 h-4 text-slate-700" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-slate-900">1446/3412-ع</span>
                      <span className="text-[11px] text-slate-700 font-medium">ورثة عبد الرحمن آل تركي</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                      <span>محكمة الاستئناف بالدمام</span>
                      <span>•</span>
                      <span>وكالة حصر ورثة: 4598112</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <span className="text-[11px] text-slate-700 font-medium bg-white px-2 py-0.5 rounded border border-slate-200">
                    أ. ريم القحطاني
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    تقديم مذكرة
                  </span>
                </div>
              </div>

              {/* Row 3: General Court */}
              <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0 shadow-2xs">
                    <ShieldCheck className="w-4 h-4 text-slate-700" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs text-slate-900">1446/9024-ع</span>
                      <span className="text-[11px] text-slate-700 font-medium">مؤسسة المناهل الرقمية</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                      <span>المحكمة العامة بجدة</span>
                      <span>•</span>
                      <span>وكالة عامة: 4633019</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <span className="text-[11px] text-slate-700 font-medium bg-white px-2 py-0.5 rounded border border-slate-200">
                    أ. خالد العتيبي
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    تم النطق بالحكم
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* Card 2 (col-span-2): أتمتة الواتساب (Key Differentiator) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div className="md:col-span-2 border border-slate-200 rounded-xl bg-white p-6 sm:p-7 flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  ميزة حصرية
                </span>
                <span className="text-xs text-slate-400">02</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 leading-snug">
                إشعارات واتساب تلقائية للموكلين
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                بمجرد تحديث حالة الجلسة، يصل إشعار فوري للموكل على واتساب باسم
                مكتبك.
              </p>
            </div>

            {/* Mini UI: Realistic WhatsApp Message Bubble */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="bg-[#EFEAE2] p-3 rounded-xl border border-slate-200/80 text-right space-y-2">
                {/* Chat Top Info */}
                <div className="flex items-center justify-between text-[11px] text-slate-700 pb-1.5 border-b border-black/5">
                  <span className="font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    مكتب المحاماة الرسمي
                  </span>
                  <span className="text-[10px] text-slate-500">موثق ✓</span>
                </div>

                {/* WhatsApp Chat Bubble */}
                <div className="bg-white rounded-lg p-2.5 text-xs text-slate-800 shadow-2xs space-y-1 relative">
                  <p className="font-semibold text-slate-900 leading-snug">
                    السلام عليكم أ. أحمد،
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    تم قيد جلسة جديدة لقضيتكم رقم (1446/7821) لدى المحكمة
                    التجارية بالرياض.
                  </p>
                  <div className="text-[11px] font-mono text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-100 space-y-0.5">
                    <div>🗓 الموعد: غداً الساعة 09:30 ص</div>
                    <div>⚖️ المحامي المكلف: أ. فيصل السعيد</div>
                  </div>
                  <div className="flex justify-end items-center gap-1 text-[10px] text-slate-400 pt-0.5">
                    <span>10:42 ص</span>
                    <span className="text-blue-500 font-bold">✓✓</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* Card 3 (col-span-3): الربط المباشر مع Google Sheets */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div className="md:col-span-3 border border-slate-200 rounded-xl bg-white p-6 sm:p-7 flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-800">
                  التكامل والمرونة
                </span>
                <span className="text-xs text-slate-400">03</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 leading-snug">
                مزامنة فورية مع Google Sheets
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                لا تتخلَ عن جداولك. صدّر وزامن بيانات القضايا والجلسات
                والعملاء لحظياً مع قوقل شيت لتقارير مالية وإدارية مرنة.
              </p>
            </div>

            {/* Mini UI: Minimalist Node Diagram + Spreadsheet Preview */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              {/* Node Diagram */}
              <div className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <Database className="w-3.5 h-3.5 text-slate-700" />
                  <span>{brandName}</span>
                </div>

                <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  مزامنة حية (Synced)
                </div>

                <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                  <span className="w-3 h-3 rounded bg-emerald-600 text-white flex items-center justify-center text-[8px]">
                    S
                  </span>
                  <span>Google Sheets</span>
                </div>
              </div>

              {/* Sheet Grid Preview */}
              <div className="mt-3 overflow-hidden rounded border border-slate-200 text-[11px]">
                <table className="w-full text-right">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-1 px-2">القضية</th>
                      <th className="py-1 px-2">المحكمة</th>
                      <th className="py-1 px-2">الأتعاب</th>
                      <th className="py-1 px-2">الموعد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-mono text-[10px]">
                    <tr>
                      <td className="py-1 px-2">7821-ت</td>
                      <td className="py-1 px-2 text-slate-600">التجارية</td>
                      <td className="py-1 px-2 text-emerald-700">٣٥,٠٠٠ ر.س</td>
                      <td className="py-1 px-2 text-slate-500">1446/07/20</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2">3412-ع</td>
                      <td className="py-1 px-2 text-slate-600">الاستئناف</td>
                      <td className="py-1 px-2 text-emerald-700">٥٠,٠٠٠ ر.س</td>
                      <td className="py-1 px-2 text-slate-500">1446/07/21</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* Card 4 (col-span-3): إدارة المحامين والمهام (Team & Tasks) */}
          {/* ───────────────────────────────────────────────────────────── */}
          <div className="md:col-span-3 border border-slate-200 rounded-xl bg-white p-6 sm:p-7 flex flex-col justify-between hover:border-slate-300 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-800">
                  إدارة الفريق
                </span>
                <span className="text-xs text-slate-400">04</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 leading-snug">
                إدارة فريق المحامين والمهام والصلاحيات
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                أضف محامي مكتبك بصلاحيات مخصصة، وزّع المهام القانونية (صياغة
                لوائح، مراجعة عقود) وتابع نسب الإنجاز بدقة.
              </p>
            </div>

            {/* Mini UI: Sleek Task Checklist Component */}
            <div className="mt-6 pt-5 border-t border-slate-100 space-y-2">
              {/* Task 1 */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                    ✓
                  </span>
                  <span className="font-medium text-slate-900 line-through text-slate-500">
                    صياغة لائحة جوابية - شركة الروابي
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                    عاجل
                  </span>
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[9px] font-bold">
                    ف.س
                  </span>
                </div>
              </div>

              {/* Task 2 */}
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded border border-slate-300 flex items-center justify-center" />
                  <span className="font-medium text-slate-900">
                    مراجعة عقد شراكة تجارية
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                    مراجعة عقد
                  </span>
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[9px] font-bold">
                    ر.ق
                  </span>
                </div>
              </div>

              {/* Task 3 */}
              <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded border border-slate-300 flex items-center justify-center" />
                  <span className="font-medium text-slate-900">
                    استخراج صك حصر ورثة
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500">
                    تسليم غداً
                  </span>
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[9px] font-bold">
                    خ.ع
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
