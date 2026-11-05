import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Building2,
  Users,
  UserPlus,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Edit2,
  LogOut,
  Calendar,
  Zap,
  Crown,
  CreditCard,
  AlertTriangle,
  Link2,
  Clock,
  Sparkles,
  Layers,
  Plus,
  FileSpreadsheet,
  MessageSquare,
  Bot,
  BarChart3,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useGetCurrentUser, useLogout } from '@workspace/api-client-react';
import { validatePassword, PASSWORD_POLICY } from '@workspace/api-zod';
import { useQueryClient } from '@tanstack/react-query';

export interface SubscriptionPlanFeatures {
  google_sheets_export?: boolean;
  whatsapp_reminders?: boolean;
  max_members?: number;
  custom_branding?: boolean;
  ai_assistant?: boolean;
  court_session_analytics?: boolean;
  [key: string]: any;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  ai_quota_limit: number;
  price?: string;
  features: SubscriptionPlanFeatures;
  office_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface OfficeAdmin {
  id: string;
  username: string;
  email?: string | null;
  role: 'admin';
  office_name?: string | null;
  display_name?: string | null;
  status?: 'active' | 'suspended';
  phone?: string | null;
  subscription_end_date?: string | null;
  subscription_notes?: string | null;
  plan_tier?: 'plus' | 'pro' | string;
  plan_id?: string | null;
  ai_quota_limit_override?: number | null;
  plan?: SubscriptionPlan | null;
  billing_cycle?: 'monthly' | 'annual';
  ai_quota_limit?: number;
  ai_usage_count?: number;
  member_count?: number;
  has_google_service?: boolean;
  google_spreadsheet_id?: string | null;
  created_at?: string;
}

export interface UnlinkedMember {
  id: string;
  username: string;
  display_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role: 'staff';
  status?: 'active' | 'suspended';
  created_at?: string;
}

export function getSubscriptionInfo(admin: OfficeAdmin) {
  const isSuspended = admin.status === 'suspended';
  if (isSuspended) {
    return {
      statusText: 'موقوف مؤقتاً',
      badgeColor: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
      daysLeft: null,
      isExpiringSoon: false,
      isExpired: false,
      isSuspended: true,
    };
  }

  if (!admin.subscription_end_date) {
    return {
      statusText: 'اشتراك دائم / غير محدد',
      badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      daysLeft: null,
      isExpiringSoon: false,
      isExpired: false,
      isSuspended: false,
    };
  }

  const end = new Date(admin.subscription_end_date);
  const now = new Date();
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffTime = endDay - nowDay;
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return {
      statusText: 'منتهي الصلاحية ❌',
      badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      daysLeft,
      isExpiringSoon: false,
      isExpired: true,
      isSuspended: false,
    };
  }

  if (daysLeft <= 7) {
    return {
      statusText: daysLeft === 0 ? 'ينتهي اليوم ⚠️' : `ينتهي خلال ${daysLeft} ${daysLeft === 1 ? 'يوم' : 'أيام'} ⚠️`,
      badgeColor: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40 font-bold',
      daysLeft,
      isExpiringSoon: true,
      isExpired: false,
      isSuspended: false,
    };
  }

  return {
    statusText: `نشط (متبقي ${daysLeft} يوماً)`,
    badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    daysLeft,
    isExpiringSoon: false,
    isExpired: false,
    isSuspended: false,
  };
}

export function normalizeDateForInput(val?: string | null): string {
  if (!val) return '';
  const str = String(val).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return '';
}

export function formatDateDisplay(val?: string | null): string {
  if (!val || !val.trim()) return '—';
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  } catch {}
  return String(val).split('T')[0];
}

