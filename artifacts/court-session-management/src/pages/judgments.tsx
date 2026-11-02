import { useState, useEffect, useCallback } from 'react';
import { getArabicDayName } from '@/lib/hijri';
import { Gavel, Plus, Trash2, Calendar as CalendarIcon, User, Scale, Search, Edit3, Loader2, RefreshCw, CheckCircle2, XCircle, FileText, UserCheck, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export interface JudgmentRecord {
  id: number;
  caseNumber?: string;
  court: string;
  plaintiff: string;
  defendant: string;
  assignedLawyer: string;
  judgmentNumber: string;
  judgmentDate: string;
  summary: string;
  isFavorable: 'نهائي' | 'ابتدائي' | 'نعم' | 'لا' | string;
  createdAt: string;
}

export default function JudgmentsPage() {
  const { toast } = useToast();

  const [records, setRecords] = useState<JudgmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterResult, setFilterResult] = useState<'all' | 'نهائي' | 'ابتدائي'>('all');
  const [isOpen, setIsOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<JudgmentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JudgmentRecord | null>(null);
  const [bindingError, setBindingError] = useState<string | null>(null);

  // Form State
  const [formError, setFormError] = useState<string | null>(null);
  const [caseNumber, setCaseNumber] = useState('');
  const [court, setCourt] = useState('');
  const [plaintiff, setPlaintiff] = useState('');
  const [defendant, setDefendant] = useState('');
  const [assignedLawyer, setAssignedLawyer] = useState('');
  const [judgmentNumber, setJudgmentNumber] = useState('');
  const [judgmentDate, setJudgmentDate] = useState('');
  const [summary, setSummary] = useState('');
  const [isFavorable, setIsFavorable] = useState<'نهائي' | 'ابتدائي'>('نهائي');

  // Load Judgments data
  const loadRecords = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsLoading(true);
    try {
      const url = isManualRefresh ? '/api/judgments?refresh=true' : '/api/judgments';
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        setBindingError(null);
        const data: JudgmentRecord[] = await res.json();
        setRecords(data);
      } else if (res.status === 409) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson.error || 'ربط المكتب غير مكتمل. تواصل مع المشرف';
        setBindingError(msg);
        throw new Error(msg);
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'فشل جلب البيانات من السيرفر');
      }
    } catch (err: any) {
      toast({
        title: 'خطأ في جلب البيانات',
        description: err.message || 'تعذر تحميل الأحكام القضائية',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingRecord(null);
    setFormError(null);
    setCaseNumber('');
    setCourt('');
    setPlaintiff('');
    setDefendant('');
    setAssignedLawyer('');
    setJudgmentNumber('');
    setJudgmentDate('');
    setSummary('');
    setIsFavorable('نهائي');
    setIsOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (rec: JudgmentRecord) => {
    setEditingRecord(rec);
    setFormError(null);
    setCaseNumber(rec.caseNumber || '');
    setCourt(rec.court || '');
    setPlaintiff(rec.plaintiff || '');
    setDefendant(rec.defendant || '');
    setAssignedLawyer(rec.assignedLawyer || '');
    setJudgmentNumber(rec.judgmentNumber || '');
    setJudgmentDate(rec.judgmentDate || '');
    setSummary(rec.summary || '');
    setIsFavorable(rec.isFavorable === 'ابتدائي' || rec.isFavorable === 'لا' ? 'ابتدائي' : 'نهائي');
    setIsOpen(true);
  };

  // Submit Save or Update
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!caseNumber.trim()) {
      const msg = 'يرجى إدخال رقم القضية.';
      setFormError(msg);
      toast({
        title: 'تنبيه',
        description: msg,
        variant: 'destructive',
      });
      return;
    }

    if (!judgmentNumber.trim()) {
      const msg = 'يرجى إدخال رقم الصك.';
      setFormError(msg);
      toast({
        title: 'تنبيه',
        description: msg,
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    setFormError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

    try {
      const payload = {
        caseNumber: caseNumber.trim(),
        court: court.trim(),
        plaintiff: plaintiff.trim(),
        defendant: defendant.trim(),
        assignedLawyer: assignedLawyer.trim(),
        judgmentNumber: judgmentNumber.trim(),
        judgmentDate: judgmentDate.trim(),
        summary: summary.trim(),
        isFavorable,
      };

      let res: Response;
      if (editingRecord) {
        // PUT update
        res = await fetch(`/api/judgments/${editingRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      } else {
        // POST create
        res = await fetch('/api/judgments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      }

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const refIdStr = errorData.refId ? ` رقم المرجع: ${errorData.refId}` : '';
        const errMsg = errorData.error
          ? (errorData.refId && errorData.error.includes(errorData.refId) ? errorData.error : `${errorData.error}${refIdStr}`)
          : `تعذر حفظ الحكم في السيرفر.${refIdStr}`;
        throw new Error(errMsg);
      }

      toast({
        title: 'نجاح',
        description: editingRecord ? 'تم تحديث الحكم بنجاح.' : 'تم إضافة الحكم بنجاح.',
      });

      setFormError(null);
      setIsOpen(false);
      await loadRecords(true);
    } catch (err: any) {
      clearTimeout(timeoutId);
      let message = err.message || 'فشل حفظ الحكم.';
      if (err.name === 'AbortError') {
        message = 'انتهت مهلة حفظ الحكم (20 ثانية). يرجى المحاولة مرة أخرى.';
      }
      setFormError(message);
      toast({
        title: 'خطأ',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Record
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      const res = await fetch(`/api/judgments/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('فشل حذف الحكم من السيرفر.');
      }

      toast({
        title: 'تم الحذف',
        description: 'تم حذف سجل الحكم بنجاح.',
      });

      setDeleteTarget(null);
      await loadRecords(true);
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message || 'فشل عملية الحذف.',
        variant: 'destructive',
      });
    }
  };

  // Filtering
  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.caseNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.judgmentNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.court?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.plaintiff?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.defendant?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.assignedLawyer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.summary?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      filterResult === 'all' ||
      r.isFavorable === filterResult ||
      (filterResult === 'نهائي' && r.isFavorable === 'نعم') ||
      (filterResult === 'ابتدائي' && r.isFavorable === 'لا');

    return matchesSearch && matchesFilter;
  });

  const favorableCount = records.filter((r) => r.isFavorable === 'نهائي' || r.isFavorable === 'نعم').length;
  const unfavorableCount = records.filter((r) => r.isFavorable === 'ابتدائي' || r.isFavorable === 'لا').length;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="fade-in-up flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 rounded-full bg-emerald-600" />
            <h1 className="text-2xl font-bold tracking-tight">الأحكام القضائية</h1>
          </div>
          <p className="text-muted-foreground text-sm mr-3">
            سجل وتوثيق الأحكام والقرارات القضائية ومتابعة نتائجها النهائية والابتدائية
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadRecords(true)}
            disabled={isLoading}
            className="gap-2 border-border"
            title="تحديث البيانات من قوقل شيت"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            تحديث
          </Button>

          <Button
            onClick={handleOpenCreate}
            size="sm"
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            data-testid="button-add-judgment"
          >
            <Plus className="w-4 h-4" />
            إضافة حكم جديد
          </Button>
        </div>
      </div>

      {bindingError && (
        <div className="fade-in-up rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-destructive flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="flex-1 font-semibold text-sm">{bindingError}</div>
        </div>
      )}

      {/* Stats Quick Cards */}
      <div className="fade-in-up fade-in-up-delay-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">إجمالي الأحكام</p>
            <p className="text-2xl font-bold font-mono">{records.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Gavel className="w-5 h-5 text-primary" />
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-1">أحكام نهائية</p>
            <p className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300">{favorableCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">أحكام ابتدائية</p>
            <p className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-300">{unfavorableCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="fade-in-up fade-in-up-delay-1 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="البحث برقم القضية، رقم الصك، المحكمة، المدعي، المدعى عليه..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 h-10 bg-card border-border text-sm"
            data-testid="input-search-judgments"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-muted rounded-xl border border-border shrink-0">
          <button
            onClick={() => setFilterResult('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterResult === 'all'
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            الكل ({records.length})
          </button>
          <button
            onClick={() => setFilterResult('نهائي')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterResult === 'نهائي'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            أحكام نهائية ({favorableCount})
          </button>
          <button
            onClick={() => setFilterResult('ابتدائي')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterResult === 'ابتدائي'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            أحكام ابتدائية ({unfavorableCount})
          </button>
        </div>
      </div>

      {/* List / Cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5">
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : filteredRecords.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 fade-in-up fade-in-up-delay-2">
          {filteredRecords.map((rec) => {
            const isFinal = rec.isFavorable === 'نهائي' || rec.isFavorable === 'نعم';
            const dayName = getArabicDayName({ sessionDateHijri: rec.judgmentDate });

            return (
              <div
                key={rec.id}
                className="rounded-2xl border border-border bg-card p-5 relative group transition-all duration-200 hover:border-emerald-500/40 hover:shadow-lg flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Case Number, Judgment Deed & Status Badge */}
                  <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-border/60">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {rec.caseNumber ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                            قضية رقم: {rec.caseNumber}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground">
                            بدون رقم قضية
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Gavel className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground block leading-tight font-medium">رقم الصك</span>
                          <span className="font-bold text-base font-mono text-foreground">{rec.judgmentNumber}</span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 border shadow-xs ${
                        isFinal
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
                      }`}
                    >
                      {isFinal ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      )}
                      {isFinal ? 'حكم نهائي' : 'حكم ابتدائي'}
                    </span>
                  </div>

                  {/* Structured Details List */}
                  <div className="space-y-2.5 text-xs">
                    {/* Court */}
                    {rec.court && (
                      <div className="flex items-center gap-2 text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/30">
                        <Scale className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span className="font-semibold text-foreground shrink-0">المحكمة المختصة:</span>
                        <span className="font-medium text-foreground truncate">{rec.court}</span>
                      </div>
                    )}

                    {/* Parties (Plaintiff & Defendant) */}
                    {(rec.plaintiff || rec.defendant) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex items-center gap-1.5 bg-background p-2 rounded-lg border border-border/50">
                          <User className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-[11px] font-semibold text-muted-foreground shrink-0">المدعي:</span>
                          <span className="font-medium text-foreground truncate">{rec.plaintiff || '—'}</span>
                        </div>

                        <div className="flex items-center gap-1.5 bg-background p-2 rounded-lg border border-border/50">
                          <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-[11px] font-semibold text-muted-foreground shrink-0">المدعى عليه:</span>
                          <span className="font-medium text-foreground truncate">{rec.defendant || '—'}</span>
                        </div>
                      </div>
                    )}

                    {/* Assigned Lawyer */}
                    {rec.assignedLawyer && (
                      <div className="flex items-center gap-2 text-muted-foreground bg-background p-2 rounded-lg border border-border/50">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-semibold text-foreground shrink-0">المحامي المكلف:</span>
                        <span className="font-medium text-foreground truncate">{rec.assignedLawyer}</span>
                      </div>
                    )}

                    {/* Judgment Date & Day */}
                    {rec.judgmentDate && (
                      <div className="flex items-center justify-between gap-2 text-muted-foreground bg-background p-2 rounded-lg border border-border/50">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="font-semibold text-foreground">تاريخ الحكم:</span>
                          <span className="font-mono text-foreground dir-ltr font-bold">{rec.judgmentDate}</span>
                        </div>
                        {dayName && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium text-[11px] border border-emerald-500/20">
                            {dayName}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Summary Box */}
                  {rec.summary && (
                    <div className="mt-3 bg-muted/40 p-3 rounded-xl border border-border/60 text-xs text-muted-foreground leading-relaxed">
                      <span className="font-bold text-foreground block mb-1 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        ملخص الحكم:
                      </span>
                      <p className="text-foreground/90 whitespace-pre-wrap">{rec.summary}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border/40">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(rec)}
                    className="h-8 gap-1.5 text-xs text-foreground border-border hover:bg-muted"
                    data-testid={`button-edit-judgment-${rec.id}`}
                  >
                    <Edit3 className="w-3.5 h-3.5 text-primary" />
                    تعديل
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget(rec)}
                    className="h-8 gap-1.5 text-xs text-destructive border-destructive/20 hover:bg-destructive/10 hover:border-destructive/30"
                    data-testid={`button-delete-judgment-${rec.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    حذف
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center fade-in-up">
          <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
            <Gavel className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">لا توجد أحكام مسجلة</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
            {searchQuery || filterResult !== 'all'
              ? 'لا توجد أحكام مطابقة لمعايير البحث والتصفية.'
              : 'قم بإضافة الأحكام والقرارات القضائية لمتابعتها هنا.'}
          </p>
          <Button onClick={handleOpenCreate} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4" />
            إضافة حكم جديد
          </Button>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/10 flex items-center justify-center">
                <Gavel className="w-4 h-4 text-emerald-600" />
              </div>
              {editingRecord ? 'تعديل بيانات الحكم' : 'إضافة حكم قضائي جديد'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            {formError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-start gap-2"
                data-testid="judgment-form-error"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 font-medium">{formError}</div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="caseNumber" className="text-xs font-semibold">
                  رقم القضية <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="caseNumber"
                  value={caseNumber}
                  onChange={(e) => {
                    setCaseNumber(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="مثال: 44109283"
                  className="font-mono text-sm"
                  dir="ltr"
                  required
                  disabled={isSaving}
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('يرجى تعبئة هذا الحقل')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="judgmentNumber" className="text-xs font-semibold">
                  رقم الصك <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="judgmentNumber"
                  value={judgmentNumber}
                  onChange={(e) => {
                    setJudgmentNumber(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  placeholder="مثال: 443012948"
                  className="font-mono text-sm"
                  dir="ltr"
                  required
                  disabled={isSaving}
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('يرجى تعبئة هذا الحقل')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="court" className="text-xs font-semibold">
                  المحكمة المختصة
                </Label>
                <Input
                  id="court"
                  value={court}
                  onChange={(e) => setCourt(e.target.value)}
                  placeholder="مثال: المحكمة العامة بالرياض"
                  className="text-sm"
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="assignedLawyer" className="text-xs font-semibold">
                  المحامي المكلف
                </Label>
                <Input
                  id="assignedLawyer"
                  value={assignedLawyer}
                  onChange={(e) => setAssignedLawyer(e.target.value)}
                  placeholder="اسم المحامي المتابع"
                  className="text-sm"
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="plaintiff" className="text-xs font-semibold">
                  المدعي
                </Label>
                <Input
                  id="plaintiff"
                  value={plaintiff}
                  onChange={(e) => setPlaintiff(e.target.value)}
                  placeholder="اسم المدعي"
                  className="text-sm"
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="defendant" className="text-xs font-semibold">
                  المدعى عليه
                </Label>
                <Input
                  id="defendant"
                  value={defendant}
                  onChange={(e) => setDefendant(e.target.value)}
                  placeholder="اسم المدعى عليه"
                  className="text-sm"
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="judgmentDate" className="text-xs font-semibold">
                  تاريخ الحكم (هجري/ميلادي)
                </Label>
                <Input
                  id="judgmentDate"
                  value={judgmentDate}
                  onChange={(e) => setJudgmentDate(e.target.value)}
                  placeholder="مثال: 1447/08/10"
                  className="font-mono text-sm"
                  dir="ltr"
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  الحكم
                </Label>
                <Select
                  value={isFavorable}
                  onValueChange={(val) => setIsFavorable(val as 'نهائي' | 'ابتدائي')}
                  disabled={isSaving}
                >
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="اختر نوع الحكم" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="نهائي">نهائي</SelectItem>
                    <SelectItem value="ابتدائي">ابتدائي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="summary" className="text-xs font-semibold">
                ملخص الحكم
              </Label>
              <Textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="منطوق الحكم والتفاصيل الأساسية للقرار..."
                className="text-sm min-h-[90px] resize-none"
                disabled={isSaving}
              />
            </div>

            <DialogFooter className="gap-2 flex-row-reverse pt-2">
              <Button
                type="submit"
                disabled={isSaving}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
                data-testid="button-save-judgment"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSaving ? 'جارٍ حفظ الحكم...' : editingRecord ? 'تحديث الحكم' : 'حفظ الحكم'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={isSaving}
              >
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الحكم</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف سجل الحكم رقم{' '}
              <span className="font-mono font-semibold text-foreground">{deleteTarget?.judgmentNumber}</span>؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 flex-row-reverse">
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              data-testid="button-confirm-delete-judgment"
            >
              تأكيد الحذف
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
