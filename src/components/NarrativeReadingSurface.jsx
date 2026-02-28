import { lazy, Suspense } from 'react';
import PropTypes from 'prop-types';
import { Sparkle } from '@phosphor-icons/react';
import { NarrativeSafetyNotice } from './NarrativeSafetyNotice';
import { SpreadPatterns } from './SpreadPatterns';

const AnimatedReveal = lazy(() => import('./AnimatedReveal'));
const StoryIllustration = lazy(() => import('./StoryIllustration'));

export function NarrativeReadingSurface({
  shouldShowVisualCompanion,
  shouldShowCinematicReveal,
  shouldShowStoryIllustration,
  visualCompanionModeLabel,
  visualCompanionMessage,
  cinematicPosition,
  cinematicRevealMessage,
  readingIdentity,
  cinematicCard,
  resolvedQuestion,
  effectiveTier,
  autoGenerateVisuals,
  onCinematicMediaReady,
  storyArtCards = [],
  fullReadingText,
  narrativeText,
  onStoryArtMediaReady,
  personalReading,
  isGenerating,
  isHandset,
  shouldShowSpreadInsights,
  themes,
  highlightItems = [],
  traditionalPassages = []
}) {
  return (
    <>
      {shouldShowVisualCompanion ? (
        <div className="bg-surface/95 backdrop-blur-xl rounded-2xl border border-secondary/40 shadow-2xl shadow-secondary/30 max-w-full sm:max-w-5xl mx-auto overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-secondary/25 bg-gradient-to-r from-primary/10 via-surface/40 to-accent/10">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-base xxs:text-lg xs:text-xl sm:text-2xl font-serif text-accent flex items-center gap-2 leading-tight">
                <Sparkle className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
                Visual Companion Studio
              </h3>
              <span className="rounded-full border border-secondary/40 bg-surface/70 px-3 py-1 text-2xs sm:text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                {visualCompanionModeLabel}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted mt-2">
              {visualCompanionMessage}
            </p>
          </div>
          <div className={`p-4 sm:p-6 grid gap-4 ${shouldShowCinematicReveal && shouldShowStoryIllustration ? 'lg:grid-cols-2' : ''}`}>
            {shouldShowCinematicReveal ? (
              <div className="rounded-xl border border-secondary/30 bg-surface/70 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h4 className="text-sm sm:text-base font-semibold text-main">
                    Cinematic Reveal
                  </h4>
                  <span className="text-2xs sm:text-xs text-muted">
                    {cinematicPosition}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted mt-2">
                  {cinematicRevealMessage}
                </p>
                <Suspense fallback={<div className="mt-4 rounded-xl border border-secondary/30 bg-surface/70 p-4 text-xs text-muted">Loading cinematic module...</div>}>
                  <AnimatedReveal
                    key={`cinematic-${readingIdentity}`}
                    card={cinematicCard}
                    position={cinematicPosition}
                    question={resolvedQuestion}
                    userTier={effectiveTier}
                    autoGenerate={autoGenerateVisuals}
                    onVideoReady={onCinematicMediaReady}
                    className="mt-4"
                  />
                </Suspense>
              </div>
            ) : null}

            {shouldShowStoryIllustration ? (
              <div className="rounded-xl border border-secondary/30 bg-surface/70 p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h4 className="text-sm sm:text-base font-semibold text-main">
                    Narrative Illustration
                  </h4>
                  <span className="text-2xs sm:text-xs text-muted">
                    {storyArtCards.length} cards
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted mt-2">
                  Uses your full reading text and spread context.
                </p>
                <Suspense fallback={<div className="mt-4 rounded-xl border border-secondary/30 bg-surface/70 p-4 text-xs text-muted">Loading illustration tools...</div>}>
                  <StoryIllustration
                    cards={storyArtCards}
                    question={resolvedQuestion}
                    narrative={fullReadingText || narrativeText}
                    userTier={effectiveTier}
                    autoGenerate={autoGenerateVisuals}
                    generationKey={readingIdentity}
                    onMediaReady={onStoryArtMediaReady}
                    heroMode
                    embedded
                    className="mt-4"
                  />
                </Suspense>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {!personalReading && !isGenerating ? (
        <div className="bg-surface/95 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-secondary/40 max-w-full sm:max-w-5xl mx-auto">
          <NarrativeSafetyNotice className="max-w-3xl mx-auto" compact={isHandset} />
        </div>
      ) : null}

      {shouldShowSpreadInsights ? (
        <div className="w-full max-w-5xl mx-auto">
          <SpreadPatterns
            themes={themes}
            spreadHighlights={highlightItems}
            passages={traditionalPassages}
          />
        </div>
      ) : null}
    </>
  );
}

NarrativeReadingSurface.propTypes = {
  shouldShowVisualCompanion: PropTypes.bool,
  shouldShowCinematicReveal: PropTypes.bool,
  shouldShowStoryIllustration: PropTypes.bool,
  visualCompanionModeLabel: PropTypes.string,
  visualCompanionMessage: PropTypes.string,
  cinematicPosition: PropTypes.string,
  cinematicRevealMessage: PropTypes.string,
  readingIdentity: PropTypes.string,
  cinematicCard: PropTypes.object,
  resolvedQuestion: PropTypes.string,
  effectiveTier: PropTypes.string,
  autoGenerateVisuals: PropTypes.bool,
  onCinematicMediaReady: PropTypes.func,
  storyArtCards: PropTypes.array,
  fullReadingText: PropTypes.string,
  narrativeText: PropTypes.string,
  onStoryArtMediaReady: PropTypes.func,
  personalReading: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  isGenerating: PropTypes.bool,
  isHandset: PropTypes.bool,
  shouldShowSpreadInsights: PropTypes.bool,
  themes: PropTypes.object,
  highlightItems: PropTypes.array,
  traditionalPassages: PropTypes.array
};
