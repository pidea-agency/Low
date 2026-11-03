export type UserRole = "super_admin" | "admin" | "staff";

export interface NavItemConfig {
  id: string;
  name: string;
  path: string;
  iconName: string;
  roles: UserRole[];
  keywords: string;
  category: "main" | "admin";
}

/**
 * Single Source of Truth for all navigation and quick search pages in the application.
 * All items define which roles are allowed to access them.
 */
export const APP_NAVIGATION_CONFIG: NavItemConfig[] = [
  {
    id: "dashboard",
    name: "لوحة التحكم",
    path: "/",
    iconName: "LayoutDashboard",
    roles: ["admin", "staff"],
    keywords: "لوحة التحكم الرئيسية الإحصائيات dashboard home",
    category: "main",
  },
  {
    id: "chat",
    name: "تحليل رسالة",
    path: "/chat",
    iconName: "MessageSquare",
    roles: ["admin", "staff"],
    keywords: "تحليل رسالة محكمة جديدة استخراج الذكاء الاصطناعي chat ai",
    category: "main",
  },
  {
    id: "sessions",
    name: "جميع الجلسات",
    path: "/sessions",
    iconName: "Calendar",
    roles: ["admin", "staff"],
    keywords: "جميع الجلسات جلسات المحكمة مواعيد جدول استماع sessions",
    category: "main",
  },
  {
    id: "reports",
    name: "تقارير الجلسات",
    path: "/reports",
    iconName: "FileText",
    roles: ["admin", "staff"],
    keywords: "تقارير الجلسات تقرير طباعة تصدير ملخص reports",
    category: "main",
  },
  {
    id: "poa",
    name: "الوكالات",
    path: "/poa",
    iconName: "ShieldCheck",
    roles: ["admin", "staff"],
    keywords: "الوكالات الوكالة وكالة شرعية إدارة الوكالات توكيل تفويض poa attorney",
    category: "main",
  },
  {
    id: "judgments",
    name: "الأحكام",
    path: "/judgments",
    iconName: "Gavel",
    roles: ["admin", "staff"],
    keywords: "الأحكام الحكم أحكام قضائية صك صكوك قرارات دعاوى judgments",
    category: "main",
  },
  {
    id: "tasks",
    name: "المهام",
    path: "/tasks",
    iconName: "CheckSquare",
    roles: ["admin", "staff"],
    keywords: "المهام مهمة مهام واجبات جدول أعمال متابعة tasks",
    category: "main",
  },
  {
    id: "office_members",
    name: "أعضاء المكتب",
    path: "/users",
    iconName: "Users",
    roles: ["admin"],
    keywords: "أعضاء المكتب المحامين الفريق المساعدين users staff members",
    category: "admin",
  },
  {
    id: "settings",
    name: "إعدادات وربط Google Sheet",
    path: "/settings",
    iconName: "Settings",
    roles: ["admin"],
    keywords: "الإعدادات إعدادات الربط جوجل شيت معالج الربط settings google sheets",
    category: "admin",
  },
  {
    id: "super_admin_portal",
    name: "إدارة المكاتب والاشتراكات",
    path: "/super-admin",
    iconName: "ShieldAlert",
    roles: ["super_admin"],
    keywords: "إدارة المكاتب والاشتراكات سوبر أدمن المشرف العام super admin subscriptions",
    category: "admin",
  },
];

/**
 * Filter items by user role.
 * If user has no role or is unauthenticated, returns empty list.
 */
export function getNavItemsForRole(role?: string | null): NavItemConfig[] {
  if (!role) return [];
  return APP_NAVIGATION_CONFIG.filter((item) => item.roles.includes(role as UserRole));
}

/**
 * Checks whether a route path is permitted for the given role.
 */
export function isRouteAllowedForRole(path: string, role?: string | null): boolean {
  const item = APP_NAVIGATION_CONFIG.find((nav) => nav.path === path);
  if (!item) return true;
  if (!role) return false;
  return item.roles.includes(role as UserRole);
}

export type RoleGuardState = "LOADING" | "UNAUTHENTICATED" | "FORBIDDEN" | "ALLOWED";

/**
 * Evaluates role guard state without side-effects (used by RequireRole and tests).
 */
export function evaluateRoleGuardState({
  user,
  isLoading,
  isError,
  requiredRoles,
}: {
  user: { role?: string } | null | undefined;
  isLoading: boolean;
  isError: boolean;
  requiredRoles: UserRole[];
}): RoleGuardState {
  if (isLoading) {
    return "LOADING";
  }
  if (isError || !user || !user.role) {
    return "UNAUTHENTICATED";
  }
  if (!requiredRoles.includes(user.role as UserRole)) {
    return "FORBIDDEN";
  }
  return "ALLOWED";
}

