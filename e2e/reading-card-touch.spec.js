import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, startReading, settleReadingLayout } from './helpers/narrativeFixtures.js';

test.setTimeout(60000);
test.use({ serviceWorkers: 'block' });

// This seed draws The Star, Temperance and Death through the real UI.
const DRAW_TIME = 1790500049291;

// A reading that describes The Star's picture in its own passage and returns
// to one of its details, without the card's name, in the next steps.
function describedReading(cardsInfo) {
  const position = (name) => cardsInfo.find((card) => card.card === name)?.position || name;
  return [
    '## Opening',
    '',
    'The Star, Temperance and Death lay out a path from release toward renewal.',
    '',
    `## ${position('The Star')}: The Star`,
    '',
    'The Star kneels by a pool and pours water from two pitchers.',
    '',
    `## ${position('Temperance')}: Temperance`,
    '',
    'Temperance asks for patience between one season and the next.',
    '',
    `## ${position('Death')}: Death`,
    '',
    'Death clears the ground for what comes after.',
    '',
    '## Next steps',
    '',
    "- Keep one ritual from before. That's one pitcher back into the pool."
  ].join('\n');
}

async function openDescribedReading(page) {
  await page.clock.setFixedTime(DRAW_TIME);
  const fixture = await createNarrativeFixture(page);
  await startReading(page, fixture, { complete: false });
  await expect.poll(() => fixture.requests.reading.length).toBe(1);
  const fullText = describedReading(fixture.requests.reading[0].cardsInfo);
  await fixture.emit('reading', 'done', { fullText, requestId: 'reading-card-touch', provider: 'fixture' });
  await expect(page.locator('.narrative-stream')).toContainText('back into the pool');
  await expect(page.getByText('Narrative ready.', { exact: true })).toBeAttached();
  return fixture;
}

test('offscreen details get their turn during streaming and never replay after completion', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.endsWith('-reduce'), 'Reduced motion deliberately has static associations.');
  await page.clock.setFixedTime(DRAW_TIME);
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture, { complete: false });
    await page.clock.setSystemTime(Date.now());
    const fullText = `## Opening\n\n${'Take time to consider the choices in front of you. '.repeat(65)}\n\n## The Star\n\nThe Star kneels by a pool.\n\nKeep going.`;
    await fixture.emit('reading', 'delta', { text: fullText });
    const pool = page.locator('p .reading-imagery[data-touch-id="pool"]').first();
    await expect(pool).toBeAttached();
    await expect(pool).not.toHaveAttribute('data-traced', 'true');
    await pool.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await settleReadingLayout(page);
    const scroll = await page.evaluate(() => scrollY);
    await expect(pool).toHaveAttribute('data-traced', 'true');
    await pool.evaluate(element => {
      window.originalDetail = element;
      window.traceStarts = 0;
      new MutationObserver(records => {
        window.traceStarts += records.filter(record => record.attributeName === 'data-tracing' && element.hasAttribute('data-tracing')).length;
      }).observe(element, { attributes: true });
    });
    await fixture.emit('reading', 'delta', { text: '\n\nA later sentence.' });
    await fixture.emit('reading', 'done', { fullText: fullText + '\n\nA later sentence.', requestId: 'stream-visible', provider: 'fixture' });
    await expect(page.getByText('Narrative ready.', { exact: true })).toBeAttached();
    expect(await pool.evaluate(element => element === window.originalDetail)).toBe(true);
    expect(Math.abs(await page.evaluate(() => scrollY) - scroll)).toBeLessThanOrEqual(2);
    await expect(page.getByRole('dialog').filter({ visible: true })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.traceStarts)).toBe(0);
  } finally { await fixture.close(); }
});

test('@mobile lays out every card above the reading, even one that never names them', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture);
    const spread = page.getByRole('region', { name: 'Your cards' });
    const cards = spread.getByRole('button', { name: /^View / });
    await expect(cards).toHaveCount(3);
    for (const card of await cards.all()) {
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute('aria-haspopup', 'dialog');
    }
  } finally {
    await fixture.close();
  }
});

