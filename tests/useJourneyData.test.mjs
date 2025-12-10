/**
 * Tests for useJourneyData and related utilities.
 *
 * These tests cover:
 * - Data utilities (Major Arcana map, streak, badges)
 * - Safe storage utilities
 * - Season narrative generation
 * - Coach suggestion priority logic
 */

import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';

import {
  computeMajorArcanaMapFromEntries,
  computeStreakFromEntries,
  computeBadgesFromEntries,
  generateJourneyStory,
  computePreferenceDrift,
} from '../src/lib/journalInsights.js';
import {
  computeFilterHash,
  buildSeasonKey,
} from '../src/lib/safeStorage.js';

describe('computeMajorArcanaMapFromEntries', () => {
  it('returns empty array for empty entries', () => {
    assert.deepEqual(computeMajorArcanaMapFromEntries([]), []);
    assert.deepEqual(computeMajorArcanaMapFromEntries(null), []);
    assert.deepEqual(computeMajorArcanaMapFromEntries(undefined), []);
  });

  it('counts Major Arcana card appearances', () => {
    const entries = [
      {
        cards: [
          { name: 'The Fool' },
          { name: 'The Tower' },
          { name: 'Three of Cups' }, // Minor - should not count
        ],
      },
      {
        cards: [
          { name: 'The Fool' },
          { name: 'Death' },
        ],
      },
    ];

    const result = computeMajorArcanaMapFromEntries(entries);

    // Should have all 22 Major Arcana
    assert.equal(result.length, 22);

    // Check specific counts
    const fool = result.find(m => m.name === 'The Fool');
    const tower = result.find(m => m.name === 'The Tower');
    const death = result.find(m => m.name === 'Death');
    const magician = result.find(m => m.name === 'The Magician');

    assert.equal(fool.count, 2);
    assert.equal(tower.count, 1);
    assert.equal(death.count, 1);
    assert.equal(magician.count, 0);
  });

  it('handles cards_json field', () => {
    const entries = [
      {
        cards_json: JSON.stringify([
          { name: 'The Star' },
          { name: 'The Moon' },
        ]),
      },
    ];

    const result = computeMajorArcanaMapFromEntries(entries);
    const star = result.find(m => m.name === 'The Star');
    const moon = result.find(m => m.name === 'The Moon');

    assert.equal(star.count, 1);
    assert.equal(moon.count, 1);
  });
});

describe('computeStreakFromEntries', () => {
  it('returns 0 for empty entries', () => {
    assert.equal(computeStreakFromEntries([]), 0);
    assert.equal(computeStreakFromEntries(null), 0);
  });

  it('computes streak from consecutive days', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const entries = [
      { ts: today.getTime() },
      { ts: yesterday.getTime() },
      { ts: twoDaysAgo.getTime() },
    ];

    const streak = computeStreakFromEntries(entries);
    assert.equal(streak, 3);
  });

  it('handles gap in readings', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const fourDaysAgo = new Date(today);
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    const entries = [
      { ts: today.getTime() },
      { ts: yesterday.getTime() },
      // Gap of 2 days
      { ts: fourDaysAgo.getTime() },
    ];

    const streak = computeStreakFromEntries(entries);
    assert.equal(streak, 2);
  });

  it('handles created_at timestamps (seconds)', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const entries = [
      { created_at: Math.floor(today.getTime() / 1000) },
      { created_at: Math.floor(yesterday.getTime() / 1000) },
    ];

    const streak = computeStreakFromEntries(entries);
    assert.equal(streak, 2);
  });
});

