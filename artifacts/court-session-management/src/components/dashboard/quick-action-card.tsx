import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

export interface QuickActionCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  featured?: boolean;
  dataTestId?: string;
}

export function QuickActionCard({
  title,
  description,
  href,
  icon: Icon,
  iconBg = 'bg-muted',
  iconColor = 'text-muted-foreground',
  featured = false,
  dataTestId,
}: QuickActionCardProps) {
  return (
    <Link href={href}>
      <div
        className={`group relative overflow-hidden rounded-xl border border-border p-6 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 h-full ${
          featured
            ? 'bg-gradient-to-br from-primary/8 to-primary/3 hover:border-primary/40'
            : 'bg-card hover:border-primary/30'
        }`}
        data-testid={dataTestId}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center shrink-0 transition-colors`}
          >
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-base mb-1 text-foreground">{title}</div>
            <div className="text-sm text-muted-foreground leading-relaxed">{description}</div>
          </div>
        </div>
        <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowLeft className={`w-4 h-4 ${featured ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
      </div>
    </Link>
  );
}

