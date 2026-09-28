import { test, expect } from '@playwright/test';
import { createNarrativeFixture, openSetup, QUESTION } from './helpers/narrativeFixtures.js';

for (const platform of ['Chromium', 'WebKit @mobile']) {
  test.describe(`Initial loading — ${platform}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });

    test('onboarding defers sound and hidden spread artwork until the reading setup is needed', async ({ page }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      const requests = [];
      page.on('request', request => requests.push(new URL(request.url()).pathname));
      try {
        await page.goto('/');
        await expect(page.getByRole('heading', { level: 2, name: 'Welcome to Tableu', exact: true })).toBeVisible();
        await page.waitForLoadState('networkidle');
        expect(requests.filter(path => path.startsWith('/sounds/'))).toEqual([]);
        expect(requests.filter(path => path.startsWith('/images/spread-art/'))).toEqual([]);

        await page.getByRole('button', { name: 'Skip onboarding', exact: true }).click();
        await page.getByRole('button', { name: 'Skip now', exact: true }).click();
        await expect(page.getByRole('radiogroup', { name: 'Spread selection' })).toBeVisible();
        await expect.poll(() => requests.some(path => path.startsWith('/images/spread-art/'))).toBe(true);
        await expect(page.getByRole('region', { name: 'Draw and explore your reading' })).toBeVisible();
      } finally {
        await fixture.close();
      }
    });

    test('ambience is fetched on activation and the setting can be switched off again', async ({ page }) => {
      const fixture = await createNarrativeFixture(page, { signedOut: true });
      const sounds = [];
      page.on('request', request => {
        const path = new URL(request.url()).pathname;
        if (path.startsWith('/sounds/')) sounds.push(path);
      });
      try {
        await page.goto('/account');
        const ambience = page.locator('#ambience-toggle');
        await expect(ambience).toHaveAttribute('aria-checked', 'false');
        await page.waitForLoadState('networkidle');
        expect(sounds).toEqual([]);
        await ambience.click();
        await expect(ambience).toHaveAttribute('aria-checked', 'true');
        await expect.poll(() => sounds.includes('/sounds/ambience.mp3')).toBe(true);
        expect(sounds).not.toContain('/sounds/flip.mp3');
        await ambience.click();
        await expect(ambience).toHaveAttribute('aria-checked', 'false');
      } finally {
        await fixture.close();
      }
    });

    test('the first reading can load effects and flip audio, then release effects for reduced motion', async ({ page }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const fixture = await createNarrativeFixture(page);
      const sounds = [];
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        const path = new URL(request.url()).pathname;
        if (path.startsWith('/sounds/')) sounds.push(path);
      });
      try {
        await openSetup(page);
        await page.locator('#question-input').fill(QUESTION);
        await page.getByRole('button', { name: /^Draw cards$/ }).click();
        await page.getByRole('button', { name: /^Deal spread/ }).click();
        await page.getByRole('button', { name: /^Reveal next:/ }).click();
        await expect.poll(() => sounds.includes('/sounds/flip.mp3')).toBe(true);
        expect(sounds).not.toContain('/sounds/ambience.mp3');
        await page.getByRole('button', { name: /^Reveal all cards/ }).click();
        await page.getByRole('button', { name: /^Create Personal Narrative$|^Create narrative/ }).press('Enter');
        await fixture.completeReading();
        await expect.poll(() => page.locator('#step-reading canvas').count()).toBeGreaterThan(0);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await expect(page.locator('#step-reading canvas')).toHaveCount(0);
        expect(errors).toEqual([]);
      } finally {
        await fixture.close();
      }
    });
  });
}
