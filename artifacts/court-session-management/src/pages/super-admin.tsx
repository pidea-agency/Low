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
  BarChart3,
  SlidersHorizontal,
  Bot,
  Menu,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { useGetCurrentUser, useLogout } from '@workspace/api-client-react';
import { validatePassword } from '@workspace/api-zod';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/components/theme-provider';

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

export interface OverviewData {
  totalOffices: number;
  activeSubscriptions: number;
  expiringIn7Days: number;
  totalAiUsage: number;
  expiringSoonest: Array<{
    id: string;
    office_name: string;
    username: string;
    display_name?: string | null;
    plan_name?: string;
    subscription_end_date?: string | null;
    days_left: number | null;
    status: string;
  }>;
}

export interface AuditLogItem {
  id: string;
  actor_id: string;
  actor_username: string;
  action: string;
  target_office_id?: string | null;
  details?: Record<string, any>;
  created_at: string;
}

export interface PlatformSettings {
  activation_link_expiry_hours: number;
  new_office_registration_enabled: boolean;
  support_contact_email: string;
  support_contact_phone: string;
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

export function formatDateTimeDisplay(val?: string | null): string {
  if (!val || !val.trim()) return '—';
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  } catch {}
  return String(val);
}

function formatAuditAction(action: string): { label: string; badgeClass: string } {
  switch (action) {
    case 'created_office':
      return { label: 'إنشاء مكتب', badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' };
    case 'updated_office':
      return { label: 'تعديل مكتب', badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' };
    case 'deleted_office':
      return { label: 'حذف مكتب', badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30' };
    case 'suspended_office':
      return { label: 'إيقاف مؤقت', badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30' };
    case 'activated_office':
      return { label: 'إعادة تفعيل', badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' };
    case 'extended_subscription':
      return { label: 'تمديد اشتراك', badgeClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30' };
    case 'reset_ai_usage':
      return { label: 'تصفير AI', badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' };
    case 'created_plan':
      return { label: 'إنشاء باقة', badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' };
    case 'updated_plan':
      return { label: 'تعديل باقة', badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30' };
    case 'deleted_plan':
      return { label: 'حذف باقة', badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30' };
    case 'linked_member':
      return { label: 'ربط عضو', badgeClass: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30' };
    case 'updated_platform_settings':
      return { label: 'إعدادات المنصة', badgeClass: 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40' };
    default:
      return { label: action, badgeClass: 'bg-muted text-muted-foreground border-border' };
  }
}

function renderAuditDetails(details?: Record<string, any>): string {
  if (!details || Object.keys(details).length === 0) return '—';
  const parts: string[] = [];
  if (details.office_name) parts.push(`المكتب: ${details.office_name}`);
  if (details.username) parts.push(`المستخدم: ${details.username}`);
  if (details.period) parts.push(`المدة: +${details.period === '1m' ? 'شهر' : 'سنة'}`);
  if (details.new_status) parts.push(`الحالة: ${details.new_status === 'suspended' ? 'موقوف' : 'نشط'}`);
  if (details.plan_tier) parts.push(`الباقة: ${details.plan_tier}`);
  if (details.name) parts.push(`الاسم: ${details.name}`);
  if (details.activation_link_expiry_hours !== undefined) parts.push(`الصلاحية: ${details.activation_link_expiry_hours} ساعة`);
  if (details.new_office_registration_enabled !== undefined) parts.push(`التسجيل: ${details.new_office_registration_enabled ? 'مفعل' : 'معطل'}`);
  if (parts.length > 0) return parts.join(' | ');
  try {
    return JSON.stringify(details);
  } catch {
    return '—';
  }
}

export default function SuperAdminPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { data: currentUser } = useGetCurrentUser();
  const logoutMutation = useLogout();
  const { theme, setTheme } = useTheme();

  // Sidebar section state
  const [currentSection, setCurrentSection] = useState<'overview' | 'offices' | 'audit' | 'settings'>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sub-tabs for Offices section
  const [activeTab, setActiveTab] = useState<'admins' | 'plans' | 'unlinked'>('admins');

  // Offices state
  const [admins, setAdmins] = useState<OfficeAdmin[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [unlinkedMembers, setUnlinkedMembers] = useState<UnlinkedMember[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(true);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'expiring'>('all');

  // Overview section state
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);

  // Audit Log section state
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditOfficeFilter, setAuditOfficeFilter] = useState<string>('all');
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Settings section state
  const [settingsForm, setSettingsForm] = useState<PlatformSettings>({
    activation_link_expiry_hours: 48,
    new_office_registration_enabled: true,
    support_contact_email: '',
    support_contact_phone: '',
  });
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

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

  const fetchOverview = async () => {
    setIsLoadingOverview(true);
    try {
      const res = await fetch('/api/super-admin/overview');
      if (res.ok) {
        const data = await res.json();
        setOverviewData(data);
      }
    } catch {
      // Keep silent fallback
    } finally {
      setIsLoadingOverview(false);
    }
  };

  const fetchAuditLogs = async (page = 1, officeFilter = auditOfficeFilter) => {
    setIsLoadingAudit(true);
    try {
      const url = new URL('/api/super-admin/audit-log', window.location.origin);
      url.searchParams.set('page', String(page));
      url.searchParams.set('limit', '15');
      if (officeFilter && officeFilter !== 'all') {
        url.searchParams.set('office_id', officeFilter);
      }
      const res = await fetch(url.pathname + url.search);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
        setAuditTotal(data.total || 0);
        setAuditPage(data.page || 1);
        setAuditTotalPages(data.total_pages || 1);
      }
    } catch {
      toast({
        title: 'خطأ',
        description: 'فشل جلب سجل الأحداث.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const fetchSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const res = await fetch('/api/super-admin/settings');
      if (res.ok) {
        const data = await res.json();
        setSettingsForm({
          activation_link_expiry_hours: data.activation_link_expiry_hours ?? 48,
          new_office_registration_enabled: data.new_office_registration_enabled ?? true,
          support_contact_email: data.support_contact_email ?? '',
          support_contact_phone: data.support_contact_phone ?? '',
        });
      }
    } catch {
      toast({
        title: 'خطأ',
        description: 'فشل جلب إعدادات المنصة.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/super-admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تحديث إعدادات المنصة.');
      }
      toast({
        title: 'تم الحفظ',
        description: 'تم تحديث إعدادات المنصة بنجاح.',
      });
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message || 'فشل تحديث إعدادات المنصة.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

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
    setIsLoadingAdmins(true);
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
      setIsLoadingAdmins(false);
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
    fetchOverview();
  }, []);

  useEffect(() => {
    if (currentSection === 'overview') {
      fetchOverview();
    } else if (currentSection === 'audit') {
      fetchAuditLogs(1, auditOfficeFilter);
    } else if (currentSection === 'settings') {
      fetchSettings();
    } else if (currentSection === 'offices') {
      fetchAdmins();
      fetchPlans();
      fetchUnlinked();
    }
  }, [currentSection]);

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
      fetchOverview();
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
      fetchOverview();
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
      fetchOverview();
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
      fetchOverview();
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
      fetchOverview();
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
      fetchOverview();
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
      fetchOverview();
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
      plan_id: defaultPlan?.id || '',
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

  const navItems = [
    {
      id: 'overview' as const,
      name: 'نظرة عامة',
      icon: BarChart3,
    },
    {
      id: 'offices' as const,
      name: 'المكاتب والاشتراكات',
      icon: Building2,
      badge: admins.length,
    },
    {
      id: 'audit' as const,
      name: 'سجل الأحداث',
      icon: Clock,
    },
    {
      id: 'settings' as const,
      name: 'الإعدادات العامة',
      icon: SlidersHorizontal,
    },
  ];

  const renderSidebarContent = (onNav?: () => void) => (
    <div
      className="flex flex-col h-full sidebar-gradient"
      style={{
        background: theme === 'dark'
          ? 'linear-gradient(165deg, #222819 0%, #1A1F13 60%, #14170E 100%)'
          : 'linear-gradient(165deg, #3F4A2C 0%, #353E24 60%, #2A321D 100%)',
        borderInlineStart: theme === 'dark'
          ? '1px solid rgba(255,255,255,0.06)'
          : '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Brand Header */}
      <div
        className="p-4 space-y-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: '#C9A449',
              boxShadow: '0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
          >
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-bold text-white leading-tight truncate">
              إدارة المنظومة
            </h1>
            <p className="text-[10px] mt-0.5" style={{ color: '#C9A449' }}>
              المشرف العام (Super Admin)
            </p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto sidebar-scrollbar">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest px-3 py-2"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          أقسام الإدارة
        </p>

        {navItems.map((item) => {
          const isActive = currentSection === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => {
                setCurrentSection(item.id);
                onNav?.();
              }}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-[#C9A449] text-white shadow-xs'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
              style={
                isActive
                  ? {
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 8px rgba(0,0,0,0.25)',
                    }
                  : undefined
              }
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate text-start">{item.name}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isActive
                      ? 'bg-black/20 text-white'
                      : 'bg-white/10 text-white/80'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div
        className="p-3 space-y-1"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer text-white/70 hover:bg-white/10 hover:text-white"
        >
          {theme === 'light' ? (
            <>
              <Moon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-start">الوضع الداكن</span>
            </>
          ) : (
            <>
              <Sun className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-start">الوضع الفاتح</span>
            </>
          )}
        </button>

        <button
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer disabled:opacity-40 text-amber-100/70 hover:bg-rose-500/15 hover:text-rose-200 group"
        >
          <LogOut className="w-4 h-4 shrink-0 text-rose-400/80 group-hover:text-rose-300 transition-colors" />
          <span className="flex-1 text-start">
            {logoutMutation.isPending ? 'جارٍ الخروج...' : 'تسجيل الخروج'}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background text-foreground font-sans" dir="rtl">
      {/* Desktop Sidebar */}
      <aside className="w-64 flex-shrink-0 hidden md:block h-full">
        {renderSidebarContent()}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Top Header */}
        <div className="md:hidden flex items-center justify-between p-3 border-b border-border bg-card shrink-0 gap-2">
          <div className="flex items-center gap-2.5">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-foreground hover:bg-accent shrink-0"
                  aria-label="فتح القائمة"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="p-0 w-72 border-none bg-transparent shadow-2xl">
                {renderSidebarContent(() => setMobileMenuOpen(false))}
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: '#C9A449' }}
              >
                <ShieldAlert className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-xs">إدارة المنظومة</span>
            </div>
          </div>

          <Badge className="bg-amber-600 text-white text-[10px] px-2">Super Admin</Badge>
        </div>

        {/* Scrollable Main Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-background">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* SECTION 1: OVERVIEW */}
            {currentSection === 'overview' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                      <BarChart3 className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                        نظرة عامة على المنظومة
                      </h1>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        مؤشرات حيوية وإحصاءات الأداء لجميع مكاتب المحاماة، باقات الاشتراك، واستهلاك الذكاء الاصطناعي
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchOverview}
                    disabled={isLoadingOverview}
                    className="gap-2 text-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOverview ? 'animate-spin' : ''}`} />
                    تحديث المؤشرات
                  </Button>
                </div>

                {/* 4 Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-3.5 shadow-xs">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">إجمالي المكاتب</p>
                      <p className="text-2xl font-black text-foreground">
                        {overviewData?.totalOffices ?? admins.length}
                      </p>
                    </div>
                  </div>

                  <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-3.5 shadow-xs">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">الاشتراكات النشطة</p>
                      <p className="text-2xl font-black text-emerald-600">
                        {overviewData?.activeSubscriptions ?? admins.filter((a) => a.status !== 'suspended' && !getSubscriptionInfo(a).isExpired).length}
                      </p>
                    </div>
                  </div>

                  <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-3.5 shadow-xs">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">تنتهي خلال 7 أيام</p>
                      <p className="text-2xl font-black text-amber-600">
                        {overviewData?.expiringIn7Days ?? admins.filter((a) => getSubscriptionInfo(a).isExpiringSoon).length}
                      </p>
                    </div>
                  </div>

                  <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-3.5 shadow-xs">
                    <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">استهلاك الذكاء الاصطناعي</p>
                      <p className="text-2xl font-black text-purple-600">
                        {overviewData?.totalAiUsage ?? admins.reduce((acc, a) => acc + (a.ai_usage_count || 0), 0)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Expiring Soonest Table */}
                <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <h2 className="text-sm font-bold text-foreground">
                        أقرب 5 اشتراكات للانتهاء
                      </h2>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentSection('offices')}
                      className="text-xs text-primary hover:underline gap-1"
                    >
                      عرض جميع المكاتب
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-muted/50 border-b border-border font-bold text-muted-foreground">
                        <tr>
                          <th className="p-3.5">اسم المكتب</th>
                          <th className="p-3.5">المشرف المسؤول</th>
                          <th className="p-3.5">باقة الاشتراك</th>
                          <th className="p-3.5">تاريخ الانتهاء</th>
                          <th className="p-3.5">حالة الصلاحية</th>
                          <th className="p-3.5 text-center">إجراء تمديد</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-medium">
                        {isLoadingOverview ? (
                          <tr>
                            <td colSpan={6} className="text-center p-8 text-muted-foreground">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto mb-2" />
                              جارٍ تحميل البيانات...
                            </td>
                          </tr>
                        ) : !overviewData?.expiringSoonest || overviewData.expiringSoonest.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center p-8 text-muted-foreground">
                              ممتاز! لا توجد مكاتب تنتهي اشتراكاتها قريباً.
                            </td>
                          </tr>
                        ) : (
                          overviewData.expiringSoonest.map((item) => {
                            const isExpired = item.days_left !== null && item.days_left < 0;
                            const isExpiringSoon = item.days_left !== null && item.days_left >= 0 && item.days_left <= 7;

                            return (
                              <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                                <td className="p-3.5 font-bold text-foreground">
                                  {item.office_name}
                                </td>
                                <td className="p-3.5 font-mono text-muted-foreground">
                                  {item.username}
                                </td>
                                <td className="p-3.5">
                                  <Badge variant="outline" className="font-bold text-[11px]">
                                    {item.plan_name || 'بلس'}
                                  </Badge>
                                </td>
                                <td className="p-3.5 text-muted-foreground">
                                  {formatDateDisplay(item.subscription_end_date)}
                                </td>
                                <td className="p-3.5">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      isExpired
                                        ? 'bg-rose-500/15 text-rose-600 border-rose-500/30'
                                        : isExpiringSoon
                                        ? 'bg-amber-500/20 text-amber-700 border-amber-500/40 font-bold'
                                        : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                                    }`}
                                  >
                                    {isExpired
                                      ? 'منتهي ❌'
                                      : item.days_left === 0
                                      ? 'ينتهي اليوم ⚠️'
                                      : item.days_left !== null
                                      ? `متبقي ${item.days_left} يوماً`
                                      : 'نشط'}
                                  </Badge>
                                </td>
                                <td className="p-3.5 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleQuickExtend(item.id, '1m')}
                                      className="text-xs h-7 px-2 font-bold hover:bg-emerald-500/10 hover:text-emerald-600 border-emerald-500/30"
                                    >
                                      +شهر
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleQuickExtend(item.id, '1y')}
                                      className="text-xs h-7 px-2 font-bold hover:bg-purple-500/10 hover:text-purple-600 border-purple-500/30"
                                    >
                                      +سنة
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

            {/* SECTION 2: OFFICES & PLANS & UNLINKED MEMBERS */}
            {currentSection === 'offices' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                        إدارة المكاتب والاشتراكات
                      </h1>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        إنشاء وتعديل مكاتب المحاماة، باقات الاشتراك، وحصص الذكاء الاصطناعي
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      resetForm();
                      setIsAddModalOpen(true);
                    }}
                    className="gap-2 text-xs font-bold"
                  >
                    <UserPlus className="w-4 h-4" />
                    إضافة مكتب جديد
                  </Button>
                </div>

                {/* Sub-tab Navigation */}
                <div className="flex items-center gap-2 border-b border-border pb-2 flex-wrap">
                  <button
                    onClick={() => setActiveTab('admins')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${
                      activeTab === 'admins'
                        ? 'bg-primary text-primary-foreground shadow-xs'
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
                        ? 'bg-primary text-primary-foreground shadow-xs'
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
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Link2 className="w-4 h-4" />
                    <span>الأعضاء غير المرتبطين ({unlinkedMembers.length})</span>
                  </button>
                </div>

                {/* Sub-tab 1: Admins */}
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
                    </div>

                    {/* Admins Table */}
                    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
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
                            {isLoadingAdmins ? (
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
                                        <Badge
                                          variant="outline"
                                          className={`font-bold gap-1 text-[11px] ${
                                            (admin.plan?.slug === 'pro' || admin.plan_tier === 'pro')
                                              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30'
                                              : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30'
                                          }`}
                                        >
                                          <Crown className="w-3 h-3" />
                                          {admin.plan?.name || (admin.plan_tier === 'pro' ? 'برو الاحترافية' : 'بلس')}
                                        </Badge>
                                        <span className="text-[10px] text-muted-foreground">
                                          {admin.billing_cycle === 'annual' ? 'فوترة سنوية' : 'فوترة شهرية'}
                                        </span>
                                      </div>
                                    </td>

                                    <td className="p-3.5">
                                      <div className="space-y-1">
                                        <Badge variant="outline" className={`text-[10px] ${sub.badgeColor}`}>
                                          {sub.statusText}
                                        </Badge>
                                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                          <Calendar className="w-3 h-3" />
                                          ينتهي: {formatDateDisplay(admin.subscription_end_date)}
                                        </div>
                                        <div className="flex items-center gap-1 mt-1">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleQuickExtend(admin.id, '1m')}
                                            className="text-[10px] h-6 px-1.5 font-bold hover:bg-emerald-500/10 hover:text-emerald-600 border-emerald-500/30"
                                            title="تمديد شهر واحد"
                                          >
                                            +شهر
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleQuickExtend(admin.id, '1y')}
                                            className="text-[10px] h-6 px-1.5 font-bold hover:bg-purple-500/10 hover:text-purple-600 border-purple-500/30"
                                            title="تمديد سنة كاملة"
                                          >
                                            +سنة
                                          </Button>
                                        </div>
                                      </div>
                                    </td>

                                    <td className="p-3.5">
                                      <div className="space-y-1 min-w-[130px]">
                                        <div className="flex items-center justify-between text-[11px]">
                                          <span className="font-bold">{usage}</span>
                                          <span className="text-muted-foreground">
                                            من {quotaLimit === -1 ? '∞' : quotaLimit}
                                          </span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                          <div
                                            className={`h-full rounded-full transition-all ${
                                              usagePercent > 90
                                                ? 'bg-rose-500'
                                                : usagePercent > 70
                                                ? 'bg-amber-500'
                                                : 'bg-primary'
                                            }`}
                                            style={{ width: `${usagePercent}%` }}
                                          />
                                        </div>
                                        <div className="flex items-center justify-between text-[9px] text-muted-foreground pt-0.5">
                                          {admin.ai_quota_limit_override !== null && admin.ai_quota_limit_override !== undefined ? (
                                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                                              مخصص
                                            </Badge>
                                          ) : (
                                            <span>الافتراضي</span>
                                          )}
                                          <button
                                            onClick={() => handleResetAi(admin.id)}
                                            className="hover:text-primary transition-colors hover:underline"
                                            title="تصفير الاستهلاك للشهر الحالي"
                                          >
                                            تصفير
                                          </button>
                                        </div>
                                      </div>
                                    </td>

                                    <td className="p-3.5">
                                      <Badge variant="outline" className="font-bold text-[11px] gap-1">
                                        <Users className="w-3 h-3 text-muted-foreground" />
                                        {admin.member_count || 0}
                                      </Badge>
                                    </td>

                                    <td className="p-3.5 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          title={admin.status === 'suspended' ? 'تفعيل المكتب' : 'إيقاف مؤقت'}
                                          onClick={() => handleToggleStatus(admin)}
                                          className={`h-7 w-7 p-0 ${
                                            admin.status === 'suspended'
                                              ? 'text-emerald-600 hover:bg-emerald-500/10'
                                              : 'text-amber-600 hover:bg-amber-500/10'
                                          }`}
                                        >
                                          <Zap className="w-3.5 h-3.5" />
                                        </Button>

                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          title="تعديل بيانات المكتب والاشتراك"
                                          onClick={() => openEditModal(admin)}
                                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </Button>

                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          title="حذف حساب المكتب"
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

                {/* Sub-tab 2: Subscription Plans */}
                {activeTab === 'plans' && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border p-3.5 rounded-xl">
                      <div>
                        <h3 className="font-bold text-sm text-foreground">باقات الاشتراك وميزاتها</h3>
                        <p className="text-xs text-muted-foreground">
                          تحديد الميزات وحصص الذكاء الاصطناعي لكل باقة اشتراك في المنصة
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

                    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-muted/50 border-b border-border font-bold text-muted-foreground">
                            <tr>
                              <th className="p-3.5">اسم الباقة</th>
                              <th className="p-3.5">المعرف (Slug)</th>
                              <th className="p-3.5">السعر المعروض</th>
                              <th className="p-3.5">حصة الـ AI الافتراضية</th>
                              <th className="p-3.5">الميزات المفعلة</th>
                              <th className="p-3.5 text-center">المكاتب المشتركة</th>
                              <th className="p-3.5 text-center">الإجراءات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border font-medium">
                            {isLoadingPlans ? (
                              <tr>
                                <td colSpan={7} className="text-center p-8 text-muted-foreground">
                                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
                                  جارٍ تحميل باقات الاشتراك...
                                </td>
                              </tr>
                            ) : plans.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="text-center p-8 text-muted-foreground">
                                  لا توجد باقات حالياً. اضغط "إضافة باقة جديدة" للبدء.
                                </td>
                              </tr>
                            ) : (
                              plans.map((plan) => {
                                const officeCount = plan.office_count ?? 0;
                                const isInUse = officeCount > 0;

                                return (
                                  <tr key={plan.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="p-3.5 font-bold text-foreground text-sm">
                                      {plan.name}
                                    </td>
                                    <td className="p-3.5 font-mono bg-muted px-2 py-0.5 rounded text-xs">
                                      {plan.slug}
                                    </td>
                                    <td className="p-3.5 text-muted-foreground">
                                      {plan.price ? `${plan.price} ر.س` : 'مخصص / مجاني'}
                                    </td>
                                    <td className="p-3.5">
                                      <Badge variant="outline" className="font-bold gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                                        <Bot className="w-3 h-3" />
                                        {plan.ai_quota_limit} تحليل / شهر
                                      </Badge>
                                    </td>
                                    <td className="p-3.5">
                                      <div className="flex flex-wrap gap-1 max-w-sm">
                                        {plan.features?.google_sheets_export && (
                                          <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                                            <Check className="w-2.5 h-2.5" /> تصدير Sheets
                                          </Badge>
                                        )}
                                        {plan.features?.whatsapp_reminders && (
                                          <Badge variant="outline" className="text-[10px] gap-1 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                                            <Check className="w-2.5 h-2.5" /> تذكيرات واتساب
                                          </Badge>
                                        )}
                                        {plan.features?.ai_assistant && (
                                          <Badge variant="outline" className="text-[10px] gap-1 bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30">
                                            <Sparkles className="w-2.5 h-2.5" /> مساعد ذكي
                                          </Badge>
                                        )}
                                        {plan.features?.custom_branding && (
                                          <Badge variant="outline" className="text-[10px] gap-1 bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30">
                                            <Crown className="w-2.5 h-2.5" /> تخصيص الهوية
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

                {/* Sub-tab 3: Unlinked Members */}
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

                    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
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
            )}

            {/* SECTION 3: AUDIT LOG */}
            {currentSection === 'audit' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                      <Clock className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                        سجل أحداث المنصة (Audit Log)
                      </h1>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        تتبع وتدقيق العمليات الإدارية الحساسة، التعديلات على الاشتراكات، وحركات المكاتب
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Office filter selector */}
                    <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                      <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
                      <select
                        value={auditOfficeFilter}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAuditOfficeFilter(val);
                          fetchAuditLogs(1, val);
                        }}
                        className="text-xs border border-border rounded-lg bg-background p-2 focus:ring-1 focus:ring-primary w-full sm:w-56"
                      >
                        <option value="all">جميع المكاتب (الكل)</option>
                        {admins.map((adm) => (
                          <option key={adm.id} value={adm.id}>
                            {adm.office_name || adm.username}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchAuditLogs(auditPage, auditOfficeFilter)}
                      disabled={isLoadingAudit}
                      className="gap-2 text-xs shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAudit ? 'animate-spin' : ''}`} />
                      تحديث
                    </Button>
                  </div>
                </div>

                {/* Audit Table */}
                <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-muted/50 border-b border-border font-bold text-muted-foreground">
                        <tr>
                          <th className="p-3.5">الفاعل (المشرف)</th>
                          <th className="p-3.5">نوع الإجراء</th>
                          <th className="p-3.5">المكتب المعني</th>
                          <th className="p-3.5">تفاصيل الحدث</th>
                          <th className="p-3.5">التاريخ والوقت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-medium">
                        {isLoadingAudit ? (
                          <tr>
                            <td colSpan={5} className="text-center p-8 text-muted-foreground">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
                              جارٍ تحميل سجل الأحداث...
                            </td>
                          </tr>
                        ) : auditLogs.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center p-8 text-muted-foreground">
                              لا توجد أحداث مسجلة في هذا النطاق حالياً.
                            </td>
                          </tr>
                        ) : (
                          auditLogs.map((log) => {
                            const act = formatAuditAction(log.action);
                            const matchedOffice = log.target_office_id
                              ? admins.find((a) => a.id === log.target_office_id)
                              : null;

                            return (
                              <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                                <td className="p-3.5">
                                  <div className="font-bold text-foreground">
                                    {log.actor_username || 'مشرف المنصة'}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground font-mono">
                                    {log.actor_id}
                                  </div>
                                </td>

                                <td className="p-3.5">
                                  <Badge variant="outline" className={`font-bold text-[10px] ${act.badgeClass}`}>
                                    {act.label}
                                  </Badge>
                                </td>

                                <td className="p-3.5">
                                  {matchedOffice ? (
                                    <div>
                                      <div className="font-bold text-foreground">
                                        {matchedOffice.office_name}
                                      </div>
                                      <div className="text-[10px] text-muted-foreground font-mono">
                                        {matchedOffice.username}
                                      </div>
                                    </div>
                                  ) : log.target_office_id ? (
                                    <span className="font-mono text-[10px] text-muted-foreground">
                                      {log.target_office_id}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>

                                <td className="p-3.5 text-muted-foreground max-w-xs truncate">
                                  {renderAuditDetails(log.details)}
                                </td>

                                <td className="p-3.5 text-muted-foreground text-[11px] whitespace-nowrap">
                                  {formatDateTimeDisplay(log.created_at)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  {auditTotalPages > 1 && (
                    <div className="p-3.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        صفحة {auditPage} من {auditTotalPages} (إجمالي {auditTotal} حدث)
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={auditPage <= 1 || isLoadingAudit}
                          onClick={() => fetchAuditLogs(auditPage - 1, auditOfficeFilter)}
                          className="h-8 text-xs gap-1"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                          السابق
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={auditPage >= auditTotalPages || isLoadingAudit}
                          onClick={() => fetchAuditLogs(auditPage + 1, auditOfficeFilter)}
                          className="h-8 text-xs gap-1"
                        >
                          التالي
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 4: SETTINGS */}
            {currentSection === 'settings' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                      <SlidersHorizontal className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                        إعدادات المنصة العامة (Platform Settings)
                      </h1>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        تهيئة الخصائص التشغيلية، روابط التفعيل، والتواصل المؤسسي للدعم الفني
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchSettings}
                    disabled={isLoadingSettings}
                    className="gap-2 text-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSettings ? 'animate-spin' : ''}`} />
                    إعادة تحميل
                  </Button>
                </div>

                {/* Form Card */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-xs max-w-2xl">
                  <form onSubmit={handleSaveSettings} className="space-y-5">
                    {/* Expiry hours */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-foreground">
                        صلاحية روابط تفعيل حسابات المحامين (بالساعات) *
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        max={720}
                        required
                        value={settingsForm.activation_link_expiry_hours}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            activation_link_expiry_hours: Math.max(1, Number(e.target.value) || 48),
                          })
                        }
                        className="text-xs h-9 font-mono max-w-xs"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        المدة الزمنية المتاحة للأعضاء الجدد لتأكيد وتفعيل حساباتهم بعد إرسال دعوة التفعيل عبر البريد الإلكتروني (الافتراضي: 48 ساعة).
                      </p>
                    </div>

                    {/* Registration toggle */}
                    <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settingsForm.new_office_registration_enabled}
                          onChange={(e) =>
                            setSettingsForm({
                              ...settingsForm,
                              new_office_registration_enabled: e.target.checked,
                            })
                          }
                          className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="text-xs font-bold text-foreground">
                          السماح بالتسجيل الذاتي للمكاتب الجديدة
                        </span>
                      </label>
                      <p className="text-[11px] text-muted-foreground pr-7">
                        عند التعطيل، يقتصر إنشاء مكاتب المحاماة الجديدة على المشرف العام حصراً من خلال هذه البوابة.
                      </p>
                    </div>

                    {/* Support Contact Email */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-foreground">
                        البريد الإلكتروني للدعم الفني للمنصة
                      </Label>
                      <Input
                        type="email"
                        placeholder="support@example.com"
                        value={settingsForm.support_contact_email}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            support_contact_email: e.target.value,
                          })
                        }
                        className="text-xs h-9"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        البريد الذي يظهر لمكاتب المحاماة عند طلب المساعدة الفنية أو الاستفسارات.
                      </p>
                    </div>

                    {/* Support Contact Phone */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-foreground">
                        رقم هاتف / واتساب الدعم الفني للمنصة
                      </Label>
                      <Input
                        type="text"
                        placeholder="+966500000000"
                        value={settingsForm.support_contact_phone}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            support_contact_phone: e.target.value,
                          })
                        }
                        className="text-xs h-9 font-mono"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        قناة التواصل السريع لحل المشكلات الطارئة والاستفسارات العاجلة.
                      </p>
                    </div>

                    <div className="pt-3 border-t border-border flex items-center justify-end">
                      <Button
                        type="submit"
                        disabled={isSavingSettings}
                        className="gap-2 text-xs font-bold"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {isSavingSettings ? 'جارٍ الحفظ...' : 'حفظ إعدادات المنصة'}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Add Office Admin Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
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
                    <option value="annual">سنوية (سنة كاملة)</option>
                    <option value="monthly">شهرية</option>
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
                    className="text-xs h-9 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">رقم الهاتف للتواصل</Label>
                  <Input
                    placeholder="+966500000000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="text-xs h-9 font-mono"
                  />
                </div>
              </div>

              {/* Custom AI Quota Override toggle */}
              <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-foreground">تخصيص حصة الذكاء الاصطناعي لهذا المكتب</span>
                    <p className="text-[10px] text-muted-foreground">
                      تجاوز الحصة الافتراضية للباقة ({plans.find((p) => p.id === formData.plan_id)?.ai_quota_limit ?? 100} تحليل)
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isCustomQuota}
                    onChange={(e) => handleCustomQuotaToggle(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                </div>

                {formData.isCustomQuota && (
                  <div className="pt-2 border-t border-border/60">
                    <Label className="text-xs">حصة التحليلات الشهرية المخصصة *</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="مثال: 300"
                      value={formData.ai_quota_limit_override}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ai_quota_limit_override: e.target.value,
                          ai_quota_limit: Number(e.target.value) || 0,
                        })
                      }
                      className="text-xs h-8 font-mono mt-1"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">ملاحظات الاشتراك / العقد</Label>
                <Textarea
                  placeholder="أي شروط خاصة أو ملاحظات إدارية..."
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
                  <UserPlus className="w-4 h-4" />
                  إنشاء الحساب وتفعيل الاشتراك
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Office Admin Modal */}
      {isEditModalOpen && selectedAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  تعديل مكتب: {selectedAdmin.office_name} ({selectedAdmin.username})
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
                  <Label className="text-xs">اسم المشرف المسؤول</Label>
                  <Input
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">تغيير كلمة المرور (اختياري)</Label>
                  <Input
                    type="password"
                    placeholder="اتركه فارغاً دون تغيير"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="text-xs h-9 font-mono"
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
                    <option value="annual">سنوية</option>
                    <option value="monthly">شهرية</option>
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
                    className="text-xs h-9 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">الهاتف</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="text-xs h-9 font-mono"
                  />
                </div>
              </div>

              {/* Custom Quota Override */}
              <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-foreground">تخصيص حصة الذكاء الاصطناعي لهذا المكتب</span>
                    <p className="text-[10px] text-muted-foreground">
                      تجاوز الحصة الافتراضية للباقة ({plans.find((p) => p.id === formData.plan_id)?.ai_quota_limit ?? 100} تحليل)
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isCustomQuota}
                    onChange={(e) => handleCustomQuotaToggle(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                </div>

                {formData.isCustomQuota && (
                  <div className="pt-2 border-t border-border/60">
                    <Label className="text-xs">حصة التحليلات الشهرية المخصصة *</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="مثال: 300"
                      value={formData.ai_quota_limit_override}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          ai_quota_limit_override: e.target.value,
                          ai_quota_limit: Number(e.target.value) || 0,
                        })
                      }
                      className="text-xs h-8 font-mono mt-1"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">ملاحظات الاشتراك</Label>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">إنشاء باقة اشتراك جديدة</h3>
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
              <div className="space-y-1">
                <Label className="text-xs">اسم الباقة (بالعربية) *</Label>
                <Input
                  required
                  placeholder="مثال: الباقة الفضية / الأساسية"
                  value={planFormData.name}
                  onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                  className="text-xs h-9"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">معرّف الباقة الإنجليزي (Slug) *</Label>
                  <Input
                    required
                    placeholder="basic / silver / enterprise"
                    value={planFormData.slug}
                    onChange={(e) => setPlanFormData({ ...planFormData, slug: e.target.value })}
                    className="text-xs h-9 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">السعر للعرض (ر.س)</Label>
                  <Input
                    placeholder="199"
                    value={planFormData.price}
                    onChange={(e) => setPlanFormData({ ...planFormData, price: e.target.value })}
                    className="text-xs h-9 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">حصة تحليلات الذكاء الاصطناعي الافتراضية *</Label>
                <Input
                  type="number"
                  required
                  min={0}
                  placeholder="100"
                  value={planFormData.ai_quota_limit}
                  onChange={(e) => setPlanFormData({ ...planFormData, ai_quota_limit: Number(e.target.value) })}
                  className="text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-xs font-bold text-foreground">ميزات وخصائص الباقة:</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={planFormData.features.google_sheets_export ?? true}
                      onChange={(e) =>
                        setPlanFormData({
                          ...planFormData,
                          features: { ...planFormData.features, google_sheets_export: e.target.checked },
                        })
                      }
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                    />
                    <span className="text-[11px] font-medium">تصدير Google Sheets المباشر</span>
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
                      checked={planFormData.features.ai_assistant ?? true}
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
                  <Plus className="w-4 h-4" />
                  إنشاء الباقة
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Subscription Plan Modal */}
      {isEditPlanModalOpen && selectedPlanForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
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
              <div className="space-y-1">
                <Label className="text-xs">اسم الباقة (بالعربية) *</Label>
                <Input
                  required
                  value={planFormData.name}
                  onChange={(e) => setPlanFormData({ ...planFormData, name: e.target.value })}
                  className="text-xs h-9"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">معرّف الباقة (Slug - للقراءة فقط)</Label>
                  <Input
                    disabled
                    value={planFormData.slug}
                    className="text-xs h-9 font-mono bg-muted"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">السعر للعرض (ر.س)</Label>
                  <Input
                    placeholder="199"
                    value={planFormData.price}
                    onChange={(e) => setPlanFormData({ ...planFormData, price: e.target.value })}
                    className="text-xs h-9 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">حصة تحليلات الذكاء الاصطناعي الافتراضية *</Label>
                <Input
                  type="number"
                  required
                  min={0}
                  value={planFormData.ai_quota_limit}
                  onChange={(e) => setPlanFormData({ ...planFormData, ai_quota_limit: Number(e.target.value) })}
                  className="text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-xs font-bold text-foreground">ميزات وخصائص الباقة:</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={planFormData.features.google_sheets_export ?? true}
                      onChange={(e) =>
                        setPlanFormData({
                          ...planFormData,
                          features: { ...planFormData.features, google_sheets_export: e.target.checked },
                        })
                      }
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                    />
                    <span className="text-[11px] font-medium">تصدير Google Sheets المباشر</span>
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
