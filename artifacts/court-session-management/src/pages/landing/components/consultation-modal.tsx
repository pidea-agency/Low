import React, { useState } from "react";
import { X, Send, CheckCircle2, MessageCircle, User, Phone, Mail, Building, FileText } from "lucide-react";
import type { LandingData } from "../types";

interface ConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: LandingData | null;
  initialTopic?: string;
}

export function ConsultationModal({
  isOpen,
  onClose,
  data,
  initialTopic = "",
}: ConsultationModalProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [topic, setTopic] = useState(initialTopic || "باقة المكتب المتكامل (Growth)");
  const [notes, setNotes] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const whatsappNumber = data?.office?.whatsappNumber || "970567603295";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Build direct WhatsApp message
    const message = [
      `*طلب تجربة مجانية وعرض لنظام ديوان القانوني*`,
      ``,
      `👤 *الاسم:* ${fullName}`,
      `📞 *الجوال:* ${phone}`,
      email ? `✉️ *البريد:* ${email}` : "",
      company ? `🏢 *اسم المكتب / الشركة:* ${company}` : "",
      `⚖️ *الباقة أو الاهتمام:* ${topic}`,
      notes ? `📝 *ملاحظات إضافية:* ${notes}` : "",
      ``,
      `_تم الإرسال عبر صفحة الهبوط الرسمية_`,
    ]
      .filter(Boolean)
      .join("\n");

    const cleanNum = whatsappNumber.replace(/[^\d]/g, "");
    const url = `https://wa.me/${cleanNum}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
    setIsSubmitted(true);
  };

  const handleResetAndClose = () => {
    setIsSubmitted(false);
    setFullName("");
    setPhone("");
    setEmail("");
    setCompany("");
    setNotes("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in-50 duration-200"
      dir="rtl"
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden text-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold text-slate-900">
              احجز تجربتك المجانية لـ 14 يوماً
            </h3>
            <p className="text-xs text-slate-500">
              تفعيل بيئة عمل مخصصة لمكتبك وتدريب فوري لفريقك
            </p>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {isSubmitted ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-slate-900">
                  تم استلام طلبك بنجاح!
                </h4>
                <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                  تم فتح محادثة الواتساب مع المستشار، وسيقوم فريقنا بتجهيز بيئة عمل
                  مكتبك فوراً وإرسال بيانات الدخول.
                </p>
              </div>
              <button
                onClick={handleResetAndClose}
                className="mt-4 h-10 px-6 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  الاسم الكامل <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثال: أ. فيصل السعيد"
                    className="w-full h-10 pr-9 pl-3 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    رقم الجوال (واتساب) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="05XXXXXXXX"
                      className="w-full h-10 pr-9 pl-3 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all text-slate-900 placeholder:text-slate-400"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    اسم مكتب المحاماة
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="مثال: مكتب النخبة للمحاماة"
                      className="w-full h-10 pr-9 pl-3 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  البريد الإلكتروني المهني
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@lawfirm.sa"
                    className="w-full h-10 pr-9 pl-3 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all text-slate-900 placeholder:text-slate-400 text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  الباقة أو الاهتمام
                </label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full h-10 px-3 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all text-slate-900"
                >
                  <option value="باقة المكتب الفردي (Solo / Starter)">
                    باقة المكتب الفردي (Solo / Starter) - حتى 3 محامين
                  </option>
                  <option value="باقة المكتب المتكامل (Growth)">
                    باقة المكتب المتكامل (Growth) - حتى 15 محامياً
                  </option>
                  <option value="باقة الشركات القانونية (Enterprise)">
                    باقة الشركات القانونية (Enterprise) - مخصصة
                  </option>
                  <option value="طلب استشارة وعرض توضيحي مخصص">
                    طلب استشارة وعرض توضيحي مخصص
                  </option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  ملاحظات أو استفسار خاص
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="عدد محامي المكتب، رغبة في استيراد بيانات سابقة من إكسل..."
                  className="w-full p-3 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all text-slate-900 placeholder:text-slate-400 resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full h-11 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  <span>تأكيد الحجز وتفعيل التجربة عبر الواتساب</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-500 text-center pt-1">
                🔒 بياناتك مشفرة ومحفوظة بسرية تامة ولا تتم مشاركتها مع أي طرف ثالث.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
