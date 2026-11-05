import { useParams, useLocation } from 'wouter';
import { useGetSession, useUpdateSession, useDeleteSession, useGetCurrentUser, getListSessionsQueryKey, getGetDashboardStatsQueryKey, getGetSessionQueryKey } from '@workspace/api-client-react';
import type { SessionStatus } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { ArrowRight, Save, Trash2, Scale, MessageCircle, Send } from 'lucide-react';
import { TimeRemainingCard } from '@/components/time-remaining';
import { ClientPicker } from '@/components/clients/client-picker';
import { LawyerSelect } from '@/components/clients/lawyer-select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQueryClient } from '@tanstack/react-query';

const statusLabelMap: Record<SessionStatus, string> = {
  Today: 'اليوم',
  Upcoming: 'قادمة',
  Finished: 'منتهية',
  Cancelled: 'ملغية',
};

const statusStyleMap: Record<SessionStatus, string> = {
  Today: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border border-emerald-600/20',
  Upcoming: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  Finished: 'bg-muted text-muted-foreground border border-border',
  Cancelled: 'bg-destructive/10 text-destructive border border-destructive/20',
};

const formFields = [
  { key: 'caseNumber', label: 'رقم القضية', dir: 'ltr' as const, mono: true },
  { key: 'status', label: 'الحالة', type: 'select' },
  { key: 'plaintiff', label: 'المدّعي', dir: 'rtl' as const },
  { key: 'defendant', label: 'المدّعى عليه', dir: 'rtl' as const },
  { key: 'court', label: 'المحكمة', dir: 'rtl' as const },
  { key: 'courtCircuit', label: 'الدائرة القضائية', dir: 'rtl' as const },
  { key: 'caseSubject', label: 'موضوع القضية', dir: 'rtl' as const },
  { key: 'sessionType', label: 'نوع الجلسة', dir: 'rtl' as const },
  { key: 'sessionDateHijri', label: 'تاريخ الجلسة (ميلادي / هجري)', dir: 'ltr' as const, mono: true },
  { key: 'sessionTime', label: 'وقت الجلسة', dir: 'auto' as const, mono: true },
];

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sessionId = Number(params.id);
  const { data: session, isLoading, error } = useGetSession(sessionId);
  const { data: currentUser } = useGetCurrentUser();

  const [formData, setFormData] = useState<any>({});
  const [isSendingWhatsapp, setIsSendingWhatsapp] = useState(false);

  const updateMutation = useUpdateSession();
  const deleteMutation = useDeleteSession();

  useEffect(() => {
    if (session) {
      setFormData({
        caseNumber: session.caseNumber || '',
        plaintiff: session.plaintiff || '',
        defendant: session.defendant || '',
        court: session.court || '',
        courtCircuit: session.courtCircuit || '',
        caseSubject: session.caseSubject || '',
        sessionType: session.sessionType || '',
        sessionDateHijri: session.sessionDateHijri || '',
        sessionTime: session.sessionTime || '',
        notes: session.notes || '',
        status: session.status,
        clientId: (session as any).clientId || (session as any).client_id || '',
        clientRole: (session as any).clientRole || (session as any).client_role || '',
        assignedLawyerId: (session as any).assignedLawyerId || (session as any).assigned_lawyer_id || '',
      });
    }
  }, [session]);

  const updateField = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    updateMutation.mutate(
      { id: sessionId, data: formData },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionId) });
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          toast({ title: 'تم الحفظ', description: 'تم تحديث الجلسة بنجاح' });
        },
        onError: (error: any) => {
          toast({ title: 'فشل الحفظ', description: error?.message || 'تعذّر تحديث الجلسة', variant: 'destructive' });
        },
      }
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(
      { id: sessionId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          toast({ title: 'تم الحذف', description: 'تم حذف الجلسة بنجاح' });
          setLocation('/sessions');
        },
        onError: (error: any) => {
          toast({ title: 'فشل الحذف', description: error?.message || 'تعذّر حذف الجلسة', variant: 'destructive' });
        },
      }
    );
  };

  const handleSendWhatsapp = async () => {
    setIsSendingWhatsapp(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/send-whatsapp`, {
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
        description: data.message || 'تم إرسال تذكير الواتساب بتفاصيل الجلسة والوقت المتبقي.',
      });
    } catch (err: any) {
      toast({
        title: 'خطأ في الإرسال',
        description: err?.message || 'تعذر إرسال تذكير الواتساب.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingWhatsapp(false);
    }
  };

  if (error) {
    return (
      <div className="p-8">
        <Button variant="ghost" onClick={() => setLocation('/sessions')} className="mb-4 gap-2">
          <ArrowRight className="w-4 h-4" />
          العودة إلى الجلسات
        </Button>
        <div className="rounded-xl border border-destructive/30 bg-destructive/8 p-5 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-destructive shrink-0" />
          <p className="text-sm text-destructive font-medium">فشل تحميل تفاصيل الجلسة</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-9 w-48" />
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <div className="grid gap-4 sm:grid-cols-2">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="fade-in-up flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          onClick={() => setLocation('/sessions')}
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground -mr-2"
          data-testid="button-back"
        >
          <ArrowRight className="w-4 h-4" />
          العودة إلى الجلسات
        </Button>
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSendWhatsapp}
            disabled={isSendingWhatsapp}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            data-testid="button-send-whatsapp-header"
          >
            {isSendingWhatsapp ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <MessageCircle className="w-4 h-4" />
            )}
            {isSendingWhatsapp ? 'جاري الإرسال...' : 'تذكير واتساب فوراً'}
          </Button>

          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusStyleMap[session.status]}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
            {statusLabelMap[session.status]}
          </span>
        </div>
      </div>

      {/* Title */}
      <div className="fade-in-up fade-in-up-delay-1">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Scale className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-mono tracking-tight">
              {session.caseNumber || 'تفاصيل الجلسة'}
            </h1>
            <p className="text-xs text-muted-foreground">
              تاريخ الإنشاء: {new Date(session.createdAt).toLocaleDateString('ar-SA')}
            </p>
          </div>
        </div>
      </div>

      {/* Time Remaining */}
      <div className="fade-in-up fade-in-up-delay-1">
        <TimeRemainingCard hearingAt={session.hearingAt} />
      </div>

      {/* Form Card */}
      <div className="fade-in-up fade-in-up-delay-2 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">بيانات الجلسة</p>
            <p className="text-xs text-muted-foreground mt-0.5">عدّل الحقول ثم اضغط حفظ</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSendWhatsapp}
            disabled={isSendingWhatsapp}
            className="gap-2 border-emerald-600/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
          >
            <Send className="w-3.5 h-3.5" />
            إرسال إشعار بالواتساب
          </Button>
        </div>

        <div className="p-5 space-y-5">
          {/* Client & Lawyer Linking */}
          <div className="space-y-3 p-3 rounded-xl border border-border/60 bg-muted/20">
            <div className="space-y-1.5">
              <ClientPicker
                value={formData.clientId || null}
                onChange={(cid) => updateField('clientId', cid || '')}
                label="العميل المرتبط"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                طرف موكلنا في الدعوى
              </Label>
              <Select
                value={formData.clientRole || 'none'}
                onValueChange={(val) => updateField('clientRole', val === 'none' ? '' : val)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="اختر صفة الموكل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">غير محدد</SelectItem>
                  <SelectItem value="plaintiff">المدّعي</SelectItem>
                  <SelectItem value="defendant">المدّعى عليه</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <LawyerSelect
                value={formData.assignedLawyerId || null}
                onChange={(lid) => updateField('assignedLawyerId', lid || '')}
                currentRole={currentUser?.role}
                currentUserId={currentUser?.id}
                currentUserName={(currentUser as any)?.displayName || currentUser?.username}
                label="المحامي المكلف"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {formFields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {f.label}
                </Label>
                {f.type === 'select' ? (
                  <Select
                    value={formData.status}
                    onValueChange={(value) => updateField('status', value)}
                  >
                    <SelectTrigger id="status" className="h-9 text-sm" data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Upcoming">قادمة</SelectItem>
                      <SelectItem value="Today">اليوم</SelectItem>
                      <SelectItem value="Finished">منتهية</SelectItem>
                      <SelectItem value="Cancelled">ملغية</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={f.key}
                    value={formData[f.key] || ''}
                    onChange={(e) => updateField(f.key, e.target.value)}
                    className={`${f.mono ? 'font-mono' : ''} h-9 text-sm`}
                    dir={f.dir}
                    data-testid={`input-${f.key}`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              ملاحظات
            </Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={4}
              dir="auto"
              className="resize-none text-sm"
              data-testid="textarea-notes"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="fade-in-up fade-in-up-delay-3 flex flex-wrap gap-3">
        <Button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="flex-1 min-w-40 gap-2 shadow-sm"
          data-testid="button-save"
        >
          <Save className="w-4 h-4" />
          {updateMutation.isPending ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
        </Button>

        <Button
          type="button"
          onClick={handleSendWhatsapp}
          disabled={isSendingWhatsapp}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          data-testid="button-send-whatsapp-bottom"
        >
          {isSendingWhatsapp ? (
            <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <MessageCircle className="w-4 h-4" />
          )}
          {isSendingWhatsapp ? 'جاري الإرسال...' : 'تذكير واتساب فوراً'}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              disabled={deleteMutation.isPending}
              className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/8 hover:border-destructive/50"
              data-testid="button-delete"
            >
              <Trash2 className="w-4 h-4" />
              حذف
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>حذف الجلسة</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف هذه الجلسة؟ لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                تأكيد الحذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
