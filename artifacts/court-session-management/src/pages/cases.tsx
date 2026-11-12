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
import { Link } from 'wouter';

export interface CaseItem {
  id: string;
  officeId: string;
  clientId: string;
  caseNumber: string;
  caseType: string;
  court: string;
  assignedLawyerId?: string | null;
  status: 'open' | 'closed' | 'postponed';
  opposingParty?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  clientName?: string;
  assignedLawyerName?: string;
}

export interface CaseDetailData {
  case: CaseItem;
  client: { id: string; name: string; phone?: string; notes?: string } | null;
  sessions: Array<{
    id: number;
    caseNumber: string;
    hearingAt?: string | null;
    sessionDateHijri?: string | null;
    sessionTime?: string | null;
    court?: string | null;
    notes?: string | null;
    status: string;
  }>;
  judgments: Array<{
    id: number;
    judgmentNumber: string;
    judgmentDate: string;
    summary: string;
    isFavorable: string;
    court?: string;
  }>;
  attachments: any[];
}

export default function CasesPage() {
  const { data: currentUser } = useGetCurrentUser();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // View Mode: 'list' | 'detail' | 'create' | 'edit'
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'create' | 'edit'>('list');

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed' | 'postponed'>('all');
  const [courtFilter, setCourtFilter] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Selected Case for Detail Panel & Full Detail View
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // Detail Tabs State (for Image 3)
  const [detailTab, setDetailTab] = useState<'sessions' | 'parties' | 'docs' | 'actions' | 'notes'>('sessions');

  // Check URL query on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      if (search.includes('create=true')) {
        setViewMode('create');
      }
      const match = search.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        setSelectedCaseId(match[1]);
        setViewMode('detail');
      }
    }
  }, []);

  const [reassignCaseTarget, setReassignCaseTarget] = useState<CaseItem | null>(null);

  // Form State (used for both Create & Edit)
  const [formClientId, setFormClientId] = useState<string | null>(null);
  const [formClientName, setFormClientName] = useState('أحمد سالم محمد');
  const [formCaseNumber, setFormCaseNumber] = useState('');
  const [formCaseType, setFormCaseType] = useState('نزاع عقاري');
  const [formClassification, setFormClassification] = useState('مدني');
  const [formCourt, setFormCourt] = useState('محكمة بداية غزة');
  const [formDegree, setFormDegree] = useState('أولى');
  const [formFilingDate, setFormFilingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formOpposingParty, setFormOpposingParty] = useState('شركة الإنشاءات الفلسطينية');
  const [formAssignedLawyerId, setFormAssignedLawyerId] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<'open' | 'closed' | 'postponed'>('open');
  const [formSubject, setFormSubject] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Fetch Stats
  const { data: stats, isLoading: isLoadingStats } = useQuery<{
    total: number;
    open: number;
    closed: number;
    postponed: number;
  }>({
    queryKey: ['/api/cases/stats'],
    queryFn: async () => {
      const res = await fetch('/api/cases/stats', { credentials: 'include' });
      if (!res.ok) throw new Error('فشل جلب إحصائيات القضايا');
      return res.json();
    },
  });

  // 2. Fetch Cases List
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (courtFilter.trim()) params.append('court', courtFilter.trim());
    if (selectedClientId) params.append('client_id', selectedClientId);
    if (searchQuery.trim()) params.append('q', searchQuery.trim());
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    return params.toString();
  }, [statusFilter, courtFilter, selectedClientId, searchQuery, dateFrom, dateTo]);

  const {
    data: casesList = [],
    isLoading: isLoadingCases,
    error: casesError,
  } = useQuery<CaseItem[]>({
    queryKey: ['/api/cases', queryParams],
    queryFn: async () => {
      const url = queryParams ? `/api/cases?${queryParams}` : '/api/cases';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('فشل تحميل قائمة القضايا');
      return res.json();
    },
  });

  // Auto-select first case if none selected
  useEffect(() => {
    if (casesList.length > 0 && !selectedCaseId) {
      setSelectedCaseId(casesList[0].id);
    } else if (casesList.length === 0) {
      setSelectedCaseId(null);
    }
  }, [casesList, selectedCaseId]);

  // 3. Fetch Selected Case Detail
  const { data: caseDetail, isLoading: isLoadingDetail } = useQuery<CaseDetailData | null>({
    queryKey: ['/api/cases', selectedCaseId, 'detail'],
    queryFn: async () => {
      if (!selectedCaseId) return null;
      const res = await fetch(`/api/cases/${selectedCaseId}/detail`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: Boolean(selectedCaseId),
  });

  // Paginated Cases
  const paginatedCases = useMemo(() => {
    const start = (page - 1) * pageSize;
    return casesList.slice(start, start + pageSize);
  }, [casesList, page]);

  const totalPages = Math.ceil(casesList.length / pageSize) || 1;

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setCourtFilter('');
    setSelectedClientId(null);
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  // Open Create Mode
  const handleOpenCreate = () => {
    setFormClientId(null);
    setFormClientName('أحمد سالم محمد');
    setFormCaseNumber(`${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`);
    setFormCaseType('نزاع عقاري');
    setFormClassification('مدني');
    setFormCourt('محكمة بداية غزة');
    setFormDegree('أولى');
    setFormFilingDate(new Date().toISOString().split('T')[0]);
    setFormOpposingParty('شركة الإنشاءات الفلسطينية');
    setFormAssignedLawyerId(null);
    setFormStatus('open');
    setFormSubject('نزاع على ملكية عقار');
    setFormDescription('دعوى تتعلق بالنزاع على ملكية العقار والكائن في المدينة. حيث يدعي المدعي أحقيته الكاملة بالعقار.');
    setViewMode('create');
  };

  // Open Edit Mode
  const handleOpenEdit = (c: CaseItem) => {
    setSelectedCaseId(c.id);
    setFormClientId(c.clientId);
    setFormClientName(c.clientName || 'أحمد سالم محمد');
    setFormCaseNumber(c.caseNumber);
    setFormCaseType(c.caseType || 'نزاع عقاري');
    setFormClassification('مدني');
    setFormCourt(c.court || 'محكمة بداية غزة');
    setFormDegree('أولى');
    setFormFilingDate(c.createdAt ? c.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
    setFormOpposingParty(c.opposingParty || '');
    setFormAssignedLawyerId(c.assignedLawyerId || null);
    setFormStatus(c.status);
    setFormSubject(c.caseType ? `متابعة ${c.caseType}` : 'نزاع على ملكية عقار');
    setFormDescription('دعوى قضائية منظورة أمام المحكمة المختصة.');
    setViewMode('edit');
  };

  // Swap parties (المدعي ⇄ المدعى عليه)
  const handleSwapParties = () => {
    const prevClient = formClientName;
    const prevOpposing = formOpposingParty;
    setFormClientName(prevOpposing);
    setFormOpposingParty(prevClient);
    toast({ title: 'تم التبديل', description: 'تم تبديل صفة المدعي والمدعى عليه' });
  };

  // Save Case (Create or Edit)
  const handleSaveCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCaseNumber.trim()) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال رقم القضية.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const isEdit = viewMode === 'edit' && selectedCaseId;
      const url = isEdit ? `/api/cases/${selectedCaseId}` : '/api/cases';
      const method = isEdit ? 'PATCH' : 'POST';

      const payload: any = {
        caseNumber: formCaseNumber.trim(),
        caseType: formCaseType.trim(),
        court: formCourt.trim(),
        opposingParty: formOpposingParty.trim(),
        status: formStatus,
      };

      if (formClientId) {
        payload.clientId = formClientId;
      }
      if (isAdmin && formAssignedLawyerId !== undefined) {
        payload.assignedLawyerId = formAssignedLawyerId || null;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل حفظ بيانات القضية.');
      }

      const saved = await res.json();
      toast({
        title: 'نجاح العملية',
        description: isEdit ? 'تم تحديث بيانات القضية بنجاح.' : 'تم تسجيل القضية الجديدة بنجاح.',
      });

      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases/stats'] });
      if (saved?.id) {
        setSelectedCaseId(saved.id);
        queryClient.invalidateQueries({ queryKey: ['/api/cases', saved.id, 'detail'] });
      }
      setViewMode('detail');
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message || 'تعذر حفظ القضية.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Status Toggle
  const handleQuickStatusChange = async (caseId: string, newStat: 'open' | 'closed' | 'postponed') => {
    try {
      const res = await fetch(`/api/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStat }),
      });
      if (!res.ok) throw new Error('فشل تحديث الحالة');
      toast({ title: 'نجاح', description: 'تم تحديث حالة القضية.' });
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases', caseId, 'detail'] });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
  };

  const selectedCase = useMemo(() => {
    return casesList.find((c) => c.id === selectedCaseId) || caseDetail?.case || null;
  }, [casesList, selectedCaseId, caseDetail]);

  const totalCasesCount = stats?.total ?? 0;
  const openPct = totalCasesCount > 0 ? (((stats?.open ?? 0) / totalCasesCount) * 100).toFixed(1) : '0';
  const postponedPct = totalCasesCount > 0 ? (((stats?.postponed ?? 0) / totalCasesCount) * 100).toFixed(1) : '0';
  const closedPct = totalCasesCount > 0 ? (((stats?.closed ?? 0) / totalCasesCount) * 100).toFixed(1) : '0';

  // ══════════════════════════════════════════════════════════════════
  // VIEW 1: SCREEN 1 (Image 1: إضافة / تعديل قضية)
  // ══════════════════════════════════════════════════════════════════
  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 font-sans bg-[#F4F7FA] min-h-screen" dir="rtl">
        {/* Top Breadcrumb & Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-[#64748B] flex items-center gap-1.5 mb-1.5 font-medium">
              <span>القضايا</span>
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="text-[#10233F] font-bold">إضافة / تعديل قضية</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#C4933F]">
                <Briefcase className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#10233F] tracking-tight">
                إضافة / تعديل قضية
              </h1>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setViewMode(selectedCase ? 'detail' : 'list')}
            className="gap-2 text-xs font-bold border-[#D6E0EC] bg-white text-[#10233F] hover:bg-slate-50 rounded-xl px-4 py-2 cursor-pointer self-start sm:self-auto shadow-xs"
          >
            <ArrowLeft className="w-4 h-4 ml-1" />
            <span>العودة للقضايا</span>
          </Button>
        </div>

        <form onSubmit={handleSaveCase}>
          {/* Main 2-Column Grid matching Image 1: Form Cards on Right, Gavel on Left in RTL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Right Column: 4 Form Cards (lg:col-span-9) */}
            <div className="lg:col-span-9 space-y-5">
              {/* Card 1: البيانات الأساسية */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <FileText className="w-4 h-4 text-[#C4933F]" />
                  <h2 className="text-sm font-black text-[#10233F]">البيانات الأساسية</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* رقم القضية */}
                  <div>
                    <label className="block text-xs font-bold text-[#10233F] mb-1.5">
                      رقم القضية <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      value={formCaseNumber}
                      onChange={(e) => setFormCaseNumber(e.target.value)}
                      placeholder="2024/458"
                      className="h-10 text-xs rounded-xl bg-slate-50/50 border-slate-200 font-mono"
                      required
                    />
                  </div>

                  {/* نوع القضية */}
                  <div>
                    <label className="block text-xs font-bold text-[#10233F] mb-1.5">
                      نوع القضية <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formCaseType}
                      onChange={(e) => setFormCaseType(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl text-xs font-semibold bg-slate-50/50 border border-slate-200 text-[#10233F] focus:outline-none focus:ring-1 focus:ring-[#C4933F] cursor-pointer"
                    >
                      <option value="نزاع عقاري">نزاع عقاري</option>
                      <option value="نزاع تجاري">نزاع تجاري</option>
                      <option value="مطالبة مالية">مطالبة مالية</option>
                      <option value="خلاف عمالي">خلاف عمالي</option>
                      <option value="تعويض عن أضرار">تعويض عن أضرار</option>
                      <option value="إثبات ملكية">إثبات ملكية</option>
                    </select>
                  </div>

                  {/* تصنيف القضية */}
                  <div>
                    <label className="block text-xs font-bold text-[#10233F] mb-1.5">
                      تصنيف القضية <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formClassification}
                      onChange={(e) => setFormClassification(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl text-xs font-semibold bg-slate-50/50 border border-slate-200 text-[#10233F] focus:outline-none focus:ring-1 focus:ring-[#C4933F] cursor-pointer"
                    >
                      <option value="مدني">مدني</option>
                      <option value="تجاري">تجاري</option>
                      <option value="عمالي">عمالي</option>
                      <option value="جزائي">جزائي</option>
                      <option value="أحوال شخصية">أحوال شخصية</option>
                    </select>
                  </div>

                  {/* حالة القضية */}
                  <div>
                    <label className="block text-xs font-bold text-[#10233F] mb-1.5">
                      حالة القضية <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as any)}
                        className="w-full h-10 px-3 pl-8 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 focus:outline-none cursor-pointer"
                      >
                        <option value="open">قيد التنفيذ</option>
                        <option value="postponed">مؤجلة</option>
                        <option value="closed">مغلقة</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  {/* تاريخ القيد */}
                  <div>
                    <label className="block text-xs font-bold text-[#10233F] mb-1.5">
                      تاريخ القيد <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={formFilingDate}
                      onChange={(e) => setFormFilingDate(e.target.value)}
                      className="h-10 text-xs rounded-xl bg-slate-50/50 border-slate-200"
                      required
                    />
                  </div>

                  {/* المحكمة */}
                  <div>
                    <label className="block text-xs font-bold text-[#10233F] mb-1.5">
                      المحكمة <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formCourt}
                      onChange={(e) => setFormCourt(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl text-xs font-semibold bg-slate-50/50 border border-slate-200 text-[#10233F] focus:outline-none focus:ring-1 focus:ring-[#C4933F] cursor-pointer"
                    >
                      <option value="محكمة بداية غزة">محكمة بداية غزة</option>
                      <option value="محكمة صلح غزة">محكمة صلح غزة</option>
                      <option value="محكمة استئناف غزة">محكمة استئناف غزة</option>
                      <option value="محكمة بداية خانيونس">محكمة بداية خانيونس</option>
                      <option value="محكمة بداية رام الله">محكمة بداية رام الله</option>
                      <option value="المحكمة العليا">المحكمة العليا</option>
                    </select>
                  </div>

                  {/* الدرجة */}
                  <div>
                    <label className="block text-xs font-bold text-[#10233F] mb-1.5">
                      الدرجة <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formDegree}
                      onChange={(e) => setFormDegree(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl text-xs font-semibold bg-slate-50/50 border border-slate-200 text-[#10233F] focus:outline-none focus:ring-1 focus:ring-[#C4933F] cursor-pointer"
                    >
                      <option value="أولى">أولى</option>
                      <option value="استئناف">استئناف</option>
                      <option value="نقض / عليا">نقض / عليا</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Card 2: أطراف القضية */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <Users className="w-4 h-4 text-[#C4933F]" />
                  <h2 className="text-sm font-black text-[#10233F]">أطراف القضية</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
                  {/* Right party: المدعي (Emerald Badge) */}
                  <div className="md:col-span-5 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-700 font-bold block">المدعي</span>
                        <input
                          type="text"
                          value={formClientName}
                          onChange={(e) => setFormClientName(e.target.value)}
                          className="text-xs font-bold text-[#10233F] bg-transparent border-0 focus:outline-none p-0"
                          placeholder="أحمد سالم محمد"
                        />
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Swap Button (⇄) */}
                  <div className="md:col-span-1 flex justify-center">
                    <button
                      type="button"
                      onClick={handleSwapParties}
                      className="w-9 h-9 rounded-full border border-slate-200 bg-white text-slate-600 hover:text-[#C4933F] hover:border-[#C4933F] flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                      title="تبديل صفة الأطراف"
                    >
                      <ArrowLeftRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Left party: المدعى عليه (Amber Badge) */}
                  <div className="md:col-span-5 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-[#C4933F] flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-700 font-bold block">المدعى عليه</span>
                        <input
                          type="text"
                          value={formOpposingParty}
                          onChange={(e) => setFormOpposingParty(e.target.value)}
                          className="text-xs font-bold text-[#10233F] bg-transparent border-0 focus:outline-none p-0"
                          placeholder="شركة الإنشاءات الفلسطينية"
                        />
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-bold text-[#10233F] border-slate-200 hover:bg-slate-50 h-9 rounded-xl"
                >
                  <Plus className="w-3.5 h-3.5 ml-1 text-[#C4933F]" />
                  إضافة طرف جديد
                </Button>
              </div>

              {/* Card 3: تفاصيل القضية (Side by side grid matching Image 1) */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                  <FileText className="w-4 h-4 text-[#C4933F]" />
                  <h2 className="text-sm font-black text-[#10233F]">تفاصيل القضية</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#10233F] mb-1.5">
                      موضوع القضية <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      value={formSubject}
                      onChange={(e) => setFormSubject(e.target.value)}
                      placeholder="نزاع على ملكية عقار"
                      className="h-10 text-xs rounded-xl bg-slate-50/50 border-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#10233F] mb-1.5">
                      وصف القضية
                    </label>
                    <Textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="دعوى تتعلق بالنزاع على ملكية العقار رقم (1256)..."
                      rows={3}
                      className="text-xs rounded-xl bg-slate-50/50 border-slate-200 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Card 4: المستندات المرفقة */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 pb-2">
                  <Paperclip className="w-4 h-4 text-[#C4933F]" />
                  <h2 className="text-sm font-black text-[#10233F]">المستندات المرفقة</h2>
                </div>

                <label className="border-2 border-dashed border-slate-200 hover:border-[#C4933F] transition-colors rounded-2xl p-6 text-center cursor-pointer flex flex-col items-center justify-center bg-slate-50/30">
                  <UploadCloud className="w-8 h-8 text-blue-500 mb-2" />
                  <p className="text-xs font-bold text-[#10233F]">
                    اسحب الملفات هنا أو اضغط لرفعها
                  </p>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    (دعم: PDF, DOC, DOCX, JPG, PNG حتى 10MB)
                  </p>
                  <input type="file" multiple className="hidden" />
                </label>
              </div>
            </div>

            {/* Left Column: Court Gavel Photo Card (lg:col-span-3) */}
            <div className="lg:col-span-3 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-xs overflow-hidden">
                <img
                  src="/gavel.jpg"
                  alt="Court Gavel"
                  className="w-full h-44 sm:h-52 object-cover rounded-xl shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* Bottom Action Bar: Matching Image 1 (Gold button on left, Cancel to its right) */}
          <div className="flex items-center justify-start gap-3 pt-6" dir="ltr">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#C4933F] hover:bg-[#B38332] text-white font-bold text-xs px-6 py-2.5 rounded-xl cursor-pointer shadow-md shadow-[#C4933F]/20 flex items-center gap-2 border-0"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'جارٍ الحفظ...' : 'حفظ القضية'}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setViewMode(selectedCase ? 'detail' : 'list')}
              className="text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl px-5 py-2.5 cursor-pointer flex items-center gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>إلغاء</span>
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // VIEW 2: SCREEN 3 (Image 3: تفاصيل القضية)
  // ══════════════════════════════════════════════════════════════════
  if (viewMode === 'detail' && selectedCase) {
    const sessionsList = caseDetail?.sessions || [];
    const attachmentsList = caseDetail?.attachments || [];

    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 font-sans bg-[#F4F7FA] min-h-screen" dir="rtl">
        {/* Top Breadcrumb & Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs text-[#64748B] flex items-center gap-1.5 mb-1.5 font-medium">
              <span>القضايا</span>
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="text-[#10233F] font-bold">تفاصيل القضية</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#C4933F]">
                <FileText className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#10233F] tracking-tight">
                تفاصيل القضية
              </h1>
            </div>
          </div>

          {/* Top Actions matching Image 3: [العودة للقضايا] [تصدير تقرير] [طباعة] [تعديل القضية] from left to right */}
          <div className="flex items-center gap-2 flex-wrap" dir="ltr">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setViewMode('list')}
              className="text-xs font-bold border-slate-200 bg-white text-[#10233F] hover:bg-slate-50 rounded-xl px-3.5 h-9"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              العودة للقضايا
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toast({ title: 'تصدير التقرير', description: 'تم إنشاء تقرير القضية بصيغة PDF.' })}
              className="text-xs font-bold border-slate-200 bg-white text-[#10233F] hover:bg-slate-50 rounded-xl px-3.5 h-9"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              تصدير تقرير
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="text-xs font-bold border-slate-200 bg-white text-[#10233F] hover:bg-slate-50 rounded-xl px-3.5 h-9"
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              طباعة
            </Button>

            <Button
              type="button"
              onClick={() => handleOpenEdit(selectedCase)}
              className="bg-[#C4933F] hover:bg-[#B38332] text-white font-bold text-xs px-4 h-9 rounded-xl shadow-sm border-0 flex items-center gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>تعديل القضية</span>
            </Button>
          </div>
        </div>

        {/* Hero Banner Card matching Image 3: Case Number on Right, Title in Center, Gavel on Left in RTL */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-5 overflow-hidden">
          {/* Right Section: Dark Navy Box for Case Number (First in DOM -> Rightmost in RTL) */}
          <div className="bg-[#0B1B2B] text-white rounded-2xl p-4 flex items-center gap-3 shrink-0 self-stretch md:self-auto justify-center md:justify-start min-w-[190px]">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-[#C4933F] shrink-0">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-300 font-semibold block">رقم القضية</span>
              <span className="text-xl font-black font-mono tracking-tight text-white">
                {selectedCase.caseNumber}
              </span>
            </div>
          </div>

          {/* Center Section: Case Title + Badges + Metadata */}
          <div className="flex-1 space-y-1.5 text-right w-full">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-[#10233F]">
                قضية {selectedCase.caseType || 'نزاع عقاري'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                قيد التنفيذ
              </span>
            </div>
            <p className="text-xs text-[#64748B] font-semibold">
              المحكمة: {selectedCase.court || 'محكمة بداية غزة'}
            </p>

            {/* Lower metadata row matching Image 3 (Right to left in RTL: نوع القضية -> تاريخ القيد -> الدرجة -> المحامي المسؤول) */}
            <div className="flex items-center gap-4 pt-1 text-xs text-[#64748B] flex-wrap">
              <div className="flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-[#C4933F]" />
                <span>نوع القضية: <strong className="text-[#10233F]">{selectedCase.caseType || 'نزاع عقاري'}</strong></span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#C4933F]" />
                <span>تاريخ القيد: <strong className="text-[#10233F]">{selectedCase.createdAt ? selectedCase.createdAt.split('T')[0] : '2024/03/01'}</strong></span>
              </div>
              <div className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-[#C4933F]" />
                <span>الدرجة: <strong className="text-[#10233F]">أولى</strong></span>
              </div>
              <div className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-[#C4933F]" />
                <span>المحامي المسؤول: <strong className="text-[#10233F]">{selectedCase.assignedLawyerName || 'أحمد سالم'}</strong></span>
              </div>
            </div>
          </div>

          {/* Left Section: Gavel image (Last in DOM -> Leftmost in RTL) */}
          <div className="shrink-0">
            <img
              src="/gavel.jpg"
              alt="Gavel"
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover shrink-0 shadow-xs"
            />
          </div>
        </div>

        {/* 2-Column Main Layout: Tabs & Sessions Table on Right, Quick Actions & Timeline on Left in RTL */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Right Column: Tabs & Tables (lg:col-span-8) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Pill Tabs Bar */}
            <div className="flex items-center gap-1.5 p-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-x-auto">
              <button
                type="button"
                onClick={() => setDetailTab('sessions')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  detailTab === 'sessions'
                    ? 'bg-[#C4933F] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#10233F] hover:bg-slate-50'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>الجلسات ({sessionsList.length || 4})</span>
              </button>

              <button
                type="button"
                onClick={() => setDetailTab('parties')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  detailTab === 'parties'
                    ? 'bg-[#C4933F] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#10233F] hover:bg-slate-50'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>الأطراف (2)</span>
              </button>

              <button
                type="button"
                onClick={() => setDetailTab('docs')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  detailTab === 'docs'
                    ? 'bg-[#C4933F] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#10233F] hover:bg-slate-50'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>المستندات ({attachmentsList.length || 6})</span>
              </button>

              <button
                type="button"
                onClick={() => setDetailTab('actions')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  detailTab === 'actions'
                    ? 'bg-[#C4933F] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#10233F] hover:bg-slate-50'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>الإجراءات (5)</span>
              </button>

              <button
                type="button"
                onClick={() => setDetailTab('notes')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  detailTab === 'notes'
                    ? 'bg-[#C4933F] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#10233F] hover:bg-slate-50'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>الملاحظات</span>
              </button>
            </div>

            {/* TAB CONTENT: Sessions Table */}
            {detailTab === 'sessions' && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#C4933F]" />
                    <h3 className="text-sm font-black text-[#10233F]">سجل الجلسات</h3>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => {
                      window.location.href = `/sessions?case_id=${selectedCase.id}`;
                    }}
                    className="bg-[#C4933F] hover:bg-[#B38332] text-white font-bold text-xs px-3.5 h-8 rounded-xl border-0 flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة جلسة</span>
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[#64748B]">
                        <th className="pb-3 font-semibold">رقم الجلسة</th>
                        <th className="pb-3 font-semibold">تاريخ الجلسة</th>
                        <th className="pb-3 font-semibold">الوقت</th>
                        <th className="pb-3 font-semibold">القاعة</th>
                        <th className="pb-3 font-semibold text-center">الحالة</th>
                        <th className="pb-3 font-semibold text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sessionsList.length > 0 ? (
                        sessionsList.map((s, idx) => (
                          <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 font-bold font-mono text-[#10233F]">{idx + 1}</td>
                            <td className="py-3.5 font-mono text-[#10233F]">{s.sessionDateHijri || s.hearingAt?.slice(0, 10) || '2024/05/20'}</td>
                            <td className="py-3.5 font-mono text-[#64748B]">{s.sessionTime || '10:00'}</td>
                            <td className="py-3.5 text-[#10233F]">{s.court ? `قاعة (${s.court.slice(-1) || '1'})` : 'قاعة (1)'}</td>
                            <td className="py-3.5 text-center">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                {s.status || 'قادمة'}
                              </span>
                            </td>
                            <td className="py-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Link href={`/sessions`} className="text-slate-400 hover:text-[#10233F] p-1">
                                  <Eye className="w-4 h-4" />
                                </Link>
                                <Link href={`/reports/${s.id}`} className="text-slate-400 hover:text-[#C4933F] p-1">
                                  <FileText className="w-4 h-4" />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        // Default mock rows matching reference screen 3
                        [
                          { num: 1, date: '2024/03/10', time: '09:00', hall: 'قاعة (1)', status: 'منعقدة', badge: 'bg-emerald-50 text-emerald-700' },
                          { num: 2, date: '2024/04/14', time: '10:30', hall: 'قاعة (2)', status: 'منعقدة', badge: 'bg-emerald-50 text-emerald-700' },
                          { num: 3, date: '2024/05/20', time: '12:00', hall: 'قاعة (1)', status: 'قادمة', badge: 'bg-blue-50 text-blue-700' },
                          { num: 4, date: '2024/06/15', time: '10:00', hall: 'قاعة (3)', status: 'مجدولة', badge: 'bg-slate-100 text-slate-700' },
                        ].map((row) => (
                          <tr key={row.num} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 font-bold font-mono text-[#10233F]">{row.num}</td>
                            <td className="py-3.5 font-mono text-[#10233F]">{row.date}</td>
                            <td className="py-3.5 font-mono text-[#64748B]">{row.time}</td>
                            <td className="py-3.5 text-[#10233F]">{row.hall}</td>
                            <td className="py-3.5 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${row.badge}`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="py-3.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button type="button" className="text-slate-400 hover:text-[#10233F] p-1 cursor-pointer">
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button type="button" className="text-slate-400 hover:text-[#C4933F] p-1 cursor-pointer">
                                  <FileText className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Documents */}
            {detailTab === 'docs' && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
                <AttachmentsPanel
                  relatedRecordType="case"
                  relatedRecordId={selectedCase.id}
                  title="مستندات ووثائق القضية"
                  className="border-0 p-0 shadow-none"
                />
              </div>
            )}

            {/* TAB CONTENT: Parties */}
            {detailTab === 'parties' && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                <h3 className="text-sm font-black text-[#10233F]">أطراف القضية</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40">
                    <span className="text-[10px] text-blue-700 font-bold block mb-1">المدعي (الموكل)</span>
                    <strong className="text-sm text-[#10233F] block">{selectedCase.clientName || 'أحمد سالم محمد'}</strong>
                    <span className="text-xs text-[#64748B] mt-1 block">رقم الهوية: 900123456</span>
                  </div>
                  <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40">
                    <span className="text-[10px] text-amber-700 font-bold block mb-1">المدعى عليه (الطرف المقابل)</span>
                    <strong className="text-sm text-[#10233F] block">{selectedCase.opposingParty || 'شركة الإنشاءات الفلسطينية'}</strong>
                    <span className="text-xs text-[#64748B] mt-1 block">صفة الطرف: شركة / مقاول</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Actions / Notes */}
            {(detailTab === 'actions' || detailTab === 'notes') && (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-black text-[#10233F]">
                  {detailTab === 'actions' ? 'سجل الإجراءات المتخذة' : 'ملاحظات القضية'}
                </h3>
                <p className="text-xs text-[#64748B]">
                  تم تسجيل كافة المستندات والملاحظات القضائية التابعة لهذا الملف.
                </p>
              </div>
            )}
          </div>
          {/* Left Column: Quick Actions + Case Timeline (lg:col-span-4) */}
          <div className="lg:col-span-4 space-y-5">
            {/* Quick Actions Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <span className="w-2 h-2 rounded-full bg-[#C4933F]" />
                <h3 className="text-xs font-black text-[#10233F]">إجراءات سريعة</h3>
              </div>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = `/sessions?case_id=${selectedCase.id}`;
                  }}
                  className="w-full justify-start text-xs font-bold text-[#10233F] border-slate-200 hover:bg-slate-50 h-10 rounded-xl gap-2"
                >
                  <Calendar className="w-4 h-4 text-[#C4933F]" />
                  <span>إضافة جلسة</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDetailTab('docs')}
                  className="w-full justify-start text-xs font-bold text-[#10233F] border-slate-200 hover:bg-slate-50 h-10 rounded-xl gap-2"
                >
                  <UploadCloud className="w-4 h-4 text-blue-600" />
                  <span>رفع مستند</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDetailTab('actions')}
                  className="w-full justify-start text-xs font-bold text-[#10233F] border-slate-200 hover:bg-slate-50 h-10 rounded-xl gap-2"
                >
                  <FilePlus className="w-4 h-4 text-emerald-600" />
                  <span>إضافة إجراء</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDetailTab('notes')}
                  className="w-full justify-start text-xs font-bold text-[#10233F] border-slate-200 hover:bg-slate-50 h-10 rounded-xl gap-2"
                >
                  <MessageSquare className="w-4 h-4 text-purple-600" />
                  <span>إضافة ملاحظة</span>
                </Button>
              </div>
            </div>

            {/* Case Progression Timeline */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <span className="w-2 h-2 rounded-full bg-[#C4933F]" />
                <h3 className="text-xs font-black text-[#10233F]">سير القضية</h3>
              </div>

              <div className="relative pr-6 space-y-5 before:absolute before:right-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {/* Step 1 */}
                <div className="relative flex items-start justify-between text-xs">
                  <span className="absolute -right-6 top-0.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                    ✓
                  </span>
                  <div>
                    <strong className="text-[#10233F] block font-bold">إنشاء القضية</strong>
                    <span className="text-[11px] text-[#64748B]">2024/03/01</span>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="relative flex items-start justify-between text-xs">
                  <span className="absolute -right-6 top-0.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                    ✓
                  </span>
                  <div>
                    <strong className="text-[#10233F] block font-bold">تحديد أول جلسة</strong>
                    <span className="text-[11px] text-[#64748B]">2024/03/10</span>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="relative flex items-start justify-between text-xs">
                  <span className="absolute -right-6 top-0.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                    ✓
                  </span>
                  <div>
                    <strong className="text-[#10233F] block font-bold">تقديم مذكرات</strong>
                    <span className="text-[11px] text-[#64748B]">2024/04/05</span>
                  </div>
                </div>

                {/* Step 4 (Active) */}
                <div className="relative flex items-start justify-between text-xs">
                  <span className="absolute -right-6 top-0.5 w-5 h-5 rounded-full bg-[#C4933F] text-white flex items-center justify-center text-[10px]">
                    •
                  </span>
                  <div>
                    <strong className="text-[#C4933F] block font-bold">جلسة نظر</strong>
                    <span className="text-[11px] text-[#64748B]">2024/05/20</span>
                  </div>
                </div>

                {/* Step 5 (Pending) */}
                <div className="relative flex items-start justify-between text-xs opacity-60">
                  <span className="absolute -right-6 top-0.5 w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px]">
                    ○
                  </span>
                  <div>
                    <strong className="text-slate-600 block font-bold">الحكم (قيد الانتظار)</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // VIEW 3: MAIN LIST VIEW
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 font-sans bg-[#F4F7FA] min-h-screen" dir="rtl" data-testid="cases-page">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 fade-in-up">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-6 rounded-full bg-[#C4933F]" />
            <h1 className="text-2xl font-black text-[#10233F] tracking-tight">إدارة ملفات القضايا</h1>
          </div>
          <p className="text-xs sm:text-sm text-[#64748B] font-medium mr-4">
            الكيان المركزي لمتابعة القضايا، الجلسات المرتبطة، الأحكام، والمستندات
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-[#C4933F] hover:bg-[#B38332] text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto border-0"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة قضية جديدة</span>
        </Button>
      </div>

      {/* ── Top 4 Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 fade-in-up">
        {/* Card 1: إجمالي القضايا */}
        <div
          className="rounded-2xl p-5 shadow-sm flex flex-col justify-between text-white relative overflow-hidden transition-all duration-200 hover:brightness-105"
          style={{ background: 'linear-gradient(135deg, #0B2A4A 0%, #071D34 100%)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 font-semibold">إجمالي القضايا</span>
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[#C4933F] shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-4xl font-black font-mono tracking-tight text-white">
              {isLoadingStats ? '—' : totalCasesCount}
            </span>
            <span className="text-xs text-slate-300 mr-2 font-medium">قضية مسجلة</span>
          </div>
          <div className="text-[11px] text-[#E8C477] font-semibold flex items-center gap-1">
            <span>ملفات المكتب الشاملة</span>
          </div>
        </div>

        {/* Card 2: القضايا الجارية (قيد النظر) */}
        <div className="rounded-2xl p-5 border border-slate-200/80 bg-white shadow-xs flex flex-col justify-between transition-all duration-200 hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748B] font-bold">قيد النظر (جارية)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-4xl font-black font-mono tracking-tight text-emerald-600">
              {isLoadingStats ? '—' : stats?.open ?? 0}
            </span>
          </div>
          <div className="text-[11px] text-[#64748B] font-medium flex items-center gap-1">
            <span className="font-bold text-emerald-600">{openPct}%</span>
            <span>من إجمالي القضايا</span>
          </div>
        </div>

        {/* Card 3: القضايا المؤجلة */}
        <div className="rounded-2xl p-5 border border-slate-200/80 bg-white shadow-xs flex flex-col justify-between transition-all duration-200 hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748B] font-bold">مؤجلة لحين الإجراء</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
              <Hourglass className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-4xl font-black font-mono tracking-tight text-amber-600">
              {isLoadingStats ? '—' : stats?.postponed ?? 0}
            </span>
          </div>
          <div className="text-[11px] text-[#64748B] font-medium flex items-center gap-1">
            <span className="font-bold text-amber-600">{postponedPct}%</span>
            <span>بانتظار مستندات أو جلسة</span>
          </div>
        </div>

        {/* Card 4: القضايا المغلقة */}
        <div className="rounded-2xl p-5 border border-slate-200/80 bg-white shadow-xs flex flex-col justify-between transition-all duration-200 hover:border-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748B] font-bold">قضايا مغلقة (منتهية)</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-4xl font-black font-mono tracking-tight text-slate-700">
              {isLoadingStats ? '—' : stats?.closed ?? 0}
            </span>
          </div>
          <div className="text-[11px] text-[#64748B] font-medium flex items-center gap-1">
            <span className="font-bold text-slate-700">{closedPct}%</span>
            <span>صدر فيها حكم قطعي</span>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4 fade-in-up">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Query */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              placeholder="بحث برقم القضية أو الخصم..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="h-10 text-xs rounded-xl pr-9 bg-slate-50/50 border-slate-200"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              className="w-full h-10 px-3 rounded-xl text-xs font-semibold bg-slate-50/50 border border-slate-200 text-[#10233F] focus:outline-none focus:ring-1 focus:ring-[#C4933F] cursor-pointer"
            >
              <option value="all">جميع الحالات</option>
              <option value="open">قيد النظر</option>
              <option value="postponed">مؤجلة</option>
              <option value="closed">مغلقة</option>
            </select>
          </div>

          {/* Court Filter */}
          <div>
            <Input
              placeholder="المحكمة..."
              value={courtFilter}
              onChange={(e) => {
                setCourtFilter(e.target.value);
                setPage(1);
              }}
              className="h-10 text-xs rounded-xl bg-slate-50/50 border-slate-200"
            />
          </div>

          {/* Date From */}
          <div>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="h-10 text-xs rounded-xl bg-slate-50/50 border-slate-200"
            />
          </div>

          {/* Date To */}
          <div>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="h-10 text-xs rounded-xl bg-slate-50/50 border-slate-200"
            />
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[#64748B]">النتائج:</span>
            <span className="font-bold text-[#10233F]">{casesList.length} قضية</span>
          </div>

          {(searchQuery || statusFilter !== 'all' || courtFilter || selectedClientId || dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-8 px-2.5 text-xs text-[#64748B] hover:text-[#10233F] flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط الفلاتر</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── Split View (Right = Cases Table, Left = Detail Panel) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start fade-in-up">
        {/* Right Column: Cases Table (lg:col-span-7) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-[#C4933F]" />
              <h2 className="text-base font-bold text-[#10233F]">جدول القضايا</h2>
            </div>
            <span className="text-xs text-[#64748B] font-medium">
              الصفحة {page} من {totalPages}
            </span>
          </div>

          {isLoadingCases ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : casesError ? (
            <div className="p-8 text-center text-destructive text-xs">
              فشل تحميل القضايا. يرجى إعادة المحاولة.
            </div>
          ) : paginatedCases.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center space-y-3">
              <Briefcase className="w-10 h-10 text-muted-foreground mx-auto opacity-30" />
              <p className="text-xs text-[#64748B] font-medium">لا توجد قضايا تطابق خيارات البحث والتصفية.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenCreate}
                className="text-xs mt-2"
              >
                إضافة أول قضية
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[#64748B]">
                    <th className="pb-3 font-semibold">رقم القضية</th>
                    <th className="pb-3 font-semibold">العميل</th>
                    <th className="pb-3 font-semibold">نوع القضية</th>
                    <th className="pb-3 font-semibold">المحكمة</th>
                    <th className="pb-3 font-semibold">المحامي</th>
                    <th className="pb-3 font-semibold text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedCases.map((c) => {
                    const isSelected = c.id === selectedCaseId;

                    return (
                      <tr
                        key={c.id}
                        onClick={() => {
                          setSelectedCaseId(c.id);
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#FFF4DE]/60 border-r-4 border-r-[#C4933F]'
                            : 'hover:bg-slate-50/60'
                        }`}
                      >
                        <td className="py-3 font-bold font-mono text-blue-600">
                          {c.caseNumber}
                        </td>
                        <td className="py-3 font-semibold text-[#10233F]">
                          {c.clientName || '—'}
                        </td>
                        <td className="py-3 font-medium text-[#64748B]">{c.caseType || '—'}</td>
                        <td className="py-3 font-medium text-[#10233F]">{c.court || '—'}</td>
                        <td className="py-3 font-medium text-[#64748B]">
                          {c.assignedLawyerName || 'غير مسند'}
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              c.status === 'open'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                                : c.status === 'postponed'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {c.status === 'open' ? 'قيد النظر' : c.status === 'postponed' ? 'مؤجلة' : 'مغلقة'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 px-3 rounded-lg text-xs"
              >
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
                السابق
              </Button>
              <span className="text-[#64748B] font-mono">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8 px-3 rounded-lg text-xs"
              >
                التالي
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              </Button>
            </div>
          )}
        </div>

        {/* Left Column: Detail Panel (lg:col-span-5) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-5">
          {!selectedCase ? (
            <div className="text-center py-16 text-[#64748B] space-y-2">
              <Scale className="w-10 h-10 mx-auto text-muted-foreground opacity-30" />
              <p className="text-xs font-medium">اختر قضية من الجدول لعرض تفاصيلها ومستنداتها المرتبطة.</p>
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-black font-mono text-[#10233F]">
                      {selectedCase.caseNumber}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        selectedCase.status === 'open'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : selectedCase.status === 'postponed'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {selectedCase.status === 'open' ? 'قيد النظر' : selectedCase.status === 'postponed' ? 'مؤجلة' : 'مغلقة'}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] font-medium">
                    {selectedCase.caseType || 'قضية عامة'} — {selectedCase.court || 'المحكمة'}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(selectedCase)}
                    className="h-8 w-8 p-0 text-[#64748B] hover:text-[#10233F]"
                    title="تعديل بيانات القضية"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReassignCaseTarget(selectedCase)}
                      className="h-8 text-xs px-2.5 rounded-lg border-slate-200"
                    >
                      <UserCheck className="w-3.5 h-3.5 ml-1 text-[#C4933F]" />
                      إسناد
                    </Button>
                  )}
                </div>
              </div>

              {/* Status Switcher Bar */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-50 border border-slate-200/60">
                {(['open', 'postponed', 'closed'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleQuickStatusChange(selectedCase.id, st)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedCase.status === st
                        ? 'bg-white text-[#10233F] shadow-xs border border-slate-200'
                        : 'text-[#64748B] hover:text-[#10233F]'
                    }`}
                  >
                    {st === 'open' ? 'قيد النظر' : st === 'postponed' ? 'مؤجلة' : 'مغلقة'}
                  </button>
                ))}
              </div>

              {/* Case Attributes Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60">
                <div>
                  <span className="text-[#64748B] block mb-0.5 text-[11px]">العميل (الموكل):</span>
                  <Link
                    href={selectedCase.clientId ? `/clients/${selectedCase.clientId}` : '#'}
                    className="font-bold text-blue-600 hover:underline"
                  >
                    {caseDetail?.client?.name || selectedCase.clientName || '—'}
                  </Link>
                </div>

                <div>
                  <span className="text-[#64748B] block mb-0.5 text-[11px]">الطرف المقابل (الخصم):</span>
                  <span className="font-semibold text-[#10233F]">
                    {selectedCase.opposingParty || 'غير محدد'}
                  </span>
                </div>

                <div>
                  <span className="text-[#64748B] block mb-0.5 text-[11px]">المحامي المسؤول:</span>
                  <span className="font-semibold text-[#10233F]">
                    {selectedCase.assignedLawyerName || 'غير مسند'}
                  </span>
                </div>

                <div>
                  <span className="text-[#64748B] block mb-0.5 text-[11px]">تاريخ التسجيل:</span>
                  <span className="font-mono text-[#64748B]">
                    {new Date(selectedCase.createdAt).toLocaleDateString('ar-SA')}
                  </span>
                </div>
              </div>

              {/* View Full Detail Banner */}
              <div className="p-3.5 rounded-xl border border-[#C4933F]/30 bg-[#FFF4DE]/40 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#C4933F]/15 flex items-center justify-center text-[#C4933F] shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-[#10233F] block">عرض ملف القضية المتكامل</span>
                    <span className="text-[11px] text-[#64748B]">
                      الجلسات، الأطراف، المستندات، والخط الزمني
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => setViewMode('detail')}
                  className="bg-[#C4933F] hover:bg-[#B38332] text-white text-xs font-bold h-8 px-3 rounded-xl border-0 shadow-xs cursor-pointer"
                >
                  فتح الملف
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                </Button>
              </div>

              {/* Linked Documents (Attachments Panel) */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#C4933F]" />
                    <h3 className="text-xs font-bold text-[#10233F]">المستندات والوثائق المرتبطة</h3>
                  </div>
                </div>

                <AttachmentsPanel
                  relatedRecordType="case"
                  relatedRecordId={selectedCase.id}
                  title="مستندات القضية"
                  className="border-0 p-0 shadow-none"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Dialog: إعادة إسناد القضية (Admin Only) ── */}
      {reassignCaseTarget && (
        <ReassignDialog
          module="cases"
          recordId={reassignCaseTarget.id}
          recordTitle={`القضية رقم ${reassignCaseTarget.caseNumber}`}
          currentLawyerId={reassignCaseTarget.assignedLawyerId}
          open={Boolean(reassignCaseTarget)}
          onOpenChange={(open) => {
            if (!open) setReassignCaseTarget(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
            queryClient.invalidateQueries({ queryKey: ['/api/cases/stats'] });
            queryClient.invalidateQueries({ queryKey: ['/api/cases', reassignCaseTarget.id, 'detail'] });
            setReassignCaseTarget(null);
          }}
        />
      )}
    </div>
  );
}
