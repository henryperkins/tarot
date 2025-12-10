/**
 * JourneySidebar - Desktop sidebar variant for ReadingJourney.
 *
 * Displays unified analytics in a condensed sidebar layout with
 * collapsible sections for Cards, Patterns, and Export.
 */

import { useState, useCallback, useRef } from 'react';
import {
  Sparkle,
  CaretDown,
  CaretUp,
  TrendUp,
  ChartBar,
  Export,
  Fire,
  Star,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import SeasonSummary from './sections/SeasonSummary';
import CardsCallingYou from './sections/CardsCallingYou';
import ContextBreakdown from './sections/ContextBreakdown';
import MajorArcanaMap from './sections/MajorArcanaMap';
import AchievementsRow from './sections/AchievementsRow';
import CadenceSection from './sections/CadenceSection';
import JourneyStorySection from './sections/JourneyStorySection';
import ExportSection from './sections/ExportSection';
import EmptyState from './sections/EmptyState';
import BackfillBanner from './sections/BackfillBanner';

// Section definitions for collapsible panels
const SECTIONS = [
  { key: 'cards', label: 'Cards Calling You', icon: TrendUp },
  { key: 'patterns', label: 'Patterns & Themes', icon: ChartBar },
  { key: 'export', label: 'Export & Share', icon: Export },
];

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
        className="flex w-full items-center justify-between py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0c1d]"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-200/75">
          <Icon className="h-3 w-3" aria-hidden="true" />
          {label}
          {badge && (
            <span className="ml-1 rounded-full bg-amber-300/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-100">
              {badge}
            </span>
          )}
        </span>
        {isOpen ? (
          <CaretUp className="h-3 w-3 text-amber-200/50" />
        ) : (
          <CaretDown className="h-3 w-3 text-amber-200/50" />
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
  activeEntries,
  exportStats,
  // Other props
  isAuthenticated,
  onCreateShareLink,
  onStartReading,
  locale = 'default',
  timezone,
  variant = 'sidebar',
}) {
  // Section open/close state
  const [openSections, setOpenSections] = useState({
    cards: true,
    patterns: false,
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
        <div className="mb-4">
          <h3
            id="reading-journey-heading"
            className="flex items-center gap-2 journal-eyebrow text-amber-100/70"
          >
            <Sparkle className="h-3 w-3" aria-hidden="true" />
            Your Reading Journey
            {filtersActive && (
              <span className="text-[10px] text-amber-100/50">(filtered)</span>
            )}
          </h3>
        </div>

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
          locale={locale}
          timezone={timezone}
          seasonWindow={seasonWindow}
        />

        {/* Stats row */}
        <div className="flex flex-wrap gap-3 text-center">
          <div className="flex-1 min-w-[60px] rounded-lg bg-amber-200/5 px-3 py-2">
            <p className="text-lg font-medium text-amber-50">{totalReadings}</p>
            <p className="text-[10px] text-amber-100/60">readings</p>
          </div>
          <div className="flex-1 min-w-[60px] rounded-lg bg-amber-200/5 px-3 py-2">
            <p className="text-lg font-medium text-amber-50">{totalCards}</p>
            <p className="text-[10px] text-amber-100/60">cards</p>
          </div>
          {currentStreak > 0 && (
            <div className="flex-1 min-w-[60px] rounded-lg bg-amber-200/5 px-3 py-2">
              <p className="text-lg font-medium text-amber-50 flex items-center justify-center gap-1">
                <Fire className="h-3.5 w-3.5 text-orange-400" />
                {currentStreak}
              </p>
              <p className="text-[10px] text-amber-100/60">streak</p>
            </div>
          )}
          {reversalRate > 0 && (
            <div className="flex-1 min-w-[60px] rounded-lg bg-amber-200/5 px-3 py-2">
              <p className="text-lg font-medium text-amber-50">{reversalRate}%</p>
              <p className="text-[10px] text-amber-100/60">reversed</p>
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
              entries={activeEntries}
              stats={exportStats}
            />
          </CollapsibleSection>
        </div>
      </div>
    </section>
  );
}
