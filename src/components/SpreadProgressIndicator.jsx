import { useRef, useLayoutEffect, useMemo } from 'react';
import { animate, stagger } from 'animejs';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useHaptic } from '../hooks/useHaptic';
import { MICROCOPY } from '../lib/microcopy';

/**
 * SpreadProgressIndicator - Visual bead/dot progress showing revealed/total cards
 * Uses "Goal Gradient" effect to encourage completion.
 */
export function SpreadProgressIndicator({
  total,
  revealed,
  className = '',
  variant = 'dots'
}) {
  const prefersReducedMotion = useReducedMotion();
  const { vibrateType } = useHaptic();
  const containerRef = useRef(null);
  const prevRevealedRef = useRef(revealed);
  const animatedDotsRef = useRef(new Set());

  const isComplete = revealed >= total;

  // Animate newly revealed dots
  useLayoutEffect(() => {
    const prevRevealed = prevRevealedRef.current;
    const revealedDropped = revealed < prevRevealed || revealed === 0;
    if (revealedDropped) {
      animatedDotsRef.current = new Set();
    }
    prevRevealedRef.current = revealed;

    if (revealed <= prevRevealed || prefersReducedMotion) return;

    // Animate each newly revealed dot
    const container = containerRef.current;
    if (!container) return;

    for (let i = prevRevealed; i < revealed; i++) {
      const dot = container.querySelector(`[data-dot-index="${i}"]`);
      if (dot && !animatedDotsRef.current.has(i)) {
        animatedDotsRef.current.add(i);
        animate(dot, {
          scale: [1, 1.4, 1],
          duration: 300,
          ease: 'outBack'
        });
      }
    }

    // Completion haptic
    if (revealed === total) {
      vibrateType('completion');
    }
  }, [revealed, total, prefersReducedMotion, vibrateType]);

  // Reset animation tracking when total changes
  useLayoutEffect(() => {
    animatedDotsRef.current = new Set();
  }, [total]);

  const dots = useMemo(() => {
    return Array.from({ length: total }, (_, i) => ({
      index: i,
      filled: i < revealed
    }));
  }, [total, revealed]);

  if (total <= 1) return null;

  return (
    <div
      ref={containerRef}
      className={`flex items-center justify-center gap-1.5 ${className}`}
      role="progressbar"
      aria-valuenow={revealed}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={MICROCOPY.progressLabel(revealed, total)}
    >
      {variant === 'dots' ? (
        <>
          {dots.map(({ index, filled }) => (
            <div
              key={index}
              data-dot-index={index}
              className={`
                w-2.5 h-2.5 rounded-full transition-all duration-200
                ${filled
                  ? 'bg-secondary shadow-sm shadow-secondary/40'
                  : 'bg-surface-muted/60 border border-secondary/30'
                }
                ${index === revealed - 1 && !prefersReducedMotion
                  ? 'ring-2 ring-secondary/40 ring-offset-1 ring-offset-main'
                  : ''
                }
              `}
              aria-hidden="true"
            />
          ))}
        </>
      ) : (
        <div className="relative w-24 h-1.5 rounded-full bg-surface-muted/40 overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
              isComplete ? 'bg-secondary' : 'bg-primary/80'
            }`}
            style={{ width: `${(revealed / total) * 100}%` }}
          />
        </div>
      )}

      {/* Text label for screen readers and visual context */}
      <span className="ml-2 text-[0.65rem] text-muted/80 font-medium">
        {revealed}/{total}
      </span>
    </div>
  );
}

/**
 * SpreadProgressBeads - Alternative circular bead layout for larger spreads
 */
export function SpreadProgressBeads({
  total,
  revealed,
  positions = [],
  className = ''
}) {
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef(null);
  const prevRevealedRef = useRef(revealed);

  useLayoutEffect(() => {
    const prevRevealed = prevRevealedRef.current;
    prevRevealedRef.current = revealed;

    if (revealed <= prevRevealed || prefersReducedMotion) return;

    const container = containerRef.current;
    if (!container) return;

    // Stagger animation for newly revealed beads
    const newBeads = [];
    for (let i = prevRevealed; i < revealed; i++) {
      const bead = container.querySelector(`[data-bead-index="${i}"]`);
      if (bead) newBeads.push(bead);
    }

    if (newBeads.length > 0) {
      animate(newBeads, {
        scale: [1, 1.3, 1],
        duration: 350,
        delay: stagger(60),
        ease: 'outBack'
      });
    }
  }, [revealed, prefersReducedMotion]);

  if (total <= 1) return null;

  return (
    <div
      ref={containerRef}
      className={`flex flex-wrap items-center justify-center gap-2 ${className}`}
      role="progressbar"
      aria-valuenow={revealed}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={MICROCOPY.progressLabel(revealed, total)}
    >
      {Array.from({ length: total }, (_, i) => {
        const filled = i < revealed;
        const positionLabel = positions[i] || `${i + 1}`;

        return (
          <div
            key={i}
            data-bead-index={i}
            className={`
              relative group flex items-center justify-center
              w-6 h-6 rounded-full text-[0.6rem] font-semibold
              transition-all duration-200
              ${filled
                ? 'bg-secondary/90 text-main border border-secondary/60'
                : 'bg-surface/60 text-muted border border-secondary/20'
              }
            `}
            title={typeof positionLabel === 'string' ? positionLabel : undefined}
          >
            {i + 1}
          </div>
        );
      })}
    </div>
  );
}
