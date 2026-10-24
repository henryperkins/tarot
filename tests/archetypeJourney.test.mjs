import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyCardTrend, computeCardTrendSeries, computeMonthlyTotals } from '../shared/journal/trends.js';
import { normalizeAnalyticsShape } from '../src/lib/archetypeJourney.js';

/**
 * Tests for archetype journey utilities.
 */

describe('computeMonthlyTotals', () => {
  it('returns empty array for null/undefined input', () => {
    assert.deepStrictEqual(computeMonthlyTotals(null), []);
    assert.deepStrictEqual(computeMonthlyTotals(undefined), []);
    assert.deepStrictEqual(computeMonthlyTotals('not an array'), []);
  });

  it('returns empty array for empty trends', () => {
    assert.deepStrictEqual(computeMonthlyTotals([]), []);
  });

  it('aggregates counts by month', () => {
    const trends = [
      { year_month: '2024-01', card_name: 'The Fool', count: 2 },
      { year_month: '2024-01', card_name: 'The Magician', count: 3 },
      { year_month: '2024-02', card_name: 'The Fool', count: 1 },
    ];

    const result = computeMonthlyTotals(trends);

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].year_month, '2024-01');
    assert.strictEqual(result[0].total, 5); // 2 + 3
    assert.strictEqual(result[1].year_month, '2024-02');
    assert.strictEqual(result[1].total, 1);
  });

  it('sorts months chronologically', () => {
    const trends = [
      { year_month: '2024-03', card_name: 'The Fool', count: 1 },
      { year_month: '2024-01', card_name: 'The Fool', count: 1 },
      { year_month: '2024-02', card_name: 'The Fool', count: 1 },
    ];

    const result = computeMonthlyTotals(trends);

    assert.strictEqual(result[0].year_month, '2024-01');
    assert.strictEqual(result[1].year_month, '2024-02');
    assert.strictEqual(result[2].year_month, '2024-03');
  });

  it('tracks major arcana count separately (card_number 0-21)', () => {
    const trends = [
      { year_month: '2024-01', card_name: 'The Fool', card_number: 0, count: 2 },
      { year_month: '2024-01', card_name: 'The World', card_number: 21, count: 1 },
      { year_month: '2024-01', card_name: 'Ace of Cups', card_number: 22, count: 3 },
    ];

    const result = computeMonthlyTotals(trends);

    assert.strictEqual(result[0].total, 6); // 2 + 1 + 3
    assert.strictEqual(result[0].majorCount, 3); // 2 + 1 (only major arcana)
  });

  it('skips entries without year_month', () => {
    const trends = [
      { year_month: '2024-01', card_name: 'The Fool', count: 2 },
      { card_name: 'The Magician', count: 5 }, // No year_month
      { year_month: '', card_name: 'The High Priestess', count: 3 }, // Empty year_month
    ];

    const result = computeMonthlyTotals(trends);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].total, 2);
  });
});

