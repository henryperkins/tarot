import { Star, Check, ArrowLeft } from '@phosphor-icons/react';
import { SPREADS } from '../../../data/spreads';
import { usePreferences } from '../../../contexts/PreferencesContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useLandscape } from '../../../hooks/useLandscape';

/**
 * BeginStep - Quick confirmation and launch
 *
 * Shows a celebratory confirmation screen with a summary of
 * user selections before starting the reading.
 * Target completion: 5-10 seconds.
 */
export function BeginStep({ selectedSpread, question, onBegin, onBack }) {
  const { personalization } = usePreferences();
  const { isAuthenticated } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();

  const spread = SPREADS[selectedSpread];
  const toneLabelMap = {
    gentle: 'Gentle',
    balanced: 'Balanced',
    blunt: 'Blunt'
  };
  const lensLabelMap = {
    psychological: 'Psychological',
    spiritual: 'Spiritual',
    mixed: 'Both lenses',
    playful: 'Playful'
  };
  const toneLabel = toneLabelMap[personalization.readingTone] || 'Balanced';
  const lensValue = personalization.spiritualFrame || 'mixed';
  const lensLabel = `${lensLabelMap[lensValue] || 'Mixed'}${lensValue === 'mixed' ? ' (default)' : ''}`;
  const hasQuestion = question?.trim().length > 0;

  return (
    <div className="flex flex-col h-full items-center justify-center text-center">
      {/* Celebration icon */}
      <div
        className={`${isLandscape ? 'mb-4' : 'mb-6'} ${
          prefersReducedMotion ? '' : 'animate-fade-in-up'
        }`}
      >
        <Star
          className={`text-gold ${isLandscape ? 'w-16 h-16' : 'w-20 h-20'}`}
          weight="duotone"
          aria-hidden="true"
        />
      </div>

      {/* Ready message */}
      <div
        className={prefersReducedMotion ? '' : 'animate-fade-in-up'}
        style={{ animationDelay: '0.1s' }}
      >
        <h2 className={`font-serif text-main ${isLandscape ? 'text-xl mb-1' : 'text-2xl mb-2'}`}>
          You&apos;re Ready
        </h2>
        <p className={`text-muted max-w-xs mx-auto ${isLandscape ? 'text-sm' : ''}`}>
          Stay open to what feels true. The cards will meet you where you are.
        </p>
      </div>

      {/* Quick summary - minimal */}
      <div
        className={`${isLandscape ? 'mt-4' : 'mt-6'} rounded-xl border border-accent/20 bg-surface/50 p-4 w-full max-w-sm text-left ${
          prefersReducedMotion ? '' : 'animate-fade-in-up'
        }`}
        style={{ animationDelay: '0.2s' }}
      >
        <h3 className="text-xs uppercase tracking-widest text-accent mb-2">Quick recap</h3>
        <div className="flex items-center gap-2 text-sm mb-2">
          <Check className="w-4 h-4 text-accent shrink-0" weight="bold" aria-hidden="true" />
          <span className="text-muted">
            {spread?.name || 'Your spread'} · {toneLabel} tone
          </span>
        </div>
        <div className="flex flex-wrap gap-2 pl-6 text-xs text-muted">
          <span className="rounded-full bg-surface/70 border border-secondary/20 px-2 py-1">
            Lens: {lensLabel}
          </span>
          <span className="rounded-full bg-surface/70 border border-secondary/20 px-2 py-1">
            {isAuthenticated ? 'Journal: Synced to your account' : 'Journal: Local unless Sync is on'}
          </span>
        </div>
        {hasQuestion && (
          <p className="text-xs text-muted italic line-clamp-2 pl-6 mt-2">
            &ldquo;{question}&rdquo;
          </p>
        )}
        <p className="mt-3 text-xs text-muted pl-6">Change anytime via Menu &gt; Replay Tutorial.</p>
      </div>

      {/* Actions */}
      <div
        className={`w-full max-w-sm ${isLandscape ? 'mt-4 space-y-2' : 'mt-8 space-y-3'}`}
      >
        <button
          type="button"
          onClick={onBegin}
          className={`w-full rounded-xl bg-accent text-surface font-bold transition hover:bg-accent/90 active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main ${
            isLandscape ? 'min-h-cta text-base' : 'min-h-nav text-lg'
          }`}
        >
          Begin Reading
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full min-h-touch py-3 text-muted text-sm flex items-center justify-center gap-1 transition hover:text-main motion-reduce:transition-none motion-reduce:transform-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl"
        >
          <ArrowLeft className="w-4 h-4" weight="bold" aria-hidden="true" />
          Go back
        </button>
      </div>
    </div>
  );
}
