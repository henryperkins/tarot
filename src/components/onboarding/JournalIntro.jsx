import { ArrowLeft, ArrowRight, Notebook, ClockCounterClockwise, Sparkle, MagnifyingGlass, PencilLine, CloudCheck, HardDrive, UserPlus, Info } from '@phosphor-icons/react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useLandscape } from '../../hooks/useLandscape';
import { useAuth } from '../../contexts/AuthContext';
import { Tooltip } from '../Tooltip';

/**
 * JournalIntro - Step 6 of onboarding
 *
 * Introduces the journal feature and explains its benefits.
 * Shows sync status based on authentication state.
 */
export function JournalIntro({ onNext, onBack, onGoToStep }) {
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();
  const { isAuthenticated } = useAuth();
  const infoButtonClass =
    'inline-flex min-w-touch min-h-touch items-center justify-center rounded-full text-muted/60 transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 touch-manipulation -ml-2 -mr-3';

  const journalBenefits = [
    {
      icon: ClockCounterClockwise,
      title: 'Track patterns across readings',
      description: 'See recurring themes and symbols emerge over time',
    },
    {
      icon: MagnifyingGlass,
      title: 'Revisit past insights anytime',
      description: 'Search and browse your complete reading history',
    },
    {
      icon: Sparkle,
      title: 'Watch your understanding deepen',
      description: 'Notice how your interpretations evolve with practice',
    },
    {
      icon: PencilLine,
      title: 'Add personal reflections',
      description: 'Capture your own thoughts alongside each reading',
    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className={`text-center mb-4 sm:mb-6 ${prefersReducedMotion ? '' : 'animate-fade-in-up'}`}
      >
        <h2 className={`font-serif text-main ${isLandscape ? 'text-xl' : 'text-2xl sm:text-3xl'}`}>
          Your Tarot Journal
        </h2>
        <p className={`text-muted mt-2 max-w-md mx-auto ${isLandscape ? 'text-sm' : ''}`}>
          A personal space to collect and reflect on your readings.
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6">
        {/* Visual preview */}
        <div
          className={`flex justify-center ${prefersReducedMotion ? '' : 'animate-fade-in-up'}`}
          style={{ animationDelay: '0.1s' }}
        >
          <div className="relative">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-accent/20 to-primary/20 border border-accent/30 flex items-center justify-center">
              <Notebook
                className="w-12 h-12 sm:w-14 sm:h-14 text-accent"
                weight="duotone"
                aria-hidden="true"
              />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center">
              <Sparkle className="w-4 h-4 text-gold" weight="fill" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Benefits list */}
        <div
          className={`space-y-3 ${prefersReducedMotion ? '' : 'animate-fade-in-up'} ${
            isLandscape ? 'grid grid-cols-2 gap-3 space-y-0' : ''
          }`}
          style={{ animationDelay: '0.2s' }}
        >
          {journalBenefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={index}
                className="flex items-start gap-3 p-4 rounded-xl border border-secondary/20 bg-surface/50"
              >
                <div className="w-10 h-10 shrink-0 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-accent" weight="duotone" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-main">{benefit.title}</h3>
                  {!isLandscape && (
                    <p className="text-xs text-muted mt-0.5">{benefit.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sync status */}
        <div
          className={`rounded-2xl border p-4 ${
            isAuthenticated
              ? 'border-success/30 bg-success/5'
              : 'border-secondary/20 bg-surface/30'
          } ${prefersReducedMotion ? '' : 'animate-fade-in-up'}`}
          style={{ animationDelay: '0.3s' }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Journal storage</p>
            <Tooltip
              content="Local stays on this device. Sync stores a copy in your account."
              position="top"
              triggerClassName={infoButtonClass}
              ariaLabel="About journal storage"
            >
              <Info className="h-3.5 w-3.5" />
            </Tooltip>
          </div>
          <p className="text-xs text-muted mb-3">Local on this device unless Sync is on.</p>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <div className="w-10 h-10 shrink-0 rounded-full bg-success/20 flex items-center justify-center">
                  <CloudCheck className="w-5 h-5 text-success" weight="fill" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium text-main">Synced to your account</p>
                  <p className="text-xs text-muted">Your journal is backed up and accessible anywhere</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 shrink-0 rounded-full bg-secondary/20 flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-muted" weight="duotone" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium text-main">Local on this device</p>
                  <p className="text-xs text-muted">
                    Your journal stays private on this browser.
                  </p>
                  {onGoToStep && (
                    <button
                      type="button"
                      onClick={() => onGoToStep(2)}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition touch-manipulation"
                    >
                      <UserPlus className="w-3.5 h-3.5" weight="bold" aria-hidden="true" />
                      Create free account to sync
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className={`flex gap-3 pt-4 pb-safe ${isLandscape ? 'pt-2' : 'pt-6'}`}>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center gap-1 min-h-cta px-4 py-3 rounded-xl border border-secondary/40 text-muted hover:text-main hover:border-secondary/60 transition motion-reduce:transition-none motion-reduce:transform-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-main"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden xs:inline">Back</span>
        </button>
        <button
          type="button"
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 min-h-cta px-6 py-3 rounded-xl bg-accent text-surface font-semibold text-base transition hover:bg-accent/90 active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main"
        >
          {isAuthenticated ? 'Start your first reading' : 'Continue'}
          <ArrowRight className="w-5 h-5" weight="bold" />
        </button>
      </div>
    </div>
  );
}
