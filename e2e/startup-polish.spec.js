import { test, expect, openAccountOptions } from './helpers/frontendTest.js';
import { createChunkFailurePreview } from './helpers/chunkFailurePreview.js';
import AxeBuilder from '@axe-core/playwright';
import { createNarrativeFixture, expectTarget, openSetup, QUESTION, startReading } from './helpers/narrativeFixtures.js';

const COACH_NAME = 'Shape a question with clarity';
const ONBOARDING_CHUNK = /\/assets\/OnboardingWizard-[^/]+\.js(?:\?|$)/;
const CONTROL_STEP_CHUNK = /\/assets\/OnboardingControlStep-[^/]+\.js(?:\?|$)/;

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

    test('returning guests load closed features only on demand', async ({ page }) => {
      await openSetup(page);
      test.skip(!await page.locator('script[type="module"][src^="/assets/"]').count(), 'Production bundle check.');
      await page.waitForLoadState('networkidle');
      const scripts = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
      expect(scripts.filter(name => /\/(GuidedIntentionCoach|AuthModal|OnboardingWizard|OnboardingControlStep|readingSchema)-[^/]+\.js(?:\?|$)/.test(name))).toEqual([]);
    });

    test('a slow tutorial restores the saved step, spread and question when it opens', async ({ page }) => {
      await page.addInitScript(progress => localStorage.setItem('tableau-onboarding-progress', JSON.stringify(progress)),
        { step: 3, selectedSpread: 'single', question: QUESTION, variant: 'trimmed' });
      let release;
      const held = new Promise(resolve => { release = resolve; });
      await page.route(ONBOARDING_CHUNK, async route => {
        await held;
        await route.continue();
      });
      try {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        test.skip(!await page.locator('script[type="module"][src^="/assets/"]').count(), 'Production chunk timing.');
        const pending = page.getByRole('dialog', { name: 'Opening tutorial…', exact: true });
        await expect(pending.getByRole('heading')).toBeFocused();
        release();
        const wizard = page.getByRole('dialog', { name: 'Welcome to Tableu', exact: true });
        await expect(wizard.getByRole('textbox', { name: 'Your question or intention' })).toHaveValue(QUESTION);
        await wizard.getByRole('button', { name: 'Go back', exact: true }).click();
        await expect(wizard.getByRole('button', { name: /One Card/ })).toHaveAttribute('aria-pressed', 'true');
      } finally {
        release();
      }
    });

    test('the seven-step tutorial loads only for its variant and can finish a reading setup', async ({ page }) => {
      let controlRequested = false;
      page.on('request', request => { if (CONTROL_STEP_CHUNK.test(request.url())) controlRequested = true; });
      await page.goto('/');
      test.skip(!await page.locator('script[type="module"][src^="/assets/"]').count(), 'Production chunk timing.');
      const wizard = page.getByRole('dialog', { name: 'Welcome to Tableu', exact: true });
      await expect(wizard.getByRole('heading', { level: 2, name: 'Welcome to Tableu' })).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(controlRequested).toBe(false);

      await page.goto('/?onboarding=control');
      const next = wizard.getByRole('button', { name: 'Continue', exact: true });
      await next.click();
      expect(controlRequested).toBe(true);
      await wizard.getByRole('button', { name: 'Skip', exact: true }).click();
      await next.click();
      await wizard.getByRole('textbox').fill(QUESTION);
      await next.click();
      await wizard.getByRole('button', { name: /I understand.*continue/i }).click();
      await next.click();
      await wizard.getByRole('button', { name: 'Begin Your Reading', exact: true }).click();
      await expect(page.getByRole('radiogroup', { name: 'Spread selection' })).toBeVisible();
      await expect(page.locator('#question-input, #quick-intention').filter({ visible: true }).first()).toHaveValue(QUESTION);
    });

    for (const [asset, path, chunk] of [
      ['wizard', '/', ONBOARDING_CHUNK],
      ['focus dependency', '/', /\/assets\/focus-trap-react-[^/]+\.js(?:\?|$)/],
      ['seven-step module', '/?onboarding=control', CONTROL_STEP_CHUNK]
    ]) {
      test(`the tutorial can be dismissed and retried when its ${asset} fails to load`, async ({ page }, testInfo) => {
        const preview = await createChunkFailurePreview(testInfo.project.use.baseURL, chunk);
        try {
          await page.goto(new URL(path, preview.origin).href);
          test.skip(!await page.locator('script[type="module"][src^="/assets/"]').count(), 'Production chunk failure.');
          const failed = page.getByRole('dialog', { name: 'Unable to open tutorial', exact: true });
          await expect(failed.getByRole('alert')).toContainText('Check your connection');
          await failed.getByRole('button', { name: 'Close' }).click();
          await expect(page.getByRole('radiogroup', { name: 'Spread selection' })).toBeVisible();
          await expect(page.locator('#step-spread')).toBeFocused();
          await page.reload();
          await expect(page.getByRole('heading', { name: 'Welcome to Tableu', level: 2 })).toBeVisible();
          expect(preview.failures()).toBe(1);
        } finally {
          await preview.close();
        }
      });
    }

    for (const feature of ['sign in', 'question coach']) {
      test(`a slow ${feature} keeps focus, can be canceled, and restores its available trigger`, async ({ page }, testInfo) => {
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
          const accountOptions = feature === 'sign in' ? await openAccountOptions(page) : null;
          const opener = feature === 'sign in'
            ? page.getByRole('button', { name: 'Sign In', exact: true }).filter({ visible: true }).first()
            : page.getByRole('button', { name: /Refine.*question|Open.*coach|Craft.*question/i }).filter({ visible: true }).first();
          const returnTarget = accountOptions || opener;
          await opener.focus();
          await opener.press('Enter');
          const pending = page.getByRole('dialog', { name: `Opening ${feature}…`, exact: true });
          await expect(pending).toBeVisible();
          await expect.poll(() => requested).toBe(true);
          await expect.poll(() => pending.evaluate(element => element.contains(document.activeElement))).toBe(true);
          await expectTarget(pending.getByRole('button', { name: 'Close', exact: true }));
          const accessibility = await new AxeBuilder({ page }).include('[role="dialog"]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
          expect(accessibility.violations).toEqual([]);
          await pending.screenshot({ path: testInfo.outputPath('loading-dialog.png') });
          await page.keyboard.press('Tab');
          expect(await pending.evaluate(element => element.contains(document.activeElement))).toBe(true);
          await page.keyboard.press('Escape');
          await expect(pending).toHaveCount(0);
          await expect(returnTarget).toBeFocused();
          if (feature === 'sign in') await openAccountOptions(page);
          await opener.press('Enter');
          await expect(pending).toBeVisible();
          release();
          if (feature === 'sign in') await expect(page.locator('#auth-email')).toBeFocused();
          else await expect(page.getByRole('dialog', { name: COACH_NAME })).toBeVisible();
          await expect(pending).toHaveCount(0);
          await page.keyboard.press('Escape');
          await expect(page.getByRole('dialog')).toHaveCount(0);
          await expect(returnTarget).toBeFocused();
        } finally {
          release();
        }
      });
    }

    test('a missing sign-in chunk leaves a dismissible error and the reading setup usable', async ({ page }) => {
      await page.route(/\/assets\/AuthModal-[^/]+\.js(?:\?|$)/, route => route.abort('failed'));
      await openSetup(page);
      test.skip(!await page.locator('script[type="module"][src^="/assets/"]').count(), 'Production chunk failure.');
      const accountOptions = await openAccountOptions(page);
      const opener = page.getByRole('button', { name: 'Sign In', exact: true }).filter({ visible: true }).first();
      await opener.focus();
      await opener.press('Enter');
      await expect(page.getByRole('alert')).toContainText('Check your connection');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(accountOptions).toBeFocused();
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
        await expect(page.getByRole('heading', { name: 'Your reading', exact: true })).toBeVisible();
      } finally {
        release();
      }
    });

    test('failed validation gives reload recovery and preserves the question and cards', async ({ page }, testInfo) => {
      await openSetup(page);
      test.skip(!await page.locator('script[type="module"][src^="/assets/"]').count(), 'Production chunk failure.');
      // Serve a real one-time HTTP failure. WebKit inspector interception caches
      // blocked module URLs across reloads, unlike an ordinary server response.
      const preview = await createChunkFailurePreview(testInfo.project.use.baseURL);
      try {
        await openSetup(page, { url: preview.origin });
        await startReading(page, fixture, { complete: false, setup: false });
        await expect(page.getByRole('alert')).toContainText('Check your connection, then reload this page. Your question and cards are saved.');
        expect(preview.failures()).toBe(1);
        expect(fixture.requests.reading).toHaveLength(0);
        await page.reload();
        // The revealed spread returns with its question, ready to interpret.
        await expect(page.getByText(QUESTION, { exact: true }).filter({ visible: true }).first()).toBeVisible();
        await page.getByRole('button', { name: /^Interpret cards/ }).filter({ visible: true }).first().press('Enter');
        await fixture.completeReading();
        expect(preview.failures()).toBe(1);
      } finally { await preview.close(); }
    });

    for (const theme of ['dark', 'light']) {
      test(`all three deck surfaces render and stay readable when selected (${theme})`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width: 1280, height: 1000 });
        await page.addInitScript(value => localStorage.setItem('tarot-theme', value), theme);
        await openSetup(page);
        // Wider screens keep the decks behind the Deck row until it is opened.
        await page.getByRole('button', { name: /^Deck\b/ }).click();
        const decks = page.getByRole('radiogroup', { name: 'Choose your deck style' });
        const cards = decks.locator('.deck-card');
        await expect(cards).toHaveCount(3);
        for (let index = 0; index < 3; index += 1) {
          const card = cards.nth(index);
          await expect.poll(() => card.evaluate(element => getComputedStyle(element).backgroundImage)).not.toBe('none');
          await card.getByRole('radio').press('Space');
          await expect(card.getByRole('radio')).toHaveAttribute('aria-checked', 'true');
          const result = await new AxeBuilder({ page }).include('.deck-selector-panel')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
          expect(result.violations).toEqual([]);
        }
        await decks.screenshot({ path: testInfo.outputPath(`decks-${theme}.png`) });
      });
    }
  });
}
