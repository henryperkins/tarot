import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { AuthProvider, useAuth } from '../../src/contexts/AuthContext.jsx';

history.replaceState(null, '', new URLSearchParams(location.search).get('start') || '/account');

function Probe() {
  const { user, loading } = useAuth();
  return React.createElement('output', { 'data-testid': 'auth-state' }, JSON.stringify({ user, loading }));
}

const root = createRoot(document.getElementById('root'));
flushSync(() => root.render(React.createElement(React.StrictMode, null,
  React.createElement(AuthProvider, null, React.createElement(Probe)))));

window.authRouteTest = {
  navigate(pathname) {
    history.replaceState(null, '', pathname);
    flushSync(() => window.dispatchEvent(new CustomEvent('tableau:route-change', { detail: { pathname } })));
  }
};
