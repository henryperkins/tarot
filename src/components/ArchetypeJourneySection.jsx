import { useState, useEffect } from 'react';
import { TrendUp, Medal, Fire } from '@phosphor-icons/react';

/**
 * Archetype Journey Section
 *
 * Displays gamified analytics to embed within JournalInsightsPanel:
 * - Top 5 cards this month
 * - Streak badges
 * - Growth prompts
 */
export function ArchetypeJourneySection({ isAuthenticated }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadAnalytics();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/archetype-journey', {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 403) {
          // Analytics disabled
          setLoading(false);
          return;
        }
        throw new Error('Failed to load analytics');
      }

      const data = await response.json();
      setAnalytics(data.analytics);
    } catch (err) {
      console.error('Failed to load archetype journey:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated || loading || error) {
    return null;
  }

  if (!analytics || analytics.topCards.length === 0) {
    return null;
  }

  return (
    <>
      {/* Top Cards This Month */}
      {analytics.topCards.length > 0 && (
        <div className="rounded-3xl border border-secondary/20 bg-surface/40 p-5">
          <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent/80">
            <TrendUp className="h-3 w-3" /> Archetype Journey
          </h3>
          <p className="mb-3 text-xs text-secondary/70">{analytics.currentMonth}</p>
          <ul className="space-y-2">
            {analytics.topCards.slice(0, 5).map((card, index) => (
              <li key={card.card_name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary/10 text-xs font-medium text-secondary">
                    {index + 1}
                  </span>
                  <span className="text-muted">{card.card_name}</span>
                </div>
                <span className="text-secondary/60">{card.count}×</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Streak Badges */}
      {analytics.streaks && analytics.streaks.length > 0 && (
        <div className="rounded-3xl border border-secondary/20 bg-surface/40 p-5">
          <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent/80">
            <Fire className="h-3 w-3" /> Recent Patterns
          </h3>
          <div className="space-y-3">
            {analytics.streaks.slice(0, 3).map((streak) => (
              <div key={streak.cardName} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent">
                  🔥
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-secondary">{streak.cardName}</p>
                  <p className="text-xs text-secondary/60">
                    Appeared {streak.count}× this month
                  </p>
                </div>
              </div>
            ))}
          </div>
          {analytics.streaks.length > 3 && (
            <p className="mt-3 text-xs text-secondary/50">
              +{analytics.streaks.length - 3} more pattern{analytics.streaks.length - 3 !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Recent Badges */}
      {analytics.badges && analytics.badges.length > 0 && (
        <div className="rounded-3xl border border-secondary/20 bg-surface/40 p-5">
          <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent/80">
            <Medal className="h-3 w-3" /> Achievements
          </h3>
          <div className="space-y-2">
            {analytics.badges.slice(0, 3).map((badge) => (
              <div key={badge.badge_key} className="flex items-start gap-2">
                <span className="text-lg">{getBadgeIcon(badge.badge_type)}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-secondary">
                    {badge.card_name || 'Milestone'}
                  </p>
                  <p className="text-xs text-secondary/60">
                    {badge.metadata?.context || 'Achievement unlocked'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Get icon for badge type
 */
function getBadgeIcon(badgeType) {
  const icons = {
    'streak': '🔥',
    'frequency': '⭐',
    'completion': '🎯',
    'milestone': '🏆'
  };
  return icons[badgeType] || '✨';
}

/**
 * Get growth prompt for a card based on its archetype
 */
export function getGrowthPrompt(cardName) {
  const prompts = {
    'The Fool': 'Recurring Fool energy suggests you\'re in a season of new beginnings. What leap of faith is calling you?',
    'The Magician': 'The Magician appears when you have all the tools you need. What are you ready to manifest?',
    'The High Priestess': 'The High Priestess invites you inward. What wisdom is your intuition revealing?',
    'The Empress': 'The Empress energy calls for nurturing. What in your life needs tending?',
    'The Emperor': 'The Emperor appears when structure is needed. Where can you create healthy boundaries?',
    'The Hierophant': 'The Hierophant suggests learning from tradition. What wisdom do you seek?',
    'The Lovers': 'The Lovers energy highlights choices and alignment. What values guide your path?',
    'The Chariot': 'The Chariot appears when willpower is key. What direction are you moving toward?',
    'Strength': 'Strength energy is about compassion and courage. Where can you be gentle with power?',
    'The Hermit': 'The Hermit calls for solitude and reflection. What inner guidance are you seeking?',
    'Wheel of Fortune': 'The Wheel reminds you of life\'s cycles. What patterns are you noticing?',
    'Justice': 'Justice appears when balance is needed. What truth are you seeking?',
    'The Hanged Man': 'The Hanged Man invites a new perspective. What are you ready to release?',
    'Death': 'Death energy signals transformation. What old form is ready to fall away?',
    'Temperance': 'Temperance calls for integration. What opposing forces seek harmony?',
    'The Devil': 'The Devil appears when examining attachments. What pattern needs awareness?',
    'The Tower': 'Tower energy brings breakthrough. What false structure is crumbling to make space for truth?',
    'The Star': 'The Star brings hope and healing. What dream is worth nurturing?',
    'The Moon': 'The Moon illuminates illusions. What fears need gentle examination?',
    'The Sun': 'The Sun celebrates vitality and joy. What brings you alive?',
    'Judgement': 'Judgement calls for awakening. What is your soul calling you toward?',
    'The World': 'The World signals completion. What cycle is reaching its fulfillment?'
  };

  return prompts[cardName] || 'This card holds important energy for your journey. What does its recurring presence reveal?';
}
