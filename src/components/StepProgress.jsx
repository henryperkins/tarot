import { GridFour, Question, Sparkle, Eye } from '@phosphor-icons/react';

const baseButtonClasses =
  'w-full h-full rounded-xl border transition font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-main';

const STEP_ICONS = {
  'spread': GridFour,
  'intention': Question,
  'ritual': Sparkle,
  'reading': Eye
};

export function StepProgress({ steps = [], activeStep, onSelect, condensed = false }) {
  return (
    <nav aria-label="Tarot reading progress" className="w-full animate-fade-in">
      <ol className={`flex ${condensed ? 'gap-1.5 py-1' : 'gap-2 sm:gap-3 pb-1'} overflow-x-auto snap-x snap-mandatory`} role="list">
        {steps.map((step, index) => {
          const isActive = step.id === activeStep;
          const StepIcon = STEP_ICONS[step.id];
          return (
            <li key={step.id} className="flex-1 snap-start group relative">
              <button
                type="button"
                className={`${baseButtonClasses} ${condensed ? 'px-2 py-1.5 text-[0.7rem]' : 'px-3 py-2.5 text-[0.78rem] sm:text-sm'} ${isActive
                    ? 'bg-primary/20 border-primary/80 text-main shadow-md shadow-primary/35'
                    : 'bg-surface border-secondary/40 text-muted hover:bg-surface-muted hover:border-secondary/60'
                  }`}
                onClick={() => onSelect?.(step.id)}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Step ${index + 1}: ${step.label}`}
                title={`Step ${index + 1}: ${step.label}`}
              >
                <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                  {StepIcon && <StepIcon className={`w-4 h-4 ${condensed ? '' : 'sm:w-5 sm:h-5'}`} aria-hidden="true" />}
                  <span className={`${condensed ? 'text-[0.68rem]' : 'text-[0.7rem]'} font-semibold text-secondary/80 sm:hidden`}>{index + 1}</span>
                  <span className={`${condensed ? 'hidden' : 'hidden sm:inline'} text-[0.82rem] font-semibold text-main`}>{step.label}</span>
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
