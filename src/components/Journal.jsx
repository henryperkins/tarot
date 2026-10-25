import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CaretLeft, Warning } from '@phosphor-icons/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { AppBottomRegion } from './AppBottomRegion';
import { InstallFooter } from './InstallFooter';
import { ConfirmModal } from './ConfirmModal';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useJournal } from '../hooks/useJournal';
import { useJournalSummary } from '../hooks/useJournalSummary';
import { JournalFilters } from './JournalFilters.jsx';
import { InsightsErrorBoundary } from './InsightsErrorBoundary.jsx';
import { JournalEntryCard } from './JournalEntryCard.jsx';
import { SavedIntentionsModal } from './SavedIntentionsModal.jsx';
import { OUTLINE_BUTTON_CLASS } from '../styles/buttonClasses';
import { BADGE_LABEL_CLASS } from '../styles/labelClasses';
import { ReadingJourney } from './ReadingJourney';
import { NoFiltersIllustration } from './illustrations/NoFiltersIllustration';
import { useSmallScreen, SMALL_SCREEN_MAX } from '../hooks/useSmallScreen';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useToast } from '../contexts/ToastContext.jsx';
import AuthModal from './AuthModal';
import { getTimestamp } from '../../shared/journal/utils.js';
import { useJournalFilters } from '../hooks/useJournalFilters';
import { useJournalAnalytics } from '../hooks/useJournalAnalytics';
import { useJournalSharing } from '../hooks/useJournalSharing';
import { AmberStarfield } from './AmberStarfield';
import { JournalSummaryBand } from './journal/JournalSummaryBand';
import { JournalEmptyState } from './journal/JournalEmptyState';
import { JournalRecoveryState } from './journal/JournalRecoveryState';
import { JournalFloatingControls } from './journal/JournalFloatingControls';
import { JournalStatusBanner } from './journal/JournalStatusBanner';
import {
  DEFAULT_FILTERS,
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
import { JournalCardsAddIcon, JournalRefreshIcon, JournalSearchIcon } from './JournalIcons';



export default function Journal() {
  // Context hooks
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const { canUseCloudJournal, canUseAdvancedInsights } = useSubscription();
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
    saveReflection,
    retrySavedVisuals,
    migrateToCloud,
    importLegacyLocalEntries,
    loadMoreEntries,
    fetchEntryById,
    hasMoreEntries: hasMoreServerEntries,
    totalEntries,
    hasTotalEntries,
    error: journalError,
    lastSyncAt,
    lastLocalSaveAt,
    syncSource,
    reload: reloadJournal
  } = useJournal({ completeHistory: true });

  const journalSummary = useJournalSummary({
    userId: user?.id,
    entries,
    enabled: isAuthenticated && canUseAdvancedInsights,
  });

  // Layout detection
  const isMobileLayout = useSmallScreen(MOBILE_LAYOUT_MAX);
  const isSmallSummary = useSmallScreen(SMALL_SCREEN_MAX);
  const prefersReducedMotion = useReducedMotion();
  const shellClass = isMobileLayout ? AMBER_SHELL_MOBILE_CLASS : AMBER_SHELL_CLASS;
  const cardClass = isMobileLayout ? AMBER_CARD_MOBILE_CLASS : AMBER_CARD_CLASS;

  // Custom hooks - filters, analytics, sharing
  const {
    filters,
    setFilters,
    filterSignature,
    filteredEntries,
    timeframeWindow,
    filtersActive,
    activeFilterChips,
    handleResetFilters,
    handleRemoveFilter,
    serverSearchState,
    refreshServerSearch,
    updateServerSearchEntry,
    requestSemanticSearch,
    clearSemanticSearch
  } = useJournalFilters(entries, { isAuthenticated, canUseCloudJournal, userId: user?.id, completeHistory: syncSource === 'api' });

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
  } = useJournalAnalytics(entries, filteredEntries, filters, { isSmallSummary, timeframeWindow });

  const {
    shareLinks,
    shareLoading,
    shareError,
    fetchShareLinks,
    createShareLink,
    deleteShareLink,
    renameShareLink
  } = useJournalSharing(isAuthenticated, user?.id);
  // Owners can always see, rename and revoke links, even on a plan that can
  // no longer create them.
  const shareManagement = useMemo(() => (isAuthenticated ? {
    links: shareLinks,
    loading: shareLoading,
    error: shareError,
    onDelete: deleteShareLink,
    onRename: renameShareLink,
    onRefresh: fetchShareLinks
  } : null), [isAuthenticated, shareLinks, shareLoading, shareError, deleteShareLink, renameShareLink, fetchShareLinks]);

  // Local UI state
  const [migrating, setMigrating] = useState(false);
  const [importingLegacy, setImportingLegacy] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ isOpen: false, entryId: null });
  const [compactList, setCompactList] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSavedIntentionsModal, setShowSavedIntentionsModal] = useState(false);
  const [historyFiltersEl, setHistoryFiltersEl] = useState(null);
  const [highlightNavigationKey, setHighlightNavigationKey] = useState(location.key);
  const [pendingHighlightEntryId, setPendingHighlightEntryId] = useState(location.state?.highlightEntryId ?? null);
  const [highlightStatus, setHighlightStatus] = useState(null);
  const [entryVisibility, setEntryVisibility] = useState({ filterSignature, count: VISIBLE_ENTRY_BATCH });
  const [monthJump, setMonthJump] = useState('');
  const [journeyReady, setJourneyReady] = useState(false);
  const [hasOpenedMobileJourney, setHasOpenedMobileJourney] = useState(false);
  const summaryRef = useRef(null);
  const mobileJourneyDetailsRef = useRef(null);
  const mobileJourneySummaryRef = useRef(null);
  const journeyScrollFrameRef = useRef(null);
  const searchInputRef = useRef(null);
  const highlightRequestRef = useRef(0);
  const filteredEntriesRef = useRef(filteredEntries);
  const hasMoreServerEntriesRef = useRef(hasMoreServerEntries);
  const [summaryVisibility, setSummaryVisibility] = useState({ small: isSmallSummary, seen: false });

  // Capture new navigation requests before rendering; clearing router state must
  // leave the pending highlight available until its scroll/highlight completes.
  if (highlightNavigationKey !== location.key) {
    setHighlightNavigationKey(location.key);
    if (location.state?.highlightEntryId != null) {
      setPendingHighlightEntryId(location.state.highlightEntryId);
    }
  }
  if (summaryVisibility.small !== isSmallSummary) {
    setSummaryVisibility({ small: isSmallSummary, seen: false });
  }
  const summaryInView = !isSmallSummary || summaryVisibility.seen;

  // Filter changes reset pagination in the same render. Requested entries also
  // extend the retained batch so they stay rendered after the highlight expires.
  const highlightIndex = pendingHighlightEntryId == null ? -1 : filteredEntries.findIndex(
    entry => String(entry?.id || '') === String(pendingHighlightEntryId)
  );
  const visibleCount = Math.max(
    entryVisibility.filterSignature === filterSignature ? entryVisibility.count : VISIBLE_ENTRY_BATCH,
    highlightIndex + 1
  );
  if (entryVisibility.filterSignature !== filterSignature || entryVisibility.count !== visibleCount) {
    setEntryVisibility({ filterSignature, count: visibleCount });
  }
  const setVisibleCount = useCallback(update => {
    setEntryVisibility(previous => ({
      ...previous,
      count: typeof update === 'function' ? update(previous.count) : update
    }));
  }, []);

  // Derived values
  const hasEntries = entries.length > 0;
  const visibleEntries = useMemo(() => filteredEntries.slice(0, visibleCount), [filteredEntries, visibleCount]);
  const localRemaining = Math.max(filteredEntries.length - visibleEntries.length, 0);
  const hasLocalMoreEntries = filteredEntries.length > visibleCount;
  const hasMoreVisibleResults = filteredEntries.length > visibleEntries.length;
  const hasMoreEntries = hasLocalMoreEntries || hasMoreServerEntries;
  const showSummaryBand = !loading && hasEntries;
  const summaryDataSource = syncSource === 'api' || syncSource === 'cache' ? 'server' : 'client';
  const totalEntryCount = hasTotalEntries ? totalEntries : entries.length;
  const hasRemoteEntries = hasMoreServerEntries || (hasTotalEntries && totalEntryCount > entries.length);
  const serverSearchEnabled = serverSearchState?.enabled;
  const serverSearchStatus = serverSearchState?.status;
  const serverSearchMode = serverSearchState?.mode;
  const serverSearchLoading = serverSearchEnabled && serverSearchStatus === 'loading';
  const serverSearchErrored = serverSearchEnabled && serverSearchStatus === 'error';
  const semanticSearchActive = Boolean(serverSearchState?.semanticActive);
  const semanticSearchAvailable = Boolean(serverSearchState?.semanticAvailable);

  const searchCoverageLabel = semanticSearchActive
    ? (serverSearchLoading
        ? 'Finding readings with a similar meaning'
        : serverSearchErrored
          ? 'Search by meaning unavailable'
          : 'Searching your recent analyzed readings by meaning')
    : serverSearchEnabled
    ? (serverSearchLoading
        ? 'Searching your full journal history'
        : serverSearchErrored
          ? 'Full-history search unavailable'
          : 'Search spans your full journal history')
    : filtersActive
    ? (hasTotalEntries
        ? `Searching latest ${entries.length} of ${totalEntryCount} entries`
        : `Searching latest ${entries.length} entries`)
    : (hasTotalEntries && totalEntryCount > entries.length
        ? `Loaded ${entries.length} of ${totalEntryCount} entries`
        : null);
  const searchScopeLabel = serverSearchEnabled
    ? (serverSearchErrored
        ? 'Showing loaded entries only'
        : serverSearchMode === 'semantic'
          ? 'Semantic matches (best-fit, not exact keyword search)'
          : 'Server search (exact matches)')
    : (filtersActive && hasRemoteEntries
        ? 'Searching loaded entries only'
        : null);
  const inlineSearchOlderLabel = hasLocalMoreEntries
    ? 'Show more results'
    : (filters.query.trim() ? 'Search older entries' : 'Load older entries');
  const highlightBannerState = pendingHighlightEntryId
    ? (highlightIndex >= 0 ? 'found' : highlightStatus || 'loading') : null;
  const showHighlightBanner = Boolean(pendingHighlightEntryId) && highlightBannerState !== 'found';
  const showLoadMoreButton = hasMoreVisibleResults || (hasMoreServerEntries && !serverSearchEnabled);
  const loadMoreLabel = serverSearchEnabled
    ? `Load ${Math.min(VISIBLE_ENTRY_BATCH, localRemaining)} more results`
    : (hasMoreServerEntries
        ? 'Load more entries'
        : `Load ${Math.min(VISIBLE_ENTRY_BATCH, localRemaining)} more`);

  // Allow other pages (e.g. Card Collection) to deep-link into the journal.
  // Supported state:
  //  - focusJournal + journeyFilter: opens history with explicit Journey criteria
  //  - prefillQuery: string -> sets the journal search query
  //  - highlightEntryId: string/number -> scrolls to and briefly highlights a specific entry
  useEffect(() => {
    const state = location?.state || {};
    const prefillQuery = typeof state?.prefillQuery === 'string' ? state.prefillQuery : '';
    const highlightEntryId = state?.highlightEntryId ?? null;

    if (!prefillQuery && !highlightEntryId && !state.focusJournal) return;

    if (state.focusJournal) {
      setFilters({ ...DEFAULT_FILTERS, journeyFilter: state.journeyFilter || null });
      handleScopeSelect(state.journeyFilter ? 'filters' : 'all');
      searchInputRef.current?.focus();
      document.getElementById('journal-history-filters')?.scrollIntoView({ block: 'start' });
    } else if (prefillQuery) {
      setFilters((prev) => ({
        ...prev,
        query: prefillQuery,
      }));
    }

    // Clear the navigation state so back/forward doesn't keep re-applying.
    navigate(`${location.pathname}${location.search || ''}${location.hash || ''}`, { replace: true, state: null });
  }, [location.key, location.pathname, location.search, location.hash, location.state, navigate, setFilters, handleScopeSelect]);

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
    target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    if (typeof window === 'undefined') return;
    window.setTimeout(() => {
      const input = searchInputRef.current;
      if (!input) return;
      input.focus();
      if (typeof input.select === 'function') {
        input.select();
      }
    }, 240);
  }, [historyFiltersEl, prefersReducedMotion]);

  const handleMonthJump = useCallback((event) => {
    const value = event.target.value;
    setMonthJump(value);
    if (!value || typeof document === 'undefined') return;
    const anchor = document.getElementById(`month-${value}`);
    if (anchor) {
      anchor.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }, [prefersReducedMotion]);

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

  useEffect(() => {
    filteredEntriesRef.current = filteredEntries;
  }, [filteredEntries]);

  useEffect(() => {
    hasMoreServerEntriesRef.current = hasMoreServerEntries;
  }, [hasMoreServerEntries]);

  useEffect(() => {
    if (!isSmallSummary || !summaryRef.current) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setSummaryVisibility(previous => previous.small === isSmallSummary
              ? { ...previous, seen: true } : previous);
          }
        });
      },
      { threshold: 0.2 }
    );
    observer.observe(summaryRef.current);
    return () => observer.disconnect();
  }, [isSmallSummary, showSummaryBand]);

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

  // The render-time batch includes requested entries; this effect owns DOM scroll
  // and the brief highlight's expiry.
  useEffect(() => {
    if (!pendingHighlightEntryId) return undefined;
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const targetId = String(pendingHighlightEntryId);

    const index = filteredEntries.findIndex((entry) => String(entry?.id || '') === targetId);
    if (index < 0) return undefined;

    // Next tick: scroll to the entry container.
    const id = `journal-entry-${targetId}`;
    const handle = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
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
  }, [pendingHighlightEntryId, filteredEntries, visibleCount, prefersReducedMotion]);

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

  useEffect(() => () => {
    if (journeyScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(journeyScrollFrameRef.current);
    }
  }, []);

  const handleMobileJourneyToggle = useCallback((event) => {
    if (event.currentTarget.open) setHasOpenedMobileJourney(true);
  }, []);

  const handleSeeJourney = useCallback(() => {
    const details = mobileJourneyDetailsRef.current;
    if (!details) return;
    details.open = true;
    setHasOpenedMobileJourney(true);
    mobileJourneySummaryRef.current?.focus({ preventScroll: true });
    if (journeyScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(journeyScrollFrameRef.current);
    }
    journeyScrollFrameRef.current = window.requestAnimationFrame(() => {
      journeyScrollFrameRef.current = null;
      details.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start'
      });
    });
  }, [prefersReducedMotion]);

  const handleMigrate = async () => {
    setMigrating(true);

    const result = await migrateToCloud();

    if (result.success) {
      const parts = [`Added ${result.migrated} local entries to your cloud journal`];
      if (typeof result.skipped === 'number' && result.skipped > 0) {
        parts.push(`${result.skipped} already existed`);
      }
      if (result.sourceRetained) parts.push('Local copies changed during sync and have been kept; sync again to include new readings');
      showToast({
        type: 'success',
        title: 'Local entry results',
        description: parts.join(', ')
      });
    } else {
      showToast({
        type: 'error',
        title: 'Could not add local entries',
        description: result.error || 'Your local entries could not be added to your cloud journal. Try again.'
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
    const entry = filteredEntries.find(item => item.id === entryId) || entries.find(item => item.id === entryId);
    setDeleteConfirmModal({ isOpen: true, entryId, ownerId: user?.id || null, readingResultId: entry?.readingResultId || null });
  };

  const handleDeleteConfirm = async () => {
    const entryId = deleteConfirmModal.entryId;
    if (!entryId) return;

    // Close modal immediately to provide responsive feedback
    setDeleteConfirmModal({ isOpen: false, entryId: null });

    if (deleteConfirmModal.ownerId !== (user?.id || null)) {
      showToast({ type: 'error', title: 'Account changed', description: 'Choose this entry again in the current account.' });
      return;
    }
    const result = await deleteEntry(entryId, { readingResultId: deleteConfirmModal.readingResultId });

    if (result.success) {
      showToast({
        type: 'success',
        title: 'Entry deleted',
        description: result.purged === false ? result.error : 'Removed from your journal history.'
      });
      if (serverSearchEnabled) {
        refreshServerSearch();
      }
    } else {
      showToast({
        type: 'error',
        title: 'Delete failed',
        description: result.error || 'Please try again in a moment.'
      });
    }
  };

  const handleSaveReflection = useCallback(async (entryId, edit) => {
    const result = await saveReflection(entryId, edit);
    // Keep other expanded cards and unfinished drafts mounted while adopting
    // the stored map in the separate search-result copy.
    if (result?.success && serverSearchEnabled) updateServerSearchEntry(entryId, { reflections: result.reflections });
    return result;
  }, [saveReflection, serverSearchEnabled, updateServerSearchEntry]);

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
    try {
      if (typeof localStorage === 'undefined') return { hasLegacy: false, hasScoped: false };
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
    } catch { return { hasLegacy: false, hasScoped: false }; }
  };

  // Compute each render so it updates after import/migration without needing
  // brittle dependency tracking.
  const localStoragePresence = getLocalStorageEntryPresence();

  const desktopRailContent = (journeyReady && !loading && hasEntries && !isMobileLayout) ? (
    <div className="space-y-6 lg:space-y-8 w-full">
      <div className="w-full">
        <InsightsErrorBoundary>
          <ReadingJourney
            journalSummary={journalSummary}
            entries={entries}
            filteredEntries={filteredEntries}
            filtersActive={journeyFiltersActive}
            filtersApplied={filtersActive}
            scopeEntries={scopedStatsEntries}
            analyticsScope={analyticsScope}
            onScopeSelect={handleScopeSelect}
            isAuthenticated={isAuthenticated}
            canUseCloudJournal={canUseCloudJournal}
            historyComplete={syncSource !== 'cache'}
            userId={user?.id}
            focusAreas={personalization?.focusAreas}
            locale={locale}
            timezone={timezone}
            variant="sidebar"
            onCreateShareLink={isAuthenticated && canUseCloudJournal ? createShareLink : null}
            shareManagement={shareManagement}
            onStartReading={handleStartReading}
            showStartReadingCta={false}
            seasonWindow={scopeWindow}
            scopeLabel={scopeLabel}
            scopeError={scopeError}
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
      <div data-app-secondary="2" data-chrome-group="journal-months" className="sticky top-24 z-20">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-secondary/20 bg-(--surface-88) px-3 py-2 backdrop-blur">
          <span className="text-2xs uppercase tracking-label-wide text-muted">{section.label}</span>
          <span className={`${BADGE_LABEL_CLASS} inline-flex items-center rounded-full border border-secondary/20 bg-surface-muted/40 px-2.5 py-1 text-muted`}>
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
              className={`space-y-2 ${isHighlighted ? 'rounded-2xl ring-2 ring-primary/35 bg-primary/3 p-2' : ''}`}
            >
              <JournalEntryCard
                entry={entry}
                openRequestKey={isHighlighted ? highlightNavigationKey : null}
                isAuthenticated={isAuthenticated}
                onCreateShareLink={isAuthenticated && canUseCloudJournal ? createShareLink : null}
                shareLinks={shareLinks}
                shareLoading={shareLoading}
                shareError={shareError}
                onDeleteShareLink={isAuthenticated ? deleteShareLink : null}
                onDelete={handleDeleteRequest}
                onRetryVisuals={retrySavedVisuals}
                onSaveReflection={handleSaveReflection}
                compact={compactList}
                cardClass={cardClass}
              />
            </div>
          );
        })}
      </div>
    </div>
  ));

  const mobileRailContent = (hasOpenedMobileJourney && !loading && hasEntries && isMobileLayout) ? (
    <section className="mb-6 space-y-3 lg:hidden" aria-label="Journal insights and journey">
      {/* Filters moved to Journal history section to avoid duplication */}
      <InsightsErrorBoundary>
        <ReadingJourney
          journalSummary={journalSummary}
          entries={entries}
          filteredEntries={filteredEntries}
          filtersActive={journeyFiltersActive}
          filtersApplied={filtersActive}
          scopeEntries={scopedStatsEntries}
          analyticsScope={analyticsScope}
          onScopeSelect={handleScopeSelect}
          isAuthenticated={isAuthenticated}
          canUseCloudJournal={canUseCloudJournal}
          historyComplete={syncSource !== 'cache'}
          userId={user?.id}
          focusAreas={personalization?.focusAreas}
          locale={locale}
          timezone={timezone}
          variant="mobile"
          onCreateShareLink={isAuthenticated && canUseCloudJournal ? createShareLink : null}
          shareManagement={shareManagement}
          onStartReading={handleStartReading}
          showStartReadingCta={false}
          seasonWindow={scopeWindow}
          scopeLabel={scopeLabel}
          scopeError={scopeError}
        />
      </InsightsErrorBoundary>
    </section>
  ) : null;

  return (
    <>
      <div data-app-chrome className="min-h-screen bg-main text-main">
        <AppHeader />

        <main id="main-content" tabIndex={-1} className="journal-page max-w-7xl mx-auto pl-[max(min(1rem,4vw),var(--safe-pad-left))] pr-[max(min(1rem,4vw),var(--safe-pad-right))] sm:pl-[max(1.5rem,var(--safe-pad-left))] sm:pr-[max(1.5rem,var(--safe-pad-right))] pt-8 pb-8">

          <div className={fromReading ? 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6' : 'hidden'}>
            {fromReading && (
              <button
                onClick={() => {
                  if (typeof window !== 'undefined' && window.history.length > 2) {
                    navigate(-1);
                    return;
                  }
                  navigate('/');
                }}
                className="inline-flex min-h-touch items-center gap-2 rounded-full px-3 py-2 text-accent hover:text-main hover:bg-surface-muted/30 transition touch-manipulation focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/50 self-start"
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
                className="inline-flex min-h-touch items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-main shadow-[0_12px_30px_-18px_rgb(var(--brand-primary-rgb)/0.35)] transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <JournalRefreshIcon className="h-4 w-4 text-accent" aria-hidden="true" />
                Saved Intentions
              </button>
              <button
                type="button"
                onClick={() => navigate('/journal/gallery')}
                className="inline-flex min-h-touch items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-main shadow-[0_12px_30px_-18px_rgb(var(--brand-primary-rgb)/0.35)] transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <JournalCardsAddIcon className="h-4 w-4 text-accent" aria-hidden="true" />
                Card Gallery
              </button>
            </div>
          </div>

          <JournalStatusBanner
            isAuthenticated={isAuthenticated}
            canUseCloudJournal={canUseCloudJournal}
            lastSyncAt={lastSyncAt}
            lastLocalSaveAt={lastLocalSaveAt}
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

          {loading ? (
            <div className="space-y-4 py-6" aria-live="polite">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-2xl border border-secondary/20 bg-surface-muted/40 ring-1 ring-primary/10 p-4 shadow-[0_16px_40px_-28px_rgba(0,0,0,0.7)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="h-4 w-28 rounded-full bg-(--border-warm-light)" />
                    <div className="h-9 w-9 rounded-full bg-(--border-warm-light)" />
                  </div>
                  <div className="mt-3 h-3 w-3/4 rounded-full bg-(--border-warm-light)" />
                  <div className="mt-2 h-3 w-5/6 rounded-full bg-(--border-warm-light)" />
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="h-16 rounded-xl bg-(--border-warm-subtle)" />
                    <div className="h-16 rounded-xl bg-(--border-warm-subtle)" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={hasEntries && hasRailContent ? 'lg:flex lg:flex-wrap lg:gap-6 xl:gap-8' : ''}>
              {/* Let the rail move below history when enlarged text needs more room. */}
              <div className="min-w-0 flex-[999_1_32rem] space-y-8">
                {hasEntries ? (
                  <section id="history" className={`${shellClass} p-[min(1.25rem,4vw)] space-y-5`}>
                    {/* Keep decorative orbs from becoming native focus-scroll space. */}
                    <div className="pointer-events-none absolute inset-0 overflow-clip rounded-[inherit]" aria-hidden="true">
                      <AmberStarfield />
                    </div>
                    <div className="relative z-10 space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-serif text-main">Saved readings</h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full border border-secondary/20 bg-surface-muted/40 px-3 py-1 text-2xs text-muted">
                              Filtered: {filteredEntries.length}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-secondary/20 bg-surface-muted/40 px-3 py-1 text-2xs text-muted">
                              Loaded: {entries.length}{hasTotalEntries ? ` of ${totalEntryCount}` : hasMoreEntries ? '+' : ''}
                            </span>
                          </div>
                          {monthSections.length > 1 && (
                            <div className="flex items-center gap-2">
                              <label htmlFor="jump-to-month" className="sr-only sm:not-sr-only sm:text-2xs sm:uppercase sm:tracking-label sm:text-muted/80">
                                Jump to month
                              </label>
                              <select
                                id="jump-to-month"
                                value={monthJumpValue}
                                onChange={handleMonthJump}
                                className="min-h-touch rounded-full border border-secondary/20 bg-surface-muted/40 px-3 text-sm-mobile sm:text-2xs text-main focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
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
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-secondary/20 bg-surface-muted/40 px-3 py-2 text-xs text-muted-high" aria-live="polite">
                          <div className="flex items-center gap-2">
                            {highlightBannerState === 'loading' ? (
                              <span
                                className="inline-flex h-3 w-3 animate-spin rounded-full border border-secondary/60 border-t-transparent"
                                aria-hidden="true"
                              />
                            ) : highlightBannerState === 'error' ? (
                              <Warning className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                            ) : (
                              <JournalSearchIcon className="h-3 w-3 text-muted" aria-hidden="true" />
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
                              className={`inline-flex min-h-touch items-center gap-1 rounded-full border border-secondary/20 bg-surface/60 px-3 py-1 text-2xs font-semibold text-main hover:border-secondary/40 hover:bg-surface-muted/60 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 ${loadingMore || !hasMoreEntries ? 'cursor-not-allowed opacity-60' : ''}`}
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
                              className={`inline-flex min-h-touch items-center gap-1 rounded-full border border-secondary/20 bg-surface/60 px-3 py-1 text-2xs font-semibold text-main hover:border-secondary/40 hover:bg-surface-muted/60 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 ${loadingMore ? 'cursor-not-allowed opacity-60' : ''}`}
                            >
                              <JournalSearchIcon className="h-3 w-3" aria-hidden="true" />
                              Try again
                            </button>
                          )}
                        </div>
                      )}

                      <div className="space-y-4">


                        <div
                          id="journal-history-filters"
                          ref={registerHistoryFiltersEl}
                          className="scroll-mt-24"
                        >
                          <JournalFilters
                            ownerId={isAuthenticated ? user?.id : null}
                            storageReady={!authLoading}
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
                            searchScopeLabel={searchScopeLabel}
                            onSearchRef={registerSearchInput}
                          />
                        </div>

                        {(semanticSearchAvailable || semanticSearchActive) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-secondary/20 bg-surface-muted/30 px-3 py-2 text-xs text-muted-high">
                            <span className="min-w-0 flex-[1_1_14rem]">
                              {semanticSearchActive
                                ? 'Showing readings with a similar meaning, not just these exact words.'
                                : 'Looking for readings on the same theme in other words?'}
                            </span>
                            <button
                              type="button"
                              onClick={semanticSearchActive ? clearSemanticSearch : requestSemanticSearch}
                              className="inline-flex min-h-touch items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-main hover:border-primary/40 hover:bg-primary/20 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
                            >
                              <JournalSearchIcon className="h-3.5 w-3.5" aria-hidden="true" />
                              {semanticSearchActive ? 'Show exact matches' : 'Search by meaning'}
                            </button>
                          </div>
                        )}
                      </div>

                      {serverSearchErrored && (
                        <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                          {semanticSearchActive
                            ? 'Search by meaning failed. Showing exact matches from loaded entries instead.'
                            : 'Full-history search failed. Showing matches from loaded entries only.'}
                        </div>
                      )}

                      {serverSearchLoading ? (
                        <div className="rounded-2xl border border-secondary/20 bg-surface-muted/40 p-8 text-center text-sm text-muted-high shadow-[0_16px_40px_-30px_rgba(0,0,0,0.8)]" role="status">
                          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border border-secondary/60 border-t-transparent" aria-hidden="true" />
                          <p className="journal-prose text-lg text-main">
                            {semanticSearchActive ? 'Finding readings with a similar meaning...' : 'Searching your full journal history...'}
                          </p>
                          <p className="journal-prose mt-2 text-muted">This can take a few seconds for large collections.</p>
                        </div>
                      ) : filteredEntries.length === 0 ? (
                        <div className="relative overflow-hidden rounded-2xl border border-secondary/20 bg-surface-muted/40 p-8 text-center text-sm text-muted-high shadow-[0_16px_40px_-30px_rgba(0,0,0,0.8)]">
                          <NoFiltersIllustration className="mb-4" />
                          <p className="journal-prose text-lg text-main">
                            {semanticSearchActive && serverSearchEnabled
                              ? 'No readings with a similar meaning were found.'
                              : serverSearchEnabled
                              ? 'No matches found in your full journal history.'
                              : hasMoreServerEntries
                                ? `No matches in the most recent ${entries.length} entries.`
                                : 'No entries match your filters.'}
                          </p>
                          <p className="journal-prose mt-2 text-muted">
                            {semanticSearchActive && serverSearchEnabled
                              ? 'Search by meaning looks through your recent analyzed readings. Try other words, or show exact matches.'
                              : semanticSearchAvailable
                              ? 'Try other words, adjust your filters, or search by meaning to find readings on the same theme.'
                              : serverSearchEnabled
                              ? 'Try a different search term or adjust your filters.'
                              : hasMoreServerEntries
                                ? 'Searching loaded entries only. Try searching older entries or adjust your filters.'
                                : 'Try adjusting the filters or reset to see the full journal.'}
                          </p>
                          {hasMoreServerEntries && !serverSearchEnabled && (
                            <div className="mt-4 flex flex-col items-center gap-2">
                              <button
                                type="button"
                                onClick={handleLoadMoreEntries}
                                disabled={loadingMore}
                                className={`inline-flex min-h-touch items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-xs font-semibold text-main hover:border-primary/40 hover:bg-primary/20 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40 ${loadingMore ? 'cursor-not-allowed opacity-60' : ''}`}
                              >
                                <JournalSearchIcon className="h-4 w-4" aria-hidden="true" />
                                {loadingMore ? 'Searching...' : inlineSearchOlderLabel}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className={entryStackSpacingClass}>
                            {renderedHistoryEntries}
                          </div>
                          {showLoadMoreButton && (
                            <div className="flex justify-center">
                              <button
                                type="button"
                                onClick={handleLoadMoreEntries}
                                disabled={loadingMore}
                                className={`${OUTLINE_BUTTON_CLASS} min-h-touch px-4 py-2 ${loadingMore ? 'cursor-wait opacity-60' : ''}`}
                              >
                                {loadingMore ? 'Loading...' : loadMoreLabel}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                        <JournalFloatingControls
                          hasEntries={hasEntries}
                          filtersActive={filtersActive}
                          activeFilterChips={activeFilterChips}
                          onResetFilters={handleResetFilters}
                          onRemoveFilter={handleRemoveFilter}
                          onScrollToFilters={scrollToHistoryFilters}
                          onStartReading={handleStartReading}
                          isMobileLayout={isMobileLayout}
                        />
                    </div>
                  </section>
                ) : journalError ? (
                  <JournalRecoveryState cloud={isAuthenticated && canUseCloudJournal} onReload={reloadJournal} loading={loading} />
                ) : (
                  <JournalEmptyState
                    shellClass={shellClass}
                    onStartReading={handleStartReading}
                  />
                )}
                {hasEntries && (
                  <div className="space-y-4">
                    {isMobileLayout && (
                      <details
                        ref={mobileJourneyDetailsRef}
                        onToggle={handleMobileJourneyToggle}
                        className="rounded-2xl border border-(--border-warm-light) bg-(--bg-surface) p-4"
                      >
                        <summary
                          ref={mobileJourneySummaryRef}
                          className="min-h-touch content-center cursor-pointer rounded-lg font-serif text-lg text-main focus-visible:outline-2 focus-visible:outline-(--focus-ring-color)"
                        >
                          Your reading journey
                        </summary>
                        <div className="pt-3">{mobileRailContent}</div>
                      </details>
                    )}
                    <details className="rounded-2xl border border-(--border-warm-light) bg-(--bg-surface) p-4">
                      <summary className="min-h-touch content-center cursor-pointer rounded-lg font-serif text-lg text-main focus-visible:outline-2 focus-visible:outline-(--focus-ring-color)">Practice snapshot</summary>
                      <div className="pt-3">
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
                            onSeeJourney={handleSeeJourney}
                            filtersActive={filtersActive}
                            dataSource={summaryDataSource}
                            embedded
                          />
                        )}
                      </div>
                    </details>
                  </div>
                )}
              </div>

              {hasEntries && hasRailContent && desktopRailContent && (
                <aside className="hidden min-w-0 lg:block lg:flex-[1_1_24rem]">
                  <div data-app-secondary="3" className="lg:sticky lg:top-6 lg:w-full">
                    {desktopRailContent}
                  </div>
                </aside>
              )}
            </div>
          )}
          <InstallFooter />
        </main>


        <AppBottomRegion />
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
