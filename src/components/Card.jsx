import { useEffect, useMemo, useRef, useState, useCallback, useLayoutEffect } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { ArrowsOut, HandPointing, ArrowLeft, ArrowRight, NotePencil, CaretUp } from '@phosphor-icons/react';
import { CARD_LOOKUP, FALLBACK_IMAGE, getCardImage } from '../lib/cardLookup';
import { CardSymbolInsights } from './CardSymbolInsights';
import { InteractiveCardOverlay } from './InteractiveCardOverlay';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useLandscape } from '../hooks/useLandscape';
import { useHaptic } from '../hooks/useHaptic';

const SUIT_ACCENTS = {
  wands: {
    accent: 'var(--wands-accent)',
    soft: 'var(--wands-accent-soft)'
  },
  cups: {
    accent: 'var(--cups-accent)',
    soft: 'var(--cups-accent-soft)'
  },
  swords: {
    accent: 'var(--swords-accent)',
    soft: 'var(--swords-accent-soft)'
  },
  pentacles: {
    accent: 'var(--pentacles-accent)',
    soft: 'var(--pentacles-accent-soft)'
  }
};

const ELEMENT_FLASH_DURATION = 0.4;
const ELEMENT_FLASH_TIMEOUT_MS = Math.round(ELEMENT_FLASH_DURATION * 1000);
const SWIPE_THRESHOLD_RULES = [
  { maxWidth: 375, distanceThreshold: 35, timeThreshold: 350 },
  { maxWidth: 440, distanceThreshold: 42, timeThreshold: 320 },
  { maxWidth: Infinity, distanceThreshold: 50, timeThreshold: 300 }
];

function getSwipeThresholds(viewportWidth) {
  const rule = SWIPE_THRESHOLD_RULES.find(({ maxWidth }) => viewportWidth < maxWidth);
  return rule || SWIPE_THRESHOLD_RULES[SWIPE_THRESHOLD_RULES.length - 1];
}