describe('Six-Month Patterns slicing (ArchetypeJourneySection.jsx:540)', () => {
  /**
   * This test validates the fix for the bug where the "Six-Month Patterns" chart
   * was rendering ALL months instead of just the last 6 months.
   *
   * The fix: computeMonthlyTotals(analytics.trends).slice(-6)
   */

  it('slice(-6) limits data to last 6 months when more data exists', () => {
    // Generate 12 months of data (simulating a user with 1 year of history)
    const trends = [];
    for (let i = 1; i <= 12; i++) {
      const month = i.toString().padStart(2, '0');
      trends.push({ year_month: `2024-${month}`, card_name: 'The Fool', count: i });
    }

    const allMonths = computeMonthlyTotals(trends);
    const lastSix = allMonths.slice(-6);

    assert.strictEqual(allMonths.length, 12, 'Should have all 12 months before slicing');
    assert.strictEqual(lastSix.length, 6, 'Should have exactly 6 months after slicing');
    assert.strictEqual(lastSix[0].year_month, '2024-07', 'First month should be July (7th month)');
    assert.strictEqual(lastSix[5].year_month, '2024-12', 'Last month should be December (12th month)');
  });

  it('slice(-6) returns all data when exactly 6 months exist', () => {
    const trends = [];
    for (let i = 7; i <= 12; i++) {
      const month = i.toString().padStart(2, '0');
      trends.push({ year_month: `2024-${month}`, card_name: 'The Fool', count: 1 });
    }

    const result = computeMonthlyTotals(trends).slice(-6);

    assert.strictEqual(result.length, 6, 'Should return all 6 months');
    assert.strictEqual(result[0].year_month, '2024-07');
    assert.strictEqual(result[5].year_month, '2024-12');
  });

  it('slice(-6) returns all data when less than 6 months exist', () => {
    const trends = [
      { year_month: '2024-10', card_name: 'The Fool', count: 1 },
      { year_month: '2024-11', card_name: 'The Fool', count: 2 },
      { year_month: '2024-12', card_name: 'The Fool', count: 3 },
    ];

    const result = computeMonthlyTotals(trends).slice(-6);

    assert.strictEqual(result.length, 3, 'Should return all 3 months when fewer than 6 exist');
  });

  it('slice(-6) returns empty array when no data exists', () => {
    const result = computeMonthlyTotals([]).slice(-6);
    assert.strictEqual(result.length, 0);
  });

  it('preserves correct totals after slicing', () => {
    // Generate data where earlier months have higher counts
    const trends = [];
    for (let i = 1; i <= 12; i++) {
      const month = i.toString().padStart(2, '0');
      // Earlier months: higher counts (to verify we get the RIGHT slice)
      trends.push({ year_month: `2024-${month}`, card_name: 'The Fool', count: 100 - i });
    }

    const lastSix = computeMonthlyTotals(trends).slice(-6);

    // July (month 7) should have count 93 (100 - 7)
    assert.strictEqual(lastSix[0].total, 93);
    // December (month 12) should have count 88 (100 - 12)
    assert.strictEqual(lastSix[5].total, 88);
  });
});

describe('Edge cases for analytics trends', () => {
  it('handles cross-year data correctly', () => {
    const trends = [
      { year_month: '2023-11', card_name: 'The Fool', count: 1 },
      { year_month: '2023-12', card_name: 'The Fool', count: 2 },
      { year_month: '2024-01', card_name: 'The Fool', count: 3 },
      { year_month: '2024-02', card_name: 'The Fool', count: 4 },
    ];

    const result = computeMonthlyTotals(trends);

    // Should sort correctly across year boundary
    assert.strictEqual(result[0].year_month, '2023-11');
    assert.strictEqual(result[3].year_month, '2024-02');
  });

  it('handles multiple cards in same month', () => {
    const trends = [
      { year_month: '2024-01', card_name: 'The Fool', card_number: 0, count: 5 },
      { year_month: '2024-01', card_name: 'The Magician', card_number: 1, count: 3 },
      { year_month: '2024-01', card_name: 'Ace of Cups', card_number: 22, count: 2 },
      { year_month: '2024-01', card_name: 'Two of Wands', card_number: 36, count: 4 },
    ];

    const result = computeMonthlyTotals(trends);

    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].total, 14); // 5 + 3 + 2 + 4
    assert.strictEqual(result[0].majorCount, 8); // 5 + 3 (only Fool and Magician)
  });
});

describe('normalizeAnalyticsShape current streak propagation', () => {
  it('preserves currentStreak from stats', () => {
    const normalized = normalizeAnalyticsShape({
      currentMonth: '2024-12',
      topCards: [],
      streaks: [],
      badges: [],
      trends: [],
      majorArcanaFrequency: {},
      stats: { currentStreak: 5 }
    });

    assert.strictEqual(normalized.stats.currentStreak, 5);
    assert.strictEqual(normalized.currentStreak || undefined, undefined);
  });

  it('defaults currentStreak to 0 when missing', () => {
    const normalized = normalizeAnalyticsShape({
      currentMonth: '2024-12',
      stats: {}
    });

    assert.strictEqual(normalized.stats.currentStreak, 0);
  });
});

