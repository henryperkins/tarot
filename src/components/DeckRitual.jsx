import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { TableuLogo } from './TableuLogo';
import { Sparkle, Scissors, ArrowsClockwise, HandTap } from '@phosphor-icons/react';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useLandscape } from '../hooks/useLandscape';
import { useHaptic } from '../hooks/useHaptic';
import { getSuitGlowColor, getSuitBorderColor } from '../lib/suitColors';
import { useToast } from '../contexts/ToastContext.jsx';

const CARD_STACK_COUNT = 7; // Visual stack layers

/**
 * Unified deck + ritual interface combining DeckPile and RitualControls
 * Supports gesture-based interactions: tap to knock, long-press to cut, double-tap to shuffle
 */
export function DeckRitual({
  // Ritual state
  knockCount = 0,
  onKnock,
  hasCut = false,
  cutIndex = 0,
  onCutChange,
  onCutConfirm,
  deckSize = 78,
  knockCadenceResetAt = 0,

  // Deal state
  isShuffling = false,
  onShuffle,
  cardsRemaining,
  nextPosition,
  spreadPositions = [],
  revealedCount = 0,
  totalCards = 0,

  // Deal action
  onDeal,

  // Cards dealt for minimap suit coloring
  cards = [],
  revealedIndices,

  // Reveal staging (deck-first vs board-first on mobile)
  revealStage = 'action',

  // External ref for ghost card animation coordination
  externalDeckRef
}) {
  const isSmallScreen = useSmallScreen();
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();
  const { vibrate } = useHaptic();
  const { publish: publishToast } = useToast();
  const deckControls = useAnimation();
  const [showCutSlider, setShowCutSlider] = useState(false);
  const [localCutIndex, setLocalCutIndex] = useState(cutIndex);
  const [showCadenceReset, setShowCadenceReset] = useState(false);
  const internalDeckRef = useRef(null);
  // Use external ref if provided (for parent to coordinate ghost card animation)
  const deckRef = externalDeckRef || internalDeckRef;
  const cadenceResetTimerRef = useRef(null);
  const knockComplete = knockCount >= 3;
  const isIdleBreathing = !prefersReducedMotion &&
    !isShuffling &&
    knockCount === 0 &&
    revealedCount === 0 &&
    cardsRemaining === totalCards;
  const canShuffleGesture = !isShuffling && revealedCount === 0 && cardsRemaining === totalCards && knockComplete;
  const isDeckPrimary = revealStage !== 'spread';
  const boardHintRef = useRef(0);

  // Sync local cut index with prop
  useEffect(() => {
    setLocalCutIndex(cutIndex);
  }, [cutIndex]);

  // Card stack visual offsets
  const stackCards = Array.from({ length: CARD_STACK_COUNT }, (_, i) => ({
    id: i,
    zIndex: CARD_STACK_COUNT - i,
    offset: i * 2,
    rotation: (i - Math.floor(CARD_STACK_COUNT / 2)) * 0.8,
    opacity: 1 - (i * 0.08)
  }));

  // Deal animation - card flies from deck
  const handleDealWithAnimation = useCallback(() => {
    if (cardsRemaining <= 0 || isShuffling) return;
    vibrate(10);
    onDeal?.();
  }, [cardsRemaining, isShuffling, onDeal, vibrate]);

  const triggerKnock = useCallback(() => {
    onKnock?.();
    vibrate([15, 30, 15]);

    // Visual pulse on knock
    if (!prefersReducedMotion) {
      deckControls.start({
        scale: [1, 0.96, 1.02, 1],
        transition: { duration: 0.25 }
      });
    }
  }, [onKnock, vibrate, prefersReducedMotion, deckControls]);

  // Tap / double-tap handler (handles knock + shuffle within same flow to avoid browser dblclick delay)
  const lastTapRef = useRef(0);
  const singleTapTimeoutRef = useRef(null);
  const clearSingleTapTimeout = useCallback(() => {
    if (singleTapTimeoutRef.current) {
      clearTimeout(singleTapTimeoutRef.current);
      singleTapTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
      }
    };
  }, []);
  const handleDeckTap = useCallback(() => {
    if (showCutSlider) return;

    if (!isDeckPrimary && cardsRemaining > 0) {
      const now = Date.now();
      if (now - boardHintRef.current > 1200) {
        publishToast({
          type: 'info',
          title: 'Reveal on the board',
          description: nextPosition ? `Tap ${nextPosition} to reveal.` : 'Tap a position to reveal the next card.',
          duration: 900
        });
        boardHintRef.current = now;
      }
      return;
    }

    if (!knockComplete) {
      triggerKnock();
      return;
    }

    const now = Date.now();
    const sinceLast = now - lastTapRef.current;
    const withinDoubleTap = sinceLast > 0 && sinceLast < 320;

    if (withinDoubleTap) {
      lastTapRef.current = 0;
      clearSingleTapTimeout();
      if (canShuffleGesture) {
        onShuffle?.();
        vibrate([20, 50, 20, 50, 20]);
      }
      return;
    }

    lastTapRef.current = now;

    if (canShuffleGesture) {
      clearSingleTapTimeout();
      singleTapTimeoutRef.current = setTimeout(() => {
        singleTapTimeoutRef.current = null;
        lastTapRef.current = 0;
        handleDealWithAnimation();
      }, 320);
      return;
    }

    handleDealWithAnimation();
  }, [showCutSlider, isDeckPrimary, cardsRemaining, publishToast, nextPosition, knockComplete, triggerKnock, canShuffleGesture, onShuffle, vibrate, handleDealWithAnimation, clearSingleTapTimeout]);

  // Long-press to reveal cut slider
  const longPressTimerRef = useRef(null);
  const handleTouchStart = useCallback(() => {
    if (showCutSlider || !isDeckPrimary) return;
    longPressTimerRef.current = setTimeout(() => {
      setShowCutSlider(true);
      vibrate([30]);
    }, 420);
  }, [showCutSlider, isDeckPrimary, vibrate]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  }, []);

  // Shuffle animation
  useEffect(() => {
    if (isShuffling && !prefersReducedMotion) {
      deckControls.start({
        rotateY: [0, 180, 360, 180, 0],
        rotateZ: [0, 5, -5, 3, 0],
        transition: { duration: 1.2, ease: 'easeInOut' }
      });
    }
  }, [isShuffling, deckControls, prefersReducedMotion]);

  // Handle local cut slider change
  const handleCutSliderChange = useCallback((e) => {
    const value = parseInt(e.target.value, 10);
    setLocalCutIndex(value);
    onCutChange?.(value);
  }, [onCutChange]);

  // Confirm cut
  const handleCutConfirm = useCallback(() => {
    onCutConfirm?.();
    setShowCutSlider(false);
    vibrate([20, 30, 20]);
    publishToast({
      type: 'info',
      title: hasCut ? 'Cut updated' : 'Cut locked',
      description: `#${localCutIndex}`,
      duration: 700
    });
  }, [onCutConfirm, vibrate, publishToast, hasCut, localCutIndex]);

  const idleBreathAnimation = isIdleBreathing ? { scale: [1, 1.02, 1] } : { scale: 1 };
  const idleBreathTransition = isIdleBreathing
    ? { duration: 3.8, ease: 'easeInOut', repeat: Infinity }
    : { duration: 0.2, ease: 'easeOut' };
  const knockHint = '3 quick taps within 2s';
  const drawLabel = nextPosition ? `Tap to draw card for ${nextPosition}.` : 'Tap to draw the next card.';
  const boardLabel = nextPosition
    ? `Tap ${nextPosition} on the board to reveal.`
    : 'Tap a position on the board to reveal the next card.';
  const knockLabel = `Tap to knock (${knockCount}/3). ${knockHint}.`;
  const cutLabel = hasCut ? ' Hold to adjust.' : ' Hold to cut.';
  const shuffleLabel = canShuffleGesture ? ' Double-tap to shuffle.' : '';
  const deckAriaLabel = cardsRemaining > 0
    ? isDeckPrimary
      ? knockComplete
        ? `${drawLabel}${cutLabel}${shuffleLabel}`
        : `${knockLabel}${cutLabel}${shuffleLabel}`
      : boardLabel
    : 'All cards dealt';

  useEffect(() => {
    if (!knockCadenceResetAt) return;
    setShowCadenceReset(true);
    if (cadenceResetTimerRef.current) {
      clearTimeout(cadenceResetTimerRef.current);
    }
    cadenceResetTimerRef.current = setTimeout(() => {
      setShowCadenceReset(false);
      cadenceResetTimerRef.current = null;
    }, 1600);
    publishToast({
      type: 'info',
      title: 'Cadence reset',
      description: knockHint,
      duration: 700
    });
    return () => {
      if (cadenceResetTimerRef.current) {
        clearTimeout(cadenceResetTimerRef.current);
        cadenceResetTimerRef.current = null;
      }
    };
  }, [knockCadenceResetAt, publishToast]);

  return (
    <div className={`deck-ritual-container relative ${isLandscape ? 'py-3' : 'py-4 xs:py-5 sm:py-8'}`}>
      {/* Ritual Status Indicator - more compact on very small screens */}
      <div className={`flex items-center justify-center ${isLandscape ? 'gap-2 mb-3' : 'gap-2 xs:gap-3 sm:gap-4 mb-3 xs:mb-4 sm:mb-6'}`}>
        <div className={`flex items-center gap-1.5 xs:gap-2 rounded-full border transition-all ${isLandscape ? 'px-2 py-1' : 'px-2.5 xs:px-3 py-1 xs:py-1.5'} ${
          knockComplete
            ? 'border-secondary/60 bg-secondary/15 text-secondary'
            : 'border-accent/30 bg-surface/60 text-muted'
        }`}>
          <Sparkle className={isLandscape ? 'w-3 h-3' : 'w-3.5 h-3.5 xs:w-4 xs:h-4'} weight={knockComplete ? 'fill' : 'regular'} />
          <span className={`font-semibold ${isLandscape ? 'text-[0.65rem]' : 'text-[0.7rem] xs:text-xs'}`}>{knockComplete ? (isLandscape ? '✓' : 'Cleared') : `${knockCount}/3`}</span>
        </div>

        <div className={`flex items-center gap-1.5 xs:gap-2 rounded-full border transition-all ${isLandscape ? 'px-2 py-1' : 'px-2.5 xs:px-3 py-1 xs:py-1.5'} ${
          hasCut
            ? 'border-secondary/60 bg-secondary/15 text-secondary'
            : 'border-accent/30 bg-surface/60 text-muted'
        }`}>
          <Scissors className={isLandscape ? 'w-3 h-3' : 'w-3.5 h-3.5 xs:w-4 xs:h-4'} weight={hasCut ? 'fill' : 'regular'} />
          <span className={`font-semibold ${isLandscape ? 'text-[0.65rem]' : 'text-[0.7rem] xs:text-xs'}`}>{hasCut ? `#${cutIndex}` : (isLandscape ? '—' : 'Uncut')}</span>
        </div>
      </div>

      {/* The Deck - responsive sizing for different screen sizes */}
      <div className="relative flex justify-center" style={{ perspective: '1200px', WebkitPerspective: '1200px' }}>
        <motion.div
          ref={deckRef}
          animate={deckControls}
          className={`deck-stack relative touch-manipulation ${isDeckPrimary ? 'cursor-pointer' : 'cursor-default opacity-70'}`}
          onClick={handleDeckTap}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
          role="button"
          aria-label={deckAriaLabel}
          aria-disabled={!isDeckPrimary}
          tabIndex={isDeckPrimary ? 0 : -1}
          onKeyDown={(e) => {
            if (!isDeckPrimary) return;
            if ((e.key === 'Enter' || e.key === ' ') && e.shiftKey) {
              e.preventDefault();
              if (canShuffleGesture) {
                onShuffle?.();
                vibrate([20, 50, 20, 50, 20]);
              } else {
                return;
              }
              return;
            }
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleDeckTap();
              return;
            }
            // 'k' to knock
            if (e.key === 'k' || e.key === 'K') {
              e.preventDefault();
              handleDeckTap();
              return;
            }
            // 'c' to toggle cut slider
            if (e.key === 'c' || e.key === 'C') {
              e.preventDefault();
              setShowCutSlider(prev => !prev);
            }
          }}
          style={{ transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d' }}
        >
          {/* Stack of cards - optimized for very small screens (<375px) */}
          {stackCards.map((card) => (
            <motion.div
              key={card.id}
              className={`absolute rounded-xl border-2 border-primary/30 overflow-hidden ${isSmallScreen ? 'w-[clamp(5.5rem,32vw,7.5rem)] h-[clamp(8.25rem,48vw,11.25rem)]' : 'w-[clamp(7rem,35vw,8.5rem)] h-[clamp(10.5rem,52vw,12.75rem)]'}`}
              style={{
                zIndex: card.zIndex,
                opacity: card.opacity,
                transform: `translateX(${card.offset}px) translateY(${card.offset}px) rotate(${card.rotation}deg)`,
                background: 'linear-gradient(145deg, var(--bg-surface), var(--bg-surface-muted))'
              }}
              initial={false}
              animate={isShuffling && !prefersReducedMotion ? {
                x: [card.offset, card.offset + 10, card.offset - 5, card.offset],
                rotate: [card.rotation, card.rotation + 3, card.rotation - 2, card.rotation]
              } : {}}
              transition={{ duration: 0.4, delay: card.id * 0.05 }}
            >
              {/* Card back pattern */}
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: 'radial-gradient(circle at 50% 50%, var(--brand-secondary) 1px, transparent 1px)',
                backgroundSize: '12px 12px'
              }} />
            </motion.div>
          ))}

          {/* Top card with logo - responsive sizing */}
          <motion.div
            className={`relative rounded-xl border-2 border-primary/40 shadow-2xl overflow-hidden ${isSmallScreen ? 'w-[clamp(5.5rem,32vw,7.5rem)] h-[clamp(8.25rem,48vw,11.25rem)]' : 'w-[clamp(7rem,35vw,8.5rem)] h-[clamp(10.5rem,52vw,12.75rem)]'}`}
            style={{
              background: 'linear-gradient(145deg, var(--bg-surface), var(--bg-surface-muted))',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3), 0 0 30px color-mix(in srgb, var(--brand-primary) 10%, transparent)'
            }}
            animate={idleBreathAnimation}
            transition={idleBreathTransition}
            whileHover={prefersReducedMotion || !isDeckPrimary ? {} : { y: -4, rotateX: 5 }}
            whileTap={prefersReducedMotion || !isDeckPrimary ? {} : { scale: 0.98 }}
          >
            <div className="absolute inset-0 flex items-center justify-center p-3 xs:p-4">
              <TableuLogo
                variant="icon"
                size={isSmallScreen ? 60 : 80}
                className="opacity-80 group-hover:opacity-100 transition-opacity"
                outline
                glow
                useRaster
              />
            </div>

            {/* Knock ripple effect */}
            <AnimatePresence>
              {knockCount > 0 && !knockComplete && (
                <motion.div
                  key={`knock-${knockCount}`}
                  className="absolute inset-0 rounded-xl border-2 border-secondary pointer-events-none"
                  initial={{ scale: 0.8, opacity: 0.8 }}
                  animate={{ scale: 1.3, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0.1 : 0.25 }}
                />
              )}
            </AnimatePresence>

            {/* Shuffle spinner overlay */}
            {isShuffling && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface/50 backdrop-blur-sm rounded-xl">
                <ArrowsClockwise className="w-8 h-8 text-secondary animate-spin" />
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* Cut slider (appears on long-press) - mobile optimized */}
      <AnimatePresence>
        {showCutSlider && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0, y: 0 } : { opacity: 0, y: 20 }}
            className="mt-4 xs:mt-5 sm:mt-6 max-w-xs mx-auto px-3 xs:px-4"
          >
            <div className="rounded-2xl border border-accent/30 bg-surface/80 backdrop-blur p-3 xs:p-4">
              <div className="flex items-center justify-between mb-2 xs:mb-3">
                <span className="text-[0.7rem] xs:text-xs text-muted">Cut position</span>
                <span className="text-sm font-bold text-secondary">#{localCutIndex}</span>
              </div>
              <input
                type="range"
                min={0}
                max={deckSize - 1}
                value={localCutIndex}
                onChange={handleCutSliderChange}
                className="w-full touch-manipulation"
                aria-label="Cut position in deck"
              />
              <div className="flex justify-between mt-2 xs:mt-3 gap-2">
                <button
                  onClick={() => setShowCutSlider(false)}
                  className="text-[0.7rem] xs:text-xs text-muted hover:text-main transition-colors px-3 py-2 rounded-full hover:bg-surface-muted/50 min-h-[44px] touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCutConfirm}
                  className="px-4 py-2 rounded-full bg-secondary/20 border border-secondary/50 text-secondary text-[0.7rem] xs:text-xs font-semibold hover:bg-secondary/30 transition-colors min-h-[44px] touch-manipulation"
                >
                  Confirm Cut
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick draw CTA placed nearer to the deck on mobile */}
      {isDeckPrimary && cardsRemaining > 0 && (
        <div className={`text-center px-3 xs:px-4 ${isLandscape ? 'mt-3' : 'mt-4 xs:mt-5'} sm:hidden`}>
          <motion.button
            onClick={handleDealWithAnimation}
            disabled={isShuffling}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-main font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            style={{ boxShadow: '0 10px 30px color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
            whileHover={prefersReducedMotion ? {} : { scale: 1.03 }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
          >
            <span>Draw: {nextPosition || 'Next Card'}</span>
            <span className="opacity-70 text-[0.7rem]">({cardsRemaining})</span>
          </motion.button>
        </div>
      )}

      {/* Ritual action buttons - explicit alternatives to gestures for accessibility */}
      <div className={`flex flex-wrap items-center justify-center px-3 xs:px-4 ${isLandscape ? 'mt-3 gap-1.5' : 'mt-3 xs:mt-4 sm:mt-5 gap-1.5 xs:gap-2 sm:gap-3'}`}>
        {/* Knock button */}
        <button
          onClick={handleDeckTap}
          disabled={knockComplete || showCutSlider}
          className={`
            flex items-center rounded-full font-medium
            transition-all touch-manipulation min-h-[44px]
            ${isLandscape ? 'gap-1 px-2.5 py-1.5 text-[0.65rem]' : 'gap-1.5 px-2.5 xs:px-3 py-2 text-[0.7rem] xs:text-xs'}
            ${knockComplete
              ? 'bg-secondary/15 border border-secondary/40 text-secondary cursor-default'
              : 'bg-surface/60 border border-accent/30 text-muted hover:bg-surface hover:border-accent/50 hover:text-main active:scale-95'
            }
          `}
          aria-label={knockComplete ? 'Knocking complete' : `Knock on deck (${knockCount}/3)`}
        >
          <HandTap className={isLandscape ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5 xs:w-4 xs:h-4'} aria-hidden="true" />
          <span>{knockComplete ? '✓' : (isLandscape ? knockCount : `Knock (${knockCount}/3)`)}</span>
        </button>

        {/* Cut button */}
        <button
          onClick={() => setShowCutSlider(prev => !prev)}
          className={`
            flex items-center rounded-full font-medium
            transition-all touch-manipulation min-h-[44px]
            ${isLandscape ? 'gap-1 px-2.5 py-1.5 text-[0.65rem]' : 'gap-1.5 px-2.5 xs:px-3 py-2 text-[0.7rem] xs:text-xs'}
            ${hasCut
              ? 'bg-secondary/15 border border-secondary/40 text-secondary'
              : showCutSlider
              ? 'bg-accent/20 border border-accent/50 text-main'
              : 'bg-surface/60 border border-accent/30 text-muted hover:bg-surface hover:border-accent/50 hover:text-main active:scale-95'
            }
          `}
          aria-label={hasCut ? `Adjust cut at position ${cutIndex}` : showCutSlider ? 'Close cut slider' : 'Cut the deck'}
          aria-expanded={showCutSlider}
        >
          <Scissors className={isLandscape ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5 xs:w-4 xs:h-4'} aria-hidden="true" />
          <span>{hasCut ? (isLandscape ? `#${cutIndex}` : 'Adjust cut') : (isLandscape ? 'Cut' : (showCutSlider ? 'Cutting...' : 'Cut Deck'))}</span>
        </button>

        {/* Shuffle button */}
        <button
          onClick={() => {
            onShuffle?.();
            vibrate([20, 50, 20, 50, 20]);
          }}
          disabled={isShuffling}
          className={`
            flex items-center rounded-full font-medium
            bg-surface/60 border border-accent/30 text-muted
            hover:bg-surface hover:border-accent/50 hover:text-main
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all touch-manipulation min-h-[44px] active:scale-95
            ${isLandscape ? 'gap-1 px-2.5 py-1.5 text-[0.65rem]' : 'gap-1.5 px-2.5 xs:px-3 py-2 text-[0.7rem] xs:text-xs'}
          `}
          aria-label={isShuffling ? 'Shuffling deck...' : 'Shuffle the deck'}
        >
          <ArrowsClockwise className={`${isLandscape ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5 xs:w-4 xs:h-4'} ${isShuffling ? 'animate-spin' : ''}`} aria-hidden="true" />
          {!isLandscape && <span>{isShuffling ? 'Shuffling...' : 'Shuffle'}</span>}
        </button>
      </div>

      {/* Gesture hints with icons for better discoverability */}
      {isDeckPrimary && (
        <div className={`flex flex-wrap justify-center px-3 xs:px-4 ${isLandscape ? 'mt-2 gap-1.5' : 'mt-2 xs:mt-3 gap-1.5 xs:gap-2'}`}>
          {showCadenceReset && !knockComplete && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border border-amber-300/40 bg-amber-300/10 text-amber-100 motion-safe:animate-pulse ${isLandscape ? 'text-[0.55rem]' : 'text-[0.6rem] xs:text-[0.65rem]'}`}
              role="status"
              aria-live="polite"
            >
              <ArrowsClockwise className="w-3 h-3" weight="duotone" aria-hidden="true" />
              <span>Cadence reset</span>
            </span>
          )}
          {!knockComplete && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface/60 border border-accent/20 text-muted ${isLandscape ? 'text-[0.55rem]' : 'text-[0.6rem] xs:text-[0.65rem]'}`}>
              <HandTap className="w-3 h-3" weight="duotone" aria-hidden="true" />
              <span>{knockHint}</span>
            </span>
          )}
          {!hasCut && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface/60 border border-accent/20 text-muted ${isLandscape ? 'text-[0.55rem]' : 'text-[0.6rem] xs:text-[0.65rem]'}`}>
              <Scissors className="w-3 h-3" weight="duotone" aria-hidden="true" />
              <span>Hold to cut</span>
            </span>
          )}
          {hasCut && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface/60 border border-accent/20 text-muted ${isLandscape ? 'text-[0.55rem]' : 'text-[0.6rem] xs:text-[0.65rem]'}`}>
              <Scissors className="w-3 h-3" weight="duotone" aria-hidden="true" />
              <span>Hold to adjust</span>
            </span>
          )}
          {canShuffleGesture && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface/60 border border-accent/20 text-muted ${isLandscape ? 'text-[0.55rem]' : 'text-[0.6rem] xs:text-[0.65rem]'}`}>
              <ArrowsClockwise className="w-3 h-3" weight="duotone" aria-hidden="true" />
              <span>2x tap shuffle</span>
            </span>
          )}
          {knockComplete && cardsRemaining > 0 && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/20 border border-primary/30 text-main ${isLandscape ? 'text-[0.55rem]' : 'text-[0.6rem] xs:text-[0.65rem]'}`}>
              <HandTap className="w-3 h-3" weight="fill" aria-hidden="true" />
              <span>Tap to draw</span>
            </span>
          )}
        </div>
      )}

      {/* Draw CTA - optimized for small screens */}
      {isDeckPrimary && cardsRemaining > 0 && (
        <div className={`text-center px-3 xs:px-4 ${isLandscape ? 'mt-3' : 'mt-4 xs:mt-5 sm:mt-6 hidden sm:block'}`}>
          <motion.button
            onClick={handleDealWithAnimation}
            disabled={isShuffling}
            className={`inline-flex items-center rounded-full bg-primary text-main font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-primary/90 min-h-[44px] ${isLandscape ? 'gap-2 px-4 py-2 text-sm' : 'gap-2 xs:gap-3 px-4 xs:px-5 sm:px-6 py-2 xs:py-2.5 sm:py-3 text-sm xs:text-base'}`}
            style={{ boxShadow: '0 10px 30px color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
            whileHover={prefersReducedMotion ? {} : { scale: 1.03 }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
          >
            <span>{isLandscape ? nextPosition || 'Next' : `Draw: ${nextPosition || 'Next Card'}`}</span>
            <span className={`opacity-70 ${isLandscape ? 'text-[0.65rem]' : 'text-[0.7rem] xs:text-xs'}`}>({cardsRemaining})</span>
          </motion.button>
        </div>
      )}

      {/* Position preview minimap */}
      {spreadPositions && spreadPositions.length > 1 && (
        <div className={`flex justify-center px-3 xs:px-4 ${isLandscape ? 'mt-3' : 'mt-4 xs:mt-5 sm:mt-6'}`}>
          <SpreadMinimap
            positions={spreadPositions}
            cards={cards}
            totalCards={totalCards}
            revealedIndices={revealedIndices}
          />
        </div>
      )}
    </div>
  );
}

// Minimap showing spread positions with current progress
// Now supports suit-colored indicators when cards are revealed
function SpreadMinimap({ positions, cards = [], totalCards, revealedIndices }) {
  const prefersReducedMotion = useReducedMotion();
  const revealedSet = revealedIndices instanceof Set ? revealedIndices : null;
  // Find the first unrevealed position (handles out-of-order reveals via ReadingBoard)
  // A position is revealed if it has a card in the cards array
  const nextIndex = (() => {
    if (revealedSet) {
      for (let i = 0; i < totalCards; i++) {
        if (!revealedSet.has(i)) return i;
      }
      return -1;
    }
    for (let i = 0; i < totalCards; i++) {
      if (!cards[i]) return i;
    }
    return -1; // All cards revealed (fallback when set not provided)
  })();

  return (
    <div
      className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-full border"
      style={{
        background: `
          linear-gradient(145deg, rgba(24, 18, 33, 0.85), rgba(10, 8, 16, 0.9))
        `,
        borderColor: 'var(--border-warm-light)'
      }}
      role="list"
      aria-label="Spread position progress"
    >
      {positions.map((pos, i) => {
        // A position is revealed if it has a card (supports out-of-order reveals)
        const isRevealed = revealedSet ? revealedSet.has(i) : Boolean(cards[i]);
        const isNext = i === nextIndex;
        const card = cards?.[i] || null;
        const label = typeof pos === 'string' ? pos.split(' — ')[0] : `Position ${i + 1}`;
        
        // Get suit-specific colors for revealed cards
        const glowColor = isRevealed && card ? getSuitGlowColor(card, 0.5) : null;
        const borderColor = isRevealed && card ? getSuitBorderColor(card) : null;

        return (
          <motion.div
            key={i}
            className={`w-2.5 h-3.5 sm:w-3 sm:h-4 rounded-sm transition-all ${
              isRevealed
                ? ''
                : isNext
                ? 'bg-primary'
                : 'bg-surface-muted border border-accent/30'
            }`}
            style={isRevealed ? {
              backgroundColor: borderColor || 'var(--brand-secondary)',
              boxShadow: `0 0 8px ${glowColor || 'rgba(var(--brand-secondary), 0.3)'}`
            } : {}}
            animate={isNext && !prefersReducedMotion ? {
              scale: [1, 1.15, 1],
              opacity: [0.8, 1, 0.8]
            } : {}}
            transition={isNext && !prefersReducedMotion ? {
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut'
            } : {}}
            title={label}
            role="listitem"
            aria-label={`${label}: ${isRevealed ? `${card?.name || 'revealed'}` : isNext ? 'next to draw' : 'pending'}`}
          />
        );
      })}
    </div>
  );
}
