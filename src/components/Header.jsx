import { ArrowCounterClockwise, Gear } from '@phosphor-icons/react';
import { GlobalNav } from './GlobalNav';
import { StepProgress } from './StepProgress';
import { useResponsiveSticky } from '../hooks/useResponsiveSticky';

/** Global destinations stay available while the reader moves through the ritual. */
export function Header({
  steps,
  activeStep,
  onStepSelect,
  isShuffling,
  minimalNav = false,
  readingView = false,
  installInMenu = false,
  onOpenReadingSettings
}) {
  const stickyRef = useResponsiveSticky(true, { rootVar: '--pinned-header-height' });

  return (
    <header
      ref={stickyRef}
      aria-labelledby="tableau-heading"
      className={['header-sticky tableu-header full-bleed', minimalNav && 'tableu-header--focused'].filter(Boolean).join(' ')}
    >
      <h1 id="tableau-heading" className="sr-only">Tableu</h1>
      <div className="tableu-header__inner">
        <GlobalNav condensed withUserChip installInMenu={installInMenu} />
        <div className="tableu-header__progress reading-step-nav">
          <StepProgress
            steps={steps}
            activeStep={activeStep}
            onSelect={onStepSelect}
            condensed
            readingView={readingView}
            quiet
          />
          {readingView && onOpenReadingSettings && (
            <button
              type="button"
              className="reading-settings"
              aria-label="Reading settings"
              onClick={onOpenReadingSettings}
            >
              <Gear size={21} aria-hidden="true" />
            </button>
          )}
        </div>
        {isShuffling && (
          <div className="tableu-header__status" role="status" aria-live="polite">
            <ArrowCounterClockwise className="w-4 h-4 motion-safe:animate-spin" aria-hidden="true" />
            <span>Shuffling the deck...</span>
          </div>
        )}
      </div>
    </header>
  );
}
