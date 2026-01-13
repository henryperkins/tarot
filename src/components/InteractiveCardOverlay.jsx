import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CaretDown, CaretUp, Lightbulb } from '@phosphor-icons/react';
import { SYMBOL_COORDINATES } from '../data/symbolCoordinates';
import { findRelatedCards } from '../../shared/symbols/symbolIndex';
import { getRandomReflection } from '../../shared/symbols/symbolReflections';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { titleCase } from '../lib/textUtils';

// Estimated tooltip dimensions for collision detection
const TOOLTIP_WIDTH = 280;
const TOOLTIP_HEIGHT_COLLAPSED = 140;
const TOOLTIP_HEIGHT_EXPANDED = 260;
const VIEWPORT_PADDING = 16;

/**
 * Calculate tooltip position with viewport collision detection
 */
function calculateTooltipPosition(rect, isExpanded = false) {
  let x = rect.left + rect.width / 2;
  let y = rect.bottom + 8;
  let placement = 'below';

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const tooltipHeight = isExpanded ? TOOLTIP_HEIGHT_EXPANDED : TOOLTIP_HEIGHT_COLLAPSED;

  // Check if tooltip would overflow right edge
  if (x + TOOLTIP_WIDTH / 2 > viewportWidth - VIEWPORT_PADDING) {
    x = viewportWidth - TOOLTIP_WIDTH / 2 - VIEWPORT_PADDING;
  }

  // Check if tooltip would overflow left edge
  if (x - TOOLTIP_WIDTH / 2 < VIEWPORT_PADDING) {
    x = TOOLTIP_WIDTH / 2 + VIEWPORT_PADDING;
  }

  // Check if tooltip would overflow bottom - flip to top
  if (y + tooltipHeight > viewportHeight - VIEWPORT_PADDING) {
    y = rect.top - tooltipHeight - 8;
    placement = 'above';

    // If flipped tooltip would also overflow top, center it vertically
    if (y < VIEWPORT_PADDING) {
      y = Math.max(VIEWPORT_PADDING, (viewportHeight - tooltipHeight) / 2);
      placement = 'center';
    }
  }

  return { x, y, placement };
}

/**
 * InteractiveCardOverlay - SVG overlay for card images with clickable symbol regions
 * Optimized for mobile with large touch targets and tap-based tooltips.
 * Uses React Portals to render tooltips above all card boundaries.
 */
