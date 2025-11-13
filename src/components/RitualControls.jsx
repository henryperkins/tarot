import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function RitualControls({
  hasKnocked,
  handleKnock,
  cutIndex,
  setCutIndex,
  hasCut,
  applyCut,
  knocksCount = 0,
  deckSize = 22
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="modern-surface p-4 sm:p-6 mb-6">
      {/* Mobile: Collapsible header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="md:hidden w-full flex items-center justify-between mb-3 p-3 bg-slate-900/40 rounded-lg border border-emerald-400/20 hover:bg-slate-900/60 transition"
        aria-expanded={isExpanded}
        aria-controls="ritual-content"
      >
        <span className="text-amber-200 font-serif text-sm">Ritual (optional)</span>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-amber-300" /> : <ChevronDown className="w-4 h-4 text-amber-300" />}
      </button>

      {/* Ritual content - always visible on desktop, collapsible on mobile */}
      <div
        id="ritual-content"
        className={`${isExpanded ? 'block' : 'hidden md:block'}`}
      >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Knock / Clear */}
        <div className="flex-1">
          <div className="font-serif text-amber-200 mb-2">Clear the deck</div>
          <button
            type="button"
            onClick={handleKnock}
            className={`px-4 py-2 rounded-lg border ${
              hasKnocked
                ? 'border-emerald-500/60 bg-emerald-500/12'
                : 'border-emerald-400/30 bg-slate-900/80 hover:bg-slate-800/90'
            }`}
            aria-pressed={hasKnocked}
            title="Knock up to 3 times"
          >
            {hasKnocked ? 'Cleared ✓' : 'Knock 3x'}
          </button>
          <div className="text-amber-100/60 text-xs mt-2">
            Knocks: {knocksCount}/3 • Your rhythm influences the cards drawn.
          </div>
        </div>

        {/* Cut */}
        <div className="flex-1">
          <div className="font-serif text-amber-200 mb-2">Cut the deck</div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <label htmlFor="cut-range" className="sr-only">
              Choose where to cut the deck
            </label>
            <input
              id="cut-range"
              type="range"
              min={0}
              max={Math.max(0, (deckSize ?? 22) - 1)}
              value={cutIndex}
              onChange={event => setCutIndex(parseInt(event.target.value, 10))}
              className="w-full sm:w-48"
              aria-label="Cut position"
            />
            <button
              type="button"
              onClick={applyCut}
              className={`w-full sm:w-auto px-3 py-2 rounded-lg border ${
                hasCut
                  ? 'border-emerald-500/60 bg-emerald-500/12'
                  : 'border-emerald-400/30 bg-slate-900/80 hover:bg-slate-800/90'
              }`}
              aria-pressed={hasCut}
            >
              {hasCut ? 'Cut set ✓' : 'Set cut'}
            </button>
          </div>
          <div className="text-xs text-amber-100/60 mt-1">
            Cut at: {cutIndex} • Where you cut shapes which cards appear.
          </div>
        </div>
      </div>

      {/* Subtle helper line */}
      <div className="text-amber-100/60 text-xs mt-4 mobile-hide">
        Ritual actions add intention, mirroring real readings where your energy guides the cards.
      </div>
      </div>
    </div>
  );
}