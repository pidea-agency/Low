import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { useGetCurrentUser } from '@workspace/api-client-react';
import { ClientPicker } from '@/components/clients/client-picker';
import { LawyerSelect } from '@/components/clients/lawyer-select';
import { ReassignDialog } from '@/components/clients/reassign-dialog';
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
}

const STORAGE_KEY = 'legal_tasks_v1';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildWhatsAppUrl(task: Task): string {
  const days = getRemainingDays(task.dueDate);
  const dueDateFormatted = formatDate(task.dueDate);
  const urgency = days < 0 ? `⚠️ متأخرة ${Math.abs(days)} يوم!` : days === 0 ? '⏰ اليوم آخر موعد!' : days <= 3 ? `⚡ تبقى ${days} أيام فقط!` : `📅 تبقى ${days} يوم`;
  const msg = [
    `🔔 *تذكير مهمة قانونية*`,
    ``,
    `📌 *المهمة:* ${task.title}`,
    `👤 *المكلف:* ${task.assignee || 'غير محدد'}`,
    `📋 *الحالة:* ${task.status}`,
    `🚩 *الأولوية:* ${task.priority}`,
    `📆 *تاريخ التسليم:* ${dueDateFormatted || 'غير محدد'}`,
    `${urgency}`,
    task.notes ? `\n📝 *ملاحظات:* ${task.notes}` : '',
  ].filter(Boolean).join('\n');
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

function getRemainingDays(dueDate: string): number {
  const due = new Date(dueDate);
  due.setHours(23, 59, 59, 999);
  const now = new Date();
  const diff = due.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getRemainingHours(dueDate: string): number {
  const due = new Date(dueDate);
  due.setHours(23, 59, 59, 999);
  const now = new Date();
  const diff = due.getTime() - now.getTime();
  return diff / (1000 * 60 * 60);
}

function classifyTask(task: Task): 'current' | 'upcoming' | 'past' {
  if (task.status === 'مكتملة') return 'past';
  const days = getRemainingDays(task.dueDate);
  if (days < 0) return 'past';
  if (days <= 7) return 'current';
  return 'upcoming';
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
}

type StatusKey = TaskStatus;

const statusConfig: Record<StatusKey, { color: string; bg: string; icon: React.FC<{ className?: string }> }> = {
  'قيد التنفيذ': { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', icon: Timer },
  'مكتملة': { color: '#22C55E', bg: 'rgba(34,197,94,0.12)', icon: CheckCircle2 },
  'مؤجلة': { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', icon: PauseCircle },
  'معلقة': { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', icon: XCircle },
};

const priorityConfig: Record<Priority, { color: string; bg: string }> = {
  'عاجلة': { color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  'عادية': { color: '#6B7280', bg: 'rgba(107,114,128,0.10)' },
};

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

// ─── RemainingBadge ───────────────────────────────────────────────────────────
function RemainingBadge({ dueDate, status }: { dueDate: string; status: TaskStatus }) {
  const days = getRemainingDays(dueDate);
  const hours = getRemainingHours(dueDate);

  if (status === 'مكتملة') {
    return <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}>مكتملة</span>;
  }
  if (days < 0) {
    return <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>متأخرة {Math.abs(days)} يوم</span>;
  }
  if (hours <= 24) {
    return <span className="text-xs px-2 py-0.5 rounded-full font-medium animate-pulse" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>أقل من 24 ساعة!</span>;
  }
  if (days === 0) {
    return <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>اليوم</span>;
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: days <= 3 ? 'rgba(245,158,11,0.12)' : 'rgba(107,114,128,0.10)', color: days <= 3 ? '#F59E0B' : '#9CA3AF' }}>
      {days} يوم متبقٍ
    </span>
  );
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────
interface TaskCardProps {
  task: Task;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onView: (t: Task) => void;
  onReminder: (t: Task) => void;
  onSendWhatsapp: (t: Task) => void;
  isSendingWhatsapp?: boolean;
  onReassign?: (t: Task) => void;
  isAdmin?: boolean;
}

function TaskCard({ task, onEdit, onDelete, onView, onReminder, onSendWhatsapp, isSendingWhatsapp, onReassign, isAdmin }: TaskCardProps) {
  const s = statusConfig[task.status];
  const p = priorityConfig[task.priority];
  const SIcon = s.icon;
  const h = getRemainingHours(task.dueDate);
  const canRemind = h > 0 && h <= 24 && task.status !== 'مكتملة';

  return (
    <div className="rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-md group" style={{ background: 'var(--card)', borderColor: 'var(--border)' }} onClick={() => onView(task)}>
      <div className="h-1 rounded-t-xl" style={{ background: task.priority === 'عاجلة' ? 'linear-gradient(90deg,#EF4444,#F97316)' : 'linear-gradient(90deg,#6B7280,#9CA3AF)' }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-semibold text-sm leading-snug text-foreground line-clamp-2 flex-1">{task.title}</h3>
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {canRemind && (
              <button title="إرسال تذكير" onClick={() => onReminder(task)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: '#F59E0B' }}>
                <Bell className="w-3.5 h-3.5" />
              </button>
            )}
            {/* WhatsApp Direct Gateway Reminder Button */}
            <button
              title="إرسال تذكير عبر الواتساب"
              disabled={isSendingWhatsapp}
              onClick={(e) => { e.stopPropagation(); onSendWhatsapp(task); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110 disabled:opacity-50"
              style={{ color: '#25D366' }}
            >
              {isSendingWhatsapp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
            </button>
            {isAdmin && onReassign && (
              <button title="إعادة تعيين المحامي" onClick={() => onReassign(task)} className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--primary)' }}>
                <UserCog className="w-3.5 h-3.5" />
              </button>
            )}
            <button title="تعديل" onClick={() => onEdit(task)} className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--muted-foreground)' }}>
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button title="حذف" onClick={() => onDelete(task)} className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#EF4444' }}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: p.bg, color: p.color }}><Flag className="w-3 h-3" />{task.priority}</span>
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.color }}><SIcon className="w-3 h-3" />{task.status}</span>
          <RemainingBadge dueDate={task.dueDate} status={task.status} />
        </div>
        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted-foreground)' }}>
          <span className="flex items-center gap-1"><User className="w-3 h-3" />{task.assignee || '—'}</span>
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(task.dueDate)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────
interface SectionProps { title: string; count: number; color: string; icon: React.FC<{ className?: string; style?: React.CSSProperties }>; children: React.ReactNode; defaultOpen?: boolean; }

function Section({ title, count, color, icon: Icon, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-6">
      <button className="flex items-center gap-2 mb-3 w-full text-right" onClick={() => setOpen(v => !v)}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}22` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <span className="font-bold text-sm text-foreground flex-1">{title}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${color}22`, color }}>{count}</span>
        {open ? <ChevronUp className="w-4 h-4" style={{ color }} /> : <ChevronDown className="w-4 h-4" style={{ color }} />}
      </button>
      {open && <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{children}</div>}
    </div>
  );
}

// ─── TaskFormDialog ───────────────────────────────────────────────────────────
interface TaskFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (d: Omit<Task, 'id' | 'createdAt'>) => void;
  initial?: Task | null;
  isSaving?: boolean;
  currentUser?: any;
}

