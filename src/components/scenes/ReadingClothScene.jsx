import { Sparkle } from '@phosphor-icons/react';
import { DeckRitual } from '../DeckRitual';
import { ReadingBoard } from '../ReadingBoard';
import { RitualNudge } from '../nudges';
import { getDealtReading } from '../readingBoardUtils';
import { getSceneModel } from './sceneModelUtils';
import { useScene } from './SceneContext';

export function ReadingClothScene({ className = '', sceneModels = {} }) {
  const { activeScene } = useScene();
  const ritualModel = getSceneModel(sceneModels, 'ritualModel');
  const revealModel = getSceneModel(sceneModels, 'revealModel');
  const isDealing = activeScene === 'ritual';

  const {
    reading,
    revealedCards,
    dealIndex,
    visibleCount,
    newDeckInterface,
    shouldShowRitualNudge,
    knockCount,
    hasCut,
    markRitualNudgeSeen,
    handleKnock,
    cutIndex,
    setCutIndex,
    applyCut,
    knockCadenceResetAt,
    isShuffling,
    shuffle,
    nextLabel,
    spreadPositions,
    handleAnimatedDeal,
    deckRef,
    dealNext
  } = ritualModel;
  const {
    spreadName,
    isHandset,
    guidedTurnLabel,
    handleTurnNext,
    handleTurnAllWithScroll,
    handleResetReveals,
    safeSpreadKey,
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
    narrativeMentionPulse,
    personalReading,
    isGenerating,
    generatePersonalReading,
    hasVisionData,
    isVisionReady
  } = revealModel;

  if (!reading || !revealedCards) return null;

  const dealtCount = Math.min(visibleCount, Math.max(0, dealIndex || 0));
  const boardReading = isDealing ? getDealtReading(reading, dealtCount) : reading;
  const turnedCount = Math.min(revealedCards.size, visibleCount);
  const statusText = isDealing
    ? `${dealtCount} of ${visibleCount} cards dealt face-down`
    : `${turnedCount} of ${visibleCount} cards face-up`;

  return (
    <section
      className={`scene-stage scene-stage--${isDealing ? 'ritual' : 'reveal'} reading-cloth-stage relative px-3 xs:px-4 sm:px-6 py-6 sm:py-8 ${className}`}
      data-scene={activeScene}
      data-reading-phase={isDealing ? 'deal' : 'turn'}
    >
      <div className="scene-stage__panel reading-cloth relative z-[2] max-w-6xl mx-auto px-3 py-5 xs:px-4 sm:p-6 lg:p-8">
        {shouldShowRitualNudge && !newDeckInterface && knockCount === 0 && !hasCut && (
          <div className="mb-5 max-w-md mx-auto">
            <RitualNudge
              onEnableRitual={markRitualNudgeSeen}
              onSkip={markRitualNudgeSeen}
            />
          </div>
        )}

        <header className="reading-cloth__header text-center">
          <h2 className="text-[0.68rem] sm:text-xs font-semibold uppercase tracking-[0.16em] text-muted/75 text-balance">
            {spreadName || 'Your reading cloth'}
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-muted" aria-live="polite">
            {statusText}
          </p>
        </header>

        <div className="reading-cloth__deck" aria-label="Reading deck">
          {newDeckInterface ? (
            <DeckRitual
              knockCount={knockCount}
              onKnock={handleKnock}
              hasCut={hasCut}
              cutIndex={cutIndex}
              onCutChange={setCutIndex}
              onCutConfirm={applyCut}
              deckSize={78}
              knockCadenceResetAt={knockCadenceResetAt}
              isShuffling={isShuffling}
              onShuffle={shuffle}
              cardsRemaining={visibleCount - dealtCount}
              nextPosition={nextLabel}
              spreadPositions={spreadPositions || []}
              revealedCount={revealedCards.size}
              dealtCount={dealtCount}
              totalCards={visibleCount}
              onDeal={handleAnimatedDeal}
              cards={reading}
              revealedIndices={revealedCards}
              externalDeckRef={deckRef}
              revealStage={isDealing ? 'deck' : 'action'}
              phase={isDealing ? 'deal' : 'turn'}
              showDealAction={!isHandset}
              minimalUI
            />
          ) : (
            <DeckRitual
              cardsRemaining={visibleCount - dealtCount}
              totalCards={visibleCount}
              dealtCount={dealtCount}
              onDeal={dealNext}
              cards={reading}
              revealedIndices={revealedCards}
              externalDeckRef={deckRef}
              revealStage={isDealing ? 'deck' : 'action'}
              phase={isDealing ? 'deal' : 'turn'}
              showDealAction={!isHandset}
              minimalUI
            />
          )}
        </div>

        <div className="reading-cloth__board" aria-label="Tarot spread">
          <ReadingBoard
            spreadKey={safeSpreadKey}
            reading={boardReading}
            revealedCards={revealedCards}
            dealIndex={dealtCount}
            isDealing={isDealing}
            onSlotDeal={isDealing ? handleAnimatedDeal : undefined}
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
            revealStage={isDealing ? 'deck' : 'spread'}
            narrativeMentionPulse={narrativeMentionPulse}
            isHandset={isHandset}
            cardsOnly
            showPositionLabels
          />
        </div>

        {!isDealing && turnedCount < visibleCount && (
          <div className={`${isHandset ? 'hidden' : 'hidden sm:flex'} reading-cloth__actions items-center justify-center gap-3 flex-wrap`}>
            <button
              type="button"
              onClick={handleTurnNext}
              className="min-h-cta px-5 py-3 rounded-xl bg-accent text-surface font-semibold shadow-lg hover:bg-accent/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-main"
            >
              {guidedTurnLabel}
            </button>
            {visibleCount > 1 && (
              <button
                type="button"
                onClick={handleTurnAllWithScroll}
                aria-label="Turn all cards face-up"
                className="min-h-touch px-5 py-2.5 rounded-full border border-secondary/40 text-sm text-muted hover:text-main hover:border-secondary/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
              >
                Turn all
              </button>
            )}
          </div>
        )}

        {!isDealing && turnedCount > 0 && (
          <div className="text-center reading-cloth__reset">
            <button
              type="button"
              onClick={handleResetReveals}
              className="inline-flex items-center justify-center min-h-touch px-4 py-2 rounded-full border border-accent/45 text-muted text-sm hover:text-main hover:border-accent/70 transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
            >
              Turn these cards face-down
            </button>
          </div>
        )}

        {!personalReading && !isGenerating && turnedCount === visibleCount && (
          <div className="text-center space-y-3 reading-cloth__narrative">
            {isHandset ? (
              <p className="text-sm text-muted">Use the action bar below to create your narrative.</p>
            ) : (
              <button
                type="button"
                onClick={generatePersonalReading}
                className="bg-accent hover:bg-accent/90 text-surface font-semibold min-h-cta px-6 sm:px-8 py-3 rounded-xl shadow-xl transition-colors inline-flex items-center gap-2.5 mx-auto text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-main"
              >
                <Sparkle className="w-5 h-5" aria-hidden="true" />
                <span>Create personal narrative</span>
              </button>
            )}
            {hasVisionData && !isVisionReady && (
              <p className="mt-3 text-sm text-muted">Vision data has conflicts; research telemetry may be incomplete.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
