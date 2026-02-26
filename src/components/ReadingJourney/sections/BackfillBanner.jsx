/**
 * BackfillBanner - Non-blocking banner to prompt users to run D1 backfill.
 *
 * Shows when authenticated users have journal entries but haven't populated
 * the D1 card_appearances table yet. The banner is dismissible and shows
 * the benefit of running backfill (enhanced server-side analytics).
 */

import { ArrowsClockwise, Info, X, CheckCircle, XCircle } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { COMPACT_SYNC_ACTION_BUTTON_CLASS } from '../../../styles/buttonClasses';

const DISMISS_KEY = 'journal_backfill_dismissed_v1';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const getDismissKey = (userId) => (userId ? `${DISMISS_KEY}:${userId}` : `${DISMISS_KEY}:guest`);

function checkDismissed(dismissKey) {
  if (typeof window === 'undefined') return false;
  try {
    const dismissedAt = Number(localStorage.getItem(dismissKey) || 0);
    return dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export default function BackfillBanner({
  onBackfill,
  isBackfilling,
  backfillResult,
  userId,
  variant = 'default', // 'default' | 'compact'
}) {
  const dismissKey = getDismissKey(userId);
  const [isDismissed, setIsDismissed] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Check dismiss state on mount and when userId changes
  useEffect(() => {
    setIsDismissed(checkDismissed(dismissKey));
  }, [dismissKey]);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(getDismissKey(userId), String(Date.now()));
    } catch {
      // localStorage unavailable
    }
  };

  // After successful backfill, show success briefly then hide
  if (backfillResult?.success) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-[color:color-mix(in_srgb,var(--status-success)_12%,transparent)] border border-[color:color-mix(in_srgb,var(--status-success)_24%,transparent)] px-3 py-2 text-xs text-[color:var(--status-success)]">
        <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        <span>
          Analysis complete!{' '}
          {backfillResult.stats?.cardsTracked > 0 && (
            <span className="text-muted">
              ({backfillResult.stats.cardsTracked} cards tracked)
            </span>
          )}
        </span>
      </div>
    );
  }

  // Show error state
  if (backfillResult && !backfillResult.success) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-[color:color-mix(in_srgb,var(--status-error)_12%,transparent)] border border-[color:color-mix(in_srgb,var(--status-error)_24%,transparent)] px-3 py-2 text-xs text-[color:var(--status-error)]">
        <XCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        <span>Analysis failed. {backfillResult.message || 'Please try again.'}</span>
        <button
          onClick={onBackfill}
          disabled={isBackfilling}
          className="ml-auto text-[color:var(--status-error)] hover:text-[color:color-mix(in_srgb,var(--status-error)_80%,transparent)] underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isBackfilling ? 'Retrying...' : 'Retry'}
        </button>
      </div>
    );
  }

  // Allow dismissal
  if (isDismissed) {
    return null;
  }

  // Compact variant for tight spaces
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-[color:var(--border-warm-subtle)] border border-[color:var(--border-warm-light)] px-3 py-2">
        <Info className="h-3.5 w-3.5 flex-shrink-0 text-[color:var(--brand-primary)]" aria-hidden="true" />
        <span className="text-xs sm:text-2xs text-muted-high flex-1">
          Analyze past readings for deeper insights
        </span>
        <button
          onClick={onBackfill}
          disabled={isBackfilling}
          className={COMPACT_SYNC_ACTION_BUTTON_CLASS}
          aria-label="Analyze past readings"
        >
          <ArrowsClockwise
            className={`h-3 w-3 ${isBackfilling && !prefersReducedMotion ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          {isBackfilling ? 'Analyzing...' : 'Analyze'}
        </button>
        <button
          onClick={handleDismiss}
          className="min-h-touch min-w-touch flex items-center justify-center -m-2 text-muted hover:text-main touch-manipulation"
          aria-label="Remind me in 7 days"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  // Default variant
  return (
    <div className="relative rounded-xl bg-gradient-ambient border border-[color:var(--border-warm-light)] p-3">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 min-h-touch min-w-touch flex items-center justify-center -m-2 text-muted hover:text-main touch-manipulation"
        aria-label="Remind me in 7 days"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-start gap-3 pr-4">
        <div className="rounded-full bg-[color:var(--accent-25)] p-1.5">
          <ArrowsClockwise className="h-3.5 w-3.5 text-[color:var(--brand-primary)]" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-xs font-medium text-main mb-1">
            Analyze past readings
          </p>
          <p className="text-xs sm:text-2xs text-muted mb-2">
            One-time analysis for insights; it does not change your entries.
          </p>
          <button
            onClick={onBackfill}
            disabled={isBackfilling}
            className="
              inline-flex items-center gap-1.5 min-h-touch px-3 py-1.5 rounded-full
              text-xs sm:text-2xs font-medium text-[color:var(--text-main)] bg-[color:var(--accent-25)]
              border border-[color:var(--border-warm-light)]
              hover:bg-[color:var(--accent-45)] hover:border-[color:var(--border-warm)]
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors touch-manipulation
            "
          >
            <ArrowsClockwise
              className={`h-3 w-3 ${isBackfilling && !prefersReducedMotion ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {isBackfilling ? 'Analyzing readings...' : 'Analyze now'}
          </button>
        </div>
      </div>
    </div>
  );
}
