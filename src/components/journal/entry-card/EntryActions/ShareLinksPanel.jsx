/**
 * ShareLinksPanel.jsx
 * This reading's share links, inside the entry action menu: copy one, or
 * delete it after confirming. Each link is a group named by its title and
 * described by its creation date, expiry and views, so screen readers hear
 * which link a "Copy link" or "Delete" item belongs to.
 */
import { memo, useEffect, useId, useRef, useState } from 'react';
import { ClipboardText, CircleNotch } from '@phosphor-icons/react';
import { JournalTrashIcon } from '../../../JournalIcons';
import { MAX_SHARE_LINKS_IN_MENU } from '../EntryCard.primitives';
import { BADGE_LABEL_CLASS } from '../../../../styles/labelClasses';
import { isShareLinkForEntry } from '../../../../lib/journal/shareLinkSelection';

const ITEM_CLASS =
  'inline-flex min-h-touch items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ' +
  'focus-visible:outline-hidden focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60';
const NEUTRAL_ITEM_CLASS =
  `${ITEM_CLASS} border-(--border-warm-light) bg-(--border-warm-subtle) text-(--text-main) hover:bg-(--primary-20) ` +
  'focus-visible:ring-(--focus-ring-color)';
const DANGER_ITEM_CLASS =
  `${ITEM_CLASS} border-[color-mix(in_srgb,var(--status-error)_45%,transparent)] ` +
  'bg-[color-mix(in_srgb,var(--status-error)_12%,transparent)] text-(--status-error) ' +
  'hover:border-[color-mix(in_srgb,var(--status-error)_70%,transparent)] ' +
  'focus-visible:ring-[color-mix(in_srgb,var(--status-error)_45%,transparent)]';

