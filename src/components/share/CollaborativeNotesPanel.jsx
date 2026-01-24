import { useMemo, useState, useEffect, useId, useCallback, useRef } from 'react';

const ALIAS_STORAGE_KEY = 'mystic-share-alias';

/**
 * Format timestamp with relative time for recent timestamps
 */
function formatTimestamp(ts) {
  if (!ts) return 'never';

  const date = new Date(ts);
  if (isNaN(date.getTime())) return 'recently';

  const now = Date.now();
  const diff = now - date.getTime();

  // Relative time for recent
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

  // Absolute for older
  return date.toLocaleDateString(undefined, {
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

export function CollaborativeNotesPanel({
  notes = [],
  cards = [],
  onSubmit,
  isSubmitting,
  onRefresh,
  error,
  selectedPosition,
  onSelectedPositionChange,
  lastSyncedAt
}) {
  const [authorName, setAuthorName] = useLocalStorage(ALIAS_STORAGE_KEY, '');
  const [cardPosition, setCardPosition] = useState(selectedPosition || '');
  const [body, setBody] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const sortedNotes = useMemo(() => {
    return [...notes].sort((a, b) => a.createdAt - b.createdAt);
  }, [notes]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const text = body.trim();
    if (!text) {
      setStatusMessage('Add a note before sending.');
      return;
    }
    try {
      await onSubmit?.({
        authorName: authorName.trim(),
        body: text,
        cardPosition: cardPosition || null
      });
      setBody('');
      setStatusMessage('Shared!');
      setTimeout(() => setStatusMessage(''), 2500);
    } catch (submitError) {
      setStatusMessage(submitError?.message || 'Unable to add note.');
    }
  };

  const handlePositionChange = (value) => {
    setCardPosition(value);
    onSelectedPositionChange?.(value);
  };

  const handleRefresh = async () => {
    if (isRefreshing || !onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

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
        Last synced: <time dateTime={lastSyncedAt ? new Date(lastSyncedAt).toISOString() : undefined}>
          {formatTimestamp(lastSyncedAt)}
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
      >
        {sortedNotes.length === 0 && (
          <p className="text-sm text-muted py-4 text-center">
            No reflections yet. Be the first to leave a note.
          </p>
        )}
        {sortedNotes.map((note) => (
          <article
            key={note.id}
            className="rounded-2xl border border-accent/20 bg-surface-muted/70 p-3"
          >
            <div className="flex items-center justify-between gap-2 text-xs text-secondary/90">
              <span className="font-semibold truncate">{note.authorName || 'Anonymous'}</span>
              <time
                dateTime={new Date(note.createdAt).toISOString()}
                className="text-secondary/70 shrink-0"
              >
                {formatTimestamp(note.createdAt)}
              </time>
            </div>
            {note.cardPosition && (
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-accent/70">
                {note.cardPosition}
              </p>
            )}
            <p className="mt-2 text-sm text-main/90 whitespace-pre-wrap break-words">
              {note.body}
            </p>
          </article>
        ))}
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
          className={statusMessage ? 'text-xs text-secondary/80' : 'sr-only'}
        >
          {statusMessage}
        </div>
      </form>
    </section>
  );
}
