import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function openTable(page, spread = /Three-Card Story/) {
  await page.addInitScript(() => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    localStorage.setItem('tarot-nudge-state', JSON.stringify({
      readingCount: 2, hasSeenRitualNudge: true, hasSeenGestureCoach: true,
      hasSeenJournalNudge: true, journalSaveCount: 1
    }));
  });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ status: path === '/api/auth/me' ? 200 : 404, json: path === '/api/auth/me'
      ? { user: { id: 'table-fixture', username: 'Reader', subscription_tier: 'plus', subscription_status: 'active' } }
      : {} });
  });
  await page.goto('/');
  await page.getByRole('radio', { name: spread }).click();
  const question = page.locator('#question-input, #quick-intention').filter({ visible: true }).first();
  if (await question.count()) await question.fill('What deserves my attention today?');
  await page.getByRole('button', { name: /^Draw cards$|^Shuffle & draw|^Shuffle deck/ }).first().click();
  return page.getByRole('region', { name: /layout$/ }).first();
}

test('dealing stays face-down, reveals select meaning, and reset preserves the table and reflections', async ({ page }) => {
  const table = await openTable(page);
  await expect(table).toBeVisible();
  const originalTable = await table.elementHandle();
  await expect(table.getByRole('button', { name: /empty position/i })).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Deal spread', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Deal spread', exact: true }).click();
  await expect(table.getByRole('button', { name: /Click to reveal/ })).toHaveCount(3);
  await expect(table.getByRole('button', { name: /Click to view details/ })).toHaveCount(0);
  const reveal = page.getByRole('button', { name: 'Reveal next: Past', exact: true });
  await reveal.focus();
  await reveal.press('Enter');
  await expect(page.getByRole('button', { name: 'Reveal next: Present', exact: true })).toBeFocused();
  const detail = page.getByRole('region', { name: 'Selected card meaning' });
  await expect(detail.getByLabel('What resonates for you?')).toBeVisible();
  const firstName = await detail.getByRole('heading', { level: 3 }).textContent();
  await expect(detail.getByRole('heading', { level: 3 })).not.toBeEmpty();
  await detail.getByLabel('What resonates for you?').fill('A small step is enough.');
  await table.getByRole('button', { name: /Card in Future position/ }).click();
  await expect(detail.getByText('Future', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset reveals', exact: true }).click();
  await expect(table.getByRole('button', { name: /Click to reveal/ })).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Reveal next: Past', exact: true })).toBeFocused();
  expect(await originalTable.evaluate(node => node.isConnected)).toBe(true);
  await page.getByRole('button', { name: 'Reveal next: Past', exact: true }).click();
  await expect(detail.getByRole('heading', { level: 3 })).toHaveText(firstName);
  await expect(detail.getByLabel('What resonates for you?')).toHaveValue('A small step is enough.');
  await page.getByRole('button', { name: 'Reveal all cards', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create narrative', exact: true })).toBeVisible();
});

for (const width of [1440, 390]) {
  test(`at ${width}px full card isolates background actions and restores inline selection`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const table = await openTable(page);
    await page.getByRole('button', { name: 'Deal spread', exact: true }).click();
    await page.getByRole('button', { name: 'Reveal next: Past', exact: true }).click();
    const detail = page.getByRole('region', { name: 'Selected card meaning' });
    await expect(detail).toBeVisible();
    await expect(table).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await detail.getByRole('button', { name: 'Open full card' }).click();
    await page.keyboard.press('Shift+G');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Reveal next:/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Reveal all cards|Reset reveals/ })).toHaveCount(0);
    await page.keyboard.press('Shift+G');
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(page.locator('#guided-intention-coach')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: /^Reveal next:/ })).toHaveCount(1);
    await expect(detail.getByRole('button', { name: 'Open full card' })).toBeFocused();
    await detail.getByRole('button', { name: 'Open full card' }).click();
    await page.getByRole('dialog').locator(':scope > [aria-hidden="true"]').click({ position: { x: 4, y: 4 } });
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(detail.getByRole('button', { name: 'Open full card' })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });

  test(`at ${width}px a double click cannot skip from deal to reveal or reveal to narrative`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const table = await openTable(page, /One-Card Insight/);
    await page.getByRole('button', { name: 'Deal spread', exact: true }).dblclick({ delay: 70 });
    await expect(table.getByRole('button', { name: /Click to reveal/ })).toHaveCount(1);
    await expect(table.getByRole('button', { name: /Click to view details/ })).toHaveCount(0);
    await page.getByRole('button', { name: /^Reveal next:/ }).dblclick({ delay: 70 });
    await expect(page.getByRole('button', { name: 'Create narrative', exact: true })).toBeVisible();
    await expect(table.getByRole('button', { name: /Click to view details/ })).toHaveCount(1);
  });

  test(`at ${width}px holding Enter cannot skip deal, reveal, or narrative steps`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const table = await openTable(page, /One-Card Insight/);
    await page.getByRole('button', { name: 'Deal spread', exact: true }).focus();
    await page.keyboard.down('Enter');
    await expect(page.getByRole('button', { name: /^Reveal next:/ })).toBeFocused();
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await expect(table.getByRole('button', { name: /Click to reveal/ })).toHaveCount(1);
    await page.keyboard.down('Enter');
    await expect(page.getByRole('button', { name: 'Create narrative', exact: true })).toBeFocused();
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await expect(page.getByRole('button', { name: 'Create narrative', exact: true })).toBeVisible();
  });
}

