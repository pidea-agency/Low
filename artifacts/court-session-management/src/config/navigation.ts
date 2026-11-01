import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  MessageSquare,
  Calendar,
  FileText,
  ShieldCheck,
  Gavel,
  CheckSquare,
  Shield,
  Settings,
} from 'lucide-react';
import {
  APP_NAVIGATION_CONFIG,
  getNavItemsForRole as getNavConfigsForRole,
  isRouteAllowedForRole,
  evaluateRoleGuardState,
  type UserRole,
  type RoleGuardState,
} from '@workspace/api-zod';

export type { UserRole, RoleGuardState };
export { isRouteAllowedForRole, evaluateRoleGuardState };

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  MessageSquare,
  Calendar,
  FileText,
  ShieldCheck,
  Gavel,
  CheckSquare,
  Shield,
  Settings,
};

export interface AppNavItem {
  id: string;
  name: string;
  path: string;
  icon: LucideIcon;
  roles: UserRole[];
  keywords: string;
  category: 'main' | 'admin';
}

export const APP_NAVIGATION_ITEMS: AppNavItem[] = APP_NAVIGATION_CONFIG.map((item) => ({
  ...item,
  icon: ICON_MAP[item.iconName] || LayoutDashboard,
}));

export function getNavItemsForRole(role?: string | null): AppNavItem[] {
  const configs = getNavConfigsForRole(role);
  return configs.map((c) => ({
    ...c,
    icon: ICON_MAP[c.iconName] || LayoutDashboard,
  }));
}
