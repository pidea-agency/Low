/**
 * POA (Power of Attorney) Local Storage Helper
 * Strictly enforces per-office and per-user isolation for cached/local POA records.
 *
 * Storage key format: legal_poa_records_v2:<officeId>:<userId>
 */

export const LEGACY_POA_STORAGE_KEY = 'legal_poa_records_v1';
export const POA_STORAGE_PREFIX = 'legal_poa_records_v2';

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
    } else {
      // Clear all POA v2 keys across all offices/users in this browser
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(`${POA_STORAGE_PREFIX}:`)) {
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
