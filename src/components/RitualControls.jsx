import React, { useEffect, useRef, useState } from 'react';

export function RitualControls({
  hasKnocked,
  handleKnock,
  cutIndex,
  setCutIndex,
  hasCut,
  applyCut,
  knocksCount = 0,
  deckSize = 22,
  onSkip,
  deckAnnouncement
}) {
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const skipPromptRef = useRef(null);
  const knockComplete = knocksCount >= 3;
  const nextKnockNumber = Math.min(knocksCount + 1, 3);

  const confirmSkip = () => {
    setShowSkipConfirm(false);
    onSkip?.();
  };

  useEffect(() => {
    if (!showSkipConfirm) return;
    const handlePointer = event => {
      if (!skipPromptRef.current) return;
      if (!skipPromptRef.current.contains(event.target)) {
        setShowSkipConfirm(false);
      }
    };
    const handleKey = event => {
      if (event.key === 'Escape') {
        setShowSkipConfirm(false);
      }
    };
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showSkipConfirm]);

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
              knockComplete
                ? 'border-emerald-500/80 bg-emerald-500/20 text-emerald-200'
                : 'border-emerald-400/40 bg-slate-950/80 text-amber-100/90 hover:bg-slate-900/90 hover:border-emerald-400/70'
            }`}
            aria-pressed={knocksCount > 0}
            title="Knock up to 3 times"
          >
            {knockComplete ? 'Deck cleared · 3 of 3' : `Knock ${nextKnockNumber} of 3`}
          </button>
          <div className="text-amber-100/85 text-[clamp(0.82rem,2.2vw,0.95rem)] leading-snug mt-2">
            Ritual progress: <span className="font-semibold">{knocksCount}</span>/3 knocks registered.
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

      <div className="flex flex-col items-center gap-2 mt-2">
        <div className="relative" ref={skipPromptRef}>
          <button
            type="button"
            onClick={() => setShowSkipConfirm(show => !show)}
            className="text-amber-200 text-xs sm:text-sm underline underline-offset-4 decoration-amber-400/60 hover:text-amber-50"
            aria-haspopup="dialog"
            aria-expanded={showSkipConfirm}
          >
            Skip ritual for now
          </button>
          {showSkipConfirm && (
            <div
              role="tooltip"
              className="absolute left-1/2 top-full mt-2 -translate-x-1/2 w-56 text-xs sm:text-sm text-amber-100/90 bg-slate-950/95 border border-amber-300/40 rounded-lg px-3 py-3 shadow-2xl shadow-slate-950/40"
            >
              <p className="font-semibold text-amber-200">Skip ritual?</p>
              <p className="text-amber-100/70 mt-1">This will draw immediately and bypass grounding steps.</p>
              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowSkipConfirm(false)}
                  className="text-amber-200/80 hover:text-amber-50"
                >
                  Stay here
                </button>
                <button
                  type="button"
                  onClick={confirmSkip}
                  className="text-emerald-300 hover:text-emerald-200 font-semibold"
                >
                  Skip & draw
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="text-amber-100/85 text-xs-plus sm:text-sm mt-2">
        Ritual actions add intention, mirroring real readings where your energy guides the cards.
      </div>
      {deckAnnouncement && (
        <p className="sr-only" aria-live="polite">
          {deckAnnouncement}
        </p>
      )}
    </div>
  );
}
