import React, { useEffect, useRef, useState } from 'react';
import { Info, Sparkles, Scissors } from 'lucide-react';
import { Tooltip } from './Tooltip';

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
  const sliderMax = Math.max(0, (deckSize ?? 22) - 1);
  const ritualStatus = knockComplete && hasCut ? 'Ready' : hasKnocked || hasCut ? 'In flow' : 'Optional';

  const controlShellClass =
    'rounded-[1.75rem] border border-emerald-500/40 bg-slate-950/75 p-3 sm:p-4 shadow-[0_0_55px_rgba(16,185,129,0.28)] backdrop-blur-xl space-y-4';
  const tileBaseClass =
    'flex flex-col gap-3 rounded-2xl border border-emerald-500/15 bg-slate-950/70 p-3 sm:p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300/60 hover:shadow-[0_0_35px_rgba(245,158,11,0.18)]';
  const activeTileClass = 'border-emerald-400/60 bg-emerald-500/5 shadow-[0_0_35px_rgba(16,185,129,0.35)]';
  const iconWrapperBase =
    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl border text-emerald-100 transition-all duration-200';
  const activeIconWrapper =
    'border-emerald-400/60 bg-emerald-500/20 text-emerald-50 shadow-[0_0_20px_rgba(16,185,129,0.35)]';
  const inactiveIconWrapper = 'border-slate-900/80 bg-slate-950/80 text-slate-400';
  const badgeBaseClass =
    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.12em] transition-all duration-200';
  const activeBadgeClass =
    'border-emerald-400/70 bg-emerald-500/20 text-emerald-50 shadow-[0_0_20px_rgba(16,185,129,0.45)]';
  const inactiveBadgeClass = 'border-slate-700/70 bg-slate-900/80 text-slate-300';
  const infoButtonClass =
    'inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-emerald-400/40 bg-transparent text-emerald-200/80 transition hover:border-amber-300/60 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60';
  const primaryButtonBase =
    'flex w-full items-center justify-between rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200';
  const primaryButtonActive = 'border-emerald-400/60 bg-emerald-500/15 text-emerald-50 shadow-[0_0_20px_rgba(16,185,129,0.35)]';
  const primaryButtonIdle = 'border-slate-800/80 bg-slate-950/60 text-amber-100/90 hover:border-amber-300/60 hover:text-amber-50';
  const sliderWrapClass = 'rounded-2xl border border-slate-800/70 bg-slate-950/60 px-3 py-2.5';

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
    <div className={controlShellClass}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.78rem] uppercase tracking-[0.35em] text-emerald-200/80">Ritual (optional)</p>
          <p className="text-sm text-amber-100/80">Light grounding before the draw, or skip anytime.</p>
        </div>
        <span
          className={`${badgeBaseClass} ${
            ritualStatus === 'Ready' ? activeBadgeClass : inactiveBadgeClass
          }`}
        >
          {ritualStatus}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className={`${tileBaseClass} ${knockComplete ? activeTileClass : ''}`}>
          <div className="flex items-center gap-2">
            <span
              className={`${iconWrapperBase} ${
                knockComplete ? activeIconWrapper : inactiveIconWrapper
              }`}
              aria-hidden="true"
            >
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="flex flex-1 items-center gap-1.5 text-[0.85rem] normal-case tracking-normal">
              <span className="font-semibold text-amber-50">Clear the deck</span>
              <Tooltip
                content="Knock three times to clear lingering energy."
                position="top"
                triggerClassName={infoButtonClass}
                ariaLabel="About clearing the deck ritual"
              >
                <Info className="h-3.5 w-3.5" />
              </Tooltip>
            </div>
            <span
              className={`${badgeBaseClass} ${
                knockComplete ? activeBadgeClass : inactiveBadgeClass
              }`}
            >
              {knockComplete ? 'Cleared' : `${knocksCount}/3`}
            </span>
          </div>
          <button
            type="button"
            onClick={handleKnock}
            className={`${primaryButtonBase} ${
              knockComplete ? primaryButtonActive : primaryButtonIdle
            }`}
            aria-pressed={knocksCount > 0}
            title="Knock up to 3 times"
          >
            <span>{knockComplete ? 'Deck cleared · 3 of 3' : `Knock ${nextKnockNumber} of 3`}</span>
            {!knockComplete && (
              <span className="text-[0.65rem] uppercase tracking-[0.2em] text-amber-200/80">Tap</span>
            )}
          </button>
          <p className="text-sm text-amber-100/85">
            Ritual progress: <span className="font-semibold text-emerald-200">{knocksCount}</span>/3 knocks registered.
          </p>
        </div>

        <div className={`${tileBaseClass} ${hasCut ? activeTileClass : ''}`}>
          <div className="flex items-center gap-2">
            <span
              className={`${iconWrapperBase} ${hasCut ? activeIconWrapper : inactiveIconWrapper}`}
              aria-hidden="true"
            >
              <Scissors className="h-4 w-4" />
            </span>
            <div className="flex flex-1 items-center gap-1.5 text-[0.85rem] normal-case tracking-normal">
              <span className="font-semibold text-amber-50">Cut the deck</span>
              <Tooltip
                content="Slide until the cut feels right, then lock it in."
                position="top"
                triggerClassName={infoButtonClass}
                ariaLabel="About cutting the deck"
              >
                <Info className="h-3.5 w-3.5" />
              </Tooltip>
            </div>
            <span
              className={`${badgeBaseClass} ${hasCut ? activeBadgeClass : inactiveBadgeClass}`}
            >
              {hasCut ? 'Locked' : `Cut #${cutIndex}`}
            </span>
          </div>
          <div className={sliderWrapClass}>
            <label htmlFor="cut-range" className="sr-only">
              Choose where to cut the deck
            </label>
            <input
              id="cut-range"
              type="range"
              min={0}
              max={sliderMax}
              value={cutIndex}
              onChange={event => setCutIndex(parseInt(event.target.value, 10))}
              className="w-full cursor-pointer appearance-none"
              aria-label="Cut position"
              aria-valuetext={`Cut position ${cutIndex} of ${deckSize}`}
              style={{ accentColor: '#fbbf24' }}
            />
            <div className="mt-1 flex items-center justify-between text-[0.7rem] text-amber-100/70">
              <span>0</span>
              <span className="font-semibold text-emerald-200">Cut #{cutIndex}</span>
              <span>{sliderMax}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={applyCut}
            className={`${primaryButtonBase} ${hasCut ? primaryButtonActive : primaryButtonIdle}`}
            aria-pressed={hasCut}
          >
            <span>{hasCut ? 'Cut confirmed' : 'Confirm cut'}</span>
            <span className="text-[0.65rem] uppercase tracking-[0.2em] text-amber-200/80">
              {hasCut ? 'Locked' : 'Lock'}
            </span>
          </button>
          <p className="text-sm text-amber-100/85">
            Cut at <span className="font-semibold text-emerald-200">{cutIndex}</span> of {deckSize}.{' '}
            {hasCut ? <span className="text-emerald-300">Cut locked in.</span> : 'Adjust until it feels right.'}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <div className="relative" ref={skipPromptRef}>
          <button
            type="button"
            onClick={() => setShowSkipConfirm(show => !show)}
            className="text-[0.68rem] uppercase tracking-[0.35em] text-amber-200/80 underline decoration-amber-300/60 underline-offset-4 transition hover:text-amber-50"
            aria-haspopup="dialog"
            aria-expanded={showSkipConfirm}
          >
            Skip ritual for now
          </button>
          {showSkipConfirm && (
            <div
              role="dialog"
              aria-label="Skip ritual confirmation"
              className="absolute left-1/2 top-full mt-2 w-64 -translate-x-1/2 rounded-2xl border border-amber-300/40 bg-slate-950/95 p-4 text-xs sm:text-sm text-amber-50 shadow-[0_15px_40px_rgba(2,6,23,0.7)]"
            >
              <p className="font-semibold text-amber-200">Skip ritual?</p>
              <p className="text-amber-100/70 mt-1">This will draw immediately and bypass grounding steps.</p>
              <div className="mt-3 flex items-center justify-end gap-2 text-[0.8rem]">
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
        <div className="text-amber-100/85 text-xs-plus sm:text-sm">
          Ritual actions add intention, mirroring real readings where your energy guides the cards.
        </div>
      </div>

      {deckAnnouncement && (
        <p className="sr-only" aria-live="polite">
          {deckAnnouncement}
        </p>
      )}
    </div>
  );
}
