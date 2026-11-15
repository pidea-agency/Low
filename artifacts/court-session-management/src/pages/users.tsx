import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Eye,
  Plus,
  Trash2,
  Download,
  History,
  RotateCcw,
  Send,
  Ban,
  Clock,
  Sparkles,
  Copy,
  Zap,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useGetCurrentUser } from '@workspace/api-client-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface OfficeMemberItem {
  id: string;
  username: string;
  display_name?: string;
  roleTitle?: string;
  avatarInitials?: string;
  avatarBg?: string;
  email?: string;
  phone?: string;
  status: 'active' | 'pending' | 'suspended';
  statusLabel?: string;
  casesCount?: number;
  poaCount?: number;
  started?: boolean;
  role: 'admin' | 'lawyer' | 'consultant' | 'assistant' | string;
  created_at?: string;
}

export type OfficeMember = OfficeMemberItem;

export default function OfficeMembersPage() {
  const { toast } = useToast();
  const { data: currentUser } = useGetCurrentUser();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // Active filter tab: 'all' | 'lawyers' | 'consultants' | 'pending'
  const [activeTab, setActiveTab] = useState<'all' | 'lawyers' | 'consultants' | 'pending'>('all');

  // Search input
  const [searchQuery, setSearchQuery] = useState('');

  // Backend members
  const [backendMembers, setBackendMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [editingMember, setEditingMember] = useState<OfficeMemberItem | null>(null);
  const [toggleStatusTarget, setToggleStatusTarget] = useState<OfficeMemberItem | null>(null);

  // Form State (Add)
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<'lawyer' | 'consultant' | 'assistant'>('lawyer');
  const [formRoleTitle, setFormRoleTitle] = useState('محامٍ ممارس • قضايا المحاكم');

  // Form State (Edit)
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRoleTitle, setEditRoleTitle] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch real users from backend
  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.users && Array.isArray(data.users)) {
          setBackendMembers(data.users);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchActivityLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/users/activity-log', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setActivityLogs(data.logs || []);
      }
    } catch {
      setActivityLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    if (isActivityLogOpen) {
      fetchActivityLogs();
    }
  }, [isActivityLogOpen, fetchActivityLogs]);

  // Map real backend members
  const allMembers: OfficeMemberItem[] = useMemo(() => {
    if (!backendMembers || backendMembers.length === 0) {
      return [];
    }
    return backendMembers.map((b, idx) => ({
      id: String(b.id || `mem-${idx}`),
      username: b.username || 'عضو',
      display_name: b.display_name || b.username || 'عضو المكتب',
      roleTitle: b.role_title || (b.role === 'admin' ? 'مدير المكتب والشركاء' : b.role === 'consultant' ? 'مستشار قانوني' : 'محامٍ ممارس'),
      avatarInitials: (b.display_name || b.username || 'مح').slice(0, 2),
      avatarBg: idx % 2 === 0 ? 'bg-[#00236f] text-white' : 'bg-[#ebf3ff] text-[#00236f]',
      email: b.email || '—',
      phone: b.phone || '—',
      status: b.status === 'suspended' ? 'suspended' : b.is_active === false ? 'pending' : 'active',
      statusLabel: b.status === 'suspended' ? 'موقوف' : b.is_active === false ? 'بانتظار التفعيل' : 'نشط',
      casesCount: b.assigned_cases_count || b.cases_count || 0,
      poaCount: b.poa_count || 0,
      started: b.is_active !== false,
      role: b.role === 'consultant' ? 'consultant' : b.role === 'assistant' ? 'assistant' : 'lawyer',
      created_at: b.created_at,
    }));
  }, [backendMembers]);

  // Dynamic KPI Metrics
  const totalMembersCount = allMembers.length;
  const activeMembersCount = allMembers.filter((m) => m.status === 'active').length;
  const pendingMembersCount = allMembers.filter((m) => m.status === 'pending').length;
  const lawyersCount = allMembers.filter((m) => m.role === 'lawyer').length;
  const consultantsCount = allMembers.filter((m) => m.role === 'consultant').length;
  const staffCount = allMembers.filter((m) => m.role === 'assistant').length;
  const totalCasesDistributed = allMembers.reduce((acc, m) => acc + (m.casesCount || 0), 0);
  const avgCasesPerMember = totalMembersCount > 0 ? (totalCasesDistributed / totalMembersCount).toFixed(1) : '0';
  const activePct = totalMembersCount > 0 ? Math.round((activeMembersCount / totalMembersCount) * 100) : 0;

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return allMembers.filter((item) => {
      // Tab filter
      if (activeTab === 'lawyers' && item.role !== 'lawyer') return false;
      if (activeTab === 'consultants' && item.role !== 'consultant') return false;
      if (activeTab === 'pending' && item.status !== 'pending') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.display_name?.toLowerCase().includes(q);
        const matchUser = item.username.toLowerCase().includes(q);
        const matchPhone = item.phone?.toLowerCase().includes(q);
        const matchEmail = item.email?.toLowerCase().includes(q);
        if (!matchName && !matchUser && !matchPhone && !matchEmail) return false;
      }

      return true;
    });
  }, [allMembers, activeTab, searchQuery]);

  // Copy email to clipboard helper
  const handleCopyEmail = (email: string) => {
    navigator.clipboard?.writeText(email);
    toast({ title: 'تم نسخ البريد الإلكتروني', description: email });
  };

  // Resend Activation
  const handleResend = (member: OfficeMemberItem) => {
    toast({
      title: 'تم إرسال رابط التفعيل',
      description: `تم إرسال رابط تفعيل جديد إلى البريد الإلكتروني (${member.email}) وعبر الواتساب.`,
    });
  };

  // Toggle Suspend / Activate
  const handleToggleStatus = async () => {
    if (!toggleStatusTarget) return;
    try {
      const res = await fetch(`/api/users/${toggleStatusTarget.id}/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: toggleStatusTarget.status === 'active' ? 'suspended' : 'active',
        }),
      });
      if (res.ok) {
        toast({
          title: 'تم تحديث حالة الحساب بنجاح',
          description: `تم تعديل حالة حساب (${toggleStatusTarget.display_name || toggleStatusTarget.username}).`,
        });
        fetchMembers();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'فشل تعديل حالة الحساب',
          description: err.error || 'تعذر تحديث حالة الحساب.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'خطأ في الاتصال',
        description: 'تعذر تعديل حالة الحساب.',
        variant: 'destructive',
      });
    } finally {
      setToggleStatusTarget(null);
    }
  };

  // Handle Save / Add Member
  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim()) {
      toast({ title: 'يرجى إدخال اسم المستخدم', variant: 'destructive' });
      return;
    }
    if (!formEmail.trim()) {
      toast({ title: 'البريد الإلكتروني مطلوب لإرسال رابط تفعيل الحساب', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        username: formUsername.trim(),
        display_name: formDisplayName.trim() || undefined,
        email: formEmail.trim(),
        phone: formPhone.trim() || undefined,
        role: 'staff',
        role_title: formRoleTitle.trim() || undefined,
      };

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({
          title: 'تمت إضافة العضو بنجاح',
          description: `تم إرسال دعوة الانضمام ورابط التفعيل إلى ${formEmail}.`,
        });
        fetchMembers();
        setIsAddOpen(false);
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'فشل إضافة العضو',
          description: err.error || 'تعذر تسجيل العضو في قاعدة البيانات.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'خطأ في الاتصال بالخادم',
        description: 'تعذر إنشاء حساب العضو. يرجى التحقق من الشبكة.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setIsSubmitting(true);
    try {
      const payload: any = {
        display_name: editDisplayName.trim() || undefined,
        email: editEmail.trim() || undefined,
        phone: editPhone.trim() || null,
        role_title: editRoleTitle.trim() || null,
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }

      const res = await fetch(`/api/users/${editingMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({
          title: 'تم تحديث بيانات العضو بنجاح',
          description: `تم حفظ التعديلات على حساب (${editDisplayName || editingMember.username}).`,
        });
        setIsEditOpen(false);
        setEditingMember(null);
        fetchMembers();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'فشل تعديل بيانات العضو',
          description: err.error || 'تعذر تحديث البيانات.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'خطأ في الاتصال بالخادم',
        description: 'تعذر تعديل البيانات. يرجى التحقق من الشبكة.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-full bg-[#f8faff] text-[#1c1d22] pb-12 font-sans" dir="rtl">
      {/* ── Top Ribbon ── */}
      <div className="bg-[#edf3ff] border-b border-[#d8e4f8] px-4 lg:px-8 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
          </span>
          <span className="font-medium text-[#2d4379]">
            حالة الخادم: متزامن مع ناجز والعدل
          </span>
          <span className="text-[#9ab1d8]">|</span>
          <span className="text-[#5c6e91]">السنة القضائية 1446-1447هـ</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-[#e4eeff] text-[#00236f] text-[11px] font-bold px-2 py-0.5 rounded border border-[#c7d9fc] flex items-center gap-1">
            <Building2 className="w-3 h-3 text-[#00236f]" />
            مكتب المحاماة الرئيسي
          </span>
        </div>
      </div>

      <div className="px-4 lg:px-8 pt-5 space-y-5">
        {/* ── Top Header Section ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-xs text-[#6e7687]">
              <span>لوحة التحكم</span>
              <span>&gt;</span>
              <span>إدارة المكتب</span>
              <span>&gt;</span>
              <span className="text-[#00236f] font-semibold">أعضاء ومحامو المكتب</span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#fff2e8] text-[#b44800] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <h1 className="text-2xl font-bold text-[#131b2e]">
                أعضاء ومحامو المكتب
              </h1>
            </div>
            <p className="text-xs text-[#55627a] leading-relaxed max-w-3xl">
              إدارة حسابات المحامين والمساعدين المصرح لهم بالدخول للنظام والعمل على قضايا وجلسات المكتب، ومتابعة الحصص الذكية والأدوار والصلاحيات القضائية.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={() => {
                setFormDisplayName('أحمد محمد العتيبي');
                setFormUsername('a.alotaibi');
                setFormEmail('ahmed.alotaibi@court.gov.sa');
                setFormPhone('972599409123');
                setFormRole('lawyer');
                setIsAddOpen(true);
              }}
              className="bg-[#b87019] hover:bg-[#995c14] text-white text-xs font-bold h-10 px-4 gap-2 rounded-lg shadow-sm cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              + إضافة محام / عضو جديد
            </Button>

            <Button
              variant="outline"
              onClick={() => setIsActivityLogOpen(true)}
              className="bg-white hover:bg-[#edf3ff] text-[#44526d] border-[#cfe0fc] text-xs font-semibold h-10 px-3.5 gap-1.5 rounded-lg cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-[#55627a]" />
              سجل النشاط
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                const csvContent =
                  'data:text/csv;charset=utf-8,الاسم,اسم المستخدم,الهاتف,البريد,الحالة,القضايا,الوكالات\n' +
                  allMembers
                    .map(
                      (m) =>
                        `"${m.display_name}","${m.username}","${m.phone}","${m.email}","${m.statusLabel}","${m.casesCount}","${m.poaCount}"`
                    )
                    .join('\n');
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', 'office_lawyers_registry.csv');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast({ title: 'تم تصدير سجل المحامين بصيغة Excel / CSV' });
              }}
              className="bg-white hover:bg-[#edf3ff] text-[#44526d] border-[#d4e2f6] text-xs font-semibold h-10 px-3.5 gap-1.5 rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#55627a]" />
              تصدير Excel
            </Button>
          </div>
        </div>

        {/* ── 4 KPI Metric Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: إجمالي الأعضاء */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">إجمالي الأعضاء</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-[#131c2d] font-mono">{totalMembersCount}</span>
                  <span className="text-xs text-[#526079]">أعضاء معتمدين</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#ebf3ff] text-[#00236f] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] text-[11px] text-[#697893]">
              {lawyersCount} محامين • {consultantsCount} مستشار • {staffCount} إداري
            </div>
          </div>

          {/* Card 2: الحسابات النشطة */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">الحسابات النشطة</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#131c2d] font-mono">{activeMembersCount}</span>
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-1.5 py-0.2 rounded border border-emerald-200">
                    {activePct}% نشاط
                  </span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] text-[11px] text-[#697893]">
              {activeMembersCount > 0 ? `يترافعون في ${totalCasesDistributed} قضية وملف` : 'لا توجد جلسات جارية'}
            </div>
          </div>

          {/* Card 3: بانتظار التفعيل */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">بانتظار التفعيل</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-[#b44800] font-mono">{pendingMembersCount}</span>
                  <span className="text-xs text-[#526079]">دعوة سارية</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#fef5ec] text-[#b35600] flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] text-[11px] text-amber-800 font-medium truncate">
              {pendingMembersCount > 0 ? `${pendingMembersCount} حساب بانتظار تفعيل الدعوة` : 'كافة الدعوات مكتملة ومفعلة'}
            </div>
          </div>

          {/* Card 4: القضايا الموزعة */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">القضايا الموزعة</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#00236f] font-mono">{totalCasesDistributed}</span>
                  <span className="bg-[#edf3ff] text-[#00236f] text-[10px] font-semibold px-1.5 py-0.2 rounded border border-[#cfdffc]">
                    تعيين حي
                  </span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#ebf3ff] text-[#00236f] flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] text-[11px] text-[#697893]">
              معدل {avgCasesPerMember} قضية لكل محامٍ
            </div>
          </div>
        </div>

        {/* ── Filter Tabs & Search Bar Row ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-[#141e30] ml-2">
              إجمالي الأعضاء: <strong className="text-[#00236f] font-mono">{allMembers.length}</strong>
            </span>

            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              الكل ({totalMembersCount})
            </button>

            <button
              onClick={() => setActiveTab('lawyers')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'lawyers'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              محامون ممارسون ({lawyersCount})
            </button>

            <button
              onClick={() => setActiveTab('consultants')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'consultants'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              مستشارون ({consultantsCount})
            </button>

            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              بانتظار التفعيل ({pendingMembersCount})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#8b99b0] absolute right-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالاسم أو اسم المستخدم أو الهاتف..."
              className="pr-9 h-9 text-xs border-[#dce7f6] bg-white focus:bg-white text-[#182337] rounded-lg shadow-2xs"
            />
          </div>
        </div>

        {/* ── Members Table Ledger ── */}
        <div className="bg-white border border-[#dbe6f8] rounded-xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#f4f7fc] text-[#55637d] font-bold border-b border-[#e2ecf9]">
                <tr>
                  <th className="py-3 px-4">اسم المحامي / العضو</th>
                  <th className="py-3 px-4">اسم المستخدم</th>
                  <th className="py-3 px-4">رقم الهاتف</th>
                  <th className="py-3 px-4">البريد الإلكتروني</th>
                  <th className="py-3 px-4 text-center">حالة الحساب</th>
                  <th className="py-3 px-4 text-center">القضايا والوكالات</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf3fc] text-[#1c263c]">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#697994]">
                      <Users className="w-10 h-10 text-[#a0acc0] mx-auto mb-2" />
                      <p className="font-bold text-sm text-[#141e30] mb-1">لا يوجد أعضاء مسجلين</p>
                      <p className="text-xs text-[#718099]">لم يتم العثور على أعضاء مطابقين للبحث أو التصفية.</p>
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => {
                    const isPending = member.status === 'pending';

                    return (
                      <tr key={member.id} className="hover:bg-[#f9fbff] transition-colors">
                        {/* 1. Name & Role */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                member.avatarBg || 'bg-[#00236f] text-white'
                              }`}
                            >
                              {member.avatarInitials || member.display_name?.slice(0, 2) || 'أم'}
                            </div>
                            <div>
                              <div className="font-bold text-[#141e30]">{member.display_name}</div>
                              <div className="text-[11px] text-[#697994]">{member.roleTitle}</div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Username */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs font-semibold text-[#3e4f6e]">
                            {member.username}
                          </span>
                        </td>

                        {/* 3. Phone */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-xs text-[#3e4f6e]">{member.phone || '-'}</span>
                        </td>

                        {/* 4. Email */}
                        <td className="py-3.5 px-4">
                          {member.email && member.email !== '—' ? (
                            <div className="flex items-center gap-1.5 font-mono text-xs text-[#3e4f6e]">
                              <button
                                onClick={() => handleCopyEmail(member.email!)}
                                className="text-[#718099] hover:text-[#00236f] cursor-pointer"
                                title="نسخ البريد"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <span className="truncate max-w-[190px]">{member.email}</span>
                            </div>
                          ) : (
                            <span className="text-[#a0acc0]">-</span>
                          )}
                        </td>

                        {/* 5. Status Badge */}
                        <td className="py-3.5 px-4 text-center">
                          {isPending ? (
                            <span className="bg-[#fff4ed] text-[#b44800] border border-[#ffd5ba] text-[10px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#fd8a42]" />
                              {member.statusLabel}
                            </span>
                          ) : (
                            <span className="bg-[#f0fdf4] text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-600" />
                              {member.statusLabel}
                            </span>
                          )}
                        </td>

                        {/* 6. Cases & POAs */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5 text-xs font-mono">
                            {isPending ? (
                              <>
                                <span className="text-[#8e9bb0]">0 قضايا</span>
                                <span className="text-[#c5d2e3]">•</span>
                                <span className="text-[#b44800] font-bold">لم يبدأ بعد</span>
                              </>
                            ) : (
                              <>
                                <span className="font-bold text-[#141e30]">{member.casesCount} قضايا</span>
                                <span className="text-[#c5d2e3]">•</span>
                                <span className="text-[#657591]">{member.poaCount} وكالات</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* 7. Action buttons */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1 text-xs">
                            {isPending ? (
                              <button
                                onClick={() => handleResend(member)}
                                className="text-[#b44800] hover:bg-[#fff0e6] p-1.5 rounded font-bold flex items-center gap-1 cursor-pointer"
                                title="إعادة إرسال الدعوة"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>إعادة</span>
                              </button>
                            ) : member.status === 'suspended' ? (
                              <button
                                onClick={() => setToggleStatusTarget(member)}
                                className="text-emerald-700 hover:bg-emerald-50 p-1.5 rounded font-bold flex items-center gap-1 cursor-pointer"
                                title="تنشيط الحساب"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>تنشيط</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => setToggleStatusTarget(member)}
                                className="text-[#b44800] hover:bg-amber-50 p-1.5 rounded font-bold flex items-center gap-1 cursor-pointer"
                                title="إيقاف الحساب مؤقتاً"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span>إيقاف</span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setEditingMember(member);
                                setEditDisplayName(member.display_name || '');
                                setEditPhone(member.phone || '');
                                setEditEmail(member.email || '');
                                setEditRoleTitle(member.roleTitle || (member as any).role_title || '');
                                setEditPassword('');
                                setIsEditOpen(true);
                              }}
                              className="text-[#718099] hover:text-[#00236f] hover:bg-[#edf3ff] p-1.5 rounded cursor-pointer"
                              title="تعديل"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          <div className="px-5 py-3 border-t border-[#edf3fc] bg-[#fafcff] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#637189]">
            <div className="flex items-center gap-3">
              <span>
                عرض {filteredMembers.length === 0 ? 0 : 1} إلى {filteredMembers.length} من أصل {totalMembersCount} سجل
              </span>
              <span className="text-[#c7d5ea]">|</span>
              <span>لكل صفحة: {Math.max(10, filteredMembers.length)}</span>
            </div>
            <div className="flex items-center gap-1 font-mono">
              <button className="w-7 h-7 rounded border border-[#d2e0f4] bg-[#00236f] text-white font-bold flex items-center justify-center">
                1
              </button>
            </div>
          </div>
        </div>

        {/* ── Bottom Analytical & Quick Action Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Box 1: استهلاك حصص الذكاء الاصطناعي */}
          <div className="bg-white border border-[#dbe6f8] rounded-xl p-4 shadow-2xs space-y-2.5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#fff4ed] text-[#b44800] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[#fd8a42]" />
                </div>
                <h3 className="text-xs font-bold text-[#141e30]">استهلاك حصص الذكاء الاصطناعي</h3>
              </div>
              <span className="font-mono text-xs font-bold text-[#141e30]">
                {currentUser?.ai_usage_count || 0} / {currentUser?.ai_quota_limit || 50} <span className="text-[10px] text-[#718099] font-sans">استعلام</span>
              </span>
            </div>

            <p className="text-[11px] text-[#556480] leading-relaxed">
              يتم توزيع الحصص الشهرية بالتساوي على المحامين لدراسة لوائح الدعاوى وتحليل المستندات.
            </p>

            <div className="space-y-1">
              <div className="w-full bg-[#edf3ff] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#00236f] h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        ((currentUser?.ai_usage_count || 0) / (currentUser?.ai_quota_limit || 50)) * 100
                      )
                    )}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-[#657591]">
                  متبقي {Math.max(0, (currentUser?.ai_quota_limit || 50) - (currentUser?.ai_usage_count || 0))} استعلام حتى نهاية الشهر
                </span>
                <button
                  onClick={() => toast({ title: 'طلب زيادة الحصة الشهرية للمكتب' })}
                  className="text-[#00236f] font-bold hover:underline cursor-pointer"
                >
                  + زيادة الحصة
                </button>
              </div>
            </div>
          </div>

          {/* Box 2: دعوة سريعة (Solid Blue Accent Card) */}
          <div className="bg-[#00236f] text-white rounded-xl p-4 shadow-sm space-y-2 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-white/80 font-bold">
                <Zap className="w-3.5 h-3.5 text-[#fd8a42]" />
                <span>دعوة سريعة</span>
              </div>
              <h3 className="text-sm font-semibold text-white">هل انضم محامٍ جديد لمكتبك؟</h3>
              <p className="text-[11px] text-white/80 leading-relaxed">
                أرسل رابط تفعيل فوري مع تحديد الصلاحيات بضغطة زر دون الحاجة لإعداد يدوي معقد.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  setFormDisplayName('');
                  setFormUsername('');
                  setFormEmail('');
                  setFormPhone('');
                  setIsAddOpen(true);
                }}
                className="w-full bg-white hover:bg-slate-100 text-[#00236f] text-xs font-bold h-9 rounded-lg cursor-pointer transition-colors"
              >
                إرسال دعوة انضمام الآن
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dialog: Add New Member ── */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#141e30]">
              إضافة محام / عضو جديد للمكتب
            </DialogTitle>
            <DialogDescription className="text-xs text-[#65738c]">
              سيتم إرسال رابط دعوة وتفعيل فوري لحساب المحامي عبر البريد والجوال.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveMember} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="font-bold text-[#44526d]">الاسم الكامل *</Label>
              <Input
                value={formDisplayName}
                onChange={(e) => setFormDisplayName(e.target.value)}
                placeholder="أحمد محمد العتيبي"
                className="h-8 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-bold text-[#44526d]">اسم المستخدم *</Label>
                <Input
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="a.alotaibi"
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="font-bold text-[#44526d]">رقم الجوال</Label>
                <Input
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="font-bold text-[#44526d]">البريد الإلكتروني المهني *</Label>
              <Input
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="ahmed.alotaibi@court.gov.sa"
                className="h-8 text-xs font-mono"
                type="email"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-bold text-[#44526d]">الدور الوظيفي</Label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as any)}
                  className="w-full h-8 text-xs bg-[#f8faff] border border-[#dce7f6] rounded-md px-2 text-[#33425b] focus:outline-none cursor-pointer"
                >
                  <option value="lawyer">محامٍ ممارس</option>
                  <option value="consultant">مستشار قانوني</option>
                  <option value="assistant">مساعد إداري</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="font-bold text-[#44526d]">المسمى / التخصص</Label>
                <Input
                  value={formRoleTitle}
                  onChange={(e) => setFormRoleTitle(e.target.value)}
                  placeholder="قضايا الشركات / عمالي"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-start pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#00236f] hover:bg-[#001c59] text-white text-xs"
              >
                {isSubmitting ? 'جارٍ الإرسال...' : 'إرسال دعوة الانضمام'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} className="text-xs">
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Edit Member ── */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) setEditingMember(null);
        }}
      >
        <DialogContent className="max-w-md text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#141e30]">
              تعديل بيانات العضو: {editingMember?.display_name || editingMember?.username}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#65738c]">
              اسم المستخدم: {editingMember?.username} (معرف الحساب غير قابل للتغيير)
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateMember} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="font-bold text-[#44526d]">الاسم الكامل *</Label>
              <Input
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="أحمد محمد العتيبي"
                className="h-8 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-bold text-[#44526d]">رقم الجوال</Label>
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="h-8 text-xs font-mono"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <Label className="font-bold text-[#44526d]">المسمى / التخصص</Label>
                <Input
                  value={editRoleTitle}
                  onChange={(e) => setEditRoleTitle(e.target.value)}
                  placeholder="محامٍ ممارس • قضايا الشركات"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="font-bold text-[#44526d]">البريد الإلكتروني المهني *</Label>
              <Input
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="ahmed.alotaibi@court.gov.sa"
                className="h-8 text-xs font-mono"
                type="email"
                required
                dir="ltr"
              />
            </div>

            <div className="space-y-1 pt-1 border-t border-[#e8edf7]">
              <Label className="font-bold text-[#65738c]">
                تعيين كلمة مرور جديدة (اتركه فارغاً للإبقاء على الحالية)
              </Label>
              <Input
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="اتركه فارغاً ما لم ترغب في التغيير"
                type="password"
                className="h-8 text-xs font-mono"
                dir="ltr"
              />
            </div>

            <DialogFooter className="gap-2 sm:justify-start pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#00236f] hover:bg-[#001c59] text-white text-xs font-bold"
              >
                {isSubmitting ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false);
                  setEditingMember(null);
                }}
                className="text-xs"
              >
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Activity Log ── */}
      <Dialog open={isActivityLogOpen} onOpenChange={setIsActivityLogOpen}>
        <DialogContent className="max-w-lg text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#141e30] flex items-center gap-2">
              <History className="w-4 h-4 text-[#00236f]" />
              سجل نشاط أعضاء المكتب
            </DialogTitle>
            <DialogDescription className="text-xs text-[#65738c]">
              سجل عمليات تسجيل الدخول والترافع وإيداع المذكرات خلال آخر 30 يوماً.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 text-xs max-h-[350px] overflow-y-auto">
            {isLoadingLogs ? (
              <div className="py-8 text-center text-xs text-[#657591]">جاري تحميل سجل النشاط...</div>
            ) : activityLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#657591] bg-[#fafcff] rounded-lg border border-[#e2ecfa]">
                لا توجد أنشطة مسجلة مؤخراً في المكتب.
              </div>
            ) : (
              activityLogs.map((log) => (
                <div key={log.id} className="p-2.5 bg-[#fafcff] rounded-lg border border-[#e2ecfa] flex items-center justify-between">
                  <div>
                    <strong className="text-[#141e30]">{log.actorName}</strong>
                    <p className="text-[11px] text-[#657591]">{log.details}</p>
                  </div>
                  <span className="text-[10px] text-[#718099] font-mono">
                    {new Date(log.createdAt).toLocaleDateString('ar-SA')} • {new Date(log.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-start">
            <Button variant="outline" onClick={() => setIsActivityLogOpen(false)} className="text-xs">
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog: Toggle Status (Suspend / Active) ── */}
      <AlertDialog open={!!toggleStatusTarget} onOpenChange={() => setToggleStatusTarget(null)}>
        <AlertDialogContent className="text-right" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold text-[#141e30]">
              {toggleStatusTarget?.status === 'suspended' ? 'تأكيد تنشيط حساب العضو' : 'تأكيد إيقاف حساب العضو مؤقتاً'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#65738c]">
              {toggleStatusTarget?.status === 'suspended'
                ? `هل أنت متأكد من رغبتك في إعادة تنشيط حساب (${toggleStatusTarget?.display_name || toggleStatusTarget?.username})؟ سيتمكن من تسجيل الدخول للنظام فوراً.`
                : `هل أنت متأكد من رغبتك في إيقاف حساب (${toggleStatusTarget?.display_name || toggleStatusTarget?.username})؟ لن يتمكن من تسجيل الدخول للنظام لحين إعادة تفعيله.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogAction
              onClick={handleToggleStatus}
              className={toggleStatusTarget?.status === 'suspended'
                ? "bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                : "bg-amber-600 hover:bg-amber-700 text-white text-xs"
              }
            >
              {toggleStatusTarget?.status === 'suspended' ? 'تأكيد التنشيط' : 'تأكيد الإيقاف'}
            </AlertDialogAction>
            <AlertDialogCancel className="text-xs">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