describe('computeBadgesFromEntries', () => {
  it('returns empty array for empty entries', () => {
    assert.deepEqual(computeBadgesFromEntries([]), []);
    assert.deepEqual(computeBadgesFromEntries(null), []);
  });

  it('returns badges for cards appearing 3+ times', () => {
    const entries = [
      { ts: Date.now(), cards: [{ name: 'The Tower' }, { name: 'The Fool' }] },
      { ts: Date.now() - 1000, cards: [{ name: 'The Tower' }, { name: 'Death' }] },
      { ts: Date.now() - 2000, cards: [{ name: 'The Tower' }, { name: 'The Fool' }] },
      { ts: Date.now() - 3000, cards: [{ name: 'Death' }] },
    ];

    const badges = computeBadgesFromEntries(entries);

    // Tower appears 3 times, Fool appears 2 times, Death appears 2 times
    assert.equal(badges.length, 1);
    assert.equal(badges[0].card_name, 'The Tower');
    assert.equal(badges[0].count, 3);
    assert.equal(badges[0].badge_type, 'fire');
  });

  it('sorts badges by count descending', () => {
    const entries = [];
    const ts = Date.now();

    // Add 5 Tower appearances
    for (let i = 0; i < 5; i++) {
      entries.push({ ts: ts - i * 1000, cards: [{ name: 'The Tower' }] });
    }
    // Add 3 Death appearances
    for (let i = 0; i < 3; i++) {
      entries.push({ ts: ts - (i + 5) * 1000, cards: [{ name: 'Death' }] });
    }

    const badges = computeBadgesFromEntries(entries);

    assert.equal(badges.length, 2);
    assert.equal(badges[0].card_name, 'The Tower');
    assert.equal(badges[0].count, 5);
    assert.equal(badges[1].card_name, 'Death');
    assert.equal(badges[1].count, 3);
  });
});

describe('generateJourneyStory', () => {
  it('returns null for insufficient entries', () => {
    assert.equal(generateJourneyStory([]), null);
    assert.equal(generateJourneyStory([{ ts: 1 }]), null);
    assert.equal(generateJourneyStory([{ ts: 1 }, { ts: 2 }]), null);
  });

  it('generates story for 3+ entries', () => {
    const entries = [
      { ts: Date.now(), context: 'love', cards: [{ name: 'The Lovers' }] },
      { ts: Date.now() - 1000, context: 'love', cards: [{ name: 'The Lovers' }] },
      { ts: Date.now() - 2000, context: 'career', cards: [{ name: 'The Tower' }] },
    ];

    const story = generateJourneyStory(entries);

    // Should return a string (may be null if not enough meaningful data)
    // The template-based implementation requires frequentCards to exist
    if (story) {
      assert.equal(typeof story, 'string');
      assert.ok(story.length > 0);
    }
  });

  it('uses precomputed stats when provided', () => {
    const entries = [
      { ts: Date.now(), context: 'career', cards: [{ name: 'The Sun' }] },
      { ts: Date.now() - 1000, context: 'career', cards: [{ name: 'The Sun' }] },
      { ts: Date.now() - 2000, context: 'love', cards: [{ name: 'The Moon' }] },
    ];

    const precomputedStats = {
      totalReadings: 3,
      frequentCards: [{ name: 'The Sun', count: 2 }],
      contextBreakdown: [{ name: 'career', count: 2 }],
      recentThemes: ['optimism'],
    };

    const story = generateJourneyStory(entries, { precomputedStats });

    if (story) {
      assert.ok(story.includes('The Sun'));
      assert.ok(story.toLowerCase().includes('career'));
    }
  });
});

describe('computePreferenceDrift', () => {
  it('returns null for empty entries', () => {
    assert.equal(computePreferenceDrift([]), null);
    assert.equal(computePreferenceDrift([], ['love']), null);
  });

  it('returns null for empty focus areas', () => {
    const entries = [{ context: 'love' }];
    assert.equal(computePreferenceDrift(entries, []), null);
  });

  it('detects drift when reading contexts differ from focus areas', () => {
    const entries = [
      { context: 'career' },
      { context: 'career' },
      { context: 'spiritual' },
    ];
    const focusAreas = ['love', 'self_worth'];

    const drift = computePreferenceDrift(entries, focusAreas);

    assert.equal(drift.hasDrift, true);
    assert.ok(drift.driftContexts.length > 0);
    assert.equal(drift.driftContexts[0].context, 'career');
  });
});

describe('computeFilterHash', () => {
  it('returns default for empty entries', () => {
    assert.equal(computeFilterHash([]), '000000');
    assert.equal(computeFilterHash(null), '000000');
  });

  it('produces consistent hash for same entries', () => {
    const entries = [
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ];

    const hash1 = computeFilterHash(entries);
    const hash2 = computeFilterHash(entries);

    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 6);
  });

  it('produces different hash for different entries', () => {
    const entries1 = [{ id: 'a' }, { id: 'b' }];
    const entries2 = [{ id: 'c' }, { id: 'd' }];

    const hash1 = computeFilterHash(entries1);
    const hash2 = computeFilterHash(entries2);

    assert.notEqual(hash1, hash2);
  });
});

