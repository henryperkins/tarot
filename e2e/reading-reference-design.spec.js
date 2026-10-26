import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createNarrativeFixture, startReading, openSetup, expectNoHorizontalOverflow, observeNarrativeUiHealth } from './helpers/narrativeFixtures.js';

test('reading overview, contents and journal actions preserve the complete original prose', async ({ page }) => {
  const health = observeNarrativeUiHealth(page);
  const narrative = '## Opening\n\nA quiet beginning.\n\n## The Story\n\nThe cards invite a gentler pace.\n\n## Next steps\n\nLet your next step leave room for rest.';
  const fixture = await createNarrativeFixture(page, { narrative });
  try {
    await startReading(page, fixture);
    await expect(page.getByRole('heading', { name: 'Your reading', exact: true })).toBeVisible();
    await expect(page.locator('[data-reading-overview] img')).toHaveCount(3);
    await page.getByRole('button', { name: /^Contents/ }).click();
    await page.getByRole('navigation', { name: 'Reading contents' }).getByRole('link', { name: 'Next steps', exact: true }).click();
    await expect(page.locator('#reading-section-80')).toBeInViewport();
    await expect(page.getByText('A quiet beginning.', { exact: true })).toBeAttached();
    await expect(page.getByText('The cards invite a gentler pace.', { exact: true })).toBeAttached();
    await expect(page.getByRole('button', { name: 'Save to journal', exact: true }).filter({ visible: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Ask about this reading', exact: true }).filter({ visible: true })).toHaveCount(1);
    await expectNoHorizontalOverflow(page, '.reading-screen');
    health();
  } finally {
    await fixture.close();
  }
});

test('Save and Ask stay in the first screen on a 900px desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await createNarrativeFixture(page, { narrative: 'The Star asks for one quiet, repeatable step.' });
  try {
    await startReading(page, fixture);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.getByRole('button', { name: 'Save to journal', exact: true }).filter({ visible: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Ask about this reading', exact: true }).filter({ visible: true })).toBeInViewport();
  } finally {
    await fixture.close();
  }
});

for (const textScale of [100, 200]) {
  test(`desktop reading actions keep keyboard-focused prose clear at ${textScale}% text`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const narrative = Array.from({ length: 12 }, (_, index) => `## Reflection ${index + 1}\n\nNotice what helps you return to a steadier rhythm. Choose one small action you can keep. [Reflection guide ${index + 1}](https://example.invalid/guide-${index + 1})`).join('\n\n');
    const fixture = await createNarrativeFixture(page, { narrative });
    try {
      await startReading(page, fixture, { complete: false });
      await fixture.emit('reading', 'done', { fullText: narrative, provider: 'fixture', requestId: 'reading-actions-focus' });
      const actions = page.locator('.reading-completion-actions');
      await expect(actions).toBeVisible();
      if (textScale === 200) await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      const target = page.getByRole('link', { name: 'Reflection guide 7', exact: true });
      const previous = page.getByRole('link', { name: 'Reflection guide 6', exact: true });
      const actionBox = await actions.boundingBox();
      // Reproduce native Tab navigation to content that starts behind the row.
      await target.evaluate((element, y) => window.scrollBy(0, element.getBoundingClientRect().top - y), actionBox.y + 8);
      await previous.evaluate(element => element.focus({ preventScroll: true }));
      await page.keyboard.press('Tab');
      await expect(target).toBeFocused();
      await expect.poll(() => target.evaluate(element => {
        const box = element.getBoundingClientRect();
        return box.top >= 0 && box.bottom <= innerHeight
          && element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      })).toBe(true);
    } finally {
      await fixture.close();
    }
  });
}

test('setext reading headings render and their contents links reach the original source destinations', async ({ page }) => {
  const narrative = 'Opening\n=======\n\nA quiet beginning.\n\nClosing\n=======\n\nAn ending worth keeping.';
  const fixture = await createNarrativeFixture(page, { narrative });
  try {
    await startReading(page, fixture, { complete: false });
    await fixture.emit('reading', 'done', { fullText: narrative, provider: 'fixture', requestId: 'setext-navigation' });
    await expect(page.getByRole('heading', { name: 'Opening', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Contents/ }).click();
    await page.getByRole('navigation', { name: 'Reading contents' }).getByRole('link', { name: 'Closing', exact: true }).click();
    const closing = page.getByRole('heading', { name: 'Closing', exact: true });
    await expect(closing).toBeFocused();
    await expect(closing).toBeInViewport();
    await expect(page.getByText('A quiet beginning.', { exact: true })).toBeAttached();
    await expect(page.getByText('An ending worth keeping.', { exact: true })).toBeAttached();
  } finally {
    await fixture.close();
  }
});

test('Celtic Cross spread, card list and inspection retain ten original occurrences', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const fixture = await createNarrativeFixture(page);
  try {
    await openSetup(page);
    await page.getByRole('radio', { name: /Celtic Cross/ }).click();
    await startReading(page, fixture, { setup: false, complete: false });
    const fullSpread = page.locator('details.reading-preparation__spread > summary');
    await fullSpread.click();
    const overview = page.locator('[data-reading-overview]');
    await expect(overview.locator('img')).toHaveCount(10);
    const names = await overview.locator('img').evaluateAll(images => images.map(image => image.alt));
    const first = overview.getByRole('button', { name: /Open card/ }).first();
    // The crossing card covers the center of position 1. Its exposed position
    // marker is the touch target in the reference's traditional arrangement.
    await first.locator('.reading-card__number').click();
    const dialog = page.getByRole('dialog').filter({ visible: true });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(first).toBeFocused();
    await page.getByRole('button', { name: 'Card list', exact: true }).click();
    await expect(overview.locator('.reading-spread__cards--list')).toBeVisible();
    expect(await overview.locator('img').evaluateAll(images => images.map(image => image.alt))).toEqual(names);
    await expectNoHorizontalOverflow(page, '.reading-screen');
    await fullSpread.click();
    await fixture.emit('reading', 'done', { provider: 'fixture', requestId: 'reference-celtic', fullText:
      `## Opening\n\nA reflection on your question.\n\n## The Heart of It\n\n**${names[0]}** and **${names[1]}** invite you to consider what is happening now.\n\n## Closing\n\nTake one useful reflection with you.` });
    await expect(page.locator('.reading-chapter__cards img')).toHaveCount(2);
  } finally {
    await fixture.close();
  }
});

test('saving exposes the returned entry and asking opens the contextual conversation', async ({ page }) => {
  const fixture = await createNarrativeFixture(page);
  let saves = 0;
  let releaseSave;
  const saveGate = new Promise(resolve => { releaseSave = resolve; });
  await page.route('**/api/journal', async route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: { entries: [] } });
    saves += 1;
    await saveGate;
    return route.fulfill({ json: { entry: { id: 'reference-entry', ...route.request().postDataJSON() } } });
  });
  try {
    await startReading(page, fixture);
    const save = page.getByRole('button', { name: 'Save to journal', exact: true }).filter({ visible: true });
    await save.click();
    await expect(page.getByRole('button', { name: /^(?:Saving…|Save to journal)$/ }).filter({ visible: true })).toBeDisabled();
    releaseSave();
    await expect(page.getByRole('button', { name: 'View saved entry', exact: true }).filter({ visible: true })).toBeVisible();
    if (page.viewportSize().width < 769) {
      await page.getByRole('button', { name: 'Reading settings', exact: true }).click();
      const settings = page.getByRole('dialog', { name: 'Prepare your reading', exact: true });
      await expect(settings.getByRole('button', { name: 'View saved entry', exact: true })).toBeEnabled();
      await settings.getByRole('button', { name: 'Close reading preparation', exact: true }).click();
      await expect(settings).toBeHidden();
    }
    const ask = page.getByRole('button', { name: 'Ask about this reading', exact: true }).filter({ visible: true });
    await ask.click();
    await expect(page.getByRole('dialog', { name: 'Follow-up chat' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Your follow-up question', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(ask).toBeFocused();
    expect(saves).toBe(1);
    await page.getByRole('button', { name: 'View saved entry', exact: true }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/journal/);
  } finally {
    releaseSave();
    await fixture.close();
  }
});

test('larger text and light theme keep the last section above the dock and controls accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('tarot-theme', 'light'));
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await page.getByRole('button', { name: /^Contents/ }).click();
    await expect.poll(() => page.locator('.reading-wayfinding').evaluate(toolbar => ({
      position: getComputedStyle(toolbar).position,
      gap: toolbar.closest('.reading-screen__column').querySelector('[data-reading-section]').getBoundingClientRect().top - toolbar.getBoundingClientRect().bottom
    }))).toMatchObject({ position: 'static', gap: expect.any(Number) });
    const gap = await page.locator('.reading-wayfinding').evaluate(toolbar =>
      toolbar.closest('.reading-screen__column').querySelector('[data-reading-section]').getBoundingClientRect().top - toolbar.getBoundingClientRect().bottom);
    expect(gap).toBeGreaterThanOrEqual(0);
    await page.getByRole('navigation', { name: 'Reading contents' }).getByRole('link', { name: 'Reflection', exact: true }).click();
    const last = page.getByText('What would enough look like today? Use what resonates, and set aside what does not.', { exact: true });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await expectNoHorizontalOverflow(page, '.reading-screen');
    const accessibility = await new AxeBuilder({ page }).include('.reading-screen').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(accessibility.violations).toEqual([]);
  } finally {
    await fixture.close();
  }
});

test('preparation can show the drawn cards and cancel without replacing the spread', async ({ page }) => {
  const fixture = await createNarrativeFixture(page);
  try {
    await startReading(page, fixture, { complete: false });
    await expect(page.getByRole('heading', { name: 'Preparing your reading', exact: true })).toBeVisible();
    await page.locator('details.reading-preparation__spread > summary').click();
    await expect(page.locator('[data-reading-overview] img')).toHaveCount(3);
    const cancel = page.getByRole('button', { name: 'Cancel generation', exact: true });
    await expect(page.locator('.reading-preparation__status')).toBeVisible();
    await expect(cancel).toBeEnabled();
    const cancelRequest = page.waitForRequest(request => request.url().endsWith('/cancel') && request.method() === 'POST');
    await cancel.click();
    await cancelRequest;
    await expect(page.getByRole('button', { name: 'Interpret cards', exact: true }).filter({ visible: true }).first()).toBeVisible();
    expect(fixture.requests.reading).toHaveLength(1);
  } finally {
    await fixture.close();
  }
});

test.describe('reading with normal motion', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  test('illustrated card inspection restores focus and section navigation preserves native Tab order', async ({ page }) => {
    const fixture = await createNarrativeFixture(page);
    try {
      await startReading(page, fixture, { complete: false });
      const fullSpread = page.locator('details.reading-preparation__spread > summary');
      await fullSpread.click();
      const names = await page.locator('[data-reading-overview] img').evaluateAll(images => images.map(image => image.alt));
      await fullSpread.click();
      const fullText = '## Opening\n\nA quiet beginning.\n\n## The Story\n\n### The Past: ' + names[0]
        + ' Upright\n\nA place to begin.\n\n### The Present: ' + names[1]
        + ' Reversed\n\nA moment to notice.\n\n### The Future: ' + names[2]
        + ' Upright\n\nRoom to choose.\n\n## Next steps\n\nCarry one useful reflection with you.';
      await fixture.emit('reading', 'done', { fullText, provider: 'fixture', requestId: 'normal-motion-focus' });
      await expect(page.locator('.reading-prose .reading-card--compact img')).toHaveCount(3);
      await page.getByRole('navigation', { name: 'Reading sections' }).getByRole('link', { name: 'The Story', exact: true }).click();
      const opener = page.locator('.reading-prose .reading-card__art').first();
      const originalButton = await opener.elementHandle();
      await opener.click();
      await expect(page.getByRole('dialog').filter({ visible: true })).toBeVisible();
      expect(await originalButton.evaluate(node => node.isConnected)).toBe(true);
      await page.keyboard.press('Escape');
      await expect(opener).toBeFocused();
      await page.getByRole('navigation', { name: 'Reading sections' }).getByRole('link', { name: 'Next steps', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Next steps', exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      if (page.viewportSize().width >= 769) {
        await expect(page.getByRole('button', { name: 'Save to journal', exact: true }).filter({ visible: true })).toBeFocused();
      } else {
        await expect(page.locator('.reading-about > summary')).toBeFocused();
      }
    } finally {
      await fixture.close();
    }
  });
});
