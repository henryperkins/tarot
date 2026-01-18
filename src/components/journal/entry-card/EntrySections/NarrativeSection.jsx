/**
 * NarrativeSection.jsx
 * Collapsible section displaying the full reading narrative (markdown).
 */
import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { CaretUp, CaretDown } from '@phosphor-icons/react';
import { styles, cn } from '../EntryCard.primitives';

export const NarrativeSection = memo(function NarrativeSection({ narrativeText, narrativeId }) {
  const [showNarrative, setShowNarrative] = useState(false);

  if (!narrativeText) return null;

  return (
    <section className={cn(styles.section, 'mt-4')}>
      <button
        type="button"
        onClick={() => setShowNarrative((prev) => !prev)}
        aria-expanded={showNarrative}
        aria-controls={narrativeId}
        className={styles.sectionHeaderClickable}
      >
        <div className={styles.sectionLabel}>Reading narrative</div>
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
        className={cn(styles.sectionBody, showNarrative ? 'block' : 'hidden')}
      >
        <div className="prose prose-invert prose-sm max-w-none text-[color:var(--text-main)] prose-a:text-[color:var(--brand-primary)] prose-strong:text-[color:var(--text-main)]">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} skipHtml>
            {narrativeText}
          </ReactMarkdown>
        </div>
      </div>
    </section>
  );
});
