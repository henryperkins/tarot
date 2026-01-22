/**
 * ShareLinksPanel.jsx
 * Displays active share links within the action menu.
 */
import { memo } from 'react';
import { ClipboardText, CircleNotch } from '@phosphor-icons/react';
import { JournalTrashIcon } from '../../../JournalIcons';
import { MAX_SHARE_LINKS_IN_MENU } from '../EntryCard.primitives';

function formatShareExpiry(expiresAt) {
  if (!expiresAt) return 'No expiry';
  const expiryMs = typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime();
  if (!Number.isFinite(expiryMs)) return 'No expiry';
  const delta = expiryMs - Date.now();
  if (delta <= 0) return 'Expired';
  const days = Math.ceil(delta / (1000 * 60 * 60 * 24));
  if (days <= 1) return 'Expires soon';
  return `Expires in ${days}d`;
}

function getShareScopeLabel(link) {
  return link?.scope === 'entry' ? 'Single reading' : 'Journal snapshot';
}

function formatShareMeta(link) {
  const entryCount = link?.entryCount || 0;
  const countLabel = entryCount === 1 ? '1 entry' : `${entryCount} entries`;
  const expiryLabel = formatShareExpiry(link?.expiresAt);
  return `${countLabel} • ${expiryLabel}`;
}

export const ShareLinksPanel = memo(function ShareLinksPanel({
  shareLinks,
  shareLoading,
  shareError,
  entryId,
  onCopyShareLink,
  onDeleteShareLink,
  pendingAction
}) {
  // Filter to only entry-scoped links for this entry
  const entryShareLinks = Array.isArray(shareLinks)
    ? shareLinks.filter((link) => {
        if (link?.scope && link.scope !== 'entry') return false;
        const ids = Array.isArray(link?.entryIds) ? link.entryIds : [];
        if (entryId) {
          return ids.includes(entryId) || link?.entryId === entryId;
        }
        return ids.length === 1 || link?.entryCount === 1;
      })
    : [];

  const shareLinksPreview = entryShareLinks.slice(0, MAX_SHARE_LINKS_IN_MENU);
  const extraShareLinks = Math.max(0, entryShareLinks.length - shareLinksPreview.length);
  const shareActionsDisabled = pendingAction === 'share-link-copy' || pendingAction === 'share-link-delete';

  return (
    <div className="mt-3 rounded-xl border border-[color:var(--border-warm)] bg-[color:var(--main-45)] p-3 shadow-[0_14px_36px_-24px_rgba(0,0,0,0.8)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
          Active share links
        </p>
        {shareLoading ? (
          <CircleNotch
            className="h-3.5 w-3.5 animate-spin text-[color:var(--text-muted)]"
            aria-label="Loading share links"
          />
        ) : (
          <span className="text-[11px] text-[color:var(--text-muted)]">
            {shareLinksPreview.length > 0 ? `${shareLinksPreview.length}${extraShareLinks ? '+' : ''} shown` : 'None'}
          </span>
        )}
      </div>

      {shareError && (
        <p className="mt-1 text-[11px] text-[color:var(--status-error)]" aria-live="polite">
          {shareError}
        </p>
      )}

      {shareLoading && (
        <div className="mt-2 space-y-2" aria-live="polite">
          {[0, 1].map((skeleton) => (
              <div
                key={skeleton}
                className="h-10 rounded-lg bg-[color:var(--border-warm-subtle)] animate-pulse"
              />
          ))}
        </div>
      )}

      {!shareLoading && !shareError && shareLinksPreview.length === 0 && (
        <p className="mt-2 text-[12px] text-[color:var(--text-muted)]">
          No active links for this reading yet—create one to share it.
        </p>
      )}

      {!shareLoading && shareLinksPreview.length > 0 && (
        <ul className="mt-2 space-y-2">
          {shareLinksPreview.map((link) => {
            const meta = formatShareMeta(link);
            const isShareLinkPending = shareActionsDisabled;
            return (
              <li
                key={link.token}
                className="rounded-lg border border-[color:var(--border-warm-subtle)] bg-[color:var(--panel-dark-1)] p-2.5 shadow-[0_10px_26px_-22px_rgba(0,0,0,0.7)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-semibold text-[color:var(--text-main)]">
                      {link.title || 'Untitled link'}
                    </p>
                    <p className="truncate text-[11px] text-[color:var(--text-muted)]">
                      {getShareScopeLabel(link)} · {meta}
                    </p>
                  </div>
                  <span className="text-[11px] text-[color:var(--text-muted)]">
                    {link.viewCount || 0} views
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onCopyShareLink(link.token)}
                    disabled={isShareLinkPending}
                    className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-warm-light)] bg-[color:var(--border-warm-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--text-main)] hover:bg-[color:var(--primary-20)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-45)] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {pendingAction === 'share-link-copy' ? (
                      <CircleNotch
                        className="h-3 w-3 animate-spin text-[color:var(--text-muted)]"
                        aria-hidden="true"
                      />
                    ) : (
                      <ClipboardText
                        className="h-3.5 w-3.5 text-[color:var(--brand-primary)]"
                        aria-hidden="true"
                      />
                    )}
                    Copy
                  </button>
                  {onDeleteShareLink && (
                    <button
                      type="button"
                      onClick={() => onDeleteShareLink(link.token)}
                      disabled={isShareLinkPending}
                      className="inline-flex items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--status-error)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--status-error)_12%,transparent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--status-error)] hover:border-[color:color-mix(in_srgb,var(--status-error)_70%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--status-error)_45%,transparent)] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {pendingAction === 'share-link-delete' ? (
                        <CircleNotch
                          className="h-3 w-3 animate-spin text-[color:var(--status-error)]"
                          aria-hidden="true"
                        />
                      ) : (
                        <JournalTrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Delete
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {extraShareLinks > 0 && (
        <p className="mt-2 text-[11px] text-[color:var(--text-muted)]">
          Showing the first {shareLinksPreview.length} of {entryShareLinks.length} links.
        </p>
      )}
    </div>
  );
});
