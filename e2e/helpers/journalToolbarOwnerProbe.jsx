/* global document, window */
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext.jsx';
import { SubscriptionProvider } from '../../src/contexts/SubscriptionContext.jsx';
import { PreferencesProvider } from '../../src/contexts/PreferencesContext.jsx';
import { ReadingProvider } from '../../src/contexts/ReadingContext.jsx';
import { ToastProvider } from '../../src/contexts/ToastContext.jsx';
import Journal from '../../src/components/Journal.jsx';
import { JournalFilters } from '../../src/components/JournalFilters.jsx';
import { DEFAULT_FILTERS, CONTEXT_FILTERS } from '../../src/lib/journal/constants.js';

// A Vite-transformed module shares the app's React instance regardless of its
// optimizer cache path. The probe is imported only by the owner-transition test.
export function mountOwnerProbe(kind) {
  const original = document.getElementById('root');
  original.hidden = true;
  original.inert = true;
  const host = document.createElement('div');
  host.id = 'toolbar-owner-probe';
  document.body.append(host);
  const root = createRoot(host);
  const cleanup = () => {
    root.unmount(); host.remove(); original.hidden = false; original.inert = false;
  };

  function ToolbarProbe({ ownerId }) {
    window.__toolbarOwnerProbe = { owner: ownerId => root.render(<ToolbarProbe ownerId={ownerId} />), cleanup };
    return <JournalFilters ownerId={ownerId} filters={DEFAULT_FILTERS} contexts={CONTEXT_FILTERS}
      onChange={() => {}} onSortOrderChange={() => {}} onViewModeChange={() => {}} />;
  }

  function JournalProbe() {
    const auth = useAuth();
    window.__toolbarOwnerProbe = {
      owner: id => id ? auth.login(id, 'synthetic-fixture') : auth.logout(), cleanup
    };
    return <><output data-probe-owner>{auth.user?.id || 'guest'}</output><Journal /></>;
  }

  root.render(kind === 'toolbar' ? <ToolbarProbe ownerId="owner-a" />
    : [AuthProvider, SubscriptionProvider, PreferencesProvider, ReadingProvider, ToastProvider, MemoryRouter]
      .reduceRight((child, Provider) => <Provider>{child}</Provider>, <JournalProbe />));
}
