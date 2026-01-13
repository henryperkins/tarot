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
