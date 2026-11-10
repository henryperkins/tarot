/**
 * NarrativeSection.jsx
 * Collapsible section displaying the full reading narrative (markdown).
 */
import { lazy, memo, useReducer, useState } from 'react';
import { CaretUp, CaretDown } from '@phosphor-icons/react';
import { JournalNarrativeIcon } from '../../../JournalIcons';
import { styles, cn } from '../EntryCard.primitives';
import { SavedVisualRecovery } from '../SavedVisualRecovery';
import { DeferredReadingContent } from '../DeferredReadingContent';
import { readingVisualRequestsEnabled } from '../../../../lib/readingGestureSettings';

const JournalMarkdown = lazy(() => import('../JournalMarkdown'));
const RestoredReadingGestures = lazy(() => import('../RestoredReadingGestures')
  .then(module => ({ default: module.RestoredReadingGestures })));

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
  const plainText = (
    <div className="journal-narrative-prose journal-reading prose prose-base text-(--text-main) wrap-anywhere">
      <p className="whitespace-pre-wrap">{narrativeText}</p>
    </div>
  );
  const reading = (
    <DeferredReadingContent key={hasGestures ? 'gestures' : 'markdown'} fallback={plainText}>
      {hasGestures ? <RestoredReadingGestures entry={entry} /> : (
        <div className="journal-narrative-prose journal-reading prose prose-base text-(--text-main) wrap-anywhere">
          <JournalMarkdown journalHeadings>{narrativeText}</JournalMarkdown>
        </div>
      )}
    </DeferredReadingContent>
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
            <span className="flex min-w-0 items-center gap-2">
              <JournalNarrativeIcon className={styles.sectionIcon} aria-hidden="true" />
              <span className={styles.sectionLabel}>Reading narrative</span>
            </span>
            <span className="shrink-0 text-(--text-muted)">
              {showNarrative ? (
                <CaretUp className="h-5 w-5" aria-hidden="true" />
              ) : (
                <CaretDown className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
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
            <div className="flex min-w-0 items-center gap-2">
              <JournalNarrativeIcon className={styles.sectionIcon} aria-hidden="true" />
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
