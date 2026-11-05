import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import JudgmentsPage from '../pages/judgments';

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('JudgmentsPage Save Lifecycle & State Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockToast.mockClear();
  });

  it('preserves all entered values and keeps form open when save fails with error & refId', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.startsWith('/api/judgments') && (!options || options.method === 'GET' || !options.method)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [],
        });
      }
      if (url === '/api/judgments' && options?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: async () => ({
            error: 'تعذر الوصول إلى جدول البيانات: يرجى مشاركة الجدول مع البريد الإلكتروني لحساب الخدمة.',
            refId: 'REF-JUDG-FAIL-999',
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    renderWithClient(<JudgmentsPage />);

    // Open Create Modal
    const addButton = await screen.findByRole('button', { name: /إضافة حكم جديد/i });
    fireEvent.click(addButton);

    // Fill form fields
    const caseNumberInput = (await screen.findByLabelText(/رقم القضية/i)) as HTMLInputElement;
    fireEvent.change(caseNumberInput, { target: { value: '44109283' } });

    const judgmentNumberInput = screen.getByLabelText(/رقم الصك/i) as HTMLInputElement;
    fireEvent.change(judgmentNumberInput, { target: { value: '443012948' } });

    const courtInput = screen.getByLabelText(/المحكمة المختصة/i) as HTMLInputElement;
    fireEvent.change(courtInput, { target: { value: 'المحكمة العامة بالرياض' } });

    const summaryInput = screen.getByLabelText(/ملخص الحكم/i) as HTMLTextAreaElement;
    fireEvent.change(summaryInput, { target: { value: 'تفاصيل حكم المحكمة التجريبي' } });

    // Submit form
    const saveButton = screen.getByTestId('button-save-judgment');
    fireEvent.click(saveButton);

    // Verify error is shown with reference ID
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'خطأ',
          description: expect.stringContaining('REF-JUDG-FAIL-999'),
          variant: 'destructive',
        })
      );
    });

    // Form MUST stay open and all values MUST be preserved
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(caseNumberInput.value).toBe('44109283');
    expect(judgmentNumberInput.value).toBe('443012948');
    expect(courtInput.value).toBe('المحكمة العامة بالرياض');
    expect(summaryInput.value).toBe('تفاصيل حكم المحكمة التجريبي');
  });

  it('closes modal and displays success state and list item when save succeeds', async () => {
    const createdRecord = {
      id: 50,
      caseNumber: '44109283',
      judgmentNumber: '443012948',
      court: 'المحكمة العامة بالرياض',
      plaintiff: 'المدعي أ',
      defendant: 'المدعى عليه ب',
      assignedLawyer: 'المحامي فهد',
      judgmentDate: '1447/08/10',
      summary: 'حكم مؤكد بالنجاح',
      isFavorable: 'نهائي',
      createdAt: new Date().toISOString(),
    };

    let postCalled = false;

    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.startsWith('/api/judgments') && (!options || options.method === 'GET' || !options.method)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => (postCalled ? [createdRecord] : []),
        });
      }
      if (url === '/api/judgments' && options?.method === 'POST') {
        postCalled = true;
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => createdRecord,
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    renderWithClient(<JudgmentsPage />);

    const addButton = await screen.findByRole('button', { name: /إضافة حكم جديد/i });
    fireEvent.click(addButton);

    const caseNumberInput = await screen.findByLabelText(/رقم القضية/i);
    fireEvent.change(caseNumberInput, { target: { value: '44109283' } });

    const judgmentNumberInput = screen.getByLabelText(/رقم الصك/i);
    fireEvent.change(judgmentNumberInput, { target: { value: '443012948' } });

    const saveButton = screen.getByTestId('button-save-judgment');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'نجاح',
          description: 'تم إضافة الحكم بنجاح.',
        })
      );
    });

    // Form modal must be closed
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    // Record appears in the list
    await waitFor(() => {
      expect(screen.getByText('حكم مؤكد بالنجاح')).toBeDefined();
    });
  });
});

