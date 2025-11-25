import { useMemo, useState } from 'react';

/**
 * Generate heatmap cell background color using CSS custom property for theme consistency.
 * Falls back to emerald green if CSS variable unavailable.
 * @param {number} value - Intensity value between 0 and 1
 * @returns {string} CSS color string
 */
function cellColor(value) {
  // Clamp and validate input
  const safeValue = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const alpha = Math.min(0.85, safeValue * 0.9);
  // Use CSS custom property with fallback for theme consistency
  return `rgba(var(--color-accent-rgb, 16, 185, 129), ${alpha.toFixed(3)})`;
}

/**
 * Generate stable key for focus region lookup
 */
function focusKey(x, y) {
  return `${x}-${y}`;
}

export function VisionHeatmapOverlay({ attention, imageSrc, label }) {
  const [visible, setVisible] = useState(true);
  const hasHeatmap = Boolean(attention?.heatmap && imageSrc);

  // Memoize focus region lookup Set to prevent recreation on every render
  const focusLookup = useMemo(() => {
    if (!Array.isArray(attention?.focusRegions)) return new Set();
    return new Set(
      attention.focusRegions.map((region) => focusKey(region.x, region.y))
    );
  }, [attention?.focusRegions]);

  if (!hasHeatmap) {
    return null;
  }

  const gridSize = attention.gridSize || attention.heatmap.length || 0;
  if (!gridSize) return null;

  return (
    <div className="mt-3 animate-fade-in">
      <div className="flex items-center justify-between gap-3 text-xs text-secondary/80">
        <div>
          <p className="font-semibold text-secondary">Interpretability heatmap</p>
          <p className="text-muted">Shows where the detector concentrated when matching symbols.</p>
        </div>
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          aria-pressed={visible}
          aria-controls="heatmap-overlay-grid"
          className="min-h-[44px] min-w-[44px] flex-shrink-0 rounded-md border border-secondary/40 px-3 py-2 text-xs uppercase tracking-wide text-secondary/80 transition-colors hover:border-secondary/70 hover:bg-secondary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      <div className="mt-2 rounded-lg border border-secondary/40 bg-black/20 p-2">
        <div className="relative">
          <img
            src={imageSrc}
            alt={label || 'Uploaded card'}
            className="block w-full rounded"
          />
          {visible && (
            <div
              id="heatmap-overlay-grid"
              className="pointer-events-none absolute inset-0 grid mix-blend-screen"
              style={{
                gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`
              }}
            >
              {attention.heatmap.flatMap((row, rowIndex) =>
                row.map((value, colIndex) => {
                  const key = focusKey(colIndex, rowIndex);
                  return (
                    <div
                      key={`${colIndex}-${rowIndex}`}
                      className={`border ${focusLookup.has(key) ? 'border-secondary/70' : 'border-transparent'}`}
                      style={{
                        backgroundColor: cellColor(value)
                      }}
                    />
                  );
                })
              )}
            </div>
          )}
        </div>
        {attention.focusRegions?.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-secondary/70">
            {attention.focusRegions.slice(0, 4).map((region) => (
              <div
                key={`${label || 'heatmap'}-region-${region.x}-${region.y}`}
                className="rounded border border-secondary/20 px-2 py-1.5"
              >
                <span className="sr-only">Focus region at </span>
                Cell ({region.x}, {region.y}) · {(region.intensity * 100).toFixed(0)}%
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
