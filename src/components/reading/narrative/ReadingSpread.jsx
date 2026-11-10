import { useState } from 'react';
import { getCardThumbnailSrcSet } from '../../../lib/cardLookup';

export function ReadingCardFigure({ card, onSelectCard, compact = false, numbered = false, imageSizes, children }) {
  const inspect = event => {
    onSelectCard?.(card.index, { triggerElement: event.currentTarget });
  };
  return <figure className={`reading-card${compact ? ' reading-card--compact' : ''}`} data-spread-index={card.index}>
    <button type="button" className="reading-card__art"
      aria-haspopup="dialog"
      aria-label={`${card.fullPositionLabel || card.positionLabel}: ${card.name}, ${card.isReversed ? 'reversed' : 'upright'}. Open card`}
      onClick={inspect} style={{ '--reading-card-ratio': (!compact && card.overviewFrame) || card.frame || '100 / 172' }}>
      <span className="reading-card__frame">
        <img src={(!compact && card.overviewImage) || card.image} alt={card.name} className={card.isReversed ? 'reading-card__image--reversed' : ''}
          srcSet={getCardThumbnailSrcSet((!compact && card.overviewImage) || card.image)}
          sizes={imageSizes || (compact ? '72px' : '(max-width: 640px) 30vw, 160px')}
          loading="eager" decoding="async" />
        {numbered && <span className="reading-card__number" aria-hidden="true">{card.index + 1}</span>}
      </span>
    </button>
    <figcaption>
      <span className="reading-card__position">{card.positionLabel}</span>
      {children || <span className="reading-card__name">{card.name}</span>}
      <span className="reading-card__orientation">{card.isReversed ? 'Reversed' : 'Upright'}</span>
    </figcaption>
  </figure>;
}

export function ReadingSpread({ cards = [], onSelectCard, spreadName, showSummary = false }) {
  const [list, setList] = useState(false);
  if (!cards.length) return null;
  const celtic = cards.length === 10;
  const smallImageSizes = cards.length === 1 ? '144px' : cards.length === 2
    ? '(max-width: 363px) calc((100vw - 44px) / 2), 160px'
    : '(max-width: 363px) calc((100vw - 44px) / 2), (max-width: 391px) 160px, (max-width: 535px) calc((100vw - 56px) / 3), 160px';
  // The final card can grow to the 160px cap when it wraps onto its own row.
  const finalSmallImageSizes = '(max-width: 391px) 160px, (max-width: 535px) calc((100vw - 56px) / 3), 160px';
  const imageSizes = celtic && !list ? '(max-width: 410px) 19vw, 75px'
    : list ? '64px' : cards.length > 3 ? '108px' : cards.length === 1 ? '144px'
      : smallImageSizes;
  const reversed = cards.filter(card => card.isReversed).length;
  const majors = cards.filter(card => card.number !== null && card.number !== undefined).length;

  return <section className="reading-spread" data-reading-overview aria-label={spreadName || 'Your drawn cards'}>
    {celtic && <div className="reading-view-switch" aria-label="Spread view">
      <button type="button" aria-pressed={!list} onClick={() => setList(false)}>Spread</button>
      <button type="button" aria-pressed={list} onClick={() => setList(true)}>Card list</button>
    </div>}
    <div className={`reading-spread__cards ${celtic && !list ? 'reading-spread__cards--celtic' : list ? 'reading-spread__cards--list' : cards.length > 3 ? 'reading-spread__cards--many' : 'reading-spread__cards--small'}`}
      data-card-count={cards.length}>
      {cards.map((card, index) => <ReadingCardFigure key={card.index} card={card} onSelectCard={onSelectCard}
        imageSizes={cards.length === 3 && index === 2 ? finalSmallImageSizes : imageSizes} numbered={celtic && !list} />)}
    </div>
    {celtic && !list && <p className="reading-spread__hint">Tap a card to explore its position</p>}
    {cards.length > 3 && !celtic && <p className="reading-spread__hint">Scroll to see every card. Tap a card to explore it.</p>}
    {showSummary && <p className="reading-spread__summary">{cards.length} cards · {reversed} reversed · {majors} Major Arcana</p>}
  </section>;
}

export function ReadingChapterCards({ cards, onSelectCard, children }) {
  return <div className="reading-chapter">
    {children}
    <div className="reading-chapter__cards">
      {cards.map(card => <ReadingCardFigure key={card.index} card={card} onSelectCard={onSelectCard} imageSizes="60px" compact />)}
    </div>
  </div>;
}
