import { useState, useEffect, useCallback } from 'react';
import { TrendUp, Medal, Fire } from '@phosphor-icons/react';
import { normalizeAnalyticsShape, getBadgeIcon } from '../lib/archetypeJourney';

/**
 * Loading skeleton for analytics sections
 */
function AnalyticsSkeleton() {
  return (
    <div className="rounded-3xl border border-secondary/20 bg-surface/40 p-5 animate-pulse">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-3 w-3 rounded bg-secondary/20" />
        <div className="h-3 w-28 rounded bg-secondary/20" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-full bg-secondary/10" />
              <div className="h-4 w-24 rounded bg-secondary/10" />
            </div>
            <div className="h-4 w-8 rounded bg-secondary/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

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

  const loadAnalytics = useCallback(async (signal) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/archetype-journey', {
        credentials: 'include',
        signal
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
      // Don't set error state for abort
      if (err.name === 'AbortError') return;
      console.error('Failed to load archetype journey:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    loadAnalytics(controller.signal);

    return () => controller.abort();
  }, [isAuthenticated, loadAnalytics]);

  // Show nothing if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Show loading skeleton while fetching
  if (loading) {
    return <AnalyticsSkeleton />;
  }

  // Log errors but don't show them to user (graceful degradation)
  if (error) {
    console.error('ArchetypeJourneySection error:', error);
    return null;
  }

  // No data yet
  if (!analytics || analytics.topCards.length === 0) {
    return null;
  }

  return (
    <>
      {/* Top Cards This Month */}
      {analytics.topCards.length > 0 && (
        <section
          className="rounded-3xl border border-secondary/20 bg-surface/40 p-5"
          aria-labelledby="archetype-journey-heading"
        >
          <h3
            id="archetype-journey-heading"
            className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent/80"
          >
            <TrendUp className="h-3 w-3" aria-hidden="true" />
            Archetype Journey
          </h3>
          <p className="mb-3 text-xs text-secondary/70">{analytics.currentMonth}</p>
          <ul
            className="space-y-2"
            aria-label="Your top 5 most frequently appearing cards this month"
          >
            {analytics.topCards.slice(0, 5).map((card, index) => (
              <li key={card.card_name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary/10 text-xs font-medium text-secondary"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <span className="text-muted">
                    <span className="sr-only">Rank {index + 1}: </span>
                    {card.card_name}
                  </span>
                </div>
                <span
                  className="text-secondary/60"
                  aria-label={`appeared ${card.count} times`}
                >
                  {card.count}×
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Streak Badges */}
      {analytics.streaks.length > 0 && (
        <section
          className="rounded-3xl border border-secondary/20 bg-surface/40 p-5"
          aria-labelledby="recent-patterns-heading"
        >
          <h3
            id="recent-patterns-heading"
            className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent/80"
          >
            <Fire className="h-3 w-3" aria-hidden="true" />
            Recent Patterns
          </h3>
          <ul className="space-y-3" aria-label="Cards appearing frequently this month">
            {analytics.streaks.slice(0, 3).map((streak) => (
              <li key={streak.cardName} className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent"
                  aria-hidden="true"
                >
                  <Fire className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-secondary">{streak.cardName}</p>
                  <p className="text-xs text-secondary/60">
                    Appeared {streak.count} time{streak.count === 1 ? '' : 's'} this month
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {analytics.streaks.length > 3 && (
            <p className="mt-3 text-xs text-secondary/50">
              +{analytics.streaks.length - 3} more pattern{analytics.streaks.length - 3 !== 1 ? 's' : ''}
            </p>
          )}
        </section>
      )}

      {/* Recent Badges */}
      {analytics.badges.length > 0 && (
        <section
          className="rounded-3xl border border-secondary/20 bg-surface/40 p-5"
          aria-labelledby="achievements-heading"
        >
          <h3
            id="achievements-heading"
            className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent/80"
          >
            <Medal className="h-3 w-3" aria-hidden="true" />
            Achievements
          </h3>
          <ul className="space-y-2" aria-label="Your earned achievements">
            {analytics.badges.slice(0, 3).map((badge) => (
              <li key={badge.badge_key} className="flex items-start gap-2">
                <span className="text-lg" aria-hidden="true">
                  {getBadgeIcon(badge.badge_type)}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-secondary">
                    {badge.card_name || 'Milestone'}
                  </p>
                  <p className="text-xs text-secondary/60">
                    {badge.metadata?.context || 'Achievement unlocked'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
