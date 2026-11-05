import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, User, Loader2, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface ClientItem {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
}

interface ClientPickerProps {
  value?: string | null;
  onChange: (clientId: string | null, clientName?: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function ClientPicker({
  value,
  onChange,
  label = 'العميل / الموكل',
  placeholder = 'اختر العميل...',
  disabled = false,
}: ClientPickerProps) {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const fetchClients = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clients', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newName.trim(),
          phone: newPhone.trim(),
          notes: newNotes.trim(),
        }),
      });

      if (res.ok) {
        const created: ClientItem = await res.json();
        setClients((prev) => [created, ...prev]);
        onChange(created.id, created.name);
        setDialogOpen(false);
        setNewName('');
        setNewPhone('');
        setNewNotes('');
        toast({ title: 'تمت إضافة العميل بنجاح' });
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: 'خطأ', description: err.error || 'فشل حفظ العميل', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالسيرفر', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1.5" dir="rtl">
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <Select
            value={value || '__none__'}
            onValueChange={(val) => {
              if (val === '__none__') {
                onChange(null, undefined);
              } else {
                const found = clients.find((c) => c.id === val);
                onChange(val, found?.name);
              }
            }}
            disabled={disabled || loading}
          >
            <SelectTrigger className="w-full text-right bg-background">
              <SelectValue placeholder={loading ? 'جاري التحميل...' : placeholder} />
            </SelectTrigger>
            <SelectContent dir="rtl" className="max-h-60">
              <SelectItem value="__none__">
                <span className="text-muted-foreground">— بدون تحديد عميل —</span>
              </SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium">{c.name}</span>
                    {c.phone && <span className="text-xs text-muted-foreground font-mono">({c.phone})</span>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
          disabled={disabled}
          className="shrink-0 gap-1 border-primary/30 hover:border-primary text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>عميل جديد</span>
        </Button>
      </div>

      {/* Inline Create Client Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md w-full" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              <span>إضافة عميل جديد للمكتب</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateClient} className="space-y-3.5 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-name" className="text-xs font-semibold">
                اسم العميل / الشركة <span className="text-destructive">*</span>
              </Label>
              <Input
                id="c-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثال: شركة الأفق المحدودة أو أحمد محمد"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="c-phone" className="text-xs font-semibold">
                رقم الجوال
              </Label>
              <div className="relative">
                <Input
                  id="c-phone"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="font-mono text-left"
                  dir="ltr"
                />
                <Phone className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="c-notes" className="text-xs font-semibold">
                ملاحظات
              </Label>
              <Textarea
                id="c-notes"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="معلومات إضافية عن العميل..."
                rows={2}
              />
            </div>

            <DialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse pt-2">
              <Button type="submit" disabled={!newName.trim() || saving}>
                {saving && <Loader2 className="w-4 h-4 ml-1.5 animate-spin" />}
                <span>حفظ واختيار</span>
              </Button>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

