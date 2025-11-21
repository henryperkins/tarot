import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { ArrowsOut } from '@phosphor-icons/react';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { MINOR_ARCANA } from '../data/minorArcana';
import { CardSymbolInsights } from './CardSymbolInsights';
import { InteractiveCardOverlay } from './InteractiveCardOverlay';

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

function getPrefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  setReflections,
  onCardClick,
  staggerDelay = 0
}) {
  const reflectionValue = reflections[index] || '';
  const revealedContentRef = useRef(null);

  // Local state to manage the visual reveal sequence
  const [isVisuallyRevealed, setIsVisuallyRevealed] = useState(isRevealed);
  const controls = useAnimation();
  const hasMounted = useRef(false);

  useEffect(() => {
    // Entry animation
    if (!hasMounted.current) {
      const prefersReducedMotion = getPrefersReducedMotion();
      controls.start({
        opacity: 1,
        y: 0,
        scale: 1,
        rotateY: 0,
        transition: prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 20 }
      });
      hasMounted.current = true;
    }
  }, [controls]);

  useEffect(() => {
    if (isRevealed && revealedContentRef.current) {
      revealedContentRef.current.focus();
    }
  }, [isRevealed]);

  // Handle the flip animation sequence
  useEffect(() => {
    if (isRevealed === isVisuallyRevealed) return;

    if (isRevealed && !isVisuallyRevealed) {
      // Start reveal sequence
      const sequence = async () => {
        console.log(`Card ${index} starting reveal sequence. Stagger: ${staggerDelay}`);

        const prefersReducedMotion = getPrefersReducedMotion();
        const duration = prefersReducedMotion ? 0 : 0.25;
        const springTransition = prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 20 };

        // Wait for stagger delay
        if (staggerDelay > 0 && !prefersReducedMotion) {
          await new Promise(resolve => setTimeout(resolve, staggerDelay * 1000));
        }

        console.log(`Card ${index} starting Phase 1 (rotate 90)`);
        // Phase 1: Rotate to 90deg (hide back)
        await controls.start({
          rotateY: 90,
          opacity: 0.8,
          transition: { duration: duration, ease: "easeIn" }
        });

        // Phase 2: Swap content
        console.log(`Card ${index} Phase 2 (swap content)`);
        setIsVisuallyRevealed(true);

        // Phase 3: Rotate back to 0deg (show front)
        console.log(`Card ${index} starting Phase 3 (rotate 0)`);
        await controls.start({
          rotateY: 0,
          opacity: 1,
          transition: springTransition
        });
        console.log(`Card ${index} reveal complete`);
      };

      sequence();
    } else {
      // Reset if needed (e.g. new game)
      setIsVisuallyRevealed(false);
      controls.set({ rotateY: 0, opacity: 1 });
    }
  }, [isRevealed, isVisuallyRevealed, staggerDelay, controls]);

  return (
    <div
      key={`${card.name}-${index}`}
      className="modern-surface border border-secondary/40 overflow-hidden"
    >
      {/* Position Label */}
      <div className="bg-surface/80 p-2 sm:p-3 border-b border-secondary/40">
        <h3 className="text-accent font-serif text-center font-semibold text-sm sm:text-base">{position}</h3>
      </div>

      {/* Card */}
      <div className="p-3 sm:p-4 md:p-6" style={{ perspective: '1000px' }}>
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9, rotateY: 0 }}
          animate={controls}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          onClick={() => {
            if (!isRevealed) onReveal(index);
            else if (onCardClick) onCardClick(card, position, index);
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              if (!isRevealed) onReveal(index);
              else if (onCardClick) onCardClick(card, position, index);
            }
          }}
          role="button"
          aria-label={
            isRevealed
              ? `${position}: ${card.name} ${card.isReversed ? 'reversed' : 'upright'}. Click to view details.`
              : `Reveal card for ${position}`
          }
          tabIndex={0}
          className={`cursor-pointer transition-all duration-500 transform ${!isVisuallyRevealed
            ? 'hover:bg-surface-muted/70 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-secondary/50 rounded-lg'
            : 'hover:bg-surface-muted/40 rounded-lg group'
            }`}
          style={{
            transformStyle: 'preserve-3d'
          }}
        >
          {!isVisuallyRevealed ? (
            <div className="text-center py-6 sm:py-10">
              <div className="tarot-card-shell mx-auto">
                <div className="tarot-card-back">
                  <div className="tarot-card-back-symbol">
                    <div className="tarot-card-back-glyph" />
                  </div>
                </div>
              </div>
              <div className="mt-3 text-xs-plus font-serif tracking-[0.18em] uppercase text-accent/75">
                Tap to cut the veil
              </div>
            </div>
          ) : (
            <div className="transition-all relative">
              {/* Zoom Icon Overlay */}
              <div className="absolute top-0 right-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="bg-surface-muted/80 p-1.5 rounded-full text-accent border border-primary/30 shadow-lg backdrop-blur-sm">
                  <ArrowsOut className="w-4 h-4" />
                </div>
              </div>

              {/* Rider-Waite Card Image with Interactive Overlay */}
              <motion.div
                layoutId={`card-image-${index}`}
                className={`mx-auto mb-3 max-w-[65%] sm:max-w-[280px] ${card.isReversed ? 'rotate-180' : ''}`}
              >
                <div className="relative">
                  <img
                    src={card.image}
                    alt={`${card.name}${card.isReversed ? ' (Reversed)' : ''}`}
                    className="w-full h-auto rounded-lg shadow-lg border-2 border-primary/30"
                    loading="lazy"
                    onError={(e) => {
                      console.error(`Failed to load image: ${card.image}`);
                      e.target.src = '/images/cards/placeholder.jpg';
                    }}
                  />
                  {/* Interactive symbol overlay - only for cards with coordinates */}
                  <InteractiveCardOverlay card={card} isReversed={card.isReversed} />
                </div>
              </motion.div>

              <div className="text-center mb-3">
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs-plus font-semibold tracking-wide ${card.isReversed
                    ? 'bg-surface-muted/90 text-accent border border-accent/50'
                    : 'bg-secondary/10 text-secondary border border-secondary/60'
                    }`}
                >
                  {card.isReversed ? 'Reversed current' : 'Upright current'}
                </span>
              </div>

              <div className="mb-4 flex justify-center">
                <CardSymbolInsights card={card} position={position} />
              </div>

              <div
                className="bg-surface/85 rounded p-4 border border-secondary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/70"
                ref={revealedContentRef}
                tabIndex={-1}
              >
                <p className="text-main text-sm sm:text-base leading-relaxed">
                  {(() => {
                    const allCards = [...MAJOR_ARCANA, ...MINOR_ARCANA];
                    const originalCard =
                      allCards.find(item => item.name === card.name) || card;
                    return card.isReversed ? originalCard.reversed : originalCard.upright;
                  })()}
                </p>
              </div>
              <div className="mt-3">
                <label className="text-muted text-xs-plus sm:text-sm block mb-1">What resonates for you?</label>
                <textarea
                  value={reflectionValue}
                  onChange={event =>
                    setReflections(prev => ({ ...prev, [index]: event.target.value }))
                  }
                  onClick={event => event.stopPropagation()}
                  onPointerDown={event => event.stopPropagation()}
                  onFocus={event => event.stopPropagation()}
                  onKeyDown={event => event.stopPropagation()}
                  rows={3}
                  maxLength={500}
                  className="w-full bg-surface/85 border border-secondary/40 rounded p-2 min-h-[4.5rem] resize-y text-main text-sm sm:text-base focus:outline-none focus:ring-1 focus:ring-secondary/55"
                  placeholder="What resonates? (optional)"
                />
                {reflectionValue.length > 0 && (
                  <div className="mt-1 text-xs text-accent/70 text-right">
                    {reflectionValue.length} / 500
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
