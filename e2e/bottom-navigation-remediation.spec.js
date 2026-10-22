import { test, expect } from './helpers/frontendTest.js';
import { prepareNavigation, settleNavigation, DEMO_READING } from './helpers/navigationFixtures.js';
import { createNarrativeFixture, startReading } from './helpers/narrativeFixtures.js';

test.describe('bottom navigation remediation', () => {
  test.use({ hasTouch: true, isMobile: true });

  for (const width of [320, 390]) for (const theme of ['dark', 'light']) {
    test(`Save and Ask stay usable mid-reading at ${width}px (${theme})`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
      await page.addInitScript(value => localStorage.setItem('tarot-theme', value), theme);
      const fixture = await createNarrativeFixture(page);
      try {
        await startReading(page, fixture);
        await page.locator('.narrative-stream').evaluate(element => element.scrollIntoView({ block: 'start' }));
        await page.evaluate(() => scrollBy(0, 250));
        const actions = page.locator('[data-app-bottom-actions]');
        const save = actions.getByRole('button', { name: 'Save to journal', exact: true });
        const ask = actions.getByRole('button', { name: 'Ask about this reading', exact: true });
        await expect(save).toBeInViewport({ ratio: 1 });
        await expect(ask).toBeInViewport({ ratio: 1 });
        await ask.click();
        const chat = page.getByRole('dialog', { name: 'Follow-up chat', exact: true });
        await expect(chat).toBeVisible();
        await page.getByRole('button', { name: 'Close follow-up chat', exact: true }).click();
        await save.click();
        await expect(actions.getByRole('button', { name: 'View saved entry', exact: true })).toBeInViewport({ ratio: 1 });
        await page.screenshot({ path: testInfo.outputPath('reading-actions.png'), animations: 'disabled' });
      } finally { await fixture.close(); }
    });
  }

  test('short reading view exposes a focused route to Save and Ask when the dock actions enter flow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const fixture = await createNarrativeFixture(page);
    try {
      await startReading(page, fixture);
      await page.setViewportSize({ width: 844, height: 390 });
      await expect(page.locator('[data-app-bottom-region]')).toHaveAttribute('data-actions-in-flow', 'true');
      const shortcut = page.getByRole('button', { name: 'Save or ask about this reading', exact: true });
      await shortcut.scrollIntoViewIfNeeded({ timeout: 5000 });
      await shortcut.click();
      const save = page.locator('[data-app-bottom-actions]').getByRole('button', { name: 'Save to journal', exact: true });
      await expect(save).toBeFocused();
      await expect(save).toBeInViewport({ ratio: 1 });
    } finally { await fixture.close(); }
  });

  test('setup keeps one labeled preparation action and coaching beside the intention', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await prepareNavigation(page);
    await page.goto('/'); await settleNavigation(page);
    const bottom = page.locator('[data-app-bottom-actions]');
    await expect(bottom.getByRole('button', { name: /coach/i })).toHaveCount(0);
    const prepare = bottom.getByRole('button', { name: 'Open reading preparation', exact: true });
    await expect(prepare).toContainText('Prepare');
    await expect(page.getByRole('region', { name: 'Reading setup', exact: true })
      .getByRole('button', { name: 'Open guided intention coach', exact: true })).toBeVisible();
    await prepare.click();
    await expect(page.getByRole('button', { name: 'Close reading preparation', exact: true })).toBeVisible();
  });

  test('enlarged reading actions keep their labels within the controls and remain reachable by keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const fixture = await createNarrativeFixture(page);
    try {
      await startReading(page, fixture);
      await page.setViewportSize({ width: 320, height: 568 });
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; document.documentElement.style.setProperty('--safe-pad-bottom', '34px'); });
      const shortcut = page.getByRole('button', { name: 'Save or ask about this reading', exact: true });
      await shortcut.scrollIntoViewIfNeeded(); await shortcut.click();
      const actions = page.locator('[data-app-bottom-actions] [data-reading-completion]');
      await expect.poll(() => actions.locator('button').evaluateAll(buttons => buttons.every(button => {
        const bounds = button.getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(button);
        return [...range.getClientRects()].every(rect => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1);
      }))).toBe(true);
      await page.keyboard.press('Tab');
      const ask = actions.getByRole('button', { name: 'Ask about this reading', exact: true });
      await expect(ask).toBeFocused();
      await expect(ask).toBeInViewport({ ratio: 1 });
    } finally { await fixture.close(); }
  });

  test('failed save reveals its error and retry action when the error makes the dock enter flow', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const fixture = await createNarrativeFixture(page);
    try {
      await startReading(page, fixture);
      await page.locator('.narrative-stream').evaluate(element => element.scrollIntoView({ block: 'start' }));
      await page.evaluate(() => scrollBy(0, 250));
      fixture.setJournalStatus(500);
      const actions = page.locator('[data-app-bottom-actions] [data-reading-completion]');
      const save = actions.getByRole('button', { name: 'Save to journal', exact: true });
      await save.click();
      await expect(actions.getByRole('alert')).toBeInViewport({ ratio: 1 });
      await expect(save).toBeFocused();
      await expect(save).toBeInViewport({ ratio: 1 });
      fixture.setJournalStatus(200);
      await save.click();
      await expect(actions.getByRole('button', { name: 'View saved entry', exact: true })).toBeVisible();
    } finally { await fixture.close(); }
  });

  test('rotating shared Notes hands its jump action to the visible wide-layout form', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await prepareNavigation(page, { pro: true });
    await page.goto('/share/navigation-demo'); await settleNavigation(page);
    await page.getByRole('tab', { name: 'Notes', exact: true }).click();
    const jump = page.getByRole('button', { name: 'Add note: open note form', exact: true });
    await expect(jump).toBeVisible();
    await jump.focus();
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(jump).toBeHidden();
    const formBody = page.locator('textarea').filter({ visible: true });
    await expect(formBody).toBeFocused();
    await expect(formBody).toBeInViewport({ ratio: 1 });
  });

  test('shared Notes reserves its jump action and removes it while the form is available', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await prepareNavigation(page, { pro: true, theme: 'light' });
    await page.route('**/api/share/navigation-demo', route => route.fulfill({ json: {
      token: 'navigation-demo', title: 'A shared reflection', entries: [DEMO_READING], notes: [], meta: { entryCount: 1 }, viewCount: 1
    } }));
    await page.goto('/share/navigation-demo'); await settleNavigation(page);
    await page.getByRole('tab', { name: 'Notes', exact: true }).click();
    const jump = page.getByRole('button', { name: 'Add note: open note form', exact: true });
    await expect(jump).toBeVisible();
    await expect.poll(() => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--app-bottom-height')))).toBeGreaterThan(44);
    await jump.click();
    const body = page.locator('#mobile-notes-panel textarea');
    await expect(body).toBeFocused();
    await expect(body).toBeInViewport({ ratio: 1 });
    await expect(jump).toBeHidden();
    await body.fill('Keep this reflection while moving through the page.');
    await page.locator('h1').click();
    await page.evaluate(() => scrollTo(0, 0));
    await expect(jump).toBeVisible();
    await jump.click();
    await expect(body).toHaveValue('Keep this reflection while moving through the page.');
    await expect(jump).toBeHidden();
    await expect.poll(() => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--app-bottom-height')))).toBe(0);
    await page.screenshot({ path: testInfo.outputPath('notes-form.png'), animations: 'disabled' });
  });

  test('unknown routes return to canonical Reading and do not create a back-navigation loop', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareNavigation(page);
    await page.goto('/journal'); await settleNavigation(page);
    await page.evaluate(() => {
      history.pushState(null, '', '/navigation-missing-route?old=1');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('navigation', { name: 'Primary navigation', exact: true })
      .getByRole('link', { name: 'Reading', exact: true })).toHaveAttribute('aria-current', 'page');
    await page.goBack();
    await expect(page).toHaveURL(/\/journal$/);
  });
});
