import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, User, Sparkle } from '@phosphor-icons/react';
import { SharedSpreadView } from '../components/share/SharedSpreadView.jsx';
import { CollaborativeNotesPanel } from '../components/share/CollaborativeNotesPanel.jsx';
import { UserMenu } from '../components/UserMenu.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useReducedMotion } from '../hooks/useReducedMotion.js';

function StatCard({ label, value, helper }) {
  return (
    <div className="rounded-2xl border border-secondary/30 bg-surface p-4 text-center">
      <p className="text-xs uppercase tracking-[0.24em] text-primary">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-main">{value}</p>
      {helper && <p className="mt-1 text-xs-plus text-muted">{helper}</p>}
    </div>
  );
}

function MetaChip({ label }) {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/30 px-3 py-2 min-h-[36px] text-xs-plus text-primary">
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
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const headerRef = useRef(null);
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
  const [mobileView, setMobileView] = useState('spread'); // 'spread' | 'notes'
  const notesPanelRef = useRef(null);

  const scrollToNotesForm = useCallback(() => {
    setMobileView('notes');
    window.requestAnimationFrame(() => {
      const panel = notesPanelRef.current;
      if (!panel) return;
      try {
        panel.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
      } catch {
        // no-op: scrollIntoView may fail on some older browsers
      }
      const focusTarget = panel.querySelector('textarea, input');
      if (focusTarget && typeof focusTarget.focus === 'function') {
        focusTarget.focus({ preventScroll: true });
      }
    });
  }, [prefersReducedMotion]);

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
      const nextNotes = payload.notes || [];
      setNotes(nextNotes);
      setLastSyncedAt(Date.now());
      setNoteError('');
      return { count: nextNotes.length };
    } catch (error) {
      const message = error.message || 'Unable to refresh notes';
      setNoteError(message);
      return { error: message };
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

  // Track header height for sticky positioning
  useEffect(() => {
    if (!headerRef.current) return;
    const updateHeaderHeight = () => {
      document.documentElement.style.setProperty(
        '--share-header-height',
        `${headerRef.current.offsetHeight}px`
      );
    };
    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);
    return () => {
      window.removeEventListener('resize', updateHeaderHeight);
      document.documentElement.style.removeProperty('--share-header-height');
    };
  }, []);

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
      <div className="flex min-h-screen items-center justify-center bg-main text-main">
        <div className="text-center">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted">Opening sacred space…</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-main text-main">
        <div className="max-w-md rounded-3xl border border-error/40 bg-surface p-8 text-center shadow-2xl">
          <p className="text-lg font-serif text-error">{errorMessage}</p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center justify-center rounded-full border border-primary/60 px-4 py-2 text-sm text-main hover:bg-primary/10"
          >
            Return to Tableu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-main text-main">
      {/* Top navigation bar with safe-area padding */}
      <header ref={headerRef} className="sticky top-0 z-40 border-b border-secondary/20 bg-main/95 backdrop-blur-sm pt-[max(var(--safe-pad-top),0.75rem)] pl-safe-left pr-safe-right">
        <div className="mx-auto max-w-6xl flex items-center justify-between py-3 px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 text-accent hover:text-accent/80 transition min-h-touch min-w-touch px-2 -ml-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              aria-label="Back to Reading"
            >
              <ArrowLeft className="h-5 w-5" weight="bold" />
              <span className="hidden sm:inline text-sm font-medium">Back to Reading</span>
            </button>
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-accent" weight="duotone" />
              <span className="font-serif text-lg text-accent">Tableu</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <UserMenu condensed />
            ) : (
              <Link
                to="/account"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-secondary/40 bg-surface/60 px-3 py-2 text-xs font-medium text-main hover:bg-surface hover:border-secondary/60 transition min-h-touch focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Account</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-3xl border border-secondary/40 bg-surface p-6 shadow-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-primary">Shared reading</p>
              <h1 className="mt-1 text-3xl font-serif text-accent">
                {shareData?.title || (shareData?.scope === 'journal' ? 'Journal snapshot' : 'Reading transmission')}
              </h1>
              <p className="text-sm text-muted">
                Invite trusted friends to add their gentle insights. This page updates as new notes arrive.
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row">
              <button
                type="button"
                onClick={copyShareLink}
                className="inline-flex items-center justify-center rounded-full border border-primary/50 px-4 py-2 min-h-touch text-sm text-main hover:bg-primary/10 active:bg-primary/20 touch-manipulation transition"
              >
                Copy link
              </button>
              <button
                type="button"
                onClick={fetchShare}
                className="inline-flex items-center justify-center rounded-full border border-primary/50 px-4 py-2 min-h-touch text-sm text-main hover:bg-primary/10 active:bg-primary/20 touch-manipulation transition"
              >
                Refresh reading
              </button>
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-full border border-primary/50 px-4 py-2 min-h-touch text-sm text-main hover:bg-primary/10 active:bg-primary/20 touch-manipulation transition"
              >
                Start your reading
              </Link>
            </div>
          </div>
          {copyState && <p className="mt-2 text-xs-plus text-primary">{copyState}</p>}

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
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
                  className={`inline-flex items-center justify-center rounded-full border px-4 py-2 min-h-touch text-xs uppercase tracking-[0.15em] touch-manipulation transition ${index === selectedEntryIndex
                    ? 'border-primary bg-primary/10 text-main'
                    : 'border-secondary text-muted hover:border-primary/50 active:bg-primary/5'
                    }`}
                >
                  {entry.spread || 'Reading'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Mobile view toggle - only visible below lg breakpoint */}
        <div
          className="mt-6 lg:hidden sticky z-20 top-[calc(var(--share-header-height,5rem)+var(--safe-pad-top))]"
          role="tablist"
          aria-label="View selection"
        >
          <div className="flex rounded-xl bg-surface-muted/80 backdrop-blur p-1 border border-secondary/20 shadow-sm shadow-secondary/20">
            <button
              type="button"
              role="tab"
              id="mobile-spread-tab"
              aria-selected={mobileView === 'spread'}
              aria-controls="mobile-spread-panel"
              tabIndex={mobileView === 'spread' ? 0 : -1}
              onClick={() => setMobileView('spread')}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault();
                  setMobileView(mobileView === 'spread' ? 'notes' : 'spread');
                  document.getElementById(mobileView === 'spread' ? 'mobile-notes-tab' : 'mobile-spread-tab')?.focus();
                }
              }}
              className={`flex-1 rounded-lg px-4 py-3 min-h-touch text-sm font-semibold transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
                mobileView === 'spread'
                  ? 'bg-surface shadow-sm border border-secondary/30 text-accent'
                  : 'text-muted hover:text-main'
              }`}
            >
              Spread
            </button>
            <button
              type="button"
              role="tab"
              id="mobile-notes-tab"
              aria-selected={mobileView === 'notes'}
              aria-controls="mobile-notes-panel"
              tabIndex={mobileView === 'notes' ? 0 : -1}
              onClick={() => setMobileView('notes')}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault();
                  setMobileView(mobileView === 'spread' ? 'notes' : 'spread');
                  document.getElementById(mobileView === 'spread' ? 'mobile-notes-tab' : 'mobile-spread-tab')?.focus();
                }
              }}
              className={`flex-1 rounded-lg px-4 py-3 min-h-touch text-sm font-semibold transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
                mobileView === 'notes'
                  ? 'bg-surface shadow-sm border border-secondary/30 text-accent'
                  : 'text-muted hover:text-main'
              }`}
            >
              Notes {notes.length > 0 && <span className="ml-1 text-xs text-primary">({notes.length})</span>}
            </button>
          </div>
        </div>

        {/* Mobile: tabbed panels */}
        <div className="mt-4 lg:hidden">
          <div
            id="mobile-spread-panel"
            role="tabpanel"
            aria-labelledby="mobile-spread-tab"
            hidden={mobileView !== 'spread'}
          >
            {mobileView === 'spread' && (
              <div className="rounded-3xl border border-secondary/30 bg-surface-muted p-5">
                <div className="flex flex-col gap-1">
                  <p className="text-xs uppercase tracking-[0.24em] text-primary">Spread overview</p>
                  <h2 className="text-2xl font-serif text-accent">{activeEntry?.spread}</h2>
                  {activeEntry?.question && (
                    <p className="text-sm text-muted">Intention: {activeEntry.question}</p>
                  )}
                  <p className="text-xs-plus text-muted">
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
            )}
          </div>
          <div
            id="mobile-notes-panel"
            role="tabpanel"
            aria-labelledby="mobile-notes-tab"
            hidden={mobileView !== 'notes'}
            ref={notesPanelRef}
          >
            {mobileView === 'notes' && (
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
            )}
          </div>
        </div>

        {/* Mobile: bottom CTA to jump to note form - only for authenticated users without bottom bar */}
        {mobileView === 'notes' && isAuthenticated && (
          <div
            className="lg:hidden fixed right-4 z-30 bottom-[calc(var(--safe-pad-bottom)+1rem)]"
          >
            <button
              type="button"
              onClick={scrollToNotesForm}
              className="inline-flex items-center gap-2 rounded-full bg-primary text-surface px-4 py-2.5 shadow-lg shadow-primary/30 border border-primary/70 text-sm font-semibold touch-manipulation min-h-touch focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              aria-label="Jump to note form"
            >
              Add note
            </button>
          </div>
        )}

        {/* Desktop: side-by-side grid layout */}
        <div className="mt-8 hidden lg:grid lg:grid-cols-[2fr,1fr] gap-6">
          <div className="space-y-6">
            <div className="rounded-3xl border border-secondary/30 bg-surface-muted p-5">
              <div className="flex flex-col gap-1">
                <p className="text-xs uppercase tracking-[0.24em] text-primary">Spread overview</p>
                <h2 className="text-2xl font-serif text-accent">{activeEntry?.spread}</h2>
                {activeEntry?.question && (
                  <p className="text-sm text-muted">Intention: {activeEntry.question}</p>
                )}
                <p className="text-xs-plus text-muted">
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

      {/* Bottom sticky "Open in app" bar for guests */}
      {!isAuthenticated && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 border-t border-accent/30 bg-surface/95 backdrop-blur-sm shadow-[0_-8px_30px_rgba(0,0,0,0.4)] pb-safe-action pl-safe-left pr-safe-right"
        >
          <div className="mx-auto max-w-6xl px-4 py-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="text-center sm:text-left">
                <p className="text-sm font-semibold text-main">Get your own insights</p>
                <p className="text-xs text-muted">Create readings and track your tarot journey</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Link
                  to="/"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-surface shadow-md hover:bg-accent/90 transition min-h-touch focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <Sparkle className="h-4 w-4" weight="fill" />
                  Start Reading
                </Link>
                <Link
                  to="/account"
                  className="inline-flex items-center justify-center rounded-full border border-secondary/60 bg-transparent px-4 py-2.5 text-sm font-semibold text-main hover:bg-secondary/10 transition min-h-touch focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