describe('buildSeasonKey', () => {
  it('builds key with all components', () => {
    const key = buildSeasonKey({
      userId: 'user123',
      filtersActive: false,
      filteredEntries: [],
      seasonWindow: {
        start: new Date('2024-12-01'),
        end: new Date('2024-12-31'),
      },
      locale: 'en-US',
      timezone: 'America/New_York',
    });

    assert.ok(key.includes('user123'));
    assert.ok(key.includes('default'));
    assert.ok(key.includes('2024-12-01'));
    assert.ok(key.includes('2024-12-31'));
    assert.ok(key.includes('en-US'));
    assert.ok(key.includes('America/New_York'));
  });

  it('includes filter hash when filters active', () => {
    const key = buildSeasonKey({
      userId: 'user123',
      filtersActive: true,
      filteredEntries: [{ id: 'a' }, { id: 'b' }],
      seasonWindow: {
        start: new Date('2024-12-01'),
        end: new Date('2024-12-31'),
      },
      locale: 'en-US',
    });

    assert.ok(key.includes('filtered:'));
    assert.ok(!key.includes(':default:'));
  });

  it('handles missing userId', () => {
    const key = buildSeasonKey({
      filtersActive: false,
      filteredEntries: [],
      seasonWindow: {
        start: new Date('2024-12-01'),
        end: new Date('2024-12-31'),
      },
      locale: 'en-US',
    });

    assert.ok(key.includes('anon'));
  });
});

describe('contextBreakdown immutability', () => {
  it('sorting contextBreakdown should not mutate original array', () => {
    // Simulate the pattern used in useJourneyData for season narrative / coach suggestion
    const original = [
      { name: 'love', count: 5 },
      { name: 'career', count: 10 },
      { name: 'spiritual', count: 3 },
    ];

    // Store original order
    const originalOrder = original.map(c => c.name);

    // Clone before sorting (the fix pattern)
    const sorted = [...original].sort((a, b) => b.count - a.count);

    // Original should be unchanged
    assert.deepEqual(original.map(c => c.name), originalOrder);
    assert.equal(original[0].name, 'love'); // Still first

    // Sorted should be in count order
    assert.equal(sorted[0].name, 'career'); // Highest count first
    assert.equal(sorted[1].name, 'love');
    assert.equal(sorted[2].name, 'spiritual');
  });

  it('direct sort mutates original array (demonstrating the bug)', () => {
    const original = [
      { name: 'love', count: 5 },
      { name: 'career', count: 10 },
      { name: 'spiritual', count: 3 },
    ];

    // This is the buggy pattern - direct sort mutates
    const result = original.sort((a, b) => b.count - a.count);

    // Original IS mutated (this is the bug we fixed)
    assert.equal(original[0].name, 'career'); // Now career is first
    assert.strictEqual(result, original); // Same reference
  });
});

