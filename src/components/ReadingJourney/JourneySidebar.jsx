/**
 * JourneySidebar - Desktop sidebar variant for ReadingJourney.
 *
 * Displays unified analytics in a condensed sidebar layout with
 * collapsible sections for Cards, Patterns, and Export.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Sparkle,
  CaretDown,
  CaretUp,
  TrendUp,
  ChartBar,
  Export,
  Fire,
  Gear,
  Info
} from '@phosphor-icons/react';
import { Tooltip } from '../Tooltip';
import SeasonSummary from './sections/SeasonSummary';
import CardsCallingYou from './sections/CardsCallingYou';
import ContextBreakdown from './sections/ContextBreakdown';
import PatternsSnapshotPanel from './sections/PatternsSnapshotPanel';
import MajorArcanaMap from './sections/MajorArcanaMap';
import AchievementsRow from './sections/AchievementsRow';
import CadenceSection from './sections/CadenceSection';
import JourneyStorySection from './sections/JourneyStorySection';
import ExportSection from './sections/ExportSection';
import JournalSummarySection from './sections/JournalSummarySection';
import EmptyState from './sections/EmptyState';
import BackfillBanner from './sections/BackfillBanner';
import PatternAlertBanner from '../PatternAlertBanner';
import { usePreferences } from '../../contexts/PreferencesContext';
import { recordCoachQuestion } from '../../lib/coachStorage';
import { getCoachSuggestionSearchQuery } from '../../lib/coachSuggestionUtils';
import { usePatternsSnapshot } from './hooks/usePatternsSnapshot';

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
    <div className="border-t border-[color:var(--border-warm-subtle)]">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between min-h-touch py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg-main)] touch-manipulation"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-high">
          <Icon className="h-4 w-4 sm:h-3 sm:w-3" aria-hidden="true" />
          {label}
          {badge && (
            <span className="ml-1 rounded-full bg-[color:var(--accent-25)] px-1.5 py-0.5 text-2xs font-medium text-[color:var(--text-main)]">
              {badge}
            </span>
          )}
        </span>
        {isOpen ? (
          <CaretUp className="h-4 w-4 sm:h-3 sm:w-3 text-muted" />
        ) : (
          <CaretDown className="h-4 w-4 sm:h-3 sm:w-3 text-muted" />
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
  reversalRateReliable,
  reversalRateSample,
  currentStreak,
  cardFrequencyReliable,
  cardFrequencySample,
  seasonNarrative,
  journeyStory,
  coachSuggestion,
  coachSuggestions,
  activeCoachIndex = 0,
  onCoachSelect,
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
  userId,
  onCreateShareLink,
  onStartReading,
  showStartReadingCta = true,
  locale = 'default',
  timezone,
  seasonTimezone,
  _dataSource,
  variant: _variant = 'sidebar',
  scopeLabel,
  filtersApplied,
  analyticsScope,
  onScopeSelect,
}) {
  const navigate = useNavigate();
  const { resetOnboarding, setShowPersonalizationBanner } = usePreferences();
  const streakGraceTooltip = 'Counts from yesterday if no reading today (grace period).';
  const streakInfoButtonClass =
    'text-muted hover:text-main focus-visible:ring-[color:var(--focus-ring-color)] -ml-2 -mr-2';
  // Section open/close state
  const [openSections, setOpenSections] = useState({
    cards: true,
    patterns: false,
    summary: false,
    export: false,
  });
  const activeCoachSuggestion = Array.isArray(coachSuggestions) && coachSuggestions.length > 0
    ? coachSuggestions[Math.min(activeCoachIndex, coachSuggestions.length - 1)]
    : coachSuggestion;
  const [showAllPatterns, setShowAllPatterns] = useState(false);
  const [saveNotice, setSaveNotice] = useState(false);
  const [saveError, setSaveError] = useState('');

  const abortControllerRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  const clearSaveTimeout = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => clearSaveTimeout(), [clearSaveTimeout]);

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

  const handleSaveIntention = useCallback((suggestion = activeCoachSuggestion) => {
    const question = suggestion?.question || suggestion?.text;
    const trimmed = typeof question === 'string' ? question.trim() : '';
    if (!trimmed) return;
    const result = recordCoachQuestion(trimmed, undefined, userId);
    clearSaveTimeout();
    if (result.success) {
      setSaveNotice(true);
      setSaveError('');
      saveTimeoutRef.current = setTimeout(() => {
        setSaveNotice(false);
      }, 1800);
    } else {
      setSaveNotice(false);
      setSaveError(result.error || 'Unable to save this intention right now.');
      saveTimeoutRef.current = setTimeout(() => {
        setSaveError('');
      }, 3000);
    }
  }, [activeCoachSuggestion, clearSaveTimeout, userId]);

  const handleOpenJournal = useCallback((suggestion = activeCoachSuggestion) => {
    const query = getCoachSuggestionSearchQuery(suggestion);
    if (query) {
      navigate('/journal', { state: { prefillQuery: query } });
      return;
    }
    navigate('/journal');
  }, [activeCoachSuggestion, navigate]);

  const handleSetFocusAreas = useCallback(() => {
    resetOnboarding();
    setShowPersonalizationBanner(false);
    navigate('/');
  }, [navigate, resetOnboarding, setShowPersonalizationBanner]);

  const scopeChipLabel = analyticsScope === 'filters' && filtersActive ? 'Filtered' : (scopeLabel || 'Scope');
  const sourceLabel = _dataSource === 'server' ? 'D1' : 'Journal';

  // Use shared patterns snapshot hook
  const {
    timeframeLabel,
    formattedSeasonWindow,
    hasMoreContexts: _hasMoreContexts,
    hasMoreThemes: _hasMoreThemes,
    hasMorePatterns,
  } = usePatternsSnapshot({
    scopeLabel,
    seasonWindow,
    locale,
    timezone,
    seasonTimezone,
    filtersActive,
    analyticsScope,
    contextBreakdown,
    themes,
  });

  const handlePatternsToggle = useCallback(() => {
    setShowAllPatterns((prev) => !prev);
  }, []);

  // Show loading skeleton
  if (isLoading) {
    return (
      <div className="panel-mystic bg-gradient-ambient rounded-3xl p-5 animate-pulse">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-[color:var(--border-warm-light)]" />
            <div className="h-3 w-28 rounded bg-[color:var(--border-warm-light)]" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-[color:var(--border-warm-subtle)]" />
            <div className="h-4 w-3/4 rounded bg-[color:var(--border-warm-subtle)]" />
          </div>
        </div>
      </div>
    );
  }

  // Show "no results for filter" when filters yield empty but user has entries
  if (isFilteredEmpty) {
    return (
      <section
        className="panel-mystic bg-gradient-ambient rounded-3xl p-5"
        aria-labelledby="reading-journey-filtered-empty"
      >
        <div className="relative z-10 text-center py-6">
          <h3
            id="reading-journey-filtered-empty"
            className="mb-3 flex items-center justify-center gap-2 journal-eyebrow text-muted-high"
          >
            <Sparkle className="h-3 w-3" aria-hidden="true" />
            Your Reading Journey
            <span className="text-2xs text-muted">(filtered)</span>
          </h3>
          <p className="text-sm text-muted-high mb-2">
            No readings match your current filters.
          </p>
          <p className="text-xs text-muted">
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
        className="panel-mystic bg-gradient-ambient rounded-3xl p-5"
        aria-labelledby="reading-journey-disabled"
      >
        <div className="relative z-10 text-center py-6">
          <h3
            id="reading-journey-disabled"
            className="mb-3 flex items-center justify-center gap-2 journal-eyebrow text-muted-high"
          >
            <Sparkle className="h-3 w-3" aria-hidden="true" />
            Your Reading Journey
          </h3>
          <p className="text-sm text-muted-high mb-2">
            Journey analytics are currently disabled.
          </p>
          <p className="text-xs text-muted">
            You can enable them in your account settings to track card patterns and reading insights.
          </p>
          <button
            type="button"
            onClick={() => navigate('/account#analytics')}
            className="mt-4 inline-flex min-h-touch items-center justify-center rounded-full border border-[color:var(--border-warm-light)] px-4 py-2 text-sm font-semibold text-[color:var(--text-main)] transition-[background-color,border-color] duration-[var(--duration-normal)] ease-[var(--ease-out)] hover:bg-[color:var(--border-warm-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
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
      className="panel-mystic bg-gradient-ambient rounded-3xl p-5"
      aria-labelledby="reading-journey-heading"
    >
      {/* Decorative background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60 mix-blend-screen"
        aria-hidden="true"
        style={{
          backgroundImage:
            'radial-gradient(circle at 14% 18%, var(--glow-gold), transparent 32%), radial-gradient(circle at 86% 26%, var(--glow-blue), transparent 30%), radial-gradient(circle at 60% 78%, var(--glow-pink), transparent 32%)',
        }}
      />
      <div
        className="pointer-events-none absolute -left-24 top-8 h-64 w-64 rounded-full bg-[color:var(--glow-gold)] blur-[110px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-[-120px] top-1/3 h-72 w-72 rounded-full bg-[color:var(--glow-blue)] blur-[110px]"
        aria-hidden="true"
      />

      <div className="relative z-10 space-y-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3
            id="reading-journey-heading"
            className="flex items-center gap-2 journal-eyebrow text-muted-high"
          >
            <Sparkle className="h-3 w-3" aria-hidden="true" />
            Your Reading Journey
            {scopeLabel && (
              <span className="ml-2 rounded-full border border-[color:var(--border-warm-light)] bg-[color:var(--border-warm-subtle)] px-2 py-0.5 text-2xs font-semibold uppercase tracking-[0.16em] text-muted-high">
                {scopeChipLabel} · {sourceLabel}
              </span>
            )}
          </h3>
          <Link
            to="/account#analytics"
            className="flex items-center justify-center w-8 h-8 rounded-full text-muted hover:text-main hover:bg-[color:var(--border-warm-subtle)] transition-colors"
            aria-label="Journey settings"
            title="Settings"
          >
            <Gear className="w-4 h-4" />
          </Link>
        </div>
        {filtersApplied && analyticsScope !== 'filters' && typeof onScopeSelect === 'function' && (
          <div className="flex flex-wrap items-center gap-2 rounded-full border border-[color:var(--border-warm)] bg-[color:var(--accent-25)] px-3 py-1 text-2xs text-muted-high">
            <span>Filters not applied to insights</span>
            <button
              type="button"
              onClick={() => onScopeSelect('filters')}
              className="font-semibold text-[color:var(--text-main)] underline underline-offset-2 hover:text-[color:var(--text-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
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
            userId={userId}
            variant="compact"
          />
        )}

        {/* Season Summary (always visible) */}
        <SeasonSummary
          narrative={seasonNarrative}
          topCard={cardFrequency[0]}
          cardFrequencyReliable={cardFrequencyReliable}
          currentStreak={currentStreak}
          totalReadings={totalReadings}
          topContext={[...contextBreakdown].sort((a, b) => b.count - a.count)[0]}
          contextBreakdown={contextBreakdown}
          preferenceDrift={preferenceDrift}
          coachSuggestion={activeCoachSuggestion}
          coachSuggestions={coachSuggestions}
          activeCoachIndex={activeCoachIndex}
          onCoachSelect={onCoachSelect}
          onStartReading={onStartReading}
          onSaveIntention={handleSaveIntention}
          onOpenJournal={handleOpenJournal}
          onSetFocusAreas={handleSetFocusAreas}
          saveNotice={saveNotice}
          saveError={saveError}
          showStartReadingCta={showStartReadingCta}
          filtersActive={filtersActive}
          scopeLabel={scopeLabel}
          focusAreasCtaLabel={preferenceDrift?.hasDrift || preferenceDrift?.hasEmerging ? 'Update focus areas' : ''}
          locale={locale}
          timezone={seasonTimezone || timezone}
          seasonWindow={seasonWindow}
        />

        {/* Stats row */}
        <div className="flex flex-wrap gap-3 text-center">
          <div className="flex-1 min-w-[60px] rounded-lg bg-[color:var(--border-warm-subtle)] px-3 py-2">
            <p className="text-lg font-medium text-main">{totalReadings}</p>
            <p className="text-xs text-muted">readings</p>
          </div>
          <div className="flex-1 min-w-[60px] rounded-lg bg-[color:var(--border-warm-subtle)] px-3 py-2">
            <p className="text-lg font-medium text-main">{totalCards}</p>
            <p className="text-xs text-muted">cards</p>
          </div>
          {currentStreak > 0 && (
            <div className="flex-1 min-w-[60px] rounded-lg bg-[color:var(--border-warm-subtle)] px-3 py-2">
              <p className="text-lg font-medium text-main flex items-center justify-center gap-1">
                <Fire className="h-3.5 w-3.5 text-[color:var(--brand-primary)]" />
                {currentStreak}
              </p>
              <p className="text-xs text-muted flex items-center justify-center gap-1">
                streak
                <Tooltip
                  content={streakGraceTooltip}
                  position="top"
                  triggerClassName={streakInfoButtonClass}
                  ariaLabel="About streak grace period"
                >
                  <Info className="h-3 w-3" />
                </Tooltip>
              </p>
            </div>
          )}
          {reversalRateSample > 0 && (
            <div className="flex-1 min-w-[60px] rounded-lg bg-[color:var(--border-warm-subtle)] px-3 py-2">
              <p className="text-lg font-medium text-main">
                {reversalRateReliable ? `${reversalRate}%` : 'Emerging'}
              </p>
              <p className="text-xs text-muted">
                {reversalRateReliable ? 'reversed' : `${reversalRateSample} cards`}
              </p>
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
              <CardsCallingYou
                cards={cardFrequency}
                badges={badges}
                isEmerging={cardFrequencyReliable === false}
                sampleSize={cardFrequencySample || totalReadings}
              />

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
                  <p className="text-xs text-muted mb-2">Recent Themes</p>
                  <div className="flex flex-wrap gap-1.5">
                    {themes.slice(0, 4).map((theme, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-[color:var(--border-warm-subtle)] px-2.5 py-1 text-xs text-muted-high"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Single "View full patterns" / "Hide patterns" button */}
              {hasMorePatterns && (
                <button
                  type="button"
                  onClick={handlePatternsToggle}
                  aria-expanded={showAllPatterns}
                  className="text-xs font-semibold text-[color:var(--text-accent)] hover:text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-color)]"
                >
                  {showAllPatterns ? 'Hide patterns' : 'View full patterns'}
                </button>
              )}

              {/* Expanded patterns snapshot using shared component */}
              {showAllPatterns && hasMorePatterns && (
                <PatternsSnapshotPanel
                  timeframeLabel={timeframeLabel}
                  formattedSeasonWindow={formattedSeasonWindow}
                  contextBreakdown={contextBreakdown}
                  themes={themes}
                  preferenceDrift={preferenceDrift}
                  onClose={handlePatternsToggle}
                />
              )}

              {/* Reading Cadence */}
              {cadence.length > 0 && <CadenceSection data={cadence} variant="sidebar" />}

              {/* Journey Story */}
              {journeyStory && <JourneyStorySection story={journeyStory} />}
            </div>
          </CollapsibleSection>

          {/* AI Summary Section - only for authenticated users */}
          {isAuthenticated && (
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
          )}

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
            preferenceDrift={preferenceDrift}
            scopeLabel={scopeLabel}
            filtersApplied={filtersApplied}
          />
        </CollapsibleSection>
        </div>
      </div>
    </section>
  );
}
