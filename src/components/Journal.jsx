import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CaretLeft, Warning } from '@phosphor-icons/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GlobalNav } from './GlobalNav';
import { ConfirmModal } from './ConfirmModal';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useJournal } from '../hooks/useJournal';
import { JournalFilters } from './JournalFilters.jsx';
import { InsightsErrorBoundary } from './InsightsErrorBoundary.jsx';
import { JournalEntryCard } from './JournalEntryCard.jsx';
import { SavedIntentionsModal } from './SavedIntentionsModal.jsx';
import { OUTLINE_BUTTON_CLASS } from '../styles/buttonClasses';
import { ReadingJourney } from './ReadingJourney';
import { NoFiltersIllustration } from './illustrations/NoFiltersIllustration';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useToast } from '../contexts/ToastContext.jsx';
import AuthModal from './AuthModal';
import { getTimestamp } from '../../shared/journal/utils.js';
import { useJournalFilters } from '../hooks/useJournalFilters';
import { useJournalAnalytics } from '../hooks/useJournalAnalytics';
import { useJournalSharing } from '../hooks/useJournalSharing';
import { AmberStarfield } from './AmberStarfield';
import { JournalSummaryBand } from './journal/JournalSummaryBand';
import { JournalEmptyState } from './journal/JournalEmptyState';
import { JournalFloatingControls } from './journal/JournalFloatingControls';
import { JournalStatusBanner } from './journal/JournalStatusBanner';
import {
  CONTEXT_FILTERS,
  SPREAD_FILTERS,
  DECK_FILTERS,
  VISIBLE_ENTRY_BATCH,
  MOBILE_LAYOUT_MAX,
  AMBER_SHELL_CLASS,
  AMBER_CARD_CLASS,
  AMBER_SHELL_MOBILE_CLASS,
  AMBER_CARD_MOBILE_CLASS
} from '../lib/journal/constants';
import { getMonthHeader } from '../lib/journal/utils';
import { JournalCardsAddIcon, JournalRefreshIcon, JournalSearchIcon, JournalSlidersIcon } from './JournalIcons';