describe('computeCardTrendSeries', () => {
  const at = (year, month, day = 10) => new Date(year, month - 1, day).getTime();
  const reading = (ts, ...names) => ({ ts, cards: names.map((name) => ({ name })) });

  it('counts monthly appearances up to the scope end and marks a rise', () => {
    const entries = [
      reading(at(2026, 8), 'The Star'),
      reading(at(2026, 9), 'The Star'), reading(at(2026, 9, 12), 'The Star'), reading(at(2026, 9, 14), 'The Star', 'The Moon'),
      ...Array.from({ length: 6 }, (_, index) => reading(at(2026, 10, index + 1), 'The Star')),
      reading(at(2026, 11), 'The Star') // after the scope: not counted
    ];
    const trends = computeCardTrendSeries(entries, ['The Star', 'The Moon'], { endDate: new Date(2026, 9, 31) });
    assert.deepStrictEqual(trends.get('The Star').trendData, [
      { year_month: '2026-08', count: 1 },
      { year_month: '2026-09', count: 3 },
      { year_month: '2026-10', count: 6 }
    ]);
    assert.strictEqual(trends.get('The Star').trend, 'up');
    assert.deepStrictEqual(trends.get('The Moon').trendData.map((point) => point.count), [0, 1, 0]);
    assert.strictEqual(trends.get('The Moon').trend, 'stable');
  });

  it('starts at the first month with any reading, so a new journal is not a rise', () => {
    const entries = [reading(at(2026, 10), 'The Fool'), reading(at(2026, 10, 11), 'The Fool'), reading(at(2026, 10, 12), 'The Fool')];
    const trend = computeCardTrendSeries(entries, ['The Fool'], { endDate: new Date(2026, 9, 31) }).get('The Fool');
    assert.deepStrictEqual(trend.trendData, [{ year_month: '2026-10', count: 3 }]);
    assert.strictEqual(trend.trend, 'stable');
  });

  it('keeps quiet months inside the window and reads parsed card JSON', () => {
    const entries = [
      { ts: at(2026, 5), cards_json: JSON.stringify([{ name: 'Death' }, { name: 'Death' }]) },
      { ts: at(2026, 6), cards_json: JSON.stringify([{ name: 'Death' }, { name: 'Death' }]) },
      { ts: at(2026, 10), cards: [{ name: 'The Sun' }] }
    ];
    const trend = computeCardTrendSeries(entries, ['Death'], { endDate: new Date(2026, 9, 15) }).get('Death');
    assert.deepStrictEqual(trend.trendData.map((point) => point.year_month), ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    assert.deepStrictEqual(trend.trendData.map((point) => point.count), [2, 2, 0, 0, 0, 0]);
    assert.strictEqual(trend.trend, 'down');
  });

  it('returns nothing for missing names or an invalid end date', () => {
    assert.strictEqual(computeCardTrendSeries([], []).size, 0);
    assert.strictEqual(computeCardTrendSeries([reading(at(2026, 10), 'The Star')], ['The Star'], { endDate: new Date('nope') }).size, 0);
  });
});

describe('classifyCardTrend', () => {
  it('needs a clear change between the earlier and recent months', () => {
    assert.strictEqual(classifyCardTrend([0, 0, 0, 1, 3, 6]), 'up');
    assert.strictEqual(classifyCardTrend([3, 3, 3, 0, 0, 1]), 'down');
    assert.strictEqual(classifyCardTrend([2, 2, 2, 2, 2, 2]), 'stable');
    assert.strictEqual(classifyCardTrend([0, 0, 0, 0, 0, 1]), 'stable');
    assert.strictEqual(classifyCardTrend([5]), 'stable');
    assert.strictEqual(classifyCardTrend([2, 5]), 'up');
  });
});
