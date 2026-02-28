import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PERSONALIZATION,
  PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH,
  PERSONALIZATION_GUEST_KEY,
  PERSONALIZATION_STORAGE_KEY_BASE,
  getPersonalizationStorageKey,
  loadPersonalizationFromStorage,
  sanitizePersonalization,
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

test('sanitizePersonalization normalizes enums, focus areas, and displayName length', () => {
  const loaded = sanitizePersonalization({
    displayName: `   ${'A'.repeat(80)}   `,
    tarotExperience: 'guru',
    readingTone: 'soft',
    preferredSpreadDepth: 'ultra-deep',
    spiritualFrame: 'woo',
    focusAreas: [' love ', '', 'love', 'career', 123, 'x'.repeat(60)],
    showRitualSteps: 'yes'
  });

  assert.equal(loaded.displayName.length, PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH);
  assert.equal(loaded.tarotExperience, DEFAULT_PERSONALIZATION.tarotExperience);
  assert.equal(loaded.readingTone, DEFAULT_PERSONALIZATION.readingTone);
  assert.equal(loaded.preferredSpreadDepth, DEFAULT_PERSONALIZATION.preferredSpreadDepth);
  assert.equal(loaded.spiritualFrame, DEFAULT_PERSONALIZATION.spiritualFrame);
  assert.deepEqual(loaded.focusAreas, ['love', 'career', 'x'.repeat(40)]);
  assert.equal(loaded.showRitualSteps, DEFAULT_PERSONALIZATION.showRitualSteps);
});

test('sanitizePersonalization can preserve displayName spacing for live input state', () => {
  const loaded = sanitizePersonalization(
    {
      displayName: '  Mary Jane  '
    },
    { trimDisplayName: false }
  );

  assert.equal(loaded.displayName, '  Mary Jane  ');
});

test('loadPersonalizationFromStorage sanitizes stale invalid values', () => {
  const storage = {
    getItem() {
      return JSON.stringify({
        displayName: `${'B'.repeat(60)}`,
        readingTone: 'soft',
        tarotExperience: 'master'
      });
    }
  };

  const loaded = loadPersonalizationFromStorage('tarot-personalization:any', storage);
  assert.equal(loaded.displayName.length, PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH);
  assert.equal(loaded.readingTone, DEFAULT_PERSONALIZATION.readingTone);
  assert.equal(loaded.tarotExperience, DEFAULT_PERSONALIZATION.tarotExperience);
});
