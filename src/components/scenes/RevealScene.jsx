import { Sparkle } from '@phosphor-icons/react';
import { ReadingBoard } from '../ReadingBoard';

export function RevealScene({
  title = 'Reveal',
  showTitle = true,
  className = '',
  sceneData = {}
}) {
  const {
    spreadName,
    visibleCount,
    revealedCards,
    isLandscape,
    isHandset,
    guidedRevealLabel,
    handleAnimatedDeal,
    handleRevealAllWithScroll,
    handleResetReveals,
    safeSpreadKey,
    reading,
    revealCard,
    handleCardClick,
    activeFocusedCardData,
    handleCloseDetail,
    recentlyClosedIndex,
    reflections,
    setReflections,
    handleOpenModalFromPanel,
    handleNavigateCard,
    navigationData,
    revealStage,
    narrativeMentionPulse,
    personalReading,
    isGenerating,
    generatePersonalReading,
    hasVisionData,
    isVisionReady
  } = sceneData;

  if (!reading) return null;

  return (
    <section
      className={`scene-stage scene-stage--reveal relative px-3 xs:px-4 sm:px-6 py-5 sm:py-7 ${className}`}
      data-scene="reveal"
    >
      <div className="scene-stage__panel scene-stage__panel--reveal relative z-[2] max-w-5xl mx-auto p-4 sm:p-6">
        {showTitle ? <h2 className="text-xl sm:text-2xl font-serif text-accent text-center mb-3">{title}</h2> : null}

        <div className={`text-center text-accent font-serif mb-2 ${isLandscape ? 'text-lg' : 'text-2xl'}`}>
          {spreadName || 'Tarot Spread'}
        </div>
        {visibleCount > 1 && !isLandscape && (
          <p className="text-center text-muted text-xs-plus sm:text-sm mb-4">
            Reveal in order for narrative flow, then hover or long-press a card for quick meaning.
          </p>
        )}

        {revealedCards.size < visibleCount && (
          <div className={`${isHandset ? 'hidden' : 'hidden sm:block'} text-center space-y-2`}>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleAnimatedDeal}
                className="min-h-touch px-4 sm:px-5 py-2.5 sm:py-3 rounded-full border border-secondary/40 text-sm sm:text-base text-muted hover:text-main hover:border-secondary/60 transition"
              >
                {guidedRevealLabel}
              </button>
              <button
                type="button"
                onClick={handleRevealAllWithScroll}
                aria-label="Reveal all cards"
                className="min-h-touch px-4 sm:px-5 py-2.5 sm:py-3 rounded-full border border-secondary/40 text-sm sm:text-base text-muted hover:text-main hover:border-secondary/60 transition"
              >
                Reveal instantly
              </button>
            </div>
            <p className="text-accent/80 text-xs sm:text-sm">{revealedCards.size} of {visibleCount} cards revealed</p>
          </div>
        )}
        {revealedCards.size > 0 && (
          <div className="text-center mt-3 sm:mt-4">
            <button type="button" onClick={handleResetReveals} className="inline-flex items-center justify-center min-h-touch px-4 py-2 rounded-full border border-accent/50 text-muted text-xs sm:text-sm hover:text-main hover:border-accent/70 transition touch-manipulation">
              <span className="hidden xs:inline">Reset reveals (keep this spread)</span><span className="xs:hidden">Reset reveals</span>
            </button>
          </div>
        )}

        <ReadingBoard
          spreadKey={safeSpreadKey}
          reading={reading}
          revealedCards={revealedCards}
          revealCard={revealCard}
          onCardClick={handleCardClick}
          focusedCardData={activeFocusedCardData}
          onCloseDetail={handleCloseDetail}
          recentlyClosedIndex={recentlyClosedIndex}
          reflections={reflections}
          setReflections={setReflections}
          onOpenModal={handleOpenModalFromPanel}
          onNavigateCard={handleNavigateCard}
          canNavigatePrev={navigationData?.canPrev}
          canNavigateNext={navigationData?.canNext}
          navigationLabel={navigationData?.label}
          revealStage={revealStage}
          narrativeMentionPulse={narrativeMentionPulse}
          isHandset={isHandset}
        />

        {!personalReading && !isGenerating && revealedCards.size === visibleCount && (
          <div className="text-center space-y-3">
            {isHandset ? (
              <p className="text-xs text-muted">Use the action bar below to create your narrative.</p>
            ) : (
              <button onClick={generatePersonalReading} className="bg-accent hover:bg-accent/90 text-surface font-semibold px-5 sm:px-8 py-3 sm:py-4 rounded-xl shadow-xl shadow-accent/20 transition-all flex items-center gap-2 sm:gap-3 mx-auto text-sm sm:text-base md:text-lg">
                <Sparkle className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Create Personal Narrative</span>
              </button>
            )}
            {hasVisionData && !isVisionReady && (
              <p className="mt-3 text-sm text-muted">⚠️ Vision data has conflicts - research telemetry may be incomplete.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
