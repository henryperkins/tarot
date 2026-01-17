/**
 * JourneySidebar - Desktop sidebar variant for ReadingJourney.
 *
 * Displays unified analytics in a condensed sidebar layout with
 * collapsible sections for Cards, Patterns, and Export.
 */

import { useState, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Sparkle,
  CaretDown,
  CaretUp,
  TrendUp,
  ChartBar,
  Export,
  Fire,
  Gear
} from '@phosphor-icons/react';
import SeasonSummary from './sections/SeasonSummary';
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
import PatternAlertBanner from '../PatternAlertBanner';

/**
 * CollapsibleSection - Expandable section wrapper.
 */
function CollapsibleSection({
  isOpen,
  onToggle,
  icon: Icon,
  label,
  children,
  badge,
}) {
  return (
    <div className="border-t border-amber-200/10">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between min-h-[44px] py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0c1d] touch-manipulation"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-200/75">
          <Icon className="h-4 w-4 sm:h-3 sm:w-3" aria-hidden="true" />
          {label}
          {badge && (
            <span className="ml-1 rounded-full bg-amber-300/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-100">
              {badge}
            </span>
          )}
        </span>
        {isOpen ? (
          <CaretUp className="h-4 w-4 sm:h-3 sm:w-3 text-amber-200/50" />
        ) : (
          <CaretDown className="h-4 w-4 sm:h-3 sm:w-3 text-amber-200/50" />
        )}
      </button>
      {isOpen && <div className="pb-4">{children}</div>}
    </div>
  );
}

/**
 * JourneySidebar - Main desktop sidebar component.
 */
