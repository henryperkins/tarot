/**
 * BackfillBanner - Non-blocking banner to prompt users to run D1 backfill.
 *
 * Shows when authenticated users have journal entries but haven't populated
 * the D1 card_appearances table yet. The banner is dismissible and shows
 * the benefit of running backfill (enhanced server-side analytics).
 */

import { ArrowsClockwise, Info, X, CheckCircle, XCircle } from '@phosphor-icons/react';
import { useState } from 'react';

export default function BackfillBanner({
  onBackfill,
  isBackfilling,
  backfillResult,
  variant = 'default', // 'default' | 'compact'
}) {
  const [isDismissed, setIsDismissed] = useState(false);

  // After successful backfill, show success briefly then hide
  if (backfillResult?.success) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-400/20 px-3 py-2 text-xs text-green-200/90">
        <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        <span>
          Journey analytics synced!{' '}
          {backfillResult.stats?.cardsTracked > 0 && (
            <span className="text-green-200/70">
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
      <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-400/20 px-3 py-2 text-xs text-red-200/90">
        <XCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        <span>Sync failed. {backfillResult.message || 'Please try again.'}</span>
        <button
          onClick={onBackfill}
          disabled={isBackfilling}
          className="ml-auto text-red-200 hover:text-red-100 underline disabled:opacity-50 disabled:cursor-not-allowed"
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
      <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-400/15 px-3 py-2">
        <Info className="h-3.5 w-3.5 flex-shrink-0 text-amber-300/70" aria-hidden="true" />
        <span className="text-[11px] text-amber-100/70 flex-1">
          Sync your journal for enhanced analytics
        </span>
        <button
          onClick={onBackfill}
          disabled={isBackfilling}
          className="flex items-center gap-1.5 text-[11px] font-medium text-amber-200 hover:text-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowsClockwise
            className={`h-3 w-3 ${isBackfilling ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          {isBackfilling ? 'Syncing...' : 'Sync'}
        </button>
        <button
          onClick={() => setIsDismissed(true)}
          className="ml-1 text-amber-200/50 hover:text-amber-200/80"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  // Default variant
  return (
    <div className="relative rounded-xl bg-gradient-to-br from-amber-500/10 via-amber-600/5 to-transparent border border-amber-400/15 p-3">
      <button
        onClick={() => setIsDismissed(true)}
        className="absolute top-2 right-2 text-amber-200/40 hover:text-amber-200/70"
        aria-label="Dismiss sync prompt"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-start gap-3 pr-4">
        <div className="rounded-full bg-amber-400/20 p-1.5">
          <ArrowsClockwise className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-amber-100/90 mb-1">
            Sync for enhanced analytics
          </p>
          <p className="text-[11px] text-amber-100/60 mb-2">
            Analyze your past readings to unlock server-synced journey tracking across devices.
          </p>
          <button
            onClick={onBackfill}
            disabled={isBackfilling}
            className="
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
              text-[11px] font-medium text-amber-50 bg-amber-400/15
              border border-amber-300/30
              hover:bg-amber-400/25 hover:border-amber-300/40
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            "
          >
            <ArrowsClockwise
              className={`h-3 w-3 ${isBackfilling ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            {isBackfilling ? 'Syncing readings...' : 'Sync now'}
          </button>
        </div>
      </div>
    </div>
  );
}
