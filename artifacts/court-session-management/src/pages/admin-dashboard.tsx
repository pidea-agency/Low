import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  UserPlus,
  Trash2,
  Key,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Database,
  Copy,
  Check,
  User,
  Mail,
  Lock,
  Edit2,
  LogOut,
  ExternalLink,
  Save,
  Eye,
  EyeOff,
  Sheet,
  FileCode,
  Sparkles,
  Pause,
  Play,
  Calendar,
  Clock,
  RotateCw,
  RotateCcw,
  Zap,
  Crown,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Link, useLocation } from 'wouter';
import { useGetCurrentUser, useLogout } from '@workspace/api-client-react';
import { validatePassword, PASSWORD_POLICY } from '@workspace/api-zod';
import { useQueryClient } from '@tanstack/react-query';

export interface AppUser {
  id: string;
  username: string;
  email?: string | null;
  role: 'admin' | 'staff';
  display_name?: string | null;
  status?: 'active' | 'suspended';
  subscription_end_date?: string | null;
  subscription_notes?: string | null;
  plan_tier?: 'plus' | 'pro';
  billing_cycle?: 'monthly' | 'annual';
  ai_quota_limit?: number;
  ai_usage_count?: number;
  google_service_account_json?: string | null;
  google_spreadsheet_id?: string | null;
  google_sheet_name?: string | null;
  has_google_service?: boolean;
  created_at?: string;
}