export default function SuperAdminPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: currentUser } = useGetCurrentUser();
  const logoutMutation = useLogout();

  const [activeTab, setActiveTab] = useState<'admins' | 'plans' | 'unlinked'>('admins');
  const [admins, setAdmins] = useState<OfficeAdmin[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [unlinkedMembers, setUnlinkedMembers] = useState<UnlinkedMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'expiring'>('all');

  // Modals for Office Admins
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<OfficeAdmin | null>(null);

  // Modals for Plans
  const [isAddPlanModalOpen, setIsAddPlanModalOpen] = useState(false);
  const [isEditPlanModalOpen, setIsEditPlanModalOpen] = useState(false);
  const [selectedPlanForEdit, setSelectedPlanForEdit] = useState<SubscriptionPlan | null>(null);

  // Office Form state
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    office_name: '',
    display_name: '',
    email: '',
    phone: '',
    plan_id: '',
    plan_tier: 'plus' as 'plus' | 'pro' | string,
    billing_cycle: 'annual' as 'monthly' | 'annual',
    subscription_end_date: '',
    subscription_notes: '',
    isCustomQuota: false,
    ai_quota_limit_override: '' as string | number,
    ai_quota_limit: 100,
  });

  // Plan Form state
  const [planFormData, setPlanFormData] = useState({
    name: '',
    slug: '',
    ai_quota_limit: 100,
    price: '',
    features: {
      google_sheets_export: true,
      whatsapp_reminders: false,
      max_members: 10,
      custom_branding: false,
      ai_assistant: true,
      court_session_analytics: false,
    } as SubscriptionPlanFeatures,
  });

  // Linking state
  const [linkingState, setLinkingState] = useState<{ [memberId: string]: string }>({});

  const fetchPlans = async () => {
    setIsLoadingPlans(true);
    try {
      const res = await fetch('/api/super-admin/plans');
      if (res.ok) {
        const data = await res.json();
        if (data.plans) {
          setPlans(data.plans);
        }
      }
    } catch {}
    finally {
      setIsLoadingPlans(false);
    }
  };

  const fetchAdmins = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/super-admin/admins');
      if (res.status === 401 || res.status === 403) {
        navigate('/admin/login');
        return;
      }
      const data = await res.json();
      if (data.admins) {
        setAdmins(data.admins);
      }
    } catch {
      toast({
        title: 'خطأ',
        description: 'فشل جلب بيانات المكاتب والاشتراكات.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnlinked = async () => {
    try {
      const res = await fetch('/api/super-admin/unlinked-members');
      const data = await res.json();
      if (data.unlinked) {
        setUnlinkedMembers(data.unlinked);
      }
    } catch {}
  };

  useEffect(() => {
    fetchAdmins();
    fetchPlans();
    fetchUnlinked();
  }, []);

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      queryClient.clear();
      navigate('/admin/login');
    } catch {
      navigate('/admin/login');
    }
  };

  const handlePlanChange = (selectedPlanId: string) => {
    const selected = plans.find((p) => p.id === selectedPlanId);
    setFormData((prev) => ({
      ...prev,
      plan_id: selectedPlanId,
      plan_tier: selected?.slug || 'plus',
      ai_quota_limit: prev.isCustomQuota && prev.ai_quota_limit_override !== ''
        ? Number(prev.ai_quota_limit_override)
        : (selected?.ai_quota_limit ?? 100),
    }));
  };

  const handleCustomQuotaToggle = (checked: boolean) => {
    const selected = plans.find((p) => p.id === formData.plan_id) || plans[0];
    setFormData((prev) => ({
      ...prev,
      isCustomQuota: checked,
      ai_quota_limit_override: checked ? (prev.ai_quota_limit_override || (selected?.ai_quota_limit ?? 100)) : '',
      ai_quota_limit: checked && prev.ai_quota_limit_override !== ''
        ? Number(prev.ai_quota_limit_override)
        : (selected?.ai_quota_limit ?? 100),
    }));
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password.trim() || !formData.office_name.trim()) {
      toast({
        title: 'تنبيه',
        description: 'اسم المكتب، اسم المستخدم وكلمة المرور مطلوبة.',
        variant: 'destructive',
      });
      return;
    }

    const val = validatePassword(formData.password, { username: formData.username, email: formData.email });
    if (!val.isValid) {
      toast({
        title: 'كلمة مرور ضعيفة',
        description: val.message,
        variant: 'destructive',
      });
      return;
    }

    try {
      const selectedPlan = plans.find((p) => p.id === formData.plan_id);
      const payload: any = {
        username: formData.username.trim(),
        password: formData.password.trim(),
        office_name: formData.office_name.trim(),
        display_name: formData.display_name.trim() || formData.office_name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        plan_id: formData.plan_id || undefined,
        plan_tier: selectedPlan?.slug || formData.plan_tier || 'plus',
        billing_cycle: formData.billing_cycle,
        subscription_end_date: formData.subscription_end_date,
        subscription_notes: formData.subscription_notes.trim() || undefined,
        ai_quota_limit_override: formData.isCustomQuota && formData.ai_quota_limit_override !== ''
          ? Number(formData.ai_quota_limit_override)
          : null,
      };

      const res = await fetch('/api/super-admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل إنشاء المكتب.');
      }

      toast({
        title: 'تم بنجاح',
        description: `تم إنشاء حساب المكتب "${formData.office_name}" بنجاح!`,
      });
      setIsAddModalOpen(false);
      resetForm();
      fetchAdmins();
      fetchPlans();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmin) return;

    if (formData.password.trim()) {
      const val = validatePassword(formData.password, { username: selectedAdmin.username, email: formData.email });
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
      const selectedPlan = plans.find((p) => p.id === formData.plan_id);
      const payload: any = {
        office_name: formData.office_name,
        display_name: formData.display_name,
        email: formData.email,
        phone: formData.phone,
        plan_id: formData.plan_id || undefined,
        plan_tier: selectedPlan?.slug || formData.plan_tier || 'plus',
        billing_cycle: formData.billing_cycle,
        subscription_end_date: formData.subscription_end_date || null,
        subscription_notes: formData.subscription_notes,
        ai_quota_limit_override: formData.isCustomQuota && formData.ai_quota_limit_override !== ''
          ? Number(formData.ai_quota_limit_override)
          : null,
      };
      if (formData.password.trim()) {
        payload.password = formData.password.trim();
      }

      const res = await fetch(`/api/super-admin/admins/${selectedAdmin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تعديل بيانات المكتب.');
      }

      toast({
        title: 'تم بنجاح',
        description: 'تم تحديث بيانات واشتراك المكتب بنجاح!',
      });
      setIsEditModalOpen(false);
      fetchAdmins();
      fetchPlans();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Plan CRUD Handlers
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planFormData.name.trim() || !planFormData.slug.trim()) {
      toast({
        title: 'تنبيه',
        description: 'اسم الباقة ومعرّف الباقة (slug) مطلوبان.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await fetch('/api/super-admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: planFormData.name.trim(),
          slug: planFormData.slug.trim().toLowerCase(),
          ai_quota_limit: Number(planFormData.ai_quota_limit) || 100,
          price: planFormData.price.trim(),
          features: planFormData.features,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل إنشاء الباقة.');
      }

      toast({
        title: 'تم بنجاح',
        description: `تم إنشاء باقة "${planFormData.name}" بنجاح!`,
      });
      setIsAddPlanModalOpen(false);
      resetPlanForm();
      fetchPlans();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleUpdatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanForEdit) return;

    try {
      const res = await fetch(`/api/super-admin/plans/${selectedPlanForEdit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: planFormData.name.trim(),
          ai_quota_limit: Number(planFormData.ai_quota_limit) || 100,
          price: planFormData.price.trim(),
          features: planFormData.features,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تحديث الباقة.');
      }

      toast({
        title: 'تم بنجاح',
        description: `تم تحديث بيانات باقة "${planFormData.name}" بنجاح!`,
      });
      setIsEditPlanModalOpen(false);
      fetchPlans();
      fetchAdmins();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeletePlan = async (plan: SubscriptionPlan) => {
    if (plan.office_count && plan.office_count > 0) {
      toast({
        title: 'لا يمكن حذف الباقة',
        description: `لا يمكن حذف باقة "${plan.name}" لوجود ${plan.office_count} مكتب مشترك بها حالياً.`,
        variant: 'destructive',
      });
      return;
    }

    if (!window.confirm(`هل أنت متأكد من حذف باقة "${plan.name}"؟`)) {
      return;
    }

    try {
      const res = await fetch(`/api/super-admin/plans/${plan.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل حذف الباقة.');
      }

      toast({
        title: 'تم الحذف',
        description: `تم حذف باقة "${plan.name}" بنجاح.`,
      });
      fetchPlans();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const openEditPlanModal = (plan: SubscriptionPlan) => {
    setSelectedPlanForEdit(plan);
    setPlanFormData({
      name: plan.name,
      slug: plan.slug,
      ai_quota_limit: plan.ai_quota_limit,
      price: plan.price || '',
      features: {
        google_sheets_export: plan.features?.google_sheets_export ?? true,
        whatsapp_reminders: plan.features?.whatsapp_reminders ?? false,
        max_members: plan.features?.max_members ?? 10,
        custom_branding: plan.features?.custom_branding ?? false,
        ai_assistant: plan.features?.ai_assistant ?? true,
        court_session_analytics: plan.features?.court_session_analytics ?? false,
      },
    });
    setIsEditPlanModalOpen(true);
  };

  const resetPlanForm = () => {
    setPlanFormData({
      name: '',
      slug: '',
      ai_quota_limit: 100,
      price: '',
      features: {
        google_sheets_export: true,
        whatsapp_reminders: false,
        max_members: 10,
        custom_branding: false,
        ai_assistant: true,
        court_session_analytics: false,
      },
    });
  };

  const handleQuickExtend = async (adminId: string, period: '1m' | '1y') => {
    try {
      const res = await fetch(`/api/super-admin/admins/${adminId}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      });
      if (!res.ok) throw new Error('فشل تمديد الاشتراك');
      toast({
        title: 'تم التمديد',
        description: `تم تمديد الاشتراك بنجاح (+${period === '1m' ? 'شهر' : 'سنة'}).`,
      });
      fetchAdmins();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleToggleStatus = async (admin: OfficeAdmin) => {
    const nextStatus = admin.status === 'suspended' ? 'active' : 'suspended';
    const actionName = nextStatus === 'suspended' ? 'إيقاف' : 'تفعيل';
    if (!window.confirm(`هل أنت متأكد من ${actionName} اشتراك مكتب "${admin.office_name || admin.display_name}"؟ سيتم ${nextStatus === 'suspended' ? 'تعليق دخول جميع أعضائه' : 'إتاحة الدخول مجدداً'}.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/super-admin/admins/${admin.id}/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('فشل تغيير الحالة.');
      toast({
        title: 'تم بنجاح',
        description: `تم ${actionName} اشتراك المكتب بنجاح.`,
      });
      fetchAdmins();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleResetAi = async (adminId: string) => {
    try {
      const res = await fetch(`/api/super-admin/admins/${adminId}/reset-ai-usage`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('فشل تصفير الاستهلاك.');
      toast({
        title: 'تم التصفير',
        description: 'تم إعادة عداد استهلاك الذكاء الاصطناعي للمكتب إلى 0.',
      });
      fetchAdmins();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAdmin = async (admin: OfficeAdmin) => {
    if (!window.confirm(`تحذير نهائي: هل أنت متأكد من حذف حساب مكتب "${admin.office_name}"؟ سيتم إلغاء ارتباط جميع أعضاء هذا المكتب.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/super-admin/admins/${admin.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('فشل حذف المكتب.');
      toast({
        title: 'تم الحذف',
        description: 'تم حذف حساب المكتب بنجاح.',
      });
      fetchAdmins();
      fetchUnlinked();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleLinkMember = async (memberId: string) => {
    const adminId = linkingState[memberId];
    if (!adminId) {
      toast({
        title: 'تنبيه',
        description: 'يرجى اختيار مدير المكتب المراد الربط به أولاً.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await fetch('/api/super-admin/link-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, adminId }),
      });
      if (!res.ok) throw new Error('فشل ربط العضو.');
      toast({
        title: 'تم الربط بنجاح',
        description: 'تم ربط العضو بالمكتب بنجاح.',
      });
      fetchUnlinked();
      fetchAdmins();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const openEditModal = (admin: OfficeAdmin) => {
    setSelectedAdmin(admin);
    const matchedPlan = plans.find((p) => p.id === admin.plan_id || p.slug === admin.plan_tier) || plans[0];
    const hasOverride = admin.ai_quota_limit_override !== null && admin.ai_quota_limit_override !== undefined;

    setFormData({
      username: admin.username,
      password: '',
      office_name: admin.office_name || '',
      display_name: admin.display_name || '',
      email: admin.email || '',
      phone: admin.phone || '',
      plan_id: admin.plan_id || matchedPlan?.id || '',
      plan_tier: admin.plan_tier || matchedPlan?.slug || 'plus',
      billing_cycle: admin.billing_cycle || 'annual',
      subscription_end_date: normalizeDateForInput(admin.subscription_end_date),
      subscription_notes: admin.subscription_notes || '',
      isCustomQuota: hasOverride,
      ai_quota_limit_override: hasOverride ? Number(admin.ai_quota_limit_override) : '',
      ai_quota_limit: admin.ai_quota_limit ?? (matchedPlan?.ai_quota_limit ?? 100),
    });
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const defaultPlan = plans.find((p) => p.slug === 'plus') || plans[0];

    setFormData({
      username: '',
      password: '',
      office_name: '',
      display_name: '',
      email: '',
      phone: '',
      plan_id: defaultPlan?.id || 'plan-plus',
      plan_tier: defaultPlan?.slug || 'plus',
      billing_cycle: 'annual',
      subscription_end_date: nextYear.toISOString().split('T')[0],
      subscription_notes: '',
      isCustomQuota: false,
      ai_quota_limit_override: '',
      ai_quota_limit: defaultPlan?.ai_quota_limit ?? 100,
    });
  };

  const filteredAdmins = admins.filter((a) => {
    const matchSearch =
      (a.office_name && a.office_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (a.display_name && a.display_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      a.username.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchSearch) return false;

    const sub = getSubscriptionInfo(a);
    if (statusFilter === 'active') return a.status !== 'suspended' && !sub.isExpired;
    if (statusFilter === 'suspended') return a.status === 'suspended';
    if (statusFilter === 'expiring') return sub.isExpiringSoon || sub.isExpired;
    return true;
  });

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8 font-sans" dir="rtl">
      {/* Top Banner Header */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                  بوابة إدارة المنظومة (Super Admin)
                </h1>
                <Badge className="bg-amber-600 text-white text-[10px] px-2">إشراف المنصة</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                إدارة مكاتب المحاماة، باقات الاشتراك، حصص الذكاء الاصطناعي، والربط المركزي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-4 h-4" />
              تسجيل الخروج
            </Button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">إجمالي المكاتب المشتركة</p>
              <p className="text-xl font-black text-foreground">{admins.length}</p>
            </div>
          </div>

          <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">الاشتراكات النشطة</p>
              <p className="text-xl font-black text-emerald-600">
                {admins.filter((a) => a.status !== 'suspended' && !getSubscriptionInfo(a).isExpired).length}
              </p>
            </div>
          </div>

          <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">باقات الاشتراك المتاحة</p>
              <p className="text-xl font-black text-amber-600">{plans.length}</p>
            </div>
          </div>

          <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">أعضاء غير مرتبطين بمكتب</p>
              <p className="text-xl font-black text-rose-600">{unlinkedMembers.length}</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-border pb-2 flex-wrap">
          <button
            onClick={() => setActiveTab('admins')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${
              activeTab === 'admins'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>مكاتب المحاماة والاشتراكات ({admins.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('plans')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${
              activeTab === 'plans'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>باقات الاشتراك وميزاتها ({plans.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('unlinked')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${
              activeTab === 'unlinked'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>الأعضاء غير المرتبطين ({unlinkedMembers.length})</span>
          </button>
        </div>

        {/* Tab 1: Office Admins */}
        {activeTab === 'admins' && (
          <div className="space-y-4">
            {/* Filters & Actions Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border p-3.5 rounded-xl">
              <div className="flex flex-1 items-center gap-2 min-w-0">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="بحث باسم المكتب أو المشرف..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pr-9 text-xs h-9"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto text-xs">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                      statusFilter === 'all' ? 'bg-muted text-foreground font-bold' : 'text-muted-foreground'
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    onClick={() => setStatusFilter('active')}
                    className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                      statusFilter === 'active' ? 'bg-emerald-500/15 text-emerald-600 font-bold' : 'text-muted-foreground'
                    }`}
                  >
                    نشط
                  </button>
                  <button
                    onClick={() => setStatusFilter('suspended')}
                    className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                      statusFilter === 'suspended' ? 'bg-red-500/15 text-red-600 font-bold' : 'text-muted-foreground'
                    }`}
                  >
                    موقوف
                  </button>
                  <button
                    onClick={() => setStatusFilter('expiring')}
                    className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                      statusFilter === 'expiring' ? 'bg-amber-500/15 text-amber-600 font-bold' : 'text-muted-foreground'
                    }`}
                  >
                    قاربت على الانتهاء
                  </button>
                </div>
              </div>

              <Button
                onClick={() => {
                  resetForm();
                  setIsAddModalOpen(true);
                }}
                className="gap-2 text-xs font-bold shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                إضافة مكتب جديد
              </Button>
            </div>

            {/* Admins Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-muted/50 border-b border-border font-bold text-muted-foreground">
                    <tr>
                      <th className="p-3.5">المكتب / المدير</th>
                      <th className="p-3.5">بيانات الدخول</th>
                      <th className="p-3.5">باقة الاشتراك</th>
                      <th className="p-3.5">حالة الاشتراك والصلاحية</th>
                      <th className="p-3.5">استهلاك الـ AI</th>
                      <th className="p-3.5">الأعضاء</th>
                      <th className="p-3.5 text-center">إجراءات سريعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-medium">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="text-center p-8 text-muted-foreground">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
                          جارٍ تحميل قائمة المكاتب...
                        </td>
                      </tr>
                    ) : filteredAdmins.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center p-8 text-muted-foreground">
                          لا توجد مكاتب تطابق الفلتر المحدد.
                        </td>
                      </tr>
                    ) : (
                      filteredAdmins.map((admin) => {
                        const sub = getSubscriptionInfo(admin);
                        const quotaLimit = admin.ai_quota_limit ?? 100;
                        const usage = admin.ai_usage_count || 0;
                        const usagePercent = quotaLimit === -1 ? 0 : Math.min(100, Math.round((usage / quotaLimit) * 100));

                        return (
                          <tr key={admin.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3.5">
                              <div className="font-bold text-sm text-foreground">
                                {admin.office_name || 'مكتب غير مسمى'}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {admin.display_name || admin.username}
                              </div>
                            </td>

                            <td className="p-3.5">
                              <span className="font-mono bg-muted px-2 py-0.5 rounded font-bold">
                                {admin.username}
                              </span>
                              {admin.email && (
                                <div className="text-[11px] text-muted-foreground mt-1 truncate max-w-[140px]">
                                  {admin.email}
                                </div>
                              )}
                            </td>

                            <td className="p-3.5">
                              <div className="flex flex-col gap-1 items-start">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge
                                    className={
                                      (admin.plan?.slug || admin.plan_tier) === 'pro'
                                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                        : (admin.plan?.slug || admin.plan_tier) === 'basic'
                                        ? 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30'
                                        : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30'
                                    }
                                  >
                                    {admin.plan?.name || (admin.plan_tier === 'pro' ? 'احترافية (Pro)' : admin.plan_tier === 'basic' ? 'الأساسية' : 'بلس (Plus)')}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground font-semibold">
                                    {admin.billing_cycle === 'monthly' ? 'شهري' : 'سنوي'}
                                  </span>
                                </div>
                                {admin.ai_quota_limit_override !== null && admin.ai_quota_limit_override !== undefined && (
                                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-mono">
                                    حصة مخصصة: {admin.ai_quota_limit_override}
                                  </Badge>
                                )}
                              </div>
                            </td>

                            <td className="p-3.5">
                              <div className="space-y-1">
                                <Badge className={`border text-[11px] ${sub.badgeColor}`}>
                                  {sub.statusText}
                                </Badge>
                                <div className="text-[11px] text-muted-foreground">
                                  ينتهي: {formatDateDisplay(admin.subscription_end_date)}
                                </div>
                              </div>
                            </td>

                            <td className="p-3.5">
                              <div className="w-28 space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                  <span>{usage} مستهلك</span>
                                  <span>{quotaLimit === -1 ? 'مفتوح' : `${quotaLimit}`}</span>
                                </div>
                                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      usagePercent > 90 ? 'bg-destructive' : 'bg-primary'
                                    }`}
                                    style={{ width: `${quotaLimit === -1 ? 15 : usagePercent}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            <td className="p-3.5">
                              <Badge variant="outline" className="gap-1 font-bold">
                                <Users className="w-3 h-3 text-muted-foreground" />
                                {admin.member_count || 0}
                              </Badge>
                            </td>

                            <td className="p-3.5">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Quick Extend Buttons */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  title="تمديد شهر إضافي"
                                  onClick={() => handleQuickExtend(admin.id, '1m')}
                                  className="h-7 px-2 text-[10px] gap-1"
                                >
                                  +شهر
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  title="تمديد سنة إضافية"
                                  onClick={() => handleQuickExtend(admin.id, '1y')}
                                  className="h-7 px-2 text-[10px] gap-1 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                                >
                                  +سنة
                                </Button>

                                {/* Reset AI Usage */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="تصفير استهلاك الذكاء الاصطناعي"
                                  onClick={() => handleResetAi(admin.id)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                >
                                  <Zap className="w-3.5 h-3.5" />
                                </Button>

                                {/* Toggle Active/Suspended */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title={admin.status === 'suspended' ? 'إعادة التفعيل' : 'إيقاف مؤقت'}
                                  onClick={() => handleToggleStatus(admin)}
                                  className={`h-7 w-7 p-0 ${
                                    admin.status === 'suspended'
                                      ? 'text-emerald-600 hover:text-emerald-700'
                                      : 'text-amber-600 hover:text-amber-700'
                                  }`}
                                >
                                  {admin.status === 'suspended' ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                  ) : (
                                    <AlertTriangle className="w-4 h-4" />
                                  )}
                                </Button>

                                {/* Edit Admin */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="تعديل بيانات واشتراك المكتب"
                                  onClick={() => openEditModal(admin)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>

                                {/* Delete Admin */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="حذف المكتب"
                                  onClick={() => handleDeleteAdmin(admin)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Subscription Plans */}
        {activeTab === 'plans' && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border p-3.5 rounded-xl shadow-sm">
              <div>
                <h2 className="text-sm font-bold text-foreground">باقات الاشتراك وميزات المنظومة</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  التحكم في الباقات المتاحة لمكاتب المحاماة، حصص التحليل الافتراضية، وتفعيل ميزات كل باقة
                </p>
              </div>
              <Button
                onClick={() => {
                  resetPlanForm();
                  setIsAddPlanModalOpen(true);
                }}
                className="gap-2 text-xs font-bold shrink-0"
              >
                <Plus className="w-4 h-4" />
                إضافة باقة جديدة
              </Button>
            </div>

            {/* Plans Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-muted/50 border-b border-border font-bold text-muted-foreground">
                    <tr>
                      <th className="p-3.5">اسم الباقة والمعرّف</th>
                      <th className="p-3.5">سعر العرض</th>
                      <th className="p-3.5">حصة الـ AI الافتراضية</th>
                      <th className="p-3.5">الميزات المشمولة</th>
                      <th className="p-3.5 text-center">المكاتب المشتركة</th>
                      <th className="p-3.5 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-medium">
                    {isLoadingPlans ? (
                      <tr>
                        <td colSpan={6} className="text-center p-8 text-muted-foreground">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
                          جارٍ تحميل قائمة الباقات...
                        </td>
                      </tr>
                    ) : plans.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center p-8 text-muted-foreground">
                          لا توجد باقات اشتراك مضافة حتى الآن.
                        </td>
                      </tr>
                    ) : (
                      plans.map((plan) => {
                        const officeCount = plan.office_count ?? 0;
                        const isInUse = officeCount > 0;
                        return (
                          <tr key={plan.id} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3.5">
                              <div className="font-bold text-sm text-foreground">{plan.name}</div>
                              <div className="font-mono text-[11px] text-muted-foreground mt-0.5 bg-muted px-1.5 py-0.5 rounded inline-block">
                                slug: {plan.slug}
                              </div>
                            </td>

                            <td className="p-3.5">
                              <span className="font-bold text-foreground">{plan.price || '—'}</span>
                            </td>

                            <td className="p-3.5">
                              <div className="flex items-center gap-1.5 font-mono">
                                <Zap className="w-3.5 h-3.5 text-amber-600" />
                                <span className="font-bold text-foreground">{plan.ai_quota_limit}</span>
                                <span className="text-muted-foreground text-[11px]">تحليل / شهر</span>
                              </div>
                            </td>

                            <td className="p-3.5">
                              <div className="flex flex-wrap gap-1 max-w-md">
                                {plan.features?.google_sheets_export && (
                                  <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                                    <FileSpreadsheet className="w-2.5 h-2.5" /> Google Sheets
                                  </Badge>
                                )}
                                {plan.features?.whatsapp_reminders && (
                                  <Badge variant="outline" className="text-[10px] gap-1 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                                    <MessageSquare className="w-2.5 h-2.5" /> تذكيرات واتساب
                                  </Badge>
                                )}
                                {plan.features?.ai_assistant && (
                                  <Badge variant="outline" className="text-[10px] gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                                    <Bot className="w-2.5 h-2.5" /> مساعد ذكي
                                  </Badge>
                                )}
                                {plan.features?.court_session_analytics && (
                                  <Badge variant="outline" className="text-[10px] gap-1 bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30">
                                    <BarChart3 className="w-2.5 h-2.5" /> إحصائيات الجلسات
                                  </Badge>
                                )}
                                {plan.features?.custom_branding && (
                                  <Badge variant="outline" className="text-[10px] gap-1 bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30">
                                    <Sparkles className="w-2.5 h-2.5" /> تخصيص الهوية
                                  </Badge>
                                )}
                                {plan.features?.max_members !== undefined && (
                                  <Badge variant="outline" className="text-[10px] gap-1 bg-muted text-muted-foreground border-border">
                                    <Users className="w-2.5 h-2.5" /> حتى {plan.features.max_members} محامين
                                  </Badge>
                                )}
                              </div>
                            </td>

                            <td className="p-3.5 text-center">
                              <Badge variant="outline" className="font-bold gap-1">
                                <Building2 className="w-3 h-3 text-muted-foreground" />
                                {officeCount} {officeCount === 1 ? 'مكتب' : 'مكاتب'}
                              </Badge>
                            </td>

                            <td className="p-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="تعديل الباقة"
                                  onClick={() => openEditPlanModal(plan)}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>

                                <div className="relative group inline-block">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={isInUse}
                                    onClick={() => handleDeletePlan(plan)}
                                    className={`h-7 w-7 p-0 ${
                                      isInUse
                                        ? 'opacity-40 cursor-not-allowed text-muted-foreground'
                                        : 'text-muted-foreground hover:text-destructive'
                                    }`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                  {isInUse && (
                                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 w-44 p-1.5 bg-popover border border-border text-[10px] text-popover-foreground text-center rounded shadow-md pointer-events-none">
                                      لا يمكن حذف الباقة لأن هناك {officeCount} مكتب مشترك بها حالياً.
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Unlinked Members */}
        {activeTab === 'unlinked' && (
          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-xl flex items-start gap-3 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold mb-1">الأعضاء غير المرتبطين بمكتب محاماة</p>
                <p>
                  المحامون المسجلون هنا تم فصلهم عن إدارة المنصة المستقلة ولا ينتمون لأي مكتب بعد. لن يتمكن هؤلاء الأعضاء من استعراض أي جلسات أو قضايا حتى يتم ربطهم بمدير مكتب معتمد لديه اشتراك فعّال.
                </p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-muted/50 border-b border-border font-bold text-muted-foreground">
                    <tr>
                      <th className="p-3.5">اسم العضو / المحامي</th>
                      <th className="p-3.5">اسم المستخدم</th>
                      <th className="p-3.5">الهاتف والبريد</th>
                      <th className="p-3.5">تاريخ التسجيل</th>
                      <th className="p-3.5">تعيين إلى مكتب محاماة</th>
                      <th className="p-3.5 text-center">إجراء الربط</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-medium">
                    {unlinkedMembers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center p-8 text-muted-foreground">
                          رائع! لا يوجد أي أعضاء غير مرتبطين بمكاتب حالياً.
                        </td>
                      </tr>
                    ) : (
                      unlinkedMembers.map((member) => (
                        <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3.5 font-bold text-foreground">
                            {member.display_name || member.username}
                          </td>

                          <td className="p-3.5 font-mono bg-muted px-2 py-0.5 rounded">
                            {member.username}
                          </td>

                          <td className="p-3.5 text-muted-foreground">
                            {member.phone || member.email || '—'}
                          </td>

                          <td className="p-3.5 text-muted-foreground">
                            {formatDateDisplay(member.created_at)}
                          </td>

                          <td className="p-3.5">
                            <select
                              value={linkingState[member.id] || ''}
                              onChange={(e) =>
                                setLinkingState({ ...linkingState, [member.id]: e.target.value })
                              }
                              className="w-full max-w-xs text-xs border border-border rounded-lg bg-background p-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="">-- اختر مكتب المحاماة --</option>
                              {admins.map((adm) => (
                                <option key={adm.id} value={adm.id}>
                                  {adm.office_name || adm.display_name} ({adm.username})
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="p-3.5 text-center">
                            <Button
                              size="sm"
                              onClick={() => handleLinkMember(member.id)}
                              className="text-xs gap-1.5 font-bold h-8"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                              ربط بالمكتب
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Office Admin Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">إضافة مكتب محاماة واشتراك جديد</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-4 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">اسم مكتب المحاماة *</Label>
                <Input
                  required
                  placeholder="مثال: مكتب النور للمحاماة والاستشارات"
                  value={formData.office_name}
                  onChange={(e) => setFormData({ ...formData, office_name: e.target.value })}
                  className="text-xs h-9"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">اسم المستخدم للأدمن *</Label>
                  <Input
                    required
                    placeholder="admin_office"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="text-xs h-9 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">كلمة المرور *</Label>
                  <Input
                    required
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="text-xs h-9 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">اسم المشرف المسؤول</Label>
                  <Input
                    placeholder="أ. محمد أحمد"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    placeholder="office@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">باقة الاشتراك *</Label>
                  <select
                    value={formData.plan_id}
                    onChange={(e) => handlePlanChange(e.target.value)}
                    className="w-full text-xs border border-border rounded-lg bg-background p-2 focus:ring-1 focus:ring-primary"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.price ? `${p.price} - ` : ''}{p.ai_quota_limit} تحليل)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">دورة الفوترة</Label>
                  <select
                    value={formData.billing_cycle}
                    onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value as any })}
                    className="w-full text-xs border border-border rounded-lg bg-background p-2 focus:ring-1 focus:ring-primary"
                  >
                    <option value="annual">سنوي</option>
                    <option value="monthly">شهري</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">تاريخ انتهاء الاشتراك *</Label>
                  <Input
                    type="date"
                    required
                    value={formData.subscription_end_date}
                    onChange={(e) => setFormData({ ...formData, subscription_end_date: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">حصة تحليلات الذكاء الاصطناعي</Label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                      <input
                        type="checkbox"
                        checked={formData.isCustomQuota}
                        onChange={(e) => handleCustomQuotaToggle(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                      />
                      <span>تخصيص الحصة للمكتب</span>
                    </label>
                  </div>
                  {formData.isCustomQuota ? (
                    <Input
                      type="number"
                      min={0}
                      placeholder="أدخل الحصة المخصصة"
                      value={formData.ai_quota_limit_override}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({
                          ...formData,
                          ai_quota_limit_override: val === '' ? '' : Number(val),
                          ai_quota_limit: val === '' ? 0 : Number(val),
                        });
                      }}
                      className="text-xs h-9 font-mono border-amber-500/50 bg-amber-500/5"
                    />
                  ) : (
                    <div className="flex items-center justify-between px-3 h-9 rounded-md border border-border bg-muted/40 text-xs text-muted-foreground font-mono">
                      <span>افتراضي الباقة: {plans.find((p) => p.id === formData.plan_id)?.ai_quota_limit ?? 100} تحليلاً</span>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">تلقائي</Badge>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">ملاحظات الاشتراك (خاصة بإدارة المنصة)</Label>
                <Textarea
                  placeholder="رقم الفاتورة، طريقة الدفع، أو أي ملاحظات داخلية..."
                  value={formData.subscription_notes}
                  onChange={(e) => setFormData({ ...formData, subscription_notes: e.target.value })}
                  className="text-xs min-h-[60px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-xs"
                >
                  إلغاء
                </Button>
                <Button type="submit" className="text-xs font-bold gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  حفظ وإنشاء المكتب
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Office Admin Modal */}
      {isEditModalOpen && selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  تعديل اشتراك المكتب: {selectedAdmin.office_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateAdmin} className="space-y-4 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">اسم مكتب المحاماة *</Label>
                <Input
                  required
                  value={formData.office_name}
                  onChange={(e) => setFormData({ ...formData, office_name: e.target.value })}
                  className="text-xs h-9"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">اسم المستخدم (للقراءة فقط)</Label>
                  <Input
                    disabled
                    value={formData.username}
                    className="text-xs h-9 font-mono bg-muted"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">تغيير كلمة المرور (اتركه فارغاً للإبقاء)</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="text-xs h-9 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">اسم المشرف المسؤول</Label>
                  <Input
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">باقة الاشتراك</Label>
                  <select
                    value={formData.plan_id}
                    onChange={(e) => handlePlanChange(e.target.value)}
                    className="w-full text-xs border border-border rounded-lg bg-background p-2 focus:ring-1 focus:ring-primary"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.price ? `${p.price} - ` : ''}{p.ai_quota_limit} تحليل)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">دورة الفوترة</Label>
                  <select
                    value={formData.billing_cycle}
                    onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value as any })}
                    className="w-full text-xs border border-border rounded-lg bg-background p-2 focus:ring-1 focus:ring-primary"
                  >
                    <option value="annual">سنوي</option>
                    <option value="monthly">شهري</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">تاريخ انتهاء الاشتراك</Label>
                  <Input
                    type="date"
                    value={formData.subscription_end_date}
                    onChange={(e) => setFormData({ ...formData, subscription_end_date: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">حصة تحليلات الذكاء الاصطناعي</Label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                      <input
                        type="checkbox"
                        checked={formData.isCustomQuota}
                        onChange={(e) => handleCustomQuotaToggle(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                      />
                      <span>تخصيص الحصة للمكتب</span>
                    </label>
                  </div>
                  {formData.isCustomQuota ? (
                    <Input
                      type="number"
                      min={0}
                      placeholder="أدخل الحصة المخصصة"
                      value={formData.ai_quota_limit_override}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({
                          ...formData,
                          ai_quota_limit_override: val === '' ? '' : Number(val),
                          ai_quota_limit: val === '' ? 0 : Number(val),
                        });
                      }}
                      className="text-xs h-9 font-mono border-amber-500/50 bg-amber-500/5"
                    />
                  ) : (
                    <div className="flex items-center justify-between px-3 h-9 rounded-md border border-border bg-muted/40 text-xs text-muted-foreground font-mono">
                      <span>افتراضي الباقة: {plans.find((p) => p.id === formData.plan_id)?.ai_quota_limit ?? 100} تحليلاً</span>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">تلقائي</Badge>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">ملاحظات الاشتراك (خاصة بإدارة المنصة)</Label>
                <Textarea
                  value={formData.subscription_notes}
                  onChange={(e) => setFormData({ ...formData, subscription_notes: e.target.value })}
                  className="text-xs min-h-[60px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-xs"
                >
                  إلغاء
                </Button>
                <Button type="submit" className="text-xs font-bold gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  حفظ التعديلات
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Subscription Plan Modal */}
      {isAddPlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">إضافة باقة اشتراك جديدة</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPlanModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">اسم الباقة بالعربية *</Label>
                  <Input
                    required
                    placeholder="مثال: الباقة الذهبية"
                    value={planFormData.name}
                    onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">معرّف الباقة (Slug) *</Label>
                  <Input
                    required
                    placeholder="مثال: gold"
                    value={planFormData.slug}
                    onChange={(e) => setPlanFormData({ ...planFormData, slug: e.target.value })}
                    className="text-xs h-9 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">سعر العرض (للعرض فقط)</Label>
                  <Input
                    placeholder="مثال: 399 ر.س / شهرياً"
                    value={planFormData.price}
                    onChange={(e) => setPlanFormData({ ...planFormData, price: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">حصة الـ AI الافتراضية *</Label>
                  <Input
                    type="number"
                    min={0}
                    required
                    placeholder="100"
                    value={planFormData.ai_quota_limit}
                    onChange={(e) => setPlanFormData({ ...planFormData, ai_quota_limit: Number(e.target.value) })}
                    className="text-xs h-9 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-xs font-bold text-foreground">ميزات وصلاحيات الباقة</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={planFormData.features.google_sheets_export ?? false}
                      onChange={(e) =>
                        setPlanFormData({
                          ...planFormData,
                          features: { ...planFormData.features, google_sheets_export: e.target.checked },
                        })
                      }
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                    />
                    <span className="text-[11px] font-medium">تصدير جداول Google Sheets</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={planFormData.features.whatsapp_reminders ?? false}
                      onChange={(e) =>
                        setPlanFormData({
                          ...planFormData,
                          features: { ...planFormData.features, whatsapp_reminders: e.target.checked },
                        })
                      }
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                    />
                    <span className="text-[11px] font-medium">تذكيرات ورسائل واتساب</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={planFormData.features.ai_assistant ?? false}
                      onChange={(e) =>
                        setPlanFormData({
                          ...planFormData,
                          features: { ...planFormData.features, ai_assistant: e.target.checked },
                        })
                      }
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                    />
                    <span className="text-[11px] font-medium">المساعد القانوني الذكي</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={planFormData.features.court_session_analytics ?? false}
                      onChange={(e) =>
                        setPlanFormData({
                          ...planFormData,
                          features: { ...planFormData.features, court_session_analytics: e.target.checked },
                        })
                      }
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                    />
                    <span className="text-[11px] font-medium">إحصائيات وتحليلات الجلسات</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={planFormData.features.custom_branding ?? false}
                      onChange={(e) =>
                        setPlanFormData({
                          ...planFormData,
                          features: { ...planFormData.features, custom_branding: e.target.checked },
                        })
                      }
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                    />
                    <span className="text-[11px] font-medium">تخصيص الهوية والشعار</span>
                  </label>

                  <div className="space-y-1 p-2 rounded-lg border border-border bg-muted/20">
                    <Label className="text-[11px] font-medium">الحد الأقصى للمستخدمين</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="10"
                      value={planFormData.features.max_members ?? 10}
                      onChange={(e) =>
                        setPlanFormData({
                          ...planFormData,
                          features: { ...planFormData.features, max_members: Number(e.target.value) },
                        })
                      }
                      className="text-xs h-7 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddPlanModalOpen(false)}
                  className="text-xs"
                >
                  إلغاء
                </Button>
                <Button type="submit" className="text-xs font-bold gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  حفظ وإنشاء الباقة
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Subscription Plan Modal */}
      {isEditPlanModalOpen && selectedPlanForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  تعديل باقة: {selectedPlanForEdit.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditPlanModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdatePlan} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">اسم الباقة بالعربية *</Label>
                  <Input
                    required
                    value={planFormData.name}
                    onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">معرّف الباقة (للقراءة فقط)</Label>
                  <Input
                    disabled
                    value={planFormData.slug}
                    className="text-xs h-9 font-mono bg-muted"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">سعر العرض (للعرض فقط)</Label>
                  <Input
                    placeholder="مثال: 399 ر.س / شهرياً"
                    value={planFormData.price}
                    onChange={(e) => setPlanFormData({ ...planFormData, price: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">حصة الـ AI الافتراضية *</Label>
                  <Input
                    type="number"
                    min={0}
                    required
                    value={planFormData.ai_quota_limit}
                    onChange={(e) => setPlanFormData({ ...planFormData, ai_quota_limit: Number(e.target.value) })}
                    className="text-xs h-9 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-xs font-bold text-foreground">ميزات وصلاحيات الباقة</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={planFormData.features.google_sheets_export ?? false}
                      onChange={(e) =>
                        setPlanFormData({
                          ...planFormData,
                          features: { ...planFormData.features, google_sheets_export: e.target.checked },
                        })
                      }
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                    />
                    <span className="text-[11px] font-medium">تصدير جداول Google Sheets</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={planFormData.features.whatsapp_reminders ?? false}
                      onChange={(e) =>
                        setPlanFormData({
                          ...planFormData,
                          features: { ...planFormData.features, whatsapp_reminders: e.target.checked },
                        })
                      }
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                    />
                    <span className="text-[11px] font-medium">تذكيرات ورسائل واتساب</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={planFormData.features.ai_assistant ?? false}
                      onChange={(e) =>
                        setPlanFormData({
                          ...planFormData,
                          features: { ...planFormData.features, ai_assistant: e.target.checked },
                        })
                      }
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                    />
                    <span className="text-[11px] font-medium">المساعد القانوني الذكي</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={planFormData.features.court_session_analytics ?? false}
                      onChange={(e) =>
                        setPlanFormData({
                          ...planFormData,
                          features: { ...planFormData.features, court_session_analytics: e.target.checked },
                        })
                      }
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                    />
                    <span className="text-[11px] font-medium">إحصائيات وتحليلات الجلسات</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={planFormData.features.custom_branding ?? false}
                      onChange={(e) =>
                        setPlanFormData({
                          ...planFormData,
                          features: { ...planFormData.features, custom_branding: e.target.checked },
                        })
                      }
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                    />
                    <span className="text-[11px] font-medium">تخصيص الهوية والشعار</span>
                  </label>

                  <div className="space-y-1 p-2 rounded-lg border border-border bg-muted/20">
                    <Label className="text-[11px] font-medium">الحد الأقصى للمستخدمين</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="10"
                      value={planFormData.features.max_members ?? 10}
                      onChange={(e) =>
                        setPlanFormData({
                          ...planFormData,
                          features: { ...planFormData.features, max_members: Number(e.target.value) },
                        })
                      }
                      className="text-xs h-7 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditPlanModalOpen(false)}
                  className="text-xs"
                >
                  إلغاء
                </Button>
                <Button type="submit" className="text-xs font-bold gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  حفظ التعديلات
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

