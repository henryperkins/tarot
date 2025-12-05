import { useDeferredValue, useCallback, useEffect, useMemo, useState } from 'react';
import { CaretLeft, UploadSimple, ChartLine, Sparkle, BookOpen, CaretDown, CaretUp } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { GlobalNav } from './GlobalNav';
import { UserMenu } from './UserMenu';
import { ConfirmModal } from './ConfirmModal';
import { useAuth } from '../contexts/AuthContext';
import { useJournal } from '../hooks/useJournal';
import { JournalFilters } from './JournalFilters.jsx';
import { JournalInsightsPanel } from './JournalInsightsPanel.jsx';
import { InsightsErrorBoundary } from './InsightsErrorBoundary.jsx';
import { JournalEntryCard } from './JournalEntryCard.jsx';
import { SavedIntentionsList } from './SavedIntentionsList.jsx';
import { ArchetypeJourneySection } from './ArchetypeJourneySection.jsx';
import { EmptyJournalIllustration } from './illustrations/EmptyJournalIllustration';
import { NoFiltersIllustration } from './illustrations/NoFiltersIllustration';
import { computeJournalStats, formatContextName } from '../lib/journalInsights';
import { SPREADS } from '../data/spreads';
import { DECK_OPTIONS } from './DeckSelector';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useToast } from '../contexts/ToastContext.jsx';

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
const MOBILE_LAYOUT_MAX = 1023;

function getEntryTimestamp(entry) {
  if (!entry) return null;
  if (typeof entry.ts === 'number') return entry.ts;
  if (entry?.created_at) return entry.created_at * 1000;
  if (entry?.updated_at) return entry.updated_at * 1000;
  return null;
}

