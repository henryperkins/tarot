import { useModalA11y } from '../hooks/useModalA11y';
import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Info, X, Flame, Drop, Wind, Leaf } from '@phosphor-icons/react';
import { buildCardInsights } from '../lib/cardInsights';
import { titleCase } from '../lib/textUtils';
import { getElementForSymbolFamily } from '../lib/symbolElementBridge';
import { getSymbolFamily } from '../../shared/symbols/symbolIndex';

// Element icons and colors for badges
const ELEMENT_BADGE_CONFIG = {
  Fire: {
    icon: Flame,
    className: 'bg-[color-mix(in_srgb,var(--color-wands)_16%,transparent)] text-main border border-[color-mix(in_srgb,var(--color-wands)_32%,transparent)]'
  },
  Water: {
    icon: Drop,
    className: 'bg-[color-mix(in_srgb,var(--color-cups)_16%,transparent)] text-main border border-[color-mix(in_srgb,var(--color-cups)_32%,transparent)]'
  },
  Air: {
    icon: Wind,
    className: 'bg-[color-mix(in_srgb,var(--color-swords)_16%,transparent)] text-main border border-[color-mix(in_srgb,var(--color-swords)_32%,transparent)]'
  },
  Earth: {
    icon: Leaf,
    className: 'bg-[color-mix(in_srgb,var(--color-pentacles)_16%,transparent)] text-main border border-[color-mix(in_srgb,var(--color-pentacles)_32%,transparent)]'
  }
};

function mergeClassNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

/**
 * Hook to detect if viewport is mobile-sized with debounced resize handling
 */
function useIsMobile(breakpoint = 640, debounceMs = 100) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    let timeoutId = null;

    function checkMobile() {
      setIsMobile(window.innerWidth < breakpoint || window.matchMedia('(hover: none), (pointer: coarse)').matches);
    }

    function handleResize() {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(checkMobile, debounceMs);
    }

    // Initial check
    checkMobile();

    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [breakpoint, debounceMs]);

  return isMobile;
}

/**
 * Symbol content display - shared between tooltip and bottom sheet
 */
