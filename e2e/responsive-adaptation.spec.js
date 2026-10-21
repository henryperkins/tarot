import { test, expect, openAccountOptions } from './helpers/frontendTest.js';
import { createNarrativeFixture, openSetup, startReading } from './helpers/narrativeFixtures.js';

async function expectTouchTarget(locator) {
  // Browsers can report transformed 44px edges a few millionths below the integer.
  // Resolve the visible placement again while a breakpoint handoff completes.
  await expect.poll(async () => {
    const box = await locator.boundingBox();
    return box ? Math.min(box.width, box.height) : 0;
  }).toBeGreaterThanOrEqual(43.99);
}

async function expectNavigationFits(page) {
  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  // Read both destinations atomically while the responsive copy is settling.
  // Separate boundingBox calls can straddle its hidden/inert handoff.
  await expect.poll(() => nav.evaluate(element => {
    const links = [...element.querySelectorAll('a')];
    if (links.length !== 2) return null;
    const boxes = links.map(link => link.getBoundingClientRect());
    const labels = links.map(link => link.querySelector('span').getBoundingClientRect());
    const [reading, journal] = boxes;
    const overlapX = Math.min(reading.right, journal.right) - Math.max(reading.left, journal.left);
    const overlapY = Math.min(reading.bottom, journal.bottom) - Math.max(reading.top, journal.top);
    return {
      targets: boxes.every(box => Math.min(box.width, box.height) >= 43.99),
      labels: labels.every((box, index) => box.left >= boxes[index].left && box.right <= boxes[index].right),
      overlap: Math.max(0, overlapX) * Math.max(0, overlapY)
    };
  })).toEqual({ targets: true, labels: true, overlap: 0 });
}

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`Responsive adaptation — ${platform}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

    test('guest navigation keeps readable destinations and usable actions', async ({ page }) => {
      test.setTimeout(60000); // Covers ten full route loads across two viewport widths.
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      try {
        await openSetup(page);
        for (const width of [390, 320]) {
          await page.setViewportSize({ width, height: 844 });
          for (const route of ['/', '/pricing', '/journal', '/journal/gallery', '/account']) {
            await page.goto(route);
            await page.getByRole('navigation', { name: 'Primary navigation' }).waitFor();
            await page.evaluate(() => document.fonts.ready);
            await expectNavigationFits(page);
            const signIn = page.locator('[data-app-header]').getByRole('button', { name: 'Sign In', exact: true });
            await expectTouchTarget(signIn);
            const settings = page.locator('[data-app-header]').getByRole('link', { name: 'Settings', exact: true });
            await expectTouchTarget(settings);
            await settings.focus();
            await page.keyboard.press('Tab');
            await expect(signIn).toBeFocused();
          }
        }
        const nav = page.getByRole('navigation', { name: 'Primary navigation' });
        await nav.getByRole('link', { name: 'Reading', exact: true }).press('Enter');
        await expect(page.getByRole('radiogroup', { name: 'Spread selection' })).toBeVisible();
        await nav.getByRole('link', { name: 'Journal', exact: true }).press('Enter');
        await expect(page).toHaveURL(/\/journal$/);
        await expect(page.getByRole('heading', { name: 'Your Tarot Journal', exact: true })).toBeVisible();
        await openAccountOptions(page);
        const signIn = page.locator('[data-app-header]').getByRole('button', { name: 'Sign In', exact: true });
        await signIn.focus();
        await signIn.press('Enter');
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.locator('#auth-email')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(signIn).toBeFocused();
      } finally {
        await fixture.close();
      }
    });

    test('reading navigation returns to the same cards, question, notes, and interpretation', async ({ page }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      const note = 'Keep this reflection while visiting the journal.';
      const readingSnapshot = () => page.evaluate(() => {
        const snapshot = JSON.parse(sessionStorage.getItem('tarot:reading-snapshot') || 'null');
        if (!snapshot) return null;
        const { reading, question, reflections, narrative } = snapshot;
        return { reading, question, reflections, narrative };
      });
      try {
        await startReading(page, fixture, { reflection: note });
        await expect(page.locator('.app-shell--reading')).toBeVisible();
        await expect.poll(async () => (await readingSnapshot())?.narrative?.raw).toBe(fixture.narrative);
        const before = await readingSnapshot();
        expect(before.reading.length).toBeGreaterThan(0);
        expect(Object.values(before.reflections)).toContain(note);
        const nav = page.getByRole('navigation', { name: 'Primary navigation', exact: true });
        await expect(nav).toHaveCount(1);
        await expectNavigationFits(page);
        await expect(nav.getByRole('link', { name: 'Reading', exact: true })).toHaveAttribute('aria-current', 'page');
        await nav.getByRole('link', { name: 'Journal', exact: true }).click();
        await expect(page).toHaveURL(/\/journal$/);
        await expect(nav.getByRole('link', { name: 'Journal', exact: true })).toHaveAttribute('aria-current', 'page');
        await nav.getByRole('link', { name: 'Reading', exact: true }).click();
        await expect(page.locator('.app-shell--reading')).toBeVisible();
        await expect(page.getByText('Narrative ready.', { exact: true })).toBeAttached();
        await expect.poll(readingSnapshot).toEqual(before);
        expect(fixture.requests.reading).toHaveLength(1);
      } finally {
        await fixture.close();
      }
    });

    test('pricing retains prices and upgrade targets at 320px in either billing interval', async ({ page }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      try {
        await openSetup(page);
        await page.setViewportSize({ width: 320, height: 844 });
        await page.goto('/pricing');
        await expect(page.getByRole('button', { name: 'Monthly', exact: true })).toBeVisible();
        for (const interval of ['Monthly', 'Annual']) {
          await page.getByRole('button', { name: new RegExp(`^${interval}`) }).click();
          await page.evaluate(() => document.fonts.ready);
          const widths = await page.evaluate(() => ({
            content: document.documentElement.scrollWidth,
            viewport: document.documentElement.clientWidth
          }));
          expect(widths.content, `${interval} pricing overflows`).toBeLessThanOrEqual(widths.viewport);
          for (const tier of ['Plus', 'Pro']) {
            const button = page.getByRole('button', { name: `Upgrade to ${tier}`, exact: true }).last();
            await expectTouchTarget(button);
            const box = await button.boundingBox();
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(widths.viewport);
          }
        }
      } finally {
        await fixture.close();
      }
    });

    test('guest actions remain separate from destinations on wider screens and in landscape', async ({ page }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      try {
        await openSetup(page);
        for (const viewport of [
          { width: 640, height: 844 }, { width: 768, height: 1024 },
          { width: 844, height: 390 }, { width: 1440, height: 1000 }
        ]) {
          await page.setViewportSize(viewport);
          await page.evaluate(() => document.fonts.ready);
          await expectNavigationFits(page);
          await expectTouchTarget(page.locator('[data-app-header]').getByRole('link', { name: 'Settings', exact: true }));
          await expectTouchTarget(page.locator('[data-app-header]').getByRole('button', { name: 'Sign In', exact: true }));
          const overlaps = await page.locator('.header-sticky .site-nav').evaluate(row => {
            const controls = [...row.querySelectorAll('button,a,summary')].filter(element => element.getClientRects().length);
            return controls.flatMap((control, index) => controls.slice(index + 1).flatMap(other => {
              const a = control.getBoundingClientRect();
              const b = other.getBoundingClientRect();
              const overlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
                * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
              return overlap > 0.01 ? [`${control.textContent.trim()} / ${other.textContent.trim()}`] : [];
            }));
          });
          expect(overlaps).toEqual([]);
        }
        await openAccountOptions(page);
        await page.getByRole('button', { name: 'Sign In', exact: true }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
      } finally {
        await fixture.close();
      }
    });

    test('desktop header stays quiet and progress remains operable inside the canvas', async ({ page }) => {
      test.setTimeout(60000);
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      try {
        await openSetup(page);
        for (const width of [1023, 1024, 1440, 1920]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.evaluate(() => document.fonts.ready);
          await expectNavigationFits(page);
          const dimensions = await page.locator('[data-app-header]').evaluate(header => {
            const measure = selector => {
              const element = document.querySelector(selector);
              const box = element.getBoundingClientRect();
              return { width: box.width, height: box.height, x: box.x, y: box.y, fontSize: parseFloat(getComputedStyle(element).fontSize) };
            };
            return {
              inner: measure('.app-header__inner'),
              logo: measure('.tableu-logo'),
              wordmark: measure('.site-nav__wordmark'),
              link: measure('.site-nav__link'),
              header: header.getBoundingClientRect().toJSON(),
              progress: measure('.step-progress-canvas'),
              step: measure('.step-progress-canvas button'),
              scrollWidth: document.documentElement.scrollWidth,
              viewportWidth: document.documentElement.clientWidth
            };
          });
          expect(dimensions.logo.width).toBe(30);
          expect(dimensions.wordmark.fontSize).toBe(17);
          expect(dimensions.link.fontSize).toBe(14);
          expect(dimensions.step.fontSize).toBe(14);
          expect(dimensions.header.height).toBe(56);
          expect(dimensions.progress.y).toBeGreaterThanOrEqual(dimensions.header.bottom);
          expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
          expect(dimensions.inner.width).toBeLessThanOrEqual(1024);
          const progress = page.getByRole('navigation', { name: 'Tarot reading progress' });
          const currentStep = progress.locator('[aria-current="step"]');
          await expect(currentStep).toHaveCount(1);
          for (const button of await progress.getByRole('button').all()) await expectTouchTarget(button);
          await page.keyboard.press('Tab');
          await currentStep.focus();
          await expect(currentStep).toBeFocused();
          await expect(currentStep).toHaveCSS('outline-style', 'solid');
          await expect(currentStep).toHaveCSS('outline-width', '2px');
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        await startReading(page, fixture);
        await expect(page.locator('.app-shell--reading')).toBeVisible();
        const readingProgress = page.locator('main .step-progress-canvas');
        await expect(page.locator('[data-app-header] .step-progress-canvas')).toHaveCount(0);
        expect((await readingProgress.boundingBox()).width).toBeLessThanOrEqual((await page.locator('main').boundingBox()).width);
        for (const button of await readingProgress.getByRole('button').all()) await expectTouchTarget(button);
        const settings = page.getByRole('button', { name: 'Reading settings', exact: true });
        await expectTouchTarget(settings);
        expect((await settings.locator('svg').boundingBox()).width).toBeGreaterThanOrEqual(21);
      } finally {
        await fixture.close();
      }
    });

    test('enlarged text leaves pricing and account controls reachable and restores sticky navigation', async ({ page }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      try {
        await openSetup(page);
        await page.goto('/pricing');
        await page.getByRole('button', { name: 'Monthly', exact: true }).waitFor();
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
        await expectNavigationFits(page);
        await page.getByRole('button', { name: /^Annual/ }).click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
        await page.getByRole('button', { name: 'Upgrade to Plus', exact: true }).last().click();
        await expect(page.getByRole('dialog')).toBeVisible();

        await page.goto('/account');
        await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor();
        const enlargedText = await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
        const sections = page.getByRole('navigation', { name: 'Jump to section' });
        await sections.getByRole('link', { name: 'Reading', exact: true }).click();
        await expect(page.locator('#reading-heading')).toBeFocused();
        const sectionBox = await page.locator('#reading').boundingBox();
        const navBox = await sections.boundingBox();
        expect(sectionBox.y).toBeGreaterThanOrEqual(navBox.y + navBox.height);
        for (const name of ['Light', 'Dark']) {
          const option = page.getByRole('radiogroup', { name: 'Theme', exact: true }).getByRole('radio', { name, exact: true });
          await option.click();
          await expect(option).toHaveAttribute('aria-checked', 'true');
          const box = await option.boundingBox();
          expect(box.x + box.width).toBeLessThanOrEqual(390);
        }
        await enlargedText.evaluate(element => element.remove());
        await expect.poll(() => page.locator('header').evaluate(element => getComputedStyle(element).position)).toBe('sticky');
        await expect.poll(() => page.evaluate(() => {
          const header = document.querySelector('header').getBoundingClientRect();
          const nav = document.querySelector('[aria-label="Jump to section"]').getBoundingClientRect();
          return nav.top - header.bottom;
        })).toBeCloseTo(0, 0);
      } finally {
        await fixture.close();
      }
    });

    test('account section and utility controls retain 44px touch targets', async ({ page }) => {
      const fixture = await createNarrativeFixture(page);
      try {
        await openSetup(page);
        await page.goto('/account');
        await expect(page.getByRole('heading', { name: 'Account & Settings' })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const sectionLinks = page.getByRole('navigation', { name: 'Jump to section' }).getByRole('link');
        for (const link of await sectionLinks.all()) await expectTouchTarget(link);
        const returnLinks = page.locator('main').getByRole('link', { name: 'Back to reading', exact: true });
        await expect(returnLinks).toHaveCount(2);
        for (const link of await returnLinks.all()) await expectTouchTarget(link);
        for (const name of ['Open journal', 'Forgot password?']) {
          await expectTouchTarget(page.locator('main').getByRole('link', { name, exact: true }));
        }
        for (const name of [
          'Edit', 'Password', 'Resend verification', 'Reset Journey data',
          'Export PDF', 'Export CSV', 'Export all data (JSON)', 'Manage subscription'
        ]) {
          await expectTouchTarget(page.locator('main').getByRole('button', { name, exact: true }));
        }
        const planToggle = page.locator('button[aria-controls="plan-usage-details"]');
        await expectTouchTarget(planToggle);
        await expect(planToggle).toHaveAttribute('aria-expanded', 'false');
        await planToggle.click();
        await expect(planToggle).toHaveAttribute('aria-expanded', 'true');
        for (const name of ['Refresh', 'Try again', 'Restore purchases']) {
          await expectTouchTarget(page.locator('#subscription').getByRole('button', { name, exact: true }));
        }
        await expectTouchTarget(page.locator('#reversal-framework-select'));
      } finally {
        await fixture.close();
      }
    });
  });
}
