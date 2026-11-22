import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import react from '@vitejs/plugin-react';
import { createServer } from 'vite';

test('the seven-step tutorial summary shows the spread and question chosen in earlier steps', async t => {
  const server = await createServer({
    configFile: false,
    cacheDir: fileURLToPath(new URL('../node_modules/.cache/onboarding-control-vite', import.meta.url)),
    plugins: [react()],
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom'
  });
  t.after(() => server.close());

  const [{ default: OnboardingControlStep }, { AuthProvider }, { PreferencesProvider }] = await Promise.all([
    server.ssrLoadModule('/src/components/onboarding/OnboardingControlStep.jsx'),
    server.ssrLoadModule('/src/contexts/AuthContext.jsx'),
    server.ssrLoadModule('/src/contexts/PreferencesContext.jsx')
  ]);
  const summary = createElement(OnboardingControlStep, {
    step: 7, selectedSpread: 'fiveCard', question: 'Where should I focus this week?'
  });
  const markup = renderToStaticMarkup(createElement(AuthProvider, null, createElement(PreferencesProvider, null, summary)));
  assert.match(markup, /Five-Card Clarity/);
  assert.match(markup, /Where should I focus this week\?/);
});
