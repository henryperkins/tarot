import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, startReading, QUESTION } from './helpers/narrativeFixtures.js';

test.setTimeout(60000);

test('question, original context and listening precede the uninterrupted reading', async ({ page }) => {
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture);
    await expect(page.getByRole('heading', { name: 'Your reading', exact: true })).toBeVisible();
    const context = page.getByText('Your question and notes', { exact: true });
    await context.click();
    await expect(context.locator('..')).toContainText(QUESTION);
    const audio = page.getByRole('group', { name: 'Listen to your reading' });
    await expect(audio).toHaveCount(1);
    expect(await audio.evaluate(element => Boolean(element.compareDocumentPosition(document.querySelector('.narrative-stream')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    await page.getByText('Reading options', { exact: true }).click();
    const focus = page.getByRole('button', { name: 'Hide extra panels', exact: true });
    await focus.click();
    await expect(focus).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.narrative-stream')).toContainText('What would enough look like today?');
    expect(fixture.requests.reading).toHaveLength(1);
  } finally { await fixture.close(); }
});

test('phone text, long original notes and trailing actions remain readable above the dock', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const fixture = await createNarrativeFixture(page);
  const note = '  A note I want to keep exactly.\n' + 'My own words matter. '.repeat(20);
  try {
    await startReading(page, fixture, { reflection: note });
    await page.getByText('Your question and notes', { exact: true }).click();
    const noteText = page.locator('.reading-context p').filter({ hasText: 'A note I want' });
    expect(await noteText.textContent()).toBe(note);
    const sizes = await page.locator('.narrative-panel .text-muted, .card-caption__position').evaluateAll(elements => elements.filter(element => element.getClientRects().length && element.textContent.trim())
      .map(element => parseFloat(getComputedStyle(element).fontSize)));
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14);
    for (const [width, height, percent] of [[320, 740, 100], [428, 926, 100], [844, 390, 200]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(percent => { document.documentElement.style.fontSize = `${percent}%`; }, percent);
      const reset = page.getByRole('button', { name: 'Start a new reading and reset this spread' });
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      await expect.poll(() => reset.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const dock = document.querySelector('.mobile-action-bar');
        return rect.bottom <= (dock ? dock.getBoundingClientRect().top : innerHeight) && rect.left >= 0 && rect.right <= innerWidth;
      })).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  } finally { await fixture.close(); }
});

test('one save survives resize and notice expiry, then reopens the exact journal entry', async ({ page }) => {
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture);
    fixture.holdJournal();
    const save = page.getByRole('button', { name: /Save reading to journal|Save to journal/i }).filter({ visible: true }).first();
    await save.evaluate(element => { element.click(); element.click(); });
    await expect.poll(() => fixture.requests.journal.length).toBe(1);
    await expect(page.getByRole('button', { name: 'Saving…', exact: true }).filter({ visible: true })).toBeDisabled();
    await page.setViewportSize({ width: 1200, height: 900 });
    await expect(page.getByRole('button', { name: 'Saving…', exact: true }).filter({ visible: true })).toBeDisabled();
    fixture.releaseJournal();
    await expect(page.getByText('Saved', { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(page.getByText('Saved to your journal.', { exact: true }).filter({ visible: true })).toHaveCount(0, { timeout: 8000 });
    await page.getByRole('button', { name: 'View saved entry', exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/journal/);
    await expect(page.locator('#history')).toContainText(QUESTION);
    expect(fixture.requests.journal).toHaveLength(1);
    expect(fixture.entries[0].personalReading).toContain('What would enough look like today?');
  } finally { await fixture.close(); }
});

test('save errors remain retryable', async ({ page }) => {
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture);
    fixture.setJournalStatus(503);
    await page.getByRole('button', { name: /Save reading to journal|Save to journal/i }).filter({ visible: true }).first().click();
    await expect(page.getByRole('alert').filter({ hasText: /save/i }).filter({ visible: true })).toBeVisible();
    fixture.setJournalStatus(200);
    await page.getByRole('button', { name: 'Save to journal', exact: true }).filter({ visible: true }).click();
    await expect(page.getByRole('button', { name: 'View saved entry', exact: true }).filter({ visible: true })).toBeVisible();
  } finally { await fixture.close(); }
});

test('optional tools follow completion and installation is available in app options', async ({ page }) => {
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture);
    const explore = page.getByText('Explore this reading', { exact: true });
    await expect(explore).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create images or video', exact: true })).toBeHidden();
    await explore.click();
    await expect(page.getByRole('button', { name: 'Create images or video', exact: true })).toBeVisible();
    await expect(page.locator('main [data-pwa-footer]')).toHaveCount(0);
    await expect(page.getByText('App options', { exact: true })).toBeAttached();
    await page.getByRole('button', { name: 'Create images or video', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Visual Companion Studio' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Create images or video', exact: true })).toBeFocused();
    expect(fixture.requests.reading).toHaveLength(1);
  } finally { await fixture.close(); }
});
