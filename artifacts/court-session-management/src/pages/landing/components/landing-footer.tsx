import React from 'react';
import { Scale, Phone, Mail, ShieldCheck } from 'lucide-react';
import type { LandingData } from '../types';

interface LandingFooterProps {
  data: LandingData | null;
}

export function LandingFooter({ data }: LandingFooterProps) {
  const office = data?.office;
  const whatsappFormatted = office?.whatsappFormatted || '+970 56 760 3295';
  const whatsappUrl = office?.whatsappUrl || 'https://wa.me/970567603295';

  return (
    <footer className="bg-[#07101E] text-slate-300 pt-16 pb-12 border-t border-[#C99732]/20" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Col 1: Brand & Real Purpose (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C99732]/25 to-black border border-[#C99732]/45 flex items-center justify-center text-white shadow-xs">
                <Scale className="w-5 h-5 text-[#E8C477]" />
              </div>
              <div className="flex flex-col">
                <span className="font-sans text-xl font-black tracking-tight text-white">
                  {office?.name || 'منصة ديوان القانونية'}
                </span>
                <span className="text-[10px] text-slate-400 tracking-wide">
                  نظام سحابي لمكاتب وفرق المحاماة
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300/80 leading-relaxed max-w-sm">
              نظام سحابي متكامل لمكاتب المحاماة في المملكة: تنظيم جلسات المحاكم، إدارة ملفات القضايا والوكالات والأحكام والمهام، مع استخراج آلي لبيانات الجلسات من رسائل التبليغ وتذكيرات استباقية عبر الواتساب.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] text-[#E8C477] bg-[#C99732]/10 px-2.5 py-1 rounded-full border border-[#C99732]/25 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#E8C477]" />
                <span>عزل كامل لبيانات المكاتب • Multi-Tenant Architecture</span>
              </span>
            </div>
          </div>

          {/* Col 2: Platform Features (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
              إمكانيات المنصة
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <a href="#features" className="hover:text-white transition-colors">استخراج الجلسات من الرسائل</a>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition-colors">إدارة الجلسات والتقويم الهجري</a>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition-colors">أرشفة الوكالات الشرعية والعقود</a>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition-colors">البحث الشامل عبر القضايا والعملاء</a>
              </li>
              <li>
                <a href="#features" className="hover:text-white transition-colors">تنبيهات WhatsApp للمحامين</a>
              </li>
            </ul>
          </div>

          {/* Col 3: Security & Single Contact Point (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
              التواصل والدعم الفني
            </h4>
            <div className="space-y-2.5 text-xs text-slate-400">
              <p className="text-xs leading-relaxed text-slate-300/80">
                فريق الدعم الفني والاستشارات متاح لخدمتكم ومساعدتكم في تهيئة بيئة العمل الخاصة بمكتبكم:
              </p>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="hover:text-white font-mono" dir="ltr">
                  {whatsappFormatted}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#C99732] shrink-0" />
                <a href={`mailto:${office?.email || 'contact@mansoori-law.sa'}`} className="hover:text-white">
                  {office?.email || 'contact@mansoori-law.sa'}
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright */}
        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} {office?.name || 'منصة ديوان القانونية'}. جميع الحقوق محفوظة.</p>
          <div className="flex items-center gap-4 text-[11px]">
            <a href="#security" className="hover:text-white transition-colors">الأمان والخصوصية</a>
            <span>•</span>
            <a href="#faq" className="hover:text-white transition-colors">الأسئلة الشائعة</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
