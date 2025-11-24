import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { ArrowsOut, HandPointing } from '@phosphor-icons/react';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { MINOR_ARCANA } from '../data/minorArcana';
import { CardSymbolInsights } from './CardSymbolInsights';
import { InteractiveCardOverlay } from './InteractiveCardOverlay';
import { TableuLogo } from './TableuLogo';

const FALLBACK_IMAGE = '/images/cards/RWS1909_-_00_Fool.jpeg';
const CARD_LOOKUP = [...MAJOR_ARCANA, ...MINOR_ARCANA].reduce((acc, entry) => {
  acc[entry.name] = entry;
  return acc;
}, {});

function getPrefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getCardImage(card) {
  if (!card) return FALLBACK_IMAGE;
  if (card.image) return card.image;
  const lookupOrder = [card.name, card.canonicalName, card.card];
  for (const key of lookupOrder) {
    const match = key && CARD_LOOKUP[key];
    if (match?.image) return match.image;
  }
  return FALLBACK_IMAGE;
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
  const textareaRef = useRef(null);
  const userInitiatedRevealRef = useRef(false);

  // Local state to manage the visual reveal sequence
  const [isVisuallyRevealed, setIsVisuallyRevealed] = useState(isRevealed);
  const controls = useAnimation();
  const hasMounted = useRef(false);

  const cardImage = useMemo(() => getCardImage(card), [card]);

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
    if (isRevealed && userInitiatedRevealRef.current) {
      // Focus textarea after animation completes (animation is ~300ms)
      const prefersReducedMotion = getPrefersReducedMotion();
      const delay = prefersReducedMotion ? 50 : 350;

      const focusTimer = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, delay);

      userInitiatedRevealRef.current = false;
      return () => clearTimeout(focusTimer);
    } else {
      userInitiatedRevealRef.current = false;
    }
  }, [isRevealed]);

  const handleReveal = () => {
    userInitiatedRevealRef.current = true;
    onReveal(index);
  };

  // Reset visual state when a revealed card is returned to an unrevealed state
  useEffect(() => {
    if (isRevealed || !isVisuallyRevealed) {
      return undefined;
    }

    const resetVisualState = () => {
      setIsVisuallyRevealed(false);
      controls.set({ rotateY: 0, opacity: 1 });
    };

    const canUseRaf = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function';
    const handleId = canUseRaf
      ? window.requestAnimationFrame(resetVisualState)
      : setTimeout(resetVisualState, 0);

    return () => {
      if (canUseRaf) {
        window.cancelAnimationFrame(handleId);
      } else {
        clearTimeout(handleId);
      }
    };
  }, [isRevealed, isVisuallyRevealed, controls]);

  // Handle the flip animation sequence
  useEffect(() => {
    if (!isRevealed || isVisuallyRevealed) {
      return;
    }

    let isActive = true;
    let staggerTimeoutId = null;

    const clearStaggerTimeout = () => {
      if (staggerTimeoutId) {
        clearTimeout(staggerTimeoutId);
        staggerTimeoutId = null;
      }
    };

    const sequence = async () => {
      if (import.meta.env.DEV) {
        console.log(`Card ${index} starting reveal sequence. Stagger: ${staggerDelay}`);
      }

      const prefersReducedMotion = getPrefersReducedMotion();
      const duration = prefersReducedMotion ? 0 : 0.25;
      const springTransition = prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 20 };

      if (staggerDelay > 0 && !prefersReducedMotion) {
        await new Promise(resolve => {
          staggerTimeoutId = setTimeout(() => {
            resolve();
            staggerTimeoutId = null;
          }, staggerDelay * 1000);
        });
        if (!isActive) return;
      }

      if (!isActive) return;
      if (import.meta.env.DEV) {
        console.log(`Card ${index} starting Phase 1 (rotate 90)`);
      }
      await controls.start({
        rotateY: 90,
        opacity: 0.8,
        transition: { duration: duration, ease: "easeIn" }
      });
      if (!isActive) return;

      if (import.meta.env.DEV) {
        console.log(`Card ${index} Phase 2 (swap content)`);
      }
      if (!isActive) return;
      setIsVisuallyRevealed(true);
      if (!isActive) return;

      if (import.meta.env.DEV) {
        console.log(`Card ${index} starting Phase 3 (rotate 0)`);
      }
      if (!isActive) return;
      await controls.start({
        rotateY: 0,
        opacity: 1,
        transition: springTransition
      });
      if (!isActive) return;

      if (import.meta.env.DEV) {
        console.log(`Card ${index} reveal complete`);
      }
    };

    sequence();

    return () => {
      isActive = false;
      clearStaggerTimeout();
      controls.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // isVisuallyRevealed is intentionally omitted - it changes mid-animation and would interrupt the sequence
  }, [isRevealed, staggerDelay, controls, index]);

  return (
    <div
      key={`${card.name}-${index}`}
      className={`modern-surface border border-secondary/40 overflow-hidden ${isVisuallyRevealed ? 'z-10' : 'z-0'}`}
      style={{ position: 'relative' }}
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
          className={`transition-all duration-500 transform rounded-lg ${!isVisuallyRevealed ? '' : 'group'}`}
          style={{
            transformStyle: 'preserve-3d',
            position: 'relative',
            zIndex: isVisuallyRevealed ? 1 : 'auto',
            backfaceVisibility: 'visible',
            WebkitBackfaceVisibility: 'visible'
          }}
        >
          {!isVisuallyRevealed ? (
            <button
              onClick={handleReveal}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleReveal();
                }
              }}
              aria-label={`Reveal card for ${position}. Cards can be revealed in any order.`}
              className="relative h-full min-h-[24rem] sm:min-h-[28rem] flex flex-col items-center justify-center gap-4 p-4 sm:p-6 w-full cursor-pointer hover:bg-surface-muted/70 hover:scale-105 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-main"
            >
              {/* Card back surface with Tableu logo */}
              <div className="relative w-full max-w-[280px] aspect-[2/3] mx-auto bg-gradient-to-br from-surface/95 via-surface-muted/90 to-surface/95 rounded-xl border-2 border-primary/30 shadow-2xl overflow-hidden">
                {/* Subtle pattern overlay */}
                <div className="absolute inset-0 opacity-10" style={{
                  backgroundImage: 'radial-gradient(circle at 50% 50%, var(--brand-secondary) 1px, transparent 1px)',
                  backgroundSize: '20px 20px'
                }} />

                {/* Tableu Logo - centered and prominent */}
                <div className="absolute inset-0 flex items-center justify-center p-6">
                  <TableuLogo
                    variant="icon"
                    size={180}
                    className="opacity-90 hover:opacity-100 transition-opacity duration-300"
                    outline
                    glow
                    useRaster
                    ariaLabel="Tableu card back - tap to reveal"
                  />
                </div>
              </div>

              {/* Tap to reveal instruction */}
              <div className="flex flex-col items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/60 bg-surface/90 px-4 py-2 text-sm font-semibold text-main shadow-md shadow-primary/30">
                  <HandPointing className="w-4 h-4" aria-hidden="true" />
                  <span>Tap to reveal</span>
                </span>
                <p className="text-xs text-muted max-w-[16rem] text-center">Reveal cards in any order—follow your intuition.</p>
              </div>
            </button>
          ) : (
            <div className="transition-all relative h-full min-h-[24rem] sm:min-h-[28rem]">
              {/* Clickable card image area - opens modal */}
              <button
                onClick={() => onCardClick?.(card, position, index)}
                aria-label={`View details for ${card.name} ${card.isReversed ? '(Reversed)' : '(Upright)'} in ${position} position`}
                className="w-full text-left cursor-pointer hover:bg-surface-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-main rounded-lg"
              >
                {/* Zoom Icon Overlay */}
                <div className="absolute top-2 right-2 z-10 opacity-90 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="bg-surface-muted/80 p-1.5 rounded-full text-accent border border-primary/30 shadow-lg backdrop-blur-sm">
                    <ArrowsOut className="w-4 h-4" />
                  </div>
                </div>

                {/* Rider-Waite Card Image with Interactive Overlay */}
                <motion.div
                  layoutId={`card-image-${index}`}
                  className={`mx-auto mb-3 max-w-[65%] sm:max-w-[280px] ${card.isReversed ? 'rotate-180' : ''}`}
                >
                  <div className="relative aspect-[2/3]">
                    <img
                      src={cardImage}
                      alt={`${card.name}${card.isReversed ? ' (Reversed)' : ''}`}
                      className="w-full h-full object-cover rounded-lg shadow-lg border-2 border-primary/30"
                      loading="lazy"
                      onError={event => {
                        const target = event.currentTarget;
                        if (!target) return;
                        console.error(`Failed to load image: ${cardImage}`);
                        target.onerror = null;
                        target.src = FALLBACK_IMAGE;
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
                  className="bg-surface/85 rounded p-4 border border-secondary/40 touch-pan-y"
                  ref={revealedContentRef}
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
              </button>

              {/* Reflection textarea - outside the button to avoid nested interactives */}
              <div className="mt-3">
                <label htmlFor={`reflection-${index}`} className="text-muted text-xs-plus sm:text-sm block mb-1">
                  What resonates for you?
                </label>
                <textarea
                  ref={textareaRef}
                  id={`reflection-${index}`}
                  value={reflectionValue}
                  onChange={event =>
                    setReflections(prev => ({ ...prev, [index]: event.target.value }))
                  }
                  rows={3}
                  maxLength={500}
                  className="w-full bg-surface/85 border border-secondary/40 rounded p-2 min-h-[4.5rem] resize-y text-main text-base focus:outline-none focus:ring-1 focus:ring-secondary/55 touch-pan-y"
                  placeholder="What resonates? (optional)"
                  aria-describedby={reflectionValue.length > 0 ? `char-count-${index}` : undefined}
                />
                {reflectionValue.length > 0 && (
                  <div id={`char-count-${index}`} className="mt-1 text-xs text-accent/70 text-right" aria-live="polite">
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
