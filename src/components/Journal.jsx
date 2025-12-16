import { useDeferredValue, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CaretLeft, UploadSimple, ChartLine, Sparkle, BookOpen, CaretDown, ClockCounterClockwise } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { GlobalNav } from './GlobalNav';
import { UserMenu } from './UserMenu';
import { ConfirmModal } from './ConfirmModal';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useJournal } from '../hooks/useJournal';
import { JournalFilters } from './JournalFilters.jsx';
import { InsightsErrorBoundary } from './InsightsErrorBoundary.jsx';
import { JournalEntryCard } from './JournalEntryCard.jsx';
import { SavedIntentionsList } from './SavedIntentionsList.jsx';
import { OUTLINE_BUTTON_CLASS } from '../styles/buttonClasses';
import { ReadingJourney } from './ReadingJourney';
import { EmptyJournalIllustration } from './illustrations/EmptyJournalIllustration';
import { NoFiltersIllustration } from './illustrations/NoFiltersIllustration';
import { computeJournalStats, formatContextName } from '../lib/journalInsights';
import { SPREADS } from '../data/spreads';
import { DECK_OPTIONS } from './DeckSelector';
import { getCardImage, getCanonicalCard } from '../lib/cardLookup';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useToast } from '../contexts/ToastContext.jsx';
import AuthModal from './AuthModal';
import { AccountNudge } from './nudges';

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

const SUIT_ELEMENTS = {
  Wands: { element: 'Fire', quality: 'passion, action, creativity' },
  Cups: { element: 'Water', quality: 'emotions, relationships, intuition' },
  Swords: { element: 'Air', quality: 'thoughts, communication, conflict' },
  Pentacles: { element: 'Earth', quality: 'material, practical, grounded' }
};

// Fallback stats object when journal is empty or stats cannot be computed
const EMPTY_STATS = {
  totalReadings: 0,
  totalCards: 0,
  reversalRate: 0,
  frequentCards: [],
  contextBreakdown: [],
  monthlyCadence: [],
  recentThemes: []
};

const VISIBLE_ENTRY_BATCH = 10;

const CARD_NODE_POSITIONS = {
  entries: { x: 50, y: 50 },
  reversal: { x: 78, y: 38 },
  context: { x: 24, y: 36 },
  'last-entry': { x: 52, y: 74 }
};

const CARD_NODE_FALLBACK = [
  { x: 24, y: 36 },
  { x: 78, y: 38 },
  { x: 50, y: 50 },
  { x: 52, y: 74 }
];
const MOBILE_LAYOUT_MAX = 1023;
const AMBER_SHELL_CLASS = 'relative overflow-hidden rounded-3xl border border-amber-300/12 bg-gradient-to-br from-[#0b0c1d] via-[#0d1024] to-[#090a16] shadow-[0_24px_68px_-30px_rgba(0,0,0,0.9)]';
const AMBER_CARD_CLASS = 'relative overflow-hidden rounded-2xl border border-amber-300/15 bg-gradient-to-br from-[#0f0b16]/85 via-[#0c0a13]/85 to-[#0a0810]/85 ring-1 ring-amber-300/10 shadow-[0_18px_45px_-30px_rgba(0,0,0,0.85)]';

