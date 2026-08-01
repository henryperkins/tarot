import { useMemo, useState } from 'react';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { ReadingBoard } from './ReadingBoard';
import { SpreadTable, SpreadTableCompact } from './SpreadTable';

const SUPPORTED_SPREADS = new Set(['single', 'threeCard', 'fiveCard', 'decision', 'relationship', 'celtic']);

export function SpreadLayoutFixture() {
  const [mentionPulse, setMentionPulse] = useState(null);
  const [reflections, setReflections] = useState({});
  const spreadKey = new URLSearchParams(window.location.search).get('spread');
  const showReversedCard = new URLSearchParams(window.location.search).get('reversed') === '1';
  const showPrimaryCompact = new URLSearchParams(window.location.search).get('compact') === '1';
  const safeSpreadKey = SUPPORTED_SPREADS.has(spreadKey) ? spreadKey : 'single';
  const cardCount = safeSpreadKey === 'single' ? 1 : safeSpreadKey === 'celtic' ? 10 : 5;
  const reading = useMemo(() => (
    MAJOR_ARCANA.slice(0, cardCount).map((card, index) => ({
      ...card,
      isReversed: showReversedCard && index === 0
    }))
  ), [cardCount, showReversedCard]);
  const stageReveal = new URLSearchParams(window.location.search).get('staged') === '1';
  const allRevealed = useMemo(() => new Set(reading.map((_, index) => index)), [reading]);
  const [stagedRevealed, setStagedRevealed] = useState(() => new Set());
  const revealedCards = stageReveal ? stagedRevealed : allRevealed;
  const isHandset = window.innerWidth < 640;

  return (
    <main data-testid="spread-layout-fixture" className="min-h-screen px-3 py-4">
      <button
        type="button"
        onClick={() => setMentionPulse({ id: Date.now(), index: 0 })}
        className="mb-3 rounded-full border border-secondary/40 px-3 py-2 text-sm text-muted"
      >
        Trigger mention pulse
      </button>
      {stageReveal && (
        <button
          type="button"
          onClick={() => setStagedRevealed(allRevealed)}
          className="mb-3 ml-2 rounded-full border border-secondary/40 px-3 py-2 text-sm text-muted"
        >
          Reveal all
        </button>
      )}
      {showPrimaryCompact ? (
        <SpreadTable
          spreadKey={safeSpreadKey}
          cards={reading}
          revealedIndices={revealedCards}
          onCardClick={() => {}}
          onCardReveal={() => {}}
          compact
          cardsOnly
        />
      ) : (
        <ReadingBoard
          spreadKey={safeSpreadKey}
          reading={reading}
          revealedCards={revealedCards}
          revealCard={() => {}}
          onCardClick={() => {}}
          focusedCardData={null}
          onCloseDetail={() => {}}
          reflections={reflections}
          setReflections={setReflections}
          onOpenModal={() => {}}
          onNavigateCard={() => {}}
          canNavigatePrev={false}
          canNavigateNext={false}
          navigationLabel=""
          revealStage="action"
          narrativeMentionPulse={mentionPulse}
          isHandset={isHandset}
          cardsOnly
        />
      )}
      {/* Mirrors the reveal scene's Reset control so layout regressions that
          spill cards onto it are caught here. */}
      <div className="text-center mt-3 sm:mt-4">
        <button
          type="button"
          className="inline-flex items-center justify-center min-h-touch px-4 py-2 rounded-full border border-accent/50 text-muted text-xs sm:text-sm"
        >
          Reset reveals
        </button>
      </div>
      <SpreadTableCompact
        spreadKey={safeSpreadKey}
        cards={reading}
        revealedIndices={revealedCards}
      />
    </main>
  );
}

export default SpreadLayoutFixture;
