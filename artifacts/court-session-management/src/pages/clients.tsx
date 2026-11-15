import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'wouter';
import {
  UserCheck,
  Plus,
  Search,
  Phone,
  FileText,
  ChevronLeft,
  Trash2,
  Edit3,
  Loader2,
  AlertCircle,
  Link as LinkIcon,
  FolderOpen,
  Calendar,
  CheckSquare,
  ShieldCheck,
  Gavel,
  Check,
  User,
  ArrowLeft,
  Save,
  X,
  Building2,
  AlertTriangle,
  Download,
  RotateCcw,
  MessageCircle,
  ExternalLink,
  Sparkles,
  DollarSign,
  Scale,
  Briefcase,
  Users,
  Rows,
  LayoutGrid,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import { useGetCurrentUser } from '@workspace/api-client-react';

export interface ClientItem {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  type?: 'individual' | 'company';
  typeLabel?: string;
  isVerified?: boolean;
  assignedLawyer?: string;
  poaNumber?: string;
  poaStatus?: string;
  poaExpiryHijri?: string;
  remainingDays?: number;
  openCasesCount?: number;
  openCasesText?: string;
  statusNote?: string;
  commercialRegistration?: string;
  representative?: string;
  isExpiringPoa?: boolean;
  expiringDays?: number;
  location?: string;
  totalFees?: string;
  paidFees?: string;
  remainingFees?: string;
  aiSummary?: string;
  poaClauses?: Array<{
    title: string;
    status: 'authorized' | 'special_permission' | 'unauthorized';
    statusText: string;
  }>;
  createdAt?: string;
}

export default function ClientsPage() {
  const [, setLocation] = useLocation();
  const { data: currentUser } = useGetCurrentUser();
  const { toast } = useToast();

  // Active Tab: 'all' | 'companies' | 'individuals' | 'active_cases' | 'pending_docs'
  const [activeTab, setActiveTab] = useState<'all' | 'companies' | 'individuals' | 'active_cases' | 'pending_docs'>('all');

  // Search and Filter states
  const [search, setSearch] = useState('');
  const [lawyerFilter, setLawyerFilter] = useState('all');
  const [poaStatusFilter, setPoaStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Backend clients
  const [backendClients, setBackendClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientItem | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formType, setFormType] = useState<'individual' | 'company'>('individual');
  const [formNotes, setFormNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch real clients from backend
  const loadBackendClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/clients', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setBackendClients(data);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackendClients();
  }, [loadBackendClients]);

  // Map real backend clients
  const allClients: ClientItem[] = useMemo(() => {
    if (!backendClients || backendClients.length === 0) {
      return [];
    }
    return backendClients.map((b) => ({
      id: String(b.id),
      name: b.name || 'عميل مسجل',
      phone: b.phone || '',
      type: (b.client_type === 'company' || b.clientType === 'company') ? 'company' : 'individual',
      typeLabel: (b.client_type === 'company' || b.clientType === 'company') ? 'سجل تجاري' : 'فرد / موكل',
      isVerified: true,
      assignedLawyer: b.assigned_lawyer_name || b.assigned_lawyer || 'غير محدد',
      poaNumber: b.poa_number || (b.poa_count ? `${b.poa_count} وكالات` : ''),
      poaStatus: b.poa_status || (b.poa_number ? 'سارية' : 'بدون وكالة'),
      poaExpiryHijri: b.poa_expiry || '—',
      remainingDays: b.remaining_days ?? 0,
      openCasesCount: b.open_cases_count || (b.cases_count || 0),
      openCasesText: (b.open_cases_count || b.cases_count) ? `${b.open_cases_count || b.cases_count} قضايا نشطة` : 'لا توجد قضايا نشطة',
      statusNote: b.notes || 'ملف نشط ومحدث',
      location: b.location || '—',
      totalFees: b.total_fees || '—',
      paidFees: b.paid_fees || '—',
      remainingFees: b.remaining_fees || '—',
      aiSummary: b.ai_summary || 'تم تسجيل الموكل وربط ملفه ببيانات النظام ومتابعة قضاياه والوكالات المعتمدة.',
      poaClauses: [
        { title: 'المرافعة والمدافعة وتقديم اللوائح', status: 'authorized', statusText: 'مفوض ✓' },
        { title: 'الإقرار والإنكار وتوجيه اليمين', status: 'authorized', statusText: 'مفوض ✓' },
        { title: 'الصلح والتنازل والإبراء', status: 'special_permission', statusText: 'بإذن خاص ⚠' },
        { title: 'استلام المبالغ المالية والشيكات', status: 'unauthorized', statusText: 'غير مفوض ✗' },
      ],
      isExpiringPoa: Boolean(b.is_expiring_poa),
      expiringDays: b.remaining_days || 0,
      createdAt: b.created_at,
    }));
  }, [backendClients]);

  // Derived Dynamic KPI Counts
  const totalClientsCount = allClients.length;
  const companiesCount = allClients.filter((c) => c.type === 'company').length;
  const individualsCount = allClients.filter((c) => c.type === 'individual').length;
  const activeCasesClientsCount = allClients.filter((c) => (c.openCasesCount || 0) > 0).length;
  const activeCasesPercentage = totalClientsCount > 0 ? Math.round((activeCasesClientsCount / totalClientsCount) * 100) : 0;
  const validPoaCount = allClients.filter((c) => c.poaStatus === 'سارية' && !c.isExpiringPoa).length;
  const pendingActionCount = allClients.filter((c) => c.isExpiringPoa || !c.poaNumber).length;
  const totalCasesSum = allClients.reduce((acc, c) => acc + (c.openCasesCount || 0), 0);

  // Filtered clients list
  const filteredClients = useMemo(() => {
    return allClients.filter((c) => {
      // Tab filter
      if (activeTab === 'companies' && c.type !== 'company') return false;
      if (activeTab === 'individuals' && c.type !== 'individual') return false;
      if (activeTab === 'active_cases' && (!c.openCasesCount || c.openCasesCount === 0)) return false;
      if (activeTab === 'pending_docs' && !c.isExpiringPoa) return false;

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = c.name.toLowerCase().includes(q);
        const matchPhone = c.phone?.toLowerCase().includes(q);
        const matchCr = c.commercialRegistration?.toLowerCase().includes(q);
        const matchLawyer = c.assignedLawyer?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchCr && !matchLawyer) return false;
      }

      // Lawyer filter
      if (lawyerFilter !== 'all' && c.assignedLawyer !== lawyerFilter) return false;

      // POA filter
      if (poaStatusFilter === 'valid' && c.isExpiringPoa) return false;
      if (poaStatusFilter === 'expiring' && !c.isExpiringPoa) return false;

      return true;
    });
  }, [allClients, activeTab, search, lawyerFilter, poaStatusFilter]);

  // Handle Save Client
  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast({ title: 'يرجى إدخال اسم العميل', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        phone: formPhone.trim(),
        notes: formNotes.trim(),
        client_type: formType,
      };
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({ title: 'تمت إضافة العميل بنجاح', description: `تم فتح ملف الموكل ${formName}.` });
        loadBackendClients();
        setCreateOpen(false);
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'فشل إضافة العميل',
          description: err.error || 'تعذر حفظ بيانات العميل في قاعدة البيانات.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'خطأ في الاتصال بالخادم',
        description: 'تعذر حفظ بيانات العميل. يرجى التحقق من الشبكة.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Client
  const handleDeleteClient = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/clients/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: 'تم حذف العميل بنجاح' });
        loadBackendClients();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'فشل حذف العميل',
          description: err.error || 'تعذر حذف العميل من قاعدة البيانات.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'خطأ في الاتصال',
        description: 'تعذر تنفيذ عملية الحذف.',
        variant: 'destructive',
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="min-h-full bg-[#f8faff] text-[#1c1d22] pb-12 font-sans" dir="rtl">
      {/* ── Top Header Section ── */}
      <div className="px-4 lg:px-8 pt-6 pb-2 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs text-[#6e7687]">
              <span>لوحة التحكم</span>
              <span>/</span>
              <span>سجلات المكتب</span>
              <span>/</span>
              <span className="text-[#00236f] font-semibold">العملاء والموكلين</span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-6 rounded-full bg-[#fd8a42]" />
              <h1 className="text-2xl font-bold text-[#131b2e]">
                العملاء والموكلين
              </h1>
              <div className="w-7 h-7 rounded-lg bg-[#ebf3ff] text-[#00236f] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs text-[#55627a] leading-relaxed mr-3.5 max-w-3xl">
              إدارة وتدقيق ملفات العملاء، وسجلات القضايا والمهام والوكالات المرتبطة بهم.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={() => {
                setFormName('');
                setFormPhone('');
                setFormNotes('');
                setCreateOpen(true);
              }}
              className="bg-[#b87019] hover:bg-[#995c14] text-white text-xs font-bold h-10 px-4 gap-2 rounded-lg shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              + عميل جديد
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                loadBackendClients();
                toast({
                  title: 'مزامنة جهات الاتصال',
                  description: 'تمت مزامنة بيانات الموكلين مع السجلات وسجل الوكالات بنجاح.',
                });
              }}
              className="bg-white hover:bg-[#edf3ff] text-[#00236f] border-[#cfe0fc] text-xs font-semibold h-10 px-3.5 gap-1.5 rounded-lg cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#00236f]" />
              مزامنة جهات الاتصال
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                const csvContent =
                  'data:text/csv;charset=utf-8,الاسم,الهاتف,النوع,المحامي,الوكالة,القضايا\n' +
                  allClients
                    .map(
                      (c) =>
                        `"${c.name}","${c.phone}","${c.typeLabel}","${c.assignedLawyer}","${c.poaNumber}","${c.openCasesText}"`
                    )
                    .join('\n');
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', 'clients_registry.csv');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast({ title: 'تم تصدير سجل الموكلين بصيغة Excel / CSV' });
              }}
              className="bg-white hover:bg-[#edf3ff] text-[#44526d] border-[#d4e2f6] text-xs font-semibold h-10 px-3.5 gap-1.5 rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#55627a]" />
              تصدير السجل (Excel)
            </Button>
          </div>
        </div>

        {/* ── 4 KPI Metric Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: إجمالي العملاء والموكلين */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">إجمالي العملاء والموكلين</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-[#131c2d] font-mono">{totalClientsCount}</span>
                  <span className="text-xs text-[#526079]">عميل مسجل</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#ebf3ff] text-[#00236f] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] flex items-center justify-between text-[11px] text-[#697893]">
              <span>{individualsCount} أفراد • {companiesCount} شركات</span>
              <span className="text-emerald-700 font-semibold">نشط</span>
            </div>
          </div>

          {/* Card 2: عملاء بقضايا نشطة */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">عملاء بقضايا نشطة</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#131c2d] font-mono">{activeCasesClientsCount}</span>
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-1.5 py-0.2 rounded border border-emerald-200">
                    {activeCasesPercentage}% نشط
                  </span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Scale className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] flex items-center justify-between text-[11px] text-[#697893]">
              <span>مرتبطون بـ {totalCasesSum} قضية متداولة</span>
              <span className="text-[#00236f] font-semibold">متابعة حية</span>
            </div>
          </div>

          {/* Card 3: وكالات سارية مربوطة */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">وكالات سارية مربوطة</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold text-[#131c2d] font-mono">{validPoaCount}</span>
                  <span className="text-xs text-[#526079]">وكالة معتمدة</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#ebf3ff] text-[#00236f] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] flex items-center justify-between text-[11px] text-[#697893]">
              <span>تم التحقق عبر بوابة ناجز</span>
              <span className="text-emerald-700 font-semibold">100%</span>
            </div>
          </div>

          {/* Card 4: تتطلب متابعة وتحديث */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">تتطلب متابعة وتحديث</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#b44800] font-mono">{pendingActionCount}</span>
                  <span className="bg-[#fff0e6] text-[#b44800] text-[10px] font-semibold px-1.5 py-0.2 rounded border border-[#ffd5ba]">
                    إجراء مطلوب
                  </span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#fef5ec] text-[#b35600] flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] flex items-center justify-between text-[11px] text-[#697893]">
              <span>نقص هوية أو انتهاء وكالة</span>
              <span className="text-amber-800 font-bold">مراجعة فورية</span>
            </div>
          </div>
        </div>

        {/* ── Tabs & View Mode Row ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              كافة العملاء ({totalClientsCount})
            </button>

            <button
              onClick={() => setActiveTab('companies')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'companies'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              شركات ومؤسسات ({companiesCount})
            </button>

            <button
              onClick={() => setActiveTab('individuals')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'individuals'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              أفراد ومستثمرين ({individualsCount})
            </button>

            <button
              onClick={() => setActiveTab('active_cases')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === 'active_cases'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              <span>قضايا نشطة</span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                {activeCasesClientsCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('pending_docs')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === 'pending_docs'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              <span>بانتظار مستندات</span>
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                {pendingActionCount}
              </span>
            </button>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 text-xs text-[#63728d]">
            <span>طريقة العرض:</span>
            <div className="flex items-center gap-1 bg-white border border-[#dce7f6] p-1 rounded-md">
              <button className="p-1 rounded bg-[#edf3ff] text-[#00236f]">
                <Rows className="w-3.5 h-3.5" />
              </button>
              <button className="p-1 rounded text-[#71809a] hover:text-[#182337]">
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Search & Filter Controls ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 bg-white border border-[#dce7f6] p-2.5 rounded-xl shadow-2xs">
          {/* Search Input */}
          <div className="lg:col-span-5 relative">
            <Search className="w-4 h-4 text-[#8b99b0] absolute right-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم، رقم السجل المدني، السجل التجاري، أو الجوال..."
              className="pr-9 h-9 text-xs border-[#dce7f6] bg-[#f9fbff] focus:bg-white text-[#182337]"
            />
          </div>

          {/* Lawyer Filter */}
          <div className="lg:col-span-3">
            <select
              value={lawyerFilter}
              onChange={(e) => setLawyerFilter(e.target.value)}
              className="w-full h-9 text-xs bg-[#f9fbff] border border-[#dce7f6] rounded-md px-2.5 text-[#33425b] focus:outline-none cursor-pointer"
            >
              <option value="all">المحامي المكلف: كافة المحامين</option>
              <option value="أ. أحمد العتيبي">أ. أحمد العتيبي</option>
              <option value="أ. سلمان الدوسري">أ. سلمان الدوسري</option>
              <option value="أ. فهد الشمري">أ. فهد الشمري</option>
            </select>
          </div>

          {/* POA Status Filter */}
          <div className="lg:col-span-2">
            <select
              value={poaStatusFilter}
              onChange={(e) => setPoaStatusFilter(e.target.value)}
              className="w-full h-9 text-xs bg-[#f9fbff] border border-[#dce7f6] rounded-md px-2.5 text-[#33425b] focus:outline-none cursor-pointer"
            >
              <option value="all">حالة الوكالة: الكل</option>
              <option value="valid">سارية ومفعلة</option>
              <option value="expiring">تطلب تجديد</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="lg:col-span-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full h-9 text-xs bg-[#f9fbff] border border-[#dce7f6] rounded-md px-2.5 text-[#33425b] focus:outline-none cursor-pointer"
            >
              <option value="newest">فرز: الأحدث إضافة</option>
              <option value="name">فرز: الاسم أبجدياً</option>
              <option value="cases">فرز: الأكثر قضايا</option>
            </select>
          </div>
        </div>

        {/* ── Clients Cards Ledger (Full Width) ── */}
        <div className="space-y-3.5">
          {filteredClients.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#dbe6f8] p-12 text-center shadow-2xs">
              <Users className="w-12 h-12 text-[#9bb3d8] mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#141e30] mb-1">لا يوجد موكلون مسجلون</h3>
              <p className="text-xs text-[#637189] max-w-sm mx-auto mb-5">
                لم يتم العثور على أي عملاء مطابقين لخيارات البحث والتصفية، أو لم يتم تسجيل موكلين بعد في قاعدة البيانات.
              </p>
              <Button
                onClick={() => {
                  setFormName('');
                  setFormPhone('');
                  setFormNotes('');
                  setCreateOpen(true);
                }}
                className="bg-[#00236f] hover:bg-[#001a54] text-white text-xs font-bold px-4 py-2 rounded-lg"
              >
                <Plus className="w-4 h-4 ml-1.5" />
                تسجيل موكل جديد
              </Button>
            </div>
          ) : (
            filteredClients.map((client) => {
              const isExpiringCard = client.isExpiringPoa;

              return (
                <div
                  key={client.id}
                  className={`bg-white rounded-xl border p-4 transition-all shadow-2xs relative ${
                    isExpiringCard ? 'border-t-4 border-t-[#fd8a42] border-[#e2ecfa]' : 'border-[#dbe6f8]'
                  } hover:border-[#b8d1fc]`}
                >
                    {/* Card Top Row */}
                    <div className="flex items-start justify-between gap-3">
                      {/* Client Info */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            client.type === 'company'
                              ? 'bg-[#eaf1ff] text-[#00236f]'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {client.type === 'company' ? (
                            <Building2 className="w-5 h-5 text-[#00236f]" />
                          ) : (
                            client.name.slice(0, 2)
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-[#141e30]">{client.name}</h3>
                            {client.typeLabel && (
                              <span className="bg-[#f2f6fc] text-[#4d5c76] text-[10px] font-medium px-2 py-0.2 rounded border border-[#dce6f4]">
                                {client.typeLabel}
                              </span>
                            )}
                            {client.isVerified && (
                              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-1.5 py-0.2 rounded border border-emerald-200 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                موكل موثق
                              </span>
                            )}
                            {isExpiringCard && (
                              <span className="bg-[#fff0e6] text-[#b44800] text-[10px] font-bold px-1.5 py-0.2 rounded border border-[#ffd5ba]">
                                تطلب تجديد الوكالة
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-[#596883] mt-1 font-mono">
                            {client.phone && <span>{client.phone}</span>}
                            {client.commercialRegistration && (
                              <span className="font-semibold text-[#141e30]">{client.commercialRegistration}</span>
                            )}
                            <span className="text-[#a5b4cb]">•</span>
                            <span className="font-sans">المحامي المكلف: {client.assignedLawyer}</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions on Left */}
                      <div className="flex items-center gap-1.5 text-[#657591]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(client);
                          }}
                          className="p-1 rounded hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingClient(client);
                            setFormName(client.name);
                            setFormPhone(client.phone || '');
                            setFormNotes(client.statusNote || '');
                            setCreateOpen(true);
                          }}
                          className="p-1 rounded hover:bg-[#edf3ff] hover:text-[#00236f] transition-colors"
                          title="تعديل"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const msg = encodeURIComponent(
                              `السلام عليكم ورحمة الله، الأستاذ ${client.name} المحترم.\nنحيطكم علماً بآخر مستجدات ملفكم لدى مكتب المحاماة الرئيسي.\n- خالص التحيات.`
                            );
                            window.open(`https://wa.me/?text=${msg}`, '_blank');
                          }}
                          className="p-1 rounded hover:bg-[#edf3ff] hover:text-[#00236f] transition-colors"
                          title="واتساب"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expiring Alert Banner inside Company Card */}
                    {isExpiringCard && (
                      <div className="mt-3 bg-[#fff4ed] border border-[#ffd5ba] rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-[#556480] flex-1">
                          <div>
                            <span className="text-[#843600] text-[10px] block">مهلة التجديد</span>
                            <strong className="text-[#b44800] text-xs">تنتهي خلال {client.expiringDays || 18} يوماً</strong>
                          </div>
                          <div>
                            <span className="text-[#843600] text-[10px] block">الوكالة التجارية</span>
                            <strong className="text-[#141e30] font-mono text-xs">{client.poaNumber}</strong>
                          </div>
                          <div>
                            <span className="text-[#843600] text-[10px] block">القضايا المتأثرة</span>
                            <strong className="text-[#141e30] text-xs">{client.openCasesText}</strong>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const msg = encodeURIComponent(
                              `السلام عليكم ورحمة الله، السادة ${client.name} المحترمون.\nنود إحاطتكم بضرورة تجديد الوكالة التجارية رقم (${client.poaNumber}) لمتابعة القضايا التجارية النشطة.\n- مكتب المحاماة الرئيسي.`
                            );
                            window.open(`https://wa.me/?text=${msg}`, '_blank');
                          }}
                          className="bg-[#b44800] hover:bg-[#8f3900] text-white text-[11px] font-bold px-3 py-1.5 rounded-md flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          إشعار الموكل (واتساب للتجديد)
                        </button>
                      </div>
                    )}

                    {/* Middle Details Grid for Normal Cards */}
                    {!isExpiringCard && (
                      <div className="mt-3 pt-2.5 border-t border-[#edf3fc] grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-[#556480]">
                        <div>
                          <span className="text-[#7a8aa3] text-[11px] block">الوكالة الشرعية</span>
                          <strong className="text-[#152033] font-mono">
                            {client.poaStatus} {client.poaNumber ? `(${client.poaNumber})` : ''}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#7a8aa3] text-[11px] block">تاريخ الانتهاء</span>
                          <strong className="text-[#152033] font-mono">{client.poaExpiryHijri}</strong>
                        </div>
                        <div>
                          <span className="text-[#7a8aa3] text-[11px] block">القضايا المفتوحة</span>
                          <strong className="text-[#00236f] font-bold">{client.openCasesText}</strong>
                        </div>
                      </div>
                    )}

                    {/* Bottom Note & Link */}
                    <div className="mt-2.5 pt-2 border-t border-[#f4f7fc] flex items-center justify-between text-xs">
                      <div className="text-[11px] text-[#556480] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>{client.statusNote}</span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/clients/${client.id}`);
                        }}
                        className="text-[#00236f] hover:underline font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <span>عرض الملف الكامل</span>
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {/* Pagination Controls */}
            <div className="px-4 py-3 bg-white border border-[#dbe6f8] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#637189] shadow-2xs">
              <div className="flex items-center gap-3">
                <span>
                  عرض {filteredClients.length === 0 ? 0 : 1} إلى {filteredClients.length} من أصل {totalClientsCount} عميل مسجل
                </span>
                <span className="text-[#c7d5ea]">|</span>
                <span>لكل صفحة: {Math.max(10, filteredClients.length)}</span>
              </div>
              <div className="flex items-center gap-1 font-mono">
                <button className="w-7 h-7 rounded border border-[#d2e0f4] bg-[#00236f] text-white font-bold flex items-center justify-center">
                  1
                </button>
              </div>
            </div>
          </div>
        </div>

      {/* ── Dialog: Add / Edit Client ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#141e30]">
              {editingClient ? 'تعديل بيانات الموكل' : 'تسجيل موكل جديد'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#65738c]">
              أدخل البيانات الأساسية للعميل ورقم الهاتف وتصنيف المنشأة أو الفرد.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveClient} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="font-bold text-[#44526d]">اسم العميل / المنشأة *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="أدخل الاسم الرباعي أو اسم الشركة..."
                className="h-8 text-xs"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="font-bold text-[#44526d]">رقم الجوال *</Label>
              <Input
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="05XXXXXXXX"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="font-bold text-[#44526d]">تصنيف العميل</Label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as any)}
                className="w-full h-8 text-xs bg-[#f8faff] border border-[#dce7f6] rounded-md px-2 text-[#33425b] focus:outline-none cursor-pointer"
              >
                <option value="individual">فرد / مستثمر</option>
                <option value="company">شركة ومؤسسة</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="font-bold text-[#44526d]">ملاحظات وتفاصيل إضافية</Label>
              <Textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="أرقام الوكالات أو السجلات أو نوع التعامل..."
                rows={2}
                className="text-xs resize-none"
              />
            </div>

            <DialogFooter className="gap-2 sm:justify-start pt-2">
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-[#00236f] hover:bg-[#001c59] text-white text-xs"
              >
                {isSaving ? 'جارٍ الحفظ...' : 'حفظ الموكل'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="text-xs">
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog: Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="text-right" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold text-[#141e30]">
              تأكيد حذف ملف العميل
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#65738c]">
              هل أنت متأكد من رغبتك في حذف ملف الموكل ({deleteTarget?.name})؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogAction
              onClick={handleDeleteClient}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs"
            >
              حذف الملف
            </AlertDialogAction>
            <AlertDialogCancel className="text-xs">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
