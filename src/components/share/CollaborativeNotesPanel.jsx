import { useMemo, useState, useEffect, useId, useCallback, useRef } from 'react';

const ALIAS_STORAGE_KEY = 'mystic-share-alias';
const DRAFT_STORAGE_KEY = 'mystic-share-draft';
const REPORTED_NOTES_STORAGE_PREFIX = 'mystic-share-reported-notes';

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'sexual', label: 'Sexual content' },
  { value: 'self-harm', label: 'Self-harm' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'other', label: 'Other' }
];

function getTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

/**
 * Format timestamp with relative time for recent timestamps
 */
function formatTimestamp(ts) {
  if (!ts) return 'never';

  const timestamp = getTimestamp(ts);
  if (!timestamp) return 'recently';

  const now = Date.now();
  const diff = now - timestamp;

  // Relative time for recent
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

  // Absolute for older
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/**
 * LocalStorage-backed state for client-side usage.
 * Reads once during initial render and debounces writes.
 */
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return initialValue;
      }
      const stored = window.localStorage.getItem(key);
      return stored !== null ? stored : initialValue;
    } catch {
      // localStorage unavailable
      return initialValue;
    }
  });

  // Debounced save to localStorage
  const saveTimeoutRef = useRef(null);
  const setAndPersist = useCallback((newValue) => {
    setValue(newValue);

    // Debounce localStorage writes
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      try {
        if (typeof window === 'undefined' || !window.localStorage) {
          return;
        }
        // Handle empty strings by removing the key, otherwise persist the value
        if (newValue === '' || newValue === null || newValue === undefined) {
          window.localStorage.removeItem(key);
        } else {
          window.localStorage.setItem(key, newValue);
        }
      } catch {
        // localStorage unavailable
      }
    }, 500);
  }, [key]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return [value, setAndPersist];
}

function getReportedNotesKey(shareToken) {
  return shareToken ? `${REPORTED_NOTES_STORAGE_PREFIX}-${shareToken}` : REPORTED_NOTES_STORAGE_PREFIX;
}

function readStoredList(key) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }
    const stored = window.localStorage.getItem(key);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredList(key, list) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // localStorage unavailable
  }
}

