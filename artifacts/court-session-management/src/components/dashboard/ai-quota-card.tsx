import React from 'react';
import { Scale, Zap, Database, AlertCircle } from 'lucide-react';

export interface AiQuotaCardProps {
  accountName: string;
  badgeLabel: string;
  isUnlimited?: boolean;
  usedCount: number;
  quotaLimit?: number | null;
  quotaLabel?: string;
  isSyncActive?: boolean;
  syncErrorMessage?: string;
  validityDate?: string | null;
  manageQuotaHref?: string;
}

export function AiQuotaCard({
  accountName,
  badgeLabel,
  isUnlimited = false,
  usedCount,
  quotaLimit,
  quotaLabel = 'استهلاك استخراج الجلسات بالذكاء الاصطناعي',
  isSyncActive = true,
  syncErrorMessage,
  validityDate,
}: AiQuotaCardProps) {
  const effectiveQuota = quotaLimit ?? 50;
  const percent = isUnlimited
    ? 100
    : Math.min(100, Math.round((usedCount / (effectiveQuota || 1)) * 100));

  return (
    <div className="fade-in-up rounded-2xl border border-border bg-card p-5 shadow-xs">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
        {/* Account Info */}
        <div className="flex items-center gap-3.5">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
            style={{ background: 'linear-gradient(135deg, #3F4A2C 0%, #353E24 100%)' }}
          >
            <Scale className="w-5 h-5 text-[#C9A449]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-foreground truncate">{accountName}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#C9A449]/15 text-[#8F7026] dark:text-[#E2C372] border border-[#C9A449]/30">
                {badgeLabel}
              </span>
            </div>
            <p className="text-[11px] mt-0.5 flex items-center gap-1.5">
              {!isSyncActive ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    {syncErrorMessage || 'مزامنة Google Drive غير متصلة'}
                  </span>
                </>
              ) : (
                <>
                  <Database className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-muted-foreground">المزامنة مع Google Drive نشطة</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* AI Quota Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#C9A449]" />
              {quotaLabel}
            </span>
            <span className="font-mono font-bold text-foreground">
              {isUnlimited ? 'مفتوح (غير محدود)' : `${usedCount} / ${quotaLimit !== null && quotaLimit !== undefined ? quotaLimit : 'مشترك'}`}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${percent}%`,
                background: isUnlimited
                  ? 'linear-gradient(90deg, #3F4A2C 0%, #52603B 100%)'
                  : percent >= 100
                  ? '#ef4444'
                  : percent >= 80
                  ? '#f59e0b'
                  : '#C9A449',
              }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {isUnlimited
              ? '✨ باقة مفتوحة — استخراج ذكاء اصطناعي غير محدود'
              : percent >= 100
              ? '⚠️ تم استهلاك كامل الحصة المحددة'
              : quotaLimit !== null && quotaLimit !== undefined
              ? `متبقي ${Math.max(0, effectiveQuota - usedCount)} عملية استخراج`
              : 'ضمن الحصة المتاحة للمكتب'}
          </p>
        </div>

        {/* Subscription Validity */}
        <div className="flex items-center justify-start md:justify-end gap-3 border-t md:border-t-0 md:border-s border-border pt-3 md:pt-0 md:ps-6">
          <div className="text-start md:text-end">
            <span className="text-[11px] text-muted-foreground block">صلاحية الحساب</span>
            <span className="text-xs font-bold font-mono text-foreground">
              {validityDate || 'غير محدد'}
            </span>
          </div>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" title="الحساب نشط" />
        </div>
      </div>
    </div>
  );
}

