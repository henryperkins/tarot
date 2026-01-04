/**
 * Archetype Journey Utilities
 *
 * Provides helper functions for gamified analytics features
 * including growth prompts, badges, and analytics normalization.
 */

export { getCardTrends, computeMonthlyTotals } from '../../shared/journal/trends.js';

/**
 * Normalize raw analytics data into consistent shape
 * Preserves API response format expected by ArchetypeJourneySection component
 * @param {Object} rawData - Raw analytics from API
 * @returns {Object} Normalized analytics object
 */
export function normalizeAnalyticsShape(rawData) {
  if (!rawData) return null;

  // Format currentMonth for display (API returns "YYYY-MM")
  let currentMonth = rawData.currentMonth;
  if (currentMonth && /^\d{4}-\d{2}$/.test(currentMonth)) {
    const [year, month] = currentMonth.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    currentMonth = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  return {
    // Current month label for display
    currentMonth: currentMonth || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),

    // Top cards this month - preserve card_name for component compatibility
    topCards: Array.isArray(rawData.topCards)
      ? rawData.topCards.map(card => ({
        card_name: card.card_name || card.name || card.cardName || 'Unknown Card',
        card_number: card.card_number ?? null,
        count: card.count || 0,
        last_seen: card.last_seen || null,
        first_seen: card.first_seen || null
      }))
      : [],

    // Streak information as array - cards appearing multiple times this month
    // Component calls .slice() on this, so it MUST be an array
    streaks: Array.isArray(rawData.streaks)
      ? rawData.streaks.map(streak => ({
        cardName: streak.cardName || streak.card_name || 'Unknown Card',
        cardNumber: streak.cardNumber ?? streak.card_number ?? null,
        count: streak.count || 0,
        month: streak.month || null
      }))
      : [],

    // Earned badges - preserve API field names for component compatibility
    badges: Array.isArray(rawData.badges)
      ? rawData.badges.map(badge => ({
        badge_type: badge.badge_type || badge.type || 'star',
        badge_key: badge.badge_key || badge.id || 'badge',
        card_name: badge.card_name || badge.label || badge.name || null,
        earned_at: badge.earned_at || badge.earnedAt || null,
        metadata: badge.metadata || {}
      }))
      : [],

    // Reading statistics
    stats: {
      totalReadings: rawData.stats?.totalReadings || rawData.totalReadings || rawData.totalReadingsThisMonth || 0,
      thisMonth: rawData.stats?.thisMonth || rawData.totalReadingsThisMonth || 0,
      avgPerWeek: rawData.stats?.avgPerWeek || 0,
      entriesProcessed: rawData.stats?.entriesProcessed ?? rawData.entriesProcessed ?? null,
      lastAnalyzedAt: rawData.stats?.lastAnalyzedAt ?? rawData.stats?.lastRunAt ?? rawData.lastAnalyzedAt ?? rawData.lastRunAt ?? null,
      needsBackfill: rawData.stats?.needsBackfill ?? rawData.needsBackfill ?? null,
      totalJournalEntries: rawData.stats?.totalJournalEntries ?? null,
      firstJournalMonth: rawData.stats?.firstJournalMonth ?? null,
      lastJournalMonth: rawData.stats?.lastJournalMonth ?? null,
      trackedCardRows: rawData.stats?.trackedCardRows ?? null,
      firstTrackedMonth: rawData.stats?.firstTrackedMonth ?? null,
      lastTrackedMonth: rawData.stats?.lastTrackedMonth ?? null
    },

    // Growth prompts/suggestions
    growthPrompts: Array.isArray(rawData.growthPrompts)
      ? rawData.growthPrompts
      : [],

    // Journey stage for gamification
    journeyStage: rawData.journeyStage || rawData.stage || 'beginner',

    // Six-month trends data for visualizations
    trends: Array.isArray(rawData.trends)
      ? rawData.trends.map(t => ({
        card_name: t.card_name || '',
        card_number: t.card_number ?? null,
        year_month: t.year_month || '',
        count: t.count || 0
      }))
      : [],

    // Major Arcana frequency distribution for current month
    majorArcanaFrequency: rawData.majorArcanaFrequency && typeof rawData.majorArcanaFrequency === 'object'
      ? rawData.majorArcanaFrequency
      : {},

    // Total readings this month (computed from card appearances)
    totalReadingsThisMonth: rawData.totalReadingsThisMonth || 0
  };
}

