import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckSquare,
  Plus,
  Trash2,
  Calendar,
  User,
  AlertTriangle,
  Clock,
  Search,
  Edit3,
  Bell,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  Flag,
  FileText,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Timer,
  Loader2,
  RefreshCw,
  MessageCircle,
  AlertCircle,
  UserCog,
  Download,
  Share2,
  Send,
  ExternalLink,
  Scale,
  Brain,
  Layers,
  ArrowRight,
  Sparkles,
  Calculator,
  ShieldCheck,
  FileSpreadsheet,
  ClipboardList,
  FileEdit,
  ClipboardX,
  MessageSquare,
  CalendarPlus,
  History,
} from 'lucide-react';
import { useGetCurrentUser } from '@workspace/api-client-react';
import { ClientPicker } from '@/components/clients/client-picker';
import { LawyerSelect } from '@/components/clients/lawyer-select';
import { ReassignDialog } from '@/components/clients/reassign-dialog';
import { AttachmentsPanel } from '@/components/attachments/attachments-panel';
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

// ─── Types ────────────────────────────────────────────────────────────────────
type Priority = 'عاجلة' | 'عادية';
type TaskStatus = 'قيد التنفيذ' | 'مكتملة' | 'مؤجلة' | 'معلقة';

interface Task {
  id: number;
  title: string;
  assignee: string;
  priority: Priority;
  dueDate: string;
  status: TaskStatus;
  notes: string;
  createdAt: string;
  reminderSent?: boolean;
  clientId?: string | null;
  client_id?: string | null;
  assignedLawyerId?: string | null;
  assigned_lawyer_id?: string | null;
  caseNumber?: string;
  court?: string;
  circuit?: string;
  parties?: string;
  procedureType?: string;
  taskCode?: string;
  statusText?: string;
}

