import { test, expect } from '@playwright/test';
import { createNarrativeFixture, startReading, QUESTION, expectNoHorizontalOverflow } from './helpers/narrativeFixtures.js';

test.use({ serviceWorkers: 'block' });
test.setTimeout(60000);

for (const width of [1440, 390]) {
  for (const theme of ['dark', 'light']) {
    test(`retryable safety outage preserves the question and shows a clear alert at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(value => localStorage.setItem('tarot-theme', value), theme);
      // All API behavior is synthetic; external telemetry/assets are denied.
      await page.route(/^https?:\/\/(?!localhost(?::|\/)|127\.0\.0\.1(?::|\/))/, route => route.abort());
      const fixture = await createNarrativeFixture(page);
      try {
        await startReading(page, fixture, { complete: false });
        await fixture.emit('reading', 'error', {
          code: 'reading_safety_unavailable', retryable: true,
          message: 'We could not finish checking your reading. Please try again in a moment.'
        });
        const alert = page.getByRole('alert').filter({ hasText: 'We could not finish checking your reading.' });
        await expect(alert.first()).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Your reading could not be completed' })).toBeVisible();
        await expect(page.getByText(QUESTION, { exact: true }).first()).toBeVisible();
        await expect(page.getByText('A Moment of Reflection', { exact: true })).toHaveCount(0);
        await expectNoHorizontalOverflow(page);
        const retry = page.getByRole('button', { name: /^Retry interpretation/ }).filter({ visible: true }).first();
        await expect(retry).toBeVisible();
        await retry.focus();
        await expect(retry).toBeFocused();
        await retry.press('Enter');
        await expect.poll(() => fixture.requests.reading.length).toBe(2);
        expect(fixture.requests.reading[1].userQuestion).toBe(QUESTION);
      } finally {
        await fixture.close();
      }
    });
  }
}
