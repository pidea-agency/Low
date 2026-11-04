import React, { useState, useEffect } from 'react';
import { Mail, Phone, Lock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { OfficeMember } from './member-table';

export interface EditMemberFormData {
  display_name: string;
  email: string;
  phone: string;
  password?: string;
}

export interface EditMemberDialogProps {
  isOpen: boolean;
  member: OfficeMember | null;
  onClose: () => void;
  onSubmit: (formData: EditMemberFormData) => Promise<void>;
}

export function EditMemberDialog({ isOpen, member, onClose, onSubmit }: EditMemberDialogProps) {
  const [formData, setFormData] = useState<EditMemberFormData>({
    display_name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (member) {
      setFormData({
        display_name: member.display_name || '',
        email: member.email || '',
        phone: member.phone || '',
        password: '',
      });
    }
  }, [member]);

  if (!isOpen || !member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4" dir="rtl">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-black text-foreground">
            تعديل بيانات المحامي: {member.display_name || member.username}
          </h2>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            اسم المستخدم: {member.username} (غير قابل للتغيير)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-display-name" className="text-xs font-bold">
              الاسم الكامل للمحامي
            </Label>
            <Input
              id="edit-display-name"
              placeholder="مثال: أ. أحمد عبد الله"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-email" className="text-xs font-bold">
              البريد الإلكتروني
            </Label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
              <Input
                id="edit-email"
                type="email"
                placeholder="lawyer@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="pr-9 text-xs font-mono"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-phone" className="text-xs font-bold">
              رقم الجوال
            </Label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
              <Input
                id="edit-phone"
                placeholder="05XXXXXXXX"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="pr-9 text-xs font-mono"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border">
            <Label htmlFor="edit-password" className="text-xs font-bold text-muted-foreground">
              تعيين كلمة مرور جديدة (اتركه فارغاً للإبقاء على الحالية)
            </Label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
              <Input
                id="edit-password"
                type="password"
                placeholder="اتركه فارغاً ما لم ترغب في التغيير"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="pr-9 text-xs font-mono"
                dir="ltr"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs">
              إلغاء
            </Button>
            <Button type="submit" disabled={isSubmitting} className="text-xs font-bold">
              {isSubmitting ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

