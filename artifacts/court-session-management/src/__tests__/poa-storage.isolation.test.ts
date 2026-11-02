import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  poaStorageKey,
  getStoredPoaRecords,
  setStoredPoaRecords,
  clearUserPoaStorage,
  cleanLegacyPoaStorage,
  handleSessionTerminationCleanup,
  LEGACY_POA_STORAGE_KEY,
} from '../lib/poa-storage';

describe('POA Local Storage Isolation and Session Cleanup', () => {
  const sampleRecordsA = [
    {
      id: 'poa-1',
      clientName: 'عميل أ (خاص بالمكتب 1)',
      poaNumber: '1111',
      issueDateHijri: '1446/01/01',
      expiryDateHijri: '1447/01/01',
      daysRemaining: 350,
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  ];

  const sampleRecordsB = [
    {
      id: 'poa-2',
      clientName: 'عميل ب (خاص بالمكتب 2)',
      poaNumber: '2222',
      issueDateHijri: '1446/02/01',
      expiryDateHijri: '1447/02/01',
      daysRemaining: 380,
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('Account A saves local POA records -> Account B (different user id, same browser storage) does not see them', () => {
    const officeId = 'office_123';
    const userA = 'user_alpha';
    const userB = 'user_beta';

    setStoredPoaRecords(officeId, userA, sampleRecordsA);

    // Account A can see its records
    const storedA = getStoredPoaRecords(officeId, userA);
    expect(storedA).toEqual(sampleRecordsA);

    // Account B on same browser MUST NOT see Account A's records
    const storedB = getStoredPoaRecords(officeId, userB);
    expect(storedB).toBeNull();
  });

  it('Same user in a different office context -> does not see the other office records', () => {
    const userId = 'lawyer_samir';
    const office1 = 'office_riyadh';
    const office2 = 'office_jeddah';

    setStoredPoaRecords(office1, userId, sampleRecordsA);

    // Reading under office 1 succeeds
    expect(getStoredPoaRecords(office1, userId)).toEqual(sampleRecordsA);

    // Reading under office 2 MUST NOT see office 1's records
    expect(getStoredPoaRecords(office2, userId)).toBeNull();
  });

  it('The storage key contains both the office id and user id, formatted as legal_poa_records_v2:<officeId>:<userId>', () => {
    const officeId = 'office_999';
    const userId = 'user_888';

    const key = poaStorageKey(officeId, userId);
    expect(key).toBe('legal_poa_records_v2:office_999:user_888');

    // Setting records creates this exact key in localStorage
    setStoredPoaRecords(officeId, userId, sampleRecordsA);
    expect(localStorage.getItem('legal_poa_records_v2:office_999:user_888')).not.toBeNull();

    // Verify it never writes to the global legacy key
    expect(localStorage.getItem('legal_poa_records_v1')).toBeNull();
  });

  it('On logout, the current user POA storage keys are removed', () => {
    const officeId = 'office_test';
    const userA = 'user_a';
    const userB = 'user_b';

    setStoredPoaRecords(officeId, userA, sampleRecordsA);
    setStoredPoaRecords(officeId, userB, sampleRecordsB);

    // User A logs out
    clearUserPoaStorage(officeId, userA);

    // User A's key is gone
    expect(getStoredPoaRecords(officeId, userA)).toBeNull();
    expect(localStorage.getItem(poaStorageKey(officeId, userA))).toBeNull();

    // User B's key is preserved (different account)
    expect(getStoredPoaRecords(officeId, userB)).toEqual(sampleRecordsB);
  });

  it('When the session expires (401 from the API), the same cleanup runs', () => {
    const officeId = 'office_test';
    const userA = 'user_a';

    setStoredPoaRecords(officeId, userA, sampleRecordsA);

    // Simulated 401 session expiry handler
    handleSessionTerminationCleanup(officeId, userA);

    expect(getStoredPoaRecords(officeId, userA)).toBeNull();
    expect(localStorage.getItem(poaStorageKey(officeId, userA))).toBeNull();
  });

  it('The old key legal_poa_records_v1 is never read as data for any account and is removed with a warning', () => {
    const officeId = 'office_test';
    const userA = 'user_a';

    // Put legacy un-isolated data into localStorage
    const legacyData = JSON.stringify([{ clientName: 'تسريب محتمل', poaNumber: '9999' }]);
    localStorage.setItem(LEGACY_POA_STORAGE_KEY, legacyData);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Clean legacy storage
    cleanLegacyPoaStorage();

    // Old key MUST be deleted from storage
    expect(localStorage.getItem(LEGACY_POA_STORAGE_KEY)).toBeNull();

    // Console warning logged with count of removed records (no sensitive data in log)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Removed 1 legacy unmigrated POA record(s)'),
    );

    // Reading for userA must NOT return the legacy data
    const records = getStoredPoaRecords(officeId, userA);
    expect(records).toBeNull();
  });

  it('If user or office is not known yet (still loading / undefined), nothing is read from or written to storage', () => {
    // Attempt to write with empty/undefined office or user
    expect(() => setStoredPoaRecords('', 'user_1', sampleRecordsA)).not.toThrow();
    expect(() => setStoredPoaRecords('office_1', '', sampleRecordsA)).not.toThrow();

    // Nothing was stored
    expect(localStorage.length).toBe(0);

    // Attempt to read with empty/undefined
    expect(getStoredPoaRecords('', 'user_1')).toBeNull();
    expect(getStoredPoaRecords('office_1', '')).toBeNull();
    expect(getStoredPoaRecords(undefined as any, undefined as any)).toBeNull();
  });

  it('Storage errors (quota exceeded, storage disabled) do not crash the page', () => {
    const officeId = 'office_test';
    const userId = 'user_test';

    // Mock localStorage.setItem to throw QuotaExceededError
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });

    // setStoredPoaRecords must not throw
    expect(() => {
      setStoredPoaRecords(officeId, userId, sampleRecordsA);
    }).not.toThrow();

    // Mock localStorage.getItem to throw SecurityError (disabled cookies/storage)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError', 'SecurityError');
    });

    // getStoredPoaRecords must not throw, returning null safely
    let result: any;
    expect(() => {
      result = getStoredPoaRecords(officeId, userId);
    }).not.toThrow();
    expect(result).toBeNull();
  });
});

