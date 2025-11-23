import { useState, useEffect } from 'react';
import { TrendUp, Medal, Fire } from '@phosphor-icons/react';
import { normalizeAnalyticsShape, getBadgeIcon } from '../lib/archetypeJourney';

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
      // Normalize to ensure all arrays exist
      setAnalytics(normalizeAnalyticsShape(data.analytics));
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
      {analytics.streaks.length > 0 && (
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
      {analytics.badges.length > 0 && (
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