export function getSubscriptionInfo(user: AppUser) {
  const isSuspended = user.status === 'suspended';
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

  if (!user.subscription_end_date) {
    return {
      statusText: 'اشتراك دائم / غير محدد',
      badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      daysLeft: null,
      isExpiringSoon: false,
      isExpired: false,
      isSuspended: false,
    };
  }

  const end = new Date(user.subscription_end_date);
  const now = new Date();
  // Strip time for clean day comparison
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

  if (daysLeft <= 3) {
    return {
      statusText: daysLeft === 0 ? 'ينتهي اليوم ⚠️' : `ينتهي خلال ${daysLeft} ${daysLeft === 1 ? 'يوم' : daysLeft === 2 ? 'يومين' : 'أيام'} ⚠️`,
      badgeColor: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40 font-bold animate-pulse',
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

interface UsersApiResponse {
  isSupabaseConfigured: boolean;
  users: AppUser[];
  error?: string;
}

/**
 * Normalizes any date string (including UTC ISO strings with time) into YYYY-MM-DD
 * so HTML5 date inputs (<input type="date">) populate correctly without appearing blank (F01).
 */
export function normalizeDateForInput(val?: string | null): string {
  if (!val) return '';
  const str = String(val).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  } catch {}
  return '';
}

/**
 * Cleanly formats date for tables, badges, and modal previews without ISO timestamps or awkward wrapping (F06).
 */
export function formatDateDisplay(val?: string | null): string {
  if (!val || !val.trim()) return 'اشتراك دائم (غير محدد)';
  const normalized = normalizeDateForInput(val);
  return normalized || String(val);
}

/**
 * Dynamically generates Supabase SQL script that strictly matches the configured table name (F04),
 * with sanitized identifier and schema check constraints (R06).
 */
export function generateSupabaseSqlScript(rawTableName: string): string {
  const cleanName = rawTableName.trim().replace(/[^a-zA-Z0-9_]/g, '') || 'app_users';
  return `-- أنشئ جدول المستخدمين في Supabase عبر SQL Editor (جدول: ${cleanName}):
create table if not exists public.${cleanName} (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  email text,
  password_hash text not null,
  role text default 'staff' check (role in ('admin', 'staff')),
  display_name text,
  status text default 'active' check (status in ('active', 'suspended')),
  subscription_end_date text,    -- YYYY-MM-DD
  subscription_notes text,
  plan_tier text default 'plus' check (plan_tier in ('plus', 'pro')),
  billing_cycle text default 'annual' check (billing_cycle in ('monthly', 'annual')),
  ai_quota_limit integer default 50,
  ai_usage_count integer default 0,
  google_service_account_json text, -- ملف مفتاح Google Service Account JSON المشفر
  google_spreadsheet_id text,       -- معرف جدول Google Sheets الخاص بالمستخدم
  google_sheet_name text default 'Sessions',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- فهارس سريعة للبحث وعزل الحسابات
create index if not exists idx_${cleanName}_username on public.${cleanName} (username);
create index if not exists idx_${cleanName}_email on public.${cleanName} (email);
create index if not exists idx_${cleanName}_status on public.${cleanName} (status);
create index if not exists idx_${cleanName}_role on public.${cleanName} (role);

-- أوامر تحديث الجدول إذا كان موجوداً مسبقاً في مشروعك:
alter table public.${cleanName} add column if not exists status text default 'active';
alter table public.${cleanName} add column if not exists subscription_end_date text;
alter table public.${cleanName} add column if not exists subscription_notes text;
alter table public.${cleanName} add column if not exists plan_tier text default 'plus';
alter table public.${cleanName} add column if not exists billing_cycle text default 'annual';
alter table public.${cleanName} add column if not exists ai_quota_limit integer default 50;
alter table public.${cleanName} add column if not exists ai_usage_count integer default 0;
alter table public.${cleanName} add column if not exists google_service_account_json text;
alter table public.${cleanName} add column if not exists google_spreadsheet_id text;
alter table public.${cleanName} add column if not exists google_sheet_name text default 'Sessions';
alter table public.${cleanName} add column if not exists updated_at timestamp with time zone default now();`;
}

export default function AdminDashboardPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currentUser } = useGetCurrentUser();
  const logoutMutation = useLogout();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'users' | 'plans' | 'supabase'>('users');

  // Loading states
  const [loading, setLoading] = useState(true);
  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState(false);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);

  // Renewal Modal State
  const [renewDuration, setRenewDuration] = useState<'1m' | '3m' | '6m' | '1y' | 'custom'>('1m');
  const [customRenewDate, setCustomRenewDate] = useState('');

  // Handover Card State for Lawyers
  const [handoverData, setHandoverData] = useState<{
    username: string;
    displayName?: string;
    password?: string;
    loginUrl: string;
    subscriptionEndDate?: string | null;
    subscriptionDurationText?: string;
    planTier?: string;
    billingCycle?: string;
    aiQuota?: number;
  } | null>(null);
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [copiedHandover, setCopiedHandover] = useState(false);

  // Subscription duration choice for new lawyer
  const [newSubscriptionDuration, setNewSubscriptionDuration] = useState<'1m' | '3m' | '6m' | '1y' | 'custom' | 'unlimited'>('1m');

  // Subscription mode for user edit modal: 'date' | 'unlimited'
  const [editSubDurationMode, setEditSubDurationMode] = useState<'date' | 'unlimited'>('date');

  // Helper to compute end date strictly by days: 30 days is strictly 30 days (F02)
  const computeEndDate = (
    dur: '1m' | '3m' | '6m' | '1y' | 'custom' | 'unlimited',
    baseDate: Date = new Date(),
  ): string => {
    if (dur === 'unlimited') return '';
    const d = new Date(baseDate);
    if (dur === '1m') d.setDate(d.getDate() + 30);
    else if (dur === '3m') d.setDate(d.getDate() + 90);
    else if (dur === '6m') d.setDate(d.getDate() + 180);
    else if (dur === '1y') d.setDate(d.getDate() + 365);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Form states for Users
  const [newUser, setNewUser] = useState({
    username: '',
    display_name: '',
    email: '',
    password: '',
    role: 'staff' as 'admin' | 'staff',
    plan_tier: 'plus' as 'plus' | 'pro',
    billing_cycle: 'annual' as 'monthly' | 'annual',
    ai_quota_limit: 50,
    subscription_end_date: computeEndDate('1m'),
    subscription_notes: '',
    google_service_account_json: '',
    google_spreadsheet_id: '',
    google_sheet_name: '',
  });

  const [newPassword, setNewPassword] = useState('');

  const [editUserData, setEditUserData] = useState({
    display_name: '',
    email: '',
    role: 'staff' as 'admin' | 'staff',
    status: 'active' as 'active' | 'suspended',
    plan_tier: 'plus' as 'plus' | 'pro',
    billing_cycle: 'annual' as 'monthly' | 'annual',
    ai_quota_limit: 50,
    ai_usage_count: 0,
    subscription_end_date: '',
    subscription_notes: '',
    google_service_account_json: '',
    google_spreadsheet_id: '',
    google_sheet_name: '',
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Supabase Settings form state
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [supabaseTableName, setSupabaseTableName] = useState('app_users');
  const [supabaseKeyIsSet, setSupabaseKeyIsSet] = useState(false);
  const [maskedSupabaseKey, setMaskedSupabaseKey] = useState('');
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);
  const [savingSupabase, setSavingSupabase] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (res.status === 401 || res.status === 403) {
        throw new Error('غير مصرح لك بالوصول إلى لوحة الإدارة.');
      }
      const data: UsersApiResponse = await res.json();
      setIsSupabaseConfigured(data.isSupabaseConfigured);
      setUsers(data.users || []);
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message || 'فشل جلب قائمة المستخدمين',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSupabaseSettings = async () => {
    try {
      const res = await fetch('/api/settings', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSupabaseUrl(data.supabaseUrl || '');
        setSupabaseTableName(data.supabaseTableName || 'app_users');
        setSupabaseKeyIsSet(data.supabaseKeyIsSet);
        setMaskedSupabaseKey(data.supabaseKey || '');
      }
    } catch {
      // Ignore if fetch settings fails
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSupabaseSettings();
  }, []);

  // Global keyboard shortcuts for accessible modals: Escape key closes active modal (F08)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAddOpen(false);
        setIsEditModalOpen(false);
        setIsRenewModalOpen(false);
        setIsPasswordModalOpen(false);
        setIsDeleteModalOpen(false);
        setIsHandoverModalOpen(false);
        setSelectedUser(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAdminLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        navigate('/admin/login', { replace: true });
      },
      onError: () => {
        toast({ title: 'خطأ', description: 'فشل تسجيل الخروج', variant: 'destructive' });
      },
    });
  };

  const handleCopySql = () => {
    const script = generateSupabaseSqlScript(supabaseTableName);
    navigator.clipboard.writeText(script);
    setCopiedSql(true);
    toast({
      title: 'تم النسخ ✅',
      description: `تم نسخ سكربت SQL الخاص بجدول (${supabaseTableName || 'app_users'}) في Supabase بنجاح.`,
    });
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleSaveSupabaseSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSupabase(true);
    try {
      const payload: Record<string, string> = {
        supabaseUrl: supabaseUrl.trim(),
        supabaseTableName: supabaseTableName.trim() || 'app_users',
      };
      if (supabaseKey.trim()) {
        payload.supabaseKey = supabaseKey.trim();
      }

      const res = await fetch('/api/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل حفظ إعدادات Supabase');
      }

      const updated = await res.json();
      setSupabaseKeyIsSet(updated.supabaseKeyIsSet);
      setMaskedSupabaseKey(updated.supabaseKey || '');
      setSupabaseKey('');

      toast({
        title: 'تم الحفظ بنجاح ✅',
        description: 'تم تحديث بيانات الاتصال بـ Supabase.',
      });

      // Refresh users list and settings status
      await fetchUsers();
      await fetchSupabaseSettings();
    } catch (err: any) {
      toast({
        title: 'خطأ في الحفظ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSavingSupabase(false);
    }
  };

  const handleSaveSupabaseConfig = handleSaveSupabaseSettings;
  const savingConfig = savingSupabase;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username.trim() || !newUser.password.trim()) {
      toast({ title: 'تنبيه', description: 'اسم المستخدم وكلمة المرور مطلوبان.', variant: 'destructive' });
      return;
    }

    const passwordValidation = validatePassword(newUser.password, {
      username: newUser.username,
      email: newUser.email,
    });
    if (!passwordValidation.isValid) {
      toast({
        title: 'تنبيه أمان كلمة المرور',
        description: passwordValidation.message,
        variant: 'destructive',
      });
      return;
    }

    // Optional JSON validation on client
    if (newUser.google_service_account_json.trim()) {
      try {
        const parsed = JSON.parse(newUser.google_service_account_json.trim());
        if (!parsed.client_email || !parsed.private_key) {
          toast({
            title: 'خطأ في ملف Google JSON',
            description: 'الملف يجب أن يحتوي على client_email و private_key.',
            variant: 'destructive',
          });
          return;
        }
      } catch {
        toast({
          title: 'صيغة JSON غير صحيحة',
          description: 'تأكد من نسخ كود Google Service Account JSON بشكل سليم.',
          variant: 'destructive',
        });
        return;
      }
    }

    setActionLoading(true);
    try {
      const payload = {
        ...newUser,
        status: 'active',
        subscription_end_date: newUser.role === 'staff' ? (newUser.subscription_end_date || null) : null,
      };

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل إنشاء المستخدم');
      }

      const savedPassword = newUser.password.trim();
      toast({ title: 'تم التسجيل بنجاح ✅', description: `تم تسجيل المحامي (${data.username}) وتجهيز حسابه للتسليم.` });
      setIsAddOpen(false);

      const durationMap: Record<string, string> = {
        '1m': 'شهر واحد (30 يوماً)',
        '3m': '3 أشهر (ربع سنوي)',
        '6m': '6 أشهر (نصف سنوي)',
        '1y': 'سنة كاملة (365 يوماً)',
        'custom': 'تاريخ مخصص',
        'unlimited': 'اشتراك دائم ومفتوح',
      };

      setHandoverData({
        username: data.username,
        displayName: newUser.display_name || data.username,
        password: savedPassword,
        loginUrl: `${window.location.origin}/login`,
        subscriptionEndDate: newUser.role === 'staff' ? (newUser.subscription_end_date || null) : null,
        subscriptionDurationText: durationMap[newSubscriptionDuration] || 'نشط',
      });
      setIsHandoverModalOpen(true);
      setNewUser({
        username: '',
        display_name: '',
        email: '',
        password: '',
        role: 'staff',
        subscription_end_date: computeEndDate('1m'),
        subscription_notes: '',
        google_service_account_json: '',
        google_spreadsheet_id: '',
        google_sheet_name: '',
      });
      setNewSubscriptionDuration('1m');
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'فشل العملية', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyHandover = () => {
    if (!handoverData) return;
    const planText = handoverData.planTier === 'pro' ? 'برو (Pro) ⭐' : 'بلس (Plus) ⚡';
    const cycleText = handoverData.billingCycle === 'annual' ? 'سنوي (365 يوماً)' : 'شهري (30 يوماً)';
    const text = `السلام عليكم ورحمة الله وبركاته،
أهلاً بك أستاذ ${handoverData.displayName || handoverData.username}،
تم بنجاح تفعيل اشتراكك وحسابك في منصة إدارة الجلسات والدعاوى القضائية:

🔗 رابط تسجيل دخول المحامي:
${handoverData.loginUrl}

👤 اسم المستخدم:
${handoverData.username}

🔑 كلمة المرور:
${handoverData.password || '12345'}

📦 باقة الاشتراك:
${planText} - دورة الفوترة: ${cycleText}

🤖 حصة الذكاء الاصطناعي الشهرية:
${handoverData.aiQuota || 50} تحليل رسائل واستدعاء ذكي شهرياً (معزولة ومستقلة)

📊 التخزين السحابي:
ربط مباشر بـ Google Sheets / Drive لحفظ الجلسات والبيانات فورياً

📅 تفاصيل الاشتراك:
${handoverData.subscriptionEndDate ? `تاريخ الانتهاء: ${handoverData.subscriptionEndDate} (${handoverData.subscriptionDurationText || 'نشط'})` : 'اشتراك دائم ومفتوح'}

حسابك جاهز للاستخدام الفوري. يمكنك تسجيل الدخول ومتابعة جلساتك وقضاياك الآن.`;

    navigator.clipboard.writeText(text);
    setCopiedHandover(true);
    toast({ title: 'تم النسخ بنجاح 📋', description: 'تم نسخ رسالة تسليم الحساب كاملة وجاهزة للإرسال.' });
    setTimeout(() => setCopiedHandover(false), 2500);
  };

  // Reset user's AI quota usage
  const handleResetAiUsage = async (userId: string, username: string) => {
    if (!confirm(`هل أنت متأكد من رغبتك في إعادة تعيين (تصفير) رصيد استهلاك الذكاء الاصطناعي للمحامي (${username})؟`)) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/reset-ai-usage`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تصفير استهلاك الذكاء الاصطناعي');
      }
      toast({
        title: 'تم تصفير الرصيد بنجاح 🔄',
        description: `تمت إعادة تعيين استهلاك الذكاء الاصطناعي لـ (${username}) إلى 0.`,
      });
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle user status: suspend / reactivate
  const handleToggleStatus = async (u: AppUser) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/users/${u.id}/toggle-status`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تحديث حالة الاشتراك');
      }
      toast({
        title: data.status === 'suspended' ? 'تم إيقاف الاشتراك مؤقتاً ⏸️' : 'تم تفعيل الاشتراك بنجاح ▶️',
        description: data.message || `تم تحديث حالة اشتراك (${u.username}).`,
      });
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  // Renewal preview calculation helper for live UI display and submission (F05)
  const getRenewalPreviewInfo = () => {
    if (!selectedUser) return { targetDate: '', isFromCurrentEnd: false, daysCount: 30 };
    const now = new Date();
    let baseDate = now;
    let isFromCurrentEnd = false;
    if (selectedUser.subscription_end_date) {
      const existing = new Date(selectedUser.subscription_end_date);
      if (existing.getTime() > now.getTime()) {
        baseDate = existing;
        isFromCurrentEnd = true;
      }
    }

    if (renewDuration === 'custom') {
      return {
        targetDate: customRenewDate || '',
        isFromCurrentEnd: false,
        daysCount: 0,
      };
    }

    const daysMap: Record<string, number> = { '1m': 30, '3m': 90, '6m': 180, '1y': 365 };
    const daysCount = daysMap[renewDuration] || 30;
    const targetDate = computeEndDate(renewDuration, baseDate);
    return { targetDate, isFromCurrentEnd, daysCount };
  };

  // Renew or extend subscription
  const handleRenewSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const preview = getRenewalPreviewInfo();
    const targetEndDate = preview.targetDate;
    if (!targetEndDate) {
      toast({ title: 'تنبيه', description: 'يرجى تحديد تاريخ انتهاء مخصص.', variant: 'destructive' });
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subscription_end_date: targetEndDate,
          status: 'active', // Reactivate on renew
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تجديد الاشتراك');
      }

      toast({
        title: 'تم تجديد الاشتراك بنجاح 🔄',
        description: `تم تمديد اشتراك (${selectedUser.username}) حتى ${targetEndDate} وتفعيله.`,
      });
      setIsRenewModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword.trim()) return;

    const passwordValidation = validatePassword(newPassword, {
      username: selectedUser.username,
      email: selectedUser.email,
    });
    if (!passwordValidation.isValid) {
      toast({
        title: 'تنبيه أمان كلمة المرور',
        description: passwordValidation.message,
        variant: 'destructive',
      });
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: newPassword.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تحديث كلمة المرور');
      }

      toast({ title: 'تم التحديث ✅', description: `تم تغيير كلمة المرور للمستخدم (${selectedUser.username}) بنجاح.` });
      setIsPasswordModalOpen(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    // Last admin protection on frontend (R03)
    if (selectedUser.role === 'admin' && editUserData.role === 'staff' && adminCount <= 1) {
      toast({
        title: 'إجراء غير مسموح',
        description: 'لا يمكن تحويل المشرف الوحيد النشط إلى محامٍ. يجب تعيين مشرف آخر أولاً.',
        variant: 'destructive',
      });
      return;
    }

    if (editUserData.role === 'staff' && editSubDurationMode === 'date') {
      if (!editUserData.subscription_end_date?.trim()) {
        toast({
          title: 'تنبيه',
          description: 'يرجى إدخال تاريخ انتهاء الاشتراك أو اختيار اشتراك دائم ومفتوح.',
          variant: 'destructive',
        });
        return;
      }
    }

    // Optional JSON validation on client
    if (editUserData.google_service_account_json.trim()) {
      try {
        const parsed = JSON.parse(editUserData.google_service_account_json.trim());
        if (!parsed.client_email || !parsed.private_key) {
          toast({
            title: 'خطأ في ملف Google JSON',
            description: 'الملف يجب أن يحتوي على client_email و private_key.',
            variant: 'destructive',
          });
          return;
        }
      } catch {
        toast({
          title: 'صيغة JSON غير صحيحة',
          description: 'تأكد من نسخ كود Google Service Account JSON بشكل سليم.',
          variant: 'destructive',
        });
        return;
      }
    }

    const payload = {
      ...editUserData,
      subscription_end_date: editUserData.role === 'admin'
        ? null
        : (editSubDurationMode === 'unlimited' ? null : editUserData.subscription_end_date),
    };

    setActionLoading(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تعديل بيانات المستخدم');
      }

      toast({ title: 'تم الحفظ ✅', description: 'تم تحديث بيانات المستخدم وتخصيص حسابه بنجاح.' });
      setIsEditModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'فشل حذف المستخدم');
      }

      toast({ title: 'تم الحذف', description: `تم حذف المستخدم (${selectedUser.username}) بنجاح.` });
      setIsDeleteModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.username.toLowerCase().includes(q) ||
      (u.display_name && u.display_name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.google_spreadsheet_id && u.google_spreadsheet_id.toLowerCase().includes(q))
    );
  });

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const staffLawyers = users.filter((u) => u.role === 'staff');
  const activeStaffCount = staffLawyers.filter((u) => {
    const info = getSubscriptionInfo(u);
    return !info.isSuspended && !info.isExpired;
  }).length;
  const expiringStaffCount = staffLawyers.filter((u) => {
    const info = getSubscriptionInfo(u);
    return info.isExpiringSoon || info.isExpired;
  }).length;
  const suspendedStaffCount = staffLawyers.filter((u) => u.status === 'suspended').length;
  const customSheetsCount = users.filter((u) => u.has_google_service).length;

  const expiringUsersList = staffLawyers.filter((u) => {
    const info = getSubscriptionInfo(u);
    return info.isExpiringSoon || info.isExpired;
  });

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      {/* Top Navigation Bar for Admin Portal */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md"
              style={{ background: 'linear-gradient(135deg, #B88A3B 0%, #8c6422 100%)' }}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base tracking-tight text-foreground">
                  بوابة المشرف العام
                </h1>
                <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]">
                  Admin Gateway
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                المشرف: <strong className="text-foreground">{currentUser?.username || '407171248'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAdminLogout}
              disabled={logoutMutation.isPending}
              className="gap-2 text-xs text-red-500/80 hover:text-red-600 hover:bg-red-500/10 font-bold"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل الخروج</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Stats Grid - Focused on Lawyers & Subscriptions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/5 p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
              <span className="text-xs font-bold">المحامون باشتراك نشط</span>
              <Users className="w-4 h-4" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-foreground">
              {activeStaffCount} <span className="text-sm font-normal text-muted-foreground">/ {staffLawyers.length}</span>
            </p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">اشتراكات سارية وتعمل حالياً</p>
          </div>

          <div className={`rounded-2xl border p-5 shadow-xs space-y-2 transition-all ${
            expiringStaffCount > 0
              ? 'border-amber-500/50 bg-amber-500/15 dark:bg-amber-500/10 ring-1 ring-amber-500/30'
              : 'border-slate-200/90 dark:border-border bg-white dark:bg-card'
          }`}>
            <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
              <span className="text-xs font-bold">اشتراكات تنتهي قريباً (≤ 3 أيام)</span>
              <AlertCircle className={`w-4 h-4 ${expiringStaffCount > 0 ? 'animate-bounce text-amber-600' : ''}`} />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-foreground">{expiringStaffCount}</p>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">تتطلب تذكيراً وتجديداً عاجلاً ⚠️</p>
          </div>

          <div className={`rounded-2xl border p-5 shadow-xs space-y-2 ${
            suspendedStaffCount > 0
              ? 'border-rose-500/40 bg-rose-500/10 dark:bg-rose-500/5'
              : 'border-slate-200/90 dark:border-border bg-white dark:bg-card'
          }`}>
            <div className="flex items-center justify-between text-rose-700 dark:text-rose-400">
              <span className="text-xs font-bold">اشتراكات موقوفة مؤقتاً</span>
              <Pause className="w-4 h-4" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-foreground">{suspendedStaffCount}</p>
            <p className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">حسابات تم إيقافها مؤقتاً ⏸️</p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 dark:border-border bg-white dark:bg-card p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-slate-600 dark:text-muted-foreground">
              <span className="text-xs font-bold">إجمالي الحسابات المسجلة</span>
              <CheckCircle2 className="w-4 h-4 text-primary" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-foreground">{users.length}</p>
            <p className="text-[11px] text-slate-500 dark:text-muted-foreground font-medium">مشرفون ومحامون بالمنظومة</p>
          </div>
        </div>

        {/* Top Subscription Expiration Alert Banner (≤ 3 days) */}
        {expiringUsersList.length > 0 && (
          <div className="rounded-2xl border border-amber-500/50 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-500/5 p-5 shadow-sm space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/25 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertCircle className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-amber-950 dark:text-amber-100 flex items-center gap-2">
                    <span>تنبيه تلقائي: اشتراكات محامين قريبة من الانتهاء (3 أيام أو أقل ⚠️)</span>
                    <Badge className="bg-amber-600 text-white font-bold text-[10px] px-2 py-0.5">
                      {expiringUsersList.length} محامي
                    </Badge>
                  </h3>
                  <p className="text-xs text-amber-900/80 dark:text-amber-300/80 font-medium">
                    المحامون المذكورون أدناه على وشك انتهاء فترة اشتراكهم أو انتهت بالفعل. يمكنك تمديد الاشتراك وتفعيله بضغطة زر واحدة:
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-1">
              {expiringUsersList.map((u) => {
                const info = getSubscriptionInfo(u);
                return (
                  <div
                    key={u.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-amber-500/40 text-xs shadow-xs"
                  >
                    <User className="w-3.5 h-3.5 text-amber-600" />
                    <span className="font-bold text-foreground">{u.display_name || u.username}</span>
                    <span className={`text-[11px] font-mono font-bold ${info.isExpired ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      ({info.statusText})
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(u);
                        setRenewDuration('1m');
                        setCustomRenewDate('');
                        setIsRenewModalOpen(true);
                      }}
                      className="h-6 px-2 text-[10px] gap-1 font-bold bg-amber-500/10 hover:bg-amber-500/25 text-amber-800 dark:text-amber-200 border-amber-500/40"
                    >
                      <RotateCw className="w-2.5 h-2.5" />
                      <span>تجديد الآن 🔄</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-border pb-1">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'users'
                ? 'border-amber-500 text-amber-500 bg-amber-500/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>إدارة حسابات المحامين والمشتركين</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {users.length}
            </Badge>
          </button>

          <button
            onClick={() => setActiveTab('supabase')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'supabase'
                ? 'border-sky-500 text-sky-500 bg-sky-500/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>إعدادات قاعدة بيانات المستخدمين (Supabase)</span>
            <span
              className={`w-2 h-2 rounded-full ${
                isSupabaseConfigured ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </button>

          <button
            onClick={() => setActiveTab('plans')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'plans'
                ? 'border-emerald-500 text-emerald-500 bg-emerald-500/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <span>باقات وخطط الاشتراك (Plus & Pro) 💎</span>
          </button>
        </div>

        {/* Tab 1: User Management */}
        {activeTab === 'users' && (
          <div className="space-y-4 fade-in-up">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  قائمة المحامين والمشتركين المصرح لهم
                </h2>
                <p className="text-xs text-muted-foreground">
                  إضافة حسابات مخصصة، ربط Google Service Account وشيت مستقل لكل مستخدم، وتعديل الصلاحيات
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchUsers}
                  disabled={loading}
                  className="gap-2 text-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>تحديث</span>
                </Button>

                <Button
                  size="sm"
                  onClick={() => setIsAddOpen(true)}
                  className="gap-2 text-xs text-white"
                  style={{ background: 'linear-gradient(135deg, #B88A3B 0%, #966c25 100%)' }}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>إضافة مستخدم جديد</span>
                </Button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute start-3 inset-y-0 my-auto text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو البريد أو اسم المستخدم أو معرف الشيت..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-9 text-sm h-9"
              />
            </div>

            {/* Users Table */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs sm:text-sm">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <tr>
                      <th className="py-3 px-3 text-start">المستخدم</th>
                      <th className="py-3 px-3 text-start">الاسم الظاهر</th>
                      <th className="py-3 px-3 text-start">الصلاحية</th>
                      <th className="py-3 px-3 text-start">الباقة والفوترة 📦</th>
                      <th className="py-3 px-3 text-start">حالة الاشتراك ⚖️</th>
                      <th className="py-3 px-3 text-start">استهلاك الذكاء الاصطناعي 🤖</th>
                      <th className="py-3 px-3 text-start">تاريخ الانتهاء</th>
                      <th className="py-3 px-3 text-start">قاعدة Google Sheets</th>
                      <th className="py-3 px-3 text-end">الإجراءات والتحكم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                            <span className="text-xs">جارٍ جلب الحسابات...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <Users className="w-8 h-8 opacity-30" />
                            <p className="text-sm font-medium">لا توجد حسابات مطابقة</p>
                            <p className="text-xs">يمكنك إضافة مستخدم جديد بالضغط على زر الإضافة أعلاه.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isCurrent = currentUser?.username === u.username;
                        const subInfo = getSubscriptionInfo(u);

                        return (
                          <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-3 font-mono font-bold text-foreground">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-sans font-bold text-xs shrink-0">
                                  {u.username.slice(0, 2).toUpperCase()}
                                </div>
                                <span>{u.username}</span>
                                {isCurrent && (
                                  <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30">
                                    حسابك
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-muted-foreground font-medium">
                              {u.display_name || '—'}
                            </td>
                            <td className="py-3 px-3">
                              {u.role === 'admin' ? (
                                <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-xs">
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>مشرف (Admin)</span>
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1 text-xs">
                                  <User className="w-3 h-3 text-emerald-500" />
                                  <span>محامي</span>
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {u.role === 'admin' ? (
                                <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold text-xs">
                                  باقة المشرف (غير محدودة)
                                </Badge>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    {u.plan_tier === 'pro' ? (
                                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 text-[11px] font-bold">
                                        <Crown className="w-3 h-3 text-amber-500" />
                                        <span>برو (Pro)</span>
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 gap-1 text-[11px] font-bold">
                                        <Zap className="w-3 h-3 text-sky-500" />
                                        <span>بلس (Plus)</span>
                                      </Badge>
                                    )}
                                    <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
                                      {u.billing_cycle === 'annual' ? 'سنوي 📅' : 'شهري 🗓️'}
                                    </Badge>
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {u.role === 'admin' ? (
                                <Badge variant="outline" className="text-xs border-slate-300 dark:border-slate-700">
                                  دائم (مشرف)
                                </Badge>
                              ) : (
                                <Badge className={`${subInfo.badgeColor} gap-1 text-xs`}>
                                  {subInfo.isSuspended ? (
                                    <Pause className="w-3 h-3" />
                                  ) : subInfo.isExpiringSoon ? (
                                    <AlertCircle className="w-3 h-3" />
                                  ) : subInfo.isExpired ? (
                                    <AlertTriangle className="w-3 h-3" />
                                  ) : (
                                    <CheckCircle2 className="w-3 h-3" />
                                  )}
                                  <span>{subInfo.statusText}</span>
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {u.role === 'admin' ? (
                                <span className="text-xs text-muted-foreground font-mono">غير محدود (∞)</span>
                              ) : (
                                <div className="space-y-1 min-w-[130px]">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-mono font-bold text-foreground">
                                      {u.ai_usage_count || 0} / {u.ai_quota_limit ?? 50}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleResetAiUsage(u.id, u.username)}
                                      disabled={actionLoading}
                                      title="تصفير استهلاك الذكاء الاصطناعي"
                                      className="h-5 px-1.5 text-[10px] gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                    >
                                      <RotateCcw className="w-2.5 h-2.5" />
                                      <span>تصفير</span>
                                    </Button>
                                  </div>
                                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className={`h-full transition-all duration-300 ${
                                        (u.ai_usage_count || 0) >= (u.ai_quota_limit ?? 50)
                                          ? 'bg-rose-500'
                                          : (u.ai_usage_count || 0) >= ((u.ai_quota_limit ?? 50) * 0.8)
                                          ? 'bg-amber-500'
                                          : 'bg-emerald-500'
                                      }`}
                                      style={{
                                        width: `${Math.min(100, Math.round(((u.ai_usage_count || 0) / ((u.ai_quota_limit ?? 50) || 1)) * 100))}%`,
                                      }}
                                    />
                                  </div>
                                  {(u.ai_usage_count || 0) >= (u.ai_quota_limit ?? 50) && (
                                    <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
                                      تم استهلاك الحصة ⚠️
                                    </p>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {u.role === 'admin' ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : u.subscription_end_date ? (
                                <div className="space-y-0.5">
                                  <span className="font-mono text-xs text-foreground font-semibold whitespace-nowrap">
                                    {formatDateDisplay(u.subscription_end_date)}
                                  </span>
                                  {u.subscription_notes && (
                                    <p className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={u.subscription_notes}>
                                      {u.subscription_notes}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">غير محدد (مفتوح)</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {u.has_google_service ? (
                                <div className="space-y-0.5">
                                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px]">
                                    <Sparkles className="w-3 h-3" />
                                    <span>شيت مخصص</span>
                                  </Badge>
                                  {u.google_spreadsheet_id && (
                                    <p className="font-mono text-[10px] text-muted-foreground truncate max-w-[110px]" title={u.google_spreadsheet_id}>
                                      ID: {u.google_spreadsheet_id.slice(0, 8)}...
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  <span>الشيت العام</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-end">
                              <div className="flex items-center justify-end gap-1.5">
                                {u.role === 'staff' && (
                                  <>
                                    {u.status === 'suspended' ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        title="إعادة تفعيل الاشتراك فوراً"
                                        aria-label={`إعادة تفعيل اشتراك ${u.display_name || u.username}`}
                                        onClick={() => handleToggleStatus(u)}
                                        disabled={actionLoading}
                                        className="h-8 px-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 font-bold gap-1"
                                      >
                                        <Play className="w-3.5 h-3.5 fill-current" />
                                        <span>تفعيل ▶️</span>
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        title="إيقاف الاشتراك مؤقتاً"
                                        aria-label={`إيقاف اشتراك ${u.display_name || u.username}`}
                                        onClick={() => handleToggleStatus(u)}
                                        disabled={actionLoading}
                                        className="h-8 px-2 text-xs text-rose-700 dark:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 font-semibold gap-1"
                                      >
                                        <Pause className="w-3.5 h-3.5 fill-current" />
                                        <span>إيقاف ⏸️</span>
                                      </Button>
                                    )}

                                    <Button
                                      variant="outline"
                                      size="sm"
                                      title="تجديد أو تمديد فترة الاشتراك"
                                      aria-label={`تجديد اشتراك ${u.display_name || u.username}`}
                                      onClick={() => {
                                        setSelectedUser(u);
                                        setRenewDuration('1m');
                                        setCustomRenewDate('');
                                        setIsRenewModalOpen(true);
                                      }}
                                      className="h-8 px-2 text-xs text-amber-800 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 font-bold gap-1"
                                    >
                                      <RotateCw className="w-3.5 h-3.5" />
                                      <span>تجديد 🔄</span>
                                    </Button>
                                  </>
                                )}

                                <Button
                                  variant="outline"
                                  size="sm"
                                  title="تسليم بيانات الحساب للمحامي"
                                  aria-label={`تسليم بيانات الحساب لـ ${u.display_name || u.username}`}
                                  onClick={() => {
                                    setHandoverData({
                                      username: u.username,
                                      displayName: u.display_name || u.username,
                                      password: '12345',
                                      loginUrl: `${window.location.origin}/login`,
                                      subscriptionEndDate: u.subscription_end_date || null,
                                      subscriptionDurationText: subInfo.statusText,
                                      planTier: u.plan_tier || 'plus',
                                      billingCycle: u.billing_cycle || 'annual',
                                      aiQuota: u.ai_quota_limit ?? 50,
                                    });
                                    setIsHandoverModalOpen(true);
                                  }}
                                  className="h-8 px-2.5 gap-1.5 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 font-semibold"
                                >
                                  <Copy className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>تسليم</span>
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="تغيير كلمة المرور"
                                  aria-label={`تغيير كلمة المرور للمستخدم ${u.username}`}
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setIsPasswordModalOpen(true);
                                  }}
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
                                >
                                  <Key className="w-4 h-4" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="تعديل المستخدم والاشتراك"
                                  aria-label={`تعديل بيانات المستخدم ${u.username}`}
                                  onClick={() => {
                                    setSelectedUser(u);
                                    const hasEndDate = Boolean(u.subscription_end_date && u.subscription_end_date.trim());
                                    setEditSubDurationMode(hasEndDate ? 'date' : 'unlimited');
                                    setEditUserData({
                                      display_name: u.display_name || '',
                                      email: u.email || '',
                                      role: u.role,
                                      status: u.status || 'active',
                                      plan_tier: u.plan_tier || 'plus',
                                      billing_cycle: u.billing_cycle || 'annual',
                                      ai_quota_limit: u.ai_quota_limit ?? 50,
                                      ai_usage_count: u.ai_usage_count || 0,
                                      subscription_end_date: normalizeDateForInput(u.subscription_end_date),
                                      subscription_notes: u.subscription_notes || '',
                                      google_service_account_json: '',
                                      google_spreadsheet_id: u.google_spreadsheet_id || '',
                                      google_sheet_name: u.google_sheet_name || '',
                                    });
                                    setIsEditModalOpen(true);
                                  }}
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title={
                                    isCurrent
                                      ? 'لا يمكنك حذف حساب المشرف المسجل به حالياً'
                                      : u.role === 'admin' && activeAdminCount <= 1
                                      ? 'لا يمكن حذف المشرف الوحيد النشط'
                                      : 'حذف المستخدم'
                                  }
                                  aria-label={`حذف المستخدم ${u.username}`}
                                  disabled={isCurrent || (u.role === 'admin' && activeAdminCount <= 1)}
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setIsDeleteModalOpen(true);
                                  }}
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 disabled:opacity-30"
                                >
                                  <Trash2 className="w-4 h-4" />
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

        {/* Tab 2: Supabase User Database Configuration */}
        {activeTab === 'supabase' && (
          <div className="space-y-6 fade-in-up">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Database className="w-5 h-5 text-sky-500" />
                  <span>تهيئة والاتصال بقاعدة بيانات Supabase</span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  إعداد ربط جدول المستخدمين والاشتراكات المركزي، واستعراض سكربت إنشاء المخطط البرمجي تلقائياً
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge
                  className={`gap-1.5 text-xs py-1 px-3 ${
                    isSupabaseConfigured
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isSupabaseConfigured ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  <span>{isSupabaseConfigured ? 'متصل بقاعدة البيانات' : 'قيد التهيئة (محلي)'}</span>
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form Settings */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span>بيانات الاتصال ومفتاح الصلاحية المرتفعة</span>
                </h3>

                <form onSubmit={handleSaveSupabaseSettings} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="supabase_url_input" className="text-xs font-semibold">
                      رابط مشروع Supabase (Project URL) *
                    </Label>
                    <Input
                      id="supabase_url_input"
                      type="url"
                      placeholder="https://xyzcompany.supabase.co"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      className="font-mono text-xs"
                      dir="ltr"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="supabase_key_input" className="text-xs font-semibold">
                        مفتاح الخدمة السري (Service Role / Secret Key) {supabaseKeyIsSet ? '(محفوظ ومحمي)' : '*'}
                      </Label>
                      <button
                        type="button"
                        onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                        aria-label={showSupabaseKey ? 'إخفاء مفتاح الخدمة' : 'إظهار مفتاح الخدمة'}
                        className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        {showSupabaseKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{showSupabaseKey ? 'إخفاء' : 'إظهار'}</span>
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="supabase_key_input"
                        type={showSupabaseKey ? 'text' : 'password'}
                        placeholder={supabaseKeyIsSet ? "المفتاح السري محفوظ ومحمي في الخادم (اتركه فارغاً للإبقاء عليه)..." : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
                        value={supabaseKey}
                        onChange={(e) => setSupabaseKey(e.target.value)}
                        className="font-mono text-xs pe-10"
                        dir="ltr"
                        required={!supabaseKeyIsSet}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      ⚠️ يُحفظ هذا المفتاح فقط على الخادم الآمن ولا يُكشف في المتصفح العام أبداً، ويُستخدم لإدارة حسابات المحامين واشتراكاتهم.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="supabase_table_input" className="text-xs font-semibold">
                      اسم جدول المستخدمين (Table Name) *
                    </Label>
                    <Input
                      id="supabase_table_input"
                      placeholder="app_users"
                      value={supabaseTableName}
                      onChange={(e) => setSupabaseTableName(e.target.value)}
                      className="font-mono text-xs"
                      dir="ltr"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">
                      يتحدث كود SQL التلقائي بجانبه فوراً ليتطابق تماماً مع اسم الجدول المحدد هنا.
                    </p>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={savingSupabase}
                      className="w-full text-xs text-white gap-2"
                      style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }}
                    >
                      <Save className="w-4 h-4" />
                      <span>{savingSupabase ? 'جارٍ حفظ الإعدادات...' : 'حفظ إعدادات الربط بقاعدة البيانات'}</span>
                    </Button>
                  </div>
                </form>
              </div>

              {/* Dynamic SQL Generator */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-emerald-500" />
                      <h3 className="text-sm font-bold text-foreground">
                        سكربت SQL التلقائي لإنشاء الجدول والفهارس
                      </h3>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopySql}
                      className="h-7 text-xs gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                    >
                      {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSql ? 'تم النسخ!' : 'نسخ كود SQL'}</span>
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    انسخ هذا الكود والصقه في <strong>SQL Editor</strong> داخل لوحة تحكم Supabase الخاصة بك لإنشاء جدول <code>{supabaseTableName || 'app_users'}</code> مع كافة القيود والفهارس الموصى بها:
                  </p>

                  <div className="relative rounded-xl border border-border bg-muted/60 p-3 max-h-[360px] overflow-y-auto font-mono text-[11px]" dir="ltr">
                    <pre className="text-muted-foreground whitespace-pre leading-relaxed select-all">
                      {generateSupabaseSqlScript(supabaseTableName)}
                    </pre>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-sky-500/20 bg-sky-500/5 text-xs text-muted-foreground flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                  <span>
                    السكربت يشتمل على قيود فحص صحة الأدوار (admin / staff) والحالات (active / suspended) وتفعيل RLS لضمان الحماية القصوى.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Plans & Pricing (Plus & Pro) */}
        {activeTab === 'plans' && (
          <div className="space-y-8 fade-in-up">
            {/* Header info */}
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs px-3 py-1 font-bold">
                باقات الاشتراك الرسمية للمنظومة ⚖️
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                اختر الباقة المناسبة لاحتياجات مكتبك أو ممارستك القانونية
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                خطط مرنة مبنية على <strong>الربط المباشر بـ Google Drive (Excel)</strong> وبدون تعقيدات قواعد البيانات، مع <strong>تكامل الذكاء الاصطناعي المركزي</strong> للمشرف وعزل كامل للحصص.
              </p>
            </div>

            {/* Architecture Explanatory Banner */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span>المحددات التقنية وآلية عمل الاشتراكات في المنظومة:</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 space-y-1.5">
                  <div className="font-bold text-sky-700 dark:text-sky-300 flex items-center gap-1.5 text-sm">
                    <Zap className="w-4 h-4" />
                    <span>الذكاء الاصطناعي المركزي</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    يعمل الذكاء الاصطناعي مركزياً عبر حساب المشرف العام. لا يدفع المحامي أي تكاليف توكنز، بل يستفيد مباشرة من حصته المحددة في باقته.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
                  <div className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 text-sm">
                    <ShieldCheck className="w-4 h-4" />
                    <span>عزل الحصص (Isolation)</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    لكل مشترك عداد وحصة ذكاء اصطناعي مستقلة تماماً داخل النظام لضمان عدم استهلاك مستخدم لرصيد مستخدم آخر نهائياً.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1.5">
                  <div className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 text-sm">
                    <Sheet className="w-4 h-4" />
                    <span>Google Drive و Excel</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    تخزين واستدعاء البيانات لحظي من شيتات Google Sheets على درايف كقاعدة بيانات مرنة ومباشرة دون الحاجة لأي قواعد بيانات معقدة.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-1.5">
                  <div className="font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>الإيقاف التلقائي الصارم</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    عند انتهاء الاشتراك، يتوقف فوراً: 1) تصدير وتعديل التقارير، 2) تحليل الرسائل بالذكاء الاصطناعي، 3) اتصال النظام ببيانات الإكسل.
                  </p>
                </div>
              </div>
            </div>

            {/* Plans Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Plan 1: Plus */}
              <div className="rounded-3xl border-2 border-sky-500/40 bg-card p-8 shadow-lg flex flex-col justify-between space-y-6 relative overflow-hidden">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 text-xs px-3 py-1 font-bold gap-1">
                      <Zap className="w-3.5 h-3.5" />
                      <span>باقة بلس (Plus Plan)</span>
                    </Badge>
                    <span className="text-xs font-bold text-muted-foreground">للمحامي المستقل</span>
                  </div>

                  <div>
                    <h3 className="text-2xl font-black text-foreground">باقة المحامي بلس ⚡</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      الخيار الأساسي المتكامل لإدارة الجلسات والدعاوى الفردية بكفاءة عالية.
                    </p>
                  </div>

                  {/* Pricing Cycles */}
                  <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-bold text-muted-foreground">الاشتراك السنوي:</span>
                      <span className="text-lg font-black text-foreground">فوترة سنوية <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400 font-bold">(وفر شهرين)</span></span>
                    </div>
                    <div className="flex items-baseline justify-between pt-1 border-t border-border/50">
                      <span className="text-xs font-bold text-muted-foreground">الاشتراك الشهري:</span>
                      <span className="text-sm font-bold text-foreground">فوترة شهرية متجددة</span>
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="space-y-2.5 pt-2">
                    <span className="text-xs font-extrabold text-foreground uppercase tracking-wider">
                      المزايا والخصائص المشمولة:
                    </span>
                    <ul className="space-y-2 text-xs text-muted-foreground">
                      <li className="flex items-start gap-2 text-foreground font-medium">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span><strong>50 تحليل ذكي للرسائل (SMS) شهرياً</strong> عبر الذكاء الاصطناعي المركزي للمشرف.</span>
                      </li>
                      <li className="flex items-start gap-2 text-foreground font-medium">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span><strong>ربط مباشر بـ Google Sheets / Drive</strong> لتخزين واستدعاء الجلسات فورياً.</span>
                      </li>
                      <li className="flex items-start gap-2 text-foreground font-medium">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span><strong>إنشاء وتحميل تقارير الجلسات (PDF / Excel)</strong> للطباعة والمشاركة مع الموكلين.</span>
                      </li>
                      <li className="flex items-start gap-2 text-foreground font-medium">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span><strong>متابعة الجلسات والتوكيلات والمهام والأحكام</strong> بدقة وتنظيم.</span>
                      </li>
                      <li className="flex items-start gap-2 text-foreground font-medium">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span><strong>تنبيهات استباقية</strong> قبل موعد الجلسة وقبل انتهاء فترة الاشتراك.</span>
                      </li>
                      <li className="flex items-start gap-2 text-foreground font-medium">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span><strong>حصة معزولة ومستقلة تماماً</strong> تضمن عدم التداخل مع أي مستخدم آخر.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setNewUser({ ...newUser, plan_tier: 'plus', ai_quota_limit: 50, billing_cycle: 'annual' });
                    setIsAddOpen(true);
                  }}
                  className="w-full h-11 text-sm font-bold bg-sky-600 hover:bg-sky-700 text-white gap-2 shadow-md"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>تسجيل مشترك جديد بباقة Plus</span>
                </Button>
              </div>

              {/* Plan 2: Pro */}
              <div className="rounded-3xl border-2 border-amber-500 bg-card p-8 shadow-xl flex flex-col justify-between space-y-6 relative overflow-hidden ring-2 ring-amber-500/20">
                <div className="absolute top-0 end-0 bg-gradient-to-l from-amber-500 to-amber-600 text-white text-[10px] font-black px-4 py-1 rounded-bl-xl shadow-xs">
                  الخيار الأكثر تميزاً للمكاتب ⭐
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/40 text-xs px-3 py-1 font-bold gap-1">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      <span>باقة برو (Pro Plan)</span>
                    </Badge>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">للمكاتب والشركات</span>
                  </div>

                  <div>
                    <h3 className="text-2xl font-black text-foreground">باقة المكتب برو 👑</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      الحل الشامل والمتقدم لمكاتب المحاماة التي تتطلب استهلاكاً مضاعفاً وتخصيصاً كاملاً.
                    </p>
                  </div>

                  {/* Pricing Cycles */}
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-300">الاشتراك السنوي:</span>
                      <span className="text-lg font-black text-amber-950 dark:text-amber-100">فوترة سنوية <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400 font-bold">(أفضل قيمة + دعم VIP)</span></span>
                    </div>
                    <div className="flex items-baseline justify-between pt-1 border-t border-amber-500/20">
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-300">الاشتراك الشهري:</span>
                      <span className="text-sm font-bold text-amber-950 dark:text-amber-100">فوترة شهرية مرنة</span>
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="space-y-2.5 pt-2">
                    <span className="text-xs font-extrabold text-foreground uppercase tracking-wider">
                      كافة مزايا باقة Plus بالإضافة إلى:
                    </span>
                    <ul className="space-y-2 text-xs text-muted-foreground">
                      <li className="flex items-start gap-2 text-foreground font-medium">
                        <Check className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span><strong>300 تحليل ذكي للرسائل (SMS) شهرياً</strong> (حصة ضخمة ومضاعفة 6 مرات).</span>
                      </li>
                      <li className="flex items-start gap-2 text-foreground font-medium">
                        <Check className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span><strong>إمكانية تخصيص Google Sheet و Service Account منفصل</strong> خاص بمكتب المحامي.</span>
                      </li>
                      <li className="flex items-start gap-2 text-foreground font-medium">
                        <Check className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span><strong>إمكانية تصفير أو شحن رصيد الذكاء الاصطناعي</strong> في أي وقت بضغطة زر من المشرف.</span>
                      </li>
                      <li className="flex items-start gap-2 text-foreground font-medium">
                        <Check className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span><strong>إدارة متقدمة للأحكام القضائية والمطالبات المالية</strong> والتنفيذ.</span>
                      </li>
                      <li className="flex items-start gap-2 text-foreground font-medium">
                        <Check className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span><strong>رسالة تسليم اشتراك احترافية مخصصة</strong> جاهزة للإرسال للمحامي عبر واتساب.</span>
                      </li>
                      <li className="flex items-start gap-2 text-foreground font-medium">
                        <Check className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span><strong>أولوية قصوى ودعم فني متواصل</strong> مع تحديثات وميزات حصرية.</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setNewUser({ ...newUser, plan_tier: 'pro', ai_quota_limit: 300, billing_cycle: 'annual' });
                    setIsAddOpen(true);
                  }}
                  className="w-full h-11 text-sm font-bold text-white gap-2 shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #B88A3B 0%, #8c6422 100%)' }}
                >
                  <Crown className="w-4 h-4" />
                  <span>تسجيل مشترك جديد بباقة Pro 👑</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal: Add User with Google Sheets & Service Account Customization */}
      {isAddOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-user-modal-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          dir="rtl"
        >
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 id="add-user-modal-title" className="text-base font-bold flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                <span>إضافة مستخدم جديد وتخصيص حسابه</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                aria-label="إغلاق نافذة الإضافة"
                className="text-muted-foreground hover:text-foreground text-sm font-bold px-2 py-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 max-h-[75vh] overflow-y-auto pe-1">
              {/* Account Basic Info */}
              <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/20">
                <div className="space-y-1">
                  <Label htmlFor="new_user_username" className="text-xs font-semibold">
                    اسم المستخدم (Username) *
                  </Label>
                  <Input
                    id="new_user_username"
                    required
                    placeholder="e.g. lawyer1 أو 5128"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('يرجى إدخال اسم المستخدم')}
                    onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                    className="font-mono text-sm"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="new_user_display_name" className="text-xs font-semibold">
                    الاسم الظاهر
                  </Label>
                  <Input
                    id="new_user_display_name"
                    placeholder="e.g. أ. عمر شاهين"
                    value={newUser.display_name}
                    onChange={(e) => setNewUser({ ...newUser, display_name: e.target.value })}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="new_user_email" className="text-xs font-semibold">
                    البريد الإلكتروني (اختياري)
                  </Label>
                  <Input
                    id="new_user_email"
                    type="email"
                    placeholder="lawyer@office.com"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="font-mono text-sm"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="new_user_password" className="text-xs font-semibold">
                    كلمة المرور * (8 خانات على الأقل)
                  </Label>
                  <Input
                    id="new_user_password"
                    required
                    type="password"
                    minLength={PASSWORD_POLICY.MIN_LENGTH}
                    maxLength={PASSWORD_POLICY.MAX_LENGTH}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity(`يرجى إدخال كلمة مرور من ${PASSWORD_POLICY.MIN_LENGTH} خانات على الأقل`)}
                    onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                    className="font-mono text-sm"
                    dir="ltr"
                  />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {PASSWORD_POLICY.HELPER_TEXT_AR}
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">الصلاحية (Role)</Label>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setNewUser({ ...newUser, role: 'staff' })}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        newUser.role === 'staff'
                          ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>محامي (المشترك)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewUser({ ...newUser, role: 'admin' })}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        newUser.role === 'admin'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>مشرف (Admin)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Subscription Duration & Plan Settings (For Lawyers) */}
              {newUser.role === 'staff' && (
                <div className="space-y-4 p-4 rounded-xl border border-amber-500/35 bg-amber-500/5">
                  <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 font-bold text-xs">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>باقة الاشتراك والذكاء الاصطناعي للمحامي</span>
                    </div>
                    <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px]">
                      تنبيه آلي قبل 3 أيام ⚠️
                    </Badge>
                  </div>

                  {/* Plan Tier Choice */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">باقة الاشتراك (Plan Tier):</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewUser({ ...newUser, plan_tier: 'plus', ai_quota_limit: 50 })}
                        className={`p-2.5 rounded-xl border text-start space-y-1 transition-all ${
                          newUser.plan_tier === 'plus'
                            ? 'border-sky-500 bg-sky-500/15 text-sky-950 dark:text-sky-100 ring-1 ring-sky-500/40 shadow-xs'
                            : 'border-border text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400">
                          <Zap className="w-3.5 h-3.5" />
                          <span>باقة بلس (Plus)</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">50 تحليل رسائل/شهر</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewUser({ ...newUser, plan_tier: 'pro', ai_quota_limit: 300 })}
                        className={`p-2.5 rounded-xl border text-start space-y-1 transition-all ${
                          newUser.plan_tier === 'pro'
                            ? 'border-amber-500 bg-amber-500/20 text-amber-950 dark:text-amber-100 ring-1 ring-amber-500/40 shadow-xs'
                            : 'border-border text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                          <Crown className="w-3.5 h-3.5" />
                          <span>باقة برو (Pro) 👑</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">300 تحليل رسائل/شهر</p>
                      </button>
                    </div>
                  </div>

                  {/* Billing Cycle Choice */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">دورة الفوترة (Billing Cycle):</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNewUser({ ...newUser, billing_cycle: 'annual', subscription_end_date: computeEndDate('1y') });
                          setNewSubscriptionDuration('1y');
                        }}
                        className={`p-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          newUser.billing_cycle === 'annual'
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-extrabold shadow-xs'
                            : 'border-border text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                        <span>اشتراك سنوي (365 يوماً)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setNewUser({ ...newUser, billing_cycle: 'monthly', subscription_end_date: computeEndDate('1m') });
                          setNewSubscriptionDuration('1m');
                        }}
                        className={`p-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          newUser.billing_cycle === 'monthly'
                            ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300 font-extrabold shadow-xs'
                            : 'border-border text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5 text-sky-500" />
                        <span>اشتراك شهري (30 يوماً)</span>
                      </button>
                    </div>
                  </div>

                  {/* AI Quota Limit */}
                  <div className="space-y-1">
                    <Label htmlFor="new_user_ai_quota" className="text-xs font-semibold flex items-center justify-between">
                      <span>رصيد الذكاء الاصطناعي الشهري (حصة معزولة للمحامي):</span>
                      <span className="text-[10px] font-mono text-muted-foreground">رسائل SMS شهرياً</span>
                    </Label>
                    <Input
                      id="new_user_ai_quota"
                      type="number"
                      min={1}
                      max={9999}
                      value={newUser.ai_quota_limit}
                      onChange={(e) => setNewUser({ ...newUser, ai_quota_limit: parseInt(e.target.value) || 50 })}
                      className="font-mono text-sm"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs font-semibold">مدة الاشتراك الممنوحة:</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { id: '1m', label: 'شهر واحد (30 يوماً)' },
                        { id: '3m', label: '3 أشهر (ربع سنوي)' },
                        { id: '6m', label: '6 أشهر (نصف سنوي)' },
                        { id: '1y', label: 'سنة كاملة (365 يوماً)' },
                        { id: 'unlimited', label: 'اشتراك دائم ومفتوح' },
                        { id: 'custom', label: 'تاريخ مخصص 📅' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setNewSubscriptionDuration(opt.id as any);
                            if (opt.id !== 'custom') {
                              setNewUser({ ...newUser, subscription_end_date: computeEndDate(opt.id as any) });
                            }
                          }}
                          className={`p-2 rounded-lg border text-xs font-bold transition-all text-center ${
                            newSubscriptionDuration === opt.id
                              ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-xs'
                              : 'border-border text-muted-foreground hover:bg-muted/50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {newSubscriptionDuration !== 'unlimited' && (
                    <div className="space-y-1">
                      <Label htmlFor="new_user_sub_end_date" className="text-xs font-semibold flex items-center justify-between">
                        <span>تاريخ انتهاء الاشتراك (Subscription End Date) * :</span>
                        <span className="text-[10px] text-muted-foreground">صيغة YYYY-MM-DD</span>
                      </Label>
                      <Input
                        id="new_user_sub_end_date"
                        type="date"
                        required={newSubscriptionDuration === 'custom'}
                        min={new Date().toISOString().split('T')[0]}
                        value={newUser.subscription_end_date}
                        onChange={(e) => {
                          setNewUser({ ...newUser, subscription_end_date: e.target.value });
                          setNewSubscriptionDuration('custom');
                        }}
                        onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('يرجى تحديد تاريخ انتهاء الاشتراك المخصص')}
                        onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                        className="font-mono text-sm"
                        dir="ltr"
                      />
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label htmlFor="new_user_sub_notes" className="text-xs font-semibold">
                      ملاحظات الاشتراك (اختياري)
                    </Label>
                    <Input
                      id="new_user_sub_notes"
                      placeholder="e.g. اشتراك سنوي - مكتب المستشار في الرياض"
                      value={newUser.subscription_notes}
                      onChange={(e) => setNewUser({ ...newUser, subscription_notes: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Per-User Google Sheets & Service Account Customization */}
              <div className="space-y-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                  <Sheet className="w-4 h-4" />
                  <span>تخصيص Google Sheets و Service Account لهذا المستخدم (اختياري)</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  إذا أردت أن يعمل هذا المستخدم على جدول Google Sheets خاص به وبحساب Google Cloud منفصل تماماً، الصق مفتاح الـ JSON الخاص به ومعرّف جدوله أدناه:
                </p>

                <div className="space-y-1">
                  <Label htmlFor="new_user_google_json" className="text-xs font-semibold flex items-center justify-between">
                    <span>محتوى ملف Google Service Account JSON:</span>
                    <span className="text-[10px] text-muted-foreground font-mono">client_email + private_key</span>
                  </Label>
                  <Textarea
                    id="new_user_google_json"
                    placeholder={`{\n  "type": "service_account",\n  "client_email": "user-account@project.iam.gserviceaccount.com",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\n..."\n}`}
                    value={newUser.google_service_account_json}
                    onChange={(e) => setNewUser({ ...newUser, google_service_account_json: e.target.value })}
                    className="font-mono text-xs h-24"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="new_user_spreadsheet_id" className="text-xs font-semibold">
                    معرّف جدول جوجل شيت (Spreadsheet ID) الخاص به
                  </Label>
                  <Input
                    id="new_user_spreadsheet_id"
                    placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                    value={newUser.google_spreadsheet_id}
                    onChange={(e) => setNewUser({ ...newUser, google_spreadsheet_id: e.target.value })}
                    className="font-mono text-xs"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    تأكد من مشاركة الجدول مع الإيميل الموجود في ملف الـ Service Account بصلاحية محرر (Editor).
                  </p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="new_user_sheet_name" className="text-xs font-semibold">
                    اسم ورقة العمل (Sheet Name) (اختياري)
                  </Label>
                  <Input
                    id="new_user_sheet_name"
                    placeholder="Sessions"
                    value={newUser.google_sheet_name}
                    onChange={(e) => setNewUser({ ...newUser, google_sheet_name: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddOpen(false)}
                  className="text-xs"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={actionLoading}
                  className="text-xs text-white"
                  style={{ background: 'linear-gradient(135deg, #B88A3B 0%, #966c25 100%)' }}
                >
                  {actionLoading ? 'جارٍ الحفظ...' : 'حفظ وإضافة المستخدم'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Change Password */}
      {isPasswordModalOpen && selectedUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="password-modal-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          dir="rtl"
        >
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 id="password-modal-title" className="text-base font-bold flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-500" />
                <span>تغيير كلمة المرور للمستخدم ({selectedUser.username})</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsPasswordModalOpen(false);
                  setSelectedUser(null);
                }}
                aria-label="إغلاق نافذة تغيير كلمة المرور"
                className="text-muted-foreground hover:text-foreground text-sm font-bold px-2 py-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-3.5">
              <div className="space-y-1">
                <Label htmlFor="update_password_input" className="text-xs font-semibold">
                  كلمة المرور الجديدة * (8 خانات على الأقل)
                </Label>
                <Input
                  id="update_password_input"
                  required
                  type="password"
                  minLength={PASSWORD_POLICY.MIN_LENGTH}
                  maxLength={PASSWORD_POLICY.MAX_LENGTH}
                  autoComplete="new-password"
                  placeholder="أدخل كلمة المرور الجديدة..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity(`يرجى إدخال كلمة مرور من ${PASSWORD_POLICY.MIN_LENGTH} خانات على الأقل`)}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                  className="font-mono text-sm"
                  dir="ltr"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {PASSWORD_POLICY.HELPER_TEXT_AR}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsPasswordModalOpen(false);
                    setSelectedUser(null);
                  }}
                  className="text-xs"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={actionLoading}
                  className="text-xs text-white bg-amber-600 hover:bg-amber-700"
                >
                  {actionLoading ? 'جارٍ التحديث...' : 'تحديث كلمة المرور'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit User and Customize Google Sheets */}
      {isEditModalOpen && selectedUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-modal-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          dir="rtl"
        >
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 id="edit-user-modal-title" className="text-base font-bold flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-primary" />
                <span>تعديل بيانات المستخدم ({selectedUser.username})</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedUser(null);
                }}
                aria-label="إغلاق نافذة التعديل"
                className="text-muted-foreground hover:text-foreground text-sm font-bold px-2 py-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4 max-h-[75vh] overflow-y-auto pe-1">
              <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/20">
                <div className="space-y-1">
                  <Label htmlFor="edit_display_name" className="text-xs font-semibold">
                    الاسم الظاهر
                  </Label>
                  <Input
                    id="edit_display_name"
                    placeholder="e.g. أ. عمر شاهين"
                    value={editUserData.display_name}
                    onChange={(e) => setEditUserData({ ...editUserData, display_name: e.target.value })}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit_email" className="text-xs font-semibold">
                    البريد الإلكتروني
                  </Label>
                  <Input
                    id="edit_email"
                    type="email"
                    placeholder="lawyer@office.com"
                    value={editUserData.email}
                    onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                    className="font-mono text-sm"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">الصلاحية (Role)</Label>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      disabled={selectedUser.role === 'admin' && activeAdminCount <= 1}
                      onClick={() => setEditUserData({ ...editUserData, role: 'staff' })}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        editUserData.role === 'staff'
                          ? 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400'
                          : 'border-border text-muted-foreground'
                      } ${selectedUser.role === 'admin' && activeAdminCount <= 1 ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>محامي (المشترك)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditUserData({ ...editUserData, role: 'admin' })}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        editUserData.role === 'admin'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>مشرف (Admin)</span>
                    </button>
                  </div>
                  {selectedUser.role === 'admin' && activeAdminCount <= 1 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 mt-1">
                      ⚠️ لا يمكن تحويل المشرف الوحيد النشط إلى محامٍ لضمان استمرارية لوحة التحكم.
                    </p>
                  )}
                </div>
              </div>

              {/* Subscription Status & Expiration for Staff */}
              {editUserData.role === 'staff' && (
                <div className="space-y-4 p-4 rounded-xl border border-amber-500/35 bg-amber-500/5">
                  <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 font-bold text-xs">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>إدارة باقة الاشتراك والذكاء الاصطناعي</span>
                    </div>
                  </div>

                  {/* Plan Tier Choice */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">باقة الاشتراك (Plan Tier):</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditUserData({ ...editUserData, plan_tier: 'plus', ai_quota_limit: 50 })}
                        className={`p-2.5 rounded-xl border text-start space-y-1 transition-all ${
                          editUserData.plan_tier === 'plus'
                            ? 'border-sky-500 bg-sky-500/15 text-sky-950 dark:text-sky-100 ring-1 ring-sky-500/40 shadow-xs'
                            : 'border-border text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold text-sky-600 dark:text-sky-400">
                          <Zap className="w-3.5 h-3.5" />
                          <span>باقة بلس (Plus)</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">50 تحليل رسائل/شهر</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditUserData({ ...editUserData, plan_tier: 'pro', ai_quota_limit: 300 })}
                        className={`p-2.5 rounded-xl border text-start space-y-1 transition-all ${
                          editUserData.plan_tier === 'pro'
                            ? 'border-amber-500 bg-amber-500/20 text-amber-950 dark:text-amber-100 ring-1 ring-amber-500/40 shadow-xs'
                            : 'border-border text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                          <Crown className="w-3.5 h-3.5" />
                          <span>باقة برو (Pro) 👑</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">300 تحليل رسائل/شهر</p>
                      </button>
                    </div>
                  </div>

                  {/* Billing Cycle Choice */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">دورة الفوترة (Billing Cycle):</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditUserData({ ...editUserData, billing_cycle: 'annual' })}
                        className={`p-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          editUserData.billing_cycle === 'annual'
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-extrabold shadow-xs'
                            : 'border-border text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                        <span>اشتراك سنوي (365 يوماً)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditUserData({ ...editUserData, billing_cycle: 'monthly' })}
                        className={`p-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          editUserData.billing_cycle === 'monthly'
                            ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300 font-extrabold shadow-xs'
                            : 'border-border text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5 text-sky-500" />
                        <span>اشتراك شهري (30 يوماً)</span>
                      </button>
                    </div>
                  </div>

                  {/* AI Quota and Current Usage with Reset */}
                  <div className="space-y-2 p-3 rounded-lg bg-card border border-border">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">حصة ورصيد استهلاك الذكاء الاصطناعي:</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (selectedUser) {
                            await handleResetAiUsage(selectedUser.id, selectedUser.username);
                            setEditUserData((prev) => ({ ...prev, ai_usage_count: 0 }));
                          }
                        }}
                        className="h-6 px-2 text-[10px] gap-1 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/10"
                      >
                        <RotateCcw className="w-3 h-3 text-emerald-600" />
                        <span>تصفير الاستهلاك الآن</span>
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="edit_ai_quota_limit" className="text-[11px] text-muted-foreground">
                          الحد الشهري (Quota Limit):
                        </Label>
                        <Input
                          id="edit_ai_quota_limit"
                          type="number"
                          min={1}
                          max={9999}
                          value={editUserData.ai_quota_limit}
                          onChange={(e) => setEditUserData({ ...editUserData, ai_quota_limit: parseInt(e.target.value) || 50 })}
                          className="font-mono text-sm h-8"
                          dir="ltr"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="edit_ai_usage_count" className="text-[11px] text-muted-foreground">
                          المستهلك حالياً (Usage):
                        </Label>
                        <Input
                          id="edit_ai_usage_count"
                          type="number"
                          min={0}
                          value={editUserData.ai_usage_count}
                          onChange={(e) => setEditUserData({ ...editUserData, ai_usage_count: parseInt(e.target.value) || 0 })}
                          className="font-mono text-sm h-8"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">حالة الحساب والوصول:</Label>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditUserData({ ...editUserData, status: 'active' })}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          editUserData.status === 'active'
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 shadow-xs'
                            : 'border-border text-muted-foreground'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>نشط (مفعل)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditUserData({ ...editUserData, status: 'suspended' })}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          editUserData.status === 'suspended'
                            ? 'border-rose-500 bg-rose-500/15 text-rose-700 dark:text-rose-300 shadow-xs'
                            : 'border-border text-muted-foreground'
                        }`}
                      >
                        <Pause className="w-3.5 h-3.5 text-rose-500" />
                        <span>موقوف مؤقتاً ⏸️</span>
                      </button>
                    </div>
                  </div>

                  {/* Subscription Duration Mode Toggle (F01 & F03) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">نوع سريان الاشتراك:</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditSubDurationMode('date');
                          if (!editUserData.subscription_end_date) {
                            setEditUserData({ ...editUserData, subscription_end_date: computeEndDate('1m') });
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          editSubDurationMode === 'date'
                            ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold shadow-xs'
                            : 'border-border text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>محدد بتاريخ انتهاء 📅</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditSubDurationMode('unlimited');
                          setEditUserData({ ...editUserData, subscription_end_date: '' });
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          editSubDurationMode === 'unlimited'
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-extrabold shadow-xs'
                            : 'border-border text-muted-foreground hover:bg-muted/40'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                        <span>اشتراك دائم ومفتوح ♾️</span>
                      </button>
                    </div>
                  </div>

                  {editSubDurationMode === 'date' ? (
                    <div className="space-y-1">
                      <Label htmlFor="edit_sub_end_date" className="text-xs font-semibold flex items-center justify-between">
                        <span>تاريخ انتهاء الاشتراك * :</span>
                        <span className="text-[10px] text-muted-foreground">صيغة YYYY-MM-DD</span>
                      </Label>
                      <Input
                        id="edit_sub_end_date"
                        type="date"
                        required
                        value={normalizeDateForInput(editUserData.subscription_end_date)}
                        onChange={(e) => setEditUserData({ ...editUserData, subscription_end_date: e.target.value })}
                        onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('يرجى تحديد تاريخ انتهاء الاشتراك')}
                        onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                        className="font-mono text-sm"
                        dir="ltr"
                      />
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>هذا الحساب يتمتع باشتراك دائم ومفتوح بدون تاريخ انتهاء صلاحية.</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label htmlFor="edit_sub_notes" className="text-xs font-semibold">
                      ملاحظات الاشتراك
                    </Label>
                    <Input
                      id="edit_sub_notes"
                      placeholder="e.g. اشتراك سنوي - مكتب الرياض"
                      value={editUserData.subscription_notes}
                      onChange={(e) => setEditUserData({ ...editUserData, subscription_notes: e.target.value })}
                      className="text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Per-User Google Sheets Customization in Edit */}
              <div className="space-y-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                    <Sheet className="w-4 h-4" />
                    <span>تخصيص Google Sheets و Service Account</span>
                  </div>
                  {selectedUser.has_google_service && (
                    <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                      ✔ تم التعيين مسبقاً
                    </Badge>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit_google_json" className="text-xs font-semibold">
                    محتوى ملف Google Service Account JSON الجديد (اختياري)
                  </Label>
                  <Textarea
                    id="edit_google_json"
                    placeholder={selectedUser.has_google_service ? "اتركه فارغاً للإبقاء على الملف الحالي، أو الصق مفتاحاً جديداً..." : "الصق كود Google Service Account JSON هنا..."}
                    value={editUserData.google_service_account_json}
                    onChange={(e) => setEditUserData({ ...editUserData, google_service_account_json: e.target.value })}
                    className="font-mono text-xs h-24"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit_spreadsheet_id" className="text-xs font-semibold">
                    معرّف جدول جوجل شيت (Spreadsheet ID)
                  </Label>
                  <Input
                    id="edit_spreadsheet_id"
                    placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                    value={editUserData.google_spreadsheet_id}
                    onChange={(e) => setEditUserData({ ...editUserData, google_spreadsheet_id: e.target.value })}
                    className="font-mono text-xs"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit_sheet_name" className="text-xs font-semibold">
                    اسم ورقة العمل (Sheet Name)
                  </Label>
                  <Input
                    id="edit_sheet_name"
                    placeholder="Sessions"
                    value={editUserData.google_sheet_name}
                    onChange={(e) => setEditUserData({ ...editUserData, google_sheet_name: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedUser(null);
                  }}
                  className="text-xs"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={actionLoading}
                  className="text-xs text-white bg-primary hover:bg-primary/90"
                >
                  {actionLoading ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Quick Subscription Renewal & Extension */}
      {isRenewModalOpen && selectedUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="renew-modal-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          dir="rtl"
        >
          <div className="bg-card border border-amber-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <RotateCw className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="renew-modal-title" className="text-base font-bold text-foreground">
                    تجديد وتمديد اشتراك المحامي
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedUser.display_name || selectedUser.username}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsRenewModalOpen(false);
                  setSelectedUser(null);
                }}
                aria-label="إغلاق نافذة التجديد"
                className="text-muted-foreground hover:text-foreground text-sm font-bold px-2 py-1 rounded-md"
              >
                ✕
              </button>
            </div>

            {/* Current Status Box */}
            <div className="p-3.5 rounded-xl border border-border bg-muted/40 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">حالة الاشتراك الحالية:</span>
                <span className="font-bold text-foreground">
                  {getSubscriptionInfo(selectedUser).statusText}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">تاريخ الانتهاء الحالي:</span>
                <span className="font-mono font-bold text-foreground">
                  {formatDateDisplay(selectedUser.subscription_end_date)}
                </span>
              </div>
            </div>

            <form onSubmit={handleRenewSubscription} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">اختر فترة التمديد الجديدة:</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: '1m', label: '+ شهر واحد (30 يوماً)' },
                    { id: '3m', label: '+ 3 أشهر (ربع سنوي)' },
                    { id: '6m', label: '+ 6 أشهر (نصف سنوي)' },
                    { id: '1y', label: '+ سنة كاملة (365 يوماً)' },
                    { id: 'custom', label: 'تاريخ مخصص 📅' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setRenewDuration(opt.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                        renewDuration === opt.id
                          ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400 shadow-xs'
                          : 'border-border text-muted-foreground hover:bg-muted/50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {renewDuration === 'custom' && (
                <div className="space-y-1">
                  <Label htmlFor="renew_custom_date" className="text-xs font-semibold">
                    تاريخ الانتهاء الجديد * :
                  </Label>
                  <Input
                    id="renew_custom_date"
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={customRenewDate}
                    onChange={(e) => setCustomRenewDate(e.target.value)}
                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('يرجى تحديد تاريخ تجديد صالح')}
                    onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                    className="font-mono text-sm"
                    dir="ltr"
                  />
                </div>
              )}

              {/* F05: Prominent Live Renewal Preview Box */}
              {(() => {
                const preview = getRenewalPreviewInfo();
                return (
                  <div className="p-3.5 rounded-xl border-2 border-amber-500/40 bg-amber-500/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        المعاينة المباشرة لتاريخ الانتهاء المتوقع:
                      </span>
                      <Badge className="bg-amber-500/25 text-amber-950 dark:text-amber-100 border-amber-500/40 text-xs font-mono font-extrabold px-2 py-0.5">
                        {formatDateDisplay(preview.targetDate)}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                      📌 <strong>قاعدة الحساب:</strong> {preview.ruleDescription}
                    </p>
                    {selectedUser.status === 'suspended' && (
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1.5 pt-1.5 border-t border-amber-500/20">
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>سيتم فك الإيقاف وإعادة تفعيل الحساب فوراً مع التجديد ▶️</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsRenewModalOpen(false);
                    setSelectedUser(null);
                  }}
                  className="text-xs"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={actionLoading}
                  className="text-xs text-white bg-amber-600 hover:bg-amber-700 shadow-md font-bold"
                >
                  {actionLoading ? 'جارٍ التجديد...' : 'تأكيد تجديد الاشتراك 🔄'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {isDeleteModalOpen && selectedUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          dir="rtl"
        >
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-500">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 id="delete-modal-title" className="text-base font-bold text-foreground">
                  تأكيد حذف المستخدم
                </h3>
                <p className="text-xs text-muted-foreground">هذا الإجراء نهائي ولا يمكن التراجع عنه.</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl">
              هل أنت متأكد من رغبتك في حذف حساب المستخدم <strong className="text-foreground">({selectedUser.username})</strong>؟
              لن يتمكن من الدخول للنظام بعد الحذف.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedUser(null);
                }}
                className="text-xs"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={actionLoading}
                onClick={handleDeleteUser}
                className="text-xs bg-red-600 hover:bg-red-700 text-white"
              >
                {actionLoading ? 'جارٍ الحذف...' : 'نعم، احذف الحساب'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ready Handover Card for Lawyers */}
      {isHandoverModalOpen && handoverData && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="handover-modal-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          dir="rtl"
        >
          <div className="bg-card border border-emerald-500/30 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="handover-modal-title" className="text-base font-extrabold text-foreground">
                    بطاقة تسليم الحساب للمحامي جاهزة
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    تم تجهيز بيانات الحساب والاشتراك بنجاح، يمكنك نسخها وإرسالها للمحامي مباشرة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHandoverModalOpen(false)}
                aria-label="إغلاق بطاقة التسليم"
                className="text-muted-foreground hover:text-foreground text-sm font-bold px-2 py-1 rounded-md"
              >
                ✕
              </button>
            </div>

            {/* Handover Details Box */}
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-3 font-sans">
              <div className="flex items-center justify-between pb-2 border-b border-emerald-500/15">
                <span className="text-xs text-muted-foreground font-semibold">المحامي / المكتب:</span>
                <span className="text-sm font-bold text-foreground">{handoverData.displayName || handoverData.username}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-emerald-500/15">
                <span className="text-xs text-muted-foreground font-semibold">رابط تسجيل دخول المحامي:</span>
                <span className="text-xs font-mono font-bold text-primary truncate max-w-[240px] text-left" dir="ltr">
                  {handoverData.loginUrl}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-emerald-500/15">
                <span className="text-xs text-muted-foreground font-semibold">اسم المستخدم:</span>
                <span className="text-sm font-mono font-bold text-foreground px-2 py-0.5 rounded bg-muted/60">
                  {handoverData.username}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-emerald-500/15">
                <span className="text-xs text-muted-foreground font-semibold">كلمة المرور:</span>
                <span className="text-sm font-mono font-extrabold text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                  {handoverData.password || '12345'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-semibold">صلاحية الاشتراك:</span>
                <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  {handoverData.subscriptionEndDate
                    ? `${formatDateDisplay(handoverData.subscriptionEndDate)} (${handoverData.subscriptionDurationText || 'نشط'})`
                    : 'اشتراك دائم ومفتوح'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              <Button
                type="button"
                onClick={handleCopyHandover}
                className="w-full sm:flex-1 gap-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md h-11"
              >
                {copiedHandover ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedHandover ? 'تم نسخ بيانات التسليم بنجاح!' : 'نسخ بيانات التسليم للمحامي كاملة 📋'}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsHandoverModalOpen(false)}
                className="w-full sm:w-auto text-xs h-11"
              >
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
