import React from 'react';
import { Link, useLocation } from 'wouter';
import {
  useLogout,
  useGetCurrentUser,
  useGetDashboardStats,
} from '@workspace/api-client-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useSidebarCollapse } from '@/context/sidebar-context';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  LayoutDashboard,
  CalendarCheck,
  ClipboardList,
  Sparkles,
  FolderOpen,
  ShieldCheck,
  Users,
  Scale,
  UserCheck,
  CreditCard,
  Sliders,
  Landmark,
  Gavel,
  LogOut,
  Pin,
  PinOff,
  PanelRightClose,
  FileSpreadsheet,
  ExternalLink,
} from 'lucide-react';

interface SidebarProps {
  onNavigate?: () => void;
  forceExpanded?: boolean;
}

interface NavItem {
  id: string;
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeType?: 'orange' | 'ai';
  isExternal?: boolean;
}

interface NavSection {
  id: string;
  title: string;
  visible: boolean;
  items: NavItem[];
}

interface CurrentUser {
  role?: 'super_admin' | 'admin' | 'lawyer' | string;
  officeName?: string;
  office_name?: string;
  displayName?: string;
  name?: string;
  username?: string;
}

function getCurrentJudicialYearLabel(): string {
  try {
    const hijriYearStr = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      year: 'numeric',
    }).format(new Date());
    const hijriYear = parseInt(hijriYearStr, 10);
    if (!Number.isNaN(hijriYear)) {
      return `${hijriYear}-${hijriYear + 1}`;
    }
  } catch {
    // Fallback to Gregorian year if Islamic calendar formatter is unavailable
  }

  const gregorianYear = new Date().getFullYear();
  return `${gregorianYear}-${gregorianYear + 1}`;
}

