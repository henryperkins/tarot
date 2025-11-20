import React from 'react';

const baseButtonClasses =
  'w-full h-full px-3 py-2 rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-main';

export function StepProgress({ steps = [], activeStep, onSelect }) {
  return (
    <nav aria-label="Tarot reading progress" className="w-full animate-fade-in">
      <ol className="flex gap-2 sm:gap-3 overflow-x-auto snap-x snap-mandatory pb-1" role="list">
        {steps.map((step, index) => {
          const isActive = step.id === activeStep;
          return (
            <li key={step.id} className="min-w-[5.5rem] flex-1 snap-start">
              <button
                type="button"
                className={`${baseButtonClasses} ${isActive
                    ? 'bg-secondary/15 border-secondary/80 text-secondary shadow-lg shadow-secondary/30'
                    : 'bg-surface/70 border-accent/20 text-muted hover:bg-surface hover:border-secondary/40'
                  }`}
                onClick={() => onSelect?.(step.id)}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Go to ${step.label} section`}
              >
                <div className="text-[0.65rem] uppercase tracking-[0.2em] text-secondary/80">
                  Step {index + 1}
                </div>
                <div className="font-serif text-sm leading-snug">{step.label}</div>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
