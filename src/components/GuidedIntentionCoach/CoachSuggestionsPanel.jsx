import { useId } from 'react';
import { ArrowRight, ArrowsClockwise, Info, Sparkle } from '@phosphor-icons/react';
import { Tooltip } from '../Tooltip';
import { describeSuggestionSources } from '../../lib/coachSuggestions';

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

  if (!visibleSuggestions || visibleSuggestions.length === 0) return null;

  const [lead, ...alternatives] = visibleSuggestions;
  // Describe the cards on screen; cycling can show a different mix of sources.
  const sourceSummary = describeSuggestionSources(visibleSuggestions);
  // The journal scope and its "Why am I seeing these?" signals explain journal
  // cards, so they appear only while one is on screen.
  const showJournalScope = Boolean(coachSnapshotLabel)
    && visibleSuggestions.some(suggestion => suggestion?.source === 'journal');
  const canCycle = personalizedSuggestions.length > visibleSuggestions.length;

  const renderSuggestion = (suggestion, index, variant) => {
    const preview = buildSuggestionPreview(suggestion);
    // Name the card by its label and describe it by its question, so
    // screen readers don't read the whole card as one run-on name.
    const labelId = `${idPrefix}-${index}-label`;
    const helperId = `${idPrefix}-${index}-helper`;
    const previewId = `${idPrefix}-${index}-preview`;
    const describedBy = [suggestion.helper && helperId, preview && previewId].filter(Boolean).join(' ') || undefined;
    const isLead = variant === 'lead';

    return (
      <button
        key={suggestion.id || suggestion.label}
        type="button"
        onClick={() => handleSuggestionPick(suggestion, preview)}
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        className={isLead
          ? 'block w-full rounded-2xl border border-primary/30 bg-surface/60 p-4 text-left transition hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:p-5'
          : 'flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface'}
      >
        <span className="min-w-0">
          <span id={labelId} className={isLead
            ? 'block text-sm font-semibold text-accent wrap-break-word'
            : 'block text-sm font-semibold text-main wrap-break-word'}
          >
            {suggestion.label}
          </span>
          {preview && (
            <span id={previewId} className={isLead
              ? 'mt-2 block font-serif text-xl leading-snug text-main wrap-break-word'
              : 'mt-1 block font-serif text-base leading-snug text-main wrap-break-word'}
            >
              {preview}
            </span>
          )}
          {suggestion.helper && (
            <span id={helperId} className="mt-2 block text-xs text-muted wrap-break-word">{suggestion.helper}</span>
          )}
          {isLead && (
            <span className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-accent">
              Start with this question
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
        </span>
        {!isLead && <ArrowRight className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
      </button>
    );
  };

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-3xl border border-primary/35 bg-primary/10 p-4 shadow-(--ui-selected-shadow) sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-surface" aria-hidden="true">
            <Sparkle className="h-4 w-4" weight="fill" />
          </span>
          <div className="min-w-0">
            <h3 id={headingId} className="font-serif text-lg leading-tight text-main">For you today</h3>
            <p className="mt-0.5 text-xs text-muted">{sourceSummary}</p>
          </div>
        </div>
        {canCycle && (
          <button
            type="button"
            onClick={cycleSuggestions}
            className="inline-flex min-h-touch shrink-0 items-center gap-2 rounded-full border border-primary/40 px-3 py-2 text-xs font-medium text-accent transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <ArrowsClockwise className="h-3.5 w-3.5" aria-hidden="true" />
            New ideas
          </button>
        )}
      </div>

      {/* Cycling swaps the lead without moving focus; say what is showing. */}
      <span className="sr-only" aria-live="polite">
        {lead?.label ? `Showing: ${lead.label}` : ''}
      </span>

      <div className="mt-4">
        {renderSuggestion(lead, 0, 'lead')}
      </div>

      {alternatives.length > 0 && (
        <div className="mt-2 divide-y divide-primary/15 border-t border-primary/15">
          {alternatives.map((suggestion, index) => renderSuggestion(suggestion, index + 1, 'alternative'))}
        </div>
      )}

      {showJournalScope && (
        <div className="mt-3 flex items-center gap-2 text-2xs text-muted">
          <span>{coachSnapshotLabel}</span>
          {coachSnapshotDetail && (
            <Tooltip
              content={coachSnapshotDetail}
              position="top"
              ariaLabel="Why am I seeing these?"
              triggerClassName="inline-flex min-h-touch min-w-touch items-center justify-center text-muted hover:text-main"
            >
              <Info className="h-3 w-3" aria-hidden="true" />
            </Tooltip>
          )}
        </div>
      )}
    </section>
  );
}
