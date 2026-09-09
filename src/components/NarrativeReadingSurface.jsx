import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Sparkle } from '@phosphor-icons/react';
import { NarrativeSafetyNotice } from './NarrativeSafetyNotice';
import { SpreadPatterns } from './SpreadPatterns';
import { VisualCompanionModal } from './reading/VisualCompanionModal';
import { OUTLINE_BUTTON_CLASS } from '../styles/buttonClasses';

const AnimatedReveal = lazy(() => import('./AnimatedReveal'));
const StoryIllustration = lazy(() => import('./StoryIllustration'));

function VisualCompanionTrigger({
  modeLabel,
  message,
  isOpen,
  onOpen
}) {
  return (
    <div className="w-full max-w-full sm:max-w-5xl mx-auto">
      <div className="panel-mystic rounded-2xl border border-[color:var(--border-warm-light)] p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-main">
              <Sparkle className="w-4 h-4 text-secondary" aria-hidden="true" />
              Visual Companion Studio
            </p>
            <p className="text-xs text-muted">{message}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            {modeLabel ? (
              <span className="rounded-full border border-secondary/40 bg-surface/70 px-3 py-1 text-2xs sm:text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                {modeLabel}
              </span>
            ) : null}
            <button
              type="button"
              onClick={onOpen}
              aria-haspopup="dialog"
              aria-expanded={isOpen}
              className={OUTLINE_BUTTON_CLASS}
            >
              <Sparkle className="w-4 h-4" aria-hidden="true" />
              <span>Open visual studio</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

VisualCompanionTrigger.propTypes = {
  modeLabel: PropTypes.string,
  message: PropTypes.string,
  isOpen: PropTypes.bool,
  onOpen: PropTypes.func.isRequired
};

function VisualCompanionModule({
  title,
  badge,
  description,
  fallback,
  children
}) {
  return (
    <div className="min-w-0 rounded-xl border border-secondary/30 bg-surface/70 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm sm:text-base font-semibold text-main">{title}</h3>
        {badge ? <span className="text-2xs sm:text-xs text-muted">{badge}</span> : null}
      </div>
      <p className="text-xs sm:text-sm text-muted mt-2">{description}</p>
      <Suspense
        fallback={(
          <div className="mt-4 rounded-xl border border-secondary/30 bg-surface/70 p-4 text-xs text-muted">
            {fallback}
          </div>
        )}
      >
        {children}
      </Suspense>
    </div>
  );
}

VisualCompanionModule.propTypes = {
  title: PropTypes.string,
  badge: PropTypes.string,
  description: PropTypes.string,
  fallback: PropTypes.string,
  children: PropTypes.node
};

export function NarrativeReadingSurface({
  surfaceModel = {},
  callbacks = {}
}) {
  const {
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
    storyArtCards = [],
    fullReadingText,
    narrativeText,
    personalReading,
    isGenerating,
    isHandset,
    shouldShowSpreadInsights,
    themes,
    highlightItems = [],
    traditionalPassages = []
  } = surfaceModel;
  const { onCinematicMediaReady, onStoryArtMediaReady } = callbacks;
  const shouldShowSafetyNotice = !personalReading && !isGenerating;
  const shouldSplitCompanionGrid = shouldShowCinematicReveal && shouldShowStoryIllustration;
  const narrativeForIllustration = fullReadingText || narrativeText;

  const [isCompanionOpen, setIsCompanionOpen] = useState(false);
  // The studio's children open dialogs of their own; track them so the studio
  // dialog can stand down while a nested one is on screen.
  const [nestedOverlays, setNestedOverlays] = useState({});
  const handleOpenCompanion = useCallback(() => setIsCompanionOpen(true), []);
  const handleCloseCompanion = useCallback(() => {
    setIsCompanionOpen(false);
    // Nested overlays live inside the studio, so closing it dismisses them too.
    // Clearing here stops a stale flag from reopening the studio with no focus
    // trap, no Escape and aria-modal="false".
    setNestedOverlays({});
  }, []);
  const setNestedOverlay = useCallback((key, open) => {
    setNestedOverlays((prev) => (
      Boolean(prev[key]) === Boolean(open) ? prev : { ...prev, [key]: Boolean(open) }
    ));
  }, []);
  const handleCinematicOverlayChange = useCallback((open) => {
    setNestedOverlay('cinematic', open);
  }, [setNestedOverlay]);
  const handleStoryOverlayChange = useCallback((open) => {
    setNestedOverlay('storyArt', open);
  }, [setNestedOverlay]);
  const hasNestedOverlay = useMemo(
    () => Object.values(nestedOverlays).some(Boolean),
    [nestedOverlays]
  );

  return (
    <>
      {shouldShowVisualCompanion ? (
        <>
          <VisualCompanionTrigger
            modeLabel={visualCompanionModeLabel}
            message={visualCompanionMessage}
            isOpen={isCompanionOpen}
            onOpen={handleOpenCompanion}
          />
          <VisualCompanionModal
            isOpen={isCompanionOpen}
            onClose={handleCloseCompanion}
            modeLabel={visualCompanionModeLabel}
            message={visualCompanionMessage}
            splitLayout={shouldSplitCompanionGrid}
            nestedOverlayOpen={hasNestedOverlay}
          >
            {shouldShowCinematicReveal ? (
              <VisualCompanionModule
                title="Cinematic Reveal"
                badge={cinematicPosition}
                description={cinematicRevealMessage}
                fallback="Loading cinematic module..."
              >
                <AnimatedReveal
                  key={`cinematic-${readingIdentity}`}
                  card={cinematicCard}
                  position={cinematicPosition}
                  question={resolvedQuestion}
                  userTier={effectiveTier}
                  autoGenerate={autoGenerateVisuals}
                  onVideoReady={onCinematicMediaReady}
                  onNestedOverlayChange={handleCinematicOverlayChange}
                  className="mt-4"
                />
              </VisualCompanionModule>
            ) : null}

            {shouldShowStoryIllustration ? (
              <VisualCompanionModule
                title="Narrative Illustration"
                badge={`${storyArtCards.length} cards`}
                description="Uses your full reading text and spread context."
                fallback="Loading illustration tools..."
              >
                <StoryIllustration
                  cards={storyArtCards}
                  question={resolvedQuestion}
                  narrative={narrativeForIllustration}
                  userTier={effectiveTier}
                  autoGenerate={autoGenerateVisuals}
                  generationKey={readingIdentity}
                  onMediaReady={onStoryArtMediaReady}
                  onNestedOverlayChange={handleStoryOverlayChange}
                  heroMode
                  embedded
                  className="mt-4"
                />
              </VisualCompanionModule>
            ) : null}
          </VisualCompanionModal>
        </>
      ) : null}

      {shouldShowSafetyNotice ? (
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
  surfaceModel: PropTypes.shape({
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
    storyArtCards: PropTypes.array,
    fullReadingText: PropTypes.string,
    narrativeText: PropTypes.string,
    personalReading: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
    isGenerating: PropTypes.bool,
    isHandset: PropTypes.bool,
    shouldShowSpreadInsights: PropTypes.bool,
    themes: PropTypes.object,
    highlightItems: PropTypes.array,
    traditionalPassages: PropTypes.array
  }),
  callbacks: PropTypes.shape({
    onCinematicMediaReady: PropTypes.func,
    onStoryArtMediaReady: PropTypes.func
  })
};
