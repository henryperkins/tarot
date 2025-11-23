import { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { ArrowsOut, HandPointing } from '@phosphor-icons/react';
import { MAJOR_ARCANA } from '../data/majorArcana';
import { MINOR_ARCANA } from '../data/minorArcana';
import { CardSymbolInsights } from './CardSymbolInsights';
import { InteractiveCardOverlay } from './InteractiveCardOverlay';
import { TableuLogo } from './TableuLogo';

function getPrefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  const handleCardActivate = () => {
    if (!isRevealed) {
      handleReveal();
    } else if (onCardClick) {
      onCardClick(card, position, index);
    }
  };

  // Reset visual state when card is unrevealed
  useEffect(() => {
    if (!isRevealed || !isVisuallyRevealed) {
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
  }, [isRevealed, isVisuallyRevealed, staggerDelay, controls, index]);

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
          onClick={handleCardActivate}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleCardActivate();
            }
          }}
          role="button"
          aria-label={
            isRevealed
              ? `${position}: ${card.name} ${card.isReversed ? 'reversed' : 'upright'}. Click to view details.`
              : `Reveal card for ${position}. Cards can be revealed in any order.`
          }
          tabIndex={0}
          className={`cursor-pointer transition-all duration-500 transform ${!isVisuallyRevealed
            ? 'hover:bg-surface-muted/70 hover:scale-105 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-main'
            : 'hover:bg-surface-muted/40 rounded-lg group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-main'
            }`}
          style={{
            transformStyle: 'preserve-3d'
          }}
        >
          {!isVisuallyRevealed ? (
            <div className="text-center py-6 sm:py-10 space-y-3">
              <div className="mx-auto flex items-center justify-center p-4 bg-gradient-to-br from-surface-muted/40 to-surface/60 rounded-xl border-2 border-primary/30 shadow-lg">
                <TableuLogo
                  variant="icon"
                  size={140}
                  className="opacity-75 hover:opacity-90 transition-opacity"
                  ariaLabel="Tableu card back - tap to reveal"
                />
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/60 bg-surface/90 px-4 py-2 text-sm font-semibold text-main shadow-md shadow-primary/30">
                  <HandPointing className="w-4 h-4" aria-hidden="true" />
                  <span>Tap to reveal</span>
                </span>
                <p className="text-xs text-muted max-w-[16rem]">Reveal cards in any order—follow your intuition.</p>
              </div>
            </div>
          ) : (
            <div className="transition-all relative">
              {/* Zoom Icon Overlay */}
              <div className="absolute top-0 right-0 z-10 opacity-90 group-hover:opacity-100 transition-opacity duration-300">
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
                    onError={event => {
                      const target = event.currentTarget;
                      if (!target) return;
                      console.error(`Failed to load image: ${card.image}`);
                      target.onerror = null;
                      target.src = '/images/cards/placeholder.jpg';
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
                className="bg-surface/85 rounded p-4 border border-secondary/40"
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
                  onClick={event => event.stopPropagation()}
                  onPointerDown={event => event.stopPropagation()}
                  onFocus={event => event.stopPropagation()}
                  onKeyDown={event => event.stopPropagation()}
                  rows={3}
                  maxLength={500}
                  className="w-full bg-surface/85 border border-secondary/40 rounded p-2 min-h-[4.5rem] resize-y text-main text-base focus:outline-none focus:ring-1 focus:ring-secondary/55"
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
