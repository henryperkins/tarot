/**
 * NarrationProgress - Visual progress bar for TTS playback
 *
 * Shows progress through the narration with time display.
 * Only visible when actively playing, paused, or loading.
 */

/**
 * Format seconds into m:ss display
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
  if (!seconds || !isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * @param {Object} props
 * @param {Object} props.ttsState - Current TTS state from audio.js
 * @param {string} [props.className] - Additional CSS classes
 */
export function NarrationProgress({ ttsState, className = '' }) {
  const { status, progress, currentTime, duration } = ttsState;

  // Only show when actively playing, paused, or has duration
  const showProgress = (status === 'playing' || status === 'paused') && duration > 0;
  if (!showProgress) return null;

  const progressPercent = Math.min(Math.max(progress * 100, 0), 100);

  return (
    <div
      className={`flex items-center gap-2 sm:gap-3 ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(progressPercent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Narration progress: ${formatTime(currentTime)} of ${formatTime(duration)}`}
    >
      {/* Progress bar track */}
      <div className="flex-1 h-1.5 bg-secondary/20 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-200 ease-out"
          style={{ width: `${progressPercent.toFixed(1)}%` }}
        />
      </div>

      {/* Time display */}
      <span className="text-xs text-muted tabular-nums min-w-[4.5rem] text-right whitespace-nowrap">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
}
