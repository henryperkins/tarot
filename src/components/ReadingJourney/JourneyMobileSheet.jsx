/**
 * JourneyMobileSheet - Mobile variant with hero card and tabbed bottom sheet.
 *
 * Mobile-first design with:
 * - Hero card showing top stats and coach suggestion
 * - "See Full Journey" button to expand bottom sheet
 * - Tabbed interface for Cards, Patterns, Export
 * - Swipe-to-dismiss gesture support
 * - Proper accessibility (focus trap, escape key, screen reader)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Sparkle,
  Fire,
  X,
  TrendUp,
  ChartBar,
  Export,
  Gear,
} from '@phosphor-icons/react';
import { useModalA11y } from '../../hooks/useModalA11y';
import CardsCallingYou from './sections/CardsCallingYou';
import ContextBreakdown from './sections/ContextBreakdown';
import MajorArcanaMap from './sections/MajorArcanaMap';
import AchievementsRow from './sections/AchievementsRow';
import CadenceSection from './sections/CadenceSection';
import JourneyStorySection from './sections/JourneyStorySection';
import ExportSection from './sections/ExportSection';
import JournalSummarySection from './sections/JournalSummarySection';
import EmptyState from './sections/EmptyState';
import BackfillBanner from './sections/BackfillBanner';

const TABS = [
  { key: 'cards', label: 'Cards', icon: TrendUp },
  { key: 'patterns', label: 'Patterns', icon: ChartBar },
  { key: 'summary', label: 'Summary', icon: Sparkle },
  { key: 'export', label: 'Export', icon: Export },
];

/**
 * JourneyMobileSheet - Mobile layout with hero and expandable sheet.
 */
