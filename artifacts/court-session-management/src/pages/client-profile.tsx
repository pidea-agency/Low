import React, { useState, useEffect, useCallback } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import {
  UserCheck,
  Phone,
  MessageCircle,
  FileText,
  Calendar,
  CheckSquare,
  ShieldCheck,
  Gavel,
  ArrowRight,
  Plus,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  User,
  Scale,
  ExternalLink,
  Edit3,
  UserCog,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useGetCurrentUser } from '@workspace/api-client-react';
import { LawyerSelect } from '@/components/clients/lawyer-select';
import { ReassignDialog } from '@/components/clients/reassign-dialog';

interface Client {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
  createdAt: string;
}

interface TimelineData {
  client: Client;
  sessions: any[];
  tasks: any[];
  poa: any[];
  judgments: any[];
}

export default function ClientProfilePage() {
  const [, params] = useRoute('/clients/:id');
  const [, setLocation] = useLocation();
  const clientId = params?.id;
  const { data: currentUser } = useGetCurrentUser();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TimelineData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit client modal
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingClient, setSavingClient] = useState(false);

  // Quick task create modal
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<'عاجلة' | 'عادية'>('عادية');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskLawyerId, setTaskLawyerId] = useState<string | null>(null);
  const [savingTask, setSavingTask] = useState(false);

  // Reassign modal
  const [reassignTarget, setReassignTarget] = useState<{
    module: 'sessions' | 'tasks' | 'poa' | 'judgments';
    id: number;
    title: string;
    currentLawyerId?: string | null;
  } | null>(null);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  const loadProfile = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/timeline`, {
        credentials: 'include',
      });
      if (res.status === 404) {
        setErrorMsg('العميل غير موجود أو ليس لديك صلاحية الوصول إليه.');
        setData(null);
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'تعذر تحميل بيانات العميل');
      }
      const json: TimelineData = await res.json();
      setData(json);
      setEditName(json.client.name || '');
      setEditPhone(json.client.phone || '');
      setEditNotes(json.client.notes || '');
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !editName.trim()) return;
    setSavingClient(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editName.trim(),
          phone: editPhone.trim(),
          notes: editNotes.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل تحديث العميل');
      }
      toast({ title: 'تم التحديث بنجاح', description: 'تم حفظ بيانات العميل المعدلة.' });
      setEditClientOpen(false);
      loadProfile();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSavingClient(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !clientId) return;
    setSavingTask(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: taskTitle.trim(),
          priority: taskPriority,
          dueDate: taskDueDate,
          notes: taskNotes.trim(),
          clientId,
          assignedLawyerId: taskLawyerId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل إضافة المهمة');
      }
      toast({ title: 'تمت إضافة المهمة', description: 'تم ربط المهمة بالعميل بنجاح.' });
      setTaskModalOpen(false);
      setTaskTitle('');
      setTaskDueDate('');
      setTaskNotes('');
      setTaskPriority('عادية');
      setTaskLawyerId(null);
      loadProfile();
    } catch (err: any) {
      toast({
        title: 'خطأ في حفظ المهمة',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSavingTask(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3" dir="rtl">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">جارٍ تحميل ملف العميل...</p>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="p-6 max-w-4xl mx-auto" dir="rtl">
        <Button variant="ghost" onClick={() => setLocation('/clients')} className="gap-2 mb-6">
          <ArrowRight className="w-4 h-4" />
          العودة لقائمة العملاء
        </Button>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-8 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
          <h2 className="text-lg font-bold text-destructive">{errorMsg || 'العميل غير موجود'}</h2>
          <Button onClick={loadProfile} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  const { client, sessions, tasks, poa, judgments } = data;

  // Active / valid metrics
  const activeTasksCount = tasks.filter((t) => t.status !== 'مكتملة').length;
  const validPoasCount = poa.filter((p) => (p.daysRemaining ?? 1) > 0).length;

  // Combined timeline items
  const timelineItems: Array<{
    id: string;
    type: 'session' | 'task' | 'poa' | 'judgment';
    title: string;
    subTitle?: string;
    date: string;
    statusBadge?: string;
    lawyer?: string;
    raw: any;
  }> = [];

  sessions.forEach((s) => {
    timelineItems.push({
      id: `s-${s.id}`,
      type: 'session',
      title: `جلسة قضائية: ${s.caseNumber || 'بدون رقم'}`,
      subTitle: `${s.court || 'المحكمة'} · ${s.plaintiff || ''} ضد ${s.defendant || ''}`,
      date: s.sessionDateHijri || s.hearingAt || s.createdAt || '',
      statusBadge: s.status,
      lawyer: s.assignedLawyer || s.assigned_lawyer,
      raw: s,
    });
  });

  tasks.forEach((t) => {
    timelineItems.push({
      id: `t-${t.id}`,
      type: 'task',
      title: `مهمة: ${t.title}`,
      subTitle: t.dueDate ? `تاريخ الاستحقاق: ${t.dueDate}` : undefined,
      date: t.dueDate || t.createdAt || '',
      statusBadge: t.status,
      lawyer: t.assignee,
      raw: t,
    });
  });

  poa.forEach((p) => {
    timelineItems.push({
      id: `p-${p.id}`,
      type: 'poa',
      title: `وكالة شرعية: ${p.poaNumber || ''}`,
      subTitle: `صلاحية: ${p.daysRemaining} يوم متبقٍ`,
      date: p.expiryDateHijri || p.createdAt || '',
      statusBadge: p.daysRemaining > 0 ? 'سارية' : 'منتهية',
      lawyer: p.assignedLawyer || p.assigned_lawyer,
      raw: p,
    });
  });

  judgments.forEach((j) => {
    timelineItems.push({
      id: `j-${j.id}`,
      type: 'judgment',
      title: `حكم قضائي: ${j.judgmentNumber || j.caseNumber || ''}`,
      subTitle: `${j.court || ''} ${j.summary ? `— ${j.summary.slice(0, 50)}...` : ''}`,
      date: j.judgmentDate || j.createdAt || '',
      statusBadge: j.isFavorable || 'صادر',
      lawyer: j.assignedLawyer || j.assigned_lawyer,
      raw: j,
    });
  });

  // Sort descending by date
  timelineItems.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* Top Nav */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link href="/clients">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowRight className="w-4 h-4" />
            العودة للعملاء
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadProfile} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            تحديث
          </Button>
          <Button
            size="sm"
            onClick={() => setEditClientOpen(true)}
            variant="outline"
            className="gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5" />
            تعديل البيانات
          </Button>
        </div>
      </div>

      {/* Client Profile Header Card */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
              <UserCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
                <Badge variant="outline" className="text-xs bg-muted/50 border-border">
                  عميل موثق
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                تاريخ التسجيل: {client.createdAt ? new Date(client.createdAt).toLocaleDateString('ar-SA') : '—'}
              </p>
              {client.notes && (
                <p className="text-sm text-foreground/80 mt-2 bg-muted/40 p-2.5 rounded-lg max-w-xl">
                  {client.notes}
                </p>
              )}
            </div>
          </div>

          {/* Quick Contact Actions */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            {client.phone ? (
              <>
                <a
                  href={`tel:${client.phone}`}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  <span>{client.phone}</span>
                </a>
                <a
                  href={`https://wa.me/${client.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                  title="محادثة واتساب"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>واتساب</span>
                </a>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">لا يوجد رقم هاتف مسجل</span>
            )}
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold">{sessions.length}</div>
              <div className="text-xs text-muted-foreground">الجلسات القضائية</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold">{activeTasksCount}</div>
              <div className="text-xs text-muted-foreground">مهام جارية</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold">{validPoasCount}</div>
              <div className="text-xs text-muted-foreground">وكالات سارية</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
              <Gavel className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xl font-bold">{judgments.length}</div>
              <div className="text-xs text-muted-foreground">أحكام قضائية</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList className="bg-muted p-1 rounded-xl">
            <TabsTrigger value="timeline" className="gap-1.5 text-xs">
              <Clock className="w-3.5 h-3.5" />
              السجل الزمني
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5" />
              الجلسات ({sessions.length})
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-1.5 text-xs">
              <CheckSquare className="w-3.5 h-3.5" />
              المهام ({tasks.length})
            </TabsTrigger>
            <TabsTrigger value="poa" className="gap-1.5 text-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              الوكالات ({poa.length})
            </TabsTrigger>
            <TabsTrigger value="judgments" className="gap-1.5 text-xs">
              <Gavel className="w-3.5 h-3.5" />
              الأحكام ({judgments.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Timeline Tab ── */}
        <TabsContent value="timeline" className="space-y-3">
          {timelineItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl p-8">
              لا توجد أية أنشطة أو سجلات مرتبطة بهذا العميل حتى الآن.
            </div>
          ) : (
            <div className="space-y-3">
              {timelineItems.map((item) => {
                const iconMap = {
                  session: <Calendar className="w-4 h-4 text-blue-600" />,
                  task: <CheckSquare className="w-4 h-4 text-amber-600" />,
                  poa: <ShieldCheck className="w-4 h-4 text-emerald-600" />,
                  judgment: <Gavel className="w-4 h-4 text-purple-600" />,
                };
                const bgMap = {
                  session: 'bg-blue-500/10',
                  task: 'bg-amber-500/10',
                  poa: 'bg-emerald-500/10',
                  judgment: 'bg-purple-500/10',
                };
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card transition-all hover:border-primary/30"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bgMap[item.type]}`}>
                      {iconMap[item.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                        <h4 className="font-semibold text-sm text-foreground">{item.title}</h4>
                        {item.statusBadge && (
                          <Badge variant="outline" className="text-xs">
                            {item.statusBadge}
                          </Badge>
                        )}
                      </div>
                      {item.subTitle && (
                        <p className="text-xs text-muted-foreground mb-1.5">{item.subTitle}</p>
                      )}
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
                        {item.date && <span>📅 {item.date}</span>}
                        {item.lawyer && <span>👤 المحامي: {item.lawyer}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Sessions Tab ── */}
        <TabsContent value="sessions" className="space-y-3">
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl p-8">
              لا توجد جلسات مسجلة لهذا العميل.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sessions.map((s) => (
                <div key={s.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm font-mono text-foreground">{s.caseNumber || 'جلسة بدون رقم'}</h4>
                      <p className="text-xs text-muted-foreground">{s.court || 'المحكمة'}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{s.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>المدعي: {s.plaintiff || '—'}</p>
                    <p>المدعى عليه: {s.defendant || '—'}</p>
                    {s.clientRole && (
                      <p className="text-primary font-medium">صفة الموكل: {s.clientRole === 'plaintiff' ? 'المدّعي' : 'المدّعى عليه'}</p>
                    )}
                    {s.sessionDateHijri && <p>التاريخ: {s.sessionDateHijri}</p>}
                    <p>المحامي المكلف: {s.assignedLawyer || s.assigned_lawyer || 'غير محدد'}</p>
                  </div>
                  <div className="pt-2 flex items-center justify-between border-t border-border/40">
                    <Link href={`/sessions/${s.id}`}>
                      <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 text-primary">
                        التفاصيل
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </Link>
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setReassignTarget({
                            module: 'sessions',
                            id: s.id,
                            title: `جلسة ${s.caseNumber || s.id}`,
                            currentLawyerId: s.assignedLawyerId || s.assigned_lawyer_id,
                          })
                        }
                        className="text-xs gap-1 h-7"
                      >
                        <UserCog className="w-3 h-3" />
                        إعادة تعيين
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tasks Tab ── */}
        <TabsContent value="tasks" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setTaskModalOpen(true)} size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              مهمة جديدة لهذا العميل
            </Button>
          </div>
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl p-8">
              لا توجد مهام مسجلة لهذا العميل.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tasks.map((t) => (
                <div key={t.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-sm text-foreground">{t.title}</h4>
                    <Badge variant="outline" className="text-xs">{t.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>الأولوية: {t.priority}</p>
                    {t.dueDate && <p>تاريخ التسليم: {t.dueDate}</p>}
                    <p>المكلف: {t.assignee || 'غير محدد'}</p>
                    {t.notes && <p className="line-clamp-2">ملاحظات: {t.notes}</p>}
                  </div>
                  {isAdmin && (
                    <div className="pt-2 flex justify-end border-t border-border/40">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setReassignTarget({
                            module: 'tasks',
                            id: t.id,
                            title: `مهمة: ${t.title}`,
                            currentLawyerId: t.assignedLawyerId || t.assigned_lawyer_id,
                          })
                        }
                        className="text-xs gap-1 h-7"
                      >
                        <UserCog className="w-3 h-3" />
                        إعادة تعيين
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── POA Tab ── */}
        <TabsContent value="poa" className="space-y-3">
          {poa.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl p-8">
              لا توجد وكالات مسجلة لهذا العميل.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {poa.map((p) => (
                <div key={p.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm font-mono text-foreground">رقم الوكالة: {p.poaNumber}</h4>
                      <p className="text-xs text-muted-foreground">{p.clientName}</p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-xs font-semibold ${
                        p.daysRemaining <= 0
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          : p.daysRemaining <= 7
                          ? 'bg-[#C9A449]/15 text-[#C9A449] border border-[#C9A449]/40'
                          : 'bg-[#3F4A2C]/10 text-[#3F4A2C] dark:text-[#A4B580] border border-[#3F4A2C]/20'
                      }`}
                    >
                      {p.daysRemaining <= 0
                        ? 'منتهية'
                        : p.daysRemaining <= 7
                        ? `${p.daysRemaining} يوم (تنتهي قريباً)`
                        : `${p.daysRemaining} يوم`}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {p.issueDateHijri && <p>تاريخ الإصدار: {p.issueDateHijri}</p>}
                    {p.expiryDateHijri && <p>تاريخ الانتهاء: {p.expiryDateHijri}</p>}
                    <p>المحامي المتابع: {p.assignedLawyer || p.assigned_lawyer || 'غير محدد'}</p>
                    {p.notes && <p className="line-clamp-2">ملاحظات: {p.notes}</p>}
                  </div>
                  {isAdmin && (
                    <div className="pt-2 flex justify-end border-t border-border/40">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setReassignTarget({
                            module: 'poa',
                            id: p.id,
                            title: `وكالة ${p.poaNumber}`,
                            currentLawyerId: p.assignedLawyerId || p.assigned_lawyer_id,
                          })
                        }
                        className="text-xs gap-1 h-7"
                      >
                        <UserCog className="w-3 h-3" />
                        إعادة تعيين
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Judgments Tab ── */}
        <TabsContent value="judgments" className="space-y-3">
          {judgments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl p-8">
              لا توجد أحكام مسجلة لهذا العميل.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {judgments.map((j) => (
                <div key={j.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm font-mono text-foreground">صك: {j.judgmentNumber || j.caseNumber}</h4>
                      <p className="text-xs text-muted-foreground">{j.court}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{j.isFavorable || 'صادر'}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>المدعي: {j.plaintiff || '—'}</p>
                    <p>المدعى عليه: {j.defendant || '—'}</p>
                    {j.clientRole && (
                      <p className="text-primary font-medium">صفة الموكل: {j.clientRole === 'plaintiff' ? 'المدّعي' : 'المدّعى عليه'}</p>
                    )}
                    {j.judgmentDate && <p>تاريخ الحكم: {j.judgmentDate}</p>}
                    <p>المحامي المكلف: {j.assignedLawyer || j.assigned_lawyer || 'غير محدد'}</p>
                    {j.summary && <p className="line-clamp-2">الملخص: {j.summary}</p>}
                  </div>
                  {isAdmin && (
                    <div className="pt-2 flex justify-end border-t border-border/40">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setReassignTarget({
                            module: 'judgments',
                            id: j.id,
                            title: `حكم ${j.judgmentNumber || j.id}`,
                            currentLawyerId: j.assignedLawyerId || j.assigned_lawyer_id,
                          })
                        }
                        className="text-xs gap-1 h-7"
                      >
                        <UserCog className="w-3 h-3" />
                        إعادة تعيين
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Client Modal */}
      <Dialog open={editClientOpen} onOpenChange={setEditClientOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات العميل</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateClient} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ed-name">اسم العميل *</Label>
              <Input
                id="ed-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-phone">رقم الهاتف / الواتساب</Label>
              <Input
                id="ed-phone"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="05XXXXXXXX"
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-notes">ملاحظات</Label>
              <Textarea
                id="ed-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse">
              <Button type="submit" disabled={savingClient}>
                {savingClient && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
                حفظ التعديل
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditClientOpen(false)}>
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Task Pre-linked Modal */}
      <Dialog open={taskModalOpen} onOpenChange={setTaskModalOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" />
              إضافة مهمة جديدة للعميل
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tsk-title">عنوان المهمة *</Label>
              <Input
                id="tsk-title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="مثال: تقديم مذكرة رد في دعوى..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>الأولوية</Label>
                <Select value={taskPriority} onValueChange={(v: any) => setTaskPriority(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="عادية">عادية</SelectItem>
                    <SelectItem value="عاجلة">🔴 عاجلة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tsk-due">تاريخ التسليم</Label>
                <Input
                  id="tsk-due"
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <LawyerSelect
                value={taskLawyerId}
                onChange={setTaskLawyerId}
                currentRole={currentUser?.role}
                currentUserId={currentUser?.id}
                currentUserName={(currentUser as any)?.displayName || currentUser?.username}
                label="المحامي المكلف"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tsk-notes">ملاحظات إضافية</Label>
              <Textarea
                id="tsk-notes"
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
                rows={2}
              />
            </div>

            <DialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse">
              <Button type="submit" disabled={savingTask || !taskTitle.trim()}>
                {savingTask && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
                إضافة المهمة
              </Button>
              <Button type="button" variant="outline" onClick={() => setTaskModalOpen(false)}>
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Admin Reassign Dialog */}
      {reassignTarget && (
        <ReassignDialog
          open={!!reassignTarget}
          onOpenChange={(open) => {
            if (!open) setReassignTarget(null);
          }}
          module={reassignTarget.module}
          recordId={reassignTarget.id}
          recordTitle={reassignTarget.title}
          currentLawyerId={reassignTarget.currentLawyerId}
          onSuccess={() => {
            setReassignTarget(null);
            loadProfile();
          }}
        />
      )}
    </div>
  );
}
