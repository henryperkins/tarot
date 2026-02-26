/**
 * PatternsSnapshotPanel - Shared expanded patterns snapshot panel.
 *
 * Shows the full context breakdown and theme list with timeframe information.
 */

import { memo } from 'react';
import { X } from '@phosphor-icons/react';
import ContextBreakdown from './ContextBreakdown';

function PatternsSnapshotPanel({
  timeframeLabel,
  formattedSeasonWindow,
  contextBreakdown = [],
  themes = [],
  preferenceDrift,
  onClose,
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border-warm-light)] bg-[color:var(--border-warm-subtle)] p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-high">
            Full Patterns Snapshot
          </p>
          <p className="text-2xs text-muted">
            Timeframe: {timeframeLabel}
            {formattedSeasonWindow ? ` · ${formattedSeasonWindow}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:text-main hover:bg-[color:var(--border-warm-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
          aria-label="Close full patterns snapshot"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {contextBreakdown.length > 0 && (
        <ContextBreakdown
          data={contextBreakdown}
          preferenceDrift={preferenceDrift}
          maxItems={contextBreakdown.length}
        />
      )}
      {themes.length > 0 && (
        <div>
          <p className="text-xs text-muted mb-2">All Themes</p>
          <div className="flex flex-wrap gap-1.5">
            {themes.map((theme, i) => (
              <span
                key={`${theme}-${i}`}
                className="rounded-full bg-[color:var(--panel-dark-3)] px-2.5 py-1 text-xs text-muted-high"
              >
                {theme}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(PatternsSnapshotPanel);