function AmberStarfield() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 opacity-60 mix-blend-screen"
        aria-hidden="true"
        style={{
          backgroundImage:
            'radial-gradient(circle at 12% 18%, rgba(251,191,36,0.08), transparent 32%), radial-gradient(circle at 84% 22%, rgba(56,189,248,0.07), transparent 30%), radial-gradient(circle at 58% 76%, rgba(167,139,250,0.08), transparent 32%)'
        }}
      />
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-amber-500/12 blur-[110px]" aria-hidden="true" />
      <div className="pointer-events-none absolute right-[-120px] top-1/3 h-72 w-72 rounded-full bg-cyan-400/10 blur-[110px]" aria-hidden="true" />
    </>
  );
}

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
  const { shouldShowAccountNudge, dismissAccountNudge, personalization } = usePreferences();
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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [expandedCardIndex, setExpandedCardIndex] = useState(null);
  const [historyFiltersEl, setHistoryFiltersEl] = useState(null);
  const [historyFiltersInView, setHistoryFiltersInView] = useState(true);
  const [hasScrolled, setHasScrolled] = useState(false);
  const navigate = useNavigate();
  const isMobileLayout = useSmallScreen(MOBILE_LAYOUT_MAX);
  const isSmallSummary = useSmallScreen(640);
  const summaryRef = useRef(null);
  const [summaryInView, setSummaryInView] = useState(!isSmallSummary);
  const { publish: showToast } = useToast();

  const registerHistoryFiltersEl = useCallback((node) => {
    setHistoryFiltersEl(node);
  }, []);

  const handleStartReading = (suggestion) => {
    navigate('/', {
      state: {
        focusSpread: true,
        suggestedSpread: suggestion?.spread,
        suggestedQuestion: suggestion?.text
      }
    });
  };

  const scrollToHistoryFilters = useCallback(() => {
    const target = historyFiltersEl
      || document.getElementById('journal-history-filters')
      || document.getElementById('history');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [historyFiltersEl]);

  const locale = useMemo(() => {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language;
    }
    return 'en-US';
  }, []);

  const timezone = useMemo(() => {
    if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    return undefined;
  }, []);

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

  useEffect(() => {
    setSummaryInView(!isSmallSummary);
  }, [isSmallSummary]);

  useEffect(() => {
    if (!summaryRef.current) return undefined;
    if (!isSmallSummary) {
      setSummaryInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setSummaryInView(true);
          }
        });
      },
      { threshold: 0.2 }
    );
    observer.observe(summaryRef.current);
    return () => observer.disconnect();
  }, [isSmallSummary]);

  useEffect(() => {
    if (!historyFiltersEl || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setHistoryFiltersInView(entry.isIntersecting);
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(historyFiltersEl);
    return () => observer.disconnect();
  }, [historyFiltersEl]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleScroll = () => setHasScrolled(window.scrollY > 200);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const visibleEntries = useMemo(() => filteredEntries.slice(0, visibleCount), [filteredEntries, visibleCount]);
  const hasMoreEntries = filteredEntries.length > visibleCount;

  // Compute stats for both full journal and filtered view
  const allStats = useMemo(() => computeJournalStats(entries) ?? EMPTY_STATS, [entries]);
  const filteredStats = useMemo(() => computeJournalStats(filteredEntries) ?? EMPTY_STATS, [filteredEntries]);
  const filtersActive = Boolean(filters.query.trim()) || filters.contexts.length > 0 || filters.spreads.length > 0 || filters.decks.length > 0 || filters.timeframe !== 'all' || filters.onlyReversals;
  const hasEntries = entries.length > 0;

  const latestAllEntryTs = useMemo(() => {
    if (!entries || entries.length === 0) return null;
    return entries.reduce((latest, entry) => {
      const ts = getEntryTimestamp(entry);
      if (!ts) return latest;
      if (!latest || ts > latest) return ts;
      return latest;
    }, null);
  }, [entries]);

  const heroEntry = useMemo(() => {
    const source = (filtersActive && filteredEntries.length > 0) ? filteredEntries : entries;
    if (!Array.isArray(source) || source.length === 0) return null;
    const sorted = [...source].sort((a, b) => {
      const aTs = getEntryTimestamp(a) || 0;
      const bTs = getEntryTimestamp(b) || 0;
      return bTs - aTs;
    });
    return sorted[0] || null;
  }, [entries, filteredEntries, filtersActive]);

  // Reset expanded card when the hero entry changes (new reading, filter change)
  useEffect(() => {
    setExpandedCardIndex(null);
  }, [heroEntry?.id, heroEntry?.sessionSeed]);

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
  const isFilteredEmpty = filtersActive && filteredEntries.length === 0;
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
  const summaryTopContext = filtersActive ? topContextFiltered : topContextAll;
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
  const summaryLastEntryLabel = isFilteredEmpty
    ? 'No matches'
    : formatSummaryDate(summaryLastEntryTs);
  const summaryLastEntrySecondary = filtersActive
    ? (isFilteredEmpty ? 'Adjust filters to see matches' : `Journal: ${formatSummaryDate(latestAllEntryTs)}`)
    : 'Latest journal update';
  const heroDateLabel = heroEntry ? formatSummaryDate(getEntryTimestamp(heroEntry)) : null;
  const heroCardLimit = isSmallSummary ? 1 : 3;
  const heroCards = useMemo(() => {
    if (!heroEntry || !Array.isArray(heroEntry.cards)) return [];
    return heroEntry.cards.slice(0, heroCardLimit).map((card, index) => ({
      id: `${card.name || 'card'}-${index}`,
      name: card.name || 'Card',
      position: card.position || `Card ${index + 1}`,
      orientation: card.orientation || (card.isReversed ? 'Reversed' : 'Upright'),
      image: getCardImage(card)
    }));
  }, [heroEntry, heroCardLimit]);
  const summaryCardData = useMemo(() => [
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
  ], [primaryEntryCount, entrySecondaryLabel, primaryReversalRate, reversalSecondary, topContextLabel, topContextSecondary, summaryLastEntryLabel, summaryLastEntrySecondary]);
  const showSummaryBand = !loading && hasEntries;
  const CARD_CONNECTORS = [
    ['entries', 'reversal'],
    ['entries', 'context'],
    ['entries', 'last-entry'],
    ['reversal', 'context'],
    ['reversal', 'last-entry'],
    ['context', 'last-entry']
  ];
  const statNodes = useMemo(() => {
    let fallbackIndex = 0;
    return summaryCardData.map((card) => {
      const fallback = CARD_NODE_FALLBACK[fallbackIndex] || { x: 50, y: 50 + fallbackIndex * 8 };
      const pos = CARD_NODE_POSITIONS[card.id] || fallback;
      fallbackIndex += CARD_NODE_POSITIONS[card.id] ? 0 : 1;
      return {
        ...card,
        x: pos.x,
        y: pos.y,
        isHero: card.id === 'entries'
      };
    });
  }, [summaryCardData]);
  const statNodeMap = useMemo(
    () => Object.fromEntries(statNodes.map((node) => [node.id, node])),
    [statNodes]
  );

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
    <div className="space-y-6 lg:space-y-8 w-full">
      <div className="w-full">
        <InsightsErrorBoundary>
          <ReadingJourney
            entries={entries}
            filteredEntries={filteredEntries}
            filtersActive={filtersActive}
            isAuthenticated={isAuthenticated}
            userId={user?.id}
            focusAreas={personalization?.focusAreas}
            locale={locale}
            timezone={timezone}
            variant="sidebar"
            onCreateShareLink={isAuthenticated ? createShareLink : null}
            onStartReading={handleStartReading}
          />
        </InsightsErrorBoundary>
      </div>
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
          <p className="text-[11px] uppercase tracking-[0.3em] text-amber-100/60">{monthLabel}</p>
        )}
        <JournalEntryCard
          entry={entry}
          isAuthenticated={isAuthenticated}
          onCreateShareLink={isAuthenticated ? createShareLink : null}
          shareLinks={shareLinks}
          shareLoading={shareLoading}
          shareError={shareError}
          onDeleteShareLink={isAuthenticated ? deleteShareLink : null}
          onDelete={handleDeleteRequest}
          compact={compactList}
        />
      </div>
    );
  });

  const mobileRailContent = (!loading && hasEntries && isMobileLayout) ? (
    <section className="mb-6 space-y-3 lg:hidden" aria-label="Journal insights and journey">
      {/* Filters moved to Journal history section to avoid duplication */}
      <InsightsErrorBoundary>
        <ReadingJourney
          entries={entries}
          filteredEntries={filteredEntries}
          filtersActive={filtersActive}
          isAuthenticated={isAuthenticated}
          userId={user?.id}
          focusAreas={personalization?.focusAreas}
          locale={locale}
          timezone={timezone}
          variant="mobile"
          onCreateShareLink={isAuthenticated ? createShareLink : null}
          onStartReading={handleStartReading}
        />
      </InsightsErrorBoundary>
    </section>
  ) : null;

  return (
    <>
      <div className="min-h-screen bg-main text-main animate-fade-in">
        <div className="skip-links">
          <a href="#journal-content" className="skip-link">Skip to journal content</a>
        </div>
        <main id="journal-content" tabIndex={-1} className="journal-page max-w-7xl mx-auto px-4 sm:px-6 py-8">
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

          {hasEntries && (
            <div className="mb-5">
              <button
                type="button"
                onClick={scrollToHistoryFilters}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-amber-200/25 bg-amber-200/5 px-5 py-2.5 text-sm font-semibold text-amber-50 shadow-[0_12px_30px_-18px_rgba(251,191,36,0.35)] transition hover:-translate-y-0.5 hover:border-amber-200/40 hover:bg-amber-200/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40"
              >
                <Sparkle className="h-4 w-4 text-amber-200" weight="fill" aria-hidden="true" />
                Find a reading
              </button>
            </div>
          )}

          {isAuthenticated ? (
            <div className={`mb-6 ${AMBER_CARD_CLASS} p-5`}>
              <AmberStarfield />
              <div className="relative z-10 space-y-2">
                <p className="journal-prose text-amber-100/85">✓ Signed in — Your journal is synced across devices</p>
                {hasLocalStorageEntries() && !migrating && (
                  <button
                    onClick={handleMigrate}
                    className={`${OUTLINE_BUTTON_CLASS} mt-1`}
                  >
                    <UploadSimple className="w-4 h-4" />
                    Migrate localStorage entries
                  </button>
                )}
                {migrating && (
                  <p className="text-sm text-amber-100/70">Migrating...</p>
                )}
              </div>
            </div>
          ) : (
            <div className={`mb-6 ${AMBER_CARD_CLASS} p-5`}>
              <AmberStarfield />
              <div className="relative z-10 space-y-3 text-sm text-amber-100/80 journal-prose">
                <p>Your journal is currently stored locally in this browser only. Use the Sign In button in the header to sync across devices.</p>
                {shouldShowAccountNudge && (
                  <div className="mt-1">
                    <AccountNudge
                      onCreateAccount={() => setShowAuthModal(true)}
                      onDismiss={dismissAccountNudge}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {journalError && (
            <div className="mb-4 rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error">
              {journalError}
            </div>
          )}

          {showSummaryBand && (
            <section
              ref={summaryRef}
              className="relative mb-6 overflow-hidden rounded-3xl border border-amber-300/10 bg-gradient-to-br from-[#07091a] via-[#0a0c1a] to-[#050714] shadow-[0_24px_64px_-24px_rgba(0,0,0,0.95)]"
            >
              {summaryInView && (
                <>
                  {/* Dense star field */}
                  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                    {[
                      { x: 5, y: 12, s: 1, o: 0.6 }, { x: 12, y: 8, s: 1.5, o: 0.8 }, { x: 18, y: 25, s: 1, o: 0.4 },
                      { x: 25, y: 5, s: 2, o: 0.7 }, { x: 32, y: 18, s: 1, o: 0.5 }, { x: 38, y: 10, s: 1.5, o: 0.6 },
                      { x: 45, y: 22, s: 1, o: 0.4 }, { x: 52, y: 6, s: 1, o: 0.7 }, { x: 58, y: 15, s: 2, o: 0.5 },
                      { x: 65, y: 8, s: 1, o: 0.6 }, { x: 72, y: 20, s: 1.5, o: 0.4 }, { x: 78, y: 12, s: 1, o: 0.8 },
                      { x: 85, y: 5, s: 1, o: 0.5 }, { x: 92, y: 18, s: 2, o: 0.6 }, { x: 95, y: 8, s: 1, o: 0.4 },
                      { x: 8, y: 88, s: 1, o: 0.5 }, { x: 15, y: 92, s: 1.5, o: 0.6 }, { x: 22, y: 85, s: 1, o: 0.4 },
                      { x: 35, y: 90, s: 2, o: 0.7 }, { x: 48, y: 95, s: 1, o: 0.5 }, { x: 62, y: 88, s: 1, o: 0.6 },
                      { x: 75, y: 92, s: 1.5, o: 0.4 }, { x: 88, y: 86, s: 1, o: 0.7 }, { x: 95, y: 90, s: 1, o: 0.5 },
                      { x: 3, y: 45, s: 1, o: 0.3 }, { x: 97, y: 55, s: 1, o: 0.3 }, { x: 50, y: 3, s: 1.5, o: 0.4 },
                    ].map((star, i) => (
                      <div
                        key={i}
                        className="absolute rounded-full bg-amber-100"
                        style={{
                          left: `${star.x}%`,
                          top: `${star.y}%`,
                          width: star.s,
                          height: star.s,
                          opacity: star.o,
                          boxShadow: star.o > 0.6 ? `0 0 ${star.s * 4}px ${star.s}px rgba(251,191,36,${star.o * 0.4})` : 'none'
                        }}
                      />
                    ))}
                  </div>

                  {/* Nebula glows */}
                  <div className="pointer-events-none absolute -left-40 top-1/4 h-80 w-80 rounded-full bg-indigo-600/[0.07] blur-[100px]" aria-hidden="true" />
                  <div className="pointer-events-none absolute -right-32 top-1/3 h-64 w-64 rounded-full bg-amber-500/[0.05] blur-[80px]" aria-hidden="true" />
                  <div className="pointer-events-none absolute left-1/4 -bottom-24 h-56 w-56 rounded-full bg-purple-600/[0.06] blur-[90px]" aria-hidden="true" />
                  <div className="pointer-events-none absolute right-1/4 top-0 h-48 w-48 rounded-full bg-cyan-500/[0.04] blur-[70px]" aria-hidden="true" />
                </>
              )}

              <div className="relative p-5 sm:p-6 lg:p-8">
                {/* Header - Clean and simple */}
                <div className="mb-5 lg:mb-4">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/50 mb-1">Journal Pulse</p>
                  <h2 className="text-xl sm:text-2xl font-serif text-amber-50/90">Your practice at a glance</h2>
                </div>

                {/* Mobile: Clean organized layout */}
                <div className="lg:hidden space-y-4">
                  {/* Stats row - 2 clean cards */}
                  <div className="grid grid-cols-2 gap-3">
                    {summaryCardData.slice(0, 2).map((stat) => {
                      const icon = stat.id === 'entries'
                        ? <Sparkle className="h-4 w-4" weight="fill" aria-hidden />
                        : <ChartLine className="h-4 w-4" aria-hidden />;
                      return (
                        <div
                          key={stat.id}
                          className="rounded-xl border border-amber-300/15 bg-gradient-to-b from-[#0f0d18] to-[#0a0912] p-3 text-center"
                        >
                          <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-amber-200/10 text-amber-200/70">
                            {icon}
                          </div>
                          <p className="text-2xl font-serif text-amber-50">{stat.value}</p>
                          <p className="text-[10px] uppercase tracking-wider text-amber-100/50 mt-1">{stat.label}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Hero card - Latest reading with clear tap affordance */}
                  {heroEntry && heroCards.length > 0 && (() => {
                    const card = heroCards[0];
                    const canonical = getCanonicalCard(card);
                    const isReversed = (card.orientation || '').toLowerCase().includes('reversed');
                    const meaning = isReversed ? canonical?.reversed : canonical?.upright;
                    const isExpanded = expandedCardIndex === 0;

                    return (
                      <button
                        type="button"
                        onClick={() => setExpandedCardIndex(isExpanded ? null : 0)}
                        aria-expanded={isExpanded}
                        aria-label={`${card.name}, ${card.orientation}. Tap for insight.`}
                        className="w-full rounded-xl border border-amber-300/15 bg-gradient-to-b from-[#0f0d18] to-[#0a0912] p-3 text-left transition-all hover:border-amber-300/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
                      >
                        <div className="flex items-center gap-3">
                          {/* Card thumbnail */}
                          <div className="relative w-14 h-20 flex-shrink-0 overflow-hidden rounded-lg border border-amber-300/20">
                            <img
                              src={card.image}
                              alt={card.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          {/* Card info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] uppercase tracking-wider text-amber-100/50 mb-0.5">Latest card</p>
                            <p className="font-serif text-base text-amber-50 truncate">{card.name}</p>
                            <p className="text-xs text-amber-100/60">{card.orientation} · {heroDateLabel}</p>
                          </div>
                          {/* Chevron indicator */}
                          <div className={`flex-shrink-0 text-amber-200/50 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                            <CaretDown className="h-5 w-5" aria-hidden />
                          </div>
                        </div>
                        {/* Expandable insight */}
                        {isExpanded && meaning && (
                          <div className="mt-3 pt-3 border-t border-amber-200/10">
                            <p className="text-xs text-amber-100/80 leading-relaxed">{meaning}</p>
                          </div>
                        )}
                      </button>
                    );
                  })()}

                  {/* CTAs - Clear actions */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleStartReading}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-300 to-amber-400 px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-amber-400/20 transition hover:shadow-amber-300/30 hover:-translate-y-0.5 active:translate-y-0 min-h-[44px]"
                    >
                      <Sparkle className="h-4 w-4" weight="fill" aria-hidden />
                      New Reading
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const journeySection = document.querySelector('[aria-label="Journal insights and journey"]');
                        if (journeySection) {
                          journeySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-amber-300/30 bg-amber-200/5 px-4 py-3 text-sm font-medium text-amber-100 transition hover:bg-amber-200/10 hover:border-amber-300/40 min-h-[44px]"
                    >
                      See Journey
                      <CaretDown className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>

                {/* Desktop: Keep expanded hero cards for larger screens */}
                <div className="hidden lg:block">
                  {heroEntry && heroCards.length > 0 && (
                    <div className="mb-4 flex flex-wrap justify-center gap-2.5">
                      {heroCards.map((card, index) => {
                        const isExpanded = expandedCardIndex === index;
                        const canonical = getCanonicalCard(card);
                        const isReversed = (card.orientation || '').toLowerCase().includes('reversed');
                        const meaning = isReversed ? canonical?.reversed : canonical?.upright;
                        const suitInfo = canonical?.suit ? SUIT_ELEMENTS[canonical.suit] : null;
                        const isMajor = canonical?.number !== undefined;

                        return (
                          <div key={card.id} className="flex items-stretch">
                            <button
                              type="button"
                              aria-expanded={isExpanded}
                              aria-label={`${card.name}, ${card.orientation}. Tap for insight.`}
                              onClick={() => setExpandedCardIndex(isExpanded ? null : index)}
                              className={`relative w-24 sm:w-28 flex-shrink-0 overflow-hidden rounded-xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
                                isExpanded
                                  ? 'border-amber-400/40 ring-1 ring-amber-400/20 rounded-r-none'
                                  : 'border-amber-300/20 hover:border-amber-300/30'
                              } bg-gradient-to-b from-[#120f1f] via-[#0c0a14] to-[#0a0911] shadow-[0_12px_32px_-20px_rgba(251,191,36,0.35)]`}
                            >
                              <div className="relative aspect-[2/3] overflow-hidden">
                                <img
                                  src={card.image}
                                  alt={card.name}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
                                {index === 0 && heroDateLabel && (
                                  <div className="absolute left-1.5 top-1.5 rounded-full bg-amber-300/25 px-1.5 py-0.5 text-[8px] font-semibold text-amber-50">
                                    {heroDateLabel}
                                  </div>
                                )}
                              </div>
                              <div className="px-2 pb-2 pt-1.5">
                                <p className="font-serif text-xs text-amber-50 leading-tight truncate">{card.name}</p>
                                <p className="text-[9px] text-amber-100/55">{card.orientation}</p>
                              </div>
                            </button>

                            {/* Slide-out insight panel */}
                            <div
                              className={`overflow-hidden transition-all duration-300 ease-out ${
                                isExpanded ? 'w-36 sm:w-40 opacity-100' : 'w-0 opacity-0'
                              }`}
                            >
                              <div className="w-36 sm:w-40 h-full rounded-r-xl border-y border-r border-amber-400/25 bg-gradient-to-br from-[#12101c] to-[#0a0912] p-2 flex flex-col">
                                <p className="text-[9px] uppercase tracking-wider text-amber-300/50 mb-1">
                                  {suitInfo ? suitInfo.element : isMajor ? 'Major Arcana' : 'Insight'}
                                </p>
                                {suitInfo && (
                                  <p className="text-[9px] text-amber-200/50 mb-1.5 leading-tight">
                                    {suitInfo.quality}
                                  </p>
                                )}
                                <p className="text-[10px] text-amber-100/80 leading-relaxed overflow-hidden flex-1" style={{ display: '-webkit-box', WebkitLineClamp: suitInfo ? 4 : 5, WebkitBoxOrient: 'vertical' }}>
                                  {meaning || 'Explore this card\'s traditional symbolism and personal significance in your reading.'}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                {/* Desktop: Constellation layout - only visible on large screens */}
                  <div className="relative" style={{ height: '340px' }}>
                    {/* SVG constellation lines */}
                    <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
                      <defs>
                        <linearGradient id="lineGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="rgba(251,191,36,0.45)" />
                          <stop offset="50%" stopColor="rgba(251,191,36,0.12)" />
                          <stop offset="100%" stopColor="rgba(251,191,36,0.45)" />
                        </linearGradient>
                        <linearGradient id="lineGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="rgba(251,191,36,0.4)" />
                          <stop offset="100%" stopColor="rgba(251,191,36,0.12)" />
                        </linearGradient>
                        <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="rgba(251,191,36,0.8)" />
                          <stop offset="60%" stopColor="rgba(251,191,36,0.25)" />
                          <stop offset="100%" stopColor="rgba(251,191,36,0)" />
                        </radialGradient>
                        <filter id="glow">
                          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                          <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>

                      {/* Draw connectors based on card positions */}
                      {CARD_CONNECTORS.map(([from, to], idx) => {
                        const start = statNodeMap[from];
                        const end = statNodeMap[to];
                        if (!start || !end) return null;
                        return (
                          <line
                            key={idx}
                            x1={`${start.x}%`}
                            y1={`${start.y}%`}
                            x2={`${end.x}%`}
                            y2={`${end.y}%`}
                            stroke="url(#lineGradient2)"
                            strokeWidth="1"
                            opacity={start.isHero || end.isHero ? 0.65 : 0.35}
                            strokeLinecap="round"
                          />
                        );
                      })}

                      {/* Accent arc between outer nodes */}
                      <path
                        d="M 20 125 Q 50 90 80 110"
                        fill="none"
                        stroke="url(#lineGradient1)"
                        strokeWidth="1"
                        opacity="0.35"
                      />

                      {/* Star nodes at intersections */}
                      {statNodes.map((node) => (
                        <g key={node.id}>
                          <circle cx={`${node.x}%`} cy={`${node.y}%`} r="3.5" fill="url(#nodeGlow)" />
                          <circle cx={`${node.x}%`} cy={`${node.y}%`} r={node.isHero ? 4 : 3} fill="rgba(251,191,36,0.55)" filter="url(#glow)" />
                        </g>
                      ))}

                      {/* Smaller accent stars along the network */}
                      {[{ x: 34, y: 40 }, { x: 66, y: 40 }, { x: 34, y: 56 }, { x: 66, y: 56 }, { x: 50, y: 62 }].map((star, i) => (
                        <circle key={i} cx={`${star.x}%`} cy={`${star.y}%`} r="1.5" fill="rgba(251,191,36,0.28)" />
                      ))}
                    </svg>

                    {/* Positioned tarot cards */}
                    {statNodes.map((stat, _index) => {
                      const isHero = stat.id === 'entries';
                      // Check if this card should show the notebook illustration
                      const showNotebookIllustration = stat.id === 'context';
                      const icon = (() => {
                        if (stat.id === 'entries') return <Sparkle className="h-5 w-5" weight="fill" aria-hidden />;
                        if (stat.id === 'reversal') return <ChartLine className="h-5 w-5" aria-hidden />;
                        if (stat.id === 'context') return <BookOpen className="h-5 w-5" aria-hidden />;
                        return <ClockCounterClockwise className="h-5 w-5" aria-hidden />;
                      })();
                      const rotation = { entries: 0, context: -3, reversal: 2.5, 'last-entry': -1.5 }[stat.id] || 0;
                      const pos = statNodeMap[stat.id]
                        ? { left: `${statNodeMap[stat.id].x}%`, top: `${statNodeMap[stat.id].y}%` }
                        : { left: '50%', top: '50%' };

                      return (
                        <div
                          key={stat.id}
                          className="group absolute transition-transform duration-500 hover:z-10"
                          style={{
                            left: pos.left,
                            top: pos.top,
                            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                            width: isHero ? '160px' : '140px'
                          }}
                        >
                          {/* Card glow */}
                          <div
                            className={`pointer-events-none absolute -inset-3 rounded-xl blur-2xl transition-opacity duration-500 ${
                              isHero ? 'bg-amber-400/20 opacity-100' : 'bg-amber-400/10 opacity-0 group-hover:opacity-100'
                            }`}
                            aria-hidden="true"
                          />

                          {/* Tarot card */}
                          <div
                            className={`relative overflow-hidden rounded-lg transition-all duration-300 group-hover:-translate-y-1 ${
                              isHero
                                ? 'ring-2 ring-amber-400/40 shadow-[0_0_40px_-10px_rgba(251,191,36,0.4)]'
                                : 'ring-1 ring-amber-300/20 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.8)] group-hover:ring-amber-300/30 group-hover:shadow-[0_12px_40px_-8px_rgba(251,191,36,0.2)]'
                            }`}
                            style={{ aspectRatio: '2.5/4' }}
                          >
                            {/* Outer decorative border area with intricate pattern */}
                            <div className={`absolute inset-0 ${
                              isHero
                                ? 'bg-gradient-to-b from-amber-800/50 via-amber-900/40 to-amber-800/50'
                                : 'bg-gradient-to-b from-amber-900/30 via-amber-950/25 to-amber-900/30'
                            }`}>
                              {/* Ornate card-back pattern */}
                              <svg className="absolute inset-0 w-full h-full" aria-hidden="true">
                                <defs>
                                  <pattern id={`cardPattern-${stat.id}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                                    <path d="M10 0L20 10L10 20L0 10Z" fill="none" stroke="currentColor" strokeWidth="0.5" className={isHero ? 'text-amber-400/20' : 'text-amber-300/10'} />
                                    <circle cx="10" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="0.5" className={isHero ? 'text-amber-400/15' : 'text-amber-300/8'} />
                                    <circle cx="10" cy="10" r="1" fill="currentColor" className={isHero ? 'text-amber-400/10' : 'text-amber-300/5'} />
                                  </pattern>
                                </defs>
                                <rect width="100%" height="100%" fill={`url(#cardPattern-${stat.id})`} />
                              </svg>
                            </div>

                            {/* Inner card frame */}
                            <div className={`absolute inset-2 rounded overflow-hidden ${
                              isHero
                                ? 'bg-gradient-to-b from-[#12101c] via-[#0a0912] to-[#12101c]'
                                : 'bg-gradient-to-b from-[#0e0c16] via-[#08070d] to-[#0e0c16]'
                            }`}>
                              {/* Inner border */}
                              <div className={`absolute inset-0 rounded border ${
                                isHero ? 'border-amber-400/30' : 'border-amber-200/15 group-hover:border-amber-300/20'
                              } transition-colors`} />

                              {/* Decorative inner frame line */}
                              <div className={`absolute inset-1 rounded border ${
                                isHero ? 'border-amber-500/15' : 'border-amber-200/5'
                              }`} />

                              {/* Corner ornaments - more elaborate */}
                              {[
                                { pos: 'top-0 left-0', rotate: '0', anchor: 'M0 12L0 0L12 0' },
                                { pos: 'top-0 right-0', rotate: '90', anchor: 'M0 12L0 0L12 0' },
                                { pos: 'bottom-0 right-0', rotate: '180', anchor: 'M0 12L0 0L12 0' },
                                { pos: 'bottom-0 left-0', rotate: '270', anchor: 'M0 12L0 0L12 0' }
                              ].map((corner, i) => (
                                <svg
                                  key={i}
                                  className={`absolute ${corner.pos} w-5 h-5 ${isHero ? 'text-amber-400/50' : 'text-amber-300/25'}`}
                                  viewBox="0 0 20 20"
                                  style={{ transform: `rotate(${corner.rotate}deg)` }}
                                  aria-hidden="true"
                                >
                                  <path d={corner.anchor} fill="none" stroke="currentColor" strokeWidth="1.5" />
                                  <circle cx="3" cy="3" r="1.5" fill="currentColor" />
                                  <path d="M6 0L6 6L0 6" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.6" />
                                </svg>
                              ))}

                              {/* Center star/sun symbol for hero */}
                              {isHero && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]" aria-hidden="true">
                                  <svg className="w-32 h-32 text-amber-300" viewBox="0 0 100 100">
                                    {[...Array(8)].map((_, i) => (
                                      <line
                                        key={i}
                                        x1="50"
                                        y1="50"
                                        x2={50 + 45 * Math.cos((i * Math.PI) / 4)}
                                        y2={50 + 45 * Math.sin((i * Math.PI) / 4)}
                                        stroke="currentColor"
                                        strokeWidth="1"
                                      />
                                    ))}
                                    <circle cx="50" cy="50" r="15" fill="none" stroke="currentColor" strokeWidth="1" />
                                    <circle cx="50" cy="50" r="8" fill="none" stroke="currentColor" strokeWidth="1" />
                                  </svg>
                                </div>
                              )}

                              {/* Card content */}
                              <div className="relative h-full flex flex-col items-center justify-center p-3 text-center">
                                {showNotebookIllustration ? (
                                  <>
                                    {/* Notebook illustration - like a tarot card image */}
                                    <div className="relative mb-2 w-full flex-1 min-h-[80px] max-h-[100px]">
                                      <svg className="w-full h-full" viewBox="0 0 80 100" aria-hidden="true">
                                        {/* Open notebook */}
                                        <g className="text-amber-200/40">
                                          {/* Left page */}
                                          <path d="M8 15 L38 12 L38 85 L8 88 Z" fill="rgba(251,191,36,0.08)" stroke="currentColor" strokeWidth="0.5" />
                                          {/* Right page */}
                                          <path d="M42 12 L72 15 L72 88 L42 85 Z" fill="rgba(251,191,36,0.06)" stroke="currentColor" strokeWidth="0.5" />
                                          {/* Spine */}
                                          <path d="M38 12 L40 10 L42 12 L42 85 L40 87 L38 85 Z" fill="rgba(251,191,36,0.12)" stroke="currentColor" strokeWidth="0.5" />
                                          {/* Page lines - left */}
                                          <line x1="12" y1="25" x2="34" y2="23" stroke="currentColor" strokeWidth="0.3" opacity="0.5" />
                                          <line x1="12" y1="32" x2="34" y2="30" stroke="currentColor" strokeWidth="0.3" opacity="0.5" />
                                          <line x1="12" y1="39" x2="34" y2="37" stroke="currentColor" strokeWidth="0.3" opacity="0.5" />
                                          <line x1="12" y1="46" x2="34" y2="44" stroke="currentColor" strokeWidth="0.3" opacity="0.5" />
                                          <line x1="12" y1="53" x2="34" y2="51" stroke="currentColor" strokeWidth="0.3" opacity="0.5" />
                                          {/* Page lines - right */}
                                          <line x1="46" y1="23" x2="68" y2="25" stroke="currentColor" strokeWidth="0.3" opacity="0.5" />
                                          <line x1="46" y1="30" x2="68" y2="32" stroke="currentColor" strokeWidth="0.3" opacity="0.5" />
                                          <line x1="46" y1="37" x2="68" y2="39" stroke="currentColor" strokeWidth="0.3" opacity="0.5" />
                                          {/* Quill pen */}
                                          <g transform="translate(50, 45) rotate(25)">
                                            <path d="M0 0 L2 -25 L4 -28 L6 -25 L8 0 L4 2 Z" fill="rgba(251,191,36,0.15)" stroke="currentColor" strokeWidth="0.4" />
                                            <path d="M3 -28 L4 -35 L5 -28" fill="none" stroke="currentColor" strokeWidth="0.3" />
                                            <ellipse cx="4" cy="2" rx="2" ry="1" fill="rgba(251,191,36,0.2)" />
                                          </g>
                                          {/* Written text squiggles on right page */}
                                          <path d="M47 44 Q50 43 53 44 Q56 45 59 44" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.6" />
                                          <path d="M47 51 Q49 50 51 51 Q53 52 55 51" fill="none" stroke="currentColor" strokeWidth="0.4" opacity="0.6" />
                                          {/* Small star doodle */}
                                          <path d="M30 60 L31 64 L35 64 L32 67 L33 71 L30 68 L27 71 L28 67 L25 64 L29 64 Z" fill="rgba(251,191,36,0.15)" stroke="currentColor" strokeWidth="0.3" />
                                          {/* Moon doodle */}
                                          <path d="M55 62 A8 8 0 1 1 55 78 A6 6 0 1 0 55 62" fill="rgba(251,191,36,0.1)" stroke="currentColor" strokeWidth="0.3" />
                                        </g>
                                      </svg>
                                    </div>
                                    {/* Label at bottom like tarot card name */}
                                    <div className="border-t border-amber-200/10 pt-1.5 w-full">
                                      <p className="text-[8px] uppercase tracking-[0.2em] text-amber-100/30 mb-0.5">{stat.label}</p>
                                      <p className="font-serif text-lg text-amber-50/85 leading-tight">{stat.value}</p>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    {/* Icon medallion */}
                                    <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                                      isHero
                                        ? 'bg-gradient-to-br from-amber-400/25 to-amber-600/15 text-amber-300 ring-2 ring-amber-400/30 shadow-[0_0_20px_-4px_rgba(251,191,36,0.5)]'
                                        : 'bg-gradient-to-br from-amber-200/15 to-amber-400/10 text-amber-200/70 ring-1 ring-amber-200/20 group-hover:text-amber-200 group-hover:ring-amber-300/25'
                                    }`}>
                                      {icon}
                                    </div>

                                    {/* Label */}
                                    <p className={`text-[9px] uppercase tracking-[0.2em] mb-1.5 ${
                                      isHero ? 'text-amber-300/60' : 'text-amber-100/35'
                                    }`}>
                                      {stat.label}
                                    </p>

                                    {/* Value */}
                                    <p className={`font-serif leading-tight ${
                                      isHero
                                        ? 'text-3xl text-amber-100 drop-shadow-[0_0_16px_rgba(251,191,36,0.4)]'
                                        : 'text-2xl text-amber-50/85'
                                    }`}>
                                      {stat.value}
                                    </p>

                                    {/* Hint */}
                                    {stat.hint && (
                                      <p className={`mt-1.5 text-[10px] leading-snug max-w-[100px] ${
                                        isHero ? 'text-amber-200/45' : 'text-amber-100/25'
                                      }`}>
                                        {stat.hint}
                                      </p>
                                    )}

                                    {/* Bottom decorative element */}
                                    <div className={`mt-2 w-6 h-px ${
                                      isHero
                                        ? 'bg-gradient-to-r from-transparent via-amber-400/50 to-transparent'
                                        : 'bg-gradient-to-r from-transparent via-amber-200/20 to-transparent'
                                    }`} />
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Top edge shine */}
                            <div className={`pointer-events-none absolute inset-x-0 top-0 h-px ${
                              isHero
                                ? 'bg-gradient-to-r from-transparent via-amber-300/50 to-transparent'
                                : 'bg-gradient-to-r from-transparent via-amber-200/20 to-transparent'
                            }`} aria-hidden="true" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          )}

          {mobileRailContent}

          {loading ? (
            <div className="space-y-4 py-6" aria-live="polite">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-2xl border border-amber-300/15 bg-amber-200/5 ring-1 ring-amber-300/10 p-4 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.7)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="h-4 w-28 rounded-full bg-white/10" />
                    <div className="h-9 w-9 rounded-full bg-white/10" />
                  </div>
                  <div className="mt-3 h-3 w-3/4 rounded-full bg-white/10" />
                  <div className="mt-2 h-3 w-5/6 rounded-full bg-white/10" />
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="h-16 rounded-xl bg-white/5" />
                    <div className="h-16 rounded-xl bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={hasEntries && hasRailContent ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-8' : ''}>
              <div className="space-y-8">
                <section id="today" className={`${AMBER_SHELL_CLASS} p-5`}>
                  <AmberStarfield />
                  <div className="relative z-10">
                    <div className="mb-4">
                      <p className="journal-eyebrow text-amber-100/70">Today</p>
                      <h2 className="text-xl font-serif text-amber-50">Keep today&rsquo;s focus handy</h2>
                    </div>
                    <SavedIntentionsList />
                  </div>
                </section>

                {hasEntries ? (
                  <section id="history" className={`${AMBER_SHELL_CLASS} p-5 space-y-5`}>
                    <AmberStarfield />
                    <div className="relative z-10 space-y-5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-serif text-amber-50">Journal history</h2>
                          <span className="inline-flex items-center rounded-full border border-amber-200/20 bg-amber-200/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/75">
                            History
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="hidden sm:flex items-center gap-2 text-xs text-amber-100/60 cursor-pointer select-none min-h-[44px]">
                            <input
                              type="checkbox"
                              className="h-5 w-5 rounded border-amber-200/30 bg-transparent text-amber-300 focus:ring-amber-200/40 focus:ring-offset-0"
                              checked={compactList}
                              onChange={(event) => setCompactList(event.target.checked)}
                            />
                            Compact view
                          </label>
                          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-[11px] text-amber-100/70">
                            Showing {visibleEntries.length} of {filteredEntries.length}
                          </span>
                        </div>
                      </div>

                      <div
                        id="journal-history-filters"
                        ref={registerHistoryFiltersEl}
                        className="scroll-mt-24"
                      >
                        <JournalFilters
                          filters={filters}
                          onChange={setFilters}
                          contexts={CONTEXT_FILTERS}
                          spreads={SPREAD_FILTERS}
                          decks={DECK_FILTERS}
                          variant={isMobileLayout ? 'compact' : 'full'}
                        />
                      </div>

                      {filteredEntries.length === 0 ? (
                        <div className="relative overflow-hidden rounded-2xl border border-amber-300/15 bg-amber-200/5 p-8 text-center text-sm text-amber-100/75 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.8)]">
                          <NoFiltersIllustration className="mb-4" />
                          <p className="journal-prose text-lg text-amber-50">No entries match your filters.</p>
                          <p className="journal-prose mt-2 text-amber-100/70">Try adjusting the filters or reset to see the full journal.</p>
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
                                className={`${OUTLINE_BUTTON_CLASS} min-h-[44px] px-4 py-2`}
                              >
                                Load {Math.min(VISIBLE_ENTRY_BATCH, filteredEntries.length - visibleEntries.length)} more
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </section>
                ) : (
                  <div className={`${AMBER_SHELL_CLASS} animate-fade-in space-y-6 rounded-3xl p-8 text-center text-amber-50`}>
                    <AmberStarfield />
                    <div className="relative z-10 space-y-6">
                      <EmptyJournalIllustration className="mx-auto mb-2 w-40" />
                      <div>
                        <h2 className="text-2xl font-serif text-amber-50">Start your tarot journal</h2>
                        <p className="journal-prose mt-1 text-sm text-amber-100/70 sm:text-base">
                          Track patterns across readings, revisit past insights, and watch your understanding deepen over time.
                        </p>
                      </div>
                      <div className="grid gap-3 text-left text-sm text-amber-100/75 sm:grid-cols-3">
                        <div className="flex items-start gap-2">
                          <Sparkle className="mt-0.5 h-4 w-4 text-amber-200" />
                          <div className="journal-prose">
                            <p className="text-amber-50 font-semibold">Spot recurring themes</p>
                            <p>Surface repeaters and spreads that resonate most.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <ChartLine className="mt-0.5 h-4 w-4 text-amber-200" />
                          <div className="journal-prose">
                            <p className="text-amber-50 font-semibold">Measure your growth</p>
                            <p>See how questions evolve and which cards guide you.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <BookOpen className="mt-0.5 h-4 w-4 text-amber-200" />
                          <div className="journal-prose">
                            <p className="text-amber-50 font-semibold">Capture reflections</p>
                            <p>Keep notes beside each position to revisit later.</p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-amber-200/20 bg-amber-200/5 p-4 text-left shadow-[0_14px_40px_-24px_rgba(0,0,0,0.75)]">
                        <p className="text-[0.78rem] uppercase tracking-[0.12em] text-amber-100/70 mb-1">Example entry</p>
                        <div className="journal-prose flex flex-col gap-1 text-sm text-amber-100/80">
                          <p className="text-amber-50 font-semibold">Three-Card Story · Daily check-in</p>
                          <p>Question: &ldquo;What pattern is emerging for me this week?&rdquo;</p>
                          <p>Pull: The Star (upright), Six of Cups, Two of Wands</p>
                          <p className="italic text-amber-100/65">Reflection: Hope is back. Remember the plan from Tuesday and take the next step.</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={handleStartReading}
                          className={`${OUTLINE_BUTTON_CLASS} px-5 py-2.5 text-sm`}
                        >
                          Start a reading
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate('/', { state: { focusSpread: true, initialQuestion: 'What pattern is emerging for me this week?' } })}
                          className="inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-amber-200/5 px-5 py-2.5 text-sm font-semibold text-amber-50 shadow-[0_12px_30px_-18px_rgba(251,191,36,0.35)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40"
                        >
                          Try a guided draw
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {hasEntries && hasRailContent && desktopRailContent && (
                <aside className="hidden lg:block lg:w-full">
                  <div className="lg:sticky lg:top-6 lg:w-full">
                    {desktopRailContent}
                  </div>
                </aside>
              )}
            </div>
          )}
        </main>

        {hasEntries && hasScrolled && historyFiltersEl && !historyFiltersInView && (
          <button
            type="button"
            onClick={scrollToHistoryFilters}
            className="fixed z-40 right-4 sm:right-6 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-amber-300/25 bg-[#0b0c1d]/90 px-4 py-3 text-sm font-semibold text-amber-50 shadow-[0_22px_55px_-28px_rgba(0,0,0,0.85)] backdrop-blur transition hover:-translate-y-0.5 hover:border-amber-300/40 hover:bg-[#0b0c1d]/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50"
            style={{ bottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
            aria-label="Jump to journal filters"
          >
            <Sparkle className="h-4 w-4 text-amber-200" weight="fill" aria-hidden="true" />
            Filters
          </button>
        )}
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
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}
