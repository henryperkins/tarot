import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Sparkle } from '@phosphor-icons/react';
import { NarrativeSafetyNotice } from './NarrativeSafetyNotice';
import { SpreadPatterns } from './SpreadPatterns';
import { VisualCompanionModal } from './reading/VisualCompanionModal';
import { OUTLINE_BUTTON_CLASS } from '../styles/buttonClasses';
import { READING_PANEL_COLUMN_CLASS } from '../styles/panelClasses';

const AnimatedReveal = lazy(() => import('./AnimatedReveal'));
const StoryIllustration = lazy(() => import('./StoryIllustration'));

function VisualCompanionTrigger({ isOpen, onOpen }) {
  return (
    <div className="space-y-1">
      <button type="button" onClick={onOpen} aria-haspopup="dialog" aria-expanded={isOpen} className={OUTLINE_BUTTON_CLASS}>
        <Sparkle className="w-4 h-4" aria-hidden="true" />
        <span>Create images or video</span>
      </button>
      <p className="text-sm text-muted">Make an illustration or a short video inspired by this reading.</p>
    </div>
  );
}

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
        {badge ? <span className="text-sm text-muted">{badge}</span> : null}
      </div>
      <p className="text-sm text-muted mt-2">{description}</p>
      <Suspense
        fallback={(
          <div className="mt-4 rounded-xl border border-secondary/30 bg-surface/70 p-4 text-sm text-muted">
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
    storyArtCards = [],
    fullReadingText,
    narrativeText,
    personalReading,
    isGenerating,
    isHandset,
    shouldShowSpreadInsights,
    themes,
    highlightItems = [],
    traditionalPassages = [],
    insightCards = []
  } = surfaceModel;
  const { onCinematicMediaReady, onStoryArtMediaReady, onSelectCard } = callbacks;
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
                  autoGenerate={false}
                  onVideoReady={onCinematicMediaReady}
                  onNestedOverlayChange={handleCinematicOverlayChange}
                  className="mt-4"
                />
              </VisualCompanionModule>
            ) : null}

            {shouldShowStoryIllustration ? (
              <VisualCompanionModule
                title="Narrative Illustration"
                badge={`${storyArtCards.length} ${storyArtCards.length === 1 ? 'card' : 'cards'}`}
                description="Uses your full reading text and spread context."
                fallback="Loading illustration tools..."
              >
                <StoryIllustration
                  cards={storyArtCards}
                  question={resolvedQuestion}
                  narrative={narrativeForIllustration}
                  userTier={effectiveTier}
                  autoGenerate={false}
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
        <div className={`${READING_PANEL_COLUMN_CLASS} bg-surface/95 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-secondary/40`}>
          <NarrativeSafetyNotice className="max-w-3xl mx-auto" compact={isHandset} />
        </div>
      ) : null}

      {shouldShowSpreadInsights ? (
        <div className={READING_PANEL_COLUMN_CLASS}>
          <SpreadPatterns
            key={readingIdentity}
            themes={themes}
            spreadHighlights={highlightItems}
            passages={traditionalPassages}
            cards={insightCards}
            onSelectCard={onSelectCard}
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
    traditionalPassages: PropTypes.array,
    insightCards: PropTypes.array
  }),
  callbacks: PropTypes.shape({
    onCinematicMediaReady: PropTypes.func,
    onStoryArtMediaReady: PropTypes.func,
    onSelectCard: PropTypes.func
  })
};
