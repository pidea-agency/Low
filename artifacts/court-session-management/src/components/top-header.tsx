import React from 'react';
import { useLocation } from 'wouter';
import {
  Bell,
  MessageSquare,
  Search,
  ChevronDown,
  User,
  LogOut,
  ShieldAlert,
  Building2,
  Scale,
  Sun,
  Moon,
} from 'lucide-react';
import { useGetCurrentUser, useLogout } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/components/theme-provider';
import { NotificationsDropdown } from './notifications/notifications-dropdown';
import { GlobalSearch } from './global-search';
import { THEME_COLORS } from '@/config/theme';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TopHeaderProps {
  title?: string;
  onOpenMobileMenu?: () => void;
}

export function TopHeader({ title, onOpenMobileMenu }: TopHeaderProps) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const logoutMutation = useLogout();
  const { theme, setTheme } = useTheme();
  const { data: currentUser } = useGetCurrentUser();
  const user = currentUser as any;

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff';

  const username = user?.username || user?.display_name || 'المستخدم';
  const officeName = user?.officeName || user?.office_name || (isAdmin ? 'مكتب المحاماة' : 'المكتب');
  const roleLabel = isSuperAdmin
    ? 'المشرف العام'
    : isAdmin
    ? 'مدير النظام'
    : `محامٍ لدى ${officeName}`;

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = isSuperAdmin ? '/admin/login' : '/login';
      },
    });
  };

  return (
    <header
      className="w-full h-16 shrink-0 flex items-center justify-between px-4 sm:px-6 z-20 text-white select-none border-b border-[#071D34]"
      style={{
        background: `linear-gradient(90deg, ${THEME_COLORS.deepNavy} 0%, ${THEME_COLORS.primaryNavy} 100%)`,
      }}
      dir="rtl"
    >
      {/* ── Right side: Global Search ── */}
      <div className="flex items-center gap-3 min-w-0 flex-1 max-w-md">
        <GlobalSearch
          className="bg-white/10 hover:bg-white/15 text-white placeholder:text-white/60 border border-white/15 rounded-xl h-10 text-xs w-full focus:border-[#C99732] focus:ring-1 focus:ring-[#C99732]"
        />
      </div>

      {/* ── Left side: Quick actions + User Profile ── */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Chat / Messages Button */}
        <button
          onClick={() => setLocation('/chat')}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer relative"
          title="المحادثة والمساعد الذكي"
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        {/* Notifications Dropdown */}
        <NotificationsDropdown
          buttonClassName="text-white/80 hover:text-white hover:bg-white/10 border-0 h-9 w-9 rounded-xl"
        />

        {/* Vertical Divider */}
        <div className="h-6 w-px bg-white/15 hidden sm:block" />

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer text-right group">
              <div className="w-9 h-9 rounded-full bg-white/15 border border-white/20 flex items-center justify-center shrink-0 text-white group-hover:border-[#C99732] transition-colors">
                <User className="w-4 h-4 text-[#FFF4DE]" />
              </div>
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-bold text-white leading-tight truncate max-w-[130px]">
                  {username}
                </span>
                <span className="text-[10px] text-[#D6E0EC]/80 leading-tight truncate max-w-[130px]">
                  {roleLabel}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-white/60 group-hover:text-white transition-colors" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-56 text-right font-sans">
            <DropdownMenuLabel className="font-bold text-xs text-[#10233F]">
              <div className="truncate font-bold">{username}</div>
              <div className="text-[10px] text-[#64748B] font-normal truncate mt-0.5">{roleLabel}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="gap-2 cursor-pointer text-xs"
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-4 h-4 text-[#64748B]" />
                  <span>الوضع الداكن</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 text-[#C99732]" />
                  <span>الوضع الفاتح</span>
                </>
              )}
            </DropdownMenuItem>

            {isAdmin && (
              <DropdownMenuItem
                onClick={() => setLocation('/settings')}
                className="gap-2 cursor-pointer text-xs"
              >
                <Building2 className="w-4 h-4 text-[#64748B]" />
                <span>إعدادات المكتب</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              className="gap-2 text-rose-600 focus:text-rose-600 focus:bg-rose-50 cursor-pointer text-xs font-bold"
            >
              <LogOut className="w-4 h-4" />
              <span>{logoutMutation.isPending ? 'جارٍ تسجيل الخروج...' : 'تسجيل الخروج'}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
