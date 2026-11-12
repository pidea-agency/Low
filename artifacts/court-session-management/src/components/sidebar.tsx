import React from 'react';
import { Link, useLocation } from 'wouter';
import { Moon, Sun, LogOut, Building2, Crown } from 'lucide-react';
import { useTheme } from './theme-provider';
import { useLogout, useGetCurrentUser } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { getNavItemsForRole } from '@/config/navigation';
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
        background: 'linear-gradient(180deg, #092038 0%, #06172A 50%, #030C16 100%)',
        borderInlineStart: '1px solid rgba(255, 255, 255, 0.08)',
      }}
      dir="rtl"
    >
      {/* ── Ambient Top Lighting ── */}
      <div
        className="absolute top-0 right-1/2 translate-x-1/2 w-48 h-32 pointer-events-none z-0 opacity-40 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(201, 151, 50, 0.25) 0%, transparent 70%)',
        }}
      />

      {/* ── Brand Header ── */}
      <div className="p-4 sm:p-5 flex flex-col items-center text-center border-b border-white/[0.08] relative z-10">
        <Link href="/" onClick={() => onNavigate?.()} className="flex flex-col items-center group cursor-pointer w-full">
          <div className="relative mb-2">
            <div className="absolute inset-0 bg-[#C99732]/20 rounded-full blur-md group-hover:blur-lg transition-all" />
            <ScalesLogoGraphic className="w-11 h-11 relative z-10 group-hover:scale-105 transition-transform" />
          </div>
          <h1 className="text-sm font-bold text-white leading-tight tracking-wide group-hover:text-slate-100 transition-colors">
            نظام إدارة جلسات المحكمة
          </h1>
          <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#C99732]/10 border border-[#C99732]/25 text-[11px] font-semibold text-[#E8C477]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E8C477] animate-pulse" />
            <span className="truncate max-w-[170px]">{isSuperAdmin ? 'بوابة المشرف العام' : officeName}</span>
          </div>
        </Link>

        {/* Lawyer Badge */}
        {isStaff && (
          <div className="mt-3 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[11px] text-slate-300 flex items-center gap-2 w-full justify-center">
            <Building2 className="w-3.5 h-3.5 text-[#E8C477] shrink-0" />
            <span className="truncate">محامٍ لدى: <strong className="text-white font-medium">{officeName}</strong></span>
          </div>
        )}
      </div>

      {/* ── Navigation Links ── */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto sidebar-scrollbar relative z-10">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400/80">
          التنقل السريع
        </div>

        {getNavItemsForRole(user?.role).map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={() => onNavigate?.()}
              data-testid={`nav-${item.path === '/' ? 'dashboard' : item.path.slice(1)}`}
              className="block"
            >
              <div
                className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-l from-[#C99732]/15 via-white/[0.06] to-white/[0.02] text-white font-semibold shadow-xs border border-[#C99732]/30'
                    : 'text-slate-300 hover:text-white hover:bg-white/[0.05] border border-transparent font-medium'
                }`}
              >
                {/* Refined Edge Accent Pill (Right edge in RTL) */}
                {isActive && (
                  <span
                    className="absolute -right-[1px] top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-l-full bg-gradient-to-b from-[#F2D794] via-[#C99732] to-[#996F19] shadow-[0_0_10px_rgba(232,196,119,0.8)]"
                    aria-hidden="true"
                  />
                )}

                {/* Icon with refined styling */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    isActive
                      ? 'bg-[#C99732]/25 text-[#F2D794] border border-[#C99732]/40 shadow-xs'
                      : 'text-slate-400 group-hover:text-slate-100 group-hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                </div>

                <span className="flex-1 text-start truncate">{item.name}</span>

                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E8C477]/80 shrink-0" />
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* ── Super Admin Crown Card ── */}
      {isSuperAdmin && (
        <div className="px-3 py-2 relative z-10">
          <div className="p-2.5 rounded-xl bg-white/[0.04] border border-[#C99732]/30 flex items-center gap-2.5 backdrop-blur-xs">
            <div className="w-8 h-8 rounded-lg bg-[#C99732]/20 border border-[#C99732]/50 flex items-center justify-center shrink-0 shadow-xs">
              <Crown className="w-4 h-4 text-[#E8C477]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white">Super Admin</div>
              <div className="text-[10px] text-[#E8C477] font-medium">صلاحيات كاملة</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Background Watermark: Classical Courthouse & Wave ── */}
      <div className="absolute bottom-0 right-0 left-0 pointer-events-none select-none opacity-20 z-0 overflow-hidden">
        <CourthouseSidebarGraphic />
      </div>

      {/* ── Footer Actions ── */}
      <div className="p-3 border-t border-white/[0.08] relative z-10 space-y-1 bg-[#030C16]/70 backdrop-blur-md">
        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-white/[0.06] hover:text-white transition-colors cursor-pointer group"
          data-testid="button-toggle-theme"
        >
          <div className="w-6 h-6 rounded-md flex items-center justify-center bg-white/[0.03] group-hover:bg-white/[0.08] transition-colors shrink-0">
            {theme === 'light' ? (
              <Moon className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200" />
            ) : (
              <Sun className="w-3.5 h-3.5 text-[#E8C477]" />
            )}
          </div>
          <span className="flex-1 text-start">
            {theme === 'light' ? 'الوضع الداكن' : 'الوضع الفاتح'}
          </span>
        </button>

        <button
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-rose-300/90 hover:bg-rose-500/15 hover:text-rose-100 transition-colors cursor-pointer disabled:opacity-40 group"
          data-testid="button-logout"
        >
          <div className="w-6 h-6 rounded-md flex items-center justify-center bg-rose-500/10 group-hover:bg-rose-500/20 transition-colors shrink-0">
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <span className="flex-1 text-start">
            {logoutMutation.isPending ? 'جارٍ الخروج...' : 'تسجيل الخروج'}
          </span>
        </button>
      </div>
    </div>
  );
}
