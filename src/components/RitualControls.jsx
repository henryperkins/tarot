import React from 'react';

export function RitualControls({
  hasKnocked,
  handleKnock,
  cutIndex,
  setCutIndex,
  hasCut,
  applyCut,
  knocksCount = 0,
  deckSize = 22,
  onSkip
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        {/* Knock / Clear */}
        <div className="flex-1 w-full">
          <div className="font-serif text-amber-200 mb-2">Clear the deck</div>
          <button
            type="button"
            onClick={handleKnock}
            className={`w-full px-4 py-3 rounded-lg border text-sm font-semibold transition-all ${
              hasKnocked
                ? 'border-emerald-500/80 bg-emerald-500/20 text-emerald-200'
                : 'border-emerald-400/40 bg-slate-950/80 text-amber-100/90 hover:bg-slate-900/90 hover:border-emerald-400/70'
            }`}
            aria-pressed={hasKnocked}
            title="Knock up to 3 times"
          >
            {hasKnocked ? 'Cleared · 3 of 3' : `Knock ${Math.min(knocksCount + 1, 3)} of 3`}
          </button>
          <div className="text-amber-100/85 text-[clamp(0.82rem,2.2vw,0.95rem)] leading-snug mt-2">
            Ritual progress: {knocksCount}/3 knocks registered.
          </div>
        </div>

        {/* Cut */}
        <div className="flex-1 w-full">
          <div className="font-serif text-amber-200 mb-2">Cut the deck</div>
          <div className="space-y-3">
            <div className="relative">
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
                className="w-full accent-emerald-400"
                aria-label="Cut position"
                aria-valuetext={`Cut position ${cutIndex} of ${deckSize}`}
              />
              <span className="absolute -top-5 right-0 text-xs text-emerald-300">
                Cut #{cutIndex}
              </span>
            </div>
            <button
              type="button"
              onClick={applyCut}
              className={`w-full px-4 py-3 rounded-lg border text-sm font-semibold transition-all ${
                hasCut
                  ? 'border-emerald-500/80 bg-emerald-500/20 text-emerald-200'
                  : 'border-emerald-400/40 bg-slate-950/80 text-amber-100/90 hover:bg-slate-900/90 hover:border-emerald-400/70'
              }`}
              aria-pressed={hasCut}
            >
              {hasCut ? 'Cut confirmed' : 'Confirm cut'}
            </button>
          </div>
          <div className="text-amber-100/85 text-[clamp(0.82rem,2.2vw,0.95rem)] leading-snug mt-1">
            Cut at <span className="font-semibold">{cutIndex}</span> of {deckSize}.{' '}
            {hasCut ? <span className="text-emerald-300">Cut locked in.</span> : 'Adjust until it feels right.'}
          </div>
        </div>
      </div>

      <div className="flex justify-center mt-2">
        <button
          type="button"
          onClick={onSkip}
          className="px-4 py-2 rounded-lg border border-amber-300/50 text-amber-100/80 text-xs sm:text-sm hover:text-amber-50 hover:border-amber-200/70 transition"
        >
          Skip Ritual
        </button>
      </div>
      <div className="text-amber-100/85 text-xs-plus sm:text-sm mt-2">
        Ritual actions add intention, mirroring real readings where your energy guides the cards.
      </div>
    </div>
  );
}
