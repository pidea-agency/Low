import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useGetCurrentUser } from '@workspace/api-client-react';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  evaluateRoleGuardState,
  type UserRole,
} from '@/config/navigation';

export interface RequireRoleProps {
  roles: UserRole[];
  children: React.ReactNode;
  fallbackUrl?: string;
  forbiddenMessage?: string;
}

/**
 * Reusable route-level role guard.
 * Prevents unauthorized users from accessing restricted pages.
 * Shows loading spinner while verifying (no flash of admin content),
 * and shows a clear Arabic forbidden message if role check fails.
 */
export function RequireRole({
  roles,
  children,
  fallbackUrl = '/login',
  forbiddenMessage = 'ليس لديك صلاحية للوصول إلى هذه الصفحة.',
}: RequireRoleProps) {
  const [, navigate] = useLocation();
  const { data: user, isLoading, isError } = useGetCurrentUser();

  const state = evaluateRoleGuardState({
    user: user as any,
    isLoading,
    isError,
    requiredRoles: roles,
  });

  useEffect(() => {
    if (state === 'UNAUTHENTICATED') {
      navigate(fallbackUrl, { replace: true });
    }
  }, [state, fallbackUrl, navigate]);

  // 1. Loading state: never flash protected content
  if (state === 'LOADING') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background" dir="rtl">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-xs text-muted-foreground">جارٍ التحقق من الصلاحيات...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated: render nothing while redirect takes effect
  if (state === 'UNAUTHENTICATED') {
    return null;
  }

  // 3. Forbidden: show clear Arabic unauthorized message and never render children
  if (state === 'FORBIDDEN') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-center" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-4 text-destructive shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-2 text-foreground">غير مصرح بالوصول</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-md leading-relaxed" data-testid="text-forbidden-message">
          {forbiddenMessage}
        </p>
        <Button
          onClick={() => navigate('/')}
          className="gap-2 font-medium"
          data-testid="button-return-dashboard"
        >
          <ArrowRight className="w-4 h-4" />
          العودة إلى لوحة التحكم
        </Button>
      </div>
    );
  }

  // 4. Allowed: render children safely
  return <>{children}</>;
}