for (const [spread, count] of [[/One-Card Insight/, 1], [/Five-Card Clarity/, 5], [/Decision.*Path/, 5], [/Relationship Snapshot/, 3], [/Celtic Cross/, 10]]) {
  test(`the ${spread.source} spread deals all ${count} positions without revealing them`, async ({ page }) => {
    const table = await openTable(page, spread);
    await page.getByRole('button', { name: 'Deal spread', exact: true }).click();
    await expect(table.getByRole('button', { name: /Click to reveal/ })).toHaveCount(count);
    await expect(table.getByRole('button', { name: /Click to view details/ })).toHaveCount(0);
    await page.getByRole('button', { name: /^Reveal next:/ }).click();
    await expect(page.getByRole('region', { name: 'Selected card meaning' }).getByRole('heading', { level: 3 })).not.toBeEmpty();
  });
}

test('touch reading adapts from portrait to landscape and keeps reflections through reset @mobile', async ({ page }) => {
  const table = await openTable(page);
  await page.getByRole('button', { name: 'Deal spread', exact: true }).tap();
  await page.getByRole('button', { name: /^Reveal next:/ }).tap();
  const detail = page.getByRole('region', { name: 'Selected card meaning' });
  const reflection = detail.getByLabel('What resonates for you?');
  await reflection.fill('A meaningful reflection. '.repeat(25));
  await expect(reflection).toHaveValue(/.{500}/);
  await expect(detail.getByText('500 / 500')).toBeVisible();
  expect((await detail.boundingBox()).y).toBeGreaterThan((await table.boundingBox()).y);

  await detail.getByRole('button', { name: 'Open full card' }).tap();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: /Reveal next:|Reveal all cards|Reset reveals/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Reset reveals', exact: true }).tap();
  await page.getByRole('button', { name: /^Reveal next:/ }).tap();
  await expect(detail.getByText('500 / 500')).toBeVisible();

  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => {
    const spreadBounds = await table.boundingBox();
    return (await detail.boundingBox()).x > spreadBounds.x + spreadBounds.width;
  }).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expect(page.getByRole('button', { name: /^Reveal next:/ })).toHaveCount(1);
});

test('dealing travels from the deck, stays face-down, and yields immediately to reveal or reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const table = await openTable(page, /Celtic Cross/);
  await page.evaluate(() => {
    window.tableDeals = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      const animation = animate.call(this, frames, options);
      if (this.matches('.reading-table [data-layout-card]')) {
        window.tableDeals.push({ frames, options, animation });
      }
      return animation;
    };
  });
  await page.getByRole('button', { name: 'Deal spread', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.tableDeals.filter(deal => deal.frames[0]?.translate).length)).toBe(10);
  const deals = await page.evaluate(() => window.tableDeals.filter(deal => deal.frames[0]?.translate).map(({ frames, options }) => ({ frames, options })));
  expect(deals.every(({ frames }) => frames[0].translate !== '0px 0px')).toBe(true);
  expect(Math.max(...deals.map(({ options }) => options.duration + options.delay))).toBeLessThanOrEqual(600);
  await expect(table.getByRole('button', { name: /Click to reveal/ })).toHaveCount(10);
  await page.getByRole('button', { name: /^Reveal next:/ }).click();
  await expect(page.getByRole('region', { name: 'Selected card meaning' }).getByLabel('What resonates for you?')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => window.tableDeals.every(({ animation }) => ['idle', 'finished'].includes(animation.playState)))).toBe(true);
  await expect.poll(() => table.locator('[aria-pressed="true"] img').first().evaluate(image =>
    new DOMMatrixReadOnly(getComputedStyle(image.parentElement.parentElement).transform).m11)).toBeCloseTo(1);
  await page.getByRole('button', { name: 'Reset reveals', exact: true }).click();
  await expect(table.getByRole('button', { name: /Click to reveal/ })).toHaveCount(10);
  await expect.poll(() => page.evaluate(() => window.tableDeals.filter(deal => deal.frames[0]?.translate).length)).toBe(10);
});

test('reduced motion keeps the deal stationary and reflection input survives meaning changes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const table = await openTable(page);
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await page.getByRole('button', { name: 'Deal spread', exact: true }).click();
  const movingCards = await table.locator('[data-layout-card]').evaluateAll(cards => cards.flatMap(card => card.getAnimations()).filter(animation =>
    animation.effect.getKeyframes().some(frame => frame.translate?.split(' ').some(value => Math.abs(parseFloat(value)) > 0.01)))
    .map(animation => ({ id: animation.id, frames: animation.effect.getKeyframes() })));
  expect(movingCards).toEqual([]);
  await page.getByRole('button', { name: /^Reveal next:/ }).click();
  const detail = page.getByRole('region', { name: 'Selected card meaning' });
  const input = detail.getByLabel('What resonates for you?');
  await input.fill('Keep this thought.');
  const originalInput = await input.elementHandle();
  await page.getByRole('button', { name: /^Reveal next:/ }).click();
  expect(await originalInput.evaluate(node => node.isConnected)).toBe(true);
  await detail.getByRole('button', { name: 'Previous revealed card' }).click();
  await expect(input).toHaveValue('Keep this thought.');
  await input.focus();
  await input.press('End');
  await input.press('!');
  await expect(input).toHaveValue('Keep this thought.!');
  await expect(input).toBeFocused();
});
