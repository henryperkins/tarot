/**
 * JournalEmptyState - First-time user experience for empty journal
 */

import { useId, useState } from 'react';
import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { OUTLINE_BUTTON_CLASS } from '../../styles/buttonClasses';
import { AMBER_CARD_CLASS } from '../../lib/journal/constants';
import { EmptyJournalIllustration } from '../illustrations/EmptyJournalIllustration';
import { AmberStarfield } from '../AmberStarfield';
import {
  JournalCommentAddIcon,
  JournalPercentCircleIcon,
  JournalSearchIcon
} from '../JournalIcons';

function JournalEntryPreview() {
  const [isExpanded, setIsExpanded] = useState(false);
  const previewId = useId();
  const previewContentId = `${previewId}-content`;

  return (
    <article className={`${AMBER_CARD_CLASS} text-left`}>
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        aria-controls={isExpanded ? previewContentId : undefined}
        className="relative z-10 flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[color:var(--border-warm-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
      >
        <div className="space-y-1">
          <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">Journal entry preview</p>
          <p className="text-base font-semibold text-main">Daily check-in · Solo pull</p>
          <p className="text-sm text-muted">
            {isExpanded ? 'Hide details' : 'Expand to see cards and reflection'}
          </p>
        </div>
        <span className="text-muted">
          {isExpanded ? <CaretUp className="h-5 w-5" aria-hidden="true" /> : <CaretDown className="h-5 w-5" aria-hidden="true" />}
        </span>
      </button>
      {isExpanded && (
        <div id={previewContentId} className="relative z-10 space-y-4 px-5 pb-5 pt-2">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">Cards drawn</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full border border-[color:var(--border-warm-light)] bg-[color:var(--panel-dark-2)] px-3 py-1 text-xs font-semibold text-main">
                The Star · Upright
              </span>
            </div>
          </div>
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.18em] text-muted">Reflection</p>
            <p className="journal-prose mt-2 text-sm text-muted-high">
              Quiet progress feels steady today. Keep the intention simple, and let the next step reveal itself.
            </p>
          </div>
        </div>
      )}
    </article>
  );
}

export function JournalEmptyState({ shellClass, onStartReading }) {
  const navigate = useNavigate();

  return (
    <div className={`${shellClass} animate-fade-in space-y-6 rounded-3xl p-8 text-center text-main`}>
      <AmberStarfield />
      <div className="relative z-10 space-y-6">
        <EmptyJournalIllustration className="mx-auto mb-2 w-40" />
        <div>
          <h2 className="text-2xl font-serif text-primary">Start your tarot journal</h2>
          <p className="journal-prose mt-1 text-sm text-muted sm:text-base">
            Track patterns across readings, revisit past insights, and watch your understanding deepen over time.
          </p>
        </div>
        <div className="grid gap-3 text-left text-sm text-muted sm:grid-cols-3">
          <div className="flex items-start gap-2">
            <JournalSearchIcon className="mt-0.5 h-4 w-4 text-accent" aria-hidden="true" />
            <div className="journal-prose">
              <p className="text-main font-semibold">Spot recurring themes</p>
              <p>Surface repeaters and spreads that resonate most.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <JournalPercentCircleIcon className="mt-0.5 h-4 w-4 text-accent" aria-hidden="true" />
            <div className="journal-prose">
              <p className="text-main font-semibold">Measure your growth</p>
              <p>See how questions evolve and which cards guide you.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <JournalCommentAddIcon className="mt-0.5 h-4 w-4 text-accent" aria-hidden="true" />
            <div className="journal-prose">
              <p className="text-main font-semibold">Capture reflections</p>
              <p>Keep notes beside each position to revisit later.</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[color:var(--border-warm-light)] bg-[color:var(--border-warm-subtle)] p-4 text-left shadow-[0_14px_40px_-24px_rgba(0,0,0,0.75)]">
          <p className="text-[0.78rem] uppercase tracking-[0.12em] text-muted mb-1">Example entry</p>
          <div className="journal-prose flex flex-col gap-1 text-sm text-muted-high">
            <p className="text-main font-semibold">Three-Card Story · Daily check-in</p>
            <p>Question: &ldquo;What pattern is emerging for me this week?&rdquo;</p>
            <p>Pull: The Star (upright), Six of Cups, Two of Wands</p>
            <p className="italic text-muted">Reflection: Hope is back. Remember the plan from Tuesday and take the next step.</p>
          </div>
        </div>
        <JournalEntryPreview />
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => onStartReading()}
            className={`${OUTLINE_BUTTON_CLASS} px-5 py-2.5 text-sm`}
          >
            Start a reading
          </button>
          <button
            type="button"
            onClick={() => navigate('/', { state: { focusSpread: true, initialQuestion: 'What pattern is emerging for me this week?' } })}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-warm-light)] bg-[color:var(--border-warm-subtle)] px-5 py-2.5 text-sm font-semibold text-main shadow-[0_12px_30px_-18px_var(--primary-30)] transition hover:-translate-y-0.5 hover:border-[color:var(--border-warm)] hover:bg-[color:var(--accent-25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
          >
            Try a guided draw
          </button>
        </div>
      </div>
    </div>
  );
}

export default JournalEmptyState;
