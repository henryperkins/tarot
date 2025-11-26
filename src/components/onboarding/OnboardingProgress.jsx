import { Check } from '@phosphor-icons/react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const STEP_LABELS = [
  'Welcome',
  'Spreads',
  'Question',
  'Ritual',
  'Account',
  'Journal',
  'Begin',
];

/**
 * OnboardingProgress - Progress indicator for onboarding wizard
 *
 * Shows current step and allows navigation to previously visited steps.
 * Mobile-compact design with dots, expanding to labels on larger screens.
 */
export function OnboardingProgress({
  currentStep,
  totalSteps,
  onStepSelect,
  allowNavigation = true,
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="flex-1">
      {/* Mobile: compact dots */}
      <nav
        className="flex items-center gap-2 sm:hidden"
        aria-label="Onboarding progress"
      >
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1;
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;
          const isAccessible = allowNavigation && step <= currentStep;

          return (
            <button
              key={step}
              type="button"
              onClick={() => isAccessible && onStepSelect?.(step)}
              disabled={!isAccessible}
              className={`relative w-8 h-8 rounded-full flex items-center justify-center transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main ${
                isCurrent
                  ? 'bg-accent text-surface'
                  : isCompleted
                  ? 'bg-accent/20 text-accent'
                  : 'bg-surface-muted text-muted'
              } ${isAccessible && !isCurrent ? 'hover:bg-accent/30' : ''} ${
                !isAccessible ? 'cursor-not-allowed opacity-50' : ''
              }`}
              aria-label={`Step ${step}: ${STEP_LABELS[i] || `Step ${step}`}${
                isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''
              }`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {isCompleted ? (
                <Check className="w-4 h-4" weight="bold" />
              ) : (
                <span className="text-xs font-semibold">{step}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Desktop: labels with connecting line */}
      <nav
        className="hidden sm:flex items-center gap-1"
        aria-label="Onboarding progress"
      >
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1;
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;
          const isAccessible = allowNavigation && step <= currentStep;
          const isLast = step === totalSteps;

          return (
            <div key={step} className="flex items-center">
              <button
                type="button"
                onClick={() => isAccessible && onStepSelect?.(step)}
                disabled={!isAccessible}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main ${
                  isCurrent
                    ? 'bg-accent text-surface'
                    : isCompleted
                    ? 'bg-accent/10 text-accent hover:bg-accent/20'
                    : 'text-muted'
                } ${!isAccessible ? 'cursor-not-allowed opacity-50' : ''}`}
                aria-label={`${STEP_LABELS[i] || `Step ${step}`}${
                  isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''
                }`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold ${
                    isCurrent
                      ? 'bg-surface/20 text-surface'
                      : isCompleted
                      ? 'bg-accent/20 text-accent'
                      : 'bg-surface-muted/50 text-muted'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-3 h-3" weight="bold" />
                  ) : (
                    step
                  )}
                </span>
                <span className="text-xs font-medium">{STEP_LABELS[i]}</span>
              </button>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={`w-4 h-px mx-1 ${
                    isCompleted ? 'bg-accent/40' : 'bg-secondary/20'
                  } ${prefersReducedMotion ? '' : 'transition-colors duration-300'}`}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
