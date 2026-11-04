import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface SubscriptionBannerProps {
  warning?: string | null;
  daysRemaining?: number | null;
  subscriptionEndDate?: string | null;
}

export function SubscriptionBanner({
  warning,
  daysRemaining,
  subscriptionEndDate,
}: SubscriptionBannerProps) {
  if (!warning) return null;

  return (
    <div className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-start sm:items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
          <AlertCircle className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-amber-950 dark:text-amber-100">
              تذكير انتهاء الاشتراك ⚠️
            </h3>
            <span className="text-[10px] bg-amber-500 text-white font-bold px-2 py-0.5 rounded-full">
              {daysRemaining !== null && daysRemaining !== undefined && daysRemaining >= 0
                ? `متبقي ${daysRemaining} أيام`
                : 'منتهي'}
            </span>
          </div>
          <p className="text-xs text-amber-900/90 dark:text-amber-300/90 mt-1 font-medium leading-relaxed">
            {warning}
          </p>
        </div>
      </div>
      {subscriptionEndDate && (
        <div className="text-xs font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-500/15 px-3 py-1.5 rounded-xl border border-amber-500/30 shrink-0 self-end sm:self-auto">
          تاريخ الانتهاء: {subscriptionEndDate}
        </div>
      )}
    </div>
  );
}