function toTime(value) {
  if (value == null || value === '') return null;
  const time = typeof value === 'number' ? value : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function describeExpiry(expiresAt, now) {
  const time = toTime(expiresAt);
  if (time === null) return 'No expiry';
  const delta = time - now;
  if (delta <= 0) return 'Expired';
  const days = Math.ceil(delta / (24 * 60 * 60 * 1000));
  return days <= 1 ? 'Expires within a day' : `Expires in ${days} days`;
}

function describeLink(link, now) {
  const created = toTime(link?.createdAt);
  const views = link?.viewCount || 0;
  return [
    created === null
      ? null
      : `Created ${new Date(created).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
    describeExpiry(link?.expiresAt, now),
    `${views} ${views === 1 ? 'view' : 'views'}`
  ].filter(Boolean).join(' · ');
}

export const ShareLinksPanel = memo(function ShareLinksPanel({
  shareLinks,
  shareLoading,
  shareError,
  entryId,
  onCopyShareLink,
  onDeleteShareLink,
  onClose,
  pendingAction
}) {
  const headingId = useId();
  const [confirmingToken, setConfirmingToken] = useState(null);
  const keepButtonRef = useRef(null);
  const deleteButtonRefs = useRef(new Map());
  const returnFocusTokenRef = useRef(null);

  // Confirming moves focus to the safe choice; cancelling returns it to Delete.
  useEffect(() => {
    if (confirmingToken) {
      keepButtonRef.current?.focus();
    } else if (returnFocusTokenRef.current) {
      deleteButtonRefs.current.get(returnFocusTokenRef.current)?.focus();
      returnFocusTokenRef.current = null;
    }
  }, [confirmingToken]);

  const cancelConfirmation = (token) => {
    returnFocusTokenRef.current = token;
    setConfirmingToken(null);
  };

  const now = Date.now();
  const entryShareLinks = Array.isArray(shareLinks)
    ? shareLinks.filter((link) => (entryId
      ? isShareLinkForEntry(link, entryId)
      : (!link?.scope || link.scope === 'entry') && (link?.entryIds?.length === 1 || link?.entryCount === 1)))
    : [];
  const shareLinksPreview = entryShareLinks.slice(0, MAX_SHARE_LINKS_IN_MENU);
  const extraShareLinks = Math.max(0, entryShareLinks.length - shareLinksPreview.length);
  const shareActionsDisabled = pendingAction === 'share-link-copy' || pendingAction === 'share-link-delete';

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      aria-busy={shareLoading || undefined}
      className="mt-3 rounded-xl border border-(--border-warm) bg-(--main-45) p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={headingId} className={`${BADGE_LABEL_CLASS} text-(--text-muted)`}>
          Share links for this reading
        </p>
        {shareLoading ? (
          <CircleNotch className="h-3.5 w-3.5 animate-spin text-(--text-muted)" aria-hidden="true" />
        ) : entryShareLinks.length > 0 ? (
          <span className="text-2xs text-(--text-muted)">{entryShareLinks.length}</span>
        ) : null}
      </div>

      {shareError && (
        <p className="mt-1 text-xs text-(--status-error)">
          {shareError}
        </p>
      )}

      {shareLoading && (
        <div className="mt-2 space-y-2" aria-hidden="true">
          {[0, 1].map((skeleton) => (
            <div key={skeleton} className="h-10 rounded-lg bg-(--border-warm-subtle) motion-safe:animate-pulse" />
          ))}
        </div>
      )}

      {!shareLoading && !shareError && shareLinksPreview.length === 0 && (
        <p className="mt-2 text-xs text-muted">
          No share links for this reading yet. The share button beside this menu creates one, and anyone with that link can open the reading.
        </p>
      )}

      {!shareLoading && shareLinksPreview.length > 0 && (
        <div className="mt-2 space-y-2">
          {shareLinksPreview.map((link) => {
            const title = link.title || 'Shared reading';
            const meta = describeLink(link, now);
            const metaId = `${headingId}-${link.token}`;
            const confirming = confirmingToken === link.token;
            return (
              <div
                key={link.token}
                role="group"
                aria-label={title}
                aria-describedby={metaId}
                className="rounded-lg border border-(--border-warm-subtle) bg-(--panel-dark-1) p-2.5"
              >
                <p className="wrap-break-word text-sm font-semibold text-(--text-main)">{title}</p>
                <p id={metaId} className="mt-0.5 wrap-break-word text-2xs text-(--text-muted)">{meta}</p>

                {confirming ? (
                  <div
                    role="group"
                    aria-label="Delete this link? Anyone who has it will no longer be able to open it."
                    className="mt-2 space-y-2"
                    onKeyDown={(event) => {
                      // Escape backs out of the confirmation before it closes the menu.
                      if (event.key !== 'Escape') return;
                      event.preventDefault();
                      event.stopPropagation();
                      cancelConfirmation(link.token);
                    }}
                  >
                    <p className="text-xs text-(--text-muted-high)">
                      Delete this link? Anyone who has it will no longer be able to open it.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        role="menuitem"
                        tabIndex={-1}
                        disabled={shareActionsDisabled}
                        onClick={() => {
                          onClose();
                          onDeleteShareLink(link.token, title);
                        }}
                        className={DANGER_ITEM_CLASS}
                      >
                        <JournalTrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        Delete link
                      </button>
                      <button
                        ref={keepButtonRef}
                        type="button"
                        role="menuitem"
                        tabIndex={-1}
                        onClick={() => cancelConfirmation(link.token)}
                        className={NEUTRAL_ITEM_CLASS}
                      >
                        Keep link
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      onClick={() => {
                        onClose();
                        onCopyShareLink(link.token);
                      }}
                      disabled={shareActionsDisabled}
                      className={NEUTRAL_ITEM_CLASS}
                    >
                      {pendingAction === 'share-link-copy' ? (
                        <CircleNotch className="h-3 w-3 animate-spin text-(--text-muted)" aria-hidden="true" />
                      ) : (
                        <ClipboardText className="h-3.5 w-3.5 text-(--brand-primary)" aria-hidden="true" />
                      )}
                      Copy link
                    </button>
                    {onDeleteShareLink && (
                      <button
                        ref={(node) => {
                          if (node) deleteButtonRefs.current.set(link.token, node);
                          else deleteButtonRefs.current.delete(link.token);
                        }}
                        type="button"
                        role="menuitem"
                        tabIndex={-1}
                        onClick={() => setConfirmingToken(link.token)}
                        disabled={shareActionsDisabled}
                        className={DANGER_ITEM_CLASS}
                      >
                        {pendingAction === 'share-link-delete' ? (
                          <CircleNotch className="h-3 w-3 animate-spin text-(--status-error)" aria-hidden="true" />
                        ) : (
                          <JournalTrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {extraShareLinks > 0 && (
        <p className="mt-2 text-2xs text-(--text-muted)">
          Showing the newest {shareLinksPreview.length} of {entryShareLinks.length} links. Manage all of them in Export &amp; Share.
        </p>
      )}
    </div>
  );
});
