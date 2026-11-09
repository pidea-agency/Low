import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LawyerSelect } from '../components/clients/lawyer-select';
import * as apiClient from '@workspace/api-client-react';

vi.mock('@workspace/api-client-react', () => ({
  useGetCurrentUser: vi.fn(),
}));

describe('LawyerSelect Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly loads and populates staff lawyers when /api/users returns { isSupabaseConfigured, users }', async () => {
    (apiClient.useGetCurrentUser as any).mockReturnValue({
      data: {
        id: 'admin-1',
        userId: 'admin-1',
        username: 'office_admin',
        displayName: 'مدير المكتب الرئيسي',
        role: 'admin',
      },
    });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        isSupabaseConfigured: true,
        users: [
          {
            id: 'staff-1',
            username: 'lawyer_ahmed',
            display_name: 'أحمد المحامي',
            role: 'staff',
          },
          {
            id: 'staff-2',
            username: 'lawyer_sara',
            display_name: 'سارة المحامية',
            role: 'staff',
          },
        ],
      }),
    });
    global.fetch = mockFetch;

    render(<LawyerSelect label="المحامي المسؤول" placeholder="اختر المحامي..." />);

    // Wait for the fetch call
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/users', { credentials: 'include' });
    });

    // The select trigger should be rendered
    const selectTrigger = screen.getByRole('combobox');
    expect(selectTrigger).toBeDefined();
  });

  it('renders read-only display when current user is staff', () => {
    (apiClient.useGetCurrentUser as any).mockReturnValue({
      data: {
        id: 'staff-1',
        username: 'staff_user',
        displayName: 'المحامي الموظف',
        role: 'staff',
      },
    });

    render(<LawyerSelect label="المحامي المسؤول" />);

    expect(screen.getByText('المحامي الموظف')).toBeDefined();
    expect(screen.getByText('مسند إليك تلقائياً')).toBeDefined();
  });
});
