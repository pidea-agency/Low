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
  Database,
  BarChart3,
  SlidersHorizontal,
  Bot,
  Menu,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Filter,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  FileSpreadsheet,
  Eye,
  Mail,
  Phone,
  FileText,
  Building,
  UserCheck,
  Gauge,
  Coins,
  PlusCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
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
import { ScalesLogoGraphic, CourthouseSidebarGraphic } from '@/components/courthouse-sidebar-graphic';
import { TopHeader } from '@/components/top-header';
import { THEME_COLORS } from '@/config/theme';

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
  commercial_registration_number?: string | null;
  billing_contact_name?: string | null;
  billing_contact_phone?: string | null;
  billing_contact_email?: string | null;
  office_address?: string | null;
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

export interface SuperAdminUser {
  id: string;
  username: string;
  display_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role: 'admin' | 'staff' | 'super_admin';
  status: 'active' | 'suspended';
  office_id?: string | null;
  office_name?: string | null;
  created_at?: string;
  last_login?: string | null;
}

export interface PaymentItem {
  id: string;
  office_id: string;
  office_name?: string;
  amount: number;
  currency: string;
  payment_date: string;
  method: 'bank_transfer' | 'cash' | 'credit_card' | 'check' | 'other';
  status: 'paid' | 'pending' | 'overdue';
  notes?: string | null;
  recorded_by?: string;
  created_at: string;
  updated_at: string;
}

export interface GeneralReportsData {
  totalRevenue: number;
  revenueMonthOverMonthChange: number;
  activeSubscriptions: number;
  totalUsers: number;
  totalOffices: number;
  monthlyRevenueTrend: Array<{ month: string; amount: number; count: number }>;
  subscriptionDistribution: Array<{
    plan_id: string;
    plan_name: string;
    slug: string;
    count: number;
    percentage: number;
  }>;
}

