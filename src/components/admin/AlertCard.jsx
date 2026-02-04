import { memo, useState } from 'react';
import { Warning, CheckCircle, CaretDown, CaretUp } from '@phosphor-icons/react';

const TYPE_LABELS = {
  regression: 'Score Regression',
  safety_spike: 'Safety Flag Spike',
  tone_spike: 'Low Tone Spike',
  coverage_drop: 'Coverage Drop'
};

const SEVERITY_STYLES = {
  critical: {
    border: 'border-error/40',
    bg: 'bg-error/10',
    badge: 'bg-error/20 text-error',
    icon: 'text-error'
  },
  warning: {
    border: 'border-warning/40',
    bg: 'bg-warning/10',
    badge: 'bg-warning/20 text-warning',
    icon: 'text-warning'
  }
};

/**
 * Format a metric value for display
 */
function formatValue(metric, value) {
  if (value === null || value === undefined) return '--';
  if (metric?.includes('rate') || metric === 'card_coverage') {
    return `${(value * 100).toFixed(2)}%`;
  }
  return value.toFixed(3);
}

/**
 * AlertCard - Individual alert with acknowledge workflow
 *
 * @param {Object} props
 * @param {Object} props.alert - Alert object from API
 * @param {Function} props.onAcknowledge - Callback to acknowledge alert
 * @param {boolean} [props.isLoading] - Whether acknowledgment is in progress
 */
export const AlertCard = memo(function AlertCard({
  alert,
  onAcknowledge,
  isLoading = false
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState('');

  const styles = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.warning;
  const typeLabel = TYPE_LABELS[alert.alert_type] || alert.alert_type;
  const readingCount = Number.isFinite(alert.reading_count) ? alert.reading_count : null;
  const sampleLabel = alert.metric_name === 'card_coverage' ? 'readings' : 'eval samples';

  const handleAcknowledge = () => {
    onAcknowledge(alert.id, notes);
  };

  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} overflow-hidden`}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Warning className={`h-5 w-5 mt-0.5 ${styles.icon}`} weight="duotone" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded-full ${styles.badge}`}>
                  {alert.severity}
                </span>
                <span className="text-sm font-medium text-main">{typeLabel}</span>
              </div>

              <div className="mt-1 space-y-0.5">
                <p className="text-xs text-muted">
                  <span className="font-medium">{alert.metric_name}:</span>{' '}
                  {formatValue(alert.metric_name, alert.observed_value)}
                  <span className="mx-1">vs</span>
                  baseline {formatValue(alert.metric_name, alert.baseline_value)}
                  {alert.delta !== null && alert.delta !== undefined && (
                    <>
                      <span className="mx-1">=</span>
                      <span className={alert.delta < 0 ? 'text-error' : 'text-success'}>
                        {alert.delta >= 0 ? '+' : ''}{formatValue(alert.metric_name, alert.delta)}
                      </span>
                    </>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {alert.period_key} &middot; {readingCount !== null ? readingCount.toLocaleString() : '--'} {sampleLabel}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors shrink-0"
          >
            Acknowledge
            {expanded ? (
              <CaretUp className="h-3 w-3" />
            ) : (
              <CaretDown className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded acknowledge section */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-secondary/20">
          <label htmlFor={`notes-${alert.id}`} className="block text-xs text-muted mb-1.5">
            Resolution notes (optional)
          </label>
          <textarea
            id={`notes-${alert.id}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What was done to address this alert?"
            className="w-full rounded-lg border border-secondary/30 bg-main px-3 py-2 text-sm text-main placeholder:text-muted/50 resize-none focus:border-accent/50 focus:outline-none"
            rows={2}
          />
          <button
            onClick={handleAcknowledge}
            disabled={isLoading}
            className="mt-2 flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-main transition-colors hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <CheckCircle className="h-4 w-4" weight="duotone" />
            {isLoading ? 'Saving...' : 'Confirm Acknowledgment'}
          </button>
        </div>
      )}
    </div>
  );
});

export default AlertCard;
