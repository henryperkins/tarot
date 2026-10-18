import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext.jsx';
import { SubscriptionProvider, useSubscription } from '../../src/contexts/SubscriptionContext.jsx';
import { useJournal } from '../../src/hooks/useJournal.js';
import { useJourneyData } from '../../src/hooks/useJourneyData.js';
import { useJournalFilters } from '../../src/hooks/useJournalFilters.js';
import ExportSection from '../../src/components/ReadingJourney/sections/ExportSection.jsx';
import BackfillBanner from '../../src/components/ReadingJourney/sections/BackfillBanner.jsx';

const h = React.createElement;
let props = { seasonWindow: { start: new Date(2000, 0, 1), end: new Date(2100, 0, 1) } };
function Probe(overrides) {
  const auth = useAuth();
  const subscription = useSubscription();
  const journal = useJournal({ completeHistory: true });
  const entries = overrides.entries || journal.entries;
  const filters = useJournalFilters(entries, { isAuthenticated: auth.isAuthenticated, userId: auth.user?.id,
    canUseCloudJournal: subscription.canUseCloudJournal, completeHistory: journal.syncSource === 'api' });
  const options = {
    entries, filteredEntries: filters.filteredEntries, filtersActive: filters.filtersActive,
    isAuthenticated: auth.isAuthenticated, userId: auth.user?.id,
    canUseCloudJournal: subscription.canUseCloudJournal,
    ...overrides
  };
  const journey = useJourneyData(options);
  window.journeyP1.value = { ...journey, entries, authLoading: auth.loading, journalLoading: journal.loading, syncSource: journal.syncSource };
  window.journeyP1.setFilters = filters.setFilters;
  window.journeyP1.backfill = journey.handleBackfill;
  window.journeyP1.checkAuth = () => auth.checkAuth('/journal');
  return h(React.Fragment, null,
    h('output', { 'data-testid': 'journey-state' }, JSON.stringify({
      authLoading: auth.loading, journalLoading: journal.loading,
      loaded: entries.length, total: journey.totalReadings, needsBackfill: journey.needsBackfill,
      disabled: journey.isAnalyticsDisabled, loading: journey.isLoading, busy: journey.isBackfilling,
      filteredIds: filters.filteredEntries.map(entry => entry.id)
    })),
    journey.needsBackfill && h(BackfillBanner, { userId: options.userId, onBackfill: () => journey.handleBackfill(),
      isBackfilling: journey.isBackfilling, backfillResult: journey.backfillResult }),
    h(ExportSection, { allEntries: entries, filteredEntries: filters.filteredEntries, scopeEntries: journey.scopedEntries,
      stats: journey.exportStats, scopeLabel: 'All time', isAuthenticated: auth.isAuthenticated })
  );
}
const root = createRoot(document.getElementById('root'));
function render() {
  flushSync(() => root.render(h(AuthProvider, null, h(SubscriptionProvider, null, h(Probe, props)))));
}
window.journeyP1 = { patch(update) { props = { ...props, ...update }; render(); } };
render();
