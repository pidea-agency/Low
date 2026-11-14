import React from 'react';
import { useLocation } from 'wouter';
import { useGetCurrentUser, useLogout } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { NotificationsDropdown } from './notifications/notifications-dropdown';
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
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const logoutMutation = useLogout();
  const { data: currentUser } = useGetCurrentUser();
  const user = currentUser as any;

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';

  const userDisplayName = user?.displayName || user?.name || user?.username || 'أ. عبدالله المنصوري';
  const officeName = user?.officeName || user?.office_name || 'مكتب المحاماة الرئيسي';
  const roleLabel = isSuperAdmin
    ? 'المشرف العام'
    : isAdmin
    ? 'مدير المكتب'
    : 'محامٍ ممارس';

  const avatarInitial = userDisplayName.charAt(0).toUpperCase() || 'A';

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = isSuperAdmin ? '/admin/login' : '/login';
      },
    });
  };

  const openSearch = () => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        ctrlKey: true,
        bubbles: true,
      })
    );
  };

  return (
    <header
      className="w-full h-16 shrink-0 flex items-center justify-between px-4 sm:px-6 z-40 select-none bg-white/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-[#eff4ff] text-[#0b1c30]"
      dir="rtl"
    >
      {/* ── Right side: Search Input + AI Assistant Button ── */}
      <div className="flex items-center gap-3 w-full max-w-lg">
        {/* Search Input Container */}
        <div className="relative w-full max-w-md hidden sm:block">
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#757682] text-lg">
            search
          </span>
          <input
            type="text"
            onClick={openSearch}
            readOnly
            placeholder="بحث في القضايا، الموكلين، الجلسات، أو الوثائق..."
            className="w-full h-10 pr-9 pl-16 rounded-lg bg-[#eff4ff] text-xs font-normal text-[#0b1c30] placeholder:text-[#757682] border border-transparent focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] transition-all cursor-pointer"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#dce9ff] text-[#444651]">
            Ctrl + K
          </span>
        </div>

        {/* AI Assistant Button */}
        <button
          onClick={() => setLocation('/chat')}
          className="flex items-center gap-1.5 px-3.5 h-9 rounded-lg bg-[#00236f] hover:bg-[#1e3a8a] text-white transition-all shadow-sm shrink-0 font-medium text-xs cursor-pointer"
          title="مساعد الذكاء الاصطناعي"
        >
          <span className="material-symbols-outlined text-base text-amber-300">auto_awesome</span>
          <span className="hidden md:inline">مساعد الذكاء الاصطناعي</span>
        </button>
      </div>

      {/* ── Left side: Office Switcher, Notifications, User Profile ── */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Office Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#eff4ff] cursor-pointer hover:bg-[#dce9ff] transition-colors text-xs">
              <span className="material-symbols-outlined text-base text-[#00236f]">account_balance</span>
              <span className="text-[#0b1c30] font-medium">{officeName}</span>
              <span className="material-symbols-outlined text-sm text-[#757682]">expand_more</span>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 text-right font-sans text-xs">
            <DropdownMenuLabel>المكاتب والصلاحيات</DropdownMenuLabel>
            <DropdownMenuItem className="font-semibold text-[#00236f]">
              {officeName} (الافتراضي)
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onClick={() => setLocation('/settings')}>
                إعدادات المكتب والربط
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications Dropdown */}
        <NotificationsDropdown
          buttonClassName="relative p-2 rounded-lg text-[#444651] hover:bg-[#dce9ff] hover:text-[#0b1c30] transition-colors cursor-pointer border-0"
        />

        {/* Vertical Divider */}
        <div className="h-6 w-px bg-[#dce9ff]"></div>

        {/* User Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center gap-2 cursor-pointer p-1 rounded-lg hover:bg-[#eff4ff] transition-colors">
              <div className="w-8 h-8 rounded-full bg-[#dce1ff] text-[#00236f] flex items-center justify-center font-bold text-xs shrink-0">
                {avatarInitial}
              </div>
              <div className="flex flex-col text-right leading-tight">
                <span className="text-xs font-semibold text-[#0b1c30]">{userDisplayName}</span>
                <span className="text-[11px] text-[#757682]">{roleLabel}</span>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className="w-56 text-right font-sans text-xs p-1.5">
            <DropdownMenuLabel className="p-2 border-b border-[#eff4ff] mb-1">
              <div className="font-bold text-sm text-[#0b1c30] truncate">{userDisplayName}</div>
              <div className="text-[11px] text-[#757682] font-medium truncate mt-0.5">{roleLabel}</div>
            </DropdownMenuLabel>
            {isAdmin && (
              <>
                <DropdownMenuItem onClick={() => setLocation('/subscription')} className="p-2 cursor-pointer">
                  الاشتراك والحصص
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation('/settings')} className="p-2 cursor-pointer">
                  الإعدادات والربط
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-[#eff4ff]" />
              </>
            )}
            <DropdownMenuItem
              onClick={handleLogout}
              className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer rounded-lg"
            >
              تسجيل الخروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
