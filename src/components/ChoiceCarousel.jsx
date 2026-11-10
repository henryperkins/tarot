import { CaretRight, Sparkle } from '@phosphor-icons/react';
import { FOCUS_RING_DEFAULT } from '../styles/focusClasses';

const ARROW_CLASS = `choice-carousel-arrow pointer-events-auto min-w-touch min-h-touch rounded-full bg-surface/80 border border-secondary/55 text-main hover:border-secondary/75 hover:bg-surface transition touch-manipulation flex items-center justify-center shadow-lg ${FOCUS_RING_DEFAULT}`;
const FADE_CLASS = 'absolute top-0 bottom-3 w-12 z-10 transition-opacity duration-200 sm:hidden pointer-events-none';
const fadeVisibility = shown => (shown ? 'opacity-100' : 'invisible opacity-0 focus-within:visible focus-within:opacity-100');

/**
 * Handset edge fades with Previous/Next buttons for a choice carousel
 * (useChoiceCarousel). Hidden from `sm` up, where the choices form a grid.
 * A button exists only while more choices sit past its edge.
 */
export function CarouselEdges({ showStart, showEnd, onStep, previousLabel, nextLabel }) {
  return (
    <>
      <div className={`${FADE_CLASS} left-0 rounded-l-2xl bg-linear-to-r from-(--panel-dark-1)/90 via-(--panel-dark-1)/60 to-transparent ${fadeVisibility(showStart)}`}>
        <button
          type="button"
          onClick={() => onStep(-1)}
          className={`${ARROW_CLASS} left-1`}
          aria-label={previousLabel}
          aria-disabled={!showStart}
          tabIndex={showStart ? 0 : -1}
        >
          <CaretRight className="w-5 h-5 rotate-180" weight="bold" aria-hidden="true" />
        </button>
      </div>
      <div className={`${FADE_CLASS} right-0 rounded-r-2xl bg-linear-to-l from-(--panel-dark-1)/90 via-(--panel-dark-1)/60 to-transparent ${fadeVisibility(showEnd)}`}>
        <button
          type="button"
          onClick={() => onStep(1)}
          className={`${ARROW_CLASS} right-1`}
          aria-label={nextLabel}
          aria-disabled={!showEnd}
          tabIndex={showEnd ? 0 : -1}
        >
          <CaretRight className="w-5 h-5" weight="bold" aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

/**
 * The "Selected" badge on a chosen card: one mark, with the card's brighter
 * border and glow. aria-checked already announces the choice, so the badge is
 * for sight only. Its text reads plainly in every layout, including landscape
 * phones, where the corner holds nothing else.
 */
export function ChosenMarks() {
  return (
    <div
      className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        backgroundColor: 'var(--surface-92)',
        color: 'var(--text-accent)',
        border: '1px solid var(--border-warm-light)',
        boxShadow: '0 12px 28px -20px rgba(0,0,0,0.7)'
      }}
      aria-hidden="true"
    >
      <Sparkle className="h-3.5 w-3.5" weight="fill" />
      <span>Selected</span>
    </div>
  );
}
