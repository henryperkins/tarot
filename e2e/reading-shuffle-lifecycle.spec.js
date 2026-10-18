import { test, expect } from './helpers/frontendTest.js';

const READER = { id: 'shuffle-reader', username: 'Reader', email: 'reader@example.invalid',
  email_verified: true, subscription_tier: 'pro', subscription_status: 'active' };
const HARNESS = `<!doctype html><html><body><div id="root"></div><script type="module">
  import RefreshRuntime from '/@react-refresh';
  RefreshRuntime.injectIntoGlobalHook(window);
  window.$RefreshReg$ = () => {};
  window.$RefreshSig$ = () => type => type;
  window.__vite_plugin_react_preamble_installed__ = true;
  await import('/e2e/helpers/tarotStateHarness.js');
</script></body></html>`;
const state = page => page.getByTestId('shuffle-state').textContent().then(JSON.parse);

for (const action of ['reset', 'spread', 'logout', 'account switch']) {
  test(`Strict Mode shuffle cannot resurrect a reading after ${action}`, async ({ page }) => {
    let user = READER;
    await page.route('**/__shuffle-harness', route => route.fulfill({ contentType: 'text/html', body: HARNESS }));
    await page.route('**/api/auth/me', route => route.fulfill({ json: { user } }));
    await page.route('**/api/auth/logout', route => route.fulfill({ json: { success: true } }));
    await page.goto('/__shuffle-harness');
    await expect.poll(async () => (await state(page))?.owner).toBe('user:shuffle-reader');
    await expect.poll(async () => (await state(page))?.authLoading).toBe(false);
    await page.clock.install();
    await page.evaluate(() => window.shuffleTest.shuffle());
    expect((await state(page)).shuffling).toBe(true);
    if (action === 'reset') await page.evaluate(() => window.shuffleTest.reset());
    if (action === 'spread') await page.evaluate(() => window.shuffleTest.select('celtic'));
    if (action === 'logout') await page.evaluate(() => window.shuffleTest.logout());
    if (action === 'account switch') {
      user = { ...READER, id: 'other-reader' };
      await page.evaluate(() => window.shuffleTest.refreshOwner());
    }
    if (action === 'logout') await expect.poll(async () => (await state(page)).owner).toBe('guest');
    if (action === 'account switch') await expect.poll(async () => (await state(page)).owner).toBe('user:other-reader');
    await page.evaluate(() => window.shuffleTest.fireObsolete());
    await page.clock.runFor(1300);
    expect(await state(page)).toMatchObject({ reading: null, scope: null, shuffling: false, seed: null, knocked: false, cut: false });
    // Cancellation must not leave the following valid draw permanently blocked.
    await page.evaluate(() => window.shuffleTest.shuffle());
    await page.clock.runFor(1300);
    await expect.poll(async () => (await state(page)).reading?.length || 0).toBeGreaterThan(0);
    expect((await state(page)).shuffling).toBe(false);
  });
}