export function InteractiveCardOverlay({ card }) {
  const [activeSymbol, setActiveSymbol] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0, placement: 'below' });
  const [activeRect, setActiveRect] = useState(null);
  const prefersReducedMotion = useReducedMotion();

  // Get card number for coordinate lookup
  const cardNumber = card.number ?? null;
  const coordinates = SYMBOL_COORDINATES[cardNumber];

  // Memoize related cards and reflection for active symbol
  const relatedCards = useMemo(() => {
    if (!activeSymbol) return [];
    return findRelatedCards(activeSymbol.object, cardNumber, 3);
  }, [activeSymbol, cardNumber]);

  const reflection = useMemo(() => {
    if (!activeSymbol) return null;
    return getRandomReflection(activeSymbol.object);
  }, [activeSymbol]);

  // Close tooltip on scroll, resize, or clicking outside
  useEffect(() => {
    if (!activeSymbol || typeof window === 'undefined') return undefined;

    const handleScroll = () => setActiveSymbol(null);
    const handleResize = () => setActiveSymbol(null);
    const handleClickOutside = () => setActiveSymbol(null);

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    // Delay adding click listener to avoid closing from the click that opened it
    const clickTimeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      clearTimeout(clickTimeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [activeSymbol]);

  // Close tooltip on Escape key
  useEffect(() => {
    if (!activeSymbol) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActiveSymbol(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSymbol]);

  const handleSymbolActivate = useCallback((symbol, event) => {
    // Prevent default browser behavior for proper handling
    if (event.type === 'keydown' && event.key === ' ') {
      event.preventDefault(); // Prevent page scroll on Space
    }
    event.stopPropagation();

    // Toggle tooltip - close if clicking same symbol, open if different
    if (activeSymbol?.object === symbol.object) {
      setActiveSymbol(null);
      setIsExpanded(false);
    } else {
      // Calculate position with collision detection
      const rect = event.currentTarget.getBoundingClientRect();
      const position = calculateTooltipPosition(rect, false);
      setTooltipPosition(position);
      setActiveRect(rect);
      setActiveSymbol(symbol);
      setIsExpanded(false);
    }
  }, [activeSymbol]);

  const handleToggleExpand = useCallback((event) => {
    event.stopPropagation();
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    // Recalculate position for new height
    if (activeRect) {
      const position = calculateTooltipPosition(activeRect, newExpanded);
      setTooltipPosition(position);
    }
  }, [isExpanded, activeRect]);

  const handleKeyDown = useCallback((symbol, event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      handleSymbolActivate(symbol, event);
    }
  }, [handleSymbolActivate]);

  // Only render for cards with mapped coordinates
  if (!coordinates) {
    return null;
  }

  return (
    <>
      <svg
        viewBox="0 0 820 1430"
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 10 }}
        aria-hidden="true"
      >
        {/* Render symbol regions */}
        {coordinates.symbols.map((symbolCoord, index) => {
          const isActive = activeSymbol?.object === symbolCoord.symbol.object;
          const commonProps = {
            fill: isActive ? 'rgba(255, 215, 0, 0.3)' : 'transparent',
            stroke: isActive ? 'rgba(255, 215, 0, 0.8)' : 'rgba(255, 255, 255, 0.2)',
            strokeWidth: "3",
            className: "cursor-pointer transition-all duration-200 hover:fill-yellow-400/20 hover:stroke-yellow-400/60 focus:outline-none focus:stroke-yellow-400 focus:stroke-[6px]",
            onClick: (e) => handleSymbolActivate(symbolCoord.symbol, e),
            onKeyDown: (e) => handleKeyDown(symbolCoord.symbol, e),
            style: { pointerEvents: 'all' },
            tabIndex: 0,
            role: "button",
            "aria-label": `${symbolCoord.symbol.object}: ${symbolCoord.symbol.meaning}`,
            "aria-expanded": isActive,
            "aria-haspopup": "true"
          };

          return (
            <g key={`symbol-${index}`}>
              {/* Clickable region */}
              {symbolCoord.shape === 'circle' && (
                <circle
                  cx={symbolCoord.cx}
                  cy={symbolCoord.cy}
                  r={symbolCoord.r}
                  {...commonProps}
                />
              )}

              {symbolCoord.shape === 'rect' && (
                <rect
                  x={symbolCoord.x}
                  y={symbolCoord.y}
                  width={symbolCoord.width}
                  height={symbolCoord.height}
                  rx="8"
                  {...commonProps}
                />
              )}

              {symbolCoord.shape === 'polygon' && (
                <polygon
                  points={symbolCoord.points}
                  {...commonProps}
                />
              )}

              {/* Pulsing indicator dot to show symbol is interactive - respects reduced motion */}
              {!isActive && symbolCoord.indicatorCx && (
                <circle
                  cx={symbolCoord.indicatorCx}
                  cy={symbolCoord.indicatorCy}
                  r="8"
                  fill="rgba(255, 215, 0, 0.8)"
                  className={`${prefersReducedMotion ? '' : 'animate-pulse'} pointer-events-none`}
                  aria-hidden="true"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip Portal */}
      {activeSymbol && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translate(-50%, 0)',
            maxWidth: '90vw',
            width: 'max-content'
          }}
          role="tooltip"
          aria-live="polite"
        >
          {/* Inner content with visual styling */}
          <div
            className={`bg-surface/95 backdrop-blur-md rounded-lg border-2 border-accent/60 p-3 shadow-2xl pointer-events-auto ${
              prefersReducedMotion ? '' : 'animate-in fade-in zoom-in-95 duration-150'
            }`}
            style={{ maxWidth: `${TOOLTIP_WIDTH}px` }}
          >
            {/* Header with symbol name */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-accent">
                  {titleCase(activeSymbol.object)}
                </p>
                {activeSymbol.color && (
                  <p className="text-xs text-secondary/70">
                    {activeSymbol.color}
                  </p>
                )}
              </div>
              {(reflection || relatedCards.length > 0) && (
                <button
                  onClick={handleToggleExpand}
                  className="flex items-center gap-1 text-xs text-secondary/70 hover:text-accent transition-colors p-1 -m-1"
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? 'Show less' : 'Explore deeper'}
                >
                  {isExpanded ? (
                    <CaretUp className="w-3.5 h-3.5" />
                  ) : (
                    <CaretDown className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>

            {/* Meaning */}
            <p className="text-xs text-main/90 leading-relaxed whitespace-normal mt-1.5">
              {activeSymbol.meaning}
            </p>

            {/* Expanded content */}
            {isExpanded && (
              <div className={`mt-3 pt-3 border-t border-secondary/20 space-y-3 ${
                prefersReducedMotion ? '' : 'animate-in fade-in slide-in-from-top-2 duration-200'
              }`}>
                {/* Reflective question */}
                {reflection && (
                  <div className="flex gap-2">
                    <Lightbulb className="w-3.5 h-3.5 text-accent/70 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-main/80 italic leading-relaxed">
                      {reflection}
                    </p>
                  </div>
                )}

                {/* Related cards */}
                {relatedCards.length > 0 && (
                  <div>
                    <p className="text-xs text-secondary/60 mb-1.5">Also appears in:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {relatedCards.map(({ cardNumber: num, cardName }) => (
                        <span
                          key={num}
                          className="text-xs px-2 py-0.5 rounded-full bg-secondary/10 text-secondary/80 border border-secondary/20"
                        >
                          {cardName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Expand hint when collapsed */}
            {!isExpanded && (reflection || relatedCards.length > 0) && (
              <button
                onClick={handleToggleExpand}
                className="mt-2 text-xs text-secondary/50 hover:text-accent transition-colors flex items-center gap-1"
              >
                <span>Explore deeper</span>
                <CaretDown className="w-3 h-3" />
              </button>
            )}

            {/* Visual arrow indicator based on placement */}
            <div
              className={`absolute w-3 h-3 bg-surface/95 border-accent/60 transform rotate-45 ${
                tooltipPosition.placement === 'above'
                  ? 'bottom-[-6px] left-1/2 -translate-x-1/2 border-r-2 border-b-2'
                  : tooltipPosition.placement === 'below'
                  ? 'top-[-6px] left-1/2 -translate-x-1/2 border-l-2 border-t-2'
                  : 'hidden'
              }`}
              aria-hidden="true"
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
