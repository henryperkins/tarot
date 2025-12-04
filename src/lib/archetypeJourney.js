/**
 * Archetype Journey Utilities
 * 
 * Provides helper functions for gamified analytics features
 * including growth prompts, badges, and analytics normalization.
 */

import { Fire, Star, Lightning, Sparkle, Medal, Trophy, Flame, Sun, Moon, Heart } from '@phosphor-icons/react';

/**
 * Badge icons mapped by streak/achievement type
 */
const BADGE_ICONS = {
  fire: Fire,
  star: Star,
  lightning: Lightning,
  sparkle: Sparkle,
  medal: Medal,
  trophy: Trophy,
  flame: Flame,
  sun: Sun,
  moon: Moon,
  heart: Heart
};

/**
 * Get the icon component for a badge type
 * @param {string} type - Badge type (fire, star, etc.)
 * @returns {React.ComponentType} Icon component
 */
export function getBadgeIcon(type) {
  return BADGE_ICONS[type] || Star;
}

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
      lastAnalyzedAt: rawData.stats?.lastAnalyzedAt ?? rawData.stats?.lastRunAt ?? rawData.lastAnalyzedAt ?? rawData.lastRunAt ?? null
    },

    // Growth prompts/suggestions
    growthPrompts: Array.isArray(rawData.growthPrompts)
      ? rawData.growthPrompts
      : [],

    // Journey stage for gamification
    journeyStage: rawData.journeyStage || rawData.stage || 'beginner'
  };
}

/**
 * Generate a growth prompt based on card patterns
 * @param {string} cardName - Name of the recurring card
 * @param {number} count - How many times it's appeared
 * @returns {string} Growth prompt text
 */
export function getGrowthPrompt(cardName, count) {
  if (!cardName) return '';
  
  const prompts = [
    `${cardName} has appeared ${count} times recently. What message is it trying to convey?`,
    `Reflect on your relationship with ${cardName}. What aspects of this card resonate with your current journey?`,
    `${cardName} keeps showing up. Consider journaling about what this archetype means in your life right now.`,
    `The repeated appearance of ${cardName} suggests an important theme. What lesson is it offering?`,
    `${cardName} is calling for your attention. Take a moment to meditate on its imagery and symbolism.`
  ];
  
  // Use card name hash to select prompt for consistency
  const index = cardName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % prompts.length;
  return prompts[index];
}

/**
 * Calculate streak status message
 * @param {number} current - Current streak count
 * @param {number} longest - Longest streak ever
 * @returns {string} Status message
 */
export function getStreakMessage(current, longest) {
  if (current === 0) {
    return 'Start a new streak with a reading today!';
  }
  
  if (current >= longest && current > 1) {
    return `🔥 New record! ${current} day streak!`;
  }
  
  if (current >= 7) {
    return `Incredible! ${current} day streak. Keep the momentum!`;
  }
  
  if (current >= 3) {
    return `Nice! ${current} day streak going strong.`;
  }
  
  return `${current} day${current === 1 ? '' : 's'} and counting!`;
}

/**
 * Get badge display color based on type
 * @param {string} type - Badge type
 * @returns {string} Tailwind color class
 */
export function getBadgeColor(type) {
  const colors = {
    fire: 'text-orange-400',
    star: 'text-yellow-400',
    lightning: 'text-blue-400',
    sparkle: 'text-purple-400',
    medal: 'text-amber-500',
    trophy: 'text-yellow-500',
    flame: 'text-red-400',
    sun: 'text-yellow-300',
    moon: 'text-indigo-400',
    heart: 'text-pink-400'
  };
  
  return colors[type] || 'text-secondary';
}