export default function JourneySidebar({
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
  reversalRate,
  currentStreak,
  seasonNarrative,
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
  variant: _variant = 'sidebar',
  scopeLabel,
  filtersApplied,
  analyticsScope,
  onScopeSelect,
}) {
  const navigate = useNavigate();
  // Section open/close state
  const [openSections, setOpenSections] = useState({
    cards: true,
    patterns: false,
    summary: false,
    export: false,
  });

  const abortControllerRef = useRef(null);

  const toggleSection = useCallback((key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleBackfillClick = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    handleBackfill(abortControllerRef.current.signal);
  }, [handleBackfill]);
  const scopeChipLabel = analyticsScope === 'filters' && filtersActive ? 'Filtered' : (scopeLabel || 'Scope');
  const sourceLabel = _dataSource === 'server' ? 'D1' : 'Journal';

  // Show loading skeleton
  if (isLoading) {
    return (
      <div className="animate-pulse rounded-3xl border border-amber-300/12 bg-gradient-to-br from-[#0b0c1d] via-[#0d1024] to-[#090a16] p-5">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-amber-200/25" />
            <div className="h-3 w-28 rounded bg-amber-200/25" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-amber-200/15" />
            <div className="h-4 w-3/4 rounded bg-amber-200/15" />
          </div>
        </div>
      </div>
    );
  }

  // Show "no results for filter" when filters yield empty but user has entries
  if (isFilteredEmpty) {
    return (
      <section
        className="relative overflow-hidden rounded-3xl border border-amber-300/12 bg-gradient-to-br from-[#0b0c1d] via-[#0d1024] to-[#090a16] p-5"
        aria-labelledby="reading-journey-filtered-empty"
      >
        <div className="relative z-10 text-center py-6">
          <h3
            id="reading-journey-filtered-empty"
            className="mb-3 flex items-center justify-center gap-2 journal-eyebrow text-amber-100/70"
          >
            <Sparkle className="h-3 w-3" aria-hidden="true" />
            Your Reading Journey
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
        aria-labelledby="reading-journey-disabled"
      >
        <div className="relative z-10 text-center py-6">
          <h3
            id="reading-journey-disabled"
            className="mb-3 flex items-center justify-center gap-2 journal-eyebrow text-amber-100/70"
          >
            <Sparkle className="h-3 w-3" aria-hidden="true" />
            Your Reading Journey
          </h3>
          <p className="text-sm text-amber-100/70 mb-2">
            Journey analytics are currently disabled.
          </p>
          <p className="text-xs text-amber-100/50">
            You can enable them in your account settings to track card patterns and reading insights.
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

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-amber-300/12 bg-gradient-to-br from-[#0b0c1d] via-[#0d1024] to-[#090a16] p-5 shadow-[0_24px_68px_-30px_rgba(0,0,0,0.9)]"
      aria-labelledby="reading-journey-heading"
    >
      {/* Decorative background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60 mix-blend-screen"
        aria-hidden="true"
        style={{
          backgroundImage:
            'radial-gradient(circle at 14% 18%, rgba(251,191,36,0.08), transparent 32%), radial-gradient(circle at 86% 26%, rgba(56,189,248,0.07), transparent 30%), radial-gradient(circle at 60% 78%, rgba(167,139,250,0.08), transparent 32%)',
        }}
      />
      <div
        className="pointer-events-none absolute -left-24 top-8 h-64 w-64 rounded-full bg-amber-500/12 blur-[110px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-[-120px] top-1/3 h-72 w-72 rounded-full bg-cyan-400/10 blur-[110px]"
        aria-hidden="true"
      />

      <div className="relative z-10 space-y-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3
            id="reading-journey-heading"
            className="flex items-center gap-2 journal-eyebrow text-amber-100/70"
          >
            <Sparkle className="h-3 w-3" aria-hidden="true" />
            Your Reading Journey
            {scopeLabel && (
              <span className="ml-2 rounded-full border border-amber-200/15 bg-amber-200/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100/70">
                {scopeChipLabel} · {sourceLabel}
              </span>
            )}
          </h3>
          <Link
            to="/account#analytics"
            className="flex items-center justify-center w-8 h-8 rounded-full text-amber-100/50 hover:text-amber-100 hover:bg-amber-200/10 transition"
            aria-label="Journey settings"
            title="Settings"
          >
            <Gear className="w-4 h-4" />
          </Link>
        </div>
        {filtersApplied && analyticsScope !== 'filters' && typeof onScopeSelect === 'function' && (
          <div className="flex flex-wrap items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[11px] text-amber-100/80">
            <span>Filters not applied to insights</span>
            <button
              type="button"
              onClick={() => onScopeSelect('filters')}
              className="font-semibold text-amber-50 underline underline-offset-2 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/40"
            >
              Apply filters
            </button>
          </div>
        )}

        {/* Pattern Alerts */}
        <PatternAlertBanner isAuthenticated={isAuthenticated} />

        {/* Backfill banner - shown when D1 sync is needed but doesn't block insights */}
        {needsBackfill && !hasBackfilled && (
          <BackfillBanner
            onBackfill={handleBackfillClick}
            isBackfilling={isBackfilling}
            backfillResult={backfillResult}
            variant="compact"
          />
        )}

        {/* Season Summary (always visible) */}
        <SeasonSummary
          narrative={seasonNarrative}
          topCard={cardFrequency[0]}
          currentStreak={currentStreak}
          totalReadings={totalReadings}
          topContext={[...contextBreakdown].sort((a, b) => b.count - a.count)[0]}
          coachSuggestion={coachSuggestion}
          onStartReading={onStartReading}
          showStartReadingCta={showStartReadingCta}
          locale={locale}
          timezone={timezone}
          seasonWindow={seasonWindow}
        />

        {/* Stats row */}
        <div className="flex flex-wrap gap-3 text-center">
          <div className="flex-1 min-w-[60px] rounded-lg bg-amber-200/5 px-3 py-2">
            <p className="text-lg font-medium text-amber-50">{totalReadings}</p>
            <p className="text-xs text-amber-100/60">readings</p>
          </div>
          <div className="flex-1 min-w-[60px] rounded-lg bg-amber-200/5 px-3 py-2">
            <p className="text-lg font-medium text-amber-50">{totalCards}</p>
            <p className="text-xs text-amber-100/60">cards</p>
          </div>
          {currentStreak > 0 && (
            <div className="flex-1 min-w-[60px] rounded-lg bg-amber-200/5 px-3 py-2">
              <p className="text-lg font-medium text-amber-50 flex items-center justify-center gap-1">
                <Fire className="h-3.5 w-3.5 text-orange-400" />
                {currentStreak}
              </p>
              <p className="text-xs text-amber-100/60">streak</p>
            </div>
          )}
          {reversalRate > 0 && (
            <div className="flex-1 min-w-[60px] rounded-lg bg-amber-200/5 px-3 py-2">
              <p className="text-lg font-medium text-amber-50">{reversalRate}%</p>
              <p className="text-xs text-amber-100/60">reversed</p>
            </div>
          )}
        </div>

        {/* Collapsible sections */}
        <div className="mt-2">
          {/* Cards Section */}
          <CollapsibleSection
            isOpen={openSections.cards}
            onToggle={() => toggleSection('cards')}
            icon={TrendUp}
            label="Cards Calling You"
            badge={cardFrequency.length > 0 ? cardFrequency.length : null}
          >
            <div className="space-y-4">
              <CardsCallingYou cards={cardFrequency} badges={badges} />

              {/* Achievements row */}
              {badges.length > 0 && (
                <div className="mt-4">
                  <AchievementsRow badges={badges} />
                </div>
              )}

              {/* Major Arcana Map */}
              {majorArcanaMap.some((m) => m.count > 0) && (
                <div className="mt-4">
                  <MajorArcanaMap data={majorArcanaMap} />
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Patterns Section */}
          <CollapsibleSection
            isOpen={openSections.patterns}
            onToggle={() => toggleSection('patterns')}
            icon={ChartBar}
            label="Patterns & Themes"
          >
            <div className="space-y-4">
              {/* Context Breakdown */}
              {contextBreakdown.length > 0 && (
                <ContextBreakdown
                  data={contextBreakdown}
                  preferenceDrift={preferenceDrift}
                />
              )}

              {/* Themes */}
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

              {/* Reading Cadence */}
              {cadence.length > 0 && <CadenceSection data={cadence} variant="sidebar" />}

              {/* Journey Story */}
              {journeyStory && <JourneyStorySection story={journeyStory} />}
            </div>
          </CollapsibleSection>

          {/* AI Summary Section */}
          <CollapsibleSection
            isOpen={openSections.summary}
            onToggle={() => toggleSection('summary')}
            icon={Sparkle}
            label="AI Summary"
          >
          <JournalSummarySection
            isAuthenticated={isAuthenticated}
            entryCount={allEntries?.length || 0}
            filteredEntries={filteredEntries}
            filtersApplied={filtersApplied}
          />
          </CollapsibleSection>

          {/* Export Section */}
          <CollapsibleSection
            isOpen={openSections.export}
            onToggle={() => toggleSection('export')}
            icon={Export}
            label="Export & Share"
          >
          <ExportSection
            isAuthenticated={isAuthenticated}
            onCreateShareLink={onCreateShareLink}
            scopeEntries={scopeEntries}
            filteredEntries={filteredEntries}
            allEntries={allEntries}
            stats={exportStats}
            scopeLabel={scopeLabel}
            filtersApplied={filtersApplied}
          />
        </CollapsibleSection>
        </div>
      </div>
    </section>
  );
}
