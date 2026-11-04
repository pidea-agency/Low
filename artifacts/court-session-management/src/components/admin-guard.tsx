import React from 'react';
import { RequireRole } from './require-role';

interface GuardProps {
  children: React.ReactNode;
}

export function SuperAdminGuard({ children }: GuardProps) {
  return (
    <RequireRole
      roles={['super_admin']}
      fallbackUrl="/admin/login"
      forbiddenMessage="هذا القسم مخصص لمشرفي المنصة فقط (Super Admin)."
    >
      {children}
    </RequireRole>
  );
}

export function AdminGuard({ children }: GuardProps) {
  return (
    <RequireRole
      roles={['admin']}
      fallbackUrl="/login"
      forbiddenMessage="هذا القسم مخصص لمدير المكتب (Admin)."
    >
      {children}
    </RequireRole>
  );
}

export function AdminOrSuperGuard({ children }: GuardProps) {
  return (
    <RequireRole
      roles={['admin', 'super_admin']}
      fallbackUrl="/admin/login"
      forbiddenMessage="هذا القسم يتطلب صلاحيات إدارية."
    >
      {children}
    </RequireRole>
  );
}
