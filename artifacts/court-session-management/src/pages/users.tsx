import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Edit2,
  Lock,
  Phone,
  Mail,
  User,
  ShieldCheck,
  Pause,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useGetCurrentUser } from '@workspace/api-client-react';
import { validatePassword } from '@workspace/api-zod';

export interface OfficeMember {
  id: string;
  username: string;
  display_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role: 'staff';
  status?: 'active' | 'suspended';
  created_at?: string;
}

export default function OfficeMembersPage() {
  const { toast } = useToast();
  const { data: currentUser } = useGetCurrentUser();

  const [members, setMembers] = useState<OfficeMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<OfficeMember | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    display_name: '',
    email: '',
    phone: '',
  });

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.users) {
        setMembers(data.users);
      }
    } catch {
      toast({
        title: 'خطأ',
        description: 'فشل جلب قائمة أعضاء ومحامي المكتب.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password.trim()) {
      toast({
        title: 'تنبيه',
        description: 'اسم المستخدم وكلمة المرور مطلوبان.',
        variant: 'destructive',
      });
      return;
    }

    const val = validatePassword(formData.password, { username: formData.username, email: formData.email });
    if (!val.isValid) {
      toast({
        title: 'كلمة مرور ضعيفة',
        description: val.message,
        variant: 'destructive',
      });
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل إنشاء حساب العضو.');
      }

      toast({
        title: 'تم بنجاح',
        description: `تم إضافة المحامي "${data.display_name || data.username}" إلى فريق المكتب بنجاح!`,
      });
      setIsAddModalOpen(false);
      resetForm();
      fetchMembers();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    if (formData.password.trim()) {
      const val = validatePassword(formData.password, { username: selectedMember.username, email: formData.email });
      if (!val.isValid) {
        toast({
          title: 'كلمة مرور ضعيفة',
          description: val.message,
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      const payload: any = {
        display_name: formData.display_name,
        email: formData.email,
        phone: formData.phone,
      };
      if (formData.password.trim()) {
        payload.password = formData.password.trim();
      }

      const res = await fetch(`/api/users/${selectedMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تعديل بيانات العضو.');
      }

      toast({
        title: 'تم بنجاح',
        description: 'تم تحديث بيانات العضو بنجاح.',
      });
      setIsEditModalOpen(false);
      fetchMembers();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleToggleStatus = async (member: OfficeMember) => {
    const nextStatus = member.status === 'suspended' ? 'active' : 'suspended';
    const actionName = nextStatus === 'suspended' ? 'إيقاف' : 'تفعيل';
    if (!window.confirm(`هل أنت متأكد من ${actionName} حساب "${member.display_name || member.username}"؟`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${member.id}/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('فشل تغيير حالة الحساب.');
      toast({
        title: 'تم بنجاح',
        description: `تم ${actionName} حساب العضو بنجاح.`,
      });
      fetchMembers();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteMember = async (member: OfficeMember) => {
    if (!window.confirm(`هل أنت متأكد من حذف حساب "${member.display_name || member.username}" من أعضاء المكتب؟`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${member.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('فشل حذف العضو.');
      toast({
        title: 'تم الحذف',
        description: 'تم حذف العضو من المكتب بنجاح.',
      });
      fetchMembers();
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const openEditModal = (member: OfficeMember) => {
    setSelectedMember(member);
    setFormData({
      username: member.username,
      password: '',
      display_name: member.display_name || '',
      email: member.email || '',
      phone: member.phone || '',
    });
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      display_name: '',
      email: '',
      phone: '',
    });
  };

  const filteredMembers = members.filter((m) => {
    const query = searchQuery.toLowerCase();
    return (
      (m.display_name && m.display_name.toLowerCase().includes(query)) ||
      m.username.toLowerCase().includes(query) ||
      (m.phone && m.phone.includes(query)) ||
      (m.email && m.email.toLowerCase().includes(query))
    );
  });

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6 font-sans" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                أعضاء ومحامو المكتب
              </h1>
              <Badge variant="outline" className="text-xs font-bold">
                {currentUser?.officeName || 'مكتب المحاماة'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              إدارة حسابات المحامين والمساعدين المصرح لهم بالدخول للنظام والعمل على قضايا وجلسات المكتب
            </p>
          </div>
        </div>

        <Button
          onClick={() => {
            resetForm();
            setIsAddModalOpen(true);
          }}
          className="gap-2 text-xs font-bold self-end sm:self-center shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          إضافة محامٍ / عضو جديد
        </Button>
      </div>

      {/* Search and Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 bg-card border border-border p-3 rounded-xl">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو اسم المستخدم أو الهاتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9 text-xs h-9"
            />
          </div>

          <div className="text-xs text-muted-foreground font-semibold">
            إجمالي الأعضاء: <span className="font-bold text-foreground">{members.length}</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-muted/50 border-b border-border font-bold text-muted-foreground">
                <tr>
                  <th className="p-3.5">اسم المحامي / العضو</th>
                  <th className="p-3.5">اسم المستخدم</th>
                  <th className="p-3.5">رقم الهاتف</th>
                  <th className="p-3.5">البريد الإلكتروني</th>
                  <th className="p-3.5">حالة الحساب</th>
                  <th className="p-3.5 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-muted-foreground">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
                      جارٍ تحميل قائمة الأعضاء...
                    </td>
                  </tr>
                ) : filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-muted-foreground">
                      لا يوجد أعضاء مسجلون في المكتب حالياً. يمكنك إضافة محامٍ جديد عبر الزر أعلاه.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-sm text-foreground">
                          {member.display_name || member.username}
                        </div>
                        <div className="text-[11px] text-muted-foreground">عضو فريق المكتب</div>
                      </td>

                      <td className="p-3.5 font-mono bg-muted px-2 py-0.5 rounded font-bold">
                        {member.username}
                      </td>

                      <td className="p-3.5 text-muted-foreground">
                        {member.phone || '—'}
                      </td>

                      <td className="p-3.5 text-muted-foreground">
                        {member.email || '—'}
                      </td>

                      <td className="p-3.5">
                        {member.status === 'suspended' ? (
                          <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 text-[11px]">
                            موقوف مؤقتاً
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px]">
                            نشط ومصرح
                          </Badge>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Toggle Active / Suspended */}
                          <Button
                            variant="ghost"
                            size="sm"
                            title={member.status === 'suspended' ? 'إعادة التفعيل' : 'إيقاف الحساب'}
                            onClick={() => handleToggleStatus(member)}
                            className={`h-7 w-7 p-0 ${
                              member.status === 'suspended'
                                ? 'text-emerald-600 hover:text-emerald-700'
                                : 'text-amber-600 hover:text-amber-700'
                            }`}
                          >
                            {member.status === 'suspended' ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <Pause className="w-4 h-4" />
                            )}
                          </Button>

                          {/* Edit Member */}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="تعديل بيانات الحساب"
                            onClick={() => openEditModal(member)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>

                          {/* Delete Member */}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="حذف العضو"
                            onClick={() => handleDeleteMember(member)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">إضافة محامٍ / عضو جديد</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">اسم المحامي / المساعد *</Label>
                <Input
                  required
                  placeholder="أ. عبدالله خالد"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="text-xs h-9"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">اسم المستخدم للدخول *</Label>
                  <Input
                    required
                    placeholder="lawyer_abdullah"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="text-xs h-9 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">كلمة المرور *</Label>
                  <Input
                    required
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="text-xs h-9 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">رقم الهاتف</Label>
                  <Input
                    placeholder="05XXXXXXXX"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    placeholder="lawyer@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-xs"
                >
                  إلغاء
                </Button>
                <Button type="submit" className="text-xs font-bold gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  حفظ وإضافة
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {isEditModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  تعديل بيانات: {selectedMember.display_name || selectedMember.username}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateMember} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">اسم المحامي / المساعد</Label>
                <Input
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="text-xs h-9"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">اسم المستخدم (للقراءة فقط)</Label>
                  <Input
                    disabled
                    value={formData.username}
                    className="text-xs h-9 font-mono bg-muted"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">تغيير كلمة المرور (اختياري)</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="text-xs h-9 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">رقم الهاتف</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  className="text-xs"
                >
                  إلغاء
                </Button>
                <Button type="submit" className="text-xs font-bold gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  حفظ التعديلات
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
