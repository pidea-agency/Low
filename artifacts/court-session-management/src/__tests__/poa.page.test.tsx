import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PowerOfAttorneyPage from '../pages/poa';
import * as apiClient from '@workspace/api-client-react';

vi.mock('@workspace/api-client-react', async () => {
  const actual = await vi.importActual<any>('@workspace/api-client-react');
  return {
    ...actual,
    useGetCurrentUser: vi.fn(),
  };
});

describe('PowerOfAttorneyPage Component Tests (Direct API & Client Link)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('Loads POA records and resolves client names from /api/clients', async () => {
    const clientsList = [
      { id: 'client-100', name: 'شركة التنمية العقارية' },
      { id: 'client-200', name: 'أحمد محمود العلي' },
    ];
    const poaRecords = [
      {
        id: 'poa-1',
        sheetRowId: 1,
        clientId: 'client-100',
        poaNumber: 'POA-88991',
        issueDateHijri: '1446/01/01',
        expiryDateHijri: '1447/01/01',
        daysRemaining: 150,
        notes: 'وكالة عقارية',
      },
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.startsWith('/api/clients')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => clientsList,
        });
      }
      if (url.startsWith('/api/poa')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => poaRecords,
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    (apiClient.useGetCurrentUser as any).mockReturnValue({
      data: { id: 'admin_1', userId: 'admin_1', officeId: 'office_1', role: 'admin' },
      isLoading: false,
    });

    render(<PowerOfAttorneyPage />);

    // Derived client name from client record should appear
    await waitFor(() => {
      expect(screen.getByText('شركة التنمية العقارية')).toBeDefined();
      expect(screen.getByText('POA-88991')).toBeDefined();
    });
  });

  it('Displays triage warning banner to admin when an unlinked POA exists', async () => {
    const unlinkedPoa = [
      {
        id: 'poa-unlinked',
        sheetRowId: 99,
        clientId: null,
        poaNumber: 'POA-UNLINKED-99',
        issueDateHijri: '1446/01/01',
        expiryDateHijri: '1447/01/01',
        daysRemaining: 120,
        clientName: 'اسم قديم غير مربوط',
      },
    ];

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.startsWith('/api/clients')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      if (url.startsWith('/api/poa')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => unlinkedPoa,
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    (apiClient.useGetCurrentUser as any).mockReturnValue({
      data: { id: 'admin_1', userId: 'admin_1', officeId: 'office_1', role: 'admin' },
      isLoading: false,
    });

    render(<PowerOfAttorneyPage />);

    await waitFor(() => {
      expect(screen.getByText(/وكالات تحتاج إلى ربط بعملاء/i)).toBeDefined();
      expect(screen.getByText(/غير مربوطة بعميل/i)).toBeDefined();
    });
  });
});
