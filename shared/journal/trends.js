import { getTimestamp, safeJsonParse } from './utils.js';

/**
 * Compute monthly totals from trends data.
 * @param {Array} trends
 * @returns {Array<{year_month: string, total: number, majorCount: number}>}
 */
export function computeMonthlyTotals(trends) {
  if (!Array.isArray(trends)) return [];

  const monthMap = new Map();

  trends.forEach((t) => {
    const month = t.year_month || '';
    if (!month) return;

    const existing = monthMap.get(month) || { year_month: month, total: 0, majorCount: 0 };
    existing.total += t.count || 0;

    // Card numbers 0-21 are Major Arcana (null/undefined/negative are ignored)
    if (t.card_number != null && t.card_number >= 0 && t.card_number <= 21) {
      existing.majorCount += t.count || 0;
    }

    monthMap.set(month, existing);
  });

  return Array.from(monthMap.values()).sort((a, b) => a.year_month.localeCompare(b.year_month));
}

/**
 * Get trends data for a specific card.
 * @param {Array} trends
 * @param {string} cardName
 * @returns {Array}
 */
export function getCardTrends(trends, cardName) {
  if (!Array.isArray(trends) || !cardName) return [];

  return trends
    .filter((t) => t.card_name === cardName)
    .sort((a, b) => (a.year_month || '').localeCompare(b.year_month || ''));
}

const TREND_MONTHS = 6;
// A direction needs a clear change, not one extra draw.
const MIN_TREND_DELTA = 2;
const MIN_TREND_RATIO = 1.5;

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Compare the recent half of a monthly series with the earlier half.
 * @param {number[]} counts - Oldest month first
 * @returns {'up'|'down'|'stable'}
 */
export function classifyCardTrend(counts) {
  if (!Array.isArray(counts) || counts.length < 2) return 'stable';
  const half = Math.floor(counts.length / 2);
  const sum = (values) => values.reduce((total, value) => total + (Number(value) || 0), 0);
  // Ignore an unpaired middle month so both totals cover the same duration.
  const earlier = sum(counts.slice(0, half));
  const recent = sum(counts.slice(counts.length - half));
  if (recent - earlier >= MIN_TREND_DELTA && recent >= earlier * MIN_TREND_RATIO) return 'up';
  if (earlier - recent >= MIN_TREND_DELTA && earlier >= recent * MIN_TREND_RATIO) return 'down';
  return 'stable';
}

/**
 * Monthly appearances for each named card over the calendar months that end
 * at `endDate`, in the reader's local calendar. The series starts at the
 * first month with any reading, so a new journal is not shown as a rise from
 * months before it began. Card names match computeJournalStats keys.
 *
 * @param {Array<object>} entries - Readings to count (all, or the filtered set)
 * @param {string[]} cardNames
 * @param {{ endDate?: Date, months?: number }} [options]
 * @returns {Map<string, { trendData: Array<{year_month: string, count: number}>, trend: 'up'|'down'|'stable' }>}
 */
export function computeCardTrendSeries(entries, cardNames, { endDate = new Date(), months = TREND_MONTHS } = {}) {
  const names = Array.isArray(cardNames) ? cardNames.filter(Boolean) : [];
  const result = new Map();
  if (!names.length || !(endDate instanceof Date) || Number.isNaN(endDate.getTime())) return result;

  const keys = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    keys.push(monthKey(new Date(endDate.getFullYear(), endDate.getMonth() - offset, 1)));
  }
  const keyIndex = new Map(keys.map((key, index) => [key, index]));
  const counts = new Map(names.map((name) => [name, keys.map(() => 0)]));
  let firstActiveIndex = keys.length;

  for (const entry of Array.isArray(entries) ? entries : []) {
    const timestamp = getTimestamp(entry);
    if (timestamp === null || timestamp > endDate.getTime()) continue;
    const index = keyIndex.get(monthKey(new Date(timestamp)));
    if (index === undefined) continue;
    firstActiveIndex = Math.min(firstActiveIndex, index);
    const cardsRaw = entry?.cards || entry?.cards_json;
    const cards = Array.isArray(cardsRaw) ? cardsRaw : safeJsonParse(cardsRaw, []);
    for (const card of Array.isArray(cards) ? cards : []) {
      const series = card ? counts.get(card.name || 'Unknown card') : null;
      if (series) series[index] += 1;
    }
  }

  for (const name of names) {
    const series = counts.get(name).slice(firstActiveIndex);
    result.set(name, {
      trendData: series.map((count, index) => ({ year_month: keys[firstActiveIndex + index], count })),
      trend: classifyCardTrend(series)
    });
  }
  return result;
}
