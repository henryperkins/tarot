import { useDeferredValue, useCallback, useEffect, useMemo, useState } from 'react';
import { CaretLeft, UploadSimple, Notebook, ChartLine, Sparkle, BookOpen } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { GlobalNav } from './GlobalNav';
import { UserMenu } from './UserMenu';
import { ConfirmModal } from './ConfirmModal';
import { useAuth } from '../contexts/AuthContext';
import { useJournal } from '../hooks/useJournal';
import { JournalFilters } from './JournalFilters.jsx';
import { JournalInsightsPanel } from './JournalInsightsPanel.jsx';
import { JournalEntryCard } from './JournalEntryCard.jsx';
import { SavedIntentionsList } from './SavedIntentionsList.jsx';
import { computeJournalStats } from '../lib/journalInsights';
import { SPREADS } from '../data/spreads';
import { DECK_OPTIONS } from './DeckSelector';

const CONTEXT_FILTERS = [
  { value: 'love', label: 'Love' },
  { value: 'career', label: 'Career' },
  { value: 'self', label: 'Self' },
  { value: 'spiritual', label: 'Spiritual' },
  { value: 'wellbeing', label: 'Wellbeing' },
  { value: 'decision', label: 'Decision' }
];

const SPREAD_FILTERS = Object.entries(SPREADS || {}).map(([value, config]) => ({
  value,
  label: config?.name || value
}));

const DECK_FILTERS = DECK_OPTIONS.map(d => ({ value: d.id, label: d.label }));

const VISIBLE_ENTRY_BATCH = 10;

