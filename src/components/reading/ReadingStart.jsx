import { ArrowCounterClockwise } from '@phosphor-icons/react';
import { MoonPhaseIndicator } from '../MoonPhaseIndicator';

// Setup stays lightweight until the reader starts a draw.
export function ReadingStart({ displayName, readingMeta, isHandset, isLandscape, shuffle, isShuffling = false }) {
  return (
    <>
      {/* Handsets keep the draw action in the dock. */}
      <div className={`hidden sm:block ${isLandscape ? 'mb-2' : 'mb-4 sm:mb-5'}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs-plus sm:text-sm uppercase tracking-[0.12em] text-accent">
            {displayName ? `Reading for ${displayName}` : 'Reading'}
          </p>
          <MoonPhaseIndicator
            ephemeris={readingMeta?.ephemeris}
            variant={isHandset ? 'icon' : 'compact'}
          />
        </div>
      </div>
      {!isHandset && (
        <div className="text-center mb-8 sm:mb-10">
          <button
            type="button"
            onClick={shuffle}
            disabled={isShuffling}
            className="min-h-cta max-w-full bg-accent hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed text-surface font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-lg shadow-lg transition-all inline-flex items-center justify-center gap-2 sm:gap-3 text-base sm:text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-main"
          >
            <ArrowCounterClockwise aria-hidden="true" className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${isShuffling ? 'motion-safe:animate-spin' : ''}`} />
            <span className="min-w-0 break-words">{isShuffling ? 'Shuffling the cards...' : 'Draw cards'}</span>
          </button>
        </div>
      )}
    </>
  );
}
