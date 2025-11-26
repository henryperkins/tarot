import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Info } from '@phosphor-icons/react';
import { SPREADS } from '../../data/spreads';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useLandscape } from '../../hooks/useLandscape';
import { useSmallScreen } from '../../hooks/useSmallScreen';

// Import spread artwork
import oneCardArt from '../../../selectorimages/onecard.png';
import threeCardArt from '../../../selectorimages/3card.png';
import decisionArt from '../../../selectorimages/decision.png';

// Beginner-friendly spreads for onboarding
const BEGINNER_SPREADS = ['single', 'threeCard', 'decision'];

const SPREAD_ART = {
  single: { src: oneCardArt, alt: 'One-card spread layout' },
  threeCard: { src: threeCardArt, alt: 'Three-card spread layout' },
  decision: { src: decisionArt, alt: 'Decision spread layout' },
};

const SPREAD_DESCRIPTIONS = {
  single: {
    tagline: 'Perfect for beginners',
    explanation: 'Draw a single card to focus on the core energy of your question. Simple and powerful.',
    positions: ['One card representing the central theme or guidance'],
  },
  threeCard: {
    tagline: 'Tell your story',
    explanation: 'Three cards reveal past influences, present situation, and future possibilities.',
    positions: ['Past — what led you here', 'Present — where you stand', 'Future — potential ahead'],
  },
  decision: {
    tagline: 'Compare your paths',
    explanation: 'When facing a choice, see the energy and outcomes of different options.',
    positions: [
      'Heart of the decision',
      'Path A — energy & likely outcome',
      'Path B — energy & likely outcome',
      'What clarifies the best path',
      'What to remember about your free will',
    ],
  },
};

/**
 * SpreadEducation - Step 2 of onboarding
 *
 * Teaches users about different spread types and lets them
 * select their first spread for the reading.
 */
export function SpreadEducation({ selectedSpread, onSelectSpread, onNext, onBack }) {
  const [expandedSpread, setExpandedSpread] = useState(null);
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();
  const isSmallScreen = useSmallScreen();

  const handleSpreadClick = (spreadKey) => {
    onSelectSpread(spreadKey);
    // Auto-expand on selection for mobile
    if (isSmallScreen && expandedSpread !== spreadKey) {
      setExpandedSpread(spreadKey);
    }
  };

  const toggleExpanded = (spreadKey, e) => {
    e.stopPropagation();
    setExpandedSpread(expandedSpread === spreadKey ? null : spreadKey);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className={`text-center mb-4 sm:mb-6 ${prefersReducedMotion ? '' : 'animate-fade-in-up'}`}
      >
        <h2 className={`font-serif text-main ${isLandscape ? 'text-xl' : 'text-2xl sm:text-3xl'}`}>
          Choose Your Spread
        </h2>
        <p className={`text-muted mt-2 max-w-md mx-auto ${isLandscape ? 'text-sm' : ''}`}>
          A spread is how cards are laid out. Each position has a meaning that shapes the reading.
        </p>
      </div>

      {/* Spread cards */}
      <div className="flex-1 overflow-y-auto">
        <div className={`grid gap-4 ${isLandscape ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
          {BEGINNER_SPREADS.map((spreadKey, index) => {
            const spread = SPREADS[spreadKey];
            const description = SPREAD_DESCRIPTIONS[spreadKey];
            const art = SPREAD_ART[spreadKey];
            const isSelected = selectedSpread === spreadKey;
            const isExpanded = expandedSpread === spreadKey;

            return (
              <button
                key={spreadKey}
                type="button"
                onClick={() => handleSpreadClick(spreadKey)}
                className={`relative flex flex-col text-left rounded-2xl border overflow-hidden transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main touch-manipulation ${
                  isSelected
                    ? 'border-accent bg-accent/10 ring-1 ring-accent/50'
                    : 'border-secondary/30 bg-surface/50 hover:border-accent/50 hover:bg-surface/70'
                } ${prefersReducedMotion ? '' : 'animate-fade-in-up'}`}
                style={{ animationDelay: `${index * 0.1}s` }}
                aria-pressed={isSelected}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-3 right-3 z-10 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                    <Check className="w-4 h-4 text-surface" weight="bold" />
                  </div>
                )}

                {/* Spread artwork */}
                <div className="relative aspect-[16/10] bg-gradient-to-br from-surface to-main overflow-hidden">
                  {art && (
                    <img
                      src={art.src}
                      alt={art.alt}
                      className="w-full h-full object-cover opacity-80"
                      loading="lazy"
                    />
                  )}
                  {/* Overlay gradient */}
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-surface/90 via-transparent to-transparent"
                    aria-hidden="true"
                  />
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-serif text-main text-base sm:text-lg leading-tight">
                        {spread.name}
                      </h3>
                      <p className="text-xs text-accent mt-0.5">{description.tagline}</p>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-secondary/20 text-xs text-muted">
                      {spread.count} {spread.count === 1 ? 'card' : 'cards'}
                    </span>
                  </div>

                  <p className={`text-sm text-muted mt-2 leading-relaxed ${isLandscape ? 'hidden' : ''}`}>
                    {description.explanation}
                  </p>

                  {/* Expandable positions info - mobile only */}
                  {isSmallScreen && !isLandscape && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => toggleExpanded(spreadKey, e)}
                        className="flex items-center gap-1 mt-3 text-xs text-accent hover:text-main transition"
                        aria-expanded={isExpanded}
                      >
                        <Info className="w-3.5 h-3.5" weight="bold" />
                        {isExpanded ? 'Hide positions' : 'Show positions'}
                      </button>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-secondary/20 space-y-1.5">
                          {description.positions.map((position, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <span className="w-5 h-5 shrink-0 rounded-full bg-accent/10 text-accent flex items-center justify-center font-medium">
                                {i + 1}
                              </span>
                              <span className="text-muted pt-0.5">{position}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Desktop positions - always visible */}
                  {!isSmallScreen && !isLandscape && (
                    <div className="mt-3 pt-3 border-t border-secondary/20 space-y-1.5">
                      {description.positions.map((position, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className="w-5 h-5 shrink-0 rounded-full bg-accent/10 text-accent flex items-center justify-center font-medium">
                            {i + 1}
                          </span>
                          <span className="text-muted pt-0.5">{position}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* What are positions explanation */}
        <div
          className={`mt-6 rounded-xl border border-secondary/20 bg-surface/30 p-4 ${
            isLandscape ? 'hidden' : ''
          }`}
        >
          <h4 className="text-sm font-medium text-main mb-2 flex items-center gap-2">
            <Info className="w-4 h-4 text-accent" />
            What are positions?
          </h4>
          <p className="text-xs text-muted leading-relaxed">
            Each spot in a spread has a specific meaning. For example, in a three-card spread, the
            first position represents your past, the second your present, and the third your future.
            The AI uses these positions to give you a more meaningful reading.
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className={`flex gap-3 pt-4 pb-safe-bottom ${isLandscape ? 'pt-2' : 'pt-6'}`}>
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
          disabled={!selectedSpread}
          className="flex-1 flex items-center justify-center gap-2 min-h-[48px] px-6 py-3 rounded-xl bg-accent text-surface font-semibold text-base transition hover:bg-accent/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-main"
        >
          Continue
          <ArrowRight className="w-5 h-5" weight="bold" />
        </button>
      </div>
    </div>
  );
}
