import { useMemo } from 'react';
import { Gear, Sparkle, ArrowsClockwise } from '@phosphor-icons/react';

// Shared button styles
const BTN_BASE = 'min-h-[44px] inline-flex items-center justify-center rounded-xl text-sm font-semibold transition touch-manipulation';
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
  className = ''
}) {
  const variantClass = {
    primary: BTN_PRIMARY,
    secondary: BTN_SECONDARY,
    tertiary: BTN_TERTIARY,
    coach: BTN_COACH
  }[variant] || BTN_PRIMARY;

  const hasStepLabel = Boolean(stepLabel);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`
        ${variantClass}
        ${hasStepLabel ? 'flex-col gap-0.5' : 'gap-1.5'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {Icon && !hasStepLabel && <Icon className="w-4 h-4" weight="fill" aria-hidden="true" />}
      {stepLabel && (
        <span className="text-xs uppercase tracking-wider opacity-70">{stepLabel}</span>
      )}
      <span className="text-sm font-semibold">{children}</span>
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

  const layoutClass = variant === 'inline'
    ? 'flex flex-col gap-2 w-full'
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
    onOpenSettings,
    onOpenCoach,
    onShuffle,
    onDealNext,
    onRevealAll,
    onGenerateNarrative,
    onSaveReading,
    onNewReading
  } = options;

  const widthClasses = {
    primary: variant === 'inline' ? 'w-full' : 'flex-1 min-w-[7.5rem]',
    prepPrimary: variant === 'inline' ? 'w-full' : 'flex-1 min-w-[6rem]',
    secondary: variant === 'inline' ? 'w-full' : 'flex-1 min-w-[7.5rem]',
    tertiary: variant === 'inline' ? 'w-full' : 'flex-1 min-w-[7.5rem]',
    icon: variant === 'inline' ? 'w-full' : 'flex-none w-[3rem]',
    coach: variant === 'inline' ? 'w-full' : 'flex-none'
  };

  switch (mode) {
    case 'shuffling': {
      const label = 'Shuffling';
      return (
        <ActionButton
          variant="primary"
          disabled
          stepLabel={stepBadge}
          ariaLabel={withStepContext(label, stepIndicatorLabel)}
          className={`${widthClasses.primary} px-3`}
        >
          <span className="flex items-center gap-2">
            <ArrowsClockwise className="w-4 h-4 animate-spin" aria-hidden="true" />
            {label}...
          </span>
        </ActionButton>
      );
    }

    case 'preparation': {
      const drawLabel = 'Draw cards';
      return (
        <>
          {showUtilityButtons && (
            <ActionButton
              variant="secondary"
              onClick={onOpenSettings}
              ariaLabel="Open settings"
              className={`${widthClasses.icon} ${variant === 'inline' ? 'px-3' : 'px-0'}`}
            >
              <Gear className="w-5 h-5" />
            </ActionButton>
          )}
          {showUtilityButtons && (
            <ActionButton
              variant="coach"
              onClick={onOpenCoach}
              icon={Sparkle}
              ariaLabel="Open guided intention coach"
              className={`${widthClasses.coach} px-3`}
            >
              Coach
            </ActionButton>
          )}
          <ActionButton
            variant="primary"
            onClick={onShuffle}
            stepLabel={stepBadge}
            ariaLabel={withStepContext(drawLabel, stepIndicatorLabel)}
            className={`${widthClasses.prepPrimary} px-3`}
          >
            {drawLabel}
          </ActionButton>
        </>
      );
    }

    case 'revealing': {
      const nextLabel = `Reveal next (${Math.min(dealIndex + 1, readingLength)}/${readingLength})`;
      return (
        <>
          <ActionButton
            variant="primary"
            onClick={onDealNext}
            stepLabel={stepBadge}
            ariaLabel={withStepContext(nextLabel, stepIndicatorLabel)}
            className={`${widthClasses.primary} px-3`}
          >
            {nextLabel}
          </ActionButton>
          {readingLength > 1 && (
            <ActionButton
              variant="tertiary"
              onClick={onRevealAll}
              ariaLabel={withStepContext('Reveal all cards', stepIndicatorLabel)}
              className={`${widthClasses.tertiary} px-3`}
            >
              Reveal all
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
            className={`${widthClasses.primary} px-3`}
          >
            <span className="flex items-center gap-2">
              <ArrowsClockwise className="w-4 h-4 animate-spin" aria-hidden="true" />
              Weaving...
            </span>
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={onNewReading}
            ariaLabel="Start a new reading"
            className={`${widthClasses.secondary} px-3`}
          >
            New reading
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
            className={`${widthClasses.primary} px-3`}
          >
            Retry narrative
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={onNewReading}
            ariaLabel="Start a new reading"
            className={`${widthClasses.secondary} px-3`}
          >
            New reading
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
            className={`${widthClasses.primary} px-3`}
          >
            Create narrative
          </ActionButton>
          <ActionButton
            variant="secondary"
            onClick={onNewReading}
            ariaLabel="Start a new reading"
            className={`${widthClasses.secondary} px-3`}
          >
            New reading
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
              ariaLabel={withStepContext('Save to journal', stepIndicatorLabel)}
              className={`${widthClasses.primary} px-3`}
            >
              Save to journal
            </ActionButton>
          )}
          <ActionButton
            variant="secondary"
            onClick={onNewReading}
            ariaLabel="Start a new reading"
            className={`${widthClasses.secondary} px-3`}
          >
            New reading
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
