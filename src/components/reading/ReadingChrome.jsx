import { MoonPhaseIndicator } from '../MoonPhaseIndicator';
import { VisionValidationPanel } from '../VisionValidationPanel';
import { ReadingStart } from './ReadingStart';

export function ReadingChrome({
  displayName,
  readingMeta,
  isHandset,
  isLandscape,
  isTableScene = false,
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
      {reading && (!isTableScene || displayName || readingMeta?.ephemeris) && (
        <div className={isLandscape ? 'mb-2' : 'mb-4 sm:mb-5'}>
          <div className="flex items-center justify-between gap-3">
            {(!isTableScene || displayName) && (
              <p className={isTableScene ? 'text-sm text-muted' : 'text-xs-plus sm:text-sm uppercase tracking-[0.12em] text-accent'}>
                {displayName ? `Reading for ${displayName}` : 'Reading'}
              </p>
            )}
            <MoonPhaseIndicator
              ephemeris={readingMeta?.ephemeris}
              variant={isHandset ? 'icon' : 'compact'}
            />
          </div>
        </div>
      )}

      {!reading ? (
        <ReadingStart
          displayName={displayName}
          readingMeta={readingMeta}
          isHandset={isHandset}
          isLandscape={isLandscape}
          shuffle={shuffle}
          isShuffling={isShuffling}
        />
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
