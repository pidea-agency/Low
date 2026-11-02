import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PowerOfAttorneyPage from '../pages/poa';
import {
  getPendingPoaRecords,
  setPendingPoaRecords,
  poaPendingStorageKey,
  clearUserPoaStorage,
  PendingPoaRecord,
} from '../lib/poa-storage';
import * as apiClient from '@workspace/api-client-react';

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@workspace/api-client-react', async () => {
  const actual = await vi.importActual<any>('@workspace/api-client-react');
  return {
    ...actual,
    useGetCurrentUser: vi.fn(),
  };
});

describe('POA Pending Sync & Safe Local Storage Tests', () => {
  const officeA = 'office_alpha';
  const userA = 'user_alpha';
  const officeB = 'office_beta';
  const userB = 'user_beta';

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    mockToast.mockClear();

    // Default current user: Account A
    (apiClient.useGetCurrentUser as any).mockReturnValue({
      data: { id: userA, userId: userA, officeId: officeA, username: 'lawyer_a' },
      isLoading: false,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('1. save fails -> record is stored as pending in local storage and appears in UI with "بانتظار الحفظ"', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.startsWith('/api/poa') && (!options || options.method === 'GET' || !options.method)) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      if (url === '/api/poa' && options?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: async () => ({
            error: 'تعذر الاتصال بـ Google Sheets',
            refId: 'REF-OFFLINE-TEST',
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    render(<PowerOfAttorneyPage />);

    // Open create modal
    const addButton = await screen.findByRole('button', { name: /إضافة وكالة جديدة/i });
    fireEvent.click(addButton);

    // Fill form
    const clientNameInput = (await screen.findByLabelText(/اسم العميل/i)) as HTMLInputElement;
    fireEvent.change(clientNameInput, { target: { value: 'شركة الأفق الجديد' } });

    const poaNumberInput = screen.getByLabelText(/رقم الوكالة/i) as HTMLInputElement;
    fireEvent.change(poaNumberInput, { target: { value: 'QA-PENDING-101' } });

    const issueDateInput = screen.getByLabelText(/تاريخ الإصدار/i) as HTMLInputElement;
    fireEvent.change(issueDateInput, { target: { value: '1446/01/01' } });

    const expiryDateInput = screen.getByLabelText(/تاريخ الانتهاء/i) as HTMLInputElement;
    fireEvent.change(expiryDateInput, { target: { value: '1447/01/01' } });

    // Submit
    const saveButton = screen.getByTestId('button-save-poa');
    fireEvent.click(saveButton);

    // Must be stored in isolated pending localStorage
    await waitFor(() => {
      const pending = getPendingPoaRecords(officeA, userA);
      expect(pending).toHaveLength(1);
      expect(pending[0].payload.poaNumber).toBe('QA-PENDING-101');
      expect(pending[0].retryCount).toBe(0);
      expect(pending[0].tempId).toBeDefined();
    });

    // In UI, record appears with badge «بانتظار الحفظ»
    await waitFor(() => {
      expect(screen.getByText('شركة الأفق الجديد')).toBeDefined();
      expect(screen.getByText('QA-PENDING-101')).toBeDefined();
      expect(screen.getByText(/بانتظار الحفظ/i)).toBeDefined();
    });
  });

  it('2. server returns [] -> pending records are NOT overwritten and still shown in UI', async () => {
    // Pre-populate 1 pending record in local storage
    const existingPending: PendingPoaRecord = {
      tempId: 'temp-poa-99',
      createdAt: new Date().toISOString(),
      payload: {
        clientName: 'مؤسسة التقنية المعلقة',
        poaNumber: 'QA-REMAIN-PENDING',
        issueDateHijri: '1446/01/01',
        expiryDateHijri: '1447/01/01',
        daysRemaining: 300,
        notes: 'ملاحظات معلقة',
      },
      retryCount: 0,
    };
    setPendingPoaRecords(officeA, userA, [existingPending]);

    // Server returns empty list []
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.startsWith('/api/poa')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    render(<PowerOfAttorneyPage />);

    // Pending record MUST still be in local storage
    await waitFor(() => {
      const pending = getPendingPoaRecords(officeA, userA);
      expect(pending).toHaveLength(1);
      expect(pending[0].payload.poaNumber).toBe('QA-REMAIN-PENDING');
    });

    // In UI, pending record is still visible with badge
    await waitFor(() => {
      expect(screen.getByText('مؤسسة التقنية المعلقة')).toBeDefined();
      expect(screen.getByText('QA-REMAIN-PENDING')).toBeDefined();
      expect(screen.getByText(/بانتظار الحفظ/i)).toBeDefined();
    });
  });

  it('3. server request fails with network/5xx -> pending records remain untouched and displayed', async () => {
    const existingPending: PendingPoaRecord = {
      tempId: 'temp-offline-1',
      createdAt: new Date().toISOString(),
      payload: {
        clientName: 'عميل أوفلاين',
        poaNumber: 'POA-OFFLINE-77',
        issueDateHijri: '1446/01/01',
        expiryDateHijri: '1447/01/01',
        daysRemaining: 200,
      },
      retryCount: 0,
    };
    setPendingPoaRecords(officeA, userA, [existingPending]);

    // Server fails completely (Network Error / 500)
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error (Failed to fetch)'));

    render(<PowerOfAttorneyPage />);

    // Storage is untouched
    await waitFor(() => {
      const pending = getPendingPoaRecords(officeA, userA);
      expect(pending).toHaveLength(1);
      expect(pending[0].payload.poaNumber).toBe('POA-OFFLINE-77');
    });

    // Displayed in UI
    await waitFor(() => {
      expect(screen.getByText('عميل أوفلاين')).toBeDefined();
      expect(screen.getByText(/بانتظار الحفظ/i)).toBeDefined();
    });
  });

  it('4. displays both confirmed server records and local pending records with no duplicates', async () => {
    const existingPending: PendingPoaRecord = {
      tempId: 'temp-p1',
      createdAt: new Date().toISOString(),
      payload: {
        clientName: 'وكالة معلقة محلياً',
        poaNumber: 'POA-PENDING-44',
        issueDateHijri: '1446/01/01',
        expiryDateHijri: '1447/01/01',
        daysRemaining: 150,
      },
      retryCount: 0,
    };
    setPendingPoaRecords(officeA, userA, [existingPending]);

    const confirmedServerRecord = {
      sheetRowId: 5,
      clientName: 'وكالة معتمدة بالسيرفر',
      poaNumber: 'POA-CONFIRMED-88',
      issueDateHijri: '1446/02/01',
      expiryDateHijri: '1447/02/01',
      daysRemaining: 180,
      notes: '',
      createdAt: '2026-11-01T00:00:00.000Z',
      officeId: officeA,
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.startsWith('/api/poa')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [confirmedServerRecord] });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    render(<PowerOfAttorneyPage />);

    // Both records must be visible
    await waitFor(() => {
      expect(screen.getByText('وكالة معتمدة بالسيرفر')).toBeDefined();
      expect(screen.getByText('POA-CONFIRMED-88')).toBeDefined();
      expect(screen.getByText('وكالة معلقة محلياً')).toBeDefined();
      expect(screen.getByText('POA-PENDING-44')).toBeDefined();
    });

    // Only the pending one has the «بانتظار الحفظ» badge
    const badges = screen.getAllByText(/بانتظار الحفظ/i);
    expect(badges).toHaveLength(1);
  });

  it('5. clicking retry -> on success, removes record from pending storage and becomes confirmed', async () => {
    const existingPending: PendingPoaRecord = {
      tempId: 'temp-retry-ok',
      createdAt: new Date().toISOString(),
      payload: {
        clientName: 'وكالة قابلة لإعادة المحاولة',
        poaNumber: 'QA-RETRY-SUCCESS',
        issueDateHijri: '1446/01/01',
        expiryDateHijri: '1447/01/01',
        daysRemaining: 250,
      },
      retryCount: 0,
    };
    setPendingPoaRecords(officeA, userA, [existingPending]);

    let serverRecords: any[] = [];

    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.startsWith('/api/poa') && (!options || options.method === 'GET' || !options.method)) {
        return Promise.resolve({ ok: true, status: 200, json: async () => serverRecords });
      }
      if (url === '/api/poa' && options?.method === 'POST') {
        const saved = {
          sheetRowId: 12,
          ...existingPending.payload,
          createdAt: new Date().toISOString(),
          officeId: officeA,
        };
        serverRecords = [saved];
        return Promise.resolve({ ok: true, status: 201, json: async () => saved });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    render(<PowerOfAttorneyPage />);

    // Find and click the retry button on the pending card
    const retryButton = await screen.findByTestId('button-retry-poa-temp-retry-ok');
    fireEvent.click(retryButton);

    // Pending storage must now be empty
    await waitFor(() => {
      const pending = getPendingPoaRecords(officeA, userA);
      expect(pending).toHaveLength(0);
    });

    // Record is still shown, but now confirmed without the pending badge
    await waitFor(() => {
      expect(screen.getByText('وكالة قابلة لإعادة المحاولة')).toBeDefined();
      expect(screen.queryByText(/بانتظار الحفظ/i)).toBeNull();
    });
  });

  it('6. retry fails -> keeps record pending, shows Arabic error with refId, increments retryCount', async () => {
    const existingPending: PendingPoaRecord = {
      tempId: 'temp-retry-fail',
      createdAt: new Date().toISOString(),
      payload: {
        clientName: 'وكالة ستفشل إعادة محاولتها',
        poaNumber: 'QA-RETRY-FAIL-9',
        issueDateHijri: '1446/01/01',
        expiryDateHijri: '1447/01/01',
        daysRemaining: 250,
      },
      retryCount: 1,
    };
    setPendingPoaRecords(officeA, userA, [existingPending]);

    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.startsWith('/api/poa') && (!options || options.method === 'GET' || !options.method)) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      if (url === '/api/poa' && options?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 504,
          json: async () => ({
            error: 'انتهت مهلة الاتصال بخوادم Google',
            refId: 'REF-RETRY-ERR-77',
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    render(<PowerOfAttorneyPage />);

    const retryButton = await screen.findByTestId('button-retry-poa-temp-retry-fail');
    fireEvent.click(retryButton);

    // Toast with Arabic error and refId
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'فشلت إعادة محاولة الحفظ',
          description: expect.stringContaining('REF-RETRY-ERR-77'),
          variant: 'destructive',
        })
      );
    });

    // Still pending, with retryCount incremented to 2
    const pending = getPendingPoaRecords(officeA, userA);
    expect(pending).toHaveLength(1);
    expect(pending[0].retryCount).toBe(2);
    expect(screen.getByText(/بانتظار الحفظ/i)).toBeDefined();
  });

  it('7. deliberate deletion removes only that pending record from local storage', async () => {
    const pending1: PendingPoaRecord = {
      tempId: 'temp-del-1',
      createdAt: new Date().toISOString(),
      payload: {
        clientName: 'وكالة للحذف',
        poaNumber: 'QA-TO-DELETE',
        issueDateHijri: '1446/01/01',
        expiryDateHijri: '1447/01/01',
        daysRemaining: 100,
      },
      retryCount: 0,
    };
    const pending2: PendingPoaRecord = {
      tempId: 'temp-keep-2',
      createdAt: new Date().toISOString(),
      payload: {
        clientName: 'وكالة للبقاء',
        poaNumber: 'QA-TO-KEEP',
        issueDateHijri: '1446/01/01',
        expiryDateHijri: '1447/01/01',
        daysRemaining: 100,
      },
      retryCount: 0,
    };
    setPendingPoaRecords(officeA, userA, [pending1, pending2]);

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.startsWith('/api/poa')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    render(<PowerOfAttorneyPage />);

    // Click delete on pending 1
    const delButton = await screen.findByTestId('button-delete-pending-poa-temp-del-1');
    fireEvent.click(delButton);

    // Confirm deletion in alert dialog
    const confirmBtn = await screen.findByTestId('button-confirm-delete-pending-poa');
    fireEvent.click(confirmBtn);

    // Only pending 2 remains in storage
    await waitFor(() => {
      const pending = getPendingPoaRecords(officeA, userA);
      expect(pending).toHaveLength(1);
      expect(pending[0].tempId).toBe('temp-keep-2');
    });

    expect(screen.queryByText('وكالة للحذف')).toBeNull();
    expect(screen.getByText('وكالة للبقاء')).toBeDefined();
  });

  it('8. pending records are strictly isolated by office and user', async () => {
    // Seed pending record for Account A
    const pendingA: PendingPoaRecord = {
      tempId: 'temp-a',
      createdAt: new Date().toISOString(),
      payload: {
        clientName: 'وكالة خاصة بمكتب أ فقط',
        poaNumber: 'QA-ISOLATION-A',
        issueDateHijri: '1446/01/01',
        expiryDateHijri: '1447/01/01',
        daysRemaining: 100,
      },
      retryCount: 0,
    };
    setPendingPoaRecords(officeA, userA, [pendingA]);

    // Now switch to Account B
    (apiClient.useGetCurrentUser as any).mockReturnValue({
      data: { id: userB, userId: userB, officeId: officeB, username: 'lawyer_b' },
      isLoading: false,
    });

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.startsWith('/api/poa')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    render(<PowerOfAttorneyPage />);

    // Account B must NOT see Account A's pending record
    await waitFor(() => {
      expect(screen.queryByText('وكالة خاصة بمكتب أ فقط')).toBeNull();
      expect(screen.queryByText('QA-ISOLATION-A')).toBeNull();
    });
  });
});

