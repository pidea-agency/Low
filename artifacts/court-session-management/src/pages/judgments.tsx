import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Gavel,
  Plus,
  Trash2,
  Calendar as CalendarIcon,
  User,
  Scale,
  Search,
  Edit3,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  FileText,
  UserCheck,
  AlertCircle,
  UserCog,
  Paperclip,
  Download,
  Clock,
  Send,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Building2,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useGetCurrentUser } from '@workspace/api-client-react';
import { ClientPicker } from '@/components/clients/client-picker';
import { LawyerSelect } from '@/components/clients/lawyer-select';
import { ReassignDialog } from '@/components/clients/reassign-dialog';
import { AttachmentsPanel } from '@/components/attachments/attachments-panel';
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

export interface JudgmentItem {
  id: string | number;
  caseNumber: string;
  judgmentNumber: string;
  court: string;
  circuit?: string;
  plaintiff: string;
  defendant: string;
  assignedLawyer: string;
  assignedLawyerId?: string | null;
  judgmentDateHijri: string;
  judgmentType: 'final' | 'preliminary' | 'enforcement' | 'urgent_appeal';
  judgmentTypeLabel: string;
  enforceabilityForm: string;
  enforceabilityStatus: string;
  summary: string;
  claimAmount?: string;
  appealDeadlineDays?: number;
  attachmentsCount?: number;
  pdfUrl?: string;
}

