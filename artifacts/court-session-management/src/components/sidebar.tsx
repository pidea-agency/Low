import React from 'react';
import { Link, useLocation } from 'wouter';
import { useLogout, useGetCurrentUser, useGetDashboardStats } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useSidebarCollapse } from '@/context/sidebar-context';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface SidebarProps {
  onNavigate?: () => void;
  forceExpanded?: boolean;
}

export function Sidebar({
  onNavigate,
  forceExpanded = false,
}: SidebarProps) {
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const logoutMutation = useLogout();
  const { data: currentUser } = useGetCurrentUser();
  const { data: statsData } = useGetDashboardStats();
  const user = currentUser as any;

  const {
    isPinned,
    isHovered,
    togglePin,
    setIsHovered,
    toggleCollapse,
  } = useSidebarCollapse();

  const isExpanded = forceExpanded ? true : isPinned || isHovered;

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin = user?.role === 'admin';

  const officeName =
    user?.officeName ||
    user?.office_name ||
    'مكتب المحاماة الرئيسي';

  const roleLabel = isSuperAdmin
    ? 'المشرف العام'
    : isAdmin
      ? 'مدير المكتب - Office Admin'
      : 'محامٍ ممارس';

  const userDisplayName =
    user?.displayName ||
    user?.name ||
    user?.username ||
    'أ. عبدالله المنصوري';

  const handleLogout = () => {
    onNavigate?.();

    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = isSuperAdmin
          ? '/admin/login'
          : '/login';
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

  const totalSessionsCount = statsData?.todayHearings !== undefined 
    ? (statsData.todayHearings > 0 ? statsData.todayHearings : (statsData.upcomingHearings || 16))
    : 16;

  const mainNavItems = [
    {
      id: 'dashboard',
      name: 'لوحة التحكم',
      path: '/',
      icon: 'dashboard',
    },
    {
      id: 'sessions',
      name: 'الجلسات والمواعيد',
      path: '/sessions',
      icon: 'event_available',
      badge: String(totalSessionsCount),
      badgeType: 'orange',
    },
    {
      id: 'tasks',
      name: 'المهام الإجرائية',
      path: '/tasks',
      icon: 'assignment',
    },
    {
      id: 'chat',
      name: 'تحليل الرسائل الذكي',
      path: '/chat',
      icon: 'neurology',
      badge: 'AI',
      badgeType: 'ai',
    },
  ];

  const recordsNavItems = [
    {
      id: 'cases',
      name: 'ملفات القضايا',
      path: '/cases',
      icon: 'folder_open',
    },
    {
      id: 'poa',
      name: 'الوكالات الشرعية',
      path: '/poa',
      icon: 'verified_user',
    },
    {
      id: 'clients',
      name: 'العملاء والموكلين',
      path: '/clients',
      icon: 'group',
    },
    {
      id: 'judgments',
      name: 'الأحكام القضائية',
      path: '/judgments',
      icon: 'history_edu',
    },
  ];

  const managementNavItems = [
    {
      id: 'office_members',
      name: 'أعضاء الفريق',
      path: '/users',
      icon: 'badge',
    },
    {
      id: 'subscription',
      name: 'الاشتراك والحصص',
      path: '/subscription',
      icon: 'credit_card',
    },
    {
      id: 'settings',
      name: 'الإعدادات والربط',
      path: '/settings',
      icon: 'tune',
    },
  ];

  const isItemActive = (path: string) =>
    path === '/'
      ? location === '/'
      : location === path || location.startsWith(path + '/');

  const renderNavItem = (item: any, collapsed = false) => {
    const active = isItemActive(item.path);

    const content = (
      <Link
        href={item.path}
        onClick={() => onNavigate?.()}
        data-testid={`nav-${collapsed ? 'collapsed-' : ''}${item.id}`}
        className={`
          flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150
          ${
            active
              ? 'bg-[#00236f] text-white shadow-xs'
              : 'text-[#444651] hover:bg-[#dce9ff]/60 hover:text-[#0b1c30]'
          }
          ${collapsed ? 'w-10 h-10 min-h-0 justify-center p-0 mx-auto' : 'w-full'}
        `}
      >
        <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'justify-center' : ''}`}>
          <span
            className={`material-symbols-outlined text-lg shrink-0 ${
              active
                ? 'text-white'
                : item.id === 'chat'
                  ? 'text-[#9b4500]'
                  : 'text-[#757682]'
            }`}
          >
            {item.icon}
          </span>
          {!collapsed && (
            <span className="truncate text-xs">{item.name}</span>
          )}
        </div>

        {!collapsed && item.badge && (
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
              active
                ? 'bg-white/20 text-white'
                : item.badgeType === 'orange'
                  ? 'bg-[#fd8a42] text-white'
                  : 'bg-[#dae2fd] text-[#131b2e]'
            }`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    );

    if (!collapsed) return content;

    return (
      <Tooltip key={item.path}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="left">
          {item.name}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <aside
      dir="rtl"
      onMouseEnter={() => !forceExpanded && setIsHovered(true)}
      onMouseLeave={() => !forceExpanded && setIsHovered(false)}
      className={`
        h-full relative z-30 flex flex-col justify-between
        bg-white text-[#0b1c30]
        border-l border-[#e5eeff]
        shadow-[0_1px_8px_rgba(0,0,0,0.04)]
        transition-all duration-200 ease-in-out
        ${
          isExpanded
            ? 'w-72'
            : 'w-[70px]'
        }
      `}
    >
      {isExpanded ? (
        <div className="flex flex-col h-full overflow-hidden justify-between">
          <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
            {/* Header / Brand */}
            <div className="h-16 px-4 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#00236f] flex items-center justify-center text-white shrink-0 shadow-xs">
                  <span className="material-symbols-outlined text-lg">account_balance</span>
                </div>
                <div className="flex flex-col min-w-0 text-right">
                  <span className="font-bold text-sm text-[#00236f] truncate leading-tight">
                    {officeName}
                  </span>
                  <span className="text-[11px] text-[#9b4500] font-semibold truncate mt-0.5">
                    {roleLabel}
                  </span>
                </div>
              </div>

              <span className="text-xs font-bold text-[#00236f]">
                LegalTech
              </span>
            </div>

            {/* Judicial Year Badge Chip */}
            <div className="px-4 py-2 shrink-0">
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#eff4ff] text-[#444651]">
                <span className="text-xs font-medium">السنة القضائية 1446-1447</span>
                <span className="material-symbols-outlined text-sm text-[#00236f]">gavel</span>
              </div>
            </div>

            {/* Navigation Lists */}
            <div className="px-3 py-1 space-y-3">
              {/* Section 1: Main Section */}
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#757682] px-2 mb-1 block">
                  القسم الرئيسي
                </span>
                <nav className="space-y-1">
                  {mainNavItems.map((item) => (
                    <React.Fragment key={item.path}>
                      {renderNavItem(item)}
                    </React.Fragment>
                  ))}
                </nav>
              </div>

              {/* Section 2: Office Records */}
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#757682] px-2 mb-1 block">
                  سجلات المكتب
                </span>
                <nav className="space-y-1">
                  {recordsNavItems.map((item) => (
                    <React.Fragment key={item.path}>
                      {renderNavItem(item)}
                    </React.Fragment>
                  ))}
                </nav>
              </div>

              {/* Section 3: Office Management */}
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#757682] px-2 mb-1 block">
                  إدارة المكتب
                </span>
                <nav className="space-y-1">
                  {managementNavItems.map((item) => (
                    <React.Fragment key={item.path}>
                      {renderNavItem(item)}
                    </React.Fragment>
                  ))}
                </nav>
              </div>
            </div>
          </div>

          {/* Bottom Area: Cloud Storage Meter */}
          <div className="shrink-0 p-3 bg-white">
            <div className="p-3 bg-[#eff4ff] rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-[#444651]">مساحة التخزين السحابي</span>
                <span className="text-xs font-bold text-[#00236f]">78%</span>
              </div>
              <div className="w-full bg-[#e5eeff] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#00236f] h-full rounded-full" style={{ width: '78%' }}></div>
              </div>
              <span className="text-[11px] text-[#757682] block mt-1 text-right">
                15.6 جيجابايت من 20 جيجابايت
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Collapsed Sidebar */
        <div className="flex flex-col h-full justify-between items-center py-3">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={toggleCollapse}
              className="w-10 h-10 rounded-lg bg-[#00236f] flex items-center justify-center text-white"
            >
              <span className="material-symbols-outlined text-lg">account_balance</span>
            </button>

            <nav className="flex flex-col items-center gap-1.5 mt-2">
              {mainNavItems.map((item) => (
                <React.Fragment key={item.path}>
                  {renderNavItem(item, true)}
                </React.Fragment>
              ))}
              <div className="w-6 h-px bg-slate-200 my-1" />
              {recordsNavItems.map((item) => (
                <React.Fragment key={item.path}>
                  {renderNavItem(item, true)}
                </React.Fragment>
              ))}
            </nav>
          </div>
        </div>
      )}
    </aside>
  );
}
