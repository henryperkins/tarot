import { useMemo, useState } from 'react';
import { Info } from '@phosphor-icons/react';
import { buildCardInsights } from '../lib/cardInsights';

export function CardSymbolInsights({ card, position }) {
  const insights = useMemo(() => buildCardInsights(card), [card]);
  const [isOpen, setIsOpen] = useState(false);

  if (!insights) {
    return null;
  }

  const orientationLabel = insights.isReversed ? 'Reversed' : 'Upright';
  const keywordsPreview = insights.keywords.slice(0, 3).join(', ');

  const handlePointerEnter = () => setIsOpen(true);
  const handlePointerLeave = () => setIsOpen(false);
  const safePosition = typeof position === 'string'
    ? position.replace(/\s+/g, '-').toLowerCase()
    : 'slot';
  const safeName = card?.name ? card.name.replace(/\s+/g, '-').toLowerCase() : 'card';
  const tooltipId = `card-symbol-tooltip-${safeName}-${safePosition}`;

  return (
    <div
      className="relative inline-block text-left"
      onMouseLeave={handlePointerLeave}
      onTouchEnd={handlePointerLeave}
    >
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={tooltipId}
        onMouseEnter={handlePointerEnter}
        onFocus={handlePointerEnter}
        onClick={() => setIsOpen(prev => !prev)}
        className="inline-flex items-center gap-2 rounded-full border border-secondary/60 bg-surface/80 px-3 py-1 text-xs text-secondary hover:border-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/70"
      >
        <Info className="h-3.5 w-3.5" />
        <span>Card symbols</span>
      </button>

      <div
        id={tooltipId}
        role="tooltip"
        className={`absolute z-20 mt-2 w-72 rounded-2xl border border-secondary/40 bg-surface/95 p-4 text-left shadow-2xl transition-all duration-200 origin-top-left ${isOpen ? 'opacity-100 scale-100' : 'pointer-events-none opacity-0 scale-95'
          }`}
        onMouseEnter={handlePointerEnter}
        onMouseLeave={handlePointerLeave}
      >
        <p className="text-sm font-semibold text-main">
          {insights.name}
          <span className="ml-2 text-xs uppercase tracking-widest text-secondary/80">
            {orientationLabel}
          </span>
        </p>
        {keywordsPreview && (
          <p className="mt-1 text-xs text-accent/80">Keywords: {keywordsPreview}</p>
        )}
        {insights.archetype && (
          <p className="mt-2 text-xs text-secondary/80">Archetype: {insights.archetype}</p>
        )}
        {insights.symbols.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent/80">Symbols</p>
            <ul className="mt-2 space-y-2 text-xs text-main/90">
              {insights.symbols.map((symbol, index) => (
                <li key={`${symbol.object}-${index}`}>
                  <span className="font-semibold text-accent">{symbol.object}</span>
                  {symbol.position && (
                    <span className="ml-1 text-accent/60">({symbol.position})</span>
                  )}
                  <div className="text-muted">{symbol.meaning}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {insights.colors.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent/80">Palette</p>
            <ul className="mt-2 space-y-1 text-xs text-muted">
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
    </div>
  );
}
