import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from '@phosphor-icons/react';
import { buildCardInsights } from '../lib/cardInsights';
import { titleCase } from '../lib/textUtils';

// Focusable element selectors for focus trap
const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable]'
].join(', ');

function mergeClassNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

function composeEventHandlers(handler, internalHandler) {
  return (event) => {
    if (typeof handler === 'function') {
      handler(event);
    }
    if (event?.defaultPrevented) return;
    if (typeof internalHandler === 'function') {
      internalHandler(event);
    }
  };
}

/**
 * Hook to detect if viewport is mobile-sized with debounced resize handling
 */
function useIsMobile(breakpoint = 640, debounceMs = 100) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    let timeoutId = null;

    function checkMobile() {
      setIsMobile(window.innerWidth < breakpoint);
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
function SymbolContent({ insights, onClose, showCloseButton = false }) {
  const orientationLabel = insights.isReversed ? 'Reversed' : 'Upright';
  const keywordsPreview = insights.keywords.slice(0, 3).join(', ');

  return (
    <div className="text-left">
      {showCloseButton && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-main">
            {insights.name}
            <span className="ml-2 text-xs uppercase tracking-widest text-secondary/80">
              {orientationLabel}
            </span>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-full text-secondary hover:bg-secondary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/70"
            aria-label="Close symbol insights"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
      {!showCloseButton && (
        <p className="text-sm font-semibold text-main">
          {insights.name}
          <span className="ml-2 text-xs uppercase tracking-widest text-secondary/80">
            {orientationLabel}
          </span>
        </p>
      )}
      {keywordsPreview && (
        <p className="mt-1 text-xs text-accent/80">
          <span className="font-medium">Keywords:</span> {keywordsPreview}
        </p>
      )}
      {insights.archetype && (
        <p className="mt-2 text-xs text-secondary/80">
          <span className="font-medium">Archetype:</span> {insights.archetype}
        </p>
      )}
      {insights.symbols.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/80">Symbols</h4>
          <ul className="mt-2 space-y-2 text-xs text-main/90" role="list">
            {insights.symbols.map((symbol, index) => (
              <li key={`${symbol.object}-${index}`} className="flex flex-col">
                <span>
                  <span className="font-semibold text-accent">{titleCase(symbol.object)}</span>
                  {symbol.position && (
                    <span className="ml-1 text-accent/60">({symbol.position})</span>
                  )}
                </span>
                <span className="text-muted mt-0.5">{symbol.meaning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {insights.colors.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.2em] text-accent/80">Palette</h4>
          <ul className="mt-2 space-y-1 text-xs text-muted" role="list">
            {insights.colors.map((color, index) => (
              <li key={`${color.color}-${index}`}>
                <span className="font-semibold text-secondary">{color.color}</span>
                <span className="ml-1 text-accent/70">— {color.meaning}</span>
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
function BottomSheet({ isOpen, onClose, children }) {
  const sheetRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        sheetRef.current?.focus();
      });
    } else {
      document.body.style.overflow = '';
      if (previousFocusRef.current?.focus) {
        previousFocusRef.current.focus();
      }
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Keyboard handling with focus trap
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    // Focus trap on Tab key
    if (event.key === 'Tab' && sheetRef.current) {
      const focusable = sheetRef.current.querySelectorAll(FOCUSABLE_SELECTORS);
      if (!focusable.length) {
        event.preventDefault();
        sheetRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    }
  }, [onClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const sheetMarkup = (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-main/70 backdrop-blur-sm animate-fade-in"
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
        className="relative z-10 w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-x border-secondary/30 bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl animate-slide-up focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle indicator */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-secondary/30" aria-hidden="true" />
        <div className="mt-2">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(sheetMarkup, document.body);
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
  openOnHover = true
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

  if (!insights) {
    return null;
  }

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
    : 'inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] rounded-full ' +
      'border border-secondary/60 bg-surface/80 px-4 py-2 text-sm text-secondary hover:border-secondary ' +
      'active:bg-secondary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/70 ' +
      'focus-visible:ring-offset-2 transition-colors touch-manipulation';

  const buttonLabel = triggerAriaLabel || triggerLabel;
  const triggerBlurHandler = isMobile
    ? triggerOnBlur
    : composeEventHandlers(triggerOnBlur, handleBlur);
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
      onClick={composeEventHandlers(triggerOnClick, handleToggle)}
      onFocus={shouldHover ? composeEventHandlers(triggerOnFocus, handleOpen) : triggerOnFocus}
      onBlur={triggerBlurHandler}
      onMouseEnter={shouldHover ? composeEventHandlers(triggerOnMouseEnter, handleOpen) : triggerOnMouseEnter}
      onMouseLeave={shouldHover ? composeEventHandlers(triggerOnMouseLeave, handleClose) : triggerOnMouseLeave}
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
        <BottomSheet isOpen={isOpen} onClose={handleCloseImmediate}>
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
        className={`absolute z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-secondary/40 bg-surface/98 p-4 shadow-2xl backdrop-blur-sm transition-all duration-200
          left-0 sm:left-auto sm:right-0
          ${isOpen
            ? 'opacity-100 translate-y-0 visible'
            : 'opacity-0 -translate-y-2 invisible pointer-events-none'
          }`}
      >
        <button
          type="button"
          onClick={handleCloseImmediate}
          className="absolute top-2 right-2 text-secondary hover:text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/70 rounded-full"
          aria-label="Close symbol insights"
        >
          ×
        </button>
        <SymbolContent insights={insights} />
      </div>
    </div>
  );
}
