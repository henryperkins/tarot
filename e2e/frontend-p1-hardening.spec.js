import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createNarrativeFixture, startReading, QUESTION } from './helpers/narrativeFixtures.js';

const entry = {
  id: 'p1-reading', ts: Date.now() - 86400000, spread: 'Three-Card Story', spreadKey: 'threeCard',
  question: 'How can I make time for reflection?',
  cards: [
    { name: 'Queen of Cups', position: 'Past', orientation: 'Upright' },
    { name: 'Five of Wands', position: 'Present', orientation: 'Reversed' },
    { name: 'Temperance', position: 'Future', orientation: 'Upright' }
  ],
  personalReading: 'A small pause can help you notice what matters.'
};

async function prepare(page, theme = 'dark', { onboarding = true, notes = [] } = {}) {
  await page.addInitScript(({ theme, entry, onboarding }) => {
    localStorage.setItem('tarot-theme', theme);
    if (onboarding) {
      localStorage.setItem('tarot-onboarding-complete', 'true');
      localStorage.setItem('tarot_journal', JSON.stringify([entry]));
    }
    localStorage.setItem('tarot-nudge-state', JSON.stringify({
      readingCount: 2, hasSeenRitualNudge: true, hasSeenGestureCoach: true,
      hasSeenJournalNudge: true, hasDismissedAccountNudge: true, journalSaveCount: 1
    }));
  }, { theme, entry, onboarding });
  await page.route(/https:\/\/[^/]*sentry\.io\//, route => route.fulfill({ json: {} }));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ status: 401, json: { user: null } });
    if (path.startsWith('/api/share/')) return route.fulfill({ json: {
      token: 'p1-share', title: 'A shared reading', entries: [entry], notes, meta: { entryCount: 1 }
    } });
    return route.fulfill({ json: { ok: true, entries: [], notes: [], items: [] } });
  });
}

async function expectAccessible(page, include) {
  let scan = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']);
  if (include) scan = scan.include(include);
  const { violations } = await scan.analyze();
  expect(violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(node => node.failureSummary) }))).toEqual([]);
}

async function screenshot(page, testInfo, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
}

test.use({ serviceWorkers: 'block', contextOptions: { reducedMotion: 'reduce' } });