function getMonthHeader(timestamp) {
  if (!timestamp) return 'Undated';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Undated';
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

function formatSummaryDate(timestamp) {
  if (!timestamp) return 'No entries yet';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'No entries yet';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function getTopContext(stats) {
  if (!stats?.contextBreakdown?.length) return null;
  return stats.contextBreakdown.slice().sort((a, b) => b.count - a.count)[0];
}

export default function Journal() {
  const { isAuthenticated, user } = useAuth();
  const { entries, loading, deleteEntry, migrateToCloud, error: journalError } = useJournal();
  const [migrating, setMigrating] = useState(false);
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
  const [compactList, setCompactList] = useState(false);
  const [mobilePanelsOpen, setMobilePanelsOpen] = useState({ filters: false, insights: false, archetype: false });
  const navigate = useNavigate();
  const isMobileLayout = useSmallScreen(MOBILE_LAYOUT_MAX);
  const { publish: showToast } = useToast();

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
  const hasEntries = entries.length > 0;
  const toggleMobilePanel = (panelId) => {
    setMobilePanelsOpen((prev) => ({ ...prev, [panelId]: !prev[panelId] }));
  };
  const renderMobileAccordionSection = (id, label, content, helperText) => (
    <div className="rounded-2xl bg-surface/75 ring-1 ring-white/5 shadow-[0_18px_45px_-32px_rgba(0,0,0,0.75)]">
      <button
        type="button"
        onClick={() => toggleMobilePanel(id)}
        aria-expanded={Boolean(mobilePanelsOpen[id])}
        className="flex w-full items-center justify-between px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40"
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-secondary/70">{label}</p>
          {helperText && <p className="text-xs text-secondary/60">{helperText}</p>}
        </div>
        {mobilePanelsOpen[id] ? <CaretUp className="h-4 w-4 text-secondary/70" aria-hidden /> : <CaretDown className="h-4 w-4 text-secondary/70" aria-hidden />}
      </button>
      {mobilePanelsOpen[id] && (
        <div className="border-t border-white/5 p-4">
          {content}
        </div>
      )}
    </div>
  );

  const latestAllEntryTs = useMemo(() => {
    if (!entries || entries.length === 0) return null;
    return entries.reduce((latest, entry) => {
      const ts = getEntryTimestamp(entry);
      if (!ts) return latest;
      if (!latest || ts > latest) return ts;
      return latest;
    }, null);
  }, [entries]);

  const latestFilteredEntryTs = useMemo(() => {
    if (!filteredEntries || filteredEntries.length === 0) return null;
    return filteredEntries.reduce((latest, entry) => {
      const ts = getEntryTimestamp(entry);
      if (!ts) return latest;
      if (!latest || ts > latest) return ts;
      return latest;
    }, null);
  }, [filteredEntries]);

  const topContextAll = useMemo(() => getTopContext(allStats), [allStats]);
  const topContextFiltered = useMemo(() => getTopContext(filteredStats), [filteredStats]);
  const primaryEntryCount = filtersActive ? filteredEntries.length : entries.length;
  const entrySecondaryLabel = filtersActive ? `of ${entries.length} entries` : 'All time';
  const primaryReversalRate = filtersActive
    ? (filteredStats ? filteredStats.reversalRate : 0)
    : (allStats?.reversalRate ?? 0);
  const reversalSecondary = filtersActive
    ? `Journal avg ${allStats?.reversalRate ?? 0}%`
    : allStats?.totalCards
      ? `${allStats.totalCards} cards logged`
      : 'Log cards to see insights';
  const summaryTopContext = filtersActive && topContextFiltered ? topContextFiltered : topContextAll;
  const topContextLabel = summaryTopContext
    ? formatContextName(summaryTopContext.name)
    : filtersActive
      ? 'No match'
      : 'No context yet';
  const topContextSecondary = filtersActive
    ? summaryTopContext
      ? 'Filtered view'
      : 'Adjust filters to resurface contexts'
    : hasEntries
      ? `${entries.length} entries`
      : 'Log a reading';
  const summaryLastEntryTs = filtersActive && filteredEntries.length > 0 ? latestFilteredEntryTs : latestAllEntryTs;
  const summaryLastEntryLabel = filtersActive && filteredEntries.length === 0
    ? 'No matches'
    : formatSummaryDate(summaryLastEntryTs);
  const summaryLastEntrySecondary = filtersActive
    ? (filteredEntries.length === 0 ? 'Showing whole journal' : `Journal: ${formatSummaryDate(latestAllEntryTs)}`)
    : 'Latest journal update';
  const summaryCardData = [
    {
      id: 'entries',
      label: 'Entries logged',
      value: primaryEntryCount,
      hint: entrySecondaryLabel
    },
    {
      id: 'reversal',
      label: 'Reversal rate',
      value: `${primaryReversalRate}%`,
      hint: reversalSecondary
    },
    {
      id: 'context',
      label: 'Top context',
      value: topContextLabel,
      hint: topContextSecondary
    },
    {
      id: 'last-entry',
      label: 'Last entry',
      value: summaryLastEntryLabel,
      hint: summaryLastEntrySecondary
    }
  ];
  const showSummaryBand = !loading && hasEntries;

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

    const result = await migrateToCloud();

    if (result.success) {
      const parts = [`Migrated ${result.migrated} entries`];
      if (typeof result.skipped === 'number' && result.skipped > 0) {
        parts.push(`${result.skipped} already existed`);
      }
      showToast({
        type: 'success',
        title: 'Migration complete',
        description: parts.join(', ')
      });
    } else {
      showToast({
        type: 'error',
        title: 'Migration failed',
        description: result.error || 'We could not sync your local entries.'
      });
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
      showToast({
        type: 'success',
        title: 'Entry deleted',
        description: 'Removed from your journal history.'
      });
    } else {
      showToast({
        type: 'error',
        title: 'Delete failed',
        description: result.error || 'Please try again in a moment.'
      });
    }
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

  const desktopRailContent = (!loading && hasEntries && !isMobileLayout) ? (
    <div className="space-y-6 lg:space-y-8">
      <JournalFilters
        filters={filters}
        onChange={setFilters}
        contexts={CONTEXT_FILTERS}
        spreads={SPREAD_FILTERS}
        decks={DECK_FILTERS}
      />
      {(allStats || filteredStats) && (
        <InsightsErrorBoundary>
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
        </InsightsErrorBoundary>
      )}
      {isAuthenticated && (
        <ArchetypeJourneySection isAuthenticated={isAuthenticated} userId={user?.id} showEmptyState />
      )}
    </div>
  ) : null;
  const hasRailContent = !loading && hasEntries;
  const entryStackSpacingClass = compactList ? 'space-y-3.5' : 'space-y-5';
  let lastMonthLabel = null;
  const renderedHistoryEntries = visibleEntries.map((entry, index) => {
    const timestamp = getEntryTimestamp(entry);
    const monthLabel = getMonthHeader(timestamp);
    const showDivider = monthLabel !== lastMonthLabel;
    lastMonthLabel = monthLabel;
    const key = entry.id || `${timestamp || 'entry'}-${index}`;
    return (
      <div key={key} className="space-y-2">
        {showDivider && (
          <p className="text-[11px] uppercase tracking-[0.3em] text-secondary/60">{monthLabel}</p>
        )}
        <JournalEntryCard
          entry={entry}
          isAuthenticated={isAuthenticated}
          onCreateShareLink={isAuthenticated ? createShareLink : null}
          onDelete={handleDeleteRequest}
          compact={compactList}
        />
      </div>
    );
  });

  const mobileRailContent = (!loading && hasEntries && isMobileLayout) ? (
    <section className="mb-6 space-y-3 lg:hidden" aria-label="Journal filters and insights">
      {renderMobileAccordionSection('filters', 'Filters', (
        <JournalFilters
          filters={filters}
          onChange={setFilters}
          contexts={CONTEXT_FILTERS}
          spreads={SPREAD_FILTERS}
          decks={DECK_FILTERS}
        />
      ), 'Search and narrow your journal')}

      {(allStats || filteredStats) && renderMobileAccordionSection('insights', 'Insights', (
        <InsightsErrorBoundary>
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
        </InsightsErrorBoundary>
      ), 'Share, export, and view analytics')}

      {isAuthenticated && renderMobileAccordionSection('archetype', 'Archetype journey', (
        <ArchetypeJourneySection isAuthenticated={isAuthenticated} userId={user?.id} showEmptyState />
      ), 'Track recurring cards in your readings')}
    </section>
  ) : null;

  return (
    <>
      <div className="min-h-screen bg-main text-main animate-fade-in">
        <div className="skip-links">
          <a href="#journal-content" className="skip-link">Skip to journal content</a>
        </div>
        <main id="journal-content" tabIndex={-1} className="journal-page max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <GlobalNav />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
            <button
              onClick={() => navigate('/')}
              className="flex items-center text-accent hover:text-main self-start"
            >
              <CaretLeft className="w-5 h-5 mr-2" />
              Back to Reading
            </button>

            <div className="flex items-center gap-4">
              <UserMenu />
            </div>
          </div>

          <h1 className="text-3xl font-serif text-accent mb-4">Your Tarot Journal</h1>

          {isAuthenticated ? (
            <div className="mb-6 rounded-2xl border border-secondary/40 bg-secondary/10 p-4">
              <p className="journal-prose text-secondary">✓ Signed in — Your journal is synced across devices</p>
              {hasLocalStorageEntries() && !migrating && (
                <button
                  onClick={handleMigrate}
                  className="mt-2 inline-flex items-center gap-2 text-sm text-secondary hover:text-secondary/80 underline"
                >
                  <UploadSimple className="w-4 h-4" />
                  Migrate localStorage entries to cloud
                </button>
              )}
              {migrating && (
                <p className="mt-2 text-sm text-secondary">Migrating...</p>
              )}
            </div>
          ) : (
            <div className="mb-6 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm text-accent journal-prose">
              Your journal is currently stored locally in this browser only. Use the Sign In button in the header to sync across devices.
            </div>
          )}

          {journalError && (
            <div className="mb-4 rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error">
              {journalError}
            </div>
          )}

          {showSummaryBand && (
            <section className="mb-6 rounded-3xl border border-secondary/30 bg-surface/80 p-6 shadow-lg">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="journal-eyebrow text-secondary/70">Journal pulse</p>
                    <h2 className="text-2xl font-serif text-main">Where your readings stand</h2>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={handleStartReading}
                      className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2 text-sm font-semibold text-surface shadow-lg shadow-accent/30 hover:opacity-95"
                    >
                      New entry
                    </button>
                      <label className="journal-prose flex items-center gap-2 text-sm text-secondary">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-secondary/40 bg-surface text-accent focus:ring-secondary"
                        checked={compactList}
                        onChange={(event) => setCompactList(event.target.checked)}
                      />
                      Compact list
                    </label>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {summaryCardData.map((card) => (
                    <div key={card.id} className="rounded-2xl border border-secondary/20 bg-surface/40 p-4">
                      <p className="journal-eyebrow text-secondary/60">{card.label}</p>
                      <p className="mt-2 text-2xl font-serif text-main">{card.value}</p>
                      {card.hint && (
                        <p className="journal-prose text-secondary/70">{card.hint}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {mobileRailContent}

          {loading ? (
            <div className="py-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-accent" />
              <p className="mt-4 text-muted">Loading journal...</p>
            </div>
          ) : (
              <div className={hasEntries && hasRailContent ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6' : ''}>
                <div className="space-y-8">
                <section id="today" className="rounded-3xl bg-surface/75 ring-1 ring-white/5 p-5 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.8)]">
                  <div className="mb-4">
                    <p className="journal-eyebrow text-secondary/70">Today</p>
                    <h2 className="text-xl font-serif text-main">Keep today&rsquo;s focus handy</h2>
                  </div>
                  <SavedIntentionsList />
                </section>

                    {hasEntries ? (
                      <section id="history" className="space-y-5">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-serif text-main">Journal history</h2>
                          <span className="inline-flex items-center rounded-full bg-surface/70 ring-1 ring-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary/70">
                            History
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-2 rounded-full bg-surface/70 ring-1 ring-white/5 px-3 py-1 text-[11px] text-secondary/70">
                          Showing {visibleEntries.length} of {filteredEntries.length}
                        </span>
                      </div>

                    {filteredEntries.length === 0 ? (
                      <div className="rounded-2xl bg-surface/70 ring-1 ring-white/5 p-8 text-center text-sm text-secondary shadow-[0_16px_40px_-30px_rgba(0,0,0,0.7)]">
                          <NoFiltersIllustration className="mb-4" />
                          <p className="journal-prose text-lg text-main">No entries match your filters.</p>
                          <p className="journal-prose mt-2 text-secondary/70">Try adjusting the filters or reset to see the full journal.</p>
                      </div>
                    ) : (
                      <>
                        <div className={entryStackSpacingClass}>
                          {renderedHistoryEntries}
                        </div>
                        {hasMoreEntries && (
                          <div className="flex justify-center">
                            <button
                              type="button"
                              onClick={handleLoadMoreEntries}
                              className="inline-flex items-center rounded-full bg-surface/70 ring-1 ring-white/5 px-3.5 py-1.5 min-h-[44px] text-xs font-semibold text-secondary hover:bg-secondary/10 shadow-[0_10px_26px_-22px_rgba(0,0,0,0.7)] touch-manipulation"
                            >
                              Load {Math.min(VISIBLE_ENTRY_BATCH, filteredEntries.length - visibleEntries.length)} more
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                ) : (
                  <div className="modern-surface animate-fade-in space-y-6 rounded-3xl p-8 text-center text-main">
                    <EmptyJournalIllustration className="mb-6" />
                    <div>
                      <h2 className="text-2xl font-serif text-accent">Start your tarot journal</h2>
                      <p className="journal-prose mt-1 text-sm text-muted sm:text-base">
                        Track patterns across readings, revisit past insights, and watch your understanding deepen over time.
                      </p>
                    </div>
                    <div className="grid gap-3 text-left text-sm text-muted sm:grid-cols-3">
                      <div className="flex items-start gap-2">
                        <Sparkle className="mt-0.5 h-4 w-4 text-accent" />
                        <div className="journal-prose">
                          <p className="text-main font-semibold">Spot recurring themes</p>
                          <p>Surface repeaters and spreads that resonate most.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <ChartLine className="mt-0.5 h-4 w-4 text-accent" />
                        <div className="journal-prose">
                          <p className="text-main font-semibold">Measure your growth</p>
                          <p>See how questions evolve and which cards guide you.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <BookOpen className="mt-0.5 h-4 w-4 text-accent" />
                        <div className="journal-prose">
                          <p className="text-main font-semibold">Capture reflections</p>
                          <p>Keep notes beside each position to revisit later.</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-secondary/50 bg-surface p-4 text-left shadow-sm">
                      <p className="text-[0.78rem] uppercase tracking-[0.12em] text-secondary/80 mb-1">Example entry</p>
                      <div className="journal-prose flex flex-col gap-1 text-sm text-muted">
                        <p className="text-main font-semibold">Three-Card Story · Daily check-in</p>
                        <p>Question: &ldquo;What pattern is emerging for me this week?&rdquo;</p>
                        <p>Pull: The Star (upright), Six of Cups, Two of Wands</p>
                        <p className="italic text-secondary">Reflection: Hope is back. Remember the plan from Tuesday and take the next step.</p>
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
                )}
              </div>

              {hasEntries && hasRailContent && desktopRailContent && (
                <aside className="hidden lg:block">
                  <div className="lg:sticky lg:top-6">
                    {desktopRailContent}
                  </div>
                </aside>
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
