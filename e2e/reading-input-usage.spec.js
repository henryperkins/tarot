import { test, expect } from './helpers/frontendTest.js';
import AxeBuilder from '@axe-core/playwright';
import { createNarrativeFixture, startReading, SOURCE_USAGE, expectNoHorizontalOverflow, expectForeground } from './helpers/narrativeFixtures.js';

test.setTimeout(60000);
test.use({ serviceWorkers: 'block' });
const panelName = 'Reading Inputs Used';

for (const width of [1440, 390, 320]) {
  for (const theme of ['light', 'dark']) {
    test(`inputs disclosure is compact and accessible at ${width}px ${theme}${width < 769 ? ' @mobile' : ''}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(value => localStorage.setItem('tarot-theme', value), theme);
      const fixture = await createNarrativeFixture(page);
      try {
        await startReading(page, fixture);
        const region = page.getByRole('region', { name: panelName });
        const trigger = region.getByRole('button', { name: panelName, exact: true });
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect((await region.boundingBox()).height).toBeLessThan(190);
        const feedback = page.getByRole('heading', { name: /How did this reading land/ });
        expect((await region.boundingBox()).y).toBeLessThan((await feedback.boundingBox()).y);
        await region.screenshot({ path: testInfo.outputPath(`inputs-${width}-${theme}-collapsed.png`) });
        await trigger.focus();
        await trigger.press('Enter');
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        await expect(region.getByText('Included: tone and reading depth.')).toBeVisible();
        await expect(region).not.toContainText(/requested not used|Skipped|telemetry|default profile/);
        await expectNoHorizontalOverflow(page);
        const id = await trigger.getAttribute('id');
        const accessibility = await new AxeBuilder({ page }).include(`section[aria-labelledby="${id}"]`).analyze();
        expect(accessibility.violations).toEqual([]);
        await region.screenshot({ path: testInfo.outputPath(`inputs-${width}-${theme}-expanded.png`) });
        if (width < 769) {
          const lastRow = region.getByRole('listitem').last();
          await lastRow.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
          await expectForeground(lastRow);
        }
        await trigger.press('Space');
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(region.getByRole('listitem')).toHaveCount(0);
      } finally {
        await fixture.close();
      }
    });
  }
}

for (const state of ['unknown', 'fallback', 'error']) {
  test(`inputs panel hides ${state} attribution`, async ({ page }) => {
    const fixture = await createNarrativeFixture(page, state === 'unknown'
      ? { sourceUsage: {} } : state === 'fallback' ? { provider: 'safe-fallback' } : {});
    try {
      await startReading(page, fixture, { complete: state !== 'error' });
      if (state === 'error') {
        await fixture.emit('reading', 'delta', { text: 'A reflection is starting.' });
        await expect(page.locator('.narrative-stream')).toContainText('A reflection is starting.');
        await expect(page.getByRole('region', { name: panelName })).toHaveCount(0);
        await fixture.emit('reading', 'error', { message: 'The reading provider failed. Please try again.' });
        await expect(page.getByText('The reading provider failed. Please try again.').first()).toBeVisible();
      }
      await expect(page.getByRole('region', { name: panelName })).toHaveCount(0);
    } finally {
      await fixture.close();
    }
  });
}

for (const hasSnapshot of [false, true]) {
  test(`journal resume ${hasSnapshot ? 'restores its own' : 'clears unknown'} inputs after a different reading`, async ({ page }) => {
    const fixture = await createNarrativeFixture(page);
    const saved = [];
    const olderEntry = {
      id: 'older-entry', ts: Date.now() - 86400000, spread: 'One-Card Insight', spreadKey: 'single',
      question: 'How can I prepare for a change?', cards: [{ name: 'The Sun', number: 19, position: 'Theme', orientation: 'Upright' }],
      personalReading: '## Opening\n\nA saved reflection from yesterday.\n\n## Reflection\n\nPrepare one small next step.',
      deckId: 'rws-1909', provider: 'local-composer', sessionSeed: 'older-seed', followUps: [], context: 'general',
      ...(hasSnapshot ? { sourceUsage: SOURCE_USAGE.alternate } : {})
    };
    await page.route('**/api/journal**', route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === '/api/journal' && route.request().method() === 'POST') {
        saved.push(route.request().postDataJSON());
        return route.fulfill({ json: { success: true, entry: { id: 'new-entry', ts: Date.now() } } });
      }
      if (pathname === '/api/journal') return route.fulfill({ json: { entries: [olderEntry], pagination: { hasMore: false, total: 1 } } });
      if (pathname === '/api/journal/older-entry') return route.fulfill({ json: { entry: olderEntry } });
      return route.fallback();
    });
    try {
      await startReading(page, fixture);
      await expect(page.getByRole('region', { name: panelName })).toBeVisible();
      await page.getByRole('button', { name: 'Save to Journal', exact: true }).click();
      await expect.poll(() => saved.length).toBe(1);
      expect(saved[0].sourceUsage.userContext.usedInputs).toContain('cardReflections');
      await page.getByRole('button', { name: 'View Journal', exact: true }).click();
      const entry = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'One-Card Insight', exact: true }) });
      await entry.locator('button[title="Expand entry"]').click();
      await expect(page.getByRole('button', { name: 'Ask a follow-up', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Ask a follow-up', exact: true }).click();
      await page.getByRole('button', { name: 'Close follow-up chat', exact: true }).click();
      await expect(page.locator('.narrative-stream')).toContainText('A saved reflection from yesterday.');
      const region = page.getByRole('region', { name: panelName });
      if (hasSnapshot) {
        await region.getByRole('button', { name: panelName }).click();
        await expect(region.getByText('Uploaded images', { exact: true })).toBeVisible();
        await expect(region).not.toContainText('Traditional wisdom');
      } else {
        await expect(region).toHaveCount(0);
      }
    } finally {
      await fixture.close();
    }
  });
}
