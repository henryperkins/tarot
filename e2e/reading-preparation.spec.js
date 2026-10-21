import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createNarrativeFixture, startReading, expectNoHorizontalOverflow } from './helpers/narrativeFixtures.js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__readingFocusTrace = [];
    for (const type of ['focusin', 'focusout', 'visibilitychange']) {
      document.addEventListener(type, event => {
        const element = event.target;
        window.__readingFocusTrace.push({ type, time: performance.now(), tag: element.tagName,
          id: element.id, label: element.getAttribute?.('aria-label'), visibility: document.visibilityState });
        if (window.__readingFocusTrace.length > 60) window.__readingFocusTrace.shift();
      }, true);
    }
  });
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus || page.isClosed()) return;
  const focus = await page.evaluate(() => {
    const active = document.activeElement;
    return { active: { tag: active?.tagName, id: active?.id, label: active?.getAttribute('aria-label'),
      disabled: active?.matches(':disabled'), unavailableAncestor: Boolean(active?.closest('[hidden], [inert], [aria-hidden="true"]')) },
    visibility: document.visibilityState, documentHasFocus: document.hasFocus(), trace: window.__readingFocusTrace };
  });
  await testInfo.attach('reading-focus', { body: JSON.stringify(focus, null, 2), contentType: 'application/json' });
});

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

test('preparation receives focus after its reading region becomes available', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture, { complete: false, spreadName: 'Celtic Cross' });
    await page.getByRole('button', { name: 'Cancel generation', exact: true }).click();
    const readingRegion = page.locator('#step-reading');
    // A closing overlay can leave the new scene temporarily inert. The mobile
    // interpretation control is outside this region and remains operable.
    await readingRegion.evaluate(element => { element.inert = true; });
    await page.getByRole('button', { name: 'Interpret cards', exact: true }).press('Enter');
    const preparation = page.locator('.reading-screen--preparing');
    await preparation.waitFor({ state: 'attached' });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(preparation.locator('h2')).not.toBeFocused();
    await readingRegion.evaluate(element => { element.inert = false; });
    await expect(preparation.getByRole('heading', { name: 'Preparing your reading', exact: true })).toBeFocused();
    await preparation.getByRole('button', { name: 'Cancel generation', exact: true }).click();
  } finally {
    await fixture.close();
  }
});

test('late preparation focus preserves a control chosen elsewhere', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture, { complete: false });
    await page.getByRole('button', { name: 'Cancel generation', exact: true }).click();
    const readingRegion = page.locator('#step-reading');
    await readingRegion.evaluate(element => { element.inert = true; });
    await page.getByRole('button', { name: 'Interpret cards', exact: true }).press('Enter');
    await page.locator('.reading-screen--preparing').waitFor({ state: 'attached' });
    const readingStep = page.getByRole('button', { name: 'Step 4: Reading', exact: true });
    await readingStep.focus();
    await readingRegion.evaluate(element => { element.inert = false; });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(readingStep).toBeFocused();
    await expect.poll(() => fixture.connectionGeneration('reading')).toBeGreaterThanOrEqual(2);
    await fixture.emit('reading', 'done', { fullText: fixture.narrative, requestId: 'late-focus-reading', provider: 'fixture' });
    await expect(page.getByRole('heading', { name: 'Your reading', exact: true })).toBeVisible();
    await expect(readingStep).toBeFocused();
  } finally {
    await fixture.close();
  }
});

test('completion recovers focus from a control hidden from assistive technology', async ({ page }) => {
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture, { complete: false });
    const readingStep = page.getByRole('button', { name: 'Step 4: Reading', exact: true });
    await readingStep.focus();
    // aria-hidden alone does not blur an active control. Scene restoration
    // must distinguish that unavailable target from a reader's usable choice.
    await readingStep.evaluate(element => element.setAttribute('aria-hidden', 'true'));
    await fixture.completeReading();
    await expect(page.getByRole('heading', { name: 'Your reading', exact: true })).toBeFocused();
  } finally {
    await fixture.close();
  }
});