export default function Journal() {
  // Context hooks
  const { isAuthenticated, user } = useAuth();
  const { canUseCloudJournal } = useSubscription();
  const { shouldShowAccountNudge, dismissAccountNudge, personalization } = usePreferences();
  const { publish: showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const fromReading = Boolean(location?.state?.fromReading);

  // Journal data hook
  const {
    entries,
    loading,
    loadingMore,
    deleteEntry,
    migrateToCloud,
    importLegacyLocalEntries,
    loadMoreEntries,
    fetchEntryById,
    hasMoreEntries: hasMoreServerEntries,
    totalEntries,
    hasTotalEntries,
    error: journalError,
    lastSyncAt,
    syncSource,
    reload: reloadJournal
  } = useJournal();

  // Layout detection
  const isMobileLayout = useSmallScreen(MOBILE_LAYOUT_MAX);
  const isSmallSummary = useSmallScreen(640);
  const shellClass = isMobileLayout ? AMBER_SHELL_MOBILE_CLASS : AMBER_SHELL_CLASS;
  const cardClass = isMobileLayout ? AMBER_CARD_MOBILE_CLASS : AMBER_CARD_CLASS;

  // Custom hooks - filters, analytics, sharing
  const {
    filters,
    setFilters,
    filterSignature,
    filteredEntries,
    filtersActive,
    activeFilterChips,
    handleResetFilters,
    handleRemoveFilter
  } = useJournalFilters(entries);

  const {
    analyticsScope,
    setAnalyticsScope: handleScopeSelect,
    customScope,
    setCustomScope: handleCustomScopeChange,
    scopeError,
    scopeWindow,
    scopeLabel,
    scopeEntryCount,
    heroEntry,
    heroCards,
    heroDateLabel,
    expandedCardIndex,
    setExpandedCardIndex,
    summaryCardData,
    statNodes,
    statNodeMap,
    scopedStatsEntries,
    journeyFiltersActive
  } = useJournalAnalytics(entries, filteredEntries, filters, { isSmallSummary });

  const {
    shareLinks,
    shareLoading,
    shareError,
    createShareLink,
    deleteShareLink
  } = useJournalSharing(isAuthenticated);

  // Local UI state
  const [migrating, setMigrating] = useState(false);
  const [importingLegacy, setImportingLegacy] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ isOpen: false, entryId: null });
  const [compactList, setCompactList] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSavedIntentionsModal, setShowSavedIntentionsModal] = useState(false);
  const [historyFiltersEl, setHistoryFiltersEl] = useState(null);
  const [historyFiltersInView, setHistoryFiltersInView] = useState(true);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [pendingHighlightEntryId, setPendingHighlightEntryId] = useState(null);
  const [highlightStatus, setHighlightStatus] = useState(null);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_ENTRY_BATCH);
  const [monthJump, setMonthJump] = useState('');
  const [journeyReady, setJourneyReady] = useState(false);
  const summaryRef = useRef(null);
  const searchInputRef = useRef(null);
  const highlightRequestRef = useRef(0);
  const filteredEntriesRef = useRef(filteredEntries);
  const hasMoreServerEntriesRef = useRef(hasMoreServerEntries);
  const [summaryInView, setSummaryInView] = useState(!isSmallSummary);

  // Derived values
  const hasEntries = entries.length > 0;
  const visibleEntries = useMemo(() => filteredEntries.slice(0, visibleCount), [filteredEntries, visibleCount]);
  const localRemaining = Math.max(filteredEntries.length - visibleEntries.length, 0);
  const hasLocalMoreEntries = filteredEntries.length > visibleCount;
  const hasMoreEntries = hasLocalMoreEntries || hasMoreServerEntries;
  const showSummaryBand = !loading && hasEntries;
  const summaryDataSource = syncSource === 'api' || syncSource === 'cache' ? 'server' : 'client';
  const totalEntryCount = hasTotalEntries ? totalEntries : entries.length;
  const searchCoverageLabel = filtersActive
    ? (hasTotalEntries
        ? `Searching latest ${entries.length} of ${totalEntryCount} entries`
        : `Searching latest ${entries.length} entries`)
    : (hasTotalEntries && totalEntryCount > entries.length
        ? `Loaded ${entries.length} of ${totalEntryCount} entries`
        : null);
  const showInlineSearchOlder = hasMoreServerEntries && filtersActive;
  const inlineSearchOlderLabel = hasLocalMoreEntries
    ? 'Show more results'
    : (filters.query.trim() ? 'Search older entries' : 'Load older entries');
  const highlightBannerState = pendingHighlightEntryId ? (highlightStatus || 'loading') : null;
  const showHighlightBanner = Boolean(pendingHighlightEntryId) && highlightBannerState !== 'found';
  const searchQuery = filters.query.trim();
  const searchSummaryTitle = searchQuery
    ? `Searching "${searchQuery}"`
    : (filtersActive ? 'Filtered readings' : 'All readings');
  const searchSummaryCount = filtersActive
    ? `${filteredEntries.length} matching entries`
    : `${filteredEntries.length} entries`;
  const showStickySummary = hasEntries && !historyFiltersInView;

  // Allow other pages (e.g. Card Collection) to deep-link into the journal.
  // Supported state:
  //  - prefillQuery: string -> sets the journal search query
  //  - highlightEntryId: string/number -> scrolls to and briefly highlights a specific entry
  useEffect(() => {
    const state = location?.state || {};
    const prefillQuery = typeof state?.prefillQuery === 'string' ? state.prefillQuery : '';
    const highlightEntryId = state?.highlightEntryId ?? null;

    if (!prefillQuery && !highlightEntryId) return;

    if (prefillQuery) {
      setFilters((prev) => ({
        ...prev,
        query: prefillQuery,
      }));
    }

    if (highlightEntryId) {
      setPendingHighlightEntryId(highlightEntryId);
    }

    // Clear the navigation state so back/forward doesn't keep re-applying.
    navigate(`${location.pathname}${location.search || ''}${location.hash || ''}`, { replace: true, state: null });
  }, [location.key, location.pathname, location.search, location.hash, location.state, navigate, setFilters]);

  const registerHistoryFiltersEl = useCallback((node) => {
    setHistoryFiltersEl(node);
  }, []);

  const registerSearchInput = useCallback((node) => {
    searchInputRef.current = node;
  }, []);

  const handleStartReading = (suggestion) => {
    navigate('/', {
      state: {
        focusSpread: true,
        suggestedSpread: suggestion?.spread,
        suggestedQuestion: suggestion?.question || suggestion?.text
      }
    });
  };

  const scrollToHistoryFilters = useCallback(() => {
    const target = historyFiltersEl
      || document.getElementById('journal-history-filters')
      || document.getElementById('history');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (typeof window === 'undefined') return;
    window.setTimeout(() => {
      const input = searchInputRef.current;
      if (!input) return;
      input.focus();
      if (typeof input.select === 'function') {
        input.select();
      }
    }, 240);
  }, [historyFiltersEl]);

  const handleMonthJump = useCallback((event) => {
    const value = event.target.value;
    setMonthJump(value);
    if (!value || typeof document === 'undefined') return;
    const anchor = document.getElementById(`month-${value}`);
    if (anchor) {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

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

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(VISIBLE_ENTRY_BATCH);
  }, [filterSignature]);

  useEffect(() => {
    setSummaryInView(!isSmallSummary);
  }, [isSmallSummary]);

  useEffect(() => {
    filteredEntriesRef.current = filteredEntries;
  }, [filteredEntries]);

  useEffect(() => {
    hasMoreServerEntriesRef.current = hasMoreServerEntries;
  }, [hasMoreServerEntries]);

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

  const resolveHighlightEntry = useCallback(async (entryId) => {
    if (!entryId) return;

    const targetId = String(entryId);
    const requestId = highlightRequestRef.current + 1;
    highlightRequestRef.current = requestId;

    const isEntryLoaded = () => (
      filteredEntriesRef.current.some((entry) => String(entry?.id || '') === targetId)
    );

    const setStatus = (status) => {
      if (highlightRequestRef.current !== requestId) return;
      setHighlightStatus(status);
    };

    if (isEntryLoaded()) {
      setStatus('found');
      return;
    }

    setStatus('loading');

    let encounteredError = false;

    const MAX_LOAD_ATTEMPTS = 3;
    for (let attempt = 0; attempt < MAX_LOAD_ATTEMPTS; attempt += 1) {
      if (!hasMoreServerEntriesRef.current) break;

      const result = await loadMoreEntries({ prefetch: false });
      const appended = result?.appended || 0;
      if (!result?.success) {
        if (result?.error) {
          encounteredError = true;
        }
        break;
      }
      if (appended <= 0) break;

      await new Promise((resolve) => setTimeout(resolve, 50));
      if (isEntryLoaded()) {
        setStatus('found');
        return;
      }
    }

    if (isEntryLoaded()) {
      setStatus('found');
      return;
    }

    if (isAuthenticated && canUseCloudJournal) {
      const fetched = await fetchEntryById(targetId);
      if (fetched?.status === 'found' || isEntryLoaded()) {
        setStatus('found');
        return;
      }
      if (fetched?.status === 'error') {
        encounteredError = true;
      }
    }

    setStatus(encounteredError ? 'error' : 'not-found');
  }, [canUseCloudJournal, fetchEntryById, isAuthenticated, loadMoreEntries]);

  useEffect(() => {
    if (!pendingHighlightEntryId) return undefined;
    void resolveHighlightEntry(pendingHighlightEntryId);

    return () => {
      highlightRequestRef.current += 1;
    };
  }, [pendingHighlightEntryId, resolveHighlightEntry]);

  // If an entry is requested, ensure it's rendered (increase visibleCount) and scroll it into view.
  useEffect(() => {
    if (!pendingHighlightEntryId) return undefined;
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const targetId = String(pendingHighlightEntryId);

    const index = filteredEntries.findIndex((entry) => String(entry?.id || '') === targetId);
    if (index >= 0 && index >= visibleCount) {
      setVisibleCount((prev) => Math.max(prev, Math.min(filteredEntries.length, index + 1)));
    }

    if (index < 0) return undefined;

    setHighlightStatus('found');

    // Next tick: scroll to the entry container.
    const id = `journal-entry-${targetId}`;
    const handle = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);

    const clearHandle = window.setTimeout(() => {
      setPendingHighlightEntryId(null);
      setHighlightStatus(null);
    }, 3200);

    return () => {
      window.clearTimeout(handle);
      window.clearTimeout(clearHandle);
    };
  }, [pendingHighlightEntryId, filteredEntries, visibleCount]);

  useEffect(() => {
    if (!hasEntries) return undefined;
    const activate = () => setJourneyReady(true);
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(activate, { timeout: 600 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timer = typeof window !== 'undefined' ? window.setTimeout(activate, 250) : null;
    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [hasEntries]);

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

  const handleImportLegacy = async () => {
    setImportingLegacy(true);

    const result = await importLegacyLocalEntries({ removeLegacy: true });

    if (result.success) {
      showToast({
        type: 'success',
        title: 'Imported local entries',
        description: `Imported ${result.imported} entries${result.skipped ? `, skipped ${result.skipped}` : ''}.`
      });
    } else {
      showToast({
        type: 'error',
        title: 'Import failed',
        description: result.error || 'We could not import your local entries.'
      });
    }

    setImportingLegacy(false);
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

  const handleLoadMoreEntries = async () => {
    if (loadingMore) return;
    if (filteredEntries.length > visibleCount) {
      setVisibleCount((prev) => Math.min(filteredEntries.length, prev + VISIBLE_ENTRY_BATCH));
      return;
    }
    if (hasMoreServerEntries) {
      const result = await loadMoreEntries();
      const appended = result?.appended || 0;
      if (appended > 0) {
        setVisibleCount((prev) => prev + Math.min(VISIBLE_ENTRY_BATCH, appended));
      }
    }
  };

  const handleLoadOlderForHighlight = async () => {
    if (!pendingHighlightEntryId) return;
    await resolveHighlightEntry(pendingHighlightEntryId);
  };

  // Check if we have localStorage entries that can be migrated/imported.
  // - legacy: tarot_journal (anonymous)
  // - user-scoped: tarot_journal_<userId>
  const getLocalStorageEntryPresence = () => {
    if (typeof localStorage === 'undefined') return false;
    const state = {
      hasLegacy: false,
      hasScoped: false,
    };

    const legacyKey = 'tarot_journal';
    const scopedKey = user?.id ? `tarot_journal_${user.id}` : null;

    const keysToCheck = [legacyKey, scopedKey].filter(Boolean);
    for (const key of keysToCheck) {
      const stored = localStorage.getItem(key);
      if (!stored) continue;
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (key === legacyKey) state.hasLegacy = true;
          if (scopedKey && key === scopedKey) state.hasScoped = true;
        }
      } catch {
        // Ignore malformed cache and keep scanning other keys.
      }
    }

    return state;
  };

  // Compute each render so it updates after import/migration without needing
  // brittle dependency tracking.
  const localStoragePresence = getLocalStorageEntryPresence();

  const desktopRailContent = (journeyReady && !loading && hasEntries && !isMobileLayout) ? (
    <div className="space-y-6 lg:space-y-8 w-full">
      <div className="w-full">
        <InsightsErrorBoundary>
          <ReadingJourney
            entries={entries}
            filteredEntries={filteredEntries}
            filtersActive={journeyFiltersActive}
            filtersApplied={filtersActive}
            scopeEntries={scopedStatsEntries}
            analyticsScope={analyticsScope}
            isAuthenticated={isAuthenticated}
            userId={user?.id}
            focusAreas={personalization?.focusAreas}
            locale={locale}
            timezone={timezone}
            variant="sidebar"
            onCreateShareLink={isAuthenticated ? createShareLink : null}
            onStartReading={handleStartReading}
            showStartReadingCta={false}
            seasonWindow={scopeWindow}
            scopeLabel={scopeLabel}
          />
        </InsightsErrorBoundary>
      </div>
    </div>
  ) : null;
  const hasRailContent = !loading && hasEntries && journeyReady;
  const entryStackSpacingClass = compactList ? 'space-y-3.5' : 'space-y-5';
  const monthSections = useMemo(() => {
    const sections = [];
    let current = null;
    visibleEntries.forEach((entry) => {
      const timestamp = getTimestamp(entry);
      let monthKey = 'undated';
      if (timestamp) {
        const date = new Date(timestamp);
        if (!Number.isNaN(date.getTime())) {
          monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
      }
      const monthLabel = getMonthHeader(timestamp);
      if (!current || current.key !== monthKey) {
        if (current) {
          current.count = current.entries.length;
          sections.push(current);
        }
        current = {
          key: monthKey,
          label: monthLabel,
          entries: []
        };
      }
      current.entries.push(entry);
    });
    if (current) {
      current.count = current.entries.length;
      sections.push(current);
    }
    return sections.map((section) => ({
      ...section,
      anchorId: `month-${section.key}`
    }));
  }, [visibleEntries]);
  const monthJumpValue = monthSections.some((section) => section.key === monthJump) ? monthJump : '';

  const renderedHistoryEntries = monthSections.map((section) => (
    <div key={section.key} id={section.anchorId} className="space-y-4 scroll-mt-24">
      <div className="sticky top-24 z-10">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200/20 bg-[#0b0c1d]/90 px-3 py-2 backdrop-blur">
          <span className="text-[11px] uppercase tracking-[0.3em] text-amber-100/70">{section.label}</span>
          <span className="inline-flex items-center rounded-full border border-amber-200/20 bg-amber-200/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100/70">
            {section.count} entries
          </span>
        </div>
      </div>
      <div className={entryStackSpacingClass}>
        {section.entries.map((entry, index) => {
          const timestamp = getTimestamp(entry);
          const key = entry.id || `${timestamp || 'entry'}-${index}`;
          const isHighlighted = pendingHighlightEntryId && String(entry?.id || '') === String(pendingHighlightEntryId);
          const anchorId = entry?.id ? `journal-entry-${String(entry.id)}` : undefined;
          return (
            <div
              id={anchorId}
              key={key}
              className={`space-y-2 ${isHighlighted ? 'rounded-2xl ring-2 ring-amber-300/35 bg-amber-300/[0.03] p-2' : ''}`}
            >
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
        })}
      </div>
    </div>
  ));

  const mobileRailContent = (journeyReady && !loading && hasEntries && isMobileLayout) ? (
    <section className="mb-6 space-y-3 lg:hidden" aria-label="Journal insights and journey">
      {/* Filters moved to Journal history section to avoid duplication */}
      <InsightsErrorBoundary>
          <ReadingJourney
            entries={entries}
            filteredEntries={filteredEntries}
            filtersActive={journeyFiltersActive}
            filtersApplied={filtersActive}
            scopeEntries={scopedStatsEntries}
            analyticsScope={analyticsScope}
            isAuthenticated={isAuthenticated}
            userId={user?.id}
            focusAreas={personalization?.focusAreas}
            locale={locale}
          timezone={timezone}
          variant="mobile"
          onCreateShareLink={isAuthenticated ? createShareLink : null}
          onStartReading={handleStartReading}
          showStartReadingCta={false}
          seasonWindow={scopeWindow}
          scopeLabel={scopeLabel}
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
        
        {/* Sticky navigation header with safe-area padding */}
        <header 
          className="sticky top-0 z-40 bg-main/95 backdrop-blur-sm border-b border-secondary/20"
          style={{
            paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)',
            paddingLeft: 'env(safe-area-inset-left, 1rem)',
            paddingRight: 'env(safe-area-inset-right, 1rem)',
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
            <GlobalNav withUserChip />
          </div>
        </header>

        <main id="journal-content" tabIndex={-1} className="journal-page max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-32 lg:pb-8">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
            {fromReading && (
              <button
                onClick={() => {
                  if (typeof window !== 'undefined' && window.history.length > 2) {
                    navigate(-1);
                    return;
                  }
                  navigate('/');
                }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-3 py-2 text-accent hover:text-main hover:bg-surface-muted/30 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50 self-start"
              >
                <CaretLeft className="w-5 h-5" />
                <span>Back to Reading</span>
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
            <h1 className="text-3xl font-serif text-accent">Your Tarot Journal</h1>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSavedIntentionsModal(true)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-amber-200/25 bg-amber-200/5 px-4 py-2.5 text-sm font-semibold text-amber-50 shadow-[0_12px_30px_-18px_rgba(251,191,36,0.35)] transition hover:-translate-y-0.5 hover:border-amber-200/40 hover:bg-amber-200/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40"
              >
                <JournalRefreshIcon className="h-4 w-4 text-amber-200" aria-hidden="true" />
                Saved Intentions
              </button>
              <button
                type="button"
                onClick={() => navigate('/journal/gallery')}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-amber-200/25 bg-amber-200/5 px-4 py-2.5 text-sm font-semibold text-amber-50 shadow-[0_12px_30px_-18px_rgba(251,191,36,0.35)] transition hover:-translate-y-0.5 hover:border-amber-200/40 hover:bg-amber-200/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40"
              >
                <JournalCardsAddIcon className="h-4 w-4 text-amber-200" aria-hidden="true" />
                Card Gallery
              </button>
            </div>
          </div>

          {showStickySummary && (
            <div className="sticky top-4 z-20 mb-6">
              <div className="rounded-2xl border border-amber-300/15 bg-[#0b0c1d]/90 p-3 shadow-[0_18px_45px_-28px_rgba(0,0,0,0.75)] backdrop-blur">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex min-w-[220px] flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-amber-50">
                      <JournalSearchIcon className="h-4 w-4 text-amber-200/70" aria-hidden="true" />
                      <span className="font-semibold">{searchSummaryTitle}</span>
                      {filtersActive && (
                        <span className="inline-flex min-h-[24px] items-center rounded-full border border-amber-200/20 bg-amber-200/10 px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100/75">
                          {activeFilterChips.length} active
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-amber-100/70">
                      <span>{searchSummaryCount}</span>
                      {searchCoverageLabel && <span>{searchCoverageLabel}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={scrollToHistoryFilters}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-xs font-semibold text-amber-100/90 hover:border-amber-200/40 hover:bg-amber-200/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40"
                    >
                      <JournalSlidersIcon className="h-4 w-4" aria-hidden="true" />
                      Edit filters
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <JournalStatusBanner
            isAuthenticated={isAuthenticated}
            canUseCloudJournal={canUseCloudJournal}
            lastSyncAt={lastSyncAt}
            syncSource={syncSource}
            journalError={journalError}
            loading={loading}
            localStoragePresence={localStoragePresence}
            localEntryCount={entries.length}
            onMigrate={handleMigrate}
            migrating={migrating}
            onImportLegacy={handleImportLegacy}
            importingLegacy={importingLegacy}
            onReload={reloadJournal}
            shouldShowAccountNudge={shouldShowAccountNudge}
            onDismissNudge={dismissAccountNudge}
            onShowAuthModal={() => setShowAuthModal(true)}
            cardClass={cardClass}
          />

          {showSummaryBand && (
            <JournalSummaryBand
              summaryRef={summaryRef}
              isMobileLayout={isMobileLayout}
              summaryInView={summaryInView}
              analyticsScope={analyticsScope}
              onScopeSelect={handleScopeSelect}
              customScope={customScope}
              onCustomScopeChange={handleCustomScopeChange}
              scopeError={scopeError}
              scopeLabel={scopeLabel}
              scopeEntryCount={scopeEntryCount}
              summaryCardData={summaryCardData}
              statNodes={statNodes}
              statNodeMap={statNodeMap}
              heroEntry={heroEntry}
              heroCards={heroCards}
              heroDateLabel={heroDateLabel}
              expandedCardIndex={expandedCardIndex}
              onExpandedCardChange={setExpandedCardIndex}
              onStartReading={handleStartReading}
              filtersActive={filtersActive}
              dataSource={summaryDataSource}
            />
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
                {hasEntries ? (
                  <section id="history" className={`${shellClass} p-5 space-y-5`}>
                    <AmberStarfield />
                    <div className="relative z-10 space-y-5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-serif text-amber-50">Journal history</h2>
                        </div>
                        <div className="flex flex-col items-start gap-1 sm:items-end">
                          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-[11px] text-amber-100/70">
                            Showing {visibleEntries.length} of {filteredEntries.length}
                            {hasMoreEntries ? '+' : ''}
                          </span>
                          {monthSections.length > 1 && (
                            <div className="flex items-center gap-2">
                              <label htmlFor="jump-to-month" className="text-[10px] uppercase tracking-[0.22em] text-amber-100/60">
                                Jump to month
                              </label>
                              <select
                                id="jump-to-month"
                                value={monthJumpValue}
                                onChange={handleMonthJump}
                                className="min-h-[32px] rounded-full border border-amber-200/20 bg-amber-200/10 px-3 text-[11px] text-amber-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40"
                              >
                                <option value="">Jump to month</option>
                                {monthSections.map((section) => (
                                  <option key={section.key} value={section.key}>
                                    {section.label} ({section.count})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>

                      {showHighlightBanner && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/20 bg-amber-200/5 px-3 py-2 text-[12px] text-amber-100/75" aria-live="polite">
                          <div className="flex items-center gap-2">
                            {highlightBannerState === 'loading' ? (
                              <span
                                className="inline-flex h-3 w-3 animate-spin rounded-full border border-amber-200/60 border-t-transparent"
                                aria-hidden="true"
                              />
                            ) : highlightBannerState === 'error' ? (
                              <Warning className="h-3.5 w-3.5 text-amber-200/80" aria-hidden="true" />
                            ) : (
                              <JournalSearchIcon className="h-3 w-3 text-amber-200/70" aria-hidden="true" />
                            )}
                            <span>
                              {highlightBannerState === 'loading'
                                ? 'Loading entry...'
                                : highlightBannerState === 'error'
                                  ? 'Couldn’t load this entry right now.'
                                  : 'This entry isn\'t loaded yet.'}
                            </span>
                          </div>
                          {highlightBannerState === 'not-found' && (
                            <button
                              type="button"
                              onClick={handleLoadOlderForHighlight}
                              disabled={loadingMore || !hasMoreEntries}
                              className={`inline-flex min-h-[32px] items-center gap-1 rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-[11px] font-semibold text-amber-100/90 hover:border-amber-200/40 hover:bg-amber-200/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40 ${loadingMore || !hasMoreEntries ? 'cursor-not-allowed opacity-60' : ''}`}
                            >
                              <JournalSearchIcon className="h-3 w-3" aria-hidden="true" />
                              Load older entries
                            </button>
                          )}
                          {highlightBannerState === 'error' && (
                            <button
                              type="button"
                              onClick={handleLoadOlderForHighlight}
                              disabled={loadingMore}
                              className={`inline-flex min-h-[32px] items-center gap-1 rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-[11px] font-semibold text-amber-100/90 hover:border-amber-200/40 hover:bg-amber-200/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40 ${loadingMore ? 'cursor-not-allowed opacity-60' : ''}`}
                            >
                              <JournalSearchIcon className="h-3 w-3" aria-hidden="true" />
                              Try again
                            </button>
                          )}
                        </div>
                      )}

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
                          viewMode={compactList ? 'compact' : 'comfortable'}
                          onViewModeChange={(mode) => setCompactList(mode === 'compact')}
                          resultCount={filteredEntries.length}
                          totalCount={entries.length}
                          searchCoverageLabel={searchCoverageLabel}
                          canSearchOlder={showInlineSearchOlder}
                          onSearchOlder={handleLoadMoreEntries}
                          searchOlderLabel={inlineSearchOlderLabel}
                          loadingMore={loadingMore}
                          onSearchRef={registerSearchInput}
                        />
                      </div>

                      {filteredEntries.length === 0 ? (
                        <div className="relative overflow-hidden rounded-2xl border border-amber-300/15 bg-amber-200/5 p-8 text-center text-sm text-amber-100/75 shadow-[0_16px_40px_-30px_rgba(0,0,0,0.8)]">
                          <NoFiltersIllustration className="mb-4" />
                          <p className="journal-prose text-lg text-amber-50">
                            {hasMoreServerEntries
                              ? `No matches in the most recent ${entries.length} entries.`
                              : 'No entries match your filters.'}
                          </p>
                          <p className="journal-prose mt-2 text-amber-100/70">
                            {hasMoreServerEntries
                              ? 'Search older entries or adjust your filters.'
                              : 'Try adjusting the filters or reset to see the full journal.'}
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className={entryStackSpacingClass}>
                            {renderedHistoryEntries}
                          </div>
                          {(hasMoreEntries || filteredEntries.length > visibleEntries.length) && (
                            <div className="flex justify-center">
                              <button
                                type="button"
                                onClick={handleLoadMoreEntries}
                                disabled={loadingMore}
                                className={`${OUTLINE_BUTTON_CLASS} min-h-[44px] px-4 py-2 ${loadingMore ? 'cursor-wait opacity-60' : ''}`}
                              >
                                {loadingMore
                                  ? 'Loading...'
                                  : hasMoreServerEntries
                                    ? 'Load more entries'
                                    : `Load ${Math.min(VISIBLE_ENTRY_BATCH, localRemaining)} more`}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </section>
                ) : (
                  <JournalEmptyState
                    shellClass={shellClass}
                    onStartReading={handleStartReading}
                  />
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

        <JournalFloatingControls
          hasEntries={hasEntries}
          hasScrolled={hasScrolled}
          historyFiltersEl={historyFiltersEl}
          historyFiltersInView={historyFiltersInView}
          filtersActive={filtersActive}
          activeFilterChips={activeFilterChips}
          onResetFilters={handleResetFilters}
          onRemoveFilter={handleRemoveFilter}
          onScrollToFilters={scrollToHistoryFilters}
          onStartReading={handleStartReading}
          isMobileLayout={isMobileLayout}
          showFiltersShortcut={!showStickySummary}
          showFilterSummary={!showStickySummary}
        />
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
      <SavedIntentionsModal isOpen={showSavedIntentionsModal} onClose={() => setShowSavedIntentionsModal(false)} />
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}
