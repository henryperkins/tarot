import { useState } from 'react';

function cellColor(value) {
  const alpha = Math.min(0.85, Math.max(0, value) * 0.9);
  return `rgba(16, 185, 129, ${alpha})`;
}

function focusKey(x, y) {
  return `${x}-${y}`;
}

export function VisionHeatmapOverlay({ attention, imageSrc, label }) {
  const [visible, setVisible] = useState(true);
  const hasHeatmap = Boolean(attention?.heatmap && imageSrc);
  if (!hasHeatmap) {
    return null;
  }

  const gridSize = attention.gridSize || attention.heatmap.length || 0;
  if (!gridSize) return null;
  const focusLookup = new Set(
    Array.isArray(attention.focusRegions)
      ? attention.focusRegions.map((region) => focusKey(region.x, region.y))
      : []
  );

  return (
    <div className="mt-3 animate-fade-in">
      <div className="flex items-center justify-between text-[11px] text-secondary/80">
        <div>
          <p className="font-semibold">Interpretability heatmap</p>
          <p>Shows where the detector concentrated when matching symbols.</p>
        </div>
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          className="rounded border border-secondary/40 px-2 py-1 text-[10px] uppercase tracking-wide text-secondary/80 hover:border-secondary/70"
        >
          {visible ? 'Hide overlay' : 'Show overlay'}
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
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-secondary/70">
            {attention.focusRegions.slice(0, 4).map((region, idx) => (
              <div key={`${label}-region-${idx}`} className="rounded border border-secondary/20 px-2 py-1">
                Cell ({region.x}, {region.y}) · {(region.intensity * 100).toFixed(0)}%
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