function TaskFormDialog({ open, onClose, onSave, initial, isSaving, currentUser }: TaskFormDialogProps) {
  const [form, setForm] = useState(emptyForm());
  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              ...initial,
              clientId: initial.clientId || (initial as any).client_id || null,
              assignedLawyerId: initial.assignedLawyerId || (initial as any).assigned_lawyer_id || null,
            }
          : emptyForm()
      );
    }
  }, [open, initial]);
  const remainingDays = form.dueDate ? getRemainingDays(form.dueDate) : null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg w-full" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-primary" />
            {initial ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={e => { e.preventDefault(); if (!form.title.trim()) return; onSave(form); }} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tk-title">عنوان المهمة *</Label>
            <Input id="tk-title" placeholder="أدخل عنوان المهمة..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          </div>

          <div className="space-y-1.5">
            <ClientPicker
              value={form.clientId || null}
              onChange={(cid) => setForm((f) => ({ ...f, clientId: cid }))}
              label="العميل المرتبط"
            />
          </div>

          <div className="space-y-1.5">
            <LawyerSelect
              value={form.assignedLawyerId || null}
              onChange={(lid, lawyerName) =>
                setForm((f) => ({
                  ...f,
                  assignedLawyerId: lid,
                  assignee: lawyerName || f.assignee,
                }))
              }
              currentRole={currentUser?.role}
              currentUserId={currentUser?.id}
              currentUserName={(currentUser as any)?.displayName || currentUser?.username}
              label="المحامي المكلف"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>الأولوية</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as Priority }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="عاجلة">🔴 عاجلة</SelectItem>
                  <SelectItem value="عادية">⚪ عادية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as TaskStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="قيد التنفيذ">🔵 قيد التنفيذ</SelectItem>
                  <SelectItem value="مكتملة">🟢 مكتملة</SelectItem>
                  <SelectItem value="مؤجلة">🟡 مؤجلة</SelectItem>
                  <SelectItem value="معلقة">🔴 معلقة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tk-due">تاريخ التسليم</Label>
            <div className="flex items-center gap-2">
              <Input id="tk-due" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="flex-1" />
              {remainingDays !== null && (
                <span className="text-xs px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap shrink-0" style={{ background: remainingDays < 0 ? 'rgba(239,68,68,0.12)' : remainingDays <= 3 ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)', color: remainingDays < 0 ? '#EF4444' : remainingDays <= 3 ? '#F59E0B' : '#22C55E' }}>
                  {remainingDays < 0 ? `متأخر ${Math.abs(remainingDays)} يوم` : remainingDays === 0 ? 'اليوم' : `${remainingDays} يوم`}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tk-notes">ملاحظات</Label>
            <Textarea id="tk-notes" placeholder="أي ملاحظات إضافية..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
          </div>
          <DialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse">
            <Button type="submit" disabled={!form.title.trim() || isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
              {initial ? 'حفظ التعديلات' : 'إضافة المهمة'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>إلغاء</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── TaskDetailDialog ─────────────────────────────────────────────────────────
interface TaskDetailDialogProps {
  task: Task | null;
  onClose: () => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onReminder: (t: Task) => void;
  onSendWhatsapp: (t: Task) => void;
  isSendingWhatsapp?: boolean;
}

function TaskDetailDialog({ task, onClose, onEdit, onDelete, onReminder, onSendWhatsapp, isSendingWhatsapp }: TaskDetailDialogProps) {
  if (!task) return null;
  const s = statusConfig[task.status];
  const p = priorityConfig[task.priority];
  const SIcon = s.icon;
  const h = getRemainingHours(task.dueDate);
  const canRemind = h > 0 && h <= 24 && task.status !== 'مكتملة';
  const days = getRemainingDays(task.dueDate);

  return (
    <Dialog open={!!task} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md w-full" dir="rtl">
        <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-lg" style={{ background: task.priority === 'عاجلة' ? 'linear-gradient(90deg,#EF4444,#F97316)' : 'linear-gradient(90deg,#6B7280,#9CA3AF)' }} />
        <DialogHeader className="pt-2">
          <DialogTitle className="text-right text-base leading-snug">{task.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-1">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: p.bg, color: p.color }}><Flag className="w-3 h-3" />{task.priority}</span>
            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: s.bg, color: s.color }}><SIcon className="w-3 h-3" />{task.status}</span>
            <RemainingBadge dueDate={task.dueDate} status={task.status} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-3" style={{ background: 'var(--muted)' }}>
              <div className="flex items-center gap-1.5 mb-1 text-muted-foreground"><User className="w-3.5 h-3.5" /><span className="text-xs">المكلف</span></div>
              <p className="text-sm font-medium">{task.assignee || '—'}</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'var(--muted)' }}>
              <div className="flex items-center gap-1.5 mb-1 text-muted-foreground"><Calendar className="w-3.5 h-3.5" /><span className="text-xs">تاريخ التسليم</span></div>
              <p className="text-sm font-medium">{formatDate(task.dueDate) || '—'}</p>
            </div>
            <div className="rounded-lg p-3 col-span-2" style={{ background: 'var(--muted)' }}>
              <div className="flex items-center gap-1.5 mb-1 text-muted-foreground"><Clock className="w-3.5 h-3.5" /><span className="text-xs">الأيام المتبقية</span></div>
              <p className="text-sm font-medium">{task.dueDate ? (days < 0 ? `متأخرة ${Math.abs(days)} يوم` : days === 0 ? 'اليوم هو آخر يوم' : `${days} يوم متبقٍ`) : '—'}</p>
            </div>
          </div>
          {task.notes && (
            <div className="rounded-lg p-3" style={{ background: 'var(--muted)' }}>
              <div className="flex items-center gap-1.5 mb-1 text-muted-foreground"><FileText className="w-3.5 h-3.5" /><span className="text-xs">ملاحظات</span></div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{task.notes}</p>
            </div>
          )}
          {canRemind && (
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#F59E0B' }} />
              <p className="text-xs flex-1" style={{ color: '#F59E0B' }}>تبقى أقل من 24 ساعة على موعد هذه المهمة!</p>
              <Button size="sm" variant="outline" className="text-xs h-7 shrink-0" onClick={() => onReminder(task)}>
                <Bell className="w-3 h-3 ml-1" />تذكير
              </Button>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse">
          <Button size="sm" onClick={() => { onClose(); onEdit(task); }}><Edit3 className="w-3.5 h-3.5 ml-1" />تعديل</Button>
          <Button size="sm" variant="destructive" onClick={() => { onClose(); onDelete(task); }}><Trash2 className="w-3.5 h-3.5 ml-1" />حذف</Button>
          <Button
            size="sm"
            onClick={() => onSendWhatsapp(task)}
            disabled={isSendingWhatsapp}
            className="inline-flex items-center gap-1.5 shrink-0 border-0"
            style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)', color: '#fff', boxShadow: '0 2px 8px rgba(37,211,102,0.35)' }}
          >
            {isSendingWhatsapp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
            تذكير واتساب
          </Button>
          <Button size="sm" variant="outline" onClick={onClose} className="mr-auto">إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const { toast } = useToast();
  const { data: currentUser } = useGetCurrentUser();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [sendingWhatsappId, setSendingWhatsappId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | TaskStatus>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | Priority>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [reassignTarget, setReassignTarget] = useState<Task | null>(null);
  const [bindingError, setBindingError] = useState<string | null>(null);

  // Load Tasks from API (and fallback to localStorage if offline)
  const loadTasks = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsLoading(true);
    try {
      const url = isManualRefresh ? '/api/tasks?refresh=true' : '/api/tasks';
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        setBindingError(null);
        const data: Task[] = await res.json();
        setTasks(data);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } else if (res.status === 409) {
        const errJson = await res.json().catch(() => ({}));
        setBindingError(errJson.error || 'ربط المكتب غير مكتمل. تواصل مع المشرف');
      } else {
        throw new Error('فشل جلب المهام من السيرفر');
      }
    } catch {
      // Fallback to localStorage
      try {
        const local = localStorage.getItem(STORAGE_KEY);
        if (local) setTasks(JSON.parse(local));
      } catch { /* ignore */ }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
  }, []);

  useEffect(() => { requestNotificationPermission(); }, [requestNotificationPermission]);

  useEffect(() => {
    const check = () => {
      setTasks(prev => prev.map(t => {
        if (t.reminderSent || t.status === 'مكتملة') return t;
        const h = getRemainingHours(t.dueDate);
        if (h > 0 && h <= 24) {
          if (Notification.permission === 'granted') new Notification('⚠️ تذكير مهمة قانونية', { body: `"${t.title}" ستنتهي خلال أقل من 24 ساعة!` });
          toast({ title: '⏰ تذكير: مهمة تقترب من موعدها', description: `"${t.title}" — تبقى أقل من 24 ساعة!` });
          return { ...t, reminderSent: true };
        }
        return t;
      }));
    };
    check();
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const refIdStr = errData.refId ? ` رقم المرجع: ${errData.refId}` : '';
        const errMsg = errData.error
          ? (errData.refId && errData.error.includes(errData.refId) ? errData.error : `${errData.error}${refIdStr}`)
          : `تعذر حفظ المهمة في جوجل شيت.${refIdStr}`;
        throw new Error(errMsg);
      }

      toast({
        title: 'تم الحفظ في الشيت 📊',
        description: editingRecordText(!!editingTask),
      });

      setFormOpen(false);
      setEditingTask(null);
      await loadTasks(true);
    } catch (err: any) {
      toast({
        title: 'خطأ في الحفظ',
        description: err.message || 'تعذر حفظ المهمة في الشيت.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const editingRecordText = (isEdit: boolean) => isEdit ? 'تم تحديث المهمة بنجاح في ورقة Tasks.' : 'تم إضافة المهمة بنجاح في ورقة Tasks.';

  const handleEdit = (task: Task) => { setEditingTask(task); setFormOpen(true); };
  const handleDelete = (task: Task) => setDeleteTarget(task);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/tasks/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('فشل حذف المهمة من الشيت');
      }
      toast({ title: 'تم الحذف', description: 'تم حذف المهمة من ورقة Tasks.' });
      setDeleteTarget(null);
      await loadTasks(true);
    } catch (err: any) {
      toast({
        title: 'خطأ في الحذف',
        description: err.message || 'تعذر حذف المهمة.',
        variant: 'destructive',
      });
    }
  };

  const handleReminder = (task: Task) => {
    if (Notification.permission === 'granted') new Notification('⚠️ تذكير مهمة قانونية', { body: `"${task.title}" ستنتهي خلال أقل من 24 ساعة!` });
    toast({ title: '🔔 تم إرسال التذكير', description: `تذكير: "${task.title}"` });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, reminderSent: true } : t));
  };

  const handleSendWhatsappReminder = async (task: Task) => {
    setSendingWhatsappId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`تعذر التواصل مع السيرفر (${res.status}): ${text.slice(0, 100)}`);
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل إرسال تذكير الواتساب');
      }

      toast({
        title: 'تم الإرسال بنجاح 🟢',
        description: data.message || 'تم إرسال تذكير المهمة عبر الواتساب بنجاح.',
      });
    } catch (err: any) {
      toast({
        title: 'خطأ في إرسال التذكير',
        description: err?.message || 'تعذر إرسال تذكير الواتساب.',
        variant: 'destructive',
      });
    } finally {
      setSendingWhatsappId(null);
    }
  };

  const filtered = tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.assignee.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    return true;
  });

  const currentTasks = filtered.filter(t => classifyTask(t) === 'current');
  const upcomingTasks = filtered.filter(t => classifyTask(t) === 'upcoming');
  const pastTasks = filtered.filter(t => classifyTask(t) === 'past');

  const cp = (task: Task) => ({
    task,
    onEdit: handleEdit,
    onDelete: handleDelete,
    onView: setViewTask,
    onReminder: handleReminder,
    onSendWhatsapp: handleSendWhatsappReminder,
    isSendingWhatsapp: sendingWhatsappId === task.id,
    onReassign: (t: Task) => setReassignTarget(t),
    isAdmin,
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3F4A2C, #52603B)' }}>
            <CheckSquare className="w-5 h-5 text-[#C9A449]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">إدارة المهام</h1>
            <p className="text-xs text-muted-foreground">{tasks.length} مهمة إجمالاً</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadTasks(true)}
            disabled={isLoading}
            title="تحديث البيانات من الشيت"
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
          <Button
            onClick={() => { setEditingTask(null); setFormOpen(true); }}
            className="flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #3F4A2C, #2A321D)', color: '#fff', border: 'none' }}
          >
            <Plus className="w-4 h-4" />إضافة مهمة
          </Button>
        </div>
      </div>

      {bindingError && (
        <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-destructive flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="flex-1 font-semibold text-sm">{bindingError}</div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="بحث في المهام..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
        </div>
        <Select value={filterStatus} onValueChange={v => setFilterStatus(v as typeof filterStatus)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="قيد التنفيذ">قيد التنفيذ</SelectItem>
            <SelectItem value="مكتملة">مكتملة</SelectItem>
            <SelectItem value="مؤجلة">مؤجلة</SelectItem>
            <SelectItem value="معلقة">معلقة</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={v => setFilterPriority(v as typeof filterPriority)}>
          <SelectTrigger className="w-32"><SelectValue placeholder="الأولوية" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الأولويات</SelectItem>
            <SelectItem value="عاجلة">عاجلة</SelectItem>
            <SelectItem value="عادية">عادية</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {([
          { label: 'قيد التنفيذ', color: '#3B82F6', s: 'قيد التنفيذ' },
          { label: 'مكتملة', color: '#22C55E', s: 'مكتملة' },
          { label: 'مؤجلة', color: '#F59E0B', s: 'مؤجلة' },
          { label: 'معلقة', color: '#EF4444', s: 'معلقة' },
        ] as { label: string; color: string; s: TaskStatus }[]).map(item => (
          <div key={item.label} className="rounded-xl p-4 border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="text-2xl font-bold" style={{ color: item.color }}>{tasks.filter(t => t.status === item.s).length}</div>
            <div className="text-xs mt-0.5 text-muted-foreground">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
          <CheckSquare className="w-16 h-16" />
          <p className="text-lg font-medium">لا توجد مهام بعد</p>
          <p className="text-sm">ابدأ بإضافة مهمتك الأولى</p>
        </div>
      )}

      {/* Task Sections */}
      {filtered.length > 0 && (
        <>
          {currentTasks.length > 0 && (
            <Section title="المهام الحالية" count={currentTasks.length} color="#3B82F6" icon={Timer} defaultOpen>
              {currentTasks.map(t => <TaskCard key={t.id} {...cp(t)} />)}
            </Section>
          )}
          {upcomingTasks.length > 0 && (
            <Section title="المهام القادمة" count={upcomingTasks.length} color="#C9A449" icon={Calendar} defaultOpen>
              {upcomingTasks.map(t => <TaskCard key={t.id} {...cp(t)} />)}
            </Section>
          )}
          {pastTasks.length > 0 && (
            <Section title="المهام المنتهية والمكتملة" count={pastTasks.length} color="#6B7280" icon={CheckCircle2} defaultOpen={false}>
              {pastTasks.map(t => <TaskCard key={t.id} {...cp(t)} />)}
            </Section>
          )}
        </>
      )}

      {/* Dialogs */}
      <TaskFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingTask(null); }}
        onSave={handleSave}
        initial={editingTask}
        isSaving={isSaving}
        currentUser={currentUser}
      />
      <TaskDetailDialog
        task={viewTask}
        onClose={() => setViewTask(null)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onReminder={handleReminder}
        onSendWhatsapp={handleSendWhatsappReminder}
        isSendingWhatsapp={viewTask ? sendingWhatsappId === viewTask.id : false}
      />

      {reassignTarget && (
        <ReassignDialog
          open={!!reassignTarget}
          onOpenChange={(open) => {
            if (!open) setReassignTarget(null);
          }}
          module="tasks"
          recordId={reassignTarget.id}
          recordTitle={reassignTarget.title}
          currentLawyerId={reassignTarget.assignedLawyerId || reassignTarget.assigned_lawyer_id}
          onSuccess={() => {
            setReassignTarget(null);
            loadTasks(true);
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف المهمة "{deleteTarget?.title}"؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">حذف</AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
