import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, startReading, openReadingSupport, openReadingAbout } from './helpers/narrativeFixtures.js';

test.setTimeout(45000);

test('completion preserves the support subtree and exposes reset without opening extra tools', async ({ page }) => {
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture, { complete: false });
    await fixture.emit('reading', 'delta', { text: '## Opening\n\nA reflection is taking shape.' });
    await expect(page.locator('.narrative-stream')).toContainText('A reflection is taking shape.');
    const support = page.locator('details.reading-support');
    await expect(support).toBeAttached();
    await expect(support).toBeHidden();
    await expect(page.getByRole('heading', { name: /^Spread Insights/ })).toHaveCount(0);
    const supportNode = await support.elementHandle();
    const narrativeNode = await page.locator('.narrative-stream').elementHandle();

    await fixture.completeReading();
    expect(await supportNode.evaluate(node => node === document.querySelector('details.reading-support'))).toBe(true);
    expect(await narrativeNode.evaluate(node => node === document.querySelector('.narrative-stream'))).toBe(true);
    await expect(support).toBeVisible();
    expect(await support.evaluate(node => node.open)).toBe(false);
    await expect(page.getByRole('button', { name: 'Start a new reading and reset this spread' })).toBeVisible();
    await openReadingSupport(page);
    await expect(page.getByRole('heading', { name: /^Spread Insights/ })).toBeVisible();
  } finally {
    await fixture.close();
  }
});

test('the companion and support columns agree at both sides of the desktop breakpoint', async ({ page }) => {
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture);
    await expect(page.locator('.reading-screen--with-companion')).toBeVisible();
    for (const width of [1024, 1099, 1100, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const column = await page.locator('.reading-screen__column').boundingBox();
      const support = await page.locator('.reading-support').boundingBox();
      expect(column.width).toBeGreaterThanOrEqual(640);
      expect(Math.abs(column.x - support.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(column.width - support.width)).toBeLessThanOrEqual(1);
      if (width < 1100) {
        await expect(page.locator('.reading-screen__companion')).toBeHidden();
        await expect(page.locator('.reading-screen__mobile-companion')).toHaveCSS('display', 'block');
      } else {
        await expect(page.locator('.reading-screen__companion')).toHaveCSS('display', 'block');
        await expect(page.locator('.reading-screen__mobile-companion')).toBeHidden();
      }
    }
  } finally {
    await fixture.close();
  }
});

test('failed readings keep recovery outside hidden exploration tools', async ({ page }) => {
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture, { complete: false });
    await fixture.emit('reading', 'error', { message: 'The connection was interrupted.', code: 'fixture_failure' });
    await expect(page.getByRole('heading', { name: 'Your reading could not be completed' })).toBeVisible();
    await expect(page.getByText('Explore this reading', { exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Start a new reading and reset this spread' })).toBeVisible();
  } finally {
    await fixture.close();
  }
});

test('visual tools load on first open and remain manual across studio reopen', async ({ page }) => {
  const modules = [];
  const generationRequests = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (/\/(?:StoryIllustration|AnimatedReveal)[.-]/.test(path)) modules.push(path);
    if (request.method() === 'POST' && /\/api\/(?:generate-|story-art)/.test(path)) generationRequests.push(path);
  });
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture);
    await openReadingSupport(page);
    await expect(page.locator('.reading-support').getByText('Generate on demand', { exact: true })).toBeVisible();
    expect(modules).toEqual([]);
    const trigger = page.getByRole('button', { name: 'Open visual studio', exact: true });
    const dialog = page.getByRole('dialog', { name: 'Visual Companion Studio', exact: true });
    await trigger.click();
    await expect(dialog.getByRole('button', { name: /Generate illustration/i })).toBeVisible();
    const loaded = await dialog.elementHandle();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await trigger.click();
    expect(await loaded.evaluate(node => node.isConnected)).toBe(true);
    await expect(dialog).toBeVisible();
    expect(modules.some(path => /StoryIllustration/.test(path))).toBe(true);
    expect(generationRequests).toEqual([]);
    await page.keyboard.press('Escape');
  } finally {
    await fixture.close();
  }
});

test('hiding extra panels preserves open support and feedback drafts across a resize', async ({ page }) => {
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture);
    await openReadingSupport(page);
    const support = page.locator('.reading-support');
    const insights = await page.locator('.spread-patterns-panel').elementHandle();
    await page.getByRole('button', { name: /How did this reading land/ }).click();
    await page.getByRole('textbox', { name: 'Additional notes (optional)' }).fill('Keep this unsent feedback.');
    const inputs = page.getByRole('button', { name: 'Reading Inputs Used', exact: true });
    await inputs.click();
    await openReadingAbout(page);
    await page.getByRole('button', { name: 'Hide extra panels: off', exact: true }).click();
    await expect(support).toBeHidden();
    expect(await insights.evaluate(node => node.isConnected)).toBe(true);
    await expect(page.getByRole('button', { name: 'Start a new reading and reset this spread' })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Hide extra panels: on', exact: true }).click();
    expect(await support.evaluate(node => node.open)).toBe(true);
    await expect(page.getByRole('textbox', { name: 'Additional notes (optional)' })).toHaveValue('Keep this unsent feedback.');
    await expect(inputs).toHaveAttribute('aria-expanded', 'true');
    expect(await insights.evaluate(node => node === document.querySelector('.spread-patterns-panel'))).toBe(true);
  } finally {
    await fixture.close();
  }
});

test('one handset disclosure exposes spread highlights without another whole-panel toggle', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture);
    await openReadingSupport(page);
    await expect(page.getByRole('button', { name: /^Spread Insights/ })).toHaveCount(0);
    await expect(page.getByRole('list', { name: 'Spread highlights' })).toBeVisible();
  } finally {
    await fixture.close();
  }
});