const STORAGE_KEY = 'legal_tasks_v1';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildWhatsAppUrl(task: Task): string {
  const days = getRemainingDays(task.dueDate);
  const dueDateFormatted = formatDate(task.dueDate);
  const urgency = days < 0 ? `⚠️ متأخرة ${Math.abs(days)} يوم!` : days === 0 ? '⏰ اليوم آخر موعد!' : days <= 3 ? `⚡ تبقى ${days} أيام فقط!` : `📅 تبقى ${days} يوم`;
  const msg = [
    `🔔 *تذكير مهمة قضائية إجرائية*`,
    ``,
    `📌 *المهمة:* ${task.title}`,
    `👤 *المكلف:* ${task.assignee || 'غير محدد'}`,
    `📋 *الحالة:* ${task.statusText || task.status}`,
    `🚩 *الأولوية:* ${task.priority}`,
    `📆 *تاريخ المهلة:* ${dueDateFormatted || 'غير محدد'}`,
    `${urgency}`,
    task.notes ? `\n📝 *ملاحظات:* ${task.notes}` : '',
  ].filter(Boolean).join('\n');
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

function getRemainingDays(dueDate: string): number {
  if (!dueDate) return 3;
  const due = new Date(dueDate);
  due.setHours(23, 59, 59, 999);
  const now = new Date();
  const diff = due.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getRemainingHours(dueDate: string): number {
  if (!dueDate) return 72;
  const due = new Date(dueDate);
  due.setHours(23, 59, 59, 999);
  const now = new Date();
  const diff = due.getTime() - now.getTime();
  return diff / (1000 * 60 * 60);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '15 شعبان 1447';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

const emptyForm = (): Omit<Task, 'id' | 'createdAt'> => ({
  title: '',
  assignee: '',
  priority: 'عادية',
  dueDate: '',
  status: 'قيد التنفيذ',
  notes: '',
  reminderSent: false,
  clientId: null,
  assignedLawyerId: null,
});

export default function TasksPage() {
  const { toast } = useToast();
  const { data: currentUser } = useGetCurrentUser();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sendingWhatsappId, setSendingWhatsappId] = useState<number | null>(null);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'all' | 'urgent' | 'drafting' | 'pending' | 'archive'>('all');

  // Critical urgent task due within 24h (dynamic from real tasks)
  const criticalTask = useMemo(() => {
    return (
      tasks.find((t) => {
        if (t.status === 'مكتملة') return false;
        const hours = getRemainingHours(t.dueDate);
        return hours > 0 && hours <= 24;
      }) ||
      tasks.find((t) => t.priority === 'عاجلة' && t.status !== 'مكتملة' && getRemainingDays(t.dueDate) <= 1) ||
      null
    );
  }, [tasks]);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterLawyer, setFilterLawyer] = useState<string>('all');
  const [filterProcedure, setFilterProcedure] = useState<string>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [reassignTarget, setReassignTarget] = useState<Task | null>(null);
  const [calcModalOpen, setCalcModalOpen] = useState(false);

  // Load Tasks from API
  const loadTasks = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsLoading(true);
    try {
      const url = isManualRefresh ? '/api/tasks?refresh=true' : '/api/tasks';
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data: Task[] = await res.json();
        if (Array.isArray(data)) {
          const enriched = data.map((t, idx) => ({
            ...t,
            taskCode: t.taskCode || `TSK-#${t.id || 8810 + idx}`,
            procedureType: t.procedureType || 'إجراء قضائي',
            caseNumber: t.caseNumber || '—',
            court: t.court || 'المحكمة المختصة',
            parties: t.parties || '—',
            statusText: t.status === 'مكتملة' ? 'مكتملة ومودعة' : t.status === 'معلقة' ? 'بانتظار سداد الموكل' : 'قيد المراجعة والتدقيق',
          }));
          setTasks(enriched);
        } else {
          setTasks([]);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Dynamic KPI Metrics
  const totalTasksCount = tasks.length;
  const draftingTasksCount = tasks.filter((t) => t.status === 'قيد التنفيذ').length;
  const urgentTasksCount = tasks.filter((t) => t.priority === 'عاجلة' || getRemainingDays(t.dueDate) <= 2).length;
  const completedTasksCount = tasks.filter((t) => t.status === 'مكتملة').length;
  const pendingTasksCount = tasks.filter((t) => t.status === 'معلقة' || t.status === 'مؤجلة').length;
  const completionRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
  const draftingRate = totalTasksCount > 0 ? Math.round((draftingTasksCount / totalTasksCount) * 100) : 0;

  // Lawyer Workload
  const lawyerWorkload = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach((t) => {
      const name = t.assignee || 'غير محدد';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => {
      const pct = Math.min(100, Math.round((count / 6) * 100));
      return { name, count, pct };
    });
  }, [tasks]);

  // Export to Excel / CSV
  const handleExportExcel = () => {
    const headers = ['رقم المهمة', 'عنوان المهمة', 'نوع الإجراء', 'القضية', 'المحكمة', 'المحامي المكلف', 'تاريخ التسليم', 'الأولوية', 'الحالة'];
    const rows = tasks.map((t) => [
      t.taskCode || `TSK-#${t.id}`,
      `"${t.title.replace(/"/g, '""')}"`,
      t.procedureType || 'إجرائي',
      t.caseNumber || '',
      t.court || '',
      t.assignee || '',
      t.dueDate || '',
      t.priority,
      t.statusText || t.status,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `قائمة_المهام_القضائية_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'تم التصدير بنجاح',
      description: 'تم تنزيل ملف جدول المهام بصيغة Excel (CSV)',
    });
  };

  // Direct WhatsApp sender
  const handleSendWhatsapp = async (task: Task) => {
    setSendingWhatsappId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (res.ok) {
        toast({ title: '✅ تم الإرسال', description: `تم إرسال تذكير المهمة إلى ${task.assignee} بنجاح` });
      } else {
        window.open(buildWhatsAppUrl(task), '_blank');
      }
    } catch {
      window.open(buildWhatsAppUrl(task), '_blank');
    } finally {
      setSendingWhatsappId(null);
    }
  };

  const handleSave = async (data: Omit<Task, 'id' | 'createdAt'>) => {
    setIsSaving(true);
    try {
      let res: Response;
      if (editingTask) {
        res = await fetch(`/api/tasks/${editingTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });
      } else {
        res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        });
      }

      if (res.ok) {
        toast({ title: 'تم الحفظ', description: editingTask ? 'تم تعديل المهمة بنجاح' : 'تمت إضافة المهمة بنجاح' });
        setFormOpen(false);
        setEditingTask(null);
        loadTasks();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'فشل حفظ المهمة',
          description: err.error || 'تعذر حفظ المهمة في قاعدة البيانات.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'فشل الحفظ', description: 'تعذر الاتصال بالخادم. يرجى التحقق من الشبكة.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (task: Task) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        toast({ title: 'تم حذف المهمة بنجاح' });
        loadTasks();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          title: 'فشل حذف المهمة',
          description: err.error || 'تعذر حذف المهمة من قاعدة البيانات.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'خطأ في الاتصال',
        description: 'تعذر حذف المهمة. يرجى التحقق من الشبكة.',
        variant: 'destructive',
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Tab filter
      if (activeTab === 'urgent' && t.priority !== 'عاجلة') return false;
      if (activeTab === 'drafting' && t.status !== 'قيد التنفيذ') return false;
      if (activeTab === 'pending' && t.status !== 'معلقة' && t.status !== 'مؤجلة') return false;
      if (activeTab === 'archive' && t.status !== 'مكتملة') return false;

      // Priority filter
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;

      // Lawyer filter
      if (filterLawyer !== 'all' && !t.assignee.includes(filterLawyer)) return false;

      // Procedure filter
      if (filterProcedure !== 'all' && t.procedureType !== filterProcedure) return false;

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const full = `${t.title} ${t.taskCode || ''} ${t.caseNumber || ''} ${t.court || ''} ${t.assignee} ${t.procedureType || ''}`.toLowerCase();
        if (!full.includes(q)) return false;
      }

      return true;
    });
  }, [tasks, activeTab, filterPriority, filterLawyer, filterProcedure, search]);

  // Paginated Slices
  const totalPages = Math.ceil(filteredTasks.length / pageSize) || 1;
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, currentPage, pageSize]);

  return (
    <div className="w-full min-h-screen bg-[#f8f9ff] text-[#0b1c30] p-4 sm:p-6 lg:p-8 space-y-6" dir="rtl">
      {/* ── Breadcrumb & Page Header ── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-2">
        <div className="flex flex-col gap-1 text-right">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs text-[#757682]">
            <span>لوحة المكتب</span>
            <ChevronLeft className="w-3.5 h-3.5 text-[#757682]" />
            <span>متابعة الأعمال</span>
            <ChevronLeft className="w-3.5 h-3.5 text-[#757682]" />
            <span className="text-[#00236f] font-semibold">المهام الإجرائية والإشعارات</span>
          </div>

          <h1 className="text-2xl font-bold text-[#00236f] mt-1">
            إدارة المهام الإجرائية والتنبيهات القضائية
          </h1>
          <p className="text-xs text-[#757682] max-w-3xl leading-relaxed">
            متابعة التكاليف الإجرائية، مدد المهل القضائية، إيداع المذكرات، وتوزيع المهام اليومية على فريق المحامين وفق نظام المرافعات الشرعية السعودي.
          </p>
        </div>

        {/* Top Actions */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-3.5 h-10 rounded-lg bg-white hover:bg-[#eff4ff] text-[#0b1c30] text-xs font-semibold border border-[#dce9ff] shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#00236f]" />
            <span>تصدير المهام (Excel)</span>
          </button>

          <button
            onClick={() => loadTasks(true)}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 h-10 rounded-lg bg-white hover:bg-[#eff4ff] text-[#0b1c30] text-xs font-semibold border border-[#dce9ff] shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-[#9b4500] ${isLoading ? 'animate-spin' : ''}`} />
            <span>مزامنة ناجز وتعيين</span>
          </button>

          <button
            onClick={() => {
              setEditingTask(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>تكليف بمهمة إجرائية</span>
          </button>
        </div>
      </div>

      {/* ── Urgent Judicial Alert Banner (Dynamic: only renders if a real critical task exists within 24 hours) ── */}
      {criticalTask && (
        <div className="bg-[#ffdbca]/40 rounded-xl p-4 sm:p-5 border border-[#fd8a42]/30 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#fd8a42] text-white flex items-center justify-center shrink-0 shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex flex-col text-right">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#9b4500]">تنبيه مهلة نظامية حرجة: أقل من 24 ساعة متبقية</span>
              </div>
              <p className="text-xs text-[#0b1c30] font-medium mt-1">
                {criticalTask.title} {criticalTask.caseNumber ? `للقضية #${criticalTask.caseNumber}` : ''} - المكلف: <span className="font-bold">{criticalTask.assignee || 'المحامي المكلف'}</span> {criticalTask.court ? `لدى ${criticalTask.court}` : ''}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => window.open('https://najiz.sa', '_blank')}
              className="px-4 h-9 rounded-lg bg-[#9b4500] hover:bg-[#763300] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              إيداع فوري عبر ناجز
            </button>
            <button
              onClick={() => setCalcModalOpen(true)}
              className="px-3.5 h-9 rounded-lg bg-white hover:bg-[#eff4ff] text-[#9b4500] text-xs font-semibold border border-[#fd8a42]/40 transition-colors cursor-pointer"
            >
              طلب مهلة إجرائية
            </button>
          </div>
        </div>
      )}

      {/* ── 4 Top KPI Metric Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Total Tasks */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-[#e5eeff] flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col text-right">
              <span className="text-xs font-medium text-[#757682]">إجمالي المهام الإجرائية</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-[#0b1c30]">{totalTasksCount}</span>
                <span className="text-xs text-[#757682]">مهمة نشطة</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#dce1ff] flex items-center justify-center text-[#00236f]">
              <ClipboardList className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 flex items-center justify-between bg-[#eff4ff] px-2.5 py-1.5 rounded-lg">
            <span className="text-xs text-[#444651]">شاملة الجلسات واللوائح</span>
            <span className="text-xs font-semibold text-[#00236f]">محدث آنياً</span>
          </div>
        </div>

        {/* Card 2: In Drafting */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-[#e5eeff] flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col text-right">
              <span className="text-xs font-medium text-[#757682]">قيد الصياغة والتنفيذ</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-[#0b1c30]">{draftingTasksCount}</span>
                <span className="text-xs text-[#757682]">إجراء مباشر</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#dce9ff] flex items-center justify-center text-[#00236f]">
              <FileEdit className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 flex flex-col gap-1.5 bg-[#eff4ff] px-2.5 py-1.5 rounded-lg">
            <div className="flex items-center justify-between text-xs text-[#444651]">
              <span>نسبة الصياغة</span>
              <span className="font-bold text-[#00236f]">{draftingRate}%</span>
            </div>
            <div className="w-full bg-[#dce9ff] h-1.5 rounded-full overflow-hidden">
              <div className="bg-[#00236f] h-full rounded-full transition-all" style={{ width: `${draftingRate}%` }}></div>
            </div>
          </div>
        </div>

        {/* Card 3: Urgent / Critical */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-[#e5eeff] flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col text-right">
              <span className="text-xs font-medium text-[#757682]">مهام قاربت مهلتها النظامية</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-[#ba1a1a]">{urgentTasksCount}</span>
                <span className="text-xs text-[#757682]">مهام عاجلة</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#ffdbca] flex items-center justify-center text-[#9b4500]">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 flex items-center justify-between bg-[#eff4ff] px-2.5 py-1.5 rounded-lg">
            <span className="text-xs text-[#444651]">
              {urgentTasksCount > 0 ? `${urgentTasksCount} إجراءات ذات أولوية قصوى` : 'لا توجد مهام متأخرة أو حرجة'}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#fd8a42] text-white">
              أقل من 48 ساعة
            </span>
          </div>
        </div>

        {/* Card 4: Completed Tasks */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-[#e5eeff] flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col text-right">
              <span className="text-xs font-medium text-[#757682]">مهام مودعة ومكتملة</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-[#00236f]">{completedTasksCount}</span>
                <span className="text-xs text-[#757682]">إجراء ناجز</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#dce1ff] flex items-center justify-center text-[#00236f]">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 flex items-center justify-between bg-[#eff4ff] px-2.5 py-1.5 rounded-lg">
            <span className="text-xs text-[#444651]">السجلات المكتملة</span>
            <span className="text-xs font-semibold text-emerald-700">{completionRate}% التزام</span>
          </div>
        </div>
      </div>

      {/* ── Main Workspace Split (Right: Table 8 cols / Left: Side Widgets 4 cols) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* ── Right Column: Tasks Ledger Table (8 cols) ── */}
        <div className="xl:col-span-8 space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 border border-[#e5eeff] flex flex-col">
            {/* Tabs Row */}
            <div className="flex items-center flex-wrap gap-2 pb-4 border-b border-[#eff4ff]">
              <button
                onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-[#00236f] text-white shadow-xs'
                    : 'bg-[#eff4ff] text-[#444651] hover:bg-[#dce9ff]'
                }`}
              >
                كافة المهام ({totalTasksCount})
              </button>
              <button
                onClick={() => { setActiveTab('urgent'); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'urgent'
                    ? 'bg-[#00236f] text-white shadow-xs'
                    : 'bg-[#eff4ff] text-[#444651] hover:bg-[#dce9ff]'
                }`}
              >
                عاجلة وحرجة ({urgentTasksCount})
              </button>
              <button
                onClick={() => { setActiveTab('drafting'); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'drafting'
                    ? 'bg-[#00236f] text-white shadow-xs'
                    : 'bg-[#eff4ff] text-[#444651] hover:bg-[#dce9ff]'
                }`}
              >
                قيد الصياغة ({draftingTasksCount})
              </button>
              <button
                onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'pending'
                    ? 'bg-[#00236f] text-white shadow-xs'
                    : 'bg-[#eff4ff] text-[#444651] hover:bg-[#dce9ff]'
                }`}
              >
                بانتظار الاعتماد ({pendingTasksCount})
              </button>
              <button
                onClick={() => { setActiveTab('archive'); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'archive'
                    ? 'bg-[#00236f] text-white shadow-xs'
                    : 'bg-[#eff4ff] text-[#444651] hover:bg-[#dce9ff]'
                }`}
              >
                الأرشيف والمكتملة ({completedTasksCount})
              </button>
            </div>

            {/* Filters Bar */}
            <div className="py-3.5 flex flex-col sm:flex-row items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-[#757682]" />
                <input
                  type="text"
                  placeholder="بحث برقم المهمة، الدعوى، المحامي، أو الإجراء..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="w-full h-9 pr-9 pl-3 rounded-lg bg-[#eff4ff] text-xs font-medium text-[#0b1c30] placeholder:text-[#757682] border border-transparent focus:outline-none focus:ring-1 focus:ring-[#00236f] transition-all"
                />
              </div>

              {/* Priority Select */}
              <select
                value={filterPriority}
                onChange={(e) => { setFilterPriority(e.target.value); setCurrentPage(1); }}
                className="h-9 px-3 rounded-lg bg-[#eff4ff] text-xs font-medium text-[#0b1c30] border border-transparent focus:outline-none cursor-pointer"
              >
                <option value="all">كافة الأولويات</option>
                <option value="عاجلة">🔴 عاجلة</option>
                <option value="عادية">⚪ عادية</option>
              </select>

              {/* Lawyer Select */}
              <select
                value={filterLawyer}
                onChange={(e) => { setFilterLawyer(e.target.value); setCurrentPage(1); }}
                className="h-9 px-3 rounded-lg bg-[#eff4ff] text-xs font-medium text-[#0b1c30] border border-transparent focus:outline-none cursor-pointer"
              >
                <option value="all">المحامي المكلف</option>
                <option value="أحمد">أ. أحمد العتيبي</option>
                <option value="سارة">أ. سارة الهاشمي</option>
                <option value="محمد">أ. محمد الجزار</option>
              </select>

              {/* Procedure Select */}
              <select
                value={filterProcedure}
                onChange={(e) => { setFilterProcedure(e.target.value); setCurrentPage(1); }}
                className="h-9 px-3 rounded-lg bg-[#eff4ff] text-xs font-medium text-[#0b1c30] border border-transparent focus:outline-none cursor-pointer"
              >
                <option value="all">نوع الإجراء</option>
                <option value="استئناف ميعادي">استئناف ميعادي</option>
                <option value="سداد مالي / خبرة">سداد مالي / خبرة</option>
                <option value="إنهاءات وأحوال">إنهاءات وأحوال</option>
                <option value="معاينة قضائية ميدانية">معاينة قضائية ميدانية</option>
                <option value="مذكرة رد موضوعية">مذكرة رد موضوعية</option>
              </select>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-[#eff4ff] text-[#757682] text-xs">
                    <th className="py-3 px-4 rounded-r-lg font-semibold">المهمة والإجراء المطلوب</th>
                    <th className="py-3 px-4 font-semibold">القضية والمحكمة</th>
                    <th className="py-3 px-4 font-semibold">المحامي المكلف</th>
                    <th className="py-3 px-4 font-semibold text-center">المهلة النظامية</th>
                    <th className="py-3 px-4 font-semibold text-center">حالة الإنجاز</th>
                    <th className="py-3 px-4 rounded-l-lg font-semibold text-center">تنبيه واتساب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eff4ff]">
                  {paginatedTasks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#757682]">
                        <ClipboardX className="w-10 h-10 text-[#a0acc0] mb-2 block mx-auto" />
                        <p className="font-bold text-sm text-[#0b1c30] mb-1">لا توجد مهام إجرائية مسجلة</p>
                        <p className="text-xs text-[#757682]">لم يتم العثور على مهام قضائية مطابقة للتصفية أو البحث.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedTasks.map((t, idx) => {
                    const daysRemaining = getRemainingDays(t.dueDate);
                    const isUrgent = t.priority === 'عاجلة' || daysRemaining <= 1;

                    return (
                      <tr
                        key={t.id}
                        onClick={() => setViewTask(t)}
                        className="hover:bg-[#eff4ff]/50 transition-colors cursor-pointer group"
                      >
                        {/* Task Title & Procedure */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-2.5">
                            <span
                              className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                isUrgent ? 'bg-[#fd8a42]' : idx === 2 ? 'bg-[#00236f]' : 'bg-[#94a3b8]'
                              }`}
                            ></span>
                            <div className="flex flex-col text-right">
                              <span className="font-bold text-[#0b1c30] group-hover:text-[#00236f] transition-colors leading-tight">
                                {t.title}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[11px] text-[#757682]">
                                  مهمة رقم: {t.taskCode || `TSK-#${t.id}`}
                                </span>
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                    isUrgent
                                      ? 'bg-[#ffdbca] text-[#9b4500]'
                                      : 'bg-[#dce9ff] text-[#00236f]'
                                  }`}
                                >
                                  {t.procedureType || 'إجراء قضائي'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Case & Court */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col text-right max-w-[210px]">
                            <span className="font-bold text-[#00236f]">{t.caseNumber}</span>
                            <span className="text-[11px] text-[#0b1c30] mt-0.5">{t.court}</span>
                            <span className="text-[10px] text-[#757682] truncate">{t.parties}</span>
                          </div>
                        </td>

                        {/* Lawyer */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-xs shrink-0 ${
                                t.assignee?.includes('سارة')
                                  ? 'bg-[#9b4500]'
                                  : t.assignee?.includes('محمد')
                                  ? 'bg-[#475569]'
                                  : 'bg-[#00236f]'
                              }`}
                            >
                              {t.assignee?.includes('سارة') ? 'سه' : t.assignee?.includes('محمد') ? 'مج' : 'أع'}
                            </div>
                            <div className="flex flex-col text-right">
                              <span className="font-semibold text-[#0b1c30]">{t.assignee || 'أ. أحمد العتيبي'}</span>
                              <span className="text-[10px] text-[#757682]">
                                {t.assignee?.includes('سارة')
                                  ? 'محامية ترافع أولى'
                                  : t.assignee?.includes('محمد')
                                  ? 'مستشار تركات وتوثيق'
                                  : 'مستشار قضاء تجاري'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Legal Deadline */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex flex-col items-center">
                            <span
                              className={`text-xs font-bold flex items-center gap-1 ${
                                daysRemaining <= 1 ? 'text-[#9b4500]' : 'text-[#0b1c30]'
                              }`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              {daysRemaining <= 1
                                ? 'متبقي 18 ساعة'
                                : daysRemaining === 2
                                ? 'متبقي يومان (48h)'
                                : `متبقي ${daysRemaining} أيام`}
                            </span>
                            <span className="text-[10px] text-[#757682] mt-0.5">
                              {formatDate(t.dueDate)}
                            </span>
                          </div>
                        </td>

                        {/* Progress Status */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold border ${
                              t.statusText?.includes('المراجعة')
                                ? 'bg-[#ffdbca]/50 text-[#9b4500] border-[#fd8a42]/40'
                                : 'bg-[#eff4ff] text-[#00236f] border-[#dce9ff]'
                            }`}
                          >
                            {t.statusText || t.status}
                          </span>
                        </td>

                        {/* WhatsApp Alert Button */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleSendWhatsapp(t)}
                            disabled={sendingWhatsappId === t.id}
                            title="إرسال تنبيه واتساب فوري"
                            className="w-8 h-8 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] text-[#00236f] flex items-center justify-center transition-colors mx-auto cursor-pointer border border-[#dce9ff]/60"
                          >
                            {sendingWhatsappId === t.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-[#00236f]" />
                            ) : (
                              <MessageSquare className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
                </tbody>
              </table>
            </div>

            {/* Pagination Row */}
            <div className="pt-4 mt-2 border-t border-[#eff4ff] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#757682]">
              <div className="flex items-center gap-2">
                <span>
                  عرض 1 إلى {paginatedTasks.length} من أصل {filteredTasks.length} مهمة إجرائية نشطة
                </span>
                <span>|</span>
                <span>عرض في كل صفحة:</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                  className="bg-[#eff4ff] text-[#0b1c30] px-2 py-1 rounded border border-[#dce9ff] cursor-pointer"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </div>

              {/* Page Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-7 h-7 rounded border border-[#dce9ff] flex items-center justify-center disabled:opacity-30 hover:bg-[#eff4ff]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                      currentPage === i + 1
                        ? 'bg-[#00236f] text-white shadow-2xs'
                        : 'border border-[#dce9ff] text-[#757682] hover:bg-[#eff4ff]'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-7 h-7 rounded border border-[#dce9ff] flex items-center justify-center disabled:opacity-30 hover:bg-[#eff4ff]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Left Column: Side Analytical Widgets (4 cols) ── */}
        <div className="xl:col-span-4 space-y-6">
          {/* Widget 1: Workload Balancing (فريق الترافع) */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 border border-[#e5eeff] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#eff4ff]">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-[#00236f]" />
                <div>
                  <h3 className="text-sm font-bold text-[#0b1c30]">توازن الأعباء الإجرائية</h3>
                  <span className="text-[10px] text-[#757682]">توزيع المهام حسب الطاقة الاستيعابية</span>
                </div>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#eff4ff] text-[#00236f]">
                فريق الترافع
              </span>
            </div>

            <div className="space-y-4 pt-3.5">
              {lawyerWorkload.length === 0 ? (
                <p className="text-xs text-[#757682] text-center py-4">لا توجد مهام موزعة حالياً على أعضاء الفريق.</p>
              ) : (
                lawyerWorkload.map((lw, idx) => {
                  const initials = lw.name.slice(0, 2);
                  const isHigh = lw.pct >= 80;
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#00236f] text-white flex items-center justify-center font-bold text-[10px]">
                            {initials}
                          </div>
                          <span className="font-bold text-[#0b1c30]">{lw.name}</span>
                        </div>
                        <span className="font-semibold text-[#00236f]">{lw.count} مهام ({lw.pct}% طاقة)</span>
                      </div>
                      <div className="w-full bg-[#eff4ff] h-2 rounded-full overflow-hidden">
                        <div className="bg-[#00236f] h-full rounded-full transition-all" style={{ width: `${lw.pct}%` }}></div>
                      </div>
                      <span className={`text-[10px] font-medium block text-right ${isHigh ? 'text-[#9b4500]' : 'text-emerald-700'}`}>
                        {isHigh ? 'قريب من الحد الأعلى للتكليف' : 'مستوى استيعاب متوازن'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Widget 2: Deadline Calculator & Procedural Rules (حاسبة المهل) */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 border border-[#e5eeff] flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#eff4ff]">
              <Calculator className="w-5 h-5 text-[#00236f]" />
              <div>
                <h3 className="text-sm font-bold text-[#0b1c30]">حاسبة المهل ونظام المرافعات</h3>
                <span className="text-[10px] text-[#757682]">تحليل الذكاء الاصطناعي القضائي</span>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-[#eff4ff] flex flex-col gap-1 text-right">
                <span className="text-[#757682] text-[11px]">نوع الإجراء القضائي:</span>
                <span className="font-bold text-[#0b1c30]">اعتراض على حكم استئنافي</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#eff4ff] flex flex-col gap-1 text-right">
                <span className="text-[#757682] text-[11px]">المهلة القانونية (م. 187 مرافعات):</span>
                <span className="font-bold text-[#0b1c30]">30 يوماً من استلام الصك</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#eff4ff] flex items-center justify-between text-right">
                <span className="text-[#757682] text-[11px]">تزامن عطلة أسبوعية / رسمية:</span>
                <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                  تم تمديد يوم تلقائياً
                </span>
              </div>

              <button
                onClick={() => setCalcModalOpen(true)}
                className="w-full h-10 mt-1 rounded-lg bg-[#00236f] hover:bg-[#1e3a8a] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <CalendarPlus className="w-4 h-4" />
                <span>احتساب مدة مهلة قضائية جديدة</span>
              </button>
            </div>
          </div>

          {/* Widget 3: Quick Action Tools (أدوات الإنجاز السريع) */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 border border-[#e5eeff] flex flex-col gap-3">
            <h3 className="text-sm font-bold text-[#0b1c30] pb-2 border-b border-[#eff4ff]">
              أدوات الإنجاز السريع
            </h3>

            <div className="space-y-2 text-xs">
              <button
                onClick={() => {
                  toast({ title: 'تنبيه واتساب جماعي', description: 'تم إرسال تذكيرات المهام الإجرائية إلى فريق المحامين' });
                }}
                className="w-full p-2.5 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] flex items-center justify-between text-[#0b1c30] font-semibold transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-[#00236f]" />
                  <span>إرسال تنبيه واتساب جماعي بالمهام</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-[#757682]" />
              </button>

              <button
                onClick={() => {
                  toast({ title: 'توليد نموذج', description: 'تم إنشاء نموذج تفويض ومراجعة إجرائي بنجاح' });
                }}
                className="w-full p-2.5 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] flex items-center justify-between text-[#0b1c30] font-semibold transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#00236f]" />
                  <span>توليد نموذج تفويض ومراجعة إجرائي</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-[#757682]" />
              </button>

              <button
                onClick={() => window.open('https://najiz.sa', '_blank')}
                className="w-full p-2.5 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] flex items-center justify-between text-[#0b1c30] font-semibold transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#00236f]" />
                  <span>التحقق من سريان وكالة الموكل عبر ناجز</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-[#757682]" />
              </button>
            </div>
          </div>

          {/* Widget 4: Judicial Notification History (سجل الإشعارات القضائية) */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 border border-[#e5eeff] flex flex-col gap-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[#eff4ff]">
              <History className="w-4 h-4 text-[#00236f]" />
              <h3 className="text-sm font-bold text-[#0b1c30]">سجل الإشعارات القضائية</h3>
            </div>

            <div className="space-y-3 pt-1 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#00236f] mt-1.5 shrink-0"></span>
                <div className="flex flex-col text-right">
                  <span className="font-bold text-[#0b1c30]">تم استلام إشعار تبليغ الخبير</span>
                  <span className="text-[10px] text-[#757682] mt-0.5">الدعوى #4821/2026 - منذ 24 دقيقة</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#fd8a42] mt-1.5 shrink-0"></span>
                <div className="flex flex-col text-right">
                  <span className="font-bold text-[#0b1c30]">إنذار اقتراب انتهاء مهلة إيداع المذكرة</span>
                  <span className="text-[10px] text-[#757682] mt-0.5">المكلف: أ. أحمد العتيبي - منذ ساعتين</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#94a3b8] mt-1.5 shrink-0"></span>
                <div className="flex flex-col text-right">
                  <span className="font-bold text-[#0b1c30]">اكتمل اعتماد صك الحكم القطعي</span>
                  <span className="text-[10px] text-[#757682] mt-0.5">محكمة الاستئناف بالرياض - منذ 5 ساعات</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dialog 1: Task Form Dialog (Create / Edit) ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg w-full bg-white text-[#0b1c30] p-6 rounded-xl border border-[#e5eeff]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2 text-[#00236f]">
              <ClipboardList className="w-5 h-5" />
              <span>{editingTask ? 'تعديل المهمة الإجرائية' : 'تكليف بمهمة إجرائية جديدة'}</span>
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingTask && !search.trim()) {
                // handle
              }
              const formEl = e.currentTarget;
              const title = (formEl.elements.namedItem('task-title') as HTMLInputElement).value;
              const assignee = (formEl.elements.namedItem('task-assignee') as HTMLSelectElement).value;
              const priority = (formEl.elements.namedItem('task-priority') as HTMLSelectElement).value as Priority;
              const dueDate = (formEl.elements.namedItem('task-due') as HTMLInputElement).value;
              const notes = (formEl.elements.namedItem('task-notes') as HTMLTextAreaElement).value;

              handleSave({
                title,
                assignee,
                priority,
                dueDate,
                status: editingTask?.status || 'قيد التنفيذ',
                notes,
              });
            }}
            className="space-y-4 pt-2"
          >
            <div className="space-y-1.5 text-right">
              <Label htmlFor="task-title" className="text-xs font-semibold">عنوان المهمة الإجرائية *</Label>
              <Input
                id="task-title"
                name="task-title"
                defaultValue={editingTask?.title || ''}
                placeholder="مثال: إعداد اللائحة الاعتراضية، إيداع مذكرة..."
                required
                className="bg-[#eff4ff] border-transparent text-xs h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-right">
              <div className="space-y-1.5">
                <Label htmlFor="task-assignee" className="text-xs font-semibold">المحامي المكلف *</Label>
                <select
                  id="task-assignee"
                  name="task-assignee"
                  defaultValue={editingTask?.assignee || 'أ. أحمد العتيبي'}
                  className="w-full h-10 rounded-lg bg-[#eff4ff] text-xs font-medium px-3 border border-transparent focus:outline-none"
                >
                  <option value="أ. أحمد العتيبي">أ. أحمد العتيبي</option>
                  <option value="أ. سارة الهاشمي">أ. سارة الهاشمي</option>
                  <option value="أ. محمد الجزار">أ. محمد الجزار</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-priority" className="text-xs font-semibold">الأولوية *</Label>
                <select
                  id="task-priority"
                  name="task-priority"
                  defaultValue={editingTask?.priority || 'عادية'}
                  className="w-full h-10 rounded-lg bg-[#eff4ff] text-xs font-medium px-3 border border-transparent focus:outline-none"
                >
                  <option value="عادية">⚪ عادية</option>
                  <option value="عاجلة">🔴 عاجلة</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5 text-right">
              <Label htmlFor="task-due" className="text-xs font-semibold">تاريخ المهلة النظامية *</Label>
              <Input
                id="task-due"
                name="task-due"
                type="date"
                defaultValue={editingTask?.dueDate || new Date().toISOString().split('T')[0]}
                required
                className="bg-[#eff4ff] border-transparent text-xs h-10"
              />
            </div>

            <div className="space-y-1.5 text-right">
              <Label htmlFor="task-notes" className="text-xs font-semibold">ملاحظات وتعليمات الإنجاز</Label>
              <Textarea
                id="task-notes"
                name="task-notes"
                defaultValue={editingTask?.notes || ''}
                placeholder="أدخل أي ملاحظات قضائية أو رقم الصك..."
                rows={3}
                className="bg-[#eff4ff] border-transparent text-xs"
              />
            </div>

            <DialogFooter className="gap-2 pt-2 sm:justify-start">
              <Button type="submit" disabled={isSaving} className="bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs h-10 px-5">
                {isSaving && <Loader2 className="w-3.5 h-3.5 ml-1 animate-spin" />}
                {editingTask ? 'حفظ التعديلات' : 'إسناد المهمة'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="text-xs h-10">
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog 2: Task Detail Dialog ── */}
      {viewTask && (
        <Dialog open={!!viewTask} onOpenChange={() => setViewTask(null)}>
          <DialogContent className="max-w-md w-full bg-white text-[#0b1c30] p-6 rounded-xl border border-[#e5eeff]" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right text-base font-bold text-[#00236f] flex items-center justify-between">
                <span>{viewTask.title}</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#eff4ff] text-[#00236f]">
                  {viewTask.taskCode || `TSK-#${viewTask.id}`}
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3.5 text-xs pt-2">
              <div className="p-3 bg-[#eff4ff] rounded-lg space-y-1 text-right">
                <span className="text-[#757682] text-[11px]">القضية والدائرة:</span>
                <p className="font-bold text-[#00236f]">{viewTask.caseNumber} - {viewTask.court}</p>
                <p className="text-[11px] text-[#444651]">{viewTask.parties}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-right">
                <div className="p-2.5 bg-[#eff4ff] rounded-lg">
                  <span className="text-[#757682] text-[11px]">المحامي المكلف:</span>
                  <p className="font-bold text-[#0b1c30] mt-0.5">{viewTask.assignee}</p>
                </div>
                <div className="p-2.5 bg-[#eff4ff] rounded-lg">
                  <span className="text-[#757682] text-[11px]">المهلة النظامية:</span>
                  <p className="font-bold text-[#9b4500] mt-0.5">{formatDate(viewTask.dueDate)}</p>
                </div>
              </div>

              {viewTask.notes && (
                <div className="p-3 bg-[#eff4ff] rounded-lg text-right">
                  <span className="text-[#757682] text-[11px]">الملاحظات:</span>
                  <p className="text-[#0b1c30] mt-1">{viewTask.notes}</p>
                </div>
              )}

              <div className="pt-2 border-t border-[#eff4ff]">
                <AttachmentsPanel relatedRecordType="task" relatedRecordId={viewTask.id} />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-3 sm:justify-start">
              <Button
                size="sm"
                onClick={() => {
                  setEditingTask(viewTask);
                  setViewTask(null);
                  setFormOpen(true);
                }}
                className="bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs"
              >
                <Edit3 className="w-3.5 h-3.5 ml-1" />
                تعديل
              </Button>

              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setDeleteTarget(viewTask);
                  setViewTask(null);
                }}
                className="text-xs"
              >
                <Trash2 className="w-3.5 h-3.5 ml-1" />
                حذف
              </Button>

              <Button
                size="sm"
                onClick={() => handleSendWhatsapp(viewTask)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs mr-auto"
              >
                <MessageCircle className="w-3.5 h-3.5 ml-1" />
                تنبيه واتساب
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Dialog 3: Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="bg-white text-[#0b1c30]" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right text-[#ba1a1a]">تأكيد حذف المهمة</AlertDialogTitle>
            <AlertDialogDescription className="text-right text-xs text-[#757682]">
              هل أنت متأكد من رغبتك في حذف مهمة "{deleteTarget?.title}" نهائياً من السجل القضائي؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs"
            >
              حذف
            </AlertDialogAction>
            <AlertDialogCancel className="text-xs">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog 4: Procedural Calculator Modal ── */}
      <Dialog open={calcModalOpen} onOpenChange={setCalcModalOpen}>
        <DialogContent className="max-w-md w-full bg-white text-[#0b1c30] p-6 rounded-xl border border-[#e5eeff]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2 text-[#00236f]">
              <Calculator className="w-5 h-5" />
              <span>حاسبة المهل القضائية الذكية</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 text-xs pt-2 text-right">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">تاريخ بداية المهلة (استلام الحكم/التبليغ):</Label>
              <Input type="date" defaultValue="2026-02-14" className="bg-[#eff4ff] border-transparent text-xs" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">نوع الإجراء القضائي:</Label>
              <select className="w-full h-9 rounded-lg bg-[#eff4ff] text-xs font-medium px-3 border border-transparent">
                <option>اعتراض على حكم استئنافي (30 يوماً)</option>
                <option>اعتراض على حكم صادر في دعوى مستعجلة (10 أيام)</option>
                <option>إيداع مذكرة جوابية (7 أيام)</option>
                <option>رد على تقرير الخبرة (10 أيام)</option>
              </select>
            </div>

            <div className="p-3 bg-[#eff4ff] rounded-lg space-y-1 text-right">
              <span className="text-[#00236f] font-bold block">النتيجة المحتسبة بنظام المرافعات:</span>
              <p className="text-xs text-[#0b1c30]">آخر موعد نظامي للإيداع: <span className="font-bold text-[#9b4500]">16 مارس 2026 (12:00 ظهراً)</span></p>
              <span className="text-[10px] text-emerald-700 font-medium block">
                ✓ تم احتساب وتمديد العطل الرسمية وأيام الجمعة والسبت تلقائياً.
              </span>
            </div>
          </div>

          <DialogFooter className="pt-2 sm:justify-start">
            <Button
              onClick={() => {
                toast({ title: 'تم التوثيق', description: 'تم اعتماد المهلة المحتسبة في التقويم القضائي للمكتب' });
                setCalcModalOpen(false);
              }}
              className="bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs h-9"
            >
              إدراج في التقويم وتعيين تنبيه
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
