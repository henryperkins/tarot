import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, startReading, openChat, openReadingSupport, QUESTION, NARRATIVE } from './helpers/narrativeFixtures.js';

test.setTimeout(60000);

for (const tier of ['guest', 'free', 'plus', 'pro']) {
  test(`${tier} saves original content, reopens it and offers truthful follow-up access`, async ({ page }) => {
    const fixture = await createNarrativeFixture(page, { signedOut: tier === 'guest', tier: tier === 'guest' ? 'free' : tier });
    const note = 'My original note, kept exactly.\nA second line.';
    try {
      await startReading(page, fixture, { reflection: note });
      if (tier === 'guest') {
        const { dialog } = await openChat(page);
        await expect(dialog).toContainText('Sign in to ask follow-up questions');
        await dialog.getByRole('button', { name: 'Close follow-up chat' }).click();
      }
      await page.getByRole('button', { name: 'Save to journal', exact: true }).click();
      await expect(page.getByRole('button', { name: 'View saved entry', exact: true })).toBeVisible();
      const cloud = ['plus', 'pro'].includes(tier);
      expect(fixture.requests.journal.length).toBe(cloud ? 1 : 0);
      if (cloud) {
        expect(fixture.entries[0].question).toBe(QUESTION);
        expect(fixture.entries[0].personalReading).toBe(NARRATIVE);
        expect(Object.values(fixture.entries[0].reflections)).toContain(note);
      }
      await page.getByRole('button', { name: 'View saved entry', exact: true }).click();
      await expect(page.locator('#history')).toContainText(QUESTION);
      await expect(page.locator('#history')).toContainText('What would enough look like today?');
      if (tier === 'guest') {
        await expect(page.getByRole('button', { name: 'Sign in to ask', exact: true })).toBeEnabled();
        await expect(page.locator('#history')).toContainText('My original note, kept exactly.');
        return;
      }
      await page.getByRole('button', { name: 'Ask a follow-up', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Follow-up chat' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('textbox').fill('How can I take this next step?');
      await dialog.getByRole('button', { name: 'Send question' }).click();
      await fixture.emit('followup', 'done', { fullText: 'Choose a small, specific action today.' });
      await expect(dialog.getByRole('log')).toContainText('Choose a small, specific action today.');
      expect(fixture.requests.followup).toHaveLength(1);
      await dialog.getByRole('button', { name: 'Close follow-up chat' }).click();
      await page.getByRole('navigation', { name: 'Primary navigation' })
        .getByRole('link', { name: 'Reading', exact: true }).filter({ visible: true }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator('.narrative-stream')).toContainText('What would enough look like today?');
      await expect(page.locator('[data-tracing="true"]')).toHaveCount(0);
      await page.getByText('Your notes', { exact: true }).click();
      expect(await page.locator('details.reading-options p').filter({ hasText: 'My original note' }).textContent()).toBe(note);
      await openReadingSupport(page);
      await expect(page.getByRole('button', { name: 'Open visual studio' })).toBeVisible();
      expect(fixture.requests.reading).toHaveLength(1);
    } finally { await fixture.close(); }
  });
}

for (const [spreadName, count, deck] of [
  ['One-Card Insight', 1, 'rws-1909'], ['Three-Card Story', 3, 'marseille-classic'],
  ['Five-Card Clarity', 5, 'thoth-a1'], ['Celtic Cross', 10, 'rws-1909']
]) {
  test(`${count}-card ${deck} spread retains labels and full artwork`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(deck => localStorage.setItem('tarot-deck-style', deck), deck);
    const fixture = await createNarrativeFixture(page);
    try {
      await startReading(page, fixture, { spreadName });
      if (count > 3) await page.locator('.reading-spread-disclosure > summary').click();
      const overview = page.locator('[data-reading-overview]');
      if (count === 10) await overview.getByRole('button', { name: 'Card list', exact: true }).click();
      const cards = overview.locator('.reading-card');
      await expect(cards).toHaveCount(count);
      for (const width of [320, 390, 428]) {
        await page.setViewportSize({ width, height: 844 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const image = cards.first().locator('img');
        await expect(image).toBeVisible();
        const rect = await image.boundingBox();
        expect(rect.width).toBeGreaterThanOrEqual(count === 10 ? 64 : 88);
        expect(rect.width).toBeLessThanOrEqual(160);
        expect(await image.evaluate(element => getComputedStyle(element).objectFit)).toBe('contain');
      }
      for (const card of await cards.all()) {
        await expect(card.locator('.reading-card__position')).not.toBeEmpty();
        await expect(card.locator('.reading-card__name')).not.toBeEmpty();
        await expect(card.locator('.reading-card__orientation')).toHaveText(/^(Upright|Reversed)$/);
      }
      const opener = cards.last().getByRole('button');
      await opener.scrollIntoViewIfNeeded();
      const preview = await opener.locator('img').boundingBox();
      await opener.click();
      const dialog = page.getByRole('dialog');
      const artwork = dialog.locator('img').first();
      await expect(artwork).toBeVisible();
      expect(await artwork.evaluate(img => getComputedStyle(img).objectFit)).toBe('contain');
      const enlarged = await artwork.boundingBox();
      expect(enlarged.width).toBeGreaterThan(preview.width);
      expect(enlarged.height).toBeGreaterThan(preview.height);
      expect(enlarged.height).toBeGreaterThanOrEqual(300);
      await dialog.getByRole('button', { name: 'Back to reading' }).click();
      await expect(opener).toBeFocused();
    } finally { await fixture.close(); }
  });
}

test('a late save cannot mark a new reading saved', async ({ page }) => {
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture);
    fixture.holdJournal();
    await page.getByRole('button', { name: 'Save to journal', exact: true }).click();
    await expect.poll(() => fixture.requests.journal.length).toBe(1);
    await page.getByRole('button', { name: 'Start a new reading and reset this spread' }).click();
    await page.getByRole('dialog', { name: 'Start a new reading?' }).getByRole('button', { name: 'Start new reading', exact: true }).click();
    fixture.releaseJournal();
    await expect(page.getByRole('button', { name: 'View saved entry', exact: true })).toHaveCount(0);
    await expect(page.getByText('Saved', { exact: true })).toHaveCount(0);
    expect(fixture.requests.reading).toHaveLength(1);
  } finally { await fixture.close(); }
});

test('saving errors do not block contextual follow-up', async ({ page }) => {
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture);
    fixture.setJournalStatus(503);
    await page.getByRole('button', { name: 'Save to journal', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Try saving again' })).toBeVisible();
    const { dialog } = await openChat(page);
    await dialog.getByRole('textbox').fill('What could I try today?');
    await dialog.getByRole('button', { name: 'Send question' }).click();
    await fixture.emit('followup', 'done', { fullText: 'Choose one manageable step.' });
    await expect(dialog.getByRole('log')).toContainText('Choose one manageable step.');
  } finally { await fixture.close(); }
});

for (const entryId of ['deduplicated-entry', null]) {
  test(`a deduplicated save preserves its returned navigation contract (${entryId || 'missing ID'})`, async ({ page }) => {
    const fixture = await createNarrativeFixture(page);
    const warnings = [];
    page.on('console', message => { if (message.type() === 'warning') warnings.push(message.text()); });
    let saves = 0;
    await page.route('**/api/journal', async route => {
      if (route.request().method() !== 'POST') return route.fallback();
      saves += 1;
      const entry = { ...route.request().postDataJSON(), id: entryId, ts: Math.floor(Date.now() / 1000) };
      fixture.entries.push(entry);
      return route.fulfill({ json: { entry, deduplicated: true } });
    });
    if (entryId) await page.route(`**/api/journal/${entryId}?*`, route => route.fulfill({ json: { entry: fixture.entries.find(entry => entry.id === entryId) } }));
    try {
      await startReading(page, fixture);
      await page.getByRole('button', { name: 'Save to journal', exact: true }).click();
      const view = page.getByRole('button', { name: entryId ? 'View saved entry' : 'View journal', exact: true });
      await expect(view).toBeVisible();
      expect(saves).toBe(1);
      if (entryId) {
        await view.click();
        await expect(page.locator('#history')).toContainText(QUESTION);
        await expect(page.locator('#history')).toContainText('What would enough look like today?');
      } else {
        await expect(page.getByRole('button', { name: 'View saved entry', exact: true })).toHaveCount(0);
        expect(warnings.some(warning => warning.includes('without an entry ID'))).toBe(true);
      }
    } finally { await fixture.close(); }
  });
}

test('short enlarged inspection retains readable controls while artwork is delayed or missing', async ({ page }) => {
  const fixture = await createNarrativeFixture(page);
  let release;
  const imageGate = new Promise(resolve => { release = resolve; });
  await page.route('**/images/cards/**', async route => {
    await imageGate;
    return route.fulfill({ status: 404, body: '' });
  });
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await startReading(page, fixture);
    const opener = page.locator('[data-reading-overview] .reading-card__art').first();
    await opener.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.setViewportSize({ width: 844, height: 390 });
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    const back = dialog.getByRole('button', { name: 'Back to reading' });
    await back.focus();
    await expect(back).toBeInViewport({ ratio: 1 });
    const dimensions = await dialog.evaluate(element => {
      const meaning = document.getElementById(element.getAttribute('aria-describedby'));
      return { meaning: parseFloat(getComputedStyle(meaning).fontSize), minLabel: Math.min(...[...element.querySelectorAll('.text-xs, .text-2xs, .text-sm')].map(label => parseFloat(getComputedStyle(label).fontSize))) };
    });
    expect(dimensions.meaning).toBeGreaterThanOrEqual(32);
    expect(dimensions.minLabel).toBeGreaterThanOrEqual(28);
    release();
    const image = dialog.locator('[data-reading-full-artwork] img');
    await expect(image).toHaveAttribute('src', '/images/card-back.png');
    await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
    await expect(dialog.getByRole('status')).toContainText('Artwork unavailable');
    await back.focus();
    await expect(back).toBeInViewport({ ratio: 1 });
    await back.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  } finally { release(); await fixture.close(); }
});
