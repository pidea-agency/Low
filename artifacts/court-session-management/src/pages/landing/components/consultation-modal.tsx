import React, { useState } from 'react';
import { X, Send, Scale, CheckCircle2, MessageCircle, User, Phone, Mail, Building, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { LandingData } from '../types';

interface ConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: LandingData | null;
  initialTopic?: string;
}

export function ConsultationModal({ isOpen, onClose, data, initialTopic = '' }: ConsultationModalProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [topic, setTopic] = useState(initialTopic || 'التحكيم والقضايا التجارية الكبرى');
  const [notes, setNotes] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const whatsappNumber = data?.office?.whatsappNumber || '970567603295';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Build direct WhatsApp message
    const message = [
      `*طلب استشارة / موعد جديد عبر منصة ديوان*`,
      ``,
      `👤 *الاسم:* ${fullName}`,
      `📞 *الجوال:* ${phone}`,
      email ? `✉️ *البريد:* ${email}` : '',
      company ? `🏢 *الجهة / الشركة:* ${company}` : '',
      `⚖️ *المجال المطلوب:* ${topic}`,
      notes ? `📝 *تفاصيل الاستفسار:* ${notes}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const directUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    setIsSubmitted(true);
    setTimeout(() => {
      window.open(directUrl, '_blank');
      onClose();
      setIsSubmitted(false);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative animate-in zoom-in-95 text-right space-y-5 my-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute left-4 top-4 text-[#94A3B8] hover:text-[#10233F] p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0B1B3D] text-[#C99732] flex items-center justify-center shrink-0 border border-[#C99732]/30">
            <Scale className="w-5 h-5 text-[#C99732]" />
          </div>
          <div>
            <h3 className="font-sans text-lg font-bold text-[#0C1A30]">
              طلب عرض توضيحي (Demo) أو استشارة
            </h3>
            <p className="text-xs text-[#64748B]">
              سيقوم مستشارنا بالتواصل معكم وتفعيل بيئة مكتبك فوراً
            </p>
          </div>
        </div>

        {isSubmitted ? (
          <div className="p-8 text-center space-y-3 bg-emerald-50 rounded-2xl border border-emerald-200">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-emerald-900">تم تجهيز طلبكم بنجاح</h4>
            <p className="text-xs text-emerald-700">
              جارٍ تحويلكم إلى الواتساب المعتمد للمكتب لمتابعة تفاصيل الموعد فوراً...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#10233F]">الاسم الكريم أو ممثل الجهة *</Label>
              <div className="relative">
                <User className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <Input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="أ. عبدالله المنصوري"
                  className="pr-9 text-xs h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#10233F]">رقم الجوال (مع الرمز) *</Label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <Input
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+966 50 123 4567"
                    className="pr-9 text-xs h-10 font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#10233F]">اسم الشركة أو المكتب (اختياري)</Label>
                <div className="relative">
                  <Building className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <Input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="مجموعة الاستثمار القابضة"
                    className="pr-9 text-xs h-10"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#10233F]">مجال الاستشارة أو المسألة القضائية *</Label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#D6E0EC] bg-white text-xs font-medium text-[#10233F] focus:outline-none focus:ring-2 focus:ring-[#00236f]"
              >
                <option value="التحكيم والقضايا التجارية الكبرى">التحكيم والنزاعات التجارية الكبرى</option>
                <option value="الاندماج والاستحواذ (M&A) وحوكمة الشركات">الاندماج والاستحواذ (M&A) وحوكمة الشركات</option>
                <option value="نزاعات الزكاة والضرائب والجمارك">نزاعات الزكاة والضرائب والجمارك</option>
                <option value="النزاعات العقارية وتطوير المشاريع">النزاعات العقارية وتطوير المشاريع</option>
                <option value="حماية الملكية الفكرية والعلامات التجارية">حماية الملكية الفكرية والعلامات التجارية</option>
                <option value="استعراض وجدولة تجربة حية لنظام ديوان">استعراض وجدولة تجربة حية لنظام ديوان</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-[#10233F]">ملاحظات أو نبذة عن الطلب (اختياري)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="يرجى كتابة أي تفاصيل إضافية لتجهيز المستشار المختص قبل الجلسة..."
                rows={3}
                className="text-xs leading-relaxed"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#0B1B3D] hover:bg-[#071328] text-white font-bold text-xs h-11 rounded-xl shadow-xs gap-2 cursor-pointer mt-2 border border-[#C99732]/30"
            >
              <Send className="w-4 h-4 text-[#C99732]" />
              <span>إرسال الطلب والمتابعة فوراً عبر الواتساب</span>
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
