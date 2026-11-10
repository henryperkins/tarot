import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './helpers/frontendTest.js';
import { prepareNavigation, settleNavigation, DEMO_READER, DEMO_READING } from './helpers/navigationFixtures.js';

// Compiled integration projects otherwise let the service worker satisfy chunk
// requests outside Playwright's routes, bypassing delayed/failed-load fixtures.
test.use({ serviceWorkers: 'block', contextOptions: { reducedMotion: 'reduce' } });

// Vite serves source modules in development and named, hashed chunks in builds.
const RICH_READING_MODULES = /\/(?:JournalMarkdown|RestoredReadingGestures|StreamingNarrative)(?:\.jsx|-[\w-]+\.js)(?:\?|$)/;
const DEFERRED_READING_MODULES = /\/(?:JournalMarkdown|RestoredReadingGestures)(?:\.jsx|-[\w-]+\.js)(?:\?|$)/;

async function expectLabelInName(page) {
  const { violations } = await new AxeBuilder({ page })
    .withRules(['label-content-name-mismatch']).analyze();
  expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }))).toEqual([]);
}

for (const width of [320, 390, 1440]) {
  for (const theme of ['dark', 'light']) {
    test(`onboarding names include numbers, labels and state at ${width}px (${theme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 640 ? 844 : 900 });
      await page.addInitScript(value => {
        localStorage.setItem('tarot-theme', value);
        localStorage.setItem('tarot-auto-narrate', 'false');
      }, theme);
      await page.goto('/');
      const dialog = page.getByRole('dialog', { name: 'Welcome to Tableu', exact: true });
      const progress = dialog.getByRole('navigation', { name: 'Onboarding progress', exact: true });
      await expect(progress).toBeVisible();
      const steps = progress.getByRole('button');
      await expect(steps).toHaveCount(4);
      for (const [index, label] of ['Welcome', 'Spread', 'Intention', 'Begin'].entries()) {
        await expect(steps.nth(index)).toHaveAccessibleName(`${index + 1} ${label}${index === 0 ? ' (current)' : ''}`);
        if (index > 0) await expect(steps.nth(index)).toBeDisabled();
      }
      await expectLabelInName(page);
      await dialog.getByRole('button', { name: 'Continue', exact: true }).press('Enter');
      await expect(steps.nth(0)).toHaveAccessibleName('1 Welcome (completed)');
      await expect(steps.nth(1)).toHaveAccessibleName('2 Spread (current)');
      await expect(steps.nth(1)).toHaveAttribute('aria-current', 'step');
      await expectLabelInName(page);
      await steps.nth(0).press('Enter');
      await expect(steps.nth(0)).toHaveAccessibleName('1 Welcome (current)');
      await expect(dialog.getByRole('heading', { name: 'Welcome to Tableu', level: 2 })).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });

    test(`Account retains its visible label and identity across routes at ${width}px (${theme})`, async ({ page }) => {
      // Fixture Pro coverage; real local Pro verification is a separate review.
      await page.setViewportSize({ width, height: width < 640 ? 844 : 900 });
      await prepareNavigation(page, { pro: true, theme });
      for (const path of ['/', '/journal', '/journal/gallery', '/account', '/pricing']) {
        await page.goto(path);
        await settleNavigation(page);
        const account = page.locator('[data-app-header]').getByRole('button', { name: 'Account menu for Avery', exact: true });
        await expect(account).toBeVisible();
        if (width >= 640) await expect(account.locator('.account-trigger-label')).toHaveText('Account');
        await expectLabelInName(page);
        await account.press('Enter');
        await expect(account).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('Escape');
        await expect(account).toBeFocused();
        await expect(account).toHaveAttribute('aria-expanded', 'false');
      }
    });

    for (const populated of [false, true]) {
      test(`Gallery keeps its content origin stable while ${populated ? 'a populated' : 'an empty'} collection loads at ${width}px (${theme})`, async ({ page }) => {
        await page.setViewportSize({ width, height: width < 640 ? 844 : 900 });
        await prepareNavigation(page, { pro: true, theme });
        await page.addInitScript(() => {
          window.galleryShifts = null;
          if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) {
            window.galleryShifts = [];
            new PerformanceObserver(list => {
              for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.galleryShifts.push(entry.value);
            }).observe({ type: 'layout-shift', buffered: true });
          }
        });
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        await page.route(/\/api\/(?:journal\?|archetype-journey\/card-frequency)/, async route => {
          await gate;
          await route.fulfill({ json: {
            entries: populated ? [DEMO_READING] : [],
            cards: populated ? [{ card_name: 'The Star', total_count: 1, last_seen: Math.floor(DEMO_READING.ts / 1000) }] : [],
            pagination: { total: populated ? 1 : 0, hasMore: false }
          } });
        });
        try {
          await page.goto('/journal/gallery');
          await expect(page.getByRole('status', { name: 'Loading card collection', exact: true })).toBeVisible();
          await expect(page.getByRole('heading', { name: 'Your collection starts with a saved reading', exact: true })).toHaveCount(0);
          await expect(page.getByRole('button', { name: 'Start a reading', exact: true })).toHaveCount(0);
          await settleNavigation(page);
          const toolbar = page.locator('.gallery-toolbar');
          const before = await toolbar.boundingBox();
          const contentBefore = await page.locator('.gallery-content').boundingBox();
          // Membership is unknown: don't show a speculative empty notice or a
          // tile grid that will later move to make room for one.
          await expect(page.locator('.gallery-grid')).toHaveCount(0);
          await page.evaluate(() => { if (window.galleryShifts) window.galleryShifts.length = 0; });
          release();
          const emptyHeading = page.getByRole('heading', { name: 'Your collection starts with a saved reading', exact: true });
          if (populated) {
            await expect(page.getByRole('button', { name: 'Open details for The Star', exact: true })).toBeAttached();
            await expect(emptyHeading).toHaveCount(0);
          } else await expect(emptyHeading).toBeVisible();
          await expect(page.getByRole('status', { name: 'Loading card collection', exact: true })).toHaveCount(0);
          await settleNavigation(page);
          const after = await toolbar.boundingBox();
          expect(after.y).toBeCloseTo(before.y, 1);
          expect(after.height).toBeCloseTo(before.height, 1);
          expect((await page.locator('.gallery-content').boundingBox()).y).toBeCloseTo(contentBefore.y, 1);
          const firstContent = populated ? page.locator('.gallery-grid') : emptyHeading.locator('..');
          expect((await firstContent.boundingBox()).y).toBeCloseTo(contentBefore.y, 1);
          const tileAfter = await page.locator('.gallery-grid > div').first().boundingBox();
          expect(tileAfter.height).toBeCloseTo((tileAfter.width - 2) * 1.5 + 2, 1);
          expect(await page.locator('.gallery-grid > div').first().evaluate(tile => getComputedStyle(tile).animationName)).toBe('none');
          const cls = await page.evaluate(() => window.galleryShifts?.reduce((sum, value) => sum + value, 0) ?? null);
          if (cls !== null) expect(cls).toBeLessThan(0.01);
          await page.getByRole('button', { name: 'Found', exact: true }).click();
          if (populated) {
            await expect(page.locator('.gallery-grid > div')).toHaveCount(1);
            await expect(page.getByRole('button', { name: 'Open details for The Star', exact: true })).toBeVisible();
            await page.getByRole('button', { name: 'All', exact: true }).click();
          } else {
            await expect(page.getByText('No cards match your filters.', { exact: true })).toBeVisible();
            await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
          }
          await expect(page.locator('.gallery-grid img')).toHaveCount(78);
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        } finally { release(); }
      });
    }

    test(`wrapped settings descriptions retain 1.5 leading and support enlarged text at ${width}px (${theme})`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 640 ? 844 : 900 });
      await prepareNavigation(page, { pro: true, theme });
      await page.goto('/account#analytics');
      const description = page.locator('#analytics-toggle-description');
      await expect(description).toBeVisible();
      for (const enlarged of [false, true]) {
        if (enlarged) await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
        const metrics = await description.evaluate(element => {
          const style = getComputedStyle(element);
          return { fontSize: Number.parseFloat(style.fontSize), lineHeight: Number.parseFloat(style.lineHeight),
            height: element.getBoundingClientRect().height };
        });
        expect(metrics.lineHeight / metrics.fontSize).toBeCloseTo(1.5, 2);
        expect(metrics.height).toBeGreaterThanOrEqual(metrics.lineHeight);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      }
    });
  }
}

for (const first of ['journal', 'stats']) {
  test(`Gallery waits for both sources when ${first} arrives first`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareNavigation(page, { pro: true });
    let releaseJournal;
    let releaseStats;
    const journal = new Promise(resolve => { releaseJournal = resolve; });
    const stats = new Promise(resolve => { releaseStats = resolve; });
    await page.route('**/api/journal?*', async route => {
      await journal;
      await route.fulfill({ json: { entries: [DEMO_READING], pagination: { total: 1, hasMore: false } } });
    });
    await page.route('**/api/archetype-journey/card-frequency', async route => {
      await stats;
      // Exercise local fallback as well as a populated remote frequency map.
      await route.fulfill({ json: { cards: first === 'journal' ? [] : [{ card_name: 'The Star', total_count: 1,
        last_seen: Math.floor(DEMO_READING.ts / 1000) }] } });
    });
    try {
      await page.goto('/journal/gallery');
      const loading = page.getByRole('status', { name: 'Loading card collection', exact: true });
      await expect(loading).toBeVisible();
      await settleNavigation(page);
      const before = await page.locator('.gallery-content').boundingBox();
      (first === 'journal' ? releaseJournal : releaseStats)();
      await expect(page.getByText('1 / 78', { exact: true })).toBeVisible();
      await expect(loading).toBeVisible();
      await expect(page.locator('.gallery-grid')).toHaveCount(0);
      releaseJournal();
      releaseStats();
      await expect(page.getByRole('button', { name: 'Open details for The Star', exact: true })).toBeAttached();
      expect((await page.locator('.gallery-grid').boundingBox()).y).toBeCloseTo(before.y, 1);
      await expect(page.getByRole('heading', { name: 'Your collection starts with a saved reading', exact: true })).toHaveCount(0);
    } finally { releaseJournal(); releaseStats(); }
  });
}

test('Account preserves a long Unicode identity without truncating its accessible name', async ({ page }) => {
  await prepareNavigation(page, { pro: true });
  const username = `Solène 🌿 安心 ${'Reader '.repeat(20)}`.trim();
  await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { ...DEMO_READER, username } } }));
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/account');
    const account = page.locator('[data-app-header] .account-trigger');
    await expect(account).toHaveAccessibleName(`Account menu for ${username}`);
    await expectLabelInName(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

for (const dpr of [1, 2, 3]) {
  test.describe(`Gallery image density ${dpr}x`, () => {
    test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr });
    test('chooses WebP renditions without requesting original scans', async ({ page }) => {
      await prepareNavigation(page);
      const requested = [];
      page.on('request', request => { if (request.resourceType() === 'image') requested.push(new URL(request.url()).pathname); });
      await page.goto('/journal/gallery');
      const image = page.getByRole('img', { name: 'The Fool', exact: true });
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate(element => new URL(element.currentSrc).pathname))
        .toBe(`/images/cards/w${dpr === 3 ? 720 : 360}/RWS1909_-_00_Fool.webp`);
      await expect(image).toHaveAttribute('sizes', /calc/);
      await expect(image).toHaveAttribute('decoding', 'async');
      expect(requested.filter(path => /^\/images\/cards\/RWS1909_.*\.jpe?g$/i.test(path))).toEqual([]);
    });
  });
}

test.describe('Gallery detail artwork', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('a touch opens the original scan only when card details are requested', async ({ page }) => {
    await prepareNavigation(page, { populated: true });
    const requested = [];
    page.on('request', request => { if (request.resourceType() === 'image') requested.push(new URL(request.url()).pathname); });
    await page.goto('/journal/gallery');
    const opener = page.getByRole('button', { name: 'Open details for The Star', exact: true });
    await expect(opener).toBeVisible();
    const original = '/images/cards/RWS1909_-_17_Star.jpeg';
    expect(requested).not.toContain(original);
    await opener.tap();
    const dialog = page.getByRole('dialog', { name: 'The Star Upright', exact: true });
    await expect(dialog).toBeVisible();
    await expect.poll(() => requested.includes(original)).toBe(true);
    await dialog.getByRole('button', { name: 'Close modal', exact: true }).tap();
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });
});

test('Gallery tracking-disabled state does not claim that an empty collection is starting', async ({ page }) => {
  await prepareNavigation(page, { pro: true });
  await page.route('**/api/archetype-journey/card-frequency', route => route.fulfill({ status: 403, json: { error: 'Analytics disabled' } }));
  await page.goto('/journal/gallery');
  await expect(page.getByRole('heading', { name: 'Collection tracking is disabled', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your collection starts with a saved reading', exact: true })).toHaveCount(0);
});

for (const width of [390, 1440]) {
  test(`collapsed Journal entries defer narrative modules until they open at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await prepareNavigation(page, { populated: true });
    const richRequests = [];
    page.on('request', request => {
      if (RICH_READING_MODULES.test(request.url())) richRequests.push(request.url());
    });
    await page.goto('/journal');
    const card = page.locator('#journal-entry-navigation-0 article');
    const toggle = card.getByRole('button', { name: DEMO_READING.question, exact: true });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await settleNavigation(page);
    expect(richRequests).toEqual([]);
    await toggle.press('Enter');
    const narrative = card.getByRole('button', { name: 'Reading narrative', exact: true });
    await expect(narrative).toBeVisible();
    if (await narrative.getAttribute('aria-expanded') === 'false') await narrative.press('Enter');
    await expect(card.getByRole('heading', { name: 'Opening', level: 4 })).toBeVisible();
    expect(richRequests.length).toBeGreaterThan(0);
    await expect(card).toContainText('The Star invites a gentler pace.');
  });
}

