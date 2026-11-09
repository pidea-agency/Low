import React from 'react';
import { Link, useLocation } from 'wouter';
import { Moon, Sun, LogOut, Building2, Crown, Sparkles } from 'lucide-react';
import { useTheme } from './theme-provider';
import { useLogout, useGetCurrentUser } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { getNavItemsForRole } from '@/config/navigation';
import { THEME_COLORS } from '@/config/theme';
import { ScalesLogoGraphic, CourthouseSidebarGraphic } from './courthouse-sidebar-graphic';

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
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isAdmin = currentUser?.role === 'admin';
  const isStaff = currentUser?.role === 'staff';
  const officeName = user?.officeName || user?.office_name || (isAdmin ? 'مكتب المحاماة' : 'المكتب');

  const handleLogout = () => {
    onNavigate?.();
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = isSuperAdmin ? '/admin/login' : '/login';
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
      className="flex flex-col h-full text-white relative overflow-hidden select-none"
      style={{
        background: `linear-gradient(180deg, ${THEME_COLORS.primaryNavy} 0%, ${THEME_COLORS.deepNavy} 70%, #041222 100%)`,
        borderInlineStart: '1px solid rgba(255,255,255,0.08)',
      }}
      dir="rtl"
    >
      {/* ── Brand Header ── */}
      <div className="p-4 sm:p-5 flex flex-col items-center text-center border-b border-white/10 relative z-10">
        <Link href="/" onClick={() => onNavigate?.()} className="flex flex-col items-center group cursor-pointer">
          <ScalesLogoGraphic className="w-12 h-12 mb-2 group-hover:scale-105 transition-transform" />
          <h1 className="text-sm font-black text-white leading-tight tracking-wide">
            نظام إدارة جلسات المحكمة
          </h1>
          <p className="text-[11px] font-semibold text-[#E8C477] mt-0.5">
            {isSuperAdmin ? 'بوابة المشرف العام' : officeName}
          </p>
        </Link>

        {/* Lawyer Badge */}
        {isStaff && (
          <div className="mt-3 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white/90 flex items-center gap-1.5 w-full justify-center">
            <Building2 className="w-3.5 h-3.5 text-[#C99732] shrink-0" />
            <span className="truncate">محامٍ لدى: <strong className="text-[#E8C477]">{officeName}</strong></span>
          </div>
        )}
      </div>

      {/* ── Navigation Links ── */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto sidebar-scrollbar relative z-10">
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
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-[#C99732] text-white shadow-md shadow-[#C99732]/30'
                    : 'text-[#D6E0EC] hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#D6E0EC]'}`} />
                <span className="flex-1 text-start truncate">{item.name}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* ── Super Admin Crown Card ── */}
      {isSuperAdmin && (
        <div className="px-3 py-2 relative z-10">
          <div className="p-3 rounded-xl bg-white/5 border border-[#C99732]/30 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C99732]/20 border border-[#C99732]/50 flex items-center justify-center shrink-0">
              <Crown className="w-4 h-4 text-[#E8C477]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white">Super Admin</div>
              <div className="text-[10px] text-[#E8C477]">صلاحيات كاملة</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Background Watermark: Classical Courthouse & Wave (no layout space) ── */}
      <div className="absolute bottom-0 right-0 left-0 pointer-events-none select-none opacity-30 z-0 overflow-hidden">
        <CourthouseSidebarGraphic />
      </div>

      {/* ── Footer Actions ── */}
      <div className="p-3 border-t border-white/10 relative z-10 space-y-1 bg-[#041222]/50 backdrop-blur-xs">
        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-[#D6E0EC] hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          data-testid="button-toggle-theme"
        >
          {theme === 'light' ? (
            <>
              <Moon className="w-4 h-4 shrink-0 text-[#64748B]" />
              <span className="flex-1 text-start">الوضع الداكن</span>
            </>
          ) : (
            <>
              <Sun className="w-4 h-4 shrink-0 text-[#E8C477]" />
              <span className="flex-1 text-start">الوضع الفاتح</span>
            </>
          )}
        </button>

        <button
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:bg-rose-500/20 hover:text-rose-100 transition-colors cursor-pointer disabled:opacity-40"
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 shrink-0 text-rose-400" />
          <span className="flex-1 text-start">
            {logoutMutation.isPending ? 'جارٍ الخروج...' : 'تسجيل الخروج'}
          </span>
        </button>
      </div>
    </div>
  );
}
