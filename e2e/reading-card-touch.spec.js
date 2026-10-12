import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture, startReading } from './helpers/narrativeFixtures.js';

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

test('@mobile lays out every card above the reading, even one that never names them', async ({ page }) => {
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

test('@mobile a returning detail points at its card in place; only a tap brings the card forward', async ({ page }) => {
  const fixture = await openDescribedReading(page);
  try {
    const echo = page.locator('.card-echo[data-visible]');
    const pitcher = page.locator('li .reading-imagery[data-touch-id="pitchers"]');
    await expect(pitcher).toHaveAttribute('data-pip', 'true');
    await expect(pitcher).toHaveAttribute('aria-pressed', 'false');

    // Reading down to it brings nothing over the text.
    await pitcher.evaluate((element) => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await page.waitForTimeout(700);
    await expect(echo).toHaveCount(0);

    await pitcher.click();
    await expect(pitcher).toHaveAttribute('aria-pressed', 'true');
    await expect(echo).toBeVisible();
    const covers = await page.evaluate(() => {
      const card = document.querySelector('.card-echo').getBoundingClientRect();
      const words = document.querySelector('.reading-imagery[aria-pressed="true"]').getBoundingClientRect();
      return card.left < words.right && words.left < card.right && card.top < words.bottom && words.top < card.bottom;
    });
    expect(covers).toBe(false);

    await pitcher.click();
    await expect(pitcher).toHaveAttribute('aria-pressed', 'false');
    await expect(echo).toHaveCount(0);
  } finally {
    await fixture.close();
  }
});

test('described details and card names work from the keyboard', async ({ page }) => {
  const fixture = await openDescribedReading(page);
  try {
    const pool = page.locator('p .reading-imagery[data-touch-id="pool"]').first();
    await expect(pool).toHaveAttribute('role', 'button');
    await pool.evaluate((element) => {
      element.scrollIntoView({ block: 'center', behavior: 'instant' });
      element.focus({ preventScroll: true });
    });
    await page.keyboard.press('Enter');
    await expect(pool).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(pool).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press(' ');
    await expect(pool).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press(' ');
    await expect(pool).toHaveAttribute('aria-pressed', 'false');

    const name = page.locator('p .reading-card-ref[role="button"]', { hasText: 'Temperance' }).first();
    await name.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog').filter({ visible: true }).first();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(name).toBeFocused();
  } finally {
    await fixture.close();
  }
});
