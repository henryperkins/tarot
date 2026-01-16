import { Star, Sparkle, ArrowLeft, Play, Lightbulb, Check, GearSix } from '@phosphor-icons/react';
import { SPREADS } from '../../data/spreads';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useLandscape } from '../../hooks/useLandscape';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useAuth } from '../../contexts/AuthContext';

// Labels for personalization options
const SPREAD_DEPTH_LABELS = {
  short: 'quick check-in',
  standard: 'balanced',
  deep: 'deep dive',
};

const READING_TONE_LABELS = {
  gentle: 'gentle',
  balanced: 'balanced',
  blunt: 'blunt',
};

const SPIRITUAL_FRAME_LABELS = {
  psychological: 'psychological',
  spiritual: 'spiritual',
  mixed: 'mixed',
  playful: 'playful',
};

const FOCUS_AREA_LABELS = {
  love: 'love & relationships',
  career: 'career & money',
  self_worth: 'self-worth',
  healing: 'healing & growth',
  creativity: 'creativity',
  spirituality: 'spiritual path',
};

/**
 * JourneyBegin - Step 7 of onboarding
 *
 * Final celebration step that summarizes selections
 * and shows personalization recap before launching the first reading.
 */
export function JourneyBegin({ selectedSpread, question, onBegin, onBack }) {
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();
  const { personalization } = usePreferences();
  const { isAuthenticated } = useAuth();

  const spread = SPREADS[selectedSpread];
  const hasQuestion = question && question.trim().length > 0;

  // Build focus areas label
  const focusAreasLabel = (personalization.focusAreas || [])
    .map((area) => FOCUS_AREA_LABELS[area])
    .join(', ');

  return (
    <div className="flex flex-col h-full">
      {/* Hero celebration */}
      <div className="flex-1 flex flex-col items-center justify-center text-center overflow-y-auto">
        {/* Animated stars/sparkles */}
        <div
          className={`relative mb-4 ${prefersReducedMotion ? '' : 'animate-fade-in-up'} ${
            isLandscape ? 'mb-2' : 'mb-6'
          }`}
          style={{ animationDelay: '0.1s' }}
        >
          <div className="relative">
            <Star
              className={`text-gold ${isLandscape ? 'w-14 h-14' : 'w-20 h-20 sm:w-24 sm:h-24'}`}
              weight="duotone"
              aria-hidden="true"
            />
            <Sparkle
              className="absolute -top-2 -right-1 w-6 h-6 text-accent"
              weight="fill"
              aria-hidden="true"
            />
            <Sparkle
              className="absolute bottom-0 -left-3 w-5 h-5 text-primary"
              weight="fill"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Encouraging message */}
        <div
          className={prefersReducedMotion ? '' : 'animate-fade-in-up'}
          style={{ animationDelay: '0.2s' }}
        >
          <h2
            className={`font-serif text-main mb-2 ${
              isLandscape ? 'text-xl' : 'text-2xl sm:text-3xl'
            }`}
          >
            You&apos;re Ready
          </h2>
          <p
            className={`text-muted max-w-md mx-auto leading-relaxed ${
              isLandscape ? 'text-sm' : 'text-base'
            }`}
          >
            Stay open to what feels true. The cards will meet you where you are.
          </p>
        </div>

        {/* Personalization recap */}
        <div
          className={`mt-4 w-full max-w-md ${
            prefersReducedMotion ? '' : 'animate-fade-in-up'
          } ${isLandscape ? 'mt-3' : 'mt-6 sm:mt-8'}`}
          style={{ animationDelay: '0.3s' }}
        >
          <div className="rounded-2xl border border-accent/30 bg-surface/60 backdrop-blur-sm p-4 sm:p-5 text-left">
            <h3 className="text-xs uppercase tracking-widest text-accent mb-3 flex items-center gap-2">
              <Sparkle className="w-3.5 h-3.5" weight="fill" />
              Quick recap
            </h3>

            <div className="space-y-2">
              {/* Display name */}
              <div className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" weight="bold" aria-hidden="true" />
                <span className="text-muted">
                  We&apos;ll call you{' '}
                  <span className="text-main font-medium">
                    {personalization.displayName || 'you'}
                  </span>
                </span>
              </div>

              {/* Spread depth */}
              <div className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" weight="bold" aria-hidden="true" />
                <span className="text-muted">
                  We&apos;ll start with{' '}
                  <span className="text-main font-medium">
                    {SPREAD_DEPTH_LABELS[personalization.preferredSpreadDepth] || 'balanced'}
                  </span>{' '}
                  readings
                </span>
              </div>

              {/* Focus areas */}
              <div className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" weight="bold" aria-hidden="true" />
                <span className="text-muted">
                  We&apos;ll focus on{' '}
                  <span className="text-main font-medium">
                    {focusAreasLabel || "whatever's on your mind"}
                  </span>
                </span>
              </div>

              {/* Reading tone and frame */}
              <div className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" weight="bold" aria-hidden="true" />
                <span className="text-muted">
                  Readings will be{' '}
                  <span className="text-main font-medium">
                    {READING_TONE_LABELS[personalization.readingTone] || 'honest but kind'}
                  </span>{' '}
                  with a{' '}
                  <span className="text-main font-medium">
                    {SPIRITUAL_FRAME_LABELS[personalization.spiritualFrame] || 'balanced'}
                  </span>{' '}
                  lens
                </span>
              </div>

              {/* Journal sync status */}
              <div className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" weight="bold" aria-hidden="true" />
                <span className="text-muted">
                  Journal:{' '}
                  <span className="text-main font-medium">
                    {isAuthenticated ? 'synced to your account' : 'local on this device'}
                  </span>
                  <span className="block text-xs text-muted mt-1">
                    Local on this device unless Sync is on.
                  </span>
                </span>
              </div>
            </div>

            {/* Settings note */}
            <p className="mt-3 pt-3 border-t border-secondary/20 text-xs text-muted flex items-center gap-1">
              <GearSix className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Change anytime via Menu &gt; Replay Tutorial.
            </p>
          </div>
        </div>

        {/* First reading info */}
        {!isLandscape && (
          <div
            className={`mt-4 w-full max-w-md rounded-xl border border-secondary/20 bg-surface/30 p-4 text-left ${
              prefersReducedMotion ? '' : 'animate-fade-in-up'
            }`}
            style={{ animationDelay: '0.4s' }}
          >
            <h4 className="text-xs uppercase tracking-widest text-muted mb-2">First Reading</h4>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Spread</span>
              <span className="text-sm text-main font-medium">
                {spread?.name || 'One-Card Insight'}
              </span>
            </div>
            {hasQuestion && (
              <p className="text-sm text-main italic mt-2 leading-relaxed">
                &quot;{question}&quot;
              </p>
            )}
          </div>
        )}

        {/* Tip */}
        {!isLandscape && (
          <p
            className={`mt-4 text-xs text-muted max-w-sm mx-auto flex items-start gap-1.5 ${
              prefersReducedMotion ? '' : 'animate-fade-in-up'
            }`}
            style={{ animationDelay: '0.5s' }}
          >
            <Lightbulb className="w-4 h-4 text-accent shrink-0 mt-0.5" weight="fill" />
            <span>
              <strong className="text-main">Tip:</strong> Take a breath before you draw. Let your
              mind settle on your question or simply be open to what appears.
            </span>
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className={`flex gap-3 pt-4 pb-safe-bottom ${isLandscape ? 'pt-2' : 'pt-6'}`}>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center gap-1 min-h-[48px] px-4 py-3 rounded-xl border border-secondary/40 text-muted hover:text-main hover:border-secondary/60 transition motion-reduce:transition-none motion-reduce:transform-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-main"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden xs:inline">Back</span>
        </button>
        <button
          type="button"
          onClick={onBegin}
          className="flex-1 flex items-center justify-center gap-2 min-h-[52px] px-6 py-3 rounded-xl bg-gradient-to-r from-accent to-gold text-surface font-bold text-lg shadow-lg shadow-accent/25 transition hover:shadow-xl hover:shadow-accent/30 active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main"
        >
          <Play className="w-5 h-5" weight="fill" />
          Begin Your Reading
        </button>
      </div>
    </div>
  );
}