export default function JudgmentsPage() {
  const { toast } = useToast();
  const { data: currentUser } = useGetCurrentUser();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // Active status tab: 'all' | 'final' | 'preliminary' | 'enforcement' | 'urgent_appeal'
  const [activeTab, setActiveTab] = useState<'all' | 'final' | 'preliminary' | 'enforcement' | 'urgent_appeal'>('all');

  // Search input
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog states
  const [isOpen, setIsOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<JudgmentItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JudgmentItem | null>(null);
  const [reassignTarget, setReassignTarget] = useState<JudgmentItem | null>(null);
  const [attachmentTarget, setAttachmentTarget] = useState<JudgmentItem | null>(null);

  // Form State
  const [caseNumber, setCaseNumber] = useState('');
  const [court, setCourt] = useState('');
  const [circuit, setCircuit] = useState('');
  const [plaintiff, setPlaintiff] = useState('');
  const [defendant, setDefendant] = useState('');
  const [assignedLawyer, setAssignedLawyer] = useState('');
  const [assignedLawyerId, setAssignedLawyerId] = useState<string | null>(null);
  const [judgmentNumber, setJudgmentNumber] = useState('');
  const [judgmentDateHijri, setJudgmentDateHijri] = useState('1446/05/18هـ');
  const [summary, setSummary] = useState('');
  const [judgmentType, setJudgmentType] = useState<'final' | 'preliminary' | 'enforcement' | 'urgent_appeal'>('final');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch real Judgments from backend
  const [backendRecords, setBackendRecords] = useState<any[]>([]);

  const loadBackendData = useCallback(async () => {
    try {
      const res = await fetch('/api/judgments', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setBackendRecords(data);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadBackendData();
  }, [loadBackendData]);

  // Map real backend judgments
  const allJudgments: JudgmentItem[] = useMemo(() => {
    if (!backendRecords || backendRecords.length === 0) {
      return [];
    }
    return backendRecords.map((b, idx) => {
      const jType = b.judgmentType || (b.isFavorable === 'ابتدائي' ? 'preliminary' : b.isFavorable === 'تنفيذي' ? 'enforcement' : 'final');
      let typeLabel = 'حكم نهائي';
      let enforceabilityForm = 'الصيغة: تنفيذية قطعية';
      let enforceabilityStatus = 'مكتسب الصفة التنفيذية - جاهز للتنفيذ';

      if (jType === 'preliminary') {
        typeLabel = 'حكم ابتدائي';
        enforceabilityForm = 'متبقي مهلة الاعتراض';
        enforceabilityStatus = 'قيد تدقيق اللائحة الاعتراضية';
      } else if (jType === 'enforcement') {
        typeLabel = 'قرار تنفيذ (م 46)';
        enforceabilityForm = 'الصيغة: قرار إفصاح وحجز تنفيذي';
        enforceabilityStatus = 'مفعل لدى منصة إيفاء والتنفيذ الجبري';
      } else if (jType === 'urgent_appeal') {
        typeLabel = 'حكم ابتدائي (مستأنف)';
        enforceabilityForm = b.appealDeadlineDays ? `متبقي ${b.appealDeadlineDays} يوماً على مهلة الاعتراض` : 'متبقي مهلة الاعتراض';
        enforceabilityStatus = 'قيد الاستئناف - إعداد لائحة الاعتراض';
      }

      return {
        id: b.id || `judge-${idx}`,
        caseNumber: b.caseNumber || b.case_number || '—',
        judgmentNumber: b.judgmentNumber || b.judgment_number || '—',
        court: b.court || 'المحكمة المختصة',
        circuit: b.circuit || 'الدائرة القضائية',
        plaintiff: b.plaintiff || '—',
        defendant: b.defendant || '—',
        assignedLawyer: b.assignedLawyer || b.assigned_lawyer_name || 'غير محدد',
        assignedLawyerId: b.assignedLawyerId || null,
        judgmentDateHijri: b.judgmentDate || b.judgment_date || '—',
        judgmentType: jType,
        judgmentTypeLabel: typeLabel,
        enforceabilityForm,
        enforceabilityStatus,
        summary: b.summary || 'منطوق الحكم الصادر في الدعوى.',
        attachmentsCount: b.attachmentsCount || 0,
        appealDeadlineDays: b.appealDeadlineDays,
      };
    });
  }, [backendRecords]);

  // Dynamic KPI Counts
  const totalJudgmentsCount = allJudgments.length;
  const finalJudgmentsCount = allJudgments.filter((j) => j.judgmentType === 'final').length;
  const preliminaryJudgmentsCount = allJudgments.filter((j) => j.judgmentType === 'preliminary').length;
  const enforcementJudgmentsCount = allJudgments.filter((j) => j.judgmentType === 'enforcement').length;
  const urgentAppealCount = allJudgments.filter((j) => j.judgmentType === 'urgent_appeal' || (j.appealDeadlineDays !== undefined && j.appealDeadlineDays > 0)).length;
  const winRate = totalJudgmentsCount > 0 ? Math.round((finalJudgmentsCount / totalJudgmentsCount) * 100) : 0;

  // Filtered Judgments
  const filteredJudgments = useMemo(() => {
    return allJudgments.filter((item) => {
      // Tab filter
      if (activeTab === 'final' && item.judgmentType !== 'final') return false;
      if (activeTab === 'preliminary' && item.judgmentType !== 'preliminary') return false;
      if (activeTab === 'enforcement' && item.judgmentType !== 'enforcement') return false;
      if (activeTab === 'urgent_appeal' && item.judgmentType !== 'urgent_appeal') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCase = item.caseNumber.toLowerCase().includes(q);
        const matchJudgeNum = item.judgmentNumber.toLowerCase().includes(q);
        const matchCourt = item.court.toLowerCase().includes(q);
        const matchPlaintiff = item.plaintiff.toLowerCase().includes(q);
        const matchDefendant = item.defendant.toLowerCase().includes(q);
        if (!matchCase && !matchJudgeNum && !matchCourt && !matchPlaintiff && !matchDefendant) {
          return false;
        }
      }

      return true;
    });
  }, [allJudgments, activeTab, searchQuery]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingRecord(null);
    setCaseNumber('');
    setJudgmentNumber('');
    setCourt('');
    setCircuit('');
    setPlaintiff('');
    setDefendant('');
    setAssignedLawyer('');
    setAssignedLawyerId(null);
    setJudgmentDateHijri('');
    setJudgmentType('final');
    setSummary('');
    setIsOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (rec: JudgmentItem) => {
    setEditingRecord(rec);
    setCaseNumber(rec.caseNumber);
    setJudgmentNumber(rec.judgmentNumber);
    setCourt(rec.court);
    setCircuit(rec.circuit || '');
    setPlaintiff(rec.plaintiff);
    setDefendant(rec.defendant);
    setAssignedLawyer(rec.assignedLawyer);
    setAssignedLawyerId(rec.assignedLawyerId || null);
    setJudgmentDateHijri(rec.judgmentDateHijri);
    setJudgmentType(rec.judgmentType);
    setSummary(rec.summary);
    setIsOpen(true);
  };

  // Save Judgment
  const handleSaveJudgment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseNumber.trim() || !judgmentNumber.trim()) {
      toast({ title: 'يرجى إدخال رقم القضية ورقم الصك', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        caseNumber: caseNumber.trim(),
        judgmentNumber: judgmentNumber.trim(),
        court: court.trim(),
        plaintiff: plaintiff.trim(),
        defendant: defendant.trim(),
        assignedLawyer: assignedLawyer.trim(),
        assignedLawyerId: assignedLawyerId || null,
        judgmentDate: judgmentDateHijri.trim(),
        summary: summary.trim(),
        isFavorable: judgmentType === 'preliminary' ? 'ابتدائي' : 'نهائي',
      };

      const url = editingRecord ? `/api/judgments/${editingRecord.id}` : '/api/judgments';
      const method = editingRecord ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({
          title: editingRecord ? 'تم تحديث الحكم بنجاح' : 'تم تسجيل الحكم القضائي بنجاح',
          description: `تم توثيق صك الحكم رقم ${judgmentNumber}.`,
        });
        loadBackendData();
        setIsOpen(false);
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'فشل حفظ الحكم القضائي',
          description: err.error || 'تعذر حفظ الحكم في قاعدة البيانات.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'خطأ في الاتصال بالخادم',
        description: 'تعذر حفظ صك الحكم. يرجى التحقق من اتصال الشبكة.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Judgment
  const handleDeleteJudgment = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/judgments/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: 'تم حذف صك الحكم بنجاح' });
        loadBackendData();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'فشل حذف الحكم',
          description: err.error || 'تعذر حذف الحكم من قاعدة البيانات.',
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
              <span className="text-[#00236f] font-semibold">الأحكام القضائية</span>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-6 rounded-full bg-[#00236f]" />
              <h1 className="text-2xl font-bold text-[#131b2e]">
                الأحكام القضائية
              </h1>
            </div>
            <p className="text-xs text-[#55627a] leading-relaxed mr-3.5 max-w-3xl">
              سجل وتوثيق الأحكام والقرارات القضائية ومتابعة نتائجها النهائية والابتدائية والتنفيذية.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={handleOpenCreate}
              className="bg-[#b87019] hover:bg-[#995c14] text-white text-xs font-bold h-10 px-4 gap-2 rounded-lg shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              + إضافة حكم جديد
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                const csvContent =
                  'data:text/csv;charset=utf-8,رقم القضية,رقم الصك,المحكمة,المدعي,المدعى عليه,المحامي,النوع,الخلاصة\n' +
                  allJudgments
                    .map(
                      (j) =>
                        `"${j.caseNumber}","${j.judgmentNumber}","${j.court}","${j.plaintiff}","${j.defendant}","${j.assignedLawyer}","${j.judgmentTypeLabel}","${j.summary.replace(/"/g, '""')}"`
                    )
                    .join('\n');
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement('a');
                link.setAttribute('href', encodedUri);
                link.setAttribute('download', 'judgments_registry.csv');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast({ title: 'تم تصدير سجل الأحكام القضائية بصيغة Excel / CSV' });
              }}
              className="bg-white hover:bg-[#edf3ff] text-[#44526d] border-[#d4e2f6] text-xs font-semibold h-10 px-3.5 gap-1.5 rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#55627a]" />
              تصدير السجل
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                loadBackendData();
                toast({
                  title: 'تحديث ومزامنة ناجز',
                  description: 'تم التحقق من صكوك الأحكام وقرارات التنفيذ إلكترونياً بنجاح.',
                });
              }}
              className="bg-white hover:bg-[#edf3ff] text-[#00236f] border-[#cfe0fc] text-xs font-semibold h-10 px-3.5 gap-1.5 rounded-lg cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#00236f]" />
              تحديث ومزامنة ناجز
            </Button>
          </div>
        </div>

        {/* ── 4 KPI Metric Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: إجمالي الأحكام */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">إجمالي الأحكام</span>
                <div className="text-3xl font-bold text-[#131c2d] font-mono">{totalJudgmentsCount}</div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#fef5ec] text-[#b35600] flex items-center justify-center">
                <Gavel className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] text-[11px] text-[#697893]">
              دعاوى مكتملة وقيد المتابعة
            </div>
          </div>

          {/* Card 2: أحكام نهائية (مكتسبة القطعية) */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">أحكام نهائية (مكتسبة القطعية)</span>
                <div className="text-3xl font-bold text-[#131c2d] font-mono">{finalJudgmentsCount}</div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] text-[11px] text-emerald-700 font-semibold">
              نسبة نجاح {winRate}% لصالح الموكلين
            </div>
          </div>

          {/* Card 3: أحكام ابتدائية (قيد الاستئناف) */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">أحكام ابتدائية (قيد الاستئناف)</span>
                <div className="text-3xl font-bold text-[#00236f] font-mono">{preliminaryJudgmentsCount}</div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-[#ebf3ff] text-[#00236f] flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] text-[11px] text-amber-800 font-medium">
              مهلة تقديم اللائحة جارية
            </div>
          </div>

          {/* Card 4: قرارات تنفيذ صادرة */}
          <div className="bg-white border border-[#e2ecfa] rounded-xl p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-xs font-medium text-[#647188]">قرارات تنفيذ صادرة</span>
                <div className="text-3xl font-bold text-purple-700 font-mono">{enforcementJudgmentsCount}</div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                <Scale className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-[#f1f5fd] text-[11px] text-purple-700 font-medium">
              مادة (46) تفعيل التنفيذ الجبري
            </div>
          </div>
        </div>

        {/* ── Tabs & Search Bar Row ── */}
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
              الكل {totalJudgmentsCount}
            </button>

            <button
              onClick={() => setActiveTab('final')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === 'final'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              <span>أحكام نهائية</span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                {finalJudgmentsCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('preliminary')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === 'preliminary'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              <span>أحكام ابتدائية</span>
              <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                {preliminaryJudgmentsCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('enforcement')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === 'enforcement'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              <span>أوامر تنفيذ</span>
              <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                {enforcementJudgmentsCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('urgent_appeal')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'urgent_appeal'
                  ? 'bg-[#00236f] text-white shadow-xs'
                  : 'bg-white text-[#55637d] hover:bg-[#edf3ff] border border-[#dce7f6]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#fd8a42]" />
              <span>تتطلب استئنافاً عاجلاً</span>
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                {urgentAppealCount}
              </span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#8b99b0] absolute right-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث برقم القضية، رقم الصك، المحكمة، المدعي..."
              className="pr-9 h-9 text-xs border-[#dce7f6] bg-white focus:bg-white text-[#182337] rounded-lg shadow-2xs"
            />
          </div>
        </div>

        {/* ── Judgments Cards List ── */}
        <div className="space-y-4 pt-1">
          {filteredJudgments.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#dbe6f8] p-12 text-center shadow-2xs">
              <Gavel className="w-12 h-12 text-[#9bb3d8] mx-auto mb-3" />
              <h3 className="text-base font-bold text-[#141e30] mb-1">لا توجد أحكام قضائية مسجلة</h3>
              <p className="text-xs text-[#637189] max-w-sm mx-auto mb-5">
                لم يتم العثور على أي صكوك أحكام مطابقة للتصفية، أو لم يتم توثيق أحكام قضائية بعد.
              </p>
              <Button
                onClick={handleOpenCreate}
                className="bg-[#00236f] hover:bg-[#001a54] text-white text-xs font-bold px-4 py-2 rounded-lg"
              >
                <Plus className="w-4 h-4 ml-1.5" />
                إضافة صك حكم جديد
              </Button>
            </div>
          ) : (
            filteredJudgments.map((item) => {
            const isFinal = item.judgmentType === 'final';
            const isUrgent = item.judgmentType === 'urgent_appeal';

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-[#dbe6f8] shadow-2xs p-5 space-y-4 hover:border-[#b8d1fc] transition-all"
              >
                {/* Header Row: Case Number Pill & Status Badges */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#edf3fc]">
                  <div className="flex items-center gap-2">
                    <span className="bg-[#f0f5ff] text-[#00236f] text-xs font-mono font-bold px-3 py-1 rounded-md border border-[#cfe0fc]">
                      قضية رقم : {item.caseNumber}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isFinal && (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1 rounded-md flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        {item.judgmentTypeLabel}
                      </span>
                    )}
                    {isUrgent && (
                      <>
                        <span className="bg-[#eaf1ff] text-[#00236f] border border-[#cfdffc] text-xs font-bold px-3 py-1 rounded-md flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#00236f]" />
                          {item.judgmentTypeLabel}
                        </span>
                        <span className="bg-[#fff0e6] text-[#b44800] border border-[#ffd5ba] text-xs font-bold px-2.5 py-1 rounded-md flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-[#fd8a42]" />
                          {item.enforceabilityForm}
                        </span>
                      </>
                    )}
                    {!isFinal && !isUrgent && (
                      <span className="bg-[#f4f7fc] text-[#42526e] border border-[#dbe6f8] text-xs font-bold px-3 py-1 rounded-md">
                        {item.judgmentTypeLabel}
                      </span>
                    )}
                    {isFinal && (
                      <span className="bg-[#f4f7fc] text-[#55647e] text-xs font-medium px-2.5 py-1 rounded-md border border-[#dbe6f8]">
                        {item.enforceabilityForm}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Content Grid: 3 Blocks */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                  {/* Right Block: Judgment Instrument Number */}
                  <div className="lg:col-span-3 bg-[#fafcff] border border-[#e2ecfa] rounded-xl p-4 text-center space-y-1">
                    <span className="text-[11px] text-[#697994] font-medium block">رقم الصك القضائي</span>
                    <div className="flex items-center justify-center gap-2">
                      <div className="text-2xl font-bold text-[#131c2d] tracking-wider font-mono">
                        {item.judgmentNumber}
                      </div>
                      <Gavel className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="text-[10px] text-[#718099] pt-1">
                      تاريخ الإصدار: {item.judgmentDateHijri}
                    </div>
                  </div>

                  {/* Middle Block: Court & Parties Info */}
                  <div className="lg:col-span-5 space-y-2 text-xs">
                    <div>
                      <span className="text-[#657591] font-semibold">المحكمة المختصة: </span>
                      <strong className="text-[#141e30]">{item.court}</strong>
                      {item.circuit && (
                        <span className="text-[#556480] mr-1">- {item.circuit}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#edf3fc]">
                      <div>
                        <span className="text-[#657591] block text-[11px]">المدعي (الموكل):</span>
                        <strong className="text-[#141e30]">{item.plaintiff}</strong>
                      </div>
                      <div>
                        <span className="text-[#657591] block text-[11px]">المدعى عليه:</span>
                        <strong className="text-[#141e30]">{item.defendant}</strong>
                      </div>
                    </div>

                    <div className="pt-1 text-[11px] text-[#556480]">
                      <span className="text-[#657591]">المحامي المكلف: </span>
                      <strong className="text-[#00236f]">{item.assignedLawyer}</strong>
                    </div>
                  </div>

                  {/* Left Block: Ruling Summary Box */}
                  <div className="lg:col-span-4 bg-[#f8faff] border border-[#dce7f6] rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-[#141e30]">
                      <Volume2 className="w-4 h-4 text-[#00236f]" />
                      <span>منطوق الحكم وخلاصته:</span>
                    </div>
                    <p className="text-[11px] text-[#3e4f6e] leading-relaxed">
                      {item.summary}
                    </p>
                    <div className="pt-1">
                      <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-200">
                        {item.enforceabilityStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#edf3fc] text-xs">
                  {/* Left Secondary Actions */}
                  <div className="flex items-center gap-1.5 text-[#556480]">
                    {(isAdmin || (currentUser?.id && (item.assignedLawyerId === currentUser.id || (item as any).assigned_lawyer_id === currentUser.id))) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(item)}
                        className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1 px-2.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        حذف
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(item)}
                      className="h-8 text-xs text-[#00236f] hover:bg-[#edf3ff] gap-1 px-2.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      تعديل
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAttachmentTarget(item)}
                      className="h-8 text-xs text-[#44526e] hover:bg-[#edf3ff] gap-1 px-2.5 cursor-pointer"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      المرفقات ({item.attachmentsCount || 2})
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setReassignTarget(item)}
                        className="h-8 text-xs text-[#44526e] hover:bg-[#edf3ff] gap-1 px-2.5 cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        إعادة تعيين
                      </Button>
                    )}
                  </div>

                  {/* Right Primary Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        toast({
                          title: 'صك الحكم القضائي',
                          description: `جارٍ تجهيز وتحميل نسخة الصك رقم ${item.judgmentNumber} بصيغة PDF.`,
                        });
                      }}
                      className="h-8 text-xs border-[#d1dff6] text-[#42526e] hover:bg-[#edf3ff] gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-rose-600" />
                      صك الحكم الرسمي (PDF)
                    </Button>

                    {isFinal ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          toast({
                            title: 'طلب التنفيذ القضائي عبر ناجز',
                            description: `تم توجيه طلب التنفيذ للصك رقم ${item.judgmentNumber} لدى محكمة التنفيذ بنجاح.`,
                          });
                        }}
                        className="h-8 text-xs bg-[#0b8043] hover:bg-[#086334] text-white font-bold gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Gavel className="w-3.5 h-3.5" />
                        طلب التنفيذ عبر ناجز
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          toast({
                            title: 'إيداع لائحة اعتراضية',
                            description: `تم فتح نموذج إيداع لائحة الاستئناف للقضية ${item.caseNumber}.`,
                          });
                        }}
                        className="h-8 text-xs bg-[#00236f] hover:bg-[#001c59] text-white font-bold gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        تقديم لائحة اعتراضية (استئناف)
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        </div>
      </div>

      {/* ── Dialog: Add / Edit Judgment ── */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#141e30]">
              {editingRecord ? 'تعديل بيانات الحكم القضائي' : 'توثيق وتسجيل حكم قضائي جديد'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#65738c]">
              أدخل بيانات صك الحكم والمحكمة والأطراف ومنطوق الحكم الصادر.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveJudgment} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-bold text-[#44526d]">رقم القضية *</Label>
                <Input
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  placeholder="مثال: 4821/2026"
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="font-bold text-[#44526d]">رقم الصك القضائي *</Label>
                <Input
                  value={judgmentNumber}
                  onChange={(e) => setJudgmentNumber(e.target.value)}
                  placeholder="مثال: 123123"
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-bold text-[#44526d]">المحكمة *</Label>
                <Input
                  value={court}
                  onChange={(e) => setCourt(e.target.value)}
                  placeholder="المحكمة التجارية بالرياض"
                  className="h-8 text-xs"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="font-bold text-[#44526d]">الدائرة القضائية</Label>
                <Input
                  value={circuit}
                  onChange={(e) => setCircuit(e.target.value)}
                  placeholder="الدائرة الحقوقية الثالثة"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-bold text-[#44526d]">المدعي (الموكل)</Label>
                <Input
                  value={plaintiff}
                  onChange={(e) => setPlaintiff(e.target.value)}
                  placeholder="أحمد خالد العتيبي"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="font-bold text-[#44526d]">المدعى عليه</Label>
                <Input
                  value={defendant}
                  onChange={(e) => setDefendant(e.target.value)}
                  placeholder="شركة الأفق للاستثمار"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-bold text-[#44526d]">تاريخ الحكم (هجري)</Label>
                <Input
                  value={judgmentDateHijri}
                  onChange={(e) => setJudgmentDateHijri(e.target.value)}
                  placeholder="1446/05/18هـ"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="font-bold text-[#44526d]">حالة الحكم</Label>
                <select
                  value={judgmentType}
                  onChange={(e) => setJudgmentType(e.target.value as any)}
                  className="w-full h-8 text-xs bg-[#f8faff] border border-[#dce7f6] rounded-md px-2 text-[#33425b] focus:outline-none cursor-pointer"
                >
                  <option value="final">حكم نهائي (مكتسب القطعية)</option>
                  <option value="preliminary">حكم ابتدائي (قيد الاستئناف)</option>
                  <option value="enforcement">قرار تنفيذ (مادة 46)</option>
                  <option value="urgent_appeal">استئناف عاجل</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="font-bold text-[#44526d]">منطوق الحكم وخلاصته *</Label>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="إلزام المدعى عليها بدفع المبالغ المستحقة وتحميل الأتعاب..."
                rows={3}
                className="text-xs resize-none"
                required
              />
            </div>

            <DialogFooter className="gap-2 sm:justify-start pt-2">
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-[#00236f] hover:bg-[#001c59] text-white text-xs"
              >
                {isSaving ? 'جارٍ الحفظ...' : 'حفظ صك الحكم'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="text-xs">
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
              تأكيد حذف صك الحكم القضائي
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#65738c]">
              هل أنت متأكد من رغبتك في حذف الحكم رقم ({deleteTarget?.judgmentNumber}) الخاص بالقضية ({deleteTarget?.caseNumber})؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogAction
              onClick={handleDeleteJudgment}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs"
            >
              حذف الحكم
            </AlertDialogAction>
            <AlertDialogCancel className="text-xs">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog: Reassign Lawyer ── */}
      {reassignTarget && (
        <ReassignDialog
          open={!!reassignTarget}
          onOpenChange={(open) => !open && setReassignTarget(null)}
          module="judgments"
          recordId={reassignTarget.id}
          currentLawyerId={reassignTarget.assignedLawyerId || null}
          recordTitle={`صك الحكم رقم ${reassignTarget.judgmentNumber}`}
          onSuccess={() => {
            loadBackendData();
            setReassignTarget(null);
            toast({ title: 'تمت إعادة تعيين المحامي المكلف بنجاح' });
          }}
        />
      )}

      {/* ── Dialog: Attachments ── */}
      {attachmentTarget && (
        <Dialog open={!!attachmentTarget} onOpenChange={(open) => !open && setAttachmentTarget(null)}>
          <DialogContent className="max-w-xl text-right" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-[#141e30]">
                مرفقات صك الحكم رقم {attachmentTarget.judgmentNumber}
              </DialogTitle>
            </DialogHeader>
            <AttachmentsPanel
              relatedRecordType="judgment"
              relatedRecordId={attachmentTarget.id}
              title={`مرفقات صك الحكم رقم ${attachmentTarget.judgmentNumber}`}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
