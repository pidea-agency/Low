import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PowerOfAttorneyPage from '../pages/poa';
import { LEGACY_POA_STORAGE_KEY, poaStorageKey } from '../lib/poa-storage';
import * as apiClient from '@workspace/api-client-react';

// Mock the API client
vi.mock('@workspace/api-client-react', async () => {
  const actual = await vi.importActual<any>('@workspace/api-client-react');
  return {
    ...actual,
    useGetCurrentUser: vi.fn(),
  };
});

describe('PowerOfAttorneyPage Storage Isolation Component Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    // Default fetch mock returning offline error to test fallback to local storage
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error (offline)'));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('Never loads data from the legacy legal_poa_records_v1 key and removes it on mount', async () => {
    const legacyRecords = [
      {
        id: 'legacy-1',
        clientName: 'تسريب وكالة قديمة',
        poaNumber: '7777',
        issueDateHijri: '1446/01/01',
        expiryDateHijri: '1447/01/01',
        daysRemaining: 100,
        createdAt: '2026-11-01T00:00:00.000Z',
      },
    ];
    localStorage.setItem(LEGACY_POA_STORAGE_KEY, JSON.stringify(legacyRecords));

    (apiClient.useGetCurrentUser as any).mockReturnValue({
      data: { id: 'user_1', userId: 'user_1', officeId: 'office_1', username: 'lawyer1' },
      isLoading: false,
    });

    render(<PowerOfAttorneyPage />);

    // Legacy key must be purged
    await waitFor(() => {
      expect(localStorage.getItem(LEGACY_POA_STORAGE_KEY)).toBeNull();
    });

    // The legacy record MUST NOT be displayed on screen
    expect(screen.queryByText('تسريب وكالة قديمة')).toBeNull();
  });

  it('Loads isolated records for Account A and does not display Account B records', async () => {
    const recordsA = [
      {
        id: 'poa-a',
        clientName: 'وكالة خاصة بمكتب أ',
        poaNumber: '1001',
        issueDateHijri: '1446/01/01',
        expiryDateHijri: '1447/01/01',
        daysRemaining: 100,
        createdAt: '2026-11-01T00:00:00.000Z',
      },
    ];
    const recordsB = [
      {
        id: 'poa-b',
        clientName: 'وكالة سرية لمكتب ب',
        poaNumber: '2002',
        issueDateHijri: '1446/01/01',
        expiryDateHijri: '1447/01/01',
        daysRemaining: 100,
        createdAt: '2026-11-01T00:00:00.000Z',
      },
    ];

    // Seed both accounts in localStorage under their isolated keys
    localStorage.setItem(poaStorageKey('office_a', 'user_a'), JSON.stringify(recordsA));
    localStorage.setItem(poaStorageKey('office_b', 'user_b'), JSON.stringify(recordsB));

    // Render as Account A
    (apiClient.useGetCurrentUser as any).mockReturnValue({
      data: { id: 'user_a', userId: 'user_a', officeId: 'office_a', username: 'lawyer_a' },
      isLoading: false,
    });

    const { unmount } = render(<PowerOfAttorneyPage />);

    // Account A sees Account A's record
    await waitFor(() => {
      expect(screen.getByText('وكالة خاصة بمكتب أ')).toBeDefined();
    });

    // Account A CANNOT see Account B's record
    expect(screen.queryByText('وكالة سرية لمكتب ب')).toBeNull();
    unmount();

    // Now render as Account B
    (apiClient.useGetCurrentUser as any).mockReturnValue({
      data: { id: 'user_b', userId: 'user_b', officeId: 'office_b', username: 'lawyer_b' },
      isLoading: false,
    });

    render(<PowerOfAttorneyPage />);

    // Account B sees Account B's record
    await waitFor(() => {
      expect(screen.getByText('وكالة سرية لمكتب ب')).toBeDefined();
    });

    // Account B CANNOT see Account A's record
    expect(screen.queryByText('وكالة خاصة بمكتب أ')).toBeNull();
  });

  it('Does not read or write storage while user identity is loading', async () => {
    (apiClient.useGetCurrentUser as any).mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(<PowerOfAttorneyPage />);

    // No keys created or modified
    expect(localStorage.length).toBe(0);
  });
});

