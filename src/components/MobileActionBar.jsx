import { useMemo } from 'react';
import { Gear, Sparkle, ArrowsClockwise } from '@phosphor-icons/react';
import { useLandscape } from '../hooks/useLandscape';

// Shared button styles - reduced height in landscape while maintaining touch target
const BTN_BASE = 'inline-flex items-center justify-center rounded-xl font-semibold transition touch-manipulation';
const BTN_PRIMARY = `${BTN_BASE} bg-accent text-surface shadow-lg hover:opacity-90`;
const BTN_SECONDARY = `${BTN_BASE} bg-surface-muted text-accent border border-accent/30 hover:bg-surface`;
const BTN_TERTIARY = `${BTN_BASE} bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30`;
const BTN_COACH = `${BTN_BASE} bg-secondary/20 text-secondary border border-secondary/40 hover:bg-secondary/30`;

const STEP_BADGES = {
  spread: 'Step 1',
  intention: 'Step 2',
  ritual: 'Step 3',
  reading: 'Step 4'
};

/**
 * Determines which action mode the mobile bar should display
 */
export function getActionMode({ isShuffling, reading, revealedCount, allRevealed, needsNarrative, hasNarrative, isGenerating, isError }) {
  if (isShuffling) return 'shuffling';
  if (!reading) return 'preparation';
  if (!allRevealed) return 'revealing';
  if (needsNarrative && isGenerating) return 'generating';
  if (needsNarrative && isError) return 'error';
  if (needsNarrative) return 'ready-for-narrative';
  if (hasNarrative) return 'completed';
  return 'completed';
}

