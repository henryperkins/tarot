import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createNarrativeFixture, startReading, expectNoHorizontalOverflow } from './helpers/narrativeFixtures.js';

test('generation keeps the question and draw visible and receives keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture, { complete: false });
    await expect(page.getByRole('heading', { name: 'Preparing your reading', exact: true })).toBeFocused();
    const preparation = page.locator('.reading-screen--preparing');
    await expect(preparation.getByText(fixture.question, { exact: true })).toBeVisible();
    await expect(preparation.locator('.reading-preparation__draw img')).toHaveCount(3);
    const card = preparation.locator('.reading-preparation__draw').getByRole('button', { name: /Open card/ }).first();
    await card.press('Enter');
    await expect(page.getByRole('dialog').filter({ visible: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(card).toBeFocused();
    await expect(preparation.getByRole('status')).toBeVisible();
    await fixture.completeReading();
    await expect(page.getByRole('heading', { name: 'Your reading', exact: true })).toBeFocused();
  } finally {
    await fixture.close();
  }
});

for (const width of [320, 390]) {
  test(`Celtic Cross keeps status and cancellation usable while exploring at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const fixture = await createNarrativeFixture(page);
    try {
      await startReading(page, fixture, { complete: false, spreadName: 'Celtic Cross' });
      const preparation = page.locator('.reading-screen--preparing');
      const cancel = preparation.getByRole('button', { name: 'Cancel generation', exact: true });
      await expect(cancel).toBeInViewport();
      await expect(preparation.locator('.reading-preparation__draw img')).toHaveCount(10);
      await page.evaluate(() => document.fonts.ready);
      const overflowingCaptions = await preparation.locator('.reading-preparation__draw figcaption').evaluateAll(captions =>
        captions.filter(caption => caption.scrollWidth > caption.clientWidth + 1).map(caption => caption.textContent));
      expect(overflowingCaptions, 'Card names and positions must fit their own compact card').toEqual([]);
      const cardIdentities = () => preparation.locator('.reading-preparation__draw .reading-card').evaluateAll(cards => cards.map(card => ({
        index: card.dataset.spreadIndex, name: card.querySelector('img').alt,
        orientation: card.querySelector('.reading-card__orientation').textContent
      })));
      const originalCards = await cardIdentities();
      const fullSpread = preparation.locator('details.reading-preparation__spread');
      const disclosure = fullSpread.locator(':scope > summary');
      await disclosure.focus();
      await disclosure.press('Enter');
      await expect(disclosure).toBeFocused();
      await expect(fullSpread.locator('[data-reading-overview] img')).toHaveCount(10);
      await fullSpread.getByRole('button', { name: 'Card list', exact: true }).click();
      const cardButtons = fullSpread.getByRole('button', { name: /Open card/ });
      await cardButtons.first().focus();
      for (let index = 0; index < 9; index += 1) await page.keyboard.press('Tab');
      await expect(cardButtons.last()).toBeFocused();
      for (let index = 8; index >= 0; index -= 1) {
        await page.keyboard.press('Shift+Tab');
        await expect(cardButtons.nth(index)).toBeFocused();
        await expect.poll(() => cardButtons.nth(index).evaluate(element => {
          const box = element.getBoundingClientRect();
          return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
        }), 'Focused cards must remain exposed below the waiting controls').toBe(true);
      }
      await fullSpread.locator('.reading-card').last().scrollIntoViewIfNeeded();
      await expect(preparation.getByRole('status')).toBeInViewport();
      await expect(cancel).toBeInViewport();
      const cancelRequest = page.waitForRequest(request => request.url().endsWith('/cancel') && request.method() === 'POST');
      await cancel.click();
      await cancelRequest;
      await expect(page.getByRole('button', { name: 'Interpret cards', exact: true }).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByText(fixture.question, { exact: true })).toBeVisible();
      expect(fixture.requests.reading).toHaveLength(1);
      await page.getByRole('button', { name: 'Interpret cards', exact: true }).filter({ visible: true }).first().press('Enter');
      await expect(preparation.locator('.reading-preparation__draw img')).toHaveCount(10);
      expect(await cardIdentities()).toEqual(originalCards);
      await cancel.click();
    } finally {
      await fixture.close();
    }
  });
}

test('extended preparation stays reassuring without stealing focus', async ({ page }) => {
  await page.clock.install();
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture, { complete: false });
    const preparation = page.locator('.reading-screen--preparing');
    const cancel = preparation.getByRole('button', { name: 'Cancel generation', exact: true });
    await cancel.focus();
    await page.clock.fastForward(12001);
    await expect(preparation.getByRole('status')).toContainText('Your reading is still being prepared.');
    await expect(preparation).not.toContainText('longer than usual');
    await expect(preparation).toContainText('Your cards and question stay here if you cancel.');
    await expect(cancel).toBeFocused();
    await fixture.completeReading();
    await expect(page.getByRole('heading', { name: 'Your reading', exact: true })).toBeFocused();
  } finally {
    await fixture.close();
  }
});

test('single-card preparation handles long questions, enlarged text and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.addInitScript(() => localStorage.setItem('tarot-theme', 'light'));
  const fixture = await createNarrativeFixture(page, { question: 'How can I find balance? 🌿 ما الذي يدعمني؟ 自分を大切にする ' + 'LongReflection'.repeat(15) });
  try {
    await startReading(page, fixture, { complete: false, spreadName: 'One-Card' });
    const preparation = page.locator('.reading-screen--preparing');
    await expect(preparation.getByRole('status')).toContainText('Your card is drawn.');
    await expect(preparation.locator('.reading-preparation__draw img')).toHaveCount(1);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await expectNoHorizontalOverflow(page, '.reading-screen--preparing');
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await expect.poll(() => preparation.evaluate(element => element.getAnimations({ subtree: true })
      .filter(animation => animation.playState === 'running').map(animation => animation.animationName || 'transition'))).toEqual([]);
    const accessibility = await new AxeBuilder({ page }).include('.reading-screen--preparing').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(accessibility.violations).toEqual([]);
  } finally {
    await fixture.close();
  }
});