test('completion preserves an open card inspector and restores a usable target on close', async ({ page }) => {
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture, { complete: false });
    await page.locator('.reading-preparation__draw').getByRole('button', { name: /Open card/ }).first().press('Enter');
    const inspector = page.getByRole('dialog').filter({ visible: true });
    await expect(inspector).toBeVisible();
    await fixture.completeReading();
    await expect(inspector).toBeVisible();
    expect(await inspector.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(inspector).not.toBeVisible();
    await expect.poll(() => page.evaluate(() => {
      const active = document.activeElement;
      return active !== document.body && !active.closest('[hidden], [inert], [aria-hidden="true"]')
        && active.getClientRects().length > 0;
    })).toBe(true);
  } finally {
    await fixture.close();
  }
});

for (const reducedMotion of ['reduce', 'no-preference']) {
  for (const width of [320, 390, 1440]) {
    test(`cancellation restores table focus and preserves the draw on retry at ${width}px with ${reducedMotion} motion`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion });
      const fixture = await createNarrativeFixture(page);
      try {
        await startReading(page, fixture, { complete: false });
        const preparation = page.locator('.reading-screen--preparing');
        await expect(preparation.getByRole('heading', { name: 'Preparing your reading', exact: true })).toBeFocused();
        await expect.poll(() => fixture.connected('reading')).toBeGreaterThan(0);
        const firstConnection = fixture.connectionGeneration('reading');
        const originalCards = structuredClone(fixture.requests.reading[0].cardsInfo);
        const cancellation = page.waitForResponse(response => response.url().endsWith('/cancel') && response.request().method() === 'POST');
        await preparation.getByRole('button', { name: 'Cancel generation', exact: true }).click();
        expect((await cancellation).status()).toBe(200);

        const table = page.locator('.reading-table');
        const interpretation = page.getByRole('button', { name: 'Interpret cards', exact: true }).filter({ visible: true }).first();
        await expect(table.getByText(fixture.question, { exact: true })).toBeVisible();
        await expect(table.getByRole('status')).toHaveText('3 of 3 cards revealed');
        await expect(interpretation).toBeVisible();
        // The preparation heading is removed on cancel. The handset table
        // heading replaces it; desktop keeps its existing primary action.
        await expect(width < 768 ? page.locator('#reading-table-title') : table.locator('[data-reading-primary]')).toBeFocused();

        await interpretation.press('Enter');
        await expect(preparation.getByRole('heading', { name: 'Preparing your reading', exact: true })).toBeFocused();
        await expect(preparation.getByText(fixture.question, { exact: true })).toBeVisible();
        await expect(preparation.locator('.reading-preparation__draw img')).toHaveCount(3);
        expect(fixture.requests.reading).toHaveLength(2);
        expect(fixture.requests.reading[1].cardsInfo).toEqual(originalCards);
        expect(fixture.requests.reading[1].userQuestion).toBe(fixture.question);
        await expect.poll(() => fixture.connected('reading', firstConnection)).toBeGreaterThan(0);
        await fixture.emit('reading', 'done', { fullText: fixture.narrative, requestId: 'cancelled-reading-retry', provider: 'fixture' });
        await expect(page.getByRole('heading', { name: 'Your reading', exact: true })).toBeFocused();
        await expect(page.getByText('Narrative ready.', { exact: true })).toBeAttached();
      } finally {
        await fixture.close();
      }
    });
  }
}

for (const reducedMotion of ['reduce', 'no-preference']) {
  for (const width of [320, 390]) {
    test(`Celtic Cross keeps status and cancellation usable while exploring at ${width}px with ${reducedMotion} motion`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion });
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
        const restoredHeading = page.locator('#reading-table-title');
        await expect(restoredHeading).toBeFocused();
        await expect(restoredHeading).toBeInViewport();
        await expect.poll(() => restoredHeading.evaluate(element => {
          const box = element.getBoundingClientRect();
          return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
        }), 'Restored focus must be exposed after cancellation').toBe(true);
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
