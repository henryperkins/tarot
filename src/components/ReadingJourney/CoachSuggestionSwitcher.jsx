import { memo } from 'react';

function CoachSuggestionSwitcher({
  suggestions = [],
  activeIndex = 0,
  onSelect,
  tone = 'warm',
  label = 'Try another angle',
}) {
  const safeSuggestions = Array.isArray(suggestions) ? suggestions.slice(0, 3) : [];
  if (safeSuggestions.length < 2) return null;

  const styles = tone === 'amber'
    ? {
      label: 'text-[10px] uppercase tracking-[0.18em] text-amber-100/50',
      buttonBase: 'min-h-touch rounded-full border border-amber-300/30 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-amber-200/70 transition-colors',
      buttonActive: 'bg-amber-300/20 text-amber-100 border-amber-200/60',
      buttonInactive: 'hover:border-amber-200/60 hover:text-amber-100',
    }
    : {
      label: 'text-[10px] uppercase tracking-[0.18em] text-muted',
      buttonBase: 'min-h-touch rounded-full border border-[color:var(--border-warm-light)] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-high transition-colors',
      buttonActive: 'bg-[color:var(--border-warm-subtle)] text-main border-[color:var(--border-warm)]',
      buttonInactive: 'hover:text-main hover:border-[color:var(--border-warm)]',
    };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className={styles.label}>{label}</span>
      {safeSuggestions.map((suggestion, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={`${suggestion.source || 'suggestion'}-${index}`}
            type="button"
            className={`${styles.buttonBase} ${isActive ? styles.buttonActive : styles.buttonInactive}`}
            onClick={() => onSelect?.(index)}
            aria-pressed={isActive}
            title={suggestion.sourceDetail || suggestion.sourceLabel || ''}
          >
            {suggestion.sourceLabel || suggestion.source || 'Suggestion'}
          </button>
        );
      })}
    </div>
  );
}

export default memo(CoachSuggestionSwitcher);
