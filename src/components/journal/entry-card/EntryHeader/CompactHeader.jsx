/**
 * CompactHeader.jsx
 * Collapsed compact view for journal entry card - minimal 2-3 line list style.
 */
import { memo } from 'react';
import { CaretDown, DotsThreeVertical } from '@phosphor-icons/react';
import { JournalShareIcon } from '../../../JournalIcons';
import { REVERSED_PATTERN } from '../../../../lib/journalInsights';
import { styles, cn } from '../EntryCard.primitives';

export const CompactHeader = memo(function CompactHeader({
  entry,
  entryContentId,
  onToggle,
  metadata,
  actionMenu,
  actions,
  actionMenuId,
  renderActionMenu
}) {
  const {
    cards,
    cardPreview,
    formattedTimestamp,
    relativeTimeLabel,
    deckLabel,
    contextLabel
  } = metadata;

  const {
    pendingAction,
    handleShare
  } = actions;

  const {
    toggle: toggleMenu,
    buttonRef: actionMenuButtonRef
  } = actionMenu;

  const shareActionLabel = actions.isAuthenticated && actions.onCreateShareLink
    ? 'Create share link'
    : 'Copy summary';

  return (
    <div className="relative z-10 px-3.5 py-3">
      <div className="flex items-center gap-2">
        {/* Main clickable area */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={false}
          aria-controls={entryContentId}
          className="group flex flex-1 items-start gap-3 min-w-0 rounded-2xl px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:rgba(232,218,195,0.45)]"
        >
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border border-[color:rgba(255,255,255,0.14)] bg-[color:rgba(12,12,20,0.6)] text-[color:var(--text-muted)] shadow-[0_10px_18px_-12px_rgba(0,0,0,0.6)] flex-shrink-0">
            <CaretDown className="h-3.5 w-3.5" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            {/* Line 1: Title + context */}
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="min-w-0 text-[13px] sm:text-[14px] font-semibold text-[color:var(--brand-primary)] truncate flex-1">
                {entry.spread || entry.spreadName || 'Reading'}
              </h3>
              {contextLabel && (
                <span className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--text-muted)] hidden sm:inline">
                  {contextLabel}
                </span>
              )}
            </div>

            {/* Line 2: Meta row */}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[color:var(--text-muted)]">
              <span className="inline-flex items-center rounded-full border border-[color:rgba(255,255,255,0.12)] px-2 py-0.5">
                {relativeTimeLabel || formattedTimestamp}
              </span>
              <span className="inline-flex items-center rounded-full border border-[color:rgba(255,255,255,0.1)] px-2 py-0.5">
                {cards.length} {cards.length === 1 ? 'card' : 'cards'}
              </span>
              {deckLabel && (
                <span className="inline-flex items-center rounded-full border border-[color:rgba(255,255,255,0.08)] px-2 py-0.5 truncate max-w-[120px]">
                  {deckLabel}
                </span>
              )}
            </div>

            {/* Line 3: Card chips */}
            {cardPreview.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 mt-1">
                {cardPreview.slice(0, 2).map((card, idx) => {
                  const name = (card.name || 'Card').replace(/^The\s+/i, '');
                  const reversed = REVERSED_PATTERN.test(card?.orientation || '') || card?.isReversed;
                  return (
                    <span
                      key={`compact-${card.name || 'card'}-${idx}`}
                      className="inline-flex items-center gap-0.5 rounded-full border border-[color:rgba(255,255,255,0.12)] bg-[color:rgba(10,11,18,0.55)] px-1.5 py-0.5 text-[10px] text-[color:var(--text-muted)]"
                    >
                      <span className="text-[color:var(--text-main)] font-medium truncate max-w-[72px]">
                        {name}
                      </span>
                      {reversed && (
                        <span className="text-[9px] text-[color:var(--status-error)] font-semibold">R</span>
                      )}
                    </span>
                  );
                })}
                {cards.length > 2 && (
                  <span className="text-[10px] text-[color:var(--text-muted)]">+{cards.length - 2}</span>
                )}
              </div>
            )}

            {/* Line 4: Question (truncated) */}
            {entry.question && (
              <p className="text-[11px] text-[color:var(--text-muted)] truncate mt-1 leading-snug">
                {entry.question}
              </p>
            )}
          </div>
        </button>

        {/* Share button */}
        <button
          type="button"
          onClick={handleShare}
          disabled={pendingAction === 'share'}
          title={shareActionLabel}
          className={cn(
            styles.iconButtonCompact,
            pendingAction === 'share' && 'cursor-wait opacity-60'
          )}
        >
          <JournalShareIcon className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{shareActionLabel}</span>
        </button>

        {/* Action menu button */}
        <button
          type="button"
          ref={actionMenuButtonRef}
          onClick={(event) => {
            event.stopPropagation();
            toggleMenu();
          }}
          className={styles.iconButtonCompact}
          aria-haspopup="menu"
          aria-controls={actionMenuId}
          aria-expanded={actionMenu.isOpen}
          title="Entry actions"
        >
          <DotsThreeVertical className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Open entry actions</span>
        </button>

        {renderActionMenu()}
      </div>
    </div>
  );
});
