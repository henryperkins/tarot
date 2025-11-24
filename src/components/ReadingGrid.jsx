import { useEffect, useRef, useState } from 'react';
import { getSpreadInfo } from '../data/spreads';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { MINOR_ARCANA } from '../data/minorArcana';
import { Card } from './Card';
import { Tooltip } from './Tooltip';

const CARD_LOOKUP = [...MAJOR_ARCANA, ...MINOR_ARCANA].reduce((acc, card) => {
  acc[card.name] = card;
  return acc;
}, {});

function toAreaClass(position) {
  // Normalize full Celtic Cross labels (e.g. "Present — core situation (Card 1)")
  const key = position.split('—')[0].trim(); // take text before the em dash
  const map = {
    'Present': 'present',
    'Challenge': 'challenge',
    'Past': 'past',
    'Near Future': 'future',
    'Future': 'future',
    'Conscious': 'above',
    'Subconscious': 'below',
    'Self / Advice': 'advice',
    'External Influences': 'external',
    'Hopes & Fears': 'hopesfears',
    'Outcome': 'outcome'
  };
  return `cc-${map[key] || 'present'}`;
}

function getOrientationMeaning(card) {
  const meta = CARD_LOOKUP[card.name] || card;
  const uprightMeaning = meta.upright || card.upright || '';
  const reversedMeaning = meta.reversed || card.reversed || '';
  return card.isReversed ? reversedMeaning || uprightMeaning : uprightMeaning || reversedMeaning;
}

export function ReadingGrid({
  selectedSpread,
  reading,
  revealedCards,
  revealCard,
  reflections,
  setReflections,
  onCardClick
}) {
  if (!reading) return null;

  const spreadInfo = getSpreadInfo(selectedSpread);
  const isBatchReveal = reading.length > 1 && revealedCards.size === reading.length;
  const carouselRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el || reading.length <= 1) return undefined;

    const handleScroll = () => {
      const approxIndex = Math.round(el.scrollLeft / el.clientWidth);
      const clamped = Math.min(reading.length - 1, Math.max(0, approxIndex));
      setActiveIndex(clamped);
    };

    handleScroll();
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [reading.length]);

  const scrollToIndex = (index) => {
    const el = carouselRef.current;
    if (!el) return;
    const clamped = Math.min(reading.length - 1, Math.max(0, index));
    setActiveIndex(clamped);
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <>
      {reading.length > 1 && (
        <p className="sm:hidden text-center text-xs text-primary/70 mb-2 animate-pulse">
          Swipe to explore cards &rarr;
        </p>
      )}
      <div
        className={
          selectedSpread === 'celtic'
            ? 'cc-grid animate-fade-in'
            : `animate-fade-in ${reading.length === 1
              ? 'grid grid-cols-1 max-w-md mx-auto'
              : 'flex overflow-x-auto snap-x snap-mandatory gap-4 pb-6 sm:grid sm:gap-8 sm:overflow-visible sm:snap-none sm:pb-0 ' + (reading.length <= 4
                ? 'sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4'
                : 'sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3')
            }`
        }
        ref={reading.length > 1 ? carouselRef : null}
      >
        {reading.map((card, index) => {
          const position = spreadInfo?.positions?.[index] || `Position ${index + 1}`;
          const isRevealed = revealedCards.has(index);

          const tooltipContent = isRevealed ? (
            <div className="space-y-1 text-left leading-snug">
              <strong className="block text-accent text-sm">
                {card.name}
                {card.isReversed ? ' (Reversed)' : ''}
              </strong>
              <em className="block text-xs text-muted">{position}</em>
              <p className="text-xs-plus text-main/90">{getOrientationMeaning(card)}</p>
            </div>
          ) : null;

          const cardElement = (
            <Card
              card={card}
              index={index}
              isRevealed={isRevealed}
              onReveal={revealCard}
              position={position}
              reflections={reflections}
              setReflections={setReflections}
              onCardClick={onCardClick}
              staggerDelay={isBatchReveal ? index * 0.15 : 0}
            />
          );

          return (
            <div
              key={`${card.name}-${index}`}
              className={`${selectedSpread === 'celtic'
                ? toAreaClass(position)
                : reading.length > 1 ? 'min-w-[75vw] snap-center sm:min-w-0' : ''
                }`}
            >
              <Tooltip
                content={isRevealed ? tooltipContent : null}
                position="top"
                asChild
                enableClick={false}
                triggerClassName="block h-full"
              >
                {cardElement}
              </Tooltip>
            </div>
          );
        })}
      </div>
      {reading.length > 1 && (
        <div className="sm:hidden mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => scrollToIndex(activeIndex - 1)}
            disabled={activeIndex === 0}
            className="inline-flex items-center justify-center rounded-full border border-secondary/50 bg-surface px-3 py-2 min-w-[48px] min-h-[44px] text-xs font-semibold text-muted disabled:opacity-40"
            aria-label="Show previous card"
          >
            Prev
          </button>
          <p className="text-xs text-muted" aria-live="polite">
            Card {activeIndex + 1} of {reading.length}
          </p>
          <button
            type="button"
            onClick={() => scrollToIndex(activeIndex + 1)}
            disabled={activeIndex >= reading.length - 1}
            className="inline-flex items-center justify-center rounded-full border border-secondary/50 bg-surface px-3 py-2 min-w-[48px] min-h-[44px] text-xs font-semibold text-muted disabled:opacity-40"
            aria-label="Show next card"
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
