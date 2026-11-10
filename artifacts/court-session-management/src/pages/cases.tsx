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
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

  // Selected Case for Detail Panel
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isFullDetailOpen, setIsFullDetailOpen] = useState(false);
  const [reassignCaseTarget, setReassignCaseTarget] = useState<CaseItem | null>(null);

  // Create Form State
  const [newClientId, setNewClientId] = useState<string | null>(null);
  const [newCaseNumber, setNewCaseNumber] = useState('');
  const [newCaseType, setNewCaseType] = useState('');
  const [newCourt, setNewCourt] = useState('');
  const [newOpposingParty, setNewOpposingParty] = useState('');
  const [newAssignedLawyerId, setNewAssignedLawyerId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<'open' | 'closed' | 'postponed'>('open');
  const [isCreating, setIsCreating] = useState(false);

  // Edit Form State
  const [editingCase, setEditingCase] = useState<CaseItem | null>(null);
  const [editClientId, setEditClientId] = useState<string | null>(null);
  const [editCaseNumber, setEditCaseNumber] = useState('');
  const [editCaseType, setEditCaseType] = useState('');
  const [editCourt, setEditCourt] = useState('');
  const [editOpposingParty, setEditOpposingParty] = useState('');
  const [editAssignedLawyerId, setEditAssignedLawyerId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<'open' | 'closed' | 'postponed'>('open');
  const [isUpdating, setIsUpdating] = useState(false);

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
    refetch: refetchCases,
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

  // Create Case Handler
  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientId) {
      toast({ title: 'تنبيه', description: 'يرجى اختيار العميل أولاً.', variant: 'destructive' });
      return;
    }
    if (!newCaseNumber.trim()) {
      toast({ title: 'تنبيه', description: 'يرجى إدخال رقم القضية.', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clientId: newClientId,
          caseNumber: newCaseNumber.trim(),
          caseType: newCaseType.trim(),
          court: newCourt.trim(),
          opposingParty: newOpposingParty.trim(),
          assignedLawyerId: newAssignedLawyerId || null,
          status: newStatus,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل إنشاء القضية.');
      }

      const created = await res.json();
      toast({ title: 'نجاح', description: 'تم إنشاء ملف القضية بنجاح.' });
      setIsCreateOpen(false);

      // Reset form
      setNewClientId(null);
      setNewCaseNumber('');
      setNewCaseType('');
      setNewCourt('');
      setNewOpposingParty('');
      setNewAssignedLawyerId(null);
      setNewStatus('open');

      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases/stats'] });
      setSelectedCaseId(created.id);
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message || 'تعذر حفظ القضية.', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  // Open Edit Dialog
  const handleOpenEdit = (c: CaseItem) => {
    setEditingCase(c);
    setEditClientId(c.clientId);
    setEditCaseNumber(c.caseNumber);
    setEditCaseType(c.caseType || '');
    setEditCourt(c.court || '');
    setEditOpposingParty(c.opposingParty || '');
    setEditAssignedLawyerId(c.assignedLawyerId || null);
    setEditStatus(c.status);
    setIsEditOpen(true);
  };

  // Update Case Handler
  const handleUpdateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCase) return;

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/cases/${editingCase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clientId: editClientId || undefined,
          caseNumber: editCaseNumber.trim(),
          caseType: editCaseType.trim(),
          court: editCourt.trim(),
          opposingParty: editOpposingParty.trim(),
          assignedLawyerId: isAdmin ? editAssignedLawyerId : undefined,
          status: editStatus,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل تحديث القضية.');
      }

      toast({ title: 'نجاح', description: 'تم تحديث بيانات القضية بنجاح.' });
      setIsEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases', editingCase.id, 'detail'] });
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message || 'تعذر تعديل القضية.', variant: 'destructive' });
    } finally {
      setIsUpdating(false);
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" dir="rtl" data-testid="cases-page">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 fade-in-up">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2.5 h-6 rounded-full bg-[#C99732]" />
            <h1 className="text-2xl font-black text-[#10233F] tracking-tight">إدارة ملفات القضايا</h1>
          </div>
          <p className="text-xs sm:text-sm text-[#64748B] font-medium mr-4">
            الكيان المركزي لمتابعة القضايا، الجلسات المرتبطة، الأحكام، والمستندات
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-[#C99732] hover:bg-[#b5872a] text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة قضية جديدة</span>
        </Button>
      </div>

      {/* ── Top 4 Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 fade-in-up">
        {/* Card 1: إجمالي القضايا (Distinct styling) */}
        <div
          className="rounded-2xl p-5 shadow-sm flex flex-col justify-between text-white relative overflow-hidden transition-all duration-200 hover:brightness-105"
          style={{ background: 'linear-gradient(135deg, #0B2A4A 0%, #071D34 100%)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 font-semibold">إجمالي القضايا</span>
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[#C99732] shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-4xl font-black font-mono tracking-tight text-white">
              {isLoadingStats ? '—' : totalCasesCount}
            </span>
          </div>
          <div className="rounded-xl bg-[#051628]/70 px-3 py-1.5 text-xs text-slate-300 flex items-center justify-center gap-2 font-medium">
            <span>ملفات المكتب المسجلة</span>
          </div>
        </div>

        {/* Card 2: قيد النظر (Open) */}
        <div className="rounded-2xl border border-[#D6E0EC] bg-white p-5 shadow-xs flex flex-col justify-between transition-all duration-200 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748B] font-semibold">قيد النظر (جارية)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-4xl font-black font-mono tracking-tight text-[#10233F]">
              {isLoadingStats ? '—' : stats?.open ?? 0}
            </span>
          </div>
          <div className="self-start">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
              <span>{openPct}%</span>
              <span>من إجمالي القضايا</span>
            </span>
          </div>
        </div>

        {/* Card 3: مؤجلة (Postponed) */}
        <div className="rounded-2xl border border-[#D6E0EC] bg-white p-5 shadow-xs flex flex-col justify-between transition-all duration-200 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748B] font-semibold">مؤجلة</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-4xl font-black font-mono tracking-tight text-[#10233F]">
              {isLoadingStats ? '—' : stats?.postponed ?? 0}
            </span>
          </div>
          <div className="self-start">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
              <span>{postponedPct}%</span>
              <span>من إجمالي القضايا</span>
            </span>
          </div>
        </div>

        {/* Card 4: مغلقة (Closed) */}
        <div className="rounded-2xl border border-[#D6E0EC] bg-white p-5 shadow-xs flex flex-col justify-between transition-all duration-200 hover:shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748B] font-semibold">مغلقة (محكوم بها)</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="my-3">
            <span className="text-4xl font-black font-mono tracking-tight text-[#10233F]">
              {isLoadingStats ? '—' : stats?.closed ?? 0}
            </span>
          </div>
          <div className="self-start">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              <span>{closedPct}%</span>
              <span>من إجمالي القضايا</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="rounded-2xl border border-[#D6E0EC] bg-white p-4 shadow-xs space-y-3 fade-in-up">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search Box */}
          <div className="relative sm:col-span-2">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <Input
              placeholder="بحث برقم القضية، العميل، الخصم..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pr-10 h-10 text-xs rounded-xl bg-white border-[#D6E0EC]"
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
              className="w-full h-10 px-3 rounded-xl text-xs font-medium bg-white border border-[#D6E0EC] text-[#10233F] focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="all">كافة الحالات</option>
              <option value="open">قيد النظر (جارية)</option>
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
              className="h-10 text-xs rounded-xl bg-white border-[#D6E0EC]"
            />
          </div>

          {/* Date From */}
          <div>
            <Input
              type="date"
              placeholder="من تاريخ"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="h-10 text-xs rounded-xl bg-white border-[#D6E0EC]"
            />
          </div>

          {/* Date To */}
          <div>
            <Input
              type="date"
              placeholder="إلى تاريخ"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="h-10 text-xs rounded-xl bg-white border-[#D6E0EC]"
            />
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex items-center justify-between pt-2 border-t border-[#D6E0EC]/50 text-xs flex-wrap gap-2">
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
        <div className="lg:col-span-7 rounded-2xl border border-[#D6E0EC] bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-[#C99732]" />
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
            <div className="rounded-2xl border border-dashed border-[#D6E0EC] p-10 text-center space-y-3">
              <Briefcase className="w-10 h-10 text-muted-foreground mx-auto opacity-30" />
              <p className="text-xs text-[#64748B] font-medium">لا توجد قضايا تطابق خيارات البحث والتصفية.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="text-xs mt-2"
              >
                إضافة أول قضية
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-[#D6E0EC] text-[#64748B]">
                    <th className="pb-3 font-semibold">رقم القضية</th>
                    <th className="pb-3 font-semibold">العميل</th>
                    <th className="pb-3 font-semibold">نوع القضية</th>
                    <th className="pb-3 font-semibold">المحكمة</th>
                    <th className="pb-3 font-semibold">المحامي</th>
                    <th className="pb-3 font-semibold text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]/70">
                  {paginatedCases.map((c) => {
                    const isSelected = c.id === selectedCaseId;

                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedCaseId(c.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#FFF4DE]/60 border-r-4 border-r-[#C99732]'
                            : 'hover:bg-[#F8FAFC]'
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
            <div className="flex items-center justify-between pt-3 border-t border-[#D6E0EC]/60 text-xs">
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
        <div className="lg:col-span-5 rounded-2xl border border-[#D6E0EC] bg-white p-5 shadow-xs space-y-5">
          {!selectedCase ? (
            <div className="text-center py-16 text-[#64748B] space-y-2">
              <Scale className="w-10 h-10 mx-auto text-muted-foreground opacity-30" />
              <p className="text-xs font-medium">اختر قضية من الجدول لعرض تفاصيلها ومستنداتها المرتبطة.</p>
            </div>
          ) : (
            <>
              {/* Detail Header */}
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#D6E0EC]">
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
                      className="h-8 text-xs px-2.5 rounded-lg border-[#D6E0EC]"
                    >
                      <UserCheck className="w-3.5 h-3.5 ml-1 text-[#C99732]" />
                      إسناد
                    </Button>
                  )}
                </div>
              </div>

              {/* Status Switcher Bar */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-[#D6E0EC]/60">
                {(['open', 'postponed', 'closed'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => handleQuickStatusChange(selectedCase.id, st)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedCase.status === st
                        ? 'bg-white text-[#10233F] shadow-xs border border-[#D6E0EC]'
                        : 'text-[#64748B] hover:text-[#10233F]'
                    }`}
                  >
                    {st === 'open' ? 'قيد النظر' : st === 'postponed' ? 'مؤجلة' : 'مغلقة'}
                  </button>
                ))}
              </div>

              {/* Case Attributes Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-[#F8FAFC] p-3.5 rounded-xl border border-[#D6E0EC]/60">
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

              {/* Next Session Date Summary */}
              <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary shrink-0" />
                  <div>
                    <span className="font-bold text-[#10233F] block">الجلسة القادمة:</span>
                    <span className="text-[11px] text-[#64748B]">
                      {caseDetail?.sessions && caseDetail.sessions.length > 0
                        ? `${caseDetail.sessions[0].sessionDateHijri || caseDetail.sessions[0].hearingAt?.slice(0, 10)} - ${caseDetail.sessions[0].sessionTime || ''}`
                        : 'لا توجد جلسات مجدولة حالياً'}
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsFullDetailOpen(true)}
                  className="text-xs text-primary font-bold hover:underline h-7 px-2"
                >
                  عرض السجل الكامل
                  <ExternalLink className="w-3 h-3 mr-1" />
                </Button>
              </div>

              {/* Linked Documents (Attachments Panel) */}
              <div className="pt-2 border-t border-[#D6E0EC]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#C99732]" />
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

      {/* ── Dialog: إضافة قضية جديدة ── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#10233F]">
              <Briefcase className="w-5 h-5 text-[#C99732]" />
              <span>إضافة ملف قضية جديد</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#64748B]">
              تسجيل قضية جديدة وربطها بالعميل والمحامي المسؤول في المكتب
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCase} className="space-y-4 pt-2">
            <div>
              <ClientPicker
                value={newClientId}
                onChange={setNewClientId}
                label="العميل (الموكل) *"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#10233F] mb-1">
                  رقم القضية *
                </label>
                <Input
                  placeholder="مثال: 2025/104"
                  value={newCaseNumber}
                  onChange={(e) => setNewCaseNumber(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#10233F] mb-1">
                  نوع القضية
                </label>
                <Input
                  placeholder="مثال: نزاع تجاري، عقاري..."
                  value={newCaseType}
                  onChange={(e) => setNewCaseType(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#10233F] mb-1">
                  المحكمة والدائرة
                </label>
                <Input
                  placeholder="مثال: المحكمة العامة بالرياض"
                  value={newCourt}
                  onChange={(e) => setNewCourt(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#10233F] mb-1">
                  الطرف المقابل (الخصم)
                </label>
                <Input
                  placeholder="اسم الخصم أو الشركة..."
                  value={newOpposingParty}
                  onChange={(e) => setNewOpposingParty(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            {isAdmin && (
              <div>
                <LawyerSelect
                  value={newAssignedLawyerId}
                  onChange={setNewAssignedLawyerId}
                  label="المحامي المسؤول"
                  placeholder="إسناد إلى محامٍ (اختياري)..."
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#10233F] mb-1">
                حالة القضية
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as any)}
                className="w-full h-10 px-3 rounded-xl text-xs font-medium bg-white border border-[#D6E0EC] text-[#10233F] focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="open">قيد النظر (جارية)</option>
                <option value="postponed">مؤجلة</option>
                <option value="closed">مغلقة</option>
              </select>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:justify-start">
              <Button
                type="submit"
                disabled={isCreating}
                className="bg-[#C99732] hover:bg-[#b5872a] text-white font-bold text-xs px-5 rounded-xl cursor-pointer"
              >
                {isCreating ? 'جاري الحفظ...' : 'حفظ القضية'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="text-xs rounded-xl"
              >
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: تعديل القضية ── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#10233F]">
              <Edit2 className="w-5 h-5 text-[#C99732]" />
              <span>تعديل بيانات القضية</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateCase} className="space-y-4 pt-2">
            <div>
              <ClientPicker
                value={editClientId}
                onChange={setEditClientId}
                label="العميل (الموكل) *"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#10233F] mb-1">
                  رقم القضية *
                </label>
                <Input
                  value={editCaseNumber}
                  onChange={(e) => setEditCaseNumber(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#10233F] mb-1">
                  نوع القضية
                </label>
                <Input
                  value={editCaseType}
                  onChange={(e) => setEditCaseType(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#10233F] mb-1">
                  المحكمة والدائرة
                </label>
                <Input
                  value={editCourt}
                  onChange={(e) => setEditCourt(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#10233F] mb-1">
                  الطرف المقابل
                </label>
                <Input
                  value={editOpposingParty}
                  onChange={(e) => setEditOpposingParty(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            {isAdmin && (
              <div>
                <LawyerSelect
                  value={editAssignedLawyerId}
                  onChange={setEditAssignedLawyerId}
                  label="المحامي المسؤول"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#10233F] mb-1">
                الحالة
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as any)}
                className="w-full h-10 px-3 rounded-xl text-xs font-medium bg-white border border-[#D6E0EC] text-[#10233F] focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="open">قيد النظر (جارية)</option>
                <option value="postponed">مؤجلة</option>
                <option value="closed">مغلقة</option>
              </select>
            </div>

            <DialogFooter className="gap-2 pt-2 sm:justify-start">
              <Button
                type="submit"
                disabled={isUpdating}
                className="bg-[#C99732] hover:bg-[#b5872a] text-white font-bold text-xs px-5 rounded-xl cursor-pointer"
              >
                {isUpdating ? 'جاري الحفظ...' : 'تحديث البيانات'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                className="text-xs rounded-xl"
              >
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: التفاصيل الكاملة (الجلسات والأحكام المرتبطة) ── */}
      <Dialog open={isFullDetailOpen} onOpenChange={setIsFullDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#10233F]">
              <Layers className="w-5 h-5 text-[#C99732]" />
              <span>السجل الكامل للقضية: {selectedCase?.caseNumber}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* Linked Sessions Section */}
            <div>
              <h4 className="text-xs font-bold text-[#10233F] flex items-center gap-1.5 mb-2.5">
                <Calendar className="w-4 h-4 text-primary" />
                <span>الجلسات القضائية المرتبطة ({caseDetail?.sessions?.length ?? 0})</span>
              </h4>

              {caseDetail?.sessions && caseDetail.sessions.length > 0 ? (
                <div className="space-y-2">
                  {caseDetail.sessions.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-xl border border-[#D6E0EC] bg-[#F8FAFC] flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#10233F] block font-mono">
                          {s.sessionDateHijri || s.hearingAt?.slice(0, 10)} {s.sessionTime ? `- ${s.sessionTime}` : ''}
                        </span>
                        <span className="text-[11px] text-[#64748B]">
                          {s.court || 'المحكمة'} {s.notes ? `— ${s.notes}` : ''}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-[#D6E0EC] text-center text-xs text-[#64748B]">
                  لا توجد جلسات مرتبطة بهذا الرقم.
                </div>
              )}
            </div>

            {/* Linked Judgments Section */}
            <div>
              <h4 className="text-xs font-bold text-[#10233F] flex items-center gap-1.5 mb-2.5">
                <Gavel className="w-4 h-4 text-[#C99732]" />
                <span>الأحكام القضائية الصادرة ({caseDetail?.judgments?.length ?? 0})</span>
              </h4>

              {caseDetail?.judgments && caseDetail.judgments.length > 0 ? (
                <div className="space-y-2">
                  {caseDetail.judgments.map((j) => (
                    <div
                      key={j.id}
                      className="p-3 rounded-xl border border-[#D6E0EC] bg-[#F8FAFC] flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#10233F] block">
                          صك رقم: {j.judgmentNumber} ({j.judgmentDate})
                        </span>
                        <span className="text-[11px] text-[#64748B] line-clamp-1">
                          {j.summary || 'ملخص الحكم'}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        {j.isFavorable}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-[#D6E0EC] text-center text-xs text-[#64748B]">
                  لا توجد أحكام مسجلة لهذه القضية حتى الآن.
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-2 sm:justify-start">
            <Button
              variant="outline"
              onClick={() => setIsFullDetailOpen(false)}
              className="text-xs rounded-xl"
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