export function Sidebar({
  onNavigate,
  forceExpanded = false,
}: SidebarProps) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const logoutMutation = useLogout();
  const { data: currentUser } = useGetCurrentUser();
  const { data: statsData } = useGetDashboardStats();

  const user = (currentUser ?? null) as CurrentUser | null;

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
  const canManageOffice = isAdmin || isSuperAdmin;

  const { data: googleBinding } = useQuery({
    queryKey: ['google-binding-sidebar'],
    queryFn: async () => {
      const res = await fetch('/api/settings/google-binding');
      if (!res.ok) return null;
      return res.json() as Promise<{
        is_connected?: boolean;
        spreadsheet_id?: string | null;
        sheet_name?: string | null;
      }>;
    },
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const hasConnectedSheet = Boolean(isAdmin && googleBinding?.is_connected && googleBinding?.spreadsheet_id);
  const cleanSpreadsheetId = googleBinding?.spreadsheet_id ? googleBinding.spreadsheet_id.trim() : '';
  const googleSheetUrl = hasConnectedSheet
    ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(cleanSpreadsheetId)}/edit`
    : '/settings';

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
    '';

  const judicialYearLabel = getCurrentJudicialYearLabel();

  const sessionsCount =
    typeof statsData?.todayHearings === 'number' && statsData.todayHearings > 0
      ? statsData.todayHearings
      : 0;

  const handleLogout = () => {
    onNavigate?.();

    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation(isSuperAdmin ? '/admin/login' : '/login');
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

  const navSections: NavSection[] = [
    {
      id: 'main',
      title: 'القسم الرئيسي',
      visible: true,
      items: [
        {
          id: 'dashboard',
          name: 'لوحة التحكم',
          path: '/dashboard',
          icon: LayoutDashboard,
        },
        {
          id: 'sessions',
          name: 'الجلسات والمواعيد',
          path: '/sessions',
          icon: CalendarCheck,
          badge: sessionsCount > 0 ? String(sessionsCount) : undefined,
          badgeType: 'orange',
        },
        {
          id: 'tasks',
          name: 'المهام الإجرائية',
          path: '/tasks',
          icon: ClipboardList,
        },
        {
          id: 'chat',
          name: 'تحليل الرسائل الذكي',
          path: '/chat',
          icon: Sparkles,
          badge: 'AI',
          badgeType: 'ai',
        },
      ],
    },
    {
      id: 'records',
      title: 'سجلات المكتب',
      visible: true,
      items: [
        {
          id: 'cases',
          name: 'ملفات القضايا',
          path: '/cases',
          icon: FolderOpen,
        },
        {
          id: 'poa',
          name: 'الوكالات الشرعية',
          path: '/poa',
          icon: ShieldCheck,
        },
        {
          id: 'clients',
          name: 'العملاء والموكلين',
          path: '/clients',
          icon: Users,
        },
        {
          id: 'judgments',
          name: 'الأحكام القضائية',
          path: '/judgments',
          icon: Scale,
        },
      ],
    },
    {
      id: 'management',
      title: 'إدارة المكتب',
      visible: canManageOffice,
      items: [
        {
          id: 'office_members',
          name: 'أعضاء الفريق',
          path: '/users',
          icon: UserCheck,
        },
        {
          id: 'subscription',
          name: 'الاشتراك والحصص',
          path: '/subscription',
          icon: CreditCard,
        },
        {
          id: 'settings',
          name: 'الإعدادات والربط',
          path: '/settings',
          icon: Sliders,
        },
        ...(isAdmin
          ? [
              {
                id: 'google_sheet',
                name: 'فتح جدول البيانات',
                path: googleSheetUrl,
                icon: FileSpreadsheet,
                isExternal: hasConnectedSheet,
              },
            ]
          : []),
      ],
    },
  ];

  const isItemActive = (path: string) =>
    path === '/'
      ? location === '/'
      : location === path || location.startsWith(`${path}/`);

  const renderNavItem = (item: NavItem) => {
    const active = isItemActive(item.path);
    const Icon = item.icon;

    const linkClasses = [
      'flex items-center rounded-lg text-xs transition-all duration-150',
      isExpanded
        ? 'justify-between px-2.5 py-2 w-full'
        : 'w-10 h-10 justify-center p-0 mx-auto',
      active
        ? 'bg-[#00236f] text-white shadow-xs font-semibold'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground font-medium',
    ].join(' ');

    const iconClasses = [
      'w-4 h-4 shrink-0',
      active
        ? 'text-white'
        : item.id === 'chat'
          ? 'text-[#00236f]'
          : 'text-muted-foreground',
    ].join(' ');

    const linkElement = item.isExternal ? (
      <a
        key={item.id}
        href={item.path}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onNavigate?.()}
        data-testid={`nav-${isExpanded ? '' : 'collapsed-'}${item.id}`}
        className={linkClasses}
      >
        <div
          className={`flex items-center gap-2.5 min-w-0 ${
            !isExpanded ? 'justify-center' : ''
          }`}
        >
          <Icon className={iconClasses} />
          {isExpanded && <span className="truncate text-xs">{item.name}</span>}
        </div>

        {isExpanded && (
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-70" />
        )}
      </a>
    ) : (
      <Link
        key={item.path}
        href={item.path}
        onClick={() => onNavigate?.()}
        data-testid={`nav-${isExpanded ? '' : 'collapsed-'}${item.id}`}
        className={linkClasses}
      >
        <div
          className={`flex items-center gap-2.5 min-w-0 ${
            !isExpanded ? 'justify-center' : ''
          }`}
        >
          <Icon className={iconClasses} />
          {isExpanded && <span className="truncate text-xs">{item.name}</span>}
        </div>

        {isExpanded && item.badge && (
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
              active
                ? 'bg-white/20 text-white'
                : item.badgeType === 'orange'
                  ? 'bg-[#00236f] text-white'
                  : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    );

    if (isExpanded) {
      return linkElement;
    }

    return (
      <Tooltip key={item.path}>
        <TooltipTrigger asChild>{linkElement}</TooltipTrigger>
        <TooltipContent side="left">{item.name}</TooltipContent>
      </Tooltip>
    );
  };

  const visibleSections = navSections.filter((section) => section.visible);

  return (
    <aside
      dir="rtl"
      onMouseEnter={() => !forceExpanded && !isPinned && setIsHovered(true)}
      onMouseLeave={() => !forceExpanded && setIsHovered(false)}
      className={`h-full relative z-30 flex flex-col justify-between bg-background text-foreground border-l border-border shadow-xs transition-all duration-200 ease-in-out ${
        isExpanded ? 'w-72' : 'w-[70px]'
      }`}
    >
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Header / Brand */}
        <div
          className={`h-16 shrink-0 flex items-center ${
            isExpanded ? 'px-4 justify-between' : 'px-2 justify-center'
          }`}
        >
          {isExpanded ? (
            <>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#00236f] flex items-center justify-center text-white shrink-0 shadow-xs">
                  <Landmark className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0 text-right">
                  <span className="font-bold text-sm text-[#00236f] truncate leading-tight">
                    {officeName}
                  </span>
                  <span className="text-[11px] text-[#00236f] font-semibold truncate mt-0.5">
                    {roleLabel}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!forceExpanded && (
                  <button
                    type="button"
                    onClick={togglePin}
                    title={isPinned ? 'إلغاء تثبيت القائمة' : 'تثبيت القائمة'}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    {isPinned ? (
                      <PinOff className="w-3.5 h-3.5" />
                    ) : (
                      <Pin className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={toggleCollapse}
              title="توسيع القائمة"
              className="w-10 h-10 rounded-lg bg-[#00236f] flex items-center justify-center text-white shadow-xs"
            >
              <Landmark className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Judicial Year Badge */}
        {isExpanded && (
          <div className="px-4 py-2 shrink-0">
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-muted text-muted-foreground">
              <span className="text-xs font-medium">
                السنة القضائية {judicialYearLabel}
              </span>
              <Gavel className="w-3.5 h-3.5 text-[#00236f]" />
            </div>
          </div>
        )}

        {/* Navigation Sections */}
        <div
          className={`flex-1 min-h-0 overflow-y-auto py-2 ${
            isExpanded ? 'px-3 space-y-3' : 'px-2 flex flex-col items-center gap-2'
          }`}
        >
          {visibleSections.map((section, sectionIndex) => (
            <React.Fragment key={section.id}>
              {!isExpanded && sectionIndex > 0 && (
                <div className="w-6 h-px bg-border my-1" />
              )}

              <div
                className={
                  isExpanded
                    ? 'w-full'
                    : 'flex flex-col items-center gap-1.5 w-full'
                }
              >
                {isExpanded && (
                  <span className="text-[11px] font-semibold text-muted-foreground px-2 mb-1 block">
                    {section.title}
                  </span>
                )}

                <nav
                  className={
                    isExpanded
                      ? 'space-y-1'
                      : 'flex flex-col items-center gap-1.5 w-full'
                  }
                >
                  {section.items.map(renderNavItem)}
                </nav>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Footer: Current User & Logout */}
      <div className="border-t border-border p-2.5 shrink-0">
        {isExpanded ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-right">
              {userDisplayName && (
                <p className="text-xs font-semibold text-foreground truncate">
                  {userDisplayName}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground truncate">
                {roleLabel}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              title="تسجيل الخروج"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={toggleCollapse}
              title="توسيع القائمة"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={logoutMutation.isPending}
                  aria-label="تسجيل الخروج"
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">تسجيل الخروج</TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>
    </aside>
  );
}