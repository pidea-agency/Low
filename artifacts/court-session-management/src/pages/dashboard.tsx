import React from 'react';
import { useGetCurrentUser } from '@workspace/api-client-react';
import { Redirect } from 'wouter';
import DashboardAdminPage from './dashboard-admin';

/**
 * Unified Modern LegalTech Dashboard.
 * Resolves "/" to `DashboardAdminPage` with full light mode and real backend data.
 */
export default function DashboardPage() {
  const { data: user, isLoading } = useGetCurrentUser();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const role = (user as any)?.role;

  if (role === 'super_admin') {
    return <Redirect to="/super-admin" />;
  }

  return <DashboardAdminPage />;
}
