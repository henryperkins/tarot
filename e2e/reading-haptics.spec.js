import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, openSetup, QUESTION } from './helpers/narrativeFixtures.js';

async function openRitual(page) {
  await openSetup(page);
  await page.locator('#question-input, #quick-intention').filter({ visible: true }).first().fill(QUESTION);
  await page.getByRole('button', { name: /^Draw cards$/ }).filter({ visible: true }).first().click();
  await page.getByRole('button', { name: 'Deal spread', exact: true }).waitFor();
  await page.locator('summary').filter({ hasText: 'Optional ritual' }).click();
}

async function knockAndReveal(page) {
  for (let count = 0; count < 3; count += 1) {
    await page.getByRole('button', { name: `Knock (${count}/3)`, exact: true }).click();
  }
  await expect(page.getByRole('button', { name: 'Knock (3/3)', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Deal spread', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal next: Past', exact: true }).click();
  await page.getByRole('button', { name: /Card in Present position.*Click to reveal/ }).click();
  await expect(page.getByRole('button', { name: /Click to view details/ })).toHaveCount(2);
}

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`Reading haptics — ${platform}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    let fixture;

    test.beforeEach(async ({ page }) => {
      fixture = await createNarrativeFixture(page);
      await page.addInitScript(() => {
        window.readingVibrations = [];
        Object.defineProperty(navigator, 'vibrate', {
          configurable: true,
          value(pattern) {
            window.readingVibrations.push(pattern);
            return true;
          }
        });
      });
    });

    test.afterEach(async () => {
      await fixture.close();
    });

    test('reduced motion suppresses ritual and individual card haptics', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openRitual(page);
      await page.getByRole('button', { name: 'Set cut', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Cut set', exact: true })).toBeVisible();
      await knockAndReveal(page);
      expect(await page.evaluate(() => window.readingVibrations)).toEqual([]);
    });

    test('changing motion preference disables haptics in existing action callbacks', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await openRitual(page);
      await page.getByRole('button', { name: 'Set cut', exact: true }).click();
      expect(await page.evaluate(() => window.readingVibrations)).toContain(12);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      // The cut action is already mounted when the preference changes.
      await page.evaluate(() => { window.readingVibrations = []; });
      await page.getByRole('button', { name: 'Cut set', exact: true }).click();
      await knockAndReveal(page);
      // Stopping an earlier vibration with vibrate(0) remains safe and desirable.
      expect(await page.evaluate(() => window.readingVibrations.filter(pattern => pattern !== 0))).toEqual([]);
    });

    test('a blocked vibration API leaves ritual and reveal actions usable', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await openRitual(page);
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'vibrate', {
          configurable: true,
          value() { throw new DOMException('Vibration blocked', 'NotAllowedError'); }
        });
      });
      await page.getByRole('button', { name: 'Set cut', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Cut set', exact: true })).toBeVisible();
      await knockAndReveal(page);
      expect(errors).toEqual([]);
    });
  });
}
