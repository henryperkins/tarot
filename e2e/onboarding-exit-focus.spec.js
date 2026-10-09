import { test, expect } from './helpers/frontendTest.js';

test.describe('Onboarding exit focus', () => {
  for (const width of [390, 1280]) {
    for (const intent of ['resume', 'skip']) {
      test(`${intent} cancellation restores its exact opener at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto('/');
        const wizard = page.getByRole('dialog', { name: /Welcome to Tableu/ });
        await expect(wizard).toBeVisible();
        if (width === 1280) {
          const close = wizard.getByRole('button', { name: 'Skip onboarding', exact: true });
          await expect(close).toBeFocused();
          const buttons = wizard.getByRole('button').filter({ visible: true });
          await buttons.last().focus();
          await page.keyboard.press('Tab');
          await expect(buttons.first()).toBeFocused();
          await page.keyboard.press('Shift+Tab');
          await expect(buttons.last()).toBeFocused();
          await close.click();
          await expect(wizard).toBeHidden();
          return;
        }
        const opener = intent === 'resume'
          ? wizard.getByRole('button', { name: 'Save & resume later', exact: true })
          : wizard.getByRole('button', { name: 'Skip onboarding', exact: true });
        for (const cancel of ['button', 'escape']) {
          await opener.click();
          const nested = page.getByRole('dialog', { name: intent === 'resume' ? 'Save and resume later?' : 'Skip onboarding?' });
          await expect(nested).toBeVisible();
          await expect(nested.getByRole('button', { name: 'Stay here' })).toBeFocused();
          if (cancel === 'escape') await page.keyboard.press('Escape');
          else await nested.getByRole('button', { name: 'Stay here' }).click();
          await expect(nested).toBeHidden();
          await expect(opener).toBeFocused();
          await page.evaluate(() => new Promise(resolve => {
            let frames = 0;
            const tick = () => ++frames < 12 ? requestAnimationFrame(tick) : resolve();
            requestAnimationFrame(tick);
          }));
          await expect(opener).toBeFocused();
        }
        const buttons = wizard.getByRole('button').filter({ visible: true });
        await buttons.last().focus();
        await page.keyboard.press('Tab');
        await expect(buttons.first()).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(buttons.last()).toBeFocused();
        await opener.click();
        await page.getByRole('button', { name: intent === 'resume' ? 'Save & close' : 'Skip now', exact: true }).click();
        await expect(wizard).toBeHidden();
        await expect(page.getByRole('radiogroup', { name: 'Spread selection' })).toBeVisible();
        const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('tableau-onboarding-progress')));
        if (intent === 'resume') expect(progress).toMatchObject({ step: 1, selectedSpread: 'threeCard', question: '' });
        else expect(progress).toBeNull();
        if (intent === 'resume') {
          await page.reload();
          await expect(wizard).toBeVisible();
          expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tableau-onboarding-progress')))).toEqual(progress);
          return;
        }
        const replay = page.getByRole('button', { name: 'Replay tutorial', exact: true });
        await replay.focus();
        const scroll = await page.evaluate(() => window.scrollY);
        await replay.press('Enter');
        await page.getByRole('dialog', { name: 'Replay tutorial?', exact: true }).getByRole('button', { name: 'Replay tutorial', exact: true }).click();
        await expect(wizard).toBeVisible();
        await wizard.getByRole('button', { name: 'Skip onboarding', exact: true }).click();
        await page.getByRole('button', { name: 'Skip now', exact: true }).click();
        await expect(wizard).toBeHidden();
        await expect(replay).toBeFocused();
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scroll);
      });
    }
  }
});
