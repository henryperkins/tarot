import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PERSONALIZATION,
  PERSONALIZATION_GUEST_KEY,
  PERSONALIZATION_STORAGE_KEY_BASE,
  getPersonalizationStorageKey,
  loadPersonalizationFromStorage,
  sanitizeGuestPersonalization
} from '../src/utils/personalizationStorage.js';

test('getPersonalizationStorageKey scopes personalization per user', () => {
  assert.equal(getPersonalizationStorageKey(null), PERSONALIZATION_GUEST_KEY);
  assert.equal(getPersonalizationStorageKey(undefined), PERSONALIZATION_GUEST_KEY);
  assert.equal(getPersonalizationStorageKey('user-123'), `${PERSONALIZATION_STORAGE_KEY_BASE}:user-123`);
});

test('sanitizeGuestPersonalization clears identifying fields for guests', () => {
  const sanitized = sanitizeGuestPersonalization({
    ...DEFAULT_PERSONALIZATION,
    displayName: 'Henry',
    preferredSpreadDepth: 'deep',
    readingTone: 'gentle'
  });

  assert.equal(sanitized.displayName, '');
  assert.equal(sanitized.preferredSpreadDepth, 'standard');
  assert.equal(sanitized.readingTone, DEFAULT_PERSONALIZATION.readingTone);
});

test('loadPersonalizationFromStorage returns defaults for missing storage', () => {
  const storage = {
    getItem() {
      return null;
    }
  };

  const loaded = loadPersonalizationFromStorage('tarot-personalization:any', storage);
  assert.equal(loaded.readingTone, DEFAULT_PERSONALIZATION.readingTone);
  assert.equal(loaded.preferredSpreadDepth, DEFAULT_PERSONALIZATION.preferredSpreadDepth);
});
