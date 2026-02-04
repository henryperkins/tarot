/**
 * NarrativeSection.jsx
 * Collapsible section displaying the full reading narrative (markdown).
 */
import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { CaretUp, CaretDown } from '@phosphor-icons/react';
import { JournalNarrativeIcon } from '../../../JournalIcons';
import { styles, cn } from '../EntryCard.primitives';

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
      className="text-[color:var(--brand-primary)] underline decoration-dotted underline-offset-4 hover:text-[color:var(--text-main)] break-words overflow-wrap-anywhere"
      target="_blank"
      rel="noopener noreferrer"
    />
  ),
  pre: ({ node: _node, ...props }) => (
    <pre
      {...props}
      className="overflow-x-auto rounded-xl border border-[color:var(--border-warm-light)] bg-[color:var(--bg-surface-muted)] p-3 text-sm leading-relaxed"
    />
  ),
  code: ({ node: _node, inline, className, children, ...props }) => {
    if (inline) {
      return (
        <code
          {...props}
          className="rounded bg-[color:var(--border-warm-subtle)] px-1.5 py-0.5 font-mono text-[0.85em] text-[color:var(--text-main)] break-words"
        >
          {children}
        </code>
      );
    }

    return (
      <code
        {...props}
        className={cn('font-mono whitespace-pre-wrap break-words', className)}
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
    <thead {...props} className="bg-[color:var(--border-warm-subtle)]" />
  ),
  th: ({ node: _node, ...props }) => (
    <th
      {...props}
      className="border border-[color:var(--border-warm-light)] px-2 py-2 text-left text-xs font-semibold text-main"
    />
  ),
  td: ({ node: _node, ...props }) => (
    <td
      {...props}
      className="border border-[color:var(--border-warm-subtle)] px-2 py-2 align-top text-xs text-muted"
    />
  )
};

export const NarrativeSection = memo(function NarrativeSection({
  narrativeText,
  narrativeId,
  collapsible = true,
  defaultExpanded = false
}) {
  const [showNarrative, setShowNarrative] = useState(defaultExpanded);

  if (!narrativeText) return null;

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
              <JournalNarrativeIcon className="h-4 w-4 text-[color:var(--brand-primary)]" aria-hidden="true" />
              <div className={styles.sectionLabel}>Reading narrative</div>
            </div>
            <div className="text-[color:var(--text-muted)]">
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
              <div className="prose prose-invert prose-base max-w-none text-[color:var(--text-main)] prose-a:text-[color:var(--brand-primary)] prose-strong:text-[color:var(--text-main)] prose-p:leading-relaxed prose-li:leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  skipHtml
                  components={MARKDOWN_COMPONENTS}
                >
                  {narrativeText}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-[color:var(--text-muted)] line-clamp-4">
                {getNarrativePreviewText(narrativeText) || 'Tap to read the full narrative.'}
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <header className={styles.sectionHeader}>
            <div className="flex items-center gap-2">
              <JournalNarrativeIcon className="h-4 w-4 text-[color:var(--brand-primary)]" aria-hidden="true" />
              <div className={styles.sectionLabel}>Reading narrative</div>
            </div>
          </header>
          <div id={narrativeId} className={styles.sectionBody}>
            <div className="prose prose-invert prose-base max-w-none text-[color:var(--text-main)] prose-a:text-[color:var(--brand-primary)] prose-strong:text-[color:var(--text-main)] prose-p:leading-relaxed prose-li:leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                skipHtml
                components={MARKDOWN_COMPONENTS}
              >
                {narrativeText}
              </ReactMarkdown>
            </div>
          </div>
        </>
      )}
    </section>
  );
});
