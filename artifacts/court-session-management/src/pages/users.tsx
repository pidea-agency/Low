import React, { useState, useEffect } from 'react';
import { Users, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useGetCurrentUser } from '@workspace/api-client-react';
import { validatePassword } from '@workspace/api-zod';
import {
  MemberTable,
  AddMemberDialog,
  EditMemberDialog,
  type OfficeMember,
  type AddMemberFormData,
  type EditMemberFormData,
} from '@/components/users';

export type { OfficeMember };

export default function OfficeMembersPage() {
  const { toast } = useToast();
  const { data: currentUser } = useGetCurrentUser();

  const [members, setMembers] = useState<OfficeMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<OfficeMember | null>(null);

  // Activation resend tracking
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  // Countdown timer for resend cooldowns
  useEffect(() => {
    const timer = setInterval(() => {
      setCooldowns((prev) => {
        let changed = false;
        const next: Record<string, number> = {};
        for (const [id, sec] of Object.entries(prev)) {
          if (sec > 1) {
            next[id] = sec - 1;
            changed = true;
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.users) {
        setMembers(data.users);
      }
    } catch {
      toast({
        title: 'خطأ',
        description: 'فشل جلب قائمة أعضاء ومحامي المكتب.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleCreateMember = async (formData: AddMemberFormData) => {
    if (!formData.username.trim()) {
      toast({
        title: 'تنبيه',
        description: 'اسم المستخدم للدخول مطلوب.',
        variant: 'destructive',
      });
      return null;
    }
    if (!formData.email.trim()) {
      toast({
        title: 'تنبيه',
        description: 'البريد الإلكتروني إلزامي لإرسال رابط التفعيل للمحامي.',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username.trim(),
          display_name: formData.display_name.trim() || undefined,
          email: formData.email.trim(),
          phone: formData.phone.trim() || undefined,
          role: 'staff',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل إنشاء حساب العضو.');
      }

      toast({
        title: 'تم إنشاء الحساب',
        description: data.emailSent
          ? 'تم إنشاء المحامي بنجاح وإرسال رابط التفعيل عبر البريد الإلكتروني.'
          : 'تم إنشاء المحامي بنجاح. تعذر إرسال البريد تلقائياً.',
      });

      fetchMembers();
      return {
        activationUrl: data.activationUrl,
        emailSent: Boolean(data.emailSent),
        emailError: data.emailError,
      };
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
      return null;
    }
  };

  const handleResendActivation = async (member: OfficeMember) => {
    if (cooldowns[member.id] > 0 || resendingId === member.id) return;
    setResendingId(member.id);

    try {
      const res = await fetch(`/api/users/${member.id}/resend-activation`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل إعادة إرسال رابط التفعيل.');
      }

      setCooldowns((prev) => ({ ...prev, [member.id]: 60 }));

      if (data.emailSent) {
        toast({
          title: 'تم الإرسال',
          description: `تم إرسال رابط تفعيل جديد إلى ${member.email || 'البريد الإلكتروني'}.`,
        });
      } else {
        toast({
          title: 'تعذر إرسال البريد',
          description: data.emailError || 'تم تجديد الرابط ولكن فشل إرسال البريد الإلكتروني.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setResendingId(null);
    }
  };

  const handleUpdateMember = async (formData: EditMemberFormData) => {
    if (!selectedMember) return;

    if (formData.password?.trim()) {
      const val = validatePassword(formData.password, {
        username: selectedMember.username,
        email: formData.email,
      });
      if (!val.isValid) {
        toast({
          title: 'كلمة مرور ضعيفة',
          description: val.message,
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      const payload: any = {
        display_name: formData.display_name,
        email: formData.email,
        phone: formData.phone,
      };
      if (formData.password?.trim()) {
        payload.password = formData.password.trim();
      }

      const res = await fetch(`/api/users/${selectedMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تعديل بيانات العضو.');
      }

      toast({
        title: 'تم بنجاح',
        description: 'تم تحديث بيانات العضو بنجاح.',
      });
      setIsEditModalOpen(false);
      fetchMembers();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleToggleStatus = async (member: OfficeMember) => {
    const nextStatus = member.status === 'suspended' ? 'active' : 'suspended';
    const actionName = nextStatus === 'suspended' ? 'إيقاف' : 'تفعيل';
    if (!window.confirm(`هل أنت متأكد من ${actionName} حساب "${member.display_name || member.username}"؟`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${member.id}/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('فشل تغيير حالة الحساب.');
      toast({
        title: 'تم بنجاح',
        description: `تم ${actionName} حساب العضو بنجاح.`,
      });
      fetchMembers();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteMember = async (member: OfficeMember) => {
    if (!window.confirm(`هل أنت متأكد من حذف حساب "${member.display_name || member.username}" من أعضاء المكتب؟`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${member.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('فشل حذف العضو.');
      toast({
        title: 'تم الحذف',
        description: 'تم حذف العضو من المكتب بنجاح.',
      });
      fetchMembers();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6 font-sans" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                أعضاء ومحامو المكتب
              </h1>
              <Badge variant="outline" className="text-xs font-bold">
                {currentUser?.officeName || 'مكتب المحاماة'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              إدارة حسابات المحامين والمساعدين المصرح لهم بالدخول للنظام والعمل على قضايا وجلسات المكتب
            </p>
          </div>
        </div>

        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="gap-2 text-xs font-bold self-end sm:self-center shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          إضافة محامٍ / عضو جديد
        </Button>
      </div>

      {/* Members Table */}
      <MemberTable
        members={members}
        isLoading={isLoading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onEdit={(m) => {
          setSelectedMember(m);
          setIsEditModalOpen(true);
        }}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDeleteMember}
        onResendActivation={handleResendActivation}
        resendingId={resendingId}
        cooldowns={cooldowns}
      />

      {/* Add Member Dialog */}
      <AddMemberDialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateMember}
      />

      {/* Edit Member Dialog */}
      <EditMemberDialog
        isOpen={isEditModalOpen}
        member={selectedMember}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedMember(null);
        }}
        onSubmit={handleUpdateMember}
      />
    </div>
  );
}
