import React from 'react';
import { RequireRole } from './require-role';

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  return (
    <RequireRole roles={['admin']} fallbackUrl="/admin/login">
      {children}
    </RequireRole>
  );
}
