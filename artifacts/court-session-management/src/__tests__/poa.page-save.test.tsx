import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PowerOfAttorneyPage from '../pages/poa';
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

vi.mock('@/components/clients/client-picker', () => ({
  ClientPicker: ({ value, onChange, label }: any) => (
    <div data-testid="client-picker-mock">
      <label>{label}</label>
      <button
        type="button"
        data-testid="select-client-button"
        onClick={() => onChange('client-1', 'شركة البركة')}
      >
        اختيار شركة البركة
      </button>
      <span>{value || 'no-client'}</span>
    </div>
  ),
}));

describe('PowerOfAttorneyPage Save Lifecycle & Validation', () => {
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

  it('rejects submission if clientId is not chosen', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.startsWith('/api/clients')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      if (url.startsWith('/api/poa')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    render(<PowerOfAttorneyPage />);

    // Open modal
    const addButton = await screen.findByRole('button', { name: /إضافة وكالة جديدة/i });
    fireEvent.click(addButton);

    // Enter POA number only (no client picked)
    const poaNumberInput = screen.getByLabelText(/رقم الوكالة/i) as HTMLInputElement;
    fireEvent.change(poaNumberInput, { target: { value: 'QA-POA-123' } });

    // Submit
    const saveButton = screen.getByTestId('button-save-poa');
    fireEvent.click(saveButton);

    // Toast validation error
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'تنبيه',
          description: expect.stringContaining('يرجى اختيار العميل المرتبط بالوكالة'),
        })
      );
    });
  });

  it('handles backend error gracefully without local storage queue', async () => {
    const clients = [{ id: 'client-1', name: 'شركة البركة' }];

    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.startsWith('/api/clients')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => clients });
      }
      if (url.startsWith('/api/poa') && (!options || options.method === 'GET' || !options.method)) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      if (url === '/api/poa' && options?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({
            error: 'تعذر حفظ الوكالة في قاعدة البيانات.',
            refId: 'REF-ERR-789',
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    render(<PowerOfAttorneyPage />);

    // Open modal
    const addButton = await screen.findByRole('button', { name: /إضافة وكالة جديدة/i });
    fireEvent.click(addButton);

    // Pick client
    const selectClientBtn = screen.getByTestId('select-client-button');
    fireEvent.click(selectClientBtn);

    // Enter POA number
    const poaNumberInput = screen.getByLabelText(/رقم الوكالة/i) as HTMLInputElement;
    fireEvent.change(poaNumberInput, { target: { value: 'QA-POA-ERROR' } });

    // Submit
    const saveButton = screen.getByTestId('button-save-poa');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'خطأ في حفظ الوكالة',
          description: expect.stringContaining('REF-ERR-789'),
        })
      );
    });

    // Ensure NO poa items stored in localStorage
    expect(localStorage.length).toBe(0);
  });
});
