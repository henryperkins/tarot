import { safeStorage } from './safeStorage.js';
import {
  LEGACY_PERSONALIZATION_STORAGE_KEY,
  sanitizeGuestPersonalization,
  sanitizePersonalization
} from '../utils/personalizationStorage.js';

// Browser settings share one lens catalog; the reading engine's supported
// overrides are checked against these keys in reversalFrameworkOptions.test.mjs.
export const REVERSAL_FRAMEWORK_OPTIONS = Object.freeze([
  { value: 'auto', label: 'Auto (recommended)', description: 'Balances context, card meaning, and spread position.' },
  { value: 'blocked', label: 'Blocked energy', description: 'Reversals highlight blocked or resisted energy.' },
  { value: 'delayed', label: 'Timing & delays', description: 'Reversals point to timing issues and delays.' },
  { value: 'internalized', label: 'Internal process', description: 'Reversals indicate inward or private processing.' },
  { value: 'contextual', label: 'Context-based', description: 'Reversals adapt to your question context.' },
  { value: 'shadow', label: 'Shadow Integration (Jungian)', description: 'Reversals reveal shadow work and integration.' },
  { value: 'mirror', label: 'Mirror / reflection', description: 'Reversals reflect your current state back to you.' },
  { value: 'potentialBlocked', label: 'Unrealized potential', description: 'Reversals show unrealized potential or hesitations.' }
].map(option => Object.freeze(option)));

export const REVERSAL_FRAMEWORK_KEYS = Object.freeze(
  REVERSAL_FRAMEWORK_OPTIONS.filter(option => option.value !== 'auto').map(option => option.value)
);

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
