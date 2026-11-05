import { Link, useLocation } from 'wouter';
import { Moon, Sun, LogOut, Scale } from 'lucide-react';
import { useTheme } from './theme-provider';
import { useLogout, useGetCurrentUser } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { clearUserPoaStorage, hasPendingPoaRecords } from '@/lib/poa-storage';
import { useToast } from '@/hooks/use-toast';
import { GlobalSearch } from './global-search';
import { getNavItemsForRole } from '@/config/navigation';
import { NotificationsDropdown } from './notifications/notifications-dropdown';

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const logoutMutation = useLogout();
  const { data: currentUser } = useGetCurrentUser();
  const user = currentUser as any;

  const handleLogout = () => {
    onNavigate?.();
    const userId = currentUser?.id || (currentUser as any)?.userId;
    const officeId = (currentUser as any)?.officeId || userId;

    if (officeId && userId && hasPendingPoaRecords(officeId, userId)) {
      const confirmed = window.confirm('لديك وكالات غير محفوظة بعد. تسجيل الخروج سيحذفها.');
      if (!confirmed) {
        return;
      }
    }

    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        clearUserPoaStorage(officeId, userId);
        queryClient.clear();
        window.location.href = '/login';
      },
      onError: () => {
        toast({
          title: 'خطأ',
          description: 'فشل تسجيل الخروج',
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <div
      className="flex flex-col h-full sidebar-gradient"
      style={{
        background: theme === 'dark'
          ? 'linear-gradient(165deg, #222819 0%, #1A1F13 60%, #14170E 100%)'
          : 'linear-gradient(165deg, #3F4A2C 0%, #353E24 60%, #2A321D 100%)',
        borderInlineStart: theme === 'dark'
          ? '1px solid rgba(255,255,255,0.06)'
          : '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Logo/Brand */}
      <div
        className="p-4 space-y-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Icon badge */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: '#C9A449',
                boxShadow: '0 2px 6px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.3)',
              }}
            >
              <Scale className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs font-bold text-white leading-tight truncate">
                إدارة جلسات المحكمة
              </h1>
              <p className="text-[10px] mt-0.5" style={{ color: '#C9A449' }}>
                بوابة المحامي
              </p>
            </div>
          </div>
          <NotificationsDropdown />
        </div>

        {/* Global Search Button */}
        <GlobalSearch />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto sidebar-scrollbar">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest px-3 py-2"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          القائمة الرئيسية
        </p>

        {getNavItemsForRole(user?.role).map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => onNavigate?.()}
              data-testid={`nav-${item.path === '/' ? 'dashboard' : item.path.slice(1)}`}
            >
              <div
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-[#C9A449] text-white shadow-xs'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
                style={
                  isActive
                    ? {
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 8px rgba(0,0,0,0.25)',
                      }
                    : undefined
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-start">{item.name}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer actions */}
      <div
        className="p-3 space-y-1"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer text-white/70 hover:bg-white/10 hover:text-white"
          data-testid="button-toggle-theme"
        >
          {theme === 'light' ? (
            <>
              <Moon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-start">الوضع الداكن</span>
            </>
          ) : (
            <>
              <Sun className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-start">الوضع الفاتح</span>
            </>
          )}
        </button>

        <button
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer disabled:opacity-40 text-amber-100/70 hover:bg-rose-500/15 hover:text-rose-200 group"
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 shrink-0 text-rose-400/80 group-hover:text-rose-300 transition-colors" />
          <span className="flex-1 text-start">
            {logoutMutation.isPending ? 'جارٍ الخروج...' : 'تسجيل الخروج'}
          </span>
        </button>
      </div>
    </div>
  );
}
