import React, { useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext.jsx';
import { PreferencesProvider } from '../../src/contexts/PreferencesContext.jsx';
import { SubscriptionProvider } from '../../src/contexts/SubscriptionContext.jsx';
import { useTarotState } from '../../src/hooks/useTarotState.js';

const queued = [];
function Probe() {
  const state = useTarotState();
  const auth = useAuth();
  useLayoutEffect(() => {
    window.shuffleTest = {
      shuffle() {
        const schedule = window.setTimeout;
        window.setTimeout = (callback, delay, ...args) => {
          if (delay === 1200) queued.push(callback);
          return schedule(callback, delay, ...args);
        };
        try { flushSync(() => state.shuffle()); }
        finally { window.setTimeout = schedule; }
      },
      reset: () => flushSync(() => state.resetReadingState()),
      select: key => flushSync(() => state.selectSpread(key)),
      logout: auth.logout,
      refreshOwner: auth.checkAuth,
      fireObsolete: () => flushSync(() => queued[0]()),
      unmount: () => root.unmount()
    };
  });
  return React.createElement('output', { 'data-testid': 'shuffle-state' }, JSON.stringify({
    reading: state.reading?.map(card => card.name) ?? null,
    scope: state.drawIncludeMinors, shuffling: state.isShuffling,
    owner: state.snapshotOwner, authLoading: auth.loading,
    seed: state.sessionSeed, knocked: state.hasKnocked, cut: state.hasCut
  }));
}

const root = createRoot(document.getElementById('root'));
root.render(React.createElement(React.StrictMode, null,
  React.createElement(AuthProvider, null,
    React.createElement(PreferencesProvider, null,
      React.createElement(SubscriptionProvider, null, React.createElement(Probe))))));
