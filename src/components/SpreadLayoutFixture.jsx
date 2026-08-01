import { useMemo, useState } from 'react';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { ReadingBoard } from './ReadingBoard';

const SUPPORTED_SPREADS = new Set(['single', 'threeCard', 'fiveCard', 'decision', 'relationship', 'celtic']);

export function SpreadLayoutFixture() {
  const [mentionPulse, setMentionPulse] = useState(null);
  const [reflections, setReflections] = useState({});
  const spreadKey = new URLSearchParams(window.location.search).get('spread');
  const safeSpreadKey = SUPPORTED_SPREADS.has(spreadKey) ? spreadKey : 'single';
  const cardCount = safeSpreadKey === 'single' ? 1 : safeSpreadKey === 'celtic' ? 10 : 5;
  const reading = useMemo(() => (
    MAJOR_ARCANA.slice(0, cardCount).map((card) => ({ ...card, isReversed: false }))
  ), [cardCount]);
  const revealedCards = useMemo(() => new Set(reading.map((_, index) => index)), [reading]);
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
    </main>
  );
}

export default SpreadLayoutFixture;
