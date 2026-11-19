import React from 'react';
import { ShieldCheck, Lock, Database, UserCheck, ArrowLeft, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SecurityComplianceCardProps {
  onOpenConsultation: () => void;
}

export function SecurityComplianceCard({ onOpenConsultation }: SecurityComplianceCardProps) {
  return (
    <section id="security" dir="rtl" className="py-16 sm:py-24 bg-[#FBF9F5]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Luxury Dark Judicial Navy Card (Matching Login Page & Internal Branding) */}
        <div className="rounded-3xl border border-[#C99732]/30 bg-gradient-to-br from-[#060A14] via-[#0B1B3D] to-[#060A14] p-8 sm:p-14 text-center shadow-xl space-y-8 relative overflow-hidden text-white">
          {/* Subtle Golden Ambient Glows matching login hero */}
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-[#C99732]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-[#C99732]/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Tag */}
          <div className="space-y-3 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C99732]/15 border border-[#C99732]/35 text-[#E8C477] text-[11px] sm:text-xs font-bold">
              <Scale className="w-3.5 h-3.5" />
              <span>الأمان وعزل البيانات • Data Security & Isolation</span>
            </div>

            <h3 className="font-sans text-2xl sm:text-4xl font-black text-white tracking-tight">
              بياناتك مخزنة بأمان، ومعزولة بالكامل عن أي مكتب آخر.
            </h3>
            <p className="text-xs sm:text-sm lg:text-base text-slate-300/90 max-w-2xl mx-auto leading-relaxed pt-1 font-normal">
              تم بناء المنصة بهندسة برمجية متعددة المستأجرين (Multi-Tenant Architecture) تضمن الاستقلالية التامة لبيانات كل مكتب محاماة. ملفاتك، وكالاتك، وجلسات موكليك مشفرة ومحمية بقواعد بيانات سحابية متطورة، ولا يمكن لأي طرف خارجي الوصول إليها.
            </p>
          </div>

          {/* 4 Architectural Pillars in Golden-Accented Circles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-2 relative z-10">
            {/* Pillar 1: Tenant Isolation */}
            <div className="flex flex-col items-center space-y-2.5">
              <div className="w-16 h-16 rounded-full border border-[#C99732]/40 bg-white/5 backdrop-blur-md flex items-center justify-center text-[#E8C477] shadow-[0_4px_20px_rgba(201,151,50,0.15)] hover:scale-105 transition-transform">
                <ShieldCheck className="w-7 h-7 text-[#E8C477]" />
              </div>
              <span className="text-xs font-bold text-white">عزل تام للمكاتب</span>
              <span className="text-[10px] text-slate-400">فصل مستقل لقواعد بيانات كل مكتب</span>
            </div>

            {/* Pillar 2: Role Access */}
            <div className="flex flex-col items-center space-y-2.5">
              <div className="w-16 h-16 rounded-full border border-[#C99732]/40 bg-white/5 backdrop-blur-md flex items-center justify-center text-[#E8C477] shadow-[0_4px_20px_rgba(201,151,50,0.15)] hover:scale-105 transition-transform">
                <UserCheck className="w-7 h-7 text-[#E8C477]" />
              </div>
              <span className="text-xs font-bold text-white">صلاحيات أدوار دقيقة</span>
              <span className="text-[10px] text-slate-400">اطلاع المحامي على قضاياه المكلف بها فقط</span>
            </div>

            {/* Pillar 3: Database & Cloud */}
            <div className="flex flex-col items-center space-y-2.5">
              <div className="w-16 h-16 rounded-full border border-[#C99732]/40 bg-white/5 backdrop-blur-md flex items-center justify-center text-[#E8C477] shadow-[0_4px_20px_rgba(201,151,50,0.15)] hover:scale-105 transition-transform">
                <Database className="w-7 h-7 text-[#E8C477]" />
              </div>
              <span className="text-xs font-bold text-white">بنية سحابية موثوقة</span>
              <span className="text-[10px] text-slate-400">تخزين آمن مبني على PostgreSQL</span>
            </div>

            {/* Pillar 4: Audit Logs */}
            <div className="flex flex-col items-center space-y-2.5">
              <div className="w-16 h-16 rounded-full border border-[#C99732]/40 bg-white/5 backdrop-blur-md flex items-center justify-center text-[#E8C477] shadow-[0_4px_20px_rgba(201,151,50,0.15)] hover:scale-105 transition-transform">
                <Lock className="w-7 h-7 text-[#E8C477]" />
              </div>
              <span className="text-xs font-bold text-white">سجل تدقيق داخلي</span>
              <span className="text-[10px] text-slate-400">توثيق حركات الإسناد والتعديل</span>
            </div>
          </div>

          {/* Action Button inside card */}
          <div className="pt-2 relative z-10">
            <Button
              onClick={onOpenConsultation}
              className="h-10 px-6 rounded-xl bg-gradient-to-l from-[#FFF4DE] via-[#E8C477] to-[#C99732] hover:brightness-105 text-[#080D1A] text-xs font-bold shadow-md transition-all hover:scale-102 cursor-pointer"
            >
              <span>اطلب عرضاً تجريبياً لمكتبك</span>
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
