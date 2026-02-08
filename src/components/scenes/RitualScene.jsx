import { DeckPile } from '../DeckPile';
import { DeckRitual } from '../DeckRitual';
import { RitualNudge } from '../nudges';

export function RitualScene({
  title = 'Ritual',
  showTitle = true,
  className = '',
  sceneData = {}
}) {
  const {
    reading,
    revealedCards,
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
    revealStage,
    dealNext
  } = sceneData;

  if (!reading || !revealedCards || revealedCards.size >= visibleCount) return null;

  return (
    <section
      className={`relative min-h-[320px] px-3 xs:px-4 sm:px-6 py-6 sm:py-8 ${className}`}
      data-scene="ritual"
    >
      <div className="relative z-[2] max-w-5xl mx-auto rounded-2xl border border-secondary/25 bg-black/45 backdrop-blur-sm p-4 sm:p-6">
        {showTitle ? <h2 className="text-xl sm:text-2xl font-serif text-accent text-center mb-4">{title}</h2> : null}

        {shouldShowRitualNudge && knockCount === 0 && !hasCut && (
          <div className="mb-4 max-w-md mx-auto">
            <RitualNudge
              onEnableRitual={markRitualNudgeSeen}
              onSkip={markRitualNudgeSeen}
            />
          </div>
        )}

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
            cardsRemaining={visibleCount - revealedCards.size}
            nextPosition={nextLabel}
            spreadPositions={spreadPositions || []}
            revealedCount={revealedCards.size}
            totalCards={visibleCount}
            onDeal={handleAnimatedDeal}
            cards={reading}
            revealedIndices={revealedCards}
            externalDeckRef={deckRef}
            revealStage={revealStage}
          />
        ) : (
          <DeckPile
            cardsRemaining={visibleCount - revealedCards.size}
            onDraw={dealNext}
            isShuffling={isShuffling}
            nextLabel={nextLabel}
          />
        )}
      </div>
    </section>
  );
}
