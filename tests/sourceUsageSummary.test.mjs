import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildUserContextSourceUsage } from '../functions/lib/narrative/sourceUsage.js';
import { formatUsageSummary } from '../src/components/reading/complete/sourceUsageSummary.js';

describe('formatUsageSummary', () => {
  test('returns an empty summary for missing source usage', () => {
    const result = formatUsageSummary(null);

    assert.deepEqual(result, {
      rows: [],
      summary: {
        used: 0,
        requestedNotUsed: 0
      }
    });
  });

  test('captures source usage states and aggregate counts', () => {
    const result = formatUsageSummary({
      spreadCards: { requested: true, used: true },
      vision: { requested: true, used: false },
      userContext: {
        requested: true,
        used: true,
        questionProvided: true,
        questionUsed: true,
        reflectionsProvided: true,
        reflectionsUsed: false,
        displayNameProvided: true,
        displayNameUsed: true,
        focusAreasProvided: false,
        usedInputs: ['question', 'displayName'],
        skippedInputs: {
          reflections: 'deduped_against_card_reflection'
        }
      },
      graphRAG: {
        requested: true,
        used: true,
        mode: 'semantic_scoring',
        passagesProvided: 9,
        passagesUsedInPrompt: 4
      },
      ephemeris: { requested: true, skippedReason: 'token_budget' },
      forecast: { requested: false, used: false }
    });

    const byLabel = Object.fromEntries(result.rows.map((row) => [row.label, row]));

    assert.equal(byLabel['Spread & cards'].state, 'used');
    assert.equal(byLabel['Vision uploads'].state, 'requestedNotUsed');
    assert.equal(byLabel['User context'].detail, 'Used: question, display name | Skipped: reflections (deduped against card reflection)');
    assert.equal(byLabel['Traditional wisdom'].detail, 'semantic_scoring mode, 4/9 passages');
    assert.equal(byLabel.Ephemeris.state, 'skipped');
    assert.equal(byLabel.Ephemeris.detail, 'Reason: token budget');
    assert.equal(byLabel.Forecast.state, 'notRequested');
    assert.deepEqual(result.summary, {
      used: 3,
      requestedNotUsed: 2
    });
  });

  test('renders missing user context as not requested instead of skipped', () => {
    const result = formatUsageSummary({
      spreadCards: { requested: true, used: true },
      vision: { requested: false, used: false },
      userContext: buildUserContextSourceUsage({}),
      graphRAG: { requested: false, used: false },
      ephemeris: { requested: false, used: false },
      forecast: { requested: false, used: false }
    });

    const byLabel = Object.fromEntries(result.rows.map((row) => [row.label, row]));
    assert.equal(byLabel['User context'].state, 'notRequested');
    assert.equal(byLabel['User context'].badgeText, 'Not requested');
    assert.equal(byLabel['User context'].detail, '');
  });
});