function normalizeSuitKey(suit) {
  if (!suit || typeof suit !== 'string') return null;
  const trimmed = suit.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === 'wands') return 'wands';
  if (trimmed === 'cups') return 'cups';
  if (trimmed === 'swords') return 'swords';
  if (trimmed === 'pentacles') return 'pentacles';
  return null;
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
  openReflectionIndex,
  onRequestOpenReflection,
  staggerDelay = 0
}) {
  const reflectionValue = reflections?.[index] ?? '';
  const textareaRef = useRef(null);
  const userInitiatedRevealRef = useRef(false);
  const animationStartedRef = useRef(false);
  const { vibrate } = useHaptic();
  const prefersReducedMotion = useReducedMotion();
  const isSmallScreen = useSmallScreen(640); // < sm breakpoint
  const isLandscape = useLandscape();

  // Suit/element accents (Minors only) - uses CSS variables defined in `src/styles/tarot.css`.
  const canonicalCard = CARD_LOOKUP[card?.name] || card;
  const suitKey = useMemo(
    () => normalizeSuitKey(canonicalCard?.suit || card?.suit),
    [canonicalCard?.suit, card?.suit]
  );
  const suitAccent = suitKey ? SUIT_ACCENTS[suitKey] : null;
  const suitAccentColor = suitAccent?.accent || null;
  const suitAccentSoft = suitAccent?.soft || null;

  const suitImageStyle = useMemo(() => {
    if (!suitAccentColor || !suitAccentSoft) return undefined;
    return {
      borderColor: suitAccentColor,
      boxShadow: `0 0 0 1px ${suitAccentSoft}, 0 10px 24px rgba(0,0,0,0.25)`
    };
  }, [suitAccentColor, suitAccentSoft]);

  const suitFrameStyle = useMemo(() => {
    if (!suitAccentColor || !suitAccentSoft) return undefined;
    return {
      boxShadow: `0 0 0 1px ${suitAccentSoft}, 0 0 18px ${suitAccentSoft}`
    };
  }, [suitAccentColor, suitAccentSoft]);

  // Brief “element flash” on reveal (skips when reduced motion is preferred).
  const [elementFlashKey, setElementFlashKey] = useState(0);
  const [elementFlashActive, setElementFlashActive] = useState(false);
  const elementFlashTimeoutRef = useRef(null);
  const prevVisuallyRevealedRef = useRef(isRevealed);

  // Mobile: collapsible reflection section (starts collapsed unless has content)
  // This is local state that is authoritative on desktop, or when mobile has no coordination
  const [localShowReflection, setLocalShowReflection] = useState(() => Boolean(reflectionValue));

  // Compute effective visibility: on mobile with active coordination, derive from parent
  const showReflection = useMemo(() => {
    if (!isSmallScreen) return localShowReflection;
    if (openReflectionIndex === null) return localShowReflection;
    return openReflectionIndex === index;
  }, [isSmallScreen, openReflectionIndex, index, localShowReflection]);

  // Track previous openReflectionIndex to detect when this card is newly opened
  const prevOpenReflectionIndexRef = useRef(openReflectionIndex);

  // Focus textarea when this card's reflection is opened via parent coordination (side effect only)
  useLayoutEffect(() => {
    if (!isSmallScreen) return;
    const prevIndex = prevOpenReflectionIndexRef.current;
    prevOpenReflectionIndexRef.current = openReflectionIndex;

    // Focus only when this card's reflection was just opened via parent coordination
    if (openReflectionIndex === index && prevIndex !== index) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [openReflectionIndex, index, isSmallScreen]);

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
    return () => {
      if (elementFlashTimeoutRef.current) {
        window.clearTimeout(elementFlashTimeoutRef.current);
        elementFlashTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const prev = prevVisuallyRevealedRef.current;
    prevVisuallyRevealedRef.current = isVisuallyRevealed;

    if (!isVisuallyRevealed || prev) {
      if (!isVisuallyRevealed) {
        // Defer to next frame to avoid synchronous setState cascade
        requestAnimationFrame(() => setElementFlashActive(false));
      }
      return;
    }

    if (prefersReducedMotion) return;
    if (!suitAccentColor || !suitAccentSoft) return;

    // These are deferred via the animation callback timing
    requestAnimationFrame(() => {
      setElementFlashKey(k => k + 1);
      setElementFlashActive(true);
    });
    if (elementFlashTimeoutRef.current) {
      window.clearTimeout(elementFlashTimeoutRef.current);
    }
    elementFlashTimeoutRef.current = window.setTimeout(() => {
      setElementFlashActive(false);
      elementFlashTimeoutRef.current = null;
    }, ELEMENT_FLASH_TIMEOUT_MS);
  }, [isVisuallyRevealed, prefersReducedMotion, suitAccentColor, suitAccentSoft]);

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

  const handleReveal = useCallback(() => {
    userInitiatedRevealRef.current = true;
    onReveal(index);
  }, [onReveal, index]);

  // Swipe gesture state
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(true);

  // Swipe-to-reveal gesture handler
  const handleSwipeReveal = useCallback((direction) => {
    if (isRevealed || isVisuallyRevealed) return;

    vibrate(10);

    // Visual swipe animation before reveal
    if (!prefersReducedMotion) {
      controls.start({
        x: direction === 'right' ? 50 : -50,
        opacity: 0.7,
        transition: { duration: 0.15 }
      }).then(() => {
        handleReveal();
        controls.start({ x: 0, opacity: 1 });
      });
    } else {
      handleReveal();
    }
  }, [isRevealed, isVisuallyRevealed, handleReveal, controls, prefersReducedMotion, vibrate]);

  // Touch gesture tracking for swipe
  const handleTouchStart = useCallback((e) => {
    if (isRevealed) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    };
    setShowSwipeHint(false);
  }, [isRevealed]);

  const handleTouchMove = useCallback((e) => {
    if (isRevealed) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    // Only track horizontal movement, cap at 100px
    setSwipeOffset(Math.max(-100, Math.min(100, dx)));
  }, [isRevealed]);

  const handleTouchCancel = useCallback(() => {
    if (isRevealed) return;
    setSwipeOffset(0);
  }, [isRevealed]);

  const handleTouchEnd = useCallback((e) => {
    if (isRevealed) return;

    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;

    // Reset offset
    setSwipeOffset(0);

    // Responsive swipe thresholds (more forgiving on small screens)
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const { distanceThreshold, timeThreshold } = getSwipeThresholds(vw);
    const horizontalAdvantage = isSmallScreen ? 1.2 : 1.5;

    const horizontalDominant = Math.abs(dx) > Math.abs(dy) * horizontalAdvantage;

    if (Math.abs(dx) > distanceThreshold && horizontalDominant && dt < timeThreshold) {
      handleSwipeReveal(dx > 0 ? 'right' : 'left');
    }
  }, [isRevealed, handleSwipeReveal, isSmallScreen]);

  // Reset visual state when a revealed card is returned to an unrevealed state
  useEffect(() => {
    // When card becomes unrevealed, reset animation tracking
    if (!isRevealed) {
      animationStartedRef.current = false;
    }

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
    // Only start animation when isRevealed becomes true and we haven't animated yet
    if (!isRevealed || animationStartedRef.current) {
      return;
    }

    // Mark animation as started immediately to prevent re-triggers
    animationStartedRef.current = true;

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

      // Enhanced timing for ink-spread reveal effect
      const inkDuration = prefersReducedMotion ? 0 : 0.35;
      const revealTransition = prefersReducedMotion
        ? { duration: 0 }
        : { duration: 0.4, ease: [0.4, 0, 0.2, 1] };

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
        console.log(`Card ${index} starting Phase 1 (ink blur out)`);
      }
      
      // Phase 1: Ink blur-out (card fades with blur as if dissolving)
      await controls.start({
        rotateY: 90,
        opacity: 0.6,
        filter: prefersReducedMotion ? 'blur(0px)' : 'blur(8px)',
        scale: 0.95,
        transition: { duration: inkDuration, ease: "easeIn" }
      });
      if (!isActive) return;

      if (import.meta.env.DEV) {
        console.log(`Card ${index} Phase 2 (swap content)`);
      }
      setIsVisuallyRevealed(true);
      if (!isActive) return;

      if (import.meta.env.DEV) {
        console.log(`Card ${index} starting Phase 3 (ink spread in)`);
      }
      
      // Phase 2: Ink spread-in (card emerges from blur with scale)
      await controls.start({
        rotateY: 0,
        opacity: 1,
        filter: 'blur(0px)',
        scale: 1,
        transition: revealTransition
      });

      if (import.meta.env.DEV) {
        console.log(`Card ${index} reveal complete`);
      }
    };

    sequence();

    return () => {
      isActive = false;
      clearStaggerTimeout();
      // Don't call controls.stop() here - let the animation complete naturally
    };
    // Intentionally only depend on isRevealed to start animation once
    // Other values are read from refs or are stable
  }, [isRevealed, staggerDelay, controls, index, prefersReducedMotion]);

  // Get card meaning
  const originalCard = canonicalCard;
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
            WebkitTransformStyle: 'preserve-3d',
            position: 'relative',
            zIndex: isVisuallyRevealed ? 1 : 'auto',
            backfaceVisibility: 'visible',
            WebkitBackfaceVisibility: 'visible',
            willChange: prefersReducedMotion ? undefined : 'transform, opacity, filter'
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
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchCancel}
              aria-label={`${position}. Tap to reveal.`}
              className={`card-swipe-container relative h-full ${isLandscape ? 'min-h-[200px] max-h-[280px]' : 'min-h-[40vh] supports-[height:1svh]:min-h-[40svh] max-h-[55vh] supports-[height:1svh]:max-h-[55svh]'} sm:min-h-[24rem] sm:max-h-none flex flex-col items-center justify-center gap-4 p-4 sm:p-6 w-full cursor-pointer hover:bg-surface-muted/70 hover:scale-105 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-main`}
            >
              {/* Card back with mystical design */}
              <div
                className="relative w-full max-w-[280px] aspect-[2/3] mx-auto rounded-xl border-2 border-primary/30 shadow-2xl overflow-hidden transition-transform"
                style={{ transform: `translateX(${swipeOffset * 0.5}px)` }}
              >
                <img
                  src="/cardback.png"
                  alt="Card back - tap or swipe to reveal"
                  className="w-full h-full object-cover"
                  loading="eager"
                />

                {/* Swipe hint arrows */}
                {showSwipeHint && !prefersReducedMotion && (
                  <>
                    <div className="card-swipe-hint card-swipe-hint--left swipe-hint">
                      <ArrowLeft className="w-6 h-6 text-primary/60" aria-hidden="true" />
                    </div>
                    <div className="card-swipe-hint card-swipe-hint--right swipe-hint">
                      <ArrowRight className="w-6 h-6 text-primary/60" aria-hidden="true" />
                    </div>
                  </>
                )}
              </div>

              {/* Tap/swipe to reveal instruction */}
              <div className="flex flex-col items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/60 bg-surface/90 px-4 py-2 text-sm font-semibold text-main shadow-md shadow-primary/30">
                  <HandPointing className="w-4 h-4" aria-hidden="true" />
                  <span>Tap to reveal</span>
                </span>
              </div>
            </button>
          ) : (
            <div className={`transition-all relative h-full ${isLandscape ? 'min-h-[200px] max-h-[280px]' : 'min-h-[40vh] supports-[height:1svh]:min-h-[40svh] max-h-[55vh] supports-[height:1svh]:max-h-[55svh]'} sm:min-h-[24rem] sm:max-h-none flex flex-col items-center`}>
              {/* Card content area - restructured to avoid nested interactives */}
              <div className="relative w-full">
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
                <button
                  type="button"
                  onClick={() => onCardClick?.(card, position, index)}
                  className="relative bg-transparent border-0 p-0 cursor-pointer w-full hover:bg-surface-muted/40 transition-colors rounded-lg"
                  aria-label={`View details for ${card.name}`}
                >
                  {/* Rider-Waite Card Image with Interactive Overlay */}
                  <motion.div
                    layoutId={`card-image-${index}`}
                    className={`mx-auto mb-3 max-w-[65%] sm:max-w-[280px] ${card.isReversed ? 'rotate-180' : ''}`}
                  >
                    <div className="relative aspect-[2/3] rounded-lg" style={suitFrameStyle}>
                      <img
                        src={cardImage}
                        alt={`${card.name}${card.isReversed ? ' (Reversed)' : ''}`}
                        className="w-full h-full object-cover rounded-lg shadow-lg border-2 border-primary/30"
                        style={suitImageStyle}
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

                      {elementFlashActive && suitAccentColor && suitAccentSoft && (
                        <motion.div
                          // Key forces a fresh animation per reveal.
                          key={`element-flash-${index}-${elementFlashKey}`}
                          className="absolute inset-0 rounded-lg pointer-events-none"
                          initial={{ opacity: 0.6, scale: 0.92 }}
                          animate={{ opacity: 0, scale: 1.12 }}
                          transition={{ duration: ELEMENT_FLASH_DURATION, ease: 'easeOut' }}
                          style={{
                            border: `2px solid ${suitAccentColor}`,
                            background: `radial-gradient(circle at 50% 35%, ${suitAccentSoft} 0%, transparent 60%)`
                          }}
                          aria-hidden="true"
                        />
                      )}

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

              {/* Reflection textarea - collapsible on mobile to reduce density */}
              <div className="mt-3 w-full">
                {/* Mobile: toggle button when collapsed */}
                {isSmallScreen && !showReflection ? (
                  <button
                    type="button"
                    onClick={() => {
                      setLocalShowReflection(true);
                      onRequestOpenReflection?.(index);
                      // Focus textarea after state update
                      setTimeout(() => textareaRef.current?.focus(), 50);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-secondary/30 bg-surface/60 text-muted hover:text-main hover:border-secondary/50 transition-colors touch-manipulation min-h-[44px]"
                    aria-expanded="false"
                    aria-controls={`reflection-${index}`}
                  >
                    <NotePencil className="w-4 h-4" aria-hidden="true" />
                    <span className="text-sm">
                      {reflectionValue ? 'Edit reflection' : 'Add reflection'}
                    </span>
                    {reflectionValue && (
                      <span className="text-xs text-secondary ml-1">({reflectionValue.length})</span>
                    )}
                  </button>
                ) : (
                  <>
                    {/* Mobile: collapsible header with toggle */}
                    {isSmallScreen && (
                      <button
                        type="button"
                        onClick={() => {
                          setLocalShowReflection(false);
                          if (onRequestOpenReflection && openReflectionIndex === index) {
                            onRequestOpenReflection(null);
                          }
                        }}
                        className="w-full flex items-center justify-between mb-1.5 min-h-[44px] touch-manipulation text-muted hover:text-main transition-colors"
                        aria-expanded="true"
                        aria-controls={`reflection-${index}`}
                      >
                        <span className="text-xs-plus">What resonates for you?</span>
                        <CaretUp className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                    {/* Desktop: static label */}
                    {!isSmallScreen && (
                      <label htmlFor={`reflection-${index}`} className="text-muted text-xs-plus sm:text-sm block mb-1">
                        What resonates for you?
                      </label>
                    )}
                    <textarea
                      ref={textareaRef}
                      id={`reflection-${index}`}
                      value={reflectionValue}
                      onChange={event =>
                        setReflections(prev => ({ ...prev, [index]: event.target.value }))
                      }
                      rows={isSmallScreen ? 3 : 4}
                      maxLength={500}
                      className="w-full bg-surface/85 border border-secondary/40 rounded p-2 min-h-[3.5rem] sm:min-h-[4.5rem] resize-y text-main text-base leading-relaxed focus:outline-none focus:ring-1 focus:ring-secondary/55 touch-pan-y"
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
                  </>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
