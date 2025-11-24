import { useRef } from 'react';

/**
 * CarouselDots - Reusable pagination indicator for horizontal carousels
 *
 * Features:
 * - WCAG 2.5.8 compliant touch targets (44x44px minimum)
 * - Full keyboard navigation (arrows, Home, End, Enter, Space)
 * - Screen reader accessible with proper ARIA
 * - Customizable appearance via variant prop
 *
 * @param {number} activeIndex - Currently active/visible item index
 * @param {number} totalItems - Total number of items in carousel
 * @param {function} onSelectItem - Callback when user selects a position
 * @param {string} variant - Visual style: 'default' | 'compact' | 'labeled'
 * @param {string[]} labels - Optional labels for each position (for screen readers)
 * @param {string} ariaLabel - Label for the overall control group
 */
export function CarouselDots({
  activeIndex,
  totalItems,
  onSelectItem,
  variant = 'default',
  labels = [],
  ariaLabel = 'Carousel position'
}) {
  const dotRefs = useRef([]);

  const focusDot = (index) => {
    const el = dotRefs.current[index];
    if (el && typeof el.focus === 'function') {
      el.focus();
    }
  };

  const goToIndex = (index) => {
    if (totalItems <= 0) return;
    const clamped = Math.min(totalItems - 1, Math.max(0, index));
    onSelectItem?.(clamped);
    // Schedule focus after state update
    const focusNext = () => focusDot(clamped);
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(focusNext);
    } else {
      focusNext();
    }
  };

  const handleKeyDown = (event, idx) => {
    if (totalItems <= 0) return;

    // Handle activation with Enter or Space
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      goToIndex(idx);
      return;
    }

    let nextIndex = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      nextIndex = (idx + 1) % totalItems;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      nextIndex = (idx - 1 + totalItems) % totalItems;
    } else if (event.key === 'Home') {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      nextIndex = totalItems - 1;
    }

    if (nextIndex !== null) {
      goToIndex(nextIndex);
    }
  };

  if (totalItems <= 1) return null;

  // Variant-specific styles
  const variantStyles = {
    default: {
      container: 'flex items-center justify-center gap-1',
      // 44px touch target with smaller visual dot inside
      button: 'relative flex items-center justify-center w-11 h-11 touch-manipulation',
      dotBase: 'w-2 h-2 rounded-full transition-all duration-200',
      dotActive: 'bg-primary w-4 shadow-md shadow-primary/40',
      dotInactive: 'bg-secondary/50 hover:bg-secondary/70'
    },
    compact: {
      container: 'flex items-center justify-center gap-0.5',
      button: 'relative flex items-center justify-center w-8 h-8 touch-manipulation',
      dotBase: 'w-1.5 h-1.5 rounded-full transition-all duration-200',
      dotActive: 'bg-primary w-3 shadow-sm shadow-primary/30',
      dotInactive: 'bg-secondary/40 hover:bg-secondary/60'
    },
    labeled: {
      container: 'flex items-center justify-center gap-2',
      button: 'relative flex items-center justify-center min-w-[44px] h-11 px-2 touch-manipulation',
      dotBase: 'text-xs font-medium transition-all duration-200 rounded-full px-2 py-1',
      dotActive: 'bg-primary/20 text-primary border border-primary/50',
      dotInactive: 'bg-secondary/10 text-muted border border-secondary/30 hover:bg-secondary/20'
    }
  };

  const styles = variantStyles[variant] || variantStyles.default;

  return (
    <div
      className={styles.container}
      role="tablist"
      aria-label={ariaLabel}
    >
      {Array.from({ length: totalItems }).map((_, idx) => {
        const isActive = idx === activeIndex;
        const label = labels[idx] || `Item ${idx + 1}`;

        return (
          <button
            key={idx}
            ref={el => { dotRefs.current[idx] = el; }}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`${label}${isActive ? ' (current)' : ''}`}
            className={`${styles.button} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-main rounded-full`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => goToIndex(idx)}
            onKeyDown={(event) => handleKeyDown(event, idx)}
          >
            {variant === 'labeled' ? (
              <span className={`${styles.dotBase} ${isActive ? styles.dotActive : styles.dotInactive}`}>
                {idx + 1}
              </span>
            ) : (
              <span
                className={`${styles.dotBase} ${isActive ? styles.dotActive : styles.dotInactive}`}
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * CarouselNav - Navigation buttons + dots for mobile carousels
 * Combines prev/next buttons with position indicators
 */
export function CarouselNav({
  activeIndex,
  totalItems,
  onSelectItem,
  labels = [],
  showButtons = true,
  ariaLabel = 'Carousel navigation'
}) {
  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < totalItems - 1;
  const currentLabel = labels[activeIndex] || `${activeIndex + 1} of ${totalItems}`;

  return (
    <div className="space-y-3">
      <CarouselDots
        activeIndex={activeIndex}
        totalItems={totalItems}
        onSelectItem={onSelectItem}
        labels={labels}
        ariaLabel={ariaLabel}
      />

      {showButtons && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onSelectItem?.(activeIndex - 1)}
            disabled={!canGoPrev}
            className="inline-flex items-center justify-center rounded-full border border-secondary/50 bg-surface px-3 py-2 min-w-[48px] min-h-[44px] text-xs font-semibold text-muted disabled:opacity-40 touch-manipulation"
            aria-label="Previous item"
          >
            Prev
          </button>
          <p className="text-xs text-muted" aria-live="polite">
            {currentLabel}
          </p>
          <button
            type="button"
            onClick={() => onSelectItem?.(activeIndex + 1)}
            disabled={!canGoNext}
            className="inline-flex items-center justify-center rounded-full border border-secondary/50 bg-surface px-3 py-2 min-w-[48px] min-h-[44px] text-xs font-semibold text-muted disabled:opacity-40 touch-manipulation"
            aria-label="Next item"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
