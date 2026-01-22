/**
 * NarrationStatus - Visual status indicator for TTS playback
 *
 * Shows current TTS state with icon and optional label.
 * Provides visual feedback during loading, playing, paused, completed, and error states.
 */
import { CircleNotch, SpeakerHigh, Pause, Warning, CheckCircle } from '@phosphor-icons/react';

const STATUS_CONFIG = {
  idle: {
    icon: null,
    label: null,
    iconClassName: ''
  },
  loading: {
    icon: CircleNotch,
    label: 'Preparing...',
    iconClassName: 'text-accent animate-spin'
  },
  playing: {
    icon: SpeakerHigh,
    label: 'Playing',
    iconClassName: 'text-success'
  },
  paused: {
    icon: Pause,
    label: 'Paused',
    iconClassName: 'text-warning'
  },
  completed: {
    icon: CheckCircle,
    label: 'Finished',
    iconClassName: 'text-muted'
  },
  stopped: {
    icon: null,
    label: null,
    iconClassName: ''
  },
  error: {
    icon: Warning,
    label: 'Error',
    iconClassName: 'text-error'
  },
  'unlock-failed': {
    icon: Warning,
    label: 'Tap to enable',
    iconClassName: 'text-warning'
  }
};

/**
 * @param {Object} props
 * @param {Object} props.ttsState - Current TTS state from audio.js
 * @param {boolean} [props.showLabel=true] - Whether to show text label
 * @param {boolean} [props.showMessage=false] - Whether to show full message instead of label
 * @param {string} [props.className] - Additional CSS classes
 */
export function NarrationStatus({ ttsState, showLabel = true, showMessage = false, className = '' }) {
  const { status, message, cached } = ttsState;
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle;

  // Don't render anything for idle/stopped states
  if (!config.icon) return null;

  const Icon = config.icon;
  const displayText = showMessage && message ? message : config.label;

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      role="status"
      aria-live="polite"
    >
      <Icon
        className={`w-4 h-4 flex-shrink-0 ${config.iconClassName}`}
        weight="bold"
        aria-hidden="true"
      />
      {showLabel && displayText && (
        <span className="text-xs text-muted">
          {displayText}
          {cached && status === 'loading' && (
            <span className="text-muted/70"> (cached)</span>
          )}
        </span>
      )}
    </div>
  );
}

/**
 * NarrationError - Detailed error display with optional action
 *
 * Shows when TTS encounters an error, with specific messaging for tier limits.
 */
export function NarrationError({ ttsState, onUpgrade, className = '' }) {
  const { status, errorCode, message, errorDetails } = ttsState;

  if (status !== 'error') return null;

  const isTierLimit = errorCode === 'TIER_LIMIT';
  const isRateLimit = errorCode === 'RATE_LIMIT';

  return (
    <div
      className={`text-center text-xs bg-error/10 border border-error/30 rounded-lg px-3 py-2 ${className}`}
      role="alert"
    >
      <p className="text-error">
        {message || 'Unable to play narration.'}
      </p>

      {isTierLimit && onUpgrade && (
        <button
          type="button"
          onClick={onUpgrade}
          className="mt-1.5 text-error underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/50 rounded"
        >
          View subscription options
        </button>
      )}

      {isRateLimit && errorDetails?.resetAt && (
        <p className="mt-1 text-muted/80">
          Limit resets: {new Date(errorDetails.resetAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
