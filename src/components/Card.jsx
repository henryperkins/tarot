import React from 'react';
import { Star, Moon } from 'lucide-react';
import { MAJOR_ARCANA } from '../data/majorArcana';

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
      className="bg-indigo-900/40 backdrop-blur rounded-lg border border-amber-500/30 overflow-hidden"
    >
      {/* Position Label */}
      <div className="bg-indigo-950/60 p-3 border-b border-amber-500/20">
        <h3 className="text-amber-300 font-serif text-center font-semibold">{position}</h3>
      </div>

      {/* Card */}
      <div className="p-4 sm:p-6" style={{ perspective: '1000px' }}>
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
              ? 'hover:bg-indigo-800/30 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-500/50 rounded-lg'
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
                    }`}
                  >
                    <div className="tarot-card-face-header">
                      <span>
                        {typeof card.number === 'number' ? romanize(card.number) : card.number}
                      </span>
                    </div>
                    <div className="tarot-card-face-symbol">
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
                    </div>
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
                      ? 'bg-purple-500/15 text-purple-300 border border-purple-500/40'
                      : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {card.isReversed ? 'Reversed current' : 'Upright current'}
                </span>
              </div>

              <div className="bg-indigo-950/60 rounded p-4 border border-amber-500/10">
                <p className="text-amber-100/90 text-sm leading-relaxed">
                  {(() => {
                    const originalCard = MAJOR_ARCANA.find(item => item.name === card.name) || card;
                    return card.isReversed ? originalCard.reversed : originalCard.upright;
                  })()}
                </p>
              </div>
              <div className="mt-3">
                <label className="text-amber-100/70 text-xs block mb-1">What resonates for you?</label>
                <textarea
                  value={reflections[index] || ''}
                  onChange={event =>
                    setReflections(prev => ({ ...prev, [index]: event.target.value }))
                  }
                  rows={2}
                  className="w-full bg-indigo-950/60 border border-amber-500/20 rounded p-2 text-amber-100/90 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50"
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