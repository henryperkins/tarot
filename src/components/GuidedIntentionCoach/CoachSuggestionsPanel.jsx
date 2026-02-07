import { ArrowLeft, ArrowRight, Info } from '@phosphor-icons/react';
import { Tooltip } from '../Tooltip';

export function CoachSuggestionsPanel({
  personalizedSuggestions,
  isSuggestionsExpanded,
  setSuggestionsExpanded,
  suggestionPageCount,
  suggestionsPage,
  setSuggestionsPage,
  visibleSuggestions,
  buildSuggestionPreview,
  handleSuggestionPick,
  getTopicLabel,
  getTimeframeLabel,
  getDepthLabel,
  coachSnapshotLabel,
  coachSnapshotDetail
}) {
  if (!personalizedSuggestions || personalizedSuggestions.length === 0) return null;

  return (
    <section className="rounded-2xl border border-secondary/30 bg-surface-muted/40 p-4 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-secondary">Suggested for you</p>
          <p className="text-xs text-muted">
            {isSuggestionsExpanded
              ? 'Based on your journal trends and recent questions.'
              : `${personalizedSuggestions.length} suggestions ready. Tap to peek.`}
          </p>
          {coachSnapshotLabel && (
            <div className="mt-1 flex items-center gap-2 text-2xs text-secondary/70">
              <span>{coachSnapshotLabel}</span>
              {coachSnapshotDetail && (
                <Tooltip
                  content={coachSnapshotDetail}
                  position="top"
                  ariaLabel="Why am I seeing these?"
                  triggerClassName="text-secondary/70 hover:text-main"
                >
                  <Info className="h-3 w-3" />
                </Tooltip>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-secondary">
          {isSuggestionsExpanded && suggestionPageCount > 1 && (
            <div className="flex items-center gap-2 text-xs text-secondary">
              <button
                type="button"
                onClick={() => setSuggestionsPage(prev => (prev - 1 + suggestionPageCount) % suggestionPageCount)}
                className="inline-flex items-center justify-center rounded-full border border-secondary/40 px-2 py-1 hover:bg-secondary/10 transition"
                aria-label="Previous suggestions"
              >
                <ArrowLeft className="h-3 w-3" aria-hidden="true" />
              </button>
              <span className="text-2xs uppercase tracking-[0.3em] text-secondary/70">
                {suggestionsPage + 1}/{suggestionPageCount}
              </span>
              <button
                type="button"
                onClick={() => setSuggestionsPage(prev => (prev + 1) % suggestionPageCount)}
                className="inline-flex items-center justify-center rounded-full border border-secondary/40 px-2 py-1 hover:bg-secondary/10 transition"
                aria-label="Next suggestions"
              >
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setSuggestionsExpanded(prev => !prev)}
            aria-expanded={isSuggestionsExpanded}
            aria-controls="coach-suggestions"
            className="inline-flex items-center justify-center rounded-full border border-secondary/40 px-3 py-1 hover:bg-secondary/10 transition"
          >
            {isSuggestionsExpanded ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      {isSuggestionsExpanded && (
        <div id="coach-suggestions" className="grid gap-3 sm:grid-cols-2 max-h-[16rem] sm:max-h-[20rem] overflow-y-auto pr-1">
          {visibleSuggestions.map(suggestion => {
            const preview = buildSuggestionPreview(suggestion);
            const chips = [
              getTopicLabel(suggestion.topic),
              getTimeframeLabel(suggestion.timeframe),
              getDepthLabel(suggestion.depth)
            ].filter(Boolean);
            return (
              <button
                key={suggestion.id || suggestion.label}
                type="button"
                onClick={() => handleSuggestionPick(suggestion)}
                className="rounded-2xl border border-accent/20 bg-surface/70 p-3 text-left transition hover:border-secondary/60 hover:bg-surface-muted/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-main">{suggestion.label}</p>
                    {suggestion.helper && (
                      <p className="text-xs text-secondary/80 mt-1">{suggestion.helper}</p>
                    )}
                  </div>
                  <span className="text-2xs uppercase tracking-[0.3em] text-secondary/70">Use</span>
                </div>
                {preview && (
                  <p className="mt-2 text-sm text-main/90">{preview}</p>
                )}
                {chips.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2 text-2xs uppercase tracking-[0.3em] text-secondary/60">
                    {chips.map(chip => (
                      <span key={`${suggestion.id || suggestion.label}-${chip}`} className="rounded-full border border-secondary/30 px-2 py-1">
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
