import { ArrowLeft, ArrowRight, Hand, Scissors, Sparkle, Lightbulb } from '@phosphor-icons/react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useLandscape } from '../../hooks/useLandscape';

/**
 * RitualIntro - Step 4 of onboarding
 *
 * Explains the optional ritual mechanics (knock and cut)
 * and their symbolic meaning.
 */
export function RitualIntro({ onNext, onBack, onSkipRitual }) {
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className={`text-center mb-4 sm:mb-6 ${prefersReducedMotion ? '' : 'animate-fade-in-up'}`}
      >
        <h2 className={`font-serif text-main ${isLandscape ? 'text-xl' : 'text-2xl sm:text-3xl'}`}>
          The Ritual (Optional)
        </h2>
        <p className={`text-muted mt-2 max-w-md mx-auto ${isLandscape ? 'text-sm' : ''}`}>
          A mindful moment to connect with the deck before your reading.
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6">
        {/* Introduction */}
        <div
          className={`text-center ${prefersReducedMotion ? '' : 'animate-fade-in-up'}`}
          style={{ animationDelay: '0.1s' }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-sm text-accent">
            <Sparkle className="w-4 h-4" weight="fill" />
            Adds meaning, not magic
          </div>
        </div>

        {/* Ritual steps */}
        <div
          className={`grid gap-4 ${isLandscape ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}
        >
          {/* Knock */}
          <div
            className={`rounded-2xl border border-accent/20 bg-surface/50 p-5 ${
              prefersReducedMotion ? '' : 'animate-fade-in-up'
            }`}
            style={{ animationDelay: '0.2s' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
                <Hand className="w-6 h-6 text-accent" weight="duotone" />
              </div>
              <div>
                <h3 className="font-serif text-main text-lg">Knock</h3>
                <p className="text-xs text-accent">Step 1</p>
              </div>
            </div>
            <p className={`text-muted leading-relaxed ${isLandscape ? 'text-sm' : ''}`}>
              Tap the deck to signal your intention. Each knock adds a bit of randomness to how
              cards are shuffled — your personal touch on the reading.
            </p>
            <div className="mt-3 pt-3 border-t border-secondary/20">
              <p className="text-xs text-muted italic flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5 text-accent shrink-0" weight="fill" />
                Symbolizes: &quot;I&apos;m ready to receive guidance.&quot;
              </p>
            </div>
          </div>

          {/* Cut */}
          <div
            className={`rounded-2xl border border-accent/20 bg-surface/50 p-5 ${
              prefersReducedMotion ? '' : 'animate-fade-in-up'
            }`}
            style={{ animationDelay: '0.3s' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
                <Scissors className="w-6 h-6 text-accent" weight="duotone" />
              </div>
              <div>
                <h3 className="font-serif text-main text-lg">Cut</h3>
                <p className="text-xs text-accent">Step 2</p>
              </div>
            </div>
            <p className={`text-muted leading-relaxed ${isLandscape ? 'text-sm' : ''}`}>
              Choose where to split the deck. This determines the starting point for your draw —
              your intuition guiding which cards surface.
            </p>
            <div className="mt-3 pt-3 border-t border-secondary/20">
              <p className="text-xs text-muted italic flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5 text-accent shrink-0" weight="fill" />
                Symbolizes: &quot;I trust my inner wisdom.&quot;
              </p>
            </div>
          </div>
        </div>

        {/* Why ritual matters - collapsed in landscape */}
        {!isLandscape && (
          <div
            className={`rounded-xl border border-secondary/20 bg-surface/30 p-4 ${
              prefersReducedMotion ? '' : 'animate-fade-in-up'
            }`}
            style={{ animationDelay: '0.4s' }}
          >
            <h4 className="text-sm font-medium text-main mb-2">Why include a ritual?</h4>
            <p className="text-xs text-muted leading-relaxed">
              The ritual isn&apos;t about mystical powers — it&apos;s about{' '}
              <strong className="text-main">creating space</strong> for reflection. Taking a
              moment to knock and cut helps you transition from daily busyness into a more
              contemplative state, making the reading feel more personal and meaningful.
            </p>
          </div>
        )}

        {/* Note about skipping */}
        <div
          className={`text-center ${prefersReducedMotion ? '' : 'animate-fade-in-up'}`}
          style={{ animationDelay: '0.5s' }}
        >
          <p className="text-xs text-muted">
            You can always skip the ritual and go straight to drawing cards.
            <br />
            The AI reading works the same either way.
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className={`flex flex-col gap-3 pt-4 pb-safe-bottom ${isLandscape ? 'pt-2' : 'pt-6'}`}>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center gap-1 min-h-[48px] px-4 py-3 rounded-xl border border-secondary/40 text-muted hover:text-main hover:border-secondary/60 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-main"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden xs:inline">Back</span>
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex-1 flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-xl bg-accent text-surface font-semibold text-base transition hover:bg-accent/90 active:scale-[0.98] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main"
          >
            I understand — continue
            <ArrowRight className="w-5 h-5" weight="bold" />
          </button>
        </div>
        <button
          type="button"
          onClick={onSkipRitual}
          className="w-full min-h-[44px] px-4 py-2 text-muted hover:text-main text-sm transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-main"
        >
          Skip and start reading
        </button>
      </div>
    </div>
  );
}
