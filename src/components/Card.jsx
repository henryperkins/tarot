import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { ArrowsOut, HandPointing } from '@phosphor-icons/react';
import { CARD_LOOKUP, FALLBACK_IMAGE, getCardImage } from '../lib/cardLookup';
import { CardSymbolInsights } from './CardSymbolInsights';
import { InteractiveCardOverlay } from './InteractiveCardOverlay';
import { useReducedMotion } from '../hooks/useReducedMotion';

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
  const reflectionValue = reflections?.[index] ?? '';
  const textareaRef = useRef(null);
  const userInitiatedRevealRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  // Local state to manage the visual reveal sequence
  const [isVisuallyRevealed, setIsVisuallyRevealed] = useState(isRevealed);
  const controls = useAnimation();
  const hasMounted = useRef(false);

  const cardImage = useMemo(() => getCardImage(card), [card]);

  useEffect(() => {
    // Entry animation
    if (!hasMounted.current) {
      controls.start({
        opacity: 1,
        y: 0,
        scale: 1,
        rotateY: 0,
        transition: prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 20 }
      });
      hasMounted.current = true;
    }
  }, [controls, prefersReducedMotion]);

  useEffect(() => {
    if (isRevealed && userInitiatedRevealRef.current) {
      // Focus textarea after animation completes (animation is ~300ms)
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
  }, [isRevealed, prefersReducedMotion]);

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
    // Note: isVisuallyRevealed is intentionally omitted as it changes mid-animation
    // prefersReducedMotion is now included to handle preference changes
  }, [isRevealed, staggerDelay, controls, index, prefersReducedMotion]);

  // Get card meaning
  const originalCard = CARD_LOOKUP[card.name] || card;
  const meaning = card.isReversed ? originalCard.reversed : originalCard.upright;

  // Character count warning thresholds
  const charCount = reflectionValue.length;
  const charCountClass = charCount > 480 ? 'text-error' : charCount > 450 ? 'text-warning' : 'text-accent/70';

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
              {/* Card back with mystical design */}
              <div className="relative w-full max-w-[280px] aspect-[2/3] mx-auto rounded-xl border-2 border-primary/30 shadow-2xl overflow-hidden">
                <img
                  src="/cardback.png"
                  alt="Card back - tap to reveal"
                  className="w-full h-full object-cover"
                  loading="eager"
                />
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
              {/* Card content area - restructured to avoid nested interactives */}
              <div className="relative">
                {/* Zoom Icon - primary keyboard target for modal */}
                <button
                  type="button"
                  onClick={() => onCardClick?.(card, position, index)}
                  className="absolute top-2 right-2 z-20 min-h-[44px] min-w-[44px] flex items-center justify-center bg-surface-muted/80 rounded-full text-accent border border-primary/30 shadow-lg backdrop-blur-sm hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary touch-manipulation"
                  aria-label={`View details for ${card.name}`}
                >
                  <ArrowsOut className="w-5 h-5" />
                </button>

                {/* Card image area - clickable for modal (keyboard users use the zoom button above) */}
                <div
                  onClick={() => onCardClick?.(card, position, index)}
                  className="cursor-pointer hover:bg-surface-muted/40 transition-colors rounded-lg"
                >
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
                        decoding="async"
                        onError={event => {
                          const target = event.currentTarget;
                          if (!target) return;
                          console.error(`Failed to load image: ${cardImage}`);
                          target.onerror = null;
                          target.src = FALLBACK_IMAGE;
                        }}
                      />
                      {/* Interactive symbol overlay */}
                      <InteractiveCardOverlay card={card} />
                    </div>
                  </motion.div>

                  <div className="text-center mb-3">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs-plus font-semibold tracking-wide ${card.isReversed
                        ? 'bg-surface-muted/90 text-accent border border-accent/50'
                        : 'bg-secondary/10 text-secondary border border-secondary/60'
                        }`}
                    >
                      {card.isReversed ? 'Reversed' : 'Upright'}
                    </span>
                  </div>

                  <div className="mb-4 flex justify-center">
                    <CardSymbolInsights card={card} position={position} />
                  </div>

                  <div className="bg-surface/85 rounded p-4 border border-secondary/40 touch-pan-y">
                    <p className="text-main text-sm sm:text-base leading-relaxed">
                      {meaning}
                    </p>
                  </div>
                </div>
              </div>

              {/* Reflection textarea - separate from clickable card area */}
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
                  aria-describedby={`char-count-${index}`}
                />
                <div
                  id={`char-count-${index}`}
                  className={`mt-1 text-xs text-right ${charCountClass}`}
                  aria-live="polite"
                >
                  {charCount} / 500
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
