import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SYMBOL_COORDINATES } from '../data/symbolCoordinates';
import { useReducedMotion } from '../hooks/useReducedMotion';

// Estimated tooltip dimensions for collision detection
const TOOLTIP_WIDTH = 220;
const TOOLTIP_HEIGHT = 120;
const VIEWPORT_PADDING = 16;

/**
 * Calculate tooltip position with viewport collision detection
 */
function calculateTooltipPosition(rect) {
  let x = rect.left + rect.width / 2;
  let y = rect.bottom + 8;
  let placement = 'below';

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Check if tooltip would overflow right edge
  if (x + TOOLTIP_WIDTH / 2 > viewportWidth - VIEWPORT_PADDING) {
    x = viewportWidth - TOOLTIP_WIDTH / 2 - VIEWPORT_PADDING;
  }

  // Check if tooltip would overflow left edge
  if (x - TOOLTIP_WIDTH / 2 < VIEWPORT_PADDING) {
    x = TOOLTIP_WIDTH / 2 + VIEWPORT_PADDING;
  }

  // Check if tooltip would overflow bottom - flip to top
  if (y + TOOLTIP_HEIGHT > viewportHeight - VIEWPORT_PADDING) {
    y = rect.top - TOOLTIP_HEIGHT - 8;
    placement = 'above';

    // If flipped tooltip would also overflow top, center it vertically
    if (y < VIEWPORT_PADDING) {
      y = Math.max(VIEWPORT_PADDING, (viewportHeight - TOOLTIP_HEIGHT) / 2);
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
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0, placement: 'below' });
  const prefersReducedMotion = useReducedMotion();

  // Get card number for coordinate lookup
  const cardNumber = card.number ?? null;
  const coordinates = SYMBOL_COORDINATES[cardNumber];

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
    } else {
      // Calculate position with collision detection
      const rect = event.currentTarget.getBoundingClientRect();
      const position = calculateTooltipPosition(rect);
      setTooltipPosition(position);
      setActiveSymbol(symbol);
    }
  }, [activeSymbol]);

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
            <p className="text-sm font-semibold text-accent mb-1">
              {activeSymbol.object}
            </p>
            {activeSymbol.color && (
              <p className="text-xs text-secondary/80 mb-1">
                Color: {activeSymbol.color}
              </p>
            )}
            <p className="text-xs text-main/90 leading-relaxed whitespace-normal">
              {activeSymbol.meaning}
            </p>

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
