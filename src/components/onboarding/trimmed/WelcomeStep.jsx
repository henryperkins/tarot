import { useState } from 'react';
import { Moon, User } from '@phosphor-icons/react';
import { usePreferences } from '../../../contexts/PreferencesContext';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useLandscape } from '../../../hooks/useLandscape';

const EXPERIENCE_OPTIONS = [
  { value: 'newbie', label: 'New to tarot' },
  { value: 'intermediate', label: 'Know basics' },
  { value: 'experienced', label: 'Experienced' }
];

const TONE_OPTIONS = [
  { value: 'gentle', label: 'Gentle' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'blunt', label: 'Direct' }
];

/**
 * WelcomeStep - Consolidated welcome with essential personalization
 *
 * Combines name input, experience level, and tone preference into
 * a single streamlined step. Target completion: 20-30 seconds.
 */
export function WelcomeStep({ onNext }) {
  const { personalization, setDisplayName, setTarotExperience, setReadingTone } = usePreferences();
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();

  const [name, setName] = useState(personalization.displayName || '');
  const [experience, setExperience] = useState(personalization.tarotExperience || 'intermediate');
  const [tone, setTone] = useState(personalization.readingTone || 'balanced');

  const handleContinue = () => {
    setDisplayName(name.trim() || null);
    setTarotExperience(experience);
    setReadingTone(tone);
    onNext();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Hero - simplified */}
      <div
        className={`text-center ${isLandscape ? 'mb-3' : 'mb-6'} ${
          prefersReducedMotion ? '' : 'animate-fade-in-up'
        }`}
      >
        <Moon
          className={`mx-auto text-accent ${isLandscape ? 'w-12 h-12 mb-2' : 'w-16 h-16 mb-4'}`}
          weight="duotone"
          aria-hidden="true"
        />
        <h2 className={`font-serif text-main ${isLandscape ? 'text-2xl mb-1' : 'text-3xl mb-2'}`}>
          Welcome to Tableau
        </h2>
        <p className="text-muted text-sm">A space for reflection, clarity, and insight</p>
      </div>

      {/* Consolidated inputs - all visible, no accordions */}
      <div className={`flex-1 overflow-y-auto ${isLandscape ? 'space-y-3' : 'space-y-5'}`}>
        {/* Name (optional) */}
        <div
          className={prefersReducedMotion ? '' : 'animate-fade-in-up'}
          style={{ animationDelay: '0.1s' }}
        >
          <label
            htmlFor="welcome-name"
            className="flex items-center gap-2 text-sm text-accent mb-2"
          >
            <User className="w-4 h-4" weight="duotone" aria-hidden="true" />
            What should we call you?
            <span className="text-muted">(optional)</span>
          </label>
          <input
            id="welcome-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name or nickname"
            className="w-full rounded-xl border border-secondary/30 bg-surface min-h-[44px] px-4 py-3 text-base text-main placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/50 transition"
            autoComplete="given-name"
          />
        </div>

        {/* Experience - horizontal pills */}
        <div
          className={prefersReducedMotion ? '' : 'animate-fade-in-up'}
          style={{ animationDelay: '0.2s' }}
        >
          <p className="text-sm text-accent mb-2">Tarot experience</p>
          <div className="flex gap-2">
            {EXPERIENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setExperience(opt.value)}
                className={`flex-1 min-h-[44px] py-3 px-2 rounded-xl text-sm font-medium transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main ${
                  experience === opt.value
                    ? 'bg-accent text-surface'
                    : 'bg-surface border border-secondary/30 text-muted hover:border-accent/50'
                }`}
                aria-pressed={experience === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tone - horizontal pills */}
        <div
          className={prefersReducedMotion ? '' : 'animate-fade-in-up'}
          style={{ animationDelay: '0.3s' }}
        >
          <p className="text-sm text-accent mb-2">Reading tone preference</p>
          <div className="flex gap-2">
            {TONE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTone(opt.value)}
                className={`flex-1 min-h-[44px] py-3 px-2 rounded-xl text-sm font-medium transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main ${
                  tone === opt.value
                    ? 'bg-accent text-surface'
                    : 'bg-surface border border-secondary/30 text-muted hover:border-accent/50'
                }`}
                aria-pressed={tone === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Single CTA - full width, prominent */}
      <div className={`${isLandscape ? 'pt-3' : 'pt-4'} pb-safe-bottom`}>
        <button
          type="button"
          onClick={handleContinue}
          className="w-full min-h-[52px] rounded-xl bg-accent text-surface font-semibold text-lg transition hover:bg-accent/90 active:scale-[0.98] touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
