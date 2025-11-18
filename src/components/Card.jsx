import React, { useEffect, useRef } from 'react';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { MINOR_ARCANA } from '../data/minorArcana';
import { CardSymbolInsights } from './CardSymbolInsights';

function isMinor(card) {
  return !!card.suit && !!card.rank;
}

function getMinorSuitGlyph(card) {
  if (!isMinor(card)) return null;
  switch (card.suit) {
    case 'Wands':
      return '⚚';
    case 'Cups':
      return '♥';
    case 'Swords':
      return '♠';
    case 'Pentacles':
      return '★';
    default:
      return '✶';
  }
}

function getMinorAccentClass(card) {
  if (!isMinor(card)) return '';
  switch (card.suit) {
    case 'Wands':
      return 'minor-wands';
    case 'Cups':
      return 'minor-cups';
    case 'Swords':
      return 'minor-swords';
    case 'Pentacles':
      return 'minor-pentacles';
    default:
      return '';
  }
}

function getMinorPipCount(card) {
  if (!isMinor(card)) return 0;
  // Use rankValue from MINOR_ARCANA when available; fallback to simple mapping.
  const meta =
    MINOR_ARCANA.find(c => c.name === card.name) ||
    MINOR_ARCANA.find(c => c.suit === card.suit && c.rank === card.rank);
  if (meta && typeof meta.rankValue === 'number') {
    return Math.min(Math.max(meta.rankValue, 1), 10);
  }
  const rank = card.rank;
  const map = {
    Ace: 1,
    Two: 2,
    Three: 3,
    Four: 4,
    Five: 5,
    Six: 6,
    Seven: 7,
    Eight: 8,
    Nine: 9,
    Ten: 10
  };
  return map[rank] || 0;
}

// Roman numeral helper to evoke authentic majors labeling
function romanize(num) {
  if (num === 0) return '0';
  const map = [
    { v: 1000, s: 'M' },
    { v: 900, s: 'CM' },
    { v: 500, s: 'D' },
    { v: 400, s: 'CD' },
    { v: 100, s: 'C' },
    { v: 90, s: 'XC' },
    { v: 50, s: 'L' },
    { v: 40, s: 'XL' },
    { v: 10, s: 'X' },
    { v: 9, s: 'IX' },
    { v: 5, s: 'V' },
    { v: 4, s: 'IV' },
    { v: 1, s: 'I' }
  ];
  let res = '';
  let n = num;
  for (const { v, s } of map) {
    while (n >= v) {
      res += s;
      n -= v;
    }
  }
  return res || String(num);
}

export function Card({
  card,
  index,
  isRevealed,
  onReveal,
  position,
  reflections,
  setReflections
}) {
  const reflectionValue = reflections[index] || '';
  const revealedContentRef = useRef(null);

  useEffect(() => {
    if (isRevealed && revealedContentRef.current) {
      revealedContentRef.current.focus();
    }
  }, [isRevealed]);

  return (
    <div
      key={`${card.name}-${index}`}
      className="modern-surface border border-emerald-400/40 overflow-hidden animate-fade-in"
    >
      {/* Position Label */}
      <div className="bg-slate-950/80 p-2 sm:p-3 border-b border-emerald-400/40">
        <h3 className="text-amber-300 font-serif text-center font-semibold text-sm sm:text-base">{position}</h3>
      </div>

      {/* Card */}
      <div className="p-3 sm:p-4 md:p-6" style={{ perspective: '1000px' }}>
        <div
          onClick={() => !isRevealed && onReveal(index)}
          onKeyDown={event => {
            if (!isRevealed && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              onReveal(index);
            }
          }}
          role="button"
          aria-label={
            isRevealed
              ? `${position}: ${card.name} ${card.isReversed ? 'reversed' : 'upright'}`
              : `Reveal card for ${position}`
          }
          tabIndex={0}
          className={`cursor-pointer transition-all duration-500 transform ${!isRevealed
            ? 'hover:bg-slate-900/70 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 rounded-lg'
            : ''
            }`}
          style={{
            transformStyle: 'preserve-3d',
            animation: isRevealed ? 'flipCard 0.6s ease-out' : 'none'
          }}
        >
          {!isRevealed ? (
            <div className="text-center py-6 sm:py-10">
              <div className="tarot-card-shell mx-auto">
                <div className="tarot-card-back">
                  <div className="tarot-card-back-symbol">
                    <div className="tarot-card-back-glyph" />
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs-plus font-serif tracking-[0.18em] uppercase text-amber-200/75">
                Tap to cut the veil
              </div>
            </div>
          ) : (
            <div className="transition-all">
              {/* Rider-Waite Card Image */}
              <div className={`mx-auto mb-3 max-w-[65%] sm:max-w-[280px] ${card.isReversed ? 'rotate-180' : ''}`}>
                <img
                  src={card.image}
                  alt={`${card.name}${card.isReversed ? ' (Reversed)' : ''}`}
                  className="w-full h-auto rounded-lg shadow-lg border-2 border-amber-400/30"
                  loading="lazy"
                  onError={(e) => {
                    console.error(`Failed to load image: ${card.image}`);
                    e.target.src = '/images/cards/placeholder.jpg';
                  }}
                />
              </div>

              <div className="text-center mb-3">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs-plus font-semibold tracking-wide ${card.isReversed
                    ? 'bg-slate-900/90 text-cyan-300 border border-cyan-400/50'
                    : 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/60'
                    }`}
                >
                  {card.isReversed ? 'Reversed current' : 'Upright current'}
                </span>
              </div>

              <div className="mb-4 flex justify-center">
                <CardSymbolInsights card={card} position={position} />
              </div>

              <div
                className="bg-slate-950/85 rounded p-4 border border-emerald-400/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                ref={revealedContentRef}
                tabIndex={-1}
              >
                <p className="text-amber-100/90 text-sm sm:text-base leading-relaxed">
                  {(() => {
                    const allCards = [...MAJOR_ARCANA, ...MINOR_ARCANA];
                    const originalCard =
                      allCards.find(item => item.name === card.name) || card;
                    return card.isReversed ? originalCard.reversed : originalCard.upright;
                  })()}
                </p>
              </div>
              <div className="mt-3">
                <label className="text-amber-100/85 text-xs-plus sm:text-sm block mb-1">What resonates for you?</label>
                <textarea
                  value={reflectionValue}
                  onChange={event =>
                    setReflections(prev => ({ ...prev, [index]: event.target.value }))
                  }
                  rows={3}
                  maxLength={500}
                  className="w-full bg-slate-950/85 border border-emerald-400/40 rounded p-2 min-h-[4.5rem] resize-y text-amber-100/90 text-sm sm:text-base focus:outline-none focus:ring-1 focus:ring-emerald-400/55"
                  placeholder="What resonates? (optional)"
                />
                {reflectionValue.length > 0 && (
                  <div className="mt-1 text-xs text-amber-300/70 text-right">
                    {reflectionValue.length} / 500
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
