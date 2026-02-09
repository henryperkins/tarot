import { useRef, useLayoutEffect } from 'react';
import { Eye } from '@phosphor-icons/react';
import { animate, createScope, set } from 'animejs';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { MICROCOPY } from '../lib/microcopy';

/**
 * TactileLensButton - Press-and-hold button to reveal position meanings
 * Placed in the bottom-left corner, opposite the deck.
 * 
 * NOTE: State is managed externally via useTactileLens hook in parent component
 * to ensure the overlay and button share the same state instance.
 */
export function TactileLensButton({
  disabled = false,
  className = '',
  isActive = false,
  showTutorial = false,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onDismissTutorial
}) {
  const buttonRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  // Tutorial pulse animation — scope-managed for automatic cleanup
  useLayoutEffect(() => {
    const node = buttonRef.current;
    if (!node || !showTutorial || prefersReducedMotion) return undefined;

    const scope = createScope({ root: node }).add(() => {
      animate(node, {
        scale: [1, 1.15, 1],
        duration: 800,
        loop: true,
        ease: 'inOutQuad'
      });
    });

    return () => scope.revert();
  }, [showTutorial, prefersReducedMotion]);

  // Reset scale when tutorial dismissed
  useLayoutEffect(() => {
    const node = buttonRef.current;
    if (!node || showTutorial) return;
    set(node, { scale: 1 });
  }, [showTutorial]);

  return (
    <div className={`relative ${className}`}>
      {/* Tutorial tooltip */}
      {showTutorial && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-full bg-main/90 border border-primary/30 text-xs text-main font-medium whitespace-nowrap shadow-lg animate-fade-in"
          role="tooltip"
          onClick={onDismissTutorial}
        >
          {MICROCOPY.holdToViewMeanings}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-main/90" />
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        disabled={disabled}
        className={`
          relative flex items-center justify-center
          w-12 h-12 rounded-full
          border-2 transition-all touch-manipulation
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isActive
            ? 'bg-primary/30 border-primary/70 text-primary shadow-lg shadow-primary/30'
            : showTutorial
              ? 'bg-primary/20 border-primary/50 text-primary'
              : 'bg-surface/80 border-secondary/40 text-muted hover:border-primary/40 hover:text-accent'
          }
        `}
        aria-label={MICROCOPY.positionMeanings}
        aria-pressed={isActive}
      >
        <Eye
          className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`}
          weight={isActive ? 'fill' : 'regular'}
        />
      </button>
    </div>
  );
}

/**
 * TactileLensOverlay - Overlay showing position meanings when lens is active
 * Renders as a transparent layer over the spread with position labels.
 */
export function TactileLensOverlay({
  isActive,
  positions = [],
  spreadLayout = [],
  prefersReducedMotion = false
}) {
  const overlayRef = useRef(null);

  // Enter animation only — the overlay unmounts when !isActive (line below),
  // so exit animations would target a detached node and never play.
  useLayoutEffect(() => {
    const node = overlayRef.current;
    if (!node) return undefined;

    if (prefersReducedMotion) {
      set(node, { opacity: 1 });
      return undefined;
    }

    set(node, { opacity: 0 });
    const anim = animate(node, {
      opacity: [0, 1],
      duration: 150,
      ease: 'outQuad'
    });
    return () => anim?.pause?.();
  }, [isActive, prefersReducedMotion]);

  // Don't render when inactive - removes from a11y tree entirely
  if (!isActive) return null;

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none z-30"
      role="region"
      aria-label={MICROCOPY.positionMeanings}
      aria-live="polite"
    >
      {/* Semi-transparent backdrop to dim cards */}
      <div className="absolute inset-0 bg-main/60 backdrop-blur-[2px]" />

      {/* Position labels */}
      {spreadLayout.map((pos, i) => {
        const positionText = positions[i] || `Position ${i + 1}`;
        return (
          <div
            key={i}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              marginLeft: pos.offsetX ? `${pos.offsetX}%` : 0
            }}
          >
            <div className="px-3 py-2 rounded-lg bg-surface/95 border border-primary/40 shadow-lg">
              <div className="text-2xs text-primary font-bold mb-0.5">
                {i + 1}
              </div>
              <div className="text-xs text-main font-semibold leading-tight max-w-[100px] text-center">
                {positionText}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
