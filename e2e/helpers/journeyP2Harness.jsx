/* global window, document */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext.jsx';
import { SubscriptionProvider, useSubscription } from '../../src/contexts/SubscriptionContext.jsx';
import { useJournal } from '../../src/hooks/useJournal.js';
import { useJournalFilters } from '../../src/hooks/useJournalFilters.js';
import { useJournalAnalytics } from '../../src/hooks/useJournalAnalytics.js';
import { useJourneyData } from '../../src/hooks/useJourneyData.js';
import ExportSection from '../../src/components/ReadingJourney/sections/ExportSection.jsx';
import SeasonSummary from '../../src/components/ReadingJourney/sections/SeasonSummary.jsx';
import CadenceSection from '../../src/components/ReadingJourney/sections/CadenceSection.jsx';

let overrides = {};
const h = React.createElement;
function Probe() {
  const auth = useAuth();
  const subscription = useSubscription();
  const journal = useJournal({ completeHistory: true });
  const entries = overrides.entries ?? journal.entries;
  const filters = useJournalFilters(entries, { isAuthenticated: auth.isAuthenticated, userId: auth.user?.id,
    canUseCloudJournal: subscription.canUseCloudJournal, completeHistory: true });
  const analytics = useJournalAnalytics(entries, filters.filteredEntries, filters.filters, { timeframeWindow: filters.timeframeWindow });
  const journey = useJourneyData({
    entries, filteredEntries: filters.filteredEntries, filtersActive: analytics.journeyFiltersActive,
    seasonWindow: analytics.scopeWindow, scopeEntries: analytics.scopedStatsEntries,
    isAuthenticated: auth.isAuthenticated, userId: auth.user?.id, canUseCloudJournal: subscription.canUseCloudJournal,
  });
  Object.assign(window.journeyP2, {
    value: { journey, analytics, entries, filteredEntries: filters.filteredEntries, ready: !auth.loading && !journal.loading },
    setScope: analytics.setAnalyticsScope,
    setDate: analytics.setCustomScope,
    setFilters: filters.setFilters,
    saveEntry: journal.saveEntry,
    deleteEntry: journal.deleteEntry,
    reload: journal.reload,
  });
  return h(React.Fragment, null,
    h('output', { 'data-testid': 'scope-label' }, analytics.scopeLabel),
    h('output', { 'data-testid': 'scope-error' }, analytics.scopeError),
    h(SeasonSummary, { narrative: journey.seasonNarrative, topCard: journey.cardFrequency[0],
      totalReadings: journey.totalReadings, currentStreak: journey.currentStreak,
      seasonWindow: journey.seasonWindow, scopeLabel: analytics.scopeLabel,
      hasHistory: entries.length > 0, onScopeSelect: analytics.setAnalyticsScope }),
    h(CadenceSection, { data: journey.cadence }),
    h(ExportSection, { allEntries: entries, filteredEntries: filters.filteredEntries,
      scopeEntries: analytics.scopedStatsEntries, scopeLabel: analytics.scopeLabel,
      stats: analytics.scopeStats, filtersApplied: filters.filtersActive,
      isAuthenticated: auth.isAuthenticated }),
  );
}
const root = createRoot(document.getElementById('root'));
function render() {
  flushSync(() => root.render(h(AuthProvider, null, h(SubscriptionProvider, null, h(Probe)))));
}
window.journeyP2 = { patch(update) { overrides = { ...overrides, ...update }; render(); } };
render();
