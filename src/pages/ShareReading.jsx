import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SharedSpreadView } from '../components/share/SharedSpreadView.jsx';
import { CollaborativeNotesPanel } from '../components/share/CollaborativeNotesPanel.jsx';

function StatCard({ label, value, helper }) {
  return (
    <div className="rounded-2xl border border-emerald-400/30 bg-slate-950/70 p-4 text-center">
      <p className="text-[0.65rem] uppercase tracking-[0.3em] text-emerald-300/80">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-amber-50">{value}</p>
      {helper && <p className="mt-1 text-xs text-amber-200/70">{helper}</p>}
    </div>
  );
}

function MetaChip({ label }) {
  return (
    <span className="rounded-full border border-emerald-400/30 px-3 py-1 text-xs text-emerald-200">
      {label}
    </span>
  );
}

function deriveDefaultPosition(entry) {
  if (!entry || !Array.isArray(entry.cards) || entry.cards.length === 0) {
    return '';
  }
  return entry.cards[0].position || `Card 1`;
}

export default function ShareReading() {
  const { token } = useParams();
  const [shareData, setShareData] = useState(null);
  const [notes, setNotes] = useState([]);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedEntryIndex, setSelectedEntryIndex] = useState(0);
  const [activePosition, setActivePosition] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [copyState, setCopyState] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const fetchShare = useCallback(async () => {
    if (!token) return;
    setStatus('loading');
    setErrorMessage('');
    try {
      const response = await fetch(`/api/share/${token}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to load share link');
      }
      const payload = await response.json();
      setShareData(payload);
      setNotes(payload.notes || []);
      setSelectedEntryIndex(0);
      setLastSyncedAt(Date.now());
      setStatus('ready');
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load share link');
      setStatus('error');
    }
  }, [token]);

  useEffect(() => {
    fetchShare();
  }, [fetchShare]);

  const refreshNotes = useCallback(async () => {
    try {
      const response = await fetch(`/api/share-notes/${token}`);
      if (!response.ok) {
        throw new Error('Unable to refresh notes');
      }
      const payload = await response.json();
      setNotes(payload.notes || []);
      setLastSyncedAt(Date.now());
      setNoteError('');
    } catch (error) {
      setNoteError(error.message || 'Unable to refresh notes');
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      refreshNotes();
    }, 20000);
    return () => clearInterval(interval);
  }, [token, refreshNotes]);

  const activeEntry = useMemo(() => {
    if (!shareData?.entries || shareData.entries.length === 0) return null;
    const index = Math.min(selectedEntryIndex, shareData.entries.length - 1);
    return shareData.entries[index];
  }, [shareData, selectedEntryIndex]);

  useEffect(() => {
    const defaultPosition = deriveDefaultPosition(activeEntry);
    setActivePosition(defaultPosition);
  }, [activeEntry]);

  const stats = shareData?.stats;

  const copyShareLink = async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState('Link copied');
    } catch {
      setCopyState('Clipboard unavailable');
    }
    setTimeout(() => setCopyState(''), 2500);
  };

  const handleAddNote = async ({ authorName, body, cardPosition }) => {
    setNoteSubmitting(true);
    setNoteError('');
    try {
      const response = await fetch(`/api/share-notes/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorName, body, cardPosition })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to save note');
      }
      const payload = await response.json();
      setNotes((previous) => [...previous, payload.note]);
      setLastSyncedAt(Date.now());
    } catch (error) {
      setNoteError(error.message || 'Unable to save note');
      throw error;
    } finally {
      setNoteSubmitting(false);
    }
  };

  const contexts = shareData?.meta?.contexts || [];
  const collaboration = shareData?.collaboration;

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-amber-50">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-amber-200 border-t-transparent" />
          <p className="mt-4 text-sm text-amber-200/80">Opening sacred space…</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-amber-50">
        <div className="max-w-md rounded-3xl border border-rose-400/40 bg-slate-950/80 p-8 text-center shadow-2xl">
          <p className="text-lg font-serif text-rose-200">{errorMessage}</p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center justify-center rounded-full border border-amber-400/60 px-4 py-2 text-sm text-amber-100 hover:bg-amber-500/10"
          >
            Return to Tableu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-amber-50">
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-3xl border border-emerald-400/40 bg-slate-950/80 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[0.65rem] uppercase tracking-[0.3em] text-emerald-300/80">Shared reading</p>
              <h1 className="mt-1 text-3xl font-serif text-amber-100">
                {shareData?.title || (shareData?.scope === 'journal' ? 'Journal snapshot' : 'Reading transmission')}
              </h1>
              <p className="text-sm text-amber-100/70">
                Invite trusted friends to add their gentle insights. This page updates as new notes arrive.
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row">
              <button
                type="button"
                onClick={copyShareLink}
                className="rounded-full border border-amber-400/50 px-4 py-2 text-sm text-amber-100 hover:bg-amber-500/10"
              >
                Copy link
              </button>
              <button
                type="button"
                onClick={fetchShare}
                className="rounded-full border border-emerald-400/50 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/10"
              >
                Refresh reading
              </button>
              <Link
                to="/"
                className="rounded-full border border-emerald-400/50 px-4 py-2 text-sm text-emerald-100 text-center hover:bg-emerald-500/10"
              >
                Start your reading
              </Link>
            </div>
          </div>
          {copyState && <p className="mt-2 text-xs text-emerald-200/80">{copyState}</p>}

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-emerald-200/70">
            <MetaChip label={`Views ${shareData?.viewCount ?? 0}`} />
            {shareData?.meta?.entryCount && <MetaChip label={`${shareData.meta.entryCount} entries`} />}
            {shareData?.expiresAt && (
              <MetaChip label={`Expires ${new Date(shareData.expiresAt).toLocaleString()}`} />
            )}
            {collaboration?.noteCount ? <MetaChip label={`${collaboration.noteCount} shared notes`} /> : null}
            {contexts?.slice(0, 3).map((context) => (
              <MetaChip key={context.name} label={`${context.name} · ${context.count}`} />
            ))}
          </div>

          {stats && (
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <StatCard label="Entries" value={stats.totalReadings} helper="Included in this share" />
              <StatCard label="Cards logged" value={stats.totalCards} helper={`${stats.reversalRate}% reversed`} />
              <StatCard
                label="Top context"
                value={stats.contextBreakdown?.[0]?.name || '—'}
                helper={stats.contextBreakdown?.[0] ? `${stats.contextBreakdown[0].count} pulls` : 'Mix of topics'}
              />
            </div>
          )}

          {shareData?.entries?.length > 1 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {shareData.entries.map((entry, index) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedEntryIndex(index)}
                  className={`rounded-full border px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em] ${index === selectedEntryIndex
                    ? 'border-emerald-400 bg-emerald-500/10 text-emerald-100'
                    : 'border-slate-700/70 text-amber-100/70 hover:border-emerald-300/50'
                    }`}
                >
                  {entry.spread || 'Reading'}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-emerald-400/30 bg-slate-950/60 p-5">
              <div className="flex flex-col gap-1">
                <p className="text-[0.65rem] uppercase tracking-[0.3em] text-emerald-300/80">Spread overview</p>
                <h2 className="text-2xl font-serif text-amber-100">{activeEntry?.spread}</h2>
                {activeEntry?.question && (
                  <p className="text-sm text-amber-100/70">Intention: {activeEntry.question}</p>
                )}
                <p className="text-xs text-amber-200/70">
                  {activeEntry?.ts ? new Date(activeEntry.ts).toLocaleString() : ''}
                </p>
              </div>
              <SharedSpreadView
                entry={activeEntry}
                notes={notes}
                selectedPosition={activePosition}
                onSelectPosition={setActivePosition}
              />
            </div>
          </div>
          <CollaborativeNotesPanel
            notes={notes}
            cards={activeEntry?.cards || []}
            onSubmit={handleAddNote}
            onRefresh={refreshNotes}
            isSubmitting={noteSubmitting}
            error={noteError}
            selectedPosition={activePosition}
            onSelectedPositionChange={setActivePosition}
            lastSyncedAt={lastSyncedAt}
          />
        </div>
      </main>
    </div>
  );
}
