import { Sparkle } from '@phosphor-icons/react';

export function NarrativePanelHeader({
  focusToggleAvailable,
  isNarrativeFocus,
  onToggleNarrativeFocus
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <h3 className="text-base xxs:text-lg xs:text-xl sm:text-2xl font-serif text-accent flex items-center gap-2 leading-tight">
        <Sparkle className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
        Your Personalized Narrative
      </h3>
      {focusToggleAvailable ? (
        <button
          type="button"
          aria-pressed={isNarrativeFocus}
          onClick={onToggleNarrativeFocus}
          className="inline-flex items-center gap-2 rounded-full border border-secondary/50 px-3 xxs:px-4 py-1.5 text-xs-plus sm:text-sm font-semibold text-muted hover:text-main hover:border-secondary/70 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/60 sm:ml-auto"
        >
          {isNarrativeFocus ? 'Show insight panels' : 'Focus on narrative'}
        </button>
      ) : null}
    </div>
  );
}
