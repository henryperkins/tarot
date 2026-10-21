import { test, expect } from './helpers/frontendTest.js';
import { prepareNavigation, settleNavigation, expectCanvasProgressGeometry, DEMO_READER } from './helpers/navigationFixtures.js';
import { writeFile } from 'node:fs/promises';

async function expectSinglePlacement(page) {
  const groups = page.locator('[data-destination-group]');
  expect(await groups.evaluateAll(nodes => nodes.filter(node => !node.hidden && !node.inert).length)).toBe(1);
  expect(await groups.evaluateAll(nodes => nodes.filter(node => node.hidden).every(node => node.inert))).toBe(true);
}

for (const width of [390, 1440]) {
  test(`direct Sign in isolates chrome and returns keyboard focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await prepareNavigation(page);
    await page.goto('/journal'); await settleNavigation(page);
    const signIn = page.locator('[data-app-header]').getByRole('button', { name: 'Sign In', exact: true });
    await signIn.focus(); await signIn.press('Enter');
    await expect(page.locator('#auth-email')).toBeVisible();
    for (const selector of ['[data-app-header]', '[data-app-bottom-region]']) {
      await expect.poll(() => page.locator(selector).evaluate(element => Boolean(element.closest('[inert]')))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(signIn).toBeFocused();
  });
}

for (const width of [320, 390, 768, 769, 1024, 1440]) {
  for (const pro of [false, true]) {
    test(`200% text keeps ${pro ? 'Pro' : 'guest'} chrome usable at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await prepareNavigation(page, { pro });
      for (const path of ['/', '/journal', '/account']) {
        await page.goto(path); await settleNavigation(page);
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
        await page.evaluate(() => document.fonts.ready);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await expectSinglePlacement(page);
        if (path === '/') await expectCanvasProgressGeometry(page);
        for (const target of await page.locator('[data-app-header] a, [data-app-header] button').filter({ visible: true }).all()) {
          const r = await target.boundingBox();
          expect(r.x).toBeGreaterThanOrEqual(-1);
          expect(r.x + r.width).toBeLessThanOrEqual(width + 1);
          expect(r.width).toBeGreaterThanOrEqual(43.99);
          expect(r.height).toBeGreaterThanOrEqual(43.99);
        }
        await page.screenshot({ path: testInfo.outputPath(`${path === '/' ? 'reading' : path.slice(1)}.png`), animations: 'disabled' });
      }
    });
  }
}

test('auth loading and a long identity preserve the desktop destination cluster', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await prepareNavigation(page, { pro: true });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/auth/me', async route => {
    await gate;
    await route.fulfill({ json: { user: { ...DEMO_READER, username: 'A very long reader identity that must stay inside the menu' } } });
  });
  try {
    await page.goto('/account');
    await expect(page.getByRole('status', { name: 'Loading account' })).toBeVisible();
    const cluster = page.locator('[data-destination-group="header"]');
    const before = await cluster.boundingBox();
    release();
    await expect(page.getByRole('button', { name: /User menu for A very long reader/ })).toBeVisible();
    const after = await cluster.boundingBox();
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  } finally { release(); }
});

for (const state of ['loading', 'error', 'ready']) {
  test(`quiet shared reading keeps zero destinations through ${state}, keyboard and auth changes`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareNavigation(page);
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    if (state !== 'ready') await page.route('**/api/share/navigation-demo', async route => {
      if (state === 'loading') await gate;
      await route.fulfill({ status: 404, json: { error: 'Share unavailable' } });
    });
    try {
      await page.goto('/share/navigation-demo'); await settleNavigation(page);
      if (state === 'error') await expect(page.getByRole('heading', { name: 'Share unavailable', exact: true })).toBeVisible();
      await expect(page.locator('[data-destination-nav]')).toHaveCount(0);
      await page.evaluate(() => {
        window.navigationViewportHeight = 420;
        Object.defineProperty(visualViewport, 'height', { configurable: true, get: () => window.navigationViewportHeight });
        visualViewport.dispatchEvent(new Event('resize'));
      });
      await expect(page.locator('[data-destination-nav]')).toHaveCount(0);
      await page.evaluate(() => { window.navigationViewportHeight = innerHeight; visualViewport.dispatchEvent(new Event('resize')); });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await expect(page.locator('[data-destination-nav]')).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-bottom-height')))).toBe(0);
      release?.();
      await page.route('**/api/auth/me', route => route.fulfill({ json: { user: DEMO_READER } }));
      await page.reload(); await settleNavigation(page);
      await expect(page.getByRole('button', { name: 'User menu for Avery', exact: true })).toBeVisible();
      await expect(page.locator('[data-destination-nav]')).toHaveCount(0);
    } finally { release?.(); }
  });
}

test('nested Gallery navigation and modified links preserve the original page', async ({ page, context }) => {
  await page.setViewportSize({ width: 1024, height: 900 }); await prepareNavigation(page, { populated: true });
  await page.goto('/journal/gallery'); await settleNavigation(page);
  const journal = page.getByRole('navigation', { name: 'Primary navigation', exact: true }).getByRole('link', { name: 'Journal', exact: true });
  await expect(journal).toHaveAttribute('aria-current', 'page');
  const popupEvent = context.waitForEvent('page');
  await journal.click({ modifiers: ['ControlOrMeta'] });
  const popup = await popupEvent;
  try { await expect(popup).toHaveURL(/\/journal$/); await expect(page).toHaveURL(/\/journal\/gallery$/); }
  finally { await popup.close(); }
});

test('auth failure and failed journal data leave navigation usable', async ({ page }) => {
  await prepareNavigation(page, { pro: true });
  await page.route('**/api/journal?*', route => route.fulfill({ status: 503, json: { error: 'Journal offline' } }));
  await page.goto('/account'); await settleNavigation(page);
  await expect(page.locator('#practice')).toContainText('Unable to load your journal.');
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Journal', exact: true }).click();
  await expect(page).toHaveURL(/\/journal$/);
  await page.route('**/api/auth/me', route => route.fulfill({ status: 503, json: { error: 'Auth unavailable' } }));
  await page.goto('/account'); await settleNavigation(page);
  await expect(page.locator('[data-app-header]').getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
  await expectSinglePlacement(page);
});

test('touch-first desktop-site layout uses only handset destinations', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 980, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await context.newPage();
  try {
    await prepareNavigation(page);
    await page.goto(`${testInfo.project.use.baseURL}/journal`); await settleNavigation(page);
    await expect(page.locator('[data-destination-group="dock"]')).toBeVisible();
    await expect(page.locator('[data-destination-group="header"]')).toHaveAttribute('hidden', '');
    await expectSinglePlacement(page);
    await writeFile(testInfo.outputPath('touch-layout.json'), JSON.stringify(await page.evaluate(() => ({ width: innerWidth, height: innerHeight, touch: matchMedia('(pointer: coarse)').matches })), null, 2));
  } finally { await context.close(); }
});
