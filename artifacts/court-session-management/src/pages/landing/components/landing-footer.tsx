import React from "react";
import { MessageCircle, Mail, ShieldCheck } from "lucide-react";
import type { LandingData } from "../types";

interface LandingFooterProps {
  data: LandingData | null;
}

export function LandingFooter({ data }: LandingFooterProps) {
  const office = data?.office;
  const brandName = office?.name || "ديوان";
  const whatsappFormatted = office?.whatsappFormatted || "+970 56 760 3295";
  const whatsappUrl = office?.whatsappUrl || "https://wa.me/970567603295";

  return (
    <footer
      className="bg-white text-slate-600 pt-16 pb-12 border-t border-slate-200"
      dir="rtl"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* Col 1: Brand Summary (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                د
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-sans text-lg font-extrabold text-slate-900 tracking-tight">
                  {brandName}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  للحلول القانونية
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed max-w-sm font-normal">
              المنظومة السحابية المتقدمة لإدارة مكاتب وشركات المحاماة في العالم
              العربي. تنظيم الجلسات، الوكالات، المهام، وأتمتة إشعارات الواتساب
              مع ربط Google Sheets المباشر.
            </p>

            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>عزل كامل لبيانات المكاتب • تشفير AES-256</span>
              </span>
            </div>
          </div>

          {/* Col 2: Product Features (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              المميزات والحلول
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-600">
              <li>
                <a href="#features" className="hover:text-slate-900 transition-colors">
                  إدارة الجلسات والتقويم القضائي
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-slate-900 transition-colors">
                  أتمتة إشعارات واتساب للموكلين
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-slate-900 transition-colors">
                  الربط والمزامنة مع Google Sheets
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-slate-900 transition-colors">
                  إدارة فريق المحامين والمهام
                </a>
              </li>
              <li>
                <a href="#features" className="hover:text-slate-900 transition-colors">
                  أرشفة الوكالات الشرعية والتراخيص
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Legal & Security (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              الشروط والأمان
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-600">
              <li>
                <a href="#faq" className="hover:text-slate-900 transition-colors">
                  سياسة الخصوصية
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-slate-900 transition-colors">
                  شروط الاستخدام
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-slate-900 transition-colors">
                  اتفاقية سرية المعلومات
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-slate-900 transition-colors">
                  الأمان والنسخ الاحتياطي
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Contact & Direct Support (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              التواصل والدعم الفني
            </h4>
            <div className="space-y-2.5 text-xs text-slate-600">
              <p className="text-xs leading-relaxed text-slate-500">
                فريق الدعم الفني والقانوني متواجد يومياً لمساعدتكم:
              </p>
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-slate-900 font-mono text-slate-800 font-semibold"
                  dir="ltr"
                >
                  {whatsappFormatted}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                <a
                  href={`mailto:${office?.email || "support@diwan.sa"}`}
                  className="hover:text-slate-900 text-slate-700"
                >
                  {office?.email || "support@diwan.sa"}
                </a>
              </div>
              <div className="pt-1 text-[11px] text-slate-500">
                أوقات العمل: الأحد - الخميس (08:00 ص - 06:00 م)
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Subtle Links */}
        <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            © {new Date().getFullYear()} {brandName} للحلول القانونية. جميع
            الحقوق محفوظة.
          </p>
          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <span>نظام سحابي مرخص وآمن</span>
            <span>•</span>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">
              باقات الاشتراك
            </a>
            <span>•</span>
            <a href="#faq" className="hover:text-slate-900 transition-colors">
              الأسئلة الشائعة
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