export default function JourneyMobileSheet({
  // Data from useJourneyData
  cardFrequency,
  badges,
  majorArcanaMap,
  contextBreakdown,
  themes,
  preferenceDrift,
  cadence,
  totalReadings,
  totalCards,
  currentStreak,
  journeyStory,
  coachSuggestion,
  seasonWindow,
  filtersActive,
  isLoading,
  hasBackfilled,
  needsBackfill,
  isEmpty,
  isFilteredEmpty,
  isAnalyticsDisabled,
  isBackfilling,
  backfillResult,
  handleBackfill,
  // For export functionality
  scopeEntries,
  filteredEntries,
  allEntries,
  exportStats,
  // Other props
  isAuthenticated,
  onCreateShareLink,
  onStartReading,
  showStartReadingCta = true,
  locale = 'default',
  timezone,
  _dataSource,
  scopeLabel,
  filtersApplied,
  analyticsScope,
}) {
  const navigate = useNavigate();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('cards');
  const sheetRef = useRef(null);
  const closeButtonRef = useRef(null);
  const triggerButtonRef = useRef(null);
  const abortControllerRef = useRef(null);
  const scopeChipLabel = analyticsScope === 'filters' && filtersActive ? 'Filtered' : (scopeLabel || 'Scope');
  const sourceLabel = _dataSource === 'server' ? 'D1' : 'Journal';

  // Swipe-to-dismiss state
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartY = useRef(null);
  const touchStartTime = useRef(null);

  // Close handler for useModalA11y
  const handleClose = useCallback(() => {
    setIsSheetOpen(false);
  }, []);

  // Use shared modal accessibility hook for scroll lock, escape key, and focus trap
  useModalA11y(isSheetOpen, {
    onClose: handleClose,
    containerRef: sheetRef,
    initialFocusRef: closeButtonRef,
    scrollLockStrategy: 'simple',
  });

  // Reset drag state when sheet closes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isSheetOpen) return;

    const rafId = window.requestAnimationFrame(() => {
      setDragOffset(0);
      setIsDragging(false);
      touchStartY.current = null;
      touchStartTime.current = null;
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [isSheetOpen]);

  // Swipe-to-dismiss handlers
  const handleTouchStart = useCallback((event) => {
    const target = event.target;
    const isHandle = target.closest('.journey-sheet__handle');
    const isHeader = target.closest('.journey-sheet__header');
    const scrollContainer = sheetRef.current?.querySelector('.journey-sheet__body');
    const isAtScrollTop = !scrollContainer || scrollContainer.scrollTop <= 0;

    // Allow drag from handle, header, or content when at scroll top
    if (isHandle || isHeader || isAtScrollTop) {
      touchStartY.current = event.touches[0].clientY;
      touchStartTime.current = Date.now();
      setIsDragging(true);
    }
  }, []);

  const handleTouchMove = useCallback((event) => {
    if (touchStartY.current === null) return;

    const currentY = event.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;

    // Only allow dragging downward (positive delta)
    if (deltaY > 0) {
      // Apply resistance as drag increases (feels more natural)
      const resistance = 0.6;
      const dampedDelta = deltaY * resistance;
      setDragOffset(dampedDelta);
    }
  }, []);

  const handleTouchEnd = useCallback((event) => {
    if (touchStartY.current === null) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }

    const touchEndY = event.changedTouches[0].clientY;
    const deltaY = touchEndY - touchStartY.current;
    const elapsed = Date.now() - (touchStartTime.current || Date.now());

    // Calculate velocity (pixels per millisecond)
    const velocity = deltaY / Math.max(elapsed, 1);

    // Dismiss conditions:
    // 1. Dragged far enough (200px+)
    // 2. Fast swipe (velocity > 0.6 px/ms) with substantial distance (80px+)
    const shouldDismiss = deltaY > 200 || (deltaY > 80 && velocity > 0.6);

    if (shouldDismiss) {
      // Animate out with current momentum
      setDragOffset(window.innerHeight);
      setTimeout(handleClose, 150);
    } else {
      // Snap back
      setDragOffset(0);
    }

    touchStartY.current = null;
    touchStartTime.current = null;
    setIsDragging(false);
  }, [handleClose]);

  const handleTouchCancel = useCallback(() => {
    touchStartY.current = null;
    touchStartTime.current = null;
    setIsDragging(false);
    setDragOffset(0);
  }, []);

  const handleBackfillClick = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    handleBackfill(abortControllerRef.current.signal);
  }, [handleBackfill]);

  // Show loading skeleton
  if (isLoading) {
    return (
      <div className="animate-pulse rounded-3xl border border-amber-300/12 bg-gradient-to-br from-[#0b0c1d] via-[#0d1024] to-[#090a16] p-5">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-amber-200/25" />
            <div className="h-3 w-28 rounded bg-amber-200/25" />
          </div>
          <div className="h-20 w-full rounded-xl bg-amber-200/10" />
        </div>
      </div>
    );
  }

  // Show "no results for filter" when filters yield empty but user has entries
  if (isFilteredEmpty) {
    return (
      <section
        className="relative overflow-hidden rounded-3xl border border-amber-300/12 bg-gradient-to-br from-[#0b0c1d] via-[#0d1024] to-[#090a16] p-5"
        aria-labelledby="reading-journey-mobile-filtered-empty"
      >
        <div className="relative z-10 text-center py-6">
          <h3
            id="reading-journey-mobile-filtered-empty"
            className="mb-3 flex items-center justify-center gap-2 journal-eyebrow text-amber-100/70"
          >
            <Sparkle className="h-3 w-3" aria-hidden="true" />
            Your Journey
            <span className="text-[10px] text-amber-100/50">(filtered)</span>
          </h3>
          <p className="text-sm text-amber-100/70 mb-2">
            No readings match your current filters.
          </p>
          <p className="text-xs text-amber-100/50">
            Try adjusting or clearing your filters to see your journey insights.
          </p>
        </div>
      </section>
    );
  }

  // Show analytics disabled state (user opted out)
  if (isAnalyticsDisabled) {
    return (
      <section
        className="relative overflow-hidden rounded-3xl border border-amber-300/12 bg-gradient-to-br from-[#0b0c1d] via-[#0d1024] to-[#090a16] p-5"
        aria-labelledby="reading-journey-mobile-disabled"
      >
        <div className="relative z-10 text-center py-6">
          <h3
            id="reading-journey-mobile-disabled"
            className="mb-3 flex items-center justify-center gap-2 journal-eyebrow text-amber-100/70"
          >
            <Sparkle className="h-3 w-3" aria-hidden="true" />
            Your Journey
          </h3>
          <p className="text-sm text-amber-100/70 mb-2">
            Journey analytics are currently disabled.
          </p>
          <p className="text-xs text-amber-100/50">
            Enable them in settings to track card patterns.
          </p>
          <button
            type="button"
            onClick={() => navigate('/account#analytics')}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full border border-amber-200/25 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-amber-200/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40"
          >
            Go to Settings
          </button>
        </div>
      </section>
    );
  }

  // Show empty state only for truly empty journal (no entries at all)
  // Note: Previously this also blocked for (needsBackfill && !hasBackfilled),
  // but that hid client-computed insights from authenticated users until they
  // ran the D1 backfill. Now we show client stats and include a backfill banner.
  if (isEmpty) {
    return (
      <EmptyState
        onBackfill={handleBackfillClick}
        isBackfilling={isBackfilling}
        backfillResult={backfillResult}
        isAuthenticated={isAuthenticated}
        hasEntries={false}
      />
    );
  }

  const topCard = cardFrequency[0];
  const topCardScopeLabel = filtersActive
    ? 'in filtered view'
    : (_dataSource === 'server' ? 'this month' : 'in your journal');

  return (
    <>
      {/* Hero Card */}
      <section
        className="relative overflow-hidden rounded-3xl border border-amber-300/12 bg-gradient-to-br from-[#0b0c1d] via-[#0d1024] to-[#090a16] p-5 shadow-[0_24px_68px_-30px_rgba(0,0,0,0.9)]"
        aria-labelledby="reading-journey-mobile-heading"
      >
        {/* Decorative background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60 mix-blend-screen"
          aria-hidden="true"
          style={{
            backgroundImage:
              'radial-gradient(circle at 14% 18%, rgba(251,191,36,0.08), transparent 32%), radial-gradient(circle at 86% 26%, rgba(56,189,248,0.07), transparent 30%)',
          }}
        />

        <div className="relative z-10 space-y-4">
          {/* Header */}
          <h3
            id="reading-journey-mobile-heading"
            className="flex items-center gap-2 journal-eyebrow text-amber-100/70"
          >
            <Sparkle className="h-3 w-3" aria-hidden="true" />
            Your Journey
            {scopeLabel && (
              <span className="rounded-full border border-amber-200/15 bg-amber-200/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100/70">
                Scope: {scopeLabel}
              </span>
            )}
          </h3>

          {/* Backfill banner - shown when D1 sync is needed but doesn't block insights */}
          {needsBackfill && !hasBackfilled && (
            <BackfillBanner
              onBackfill={handleBackfillClick}
              isBackfilling={isBackfilling}
              backfillResult={backfillResult}
              variant="compact"
            />
          )}

          {/* Season window indicator for localized formatting */}
          {seasonWindow && (
            <p className="text-[11px] text-amber-100/50">
              {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', ...(timezone && { timeZone: timezone }) }).format(seasonWindow.start)}
              {' – '}
              {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', ...(timezone && { timeZone: timezone }) }).format(seasonWindow.end)}
            </p>
          )}

          {/* Top Card Feature */}
          {topCard && (
            <div className="rounded-xl bg-gradient-to-br from-amber-500/15 via-amber-600/10 to-transparent p-4 border border-amber-300/15 text-center">
              <div className="text-2xl mb-1">🃏</div>
              <p className="text-lg font-serif text-amber-50">{topCard.name}</p>
              <p className="text-xs text-amber-100/70">
                appeared {topCard.count}x {topCardScopeLabel}
              </p>
              {topCard.hasBadge && (
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-orange-300">
                  <Fire className="h-3 w-3" />
                  Streak badge earned
                </p>
              )}
            </div>
          )}

          {/* Stats row */}
          <div className="flex justify-center gap-4">
            <div className="text-center">
              <p className="text-xl font-medium text-amber-50">{totalReadings}</p>
              <p className="text-[10px] text-amber-100/60">readings</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-medium text-amber-50">{totalCards}</p>
              <p className="text-[10px] text-amber-100/60">cards</p>
            </div>
            {currentStreak > 0 && (
              <div className="text-center">
                <p className="text-xl font-medium text-amber-50 flex items-center justify-center gap-1">
                  <Fire className="h-4 w-4 text-orange-400" />
                  {currentStreak}
                </p>
                <p className="text-[10px] text-amber-100/60">streak</p>
              </div>
            )}
          </div>

          {/* Coach suggestion */}
          {coachSuggestion && (
            <div className="rounded-lg bg-amber-200/5 p-3 border border-amber-300/10">
              <p className="text-xs text-amber-100/80">
                💡 {coachSuggestion.text}
              </p>
              {onStartReading && showStartReadingCta && (
                <button
                  onClick={() => onStartReading(coachSuggestion)}
                  className="mt-2 text-xs font-medium text-amber-200 hover:text-amber-100 min-h-[44px] -mb-2 -ml-1 px-1"
                >
                  Start Reading →
                </button>
              )}
            </div>
          )}

          {/* See Full Journey button */}
          <button
            ref={triggerButtonRef}
            onClick={() => setIsSheetOpen(true)}
            className="
              w-full py-3 min-h-[44px] rounded-full text-sm font-medium
              border border-amber-300/30 text-amber-100 bg-amber-200/5
              hover:bg-amber-200/10 hover:border-amber-300/40
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50
              transition-colors
            "
          >
            See Full Journey ↓
          </button>
        </div>
      </section>

      {/* Bottom Sheet */}
      {isSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-labelledby="journey-sheet-title"
        >
          {/* Backdrop with fade animation */}
          <div
            className="absolute inset-0 bg-main/70 backdrop-blur-sm animate-fade-in"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Sheet with slide animation and swipe handling */}
          {/* maxHeight uses dvh (dynamic viewport height) which correctly handles mobile browser chrome
              and home indicators. Falls back to vh for older browsers via CSS custom property. */}
          <div
            ref={sheetRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
            className="relative bg-gradient-to-br from-[#0b0c1d] via-[#0d1024] to-[#090a16] rounded-t-3xl border-t border-x border-amber-300/12 overflow-hidden flex flex-col animate-slide-up"
            style={{
              maxHeight: 'min(calc(100dvh - 8px), calc(100vh - 8px - env(safe-area-inset-bottom, 0px)))',
              transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
              transition: isDragging ? 'none' : 'transform 0.2s ease-out',
            }}
            tabIndex={-1}
          >
            {/* Drag handle */}
            <div className="journey-sheet__handle flex justify-center py-3 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full bg-amber-200/30" />
            </div>

            {/* Header */}
            <div className="journey-sheet__header flex items-center justify-between px-5 pb-3">
              <div className="flex items-center gap-2">
                <h2
                  id="journey-sheet-title"
                  className="flex items-center gap-2 text-sm font-medium text-amber-100"
                >
                  <Sparkle className="h-3 w-3" />
                  Your Reading Journey
                </h2>
                {scopeLabel && (
                  <span className="rounded-full border border-amber-200/15 bg-amber-200/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100/70">
                    {scopeChipLabel} · {sourceLabel}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Link
                  to="/account#analytics"
                  className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-amber-100/60 hover:text-amber-100 hover:bg-amber-200/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50 transition-colors"
                  aria-label="Journey settings"
                >
                  <Gear className="h-5 w-5" />
                </Link>
                <button
                  ref={closeButtonRef}
                  onClick={handleClose}
                  className="
                    flex items-center justify-center
                    min-h-[44px] min-w-[44px] -mr-2
                    rounded-lg text-amber-100/60
                    hover:text-amber-100 hover:bg-amber-200/10
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50
                    transition-colors
                  "
                  aria-label="Close journey panel"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Tabs with proper touch targets */}
            <div className="flex border-b border-amber-200/10 px-5" role="tablist">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  aria-controls={`journey-tabpanel-${tab.key}`}
                  className={`
                    flex items-center justify-center gap-1.5
                    px-4 py-3 min-h-[44px]
                    text-xs font-medium
                    border-b-2 transition-colors
                    ${
                      activeTab === tab.key
                        ? 'border-amber-400 text-amber-100'
                        : 'border-transparent text-amber-100/60 hover:text-amber-100/80'
                    }
                  `}
                >
                  <tab.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content with safe area padding and overscroll containment */}
            <div
              className="journey-sheet__body flex-1 overflow-y-auto p-5 space-y-4 overscroll-contain"
              style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 1.25rem))' }}
              role="tabpanel"
              id={`journey-tabpanel-${activeTab}`}
              aria-labelledby={`journey-tab-${activeTab}`}
            >
              {activeTab === 'cards' && (
                <>
                  <CardsCallingYou cards={cardFrequency} badges={badges} />
                  {badges.length > 0 && <AchievementsRow badges={badges} />}
                  {majorArcanaMap.some((m) => m.count > 0) && (
                    <MajorArcanaMap data={majorArcanaMap} />
                  )}
                </>
              )}

              {activeTab === 'patterns' && (
                <>
                  {contextBreakdown.length > 0 && (
                    <ContextBreakdown
                      data={contextBreakdown}
                      preferenceDrift={preferenceDrift}
                    />
                  )}
                  {themes.length > 0 && (
                    <div>
                      <p className="text-xs text-amber-100/60 mb-2">Recent Themes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {themes.slice(0, 4).map((theme, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-amber-200/10 px-2.5 py-1 text-xs text-amber-100/80"
                          >
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {cadence.length > 0 && <CadenceSection data={cadence} />}
                  {journeyStory && <JourneyStorySection story={journeyStory} />}
                </>
              )}

              {activeTab === 'summary' && (
                <JournalSummarySection
                  isAuthenticated={isAuthenticated}
                  entryCount={allEntries?.length || 0}
                  filteredEntries={filteredEntries}
                  filtersApplied={filtersApplied}
                />
              )}

              {activeTab === 'export' && (
                <ExportSection
                  isAuthenticated={isAuthenticated}
                  onCreateShareLink={onCreateShareLink}
                  scopeEntries={scopeEntries}
                  filteredEntries={filteredEntries}
                  allEntries={allEntries}
                  stats={exportStats}
                  scopeLabel={scopeLabel}
                  filtersApplied={filtersApplied}
                  analyticsScope={analyticsScope}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
