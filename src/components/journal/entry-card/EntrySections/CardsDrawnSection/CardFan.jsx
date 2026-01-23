import { memo, useState, useCallback, useRef, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';
import { getSuitAccentVar, cn } from '../../EntryCard.primitives';
import { CardThumbnail } from './CardThumbnail';
import {
  EXPANDED_THUMB_SIZE,
  EAGER_LOAD_COUNT,
  getArcPosition,
  getCardStackOffset,
  getOrientationState,
  getCardAriaLabel
} from './useCardFan';

export const CardFan = memo(function CardFan({
  cards,
  cardsId,
  activeIndex,
  onCardKeyDown,
  onCardSelect,
  setCardRef,
  fanRef,
  reduceMotion
}) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Measure container width for responsive arc
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      setContainerWidth(container.offsetWidth);
    };

    // Measure immediately
    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Get stack position for animation origin
  const getStackMotion = useCallback((index) => {
    const stackCount = Math.min(cards.length, 5);
    const stackIndex = Math.min(index, stackCount - 1);
    return getCardStackOffset(stackIndex, stackCount);
  }, [cards.length]);

  // Animation variants
  const containerVariants = {
    show: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.04,
        delayChildren: reduceMotion ? 0 : 0.05
      }
    },
    hidden: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.03,
        staggerDirection: -1
      }
    }
  };

  const cardVariants = {
    show: ({ arcPos }) => ({
      opacity: 1,
      x: arcPos.x,
      y: -arcPos.y, // Negative because cards rise at edges
      rotate: arcPos.rotation,
      scale: arcPos.scale,
      transition: reduceMotion
        ? { duration: 0 }
        : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
    }),
    hidden: ({ stackMotion }) => ({
      opacity: 0,
      x: stackMotion.x,
      y: stackMotion.y,
      rotate: stackMotion.rotation,
      scale: 0.96,
      transition: reduceMotion
        ? { duration: 0 }
        : { duration: 0.28, ease: 'easeOut' }
    })
  };

  const renderCard = (card, index) => {
    const { isReversed, label } = getOrientationState(card);
    const suitColor = getSuitAccentVar(card?.name) || 'var(--brand-primary)';
    const cardLabel = getCardAriaLabel(card, label);
    const tabIndex = cards.length === 1 ? 0 : (index === activeIndex ? 0 : -1);
    const isActive = index === activeIndex;
    const arcPos = getArcPosition(index, cards.length, containerWidth);

    return (
      <motion.div
        key={`${card?.name || 'card'}-${index}`}
        variants={cardVariants}
        custom={{ arcPos, stackMotion: getStackMotion(index) }}
        className="absolute left-1/2 bottom-0 hover:!z-50 focus-within:!z-50"
        style={{
          zIndex: isActive ? arcPos.zIndex + 20 : arcPos.zIndex,
          transformOrigin: 'center bottom'
        }}
        whileHover={reduceMotion ? undefined : {
          y: -arcPos.y - 8,
          scale: arcPos.scale * 1.08,
          transition: { duration: 0.2, ease: 'easeOut' }
        }}
        whileFocus={reduceMotion ? undefined : {
          y: -arcPos.y - 8,
          scale: arcPos.scale * 1.08,
          transition: { duration: 0.2, ease: 'easeOut' }
        }}
      >
        <button
          ref={setCardRef(index)}
          type="button"
          aria-label={cardLabel}
          className={cn(
            'group rounded-lg transition-shadow duration-300 ease-out',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-45)]',
            'hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)]',
            isActive && 'shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)]'
          )}
          style={{ transform: 'translateX(-50%)' }}
          tabIndex={tabIndex}
          onKeyDown={(event) => onCardKeyDown(event, index)}
          onClick={() => onCardSelect(index)}
        >
          <CardThumbnail
            card={card}
            size={EXPANDED_THUMB_SIZE}
            suitColor={suitColor}
            isReversed={isReversed}
            loading={index < EAGER_LOAD_COUNT ? 'eager' : 'lazy'}
            showPosition={false}
            showPositionOverlay
            isActive={isActive}
            nameMaxWidth={64}
          />
        </button>
      </motion.div>
    );
  };

  // Single card: centered, no arc
  if (cards.length === 1) {
    const singleCard = cards[0];
    const { isReversed, label } = getOrientationState(singleCard);
    const suitColor = getSuitAccentVar(singleCard?.name) || 'var(--brand-primary)';
    const cardLabel = getCardAriaLabel(singleCard, label);

    return (
      <motion.div
        layout
        transition={{ duration: reduceMotion ? 0 : 0.3, ease: 'easeOut' }}
        className="pt-2 pb-4"
      >
        <motion.div
          id={cardsId}
          ref={fanRef}
          className="flex justify-center"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={reduceMotion ? undefined : { duration: 0.25, ease: 'easeOut' }}
        >
          <button
            ref={setCardRef(0)}
            type="button"
            aria-label={cardLabel}
            className={cn(
              'group rounded-lg transition-shadow duration-300 ease-out',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-45)]',
              'hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)]'
            )}
            tabIndex={0}
            onKeyDown={(event) => onCardKeyDown(event, 0)}
            onClick={() => onCardSelect(0)}
          >
            <CardThumbnail
              card={singleCard}
              size={EXPANDED_THUMB_SIZE}
              suitColor={suitColor}
              isReversed={isReversed}
              loading="eager"
              showPosition={false}
              showPositionOverlay
              isActive={activeIndex === 0}
              nameMaxWidth={64}
            />
          </button>
        </motion.div>
      </motion.div>
    );
  }

  // Calculate container height based on card size + arc rise (more height for larger spreads)
  const arcRise = cards.length > 7 ? 32 : 24;
  const containerHeight = EXPANDED_THUMB_SIZE.height + arcRise + 10;

  return (
    <motion.div
      layout
      transition={{ duration: reduceMotion ? 0 : 0.3, ease: 'easeOut' }}
      className="pt-2 pb-4"
    >
      <div
        ref={containerRef}
        className="relative w-full"
        style={{ height: containerHeight }}
      >
        <motion.div
          id={cardsId}
          ref={fanRef}
          className="absolute inset-0"
          variants={containerVariants}
          initial={reduceMotion ? false : 'hidden'}
          animate="show"
          exit={reduceMotion ? undefined : 'hidden'}
        >
          {cards.map((card, index) => renderCard(card, index))}
        </motion.div>
      </div>
    </motion.div>
  );
});
