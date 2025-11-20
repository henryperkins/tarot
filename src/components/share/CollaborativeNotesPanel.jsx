import React, { useEffect, useMemo, useState } from 'react';

const ALIAS_STORAGE_KEY = 'mystic-share-alias';

function formatTimestamp(ts) {
  if (!ts) return 'never';
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return 'recently';
  }
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
  const [authorName, setAuthorName] = useState('');
  const [cardPosition, setCardPosition] = useState(selectedPosition || '');
  const [body, setBody] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    const stored = localStorage.getItem(ALIAS_STORAGE_KEY);
    if (stored) {
      setAuthorName(stored);
    }
  }, []);

  useEffect(() => {
    setCardPosition(selectedPosition || '');
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
      if (typeof localStorage !== 'undefined' && authorName.trim()) {
        localStorage.setItem(ALIAS_STORAGE_KEY, authorName.trim());
      }
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

  return (
    <section className="rounded-3xl border border-secondary/30 bg-surface/85 p-6 shadow-xl">
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-secondary/80">Collaborative reflections</p>
          <h3 className="text-xl font-serif text-main">Add your voice to this spread</h3>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-full border border-secondary/40 px-3 py-1 text-xs text-secondary hover:bg-secondary/10"
          >
            Refresh
          </button>
        )}
      </header>
      <p className="mt-1 text-xs text-secondary/70">Last synced: {formatTimestamp(lastSyncedAt)}</p>

      {error && <p className="mt-3 text-sm text-error">{error}</p>}

      <div className="mt-4 max-h-60 space-y-3 overflow-y-auto pr-2">
        {sortedNotes.length === 0 && (
          <p className="text-sm text-muted">No reflections yet. Be the first to leave a note.</p>
        )}
        {sortedNotes.map((note) => (
          <article key={note.id} className="rounded-2xl border border-accent/20 bg-surface-muted/70 p-3">
            <div className="flex items-center justify-between text-xs text-secondary/90">
              <span className="font-semibold">{note.authorName}</span>
              <time>{new Date(note.createdAt).toLocaleString()}</time>
            </div>
            {note.cardPosition && (
              <p className="mt-1 text-[0.65rem] uppercase tracking-[0.18em] text-accent/70">{note.cardPosition}</p>
            )}
            <p className="mt-2 text-sm text-main/90 whitespace-pre-wrap">{note.body}</p>
          </article>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            placeholder="Display name"
            className="flex-1 rounded-2xl border border-secondary/30 bg-surface-muted/70 px-3 py-2 text-sm text-main focus:outline-none focus:ring-2 focus:ring-secondary/50"
            maxLength={40}
          />
          <select
            value={cardPosition}
            onChange={(event) => handlePositionChange(event.target.value)}
            className="flex-1 rounded-2xl border border-secondary/30 bg-surface-muted/70 px-3 py-2 text-sm text-main focus:outline-none focus:ring-2 focus:ring-secondary/50"
          >
            <option value="">Whole spread</option>
            {cards.map((card, index) => (
              <option key={`${card.position || card.name}-${index}`} value={card.position || card.name}>
                {card.position || card.name}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          placeholder="Share what you're seeing..."
          maxLength={600}
          className="w-full rounded-2xl border border-secondary/30 bg-surface-muted/70 px-3 py-2 text-sm text-main focus:outline-none focus:ring-2 focus:ring-secondary/50"
        />
        <div className="flex items-center justify-between text-sm">
          <span className="text-accent/70">{body.length} / 600</span>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full border border-secondary/60 px-4 py-1.5 text-sm text-secondary transition hover:bg-secondary/10 disabled:opacity-60"
          >
            {isSubmitting ? 'Sending…' : 'Share note'}
          </button>
        </div>
        {statusMessage && <p className="text-xs text-secondary/80">{statusMessage}</p>}
      </form>
    </section>
  );
}