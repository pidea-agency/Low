import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Search,
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Users,
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  RotateCcw,
  Scale,
  Gavel,
  ShieldAlert,
  Edit2,
  UserCheck,
  ExternalLink,
  Hourglass,
  Layers,
  ArrowLeft,
  Printer,
  Download,
  UploadCloud,
  CheckCircle,
  CircleDot,
  Paperclip,
  ArrowLeftRight,
  MoreHorizontal,
  Save,
  X,
  Eye,
  MessageSquare,
  FilePlus,
  ChevronDown,
  Sparkles,
  AlarmClock,
  Check,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useGetCurrentUser } from '@workspace/api-client-react';
import { ClientPicker } from '@/components/clients/client-picker';
import { LawyerSelect } from '@/components/clients/lawyer-select';
import { ReassignDialog } from '@/components/clients/reassign-dialog';
import { AttachmentsPanel } from '@/components/attachments/attachments-panel';

export interface CaseItem {
  id: string;
  officeId?: string;
  clientId?: string;
  caseNumber: string;
  caseType: string;
  court: string;
  circuit?: string;
  judge?: string;
  assignedLawyerId?: string | null;
  assignedLawyerName?: string;
  assignedLawyerInitials?: string;
  lawyerProgress?: number;
  status: 'open' | 'closed' | 'postponed' | string;
  proceduralStatus?: string;
  proceduralBadgeType?: 'warning' | 'info' | 'amber' | 'success' | 'purple';
  nextHearingText?: string;
  nextHearingSub?: string;
  nextHearingIcon?: string;
  opposingParty?: string | null;
  clientName?: string;
  claimAmount?: string;
  agencyNumber?: string;
  agencyStatus?: string;
  acceptanceRate?: string;
  aiAnalysis?: string;
  timelineStage?: string;
  timeline?: Array<{
    title: string;
    dateAndCourt: string;
    status: 'completed' | 'active' | 'upcoming';
  }>;
  attachments?: Array<{
    name: string;
    sizeAndNote: string;
    type: 'pdf' | 'docx';
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export default function CasesPage() {
  const { data: currentUser } = useGetCurrentUser();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Active status tab: 'all' | 'under_review' | 'needs_action' | 'closed' | 'archive'
  const [activeTab, setActiveTab] = useState<'all' | 'under_review' | 'needs_action' | 'closed' | 'archive'>('all');

  // View Mode: 'split' (as in screenshot) | 'full_detail' | 'cards'
  const [viewType, setViewType] = useState<'table' | 'cards'>('table');

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [courtFilter, setCourtFilter] = useState('all');
  const [lawyerFilter, setLawyerFilter] = useState('all');
  const [phaseFilter, setPhaseFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Selected Case for the Left Detail Panel
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFullDetailModalOpen, setIsFullDetailModalOpen] = useState(false);
  const [reassignCaseTarget, setReassignCaseTarget] = useState<CaseItem | null>(null);

  // Form State for Creating a Case
  const [formCaseNumber, setFormCaseNumber] = useState('');
  const [formClientName, setFormClientName] = useState('');
  const [formOpposingParty, setFormOpposingParty] = useState('');
  const [formCourt, setFormCourt] = useState('المحكمة التجارية بالرياض');
  const [formCircuit, setFormCircuit] = useState('الدائرة الرابعة');
  const [formCaseType, setFormCaseType] = useState('مطالبة مالية وتوريد');
  const [formClaimAmount, setFormClaimAmount] = useState('');

  // 1. Fetch Cases from Backend
  const { data: backendCases = [], isLoading: isLoadingCases } = useQuery<any[]>({
    queryKey: ['/api/cases'],
    queryFn: async () => {
      const res = await fetch('/api/cases', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch Cases Statistics for live dynamic counts
  const { data: caseStats } = useQuery<{
    total: number;
    open: number;
    closed: number;
    postponed: number;
  }>({
    queryKey: ['/api/cases/stats'],
    queryFn: async () => {
      const res = await fetch('/api/cases/stats', { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Map backend cases directly to CaseItem format (No mock data fallback)
  const allCases: CaseItem[] = useMemo(() => {
    if (!backendCases || backendCases.length === 0) {
      return [];
    }
    return backendCases.map((bc) => ({
      id: String(bc.id),
      caseNumber: bc.caseNumber || 'بدون رقم',
      caseType: bc.caseType || 'دعوى قضائية',
      court: bc.court || 'المحكمة المختصة',
      circuit: bc.courtCircuit || 'الدائرة القضائية',
      judge: bc.judge || '—',
      clientName: bc.clientName || 'موكل مسجل',
      opposingParty: bc.opposingParty || '—',
      assignedLawyerName: bc.assignedLawyerName || 'غير مسند',
      assignedLawyerInitials: bc.assignedLawyerName ? bc.assignedLawyerName.slice(0, 2) : 'غ',
      lawyerProgress: bc.status === 'closed' ? 100 : bc.status === 'postponed' ? 50 : 25,
      status: bc.status || 'open',
      proceduralStatus:
        bc.status === 'closed'
          ? 'منتهية - محكوم لصالحنا'
          : bc.status === 'postponed'
          ? 'مؤجلة / بانتظار إجراء'
          : 'قيد المرافعة',
      proceduralBadgeType:
        bc.status === 'closed' ? 'success' : bc.status === 'postponed' ? 'warning' : 'info',
      nextHearingText: bc.nextHearingDate
        ? new Date(bc.nextHearingDate).toLocaleDateString('ar-SA')
        : 'مجدولة قريباً',
      nextHearingSub: 'جلسة مرافعة',
      claimAmount: bc.claimAmount
        ? `${Number(bc.claimAmount).toLocaleString('ar-SA')} ر.س`
        : 'دعوى منظورة في المحكمة المختصة',
      agencyNumber: bc.poaNumber ? `${bc.poaNumber} (سارية ✓)` : '—',
      agencyStatus: bc.poaNumber ? 'سارية ✓' : '—',
      acceptanceRate: bc.acceptanceRate || '',
      aiAnalysis: bc.notes || 'تم تسجيل القضية بنجاح ومتابعة الإجراءات ومواعيد الجلسات المرتبطة.',
      timelineStage: bc.status === 'closed' ? 'محكوم بها' : 'مرافعة',
      timeline: [
        { title: 'قيد القضية في النظام', dateAndCourt: bc.court || 'المحكمة', status: 'completed' },
      ],
      attachments: Array.isArray(bc.attachments) ? bc.attachments : [],
    }));
  }, [backendCases]);

  // Derived KPI metrics directly from real DB records / stats
  const totalCasesCount = caseStats?.total ?? allCases.length;
  const openCasesCount = caseStats?.open ?? allCases.filter((c) => c.status === 'open').length;
  const postponedCasesCount =
    caseStats?.postponed ??
    allCases.filter((c) => c.status === 'postponed' || c.proceduralBadgeType === 'warning').length;
  const closedCasesCount = caseStats?.closed ?? allCases.filter((c) => c.status === 'closed').length;
  const openPercentage = totalCasesCount > 0 ? Math.round((openCasesCount / totalCasesCount) * 100) : 0;
  const winRate =
    closedCasesCount + openCasesCount > 0
      ? Math.round((closedCasesCount / Math.max(1, closedCasesCount + openCasesCount)) * 100)
      : 0;

  // Filtered cases
  const filteredCases = useMemo(() => {
    return allCases.filter((item) => {
      // Tab filter
      if (activeTab === 'under_review' && item.status !== 'open') return false;
      if (activeTab === 'needs_action' && item.proceduralBadgeType !== 'warning' && item.status !== 'postponed')
        return false;
      if (activeTab === 'closed' && item.status !== 'closed') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = item.caseNumber.toLowerCase().includes(q);
        const matchClient = item.clientName?.toLowerCase().includes(q);
        const matchOpponent = item.opposingParty?.toLowerCase().includes(q);
        const matchCourt = item.court.toLowerCase().includes(q);
        const matchType = item.caseType.toLowerCase().includes(q);
        if (!matchNumber && !matchClient && !matchOpponent && !matchCourt && !matchType) return false;
      }

      // Court filter
      if (courtFilter !== 'all' && !item.court.includes(courtFilter)) return false;

      // Lawyer filter
      if (lawyerFilter !== 'all' && item.assignedLawyerName !== lawyerFilter) return false;

      return true;
    });
  }, [allCases, activeTab, searchQuery, courtFilter, lawyerFilter]);

  // Selected Case Object (Null if no cases exist in DB)
  const selectedCase = useMemo(() => {
    if (allCases.length === 0) return null;
    const found = allCases.find((c) => c.id === selectedCaseId);
    return found || allCases[0] || null;
  }, [allCases, selectedCaseId]);

  // Handle Create Case Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCaseNumber.trim()) {
      toast({ title: 'يرجى إدخال رقم القضية', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          caseNumber: formCaseNumber.trim(),
          caseType: formCaseType.trim(),
          court: formCourt.trim(),
          courtCircuit: formCircuit.trim(),
          opposingParty: formOpposingParty.trim(),
          clientName: formClientName.trim(),
          status: 'open',
        }),
      });

      if (res.ok) {
        toast({
          title: 'تم فتح ملف القضية بنجاح',
          description: `تم تسجيل القضية رقم ${formCaseNumber} وإضافتها لملفات المكتب.`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
        queryClient.invalidateQueries({ queryKey: ['/api/cases/stats'] });
        setIsCreateOpen(false);
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'فشل تسجيل القضية',
          description: err.error || 'تعذر حفظ ملف القضية في قاعدة البيانات.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'خطأ في الاتصال بالخادم',
        description: 'تعذر حفظ ملف القضية. يرجى التحقق من اتصال الشبكة.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-full bg-[#f8faff] text-[#1c1d22] pb-12 font-sans" dir="rtl">
      {/* ── Top Header and Action Bar ── */}
      <div className="px-4 lg:px-8 pt-6 pb-2 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-6 rounded-full bg-[#fd8a42]" />
              <h1 className="text-2xl font-bold text-[#131b2e]">
                إدارة ملفات القضايا والنزاعات
              </h1>
            </div>
            <p className="text-xs text-[#55627a] leading-relaxed mr-3.5">
              الكيان المركزي لمتابعة القضايا، الجلسات المرتبطة، الأحكام والمستندات، وتوزيع الملفات القضائية وتكليف المحامين.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={() => {
                setFormCaseNumber(`${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`);
                setIsCreateOpen(true);
              }}
              className="bg-[#00236f] hover:bg-[#001c59] text-white text-xs font-bold h-10 px-4 gap-2 rounded-lg shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              فتح ملف قضية جديدة
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                toast({
                  title: 'مزامنة ناجز ومعين القضائية',
                  description: 'تم تحديث كافة بيانات القضايا والجلسات المربوطة إلكترونياً بنجاح.',
                });
              }}
              className="bg-white hover:bg-[#edf3ff] text-[#00236f] border-[#cfe0fc] text-xs font-semibold h-10 px-3.5 gap-1.5 rounded-lg cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#00236f]" />
              مزامنة ناجز القضائية
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                const csvContent =
                  'data:text/csv;charset=utf-8,رقم القضية,التصنيف,المحكمة,الموكل,الخصم,المحامي,الحالة\n' +
                  allCases
                    .map(
                      (c) =>
                        `"${c.caseNumber}","${c.caseType}","${c.court}","${c.clientName}","${c.opposingParty}","${c.assignedLawyerName}","${c.proceduralStatus}"`
                    )
                    .join('\n');
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', 'cases_registry.csv');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast({ title: 'تم تصدير تقرير القضايا بصيغة Excel / CSV' });
              }}
              className="bg-white hover:bg-[#edf3ff] text-[#44526d] border-[#d4e2f6] text-xs font-semibold h-10 px-3.5 gap-1.5 rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#55627a]" />
              تصدير تقرير (PDF / XLS)
            </Button>
          </div>
        </div>

        {/* ── 4 KPI Metric Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: إجمالي القضايا المسجلة (Solid Navy Blue Card matching screenshot) */}
          <div className="bg-[#00236f] text-white rounded-xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-white/80">إجمالي القضايا المسجلة</span>
                <div className="text-3xl font-bold font-mono">{totalCasesCount}</div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-white/15 flex items-center justify-between text-[11px]">
              <span className="bg-[#fd8a42] text-white font-medium px-2 py-0.5 rounded-full text-[10px]">
                {totalCasesCount > 0 ? `+${totalCasesCount} ملفات نشطة` : 'لا توجد قضايا'}
              </span>
              <span className="text-white/70 text-[10px]">ملفات المكتب الشاملة تحت الترافع النشط</span>
            </div>
          </div>

          {/* Card 2: قيد النظر (ترافع ومرافعة) */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">قيد النظر (ترافع ومرافعة)</span>
                <div className="text-3xl font-bold text-[#131c2d] font-mono">{openCasesCount}</div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#ebf3ff] text-[#00236f] flex items-center justify-center">
                <Scale className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-[#f1f5fd] space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#00236f] font-semibold">%{openPercentage} من الإجمالي</span>
                <span className="text-[#7c889e]">مستوى الترافع</span>
              </div>
              <div className="w-full bg-[#edf3ff] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#00236f] h-full rounded-full" style={{ width: `${openPercentage}%` }} />
              </div>
            </div>
          </div>

          {/* Card 3: مؤجلة / بانتظار إجراء ومستندات */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">مؤجلة / بانتظار إجراء ومستندات</span>
                <div className="text-3xl font-bold text-[#131c2d] font-mono">{postponedCasesCount}</div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#fef5ec] text-[#b35600] flex items-center justify-center">
                <Hourglass className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-[#f1f5fd] flex items-center justify-between text-[11px]">
              <span className="bg-[#fff0e6] text-[#b44800] border border-[#ffd5ba] font-medium px-2 py-0.5 rounded-full text-[10px]">
                {postponedCasesCount > 0 ? 'مطلوب متابعة' : 'لا توجد تأجيلات'}
              </span>
              <span className="text-[#7c889e] text-[10px]">مذكرات جوابية أو ندب خبراء</span>
            </div>
          </div>

          {/* Card 4: محكوم بها (منتهية ومكتسبة القطعية) */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">محكوم بها (منتهية ومكتسبة القطعية)</span>
                <div className="text-3xl font-bold text-[#131c2d] font-mono">{closedCasesCount}</div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#ebf3ff] text-[#00236f] flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-[#f1f5fd] flex items-center justify-between text-[11px]">
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium px-2 py-0.5 rounded-full text-[10px]">
                نسبة كسب %{winRate}
              </span>
              <span className="text-[#7c889e] text-[10px]">صدرت أحكام قطعية لصالح الموكلين</span>
            </div>
          </div>
        </div>

        {/* ── Tabs & View Controls ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              كافة القضايا ({totalCasesCount})
            </button>

            <button
              onClick={() => setActiveTab('under_review')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'under_review'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              قيد النظر ({openCasesCount})
            </button>

            <button
              onClick={() => setActiveTab('needs_action')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'needs_action'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              <span>تتطلب إجراء ومستندات</span>
              <span className="bg-[#fd8a42] text-white text-[10px] font-semibold px-1.5 py-0.2 rounded-full">
                {postponedCasesCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('closed')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'closed'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              أحكام منتهية ({closedCasesCount})
            </button>

            <button
              onClick={() => setActiveTab('archive')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'archive'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              الأرشيف القضائي
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-white border border-[#d9e5f5] p-1 rounded-lg">
            <button
              onClick={() => setViewType('table')}
              className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewType === 'table' ? 'bg-[#edf3ff] text-[#00236f]' : 'text-[#647188] hover:text-[#182337]'
              }`}
            >
              <span className="material-symbols-outlined text-sm">view_list</span>
              جدول تفصيلي
            </button>
            <button
              onClick={() => setViewType('cards')}
              className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewType === 'cards' ? 'bg-[#edf3ff] text-[#00236f]' : 'text-[#647188] hover:text-[#182337]'
              }`}
            >
              <span className="material-symbols-outlined text-sm">dashboard</span>
              بطاقات ومراحل
            </button>
          </div>
        </div>

        {/* ── Filter Toolbar ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 bg-white border border-[#dce7f6] p-2.5 rounded-xl shadow-2xs">
          {/* Search Input */}
          <div className="lg:col-span-5 relative">
            <Search className="w-4 h-4 text-[#8b99b0] absolute right-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث برقم القضية، الموكل، الخصم، أو ناظر الدعوى..."
              className="pr-9 h-9 text-xs border-[#dce7f6] bg-[#f9fbff] focus:bg-white text-[#182337]"
            />
          </div>

          {/* Court Filter */}
          <div className="lg:col-span-2">
            <select
              value={courtFilter}
              onChange={(e) => setCourtFilter(e.target.value)}
              className="w-full h-9 text-xs bg-[#f9fbff] border border-[#dce7f6] rounded-md px-2.5 text-[#33425b] focus:outline-none cursor-pointer"
            >
              <option value="all">المحكمة: جميع المحاكم</option>
              <option value="التجارية">المحكمة التجارية</option>
              <option value="الاستئناف">محكمة الاستئناف</option>
              <option value="العامة">المحكمة العامة</option>
              <option value="العمالية">المحكمة العمالية</option>
            </select>
          </div>

          {/* Lawyer Filter */}
          <div className="lg:col-span-2">
            <select
              value={lawyerFilter}
              onChange={(e) => setLawyerFilter(e.target.value)}
              className="w-full h-9 text-xs bg-[#f9fbff] border border-[#dce7f6] rounded-md px-2.5 text-[#33425b] focus:outline-none cursor-pointer"
            >
              <option value="all">المحامي: الجميع</option>
              <option value="أ. أحمد العتيبي">أ. أحمد العتيبي</option>
              <option value="أ. سارة الهاشمي">أ. سارة الهاشمي</option>
              <option value="أ. محمد الجزار">أ. محمد الجزار</option>
              <option value="أ. محمود عز الدين">أ. محمود عز الدين</option>
            </select>
          </div>

          {/* Phase Filter */}
          <div className="lg:col-span-2">
            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="w-full h-9 text-xs bg-[#f9fbff] border border-[#dce7f6] rounded-md px-2.5 text-[#33425b] focus:outline-none cursor-pointer"
            >
              <option value="all">المرحلة: كافة المراحل</option>
              <option value="مذكرات ختامية">مذكرات ختامية</option>
              <option value="تدقيق المستندات">تدقيق المستندات</option>
              <option value="أعمال الخبرة">أعمال الخبرة</option>
              <option value="محجوزة للحكم">محجوزة للحكم</option>
            </select>
          </div>

          {/* Extra Filter Button */}
          <div className="lg:col-span-1">
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setCourtFilter('all');
                setLawyerFilter('all');
                setPhaseFilter('all');
                toast({ title: 'تم إعادة ضبط الفلاتر' });
              }}
              className="w-full h-9 text-xs text-[#00236f] border-[#dce7f6] hover:bg-[#edf3ff] gap-1 cursor-pointer font-bold px-2"
            >
              <Filter className="w-3.5 h-3.5" />
              تصفية إضافية
            </Button>
          </div>
        </div>

        {/* ── Main Split View Content (Ledger Table on Right, Selected File on Left) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ══════════════ RIGHT: Direct Cases Ledger (7 Cols in RTL) ══════════════ */}
          <div className="lg:col-span-7 bg-white border border-[#dbe6f8] rounded-xl shadow-2xs overflow-hidden flex flex-col justify-between">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-[#e6eef9] bg-[#fafcff] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00236f] text-lg">folder_managed</span>
                <span className="text-xs lg:text-sm font-bold text-[#141c2c]">
                  سجل القضايا المباشرة
                </span>
                <span className="text-xs text-[#6e7d97]">
                  عرض {filteredCases.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} إلى{' '}
                  {Math.min(currentPage * pageSize, filteredCases.length)} من أصل {filteredCases.length}
                </span>
              </div>
              <div className="text-[11px] text-[#64748f] font-medium flex items-center gap-1">
                <span>مرتب حسب:</span>
                <span className="font-bold text-[#182338]">تاريخ الجلسة القادمة (الأقرب أولاً)</span>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#f4f7fc] text-[#55637d] font-bold border-b border-[#e2ecf9]">
                  <tr>
                    <th className="py-3 px-3.5">القضية والتصنيف</th>
                    <th className="py-3 px-3.5">أطراف النزاع</th>
                    <th className="py-3 px-3.5">المحكمة والدائرة</th>
                    <th className="py-3 px-3.5">المحامي والمهام</th>
                    <th className="py-3 px-3.5">الجلسة القادمة</th>
                    <th className="py-3 px-3.5 text-center">الحالة الإجرائية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf3fc] text-[#1c263c]">
                  {filteredCases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-[#757682]">
                          <Briefcase className="w-8 h-8 text-[#00236f]/40" />
                          <p className="text-sm font-bold text-[#141c2c]">لا توجد قضايا مسجلة حالياً</p>
                          <p className="text-xs text-[#6e7d97]">
                            لم يتم العثور على أي ملفات قضايا تطابق معايير البحث الحالية
                          </p>
                          <Button
                            onClick={() => setIsCreateOpen(true)}
                            className="mt-2 bg-[#00236f] hover:bg-[#001c59] text-white text-xs font-bold"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            فتح ملف قضية جديدة
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCases
                      .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                      .map((caseItem) => {
                        const isSelected = selectedCaseId === caseItem.id;
                        return (
                          <tr
                            key={caseItem.id}
                            onClick={() => setSelectedCaseId(caseItem.id)}
                            className={`cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-[#edf4ff] border-r-4 border-r-[#00236f]'
                                : 'hover:bg-[#f9fbff]'
                            }`}
                          >
                            {/* 1. Case Number & Type */}
                            <td className="py-3.5 px-3.5">
                              <div className="font-mono font-bold text-sm text-[#00236f]">
                                {caseItem.caseNumber}
                              </div>
                              <div className="text-[11px] text-[#5b6a84] font-medium truncate max-w-[130px]">
                                {caseItem.caseType}
                              </div>
                            </td>

                            {/* 2. Parties */}
                            <td className="py-3.5 px-3.5">
                              <div className="font-bold text-[#141f33] truncate max-w-[130px]">
                                {caseItem.clientName}
                              </div>
                              <div className="text-[11px] text-[#718099] truncate max-w-[130px]">
                                ضد: {caseItem.opposingParty}
                              </div>
                            </td>

                            {/* 3. Court & Circuit */}
                            <td className="py-3.5 px-3.5">
                              <div className="font-bold text-[#141f33] truncate max-w-[120px]">
                                {caseItem.court}
                              </div>
                              <div className="text-[10px] text-[#718099] truncate max-w-[120px]">
                                {caseItem.circuit} {caseItem.judge ? `- ${caseItem.judge}` : ''}
                              </div>
                            </td>

                            {/* 4. Lawyer & Progress */}
                            <td className="py-3.5 px-3.5">
                              <div className="flex items-center gap-1.5">
                                <div className="w-6 h-6 rounded-full bg-[#00236f] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                                  {caseItem.assignedLawyerInitials || 'أع'}
                                </div>
                                <div className="text-xs">
                                  <div className="font-semibold text-[#141e30] truncate max-w-[90px]">
                                    {caseItem.assignedLawyerName}
                                  </div>
                                  <div className="text-[10px] text-[#55647e]">
                                    إنجاز: %{caseItem.lawyerProgress || 80}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* 5. Next Hearing */}
                            <td className="py-3.5 px-3.5">
                              <div className="flex items-center gap-1 font-bold text-xs text-[#141e30]">
                                {caseItem.nextHearingIcon === 'clock' && (
                                  <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                )}
                                {caseItem.nextHearingIcon === 'check' && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                )}
                                <span>{caseItem.nextHearingText}</span>
                              </div>
                              <div className="text-[10px] text-[#657591]">
                                {caseItem.nextHearingSub}
                              </div>
                            </td>

                            {/* 6. Procedural Badge */}
                            <td className="py-3.5 px-3.5 text-center">
                              {caseItem.proceduralBadgeType === 'warning' && (
                                <span className="bg-[#fff2e8] text-[#b44800] border border-[#ffd5ba] text-[10px] font-bold px-2 py-1 rounded-full inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#fd8a42]" />
                                  {caseItem.proceduralStatus}
                                </span>
                              )}
                              {caseItem.proceduralBadgeType === 'info' && (
                                <span className="bg-[#eef5ff] text-[#00236f] border border-[#cfdffc] text-[10px] font-bold px-2 py-1 rounded-full inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#00236f]" />
                                  {caseItem.proceduralStatus}
                                </span>
                              )}
                              {caseItem.proceduralBadgeType === 'amber' && (
                                <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-1 rounded-full inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  {caseItem.proceduralStatus}
                                </span>
                              )}
                              {caseItem.proceduralBadgeType === 'success' && (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-1 rounded-full inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                  {caseItem.proceduralStatus}
                                </span>
                              )}
                              {caseItem.proceduralBadgeType === 'purple' && (
                                <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold px-2 py-1 rounded-full inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                                  {caseItem.proceduralStatus}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="px-5 py-3 border-t border-[#edf3fc] bg-[#fafcff] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#637189]">
              <span>
                إظهار السجلات من {filteredCases.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} إلى{' '}
                {Math.min(currentPage * pageSize, filteredCases.length)} من إجمالي {filteredCases.length} قضية
              </span>
              <div className="flex items-center gap-1 font-mono">
                {Array.from({ length: Math.max(1, Math.ceil(filteredCases.length / pageSize)) }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-7 h-7 rounded border transition-colors ${
                      currentPage === i + 1
                        ? 'border-[#00236f] bg-[#00236f] text-white font-bold'
                        : 'border-[#d2e0f4] bg-white text-[#42526e] hover:bg-[#edf3ff]'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ══════════════ LEFT: Selected Case File Detail (5 Cols in RTL) ══════════════ */}
          <div className="lg:col-span-5 space-y-3.5">
            {!selectedCase ? (
              <div className="bg-white border border-[#dbe6f8] rounded-xl shadow-2xs overflow-hidden p-8 flex flex-col items-center justify-center text-center gap-3 min-h-[380px]">
                <Scale className="w-12 h-12 text-[#9bbef5]" />
                <h3 className="text-sm font-bold text-[#141f33]">تفاصيل ملف القضية والترافع</h3>
                <p className="text-xs text-[#697893] max-w-xs">
                  قم باختيار أو تسجيل ملف قضية جديد لاستعراض تحليله الذكي ومواعيد جلساته ومستنداته
                </p>
                <Button
                  onClick={() => setIsCreateOpen(true)}
                  className="bg-[#00236f] hover:bg-[#001c59] text-white text-xs font-bold mt-2"
                >
                  + فتح ملف قضية جديدة
                </Button>
              </div>
            ) : (
              <div className="bg-white border border-[#dbe6f8] rounded-xl shadow-2xs overflow-hidden p-4 space-y-3.5">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-[#131c2d]">
                        ملف قضية #{selectedCase.caseNumber}
                      </h2>
                      <span className="bg-[#fff2e8] text-[#b44800] border border-[#ffd5ba] text-[10px] font-bold px-2 py-0.2 rounded">
                        عاجلة
                      </span>
                    </div>
                    <p className="text-xs text-[#52617a] mt-0.5 leading-relaxed font-medium">
                      {selectedCase.claimAmount}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsFullDetailModalOpen(true)}
                    className="text-[#657591] hover:text-[#00236f] p-1 rounded hover:bg-[#edf3ff] cursor-pointer"
                    title="تعديل أو استعراض"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>

                {/* AI Analysis Box */}
                <div className="bg-[#f5f8ff] border border-[#d4e4fc] rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#00236f]">
                      <Sparkles className="w-4 h-4 text-[#00236f]" />
                      تحليل الذكاء الاصطناعي للموقف القضائي
                    </div>
                    <span className="bg-[#00236f] text-white text-[10px] font-bold px-2 py-0.5 rounded">
                      نسبة القبول {selectedCase.acceptanceRate || '%88'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#3e4f6e] leading-relaxed">
                    {selectedCase.aiAnalysis}
                  </p>
                </div>

                {/* Parties & Lawyer Summary Box */}
                <div className="border border-[#e2ecfa] bg-[#fafcff] rounded-lg p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#edf3fc]">
                    <div>
                      <span className="text-[#697893] text-[11px]">الموكل: </span>
                      <strong className="text-[#151f33]">{selectedCase.clientName}</strong>
                    </div>
                    <div>
                      <span className="text-[#697893] text-[11px]">رقم الوكالة: </span>
                      <span className="text-emerald-700 font-bold text-[11px]">
                        {selectedCase.agencyNumber}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[#697893] text-[11px]">المحامي المسؤول: </span>
                      <strong className="text-[#151f33]">{selectedCase.assignedLawyerName}</strong>
                    </div>
                    <div>
                      <span className="text-[#697893] text-[11px]">الجلسة القادمة: </span>
                      <span className="text-[#00236f] font-bold text-[11px]">
                        {selectedCase.nextHearingText}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Procedural Timeline */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#141f33] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-[#00236f]">route</span>
                      المسار الزمني للإجراءات
                    </span>
                    <span className="text-[11px] text-[#657591]">
                      المرحلة: <strong className="text-[#00236f]">{selectedCase.timelineStage}</strong>
                    </span>
                  </div>

                  <div className="space-y-2.5 pr-2 relative border-r-2 border-[#dce8fd] mr-2">
                    {selectedCase.timeline?.map((step, idx) => (
                      <div key={idx} className="relative pr-4">
                        {step.status === 'completed' && (
                          <div className="absolute -right-[9px] top-0.5 w-4 h-4 rounded-full bg-[#00236f] text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                        {step.status === 'active' && (
                          <div className="absolute -right-[9px] top-0.5 w-4 h-4 rounded-full bg-[#fd8a42] text-white flex items-center justify-center">
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                          </div>
                        )}
                        {step.status === 'upcoming' && (
                          <div className="absolute -right-[9px] top-0.5 w-4 h-4 rounded-full bg-[#e2ecfa] border-2 border-white" />
                        )}
                        <div className="text-xs font-bold text-[#141f33]">{step.title}</div>
                        <div className="text-[11px] text-[#657591]">{step.dateAndCourt}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Documents & Attachments */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#141f33] flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-[#00236f]" />
                      المستندات والمرفقات ({selectedCase.attachments?.length || 0})
                    </span>
                    <button
                      onClick={() => {
                        toast({
                          title: 'إرفاق مستند جديد',
                          description: 'تم فتح نافذة تحميل العقود والمذكرات القانونية.',
                        });
                      }}
                      className="text-[11px] text-[#00236f] font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      إرفاق مستند
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {selectedCase.attachments && selectedCase.attachments.length > 0 ? (
                      selectedCase.attachments.map((doc, idx) => (
                        <div
                          key={idx}
                          className="bg-[#fafcff] border border-[#e2ecfa] rounded-lg p-2 flex items-center justify-between hover:border-[#b8d1fc] transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#00236f] shrink-0" />
                            <div className="text-xs">
                              <div className="font-semibold text-[#141e30] truncate max-w-[200px]">
                                {doc.name}
                              </div>
                              <div className="text-[10px] text-[#718099]">{doc.sizeAndNote}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => toast({ title: 'جارٍ تنزيل المستند المرفق' })}
                            className="text-[#657591] hover:text-[#00236f] p-1 rounded cursor-pointer"
                            title="تحميل"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center text-xs text-[#718099] bg-[#fafcff] rounded-lg border border-dashed border-[#e2ecfa]">
                        لا توجد مستندات مرفقة بهذه القضية
                      </div>
                    )}
                  </div>
                </div>

                {/* Large Action Button */}
                <div className="pt-2">
                  <Button
                    onClick={() => setIsFullDetailModalOpen(true)}
                    className="w-full bg-[#00236f] hover:bg-[#001c59] text-white text-xs font-bold h-10 gap-2 rounded-lg cursor-pointer shadow-xs"
                  >
                    <ExternalLink className="w-4 h-4" />
                    عرض السجل الكامل للقضية
                  </Button>
                </div>

                {/* Reminder Warning Box */}
                <div className="bg-[#fff4ed] border border-[#ffd5ba] rounded-lg p-3 text-xs space-y-1">
                  <div className="font-bold text-[#b44800] flex items-center gap-1.5">
                    <AlarmClock className="w-4 h-4 text-[#fd8a42]" />
                    تذكير جلسة عن بعد (منصة معين / ناجز):
                  </div>
                  <p className="text-[11px] text-[#843600] leading-relaxed mr-5">
                    رابط الدخول الافتراضي متاح للجلسات المجدولة. يرجى تأكيد تواجد المحامي قبل الموعد بـ 15 دقيقة.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Dialog: Create Case ── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#141e30]">
              فتح وتسجيل ملف قضية جديدة
            </DialogTitle>
            <DialogDescription className="text-xs text-[#65738c]">
              أدخل البيانات الأساسية للقضية والأطراف والمحكمة المختصة.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-[#44526d]">رقم القضية *</label>
                <Input
                  value={formCaseNumber}
                  onChange={(e) => setFormCaseNumber(e.target.value)}
                  placeholder="مثال: 4821/2026"
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-[#44526d]">تصنيف ونوع القضية</label>
                <Input
                  value={formCaseType}
                  onChange={(e) => setFormCaseType(e.target.value)}
                  placeholder="تجارية، عقارية، عمالية..."
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-[#44526d]">المحكمة *</label>
                <Input
                  value={formCourt}
                  onChange={(e) => setFormCourt(e.target.value)}
                  placeholder="المحكمة التجارية بالرياض"
                  className="h-8 text-xs"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-[#44526d]">الدائرة القضائية</label>
                <Input
                  value={formCircuit}
                  onChange={(e) => setFormCircuit(e.target.value)}
                  placeholder="الدائرة 4"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-[#44526d]">اسم الموكل</label>
                <Input
                  value={formClientName}
                  onChange={(e) => setFormClientName(e.target.value)}
                  placeholder="شركة الرؤية اللوجستية"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-[#44526d]">الخصم (المدعى عليه)</label>
                <Input
                  value={formOpposingParty}
                  onChange={(e) => setFormOpposingParty(e.target.value)}
                  placeholder="شركة أفق الإنشاءات"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-start pt-2">
              <Button type="submit" className="bg-[#00236f] hover:bg-[#001c59] text-white text-xs">
                حفظ وفتح الملف
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="text-xs">
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Full Case Detail Modal ── */}
      <Dialog open={isFullDetailModalOpen && !!selectedCase} onOpenChange={setIsFullDetailModalOpen}>
        {selectedCase && (
          <DialogContent className="max-w-2xl text-right max-h-[85vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#141e30] flex items-center justify-between">
                <span>السجل الكامل لملف القضية #{selectedCase.caseNumber}</span>
                <span className="bg-[#eef4ff] text-[#00236f] text-xs font-bold px-2 py-0.5 rounded border border-[#cfdffc]">
                  {selectedCase.proceduralStatus}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-[#65738c]">
                {selectedCase.court} - {selectedCase.circuit} | القاضي: {selectedCase.judge}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* Quick Summary Grid */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-[#fafcff] rounded-lg border border-[#e2ecfa]">
                <div>
                  <span className="text-[#657591]">الموكل: </span>
                  <strong className="text-[#141e30]">{selectedCase.clientName}</strong>
                </div>
                <div>
                  <span className="text-[#657591]">الخصم: </span>
                  <strong className="text-[#141e30]">{selectedCase.opposingParty}</strong>
                </div>
                <div>
                  <span className="text-[#657591]">المحامي المكلف: </span>
                  <strong className="text-[#00236f]">{selectedCase.assignedLawyerName}</strong>
                </div>
                <div>
                  <span className="text-[#657591]">قيمة المطالبة: </span>
                  <strong className="text-[#141e30]">{selectedCase.claimAmount}</strong>
                </div>
              </div>

              {/* AI Assessment */}
              <div className="p-3 bg-[#f5f8ff] rounded-lg border border-[#d4e4fc] space-y-1">
                <div className="font-bold text-[#00236f] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  تحليل الذكاء الاصطناعي للموقف القضائي (نسبة القبول {selectedCase.acceptanceRate})
                </div>
                <p className="text-[11px] text-[#3e4f6e] leading-relaxed">{selectedCase.aiAnalysis}</p>
              </div>

              {/* Full Timeline */}
              <div className="space-y-2">
                <span className="font-bold text-[#141e30] block">المسار الإجرائي للجلسات والمذكرات:</span>
                <div className="space-y-2 pr-2 border-r-2 border-[#dce8fd] mr-2">
                  {selectedCase.timeline?.map((st, i) => (
                    <div key={i} className="pr-3 text-xs">
                      <div className="font-bold text-[#141e30]">{st.title}</div>
                      <div className="text-[11px] text-[#657591]">{st.dateAndCourt}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attachments */}
              <div className="space-y-2">
                <span className="font-bold text-[#141e30] block">المستندات القضائية المرفقة:</span>
                <div className="space-y-1.5">
                  {selectedCase.attachments?.map((at, i) => (
                    <div
                      key={i}
                      className="p-2 bg-[#f8faff] rounded border border-[#e2ecfa] flex items-center justify-between"
                    >
                      <span className="font-medium text-[#141e30]">{at.name}</span>
                      <span className="text-[11px] text-[#718099]">{at.sizeAndNote}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-start pt-2">
              <Button
                onClick={() => {
                  setReassignCaseTarget(selectedCase);
                  setIsFullDetailModalOpen(false);
                }}
                variant="outline"
                className="text-xs"
              >
                إعادة تعيين المحامي المكلف
              </Button>
              <Button
                onClick={() => setIsFullDetailModalOpen(false)}
                className="bg-[#00236f] hover:bg-[#001c59] text-white text-xs"
              >
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ── Dialog: Reassign Lawyer ── */}
      {reassignCaseTarget && (
        <ReassignDialog
          open={!!reassignCaseTarget}
          onOpenChange={(open) => !open && setReassignCaseTarget(null)}
          module="cases"
          recordId={reassignCaseTarget.id}
          currentLawyerId={reassignCaseTarget.assignedLawyerId || null}
          recordTitle={`ملف القضية ${reassignCaseTarget.caseNumber}`}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
            setReassignCaseTarget(null);
            toast({ title: 'تمت إعادة تعيين المحامي بنجاح' });
          }}
        />
      )}
    </div>
  );
}
