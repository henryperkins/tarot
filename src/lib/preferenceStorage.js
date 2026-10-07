import { safeStorage } from './safeStorage.js';
import {
  LEGACY_PERSONALIZATION_STORAGE_KEY,
  sanitizeGuestPersonalization,
  sanitizePersonalization
} from '../utils/personalizationStorage.js';

// These values are optional checkpoints; React retains live state when a
// browser blocks access to storage or runs out of space.
export const safeSessionStorage = {
  getItem(key) {
    try {
      return typeof window === 'undefined' ? null : window.sessionStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      if (typeof window !== 'undefined') window.sessionStorage?.setItem(key, value);
    } catch {
      // The current tab can continue without a persisted checkpoint.
    }
  },
  removeItem(key) {
    try {
      if (typeof window !== 'undefined') window.sessionStorage?.removeItem(key);
    } catch {
      // There may be no accessible checkpoint to remove.
    }
  }
};

export function migrateLegacyPersonalization(storageKey, { userId = null, storage = safeStorage } = {}) {
  let legacyRaw;
  try {
    legacyRaw = storage.getItem(LEGACY_PERSONALIZATION_STORAGE_KEY);
    if (!legacyRaw) return null;
    const existingRaw = storage.getItem(storageKey);
    let existing = null;
    try {
      existing = JSON.parse(existingRaw);
    } catch {
      // A corrupt scoped copy cannot take precedence over a readable original.
    }
    if (existing !== null && typeof existing === 'object' && !Array.isArray(existing)) {
      // A valid owner-scoped preference takes precedence over legacy data.
      storage.removeItem(LEGACY_PERSONALIZATION_STORAGE_KEY);
      return null;
    }
  } catch {
    return null;
  }

  let migrated;
  try {
    const parsed = JSON.parse(legacyRaw);
    migrated = userId ? sanitizePersonalization(parsed) : sanitizeGuestPersonalization(parsed);
  } catch {
    return null;
  }

  // Preserve the original signed-in payload; guest migration intentionally
  // removes private personalization according to the existing guest contract.
  const scopedRaw = userId ? legacyRaw : JSON.stringify(migrated);
  let copyVerified = false;
  try {
    storage.setItem(storageKey, scopedRaw);
    // The safe wrapper may swallow a failed write. Verify the copy before
    // exposing private values or removing the only readable original.
    copyVerified = storage.getItem(storageKey) === scopedRaw;
    if (copyVerified) {
      storage.removeItem(LEGACY_PERSONALIZATION_STORAGE_KEY);
    }
  } catch {
    // Keep the original recoverable without assigning private values to a new owner.
  }
  return copyVerified ? migrated : null;
}
