import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  UserCheck,
  Plus,
  Search,
  Phone,
  FileText,
  ChevronLeft,
  Trash2,
  Edit3,
  Loader2,
  AlertCircle,
  Link as LinkIcon,
  FolderOpen,
  Calendar,
  CheckSquare,
  ShieldCheck,
  Gavel,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { useGetCurrentUser } from '@workspace/api-client-react';
import { ClientPicker } from '@/components/clients/client-picker';
import { LawyerSelect } from '@/components/clients/lawyer-select';
import { TablePagination } from '@/components/ui/table-pagination';

interface Client {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
  createdAt: string;
}

interface LegacyRecord {
  id: number;
  module: 'sessions' | 'tasks' | 'poa' | 'judgments';
  title: string;
  subTitle?: string;
  client_id?: string | null;
  assigned_lawyer_id?: string | null;
}

export default function ClientsPage() {
  const [, setLocation] = useLocation();
  const { data: currentUser } = useGetCurrentUser();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'clients' | 'triage'>('clients');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Triage state
  const [triageLoading, setTriageLoading] = useState(false);
  const [unassignedRecords, setUnassignedRecords] = useState<LegacyRecord[]>([]);
  const [triageTarget, setTriageTarget] = useState<LegacyRecord | null>(null);
  const [triageClientId, setTriageClientId] = useState<string | null>(null);
  const [triageLawyerId, setTriageLawyerId] = useState<string | null>(null);
  const [triageSaving, setTriageSaving] = useState(false);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clients', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch {
      toast({ title: 'خطأ', description: 'فشل تحميل بيانات العملاء', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadTriageRecords = useCallback(async () => {
    if (!isAdmin) return;
    setTriageLoading(true);
    try {
      const res = await fetch('/api/clients/legacy-unassigned', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const records: LegacyRecord[] = [];

        if (Array.isArray(data.sessions)) {
          for (const s of data.sessions) {
            records.push({
              id: s.id,
              module: 'sessions',
              title: s.caseNumber || `جلسة رقم ${s.id}`,
              subTitle: `${s.court || 'المحكمة'} — ${s.sessionDateHijri || ''}`,
              client_id: s.clientId || s.client_id,
              assigned_lawyer_id: s.assignedLawyerId || s.assigned_lawyer_id,
            });
          }
        }
        if (Array.isArray(data.tasks)) {
          for (const t of data.tasks) {
            records.push({
              id: t.id,
              module: 'tasks',
              title: t.title,
              subTitle: t.dueDate ? `التسليم: ${t.dueDate}` : undefined,
              client_id: t.clientId || t.client_id,
              assigned_lawyer_id: t.assignedLawyerId || t.assigned_lawyer_id,
            });
          }
        }
        if (Array.isArray(data.poa)) {
          for (const p of data.poa) {
            records.push({
              id: p.id,
              module: 'poa',
              title: p.poaNumber ? `وكالة رقم ${p.poaNumber}` : `وكالة ${p.clientName || ''}`,
              subTitle: p.expiryDateHijri ? `تنتهي: ${p.expiryDateHijri}` : undefined,
              client_id: p.clientId || p.client_id,
              assigned_lawyer_id: p.assignedLawyerId || p.assigned_lawyer_id,
            });
          }
        }
        if (Array.isArray(data.judgments)) {
          for (const j of data.judgments) {
            records.push({
              id: j.id,
              module: 'judgments',
              title: j.judgmentNumber ? `صك رقم ${j.judgmentNumber}` : `حكم قضية ${j.caseNumber || ''}`,
              subTitle: j.court || undefined,
              client_id: j.clientId || j.client_id,
              assigned_lawyer_id: j.assignedLawyerId || j.assigned_lawyer_id,
            });
          }
        }

        setUnassignedRecords(records);
      }
    } catch {
      // ignore
    } finally {
      setTriageLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  useEffect(() => {
    if (activeTab === 'triage') {
      loadTriageRecords();
    }
  }, [activeTab, loadTriageRecords]);

  const handleOpenCreate = () => {
    setFormName('');
    setFormPhone('');
    setFormNotes('');
    setCreateOpen(true);
  };

  const handleOpenEdit = (c: Client) => {
    setEditingClient(c);
    setFormName(c.name);
    setFormPhone(c.phone || '');
    setFormNotes(c.notes || '');
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setSaving(true);
    try {
      const isEdit = !!editingClient;
      const url = isEdit ? `/api/clients/${editingClient.id}` : '/api/clients';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formName.trim(),
          phone: formPhone.trim(),
          notes: formNotes.trim(),
        }),
      });

      if (res.ok) {
        const saved = await res.json();
        if (isEdit) {
          setClients((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
          toast({ title: 'تم تحديث بيانات العميل بنجاح' });
          setEditingClient(null);
        } else {
          setClients((prev) => [saved, ...prev]);
          toast({ title: 'تمت إضافة العميل بنجاح' });
          setCreateOpen(false);
        }
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

  const handleDeleteClient = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setClients((prev) => prev.filter((c) => c.id !== deleteTarget.id));
        toast({ title: 'تم حذف العميل' });
        setDeleteTarget(null);
      } else {
        toast({ title: 'خطأ', description: 'فشل حذف العميل', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالسيرفر', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTriageSubmit = async () => {
    if (!triageTarget) return;
    setTriageSaving(true);
    try {
      const res = await fetch('/api/clients/triage-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          module: triageTarget.module,
          id: triageTarget.id,
          clientId: triageClientId || null,
          assignedLawyerId: triageLawyerId || null,
        }),
      });

      if (res.ok) {
        toast({ title: 'تم ربط السجل بنجاح' });
        setUnassignedRecords((prev) =>
          prev.filter((r) => !(r.module === triageTarget.module && r.id === triageTarget.id)),
        );
        setTriageTarget(null);
        loadClients();
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: 'خطأ', description: err.error || 'فشل ربط السجل', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'خطأ', description: 'تعذر الاتصال بالسيرفر', variant: 'destructive' });
    } finally {
      setTriageSaving(false);
    }
  };

  const filteredClients = clients.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q));
  });

  const totalItems = filteredClients.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedClients = filteredClients.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getModuleBadge = (mod: LegacyRecord['module']) => {
    switch (mod) {
      case 'sessions':
        return (
          <Badge variant="outline" className="gap-1 border-blue-500/30 text-blue-500 bg-blue-500/10">
            <Calendar className="w-3 h-3" /> جلسة
          </Badge>
        );
      case 'tasks':
        return (
          <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-500 bg-amber-500/10">
            <CheckSquare className="w-3 h-3" /> مهمة
          </Badge>
        );
      case 'poa':
        return (
          <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-500 bg-emerald-500/10">
            <ShieldCheck className="w-3 h-3" /> وكالة
          </Badge>
        );
      case 'judgments':
        return (
          <Badge variant="outline" className="gap-1 border-purple-500/30 text-purple-500 bg-purple-500/10">
            <Gavel className="w-3 h-3" /> حكم
          </Badge>
        );
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">العملاء والموكلين</h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                إدارة ملفات العملاء وسجلات القضايا والمهام والوكالات المرتبطة بهم
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleOpenCreate} className="gap-1.5 shadow-sm">
            <Plus className="w-4 h-4" />
            <span>عميل جديد</span>
          </Button>
        </div>
      </div>

      {/* Tabs (Clients List vs Admin Triage) */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList className="bg-muted/60 p-1 border border-border">
            <TabsTrigger value="clients" className="gap-2 text-xs md:text-sm">
              <UserCheck className="w-4 h-4" />
              <span>قائمة العملاء</span>
              <span className="text-xs px-1.5 py-0.2 rounded-full bg-primary/15 text-primary font-bold">
                {clients.length}
              </span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="triage" className="gap-2 text-xs md:text-sm">
                <LinkIcon className="w-4 h-4" />
                <span>فرز السجلات غير المعينة</span>
                {unassignedRecords.length > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5 text-[11px] rounded-full">
                    {unassignedRecords.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          {activeTab === 'clients' && (
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                placeholder="بحث بالاسم أو رقم الجوال..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pr-9 h-9 text-xs md:text-sm bg-background"
              />
            </div>
          )}
        </div>

        {/* Tab 1: Clients List */}
        <TabsContent value="clients" className="space-y-4 mt-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">جاري تحميل بيانات العملاء...</p>
            </div>
          ) : filteredClients.length === 0 ? (
            <Card className="border-dashed border-2 bg-muted/20">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
                  <UserCheck className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-base">لا يوجد عملاء مسجلين</h3>
                <p className="text-xs md:text-sm text-muted-foreground max-w-sm mt-1">
                  {search ? 'لم يتم العثور على عملاء يطابقون كلمة البحث.' : 'قم بإضافة عملاء المكتب لتنظيم الجلسات والمهام والوكالات تحت ملف موحد لكل موكل.'}
                </p>
                {!search && (
                  <Button onClick={handleOpenCreate} variant="outline" className="mt-4 gap-1.5 text-xs">
                    <Plus className="w-4 h-4" />
                    <span>إضافة أول عميل</span>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedClients.map((client) => (
                  <Card
                    key={client.id}
                    className="hover:border-primary/50 transition-all hover:shadow-md cursor-pointer border-border/80 group"
                    onClick={() => setLocation(`/clients/${client.id}`)}
                  >
                  <CardContent className="p-4 flex flex-col justify-between h-full space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                            {client.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm md:text-base text-foreground group-hover:text-primary transition-colors truncate">
                              {client.name}
                            </h4>
                            {client.phone && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 font-mono mt-0.5" dir="ltr">
                                <span>{client.phone}</span>
                                <Phone className="w-3 h-3 text-muted-foreground/70" />
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenEdit(client)}
                            title="تعديل"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteTarget(client)}
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {client.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/40 p-2 rounded-md">
                          {client.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FolderOpen className="w-3.5 h-3.5 text-primary/70" />
                        <span>عرض الملف الكامل</span>
                      </span>
                      <ChevronLeft className="w-4 h-4 text-muted-foreground group-hover:-translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          </>
        )}
        </TabsContent>

        {/* Tab 2: Admin Triage */}
        {isAdmin && (
          <TabsContent value="triage" className="space-y-4 mt-0">
            <div className="p-3.5 rounded-lg border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs md:text-sm text-foreground/90 leading-relaxed">
                <span className="font-bold text-amber-700 dark:text-amber-400">فرز السجلات غير المعينة:</span> هذه السجلات
                موجودة في قاعدة بيانات المكتب ولكنها غير مربوطة بعميل محدد، أو لم يتم تعيين محامٍ مسؤول عنها بعد. يتيح لك هذا
                القسم تعيين المسؤول والعميل بخطوة واحدة للحفاظ على دقة الصلاحيات.
              </div>
            </div>

            {triageLoading ? (
              <div className="flex flex-col items-center justify-center p-16 gap-3 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm">جاري جلب السجلات غير المعينة...</p>
              </div>
            ) : unassignedRecords.length === 0 ? (
              <Card className="border-dashed bg-muted/10">
                <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
                    <Check className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm md:text-base">ممتاز! جميع السجلات معينة</h4>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1">
                    لا توجد حالياً جلسات أو مهام أو وكالات أو أحكام مفقودة العميل أو المحامي المسؤول.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs md:text-sm">
                    <thead className="bg-muted/70 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="p-3">نوع السجل</th>
                        <th className="p-3">عنوان / تفاصيل السجل</th>
                        <th className="p-3">حالة العميل</th>
                        <th className="p-3">حالة التعيين</th>
                        <th className="p-3 text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {unassignedRecords.map((record) => (
                        <tr key={`${record.module}-${record.id}`} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 whitespace-nowrap">{getModuleBadge(record.module)}</td>
                          <td className="p-3">
                            <div className="font-semibold">{record.title}</div>
                            {record.subTitle && (
                              <div className="text-xs text-muted-foreground">{record.subTitle}</div>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {record.client_id ? (
                              <Badge variant="outline" className="text-emerald-600 bg-emerald-500/10 border-emerald-500/20 text-xs">
                                مربوط بعميل
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-destructive bg-destructive/10 border-destructive/20 text-xs">
                                غير مربوط بعميل
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {record.assigned_lawyer_id ? (
                              <Badge variant="outline" className="text-emerald-600 bg-emerald-500/10 border-emerald-500/20 text-xs">
                                معين لمحامٍ
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 bg-amber-500/10 border-amber-500/20 text-xs">
                                غير معين لمحامٍ
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setTriageTarget(record);
                                setTriageClientId(record.client_id || null);
                                setTriageLawyerId(record.assigned_lawyer_id || null);
                              }}
                              className="gap-1 text-xs border-primary/30 hover:border-primary text-primary"
                            >
                              <LinkIcon className="w-3.5 h-3.5" />
                              <span>ربط وتعيين</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Add / Edit Client Dialog */}
      <Dialog
        open={createOpen || !!editingClient}
        onOpenChange={(v) => {
          if (!v) {
            setCreateOpen(false);
            setEditingClient(null);
          }
        }}
      >
        <DialogContent className="max-w-md w-full" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary" />
              <span>{editingClient ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveClient} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="cl-name" className="text-xs font-semibold">
                اسم العميل أو الجهة <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cl-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="مثال: شركة البركة للمقاولات أو فهد بن خالد"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cl-phone" className="text-xs font-semibold">
                رقم الجوال
              </Label>
              <Input
                id="cl-phone"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="05XXXXXXXX"
                dir="ltr"
                className="text-left font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cl-notes" className="text-xs font-semibold">
                ملاحظات أو تفاصيل إضافية
              </Label>
              <Textarea
                id="cl-notes"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="أي ملاحظات تتعلق بصفة الموكل أو متطلبات قضاياه..."
                rows={3}
              />
            </div>

            <DialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse pt-2">
              <Button type="submit" disabled={!formName.trim() || saving}>
                {saving && <Loader2 className="w-4 h-4 ml-1.5 animate-spin" />}
                <span>{editingClient ? 'حفظ التعديلات' : 'إضافة العميل'}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  setEditingClient(null);
                }}
                disabled={saving}
              >
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">هل أنت متأكد من حذف العميل؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right text-xs md:text-sm">
              سيتم حذف سجل العميل &quot;{deleteTarget?.name}&quot;. لن يؤثر ذلك على الجلسات أو المهام السابقة ولكن سيفك ارتباطها
              بهذا العميل.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse">
            <AlertDialogAction onClick={handleDeleteClient} className="bg-destructive hover:bg-destructive/90">
              {saving ? <Loader2 className="w-4 h-4 ml-1.5 animate-spin" /> : null}
              <span>تأكيد الحذف</span>
            </AlertDialogAction>
            <AlertDialogCancel disabled={saving}>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Triage Link Modal */}
      {triageTarget && (
        <Dialog open={!!triageTarget} onOpenChange={(v) => !v && setTriageTarget(null)}>
          <DialogContent className="max-w-md w-full" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-right flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-primary" />
                <span>ربط السجل وتعيين المسؤول</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs space-y-1">
                <div className="flex items-center gap-2">
                  {getModuleBadge(triageTarget.module)}
                  <span className="font-bold">{triageTarget.title}</span>
                </div>
                {triageTarget.subTitle && (
                  <p className="text-muted-foreground">{triageTarget.subTitle}</p>
                )}
              </div>

              <div className="space-y-3">
                <ClientPicker
                  value={triageClientId}
                  onChange={(id) => setTriageClientId(id)}
                  label="ربط بعميل مسجل"
                />

                <LawyerSelect
                  value={triageLawyerId}
                  onChange={(id) => setTriageLawyerId(id)}
                  label="تعيين المحامي المسؤول"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse pt-2">
              <Button onClick={handleTriageSubmit} disabled={triageSaving}>
                {triageSaving && <Loader2 className="w-4 h-4 ml-1.5 animate-spin" />}
                <span>حفظ التعيين</span>
              </Button>
              <Button variant="outline" onClick={() => setTriageTarget(null)} disabled={triageSaving}>
                إلغاء
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

