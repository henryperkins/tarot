/**
 * ShareLinksManager - Every share link the reader has made, single readings and
 * journal snapshots alike, with copy, rename and delete.
 *
 * Shown whenever the reader is signed in, including after a plan change: the
 * owner can always revoke a link even when they can no longer create one.
 */

import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowSquareOut, CircleNotch, ClipboardText, PencilSimple } from '@phosphor-icons/react';
import { JournalTrashIcon } from '../../JournalIcons';
import { copyTextToClipboard } from '../../../lib/journalInsights';

const TITLE_MAX_LENGTH = 80;
const ACTION_BUTTON_CLASS = 'inline-flex min-h-touch items-center gap-1.5 rounded-full border border-(--border-warm-light) bg-(--border-warm-subtle) px-3 py-1.5 text-xs font-semibold text-(--text-main) hover:bg-(--border-warm-light) focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color) disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation';
const DANGER_BUTTON_CLASS = 'inline-flex min-h-touch items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--status-error)_45%,transparent)] bg-[color-mix(in_srgb,var(--status-error)_12%,transparent)] px-3 py-1.5 text-xs font-semibold text-(--status-error) hover:border-[color-mix(in_srgb,var(--status-error)_70%,transparent)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--status-error)_45%,transparent)] disabled:cursor-not-allowed disabled:opacity-60 touch-manipulation';

function isExpired(link, now) {
  return Boolean(link?.expiresAt) && link.expiresAt <= now;
}

function describeExpiry(link, now) {
  if (!link?.expiresAt) return 'No expiry';
  const delta = link.expiresAt - now;
  if (delta <= 0) return 'Expired';
  const days = Math.ceil(delta / (24 * 60 * 60 * 1000));
  return days <= 1 ? 'Expires within a day' : `Expires in ${days} days`;
}

function describeLink(link, now) {
  const scopeLabel = link?.scope === 'entry' ? 'Single reading' : 'Journal snapshot';
  const count = link?.entryCount || 0;
  const views = link?.viewCount || 0;
  return [
    scopeLabel,
    `${count} ${count === 1 ? 'entry' : 'entries'}`,
    describeExpiry(link, now),
    `${views} ${views === 1 ? 'view' : 'views'}`
  ].join(' · ');
}

function shareUrl(token) {
  const path = `/share/${encodeURIComponent(token)}`;
  return typeof window === 'undefined' ? path : `${window.location.origin}${path}`;
}