function SymbolContent({ insights, onClose, showCloseButton = false, inline = false }) {
  const orientationLabel = insights.isReversed ? 'Reversed' : 'Upright';
  const keywordsPreview = insights.keywords.slice(0, 3).join(', ');

  return (
    <div className="text-left">
      {showCloseButton && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-base font-semibold text-main">
            {insights.name}
            <span className="ml-2 text-sm text-muted">
              {orientationLabel}
            </span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-touch min-w-touch -mr-2 flex items-center justify-center rounded-full text-secondary hover:bg-secondary/10 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-secondary/70"
            aria-label="Close symbol insights"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
      {!showCloseButton && !inline && (
        <p className="text-base font-semibold text-main">
          {insights.name}
          <span className="ml-2 text-sm text-muted">
            {orientationLabel}
          </span>
        </p>
      )}
      {keywordsPreview && !inline && (
        <p className="mt-1 text-base text-muted">
          <span className="font-medium">Keywords:</span> {keywordsPreview}
        </p>
      )}
      {insights.archetype && (
        <p className="mt-2 text-base text-muted">
          <span className="font-medium">Archetype:</span> {insights.archetype}
        </p>
      )}
      {insights.symbols.length > 0 && (
        <div className="mt-3">
          <h4 className="text-base font-semibold text-main">Symbols</h4>
          <ul className="mt-2 space-y-2 text-base text-main" role="list">
            {insights.symbols.map((symbol, index) => {
              const family = getSymbolFamily(symbol.object);
              const element = getElementForSymbolFamily(family);
              const badge = element ? ELEMENT_BADGE_CONFIG[element] : null;
              return (
                <li key={`${symbol.object}-${index}`} className="flex flex-col">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-main">{titleCase(symbol.object)}</span>
                    {symbol.position && !insights.isReversed && (
                      <span className="text-muted">({symbol.position})</span>
                    )}
                    {badge && (
                      <span
                        className={`ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-sm ${badge.className}`}
                        title={`${element} element`}
                      >
                        <badge.icon className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{element}</span>
                      </span>
                    )}
                  </span>
                  <span className="text-muted mt-0.5">{symbol.meaning}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {insights.colors.length > 0 && (
        <div className="mt-3">
          <h4 className="text-base font-semibold text-main">Palette</h4>
          <ul className="mt-2 space-y-1 text-base text-muted" role="list">
            {insights.colors.map((color, index) => (
              <li key={`${color.color}-${index}`}>
                <span className="font-semibold text-main">{color.color}</span>
                <span className="ml-1 text-muted">— {color.meaning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Mobile bottom sheet for symbol insights
 */
function BottomSheet({ isOpen, onClose, nested = false, children }) {
  const sheetRef = useRef(null);

  // A layer of the shared modal stack, so it owns Escape, Tab and Back while
  // open (each closes the sheet before a card dialog underneath) and returns
  // focus to its opener. Inside the card dialog, which already locks the page,
  // it takes no lock of its own: two locks released together froze the page.
  useModalA11y(isOpen, {
    onClose,
    containerRef: sheetRef,
    scrollLockStrategy: 'simple',
    lockScroll: !nested,
    backGuardId: 'symbolSheet'
  });

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  // The card dialog layer (z-toast) or above, so the modal stack ranks the
  // sheet on top of the card it opens from.
  const sheetMarkup = (
    <div className="fixed inset-0 z-toast flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-main/70 backdrop-blur-sm motion-safe:animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Card symbol insights"
        tabIndex={-1}
        className="relative z-10 w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-x border-secondary/30 bg-surface p-5 pb-[max(1.25rem,var(--safe-pad-bottom))] shadow-2xl motion-safe:animate-slide-up focus:outline-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mt-2">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(sheetMarkup, document.body);
}

/** Details embedded in an inspector share its focus, history and scroll owner. */
export function CardSymbolDetails({ card }) {
  const insights = useMemo(() => buildCardInsights(card, { includeAllSymbols: true }), [card]);
  return insights ? <SymbolContent insights={insights} inline /> : null;
}

export function CardSymbolInsights({
  card,
  position,
  triggerContent,
  triggerLabel = 'Card symbols',
  triggerAriaLabel,
  triggerClassName,
  triggerProps,
  triggerRef,
  openOnHover = true,
  // Opened from inside another dialog that already locks page scroll.
  nested = false
}) {
  const insights = useMemo(() => buildCardInsights(card), [card]);
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const shouldHover = openOnHover && !isMobile;

  // Generate unique IDs for accessibility
  const safePosition = typeof position === 'string'
    ? position.replace(/\s+/g, '-').toLowerCase()
    : 'slot';
  const safeName = card?.name ? card.name.replace(/\s+/g, '-').toLowerCase() : 'card';
  const tooltipId = `card-symbol-tooltip-${safeName}-${safePosition}`;

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const cancelCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  // Delayed close to allow moving between trigger and tooltip
  const handleOpen = useCallback(() => {
    cancelCloseTimeout();
    setIsOpen(true);
  }, [cancelCloseTimeout]);

  const handleClose = useCallback(() => {
    cancelCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      closeTimeoutRef.current = null;
    }, 150);
  }, [cancelCloseTimeout]);

  const handleToggle = useCallback((event) => {
    event.stopPropagation();
    setIsOpen(prev => !prev);
  }, []);

  const handleCloseImmediate = useCallback(() => {
    cancelCloseTimeout();
    setIsOpen(false);
  }, [cancelCloseTimeout]);

  const handleBlur = useCallback((event) => {
    const nextFocus = event.relatedTarget;
    if (nextFocus && containerRef.current?.contains(nextFocus)) {
      cancelCloseTimeout();
      return;
    }
    handleClose();
  }, [cancelCloseTimeout, handleClose]);

  const {
    className: triggerPropsClassName,
    onClick: triggerOnClick,
    onFocus: triggerOnFocus,
    onBlur: triggerOnBlur,
    onMouseEnter: triggerOnMouseEnter,
    onMouseLeave: triggerOnMouseLeave,
    ...restTriggerProps
  } = triggerProps || {};

  const baseTriggerClassName = triggerContent
    ? ''
    : 'inline-flex items-center justify-center gap-2 min-h-touch min-w-touch rounded-full ' +
      'border border-secondary/60 bg-surface/80 px-4 py-2 text-sm text-secondary hover:border-secondary ' +
      'active:bg-secondary/10 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-secondary/70 ' +
      'focus-visible:ring-offset-2 transition-colors touch-manipulation';

  const buttonLabel = triggerAriaLabel || triggerLabel;
  const handleTriggerClick = useCallback((event) => {
    if (typeof triggerOnClick === 'function') {
      triggerOnClick(event);
    }
    if (event?.defaultPrevented) return;
    handleToggle(event);
  }, [triggerOnClick, handleToggle]);
  const handleTriggerFocus = useCallback((event) => {
    if (typeof triggerOnFocus === 'function') {
      triggerOnFocus(event);
    }
    if (event?.defaultPrevented) return;
    if (shouldHover) {
      handleOpen(event);
    }
  }, [triggerOnFocus, handleOpen, shouldHover]);
  const handleTriggerBlur = useCallback((event) => {
    if (typeof triggerOnBlur === 'function') {
      triggerOnBlur(event);
    }
    if (event?.defaultPrevented) return;
    if (!isMobile) {
      handleBlur(event);
    }
  }, [triggerOnBlur, handleBlur, isMobile]);
  const handleTriggerMouseEnter = useCallback((event) => {
    if (typeof triggerOnMouseEnter === 'function') {
      triggerOnMouseEnter(event);
    }
    if (event?.defaultPrevented) return;
    if (shouldHover) {
      handleOpen(event);
    }
  }, [triggerOnMouseEnter, handleOpen, shouldHover]);
  const handleTriggerMouseLeave = useCallback((event) => {
    if (typeof triggerOnMouseLeave === 'function') {
      triggerOnMouseLeave(event);
    }
    if (event?.defaultPrevented) return;
    if (shouldHover) {
      handleClose(event);
    }
  }, [triggerOnMouseLeave, handleClose, shouldHover]);

  if (!insights) {
    return null;
  }
  const triggerButton = (
    <button
      ref={triggerRef}
      type="button"
      {...restTriggerProps}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      aria-controls={isMobile ? undefined : tooltipId}
      aria-label={buttonLabel}
      className={mergeClassNames(baseTriggerClassName, triggerClassName, triggerPropsClassName)}
      onClick={handleTriggerClick}
      onFocus={handleTriggerFocus}
      onBlur={handleTriggerBlur}
      onMouseEnter={handleTriggerMouseEnter}
      onMouseLeave={handleTriggerMouseLeave}
    >
      {triggerContent ? (
        triggerContent
      ) : (
        <>
          <Info className="h-4 w-4" aria-hidden="true" />
          <span>{triggerLabel}</span>
        </>
      )}
    </button>
  );

  // Mobile: use bottom sheet
  if (isMobile) {
    return (
      <>
        {triggerButton}
        <BottomSheet isOpen={isOpen} onClose={handleCloseImmediate} nested={nested}>
          <SymbolContent
            insights={insights}
            onClose={handleCloseImmediate}
            showCloseButton
          />
        </BottomSheet>
      </>
    );
  }

  // Desktop: use tooltip with proper positioning
  return (
    <div
      ref={containerRef}
      className="relative inline-block text-left"
      onMouseEnter={shouldHover ? handleOpen : undefined}
      onMouseLeave={shouldHover ? handleClose : undefined}
    >
      {triggerButton}

      {/* Desktop popover - positioned to avoid overflow */}
      <div
        ref={tooltipRef}
        id={tooltipId}
        role="dialog"
        aria-label="Card symbol insights"
        onMouseEnter={shouldHover ? handleOpen : undefined}
        onMouseLeave={shouldHover ? handleClose : undefined}
        onBlur={handleBlur}
        className={`absolute z-sticky-nav mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-secondary/40 bg-surface/98 p-4 shadow-2xl backdrop-blur-sm transition-all duration-200
          left-0 sm:left-auto sm:right-0
          ${isOpen
            ? 'opacity-100 translate-y-0 visible'
            : 'opacity-0 -translate-y-2 invisible pointer-events-none'
          }`}
      >
        <button
          type="button"
          onClick={handleCloseImmediate}
          className="absolute top-2 right-2 text-secondary hover:text-main focus:outline-hidden focus-visible:ring-2 focus-visible:ring-secondary/70 rounded-full"
          aria-label="Close symbol insights"
        >
          ×
        </button>
        <SymbolContent insights={insights} />
      </div>
    </div>
  );
}
