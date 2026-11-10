import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture } from './helpers/narrativeFixtures.js';

const entry = {
  id: 'arcana-keyboard', ts: Date.now(), spread: 'Three-Card Story', spreadKey: 'threeCard',
  cards: [{ name: 'The Fool', position: 'Present', orientation: 'Upright' }],
  question: 'What can I learn from this week?', personalReading: 'Make room for a fresh perspective.'
};

// The mobile Journey mounts only after its native disclosure is opened.
async function openMobileJourney(page) {
  const summary = page.locator('summary', { hasText: 'Your reading journey' });
  const details = summary.locator('xpath=ancestor::details[1]');
  await summary.waitFor();
  // getAttribute returns '' (falsy) for present boolean attributes; test for absence instead.
  if ((await details.getAttribute('open')) === null) await summary.click();
  await expect(details).toHaveAttribute('open');
}

// Arcana rows fit their width (wrapping only for enlarged text): no numeral may sit
// outside its row or the viewport, and nothing scrolls sideways.
async function checkArcanaBoundaries(page, row) {
  await row.evaluate(async element => {
    await document.fonts.ready;
    const dialog = element.closest('[role="dialog"]');
    await Promise.allSettled((dialog?.getAnimations() || []).map(animation => animation.finished));
    element.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  const layout = await row.evaluate(element => {
    const box = element.getBoundingClientRect();
    const tiles = [...element.querySelectorAll('[role="img"]')].map(tile => {
      const rect = tile.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, textOverflow: tile.scrollWidth - tile.clientWidth };
    });
    return { left: box.left, right: box.right, overflow: element.scrollWidth - element.clientWidth, tiles };
  });
  expect(layout.overflow).toBeLessThanOrEqual(0);
  expect(layout.tiles).toHaveLength(11);
  for (const tile of layout.tiles) {
    expect(tile.width).toBeGreaterThan(0);
    expect(tile.left).toBeGreaterThanOrEqual(layout.left - 0.5);
    expect(tile.right).toBeLessThanOrEqual(layout.right + 0.5);
    expect(tile.textOverflow).toBeLessThanOrEqual(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
}

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`Startup hardening — ${platform}`, () => {
    test.use({ serviceWorkers: 'block' });

    for (const theme of ['light', 'dark']) {
      test(`stored ${theme} theme is applied before the React entry executes`, async ({ page }) => {
        const fixture = await createNarrativeFixture(page, { signedOut: true });
        let release;
        const held = new Promise(resolve => { release = resolve; });
        await page.addInitScript(value => localStorage.setItem('tarot-theme', value), theme);
        await page.route(/\/(assets\/app-[^/]+\.js|src\/main\.jsx)(?:\?.*)?$/, async route => {
          await held;
          await route.continue();
        });
        try {
          await page.goto('/', { waitUntil: 'commit' });
          await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('light'))).toBe(theme === 'light');
          await expect(page.locator('#root')).toBeEmpty();
          await expect.poll(() => page.locator('meta[name="theme-color"]').evaluateAll(nodes => nodes.map(node => node.content.toLowerCase())))
            .toEqual([theme === 'light' ? '#fafafa' : '#0f0e13', theme === 'light' ? '#fafafa' : '#0f0e13']);
          release();
          await expect(page.getByRole('heading', { level: 2, name: 'Welcome to Tableu', exact: true })).toBeVisible();
          await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('light'))).toBe(theme === 'light');
        } finally {
          release();
          await fixture.close();
        }
      });
    }

    test('theme storage failures preserve a usable default and in-memory switching', async ({ page }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      await page.addInitScript(() => {
        const get = Storage.prototype.getItem;
        const set = Storage.prototype.setItem;
        Storage.prototype.getItem = function (key) {
          if (key === 'tarot-theme') throw new DOMException('Storage unavailable', 'SecurityError');
          return get.call(this, key);
        };
        Storage.prototype.setItem = function (key, value) {
          if (key === 'tarot-theme') throw new DOMException('Storage is full', 'QuotaExceededError');
          return set.call(this, key, value);
        };
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto('/account');
        const themes = page.getByRole('radiogroup', { name: 'Theme', exact: true });
        for (const label of ['Light', 'Dark']) {
          const option = themes.getByRole('radio', { name: label, exact: true });
          await option.press('Enter');
          await expect(option).toHaveAttribute('aria-checked', 'true');
          await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('light'))).toBe(label === 'Light');
        }
        expect(errors).toEqual([]);
      } finally {
        await fixture.close();
      }
    });

    test('the journey panel keeps controls and card names reachable at 200% text', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 900 });
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      // Cards Calling You lists cards that repeat, so The Fool comes up in two readings.
      await page.addInitScript(value => {
        localStorage.setItem('tarot-onboarding-complete', 'true');
        localStorage.setItem('tarot_journal', JSON.stringify([value, { ...value, id: `${value.id}-again`, ts: value.ts - 60000 }]));
      }, entry);
      try {
        await page.goto('/journal');
        await openMobileJourney(page);
        const opener = page.getByRole('button', { name: 'See Full Journey', exact: false });
        await opener.press('Enter');
        const panel = page.getByRole('dialog', { name: 'Your Reading Journey', exact: true });
        await expect(panel).toBeVisible();
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
        for (const control of [panel.getByRole('link', { name: 'Journey settings' }), panel.getByRole('button', { name: 'Close journey panel' })]) {
          const box = await control.boundingBox();
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(320);
          expect(box.width).toBeGreaterThanOrEqual(43.99);
          expect(box.height).toBeGreaterThanOrEqual(43.99);
        }
        const card = panel.getByRole('list', { name: 'Your top most frequently appearing cards' }).locator('li').first()
          .locator('span.text-main').filter({ hasText: entry.cards[0].name });
        expect(await card.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
        for (const name of ['Major Arcana 0 to 10', 'Major Arcana 11 to 21']) await checkArcanaBoundaries(page, panel.getByRole('group', { name, exact: true }));
        for (const tab of await panel.getByRole('tab').all()) {
          await tab.focus();
          await tab.press('Enter');
          await expect(tab).toHaveAttribute('aria-selected', 'true');
          const box = await tab.boundingBox();
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(320);
        }
        await panel.getByRole('button', { name: 'Close journey panel' }).press('Enter');
        await expect(panel).toHaveCount(0);
        await expect(opener).toBeFocused();
      } finally {
        await fixture.close();
      }
    });

    for (const width of [390, 1280]) {
      test(`journey streak tooltips retain valid DOM and keyboard behavior at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        const fixture = await createNarrativeFixture(page, { signedOut: true });
        const nestingWarnings = [];
        page.on('console', message => {
          if (/cannot be a descendant|validateDOMNesting|cannot contain a nested/.test(message.text())) nestingWarnings.push(message.text());
        });
        await page.addInitScript(value => {
          localStorage.setItem('tarot-onboarding-complete', 'true');
          localStorage.setItem('tarot_journal', JSON.stringify([value]));
        }, entry);
        try {
          await page.goto('/journal');
          let surface = page.locator('aside');
          if (width < 1024) {
            await openMobileJourney(page);
            surface = page.getByRole('region', { name: 'Journal insights and journey', exact: true });
          }
          const trigger = surface.getByRole('button', { name: 'About streak grace period', exact: true });
          await trigger.focus();
          await expect(surface.getByRole('tooltip')).toContainText('grace period');
          await page.keyboard.press('Escape');
          await expect(surface.getByRole('tooltip')).toBeHidden();
          await expect(trigger).toBeFocused();
          if (width < 1024) await expect(surface).toBeVisible();
          await trigger.evaluate(element => element.blur());
          await trigger.hover();
          await expect(surface.getByRole('tooltip')).toBeVisible();
          await page.mouse.move(0, 0);
          await expect(surface.getByRole('tooltip')).toBeHidden();
          expect(nestingWarnings).toEqual([]);
        } finally { await fixture.close(); }
      });
    }

    test('the Arcana map shows all 22 numerals in its named rows without scrolling', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      await page.addInitScript(value => {
        localStorage.setItem('tarot-onboarding-complete', 'true');
        localStorage.setItem('tarot_journal', JSON.stringify([value]));
      }, entry);
      try {
        await page.goto('/journal');
        const first = page.getByRole('group', { name: 'Major Arcana 0 to 10', exact: true });
        const second = page.getByRole('group', { name: 'Major Arcana 11 to 21', exact: true });
        await expect(first).toBeVisible();
        await expect(second).toBeVisible();
        // The rows are not scroll areas, so they take no Tab stop.
        expect(await first.getAttribute('tabindex')).toBeNull();
        expect(await second.getAttribute('tabindex')).toBeNull();
        await expect(second.getByRole('img', { name: 'The World: appeared 0 times', exact: true })).toBeVisible();
        await expect(first.getByRole('img', { name: 'The Fool: appeared 1 time', exact: true })).toHaveCount(1);
        expect(await first.getByRole('img').count() + await second.getByRole('img').count()).toBe(22);
        await checkArcanaBoundaries(page, first);
        await checkArcanaBoundaries(page, second);
      } finally {
        await fixture.close();
      }
    });
  });
}
