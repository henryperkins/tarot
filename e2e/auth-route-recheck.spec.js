import { test, expect } from './helpers/frontendTest.js';

const READER = {
  id: 'auth-route-reader', username: 'Reader', email: 'reader@example.invalid',
  email_verified: true, subscription_tier: 'pro', subscription_status: 'active'
};

// Mount the real provider on its own so route timing is independent of page
// loaders. flushSync commits each route in the same task, before native queued
// microtasks can run, as can happen during consecutive client-side redirects.
const HARNESS = `<!doctype html>
<html><body><div id="root"></div><script type="module">
  import RefreshRuntime from '/@react-refresh';
  RefreshRuntime.injectIntoGlobalHook(window);
  window.$RefreshReg$ = () => {};
  window.$RefreshSig$ = () => type => type;
  window.__vite_plugin_react_preamble_installed__ = true;

  const [{ default: React }, { default: ReactDOMClient }, { default: ReactDOM }, { AuthProvider, useAuth }] = await Promise.all([
    import('/node_modules/.vite/deps/react.js'),
    import('/node_modules/.vite/deps/react-dom_client.js'),
    import('/node_modules/.vite/deps/react-dom.js'),
    import('/src/contexts/AuthContext.jsx')
  ]);
  const { createRoot } = ReactDOMClient;
  const { flushSync } = ReactDOM;
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
</script></body></html>`;

async function prepare(page, startPath = '/account') {
  let currentUser = READER;
  let authRequests = 0;
  await page.route(url => url.pathname === '/__auth-route-harness', route => route.fulfill({
    contentType: 'text/html', body: HARNESS
  }));
  await page.route('**/api/auth/me', route => {
    authRequests += 1;
    return route.fulfill({ json: { user: currentUser } });
  });
  await page.goto(`/__auth-route-harness?start=${encodeURIComponent(startPath)}`);
  await expect.poll(() => page.evaluate(() => !!window.authRouteTest)).toBe(true);
  return {
    requests: () => authRequests,
    setUser: user => { currentUser = user; }
  };
}

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test.describe('Auth checks across route redirects', () => {
  test.use({ serviceWorkers: 'block' });

  for (const skipPath of ['/design', '/governance-critique']) {
    test(`an initialized provider rechecks after ${skipPath} and consecutive normal redirects`, async ({ page }) => {
      const auth = await prepare(page);
      const state = page.getByTestId('auth-state');
      await expect(state).toContainText(READER.email);
      await expect(state).toContainText('"loading":false');
      expect(auth.requests()).toBe(1);
      auth.setUser({ ...READER, id: 'refreshed-reader', email: 'refreshed@example.invalid' });

      await page.evaluate(skipPath => {
        window.authRouteTest.navigate(skipPath);
        window.authRouteTest.navigate('/journal');
        window.authRouteTest.navigate('/account');
      }, skipPath);

      await settle(page);
      await expect.poll(auth.requests).toBe(2);
      await expect(state).toContainText('refreshed@example.invalid');
      await expect(state).toContainText('"loading":false');

      await page.evaluate(() => window.authRouteTest.navigate('/journal'));
      await settle(page);
      expect(auth.requests()).toBe(2);
      await expect(state).toContainText('refreshed@example.invalid');
    });

    test(`an initially skipped ${skipPath} checks once after consecutive normal redirects`, async ({ page }) => {
      const auth = await prepare(page, skipPath);
      const state = page.getByTestId('auth-state');
      await expect(state).toContainText('"loading":false');
      expect(auth.requests()).toBe(0);

      await page.evaluate(() => {
        window.authRouteTest.navigate('/journal');
        window.authRouteTest.navigate('/account');
      });

      await expect(state).toContainText(READER.email);
      await expect(state).toContainText('"loading":false');
      expect(auth.requests()).toBe(1);
    });
  }

  test('normal route transitions retain the initialized user without another auth check', async ({ page }) => {
    const auth = await prepare(page);
    const state = page.getByTestId('auth-state');
    await expect(state).toContainText(READER.email);
    await expect(state).toContainText('"loading":false');

    await page.evaluate(() => {
      window.authRouteTest.navigate('/journal');
      window.authRouteTest.navigate('/account');
    });
    await settle(page);

    expect(auth.requests()).toBe(1);
    await expect(state).toContainText(READER.email);
    await expect(state).toContainText('"loading":false');
  });
});
