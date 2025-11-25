import { useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { SPREADS } from '../data/spreads';
import { getCardImage, FALLBACK_IMAGE } from '../lib/cardLookup';

/**
 * Spread layout definitions (x, y as percentage of container)
 * Each position includes coordinates and optional rotation
 */
const SPREAD_LAYOUTS = {
  single: [
    { x: 50, y: 50, scale: 1.2 }
  ],
  threeCard: [
    { x: 20, y: 50, label: 'Past' },
    { x: 50, y: 50, label: 'Present' },
    { x: 80, y: 50, label: 'Future' }
  ],
  fiveCard: [
    { x: 50, y: 20, label: 'Core' },
    { x: 20, y: 50, label: 'Challenge' },
    { x: 50, y: 50, label: 'Hidden' },
    { x: 80, y: 50, label: 'Support' },
    { x: 50, y: 80, label: 'Direction' }
  ],
  decision: [
    { x: 50, y: 20, label: 'Heart' },
    { x: 25, y: 50, label: 'Path A' },
    { x: 75, y: 50, label: 'Path B' },
    { x: 50, y: 70, label: 'Clarity' },
    { x: 50, y: 90, label: 'Free Will' }
  ],
  relationship: [
    { x: 30, y: 50, label: 'You' },
    { x: 70, y: 50, label: 'Them' },
    { x: 50, y: 75, label: 'Connection' }
  ],
  celtic: [
    { x: 35, y: 50, label: 'Present' },
    { x: 35, y: 50, label: 'Challenge', rotate: 90, offsetX: 3 },
    { x: 15, y: 50, label: 'Past' },
    { x: 55, y: 50, label: 'Future' },
    { x: 35, y: 20, label: 'Above' },
    { x: 35, y: 80, label: 'Below' },
    { x: 80, y: 80, label: 'Self' },
    { x: 80, y: 60, label: 'Environment' },
    { x: 80, y: 40, label: 'Hopes/Fears' },
    { x: 80, y: 20, label: 'Outcome' }
  ]
};

/**
 * SpreadTable - Visual spread layout showing where cards will land
 * Displays placeholders for undealt positions and mini cards for dealt positions
 */
export function SpreadTable({
  spreadKey,
  cards = [],
  revealedIndices = new Set(),
  onCardClick,
  onCardReveal,
  nextDealIndex = 0,
  compact = false
}) {
  const prefersReducedMotion = useReducedMotion();
  const layout = SPREAD_LAYOUTS[spreadKey] || SPREAD_LAYOUTS.single;
  const spreadInfo = SPREADS[spreadKey];

  // Get position labels from spread definition or layout
  const getPositionLabel = useMemo(() => {
    return (index) => {
      if (spreadInfo?.positions?.[index]) {
        // Extract short label from full position text
        const fullPosition = spreadInfo.positions[index];
        const shortLabel = fullPosition.split(' — ')[0].split(' (')[0];
        return shortLabel;
      }
      return layout[index]?.label || `Card ${index + 1}`;
    };
  }, [spreadInfo, layout]);

  // Aspect ratio based on spread type
  const aspectRatio = spreadKey === 'celtic' ? '4/3' : '3/2';

  return (
    <div
      className={`spread-table relative w-full rounded-2xl sm:rounded-3xl border border-accent/20 overflow-hidden ${
        compact ? 'p-3' : 'p-4 sm:p-6'
      }`}
      style={{
        aspectRatio,
        background: 'linear-gradient(145deg, var(--bg-surface), var(--bg-surface-muted))',
        boxShadow: 'inset 0 0 60px color-mix(in srgb, var(--brand-accent) 6%, transparent)'
      }}
      role="region"
      aria-label={`${spreadInfo?.name || 'Spread'} layout`}
    >
      {/* Table surface texture */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, var(--brand-accent) 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }}
        aria-hidden="true"
      />

      {/* Position placeholders */}
      {layout.map((pos, i) => {
        const card = cards?.[i];
        const isRevealed = revealedIndices?.has?.(i) || false;
        const isNext = i === nextDealIndex && !card;
        const positionLabel = getPositionLabel(i);
        const cardImage = card ? getCardImage(card) : null;

        return (
          <motion.div
            key={i}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              zIndex: isRevealed ? 10 : card ? 5 : 1,
              marginLeft: pos.offsetX ? `${pos.offsetX}%` : 0
            }}
            initial={false}
            animate={isNext && !prefersReducedMotion ? { scale: [1, 1.05, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            {!card ? (
              // Empty placeholder
              <div
                className={`
                  ${compact ? 'w-10 h-14 sm:w-12 sm:h-16' : 'w-12 h-16 sm:w-16 sm:h-22 md:w-20 md:h-28'}
                  rounded-lg border-2 border-dashed
                  flex items-center justify-center
                  transition-all
                  ${isNext
                    ? 'border-primary/60 bg-primary/10'
                    : 'border-accent/30 bg-surface/30'
                  }
                `}
                style={isNext && !prefersReducedMotion ? {
                  animation: 'placeholderPulse 1.5s ease-in-out infinite'
                } : {}}
                role="img"
                aria-label={`${positionLabel}: waiting for card`}
              >
                <span className={`${compact ? 'text-[0.5rem]' : 'text-[0.55rem] sm:text-xs'} text-muted text-center px-1 leading-tight`}>
                  {positionLabel}
                </span>
              </div>
            ) : (
              // Card in position (mini representation)
              <AnimatePresence mode="wait">
                <motion.button
                  key={card.name}
                  initial={prefersReducedMotion ? { opacity: 1 } : { scale: 0, rotate: -180 }}
                  animate={{ scale: pos.scale || 1, rotate: pos.rotate || 0, opacity: 1 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { scale: 0, rotate: 180 }}
                  transition={prefersReducedMotion ? { duration: 0.1 } : { type: 'spring', stiffness: 300, damping: 20 }}
                  className={`
                    ${compact ? 'w-10 h-14 sm:w-12 sm:h-16' : 'w-12 h-16 sm:w-16 sm:h-22 md:w-20 md:h-28'}
                    rounded-lg border-2 cursor-pointer overflow-hidden
                    transition-all touch-manipulation
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-main
                    ${isRevealed
                      ? 'border-secondary/60 shadow-lg'
                      : 'border-primary/40 hover:border-primary/60'
                    }
                  `}
                  style={isRevealed ? {
                    boxShadow: '0 4px 12px color-mix(in srgb, var(--brand-secondary) 20%, transparent)'
                  } : {}}
                  onClick={() => isRevealed ? onCardClick?.(card, positionLabel, i) : onCardReveal?.(i)}
                  aria-label={isRevealed
                    ? `${card.name} in ${positionLabel} position. Click to view details.`
                    : `Card in ${positionLabel} position. Click to reveal.`
                  }
                >
                  {isRevealed ? (
                    <div className={`w-full h-full bg-surface flex items-center justify-center relative ${card.isReversed ? 'rotate-180' : ''}`}>
                      <img
                        src={cardImage}
                        alt={card.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = FALLBACK_IMAGE;
                        }}
                      />
                      {/* Mini label overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-0.5 sm:p-1">
                        <span className={`${compact ? 'text-[0.4rem]' : 'text-[0.45rem] sm:text-[0.55rem]'} text-white font-semibold leading-tight block truncate`}>
                          {card.name.replace(/^The /, '')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-surface-muted flex items-center justify-center">
                      <span className={`${compact ? 'text-[0.45rem]' : 'text-[0.5rem] sm:text-xs'} text-muted`}>Tap</span>
                    </div>
                  )}
                </motion.button>
              </AnimatePresence>
            )}
          </motion.div>
        );
      })}

      {/* Spread name indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
        <span className={`${compact ? 'text-[0.55rem] px-2 py-0.5' : 'text-xs px-3 py-1'} text-muted/70 bg-surface/60 rounded-full border border-accent/10`}>
          {spreadInfo?.tag || spreadKey}
        </span>
      </div>
    </div>
  );
}

/**
 * Compact horizontal spread preview for mobile
 */
export function SpreadTableCompact({ spreadKey, cards = [], revealedIndices = new Set(), onCardClick: _onCardClick }) {
  const layout = SPREAD_LAYOUTS[spreadKey] || SPREAD_LAYOUTS.single;
  const spreadInfo = SPREADS[spreadKey];

  return (
    <div
      className="flex items-center justify-center gap-1.5 py-3 px-4 bg-surface/40 rounded-xl border border-accent/15"
      role="region"
      aria-label={`${spreadInfo?.name || 'Spread'} progress`}
    >
      {layout.map((pos, i) => {
        const card = cards?.[i];
        const isRevealed = revealedIndices?.has?.(i) || false;

        return (
          <div
            key={i}
            className={`
              w-6 h-9 rounded border
              flex items-center justify-center
              transition-all
              ${card
                ? isRevealed
                  ? 'border-secondary/50 bg-secondary/20'
                  : 'border-primary/40 bg-primary/10'
                : 'border-accent/20 bg-surface/50'
              }
            `}
            title={pos.label || `Position ${i + 1}`}
          >
            {card && isRevealed ? (
              <span className="text-[0.4rem] text-secondary font-bold">
                {card.name.charAt(0)}
              </span>
            ) : card ? (
              <span className="text-[0.4rem] text-primary">?</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
