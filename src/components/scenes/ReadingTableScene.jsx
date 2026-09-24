import { useLayoutEffect, useRef } from 'react';
import { CaretLeft, CaretRight, HandTap, Sparkle } from '@phosphor-icons/react';
import { CardBack } from '../CardBack';
import { SpreadTable } from '../SpreadTable';
import { getReadingTableAction, extractShortLabel } from '../readingBoardUtils';
import { getCardImage, getOrientationMeaning } from '../../lib/cardLookup';
import { getSceneModel } from './sceneModelUtils';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import '../../styles/reading-table.css';

export function ReadingTableScene({ sceneModels = {} }) {
  const deckRef = useRef(null);
  const interpretationRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const model = getSceneModel(sceneModels, 'revealModel');
  const ritual = getSceneModel(sceneModels, 'ritualModel');
  const {
    reading, visibleCount, spreadName, safeSpreadKey, spreadPositions,
    revealedCards, isSpreadDealt, dealSpread, dealNext, isHandset, isLandscape,
    handleRevealAllWithScroll, handleResetReveals, revealCard, handleCardClick,
    activeFocusedCardData, reflections, setReflections, handleOpenModalFromPanel,
    handleNavigateCard, navigationData, generatePersonalReading, userQuestion
  } = model;
  const action = getReadingTableAction({ isSpreadDealt, revealedCards, totalCards: visibleCount, positions: spreadPositions });
  const onPrimary = action?.phase === 'deal' ? dealSpread : action?.phase === 'reveal' ? dealNext : generatePersonalReading;
  const selected = activeFocusedCardData;
  const card = selected?.card;
  const reflection = selected ? (reflections?.[selected.index] || '') : '';

  useLayoutEffect(() => {
    const node = interpretationRef.current;
    if (!card || typeof node?.animate !== 'function') return undefined;
    const animation = node.animate([{ opacity: 0.55 }, { opacity: 1 }], {
      duration: prefersReducedMotion ? 100 : 200,
      easing: 'ease-out'
    });
    return () => animation.cancel();
  }, [card, selected?.index, prefersReducedMotion]);

  if (!reading) return null;

  return (
    <section className="reading-table" data-scene={isSpreadDealt ? 'reveal' : 'ritual'} aria-labelledby="reading-table-title">
      <header className="reading-table__header">
        <div>
          <h2 id="reading-table-title">{spreadName?.split(' (')[0]}</h2>
          {userQuestion ? <p className="reading-table__question" dir="auto">{userQuestion}</p> : null}
        </div>
        {!isHandset && action ? (
          <button type="button" className="reading-table__primary" data-reading-primary data-reading-focus-target onKeyDown={event => {
            if (event.key === 'Enter' && event.repeat) event.preventDefault();
          }} onClick={event => {
            // A double click must not activate the next phase of the same button.
            if (event.detail <= 1) onPrimary?.();
          }}>
            {action.phase === 'narrative' ? <Sparkle size={20} aria-hidden="true" /> : null}
            {action.label}
          </button>
        ) : null}
      </header>

      <div className="reading-table__workspace">
        <div className="reading-table__spread">
          <div className="reading-table__deck-row">
            <div ref={deckRef} className="reading-table__deck" aria-hidden="true"><CardBack /></div>
            <p className="reading-table__status" role="status">
              {isSpreadDealt ? `${revealedCards.size} of ${visibleCount} cards revealed` : 'Your deck is ready. Deal when you feel ready.'}
            </p>
            {!isSpreadDealt ? (
              <details className="reading-table__ritual">
                <summary>Optional ritual</summary>
                <div className="reading-table__ritual-controls">
                  <button type="button" className="reading-table__secondary" onClick={ritual.handleKnock} disabled={ritual.knockCount >= 3}>
                    <HandTap size={20} aria-hidden="true" />Knock ({ritual.knockCount}/3)
                  </button>
                  <label htmlFor="table-cut">Cut the deck</label>
                  <input id="table-cut" type="range" min="1" max={ritual.deckSize - 1} value={ritual.cutIndex} onChange={event => ritual.setCutIndex(Number(event.target.value))} />
                  <button type="button" className="reading-table__secondary" onClick={ritual.applyCut}>
                    {ritual.hasCut ? 'Cut set' : 'Set cut'}
                  </button>
                </div>
              </details>
            ) : null}
          </div>
          <SpreadTable
            spreadKey={safeSpreadKey}
            cards={isSpreadDealt ? reading : []}
            revealedIndices={revealedCards}
            onCardClick={handleCardClick}
            onCardReveal={revealCard}
            nextDealIndex={action?.nextIndex ?? -1}
            disableReveal={!isSpreadDealt}
            selectedIndex={selected?.index ?? -1}
            readingTable
            dealOriginRef={deckRef}
            hideLegend
            showProgress={false}
            showTactileLens={false}
            cardsOnly
            size="large"
            isHandset={isHandset || isLandscape}
          />
          {safeSpreadKey === 'celtic' ? (
            <ol className="reading-table__positions" aria-label="Spread positions">
              {spreadPositions.slice(0, visibleCount).map((position, index) => <li key={position}><strong>{index + 1}</strong>{extractShortLabel(position, 80) || position}</li>)}
            </ol>
          ) : null}
          <div className="reading-table__secondary-actions">
            {isSpreadDealt && revealedCards.size < visibleCount ? (
              <button type="button" className="reading-table__quiet" onClick={handleRevealAllWithScroll} aria-label="Reveal all cards">Reveal remaining</button>
            ) : null}
            {revealedCards.size > 0 ? (
              <button type="button" className="reading-table__quiet" onClick={handleResetReveals}>Reset reveals</button>
            ) : null}
          </div>
        </div>

        <section className="reading-table__detail" aria-label="Selected card meaning">
          {card ? (
            <>
              <div ref={interpretationRef}>
                <div className="reading-table__card-heading">
                  <img className={`reading-table__card-image ${card.isReversed ? 'reading-table__card-image--reversed' : ''}`} src={getCardImage(card)} alt={card.name} />
                  <div>
                    <p className="reading-table__position">{extractShortLabel(selected.position, 80) || selected.position}</p>
                    <h3>{card.name}</h3>
                    <p className="reading-table__orientation">{card.isReversed ? 'Reversed' : 'Upright'}</p>
                  </div>
                </div>
                <p className="reading-table__meaning" dir="auto">{getOrientationMeaning(card)}</p>
              </div>
              <div className="reading-table__card-navigation" aria-label="Browse revealed cards">
                <button type="button" className="reading-table__secondary" disabled={!navigationData?.canPrev} onClick={() => handleNavigateCard('prev')} aria-label="Previous revealed card"><CaretLeft size={20} aria-hidden="true" /></button>
                <button type="button" className="reading-table__quiet" onClick={() => handleOpenModalFromPanel(selected)}>Open full card</button>
                <button type="button" className="reading-table__secondary" disabled={!navigationData?.canNext} onClick={() => handleNavigateCard('next')} aria-label="Next revealed card"><CaretRight size={20} aria-hidden="true" /></button>
              </div>
              <label className="reading-table__reflection-label" htmlFor={`table-reflection-${selected.index}`}>What resonates for you?</label>
              <textarea
                id={`table-reflection-${selected.index}`}
                className="reading-table__reflection"
                rows={3}
                maxLength={500}
                value={reflection}
                onChange={event => setReflections(previous => ({ ...previous, [selected.index]: event.target.value }))}
                placeholder="Your reflection (optional)"
                aria-describedby="table-reflection-count"
              />
              <p id="table-reflection-count" className="reading-table__reflection-count">{reflection.length} / 500</p>
            </>
          ) : (
            <div className="reading-table__empty">
              <h3>Your card’s meaning</h3>
              <p>{isSpreadDealt ? 'Reveal a card to explore its place in your spread.' : 'Deal your spread, then turn one card at a time. Its meaning will appear here.'}</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
