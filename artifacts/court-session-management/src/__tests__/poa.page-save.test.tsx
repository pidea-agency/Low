import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PowerOfAttorneyPage from '../pages/poa';
import { poaStorageKey } from '../lib/poa-storage';
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

describe('PowerOfAttorneyPage Save Lifecycle & Outcome Visibility Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    mockToast.mockClear();

    (apiClient.useGetCurrentUser as any).mockReturnValue({
      data: { id: 'user_1', userId: 'user_1', officeId: 'office_1', username: 'lawyer1' },
      isLoading: false,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('if the Sheets write fails, page does NOT show record as saved, shows error with refId, keeps form values open', async () => {
    // GET /api/poa returns empty list
    // POST /api/poa fails with 503 and refId
    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.startsWith('/api/poa') && (!options || options.method === 'GET' || !options.method)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [],
        });
      }
      if (url === '/api/poa' && options?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: async () => ({
            error: 'تعذر الوصول إلى جدول البيانات: يرجى مشاركة الجدول مع حساب الخدمة.',
            refId: 'REF-POA-FAIL-123',
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    render(<PowerOfAttorneyPage />);

    // Open Create Modal
    const addButton = await screen.findByRole('button', { name: /إضافة وكالة جديدة/i });
    fireEvent.click(addButton);

    // Fill form fields
    const clientNameInput = (await screen.findByLabelText(/اسم العميل/i)) as HTMLInputElement;
    fireEvent.change(clientNameInput, { target: { value: 'شركة الأمل للتجارة' } });

    const poaNumberInput = screen.getByLabelText(/رقم الوكالة/i) as HTMLInputElement;
    fireEvent.change(poaNumberInput, { target: { value: 'QA-20261029-POA' } });

    const issueDateInput = screen.getByLabelText(/تاريخ الإصدار/i) as HTMLInputElement;
    fireEvent.change(issueDateInput, { target: { value: '1446/01/01' } });

    const expiryDateInput = screen.getByLabelText(/تاريخ الانتهاء/i) as HTMLInputElement;
    fireEvent.change(expiryDateInput, { target: { value: '1447/01/01' } });

    const notesInput = screen.getByLabelText(/ملاحظات/i) as HTMLTextAreaElement;
    fireEvent.change(notesInput, { target: { value: 'وكالة فحص الخطأ' } });

    // Submit form
    const saveButton = screen.getByTestId('button-save-poa');
    fireEvent.click(saveButton);

    // Verify error is shown with reference ID
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'خطأ في حفظ الوكالة',
          description: expect.stringContaining('REF-POA-FAIL-123'),
          variant: 'destructive',
        })
      );
    });

    // Form MUST stay open and all values MUST be preserved
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(clientNameInput.value).toBe('شركة الأمل للتجارة');
    expect(poaNumberInput.value).toBe('QA-20261029-POA');

    // The unconfirmed record MUST NOT be claimed as saved or added to the main list
    const storageData = localStorage.getItem(poaStorageKey('office_1', 'user_1'));
    if (storageData) {
      const parsed = JSON.parse(storageData);
      expect(parsed.find((r: any) => r.poaNumber === 'QA-20261029-POA')).toBeUndefined();
    }
  });

  it('after successful save confirmed by server, record is displayed and survives a simulated reload (remount)', async () => {
    const savedRecord = {
      sheetRowId: 10,
      clientName: 'شركة النجاح القانوني',
      poaNumber: 'QA-CONFIRMED-456',
      issueDateHijri: '1446/01/01',
      expiryDateHijri: '1447/01/01',
      daysRemaining: 200,
      notes: 'وكالة مؤكدة بالسيرفر',
      createdAt: '2026-11-02T10:00:00.000Z',
      officeId: 'office_1',
    };

    let serverRecords: any[] = [];

    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.startsWith('/api/poa') && (!options || options.method === 'GET' || !options.method)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => serverRecords,
        });
      }
      if (url === '/api/poa' && options?.method === 'POST') {
        serverRecords = [savedRecord];
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => savedRecord,
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    const { unmount } = render(<PowerOfAttorneyPage />);

    // Open Create Modal
    const addButton = await screen.findByRole('button', { name: /إضافة وكالة جديدة/i });
    fireEvent.click(addButton);

    // Fill form
    const clientNameInput = (await screen.findByLabelText(/اسم العميل/i)) as HTMLInputElement;
    fireEvent.change(clientNameInput, { target: { value: savedRecord.clientName } });

    const poaNumberInput = screen.getByLabelText(/رقم الوكالة/i) as HTMLInputElement;
    fireEvent.change(poaNumberInput, { target: { value: savedRecord.poaNumber } });

    const saveButton = screen.getByTestId('button-save-poa');
    fireEvent.click(saveButton);

    // Check success toast
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'تمت الإضافة',
        })
      );
    });

    // Record is displayed in the list
    await waitFor(() => {
      expect(screen.getByText('شركة النجاح القانوني')).toBeDefined();
      expect(screen.getByText('QA-CONFIRMED-456')).toBeDefined();
    });

    // Simulate page reload: unmount component and remount
    unmount();

    render(<PowerOfAttorneyPage />);

    // Record MUST still be present after reload!
    await waitFor(() => {
      expect(screen.getByText('شركة النجاح القانوني')).toBeDefined();
      expect(screen.getByText('QA-CONFIRMED-456')).toBeDefined();
    });
  });
});
