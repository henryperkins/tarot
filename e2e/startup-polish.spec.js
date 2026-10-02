import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createNarrativeFixture, expectTarget, openSetup, QUESTION, startReading } from './helpers/narrativeFixtures.js';

const COACH_NAME = 'Shape a question with clarity';

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`Startup optimization and deck polish — ${platform}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    let fixture;

    test.beforeEach(async ({ page }) => {
      fixture = await createNarrativeFixture(page, { signedOut: true });
    });

    test.afterEach(async () => {
      await fixture.close();
    });

    test('closed features stay out of the production startup budget', async ({ page }) => {
      await openSetup(page);
      test.skip(!await page.locator('script[type="module"][src^="/assets/"]').count(), 'Production bundle check.');
      await page.waitForLoadState('networkidle');
      const resources = await page.evaluate(() => performance.getEntriesByType('resource')
        .filter(entry => /\.js(?:\?|$)/.test(entry.name))
        .map(entry => ({ name: entry.name, bytes: entry.decodedBodySize })));
      expect(resources.reduce((total, entry) => total + entry.bytes, 0)).toBeLessThan(1_180_000);
      expect(resources.filter(entry => /\/(GuidedIntentionCoach|AuthModal|readingSchema)-/.test(entry.name))).toEqual([]);
    });

    for (const feature of ['sign in', 'question coach']) {
      test(`a slow ${feature} keeps focus, can be canceled, and returns to its opener`, async ({ page }, testInfo) => {
        const name = feature === 'sign in' ? 'AuthModal' : 'GuidedIntentionCoach';
        let release;
        const held = new Promise(resolve => { release = resolve; });
        let requested = false;
        await page.route(new RegExp(`/assets/${name}-[^/]+\\.js(?:\\?|$)`), async route => {
          requested = true;
          await held;
          await route.continue();
        });
        try {
          await openSetup(page);
          test.skip(!await page.locator('script[type="module"][src^="/assets/"]').count(), 'Production chunk timing.');
          await page.waitForLoadState('networkidle');
          expect(requested).toBe(false);
          const opener = feature === 'sign in'
            ? page.getByRole('button', { name: 'Sign In', exact: true }).filter({ visible: true }).first()
            : page.getByRole('button', { name: /Refine.*question|Open.*coach|Craft.*question/i }).filter({ visible: true }).first();
          await opener.focus();
          await opener.press('Enter');
          const pending = page.getByRole('dialog', { name: `Opening ${feature}…`, exact: true });
          await expect(pending).toBeVisible();
          await expect.poll(() => requested).toBe(true);
          await expect.poll(() => pending.evaluate(element => element.contains(document.activeElement))).toBe(true);
          await expectTarget(pending.getByRole('button', { name: 'Close', exact: true }));
          const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
          expect(accessibility.violations).toEqual([]);
          await pending.screenshot({ path: testInfo.outputPath('loading-dialog.png') });
          await page.keyboard.press('Tab');
          expect(await pending.evaluate(element => element.contains(document.activeElement))).toBe(true);
          await page.keyboard.press('Escape');
          await expect(pending).toHaveCount(0);
          await expect(opener).toBeFocused();
          await opener.press('Enter');
          await expect(pending).toBeVisible();
          release();
          if (feature === 'sign in') await expect(page.locator('#auth-email')).toBeFocused();
          else await expect(page.getByRole('dialog', { name: COACH_NAME })).toBeVisible();
          await expect(pending).toHaveCount(0);
          await page.keyboard.press('Escape');
          await expect(page.getByRole('dialog')).toHaveCount(0);
          await expect(opener).toBeFocused();
        } finally {
          release();
        }
      });
    }

    test('a missing sign-in chunk leaves a dismissible error and the reading setup usable', async ({ page }) => {
      await page.route(/\/assets\/AuthModal-[^/]+\.js(?:\?|$)/, route => route.abort('failed'));
      await openSetup(page);
      test.skip(!await page.locator('script[type="module"][src^="/assets/"]').count(), 'Production chunk failure.');
      const opener = page.getByRole('button', { name: 'Sign In', exact: true }).filter({ visible: true }).first();
      await opener.focus();
      await opener.press('Enter');
      await expect(page.getByRole('alert')).toContainText('Check your connection');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(opener).toBeFocused();
      await expect(page.getByRole('radiogroup', { name: 'Spread selection' })).toBeVisible();
    });

    test('reading validation loads on demand and still validates before starting one job', async ({ page }) => {
      let requested = false;
      let release;
      const held = new Promise(resolve => { release = resolve; });
      await page.route(/\/assets\/readingSchema-[^/]+\.js(?:\?|$)/, async route => {
        requested = true;
        await held;
        await route.continue();
      });
      try {
        await openSetup(page);
        test.skip(!await page.locator('script[type="module"][src^="/assets/"]').count(), 'Production chunk timing.');
        await page.waitForLoadState('networkidle');
        expect(requested).toBe(false);
        await startReading(page, fixture, { complete: false });
        await expect.poll(() => requested).toBe(true);
        expect(fixture.requests.reading).toHaveLength(0);
        release();
        await expect.poll(() => fixture.requests.reading.length).toBe(1);
        await fixture.completeReading();
        await expect(page.getByRole('heading', { name: 'Your Personalized Narrative' })).toBeVisible();
      } finally {
        release();
      }
    });

    test('failed validation gives reload recovery and preserves the question', async ({ page }) => {
      await page.route(/\/assets\/readingSchema-[^/]+\.js(?:\?|$)/, route => route.abort('failed'), { times: 1 });
      await openSetup(page);
      test.skip(!await page.locator('script[type="module"][src^="/assets/"]').count(), 'Production chunk failure.');
      await startReading(page, fixture, { complete: false });
      await expect(page.getByRole('alert')).toContainText('Check your connection, then reload this page. Your question is saved');
      expect(fixture.requests.reading).toHaveLength(0);
      await page.reload();
      await expect(page.locator('#question-input, #quick-intention').filter({ visible: true }).first()).toHaveValue(QUESTION);
      await startReading(page, fixture);
    });

    for (const theme of ['dark', 'light']) {
      test(`all three deck surfaces render and stay readable when selected (${theme})`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: 1280, height: 1000 });
        await page.addInitScript(value => localStorage.setItem('tarot-theme', value), theme);
        await openSetup(page);
        const decks = page.getByRole('radiogroup', { name: 'Choose your deck style' });
        const cards = decks.locator('.deck-card');
        await expect(cards).toHaveCount(3);
        for (let index = 0; index < 3; index += 1) {
          const card = cards.nth(index);
          await expect.poll(() => card.evaluate(element => getComputedStyle(element).backgroundImage)).not.toBe('none');
          await card.getByRole('radio').press('Space');
          await expect(card.getByRole('radio')).toHaveAttribute('aria-checked', 'true');
          const result = await new AxeBuilder({ page }).include('.deck-selector-panel')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
          expect(result.violations).toEqual([]);
        }
        await decks.screenshot({ path: testInfo.outputPath(`decks-${theme}.png`) });
      });
    }
  });
}
