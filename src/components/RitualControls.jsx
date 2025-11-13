import React from 'react';

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
  return (
    <div className="modern-surface p-6 mb-6">
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
            Knocks: {knocksCount}/3 • Knocking influences the shuffle seed.
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
            Cut at: {cutIndex} • Cut selection also influences the shuffle seed.
          </div>
        </div>
      </div>

      {/* Subtle helper line */}
      <div className="text-amber-100/60 text-xs mt-4">
        Ritual actions are optional but mirror real-table practice and shape how the deck shuffles.
      </div>
    </div>
  );
}