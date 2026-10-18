import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, startReading, openSetup, openReadingSupport } from './helpers/narrativeFixtures.js';

test.setTimeout(60000);
test.use({ serviceWorkers: 'block' });
const snapshot = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('tarot:reading-snapshot') || 'null'));

for (const deck of ['thoth-a1', 'marseille-classic']) {
  test(`${deck} artwork and journal identity survive a different stored preference and resume`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.addInitScript(deck => {
      if (!sessionStorage.getItem('deck-identity-test-started')) {
        localStorage.setItem('tarot-deck-style', deck);
        sessionStorage.setItem('deck-identity-test-started', 'true');
      }
    }, deck);
    const fixture = await createNarrativeFixture(page);
    const images = page.locator(`img[src*="/${deck === 'thoth-a1' ? 'thoth' : 'marseille'}/"]`);
    try {
      await startReading(page, fixture);
      expect(fixture.requests.reading[0].deckStyle).toBe(deck);
      await expect(images.first()).toBeVisible();
      const artwork = await images.evaluateAll(nodes => nodes.map(node => ({ src: node.getAttribute('src'), alt: node.alt })));
      await expect.poll(async () => (await snapshot(page))?.narrative?.raw).toBeTruthy();
      await page.evaluate(() => localStorage.setItem('tarot-deck-style', 'rws-1909'));
      await page.reload();
      await expect(images.first()).toBeVisible();
      expect(await images.evaluateAll(nodes => nodes.map(node => ({ src: node.getAttribute('src'), alt: node.alt })))).toEqual(artwork);
      await page.getByRole('button', { name: 'Save to journal', exact: true }).filter({ visible: true }).click();
      await expect.poll(() => fixture.requests.journal.length).toBe(1);
      expect(fixture.requests.journal[0].deckId).toBe(deck);
      await page.getByRole('button', { name: 'View saved entry', exact: true }).filter({ visible: true }).click();
      const entry = page.getByRole('article').first();
      const expand = entry.locator('button[title="Expand entry"]');
      if (await expand.count()) await expand.click();
      await entry.getByRole('button', { name: 'Ask a follow-up', exact: true }).click();
      await page.getByRole('button', { name: 'Close follow-up chat', exact: true }).click();
      await expect(images.first()).toBeVisible();
      await expect.poll(async () => (await snapshot(page))?.drawDeckStyleId).toBe(deck);
      await openReadingSupport(page);
      await page.getByRole('button', { name: 'Start a new reading and reset this spread', exact: true }).click();
      await page.getByRole('button', { name: 'Deal spread', exact: true }).filter({ visible: true }).click();
      await expect.poll(async () => (await snapshot(page))?.drawDeckStyleId).toBe('rws-1909');
    } finally { await fixture.close(); }
  });
}

async function openDetails(page) {
  await openReadingSupport(page);
  const panel = page.locator('.spread-patterns-panel');
  const toggle = panel.getByRole('button', { name: /^Spread Insights/ });
  if (await toggle.count() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  const details = panel.getByRole('button', { name: /^More spread details/ });
  if (await details.count() && await details.getAttribute('aria-expanded') === 'false') await details.click();
  return panel;
}

for (const [savedDeck, expectedDeck] of [
  ['legacy-unknown', 'thoth-a1'],
  [null, 'thoth-a1'],
  ['marseille-classic', 'marseille-classic']
]) {
  test(`journal resume resolves recognized deck metadata when deckId is ${savedDeck}`, async ({ page }) => {
    const fixture = await createNarrativeFixture(page);
    const savedEntry = {
      id: 'legacy-deck-entry', ts: Math.floor(Date.now() / 1000), spread: 'One-Card Insight', spreadKey: 'single',
      question: 'How can I prepare for a change?',
      cards: [{ name: 'The Fool', number: 0, position: 'Theme', orientation: 'Upright' }],
      personalReading: '## Opening\n\nA saved reflection from yesterday.\n\n## Reflection\n\nPrepare one small next step.',
      deckId: savedDeck, themes: { deckStyle: 'thoth-a1' }, provider: 'local-composer', followUps: [], context: 'general'
    };
    await page.route('**/api/journal**', route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === '/api/journal') return route.fulfill({ json: {
        entries: [savedEntry], pagination: { hasMore: false, total: 1 }
      } });
      if (pathname === '/api/journal/legacy-deck-entry') return route.fulfill({ json: { entry: savedEntry } });
      return route.fallback();
    });
    try {
      await openSetup(page);
      await page.goto('/journal');
      const entry = page.getByRole('article').first();
      const expand = entry.locator('button[title="Expand entry"]');
      await expect(entry).toBeVisible();
      if (await expand.count()) await expand.click();
      await entry.getByRole('button', { name: 'Ask a follow-up', exact: true }).click();
      await page.getByRole('button', { name: 'Close follow-up chat', exact: true }).click();
      await expect.poll(async () => (await snapshot(page))?.drawDeckStyleId).toBe(expectedDeck);
      await expect(page.locator(`img[src*="/${expectedDeck === 'thoth-a1' ? 'thoth' : 'marseille'}/"]`).first()).toBeVisible();
    } finally { await fixture.close(); }
  });
}

test('a restored Thoth draw keeps its reveal artwork and request edition under an RWS preference', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('deck-identity-test-started')) {
      localStorage.setItem('tarot-deck-style', 'thoth-a1');
      sessionStorage.setItem('deck-identity-test-started', 'true');
    }
  });
  const fixture = await createNarrativeFixture(page);
  try {
    await openSetup(page);
    await page.locator('#question-input').fill(fixture.question);
    await page.getByRole('button', { name: /^Draw cards$/ }).filter({ visible: true }).first().click();
    await page.getByRole('button', { name: /^Deal spread/ }).filter({ visible: true }).first().click();
    await page.getByRole('button', { name: /^Reveal all cards/ }).filter({ visible: true }).first().click();
    await expect(page.locator('.reading-table img[src*="/thoth/"]').first()).toBeVisible();
    await expect.poll(async () => (await snapshot(page))?.isSpreadDealt).toBe(true);
    await page.evaluate(() => localStorage.setItem('tarot-deck-style', 'rws-1909'));
    await page.reload();
    await expect(page.locator('.reading-table img[src*="/thoth/"]').first()).toBeVisible();
    await page.getByRole('button', { name: /^Interpret cards/ }).filter({ visible: true }).first().click();
    await fixture.completeReading();
    expect(fixture.requests.reading[0].deckStyle).toBe('thoth-a1');
    expect(fixture.requests.reading[0].spreadInfo.deckStyle).toBe('thoth-a1');
  } finally { await fixture.close(); }
});

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