test('@mobile labels each card by name and position at a readable size', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await openDescribedReading(page);
  try {
    const plate = page.locator('.card-touch-plate').first();
    await plate.scrollIntoViewIfNeeded();
    await expect(plate.locator('.card-caption__name')).toHaveText(/The Star|Temperance|Death/);
    const sizes = await page.locator('.card-caption__name, .card-caption__position').evaluateAll((elements) => elements
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => Number.parseFloat(getComputedStyle(element).fontSize)));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14);
  } finally {
    await fixture.close();
  }
});

test('every explicit detail opens full artwork and returns to the same passage', async ({ page }, testInfo) => {
  const fixture = await openDescribedReading(page);
  try {
    const pitcher = page.locator('li .reading-imagery[data-touch-id="pitchers"]');
    await pitcher.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect(page.locator('.card-echo[data-visible]')).toHaveCount(0);
    for (const close of ['Escape', 'Back to reading', 'backdrop']) {
      await pitcher.focus();
      await settleReadingLayout(page);
      const scroll = await page.evaluate(() => scrollY);
      await pitcher.press(close === 'Back to reading' ? ' ' : 'Enter');
      const dialog = page.getByRole('dialog').filter({ visible: true }).first();
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('The Star');
      await expect(dialog).toContainText('pitcher');
      const art = dialog.locator('[data-reading-full-artwork] img');
      await expect(art).toBeVisible();
      const geometry = await art.evaluate(element => ({ width: element.getBoundingClientRect().width, fit: getComputedStyle(element).objectFit }));
      expect(geometry.width).toBeGreaterThanOrEqual(200);
      expect(geometry.fit).toBe('contain');
      if (close === 'Escape') await page.keyboard.press('Escape');
      else if (close === 'backdrop') await page.locator('[data-card-modal-backdrop]').click({ position: { x: 3, y: 3 } });
      else await dialog.getByRole('button', { name: 'Back to reading' }).click();
      await expect(dialog).toBeHidden();
      await expect(pitcher).toBeFocused();
      expect(Math.abs(await page.evaluate(() => scrollY) - scroll)).toBeLessThanOrEqual(2);
    }
    const name = page.locator('p .reading-card-ref[role="button"]', { hasText: 'Temperance' }).first();
    await name.focus();
    await name.press('Enter');
    await expect(page.getByRole('dialog').filter({ visible: true }).first()).toContainText('Temperance');
    await page.keyboard.press('Escape');
    await expect(name).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath('reading-inspection.png'), fullPage: true });
  } finally { await fixture.close(); }
});

test('moving from a detail to a card name and plain text releases passive inspection', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.endsWith('-reduce'), 'Reduced motion has no automatic turns to resume.');
  const fixture = await openDescribedReading(page);
  try {
    await page.clock.setSystemTime(Date.now());
    const paragraph = page.locator('p').filter({ has: page.locator('.reading-imagery[data-touch-id="pool"]') }).first();
    const detail = paragraph.locator('.reading-imagery[data-touch-id="pool"]').first();
    await detail.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await settleReadingLayout(page);
    const detailRect = await detail.boundingBox();
    await page.mouse.move(detailRect.x + detailRect.width / 2, detailRect.y + detailRect.height / 2);
    await expect(detail).toHaveAttribute('data-tracing', 'true');
    const name = paragraph.locator('.reading-card-ref').first();
    const nameRect = await name.boundingBox();
    await page.mouse.move(nameRect.x + nameRect.width / 2, nameRect.y + nameRect.height / 2);
    const plainRect = await paragraph.boundingBox();
    await page.mouse.move(plainRect.x + plainRect.width - 2, plainRect.y + plainRect.height - 2);
    await expect(detail).not.toHaveAttribute('data-tracing', 'true');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally { await fixture.close(); }
});
