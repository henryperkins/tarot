import { test, expect } from '@playwright/test';
import { createNarrativeFixture } from './helpers/narrativeFixtures.js';

for (const platform of [
  { name: 'desktop', viewport: { width: 1280, height: 900 } },
  { name: 'phone @mobile', viewport: { width: 320, height: 800 } }
]) {
  test.describe(`Onboarding step focus — ${platform.name}`, () => {
    test.use({ viewport: platform.viewport, serviceWorkers: 'block' });

    for (const theme of ['dark', 'light']) {
      test(`step changes keep a useful focus target and preserve the question (${theme})`, async ({ page }) => {
        const fixture = await createNarrativeFixture(page, { signedOut: true });
        await page.addInitScript(value => localStorage.setItem('tarot-theme', value), theme);
        await page.emulateMedia({ reducedMotion: theme === 'dark' ? 'no-preference' : 'reduce' });
        try {
          await page.goto('/');
          const dialog = page.getByRole('dialog', { name: 'Welcome to Tableu', exact: true });
          await expect(dialog.getByRole('button', { name: 'Skip onboarding', exact: true })).toBeFocused();
          await dialog.getByRole('button', { name: 'Continue', exact: true }).press('Enter');
          const spreadHeading = dialog.getByRole('heading', { name: 'Choose Your Spread', exact: true });
          await expect(spreadHeading).toBeFocused();
          await expect(spreadHeading).toBeInViewport();
          await page.keyboard.press('Tab');
          await expect(dialog.getByRole('button', { name: /One Card/ })).toBeFocused();

          await dialog.getByRole('button', { name: 'Continue', exact: true }).press('Enter');
          const question = dialog.getByRole('textbox', { name: 'Your question or intention', exact: true });
          await expect(question).toBeFocused();
          const intention = 'كيف أجد وقتًا للراحة؟ 🌿 安心';
          await question.fill(intention);
          await dialog.getByRole('button', { name: 'Continue', exact: true }).press('Enter');
          const readyHeading = dialog.getByRole('heading', { name: "You're Ready", exact: true });
          await expect(readyHeading).toBeFocused();
          await expect(readyHeading).toBeInViewport();

          await dialog.getByRole('button', { name: /^(Go back|Back)$/ }).press('Enter');
          await expect(question).toBeFocused();
          await expect(question).toHaveValue(intention);
          await dialog.getByRole('button', { name: 'Go back', exact: true }).press('Enter');
          await expect(spreadHeading).toBeFocused();
          await dialog.getByRole('button', { name: /Welcome.*completed/ }).press('Enter');
          await expect(dialog.getByRole('heading', { name: 'Welcome to Tableu', level: 2 })).toBeFocused();

          if (platform.name.includes('phone')) {
            await dialog.getByRole('button', { name: 'Skip onboarding', exact: true }).press('Enter');
            await page.getByRole('button', { name: 'Stay here', exact: true }).press('Enter');
            await expect(dialog.getByRole('button', { name: 'Skip onboarding', exact: true })).toBeFocused();
          }
          expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        } finally {
          await fixture.close();
        }
      });
    }
  });
}
