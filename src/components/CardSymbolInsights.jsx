import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Info, X } from '@phosphor-icons/react';
import { buildCardInsights } from '../lib/cardInsights';

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
                  <span className="font-semibold text-accent">{symbol.object}</span>
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
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
        className="relative z-10 w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-x border-secondary/30 bg-surface/98 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl animate-slide-up focus:outline-none"
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
}

export function CardSymbolInsights({ card, position }) {
  const insights = useMemo(() => buildCardInsights(card), [card]);
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const closeTimeoutRef = useRef(null);

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

  // Delayed close to allow moving between trigger and tooltip
  const handleOpen = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  }, []);

  const handleToggle = useCallback((event) => {
    event.stopPropagation();
    setIsOpen(prev => !prev);
  }, []);

  const handleCloseImmediate = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    setIsOpen(false);
  }, []);

  if (!insights) {
    return null;
  }

  // Mobile: use bottom sheet
  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          className="inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] rounded-full border border-secondary/60 bg-surface/80 px-4 py-2 text-sm text-secondary hover:border-secondary active:bg-secondary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/70 focus-visible:ring-offset-2 touch-manipulation transition-colors"
        >
          <Info className="h-4 w-4" aria-hidden="true" />
          <span>Card symbols</span>
        </button>
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
      onMouseEnter={handleOpen}
      onMouseLeave={handleClose}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={tooltipId}
        onClick={handleToggle}
        onFocus={handleOpen}
        onBlur={handleClose}
        className="inline-flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] rounded-full border border-secondary/60 bg-surface/80 px-4 py-2 text-sm text-secondary hover:border-secondary active:bg-secondary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/70 focus-visible:ring-offset-2 transition-colors"
      >
        <Info className="h-4 w-4" aria-hidden="true" />
        <span>Card symbols</span>
      </button>

      {/* Desktop tooltip - positioned to avoid overflow */}
      <div
        ref={tooltipRef}
        id={tooltipId}
        role="dialog"
        aria-label="Card symbol insights"
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        className={`absolute z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-secondary/40 bg-surface/98 p-4 shadow-2xl backdrop-blur-sm transition-all duration-200
          left-0 sm:left-auto sm:right-0
          ${isOpen
            ? 'opacity-100 translate-y-0 visible'
            : 'opacity-0 -translate-y-2 invisible pointer-events-none'
          }`}
      >
        <SymbolContent insights={insights} />
      </div>
    </div>
  );
}
