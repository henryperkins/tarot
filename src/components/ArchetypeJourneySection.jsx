import { useState, useEffect, useCallback, useRef } from 'react';
import { TrendUp, Medal, Fire, ArrowsClockwise, Sparkle } from '@phosphor-icons/react';
import { normalizeAnalyticsShape, getBadgeIcon } from '../lib/archetypeJourney';

function parseTimestamp(value) {
  if (!value) return null;
  if (typeof value === 'number') {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? (numeric < 1e12 ? numeric * 1000 : numeric) : null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function formatTimestampLabel(value) {
  const ms = parseTimestamp(value);
  if (!ms) return null;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

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
 * Empty state component with backfill option
 */
function EmptyState({ onBackfill, isBackfilling, backfillResult }) {
  const abortControllerRef = useRef(null);

  const handleClick = useCallback(() => {
    // Abort any previous backfill
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    onBackfill(abortControllerRef.current.signal);
  }, [onBackfill]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <section
      className="rounded-3xl border border-secondary/20 bg-surface/40 p-5"
      aria-labelledby="archetype-journey-empty-heading"
    >
      <h3
        id="archetype-journey-empty-heading"
        className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent/80"
      >
        <Sparkle className="h-3 w-3" aria-hidden="true" />
        Archetype Journey
      </h3>

      {backfillResult ? (
        <div className="text-sm text-secondary/80">
          <p className="mb-2 text-primary">
            {backfillResult.success ? 'Backfill complete!' : 'Backfill failed'}
          </p>
          {backfillResult.success && backfillResult.stats && (
            <ul className="space-y-1 text-xs text-muted">
              <li>{backfillResult.stats.entriesProcessed} entries processed</li>
              <li>{backfillResult.stats.cardsTracked} cards tracked</li>
              {backfillResult.stats.badgesAwarded > 0 && (
                <li>{backfillResult.stats.badgesAwarded} badges awarded</li>
              )}
            </ul>
          )}
          {!backfillResult.success && (
            <p className="text-xs text-error">{backfillResult.message || 'Please try again'}</p>
          )}
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted leading-relaxed">
            Track which cards appear most often in your readings to discover recurring archetypal themes in your journey.
          </p>

          <button
            onClick={handleClick}
            disabled={isBackfilling}
            aria-label="Analyze journal for archetype journey"
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium
              border border-accent/30 text-accent
              hover:bg-accent/10 hover:border-accent/50
              active:bg-accent/20
              disabled:opacity-50 disabled:cursor-not-allowed
              transition
            `}
          >
            <ArrowsClockwise
              className={`h-3.5 w-3.5 ${isBackfilling ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {isBackfilling ? 'Analyzing readings...' : 'Analyze past readings'}
          </button>

          <p className="mt-3 text-[11px] text-secondary/50">
            This will scan your journal entries and build your card frequency data.
          </p>
          {backfillResult?.success && backfillResult?.stats?.entriesProcessed > 0 && (
            <p className="mt-1 text-[10px] text-secondary/60">
              Last run processed {backfillResult.stats.entriesProcessed} entries.
            </p>
          )}
        </>
      )}
    </section>
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
export function ArchetypeJourneySection({ isAuthenticated, showEmptyState = true }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState(null);
  const reloadControllerRef = useRef(null);

  const loadAnalytics = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    setIsDisabled(false);

    try {
      const response = await fetch('/api/archetype-journey', {
        credentials: 'include',
        signal
      });

      if (!response.ok) {
        if (response.status === 403) {
          // Analytics disabled by user preference
          setIsDisabled(true);
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

  const handleBackfill = useCallback(async (signal) => {
    setIsBackfilling(true);
    setBackfillResult(null);

    try {
      const response = await fetch('/api/archetype-journey-backfill', {
        method: 'POST',
        credentials: 'include',
        signal
      });

      const data = await response.json();

      if (!response.ok) {
        setBackfillResult({ success: false, message: data.error || 'Backfill failed' });
        return;
      }

      setBackfillResult({ success: true, stats: data.stats });

      // Reload analytics after successful backfill
      if (data.stats?.cardsTracked > 0) {
        // Reload with slight delay to let DB settle
        await new Promise(resolve => setTimeout(resolve, 300));
        if (!signal?.aborted) {
          if (reloadControllerRef.current) {
            reloadControllerRef.current.abort();
          }
          const reloadController = new AbortController();
          reloadControllerRef.current = reloadController;
          try {
            await loadAnalytics(reloadController.signal);
          } finally {
            if (reloadControllerRef.current === reloadController) {
              reloadControllerRef.current = null;
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Backfill failed:', err);
      setBackfillResult({ success: false, message: err.message });
    } finally {
      setIsBackfilling(false);
    }
  }, [loadAnalytics]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    loadAnalytics(controller.signal);

    return () => controller.abort();
  }, [isAuthenticated, loadAnalytics]);

  useEffect(() => {
    return () => {
      if (reloadControllerRef.current) {
        reloadControllerRef.current.abort();
      }
    };
  }, []);

  // Show nothing if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Show loading skeleton while fetching
  if (loading) {
    return <AnalyticsSkeleton />;
  }

  // Feature disabled by user - show nothing (they can enable in UserMenu)
  if (isDisabled) {
    return null;
  }

  // Log errors but don't show them to user (graceful degradation)
  if (error) {
    console.error('ArchetypeJourneySection error:', error);
    return null;
  }

  // No data yet - show empty state with backfill option
  if (!analytics || analytics.topCards.length === 0) {
    if (!showEmptyState) {
      return null;
    }
    return (
      <EmptyState
        onBackfill={handleBackfill}
        isBackfilling={isBackfilling}
        backfillResult={backfillResult}
      />
    );
  }

  const sectionBlocks = [];

  if (analytics.topCards.length > 0) {
    sectionBlocks.push({
      key: 'topCards',
      content: (
        <>
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent/80">
            <TrendUp className="h-3 w-3" aria-hidden="true" />
            Top Cards
          </div>
          <ul className="space-y-2" aria-label="Your top 5 most frequently appearing cards this month">
            {analytics.topCards.slice(0, 5).map((card, index) => (
              <li key={`${card.card_name}-${index}`} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary/10 text-xs font-medium text-secondary" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="text-muted">
                    <span className="sr-only">Rank {index + 1}: </span>
                    {card.card_name}
                  </span>
                </div>
                <span className="text-secondary/60" aria-label={`appeared ${card.count} times`}>
                  {card.count}×
                </span>
              </li>
            ))}
          </ul>
        </>
      )
    });
  }

  if (analytics.streaks.length > 0) {
    sectionBlocks.push({
      key: 'patterns',
      content: (
        <>
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent/80">
            <Fire className="h-3 w-3" aria-hidden="true" />
            Recent Patterns
          </div>
          <ul className="space-y-3" aria-label="Cards appearing frequently this month">
            {analytics.streaks.slice(0, 3).map((streak) => (
              <li key={streak.cardName} className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent"
                  aria-hidden="true"
                  title="Pattern highlight"
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
        </>
      )
    });
  }

  if (analytics.badges.length > 0) {
    sectionBlocks.push({
      key: 'achievements',
      content: (
        <>
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent/80">
            <Medal className="h-3 w-3" aria-hidden="true" />
            Achievements
          </div>
          <ul className="space-y-2" aria-label="Your earned achievements">
            {analytics.badges.slice(0, 3).map((badge) => {
              const BadgeIcon = getBadgeIcon(badge.badge_type);
              return (
                <li key={badge.badge_key} className="flex items-start gap-2">
                  <span className="text-lg" title={badge.card_name || 'Achievement badge'}>
                    <BadgeIcon className="h-4 w-4" aria-hidden="true" />
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
              );
            })}
          </ul>
        </>
      )
    });
  }

  const topCardWithLastSeen = analytics.topCards.find((card) => card.last_seen);
  const lastAnalyzedLabel = formatTimestampLabel(analytics.stats?.lastAnalyzedAt || topCardWithLastSeen?.last_seen);
  const processedCaptionCount = analytics.stats?.entriesProcessed ?? analytics.stats?.totalReadings ?? null;
  const runCaptionParts = [];
  if (lastAnalyzedLabel) {
    runCaptionParts.push(`Last analyzed ${lastAnalyzedLabel}`);
  }
  if (processedCaptionCount) {
    runCaptionParts.push(`${processedCaptionCount} entries processed`);
  }
  const runCaption = runCaptionParts.join(' · ');

  return (
    <section className="rounded-3xl border border-secondary/30 bg-surface/70 p-5 space-y-5" aria-labelledby="archetype-journey-heading">
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-secondary/70">Archetype Journey</p>
        <h3 id="archetype-journey-heading" className="text-lg font-serif text-main">{analytics.currentMonth}</h3>
        <p className="text-xs text-secondary/60">
          {analytics.stats?.thisMonth ?? 0} entries this month · Avg {analytics.stats?.avgPerWeek ?? 0}/week · {analytics.stats?.totalReadings ?? 0} total
        </p>
        {runCaption && (
          <p className="text-[11px] text-secondary/60">
            {runCaption}
          </p>
        )}
      </div>
      {sectionBlocks.length > 0 ? (
        <div className="space-y-5 divide-y divide-secondary/15">
          {sectionBlocks.map((section, index) => (
            <div key={section.key} className={index === 0 ? '' : 'pt-5'}>
              {section.content}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-secondary/70">Run more readings to unlock archetype analytics.</p>
      )}
    </section>
  );
}