test('failed rich-rendering requests leave the saved narrative readable', async ({ page }) => {
  await prepareNavigation(page, { populated: true });
  await page.route(DEFERRED_READING_MODULES, route => route.abort());
  await page.goto('/journal');
  const card = page.locator('#journal-entry-navigation-0 article');
  await card.getByRole('button', { name: DEMO_READING.question, exact: true }).press('Enter');
  const narrative = card.getByRole('button', { name: 'Reading narrative', exact: true });
  await expect(narrative).toBeVisible();
  if (await narrative.getAttribute('aria-expanded') === 'false') await narrative.press('Enter');
  await expect(card.getByRole('alert')).toContainText('Reading formatting is unavailable.');
  await expect(card.locator('.journal-reading > p')).toHaveText(DEMO_READING.personalReading);
  await expect(card.getByRole('button', { name: DEMO_READING.question, exact: true })).toBeEnabled();
});

for (const backwards of [false, true]) {
  test(`formatting waits for a ${backwards ? 'backwards' : 'forwards'} selection in saved text to clear`, async ({ page }) => {
    await prepareNavigation(page, { populated: true });
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route(DEFERRED_READING_MODULES, async route => { await gate; await route.continue(); });
    try {
      await page.goto('/journal');
      const card = page.locator('#journal-entry-navigation-0 article');
      await card.getByRole('button', { name: DEMO_READING.question, exact: true }).press('Enter');
      const narrative = card.getByRole('button', { name: 'Reading narrative', exact: true });
      await expect(narrative).toBeVisible();
      if (await narrative.getAttribute('aria-expanded') === 'false') await narrative.press('Enter');
      const plain = card.locator('.journal-reading > p').filter({ visible: true });
      await expect(plain).toHaveText(DEMO_READING.personalReading);
      const selected = 'The Star invites a gentler pace.';
      await plain.evaluate((paragraph, { selected, backwards }) => {
        const node = paragraph.firstChild;
        const start = node.textContent.indexOf(selected);
        window.selectedJournalNode = node;
        window.journalFocus = document.activeElement;
        window.getSelection().setBaseAndExtent(node, backwards ? start + selected.length : start,
          node, backwards ? start : start + selected.length);
      }, { selected, backwards });
      release();
      // The renderer really arrived; its staged output remains inaccessible
      // until the native selection is released, without a source edit/remount.
      await expect(card.getByRole('heading', { name: 'Opening', level: 4, includeHidden: true })).toBeAttached();
      await expect(card.getByRole('heading', { name: 'Opening', level: 4 })).toHaveCount(0);
      expect(await page.evaluate(() => ({ text: window.getSelection().toString(),
        sameNode: window.getSelection().anchorNode === window.selectedJournalNode,
        backwards: window.getSelection().anchorOffset > window.getSelection().focusOffset,
        focused: document.activeElement === window.journalFocus }))).toEqual({ text: selected, sameNode: true, backwards, focused: true });
      await page.evaluate(() => window.getSelection().removeAllRanges());
      await expect(card.getByRole('heading', { name: 'Opening', level: 4 })).toBeVisible();
      await expect(card).toContainText('The Star invites a gentler pace.');
    } finally { release(); }
  });
}

test.describe('Gallery motion preferences', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  test('changing reduced motion settles both discovered and missing cards immediately', async ({ page }) => {
    await prepareNavigation(page, { populated: true });
    await page.goto('/journal/gallery');
    const cards = page.locator('.gallery-grid > div');
    await expect(cards).toHaveCount(78);
    await expect.poll(() => cards.evaluateAll(tiles => tiles.every(tile => getComputedStyle(tile).animationName === 'fadeInUp'))).toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => cards.evaluateAll(tiles => tiles.every(tile => {
      const style = getComputedStyle(tile);
      return style.animationName === 'none' && style.transform === 'none';
    }))).toBe(true);
    await expect(page.getByRole('button', { name: 'Open details for The Star', exact: true })).toBeEnabled();
  });
});
