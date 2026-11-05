import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Bell, CheckCheck, Clock, FileWarning, ExternalLink } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface AppNotification {
  id: string;
  officeId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  relatedRecordType?: string | null;
  relatedRecordId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
  total: number;
  page: number;
  limit: number;
}

function formatArabicRelativeTime(dateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'الآن';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'أمس';
    if (diffDays === 2) return 'منذ يومين';
    if (diffDays <= 10) return `منذ ${diffDays} أيام`;
    return `منذ ${diffDays} يوماً`;
  } catch {
    return '';
  }
}

interface NotificationsDropdownProps {
  className?: string;
  buttonClassName?: string;
}

export function NotificationsDropdown({ className, buttonClassName }: NotificationsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ['/api/notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications?limit=25', { credentials: 'include' });
      if (!res.ok) {
        throw new Error('فشل تحميل الإشعارات');
      }
      return res.json();
    },
    refetchInterval: 30000, // Poll every 30s
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('فشل تحديث الإشعار');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('فشل تحديث الإشعارات');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const handleNotificationClick = (item: AppNotification) => {
    if (!item.isRead) {
      markReadMutation.mutate(item.id);
    }
    setOpen(false);

    if (item.relatedRecordType === 'poa') {
      setLocation('/poa');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="الإشعارات والتنبيهات"
          className={cn(
            'relative p-2 rounded-lg transition-colors flex items-center justify-center',
            'text-white/80 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#C9A449]',
            buttonClassName,
          )}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white shadow-sm animate-pulse"
              style={{ backgroundColor: '#C9A449' }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className={cn(
          'w-80 sm:w-96 p-0 rounded-xl shadow-2xl border border-border/40 bg-card text-card-foreground',
          className,
        )}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#C9A449]" />
            <h3 className="font-semibold text-xs">التنبيهات والإشعارات</h3>
            {unreadCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#C9A449]/15 text-[#C9A449] font-medium">
                {unreadCount} جديد
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              قراءة الكل
            </Button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="max-h-80 overflow-y-auto divide-y divide-border/30">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <Clock className="w-5 h-5 animate-spin text-[#C9A449]" />
              جاري تحميل التنبيهات...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <Bell className="w-8 h-8 text-muted-foreground/30 stroke-[1.5]" />
              <p className="font-medium">لا توجد إشعارات جديدة</p>
              <p className="text-[11px] text-muted-foreground/70">
                سيتم إشعارك هنا عند اقتراب موعد انتهاء الوكالات أو المهام المهمة.
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={cn(
                  'p-3 transition-colors cursor-pointer flex items-start gap-3 hover:bg-muted/50 group text-right',
                  !item.isRead && 'bg-[#C9A449]/5 border-r-2 border-r-[#C9A449]',
                )}
              >
                <div
                  className={cn(
                    'w-7 h-7 rounded-lg shrink-0 flex items-center justify-center mt-0.5',
                    item.type === 'poa_expiring'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'bg-[#C9A449]/15 text-[#C9A449]',
                  )}
                >
                  <FileWarning className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <p
                      className={cn(
                        'text-xs leading-snug truncate',
                        !item.isRead ? 'font-bold text-foreground' : 'font-medium text-foreground/80',
                      )}
                    >
                      {item.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatArabicRelativeTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                    {item.body}
                  </p>
                  {item.relatedRecordType === 'poa' && (
                    <div className="flex items-center gap-1 text-[10px] text-[#C9A449] font-medium pt-0.5 group-hover:underline">
                      <span>عرض تفاصيل الوكالة</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </div>
                  )}
                </div>
                {!item.isRead && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C9A449] shrink-0 mt-2" />
                )}
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