function ActionButton({
  onClick,
  disabled,
  variant = 'primary',
  stepLabel,
  children,
  ariaLabel,
  icon: Icon,
  className = '',
  isLandscape = false
}) {
  const variantClass = {
    primary: BTN_PRIMARY,
    secondary: BTN_SECONDARY,
    tertiary: BTN_TERTIARY,
    coach: BTN_COACH
  }[variant] || BTN_PRIMARY;

  // In landscape: hide step labels, use compact height
  const showStepLabel = Boolean(stepLabel) && !isLandscape;
  const heightClass = isLandscape ? 'min-h-[40px]' : 'min-h-[44px]';
  const textSize = isLandscape ? 'text-xs' : 'text-sm';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`
        ${variantClass}
        ${heightClass}
        ${showStepLabel ? 'flex-col gap-0.5' : 'gap-1.5'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {Icon && !showStepLabel && <Icon className={isLandscape ? 'w-3.5 h-3.5' : 'w-4 h-4'} weight="fill" aria-hidden="true" />}
      {showStepLabel && (
        <span className="text-xs uppercase tracking-wider opacity-70">{stepLabel}</span>
      )}
      <span className={`${textSize} font-semibold`}>{children}</span>
    </button>
  );
}

function MobileActionContents({
  isShuffling,
  reading,
  revealedCards,
  dealIndex = 0,
  isGenerating,
  personalReading,
  needsNarrativeGeneration,
  stepIndicatorLabel,
  activeStep = 'spread',
  onOpenSettings,
  onOpenCoach,
  onShuffle,
  onDealNext,
  onRevealAll,
  onGenerateNarrative,
  onSaveReading,
  onNewReading,
  variant = 'fixed',
  showUtilityButtons = true
}) {
  const isLandscape = useLandscape();
  const readingLength = reading?.length || 0;
  const revealedCount = revealedCards?.size || 0;
  const allRevealed = readingLength > 0 && revealedCount === readingLength;
  const hasNarrative = Boolean(personalReading && !personalReading.isError);
  const isError = Boolean(personalReading?.isError);
  // Preserve the ability to retry even if upstream flags temporarily clear needsNarrativeGeneration
  const needsNarrative = needsNarrativeGeneration || isError;
  const stepBadge = STEP_BADGES[activeStep] || 'Step';

  const mode = useMemo(() => getActionMode({
    isShuffling,
    reading,
    revealedCount,
    allRevealed,
    needsNarrative,
    hasNarrative,
    isGenerating,
    isError
  }), [isShuffling, reading, revealedCount, allRevealed, needsNarrative, hasNarrative, isGenerating, isError]);

  // In landscape: tighter layout with smaller gaps
  const layoutClass = variant === 'inline'
    ? 'flex flex-col gap-2 w-full'
    : isLandscape
      ? 'flex flex-wrap gap-1.5'
      : 'flex flex-wrap gap-2';

  return (
    <div className={layoutClass}>
      {renderActions(mode, {
        variant,
        showUtilityButtons,
        readingLength,
        dealIndex,
        stepBadge,
        stepIndicatorLabel,
        hasNarrative,
        isLandscape,
        onOpenSettings,
        onOpenCoach,
        onShuffle,
        onDealNext,
        onRevealAll,
        onGenerateNarrative,
        onSaveReading,
        onNewReading
      })}
    </div>
  );
}

function withStepContext(label, stepIndicatorLabel) {
  if (!stepIndicatorLabel) return label;
  return `${label} — ${stepIndicatorLabel}`;
}

function renderActions(mode, options) {
  const {
    variant,
    showUtilityButtons,
    readingLength,
    dealIndex,
    stepBadge,
    stepIndicatorLabel,
    hasNarrative,
    isLandscape,
    onOpenSettings,
    onOpenCoach,
    onShuffle,
    onDealNext,
    onRevealAll,
    onGenerateNarrative,
    onSaveReading,
    onNewReading
  } = options;

  // In landscape: smaller minimum widths to fit more buttons
  const widthClasses = {
    primary: variant === 'inline' ? 'w-full' : isLandscape ? 'flex-1 min-w-[5.5rem]' : 'flex-1 min-w-[7.5rem]',
    prepPrimary: variant === 'inline' ? 'w-full' : isLandscape ? 'flex-1 min-w-[4.5rem]' : 'flex-1 min-w-[6rem]',
    secondary: variant === 'inline' ? 'w-full' : isLandscape ? 'flex-1 min-w-[5.5rem]' : 'flex-1 min-w-[7.5rem]',
    tertiary: variant === 'inline' ? 'w-full' : isLandscape ? 'flex-1 min-w-[5.5rem]' : 'flex-1 min-w-[7.5rem]',
    icon: variant === 'inline' ? 'w-full' : isLandscape ? 'flex-none w-[2.5rem]' : 'flex-none w-[3rem]',
    coach: variant === 'inline' ? 'w-full' : 'flex-none'
  };

  // Padding classes: smaller in landscape
  const px = isLandscape ? 'px-2' : 'px-3';

  switch (mode) {
    case 'shuffling': {
      const label = isLandscape ? 'Shuffling' : 'Shuffling';
      return (
        <ActionButton
          variant="primary"
          disabled
          stepLabel={stepBadge}
          ariaLabel={withStepContext(label, stepIndicatorLabel)}
          className={`${widthClasses.primary} ${px}`}
          isLandscape={isLandscape}
        >
          <span className="flex items-center gap-1.5">
            <ArrowsClockwise className={isLandscape ? 'w-3.5 h-3.5 animate-spin' : 'w-4 h-4 animate-spin'} aria-hidden="true" />
            {label}...
          </span>
        </ActionButton>
      );
    }

    case 'preparation': {
      const drawLabel = isLandscape ? 'Draw' : 'Draw cards';
      return (
        <>
          {showUtilityButtons && (
            <ActionButton
              variant="secondary"
              onClick={onOpenSettings}
              ariaLabel="Open settings"
              className={`${widthClasses.icon} ${variant === 'inline' ? px : 'px-0'}`}
              isLandscape={isLandscape}
            >
              <Gear className={isLandscape ? 'w-4 h-4' : 'w-5 h-5'} />
            </ActionButton>
          )}
          {showUtilityButtons && (
            <ActionButton
              variant="coach"
              onClick={onOpenCoach}
              icon={Sparkle}
              ariaLabel="Open guided intention coach"
              className={`${widthClasses.coach} ${px}`}
              isLandscape={isLandscape}
            >
              {isLandscape ? 'Coach' : 'Coach'}
            </ActionButton>
          )}
          <ActionButton
            variant="primary"
            onClick={onShuffle}
            stepLabel={stepBadge}
            ariaLabel={withStepContext(drawLabel, stepIndicatorLabel)}
            className={`${widthClasses.prepPrimary} ${px}`}
            isLandscape={isLandscape}
          >
            {drawLabel}
          </ActionButton>
        </>
      );
    }

    case 'revealing': {
      const nextLabel = isLandscape
        ? `Next (${Math.min(dealIndex + 1, readingLength)}/${readingLength})`
        : `Reveal next (${Math.min(dealIndex + 1, readingLength)}/${readingLength})`;
      const revealAllLabel = isLandscape ? 'All' : 'Reveal all';
      return (
        <>
          <ActionButton
            variant="primary"
            onClick={onDealNext}
            stepLabel={stepBadge}
            ariaLabel={withStepContext(nextLabel, stepIndicatorLabel)}
            className={`${widthClasses.primary} ${px}`}
            isLandscape={isLandscape}
          >
            {nextLabel}
          </ActionButton>
          {readingLength > 1 && (
            <ActionButton
              variant="tertiary"
              onClick={onRevealAll}
              ariaLabel={withStepContext('Reveal all cards', stepIndicatorLabel)}
              className={`${widthClasses.tertiary} ${px}`}
              isLandscape={isLandscape}
            >
              {revealAllLabel}
            </ActionButton>
          )}
        </>
      );
    }

    case 'generating':
      return (
        <>
          <ActionButton
            variant="primary"
            disabled
            stepLabel={stepBadge}
            ariaLabel={withStepContext('Narrative in progress', stepIndicatorLabel)}
            className={`${widthClasses.primary} ${px}`}
            isLandscape={isLandscape}
          >
            <span className="flex items-center gap-1.5">
              <ArrowsClockwise className={isLandscape ? 'w-3.5 h-3.5 animate-spin' : 'w-4 h-4 animate-spin'} aria-hidden="true" />
              {isLandscape ? 'Weaving' : 'Weaving...'}
            </span>
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={onNewReading}
            ariaLabel="Start a new reading (resets the current spread)"
            className={`${widthClasses.secondary} ${px}`}
            isLandscape={isLandscape}
          >
            {isLandscape ? 'New' : 'New reading'}
          </ActionButton>
        </>
      );

    case 'error':
      return (
        <>
          <ActionButton
            variant="primary"
            onClick={onGenerateNarrative}
            stepLabel={stepBadge}
            icon={ArrowsClockwise}
            ariaLabel={withStepContext('Retry narrative generation', stepIndicatorLabel)}
            className={`${widthClasses.primary} ${px}`}
            isLandscape={isLandscape}
          >
            {isLandscape ? 'Retry' : 'Retry narrative'}
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={onNewReading}
            ariaLabel="Start a new reading (resets the current spread)"
            className={`${widthClasses.secondary} ${px}`}
            isLandscape={isLandscape}
          >
            {isLandscape ? 'New' : 'New reading'}
          </ActionButton>
        </>
      );

    case 'ready-for-narrative':
      return (
        <>
          <ActionButton
            variant="primary"
            onClick={onGenerateNarrative}
            stepLabel={stepBadge}
            ariaLabel={withStepContext('Create narrative', stepIndicatorLabel)}
            className={`${widthClasses.primary} ${px}`}
            isLandscape={isLandscape}
          >
            {isLandscape ? 'Create' : 'Create narrative'}
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={onNewReading}
            ariaLabel="Start a new reading (resets the current spread)"
            className={`${widthClasses.secondary} ${px}`}
            isLandscape={isLandscape}
          >
            {isLandscape ? 'New' : 'New reading'}
          </ActionButton>
        </>
      );

    case 'completed':
      return (
        <>
          {hasNarrative && (
            <ActionButton
              variant="primary"
              onClick={onSaveReading}
              stepLabel={stepBadge}
              ariaLabel={withStepContext('Save reading to journal', stepIndicatorLabel)}
              className={`${widthClasses.primary} ${px}`}
              isLandscape={isLandscape}
            >
              {isLandscape ? 'Save' : 'Save reading'}
            </ActionButton>
          )}
          <ActionButton
            variant="secondary"
            onClick={onNewReading}
            ariaLabel="Start a new reading (resets the current spread)"
            className={`${widthClasses.secondary} ${px}`}
            isLandscape={isLandscape}
          >
            {isLandscape ? 'New' : 'New reading'}
          </ActionButton>
        </>
      );

    default:
      return null;
  }
}

export function MobileActionBar({ keyboardOffset = 0, ...props }) {
  return (
    <nav
      className="mobile-action-bar sm:hidden"
      aria-label="Primary mobile actions"
      style={keyboardOffset > 0 ? { bottom: keyboardOffset } : undefined}
    >
      <MobileActionContents {...props} />
    </nav>
  );
}

export function MobileActionGroup({ showUtilityButtons = false, ...props }) {
  return (
    <div className="mobile-action-group sm:hidden" aria-label="Inline mobile actions">
      <MobileActionContents variant="inline" showUtilityButtons={showUtilityButtons} {...props} />
    </div>
  );
}