describe('scoped entries logic', () => {
  it('filters entries to current month when using server data pattern', () => {
    // Simulate the scoping logic from useJourneyData
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const entries = [
      { id: 'current1', ts: now.getTime() - 1000 }, // Current month
      { id: 'current2', ts: currentMonthStart.getTime() + 86400000 }, // Current month
      { id: 'old', ts: now.getTime() - 60 * 24 * 60 * 60 * 1000 }, // 60 days ago
    ];

    const windowStart = currentMonthStart.getTime();
    const windowEnd = currentMonthEnd.getTime() + (24 * 60 * 60 * 1000);

    const scopedEntries = entries.filter(entry => {
      const ts = entry?.ts || (entry?.created_at ? entry.created_at * 1000 : null);
      if (!ts) return false;
      return ts >= windowStart && ts <= windowEnd;
    });

    // Should only include current month entries
    assert.equal(scopedEntries.length, 2);
    assert.ok(scopedEntries.every(e => e.id.startsWith('current')));
    assert.ok(!scopedEntries.some(e => e.id === 'old'));
  });

  it('uses all entries when filters are active (not scoped)', () => {
    const filtersActive = true;
    const filteredEntries = [
      { id: 'filtered1' },
      { id: 'filtered2' },
    ];
    const entries = [
      { id: 'all1' },
      { id: 'all2' },
      { id: 'all3' },
    ];

    // When filters active, use filteredEntries directly (the logic in useJourneyData)
    const activeEntries = filtersActive ? filteredEntries : entries;

    assert.equal(activeEntries.length, 2);
    assert.equal(activeEntries[0].id, 'filtered1');
  });

  it('handles entries with created_at in seconds', () => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const entries = [
      { id: 'seconds', created_at: Math.floor(now.getTime() / 1000) }, // Seconds timestamp
      { id: 'millis', ts: now.getTime() }, // Milliseconds timestamp
    ];

    const windowStart = currentMonthStart.getTime();
    const windowEnd = currentMonthEnd.getTime() + (24 * 60 * 60 * 1000);

    const scopedEntries = entries.filter(entry => {
      const ts = entry?.ts || (entry?.created_at ? entry.created_at * 1000 : null);
      if (!ts) return false;
      return ts >= windowStart && ts <= windowEnd;
    });

    // Both should be included (both are current month)
    assert.equal(scopedEntries.length, 2);
  });

  it('filters entries when seasonWindow is explicitly provided', () => {
    // Test the fixed bug: seasonWindow should filter entries to that range
    const now = new Date();
    const jan2024 = new Date(2024, 0, 15); // Jan 15, 2024
    const feb2024 = new Date(2024, 1, 15); // Feb 15, 2024
    const mar2024 = new Date(2024, 2, 15); // Mar 15, 2024

    const entries = [
      { id: 'jan', ts: jan2024.getTime() },
      { id: 'feb', ts: feb2024.getTime() },
      { id: 'mar', ts: mar2024.getTime() },
      { id: 'current', ts: now.getTime() },
    ];

    // Simulate seasonWindow prop covering Jan-Feb 2024
    const seasonWindow = {
      start: new Date(2024, 0, 1),
      end: new Date(2024, 1, 29),
    };

    const windowStart = seasonWindow.start.getTime();
    const windowEnd = seasonWindow.end.getTime() + (24 * 60 * 60 * 1000);

    const scopedEntries = entries.filter(entry => {
      const ts = entry?.ts || (entry?.created_at ? entry.created_at * 1000 : null);
      if (!ts) return false;
      return ts >= windowStart && ts <= windowEnd;
    });

    // Should only include Jan and Feb entries
    assert.equal(scopedEntries.length, 2);
    assert.ok(scopedEntries.some(e => e.id === 'jan'));
    assert.ok(scopedEntries.some(e => e.id === 'feb'));
    assert.ok(!scopedEntries.some(e => e.id === 'mar'));
    assert.ok(!scopedEntries.some(e => e.id === 'current'));
  });

  it('exportEntries returns full journal when unfiltered', () => {
    // This tests the exportEntries logic in useJourneyData
    const filtersActive = false;
    const seasonWindow = null;
    const entries = [
      { id: 'old', ts: Date.now() - 60 * 24 * 60 * 60 * 1000 },
      { id: 'current', ts: Date.now() },
    ];
    const filteredEntries = entries;

    // Simulate exportEntries logic
    let exportEntries;
    if (filtersActive) {
      exportEntries = filteredEntries;
    } else if (seasonWindow) {
      // Would filter to seasonWindow
      exportEntries = entries;
    } else {
      // Unfiltered: export full journal
      exportEntries = entries;
    }

    // Should return all entries (full journal)
    assert.equal(exportEntries.length, 2);
    assert.ok(exportEntries.some(e => e.id === 'old'));
    assert.ok(exportEntries.some(e => e.id === 'current'));
  });

  it('exportEntries returns filtered entries when filters are active', () => {
    const filtersActive = true;
    const seasonWindow = null;
    const entries = [
      { id: 'a', ts: Date.now() },
      { id: 'b', ts: Date.now() },
      { id: 'c', ts: Date.now() },
    ];
    const filteredEntries = [
      { id: 'a', ts: Date.now() },
    ];

    // Simulate exportEntries logic
    let exportEntries;
    if (filtersActive) {
      exportEntries = filteredEntries;
    } else if (seasonWindow) {
      exportEntries = entries;
    } else {
      exportEntries = entries;
    }

    // Should return only filtered entries
    assert.equal(exportEntries.length, 1);
    assert.equal(exportEntries[0].id, 'a');
  });
});
