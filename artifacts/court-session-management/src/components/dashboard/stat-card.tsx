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
  iconBg = 'bg-blue-50',
  iconColor = 'text-blue-600',
  dotColor,
  href,
  isLoading = false,
  isUnavailable = false,
  unavailableText = 'غير متاح',
  dataTestId,
  subtext,
}: StatCardProps) {
  const content = (
    <div className="fade-in-up rounded-2xl border border-[#D6E0EC] bg-white p-5 transition-all duration-200 hover:shadow-md hover:border-[#C99732]/60 hover:-translate-y-0.5 cursor-pointer h-full flex items-center justify-between shadow-xs">
      {/* Right side in RTL: Numbers and Label */}
      <div className="min-w-0">
        <p className="text-xs text-[#64748B] font-medium truncate mb-1">{label}</p>
        {isLoading ? (
          <Skeleton className="h-9 w-16 mb-1" />
        ) : isUnavailable ? (
          <div className="text-lg font-bold font-sans text-amber-600 py-1" data-testid={dataTestId}>
            {unavailableText}
          </div>
        ) : (
          <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-[#10233F]" data-testid={dataTestId}>
            {value ?? 0}
          </div>
        )}
        {subtext && <p className="text-[10px] text-[#64748B] mt-1 truncate">{subtext}</p>}
      </div>

      {/* Left side in RTL: Circular colored icon badge */}
      <div className={`w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center shrink-0 shadow-xs border border-black/5`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