function ShareLinkRow({ link, now, busy, onCopy, onRename, onDelete }) {
  const [mode, setMode] = useState('idle');
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  const confirmButtonRef = useRef(null);
  const renameButtonRef = useRef(null);
  const deleteButtonRef = useRef(null);
  const returnFocusRef = useRef(null);
  const inputId = useId();
  const expired = isExpired(link, now);
  const title = link.title || 'Untitled link';

  // Focus follows the form: into it when it opens, back to its button after.
  useEffect(() => {
    if (mode === 'rename') inputRef.current?.focus();
    if (mode === 'confirm-delete') confirmButtonRef.current?.focus();
    if (mode === 'idle' && returnFocusRef.current) {
      returnFocusRef.current.current?.focus();
      returnFocusRef.current = null;
    }
  }, [mode]);

  const closeForm = (returnFocusTo) => {
    returnFocusRef.current = returnFocusTo;
    setMode('idle');
  };

  const startRename = () => {
    setDraft(link.hasCustomTitle ? link.title : '');
    setMode('rename');
  };

  const submitRename = async (event) => {
    event.preventDefault();
    if (await onRename(link, draft)) closeForm(renameButtonRef);
  };

  return (
    <li className="rounded-lg border border-(--border-warm-subtle) bg-(--panel-dark-1) p-3">
      <p className="wrap-break-word text-sm font-semibold text-(--text-main)">{title}</p>
      <p className="mt-0.5 wrap-break-word text-xs sm:text-2xs text-muted-high">{describeLink(link, now)}</p>

      {mode === 'rename' && (
        <form className="mt-2 space-y-2" onSubmit={submitRename}>
          <label htmlFor={inputId} className="block text-xs sm:text-2xs text-muted-high">
            Link title <span className="text-muted">(shown when the link is shared; leave blank for the default)</span>
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            value={draft}
            readOnly={busy}
            maxLength={TITLE_MAX_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                if (!busy) closeForm(renameButtonRef);
              }
            }}
            placeholder={link.scope === 'entry' ? 'Shared reading' : 'Journal snapshot'}
            className="w-full min-h-touch rounded border border-(--border-warm-light) bg-(--border-warm-subtle) px-3 py-2 text-base sm:text-sm text-(--text-main) focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)"
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className={ACTION_BUTTON_CLASS}>
              {busy && <CircleNotch className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              Save title
            </button>
            <button type="button" disabled={busy} onClick={() => closeForm(renameButtonRef)} className={ACTION_BUTTON_CLASS}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {mode === 'confirm-delete' && (
        <div className="mt-2 space-y-2" role="group" aria-label={`Delete ${title}`}>
          <p className="text-xs text-muted-high">Delete this link? Anyone who has it will no longer be able to open it.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              ref={confirmButtonRef}
              disabled={busy}
              onClick={async () => {
                if (!(await onDelete(link))) closeForm(deleteButtonRef);
              }}
              className={DANGER_BUTTON_CLASS}
            >
              {busy ? <CircleNotch className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <JournalTrashIcon className="h-3.5 w-3.5" aria-hidden="true" />}
              Delete link
            </button>
            <button type="button" disabled={busy} onClick={() => closeForm(deleteButtonRef)} className={ACTION_BUTTON_CLASS}>
              Keep link
            </button>
          </div>
        </div>
      )}

      {mode === 'idle' && (
        <div className="mt-2 flex flex-wrap gap-2">
          {!expired && (
            <>
              <button type="button" disabled={busy} onClick={() => onCopy(link)} className={ACTION_BUTTON_CLASS}>
                <ClipboardText className="h-3.5 w-3.5 text-(--brand-primary)" aria-hidden="true" />
                Copy link
                <span className="sr-only"> for {title}</span>
              </button>
              <a
                href={`/share/${encodeURIComponent(link.token)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={ACTION_BUTTON_CLASS}
              >
                <ArrowSquareOut className="h-3.5 w-3.5 text-(--brand-primary)" aria-hidden="true" />
                Open
                <span className="sr-only"> {title} (opens in a new tab)</span>
              </a>
            </>
          )}
          <button type="button" ref={renameButtonRef} disabled={busy} onClick={startRename} className={ACTION_BUTTON_CLASS}>
            <PencilSimple className="h-3.5 w-3.5 text-(--brand-primary)" aria-hidden="true" />
            Rename
            <span className="sr-only"> {title}</span>
          </button>
          <button
            type="button"
            ref={deleteButtonRef}
            disabled={busy}
            onClick={() => setMode('confirm-delete')}
            className={DANGER_BUTTON_CLASS}
          >
            <JournalTrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Delete
            <span className="sr-only"> {title}</span>
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * @param {Object} props
 * @param {Array} props.links - Links from GET /api/share
 * @param {boolean} props.loading
 * @param {string} props.error - Load error, if any
 * @param {Function} [props.onDelete] - (token) => Promise
 * @param {Function} [props.onRename] - (token, title) => Promise
 * @param {Function} [props.onRefresh] - Reloads the list
 */
function ShareLinksManager({ links = [], loading = false, error = '', onDelete, onRename, onRefresh }) {
  const [pendingToken, setPendingToken] = useState(null);
  const [status, setStatus] = useState(null);
  const [hasShownLinks, setHasShownLinks] = useState(false);
  const [focusListRequest, setFocusListRequest] = useState(0);
  const headingId = useId();
  const listRef = useRef(null);
  const [now, setNow] = useState(() => Date.now());
  const safeLinks = useMemo(() => Array.isArray(links) ? links.filter((link) => link?.token) : [], [links]);
  if (safeLinks.length > 0 && !hasShownLinks) setHasShownLinks(true);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const nextExpiry = Math.min(...safeLinks.map(link => link.expiresAt).filter(expiry => expiry > now));
    // Wake at expiry, and refresh relative day labels while the panel is open.
    const timer = setTimeout(refresh, Math.max(1, Math.min(60_000, nextExpiry - Date.now())));
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [now, safeLinks]);

  useEffect(() => {
    if (!status) return undefined;
    const timer = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(timer);
  }, [status]);

  // A deleted row unmounts with the refreshed list; keep focus inside the section.
  useEffect(() => {
    if (focusListRequest) listRef.current?.focus();
  }, [focusListRequest]);

  // Readers who never made a link see nothing; deleting the last one leaves an
  // empty state so focus and the confirmation have somewhere to stay.
  if (!loading && !error && safeLinks.length === 0 && !hasShownLinks) return null;

  const runAction = async (token, task) => {
    setPendingToken(token);
    try {
      return await task();
    } finally {
      setPendingToken(null);
    }
  };

  const handleCopy = (link) => runAction(link.token, async () => {
    const copied = await copyTextToClipboard(shareUrl(link.token));
    setStatus(copied
      ? { type: 'success', message: `Copied the link for “${link.title}”.` }
      : { type: 'error', message: 'Copying was blocked. Open the link and copy it from the address bar.' });
  });

  const handleRename = (link, title) => runAction(link.token, async () => {
    if (!onRename) return false;
    try {
      const result = await onRename(link.token, title);
      setStatus({ type: 'success', message: `Renamed the link to “${result?.title || title}”.` });
      return true;
    } catch (renameError) {
      setStatus({ type: 'error', message: renameError?.message || 'Unable to rename this link.' });
      return false;
    }
  });

  const handleDelete = (link) => runAction(link.token, async () => {
    if (!onDelete) return false;
    try {
      await onDelete(link.token);
      setStatus({ type: 'success', message: `Deleted “${link.title}”. It no longer opens.` });
      setFocusListRequest((request) => request + 1);
      return true;
    } catch (deleteError) {
      setStatus({ type: 'error', message: deleteError?.message || 'Unable to delete this link.' });
      return false;
    }
  });

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p id={headingId} className="text-sm sm:text-xs text-muted">
          Your share links{safeLinks.length > 0 ? ` (${safeLinks.length})` : ''}
        </p>
        {loading && (
          <span className="inline-flex items-center gap-1 text-xs sm:text-2xs text-muted" role="status">
            <CircleNotch className="h-3 w-3 animate-spin" aria-hidden="true" />
            Loading links…
          </span>
        )}
      </div>

      {error && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs sm:text-2xs text-(--status-error)" role="alert">
          <span>{error}</span>
          {onRefresh && (
            <button type="button" onClick={() => onRefresh()} className="min-h-touch font-semibold underline underline-offset-2 text-(--text-main) focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)">
              Try again
            </button>
          )}
        </div>
      )}

      {safeLinks.length === 0 && !loading && !error && (
        <p ref={listRef} tabIndex={-1} className="text-xs sm:text-2xs text-muted focus-visible:outline-hidden">
          You have no active share links.
        </p>
      )}

      {safeLinks.length > 0 && (
        <ul ref={listRef} tabIndex={-1} className="space-y-2 focus-visible:outline-hidden" aria-labelledby={headingId}>
          {safeLinks.map((link) => (
            <ShareLinkRow
              key={link.token}
              link={link}
              now={now}
              busy={pendingToken !== null}
              onCopy={handleCopy}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}

      <p className="mt-2 text-xs sm:text-2xs" aria-live="polite">
        {status && (
          <span className={status.type === 'success' ? 'text-(--status-success)' : 'text-(--status-error)'}>
            {status.message}
          </span>
        )}
      </p>
    </section>
  );
}

export default memo(ShareLinksManager);
