import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from '../pages/dashboard';
import DashboardAdminPage from '../pages/dashboard-admin';
import DashboardStaffPage from '../pages/dashboard-staff';
import * as apiClient from '@workspace/api-client-react';

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

vi.mock('@workspace/api-client-react', async () => {
  const actual = await vi.importActual<any>('@workspace/api-client-react');
  return {
    ...actual,
    useGetCurrentUser: vi.fn(),
    useGetDashboardStats: vi.fn(),
    useListSessions: vi.fn(),
  };
});

describe('Dashboard Role-based Component Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ users: [], tasks: [] }),
    } as any);

    (apiClient.useGetDashboardStats as any).mockReturnValue({
      data: {
        totalCases: 5,
        todayHearings: 2,
        upcomingHearings: 3,
        finishedHearings: 0,
        totalPoas: 4,
      },
      isLoading: false,
      error: null,
    });

    (apiClient.useListSessions as any).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('DashboardPage dynamically renders DashboardAdminPage for admin role', async () => {
    (apiClient.useGetCurrentUser as any).mockReturnValue({
      data: {
        id: 'admin_1',
        username: 'office_boss',
        role: 'admin',
        displayName: 'المحامي العام',
        ai_quota_limit: 100,
        ai_usage_count: 10,
        plan_tier: 'pro',
      },
      isLoading: false,
    });

    renderWithClient(<DashboardPage />);

    expect(await screen.findByTestId('admin-dashboard-page')).toBeTruthy();
    expect(screen.getByText('لوحة الإدارة والمكتب')).toBeTruthy();
    expect(screen.getByTestId('link-admin-users')).toBeTruthy();
    expect(screen.getByTestId('link-admin-subscription')).toBeTruthy();
    expect(screen.getByTestId('link-admin-settings')).toBeTruthy();
  });

  it('DashboardPage dynamically renders DashboardStaffPage for staff role without admin controls', async () => {
    (apiClient.useGetCurrentUser as any).mockReturnValue({
      data: {
        id: 'staff_1',
        username: 'lawyer_ali',
        role: 'staff',
        displayName: 'علي المحامي',
        ai_quota_limit: 25,
        ai_usage_count: 5,
      },
      isLoading: false,
    });

    renderWithClient(<DashboardPage />);

    expect(await screen.findByTestId('staff-dashboard-page')).toBeTruthy();
    expect(screen.getByText(/مرحباً بك، علي المحامي/)).toBeTruthy();

    // Staff dashboard must NEVER expose admin links
    expect(screen.queryByTestId('link-admin-users')).toBeNull();
    expect(screen.queryByTestId('link-admin-subscription')).toBeNull();
    expect(screen.queryByTestId('link-admin-settings')).toBeNull();

    // Staff tools must be present
    expect(screen.getByTestId('link-staff-chat')).toBeTruthy();
    expect(screen.getByTestId('link-staff-sessions')).toBeTruthy();
    expect(screen.getByTestId('link-staff-poa')).toBeTruthy();
    expect(screen.getByTestId('link-staff-judgments')).toBeTruthy();
  });
});