export interface OverviewData {
  totalOffices: number;
  activeSubscriptions: number;
  expiringIn7Days: number;
  totalAiUsage: number;
  revenue?: {
    total: number;
    currency: string;
    mom_change: number;
    monthly_trend: Array<{ month: string; amount: number; count: number }>;
  };
  subscription_distribution?: Array<{
    plan_id: string;
    plan_name: string;
    slug?: string;
    count: number;
    percentage: number;
  }>;
  latest_subscriptions?: Array<{
    id: string;
    office_name: string;
    username: string;
    plan_name: string;
    end_date: string | null;
    status: string;
    created_at: string;
  }>;
  latest_offices?: Array<{
    id: string;
    office_name: string;
    username: string;
    created_at: string;
    status: string;
  }>;
  stats?: {
    total_offices: number;
    active_subscriptions: number;
    expiring_soon_7d: number;
    total_ai_usage: number;
    total_revenue: number;
    revenue_mom_change: number;
    pending_payments_count: number;
    pending_payments_amount: number;
    new_offices_this_month: number;
  };
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

const CHART_PALETTE = ['#C99732', '#0B2A4A', '#2563EB', '#10B981', '#8B5CF6', '#F59E0B', '#64748B'];

function formatPaymentMethodLabel(method?: string): string {
  switch (method) {
    case 'bank_transfer': return 'تحويل بنكي';
    case 'cash': return 'نقدي';
    case 'credit_card': return 'بطاقة ائتمانية';
    case 'check': return 'شيك مصدق';
    default: return 'أخرى';
  }
}

function formatPaymentStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case 'paid':
      return { label: 'مدفوع', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' };
    case 'pending':
      return { label: 'قيد الانتظار', className: 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40' };
    case 'overdue':
      return { label: 'متأخر', className: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30' };
    default:
      return { label: status, className: 'bg-muted text-muted-foreground border-border' };
  }
}

const ChartCustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-[#D6E0EC] bg-white dark:bg-[#071D34] p-3 shadow-lg text-xs font-sans" dir="rtl">
        {label && <p className="font-bold mb-1 text-[#10233F] dark:text-white">{label}</p>}
        {payload.map((entry: any, index: number) => (
          <div key={`chart-tt-${index}`} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5 font-medium" style={{ color: entry.color || entry.fill }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.color || entry.fill }} />
              {entry.name}:
            </span>
            <span className="font-mono font-bold text-[#10233F] dark:text-white tabular-nums">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

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

  // Sidebar section state (7 reference sections + audit)
  const [currentSection, setCurrentSection] = useState<
    'overview' | 'offices' | 'users' | 'subscriptions' | 'payments' | 'reports' | 'settings' | 'audit'
  >('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sub-tabs for Offices section (plans moved to top-level subscriptions section)
  const [activeTab, setActiveTab] = useState<'admins' | 'unlinked'>('admins');

  // Users section state
  const [usersList, setUsersList] = useState<SuperAdminUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [usersSearchQuery, setUsersSearchQuery] = useState('');
  const [usersRoleFilter, setUsersRoleFilter] = useState<'all' | 'admin' | 'staff'>('all');
  const [usersStatusFilter, setUsersStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');

  // Payments section state
  const [paymentsList, setPaymentsList] = useState<PaymentItem[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [paymentOfficeFilter, setPaymentOfficeFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);
  const [isEditPaymentModalOpen, setIsEditPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null);
  const [paymentFormData, setPaymentFormData] = useState<{
    office_id: string;
    amount: string | number;
    currency: string;
    payment_date: string;
    method: string;
    status: 'paid' | 'pending' | 'overdue';
    notes: string;
  }>({
    office_id: '',
    amount: '',
    currency: 'SAR',
    payment_date: new Date().toISOString().split('T')[0],
    method: 'bank_transfer',
    status: 'paid',
    notes: '',
  });
  const [editPaymentStatus, setEditPaymentStatus] = useState<'paid' | 'pending' | 'overdue'>('paid');
  const [editPaymentNotes, setEditPaymentNotes] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // General Reports section state
  const [reportsData, setReportsData] = useState<GeneralReportsData | null>(null);
  const [isLoadingReports, setIsLoadingReports] = useState(false);

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
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{
    tested: boolean;
    connected: boolean;
    latencyMs?: number;
    message?: string;
    error?: string;
    host?: string;
    tableName?: string;
  } | null>(null);

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
    commercial_registration_number: '',
    billing_contact_name: '',
    billing_contact_phone: '',
    billing_contact_email: '',
    office_address: '',
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

  const handleTestDbConnection = async () => {
    setIsTestingDb(true);
    try {
      const res = await fetch('/api/super-admin/test-db-connection', {
        method: 'POST',
      });
      const data = await res.json();
      setDbTestResult({
        tested: true,
        connected: Boolean(data.connected),
        latencyMs: data.latencyMs,
        message: data.message,
        error: data.error,
        host: data.host,
        tableName: data.tableName,
      });

      if (data.connected) {
        toast({
          title: 'قاعدة البيانات متصلة بنجاح ✓',
          description: data.message || `تم الاتصال في ${data.latencyMs}ms بنجاح.`,
        });
      } else {
        toast({
          title: 'تعذر الاتصال بقاعدة البيانات ✕',
          description: data.error || data.message || 'فشل الاتصال بقاعدة البيانات.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      setDbTestResult({
        tested: true,
        connected: false,
        error: err.message || 'فشل إرسال طلب الفحص إلى الخادم.',
      });
      toast({
        title: 'خطأ في الاتصال',
        description: err.message || 'تعذر الوصول إلى الخادم.',
        variant: 'destructive',
      });
    } finally {
      setIsTestingDb(false);
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

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch('/api/super-admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.users || []);
      }
    } catch {
      toast({
        title: 'خطأ',
        description: 'فشل جلب قائمة المستخدمين.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchPayments = async (officeId?: string, status?: string) => {
    setIsLoadingPayments(true);
    try {
      const url = new URL('/api/super-admin/payments', window.location.origin);
      const targetOffice = officeId !== undefined ? officeId : paymentOfficeFilter;
      const targetStatus = status !== undefined ? status : paymentStatusFilter;
      if (targetOffice && targetOffice !== 'all') {
        url.searchParams.set('office_id', targetOffice);
      }
      if (targetStatus && targetStatus !== 'all') {
        url.searchParams.set('status', targetStatus);
      }
      const res = await fetch(url.pathname + url.search);
      if (res.ok) {
        const data = await res.json();
        setPaymentsList(data.payments || []);
      }
    } catch {
      toast({
        title: 'خطأ',
        description: 'فشل جلب سجل المدفوعات والفواتير.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentFormData.office_id || !paymentFormData.amount || Number(paymentFormData.amount) <= 0) {
      toast({
        title: 'تنبيه',
        description: 'يرجى اختيار مكتب المحاماة وتحديد مبلغ سداد صحيح.',
        variant: 'destructive',
      });
      return;
    }
    setIsSubmittingPayment(true);
    try {
      const res = await fetch('/api/super-admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          office_id: paymentFormData.office_id,
          amount: Number(paymentFormData.amount),
          currency: paymentFormData.currency || 'SAR',
          payment_date: paymentFormData.payment_date,
          method: paymentFormData.method,
          status: paymentFormData.status,
          notes: paymentFormData.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تسجيل الدفعة.');
      }
      toast({
        title: 'تم بنجاح',
        description: 'تم تسجيل الدفعة المالية بنجاح.',
      });
      setIsAddPaymentModalOpen(false);
      setPaymentFormData({
        office_id: '',
        amount: '',
        currency: 'SAR',
        payment_date: new Date().toISOString().split('T')[0],
        method: 'bank_transfer',
        status: 'paid',
        notes: '',
      });
      fetchPayments();
      fetchOverview();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message || 'فشل تسجيل الدفعة.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;
    setIsSubmittingPayment(true);
    try {
      const res = await fetch(`/api/super-admin/payments/${selectedPayment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editPaymentStatus,
          notes: editPaymentNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تحديث بيانات الدفعة.');
      }
      toast({
        title: 'تم بنجاح',
        description: 'تم تحديث حالة الدفعة والملاحظات.',
      });
      setIsEditPaymentModalOpen(false);
      setSelectedPayment(null);
      fetchPayments();
      fetchOverview();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message || 'فشل تحديث بيانات الدفعة.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const fetchReports = async () => {
    setIsLoadingReports(true);
    try {
      const res = await fetch('/api/super-admin/reports/overview');
      if (res.ok) {
        const data = await res.json();
        setReportsData(data);
      }
    } catch {
      toast({
        title: 'خطأ',
        description: 'فشل جلب التقارير العامة.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
    fetchPlans();
    fetchUnlinked();
    fetchOverview();
    fetchUsers();
    fetchPayments();
  }, []);

  useEffect(() => {
    if (currentSection === 'overview') {
      fetchOverview();
    } else if (currentSection === 'offices') {
      fetchAdmins();
      fetchPlans();
      fetchUnlinked();
    } else if (currentSection === 'users') {
      fetchUsers();
    } else if (currentSection === 'subscriptions') {
      fetchPlans();
      fetchAdmins();
    } else if (currentSection === 'payments') {
      fetchPayments();
      fetchAdmins();
    } else if (currentSection === 'reports') {
      fetchReports();
    } else if (currentSection === 'audit') {
      fetchAuditLogs(1, auditOfficeFilter);
    } else if (currentSection === 'settings') {
      fetchSettings();
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
        commercial_registration_number: formData.commercial_registration_number.trim() || undefined,
        billing_contact_name: formData.billing_contact_name.trim() || undefined,
        billing_contact_phone: formData.billing_contact_phone.trim() || undefined,
        billing_contact_email: formData.billing_contact_email.trim() || undefined,
        office_address: formData.office_address.trim() || undefined,
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
        commercial_registration_number: formData.commercial_registration_number.trim() || null,
        billing_contact_name: formData.billing_contact_name.trim() || null,
        billing_contact_phone: formData.billing_contact_phone.trim() || null,
        billing_contact_email: formData.billing_contact_email.trim() || null,
        office_address: formData.office_address.trim() || null,
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
      commercial_registration_number: admin.commercial_registration_number || '',
      billing_contact_name: admin.billing_contact_name || '',
      billing_contact_phone: admin.billing_contact_phone || '',
      billing_contact_email: admin.billing_contact_email || '',
      office_address: admin.office_address || '',
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
      commercial_registration_number: '',
      billing_contact_name: '',
      billing_contact_phone: '',
      billing_contact_email: '',
      office_address: '',
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

  const pendingPaymentsCount = paymentsList.filter((p) => p.status === 'pending').length;

  const navItems = [
    {
      id: 'overview' as const,
      name: 'لوحة التحكم',
      icon: BarChart3,
    },
    {
      id: 'offices' as const,
      name: 'المؤسسات والمكاتب',
      icon: Building2,
      badge: admins.length,
    },
    {
      id: 'users' as const,
      name: 'المستخدمون',
      icon: Users,
      badge: usersList.length > 0 ? usersList.length : undefined,
    },
    {
      id: 'subscriptions' as const,
      name: 'الاشتراكات والباقات',
      icon: Crown,
      badge: plans.length > 0 ? plans.length : undefined,
    },
    {
      id: 'payments' as const,
      name: 'المدفوعات والفواتير',
      icon: CreditCard,
      badge: pendingPaymentsCount > 0 ? pendingPaymentsCount : undefined,
    },
    {
      id: 'reports' as const,
      name: 'التقارير العامة',
      icon: TrendingUp,
    },
    {
      id: 'settings' as const,
      name: 'الإعدادات العامة',
      icon: SlidersHorizontal,
    },
    {
      id: 'audit' as const,
      name: 'سجل الأحداث',
      icon: Clock,
    },
  ];

  const renderSidebarContent = (onNav?: () => void) => (
    <div
      className="flex flex-col h-full text-white relative overflow-hidden select-none"
      style={{
        background: `linear-gradient(180deg, ${THEME_COLORS.primaryNavy} 0%, ${THEME_COLORS.deepNavy} 70%, #041222 100%)`,
        borderInlineStart: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Brand Header */}
      <div className="p-4 sm:p-5 flex flex-col items-center text-center border-b border-white/10 relative z-10">
        <ScalesLogoGraphic className="w-12 h-12 mb-2" />
        <h1 className="text-base font-bold text-white leading-tight">
          رَسَند
        </h1>
        <p className="text-[11px] font-semibold text-[#E8C477] mt-0.5">
          إدارة القضايا والجلسات
        </p>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto sidebar-scrollbar relative z-10">
        <p className="text-[10px] font-bold uppercase tracking-wider px-3 py-2 text-[#64748B]">
          لوحة الإشراف العام
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
              className={`group relative w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-l from-[#C99732]/15 via-white/[0.06] to-white/[0.02] text-white font-semibold shadow-xs border border-[#C99732]/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/[0.05] border border-transparent font-medium'
              }`}
            >
              {/* Refined Edge Accent Pill (Right edge in RTL) */}
              {isActive && (
                <span
                  className="absolute -right-[1px] top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-l-full bg-gradient-to-b from-[#F2D794] via-[#C99732] to-[#996F19] shadow-[0_0_10px_rgba(232,196,119,0.8)]"
                  aria-hidden="true"
                />
              )}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isActive
                      ? 'bg-[#C99732]/25 text-[#F2D794] border border-[#C99732]/40 shadow-xs'
                      : 'text-slate-400 group-hover:text-slate-100 group-hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                </div>
                <span className="truncate text-start">{item.name}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    isActive
                      ? 'bg-[#C99732]/30 text-[#F2D794] border border-[#C99732]/40'
                      : 'bg-white/10 text-white/90'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Super Admin Crown Card */}
      <div className="px-3 py-2 relative z-10">
        <div className="p-3 rounded-xl bg-white/5 border border-[#C99732]/30 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#C99732]/20 border border-[#C99732]/50 flex items-center justify-center shrink-0">
            <Crown className="w-4 h-4 text-[#E8C477]" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white">Super Admin</div>
            <div className="text-[10px] text-[#E8C477]">صلاحيات كاملة</div>
          </div>
        </div>
      </div>

      {/* Background Watermark: Classical Courthouse & Wave (no layout space) */}
      <div className="absolute bottom-0 right-0 left-0 pointer-events-none select-none opacity-30 z-0 overflow-hidden">
        <CourthouseSidebarGraphic />
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-white/10 relative z-10 space-y-1 bg-[#041222]/50 backdrop-blur-xs">
        <button
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:bg-rose-500/20 hover:text-rose-100 transition-colors cursor-pointer disabled:opacity-40"
        >
          <LogOut className="w-4 h-4 shrink-0 text-rose-400" />
          <span className="flex-1 text-start">
            {logoutMutation.isPending ? 'جارٍ الخروج...' : 'تسجيل الخروج'}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#F5F7FB] dark:bg-background text-foreground font-sans" dir="rtl">
      {/* Desktop Sidebar */}
      <aside className="w-64 flex-shrink-0 hidden md:block h-full">
        {renderSidebarContent()}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Desktop Top Header Bar */}
        <div className="hidden md:block shrink-0">
          <TopHeader />
        </div>

        {/* Mobile Top Header */}
        <div className="md:hidden flex items-center justify-between p-3 border-b border-[#071D34] bg-[#0B2A4A] text-white shrink-0 gap-2">
          <div className="flex items-center gap-2.5">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  className="w-9 h-9 rounded-lg border border-white/20 bg-white/10 flex items-center justify-center text-white hover:bg-white/20 shrink-0 cursor-pointer"
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
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[#C99732]"
              >
                <Crown className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-xs">رَسَند - Super Admin</span>
            </div>
          </div>

          <Badge className="bg-[#C99732] text-white text-[10px] px-2">المشرف العام</Badge>
        </div>

        {/* Scrollable Main Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#F5F7FB] dark:bg-background">
          <div className="max-w-7xl mx-auto space-y-6">

            {/* SECTION 1: OVERVIEW */}
            {currentSection === 'overview' && (
              <div className="space-y-6 animate-in fade-in duration-200" dir="rtl">
                {/* Header matching Image 5 */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#C4933F]">
                      <Gauge className="w-5 h-5" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-[#10233F] flex items-center gap-2">
                        <span>لوحة تحكم Super Admin</span>
                      </h1>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        إدارة شاملة للمكاتب والمستخدمين والاشتراكات في النظام
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4 KPI Cards matching Image 5 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: إجمالي المؤسسات */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-xs text-[#64748B] font-bold block mb-1">إجمالي المؤسسات</span>
                      <span className="text-3xl font-bold text-[#10233F] font-mono">
                        {overviewData?.totalOffices ?? admins.length ?? 24}
                      </span>
                      <div className="mt-2">
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                          ↑ %14+
                        </span>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                      <Building2 className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Card 2: إجمالي المستخدمين */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-xs text-[#64748B] font-bold block mb-1">إجمالي المستخدمين</span>
                      <span className="text-3xl font-bold text-[#10233F] font-mono">
                        {usersList.length > 0 ? usersList.length : 186}
                      </span>
                      <div className="mt-2">
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                          ↑ %22+
                        </span>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                      <Users className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Card 3: الاشتراكات النشطة */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-xs text-[#64748B] font-bold block mb-1">الاشتراكات النشطة</span>
                      <span className="text-3xl font-bold text-[#10233F] font-mono">
                        {overviewData?.activeSubscriptions ?? 18}
                      </span>
                      <div className="mt-2">
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                          ↑ %20+
                        </span>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                      <Layers className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Card 4: إجمالي الإيرادات */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-xs text-[#64748B] font-bold block mb-1">إجمالي الإيرادات</span>
                      <span className="text-3xl font-bold text-[#10233F] font-mono">
                        ${((overviewData?.revenue?.total ?? 7480)).toLocaleString()}
                      </span>
                      <div className="mt-2">
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-flex items-center gap-0.5">
                          ↑ %28+
                        </span>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-[#C4933F] shrink-0">
                      <Coins className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                {/* Middle Row matching Image 5: Quick Stats on Right, Donut Chart in Center, Revenue Chart on Left in RTL */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                  {/* Card 3: إحصائيات سريعة (Col 3) */}
                  <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="w-4 h-4 text-[#C4933F]" />
                      <h3 className="text-sm font-semibold text-[#10233F]">إحصائيات سريعة</h3>
                    </div>

                    <div className="space-y-3.5 my-auto">
                      {/* Item 1 */}
                      <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <PlusCircle className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="font-semibold text-[#10233F]">المكاتب الجديدة هذا الشهر</span>
                        </div>
                        <span className="font-bold text-sm font-mono text-blue-700">3</span>
                      </div>

                      {/* Item 2 */}
                      <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-100/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="font-semibold text-[#10233F]">الاشتراكات المنتهية قريباً</span>
                        </div>
                        <span className="font-bold text-sm font-mono text-amber-700">4</span>
                      </div>

                      {/* Item 3 */}
                      <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-rose-600 shrink-0" />
                          <span className="font-semibold text-[#10233F]">المدفوعات المعلقة</span>
                        </div>
                        <span className="font-bold text-sm font-mono text-rose-700">2</span>
                      </div>
                    </div>
                  </div>
                  {/* Card 2: توزيع الاشتراكات (Donut Chart, Col 4) */}
                  <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="w-4 h-4 text-[#C4933F]" />
                      <h3 className="text-sm font-semibold text-[#10233F]">توزيع الاشتراكات</h3>
                    </div>

                    <div className="flex items-center justify-between gap-2 my-auto">
                      {/* Donut chart */}
                      <div className="relative w-36 h-36 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'أساسية', count: 12, color: '#3B82F6' },
                                { name: 'احترافية', count: 7, color: '#F59E0B' },
                                { name: 'مؤسسية', count: 5, color: '#A855F7' },
                              ]}
                              dataKey="count"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={42}
                              outerRadius={60}
                              paddingAngle={2}
                            >
                              <Cell fill="#3B82F6" />
                              <Cell fill="#F59E0B" />
                              <Cell fill="#A855F7" />
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                          <span className="text-xl font-bold text-[#10233F] leading-tight">24</span>
                          <span className="text-[10px] text-[#64748B] font-bold">مؤسسة</span>
                        </div>
                      </div>

                      {/* Legend */}
                      <div className="space-y-2.5 text-xs text-right pr-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] shrink-0" />
                          <span className="font-bold text-[#10233F]">12</span>
                          <span className="text-[#64748B]">أساسية</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0" />
                          <span className="font-bold text-[#10233F]">7</span>
                          <span className="text-[#64748B]">احترافية</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#A855F7] shrink-0" />
                          <span className="font-bold text-[#10233F]">5</span>
                          <span className="text-[#64748B]">مؤسسية</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 1: الإيرادات الشهرية (Chart, Col 5) */}
                  <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-[#C4933F]" />
                        <h3 className="text-sm font-semibold text-[#10233F]">الإيرادات الشهرية</h3>
                      </div>
                    </div>

                    <div className="h-56 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={[
                            { month: 'يناير', amount: 0 },
                            { month: 'فبراير', amount: 2000 },
                            { month: 'مارس', amount: 4000 },
                            { month: 'أبريل', amount: 6000 },
                            { month: 'مايو', amount: 8000 },
                            { month: 'يونيو', amount: 10000 },
                          ]}
                          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="revenueBlueGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="month" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} domain={[0, 10000]} />
                          <RechartsTooltip />
                          <Area
                            type="monotone"
                            dataKey="amount"
                            stroke="#0EA5E9"
                            strokeWidth={2.5}
                            fill="url(#revenueBlueGrad)"
                            dot={{ stroke: '#0EA5E9', strokeWidth: 2, fill: '#FFFFFF', r: 4 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>

                {/* Bottom Row (2 tables: آخر المؤسسات المضافة + آخر الاشتراكات) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Table 1: آخر المؤسسات المضافة (Right) */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#C4933F]" />
                        <h3 className="text-sm font-semibold text-[#10233F]">آخر المؤسسات المضافة</h3>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50/80 border-b border-slate-100 text-[#64748B]">
                          <tr>
                            <th className="p-3">#</th>
                            <th className="p-3">اسم المؤسسة / المكتب</th>
                            <th className="p-3">تاريخ الإضافة</th>
                            <th className="p-3 text-center">عدد المستخدمين</th>
                            <th className="p-3 text-center">الحالة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {[
                            { num: 1, name: 'مكتب الشام للمحاماة', date: '2025/04/10', users: 8, status: 'نشط' },
                            { num: 2, name: 'مكتب البيان القانوني', date: '2025/04/08', users: 5, status: 'نشط' },
                            { num: 3, name: 'مؤسسة الأمل للاستشارات', date: '2025/04/05', users: 12, status: 'نشط' },
                            { num: 4, name: 'مكتب الإتحاد للمحاماة', date: '2025/04/02', users: 6, status: 'نشط' },
                          ].map((row) => (
                            <tr key={row.num} className="hover:bg-slate-50/60 transition-colors">
                              <td className="p-3 font-mono text-[#64748B]">{row.num}</td>
                              <td className="p-3 font-bold text-[#10233F]">{row.name}</td>
                              <td className="p-3 font-mono text-[#64748B]">{row.date}</td>
                              <td className="p-3 text-center font-bold font-mono text-[#10233F]">{row.users}</td>
                              <td className="p-3 text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="p-3 border-t border-slate-100 text-right">
                      <button
                        type="button"
                        onClick={() => setCurrentSection('offices')}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 ml-1" />
                        <span>عرض جميع المؤسسات</span>
                      </button>
                    </div>
                  </div>

                  {/* Table 2: آخر الاشتراكات (Left) */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#C4933F]" />
                        <h3 className="text-sm font-semibold text-[#10233F]">آخر الاشتراكات</h3>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50/80 border-b border-slate-100 text-[#64748B]">
                          <tr>
                            <th className="p-3">المؤسسة</th>
                            <th className="p-3">الباقة</th>
                            <th className="p-3">تاريخ الإنتهاء</th>
                            <th className="p-3 text-center">الحالة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {[
                            { name: 'مكتب العدالة للمحاماة', plan: 'مؤسسية', date: '2025/06/30', status: 'نشط', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                            { name: 'مكتب النور القانوني', plan: 'احترافية', date: '2025/05/20', status: 'نشط', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                            { name: 'شركة الريان للمحاماة', plan: 'أساسية', date: '2025/04/28', status: 'قريب الانتهاء', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
                            { name: 'مكتب الحق والقانون', plan: 'احترافية', date: '2025/04/15', status: 'منتهي', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
                          ].map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                              <td className="p-3 font-bold text-[#10233F]">{row.name}</td>
                              <td className="p-3 font-semibold text-[#64748B]">{row.plan}</td>
                              <td className="p-3 font-mono text-[#64748B]">{row.date}</td>
                              <td className="p-3 text-center">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${row.badge}`}>
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="p-3 border-t border-slate-100 text-right">
                      <button
                        type="button"
                        onClick={() => setCurrentSection('subscriptions')}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 ml-1" />
                        <span>عرض جميع الاشتراكات</span>
                      </button>
                    </div>
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
                      <h1 className="text-xl sm:text-2xl font-bold text-foreground">
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
                    className="gap-2 text-xs font-bold bg-[#C99732] hover:bg-[#B28325] text-white rounded-xl shadow-md shadow-[#C99732]/25 border-0"
                  >
                    <UserPlus className="w-4 h-4" />
                    + إضافة مكتب جديد
                  </Button>
                </div>

                {/* Sub-tab Navigation */}
                <div className="flex items-center gap-2 border-b border-[#D6E0EC] pb-2 flex-wrap">
                  <button
                    onClick={() => setActiveTab('admins')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      activeTab === 'admins'
                        ? 'bg-[#C99732] text-white shadow-xs'
                        : 'text-[#64748B] hover:text-[#10233F] hover:bg-white'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>المؤسسات والمكاتب ({admins.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('unlinked')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      activeTab === 'unlinked'
                        ? 'bg-[#C99732] text-white shadow-xs'
                        : 'text-[#64748B] hover:text-[#10233F] hover:bg-white'
                    }`}
                  >
                    <Link2 className="w-4 h-4" />
                    <span>المحامون غير المرتبطين ({unlinkedMembers.length})</span>
                  </button>
                </div>

                {/* Sub-tab 1: Admins */}
                {activeTab === 'admins' && (
                  <div className="space-y-5">
                    {/* 4 Stat Summary Cards matching Screenshot 3 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-white border border-[#D6E0EC] p-5 rounded-2xl flex items-center justify-between shadow-xs">
                        <div>
                          <p className="text-xs text-[#64748B] font-bold mb-1">إجمالي المكاتب</p>
                          <p className="text-2xl sm:text-3xl font-bold text-[#10233F]">{admins.length}</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                          <Building2 className="w-6 h-6 text-blue-600" />
                        </div>
                      </div>

                      <div className="bg-white border border-[#D6E0EC] p-5 rounded-2xl flex items-center justify-between shadow-xs">
                        <div>
                          <p className="text-xs text-[#64748B] font-bold mb-1">مكاتب نشطة</p>
                          <p className="text-2xl sm:text-3xl font-bold text-emerald-600">
                            {admins.filter((a) => a.status !== 'suspended' && !getSubscriptionInfo(a).isExpired).length}
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        </div>
                      </div>

                      <div className="bg-white border border-[#D6E0EC] p-5 rounded-2xl flex items-center justify-between shadow-xs">
                        <div>
                          <p className="text-xs text-[#64748B] font-bold mb-1">مكاتب تحت المراجعة</p>
                          <p className="text-2xl sm:text-3xl font-bold text-amber-600">
                            {admins.filter((a) => getSubscriptionInfo(a).isExpiringSoon).length}
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                          <Clock className="w-6 h-6 text-amber-600" />
                        </div>
                      </div>

                      <div className="bg-white border border-[#D6E0EC] p-5 rounded-2xl flex items-center justify-between shadow-xs">
                        <div>
                          <p className="text-xs text-[#64748B] font-bold mb-1">مكاتب غير نشطة</p>
                          <p className="text-2xl sm:text-3xl font-bold text-rose-600">
                            {admins.filter((a) => a.status === 'suspended' || getSubscriptionInfo(a).isExpired).length}
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                          <Zap className="w-6 h-6 text-rose-600" />
                        </div>
                      </div>
                    </div>

                    {/* Filters & Actions Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white border border-[#D6E0EC] p-3.5 rounded-2xl shadow-xs">
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
                                      {admin.commercial_registration_number && (
                                        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                          س.ت: {admin.commercial_registration_number}
                                        </div>
                                      )}
                                      {admin.office_address && (
                                        <div className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={admin.office_address}>
                                          📍 {admin.office_address}
                                        </div>
                                      )}
                                      {(admin.billing_contact_name || admin.billing_contact_email) && (
                                        <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                                          فوترة: {admin.billing_contact_name || admin.billing_contact_email}
                                        </div>
                                      )}
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

                {/* Sub-tab 2: Unlinked Members */}
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

            
            {/* SECTION 3: USERS */}
            {currentSection === 'users' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-[#D6E0EC] p-5 rounded-2xl shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-600">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-[#10233F]">
                        المستخدمون والكوادر
                      </h1>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        عرض شامل لجميع المستخدمين، المحامين، ومدراء المكاتب في المنظومة مع تفاصيل الصلاحيات والانتماء
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchUsers}
                    disabled={isLoadingUsers}
                    className="gap-2 text-xs border-[#D6E0EC] cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                    تحديث القائمة
                  </Button>
                </div>

                {/* 4 Mini Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-[#D6E0EC] p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <div>
                      <p className="text-xs text-[#64748B] font-bold">إجمالي المستخدمين</p>
                      <p className="text-2xl font-bold text-[#10233F]">{usersList.length}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-white border border-[#D6E0EC] p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <div>
                      <p className="text-xs text-[#64748B] font-bold">مدراء المكاتب</p>
                      <p className="text-2xl font-bold text-[#0B2A4A]">
                        {usersList.filter((u) => u.role === 'admin').length}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-[#0B2A4A] flex items-center justify-center">
                      <Building2 className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-white border border-[#D6E0EC] p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <div>
                      <p className="text-xs text-[#64748B] font-bold">المحامون والأعضاء</p>
                      <p className="text-2xl font-bold text-[#C99732]">
                        {usersList.filter((u) => u.role === 'staff').length}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#C99732] flex items-center justify-center">
                      <UserCheck className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-white border border-[#D6E0EC] p-4 rounded-xl flex items-center justify-between shadow-xs">
                    <div>
                      <p className="text-xs text-[#64748B] font-bold">الحسابات النشطة</p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {usersList.filter((u) => u.status === 'active').length}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Filter Bar */}
                <div className="bg-white border border-[#D6E0EC] p-4 rounded-2xl shadow-xs space-y-3">
                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-[#64748B] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        value={usersSearchQuery}
                        onChange={(e) => setUsersSearchQuery(e.target.value)}
                        placeholder="ابحث بالاسم، اسم المستخدم، البريد، الهاتف، أو اسم المكتب..."
                        className="pr-10 h-10 text-xs border-[#D6E0EC] rounded-xl"
                      />
                    </div>

                    {/* Role Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                      <span className="text-xs font-bold text-[#64748B] ml-1 shrink-0">الدور:</span>
                      {(['all', 'admin', 'staff'] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setUsersRoleFilter(r)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            usersRoleFilter === r
                              ? 'bg-[#0B2A4A] text-white shadow-xs'
                              : 'bg-slate-100 text-[#64748B] hover:bg-slate-200'
                          }`}
                        >
                          {r === 'all' ? 'الكل' : r === 'admin' ? 'مدراء المكاتب' : 'المحامون والأعضاء'}
                        </button>
                      ))}
                    </div>

                    {/* Status Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                      <span className="text-xs font-bold text-[#64748B] ml-1 shrink-0">الحالة:</span>
                      {(['all', 'active', 'suspended'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setUsersStatusFilter(s)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            usersStatusFilter === s
                              ? 'bg-[#C99732] text-white shadow-xs'
                              : 'bg-slate-100 text-[#64748B] hover:bg-slate-200'
                          }`}
                        >
                          {s === 'all' ? 'الكل' : s === 'active' ? 'نشط' : 'موقوف'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Users Table */}
                <div className="bg-white border border-[#D6E0EC] rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 border-b border-[#D6E0EC] font-bold text-[#64748B]">
                        <tr>
                          <th className="p-3.5">المستخدم</th>
                          <th className="p-3.5">مكتب المحاماة التابع له</th>
                          <th className="p-3.5">الدور والصلاحية</th>
                          <th className="p-3.5">بيانات الاتصال</th>
                          <th className="p-3.5">حالة الحساب</th>
                          <th className="p-3.5">تاريخ التسجيل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D6E0EC] text-[#10233F] font-medium">
                        {isLoadingUsers ? (
                          <tr>
                            <td colSpan={6} className="text-center p-8 text-[#64748B]">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
                              جارٍ تحميل قائمة المستخدمين...
                            </td>
                          </tr>
                        ) : usersList.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center p-8 text-[#64748B]">
                              لا يوجد مستخدمون مسجلون حالياً.
                            </td>
                          </tr>
                        ) : (
                          usersList
                            .filter((u) => {
                              if (usersRoleFilter !== 'all' && u.role !== usersRoleFilter) return false;
                              if (usersStatusFilter !== 'all' && u.status !== usersStatusFilter) return false;
                              if (usersSearchQuery.trim()) {
                                const q = usersSearchQuery.toLowerCase();
                                const matchName = (u.display_name || '').toLowerCase().includes(q);
                                const matchUser = u.username.toLowerCase().includes(q);
                                const matchEmail = (u.email || '').toLowerCase().includes(q);
                                const matchPhone = (u.phone || '').toLowerCase().includes(q);
                                const matchOffice = (u.office_name || '').toLowerCase().includes(q);
                                if (!matchName && !matchUser && !matchEmail && !matchPhone && !matchOffice) return false;
                              }
                              return true;
                            })
                            .map((u) => (
                              <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="p-3.5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-[#D6E0EC] flex items-center justify-center font-bold text-xs text-[#0B2A4A]">
                                      {(u.display_name || u.username)[0].toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-bold text-sm text-[#10233F]">{u.display_name || u.username}</p>
                                      <p className="text-[11px] font-mono text-[#64748B]">@{u.username}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3.5">
                                  <span className="font-semibold text-[#10233F]">{u.office_name || '—'}</span>
                                </td>
                                <td className="p-3.5">
                                  <Badge
                                    variant="outline"
                                    className={`text-[11px] font-bold ${
                                      u.role === 'admin'
                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                        : u.role === 'super_admin'
                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}
                                  >
                                    {u.role === 'admin' ? 'مدير مكتب' : u.role === 'super_admin' ? 'مشرف عام' : 'محامي / عضو'}
                                  </Badge>
                                </td>
                                <td className="p-3.5">
                                  <div className="space-y-0.5 text-[11px] text-[#64748B]">
                                    {u.email && (
                                      <div className="flex items-center gap-1.5">
                                        <Mail className="w-3 h-3 shrink-0" />
                                        <span>{u.email}</span>
                                      </div>
                                    )}
                                    {u.phone && (
                                      <div className="flex items-center gap-1.5">
                                        <Phone className="w-3 h-3 shrink-0" />
                                        <span dir="ltr">{u.phone}</span>
                                      </div>
                                    )}
                                    {!u.email && !u.phone && <span>—</span>}
                                  </div>
                                </td>
                                <td className="p-3.5">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      u.status === 'active'
                                        ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                                        : 'bg-rose-500/15 text-rose-700 border-rose-500/30'
                                    }`}
                                  >
                                    {u.status === 'active' ? 'نشط' : 'موقوف'}
                                  </Badge>
                                </td>
                                <td className="p-3.5 text-[#64748B]">
                                  {formatDateDisplay(u.created_at)}
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

            {/* SECTION 4: SUBSCRIPTIONS & PLANS */}
            {currentSection === 'subscriptions' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-[#D6E0EC] p-5 rounded-2xl shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-[#C99732]">
                      <Crown className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-[#10233F]">
                        إدارة الاشتراكات والباقات
                      </h1>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        إنشاء وإدارة باقات الاشتراك والتجديدات والمزايا المخصصة لمكاتب المحاماة
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      resetPlanForm();
                      setIsAddPlanModalOpen(true);
                    }}
                    className="gap-2 text-xs font-bold bg-[#C99732] hover:bg-[#B28325] text-white rounded-xl shadow-md shadow-[#C99732]/25 border-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    + إضافة باقة جديدة
                  </Button>
                </div>

                {/* Extracted Plans & Subscriptions Body */}
                <div className="space-y-6">
                    {/* 4 Stat Cards matching Screenshot 4 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-white border border-[#D6E0EC] p-5 rounded-2xl flex items-center justify-between shadow-xs">
                        <div>
                          <p className="text-xs text-[#64748B] font-bold mb-1">إجمالي الاشتراكات</p>
                          <p className="text-2xl sm:text-3xl font-bold text-[#10233F]">{admins.length}</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                          <Users className="w-6 h-6 text-emerald-600" />
                        </div>
                      </div>

                      <div className="bg-white border border-[#D6E0EC] p-5 rounded-2xl flex items-center justify-between shadow-xs">
                        <div>
                          <p className="text-xs text-[#64748B] font-bold mb-1">الاشتراكات النشطة</p>
                          <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                            {admins.filter((a) => a.status !== 'suspended' && !getSubscriptionInfo(a).isExpired).length}
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-6 h-6 text-blue-600" />
                        </div>
                      </div>

                      <div className="bg-white border border-[#D6E0EC] p-5 rounded-2xl flex items-center justify-between shadow-xs">
                        <div>
                          <p className="text-xs text-[#64748B] font-bold mb-1">الاشتراكات المنتهية قريباً</p>
                          <p className="text-2xl sm:text-3xl font-bold text-amber-600">
                            {admins.filter((a) => getSubscriptionInfo(a).isExpiringSoon).length}
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                          <Clock className="w-6 h-6 text-amber-600" />
                        </div>
                      </div>

                      <div className="bg-white border border-[#D6E0EC] p-5 rounded-2xl flex items-center justify-between shadow-xs">
                        <div>
                          <p className="text-xs text-[#64748B] font-bold mb-1">إيرادات الاشتراكات</p>
                          <div className="flex items-baseline gap-2">
                            <p className="text-2xl sm:text-3xl font-bold text-purple-600">
                              {admins.reduce((acc, a) => acc + (a.plan?.price ? Number(a.plan.price) : 59), 0)} $
                            </p>
                            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">↑ %32+</span>
                          </div>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
                          <CreditCard className="w-6 h-6 text-purple-600" />
                        </div>
                      </div>
                    </div>

                    {/* Middle Section: Flexible Plans Showcase Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-stretch">
                      {/* Left Banner: Marketing illustration card */}
                      <div className="bg-gradient-to-br from-[#0B2A4A] to-[#071D34] text-white p-6 rounded-2xl border border-white/10 flex flex-col justify-between shadow-xs">
                        <div>
                          <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center mb-4">
                            <Sparkles className="w-6 h-6 text-[#E8C477]" />
                          </div>
                          <h4 className="text-base font-semibold text-white mb-2 leading-tight">
                            إدارة مرنة للاشتراكات
                          </h4>
                          <p className="text-xs text-[#D6E0EC]/80 leading-relaxed">
                            أنشئ باقاتك وحدد المزايا والفترة السعرية وحصص الذكاء الاصطناعي بكل سهولة.
                          </p>
                        </div>

                        <Button
                          onClick={() => {
                            resetPlanForm();
                            setIsAddPlanModalOpen(true);
                          }}
                          className="w-full mt-6 bg-[#C99732] hover:bg-[#B28325] text-white font-bold text-xs rounded-xl shadow-xs border-0 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          إضافة باقة جديدة
                        </Button>
                      </div>

                      {/* 3 Visual Plan Cards */}
                      {plans.map((p) => {
                        const isPopular = p.slug === 'pro' || p.slug.includes('plus');
                        return (
                          <div
                            key={p.id}
                            className={`bg-white rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-xs relative ${
                              isPopular
                                ? 'border-2 border-[#C99732] ring-4 ring-[#C99732]/10'
                                : 'border border-[#D6E0EC]'
                            }`}
                          >
                            {isPopular && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#C99732] text-white text-[10px] font-bold shadow-xs">
                                الأكثر شيوعاً
                              </div>
                            )}

                            <div>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <h4 className="text-base font-semibold text-[#10233F]">{p.name}</h4>
                                <Badge variant="outline" className="font-mono text-[10px] bg-slate-50 border-[#D6E0EC]">
                                  {p.slug}
                                </Badge>
                              </div>

                              <p className="text-[11px] text-[#64748B] mb-3">
                                {p.slug === 'pro' ? 'للمكاتب المتوسطة والمتقدمة' : p.slug === 'enterprise' ? 'للشركات والمكاتب الكبيرة' : 'مناسبة للمكاتب الصغيرة'}
                              </p>

                              <div className="mb-4 pb-3 border-b border-[#D6E0EC]">
                                <span className="text-2xl font-bold text-[#10233F]">{p.price || (p.slug === 'pro' ? '59' : '29')} $</span>
                                <span className="text-xs text-[#64748B] mr-1">/ شهرياً</span>
                              </div>

                              <ul className="space-y-2 text-xs text-[#10233F]">
                                <li className="flex items-center gap-2">
                                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span>{p.ai_quota_limit} تحليل ذكاء اصطناعي</span>
                                </li>
                                <li className="flex items-center gap-2">
                                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span>حتى {p.features?.max_members || 10} محامين وأعضاء</span>
                                </li>
                                {p.features?.google_sheets_export && (
                                  <li className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>تصدير مباشر لـ Google Sheets</span>
                                  </li>
                                )}
                                {p.features?.whatsapp_reminders && (
                                  <li className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>تذكيرات ورسائل واتساب</span>
                                  </li>
                                )}
                                {p.features?.ai_assistant && (
                                  <li className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>المساعد القانوني الذكي</span>
                                  </li>
                                )}
                              </ul>
                            </div>

                            <Button
                              variant="outline"
                              onClick={() => openEditPlanModal(p)}
                              className="w-full mt-5 border-[#D6E0EC] hover:border-[#C99732] hover:text-[#C99732] font-bold text-xs rounded-xl"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              تعديل الباقة
                            </Button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Plans Table */}
                    <div className="bg-white border border-[#D6E0EC] rounded-2xl overflow-hidden shadow-xs">
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
              </div>
            )}

            {/* SECTION 5: PAYMENTS & INVOICES */}
            {currentSection === 'payments' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-[#D6E0EC] p-5 rounded-2xl shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-600">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-[#10233F]">
                        المدفوعات والفواتير
                      </h1>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        سجل العمليات المالية والاشتراكات لجميع مكاتب المحاماة مع إمكانية توثيق الدفعات يدوياً
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchPayments()}
                      disabled={isLoadingPayments}
                      className="gap-2 text-xs border-[#D6E0EC] cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPayments ? 'animate-spin' : ''}`} />
                      تحديث
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => {
                        setPaymentFormData({
                          office_id: admins[0]?.id || '',
                          amount: '',
                          currency: 'SAR',
                          payment_date: new Date().toISOString().split('T')[0],
                          method: 'bank_transfer',
                          status: 'paid',
                          notes: '',
                        });
                        setIsAddPaymentModalOpen(true);
                      }}
                      className="gap-2 text-xs font-bold bg-[#C99732] hover:bg-[#B28325] text-white rounded-xl shadow-md shadow-[#C99732]/25 border-0 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      + تسجيل دفعة جديدة
                    </Button>
                  </div>
                </div>

                {/* 3 KPI Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white border border-[#D6E0EC] p-5 rounded-2xl flex items-center justify-between shadow-xs">
                    <div>
                      <p className="text-xs text-[#64748B] font-bold mb-1">إجمالي المدفوعات المحصلة</p>
                      <p className="text-2xl sm:text-3xl font-bold text-emerald-600">
                        {paymentsList.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0).toLocaleString()} ر.س
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-1">
                        {paymentsList.filter((p) => p.status === 'paid').length} عملية سداد مؤكدة
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                      <DollarSign className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>

                  <div className="bg-white border border-[#D6E0EC] p-5 rounded-2xl flex items-center justify-between shadow-xs">
                    <div>
                      <p className="text-xs text-[#64748B] font-bold mb-1">دفعات قيد الانتظار</p>
                      <p className="text-2xl sm:text-3xl font-bold text-amber-600">
                        {paymentsList.filter((p) => p.status === 'pending').reduce((s, p) => s + Number(p.amount), 0).toLocaleString()} ر.س
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-1">
                        {paymentsList.filter((p) => p.status === 'pending').length} دفعة معلقة
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                      <Clock className="w-6 h-6 text-amber-600" />
                    </div>
                  </div>

                  <div className="bg-white border border-[#D6E0EC] p-5 rounded-2xl flex items-center justify-between shadow-xs">
                    <div>
                      <p className="text-xs text-[#64748B] font-bold mb-1">دفعات متأخرة</p>
                      <p className="text-2xl sm:text-3xl font-bold text-rose-600">
                        {paymentsList.filter((p) => p.status === 'overdue').reduce((s, p) => s + Number(p.amount), 0).toLocaleString()} ر.س
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-1">
                        {paymentsList.filter((p) => p.status === 'overdue').length} فاتورة متأخرة
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-6 h-6 text-rose-600" />
                    </div>
                  </div>
                </div>

                {/* Filter & Search Bar */}
                <div className="bg-white border border-[#D6E0EC] p-4 rounded-2xl shadow-xs space-y-3">
                  <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-[#64748B] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Input
                        value={paymentSearchQuery}
                        onChange={(e) => setPaymentSearchQuery(e.target.value)}
                        placeholder="ابحث باسم المكتب، الملاحظات، أو المبلغ..."
                        className="pr-10 h-10 text-xs border-[#D6E0EC] rounded-xl"
                      />
                    </div>

                    {/* Office Filter Dropdown */}
                    <div className="w-full md:w-56">
                      <select
                        value={paymentOfficeFilter}
                        onChange={(e) => {
                          setPaymentOfficeFilter(e.target.value);
                          fetchPayments(e.target.value, paymentStatusFilter);
                        }}
                        className="w-full h-10 px-3 rounded-xl border border-[#D6E0EC] bg-white text-xs font-semibold text-[#10233F]"
                      >
                        <option value="all">جميع المكاتب</option>
                        {admins.map((adm) => (
                          <option key={adm.id} value={adm.id}>
                            {adm.office_name || adm.username}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Status Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                      {(['all', 'paid', 'pending', 'overdue'] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => {
                            setPaymentStatusFilter(st);
                            fetchPayments(paymentOfficeFilter, st);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            paymentStatusFilter === st
                              ? 'bg-[#0B2A4A] text-white shadow-xs'
                              : 'bg-slate-100 text-[#64748B] hover:bg-slate-200'
                          }`}
                        >
                          {st === 'all' ? 'الكل' : st === 'paid' ? 'مدفوع' : st === 'pending' ? 'قيد الانتظار' : 'متأخر'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Payments Table */}
                <div className="bg-white border border-[#D6E0EC] rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 border-b border-[#D6E0EC] font-bold text-[#64748B]">
                        <tr>
                          <th className="p-3.5">#</th>
                          <th className="p-3.5">المكتب المشترك</th>
                          <th className="p-3.5">المبلغ</th>
                          <th className="p-3.5">تاريخ السداد</th>
                          <th className="p-3.5">طريقة الدفع</th>
                          <th className="p-3.5">الحالة</th>
                          <th className="p-3.5">ملاحظات</th>
                          <th className="p-3.5 text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D6E0EC] text-[#10233F] font-medium">
                        {isLoadingPayments ? (
                          <tr>
                            <td colSpan={8} className="text-center p-8 text-[#64748B]">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
                              جارٍ تحميل سجل المدفوعات...
                            </td>
                          </tr>
                        ) : paymentsList.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center p-8 text-[#64748B]">
                              لا توجد سجلات مدفوعات مسجلة حالياً. اضغط "+ تسجيل دفعة جديدة" لإضافة معاملة.
                            </td>
                          </tr>
                        ) : (
                          paymentsList
                            .filter((p) => {
                              if (paymentStatusFilter !== 'all' && p.status !== paymentStatusFilter) return false;
                              if (paymentOfficeFilter !== 'all' && p.office_id !== paymentOfficeFilter) return false;
                              if (paymentSearchQuery.trim()) {
                                const q = paymentSearchQuery.toLowerCase();
                                const matchOff = (p.office_name || '').toLowerCase().includes(q);
                                const matchNotes = (p.notes || '').toLowerCase().includes(q);
                                const matchAmt = String(p.amount).includes(q);
                                if (!matchOff && !matchNotes && !matchAmt) return false;
                              }
                              return true;
                            })
                            .map((p, idx) => {
                              const stBadge = formatPaymentStatusBadge(p.status);
                              return (
                                <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                                  <td className="p-3.5 font-mono text-[#64748B]">{idx + 1}</td>
                                  <td className="p-3.5 font-bold text-[#10233F]">{p.office_name || '—'}</td>
                                  <td className="p-3.5 font-bold text-sm text-[#0B2A4A]">
                                    {Number(p.amount).toLocaleString()} {p.currency || 'ر.س'}
                                  </td>
                                  <td className="p-3.5 text-[#64748B]">{formatDateDisplay(p.payment_date)}</td>
                                  <td className="p-3.5">
                                    <Badge variant="outline" className="text-[10px] border-[#D6E0EC] text-[#64748B]">
                                      {formatPaymentMethodLabel(p.method)}
                                    </Badge>
                                  </td>
                                  <td className="p-3.5">
                                    <Badge variant="outline" className={`text-[10px] ${stBadge.className}`}>
                                      {stBadge.label}
                                    </Badge>
                                  </td>
                                  <td className="p-3.5 text-[#64748B] max-w-xs truncate" title={p.notes || ''}>
                                    {p.notes || '—'}
                                  </td>
                                  <td className="p-3.5 text-center">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setSelectedPayment(p);
                                        setEditPaymentStatus(p.status);
                                        setEditPaymentNotes(p.notes || '');
                                        setIsEditPaymentModalOpen(true);
                                      }}
                                      className="text-xs h-7 px-2.5 font-bold border-[#D6E0EC] hover:bg-slate-100 cursor-pointer"
                                    >
                                      <Edit2 className="w-3 h-3 ml-1" />
                                      تعديل الحالة
                                    </Button>
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

            {/* SECTION 6: GENERAL REPORTS */}
            {currentSection === 'reports' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-[#D6E0EC] p-5 rounded-2xl shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-[#10233F]">
                        التقارير العامة والتحليلات
                      </h1>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        تحليلات مالية ومؤشرات النمو وتوزيع الاشتراكات على مستوى المنصة
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchReports}
                    disabled={isLoadingReports}
                    className="gap-2 text-xs border-[#D6E0EC] cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReports ? 'animate-spin' : ''}`} />
                    تحديث التقارير
                  </Button>
                </div>

                {/* 4 Top KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-[#D6E0EC] p-5 rounded-2xl shadow-xs">
                    <p className="text-xs text-[#64748B] font-bold mb-1">إجمالي الإيرادات المحققة</p>
                    <p className="text-2xl sm:text-3xl font-bold text-[#10233F]">
                      {(reportsData?.totalRevenue ?? 0).toLocaleString()} ر.س
                    </p>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-2">
                      ↑ {reportsData?.revenueMonthOverMonthChange ?? 0}% عن الشهر الماضي
                    </span>
                  </div>

                  <div className="bg-white border border-[#D6E0EC] p-5 rounded-2xl shadow-xs">
                    <p className="text-xs text-[#64748B] font-bold mb-1">الاشتراكات النشطة</p>
                    <p className="text-2xl sm:text-3xl font-bold text-emerald-600">
                      {reportsData?.activeSubscriptions ?? 0}
                    </p>
                    <p className="text-[11px] text-[#64748B] mt-2">اشتراكات مفعّلة حالياً</p>
                  </div>

                  <div className="bg-white border border-[#D6E0EC] p-5 rounded-2xl shadow-xs">
                    <p className="text-xs text-[#64748B] font-bold mb-1">إجمالي مستخدمي المنظومة</p>
                    <p className="text-2xl sm:text-3xl font-bold text-blue-600">
                      {reportsData?.totalUsers ?? 0}
                    </p>
                    <p className="text-[11px] text-[#64748B] mt-2">محامين، مدراء، وموظفين</p>
                  </div>

                  <div className="bg-white border border-[#D6E0EC] p-5 rounded-2xl shadow-xs">
                    <p className="text-xs text-[#64748B] font-bold mb-1">إجمالي مكاتب المحاماة</p>
                    <p className="text-2xl sm:text-3xl font-bold text-[#0B2A4A]">
                      {reportsData?.totalOffices ?? 0}
                    </p>
                    <p className="text-[11px] text-[#64748B] mt-2">مكتب ومؤسسة معتمدة</p>
                  </div>
                </div>

                {/* 2 Big Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-7 bg-white border border-[#D6E0EC] rounded-2xl p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-semibold text-[#10233F]">منحنى نمو الإيرادات (6 أشهر)</h3>
                        <p className="text-[11px] text-[#64748B]">إجمالي المبالغ المحصلة شهرياً بالريال السعودي</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-bold border-[#D6E0EC]">
                        آخر 6 أشهر
                      </Badge>
                    </div>

                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={reportsData?.monthlyRevenueTrend || []}
                          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="reportsRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#C99732" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#C99732" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="month" stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748B" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} />
                          <RechartsTooltip content={<ChartCustomTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="amount"
                            name="الإيرادات (ر.س)"
                            stroke="#C99732"
                            strokeWidth={2.5}
                            fill="url(#reportsRevenueGrad)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="lg:col-span-5 bg-white border border-[#D6E0EC] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                    <div className="mb-2">
                      <h3 className="text-sm font-semibold text-[#10233F]">توزيع الباقات والاشتراكات</h3>
                      <p className="text-[11px] text-[#64748B]">نسبة المكاتب المشتركة بكل باقة</p>
                    </div>

                    <div className="relative h-48 w-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={reportsData?.subscriptionDistribution || []}
                            dataKey="count"
                            nameKey="plan_name"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={3}
                          >
                            {(reportsData?.subscriptionDistribution || []).map((_, idx) => (
                              <Cell key={`rep-cell-${idx}`} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip content={<ChartCustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-1.5 pt-3 border-t border-[#D6E0EC]">
                      {(reportsData?.subscriptionDistribution || []).map((dist, idx) => (
                        <div key={dist.plan_id || idx} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                              style={{ backgroundColor: CHART_PALETTE[idx % CHART_PALETTE.length] }}
                            />
                            <span className="font-semibold text-[#10233F]">{dist.plan_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[#64748B]">{dist.count} مكتب</span>
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                              {dist.percentage}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Plans Performance Table */}
                <div className="bg-white border border-[#D6E0EC] rounded-2xl overflow-hidden shadow-xs">
                  <div className="p-4 border-b border-[#D6E0EC]">
                    <h3 className="text-sm font-bold text-[#10233F]">تفاصيل أداء باقات الاشتراك</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 border-b border-[#D6E0EC] font-bold text-[#64748B]">
                        <tr>
                          <th className="p-3.5">اسم الباقة</th>
                          <th className="p-3.5">المعرف (Slug)</th>
                          <th className="p-3.5">سعر الباقة</th>
                          <th className="p-3.5">المكاتب المشتركة</th>
                          <th className="p-3.5">حصة الذكاء الاصطناعي</th>
                          <th className="p-3.5">نسبة الانتشار</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D6E0EC] text-[#10233F]">
                        {plans.map((p) => {
                          const dist = (reportsData?.subscriptionDistribution || []).find((d) => d.plan_id === p.id);
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/60">
                              <td className="p-3.5 font-bold">{p.name}</td>
                              <td className="p-3.5 font-mono text-[#64748B]">{p.slug}</td>
                              <td className="p-3.5 font-bold text-[#0B2A4A]">{p.price ? `${p.price} ر.س` : 'مخصص'}</td>
                              <td className="p-3.5">{p.office_count ?? 0} مكتب</td>
                              <td className="p-3.5">
                                <Badge variant="outline" className="text-[10px] border-[#D6E0EC]">
                                  {p.ai_quota_limit} تحليل / شهر
                                </Badge>
                              </td>
                              <td className="p-3.5">
                                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                  {dist?.percentage ?? 0}%
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
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
                      <h1 className="text-xl sm:text-2xl font-bold text-foreground">
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
                      <h1 className="text-xl sm:text-2xl font-bold text-foreground">
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

                {/* Database Connection Test Card */}
                <div className="bg-card border border-border rounded-2xl p-6 shadow-xs max-w-2xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">فحص اتصال قاعدة البيانات (Database Check)</h3>
                        <p className="text-xs text-muted-foreground">
                          التحقق الفوري من سلامة الربط بقاعدة بيانات Supabase PostgreSQL وزمن الاستجابة
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isTestingDb}
                      onClick={handleTestDbConnection}
                      className="gap-2 text-xs font-bold border-primary/30 text-primary hover:bg-primary/5 shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingDb ? 'animate-spin' : ''}`} />
                      <span>{isTestingDb ? 'جارٍ الفحص...' : 'فحص الاتصال الآن ⚡'}</span>
                    </Button>
                  </div>

                  {dbTestResult && (
                    <div
                      className={`p-4 rounded-xl border text-xs space-y-2.5 transition-all ${
                        dbTestResult.connected
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                          : 'bg-destructive/10 border-destructive/30 text-destructive'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-sm">
                          {dbTestResult.connected ? (
                            <>
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                              <span>قاعدة البيانات متصلة وتعمل بصورة ممتازة ✓</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-5 h-5 text-destructive" />
                              <span>تعذر الاتصال بقاعدة البيانات ✕</span>
                            </>
                          )}
                        </div>
                        {dbTestResult.latencyMs !== undefined && (
                          <Badge
                            variant="outline"
                            className={`text-[11px] font-mono ${
                              dbTestResult.connected
                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                                : 'bg-destructive/20 text-destructive border-destructive/40'
                            }`}
                          >
                            {dbTestResult.latencyMs} ms
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs leading-relaxed">
                        {dbTestResult.message || dbTestResult.error}
                      </p>

                      {dbTestResult.host && (
                        <div className="pt-2 border-t border-border/40 flex items-center gap-4 text-[11px] text-muted-foreground font-mono">
                          <span>الخادم: {dbTestResult.host}</span>
                          {dbTestResult.tableName && <span>الجدول الأساسي: {dbTestResult.tableName}</span>}
                        </div>
                      )}
                    </div>
                  )}
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

              {/* Legal & Billing Details */}
              <div className="p-3 bg-muted/20 rounded-xl border border-border space-y-3">
                <div className="font-bold text-foreground text-xs">بيانات السجل التجاري والفوترة للمكتب</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">رقم السجل التجاري</Label>
                    <Input
                      placeholder="1010XXXXXX"
                      value={formData.commercial_registration_number}
                      onChange={(e) => setFormData({ ...formData, commercial_registration_number: e.target.value })}
                      className="text-xs h-9 font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">عنوان المكتب / المقر</Label>
                    <Input
                      placeholder="الرياض - حي العليا - طريق الملك فهد"
                      value={formData.office_address}
                      onChange={(e) => setFormData({ ...formData, office_address: e.target.value })}
                      className="text-xs h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">اسم مسؤول الفوترة</Label>
                    <Input
                      placeholder="أ. عبد الله المحاسب"
                      value={formData.billing_contact_name}
                      onChange={(e) => setFormData({ ...formData, billing_contact_name: e.target.value })}
                      className="text-xs h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">هاتف الفوترة</Label>
                    <Input
                      placeholder="05XXXXXXXX"
                      value={formData.billing_contact_phone}
                      onChange={(e) => setFormData({ ...formData, billing_contact_phone: e.target.value })}
                      className="text-xs h-9 font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">بريد الفوترة</Label>
                    <Input
                      type="email"
                      placeholder="billing@lawfirm.sa"
                      value={formData.billing_contact_email}
                      onChange={(e) => setFormData({ ...formData, billing_contact_email: e.target.value })}
                      className="text-xs h-9 font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>
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

              {/* Legal & Billing Details */}
              <div className="p-3 bg-muted/20 rounded-xl border border-border space-y-3">
                <div className="font-bold text-foreground text-xs">بيانات السجل التجاري والفوترة للمكتب</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">رقم السجل التجاري</Label>
                    <Input
                      placeholder="1010XXXXXX"
                      value={formData.commercial_registration_number}
                      onChange={(e) => setFormData({ ...formData, commercial_registration_number: e.target.value })}
                      className="text-xs h-9 font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">عنوان المكتب / المقر</Label>
                    <Input
                      placeholder="الرياض - حي العليا - طريق الملك فهد"
                      value={formData.office_address}
                      onChange={(e) => setFormData({ ...formData, office_address: e.target.value })}
                      className="text-xs h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">اسم مسؤول الفوترة</Label>
                    <Input
                      placeholder="أ. عبد الله المحاسب"
                      value={formData.billing_contact_name}
                      onChange={(e) => setFormData({ ...formData, billing_contact_name: e.target.value })}
                      className="text-xs h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">هاتف الفوترة</Label>
                    <Input
                      placeholder="05XXXXXXXX"
                      value={formData.billing_contact_phone}
                      onChange={(e) => setFormData({ ...formData, billing_contact_phone: e.target.value })}
                      className="text-xs h-9 font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">بريد الفوترة</Label>
                    <Input
                      type="email"
                      placeholder="billing@lawfirm.sa"
                      value={formData.billing_contact_email}
                      onChange={(e) => setFormData({ ...formData, billing_contact_email: e.target.value })}
                      className="text-xs h-9 font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>
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

      {/* Add Payment Modal */}
      {isAddPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-border mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">تسجيل دفعة جديدة</h3>
                  <p className="text-xs text-muted-foreground">توثيق معاملة مالية وسداد اشتراك لمكتب محاماة</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddPaymentModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePayment} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">مكتب المحاماة المشترك *</Label>
                <select
                  required
                  value={paymentFormData.office_id}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, office_id: e.target.value })}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs font-medium text-foreground"
                >
                  <option value="">-- اختر المكتب --</option>
                  {admins.map((adm) => (
                    <option key={adm.id} value={adm.id}>
                      {adm.office_name || adm.username} ({adm.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">المبلغ *</Label>
                  <Input
                    type="number"
                    required
                    min={1}
                    step="any"
                    placeholder="مثال: 1500"
                    value={paymentFormData.amount}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                    className="text-xs h-10 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">العملة</Label>
                  <Input
                    value={paymentFormData.currency}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, currency: e.target.value })}
                    className="text-xs h-10 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">تاريخ السداد *</Label>
                  <Input
                    type="date"
                    required
                    value={paymentFormData.payment_date}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_date: e.target.value })}
                    className="text-xs h-10 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">طريقة الدفع *</Label>
                  <select
                    value={paymentFormData.method}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, method: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs font-medium text-foreground"
                  >
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="cash">نقدي</option>
                    <option value="credit_card">بطاقة ائتمانية</option>
                    <option value="check">شيك مصدق</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">حالة السداد *</Label>
                <select
                  value={paymentFormData.status}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, status: e.target.value as any })}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs font-medium text-foreground"
                >
                  <option value="paid">مدفوع ومؤكد</option>
                  <option value="pending">قيد الانتظار / معلق</option>
                  <option value="overdue">متأخر</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">ملاحظات / رقم المرجع</Label>
                <Textarea
                  placeholder="رقم الحوالة البنكية، رقم الإيصال، أو تفاصيل أخرى..."
                  value={paymentFormData.notes}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                  className="text-xs min-h-[70px] resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddPaymentModalOpen(false)}
                  className="text-xs cursor-pointer"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="text-xs font-bold bg-[#C99732] hover:bg-[#B28325] text-white cursor-pointer"
                >
                  {isSubmittingPayment ? 'جارٍ التسجيل...' : 'تسجيل الدفعة'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Payment Status Modal */}
      {isEditPaymentModalOpen && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">تعديل حالة الدفعة</h3>
                <p className="text-xs text-muted-foreground">
                  المكتب: {selectedPayment.office_name} ({Number(selectedPayment.amount).toLocaleString()} {selectedPayment.currency})
                </p>
              </div>
              <button
                onClick={() => setIsEditPaymentModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdatePayment} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">حالة السداد *</Label>
                <select
                  value={editPaymentStatus}
                  onChange={(e) => setEditPaymentStatus(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl border border-input bg-background text-xs font-medium text-foreground"
                >
                  <option value="paid">مدفوع ومؤكد</option>
                  <option value="pending">قيد الانتظار / معلق</option>
                  <option value="overdue">متأخر</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">ملاحظات</Label>
                <Textarea
                  value={editPaymentNotes}
                  onChange={(e) => setEditPaymentNotes(e.target.value)}
                  placeholder="ملاحظات حول المعاملة أو التحديث..."
                  className="text-xs min-h-[80px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditPaymentModalOpen(false)}
                  className="text-xs cursor-pointer"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="text-xs font-bold bg-[#C99732] hover:bg-[#B28325] text-white cursor-pointer"
                >
                  {isSubmittingPayment ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
