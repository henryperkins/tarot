/**
 * FollowUpSection.jsx
 * Displays follow-up chat turns and provides action buttons for continuing.
 */
import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Lightning } from '@phosphor-icons/react';
import { normalizeTimestamp } from '../../../../../shared/journal/utils.js';
import { requestSignIn } from '../../../../lib/openSignIn.js';
import { styles, cn } from '../EntryCard.primitives';

function formatFollowUpTimestamp(value) {
  const ts = normalizeTimestamp(value);
  if (!ts) return null;
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const FollowUpTurn = memo(function FollowUpTurn({ turn, fallbackTurnNumber }) {
  const turnLabel = turn.turnNumber ? `Turn ${turn.turnNumber}` : `Turn ${fallbackTurnNumber}`;
  const tsLabel = formatFollowUpTimestamp(turn.createdAt);
  const patterns = turn.journalContext?.patterns || [];

  return (
    <li className={styles.turnCard}>
      <div className="flex items-start justify-between gap-2 text-xs text-muted">
        <span className="flex items-center gap-2">
          <span className="font-semibold text-(--text-main)">{turnLabel}</span>
          {tsLabel && <span aria-hidden="true">•</span>}
          {tsLabel && <span>{tsLabel}</span>}
        </span>
        {patterns.length > 0 && (
          <span className="inline-flex items-center gap-1 text-2xs text-(--brand-primary)">
            <Lightning className="h-3 w-3" weight="fill" aria-hidden="true" />
            {patterns.length} pattern{patterns.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <div className="mt-2 space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-label text-muted">You</p>
          <p className="text-sm font-semibold text-(--text-main)">{turn.question}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-label text-muted">Reader</p>
          <div className="journal-narrative-prose prose prose-base max-w-none wrap-anywhere text-(--text-main) prose-a:text-(--brand-primary) prose-strong:text-(--text-main)">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} skipHtml>
            {turn.answer || ''}
          </ReactMarkdown>
          </div>
        </div>
      </div>
    </li>
  );
});

export const FollowUpSection = memo(function FollowUpSection({
  followUps,
  followUpPreview,
  hasHiddenFollowUps,
  followUpLimit,
  followUpTurnsUsed,
  canAskFollowUp,
  isAuthenticated,
  effectiveTier,
  onOpenFollowUp
}) {
  const hasFollowUps = followUps.length > 0;

  return (
    <section className={cn(styles.section, 'mt-4')}>
      <header className={styles.sectionHeader}>
        <div className="flex items-center gap-2">
          <Lightning className="h-4 w-4 text-(--brand-primary)" aria-hidden="true" />
          <div className={styles.sectionLabel}>Follow-up chat</div>
        </div>
        <span className="text-xs text-muted">{followUps.length}</span>
      </header>

      <div className={styles.sectionBody}>
        {hasFollowUps ? (
          <ol className="space-y-3">
            {followUpPreview.map((turn, idx) => {
              const key = turn.turnNumber || idx;
              const fallbackTurnNumber = followUps.length - followUpPreview.length + idx + 1;
              return (
                <FollowUpTurn
                  key={key}
                  turn={turn}
                  fallbackTurnNumber={fallbackTurnNumber}
                />
              );
            })}
          </ol>
        ) : (
          <div className={styles.turnCard}>
            <span className="text-xs text-muted">
              No follow-ups yet — Ask one.
            </span>
          </div>
        )}

        {hasHiddenFollowUps && (
          <p className="mt-3 text-2xs text-(--text-muted)">
            Showing the most recent {followUpPreview.length} of {followUps.length} turns.
          </p>
        )}

        {isAuthenticated && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-2xs text-(--text-muted)">
            <span>Limits reset per reading.</span>
            {!canAskFollowUp && effectiveTier === 'free' && (
              <a
                href="/pricing"
                className="inline-flex min-h-touch items-center rounded px-1 text-(--brand-primary) hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)"
              >
                Upgrade to Plus for 3 follow-ups
              </a>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                requestSignIn();
                return;
              }
              onOpenFollowUp('ask');
            }}
            disabled={isAuthenticated && !canAskFollowUp}
            title={
              canAskFollowUp
                ? 'Ask a follow-up'
                : !isAuthenticated
                  ? 'Sign in to ask follow-up questions'
                  : 'Follow-up limit reached for this reading'
            }
            className={cn(
              styles.actionButton,
              !isAuthenticated || canAskFollowUp ? styles.actionButtonEnabled : styles.actionButtonDisabled
            )}
          >
            <Lightning className="h-3.5 w-3.5 text-(--brand-primary)" aria-hidden="true" />
            {canAskFollowUp ? 'Ask a follow-up' : isAuthenticated ? 'Limit reached' : 'Sign in to ask'}
          </button>

          {hasFollowUps && (
            <button
              type="button"
              onClick={() => onOpenFollowUp('continue')}
              className={cn(
                styles.actionButton,
                'border-(--border-warm-light) bg-transparent text-(--text-muted)',
                'hover:border-(--border-warm) hover:bg-(--border-warm-subtle) hover:text-(--text-main)'
              )}
              title={canAskFollowUp ? 'Continue chat' : 'Open full chat'}
            >
              {canAskFollowUp ? 'Continue chat' : 'Open full chat'}
            </button>
          )}

          <span className="text-2xs text-(--text-muted)">
            {isAuthenticated
              ? `Follow-ups used: ${followUpTurnsUsed}/${followUpLimit}`
              : 'Sign in to unlock follow-up chat'}
          </span>
        </div>
      </div>
    </section>
  );
});
