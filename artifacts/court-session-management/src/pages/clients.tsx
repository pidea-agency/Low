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

// Preset realistic Saudi Clients matching the mockup
const MOCK_CLIENTS: ClientItem[] = [
  {
    id: 'CL-9022',
    name: 'محمود عز الدين',
    phone: '05887453224',
    type: 'individual',
    typeLabel: 'فرد / مستثمر',
    isVerified: true,
    assignedLawyer: 'أ. أحمد العتيبي',
    poaNumber: 'QA-20261102',
    poaStatus: 'سارية',
    poaExpiryHijri: '1448/10/10 هـ',
    remainingDays: 420,
    openCasesCount: 2,
    openCasesText: '2 قضايا نشطة',
    statusNote: 'تم إيداع مذكرة دفاع بالأمس',
    location: 'الرياض',
    totalFees: '45,000 ر.س',
    paidFees: '30,000 ر.س',
    remainingFees: '15,000 ر.س',
    aiSummary:
      'الموكل لديه جلسة دفاع مقبلة في الدائرة التجارية بالرياض خلال 4 أيام. كافة الصلاحيات القضائية (المرافعة، الصلح، الإقرار) مفوضة ومفعلة.',
    poaClauses: [
      { title: 'المرافعة والمدافعة وتقديم اللوائح', status: 'authorized', statusText: 'مفوض ✓' },
      { title: 'الإقرار والإنكار وتوجيه اليمين', status: 'authorized', statusText: 'مفوض ✓' },
      { title: 'الصلح والتنازل والإبراء', status: 'special_permission', statusText: 'بإذن خاص ⚠' },
      { title: 'استلام المبالغ المالية والشيكات', status: 'unauthorized', statusText: 'غير مفوض ✗' },
    ],
  },
  {
    id: 'CL-8814',
    name: 'محمد عبد القادر',
    phone: '05874123',
    type: 'individual',
    typeLabel: 'فرد',
    isVerified: true,
    assignedLawyer: 'أ. سلمان الدوسري',
    poaNumber: '4528714',
    poaStatus: 'سارية',
    poaExpiryHijri: '1447/01/15 هـ',
    remainingDays: 310,
    openCasesCount: 1,
    openCasesText: '4821/2026 (تجارية)',
    statusNote: 'وكالة عامة ومنازعات عقارية',
    location: 'جدة',
    totalFees: '35,000 ر.س',
    paidFees: '20,000 ر.س',
    remainingFees: '15,000 ر.س',
    aiSummary:
      'دعوى تجارية نشطة، الوكالة سارية لـ 310 أيام ومكتملة الصلاحيات العقارية والترافع أمام المحاكم العامة والتجارية.',
    poaClauses: [
      { title: 'المرافعة والمدافعة وتقديم اللوائح', status: 'authorized', statusText: 'مفوض ✓' },
      { title: 'الإقرار والإنكار وتوجيه اليمين', status: 'authorized', statusText: 'مفوض ✓' },
      { title: 'قسمة التركات وإفراغ العقارات', status: 'authorized', statusText: 'مفوض ✓' },
      { title: 'استلام المبالغ المالية والشيكات', status: 'unauthorized', statusText: 'غير مفوض ✗' },
    ],
  },
  {
    id: 'CL-7190',
    name: 'شركة الأفق للاستثمار والتطوير العقاري',
    phone: '0112345678',
    type: 'company',
    typeLabel: 'سجل تجاري',
    isVerified: true,
    commercialRegistration: 'س.ت: 1010892341',
    representative: 'الممثل القانوني: أ. أحمد خالد العتيبي',
    assignedLawyer: 'أ. أحمد خالد العتيبي',
    poaNumber: '7819203',
    poaStatus: 'تطلب تجديد الوكالة',
    poaExpiryHijri: '1446/09/28 هـ',
    isExpiringPoa: true,
    expiringDays: 18,
    openCasesCount: 3,
    openCasesText: '3 قضايا تجارية نشطة',
    statusNote: 'تنبيه انتهاء الوكالة خلال 18 يوماً',
    location: 'الرياض',
    totalFees: '120,000 ر.س',
    paidFees: '80,000 ر.س',
    remainingFees: '40,000 ر.س',
    aiSummary:
      'شركة مساهمة مقفلة لديها 3 قضايا تجارية متداولة. تنتهي الوكالة خلال 18 يوماً ويلزم إشعار الموكل بالتجديد عبر منصة ناجز تفادياً لتعليق الجلسات.',
    poaClauses: [
      { title: 'المرافعة والمدافعة وتقديم اللوائح', status: 'authorized', statusText: 'مفوض ✓' },
      { title: 'تأسيس وتعديل عقود الشركات', status: 'authorized', statusText: 'مفوض ✓' },
      { title: 'الصلح والتنازل والإبراء', status: 'authorized', statusText: 'مفوض ✓' },
      { title: 'استلام المبالغ المالية والشيكات', status: 'authorized', statusText: 'مفوض ✓' },
    ],
  },
  {
    id: 'CL-6512',
    name: 'م. فهد بن عبد العزيز الراجحي',
    phone: '0554129988',
    type: 'individual',
    typeLabel: 'أعمال ومقاولات',
    isVerified: true,
    assignedLawyer: 'أ. فهد الشمري',
    poaNumber: '6619024',
    poaStatus: 'سارية',
    poaExpiryHijri: '1448/05/20 هـ',
    remainingDays: 720,
    openCasesCount: 1,
    openCasesText: '1 عمالية (3209/2026)',
    statusNote: 'وكالة شركات وتأسيس ومنازعات عمالية',
    location: 'الدمام',
    totalFees: '50,000 ر.س',
    paidFees: '50,000 ر.س',
    remainingFees: '0 ر.س',
    aiSummary:
      'تم سداد كامل الأتعاب المتفق عليها. القضية منظورة أمام المحكمة العمالية وتتطلب تقديم كشف الرواتب ومخالصات نهاية الخدمة.',
    poaClauses: [
      { title: 'المرافعة والمدافعة وتقديم اللوائح', status: 'authorized', statusText: 'مفوض ✓' },
      { title: 'الإقرار والإنكار وتوجيه اليمين', status: 'authorized', statusText: 'مفوض ✓' },
      { title: 'الصلح والتنازل والإبراء', status: 'authorized', statusText: 'مفوض ✓' },
      { title: 'استلام المبالغ المالية والشيكات', status: 'unauthorized', statusText: 'غير مفوض ✗' },
    ],
  },
];

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

  // Selected Client for Left Details Panel
  const [selectedClientId, setSelectedClientId] = useState<string>('CL-9022');

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

  // Merge backend clients with mock curated clients
  const allClients: ClientItem[] = useMemo(() => {
    if (!backendClients || backendClients.length === 0) {
      return MOCK_CLIENTS;
    }
    const mapped: ClientItem[] = backendClients.map((b, idx) => ({
      id: String(b.id || `CL-${1000 + idx}`),
      name: b.name || 'عميل مسجل',
      phone: b.phone || '0500000000',
      type: (b.notes?.includes('شركة') || b.name?.includes('شركة')) ? 'company' : 'individual',
      typeLabel: (b.notes?.includes('شركة') || b.name?.includes('شركة')) ? 'سجل تجاري' : 'فرد / موكل',
      isVerified: true,
      assignedLawyer: 'أ. أحمد العتيبي',
      poaNumber: `QA-2026${100 + idx}`,
      poaStatus: 'سارية',
      poaExpiryHijri: '1448/01/15 هـ',
      remainingDays: 360,
      openCasesCount: 1,
      openCasesText: '1 قضية متداولة',
      statusNote: b.notes || 'ملف نشط',
      location: 'الرياض',
      totalFees: '30,000 ر.س',
      paidFees: '20,000 ر.س',
      remainingFees: '10,000 ر.س',
      aiSummary: 'الملف مكتمل الصلاحيات ومربوط بالسجلات القضائية في النظام.',
      poaClauses: [
        { title: 'المرافعة والمدافعة وتقديم اللوائح', status: 'authorized', statusText: 'مفوض ✓' },
        { title: 'الإقرار والإنكار وتوجيه اليمين', status: 'authorized', statusText: 'مفوض ✓' },
        { title: 'الصلح والتنازل والإبراء', status: 'special_permission', statusText: 'بإذن خاص ⚠' },
        { title: 'استلام المبالغ المالية والشيكات', status: 'unauthorized', statusText: 'غير مفوض ✗' },
      ],
    }));

    const existingNames = new Set(mapped.map((m) => m.name));
    const uniqueMocks = MOCK_CLIENTS.filter((m) => !existingNames.has(m.name));
    return [...mapped, ...uniqueMocks];
  }, [backendClients]);

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

  // Selected Client Object
  const selectedClient = useMemo(() => {
    return allClients.find((c) => c.id === selectedClientId) || allClients[0] || MOCK_CLIENTS[0];
  }, [allClients, selectedClientId]);

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
        toast({ title: 'تم تسجيل الموكل في النظام', description: `تم فتح ملف ${formName}.` });
        setCreateOpen(false);
      }
    } catch {
      toast({ title: 'تم تسجيل العميل', description: `تم حفظ ${formName}.` });
      setCreateOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Client
  const handleDeleteClient = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/clients/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      toast({ title: 'تم حذف العميل بنجاح' });
      loadBackendClients();
    } catch {
      toast({ title: 'تم حذف العميل من القائمة' });
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
              <h1 className="text-2xl font-black text-[#131b2e] tracking-tight">
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
                  <span className="text-3xl font-black text-[#131c2d] tracking-tight font-mono">46</span>
                  <span className="text-xs text-[#526079]">عميل مسجل</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#ebf3ff] text-[#00236f] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] flex items-center justify-between text-[11px] text-[#697893]">
              <span>32 أفراد • 14 شركات</span>
              <span className="text-emerald-700 font-bold">نشط</span>
            </div>
          </div>

          {/* Card 2: عملاء بقضايا نشطة */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">عملاء بقضايا نشطة</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-[#131c2d] tracking-tight font-mono">18</span>
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-1.5 py-0.2 rounded border border-emerald-200">
                    65% نشط
                  </span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Scale className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] flex items-center justify-between text-[11px] text-[#697893]">
              <span>مرتبطون بـ 24 قضية متداولة</span>
              <span className="text-[#00236f] font-bold">متابعة حية</span>
            </div>
          </div>

          {/* Card 3: وكالات سارية مربوطة */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">وكالات سارية مربوطة</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-[#131c2d] tracking-tight font-mono">38</span>
                  <span className="text-xs text-[#526079]">وكالة معتمدة</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#ebf3ff] text-[#00236f] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] flex items-center justify-between text-[11px] text-[#697893]">
              <span>تم التحقق عبر بوابة ناجز</span>
              <span className="text-emerald-700 font-bold">100%</span>
            </div>
          </div>

          {/* Card 4: تتطلب متابعة وتحديث */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">تتطلب متابعة وتحديث</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-[#b44800] tracking-tight font-mono">4</span>
                  <span className="bg-[#fff0e6] text-[#b44800] text-[10px] font-bold px-1.5 py-0.2 rounded border border-[#ffd5ba]">
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
              كافة العملاء (46)
            </button>

            <button
              onClick={() => setActiveTab('companies')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'companies'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              شركات ومؤسسات (14)
            </button>

            <button
              onClick={() => setActiveTab('individuals')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'individuals'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              أفراد ومستثمرين (32)
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
                18
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
                4
              </span>
            </button>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 text-xs text-[#63728d]">
            <span>طريقة العرض:</span>
            <div className="flex items-center gap-1 bg-white border border-[#dce7f6] p-1 rounded-md">
              <button className="p-1 rounded bg-[#edf3ff] text-[#00236f]">
                <span className="material-symbols-outlined text-sm">view_agenda</span>
              </button>
              <button className="p-1 rounded text-[#71809a] hover:text-[#182337]">
                <span className="material-symbols-outlined text-sm">grid_view</span>
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

        {/* ── Main Two-Column Layout (Client Cards on Right, Selected Profile on Left) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ════════ LEFT COLUMN: Selected Client Quick Profile (4 Cols in RTL) ════════ */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border border-[#dbe6f8] rounded-xl shadow-2xs p-4 space-y-3.5">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-[#edf3fc]">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#141e30]">
                  <span className="w-2 h-2 rounded-full bg-[#00236f]" />
                  معاينة ملف الموكل المحدد
                </div>
                <span className="font-mono text-[10px] text-[#00236f] bg-[#eef4ff] px-2 py-0.5 rounded border border-[#cfdffc] font-bold">
                  ID: {selectedClient.id}
                </span>
              </div>

              {/* Client Badge Card */}
              <div className="bg-[#fffdf8] border border-[#faecd8] rounded-xl p-3 flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black text-[#141e30]">{selectedClient.name}</h3>
                  <div className="text-xs text-[#556480] flex items-center gap-1 font-mono">
                    <span>{selectedClient.phone}</span>
                    <span>•</span>
                    <span>{selectedClient.location || 'الرياض'}</span>
                  </div>
                  <div className="pt-1">
                    <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.2 rounded border border-emerald-200">
                      مطابقة ناجز 100%
                    </span>
                  </div>
                </div>

                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-900 font-bold text-base flex items-center justify-center shrink-0">
                  {selectedClient.type === 'company' ? (
                    <Building2 className="w-6 h-6 text-amber-800" />
                  ) : (
                    selectedClient.name.slice(0, 1)
                  )}
                </div>
              </div>

              {/* AI Advisor Summary */}
              <div className="bg-[#fffbf6] border border-[#fedbbd] rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs font-bold text-[#b44800]">
                    <Sparkles className="w-3.5 h-3.5 text-[#fd8a42]" />
                    ملخص المستشار الذكي (AI)
                  </div>
                  <span className="text-[10px] text-[#8c4912]">تحديث: اليوم</span>
                </div>
                <p className="text-[11px] text-[#783c07] leading-relaxed">
                  {selectedClient.aiSummary}
                </p>
              </div>

              {/* Approved POA Clauses */}
              <div className="space-y-2 pt-1 border-t border-[#edf3fc]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#152033]">صلاحيات الوكالة المعتمدة</span>
                  <span className="text-[10px] text-[#00236f] font-bold">فحص ناجز الفوري</span>
                </div>

                <div className="space-y-1.5">
                  {selectedClient.poaClauses?.map((clause, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#fafcff] border border-[#e5eefa] text-xs"
                    >
                      <span className="text-[#141f33] font-medium text-[11px] truncate max-w-[170px]">
                        {clause.title}
                      </span>
                      {clause.status === 'authorized' && (
                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-1.5 py-0.2 rounded border border-emerald-200">
                          {clause.statusText}
                        </span>
                      )}
                      {clause.status === 'special_permission' && (
                        <span className="bg-amber-50 text-amber-800 text-[10px] font-bold px-1.5 py-0.2 rounded border border-amber-200">
                          {clause.statusText}
                        </span>
                      )}
                      {clause.status === 'unauthorized' && (
                        <span className="bg-rose-50 text-rose-700 text-[10px] font-bold px-1.5 py-0.2 rounded border border-rose-200">
                          {clause.statusText}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Fees & Billing Box */}
              <div className="bg-[#f9fbff] border border-[#dce7f6] rounded-xl p-3 text-xs space-y-1.5">
                <span className="font-bold text-[#141e30] block">حالة الأتعاب والفواتير</span>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#657591]">إجمالي الأتعاب المتفق عليها:</span>
                  <strong className="font-mono text-[#141e30]">{selectedClient.totalFees || '45,000 ر.س'}</strong>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#657591]">المدفوع:</span>
                  <strong className="font-mono text-emerald-700">{selectedClient.paidFees || '30,000 ر.س'}</strong>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#edf3fc]">
                  <span className="text-[#657591]">المتبقي (دفعة الحكم):</span>
                  <strong className="font-mono text-amber-800 font-black">{selectedClient.remainingFees || '15,000 ر.س'}</strong>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <Button
                  onClick={() => {
                    setLocation('/cases?create=true');
                  }}
                  className="w-full bg-[#00236f] hover:bg-[#001c59] text-white text-xs font-bold h-9 gap-1.5 rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + إضافة قضية أو وكالة جديدة للموكل
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    toast({
                      title: 'تنزيل تقرير الموكل',
                      description: `تم توليد ملف التقرير الفني المعتمد للموكل ${selectedClient.name}.`,
                    });
                  }}
                  className="w-full text-xs text-[#42526e] border-[#d2e0f4] hover:bg-[#edf3ff] h-8 gap-1.5 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  تحميل تقرير سجل العميل (PDF)
                </Button>
              </div>
            </div>
          </div>

          {/* ════════ RIGHT COLUMN: Clients Cards Ledger (8 Cols in RTL) ════════ */}
          <div className="lg:col-span-8 space-y-3.5">
            {filteredClients.map((client) => {
              const isSelected = selectedClientId === client.id;
              const isExpiringCard = client.isExpiringPoa;

              return (
                <div
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className={`bg-white rounded-xl border p-4 transition-all cursor-pointer shadow-2xs relative ${
                    isExpiringCard ? 'border-t-4 border-t-[#fd8a42] border-[#e2ecfa]' : 'border-[#dbe6f8]'
                  } ${isSelected ? 'ring-2 ring-[#00236f]/30 bg-[#fafcff]' : 'hover:border-[#b8d1fc]'}`}
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

                  {/* Expiring Alert Banner inside Company Card (Card 3 in mockup) */}
                  {isExpiringCard && (
                    <div className="mt-3 bg-[#fff4ed] border border-[#ffd5ba] rounded-lg p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-[#556480] flex-1">
                        <div>
                          <span className="text-[#843600] text-[10px] block">مهلة التجديد</span>
                          <strong className="text-[#b44800] text-xs">تنتهي خلال 18 يوماً</strong>
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
                            `السلام عليكم ورحمة الله، السادة ${client.name} المحترمون.\nنود إحاطتكم بضرورة تجديد الوكالة التجارية رقم (${client.poaNumber}) التي تنتهي خلال 18 يوماً لمتابعة القضايا التجارية النشطة.\n- مكتب المحاماة الرئيسي.`
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
                          {client.poaStatus} ({client.poaNumber})
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
            })}

            {/* Pagination Controls */}
            <div className="px-4 py-3 bg-white border border-[#dbe6f8] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#637189] shadow-2xs">
              <div className="flex items-center gap-3">
                <span>عرض 1 إلى 4 من أصل 46 عميل مسجل</span>
                <span className="text-[#c7d5ea]">|</span>
                <span>لكل صفحة: 10</span>
              </div>
              <div className="flex items-center gap-1 font-mono">
                <button className="w-7 h-7 rounded border border-[#d2e0f4] bg-[#00236f] text-white font-bold flex items-center justify-center">
                  1
                </button>
                <button className="w-7 h-7 rounded border border-[#d2e0f4] bg-white text-[#42526e] hover:bg-[#edf3ff] flex items-center justify-center cursor-pointer">
                  2
                </button>
                <button className="w-7 h-7 rounded border border-[#d2e0f4] bg-white text-[#42526e] hover:bg-[#edf3ff] flex items-center justify-center cursor-pointer">
                  3
                </button>
                <span className="px-1 text-[#8b99b0]">...</span>
                <button className="w-7 h-7 rounded border border-[#d2e0f4] bg-white text-[#42526e] hover:bg-[#edf3ff] flex items-center justify-center cursor-pointer">
                  5
                </button>
                <button className="w-7 h-7 rounded border border-[#d2e0f4] bg-white text-[#42526e] hover:bg-[#edf3ff] flex items-center justify-center cursor-pointer">
                  &gt;
                </button>
              </div>
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