for (const width of [320, 390, 1280]) {
  test.describe(`${width}px viewport`, () => {
    test.use({ isMobile: width < 640, hasTouch: width < 640 });
    for (const theme of ['dark', 'light']) {
      test(`shared cards and empty notes have accessible semantics at ${width}px (${theme})`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await prepare(page, theme);
        await page.goto('/share/p1-share');
        await expect(page.getByRole('heading', { name: 'A shared reading' })).toBeVisible();
        await screenshot(page, testInfo, 'share');
        await expectAccessible(page);
        await expect(page.getByRole('link', { name: 'Account', exact: true })).toBeVisible();
        const card = page.getByRole('button', { name: /Past: Queen of Cups/ }).filter({ visible: true });
        await expect(card).toHaveAttribute('aria-pressed', 'true');
        await card.click();
        await expect(card).toHaveAttribute('aria-pressed', 'false');
      });

      test(`auth footnote has sufficient contrast at ${width}px (${theme})`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await prepare(page, theme);
        await page.goto('/');
        await page.getByRole('button', { name: 'Sign In', exact: true }).filter({ visible: true }).first().click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await screenshot(page, testInfo, 'auth');
        await expectAccessible(page, '[role="dialog"]');
      });

      test(`generation stays within ${width}px and completes (${theme})`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await prepare(page, theme);
        const fixture = await createNarrativeFixture(page);
        try {
          await page.goto('/');
          await page.locator('#question-input, #quick-intention').filter({ visible: true }).first().fill(QUESTION);
          await page.getByRole('button', { name: /^Draw cards$/ }).filter({ visible: true }).first().click();
          await page.getByRole('button', { name: /^Deal spread/ }).filter({ visible: true }).first().click();
          await page.getByRole('button', { name: /^Reveal all cards/ }).filter({ visible: true }).first().click();
          await page.getByRole('button', { name: /^Interpret cards/ }).filter({ visible: true }).first().click();
          await expect(page.getByLabel('Preparing your interpretation')).toBeVisible();
          await expect(page.locator('[data-scene="interlude"]')).toBeVisible();
          // Observe a held response after layout settles, rather than completing the
          // stream in the first frame before the generation scene has taken over.
          await page.waitForTimeout(1500);
          if (width < 640) await expect(page.locator('.mobile-stable-mode')).toBeAttached();
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
          await screenshot(page, testInfo, 'generating');
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
          await fixture.completeReading();
          await expect(page.getByRole('heading', { name: 'Your Personalized Narrative' })).toBeFocused();
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        } finally {
          await fixture.close();
        }
      });

      if (width < 640) {
        test(`deck notes stay visible without palette controls at ${width}px (${theme})`, async ({ page }, testInfo) => {
          await page.setViewportSize({ width, height: 900 });
          await prepare(page, theme);
          await page.goto('/');
          await page.getByRole('button', { name: /settings/i }).filter({ visible: true }).first().click();
          const dialog = page.getByRole('dialog');
          const rws = dialog.getByRole('radio', { name: /Rider-Waite-Smith/ });
          const thoth = dialog.getByRole('radio', { name: /Thoth/ });
          await expect(dialog.getByRole('button', { name: 'See color palette' })).toHaveCount(0);
          await expect(dialog.locator('.deck-palette-badge')).toHaveCount(0);
          for (const note of [
            dialog.getByText('Uses Thoth card names (e.g., "The Magus", "Adjustment").', { exact: true }),
            dialog.getByText('Uses Marseille numbering with French titles.', { exact: true })
          ]) {
            await note.scrollIntoViewIfNeeded();
            await expect(note).toBeVisible();
            await expect(note).toBeInViewport();
          }
          await screenshot(page, testInfo, 'deck-notes');
          await expect(rws).toHaveAttribute('aria-checked', 'true');
          await expect(thoth).toHaveAttribute('aria-checked', 'false');
          await expectAccessible(page, '[role="dialog"]');
          await rws.focus();
          await page.keyboard.press('ArrowRight');
          await expect(thoth).toBeFocused();
          await page.keyboard.press('Space');
          await expect(thoth).toHaveAttribute('aria-checked', 'true');
        });
      }
    }

    test(`journal scope exposes its selection at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await prepare(page);
      await page.goto('/journal');
      const all = page.getByRole('button', { name: 'All time', exact: true }).filter({ visible: true });
      await all.click();
      await expect(all).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('button', { name: 'This month', exact: true }).filter({ visible: true })).toHaveAttribute('aria-pressed', 'false');
    });

    test(`entry menu restores focus and Tab exits at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await prepare(page);
      await page.goto('/journal');
      // Deferred journey controls and scroll-triggered controls must exist before
      // recording the page's natural Tab destinations.
      await expect(page.getByRole('heading', { name: /^Your (Reading )?Journey/ }).filter({ visible: true }).first()).toBeVisible();
      const trigger = page.getByRole('button', { name: 'Open entry actions', exact: true }).filter({ visible: true }).first();
      await trigger.scrollIntoViewIfNeeded();
      await trigger.focus();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.keyboard.press('Tab');
      await page.evaluate(() => { window.__afterEntryActions = document.activeElement; });
      await trigger.focus();
      await page.keyboard.press('Shift+Tab');
      await page.evaluate(() => { window.__beforeEntryActions = document.activeElement; });
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('menuitem', { name: 'Copy CSV' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('menuitem', { name: 'Copy CSV' })).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(page.getByRole('menuitem', { name: 'Export CSV', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('menu')).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.activeElement === window.__afterEntryActions)).toBe(true);
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('menuitem', { name: 'Copy CSV' })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(page.getByRole('menu')).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.activeElement === window.__beforeEntryActions)).toBe(true);
      const expand = page.getByTitle('Expand entry', { exact: true }).first();
      await expand.click();
      const collapse = page.getByTitle('Collapse entry', { exact: true }).first();
      await expect(collapse).toBeFocused();
      await collapse.click();
      await expect(expand).toBeFocused();
    });
  });
}

for (const mode of ['low-core stable mode', 'full effects']) {
  test(`generation fits a phone with ${mode}`, async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
      deviceScaleFactor: 2, reducedMotion: 'no-preference', serviceWorkers: 'block'
    });
    const page = await context.newPage();
    await page.addInitScript(cores => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => cores });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    }, mode === 'low-core stable mode' ? 4 : 8);
    await prepare(page);
    const fixture = await createNarrativeFixture(page);
    try {
      await startReading(page, fixture, { complete: false });
      await expect(page.locator('[data-scene="interlude"]')).toBeVisible();
      await page.waitForTimeout(1500);
      expect(await page.locator('.mobile-stable-mode').count()).toBe(mode === 'low-core stable mode' ? 1 : 0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      await screenshot(page, testInfo, 'generating');
      await fixture.completeReading();
      await expect(page.getByRole('heading', { name: 'Your Personalized Narrative' })).toBeFocused();
    } finally {
      await fixture.close();
      await context.close();
    }
  });
}

for (const theme of ['dark', 'light']) {
  test(`populated shared reflections retain list semantics and contrast (${theme})`, async ({ page }) => {
    await prepare(page, theme, { notes: [{
      id: 'p1-note', authorName: 'A reader', body: 'A useful moment of reflection.',
      cardPosition: 'Past', createdAt: new Date(Date.now() - 3600000).toISOString()
    }] });
    await page.goto('/share/p1-share');
    const reflections = page.getByRole('list', { name: '1 reflection', exact: true });
    await expect(reflections.getByRole('listitem')).toHaveCount(1);
    await expect(reflections).toContainText('A useful moment of reflection.');
    await expectAccessible(page);
  });
}

