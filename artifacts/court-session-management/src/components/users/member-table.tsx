import React from 'react';
import {
  Trash2,
  Edit2,
  Pause,
  Play,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TablePagination } from '@/components/ui/table-pagination';

export interface OfficeMember {
  id: string;
  username: string;
  display_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role: 'staff';
  status?: 'active' | 'suspended' | 'pending_activation';
  created_at?: string;
}

export interface MemberTableProps {
  members: OfficeMember[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onEdit: (member: OfficeMember) => void;
  onToggleStatus: (member: OfficeMember) => void;
  onDelete: (member: OfficeMember) => void;
  onResendActivation: (member: OfficeMember) => void;
  resendingId: string | null;
  cooldowns: Record<string, number>;
}

export function MemberTable({
  members,
  isLoading,
  searchQuery,
  onSearchChange,
  onEdit,
  onToggleStatus,
  onDelete,
  onResendActivation,
  resendingId,
  cooldowns,
}: MemberTableProps) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const filtered = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      (m.display_name && m.display_name.toLowerCase().includes(q)) ||
      m.username.toLowerCase().includes(q) ||
      (m.phone && m.phone.includes(q)) ||
      (m.email && m.email.toLowerCase().includes(q))
    );
  });

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedMembers = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSearch = (q: string) => {
    onSearchChange(q);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="flex items-center justify-between gap-3 bg-card border border-border p-3 rounded-xl">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو اسم المستخدم أو الهاتف..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pr-9 text-xs h-9"
          />
        </div>

        <div className="text-xs text-muted-foreground font-semibold">
          إجمالي الأعضاء: <span className="font-bold text-foreground">{members.length}</span>
        </div>
      </div>

      {/* Members Table */}
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
              ) : totalItems === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-8 text-muted-foreground">
                    لا يوجد أعضاء مسجلون في المكتب حالياً. يمكنك إضافة محامٍ جديد عبر الزر أعلاه.
                  </td>
                </tr>
              ) : (
                paginatedMembers.map((member) => {
                  const isPending = member.status === 'pending_activation';
                  const isSuspended = member.status === 'suspended';
                  const cd = cooldowns[member.id] || 0;

                  return (
                    <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 font-bold text-foreground">
                        {member.display_name || 'بدون اسم'}
                      </td>
                      <td className="p-3.5 font-mono text-muted-foreground">{member.username}</td>
                      <td className="p-3.5 font-mono text-muted-foreground" dir="ltr">
                        {member.phone || '—'}
                      </td>
                      <td className="p-3.5 font-mono text-muted-foreground" dir="ltr">
                        {member.email || '—'}
                      </td>
                      <td className="p-3.5">
                        {isPending ? (
                          <Badge
                            variant="secondary"
                            className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 gap-1 text-[11px]"
                          >
                            <Clock className="w-3 h-3" />
                            بانتظار التفعيل
                          </Badge>
                        ) : isSuspended ? (
                          <Badge
                            variant="destructive"
                            className="bg-destructive/10 text-destructive border border-destructive/20 gap-1 text-[11px]"
                          >
                            <AlertCircle className="w-3 h-3" />
                            موقوف مؤقتاً
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 gap-1 text-[11px]"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            نشط
                          </Badge>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          {isPending && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={resendingId === member.id || cd > 0}
                              onClick={() => onResendActivation(member)}
                              className="h-7 px-2 text-[11px] gap-1 border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10"
                              title="إعادة إرسال رابط التفعيل بالبريد الإلكتروني"
                            >
                              <Send className="w-3 h-3" />
                              {resendingId === member.id
                                ? 'جارٍ الإرسال...'
                                : cd > 0
                                ? `إعادة الإرسال (${cd}ث)`
                                : 'إعادة إرسال الرابط'}
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onToggleStatus(member)}
                            className={`h-7 px-2 text-[11px] gap-1 ${
                              isSuspended
                                ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10'
                                : 'text-amber-600 hover:text-amber-700 hover:bg-amber-500/10'
                            }`}
                            title={isSuspended ? 'تفعيل الحساب' : 'إيقاف الحساب مؤقتاً'}
                          >
                            {isSuspended ? (
                              <>
                                <Play className="w-3 h-3" /> تفعيل
                              </>
                            ) : (
                              <>
                                <Pause className="w-3 h-3" /> إيقاف
                              </>
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(member)}
                            className="h-7 px-2 text-[11px] gap-1 text-primary hover:bg-primary/10"
                            title="تعديل البيانات"
                          >
                            <Edit2 className="w-3 h-3" /> تعديل
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(member)}
                            className="h-7 px-2 text-[11px] gap-1 text-destructive hover:bg-destructive/10"
                            title="حذف من المكتب"
                          >
                            <Trash2 className="w-3 h-3" /> حذف
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
    </div>
  );
}

