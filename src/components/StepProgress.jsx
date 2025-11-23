import React from 'react';
import { GridFour, Question, Sparkle, Eye } from '@phosphor-icons/react';

const baseButtonClasses =
  'w-full h-full px-3 py-2 rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-main';

const STEP_ICONS = {
  'spread': GridFour,
  'intention': Question,
  'ritual': Sparkle,
  'reading': Eye
};

export function StepProgress({ steps = [], activeStep, onSelect }) {
  return (
    <nav aria-label="Tarot reading progress" className="w-full animate-fade-in">
      <ol className="flex gap-2 sm:gap-3 overflow-x-auto snap-x snap-mandatory pb-1" role="list">
        {steps.map((step, index) => {
          const isActive = step.id === activeStep;
          const StepIcon = STEP_ICONS[step.id];
          return (
            <li key={step.id} className="flex-1 snap-start group relative">
              <button
                type="button"
                className={`${baseButtonClasses} ${isActive
                    ? 'bg-secondary/15 border-secondary/80 text-secondary shadow-lg shadow-secondary/30'
                    : 'bg-surface/70 border-accent/20 text-muted hover:bg-surface hover:border-secondary/40'
                  }`}
                onClick={() => onSelect?.(step.id)}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Step ${index + 1}: ${step.label}`}
                title={`Step ${index + 1}: ${step.label}`}
              >
                <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                  {StepIcon && <StepIcon className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />}
                  <span className="text-[0.7rem] font-semibold text-secondary/80 sm:hidden">{index + 1}</span>
                  <span className="hidden sm:inline text-[0.82rem] font-semibold text-main">{step.label}</span>
                </div>
              </button>

              {/* Hover tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-main border border-secondary/40 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none whitespace-nowrap z-50">
                <div className="text-xs font-serif text-accent">{step.label}</div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-main" style={{ filter: 'drop-shadow(0 1px 0 rgba(0,0,0,0.1))' }}></div>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
