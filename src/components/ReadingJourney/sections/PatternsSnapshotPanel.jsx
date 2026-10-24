/**
 * PatternsSnapshotPanel - Shared expanded patterns snapshot panel.
 *
 * Shows the full context breakdown and theme list with timeframe information.
 */

import { memo } from 'react';
import { CloseButton } from '../../CloseButton';
import ContextBreakdown from './ContextBreakdown';
import { LABEL_CLASS } from '../../../styles/labelClasses';

function PatternsSnapshotPanel({
  timeframeLabel,
  formattedSeasonWindow,
  contextBreakdown = [],
  themes = [],
  preferenceDrift,
  onClose,
}) {
  return (
    <div className="rounded-2xl border border-(--border-warm-light) bg-(--border-warm-subtle) p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`${LABEL_CLASS} text-muted-high`}>
            Full Patterns Snapshot
          </p>
          <p className="text-2xs text-muted">
            Timeframe: {timeframeLabel}
            {formattedSeasonWindow ? ` · ${formattedSeasonWindow}` : ''}
          </p>
        </div>
        <CloseButton label="Close full patterns snapshot" size="sm" onClick={onClose} />
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
                className="rounded-full bg-(--panel-dark-3) px-2.5 py-1 text-xs text-muted-high"
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
