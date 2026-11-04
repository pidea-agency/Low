import React from 'react';
import { Clock, User } from 'lucide-react';
import { Link } from 'wouter';

export interface DashboardTaskItem {
  id: number;
  title: string;
  assignee?: string;
  priority: string;
  dueDate?: string;
  status?: string;
}

export interface UrgentTaskItemProps {
  task: DashboardTaskItem;
}

export function UrgentTaskItem({ task }: UrgentTaskItemProps) {
  const isUrgent = task.priority === 'عاجل' || task.priority === 'عاجلة';

  return (
    <Link href="/tasks">
      <div className="rounded-xl border border-border bg-card p-3.5 transition-all duration-200 hover:border-amber-500/40 hover:shadow-xs cursor-pointer space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-bold text-foreground line-clamp-1">{task.title}</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
              isUrgent
                ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            }`}
          >
            {task.priority}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3 text-muted-foreground/70" />
            <span>المكلف: {task.assignee || 'غير محدد'}</span>
          </span>
          {task.dueDate && (
            <span className="flex items-center gap-1 font-mono text-[10px]">
              <Clock className="w-3 h-3 text-muted-foreground/70" />
              <span>{task.dueDate}</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

