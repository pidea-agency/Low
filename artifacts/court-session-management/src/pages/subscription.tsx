import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CreditCard,
  Users,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Info,
  Edit3,
  Sliders,
  Calendar,
  Layers,
  Search,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useGetCurrentUser } from '@workspace/api-client-react';

interface OfficeInfo {
  id: string;
  office_name: string;
  display_name: string;
  plan_tier: 'plus' | 'pro';
  billing_cycle: 'monthly' | 'annual';
  subscription_end_date: string | null;
  status: 'active' | 'suspended';
  ai_quota_limit: number;
  ai_usage_count: number;
  allocated_quota: number;
  unallocated_quota: number;
  days_remaining: number | null;
  is_expired: boolean;
  is_expiring_soon: boolean;
  members_count: number;
}

interface MemberQuota {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  role: 'staff';
  status: 'active' | 'suspended';
  ai_quota_limit: number | null;
  ai_usage_count: number;
  usage_percent_of_office: number;
  individual_usage_percent: number | null;
  created_at?: string;
}

export default function SubscriptionPage() {
  const { toast } = useToast();
  const { data: currentUser } = useGetCurrentUser();

  const [office, setOffice] = useState<OfficeInfo | null>(null);
  const [members, setMembers] = useState<MemberQuota[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog State
  const [editingMember, setEditingMember] = useState<MemberQuota | null>(null);
  const [hasIndividualLimit, setHasIndividualLimit] = useState(false);
  const [quotaInputValue, setQuotaInputValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const fetchOverview = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await fetch('/api/subscription/overview');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل جلب تفاصيل الاشتراك والاستهلاك.');
      }
      setOffice(data.office);
      setMembers(data.members || []);
    } catch (err: any) {
      toast({
        title: 'خطأ',
        description: err.message || 'تعذر تحميل بيانات الاشتراك.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const openQuotaDialog = (member: MemberQuota) => {
    setEditingMember(member);
    setHasIndividualLimit(member.ai_quota_limit !== null);
    setQuotaInputValue(member.ai_quota_limit !== null ? String(member.ai_quota_limit) : '');
  };

  const closeQuotaDialog = () => {
    setEditingMember(null);
    setQuotaInputValue('');
    setHasIndividualLimit(false);
  };

  // Headroom calculation for dialog
  const currentMemberAllocated = editingMember?.ai_quota_limit || 0;
  const maxAvailableForMember = office
    ? office.ai_quota_limit === -1
      ? 999999
      : office.unallocated_quota + currentMemberAllocated
    : 0;

  const numericInput = hasIndividualLimit ? parseInt(quotaInputValue, 10) : null;
  const isInputValid =
    !hasIndividualLimit ||
    (!isNaN(numericInput as number) && (numericInput as number) >= 0 && (numericInput as number) <= maxAvailableForMember);

  const isExceedingHeadroom =
    hasIndividualLimit &&
    !isNaN(numericInput as number) &&
    (numericInput as number) > maxAvailableForMember;

  const handleSaveQuota = async () => {
    if (!editingMember) return;
    if (isExceedingHeadroom) return;

    setIsSaving(true);
    try {
      const payloadLimit = hasIndividualLimit ? parseInt(quotaInputValue, 10) : null;
      const res = await fetch(`/api/subscription/members/${editingMember.id}/quota`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_quota_limit: payloadLimit }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تحديث حصة الاستهلاك للمحامي.');
      }

      toast({
        title: 'تم التحديث بنجاح ✓',
        description: data.message,
      });

      closeQuotaDialog();
      fetchOverview(true);
    } catch (err: any) {
      toast({
        title: 'فشل الحفظ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      m.username.toLowerCase().includes(q) ||
      m.display_name.toLowerCase().includes(q) ||
      (m.email && m.email.toLowerCase().includes(q)) ||
      (m.phone && m.phone.includes(q))
    );
  });

  const officeUsagePercent = office && office.ai_quota_limit > 0
    ? Math.min(100, Math.round((office.ai_usage_count / office.ai_quota_limit) * 100))
    : 0;

  const officeAllocatedPercent = office && office.ai_quota_limit > 0
    ? Math.min(100, Math.round((office.allocated_quota / office.ai_quota_limit) * 100))
    : 0;

  const isOfficeDisabled = office?.status === 'suspended' || office?.is_expired;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6 font-sans" dir="rtl">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                الاشتراك وحصص الاستهلاك
              </h1>
              <Badge variant="outline" className="text-xs font-bold">
                {office?.office_name || (currentUser as any)?.officeName || 'إدارة المكتب'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              متابعة باقة اشتراك المكتب الإجمالية وتوزيع حصص وسقوف تحليلات الذكاء الاصطناعي على أعضاء المكتب.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOverview(true)}
            disabled={isRefreshing || isLoading}
            className="text-xs h-9 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
        </div>
      </div>

      {/* Subscription Inactive / Suspended Warning Banner */}
      {isOfficeDisabled && (
        <Alert variant="destructive" className="border-red-500/30 bg-red-500/10 rounded-2xl">
          <AlertTriangle className="w-5 h-5" />
          <AlertTitle className="font-bold text-sm">
            {office?.status === 'suspended' ? 'اشتراك المكتب موقوف مؤقتاً' : 'انتهت صلاحية اشتراك المكتب'}
          </AlertTitle>
          <AlertDescription className="text-xs mt-1">
            تم إيقاف تحليلات الذكاء الاصطناعي وتعطيل تعديل الحصص للمحامين حالياً. يرجى التواصل مع إدارة المنظومة لتجديد أو تفعيل الاشتراك.
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Metric Cards */}
      {office && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Subscription Tier & Dates */}
          <Card className="rounded-2xl border-border bg-card shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold text-muted-foreground">باقة الاشتراك والصلاحية</CardTitle>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-black text-foreground">
                  {office.plan_tier === 'pro' ? 'باقة برو الاحترافية (Pro)' : 'باقة بلس المتقدمة (Plus)'}
                </span>
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[11px] font-bold">
                  {office.billing_cycle === 'monthly' ? 'فوترة شهرية' : 'فوترة سنوية'}
                </Badge>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  تاريخ الانتهاء:
                </span>
                <span className="font-mono font-bold text-foreground">
                  {office.subscription_end_date ? office.subscription_end_date.split('T')[0] : 'غير محدد'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  حالة الصلاحية:
                </span>
                {office.is_expired ? (
                  <Badge variant="destructive" className="text-[10px] font-bold">منتهي الصلاحية ❌</Badge>
                ) : office.is_expiring_soon ? (
                  <Badge className="bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30 text-[10px] font-bold">
                    ينتهي خلال {office.days_remaining} أيام ⚠️
                  </Badge>
                ) : office.days_remaining !== null ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                    متبقي {office.days_remaining} يوم ✓
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">نشط</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Overall AI Usage */}
          <Card className="rounded-2xl border-border bg-card shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold text-muted-foreground">استهلاك ذكاء المكتب الكلي</CardTitle>
              <div className="text-xs font-mono font-bold text-foreground">
                {officeUsagePercent}%
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-foreground">
                  {office.ai_usage_count}
                </span>
                <span className="text-xs text-muted-foreground">
                  من إجمالي {office.ai_quota_limit === -1 ? 'غير محدود' : `${office.ai_quota_limit} طلب`}
                </span>
              </div>

              <Progress
                value={officeUsagePercent}
                className="h-2.5 rounded-full"
              />

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                <span>المتبقي للمكتب:</span>
                <span className="font-bold text-foreground">
                  {office.ai_quota_limit === -1
                    ? 'غير محدود'
                    : `${Math.max(0, office.ai_quota_limit - office.ai_usage_count)} طلب`}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Quota Allocation Breakdown */}
          <Card className="rounded-2xl border-border bg-card shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold text-muted-foreground">توزيع الحصص على الأعضاء</CardTitle>
              <Layers className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-black text-foreground">
                    {office.allocated_quota}
                  </span>
                  <span className="text-xs text-muted-foreground mr-1.5">مخصص</span>
                </div>
                <div className="text-left">
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                    {office.unallocated_quota === 999999 ? '∞' : office.unallocated_quota}
                  </span>
                  <span className="text-xs text-muted-foreground mr-1">متاح للتخصيص</span>
                </div>
              </div>

              <Progress
                value={officeAllocatedPercent}
                className="h-2.5 rounded-full"
              />

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                <span>أعضاء المكتب:</span>
                <span className="font-bold text-foreground">
                  {office.members_count} محامين ومساعدين
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Members Quota Table Card */}
      <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
        <CardHeader className="p-5 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-black text-foreground">
              سقوف وحصص استهلاك المحامين
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              يمكنك تخصيص سقف استهلاك محدد لكل محامٍ، أو إبقائه على الرصيد المشترك للمكتب بدون سقف فردي.
            </p>
          </div>

          <div className="w-full sm:w-64 relative">
            <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="البحث بالاسم أو البريد..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs h-9 pr-8"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <span>جاري تحميل بيانات الاشتراك والأعضاء...</span>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              {members.length === 0
                ? 'لا يوجد أعضاء مسجلين تحت هذا المكتب بعد. يمكنك إضافة محامين من شاشة "أعضاء المكتب".'
                : 'لم يتم العثور على نتائج تطابق معايير البحث.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-3 px-4">المحامي</th>
                    <th className="py-3 px-4">البريد / الجوال</th>
                    <th className="py-3 px-4">حالة الحساب</th>
                    <th className="py-3 px-4">سقف الذكاء الاصطناعي</th>
                    <th className="py-3 px-4">الاستهلاك</th>
                    <th className="py-3 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredMembers.map((member) => {
                    const hasLimit = member.ai_quota_limit !== null && member.ai_quota_limit !== undefined;
                    const isOverLimit = hasLimit && member.ai_usage_count >= (member.ai_quota_limit || 0);

                    return (
                      <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-xs shrink-0">
                              {member.display_name ? member.display_name[0] : member.username[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-foreground truncate">{member.display_name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">@{member.username}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          <div>{member.email || '—'}</div>
                          {member.phone && <div className="text-[10px] text-muted-foreground/80">{member.phone}</div>}
                        </td>

                        <td className="py-3 px-4">
                          {member.status === 'suspended' ? (
                            <Badge variant="destructive" className="text-[10px]">موقوف</Badge>
                          ) : (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">نشط</Badge>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {hasLimit ? (
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="font-mono text-xs font-bold border-primary/30 text-primary">
                                {member.ai_quota_limit} طلب
                              </Badge>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                              رصيد مشترك (بدون سقف)
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 px-4 min-w-[140px]">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold font-mono text-foreground">
                                {member.ai_usage_count} طلب
                              </span>
                              {hasLimit ? (
                                <span className={`text-[10px] font-mono font-semibold ${isOverLimit ? 'text-red-500' : 'text-muted-foreground'}`}>
                                  {member.individual_usage_percent ?? 0}%
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {member.usage_percent_of_office}% من المكتب
                                </span>
                              )}
                            </div>
                            <Progress
                              value={hasLimit ? Math.min(100, member.individual_usage_percent || 0) : member.usage_percent_of_office}
                              className={`h-1.5 rounded-full ${isOverLimit ? '[&>div]:bg-red-500' : ''}`}
                            />
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openQuotaDialog(member)}
                            disabled={isOfficeDisabled}
                            className="h-8 text-xs gap-1"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                            تخصيص الحصة
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quota Allocation Dialog */}
      <Dialog open={Boolean(editingMember)} onOpenChange={(open) => !open && closeQuotaDialog()}>
        <DialogContent className="max-w-md font-sans" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sliders className="w-5 h-5 text-primary" />
              تحديد حصة الذكاء الاصطناعي للمحامي
            </DialogTitle>
            <DialogDescription className="text-xs">
              تحديد السقف الأقصى لعدد تحليلات القضايا المسموح للمحامي (<strong>{editingMember?.display_name}</strong>) إجراؤها شهرياً.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Toggle Switch */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/40">
              <div className="space-y-0.5">
                <Label htmlFor="limit-toggle" className="text-xs font-bold text-foreground">
                  تحديد سقف فردي خاص
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  عند التعطيل، يشارك المحامي رصيد المكتب المشترك دون حد مسبق.
                </p>
              </div>
              <Switch
                id="limit-toggle"
                checked={hasIndividualLimit}
                onCheckedChange={(checked) => {
                  setHasIndividualLimit(checked);
                  if (checked && !quotaInputValue) {
                    setQuotaInputValue(String(Math.min(25, maxAvailableForMember)));
                  }
                }}
              />
            </div>

            {/* Quota Input Field */}
            {hasIndividualLimit && (
              <div className="space-y-2 p-3 rounded-xl border border-border bg-card">
                <Label htmlFor="quota-input" className="text-xs font-bold text-foreground">
                  عدد الطلبات المخصصة (شهرياً)
                </Label>
                <div className="relative">
                  <Input
                    id="quota-input"
                    type="number"
                    min="0"
                    max={maxAvailableForMember}
                    value={quotaInputValue}
                    onChange={(e) => setQuotaInputValue(e.target.value)}
                    placeholder="مثال: 30"
                    className={`font-mono text-sm h-10 ${isExceedingHeadroom ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    طلب
                  </span>
                </div>

                {isExceedingHeadroom && (
                  <p className="text-[11px] text-red-500 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    العدد المطلوب يتجاوز الرصيد المتاح للتخصيص ({maxAvailableForMember} طلب متبقي).
                  </p>
                )}
              </div>
            )}

            {/* Live Headroom Info Card */}
            <div className="bg-muted/50 p-3 rounded-xl border border-border space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>سقف باقة المكتب الإجمالي:</span>
                <span className="font-mono font-bold text-foreground">
                  {office?.ai_quota_limit === -1 ? 'غير محدود' : `${office?.ai_quota_limit} طلب`}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>الحد الأقصى المتاح لهذا المحامي:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {office?.ai_quota_limit === -1 ? 'غير محدود' : `${maxAvailableForMember} طلب`}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border">
                <span>الاستهلاك الحالي لهذا المحامي:</span>
                <span className="font-mono font-bold text-foreground">
                  {editingMember?.ai_usage_count || 0} طلب مستهلك
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={closeQuotaDialog} disabled={isSaving}>
              إلغاء
            </Button>
            <Button
              size="sm"
              onClick={handleSaveQuota}
              disabled={isSaving || !isInputValid || isExceedingHeadroom}
              className="gap-1.5"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  حفظ الحصة
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

