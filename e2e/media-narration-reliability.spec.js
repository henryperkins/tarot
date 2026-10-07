import { test, expect } from '@playwright/test';
import { createNarrativeFixture, openSetup, QUESTION } from './helpers/narrativeFixtures.js';

test.use({ serviceWorkers: 'block' });
test.setTimeout(60000);

for (const width of [1440, 390]) {
  for (const theme of ['dark', 'light']) {
    test(`voice migration and enable/play quota recovery at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(value => {
        localStorage.setItem('tarot-theme', value);
        localStorage.setItem('tarot-tts-provider', 'hume');
        localStorage.setItem('tarot-voice-enabled', 'false');
        localStorage.setItem('tarot-auto-narrate', 'false');
      }, theme);
      await page.route(/^https?:\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/))/, route => route.abort());
      const fixture = await createNarrativeFixture(page);
      let narrationRequests = 0;
      await page.route('**/api/generate-card-video?capabilities=true', route => route.fulfill({ json: { cardVideo: false } }));
      await page.route('**/api/tts?stream=true', route => {
        narrationRequests++;
        return route.fulfill({ status: 429, json: { errorCode: 'TIER_LIMIT', tierLimited: true, used: 3, limit: 3 } });
      });
      try {
        await page.goto('/account');
        const engines = page.getByRole('radiogroup', { name: 'Select voice engine' });
        const clear = engines.getByRole('radio', { name: 'Clear Deepgram' });
        await expect(clear).toHaveAttribute('aria-checked', 'true');
        await expect(engines.getByRole('radio')).toHaveCount(2);
        await clear.focus();
        await clear.press('Enter');
        await page.keyboard.press('Tab');
        await expect(engines.getByRole('radio', { name: 'Word-Sync Azure SDK' })).toBeFocused();
        await openSetup(page);
        await page.locator('#question-input, #quick-intention').filter({ visible: true }).first().fill(QUESTION);
        await page.getByRole('button', { name: /^Draw cards$/ }).filter({ visible: true }).first().click();
        await page.getByRole('button', { name: /^Deal spread/ }).filter({ visible: true }).first().click();
        await page.getByRole('button', { name: /^Reveal all cards/ }).filter({ visible: true }).first().click();
        await expect(page.getByRole('button', { name: /Cinematic|Generate.*video|Watch.*video/i })).toHaveCount(0);
        const details = page.getByRole('button', { name: /Click to view details\./ }).filter({ visible: true }).first();
        await details.press('Enter');
        await page.getByRole('button', { name: 'Open full card' }).press('Enter');
        const cardDialog = page.getByRole('dialog');
        await expect(cardDialog).toBeVisible();
        await expect(cardDialog.getByRole('button', { name: 'Cinematic reveal' })).toHaveCount(0);
        await page.getByRole('button', { name: 'Close modal' }).press('Enter');
        await expect(cardDialog).toHaveCount(0);
        await page.getByRole('button', { name: /^Interpret cards/ }).filter({ visible: true }).first().press('Enter');
        await fixture.completeReading();
        await page.getByRole('button', { name: /^Read this aloud$|^Play$/ }).filter({ visible: true }).first().press('Enter');
        await page.getByRole('button', { name: 'Enable voice & play' }).press('Enter');
        await expect.poll(() => narrationRequests).toBe(1);
        await expect(page.getByRole('alert').filter({ hasText: 'Monthly limit reached (3/3)' })).toBeVisible();
        const plans = page.getByRole('button', { name: 'View subscription options' });
        await plans.focus();
        await expect(plans).toBeFocused();
        await plans.press('Enter');
        await expect(page).toHaveURL(/\/(account|pricing|settings)/);
      } finally { await fixture.close(); }
    });
  }
}