export function CollaborativeNotesPanel({
  notes = [],
  cards = [],
  shareToken,
  onSubmit,
  onReport,
  isSubmitting,
  onRefresh,
  error,
  selectedPosition,
  onSelectedPositionChange,
  lastSyncedAt
}) {
  const [authorName, setAuthorName] = useLocalStorage(ALIAS_STORAGE_KEY, '');
  const [cardPosition, setCardPosition] = useState(selectedPosition || '');
  const [body, setBody] = useLocalStorage(DRAFT_STORAGE_KEY, '');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusTone, setStatusTone] = useState('neutral');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reportingNoteId, setReportingNoteId] = useState(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0].value);
  const [reportDetails, setReportDetails] = useState('');
  const [reportError, setReportError] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const statusTimeoutRef = useRef(null);

  const reportedNotesKey = getReportedNotesKey(shareToken);
  const [reportedNoteIds, setReportedNoteIds] = useState(() => new Set(readStoredList(reportedNotesKey)));

  // Generate unique IDs for accessibility
  const nameInputId = useId();
  const positionSelectId = useId();
  const bodyTextareaId = useId();
  const statusId = useId();

  // Sync external position changes
  useEffect(() => {
    if (selectedPosition !== undefined) {
      setCardPosition(selectedPosition || '');
    }
  }, [selectedPosition]);

  const setStatus = useCallback((message, tone = 'neutral', timeoutMs) => {
    setStatusMessage(message);
    setStatusTone(tone);

    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }

    if (timeoutMs) {
      statusTimeoutRef.current = setTimeout(() => {
        setStatusMessage('');
        setStatusTone('neutral');
        statusTimeoutRef.current = null;
      }, timeoutMs);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (error) {
      setStatus(error, 'error');
    }
  }, [error, setStatus]);

  useEffect(() => {
    setReportedNoteIds(new Set(readStoredList(reportedNotesKey)));
  }, [reportedNotesKey]);

  const sortedNotes = useMemo(() => {
    return [...notes]
      .map((note) => {
        const createdAtMs = getTimestamp(note.createdAt);
        return {
          ...note,
          createdAtMs,
          formattedCreatedAt: formatTimestamp(note.createdAt),
          isoCreatedAt: createdAtMs ? new Date(createdAtMs).toISOString() : undefined
        };
      })
      .sort((a, b) => (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0));
  }, [notes]);

  const markNoteReported = useCallback((noteId) => {
    setReportedNoteIds((prev) => {
      const next = new Set(prev);
      next.add(noteId);
      writeStoredList(reportedNotesKey, Array.from(next));
      return next;
    });
  }, [reportedNotesKey]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const text = body.trim();
    if (!text) {
      setStatus('Add a note before sending.', 'error', 2500);
      return;
    }
    try {
      await onSubmit?.({
        authorName: authorName.trim(),
        body: text,
        cardPosition: cardPosition || null
      });
      setBody('');
      setStatus('Shared!', 'success', 2500);
    } catch (submitError) {
      setStatus(submitError?.message || 'Unable to add note.', 'error');
    }
  };

  const handlePositionChange = (value) => {
    setCardPosition(value);
    onSelectedPositionChange?.(value);
  };

  const handleRefresh = async () => {
    if (isRefreshing || !onRefresh) return;
    setIsRefreshing(true);
    const previousCount = notes.length;
    try {
      const result = await onRefresh();
      if (result?.error) {
        setStatus(result.error, 'error');
      } else {
        const nextCount = typeof result?.count === 'number' ? result.count : notes.length;
        const message = nextCount > previousCount ? 'Updated just now.' : 'No new notes yet.';
        setStatus(message, 'neutral', 2500);
      }
    } catch (refreshError) {
      setStatus(refreshError?.message || 'Unable to refresh notes.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReportStart = (noteId) => {
    setReportingNoteId(noteId);
    setReportReason(REPORT_REASONS[0].value);
    setReportDetails('');
    setReportError('');
  };

  const handleReportCancel = () => {
    setReportingNoteId(null);
    setReportDetails('');
    setReportError('');
  };

  const handleReportSubmit = async (noteId) => {
    if (!onReport || reportSubmitting) return;
    if (reportReason === 'other' && !reportDetails.trim()) {
      setReportError('Please add details for other reports.');
      return;
    }
    setReportSubmitting(true);
    setReportError('');
    try {
      await onReport({
        noteId,
        reason: reportReason,
        details: reportDetails.trim() || null
      });
      markNoteReported(noteId);
      setStatus('Report received. Thanks for helping keep this space safe.', 'success', 3000);
      setReportingNoteId(null);
      setReportDetails('');
    } catch (submitError) {
      setReportError(submitError?.message || 'Unable to submit report.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const lastSyncedAtMs = getTimestamp(lastSyncedAt);
  const lastSyncedAtLabel = formatTimestamp(lastSyncedAt);

  return (
    <section
      className="rounded-3xl border border-secondary/30 bg-surface/85 p-5 sm:p-6 shadow-xl"
      aria-labelledby="collab-notes-title"
    >
      <header className="flex items-center justify-between gap-3">
        <h3 id="collab-notes-title" className="text-lg sm:text-xl font-serif text-main">
          Shared reflections
        </h3>
        {onRefresh && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh shared notes"
            className="inline-flex items-center gap-2 rounded-full border border-secondary/40 px-3 py-1.5 text-xs font-medium text-secondary transition-colors
              hover:bg-secondary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/70 focus-visible:ring-offset-2
              disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        )}
      </header>

      <p className="mt-1 text-xs text-secondary/70">
        Last synced: <time dateTime={lastSyncedAtMs ? new Date(lastSyncedAtMs).toISOString() : undefined}>
          {lastSyncedAtLabel}
        </time>
      </p>

      {error && (
        <p className="mt-3 text-sm text-error" role="alert">
          {error}
        </p>
      )}

      {/* Notes list with responsive max-height */}
      <div
        className="mt-4 space-y-3 overflow-y-auto pr-1 max-h-[min(240px,40vh)]"
        style={{ WebkitOverflowScrolling: 'touch' }}
        aria-label={`${sortedNotes.length} reflection${sortedNotes.length === 1 ? '' : 's'}`}
        role="list"
      >
        {sortedNotes.length === 0 && (
          <p className="text-sm text-muted py-4 text-center">
            No reflections yet. Be the first to leave a note.
          </p>
        )}
        {sortedNotes.map((note) => {
          const isReported = reportedNoteIds.has(note.id);
          const isReporting = reportingNoteId === note.id;

          return (
            <article
              key={note.id}
              role="listitem"
              className="rounded-2xl border border-accent/20 bg-surface-muted/70 p-3"
            >
              <div className="flex items-center justify-between gap-2 text-xs text-secondary/90">
                <span className="font-semibold truncate">{note.authorName || 'Anonymous'}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {isReported ? (
                    <span className="text-2xs uppercase tracking-[0.14em] text-muted">Reported</span>
                  ) : onReport ? (
                    <button
                      type="button"
                      onClick={() => handleReportStart(note.id)}
                      className="text-2xs text-muted hover:text-accent transition"
                      aria-label="Report this note"
                    >
                      Report
                    </button>
                  ) : null}
                  <time
                    dateTime={note.isoCreatedAt}
                    className="text-secondary/70"
                  >
                    {note.formattedCreatedAt}
                  </time>
                </div>
              </div>
              {note.cardPosition && (
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-accent/70">
                  {note.cardPosition}
                </p>
              )}
              {isReported ? (
                <p className="mt-2 text-xs text-muted">
                  Report received. Thanks for helping keep this space safe.
                </p>
              ) : (
                <p className="mt-2 text-sm text-main/90 whitespace-pre-wrap break-words">
                  {note.body}
                </p>
              )}

              {isReporting && !isReported && (
                <div className="mt-3 rounded-xl border border-secondary/30 bg-surface/70 p-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-muted" htmlFor={`report-reason-${note.id}`}>
                      Report reason
                    </label>
                    <select
                      id={`report-reason-${note.id}`}
                      value={reportReason}
                      onChange={(event) => setReportReason(event.target.value)}
                      className="w-full min-h-touch rounded-lg border border-secondary/30 bg-surface-muted/70 px-3 py-2 text-xs text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50"
                    >
                      {REPORT_REASONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <label className="text-xs text-muted" htmlFor={`report-details-${note.id}`}>
                      Details (optional)
                    </label>
                    <textarea
                      id={`report-details-${note.id}`}
                      value={reportDetails}
                      onChange={(event) => setReportDetails(event.target.value)}
                      rows={2}
                      maxLength={600}
                      placeholder="Share a little more context"
                      className="w-full rounded-lg border border-secondary/30 bg-surface-muted/70 px-3 py-2 text-xs text-main placeholder:text-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 resize-none"
                    />
                  </div>
                  {reportError && (
                    <p className="mt-2 text-xs text-error" role="alert">
                      {reportError}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleReportCancel}
                      className="min-h-touch rounded-full border border-secondary/40 px-3 py-1.5 text-xs text-muted hover:text-main hover:border-secondary/60 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReportSubmit(note.id)}
                      disabled={reportSubmitting}
                      className="min-h-touch rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/20 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {reportSubmitting ? 'Sending…' : 'Submit report'}
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor={nameInputId} className="sr-only">
              Display name
            </label>
            <input
              id={nameInputId}
              type="text"
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              placeholder="Display name"
              aria-label="Your display name for this note"
              className="w-full min-h-touch rounded-2xl border border-secondary/30 bg-surface-muted/70 px-4 py-2.5 text-sm text-main placeholder:text-muted/60
                focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50"
              maxLength={40}
            />
          </div>
          <div className="flex-1">
            <label htmlFor={positionSelectId} className="sr-only">
              Card position to comment on
            </label>
            <select
              id={positionSelectId}
              value={cardPosition}
              onChange={(event) => handlePositionChange(event.target.value)}
              aria-label="Select which card position to comment on"
              className="w-full min-h-touch rounded-2xl border border-secondary/30 bg-surface-muted/70 px-4 py-2.5 text-sm text-main
                focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50"
            >
              <option value="">Whole spread</option>
              {cards.map((card, index) => (
                <option
                  key={`${card.position || card.name}-${index}`}
                  value={card.position || card.name}
                >
                  {card.position || card.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor={bodyTextareaId} className="sr-only">
            Your reflection
          </label>
          <textarea
            id={bodyTextareaId}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            placeholder="Share what you're seeing..."
            aria-label="Your reflection on this spread"
            maxLength={600}
            className="w-full rounded-2xl border border-secondary/30 bg-surface-muted/70 px-4 py-3 text-sm text-main placeholder:text-muted/60
              focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50 resize-none"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted/70" aria-label={`${body.length} of 600 characters used`}>
            {body.length} / 600
          </span>
          <button
            type="submit"
            disabled={isSubmitting || !body.trim()}
            className="min-h-touch rounded-full border border-secondary/60 px-5 py-2.5 text-sm font-medium text-secondary transition-colors touch-manipulation
              hover:bg-secondary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/70 focus-visible:ring-offset-2
              disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Sending…' : 'Share note'}
          </button>
        </div>

        {/* Status message with live region for screen readers */}
        <div
          id={statusId}
          role="status"
          aria-live="polite"
          className={statusMessage
            ? `text-xs ${statusTone === 'error'
              ? 'text-error'
              : statusTone === 'success'
                ? 'text-success'
                : 'text-secondary/80'
            }`
            : 'sr-only'}
        >
          {statusMessage}
        </div>
      </form>
    </section>
  );
}