test('active share links remain reachable with menu arrow keys', async ({ page }) => {
  await prepare(page);
  await page.route('**/api/auth/me', route => route.fulfill({ json: { user: {
    id: 'p1-user', username: 'reader', email: 'p1@example.invalid',
    subscription_tier: 'pro', subscription_status: 'active', subscription_provider: 'stripe'
  } } }));
  await page.route('**/api/journal**', route => route.fulfill({ json: { entries: [entry] } }));
  await page.route('**/api/share', route => route.fulfill({ json: { shares: [{
    token: 'p1-link', scope: 'entry', entryIds: [entry.id], entryCount: 1, title: 'Shared reflection'
  }] } }));
  let finishDeletion;
  const deletionReady = new Promise(resolve => { finishDeletion = resolve; });
  await page.route('**/api/share/p1-link', async route => {
    await deletionReady;
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto('/journal');
  const trigger = page.getByRole('button', { name: 'Open entry actions', exact: true }).filter({ visible: true }).first();
  await trigger.click();
  await expect(page.getByRole('menuitem', { name: 'Copy CSV' })).toBeFocused();
  const removeLink = page.getByRole('menuitem', { name: 'Delete', exact: true });
  await expect(removeLink).toBeVisible();
  const semantics = await new AxeBuilder({ page }).include('[role="menu"]')
    .withRules(['aria-required-parent', 'aria-required-children']).analyze();
  expect(semantics.violations).toEqual([]);
  await page.keyboard.press('End');
  await expect(removeLink).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('menuitem', { name: 'Copy', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('menuitem', { name: 'Copy CSV' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Copy CSV' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(removeLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  finishDeletion();
  await expect(page.getByText('Share link removed.', { exact: true })).toBeVisible();
  await expect(trigger).toBeFocused();
});

test('route navigation updates titles, focuses content and announces the destination', async ({ page }) => {
  await prepare(page);
  let releaseJournal;
  let journalRequested;
  const requestStarted = new Promise(resolve => { journalRequested = resolve; });
  const journalReady = new Promise(resolve => { releaseJournal = resolve; });
  await page.route(/\/(?:assets\/Journal-[^/]+\.js|src\/components\/Journal\.jsx)(?:\?|$)/, async route => {
    journalRequested();
    await journalReady;
    await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Journal', exact: true }).filter({ visible: true }).first().click();
  await requestStarted;
  releaseJournal();
  await expect(page).toHaveTitle('Journal — Tableu');
  await expect(page.locator('#main-content')).toBeFocused();
  await expect(page.getByRole('status').filter({ hasText: 'Journal page loaded' })).toBeAttached();
  const reading = page.getByRole('button', { name: 'Reading', exact: true }).filter({ visible: true }).first();
  await reading.focus();
  await page.evaluate(() => {
    history.pushState(null, '', '/journal?view=cards');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(reading).toBeFocused();
  await reading.click();
  await expect(page).toHaveTitle('Tarot Reading — Tableu');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('direct route visits receive descriptive titles, including trailing slashes', async ({ page }) => {
  await prepare(page);
  for (const [path, title] of [
    ['/journal/', 'Journal'], ['/journal/gallery', 'Card Gallery'], ['/pricing', 'Plans & Pricing'],
    ['/account', 'Account & Settings'], ['/admin', 'Quality Dashboard'], ['/design', 'Design System'],
    ['/governance-critique', 'Governance Critique'], ['/reset-password', 'Reset Password'],
    ['/verify-email', 'Verify Email'], ['/share/p1-share', 'Shared Reading']
  ]) {
    await page.goto(path);
    await expect(page).toHaveTitle(`${title} — Tableu`);
  }
});

test('initial onboarding keeps focus inside its dialog', async ({ page }) => {
  await prepare(page, 'dark', { onboarding: false });
  await page.goto('/');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await expect(page).toHaveTitle('Tarot Reading — Tableu');
  await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
});

test('monitoring reports errors without Replay and samples performance at ten percent', async ({ page }) => {
  await prepare(page);
  const envelopes = [];
  await page.route(/https:\/\/[^/]*sentry\.io\//, route => {
    envelopes.push(route.request().postData() || '');
    return route.fulfill({ json: {} });
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => {
    const carrier = window.__SENTRY__;
    return Boolean(carrier?.[carrier.version]?.stack?.getScope().getClient());
  })).toBe(true);
  const monitoring = await page.evaluate(async () => {
    const carrier = window.__SENTRY__;
    const client = carrier[carrier.version].stack.getScope().getClient();
    client.captureException(new Error('frontend-p1-fixture-error'));
    await client.flush(2000);
    return { replay: Boolean(client.getIntegrationByName('Replay')), traces: client.getOptions().tracesSampleRate };
  });
  await expect.poll(() => envelopes.some(body => body.includes('frontend-p1-fixture-error'))).toBe(true);
  expect(monitoring.replay).toBe(false);
  expect(monitoring.traces).toBe(0.1);
  expect(envelopes.some(body => /"type":"replay_(event|recording)"/.test(body))).toBe(false);
});
