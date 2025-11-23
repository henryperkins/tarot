import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SYMBOL_COORDINATES } from '../data/symbolCoordinates';

/**
 * InteractiveCardOverlay - SVG overlay for card images with clickable symbol regions
 * Optimized for mobile with large touch targets and tap-based tooltips.
 * Now uses React Portals to render tooltips above all card boundaries.
 */
export function InteractiveCardOverlay({ card }) {
  const [activeSymbol, setActiveSymbol] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Get card number for coordinate lookup
  const cardNumber = card.number ?? null;
  const coordinates = SYMBOL_COORDINATES[cardNumber];

  useEffect(() => {
    if (!activeSymbol || typeof window === 'undefined') return undefined;

    const handleScroll = () => setActiveSymbol(null);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeSymbol]);

  // Only render for cards with mapped coordinates
  if (!coordinates) {
    return null;
  }

  const handleSymbolActivate = (symbol, event) => {
    // Prevent default browser behavior for proper handling
    if (event.type === 'keydown' && event.key === ' ') {
      event.preventDefault(); // Prevent page scroll on Space
    }
    event.stopPropagation();

    // Toggle tooltip - close if clicking same symbol, open if different
    if (activeSymbol?.object === symbol.object) {
      setActiveSymbol(null);
    } else {
      // Calculate position based on the target element's viewport position
      const rect = event.currentTarget.getBoundingClientRect();
      
      // Center the tooltip horizontally relative to the symbol
      // and place it below the symbol with a small gap
      const x = rect.left + rect.width / 2;
      const y = rect.bottom + 8;

      // Store fixed coordinates (we will use fixed positioning for the portal)
      setTooltipPosition({ x, y });
      setActiveSymbol(symbol);
    }
  };

  const handleKeyDown = (symbol, event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      handleSymbolActivate(symbol, event);
    }
  };

  const handleOverlayClick = (event) => {
    // Close tooltip when clicking outside symbols (on the SVG background)
    if (event.target.tagName === 'svg') {
      setActiveSymbol(null);
    }
  };

  return (
    <>
      <svg
        viewBox="0 0 820 1430"
        className="absolute inset-0 w-full h-full pointer-events-auto"
        onClick={handleOverlayClick}
        style={{ zIndex: 10 }}
        role="application"
        aria-label="Interactive symbol map"
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
            tabIndex: "0",
            role: "button",
            "aria-label": `Symbol: ${symbolCoord.symbol.object}`,
            "aria-expanded": isActive
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

              {/* Pulsing indicator dot to show symbol is interactive */}
              {!isActive && symbolCoord.indicatorCx && (
                <circle
                  cx={symbolCoord.indicatorCx}
                  cy={symbolCoord.indicatorCy}
                  r="8"
                  fill="rgba(255, 215, 0, 0.8)"
                  className="animate-pulse pointer-events-none"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip Portal */}
      {activeSymbol && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translate(-50%, 0)', // Center horizontally
            maxWidth: '90vw',
            width: 'max-content'
          }}
        >
          {/* Inner content allows pointer events if needed (e.g. selecting text) */}
          <div className="bg-surface/95 backdrop-blur-md rounded-lg border-2 border-accent/60 p-3 shadow-2xl pointer-events-auto animate-in fade-in zoom-in-95 duration-150">
            <p className="text-sm font-semibold text-accent mb-1">
              {activeSymbol.object}
            </p>
            {activeSymbol.color && (
              <p className="text-xs text-secondary/80 mb-1">
                Color: {activeSymbol.color}
              </p>
            )}
            <p className="text-xs text-main/90 leading-relaxed max-w-[200px] whitespace-normal">
              {activeSymbol.meaning}
            </p>
            {/* Optional Arrow/Tail could be added here if desired */}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
