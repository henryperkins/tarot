import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './helpers/frontendTest.js';
import { prepareNavigation, settleNavigation } from './helpers/navigationFixtures.js';
import { createNarrativeFixture, startReading, openChat } from './helpers/narrativeFixtures.js';

for (const width of [320, 1440]) for (const theme of ['dark', 'light']) {
  test(`increased contrast preserves chrome, active state and keyboard focus at ${width}px (${theme})`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ contrast: 'more', reducedMotion: 'reduce' });
    await prepareNavigation(page, { theme });
    for (const path of ['/', '/journal', '/account']) {
      await page.goto(path); await settleNavigation(page);
      expect(await page.evaluate(() => document.documentElement.classList.contains('light'))).toBe(theme === 'light');
      expect(await page.evaluate(() => matchMedia('(prefers-contrast: more)').matches)).toBe(true);
      const nav = page.getByRole('navigation', { name: 'Primary navigation', exact: true });
      const active = nav.locator('[aria-current="page"]');
      await expect(active).toHaveCount(path === '/account' ? 0 : 1);
      if (path !== '/account') {
        expect(await active.evaluate(element => getComputedStyle(element, '::after').height)).toBe('2px');
      }
      const reading = nav.getByRole('link', { name: 'Reading', exact: true });
      await reading.focus(); await expect(reading).toBeFocused();
      await expect(reading).toHaveCSS('outline-style', 'solid');
      await expect(reading).toBeInViewport({ ratio: 1 });
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .include('[data-app-header]').include('[data-app-bottom-region]').analyze();
      expect(violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(node => node.failureSummary) }))).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`${theme}-${path.slice(1) || 'reading'}.png`), animations: 'disabled' });
    }
  });
}

test('guest tutorial replay from Settings opens the welcome and returns to a visible control', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await prepareNavigation(page);
  await page.goto('/account'); await settleNavigation(page);
  const replay = page.locator('#actions').getByRole('button', { name: 'Replay Tutorial', exact: true });
  await expect(replay).toBeVisible();
  await replay.click();
  await page.getByRole('dialog', { name: 'Replay tutorial?' }).getByRole('button', { name: 'Replay tutorial', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Welcome to Tableu', exact: true, level: 2 })).toBeVisible();
  await page.getByRole('button', { name: 'Skip onboarding', exact: true }).click();
  await page.getByRole('dialog', { name: 'Skip onboarding?' }).getByRole('button', { name: 'Skip now', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => {
    const focused = document.activeElement;
    if (!focused || focused === document.body || focused.closest('[inert], [hidden]')) return false;
    const bounds = focused.getBoundingClientRect();
    return bounds.height > 0 && bounds.top >= 0 && bounds.bottom <= innerHeight;
  })).toBe(true);
  await expect(page.getByRole('navigation', { name: 'Primary navigation', exact: true })).toHaveCount(1);
});

test('desktop destination guards dirty profile edits once and preserves history after discard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await prepareNavigation(page, { pro: true });
  await page.goto('/pricing'); await settleNavigation(page);
  await page.getByRole('link', { name: 'Manage current plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Account & Settings', exact: true })).toBeVisible();
  await page.locator('#profile').getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill('Keep my edited name');
  const journal = page.locator('[data-destination-group="header"]').getByRole('link', { name: 'Journal', exact: true });
  await journal.click();
  const confirm = page.getByRole('dialog', { name: 'Discard your changes?', exact: true });
  await expect(confirm).toHaveCount(1);
  await confirm.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue('Keep my edited name');
  await journal.click();
  await confirm.getByRole('button', { name: 'Discard and leave', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your Tarot Journal', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Account & Settings', exact: true })).toBeVisible();
  await expect(page.getByLabel('Username', { exact: true })).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/pricing$/);
});

test('generation retry, saving, saved entry and follow-up retain one destination group', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await createNarrativeFixture(page);
  const expectDestinations = () => expect(page.getByRole('navigation', { name: 'Primary navigation', exact: true })).toHaveCount(1);
  try {
    await startReading(page, fixture, { complete: false });
    await fixture.emit('reading', 'error', { code: 'reading_safety_unavailable', retryable: true, message: 'Please retry this reading.' });
    await expect(page.getByRole('heading', { name: 'Your reading could not be completed', exact: true })).toBeVisible();
    await expectDestinations();
    await page.getByRole('button', { name: /^Retry interpretation/ }).filter({ visible: true }).first().press('Enter');
    await expect.poll(() => fixture.requests.reading.length).toBe(2);
    await fixture.emit('reading', 'done', { fullText: fixture.narrative, requestId: 'navigation-gate2-retry', provider: 'fixture' });
    await expect(page.getByRole('heading', { name: 'Your reading', exact: true })).toBeVisible();
    await expectDestinations();
    fixture.holdJournal();
    await page.getByRole('button', { name: 'Save to journal', exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByRole('button', { name: 'Saving…', exact: true }).filter({ visible: true })).toBeDisabled();
    await expectDestinations();
    fixture.releaseJournal();
    await expect(page.getByRole('button', { name: 'View saved entry', exact: true }).filter({ visible: true })).toBeVisible();
    const { dialog, opener } = await openChat(page);
    await dialog.getByRole('textbox').fill('What can I do next?');
    await dialog.getByRole('button', { name: 'Send question', exact: true }).click();
    await fixture.emit('followup', 'done', { fullText: 'Choose one small step you can keep today.' });
    await expect(dialog.getByRole('log')).toContainText('Choose one small step you can keep today.');
    await dialog.getByRole('button', { name: 'Close follow-up chat', exact: true }).click();
    await expect(opener).toBeFocused();
    await expectDestinations();
    expect(fixture.requests.journal).toHaveLength(1);
    expect(fixture.requests.followup).toHaveLength(1);
    expect(fixture.requests.reading).toHaveLength(2);
  } finally { await fixture.close(); }
});
