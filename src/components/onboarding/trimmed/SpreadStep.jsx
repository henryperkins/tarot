import { useState } from 'react';
import { ArrowLeft } from '@phosphor-icons/react';
import { usePreferences } from '../../../contexts/PreferencesContext';
import { BEGINNER_SPREADS } from '../../../data/spreadBrowse';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { useLandscape } from '../../../hooks/useLandscape';

const FOCUS_AREAS = ['Love', 'Career', 'Growth', 'Decision'];

/**
 * SpreadStep - Streamlined spread selection with inline education
 *
 * Shows beginner-friendly spread options as scannable cards with
 * time estimates. Includes optional focus area selection.
 * Target completion: 15-25 seconds.
 */
export function SpreadStep({ selectedSpread, onSelectSpread, onNext, onBack }) {
  const { setFocusAreas, personalization } = usePreferences();
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();

  const [focusArea, setFocusArea] = useState(null);

  const handleContinue = () => {
    // Only update focus areas if user actively selected one during this step.
    // Merge with existing areas to preserve prior personalization.
    if (focusArea) {
      const existingAreas = Array.isArray(personalization?.focusAreas)
        ? personalization.focusAreas
        : [];
      // Add new area if not already present, preserving existing selections
      const mergedAreas = existingAreas.includes(focusArea)
        ? existingAreas
        : [...existingAreas, focusArea];
      setFocusAreas(mergedAreas);
    }
    // If no selection made, existing focus areas are preserved (no-op)
    onNext();
  };

  const toggleFocusArea = (area) => {
    const lowerArea = area.toLowerCase();
    setFocusArea(focusArea === lowerArea ? null : lowerArea);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className={`text-center ${isLandscape ? 'mb-3' : 'mb-4'} ${
          prefersReducedMotion ? '' : 'animate-fade-in-up'
        }`}
      >
        <h2 className={`font-serif text-main ${isLandscape ? 'text-xl' : 'text-2xl'}`}>
          Choose Your Spread
        </h2>
        <p className="text-muted mt-1 text-sm">How deep do you want to go?</p>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto ${isLandscape ? 'space-y-3' : 'space-y-4'}`}>
        {/* Spread cards - horizontal scroll */}
        <div
          className={`flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none ${
            prefersReducedMotion ? '' : 'animate-fade-in-up'
          }`}
          style={{ animationDelay: '0.1s' }}
        >
          {BEGINNER_SPREADS.map((spread) => {
            const cardCount = spread.spread?.count || 0;
            const displayName = spread.shortName || spread.spread?.name || spread.key;

            return (
              <button
                key={spread.key}
                type="button"
                onClick={() => onSelectSpread(spread.key)}
                className={`flex-shrink-0 w-[140px] snap-center rounded-2xl border p-4 text-left transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  selectedSpread === spread.key
                    ? 'border-accent bg-accent/10 ring-1 ring-accent'
                    : 'border-secondary/30 bg-surface/50 hover:border-accent/50'
                }`}
                aria-pressed={selectedSpread === spread.key}
              >
                {/* Card count visualization */}
                <div className="flex gap-1 mb-3" aria-hidden="true">
                  {Array.from({ length: cardCount }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-4 h-6 rounded-sm transition ${
                        selectedSpread === spread.key ? 'bg-accent' : 'bg-secondary/40'
                      }`}
                    />
                  ))}
                </div>
                <h3 className="font-medium text-main text-sm">{displayName}</h3>
                <p className="text-xs text-muted mt-0.5">{spread.tagline}</p>
                <p className="text-xs text-accent mt-2">~{spread.time}</p>
              </button>
            );
          })}
        </div>

        {/* Optional focus area - single select for simplicity */}
        <div
          className={`rounded-xl border border-secondary/20 bg-surface/50 p-4 ${
            prefersReducedMotion ? '' : 'animate-fade-in-up'
          }`}
          style={{ animationDelay: '0.2s' }}
        >
          <p className="text-sm text-accent mb-3">
            What&apos;s on your mind? <span className="text-muted">(optional)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {FOCUS_AREAS.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => toggleFocusArea(area)}
                className={`min-h-[36px] px-3 py-1.5 rounded-full text-sm transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  focusArea === area.toLowerCase()
                    ? 'bg-accent text-surface'
                    : 'bg-surface border border-secondary/30 text-muted hover:border-accent/50'
                }`}
                aria-pressed={focusArea === area.toLowerCase()}
              >
                {area}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className={`flex gap-3 ${isLandscape ? 'pt-3' : 'pt-4'} pb-safe-bottom`}>
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] min-w-[44px] px-4 py-3 text-muted flex items-center gap-1 transition hover:text-main touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4" weight="bold" aria-hidden="true" />
          <span className="hidden xxs:inline">Back</span>
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={!selectedSpread}
          className="flex-1 min-h-[52px] rounded-xl bg-accent text-surface font-semibold transition hover:bg-accent/90 active:scale-[0.98] touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
