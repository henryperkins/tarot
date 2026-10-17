/**
 * NarrativeSection.jsx
 * Collapsible section displaying the full reading narrative (markdown).
 */
import { memo, useReducer, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { CaretUp, CaretDown } from '@phosphor-icons/react';
import { JournalNarrativeIcon } from '../../../JournalIcons';
import { styles, cn } from '../EntryCard.primitives';
import { RestoredReadingGestures, SavedVisualRecovery } from '../RestoredReadingGestures';
import { readingVisualRequestsEnabled } from '../../../../lib/readingGestureSettings';

function getNarrativePreviewText(text, maxChars = 260) {
  if (!text || typeof text !== 'string') return '';

  const cleaned = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';

  const truncated = cleaned.length > maxChars
    ? `${cleaned.slice(0, maxChars).replace(/\s+\S*$/, '')}…`
    : cleaned;

  return truncated;
}

const MARKDOWN_COMPONENTS = {
  a: ({ node: _node, ...props }) => (
    <a
      {...props}
      className="text-(--brand-primary) underline decoration-dotted underline-offset-4 hover:text-(--text-main) wrap-anywhere"
      target="_blank"
      rel="noopener noreferrer"
    />
  ),
  pre: ({ node: _node, ...props }) => (
    <pre
      {...props}
      className="overflow-x-auto rounded-xl border border-(--border-warm-light) bg-(--bg-surface-muted) p-3 text-sm leading-relaxed"
    />
  ),
  code: ({ node: _node, inline, className, children, ...props }) => {
    if (inline) {
      return (
        <code
          {...props}
          className="rounded bg-(--border-warm-subtle) px-1.5 py-0.5 font-mono text-[0.85em] text-(--text-main) wrap-break-word"
        >
          {children}
        </code>
      );
    }

    return (
      <code
        {...props}
        className={cn('font-mono whitespace-pre-wrap wrap-break-word', className)}
      >
        {children}
      </code>
    );
  },
  table: ({ node: _node, ...props }) => (
    <div
      className="my-4 -mx-1 overflow-x-auto px-1"
      role="region"
      aria-label="Reading table"
      tabIndex={0}
    >
      <table
        {...props}
        className="w-full border-collapse text-sm text-main"
      />
    </div>
  ),
  thead: ({ node: _node, ...props }) => (
    <thead {...props} className="bg-(--border-warm-subtle)" />
  ),
  th: ({ node: _node, ...props }) => (
    <th
      {...props}
      className="border border-(--border-warm-light) px-2 py-2 text-left text-xs font-semibold text-main"
    />
  ),
  td: ({ node: _node, ...props }) => (
    <td
      {...props}
      className="border border-(--border-warm-subtle) px-2 py-2 align-top text-xs text-muted"
    />
  )
};

export const NarrativeSection = memo(function NarrativeSection({
  narrativeText,
  narrativeId,
  collapsible = true,
  defaultExpanded = false,
  entry = null,
  gestureStudyEnabled = false,
  onRetryVisuals = null
}) {
  const [showNarrative, setShowNarrative] = useState(defaultExpanded);
  // Private resume handles live outside React state; re-read them after changes.
  const [handleRevision, handlesChanged] = useReducer(revision => revision + 1, 0);

  if (!narrativeText) return null;
  const hasGestures = gestureStudyEnabled && typeof entry?.personalReading === 'string'
    && entry.personalReading.trim() && Array.isArray(entry.cards)
    && entry.cards.some(card => card && (card.name || card.canonicalName || card.card));
  // Saved-visual status/action sits beside the readable prose, with or without cues.
  const recovery = gestureStudyEnabled && entry ? (
    <SavedVisualRecovery entry={entry} onRetry={readingVisualRequestsEnabled() ? onRetryVisuals : null}
      handleRevision={handleRevision} onHandlesChanged={handlesChanged} />
  ) : null;
  const reading = hasGestures ? <RestoredReadingGestures entry={entry} onHandlesChanged={handlesChanged} /> : (
    <div className="prose prose-invert prose-base max-w-none text-(--text-main) prose-p:leading-relaxed wrap-anywhere">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} skipHtml components={MARKDOWN_COMPONENTS}>
        {narrativeText}
      </ReactMarkdown>
    </div>
  );

  return (
    <section className={cn(styles.section, 'mt-4')}>
      {collapsible ? (
        <>
          <button
            type="button"
            onClick={() => setShowNarrative((prev) => !prev)}
            aria-expanded={showNarrative}
            aria-controls={narrativeId}
            className={styles.sectionHeaderClickable}
          >
            <div className="flex items-center gap-2">
              <JournalNarrativeIcon className="h-4 w-4 text-(--brand-primary)" aria-hidden="true" />
              <div className={styles.sectionLabel}>Reading narrative</div>
            </div>
            <div className="text-(--text-muted)">
              {showNarrative ? (
                <CaretUp className="h-5 w-5" aria-hidden="true" />
              ) : (
                <CaretDown className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
          </button>

          <div
            id={narrativeId}
            className={styles.sectionBody}
          >
            {showNarrative ? (
              <>{recovery}{reading}</>
            ) : (
              <p className="text-sm leading-relaxed text-(--text-muted) line-clamp-4">
                {getNarrativePreviewText(narrativeText) || 'Tap to read the full narrative.'}
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <header className={styles.sectionHeader}>
            <div className="flex items-center gap-2">
              <JournalNarrativeIcon className="h-4 w-4 text-(--brand-primary)" aria-hidden="true" />
              <div className={styles.sectionLabel}>Reading narrative</div>
            </div>
          </header>
          <div id={narrativeId} className={styles.sectionBody}>
            {recovery}
            {reading}
          </div>
        </>
      )}
    </section>
  );
});
