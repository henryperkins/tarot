import { ArrowCounterClockwise } from '@phosphor-icons/react';
import { MoonPhaseIndicator } from '../MoonPhaseIndicator';
import { VisionValidationPanel } from '../VisionValidationPanel';

export function ReadingChrome({
  displayName,
  readingMeta,
  isHandset,
  isLandscape,
  reading,
  shuffle,
  isShuffling,
  canShowVisionPanel,
  isNarrativeFocus,
  deckStyleId,
  handleVisionResults,
  handleRemoveVisionResult,
  handleClearVisionResults,
  visionConflicts,
  visionResults
}) {
  return (
    <>
      <div className={isLandscape ? 'mb-2' : 'mb-4 sm:mb-5'}>
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

      {!reading ? (
        <div className="hidden sm:block text-center mb-8 sm:mb-10">
          <button
            onClick={shuffle}
            disabled={isShuffling}
            className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-surface font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-lg shadow-lg transition-all inline-flex items-center gap-2 sm:gap-3 text-base sm:text-lg"
          >
            <ArrowCounterClockwise className={`w-4 h-4 sm:w-5 sm:h-5 ${isShuffling ? 'motion-safe:animate-spin' : ''}`} />
            <span>{isShuffling ? 'Shuffling the cards...' : 'Draw cards'}</span>
          </button>
        </div>
      ) : null}

      {canShowVisionPanel && !isNarrativeFocus ? (
        <div className="mb-6">
          <VisionValidationPanel
            deckStyle={deckStyleId}
            onResults={handleVisionResults}
            onRemoveResult={handleRemoveVisionResult}
            onClearResults={handleClearVisionResults}
            conflicts={visionConflicts}
            results={visionResults}
          />
        </div>
      ) : null}
    </>
  );
}
