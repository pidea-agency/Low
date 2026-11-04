import React from 'react';
import { useGetCurrentUser } from '@workspace/api-client-react';
import { Redirect } from 'wouter';
import DashboardAdminPage from './dashboard-admin';
import DashboardStaffPage from './dashboard-staff';

/**
 * Dynamic Dashboard Dispatcher.
 * Automatically resolves "/" to:
 * - `DashboardAdminPage` for office admins.
 * - `DashboardStaffPage` for office staff lawyers.
 * - Redirects `super_admin` to `/super-admin`.
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

  if (role === 'admin') {
    return <DashboardAdminPage />;
  }

  return <DashboardStaffPage />;
}
