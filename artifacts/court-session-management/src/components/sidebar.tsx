import { Link, useLocation } from 'wouter';
import { LayoutDashboard, MessageSquare, Calendar, Moon, Sun, LogOut, Settings, Scale, FileText, ShieldCheck, Gavel, CheckSquare, Users, Sparkles, Shield, AlertTriangle, Database } from 'lucide-react';
import { useTheme } from './theme-provider';
import { useLogout, useGetCurrentUser } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { clearUserPoaStorage, hasPendingPoaRecords } from '@/lib/poa-storage';
import { useToast } from '@/hooks/use-toast';
import { GlobalSearch } from './global-search';
import { getNavItemsForRole } from '@/config/navigation';

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
        <div className="flex items-center gap-2.5">
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

        {/* Global Search Button */}
        <GlobalSearch />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
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
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer"
                style={
                  isActive
                    ? {
                        background: '#C9A449',
                        color: '#ffffff',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 8px rgba(0,0,0,0.25)',
                      }
                    : {
                        color: 'rgba(255,255,255,0.7)',
                      }
                }
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.1)';
                    (e.currentTarget as HTMLDivElement).style.color = '#ffffff';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLDivElement).style.background = '';
                    (e.currentTarget as HTMLDivElement).style.color = 'rgba(255,255,255,0.7)';
                  }
                }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.name}</span>
                {isActive && (
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: '#ffffff' }}
                  />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Subscription & Excel Drive Connection Info */}
      {user && (
        <div
          className="mx-3 mb-2 p-2.5 rounded-xl border space-y-1.5 text-xs"
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderColor: user.isExpired || user.isSuspended ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)',
          }}
        >
          {user.isExpired || user.isSuspended ? (
            <div className="space-y-1 text-red-300">
              <div className="flex items-center gap-1.5 font-bold text-[11px] text-red-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                <span>الاشتراك منتهي الصلاحية ❌</span>
              </div>
              <p className="text-[10px] leading-tight text-red-200/80">
                تم إيقاف المزامنة مع الإكسل والتقارير والذكاء الاصطناعي لحين التجديد.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {user.plan_tier === 'pro' ? 'باقة برو (Pro)' : 'باقة بلس (Plus)'}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                  {user.billing_cycle === 'monthly' ? 'شهري' : 'سنوي'}
                </span>
              </div>

              {user.role === 'admin' ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[10px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    <span>استهلاك ذكاء المكتب</span>
                    <span className="font-mono font-bold text-amber-300">
                      {user.ai_usage_count || 0} / {user.ai_quota_limit || 100}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.round(((user.ai_usage_count || 0) / (user.ai_quota_limit || 100)) * 100))}%`,
                        background: (user.ai_usage_count || 0) >= (user.ai_quota_limit || 100) ? '#ef4444' : '#C9A449',
                      }}
                    />
                  </div>
                  <Link
                    href="/subscription"
                    onClick={() => onNavigate?.()}
                    className="block text-center text-[10px] font-bold py-1 px-2 rounded-lg transition-colors hover:brightness-110"
                    style={{
                      background: 'rgba(201, 164, 73, 0.2)',
                      color: '#C9A449',
                      border: '1px solid rgba(201, 164, 73, 0.35)',
                    }}
                  >
                    إدارة الحصص والاستهلاك ←
                  </Link>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    <span>استهلاك الذكاء الاصطناعي</span>
                    <span className="font-mono font-bold text-amber-300">
                      {user.ai_usage_count || 0} / {user.ai_quota_limit ?? 'مشترك'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${user.ai_quota_limit ? Math.min(100, Math.round(((user.ai_usage_count || 0) / user.ai_quota_limit) * 100)) : Math.min(100, Math.round(((user.ai_usage_count || 0) / 100) * 100))}%`,
                        background: user.ai_quota_limit && (user.ai_usage_count || 0) >= user.ai_quota_limit ? '#ef4444' : '#C9A449',
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1 text-[10px] pt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <Database className="w-2.5 h-2.5 text-emerald-400" />
                <span>متصل مباشرة بـ Google Drive Sheets</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div
        className="p-3 space-y-1"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
          style={{ color: 'rgba(255,255,255,0.65)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)';
            (e.currentTarget as HTMLButtonElement).style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.65)';
          }}
          data-testid="button-toggle-theme"
        >
          {theme === 'light' ? (
            <>
              <Moon className="w-4 h-4 shrink-0" />
              الوضع الداكن
            </>
          ) : (
            <>
              <Sun className="w-4 h-4 shrink-0" />
              الوضع الفاتح
            </>
          )}
        </button>

        <button
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-40"
          style={{ color: 'rgba(255,180,180,0.8)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.18)';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(252,165,165,1)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,180,180,0.8)';
          }}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {logoutMutation.isPending ? 'جارٍ الخروج...' : 'تسجيل الخروج'}
        </button>
      </div>
    </div>
  );
}
