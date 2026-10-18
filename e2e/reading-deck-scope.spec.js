import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, startReading, openSetup, openReadingSupport } from './helpers/narrativeFixtures.js';

test.setTimeout(60000);
test.use({ serviceWorkers: 'block' });
const snapshot = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('tarot:reading-snapshot') || 'null'));

async function openDetails(page) {
  await openReadingSupport(page);
  const panel = page.locator('.spread-patterns-panel');
  const toggle = panel.getByRole('button', { name: /^Spread Insights/ });
  if (await toggle.count() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  const details = panel.getByRole('button', { name: /^More spread details/ });
  if (await details.count() && await details.getAttribute('aria-expanded') === 'false') await details.click();
  return panel;
}

test('Major-only scope survives preference changes, reload and journal resume; a new draw uses the new preference', async ({ page }) => {
  const fixture = await createNarrativeFixture(page);
  try {
    await openSetup(page);
    await page.goto('/account');
    const fullDeck = page.getByRole('switch', { name: 'Toggle Full Deck', exact: true });
    await expect(fullDeck).toHaveAttribute('aria-checked', 'true');
    await fullDeck.click();
    await page.getByRole('link', { name: 'Back to Reading', exact: true }).click();
    await startReading(page, fixture, { setup: false });
    let panel = await openDetails(page);
    await expect(panel).toContainText('Major Arcana focus');
    await expect.poll(async () => (await snapshot(page))?.drawIncludeMinors).toBe(false);

    await page.getByRole('button', { name: 'Reading settings', exact: true }).click();
    await expect(fullDeck).toHaveAttribute('aria-checked', 'false');
    await fullDeck.click();
    await page.getByRole('link', { name: 'Back to Reading', exact: true }).click();
    panel = await openDetails(page);
    await expect(panel).toContainText('Major Arcana focus');
    await page.reload();
    panel = await openDetails(page);
    await expect(panel).toContainText('Major Arcana focus');
    await page.getByRole('button', { name: 'Save to journal', exact: true }).filter({ visible: true }).click();
    await expect.poll(() => fixture.requests.journal.length).toBe(1);
    expect(fixture.requests.journal[0].themes.drawIncludeMinors).toBe(false);
    await page.getByRole('button', { name: 'View saved entry', exact: true }).filter({ visible: true }).click();
    const entry = page.getByRole('article').first();
    await expect(entry).toBeVisible();
    const expand = entry.locator('button[title="Expand entry"]');
    if (await expand.count()) await expand.click();
    await entry.getByRole('button', { name: 'Ask a follow-up', exact: true }).click();
    await page.getByRole('button', { name: 'Close follow-up chat', exact: true }).click();
    panel = await openDetails(page);
    await expect(panel).toContainText('Major Arcana focus');
    await page.getByRole('button', { name: 'Start a new reading and reset this spread', exact: true }).click();
    await page.getByRole('button', { name: 'Deal spread', exact: true }).filter({ visible: true }).click();
    await expect.poll(async () => (await snapshot(page))?.drawIncludeMinors).toBe(true);
  } finally { await fixture.close(); }
});

test('a full-deck draw of only Majors stays full; a legacy unknown scope is omitted', async ({ page }) => {
  await page.clock.setFixedTime(1790500049291);
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture);
    expect(fixture.requests.reading[0].cardsInfo.every(card => Number.isInteger(card.number))).toBe(true);
    const panel = await openDetails(page);
    await expect(panel).toContainText('Full deck (Major + Minor Arcana)');
    await expect.poll(async () => (await snapshot(page))?.drawIncludeMinors).toBe(true);
    await page.evaluate(() => {
      const saved = JSON.parse(sessionStorage.getItem('tarot:reading-snapshot'));
      delete saved.drawIncludeMinors;
      sessionStorage.setItem('tarot:reading-snapshot', JSON.stringify(saved));
    });
    // Navigate from a blank page so pagehide cannot overwrite the legacy fixture.
    const legacy = await snapshot(page);
    await page.goto('about:blank');
    await page.addInitScript(saved => sessionStorage.setItem('tarot:reading-snapshot', JSON.stringify(saved)), legacy);
    await page.goto('/');
    await openReadingSupport(page);
    await expect(page.locator('.spread-patterns-panel')).not.toContainText('Deck scope:');
  } finally { await fixture.close(); }
});
