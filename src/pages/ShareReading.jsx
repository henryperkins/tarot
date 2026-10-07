import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, User, Sparkle } from '@phosphor-icons/react';
import { SharedSpreadView } from '../components/share/SharedSpreadView.jsx';
import { CollaborativeNotesPanel } from '../components/share/CollaborativeNotesPanel.jsx';
import { UserMenu } from '../components/UserMenu.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import { FOCUS_RING_DEFAULT } from '../styles/focusClasses.js';

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
    <span className="inline-flex min-h-touch items-center rounded-full border border-primary/30 px-3 py-2 text-xs-plus text-primary">
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

async function loadSharedReading(token, signal) {
  const response = await fetch(`/api/share/${token}`, { signal });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Unable to load share link');
  }
  return response.json();
}

export default function ShareReading() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const pageRef = useRef(null);
  const headerRef = useRef(null);
  const mobileTabsRef = useRef(null);
  const guestFooterRef = useRef(null);
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
  const shareRequestRef = useRef(null);

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

  const fetchShare = useCallback(() => {
    if (!token) return;
    shareRequestRef.current?.abort();
    const controller = new AbortController();
    shareRequestRef.current = controller;
    return loadSharedReading(token, controller.signal).then((payload) => {
      if (controller.signal.aborted) return;
      setShareData(payload);
      setNotes(payload.notes || []);
      setSelectedEntryIndex(0);
      setActivePosition(deriveDefaultPosition(payload.entries?.[0]));
      setLastSyncedAt(Date.now());
      setStatus('ready');
    }).catch((error) => {
      if (controller.signal.aborted) return;
      setErrorMessage(error.message || 'Unable to load share link');
      setStatus('error');
    }).finally(() => {
      if (shareRequestRef.current === controller) shareRequestRef.current = null;
    });
  }, [token]);

  useEffect(() => {
    fetchShare();
    return () => shareRequestRef.current?.abort();
  }, [fetchShare]);

  const handleRefreshShare = () => {
    setStatus('loading');
    setErrorMessage('');
    fetchShare();
  };

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

  const handleSelectEntry = (index) => {
    if (index === selectedEntryIndex) return;
    setSelectedEntryIndex(index);
    setActivePosition(deriveDefaultPosition(shareData?.entries?.[index]));
  };

  // Reserve the actual pinned chrome, including changes from enlarged text.
  // Oversized chrome flows with the page so it cannot consume the viewport.
  useEffect(() => {
    if (status !== 'ready') return undefined;
    const page = pageRef.current;
    const header = headerRef.current;
    const tabs = mobileTabsRef.current;
    const footer = guestFooterRef.current;
    if (!page || !header) return undefined;
    const root = document.documentElement;
    const previousScrollPadding = ['scroll-padding-top', 'scroll-padding-bottom'].map(property => ({
      property,
      value: root.style.getPropertyValue(property),
      priority: root.style.getPropertyPriority(property)
    }));
    const measure = () => {
      const maxPinnedHeight = window.innerHeight * 0.4;
      const headerHeight = header.getBoundingClientRect().height;
      const pinHeader = headerHeight <= maxPinnedHeight;
      const tabsHeight = tabs?.getBoundingClientRect().height || 0;
      const pinTabs = pinHeader && headerHeight + tabsHeight <= maxPinnedHeight;
      const footerHeight = footer?.getBoundingClientRect().height || 0;
      const pinFooter = footerHeight > 0 && footerHeight <= maxPinnedHeight;
      const reservedFooterHeight = pinFooter ? footerHeight : 0;
      const gap = parseFloat(getComputedStyle(root).fontSize) || 16;

      header.style.position = pinHeader ? 'sticky' : 'relative';
      if (tabs) tabs.style.position = pinTabs ? 'sticky' : 'relative';
      if (footer) footer.style.position = pinFooter ? 'fixed' : 'relative';
      page.style.setProperty('--share-header-height', `${pinHeader ? headerHeight : 0}px`);
      page.style.setProperty('--share-footer-height', `${reservedFooterHeight}px`);
      root.style.scrollPaddingTop = `${(pinHeader ? headerHeight : 0) + (pinTabs ? tabsHeight : 0) + gap}px`;
      root.style.scrollPaddingBottom = `${reservedFooterHeight + gap}px`;
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    // Safe-area padding can change the border box without changing content size.
    [header, tabs, footer].filter(Boolean).forEach(element => observer?.observe(element, { box: 'border-box' }));
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      [header, tabs, footer].filter(Boolean).forEach(element => element.style.removeProperty('position'));
      page.style.removeProperty('--share-header-height');
      page.style.removeProperty('--share-footer-height');
      previousScrollPadding.forEach(({ property, value, priority }) => {
        if (value) root.style.setProperty(property, value, priority);
        else root.style.removeProperty(property);
      });
    };
  }, [status, isAuthenticated]);

  const stats = shareData?.stats;

  const copyShareLink = async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState('Link copied');
    } catch {
      setCopyState('Couldn’t copy the link. Copy this page’s address from your browser.');
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

  const handleReportNote = useCallback(async ({ noteId, reason, details }) => {
    if (!token) {
      throw new Error('Missing share token');
    }
    const response = await fetch(`/api/share-notes/${token}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        noteId,
        reason,
        details
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Unable to submit report');
    }
    return payload;
  }, [token]);

  const contexts = shareData?.meta?.contexts || [];
  const collaboration = shareData?.collaboration;

  if (status === 'loading' || status === 'error') {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-screen items-center justify-center bg-main p-4 text-main pt-[max(1rem,var(--safe-pad-top))] pr-[max(1rem,var(--safe-pad-right))] pb-[max(1rem,var(--safe-pad-bottom))] pl-[max(1rem,var(--safe-pad-left))]"
      >
        {status === 'loading' ? (
          <div className="text-center">
            <h1 className="sr-only">Shared reading</h1>
            <div role="status">
              <div aria-hidden="true" className="inline-block h-10 w-10 rounded-full border-2 border-primary border-t-transparent motion-safe:animate-spin" />
              <p className="mt-4 text-sm text-muted">Opening sacred space…</p>
            </div>
          </div>
        ) : (
          <div role="alert" className="min-w-0 max-w-md rounded-3xl border border-error/40 bg-surface p-6 text-center shadow-2xl sm:p-8">
            <h1 dir="auto" className="break-words text-lg font-serif text-error">{errorMessage}</h1>
            <Link
              to="/"
              className={`mt-5 inline-flex min-h-touch items-center justify-center rounded-full border border-primary/60 px-4 py-2 text-sm text-main hover:bg-primary/10 ${FOCUS_RING_DEFAULT}`}
            >
              Return to Tableu
            </Link>
          </div>
        )}
      </main>
    );
  }

  return (
    <div ref={pageRef} className="min-h-screen bg-main text-main">
      {/* Top navigation bar with safe-area padding */}
      <header ref={headerRef} className="sticky top-0 z-sticky-elevated border-b border-secondary/20 bg-main/95 backdrop-blur-sm pt-[max(var(--safe-pad-top),0.75rem)] pl-safe pr-safe">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 text-accent hover:text-accent/80 transition min-h-touch min-w-touch px-2 -ml-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              aria-label="Back to Reading"
            >
              <ArrowLeft className="h-5 w-5" weight="bold" />
              <span className="hidden sm:inline text-sm font-medium">Back to Reading</span>
            </button>
            <div className="flex min-w-0 max-w-full items-center gap-2">
              <Eye className="h-5 w-5 shrink-0 text-accent" weight="duotone" />
              <span className="min-w-0 break-words font-serif text-lg text-accent">Tableu</span>
            </div>
          </div>
          <div className="flex min-w-0 max-w-full items-center gap-2">
            {isAuthenticated ? (
              <UserMenu condensed />
            ) : (
              <Link
                to="/account"
                aria-label="Account"
                className="inline-flex min-w-touch items-center justify-center gap-1.5 rounded-full border border-secondary/40 bg-surface/60 px-3 py-2 text-xs font-medium text-main hover:bg-surface hover:border-secondary/60 transition min-h-touch focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <User className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Account</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 pt-8 pb-[calc(2rem+var(--share-footer-height,0px))] [overflow-wrap:anywhere]">
        <div className="min-w-0 rounded-3xl border border-secondary/40 bg-surface p-[min(1.5rem,6vw)] shadow-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-[0.24em] text-primary">Shared reading</p>
              <h1 className="mt-1 text-3xl font-serif text-accent">
                {shareData?.title || (shareData?.scope === 'journal' ? 'Journal snapshot' : 'Reading transmission')}
              </h1>
              <p className="text-sm text-muted">
                Invite trusted friends to add their gentle insights. This page updates as new notes arrive.
              </p>
            </div>
            <div className="flex min-w-0 max-w-full flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={copyShareLink}
                className="inline-flex items-center justify-center rounded-full border border-primary/50 px-4 py-2 min-h-touch text-sm text-main hover:bg-primary/10 active:bg-primary/20 touch-manipulation transition"
              >
                Copy link
              </button>
              <button
                type="button"
                onClick={handleRefreshShare}
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
            {shareData?.meta?.entryCount && <MetaChip label={`${shareData.meta.entryCount} ${shareData.meta.entryCount === 1 ? 'entry' : 'entries'}`} />}
            {shareData?.expiresAt && (
              <MetaChip label={`Expires ${new Date(shareData.expiresAt).toLocaleString()}`} />
            )}
            {collaboration?.noteCount ? <MetaChip label={`${collaboration.noteCount} shared ${collaboration.noteCount === 1 ? 'note' : 'notes'}`} /> : null}
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
                  onClick={() => handleSelectEntry(index)}
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
          ref={mobileTabsRef}
          className="mt-6 lg:hidden sticky z-20 top-[var(--share-header-height,5rem)]"
          role="tablist"
          aria-label="View selection"
        >
          <div className="grid min-w-0 grid-cols-2 rounded-xl bg-surface-muted/80 backdrop-blur p-1 border border-secondary/20 shadow-sm shadow-secondary/20">
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
              className={`min-w-0 rounded-lg px-[min(0.75rem,3vw)] py-3 min-h-touch text-sm font-semibold transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
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
              className={`min-w-0 rounded-lg px-[min(0.75rem,3vw)] py-3 min-h-touch text-sm font-semibold transition-all touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
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
                shareToken={token}
                onSubmit={handleAddNote}
                onReport={handleReportNote}
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
            className="lg:hidden fixed right-4 z-sticky-nav bottom-[calc(var(--safe-pad-bottom)+1rem)]"
          >
            <button
              type="button"
              onClick={scrollToNotesForm}
              className="inline-flex items-center gap-2 rounded-full bg-primary text-surface px-4 py-2.5 shadow-lg shadow-primary/30 border border-primary/70 text-sm font-semibold touch-manipulation min-h-touch focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
              aria-label="Add note: open note form"
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
            shareToken={token}
            onSubmit={handleAddNote}
            onReport={handleReportNote}
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
          ref={guestFooterRef}
          className="fixed bottom-0 left-0 right-0 z-sticky-nav w-full border-t border-accent/30 bg-surface/95 backdrop-blur-sm shadow-[0_-8px_30px_rgba(0,0,0,0.4)] pb-safe-action pl-safe pr-safe [overflow-wrap:anywhere]"
        >
          <div className="mx-auto max-w-6xl px-4 py-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="min-w-0 text-center sm:text-left">
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
