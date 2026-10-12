import { readFileSync } from 'node:fs';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, startReading, settleReadingLayout } from './helpers/narrativeFixtures.js';

test.setTimeout(60000);

const samples = JSON.parse(readFileSync(new URL('../data/evaluations/narrative-samples.json', import.meta.url), 'utf8')).samples;
for (const id of ['single-new-role', 'spiritual-thoth-ritual', 'wellbeing-marseille-reset']) {
  test(`preserved generated reading restores its exact prose and edition: ${id}`, async ({ page }, testInfo) => {
    const sample = samples.find(item => item.id === id);
    const fixture = await createNarrativeFixture(page);
    fixture.entries.push({
      id: 'reading-purpose-entry', ts: Math.floor(Date.now() / 1000), spread: sample.spreadName,
      spreadKey: sample.spreadKey, question: sample.userQuestion, personalReading: sample.reading,
      cards: sample.cardsInfo.map(card => ({ ...card, name: card.card })), deckId: sample.deckStyle,
      sessionSeed: `preserved-${sample.id}`, provider: 'claude-code', reflections: {}, followUps: []
    });
    try {
      await page.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
      await page.goto('/journal');
      await page.locator('button[title="Expand entry"]').first().click();
      await page.getByRole('button', { name: 'Ask a follow-up', exact: true }).click();
      await page.getByRole('button', { name: 'Close follow-up chat', exact: true }).click();
      const text = page.locator('.narrative-stream__markdown');
      await expect(page.getByRole('button', { name: 'Show full narrative immediately' })).toHaveCount(0);
      await expect(text).toBeVisible();
      await expect(page.locator('.spread-companion').filter({ visible: true }).getByRole('button', { name: /^View / })).toHaveCount(sample.cardsInfo.length);
      await expect(page.locator('[data-tracing="true"]')).toHaveCount(0);
      expect(fixture.requests.reading).toHaveLength(0);
      const words = node => node.type === 'text' || node.type === 'inlineCode' ? node.value : (node.children || []).map(words).join('');
      const expected = words(unified().use(remarkParse).parse(sample.reading)).replace(/\s+/g, '');
      const rendered = await text.evaluate(node => {
        const copy = node.cloneNode(true);
        copy.querySelectorAll('.card-touch-plate, .spread-companion, [aria-hidden="true"]').forEach(element => element.remove());
        return copy.textContent.replace(/\s+/g, '');
      });
      expect(rendered).toBe(expected);
      await page.screenshot({ path: testInfo.outputPath(`preserved-${id}.png`), fullPage: true });
      const card = page.locator('.spread-companion').filter({ visible: true }).getByRole('button', { name: /^View / }).first();
      await card.click();
      await expect(page.getByRole('dialog').locator('[data-reading-full-artwork] img')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(card).toBeFocused();
    } finally { await fixture.close(); }
  });
}

test('stream deltas preserve selection and a replaced inspection opener', async ({ page }) => {
  await page.clock.setFixedTime(1790500049291);
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture, { complete: false });
    await page.clock.setSystemTime(Date.now());
    const prose = `## The Star\n\nThe Star kneels by a pool and pours water from two pitchers.\n\n${'The next step can be small. '.repeat(25)}`;
    await fixture.emit('reading', 'delta', { text: prose });
    const detail = page.locator('p .reading-imagery[data-touch-id="pool"]').first();
    await detail.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await settleReadingLayout(page);
    await detail.evaluate(element => {
      const range = document.createRange(); range.selectNodeContents(element);
      getSelection().removeAllRanges(); getSelection().addRange(range);
    });
    await detail.click();
    await expect(page.getByRole('dialog').filter({ visible: true })).toHaveCount(0);
    const selected = await page.evaluate(() => getSelection().toString());
    await fixture.emit('reading', 'delta', { text: '\n\nKeep the space to choose.' });
    await expect.poll(() => page.evaluate(() => getSelection().toString())).toBe(selected);
    await page.evaluate(() => getSelection().removeAllRanges());
    await detail.focus();
    await settleReadingLayout(page);
    const originalScroll = await page.evaluate(() => scrollY);
    await detail.press('Enter');
    const dialog = page.getByRole('dialog').filter({ visible: true }).first();
    await expect(dialog).toBeVisible();
    await expect(page.locator('.narrative-stream [data-tracing="true"]')).toHaveCount(0);
    // Simulate a streamed Markdown fragment replacing the original opener.
    await detail.evaluate(element => element.replaceWith(element.cloneNode(true)));
    await fixture.emit('reading', 'delta', { text: '\n\nOne more thought arrives.' });
    await page.keyboard.press('Escape');
    await expect(detail).toBeFocused();
    expect(Math.abs(await page.evaluate(() => scrollY) - originalScroll)).toBeLessThanOrEqual(2);
    await fixture.emit('reading', 'done', { fullText: `${prose}\n\nKeep the space to choose.\n\nOne more thought arrives.`, provider: 'fixture' });
    await expect(page.locator('.narrative-stream')).toContainText('One more thought arrives.');
  } finally { await fixture.close(); }
});