export default function Journal() {
  const { isAuthenticated } = useAuth();
  const { entries, loading, deleteEntry, migrateToCloud, error: journalError } = useJournal();
  const [migrating, setMigrating] = useState(false);
  const [migrateMessage, setMigrateMessage] = useState('');
  const [deleteMessage, setDeleteMessage] = useState('');
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ isOpen: false, entryId: null });
  const [filters, setFilters] = useState({ query: '', contexts: [], spreads: [], decks: [], timeframe: 'all', onlyReversals: false });
  const deferredQuery = useDeferredValue(filters.query);
  const filterSignature = useMemo(
    () =>
      JSON.stringify({
        query: filters.query.trim().toLowerCase(),
        contexts: [...filters.contexts].sort(),
        spreads: [...filters.spreads].sort(),
        decks: [...filters.decks].sort(),
        timeframe: filters.timeframe,
        onlyReversals: filters.onlyReversals
      }),
    [filters]
  );
  const [shareLinks, setShareLinks] = useState([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState('');
  const navigate = useNavigate();

  const handleStartReading = () => {
    navigate('/', { state: { focusSpread: true } });
  };

  const filteredEntries = useMemo(() => {
    if (!entries || entries.length === 0) {
      return [];
    }
    const query = deferredQuery.trim().toLowerCase();
    const contextSet = new Set(filters.contexts);
    const spreadSet = new Set(filters.spreads);
    const deckSet = new Set(filters.decks);
    const timeframeCutoff = (() => {
      const now = Date.now();
      switch (filters.timeframe) {
        case '30d':
          return now - 30 * 24 * 60 * 60 * 1000;
        case '90d':
          return now - 90 * 24 * 60 * 60 * 1000;
        case 'ytd': {
          const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
          return yearStart;
        }
        default:
          return null;
      }
    })();

    return entries.filter((entry) => {
      if (contextSet.size > 0 && !contextSet.has(entry?.context)) {
        return false;
      }
      if (spreadSet.size > 0 && !spreadSet.has(entry?.spreadKey)) {
        return false;
      }
      if (deckSet.size > 0 && !deckSet.has(entry?.deckId)) {
        return false;
      }
      const entryTs = entry?.ts || (entry?.created_at ? entry.created_at * 1000 : null);
      if (timeframeCutoff && entryTs && entryTs < timeframeCutoff) {
        return false;
      }
      if (filters.onlyReversals) {
        const hasReversal = (entry?.cards || []).some((card) => (card?.orientation || '').toLowerCase().includes('reversed'));
        if (!hasReversal) {
          return false;
        }
      }
      if (query) {
        const reflections = entry?.reflections ? Object.values(entry.reflections).join(' ') : '';
        const cards = (entry?.cards || [])
          .map((card) => `${card.position || ''} ${card.name} ${card.orientation || ''}`)
          .join(' ');
        const haystack = [
          entry?.question,
          entry?.spread,
          entry?.context,
          entry?.personalReading,
          reflections,
          cards
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [entries, deferredQuery, filters.contexts, filters.spreads, filters.decks, filters.timeframe, filters.onlyReversals]);

  const [visibleCount, setVisibleCount] = useState(VISIBLE_ENTRY_BATCH);

  useEffect(() => {
    setVisibleCount(VISIBLE_ENTRY_BATCH);
  }, [filterSignature, filteredEntries.length]);

  const visibleEntries = useMemo(() => filteredEntries.slice(0, visibleCount), [filteredEntries, visibleCount]);
  const hasMoreEntries = filteredEntries.length > visibleCount;

  // Compute stats for both full journal and filtered view
  const allStats = useMemo(() => computeJournalStats(entries), [entries]);
  const filteredStats = useMemo(() => computeJournalStats(filteredEntries), [filteredEntries]);
  const filtersActive = Boolean(filters.query.trim()) || filters.contexts.length > 0 || filters.spreads.length > 0 || filters.decks.length > 0 || filters.timeframe !== 'all' || filters.onlyReversals;

  const fetchShareLinks = useCallback(async () => {
    if (!isAuthenticated) return;
    setShareLoading(true);
    setShareError('');
    try {
      const response = await fetch('/api/share', { credentials: 'include' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to load share links');
      }
      const payload = await response.json();
      setShareLinks(payload.shares || []);
    } catch (error) {
      setShareError(error.message || 'Unable to load share links');
    } finally {
      setShareLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchShareLinks();
    } else {
      setShareLinks([]);
      setShareError('');
    }
  }, [isAuthenticated, fetchShareLinks]);

  const createShareLink = useCallback(
    async ({ scope = 'journal', entryId, entryIds, title, limit, expiresInHours } = {}) => {
      if (!isAuthenticated) {
        throw new Error('Sign in to create share links');
      }
      const payload = { scope };
      const parsedLimit = Number.parseInt(limit, 10);
      const sanitizedLimit = Number.isFinite(parsedLimit)
        ? Math.max(1, Math.min(10, parsedLimit))
        : undefined;
      const parsedExpiry = Number.parseInt(expiresInHours, 10);
      const sanitizedExpiry = Number.isFinite(parsedExpiry) && parsedExpiry > 0
        ? Math.floor(parsedExpiry)
        : undefined;
      const normalizedEntryIds = Array.isArray(entryIds)
        ? entryIds
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter(Boolean)
          .slice(0, 10)
        : [];

      if (scope === 'entry') {
        if (entryId) {
          payload.entryIds = [entryId];
        } else if (normalizedEntryIds.length === 1) {
          payload.entryIds = normalizedEntryIds;
        }
      } else if (normalizedEntryIds.length > 0) {
        payload.entryIds = normalizedEntryIds;
      } else if (sanitizedLimit) {
        payload.limit = sanitizedLimit;
      }
      if (title) {
        payload.title = title;
      }
      if (sanitizedExpiry) {
        payload.expiresInHours = sanitizedExpiry;
      }
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Unable to create share link');
      }
      const data = await response.json();
      await fetchShareLinks();
      return data;
    },
    [isAuthenticated, fetchShareLinks]
  );

  const deleteShareLink = useCallback(
    async (shareToken) => {
      if (!isAuthenticated) return;
      const response = await fetch(`/api/share/${shareToken}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to delete share link');
      }
      await fetchShareLinks();
    },
    [isAuthenticated, fetchShareLinks]
  );

  const handleMigrate = async () => {
    setMigrating(true);
    setMigrateMessage('');

    const result = await migrateToCloud();

    if (result.success) {
      const parts = [`Migrated ${result.migrated} entries`];
      if (typeof result.skipped === 'number' && result.skipped > 0) {
        parts.push(`${result.skipped} already existed`);
      }
      setMigrateMessage(`Migration complete! ${parts.join(', ')}.`);
      setTimeout(() => setMigrateMessage(''), 5000);
    } else {
      setMigrateMessage(`Migration failed: ${result.error}`);
    }

    setMigrating(false);
  };

  const handleDeleteRequest = (entryId) => {
    setDeleteConfirmModal({ isOpen: true, entryId });
  };

  const handleDeleteConfirm = async () => {
    const entryId = deleteConfirmModal.entryId;
    if (!entryId) return;

    // Close modal immediately to provide responsive feedback
    setDeleteConfirmModal({ isOpen: false, entryId: null });

    const result = await deleteEntry(entryId);

    if (result.success) {
      setDeleteMessage('Entry deleted');
    } else {
      setDeleteMessage(`Delete failed: ${result.error || 'Unknown error'}`);
    }
    setTimeout(() => setDeleteMessage(''), 4000);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmModal({ isOpen: false, entryId: null });
  };

  const handleLoadMoreEntries = () => {
    setVisibleCount((prev) => Math.min(filteredEntries.length, prev + VISIBLE_ENTRY_BATCH));
  };

  // Check if we have localStorage entries that can be migrated
  const hasLocalStorageEntries = () => {
    if (typeof localStorage === 'undefined') return false;
    const stored = localStorage.getItem('tarot_journal');
    if (!stored) return false;
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  };

  return (
    <>
      <div className="min-h-screen bg-main text-main animate-fade-in">
        <div className="skip-links">
          <a href="#journal-content" className="skip-link">Skip to journal content</a>
        </div>
        <main id="journal-content" tabIndex={-1} className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <GlobalNav />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
            <button
              onClick={() => navigate('/')}
              className="flex items-center text-accent hover:text-main self-start"
            >
              <CaretLeft className="w-5 h-5 mr-2" />
              Back to Reading
            </button>

            {/* Auth controls */}
            <div className="flex items-center gap-4">
              <UserMenu />
            </div>
          </div>

          <h1 className="text-3xl font-serif text-accent mb-4">Your Tarot Journal</h1>

          {/* Auth status & migration banner */}
          {isAuthenticated ? (
            <div className="mb-6 p-4 bg-secondary/10 border border-secondary/40 rounded-lg">
              <p className="text-sm text-secondary">
                ✓ Signed in — Your journal is synced across devices
              </p>
              {hasLocalStorageEntries() && !migrating && (
                <button
                  onClick={handleMigrate}
                  className="mt-2 flex items-center gap-2 text-sm text-secondary hover:text-secondary/80 underline"
                >
                  <UploadSimple className="w-4 h-4" />
                  Migrate localStorage entries to cloud
                </button>
              )}
              {migrating && (
                <p className="mt-2 text-sm text-secondary">Migrating...</p>
              )}
              {migrateMessage && (
                <p className="mt-2 text-sm text-secondary">{migrateMessage}</p>
              )}
            </div>
          ) : (
            <div className="mb-6 p-4 bg-primary/10 border border-primary/40 rounded-lg">
              <p className="text-sm text-accent">
                Your journal is currently stored locally in this browser only. Use the Sign In button in the header to sync across devices.
              </p>
            </div>
          )}

          {journalError && (
            <div className="mb-4 rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error">
              {journalError}
            </div>
          )}

          {/* Saved Intentions Section */}
          <SavedIntentionsList />

          {/* Delete status message */}
          {deleteMessage && (
            <div className={`mb-4 p-3 rounded-lg ${deleteMessage.includes('failed') ? 'bg-error/10 border border-error/40 text-error' : 'bg-secondary/10 border border-secondary/40 text-secondary'}`}>
              <p className="text-sm">{deleteMessage}</p>
            </div>
          )}

          {/* Loading state */}
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
              <p className="mt-4 text-muted">Loading journal...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="modern-surface p-6 sm:p-7 text-center text-main space-y-4 animate-fade-in">
              <div className="flex justify-center">
                <Notebook className="w-10 h-10 text-accent" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-2xl font-serif text-accent">Start your tarot journal</h2>
                <p className="text-muted text-sm sm:text-base max-w-2xl mx-auto mt-1">
                  Track patterns across readings, revisit past insights, and watch your understanding deepen over time.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 text-left text-sm text-muted">
                <div className="flex items-start gap-2">
                  <Sparkle className="w-4 h-4 mt-0.5 text-accent" />
                  <div>
                    <p className="text-main font-semibold">Spot recurring themes</p>
                    <p>Surface repeaters and spreads that resonate most.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <ChartLine className="w-4 h-4 mt-0.5 text-accent" />
                  <div>
                    <p className="text-main font-semibold">Measure your growth</p>
                    <p>See how questions evolve and which cards guide you.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <BookOpen className="w-4 h-4 mt-0.5 text-accent" />
                  <div>
                    <p className="text-main font-semibold">Capture reflections</p>
                    <p>Keep notes beside each position to revisit later.</p>
                  </div>
                </div>
              </div>

              <div className="text-left bg-surface rounded-xl border border-secondary/50 p-4 shadow-sm">
                <p className="text-[0.78rem] uppercase tracking-[0.12em] text-secondary/80 mb-1">Example entry</p>
                <div className="flex flex-col gap-1">
                  <p className="text-main font-semibold">Three-Card Story · Daily check-in</p>
                  <p className="text-muted text-sm">Question: &ldquo;What pattern is emerging for me this week?&rdquo;</p>
                  <p className="text-muted text-sm">Pull: The Star (upright), Six of Cups, Two of Wands</p>
                  <p className="text-secondary text-sm italic">Reflection: Hope is back. Remember the plan from Tuesday and take the next step.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleStartReading}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-surface shadow-lg shadow-accent/25 hover:opacity-95 transition"
                >
                  Start a reading
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/', { state: { focusSpread: true, initialQuestion: 'What pattern is emerging for me this week?' } })}
                  className="inline-flex items-center gap-2 rounded-full border border-secondary/60 px-5 py-2.5 text-sm font-semibold text-secondary hover:bg-secondary/10 transition"
                >
                  Try a guided draw
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <JournalFilters
                filters={filters}
                onChange={setFilters}
                contexts={CONTEXT_FILTERS}
                spreads={SPREAD_FILTERS}
                decks={DECK_FILTERS}
              />
              {(allStats || filteredStats) && (
                <JournalInsightsPanel
                  stats={filteredStats}
                  allStats={allStats}
                  entries={filteredEntries}
                  allEntries={entries}
                  isAuthenticated={isAuthenticated}
                  filtersActive={filtersActive}
                  shareLinks={shareLinks}
                  shareLoading={shareLoading}
                  shareError={shareError}
                  onCreateShareLink={isAuthenticated ? createShareLink : null}
                  onDeleteShareLink={isAuthenticated ? deleteShareLink : null}
                />
              )}
              {filteredEntries.length === 0 ? (
                <p className="text-muted">No entries match your filters.</p>
              ) : (
                <div className="space-y-6">
                  <p className="text-xs uppercase tracking-[0.2em] text-secondary/70">
                    Showing {visibleEntries.length} of {filteredEntries.length} entries
                  </p>
                  {visibleEntries.map((entry) => (
                    <JournalEntryCard
                      key={entry.id}
                      entry={entry}
                      isAuthenticated={isAuthenticated}
                      onCreateShareLink={isAuthenticated ? createShareLink : null}
                      onDelete={handleDeleteRequest}
                    />
                  ))}
                  {hasMoreEntries && (
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={handleLoadMoreEntries}
                        className="rounded-full border border-secondary/40 px-4 py-2 text-sm text-secondary hover:bg-secondary/10"
                      >
                        Show {Math.min(VISIBLE_ENTRY_BATCH, filteredEntries.length - visibleEntries.length)} more
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <ConfirmModal
        isOpen={deleteConfirmModal.isOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Journal Entry"
        message="Are you sure you want to delete this journal entry? This action cannot be undone."
        confirmText="Delete"
        cancelText="Keep Entry"
        variant="danger"
      />
    </>
  );
}
