import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  User,
  Edit3,
  ChevronLeft,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Key,
  Power,
  Save,
  X,
  Briefcase,
  Calendar,
  FileText,
  BarChart3,
  Settings,
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  Folder,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

  // View mode: 'table' or 'form' (Screen 6: Image 6)
  const [viewMode, setViewMode] = useState<'table' | 'form'>('table');
  const [selectedMember, setSelectedMember] = useState<OfficeMember | null>(null);

  // Form Fields
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState('موظف جلسات');
  const [formBranch, setFormBranch] = useState('الفرع الرئيسي - الرياض');
  const [formStatus, setFormStatus] = useState<'active' | 'suspended'>('active');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirmPassword, setFormConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Permissions Matrix State (matching Image 6)
  const [permissions, setPermissions] = useState<Record<string, { view: boolean; add: boolean; edit: boolean; delete: boolean }>>({
    cases: { view: true, add: true, edit: true, delete: false },
    sessions: { view: true, add: true, edit: true, delete: false },
    clients: { view: true, add: true, edit: false, delete: false },
    documents: { view: true, add: true, edit: false, delete: true },
    reports: { view: true, add: false, edit: false, delete: false },
    users: { view: false, add: false, edit: false, delete: false },
    settings: { view: false, add: false, edit: false, delete: false },
  });

  const togglePermission = (module: string, action: 'view' | 'add' | 'edit' | 'delete') => {
    setPermissions((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev[module]?.[action],
      },
    }));
  };

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

  const handleOpenAdd = () => {
    setSelectedMember(null);
    setFormDisplayName('أحمد محمد العتيبي');
    setFormUsername('a.alotaibi');
    setFormEmail('ahmed.alotaibi@court.gov.sa');
    setFormPhone('+966 55 123 4567');
    setFormRole('موظف جلسات');
    setFormBranch('الفرع الرئيسي - الرياض');
    setFormStatus('active');
    setFormPassword('');
    setFormConfirmPassword('');
    setViewMode('form');
  };

  const handleOpenEdit = (m: OfficeMember) => {
    setSelectedMember(m);
    setFormDisplayName(m.display_name || m.username);
    setFormUsername(m.username);
    setFormEmail(m.email || '');
    setFormPhone(m.phone || '');
    setFormRole((m.role as string) === 'admin' ? 'مدير نظام' : 'موظف جلسات');
    setFormBranch('الفرع الرئيسي - الرياض');
    setFormStatus(m.status === 'suspended' ? 'suspended' : 'active');
    setFormPassword('');
    setFormConfirmPassword('');
    setViewMode('form');
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim()) {
      toast({ title: 'تنبيه', description: 'اسم المستخدم للدخول مطلوب.', variant: 'destructive' });
      return;
    }
    if (!formEmail.trim()) {
      toast({ title: 'تنبيه', description: 'البريد الإلكتروني إلزامي.', variant: 'destructive' });
      return;
    }
    if (formPassword && formPassword !== formConfirmPassword) {
      toast({ title: 'خطأ', description: 'كلمتا المرور غير متطابقتين.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedMember) {
        // Edit existing member
        const payload: any = {
          display_name: formDisplayName.trim(),
          email: formEmail.trim(),
          phone: formPhone.trim(),
        };
        if (formPassword.trim()) {
          const val = validatePassword(formPassword.trim(), {
            username: formUsername,
            email: formEmail,
          });
          if (!val.isValid) {
            toast({ title: 'كلمة مرور ضعيفة', description: val.message, variant: 'destructive' });
            setIsSubmitting(false);
            return;
          }
          payload.password = formPassword.trim();
        }

        const res = await fetch(`/api/users/${selectedMember.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'فشل تعديل بيانات المستخدم.');

        toast({ title: 'تم بنجاح', description: 'تم تحديث بيانات المستخدم وصلاحياته بنجاح.' });
      } else {
        // Create new member
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: formUsername.trim(),
            display_name: formDisplayName.trim() || undefined,
            email: formEmail.trim(),
            phone: formPhone.trim() || undefined,
            role: formRole === 'مدير نظام' ? 'admin' : 'staff',
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'فشل إنشاء حساب المستخدم.');

        toast({
          title: 'تم إنشاء الحساب',
          description: data.emailSent
            ? 'تم إنشاء المستخدم بنجاح وإرسال رابط التفعيل عبر البريد الإلكتروني.'
            : 'تم إنشاء المستخدم بنجاح.',
        });
      }

      fetchMembers();
      setViewMode('table');
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
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
      if (!res.ok) throw new Error(data.error || 'فشل إعادة إرسال رابط التفعيل.');

      setCooldowns((prev) => ({ ...prev, [member.id]: 60 }));
      toast({
        title: 'تم الإرسال',
        description: `تم إرسال رابط تفعيل جديد إلى ${member.email || 'البريد الإلكتروني'}.`,
      });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setResendingId(null);
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
      if (selectedMember && selectedMember.id === member.id) {
        setSelectedMember({ ...selectedMember, status: nextStatus });
        setFormStatus(nextStatus);
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteMember = async (member: OfficeMember) => {
    if (!window.confirm(`هل أنت متأكد من حذف حساب "${member.display_name || member.username}" من أعضاء المكتب؟`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${member.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('فشل حذف العضو.');
      toast({ title: 'تم الحذف', description: 'تم حذف العضو من المكتب بنجاح.' });
      fetchMembers();
      if (viewMode === 'form') setViewMode('table');
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // VIEW 1: SCREEN 6 (Image 6: إضافة / تعديل مستخدم وصلاحياته)
  // ══════════════════════════════════════════════════════════════════
  if (viewMode === 'form') {
    const empId = selectedMember ? `EMP-0${selectedMember.id.slice(0, 3)}` : 'EMP-0147';
    const createdDate = selectedMember?.created_at ? selectedMember.created_at.slice(0, 10) : '2024-06-15';

    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 font-sans bg-[#F4F7FA] min-h-screen" dir="rtl">
        {/* Top Breadcrumb & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-[#64748B] flex items-center gap-1.5 mb-1.5 font-medium">
              <span>الرئيسية</span>
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>المستخدمون</span>
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="text-[#10233F] font-bold">إضافة / تعديل مستخدم وصلاحياته</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#C4933F]">
                <Users className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#10233F] tracking-tight">
                إضافة / تعديل مستخدم وصلاحياته
              </h1>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setViewMode('table')}
            className="gap-2 text-xs font-bold border-slate-200 bg-white text-[#10233F] hover:bg-slate-50 rounded-xl px-4 py-2 cursor-pointer self-start sm:self-auto shadow-xs"
          >
            <ArrowLeft className="w-4 h-4 ml-1" />
            <span>العودة للمستخدمين</span>
          </Button>
        </div>

        <form onSubmit={handleSaveForm}>
          {/* 2-Column Grid matching Image 6 */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Summary + Status + Info (lg:col-span-3) */}
            <div className="lg:col-span-3 space-y-4">
              {/* Card 1: ملخص المستخدم */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs text-center space-y-3">
                <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-500 mx-auto">
                  <User className="w-10 h-10" />
                </div>

                <div>
                  <h3 className="text-sm font-black text-[#10233F]">
                    {formDisplayName || 'أحمد محمد العتيبي'}
                  </h3>
                  <span className="text-xs font-mono text-[#64748B] block mt-0.5">
                    {formUsername || 'a.alotaibi'}
                  </span>
                  <div className="mt-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      نشط
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs pt-3 border-t border-slate-100 text-right">
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B] flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#C4933F]" />
                      رقم الموظف :
                    </span>
                    <span className="font-mono font-bold text-[#10233F]">{empId}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B] flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#C4933F]" />
                      تاريخ إنشاء الحساب :
                    </span>
                    <span className="font-mono text-[#10233F]">{createdDate}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: حالة الحساب */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <BarChart3 className="w-4 h-4 text-[#C4933F]" />
                  <h3 className="text-xs font-black text-[#10233F]">حالة الحساب</h3>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold">الحساب نشط</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold">يمكنه تسجيل الدخول</span>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold">الصلاحيات محدثة</span>
                  </div>
                </div>
              </div>

              {/* Card 3: معلومات إضافية */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <ShieldCheck className="w-4 h-4 text-[#C4933F]" />
                  <h3 className="text-xs font-black text-[#10233F]">معلومات إضافية</h3>
                </div>

                <div className="space-y-2.5 text-xs text-right">
                  <div>
                    <span className="text-[#64748B] block mb-0.5">آخر تسجيل دخول :</span>
                    <span className="font-mono text-[#10233F]">10:25-01-27 ص</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[#64748B] block mb-0.5">ملاحظات إدارية :</span>
                    <span className="text-[#10233F] leading-relaxed">
                      المستخدم مسؤول عن إدارة الجلسات في الفرع الرئيسي.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: User Details + Permissions Matrix (lg:col-span-9) */}
            <div className="lg:col-span-9 space-y-5">
              {/* Card 1: بيانات المستخدم */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <User className="w-4 h-4 text-[#C4933F]" />
                  <h2 className="text-sm font-black text-[#10233F]">بيانات المستخدم</h2>
                </div>

                {/* Row 1: الاسم الكامل + اسم المستخدم */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#10233F] mb-1.5">
                      الاسم الكامل <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        value={formDisplayName}
                        onChange={(e) => setFormDisplayName(e.target.value)}
                        placeholder="أحمد محمد العتيبي"
                        className="h-10 text-xs rounded-xl bg-slate-50/50 border-slate-200 pr-9"
                        required
                      />
                      <User className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#10233F] mb-1.5">
                      اسم المستخدم <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value)}
                        placeholder="a.alotaibi"
                        className="h-10 text-xs rounded-xl bg-slate-50/50 border-slate-200 font-mono pr-9"
                        required
                      />
                      <User className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Row 2: البريد الإلكتروني + رقم الهاتف */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#10233F] mb-1.5">
                      البريد الإلكتروني <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        type="email"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder="ahmed.alotaibi@court.gov.sa"
                        dir="ltr"
                        className="h-10 text-xs rounded-xl bg-slate-50/50 border-slate-200 pr-9 text-left font-mono"
                        required
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#10233F] mb-1.5">
                      رقم الهاتف
                    </label>
                    <div className="relative">
                      <Input
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        placeholder="+966 55 123 4567"
                        dir="ltr"
                        className="h-10 text-xs rounded-xl bg-slate-50/50 border-slate-200 pr-9 text-left font-mono"
                      />
                      <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Row 3: الدور + القسم أو الفرع */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#10233F] mb-1.5">
                      الدور <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl text-xs font-semibold bg-slate-50/50 border border-slate-200 text-[#10233F] focus:outline-none cursor-pointer"
                    >
                      <option value="موظف جلسات">موظف جلسات</option>
                      <option value="محامٍ">محامٍ</option>
                      <option value="مدير نظام">مدير نظام</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#10233F] mb-1.5">
                      القسم أو الفرع <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formBranch}
                      onChange={(e) => setFormBranch(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl text-xs font-semibold bg-slate-50/50 border border-slate-200 text-[#10233F] focus:outline-none cursor-pointer"
                    >
                      <option value="الفرع الرئيسي - الرياض">الفرع الرئيسي - الرياض</option>
                      <option value="فرع جدة">فرع جدة</option>
                      <option value="فرع الدمام">فرع الدمام</option>
                    </select>
                  </div>
                </div>

                {/* Row 4: الحالة */}
                <div>
                  <label className="block text-xs font-bold text-[#10233F] mb-1.5">
                    الحالة <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 focus:outline-none cursor-pointer"
                  >
                    <option value="active">نشط</option>
                    <option value="suspended">موقوف</option>
                  </select>
                </div>

                {/* Row 5: كلمة المرور + تأكيد كلمة المرور */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#10233F] mb-1.5">
                      كلمة المرور <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        type="password"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="h-10 text-xs rounded-xl bg-slate-50/50 border-slate-200 pr-9 font-mono"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#10233F] mb-1.5">
                      تأكيد كلمة المرور <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        type="password"
                        value={formConfirmPassword}
                        onChange={(e) => setFormConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="h-10 text-xs rounded-xl bg-slate-50/50 border-slate-200 pr-9 font-mono"
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: تحديد الصلاحيات */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#C4933F]" />
                    <h2 className="text-sm font-black text-[#10233F]">تحديد الصلاحيات</h2>
                  </div>
                  <p className="text-xs text-[#64748B] mt-1">
                    حدد الصلاحيات المسموح بها لهذا المستخدم على وظائف النظام المختلفة.
                  </p>
                </div>

                {/* Permissions Matrix Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50/70 border-b border-slate-100 text-[#64748B]">
                      <tr>
                        <th className="p-3 font-bold">الوحدة / الصلاحية</th>
                        <th className="p-3 font-bold text-center">عرض فقط</th>
                        <th className="p-3 font-bold text-center">إضافة</th>
                        <th className="p-3 font-bold text-center">تعديل</th>
                        <th className="p-3 font-bold text-center">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        { key: 'cases', label: 'إدارة القضايا', icon: Briefcase },
                        { key: 'sessions', label: 'إدارة الجلسات', icon: Calendar },
                        { key: 'clients', label: 'إدارة العملاء', icon: Users },
                        { key: 'documents', label: 'إدارة المستندات', icon: FileText },
                        { key: 'reports', label: 'التقارير', icon: BarChart3 },
                        { key: 'users', label: 'إدارة المستخدمين', icon: Users },
                        { key: 'settings', label: 'الإعدادات', icon: Settings },
                      ].map((item) => {
                        const Icon = item.icon;
                        const rowPerm = permissions[item.key] || { view: false, add: false, edit: false, delete: false };

                        return (
                          <tr key={item.key} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3 font-bold text-[#10233F] flex items-center gap-2">
                              <Icon className="w-4 h-4 text-[#C4933F]" />
                              <span>{item.label}</span>
                            </td>
                            {(['view', 'add', 'edit', 'delete'] as const).map((act) => {
                              const checked = rowPerm[act];
                              return (
                                <td key={act} className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => togglePermission(item.key, act)}
                                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors mx-auto cursor-pointer ${
                                      checked
                                        ? 'bg-[#C4933F] border-[#C4933F] text-white shadow-xs'
                                        : 'border-slate-300 bg-white hover:border-[#C4933F]'
                                    }`}
                                  >
                                    {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                {/* Left Action Buttons */}
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  {selectedMember && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleToggleStatus(selectedMember)}
                        className="text-xs font-bold border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl px-4 py-2 cursor-pointer"
                      >
                        <Power className="w-3.5 h-3.5 ml-1.5" />
                        <span>تعطيل الحساب</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleResendActivation(selectedMember)}
                        className="text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl px-4 py-2 cursor-pointer"
                      >
                        <Key className="w-3.5 h-3.5 ml-1.5 text-[#C4933F]" />
                        <span>إعادة تعيين كلمة المرور</span>
                      </Button>
                    </>
                  )}
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-[#C4933F] hover:bg-[#B38332] text-white font-bold text-xs px-7 py-2.5 rounded-xl cursor-pointer shadow-md shadow-[#C4933F]/20 flex items-center gap-2 border-0"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSubmitting ? 'جارٍ الحفظ...' : 'حفظ'}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setViewMode('table')}
                    className="text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl px-5 py-2.5 cursor-pointer"
                  >
                    <X className="w-4 h-4 ml-1.5" />
                    <span>إلغاء</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // VIEW 2: MAIN MEMBERS TABLE
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6 font-sans bg-[#F4F7FA] min-h-screen" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#C4933F]">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-[#10233F] tracking-tight">
                أعضاء ومحامو المكتب
              </h1>
              <Badge variant="outline" className="text-xs font-bold border-slate-200">
                {currentUser?.officeName || 'مكتب المحاماة'}
              </Badge>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              إدارة حسابات المحامين والمساعدين المصرح لهم بالدخول للنظام والعمل على قضايا وجلسات المكتب
            </p>
          </div>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="gap-2 text-xs font-bold self-end sm:self-center shrink-0 bg-[#C4933F] hover:bg-[#B28325] text-white rounded-xl shadow-md shadow-[#C4933F]/25 border-0 cursor-pointer px-4 py-2.5"
        >
          <UserPlus className="w-4 h-4" />
          + إضافة محامٍ / عضو جديد
        </Button>
      </div>

      {/* Members Table */}
      <MemberTable
        members={members}
        isLoading={isLoading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onEdit={handleOpenEdit}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDeleteMember}
        onResendActivation={handleResendActivation}
        resendingId={resendingId}
        cooldowns={cooldowns}
      />

      {/* Add Member Dialog (kept for compatibility) */}
      <AddMemberDialog
        isOpen={false}
        onClose={() => {}}
        onSubmit={async () => null}
      />

      {/* Edit Member Dialog (kept for compatibility) */}
      <EditMemberDialog
        isOpen={false}
        member={null}
        onClose={() => {}}
        onSubmit={async () => {}}
      />
    </div>
  );
}
