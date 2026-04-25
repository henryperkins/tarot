import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  mergePersonalizationSources,
  resolveReadingPersonalizationContext,
  sanitizePersonalizationInput
} from '../functions/lib/userPersonalization.js';
import { PERSONALIZATION_REQUEST_EXPLICIT_FIELDS_KEY } from '../shared/contracts/personalizationConstants.js';

function createDb({ userRow = null, journalPreferences = null } = {}) {
  return {
    prepare(sql) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes('FROM users')) {
                return userRow;
              }
              if (sql.includes('FROM journal_entries')) {
                return journalPreferences == null
                  ? null
                  : { user_preferences_json: JSON.stringify(journalPreferences) };
              }
              throw new Error(`Unexpected query: ${sql}`);
            }
          };
        }
      };
    }
  };
}

describe('sanitizePersonalizationInput', () => {
  test('preserves explicit empty clears while sanitizing supported fields', () => {
    const result = sanitizePersonalizationInput({
      displayName: '  Sam  ',
      focusAreas: [],
      tarotExperience: 'newbie',
      readingTone: 'balanced',
      spiritualFrame: 'mixed',
      preferredSpreadDepth: 'deep'
    });

    assert.deepEqual(result, {
      displayName: 'Sam',
      focusAreas: [],
      tarotExperience: 'newbie',
      readingTone: 'balanced',
      spiritualFrame: 'mixed',
      preferredSpreadDepth: 'deep'
    });
  });
});

describe('mergePersonalizationSources', () => {
  test('lets later sources override earlier ones field-by-field', () => {
    const result = mergePersonalizationSources(
      {
        displayName: 'Rowan',
        readingTone: 'gentle',
        focusAreas: ['grief support'],
        tarotExperience: 'experienced'
      },
      {
        readingTone: 'blunt',
        focusAreas: ['career clarity']
      }
    );

    assert.deepEqual(result, {
      displayName: 'Rowan',
      readingTone: 'blunt',
      focusAreas: ['career clarity'],
      tarotExperience: 'experienced'
    });
  });
});

describe('resolveReadingPersonalizationContext', () => {
  test('merges journal, user-row, and request personalization with request precedence and loads global memories', async () => {
    const db = createDb({
      userRow: {
        display_name: 'Sam',
        reading_tone: 'gentle',
        spiritual_frame: 'mixed',
        preferred_spread_depth: 'deep'
      },
      journalPreferences: {
        tarotExperience: 'experienced',
        focusAreas: ['grief support']
      }
    });

    const memoryCalls = [];
    const result = await resolveReadingPersonalizationContext(
      db,
      'user-1',
      {
        readingTone: 'blunt',
        focusAreas: ['career clarity']
      },
      {
        loadMemories: async (_db, userId, options) => {
          memoryCalls.push({ userId, options });
          return [
            { text: 'They are navigating a long relocation season.', category: 'life_context', scope: 'global' }
          ];
        }
      }
    );

    assert.deepEqual(result.storedPersonalization, {
      displayName: 'Sam',
      readingTone: 'gentle',
      spiritualFrame: 'mixed',
      tarotExperience: 'experienced',
      preferredSpreadDepth: 'deep',
      focusAreas: ['grief support']
    });
    assert.deepEqual(result.personalization, {
      displayName: 'Sam',
      readingTone: 'blunt',
      spiritualFrame: 'mixed',
      tarotExperience: 'experienced',
      preferredSpreadDepth: 'deep',
      focusAreas: ['career clarity']
    });
    assert.equal(result.memories.length, 1);
    assert.deepEqual(memoryCalls, [{
      userId: 'user-1',
      options: {
        scope: 'global',
        limit: 8
      }
    }]);
  });

  test('does not let implicit client defaults override stored personalization', async () => {
    const db = createDb({
      userRow: {
        display_name: 'Sam',
        reading_tone: 'gentle',
        spiritual_frame: 'spiritual',
        preferred_spread_depth: 'deep'
      },
      journalPreferences: {
        tarotExperience: 'experienced',
        focusAreas: ['grief support']
      }
    });

    const result = await resolveReadingPersonalizationContext(
      db,
      'user-1',
      {
        readingTone: 'balanced',
        spiritualFrame: 'mixed',
        tarotExperience: 'newbie',
        preferredSpreadDepth: 'standard',
        focusAreas: ['career clarity']
      },
      { loadMemories: async () => [] }
    );

    assert.deepEqual(result.personalization, {
      displayName: 'Sam',
      readingTone: 'gentle',
      spiritualFrame: 'spiritual',
      tarotExperience: 'experienced',
      preferredSpreadDepth: 'deep',
      focusAreas: ['career clarity']
    });
  });

  test('lets explicit default request fields override stored personalization', async () => {
    const db = createDb({
      userRow: {
        display_name: 'Sam',
        reading_tone: 'gentle',
        spiritual_frame: 'spiritual',
        preferred_spread_depth: 'deep'
      },
      journalPreferences: {
        tarotExperience: 'experienced',
        focusAreas: ['grief support']
      }
    });

    const result = await resolveReadingPersonalizationContext(
      db,
      'user-1',
      {
        readingTone: 'balanced',
        preferredSpreadDepth: 'standard',
        [PERSONALIZATION_REQUEST_EXPLICIT_FIELDS_KEY]: ['readingTone', 'preferredSpreadDepth']
      },
      { loadMemories: async () => [] }
    );

    assert.deepEqual(result.personalization, {
      displayName: 'Sam',
      readingTone: 'balanced',
      spiritualFrame: 'spiritual',
      tarotExperience: 'experienced',
      preferredSpreadDepth: 'standard',
      focusAreas: ['grief support']
    });
  });

  test('falls back to request-only personalization for anonymous requests', async () => {
    const result = await resolveReadingPersonalizationContext(
      null,
      null,
      {
        displayName: 'Morgan',
        tarotExperience: 'newbie'
      }
    );

    assert.deepEqual(result.personalization, {
      displayName: 'Morgan',
      tarotExperience: 'newbie'
    });
    assert.equal(result.storedPersonalization, null);
    assert.deepEqual(result.memories, []);
  });
});
