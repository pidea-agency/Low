import React, { useState } from 'react';
import { Mail, Phone, User, CheckCircle2, Copy, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface AddMemberFormData {
  username: string;
  display_name: string;
  email: string;
  phone: string;
}

export interface AddMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: AddMemberFormData) => Promise<{ activationUrl?: string; emailSent?: boolean; emailError?: string } | null>;
}

export function AddMemberDialog({ isOpen, onClose, onSubmit }: AddMemberDialogProps) {
  const [formData, setFormData] = useState<AddMemberFormData>({
    username: '',
    display_name: '',
    email: '',
    phone: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{
    activationUrl?: string;
    emailSent?: boolean;
    emailError?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await onSubmit(formData);
      if (result) {
        setCreatedInfo(result);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (createdInfo?.activationUrl) {
      navigator.clipboard.writeText(createdInfo.activationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setCreatedInfo(null);
    setFormData({ username: '', display_name: '', email: '', phone: '' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" dir="rtl">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-black text-foreground">
            {createdInfo ? 'تم إنشاء الحساب وإرسال رابط التفعيل' : 'إضافة محامٍ / عضو جديد للمكتب'}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {createdInfo
              ? 'تم إنشاء الحساب بنجاح. سيقوم المحامي بضبط كلمة المرور الخاصة به عبر رابط التفعيل.'
              : 'أدخل بيانات المحامي. سيتم إرسال رابط تفعيل إلى بريده الإلكتروني لتعيين كلمة المرور بنفسه.'}
          </p>
        </div>

        {createdInfo ? (
          <div className="p-6 space-y-4">
            {createdInfo.emailSent ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-emerald-950 dark:text-emerald-100">تم إرسال دعوة التفعيل بالبريد الإلكتروني</p>
                  <p className="text-emerald-900/80 dark:text-emerald-300/80 mt-0.5">
                    تم إرسال رسالة بريد تتضمن رابط التفعيل الآمن إلى المحامي بنجاح.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-amber-950 dark:text-amber-100">تعذر إرسال البريد الإلكتروني تلقائياً</p>
                  <p className="text-amber-900/80 dark:text-amber-300/80 mt-0.5">
                    {createdInfo.emailError || 'يرجى نسخ رابط التفعيل المباشر أدناه ومشاركته مع المحامي يدوياً.'}
                  </p>
                </div>
              </div>
            )}

            {createdInfo.activationUrl && (
              <div className="space-y-2">
                <Label className="text-xs font-bold">رابط التفعيل المباشر (صالح لمدة 48 ساعة):</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={createdInfo.activationUrl}
                    className="font-mono text-xs bg-muted"
                    dir="ltr"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyLink}
                    className="gap-1 text-xs shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'تم النسخ' : 'نسخ'}
                  </Button>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button onClick={handleClose} className="text-xs font-bold">
                إغلاق
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="add-username" className="text-xs font-bold">
                اسم المستخدم للدخول <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <User className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                <Input
                  id="add-username"
                  required
                  placeholder="مثال: lawyer_ahmad"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="pr-9 text-xs font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-display-name" className="text-xs font-bold">
                الاسم الكامل للمحامي
              </Label>
              <Input
                id="add-display-name"
                placeholder="مثال: أ. أحمد عبد الله"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-email" className="text-xs font-bold">
                البريد الإلكتروني <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                <Input
                  id="add-email"
                  type="email"
                  required
                  placeholder="lawyer@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pr-9 text-xs font-mono"
                  dir="ltr"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                إلزامي لإرسال رابط التفعيل وتعيين كلمة المرور.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-phone" className="text-xs font-bold">
                رقم الجوال (اختياري)
              </Label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                <Input
                  id="add-phone"
                  placeholder="05XXXXXXXX"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="pr-9 text-xs font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose} className="text-xs">
                إلغاء
              </Button>
              <Button type="submit" disabled={isSubmitting} className="text-xs font-bold">
                {isSubmitting ? 'جارٍ الإنشاء والإرسال...' : 'إنشاء وإرسال رابط التفعيل'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

