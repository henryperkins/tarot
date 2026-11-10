import { useId, useState } from 'react';
import { ArrowRight, ArrowsClockwise, CaretDown, Info } from '@phosphor-icons/react';
import { Tooltip } from '../Tooltip';
import { describeSuggestionSources } from '../../lib/coachSuggestions';

// An open section, not a card: the questions carry the emphasis, and brass is
// kept for the actions (row arrows and "New ideas"). Rows bleed into the
// dialog padding so their text aligns with the heading while hover has room.
// Focus uses the system's semantic outline (tarot.css), which survives forced
// colors; the 8px bleed keeps its 3px offset inside the scroller.
const ROW_CLASS = '-mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-xl px-2 text-left transition hover:bg-primary/5 active:bg-primary/10';
const ACTION_CLASS = 'inline-flex min-h-touch shrink-0 items-center gap-2 rounded-lg px-2 text-sm font-medium transition hover:bg-primary/5 active:bg-primary/10';

export function CoachSuggestionsPanel({
  personalizedSuggestions,
  visibleSuggestions,
  cycleSuggestions,
  buildSuggestionPreview,
  handleSuggestionPick,
  coachSnapshotLabel,
  coachSnapshotDetail
}) {
  const idPrefix = useId();
  const headingId = `${idPrefix}-heading`;
  const alternativesId = `${idPrefix}-alternatives`;
  // Handsets (narrow, or short in landscape) show the lead alone until asked,
  // so the steps stay in view.
  const [showAlternatives, setShowAlternatives] = useState(false);

  if (!visibleSuggestions || visibleSuggestions.length === 0) return null;

  const [lead, ...alternatives] = visibleSuggestions;
  // Describe the cards on screen; cycling can show a different mix of sources.
  const sourceSummary = describeSuggestionSources(visibleSuggestions);
  // The journal scope and its "Why am I seeing these?" signals explain journal
  // cards, so they appear only while one is on screen.
  const showJournalScope = Boolean(coachSnapshotLabel)
    && visibleSuggestions.some(suggestion => suggestion?.source === 'journal');
  const canCycle = personalizedSuggestions.length > visibleSuggestions.length;

  const renderSuggestion = (suggestion, index, isLead) => {
    const preview = buildSuggestionPreview(suggestion);
    // Named by its label and described by its reason and question, so screen
    // readers don't read the whole row as one run-on name.
    const labelId = `${idPrefix}-${index}-label`;
    const helperId = `${idPrefix}-${index}-helper`;
    const previewId = `${idPrefix}-${index}-preview`;
    const describedBy = [suggestion.helper && helperId, preview && previewId].filter(Boolean).join(' ') || undefined;

    return (
      <button
        key={suggestion.id || suggestion.label}
        type="button"
        data-suggestion={isLead ? 'lead' : undefined}
        onClick={() => handleSuggestionPick(suggestion, preview)}
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        className={`${ROW_CLASS} ${isLead ? 'py-3' : 'py-2.5'}`}
      >
        <span className="min-w-0 flex-1">
          {preview && (
            <span
              id={previewId}
              className={`block font-serif leading-snug text-main text-pretty wrap-break-word ${isLead ? 'text-lg sm:text-xl' : 'text-base'}`}
            >
              {preview}
            </span>
          )}
          <span className={`block text-xs text-muted wrap-break-word ${preview ? 'mt-1' : ''}`}>
            <span id={labelId} className="font-medium">{suggestion.label}</span>
            {suggestion.helper && (
              <>
                <span aria-hidden="true"> · </span>
                <span id={helperId}>{suggestion.helper}</span>
              </>
            )}
          </span>
        </span>
        <ArrowRight className={`h-4 w-4 shrink-0 text-accent ${isLead ? 'mt-1.5' : 'mt-1'}`} aria-hidden="true" />
      </button>
    );
  };

  return (
    <section aria-labelledby={headingId} className="border-b border-(--border-warm-light) pb-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={headingId} className="font-serif text-lg leading-tight text-main">For you today</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
            <span>{sourceSummary}</span>
            {showJournalScope && (
              <>
                <span>{coachSnapshotLabel}</span>
                {coachSnapshotDetail && (
                  <Tooltip
                    content={coachSnapshotDetail}
                    position="top"
                    ariaLabel="Why am I seeing these?"
                    triggerClassName="-mx-3 -my-3.5 inline-flex min-h-touch min-w-touch items-center justify-center text-muted hover:text-main"
                  >
                    <Info className="h-3.5 w-3.5" aria-hidden="true" />
                  </Tooltip>
                )}
              </>
            )}
          </p>
        </div>
        {canCycle && (
          <button type="button" onClick={cycleSuggestions} className={`${ACTION_CLASS} -mr-2 text-accent`}>
            <ArrowsClockwise className="h-4 w-4" aria-hidden="true" />
            New ideas
          </button>
        )}
      </div>

      {/* Cycling swaps the lead without moving focus; say what is showing. */}
      <span className="sr-only" aria-live="polite">
        {lead?.label ? `Showing: ${lead.label}` : ''}
      </span>

      <div className="mt-2">
        {renderSuggestion(lead, 0, true)}
      </div>

      {alternatives.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={showAlternatives}
            aria-controls={alternativesId}
            onClick={() => setShowAlternatives(shown => !shown)}
            className={`${ACTION_CLASS} coach-suggestions__toggle -ml-2 text-muted hover:text-main sm:hidden landscape:inline-flex`}
          >
            <CaretDown
              className={`h-4 w-4 motion-safe:transition-transform ${showAlternatives ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
            {showAlternatives
              ? 'Fewer ideas'
              : `${alternatives.length} more ${alternatives.length === 1 ? 'idea' : 'ideas'}`}
          </button>
          {/* Hairlines sit on plain wrappers, not on the rounded rows, which
              bleed past the text column for their hover and focus area. */}
          <div
            id={alternativesId}
            data-expanded={showAlternatives}
            className={`coach-suggestions__alternatives divide-y divide-(--border-warm-light) border-t border-(--border-warm-light) ${showAlternatives ? '' : 'max-sm:hidden landscape:hidden'}`}
          >
            {alternatives.map((suggestion, index) => (
              <div key={suggestion.id || suggestion.label}>
                {renderSuggestion(suggestion, index + 1, false)}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
