import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';

export interface StatCardProps {
  label: string;
  value?: number | string | null;
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  dotColor?: string;
  href?: string;
  isLoading?: boolean;
  isUnavailable?: boolean;
  unavailableText?: string;
  dataTestId?: string;
  subtext?: string;
}

export function StatCard({
  label,
  value = 0,
  icon: Icon,
  iconBg = 'bg-primary/15',
  iconColor = 'text-primary',
  dotColor = 'bg-primary',
  href,
  isLoading = false,
  isUnavailable = false,
  unavailableText = 'غير متاح',
  dataTestId,
  subtext,
}: StatCardProps) {
  const content = (
    <div className="fade-in-up rounded-2xl border border-slate-200/80 dark:border-border bg-white dark:bg-card p-5 transition-all duration-200 hover:shadow-md hover:border-emerald-600/40 hover:-translate-y-0.5 cursor-pointer h-full flex flex-col justify-between shadow-xs">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shadow-xs`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className={`w-2 h-2 rounded-full ${isUnavailable ? 'bg-amber-500' : dotColor} mt-1`} />
      </div>
      <div>
        {isLoading ? (
          <Skeleton className="h-9 w-16 mb-1" />
        ) : isUnavailable ? (
          <div className="text-lg font-bold font-sans text-amber-600 dark:text-amber-400 py-1" data-testid={dataTestId}>
            {unavailableText}
          </div>
        ) : (
          <div className="text-3xl font-extrabold font-mono tracking-tight text-slate-900 dark:text-foreground" data-testid={dataTestId}>
            {value ?? 0}
          </div>
        )}
        <p className="text-xs text-slate-500 dark:text-muted-foreground mt-1.5 font-semibold">{label}</p>
        {subtext && <p className="text-[10px] text-muted-foreground mt-0.5">{subtext}</p>}
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

