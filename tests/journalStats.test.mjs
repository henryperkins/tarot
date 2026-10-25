import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { computeJournalStats } from '../shared/journal/stats.js';

test('large histories format calendar labels per month while preserving counts and quiet months', t => {
  const original = Date.prototype.toLocaleString;
  let formatted = 0;
  t.mock.method(Date.prototype, 'toLocaleString', function (...args) {
    formatted += 1;
    return original.apply(this, args);
  });
  const entries = Array.from({ length: 1000 }, (_, index) => ({
    ts: new Date(2026, index < 600 ? 7 : 9, 15, 12).getTime(),
    context: 'self', cards: []
  }));
  const stats = computeJournalStats(entries);
  assert.deepEqual(stats.monthlyCadence.map(month => month.count), [600, 0, 400]);
  assert.equal(formatted, 3, 'format each calendar bucket once, including the quiet month');
});

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
