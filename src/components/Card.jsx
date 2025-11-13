import React from 'react';
import { Star, Moon } from 'lucide-react';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { MINOR_ARCANA } from '../data/minorArcana';

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
  return (
    <div
      key={`${card.name}-${index}`}
      className="modern-surface border border-emerald-400/22 overflow-hidden"
    >
      {/* Position Label */}
      <div className="bg-slate-950/80 p-2 sm:p-3 border-b border-emerald-400/18">
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
          className={`cursor-pointer transition-all duration-500 transform ${
            !isRevealed
              ? 'hover:bg-slate-900/70 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 rounded-lg'
              : ''
          }`}
          style={{
            transformStyle: 'preserve-3d',
            animation: isRevealed ? 'flipCard 0.6s ease-out' : 'none'
          }}
        >
          {!isRevealed ? (
            <div className="text-center py-10">
              <div className="tarot-card-shell mx-auto">
                <div className="tarot-card-back">
                  <div className="tarot-card-back-symbol">
                    <div className="tarot-card-back-glyph" />
                  </div>
                </div>
              </div>
              <div className="mt-3 text-[10px] font-serif tracking-[0.18em] uppercase text-amber-200/75">
                Tap to cut the veil
              </div>
            </div>
          ) : (
            <div className="transition-all">
              <div className={card.isReversed ? 'rotate-180' : ''}>
                <div className="tarot-card-shell mx-auto mb-3">
                  <div
                    className={`tarot-card-face ${
                      card.isReversed ? 'reversed' : 'upright'
                    } ${getMinorAccentClass(card)}`}
                  >
                    {/* Header: Majors use roman numerals; Minors use rank + suit glyph */}
                    <div className="tarot-card-face-header">
                      {isMinor(card) ? (
                        <span className="flex items-center justify-center gap-1">
                          <span>{card.rank}</span>
                          <span className="text-[11px] opacity-80">
                            {getMinorSuitGlyph(card)}
                          </span>
                        </span>
                      ) : (
                        <span>
                          {typeof card.number === 'number'
                            ? romanize(card.number)
                            : card.number}
                        </span>
                      )}
                    </div>

                    {/* Symbolic center: Majors keep existing sigil; Minors show suit-based pips */}
                    <div className="tarot-card-face-symbol">
                      {isMinor(card) ? (
                        <div className="grid grid-cols-5 grid-rows-2 gap-[2px] items-center justify-items-center w-full h-full px-2">
                          {Array.from({ length: getMinorPipCount(card) }).map((_, i) => (
                            <div
                              key={i}
                              className="w-1.5 h-1.5 rounded-full bg-amber-300/80 minor-pip"
                            />
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="tarot-card-face-symbol-row">
                            <div className="tarot-card-face-symbol-pill" />
                            <div className="tarot-card-face-symbol-star" />
                          </div>
                          <div className="tarot-card-face-symbol-row">
                            <div className="tarot-card-face-symbol-pill" />
                            <div className="tarot-card-face-symbol-pill" />
                          </div>
                          <div className="tarot-card-face-symbol-row">
                            <div className="tarot-card-face-symbol-star" />
                            <div className="tarot-card-face-symbol-pill" />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Name: for Minors this already encodes rank + suit */}
                    <div className="tarot-card-face-name">
                      {card.name}
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center mb-3">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-[10px] font-semibold tracking-wide ${
                    card.isReversed
                      ? 'bg-slate-900/90 text-cyan-300 border border-cyan-400/50'
                      : 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/60'
                  }`}
                >
                  {card.isReversed ? 'Reversed current' : 'Upright current'}
                </span>
              </div>

              <div className="bg-slate-950/85 rounded p-4 border border-emerald-400/16">
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
                <label className="text-amber-100/70 text-xs sm:text-xs-plus block mb-1">What resonates for you?</label>
                <textarea
                  value={reflections[index] || ''}
                  onChange={event =>
                    setReflections(prev => ({ ...prev, [index]: event.target.value }))
                  }
                  rows={2}
                  className="w-full bg-slate-950/85 border border-emerald-400/22 rounded p-2 text-amber-100/90 text-sm sm:text-base focus:outline-none focus:ring-1 focus:ring-emerald-400/55"
                  placeholder="Write a sentence or two..."
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}