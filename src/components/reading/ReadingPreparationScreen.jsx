import { useEffect, useState } from 'react';
import { ReadingCardFigure, ReadingSpread } from './narrative/ReadingSpread';
import '../../styles/reading-screen.css';

export function ReadingPreparationScreen({ cards = [], spreadName = '', question = '', onSelectCard, onCancel }) {
  const shortSpreadName = spreadName.replace(/\s*\([^)]*\)\s*$/, '');
  const [hasViewedSpread, setHasViewedSpread] = useState(false);
  const [extendedWait, setExtendedWait] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setExtendedWait(true), 12000);
    return () => clearTimeout(timer);
  }, []);

  const drawnMessage = cards.length === 1 ? 'Your card is drawn.'
    : cards.length ? `Your ${cards.length} cards are drawn.` : 'Your interpretation is being prepared.';

  return <div className="reading-screen reading-screen--preparing">
    <header className="reading-preparation__header">
      <h2 className="reading-screen__title" tabIndex={-1} data-reading-focus-target>Preparing your reading</h2>
      {shortSpreadName && <p className="reading-screen__subtitle">{shortSpreadName}</p>}
    </header>

    <div className="reading-preparation__waiting">
      <div className="reading-preparation__status" role="status" aria-live="polite" aria-atomic="true">
        <span className="reading-preparation__spinner" aria-hidden="true" />
        <div>
          <p>{extendedWait ? 'Your reading is still being prepared.' : drawnMessage}</p>
          <p className="reading-preparation__guidance">{extendedWait
            ? 'You can explore your cards while you wait.'
            : 'Your interpretation will appear here when it is ready.'}</p>
        </div>
      </div>
      {onCancel && <>
        <button type="button" className="reading-screen__secondary reading-preparation__cancel" onClick={onCancel}>Cancel generation</button>
        <p className="reading-preparation__cancel-hint">{question
          ? 'Your cards and question stay here if you cancel.'
          : 'Your cards stay here if you cancel.'}</p>
      </>}
    </div>

    {question && <div className="reading-question"><span>Your question</span><p dir="auto">{question}</p></div>}

    {cards.length > 0 && <section className="reading-preparation__cards" aria-label="Your drawn cards">
      <h3>{cards.length === 1 ? 'Your drawn card' : 'Your drawn cards'}</h3>
      <div className={`reading-preparation__draw${cards.length > 3 ? ' reading-preparation__draw--many' : ''}`} tabIndex={cards.length > 3 ? 0 : undefined}
        role={cards.length > 3 ? 'region' : undefined} aria-label={cards.length > 3 ? 'Scroll through your drawn cards' : undefined}>
        {cards.map(card => <ReadingCardFigure key={card.index} card={card} onSelectCard={onSelectCard} compact imageSizes="64px" />)}
      </div>
      <p className="reading-preparation__card-hint">{cards.length > 3
        ? 'Scroll to see every card. Select a card to explore it.'
        : 'Select a card to explore it while your reading is prepared.'}</p>
      <details className="reading-preparation__spread" onToggle={event => {
        if (event.currentTarget.open) setHasViewedSpread(true);
      }}>
        <summary>View full spread</summary>
        {hasViewedSpread && <ReadingSpread cards={cards} spreadName={spreadName} onSelectCard={onSelectCard} showSummary />}
      </details>
    </section>}

    <details className="reading-preparation__outline">
      <summary>What your reading may cover</summary>
      <ul>
        <li>{cards.length === 1 ? 'Your card in context' : 'Your cards in context'}</li>
        {cards.length > 1 && <li>Connections across your spread</li>}
        <li>A reflection to carry with you</li>
      </ul>
    </details>
  </div>;
}
