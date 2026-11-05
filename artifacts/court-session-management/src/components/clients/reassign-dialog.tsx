import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { UserCheck, Loader2 } from 'lucide-react';
import { LawyerSelect } from './lawyer-select';
import { useToast } from '@/hooks/use-toast';
import { useGetCurrentUser } from '@workspace/api-client-react';

interface ReassignDialogProps {
  module: 'sessions' | 'tasks' | 'poa' | 'judgments';
  recordId: number | string | null;
  recordTitle?: string;
  currentLawyerId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updatedRecord: any) => void;
}

export function ReassignDialog({
  module,
  recordId,
  recordTitle,
  currentLawyerId,
  open,
  onOpenChange,
  onSuccess,
}: ReassignDialogProps) {
  const { data: currentUser } = useGetCurrentUser();
  const [selectedLawyerId, setSelectedLawyerId] = useState<string | null>(currentLawyerId || null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  if (!isAdmin) return null;

  const moduleNames = {
    sessions: 'الجلسة',
    tasks: 'المهمة',
    poa: 'الوكالة',
    judgments: 'الحكم',
  };

  const handleReassign = async () => {
    if (!recordId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/${module}/${recordId}/reassign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assignedLawyerId: selectedLawyerId }),
      });

      if (res.ok) {
        const updated = await res.json();
        toast({ title: 'تمت إعادة تعيين المسؤول بنجاح' });
        onSuccess(updated);
        onOpenChange(false);
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: 'خطأ', description: err.error || 'فشل إعادة التعيين', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالسيرفر', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            <span>إعادة تعيين {moduleNames[module]}</span>
          </DialogTitle>
          <DialogDescription className="text-right text-xs text-muted-foreground mt-1">
            {recordTitle ? `السجل: "${recordTitle}"` : 'اختر المحامي المسؤول عن متابعة هذا الملف في المكتب.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-3">
          <LawyerSelect
            value={selectedLawyerId}
            onChange={(id) => setSelectedLawyerId(id)}
            label="تعيين المحامي الجديد"
          />
        </div>

        <DialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse">
          <Button onClick={handleReassign} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 ml-1.5 animate-spin" />}
            <span>تأكيد التعيين</span>
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

