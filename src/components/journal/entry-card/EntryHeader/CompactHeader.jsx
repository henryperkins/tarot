/**
 * CompactHeader.jsx
 * Collapsed compact view for journal entry card - minimal 2-3 line list style.
 */
import { memo } from 'react';
import { CaretDown, DotsThreeVertical } from '@phosphor-icons/react';
import { JournalShareIcon } from '../../../JournalIcons';
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
    formattedTimestamp,
    relativeTimeLabel
  } = metadata;

  const timestampLabel = relativeTimeLabel || formattedTimestamp;

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
          className="group flex flex-1 items-start gap-3 min-w-0 rounded-2xl px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
        >
          <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl border border-[color:var(--border-warm-light)] bg-[color:var(--panel-dark-2)] text-[color:var(--text-muted)] shadow-[0_10px_18px_-12px_rgba(0,0,0,0.6)] flex-shrink-0">
            <CaretDown className="h-4 w-4" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="min-w-0 text-sm font-semibold text-accent truncate">
              {entry.spread || entry.spreadName || 'Reading'}
            </h3>
            {timestampLabel && (
              <p className="mt-1 text-2xs text-muted truncate">
                {timestampLabel}
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
          <JournalShareIcon className="h-5 w-5" aria-hidden="true" />
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
          <DotsThreeVertical className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Open entry actions</span>
        </button>

        {renderActionMenu()}
      </div>
    </div>
  );
});
