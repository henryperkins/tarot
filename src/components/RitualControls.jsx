import { useEffect, useRef, useState } from 'react';
import { Info, Sparkle, Scissors } from '@phosphor-icons/react';
import { Tooltip } from './Tooltip';
import { usePreferences } from '../contexts/PreferencesContext';

export function RitualControls({
  hasKnocked,
  handleKnock,
  cutIndex,
  setCutIndex,
  hasCut,
  applyCut,
  knockCount = 0,
  onSkip,
  deckAnnouncement
}) {
  const { deckSize, personalization } = usePreferences();
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const skipPromptRef = useRef(null);
  const knockComplete = knockCount >= 3;
  const nextKnockNumber = Math.min(knockCount + 1, 3);
  const sliderMax = Math.max(0, (deckSize ?? 22) - 1);
  const ritualStatus = knockComplete && hasCut ? 'Ready' : hasKnocked || hasCut ? 'In flow' : 'Optional';
  const isExperienced = personalization?.tarotExperience === 'experienced';
  const isNewbie = personalization?.tarotExperience === 'newbie';

  const controlShellClass =
    'rounded-[1.75rem] border border-secondary/40 bg-surface/75 p-3 sm:p-4 shadow-lg shadow-secondary/20 backdrop-blur-xl space-y-4';
  const tileBaseClass =
    'flex flex-col gap-3 rounded-2xl border border-secondary/15 bg-surface/70 p-3 sm:p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-lg hover:shadow-accent/10';
  const activeTileClass = 'border-secondary/60 bg-secondary/5 shadow-lg shadow-secondary/35';
  const iconWrapperBase =
    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl border text-secondary transition-all duration-200';
  const activeIconWrapper =
    'border-secondary/60 bg-secondary/20 text-secondary shadow-lg shadow-secondary/20';
  const inactiveIconWrapper = 'border-accent/20 bg-surface/80 text-muted';
  const badgeBaseClass =
    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider transition-all duration-200';
  const activeBadgeClass =
    'border-secondary/70 bg-secondary/20 text-secondary shadow-lg shadow-secondary/20';
  const inactiveBadgeClass = 'border-accent/20 bg-surface-muted/80 text-muted';
  // Info button - subtle icon, 44px touch target but no visible border
  const infoButtonClass =
    'inline-flex min-w-[44px] min-h-[44px] items-center justify-center rounded-full text-muted/60 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 touch-manipulation -ml-2 -mr-3';
  const primaryButtonBase =
    'flex w-full items-center justify-between rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200';
  const primaryButtonActive = 'border-secondary/60 bg-secondary/15 text-secondary shadow-lg shadow-secondary/20';
  const primaryButtonIdle = 'border-accent/20 bg-surface/60 text-main/90 hover:border-accent/60 hover:text-main';
  const sliderWrapClass = 'rounded-2xl border border-accent/20 bg-surface/60 px-3 py-2.5';

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
    <div className={`${controlShellClass} animate-fade-in`}>
      {/* Desktop Header - Hidden on Mobile */}
      <div className="hidden sm:flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.78rem] uppercase tracking-[0.35em] text-secondary/80">Ritual</p>
          {!isExperienced && (
            <p className="text-sm text-muted">A grounding moment before the draw.</p>
          )}
        </div>
        <span
          className={`${badgeBaseClass} ${ritualStatus === 'Ready' ? activeBadgeClass : inactiveBadgeClass
            }`}
        >
          {ritualStatus}
        </span>
      </div>

      {/* Mobile Header */}
      <div className="sm:hidden flex items-center justify-between mb-4">
        <h3 className="text-lg font-serif text-accent">Ritual</h3>
        <span className={`${badgeBaseClass} ${ritualStatus === 'Ready' ? activeBadgeClass : inactiveBadgeClass}`}>
          {ritualStatus}
        </span>
      </div>

      {/* Desktop Grid - Hidden on Mobile */}
      <div className="hidden sm:grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className={`${tileBaseClass} ${knockComplete ? activeTileClass : ''}`}>
          <div className="flex items-center gap-2">
            <span
              className={`${iconWrapperBase} ${knockComplete ? activeIconWrapper : inactiveIconWrapper
                }`}
              aria-hidden="true"
            >
              <Sparkle className="h-4 w-4" />
            </span>
            <div className="flex flex-1 items-center gap-1.5 text-[0.85rem] normal-case tracking-normal">
              <span className="font-semibold text-main">Clear the deck</span>
              <Tooltip
                content="Clear deck energy"
                position="top"
                triggerClassName={infoButtonClass}
                ariaLabel="About clearing the deck ritual"
              >
                <Info className="h-3.5 w-3.5" />
              </Tooltip>
            </div>
            <span
              className={`${badgeBaseClass} ${knockComplete ? activeBadgeClass : inactiveBadgeClass
                }`}
            >
              {knockComplete ? 'Cleared' : `${knockCount}/3`}
            </span>
          </div>
          <button
            type="button"
            onClick={handleKnock}
            className={`${primaryButtonBase} ${knockComplete ? primaryButtonActive : primaryButtonIdle
              }`}
            aria-pressed={knockCount > 0}
            title="Knock up to 3 times"
          >
            <span>{knockComplete ? 'Deck cleared · 3 of 3' : `Knock ${nextKnockNumber} of 3`}</span>
            {!knockComplete && (
              <span className="text-[0.65rem] uppercase tracking-[0.2em] text-accent/80">Tap</span>
            )}
          </button>
          {!isExperienced && (
            <p className="text-sm text-muted">
              Ritual progress: <span className="font-semibold text-secondary">{knockCount}</span>/3 knocks registered.
            </p>
          )}
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
              <span className="font-semibold text-main">Cut the deck</span>
              <Tooltip
                content="Choose cut position"
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
              style={{ accentColor: 'var(--brand-accent)' }}
            />
            <div className="mt-1 flex items-center justify-between text-[0.7rem] text-muted">
              <span>0</span>
              <span className="font-semibold text-secondary">Cut #{cutIndex}</span>
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
            <span className="text-[0.65rem] uppercase tracking-[0.2em] text-accent/80">
              {hasCut ? 'Locked' : 'Lock'}
            </span>
          </button>
          {!isExperienced && (
            <p className="text-sm text-muted">
              Cut at <span className="font-semibold text-secondary">{cutIndex}</span> of {deckSize}.{' '}
              {hasCut ? <span className="text-secondary">Cut locked in.</span> : 'Adjust until it feels right.'}
            </p>
          )}
        </div>
      </div>

      {/* Mobile Touch Controls */}
      <div className="sm:hidden space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Knock Button */}
          <button
            type="button"
            onClick={handleKnock}
            className={`aspect-square rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all active:scale-95 touch-manipulation ${knockComplete
              ? 'bg-secondary/20 border-secondary/60 text-secondary'
              : 'bg-surface-muted/60 border-accent/20 text-main'
              }`}
            aria-label={knockComplete ? 'Deck cleared with 3 knocks' : `Knock ${nextKnockNumber} of 3`}
          >
            <Sparkle className={`w-8 h-8 ${knockComplete ? 'text-secondary' : 'text-accent'}`} />
            <span className="text-sm font-semibold">{knockComplete ? 'Cleared' : 'Knock'}</span>
            <span className="text-xs opacity-70">{knockCount}/3</span>
          </button>

          {/* Cut Button */}
          <button
            type="button"
            onClick={applyCut}
            className={`aspect-square rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all active:scale-95 touch-manipulation ${hasCut
              ? 'bg-secondary/20 border-secondary/60 text-secondary'
              : 'bg-surface-muted/60 border-accent/20 text-main'
              }`}
            aria-pressed={hasCut}
            aria-label={hasCut ? `Relock cut at position ${cutIndex}` : `Lock cut at position ${cutIndex}`}
          >
            <Scissors className={`w-8 h-8 ${hasCut ? 'text-secondary' : 'text-accent'}`} />
            <span className="text-sm font-semibold">{hasCut ? 'Relock' : 'Lock'}</span>
            <span className="text-xs opacity-70">{hasCut ? 'Adjust or relock anytime' : `Cut #${cutIndex}`}</span>
          </button>
        </div>

        {/* Mobile Cut Position Slider */}
        <div className="rounded-2xl border border-accent/20 bg-surface/60 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="mobile-cut-range" className="text-xs text-muted">
              Slide to choose cut position
            </label>
            <span className="text-sm font-semibold text-secondary">#{cutIndex}</span>
          </div>
          <input
            id="mobile-cut-range"
            type="range"
            min={0}
            max={sliderMax}
            value={cutIndex}
            onChange={event => setCutIndex(parseInt(event.target.value, 10))}
            className="w-full cursor-pointer appearance-none touch-manipulation"
            aria-label="Cut position"
            aria-valuetext={`Cut position ${cutIndex} of ${deckSize}`}
            style={{ accentColor: 'var(--brand-accent)' }}
          />
          <div className="mt-1 flex items-center justify-between text-[0.65rem] text-muted">
            <span>Top (0)</span>
            <span>Bottom ({sliderMax})</span>
          </div>
          {hasCut && (
            <p className="mt-2 text-[0.65rem] text-secondary/80">
              Adjust the slider and tap &ldquo;Relock cut&rdquo; whenever you need to fine-tune.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 text-center mt-4 sm:mt-0">
        <div className="relative" ref={skipPromptRef}>
          <button
            type="button"
            onClick={() => setShowSkipConfirm(show => !show)}
            className="text-[0.68rem] uppercase tracking-[0.35em] text-accent/80 underline decoration-accent/60 underline-offset-4 transition hover:text-main"
            aria-haspopup="dialog"
            aria-expanded={showSkipConfirm}
          >
            Skip
          </button>
          {showSkipConfirm && (
            <div
              role="dialog"
              aria-label="Skip ritual confirmation"
              className="absolute left-1/2 top-full mt-2 w-64 -translate-x-1/2 rounded-2xl border border-accent/40 bg-surface/95 p-4 text-xs sm:text-sm text-main shadow-lg"
            >
              <p className="font-semibold text-accent">Skip?</p>
              <p className="text-muted mt-1">Draw immediately without ritual.</p>
              <div className="mt-3 flex items-center justify-end gap-2 text-[0.8rem]">
                <button
                  type="button"
                  onClick={() => setShowSkipConfirm(false)}
                  className="text-accent/80 hover:text-main"
                >
                  Stay here
                </button>
                <button
                  type="button"
                  onClick={confirmSkip}
                  className="text-secondary hover:text-secondary/80 font-semibold"
                >
                  Skip & draw
                </button>
              </div>
            </div>
          )}
        </div>
        {isNewbie && (
          <p className="text-[0.72rem] text-muted">
            You can adjust or hide these steps anytime in Settings → Personalization.
          </p>
        )}
      </div>

      {deckAnnouncement && (
        <p className="sr-only" aria-live="polite">
          {deckAnnouncement}
        </p>
      )}
    </div>
  );
}
