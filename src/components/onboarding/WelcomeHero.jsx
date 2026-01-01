import { Sparkle, Moon, Star, ArrowRight, Eye, Path, Lightbulb, User } from '@phosphor-icons/react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useLandscape } from '../../hooks/useLandscape';
import { usePreferences } from '../../contexts/PreferencesContext';

const EXPERIENCE_OPTIONS = [
  { value: 'newbie', label: 'Brand new' },
  { value: 'intermediate', label: 'I know the basics' },
  { value: 'experienced', label: 'Pretty experienced' },
];

/** Core principles shown in onboarding - extracted for landscape scroll */
const PRINCIPLES = [
  { Icon: Eye, label: 'Reflect & explore' },
  { Icon: Path, label: 'Embrace free will' },
  { Icon: Lightbulb, label: 'Follow what resonates' }
];

/**
 * WelcomeHero - Step 1 of onboarding
 *
 * Introduces users to tarot as a tool for self-reflection,
 * emphasizing guidance over fortune-telling.
 * Also collects display name and tarot experience level.
 */
export function WelcomeHero({ onNext, onSkip }) {
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();
  const { personalization, setDisplayName, setTarotExperience } = usePreferences();

  return (
    <div className="flex flex-col h-full">
      {/* Hero content - centered vertically */}
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {/* Mystical icon cluster */}
        <div
          className={`relative mb-6 ${isLandscape ? 'mb-4' : 'mb-8'} ${
            prefersReducedMotion ? '' : 'animate-fade-in-up'
          }`}
          style={{ animationDelay: '0.1s' }}
        >
          <div className="relative">
            <Moon
              className="w-16 h-16 sm:w-20 sm:h-20 text-accent"
              weight="duotone"
              aria-hidden="true"
            />
            <Star
              className="absolute -top-2 -right-2 w-6 h-6 sm:w-8 sm:h-8 text-gold"
              weight="fill"
              aria-hidden="true"
            />
            <Sparkle
              className="absolute -bottom-1 -left-3 w-5 h-5 sm:w-6 sm:h-6 text-primary"
              weight="fill"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Welcome text */}
        <div
          className={prefersReducedMotion ? '' : 'animate-fade-in-up'}
          style={{ animationDelay: '0.2s' }}
        >
          <h2
            className={`font-serif text-main mb-3 ${
              isLandscape ? 'text-2xl' : 'text-3xl sm:text-4xl'
            }`}
          >
            Welcome to Tableu
          </h2>
          <p
            className={`text-muted max-w-md mx-auto leading-relaxed ${
              isLandscape ? 'text-sm' : 'text-base sm:text-lg'
            }`}
          >
            A space for reflection, clarity, and personal insight
          </p>
        </div>

        {/* What is tarot explanation */}
        <div
          className={`mt-6 sm:mt-8 max-w-lg mx-auto ${
            prefersReducedMotion ? '' : 'animate-fade-in-up'
          } ${isLandscape ? 'mt-4' : ''}`}
          style={{ animationDelay: '0.3s' }}
        >
          <div className="rounded-2xl border border-accent/20 bg-surface/50 backdrop-blur-sm p-5 sm:p-6">
            <h3 className="text-accent font-serif text-lg mb-3 flex items-center gap-2">
              <Sparkle className="w-4 h-4" weight="fill" aria-hidden="true" />
              What is tarot?
            </h3>
            <p className={`text-muted leading-relaxed ${isLandscape ? 'text-sm' : ''}`}>
              Tarot is a mirror, not a crystal ball. The cards invite you to explore your thoughts and possibilities—a <strong className="text-main">conversation with yourself</strong> through symbolic imagery.
            </p>
          </div>
        </div>

        {/* Key principles - horizontal scroll in landscape, grid in portrait */}
        {isLandscape ? (
          <div
            className={`mt-3 flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none ${
              prefersReducedMotion ? '' : 'animate-fade-in-up'
            }`}
            style={{ animationDelay: '0.4s' }}
          >
            {PRINCIPLES.map((principle, i) => (
              <div
                key={i}
                className="flex-shrink-0 w-32 snap-center flex items-center gap-2 px-3 py-2 rounded-xl bg-surface/40 border border-secondary/20"
              >
                <principle.Icon className="w-5 h-5 text-accent shrink-0" weight="duotone" aria-hidden="true" />
                <span className="text-xs text-muted line-clamp-2">{principle.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div
            className={`mt-6 grid grid-cols-1 xs:grid-cols-3 gap-4 max-w-lg mx-auto ${
              prefersReducedMotion ? '' : 'animate-fade-in-up'
            }`}
            style={{ animationDelay: '0.4s' }}
          >
            {PRINCIPLES.map((principle, i) => (
              <div key={i} className="text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
                  <principle.Icon className="w-5 h-5 text-accent" weight="duotone" aria-hidden="true" />
                </div>
                <p className="text-xs text-muted">{principle.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Personalization Section */}
        <div
          className={`mt-6 w-full max-w-md mx-auto space-y-5 ${
            prefersReducedMotion ? '' : 'animate-fade-in-up'
          } ${isLandscape ? 'mt-3 space-y-3' : ''}`}
          style={{ animationDelay: '0.5s' }}
        >
          {/* Display name input */}
          <div className="text-left">
            <label
              htmlFor="display-name"
              className="flex items-center gap-2 text-sm text-accent mb-2"
            >
              <User className="w-4 h-4" weight="duotone" aria-hidden="true" />
              What should we call you?
            </label>
            <input
              id="display-name"
              type="text"
              value={personalization.displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Used to personalize your readings"
              className="w-full bg-surface border border-primary/40 rounded-xl min-h-[44px] px-3 xxs:px-4 py-3 text-sm xxs:text-base text-main placeholder-muted/70 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/70 transition-all"
              autoComplete="given-name"
            />
          </div>

          {/* Tarot experience chips */}
          <div className="text-left">
            <p className="text-sm text-accent mb-2">
              How familiar are you with tarot?
            </p>
            <div className="flex flex-col xs:flex-row flex-wrap gap-2 w-full">
              {EXPERIENCE_OPTIONS.map((option) => {
                const isSelected = personalization.tarotExperience === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTarotExperience(option.value)}
                    className={`min-h-[44px] w-full xs:w-auto px-3 xxs:px-4 sm:px-5 py-2.5 rounded-full border text-sm font-medium text-center xs:text-left transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main ${
                      isSelected
                        ? 'bg-accent text-surface border-accent'
                        : 'bg-surface/50 text-muted border-secondary/30 hover:border-accent/50 hover:text-main'
                    }`}
                    aria-pressed={isSelected}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Actions - sticky at bottom */}
      <div
        className={`flex flex-col gap-3 pt-4 pb-safe-bottom ${isLandscape ? 'pt-2' : 'pt-6'}`}
      >
        <button
          type="button"
          onClick={onNext}
          className="w-full flex items-center justify-center gap-2 min-h-[48px] px-4 xxs:px-5 py-3 rounded-xl bg-accent text-surface font-semibold text-sm xxs:text-base transition hover:bg-accent/90 active:scale-[0.98] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main"
        >
          Continue
          <ArrowRight className="w-5 h-5" weight="bold" />
        </button>
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="w-full min-h-[46px] px-4 xxs:px-5 py-2.5 rounded-xl border border-accent/50 text-accent font-semibold text-sm xxs:text-base bg-transparent hover:bg-accent/10 active:scale-[0.99] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main"
          >
            Jump in now – start reading
          </button>
        )}
      </div>
    </div>
  );
}
