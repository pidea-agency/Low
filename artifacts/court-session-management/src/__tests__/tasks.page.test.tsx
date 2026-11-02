import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TasksPage from '../pages/tasks';

// Mock useToast hook
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe('TasksPage Save & Error Reference Handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockToast.mockClear();
    localStorage.clear();
  });

  it('displays error toast with Arabic message and reference ID when save fails', async () => {
    // Initial fetch for tasks list returns empty list
    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url === '/api/tasks' && (!options || options.method === undefined || options.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [],
        });
      }
      if (url === '/api/tasks' && options?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: async () => ({
            error: 'تعذر الوصول إلى جدول البيانات: يرجى مشاركة الجدول مع البريد الإلكتروني لحساب الخدمة.',
            refId: 'REF-TEST-ERR-1234',
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    render(<TasksPage />);

    // Click "إضافة مهمة"
    const addButton = await screen.findByRole('button', { name: /إضافة مهمة/i });
    fireEvent.click(addButton);

    // Fill form
    const titleInput = await screen.findByPlaceholderText(/أدخل عنوان المهمة/i);
    fireEvent.change(titleInput, { target: { value: 'مهمة فحص الأخطاء' } });

    // Submit form
    const saveButtons = screen.getAllByRole('button', { name: /إضافة المهمة/i });
    // The modal submit button is the last one in the DOM
    fireEvent.click(saveButtons[saveButtons.length - 1]);

    // Verify error toast was shown containing the reference ID
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'خطأ في الحفظ',
          description: expect.stringContaining('REF-TEST-ERR-1234'),
          variant: 'destructive',
        })
      );
    });
  });

  it('displays success toast and closes modal when task save succeeds', async () => {
    const createdTask = {
      id: 101,
      title: 'مهمة ناجحة جديدة',
      assignee: 'محام',
      priority: 'عادية',
      dueDate: '2026-11-30',
      status: 'قيد التنفيذ',
      notes: '',
      createdAt: new Date().toISOString(),
    };

    let postCalled = false;

    global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.startsWith('/api/tasks') && (!options || options.method === 'GET' || !options.method)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => (postCalled ? [createdTask] : []),
        });
      }
      if (url === '/api/tasks' && options?.method === 'POST') {
        postCalled = true;
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => createdTask,
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    });

    render(<TasksPage />);

    const addButton = await screen.findByRole('button', { name: /إضافة مهمة/i });
    fireEvent.click(addButton);

    const titleInput = await screen.findByPlaceholderText(/أدخل عنوان المهمة/i);
    fireEvent.change(titleInput, { target: { value: 'مهمة ناجحة جديدة' } });

    const saveButtons = screen.getAllByRole('button', { name: /إضافة المهمة/i });
    fireEvent.click(saveButtons[saveButtons.length - 1]);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'تم الحفظ في الشيت 📊',
        })
      );
    });

    // Verify task now appears on screen
    await waitFor(() => {
      expect(screen.getByText('مهمة ناجحة جديدة')).toBeDefined();
    });
  });
});
