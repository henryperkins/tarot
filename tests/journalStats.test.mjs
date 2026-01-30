import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { computeJournalStats } from '../shared/journal/stats.js';

describe('computeJournalStats theme signals', () => {
  test('prioritizes recent themes with recency weighting', () => {
    const now = Date.now();
    const entries = [
      {
        ts: now,
        themes: { archetypeDescription: 'Clarity' },
        cards: [],
      },
      {
        ts: now - 1000,
        themes: { archetypeDescription: 'Growth' },
        cards: [],
      },
    ];

    const stats = computeJournalStats(entries);

    assert.ok(stats.themeSignals.length >= 2);
    assert.equal(stats.themeSignals[0].label, 'Clarity');
  });

  test('falls back to context when theme analysis is missing', () => {
    const entries = [
      {
        ts: Date.now(),
        context: 'love',
        cards: [],
      },
    ];

    const stats = computeJournalStats(entries);

    assert.ok(stats.recentThemes.includes('love'));
    assert.equal(stats.themeSignals[0].type, 'context');
  });
});
