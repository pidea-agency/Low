import React from 'react';
import { Scale, ChevronLeft, User } from 'lucide-react';
import { Link } from 'wouter';
import { TimeRemainingBadge } from '@/components/time-remaining';
import type { Session } from '@workspace/api-client-react';

export interface SessionListItemProps {
  session: Session;
  lawyerName?: string;
}

export function SessionListItem({ session, lawyerName }: SessionListItemProps) {
  const resolvedLawyer =
    lawyerName ||
    (session as any).assignedLawyerName ||
    (session as any).assigned_lawyer ||
    (session as any).assignedLawyer;

  return (
    <Link href={`/sessions/${session.id}`}>
      <div className="rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-xs cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Scale className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm font-mono text-foreground">
                {session.caseNumber || 'بدون رقم'}
              </span>
              {session.court && (
                <span className="text-[11px] text-muted-foreground">· {session.court}</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2.5 flex-wrap">
              {session.plaintiff && (
                <span className="truncate max-w-[140px]">الموكل: {session.plaintiff}</span>
              )}
              {session.defendant && (
                <span className="truncate max-w-[140px]">الخصم: {session.defendant}</span>
              )}
              {resolvedLawyer && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3F4A2C] dark:text-[#C9A449] bg-[#3F4A2C]/10 dark:bg-[#C9A449]/15 px-2 py-0.5 rounded-md">
                  <User className="w-3 h-3" />
                  <span>المحامي المعين: {resolvedLawyer}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <TimeRemainingBadge
            hearingAt={session.hearingAt}
            sessionDateHijri={session.sessionDateHijri}
          />
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </Link>
  );
}


