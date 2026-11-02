/**
 * POA (Power of Attorney) Local Storage Helper
 * Strictly enforces per-office and per-user isolation for cached/local POA records.
 *
 * Storage key format: legal_poa_records_v2:<officeId>:<userId>
 */

export const LEGACY_POA_STORAGE_KEY = 'legal_poa_records_v1';
export const POA_STORAGE_PREFIX = 'legal_poa_records_v2';
export const POA_PENDING_STORAGE_PREFIX = 'legal_poa_pending_v1';

export interface PendingPoaPayload {
  clientName: string;
  poaNumber: string;
  issueDateHijri: string;
  expiryDateHijri: string;
  daysRemaining: number;
  notes?: string;
}

export interface PendingPoaRecord {
  tempId: string;
  createdAt: string;
  payload: PendingPoaPayload;
  retryCount: number;
  lastError?: string;
}

/**
 * Builds the isolated storage key for pending POA records for a specific office and user.
 */
export function poaPendingStorageKey(officeId: string, userId: string): string {
  const cleanOffice = (officeId || '').trim();
  const cleanUser = (userId || '').trim();
  if (!cleanOffice || !cleanUser) {
    return '';
  }
  return `${POA_PENDING_STORAGE_PREFIX}:${cleanOffice}:${cleanUser}`;
}

/**
 * Safely reads pending unsynced POA records for the given office and user account.
 * Always returns an array (empty array if none or error).
 */
export function getPendingPoaRecords(officeId?: string, userId?: string): PendingPoaRecord[] {
  if (!officeId || !userId || !officeId.trim() || !userId.trim()) {
    return [];
  }
  const key = poaPendingStorageKey(officeId, userId);
  if (!key) return [];

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Safely writes pending unsynced POA records for the given office and user account.
 */
export function setPendingPoaRecords(
  officeId?: string,
  userId?: string,
  records: PendingPoaRecord[] = [],
): void {
  if (!officeId || !userId || !officeId.trim() || !userId.trim()) {
    return;
  }
  const key = poaPendingStorageKey(officeId, userId);
  if (!key) return;

  try {
    localStorage.setItem(key, JSON.stringify(records));
  } catch (err) {
    console.warn('[POA Storage] Failed to write pending POA records to localStorage:', err);
  }
}

/**
 * Appends a new pending POA record to isolated storage.
 */
export function addPendingPoaRecord(
  officeId: string | undefined,
  userId: string | undefined,
  record: PendingPoaRecord,
): void {
  const current = getPendingPoaRecords(officeId, userId);
  const exists = current.some((r) => r.tempId === record.tempId || r.payload.poaNumber === record.payload.poaNumber);
  if (!exists) {
    setPendingPoaRecords(officeId, userId, [record, ...current]);
  } else {
    const updated = current.map((r) =>
      r.tempId === record.tempId || r.payload.poaNumber === record.payload.poaNumber
        ? { ...r, ...record, tempId: r.tempId }
        : r
    );
    setPendingPoaRecords(officeId, userId, updated);
  }
}

/**
 * Removes a specific pending POA record by its tempId from isolated storage.
 */
export function removePendingPoaRecord(
  officeId: string | undefined,
  userId: string | undefined,
  tempId: string,
): void {
  const current = getPendingPoaRecords(officeId, userId);
  const filtered = current.filter((r) => r.tempId !== tempId);
  setPendingPoaRecords(officeId, userId, filtered);
}

/**
 * Checks whether the user has any pending unsynced POA records in storage.
 */
export function hasPendingPoaRecords(officeId?: string, userId?: string): boolean {
  return getPendingPoaRecords(officeId, userId).length > 0;
}

/**
 * Builds the isolated storage key for a specific office and user account.
 * Both officeId and userId must be provided from server-validated identity.
 */
export function poaStorageKey(officeId: string, userId: string): string {
  const cleanOffice = (officeId || '').trim();
  const cleanUser = (userId || '').trim();
  if (!cleanOffice || !cleanUser) {
    return '';
  }
  return `${POA_STORAGE_PREFIX}:${cleanOffice}:${cleanUser}`;
}

/**
 * Safely reads isolated POA records for the given office and user account.
 * Returns null if user/office is not ready or if no records exist.
 * Never throws on storage errors (e.g. disabled storage or security errors).
 */
export function getStoredPoaRecords<T = any>(officeId?: string, userId?: string): T[] | null {
  if (!officeId || !userId || !officeId.trim() || !userId.trim()) {
    return null;
  }
  const key = poaStorageKey(officeId, userId);
  if (!key) return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    // Storage disabled, security error, or JSON parse error -> fail-safe null
    return null;
  }
}

/**
 * Safely writes isolated POA records for the given office and user account.
 * Does nothing if user/office is not ready.
 * Catches QuotaExceededError or security errors without crashing the application.
 */
export function setStoredPoaRecords(officeId?: string, userId?: string, records: any[] = []): void {
  if (!officeId || !userId || !officeId.trim() || !userId.trim()) {
    return;
  }
  const key = poaStorageKey(officeId, userId);
  if (!key) return;

  try {
    localStorage.setItem(key, JSON.stringify(records));
  } catch (err) {
    // QuotaExceededError or disabled storage -> silently catch to prevent crash
    console.warn('[POA Storage] Failed to write local POA records to localStorage:', err);
  }
}

/**
 * Removes the isolated POA records for a specific user and office (e.g. on logout).
 * If no specific user is provided, removes all isolated POA records in storage.
 */
export function clearUserPoaStorage(officeId?: string, userId?: string): void {
  try {
    if (officeId && userId && officeId.trim() && userId.trim()) {
      const key = poaStorageKey(officeId, userId);
      if (key) {
        localStorage.removeItem(key);
      }
      const pendingKey = poaPendingStorageKey(officeId, userId);
      if (pendingKey) {
        localStorage.removeItem(pendingKey);
      }
    } else {
      // Clear all POA v2 keys and pending keys across all offices/users in this browser
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith(`${POA_STORAGE_PREFIX}:`)) || (k && k.startsWith(`${POA_PENDING_STORAGE_PREFIX}:`))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    }
  } catch {
    // Fail-safe
  }
}

/**
 * Legacy key cleaner:
 * The old key 'legal_poa_records_v1' cannot be attributed to any single office/user.
 * To prevent cross-office data leakage, it is never read as data for any account.
 * This helper removes it from localStorage and logs a console warning with the count
 * of removed unmigrated records (without logging any sensitive content).
 */
export function cleanLegacyPoaStorage(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_POA_STORAGE_KEY);
    if (legacy !== null) {
      let count = 0;
      try {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed)) {
          count = parsed.length;
        }
      } catch {}
      localStorage.removeItem(LEGACY_POA_STORAGE_KEY);
      console.warn(
        `[POA Storage] Removed ${count} legacy unmigrated POA record(s) from '${LEGACY_POA_STORAGE_KEY}'.`,
      );
    }
  } catch {
    // Fail-safe
  }
}

/**
 * Cleanup triggered on session expiry (HTTP 401) or explicit logout.
 * Cleans the active user's POA records from local storage.
 */
export function handleSessionTerminationCleanup(officeId?: string, userId?: string): void {
  clearUserPoaStorage(officeId, userId);
}
