import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { TableuLogo } from './TableuLogo';
import { Sparkle, Scissors, ArrowsClockwise, HandTap } from '@phosphor-icons/react';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useLandscape } from '../hooks/useLandscape';

const CARD_STACK_COUNT = 7; // Visual stack layers

// Haptic feedback helper
const vibrate = (pattern) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

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

  // Deal state
  isShuffling = false,
  onShuffle,
  cardsRemaining,
  nextPosition,
  spreadPositions = [],
  revealedCount = 0,
  totalCards = 0,

  // Deal action
  onDeal
}) {
  const isSmallScreen = useSmallScreen();
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();
  const deckControls = useAnimation();
  const [showCutSlider, setShowCutSlider] = useState(false);
  const [localCutIndex, setLocalCutIndex] = useState(cutIndex);
  const deckRef = useRef(null);
  const knockComplete = knockCount >= 3;

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

  // Knock gesture handler - now directly on deck
  const handleDeckTap = useCallback(() => {
    if (showCutSlider) return;

    // Check if it's a quick tap (vs drag start)
    if (knockCount < 3) {
      onKnock?.();
      vibrate([15, 30, 15]);

      // Visual pulse on knock
      if (!prefersReducedMotion) {
        deckControls.start({
          scale: [1, 0.96, 1.02, 1],
          transition: { duration: 0.25 }
        });
      }
    }
  }, [knockCount, onKnock, showCutSlider, prefersReducedMotion, deckControls]);

  // Double-tap to shuffle
  const lastTapRef = useRef(0);
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap detected
      onShuffle?.();
      vibrate([20, 50, 20, 50, 20]);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, [onShuffle]);

  // Long-press to reveal cut slider
  const longPressTimerRef = useRef(null);
  const handleTouchStart = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      setShowCutSlider(true);
      vibrate([30]);
    }, 400);
  }, []);

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

  // Deal animation - card flies from deck
  const handleDealWithAnimation = useCallback(() => {
    if (cardsRemaining <= 0 || isShuffling) return;
    vibrate(10);
    onDeal?.();
  }, [cardsRemaining, isShuffling, onDeal]);

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
  }, [onCutConfirm]);

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
      <div className="relative flex justify-center" style={{ perspective: '1200px' }}>
        <motion.div
          ref={deckRef}
          animate={deckControls}
          className="deck-stack relative cursor-pointer touch-manipulation"
          onClick={handleDeckTap}
          onDoubleClick={handleDoubleTap}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseUp={handleTouchEnd}
          role="button"
          aria-label={
            cardsRemaining > 0
              ? `Draw card for ${nextPosition || 'next position'}. Tap to knock (${knockCount}/3), double-tap to shuffle, long-press to cut.`
              : 'All cards dealt'
          }
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (e.shiftKey) {
                onShuffle?.();
              } else {
                handleDealWithAnimation();
              }
            }
            // 'k' to knock
            if (e.key === 'k' || e.key === 'K') {
              e.preventDefault();
              handleDeckTap();
            }
            // 'c' to toggle cut slider
            if (e.key === 'c' || e.key === 'C') {
              e.preventDefault();
              setShowCutSlider(prev => !prev);
            }
          }}
          style={{ transformStyle: 'preserve-3d' }}
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
            whileHover={prefersReducedMotion ? {} : { y: -4, rotateX: 5 }}
            whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
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
                  transition={{ duration: prefersReducedMotion ? 0.1 : 0.4 }}
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

      {/* Ritual action buttons - explicit alternatives to gestures for accessibility */}
      <div className={`flex flex-wrap items-center justify-center px-3 xs:px-4 ${isLandscape ? 'mt-3 gap-1.5' : 'mt-4 xs:mt-5 sm:mt-6 gap-1.5 xs:gap-2 sm:gap-3'}`}>
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
          aria-label={hasCut ? `Deck cut at position ${cutIndex}` : showCutSlider ? 'Close cut slider' : 'Cut the deck'}
          aria-expanded={showCutSlider}
        >
          <Scissors className={isLandscape ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5 xs:w-4 xs:h-4'} aria-hidden="true" />
          <span>{hasCut ? `#${cutIndex}` : (isLandscape ? 'Cut' : (showCutSlider ? 'Cutting...' : 'Cut Deck'))}</span>
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

      {/* Gesture hints (supplementary info for touch users) - hidden in landscape and on very small screens */}
      {!isLandscape && (
        <p className="hidden xs:block mt-2 xs:mt-3 text-center text-[0.65rem] xs:text-[0.7rem] text-muted/70 px-4">
          <span className="hidden sm:inline">Gestures: </span>
          Tap deck to knock · Hold to cut · Double-tap to shuffle
        </p>
      )}

      {/* Draw CTA - optimized for small screens */}
      {cardsRemaining > 0 && (
        <div className={`text-center px-3 xs:px-4 ${isLandscape ? 'mt-3' : 'mt-4 xs:mt-5 sm:mt-6'}`}>
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
            revealedCount={revealedCount}
            nextIndex={totalCards - cardsRemaining}
          />
        </div>
      )}
    </div>
  );
}

// Minimap showing spread positions with current progress
function SpreadMinimap({ positions, revealedCount, nextIndex }) {
  return (
    <div
      className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-full bg-surface/60 border border-accent/20"
      role="list"
      aria-label="Spread position progress"
    >
      {positions.map((pos, i) => {
        const isRevealed = i < revealedCount;
        const isNext = i === nextIndex;
        const label = typeof pos === 'string' ? pos.split(' — ')[0] : `Position ${i + 1}`;

        return (
          <div
            key={i}
            className={`w-2.5 h-3.5 sm:w-3 sm:h-4 rounded-sm transition-all ${
              isRevealed
                ? 'bg-secondary shadow-sm'
                : isNext
                ? 'bg-primary animate-pulse'
                : 'bg-surface-muted border border-accent/30'
            }`}
            style={isRevealed ? { boxShadow: '0 0 6px color-mix(in srgb, var(--brand-secondary) 30%, transparent)' } : {}}
            title={label}
            role="listitem"
            aria-label={`${label}: ${isRevealed ? 'revealed' : isNext ? 'next to draw' : 'pending'}`}
          />
        );
      })}
    </div>
  );
}
