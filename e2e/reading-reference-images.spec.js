import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { createNarrativeFixture, openSetup, startReading } from './helpers/narrativeFixtures.js';

test.use({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

test('collapsed Celtic overview defers images and the cold reading journey uses phone-sized sources', async ({ page }, testInfo) => {
  const fixture = await createNarrativeFixture(page, { narrative: '## Opening\n\nTake a quiet moment.\n\n## Closing\n\nKeep what helps and take one gentle step toward rest today.' });
  try {
    await page.addInitScript(() => performance.setResourceTimingBufferSize(3000));
    await openSetup(page);
    await page.getByRole('radio', { name: /Celtic Cross/ }).click();
    await startReading(page, fixture, { setup: false });
    const disclosure = page.locator('.reading-spread-disclosure');
    const overview = page.locator('[data-reading-overview]');
    await expect(disclosure).toBeVisible();
    await expect(disclosure).not.toHaveAttribute('open');
    await expect(overview.locator('img')).toHaveCount(0);

    await disclosure.locator('summary').click();
    const images = overview.locator('img');
    await expect(images).toHaveCount(10);
    await expect.poll(() => images.evaluateAll(nodes => nodes.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
    const resources = await images.evaluateAll(nodes => nodes.map(image => {
      const request = performance.getEntriesByName(image.currentSrc).at(-1);
      return {
        source: new URL(image.currentSrc).pathname,
        renderedWidth: image.getBoundingClientRect().width,
        naturalWidth: image.naturalWidth,
        encodedBodySize: request?.encodedBodySize ?? null,
        transferSize: request?.transferSize ?? null
      };
    }));
    const journeyTransfers = await page.evaluate(() => performance.getEntriesByType('resource')
      .filter(entry => /\/images\/cards\/(?:w360\/)?RWS1909_/.test(new URL(entry.name).pathname))
      .map(entry => ({ source: new URL(entry.name).pathname, encodedBodySize: entry.encodedBodySize, transferSize: entry.transferSize })));
    const evidencePath = testInfo.outputPath('celtic-phone-image-sources.json');
    await writeFile(evidencePath, JSON.stringify({ viewport: page.viewportSize(), deviceScaleFactor: 3, overviewImages: resources, coldFullJourney: journeyTransfers }, null, 2));
    await testInfo.attach('celtic-phone-image-sources.json', { path: evidencePath, contentType: 'application/json' });
    expect(resources.every(resource => /\/images\/cards\/w360\/[^/]+\.webp$/.test(resource.source))).toBe(true);
    expect(journeyTransfers.length).toBeGreaterThanOrEqual(10);
    expect(journeyTransfers.every(resource => /\/images\/cards\/w360\/[^/]+\.webp$/.test(resource.source))).toBe(true);

    // Returning to this disclosure keeps the same image nodes and selected view.
    await overview.getByRole('button', { name: 'Card list', exact: true }).click();
    await images.first().evaluate(image => { image.dataset.referenceMount = 'original'; });
    await disclosure.locator('summary').click();
    await disclosure.locator('summary').click();
    await expect(overview.locator('.reading-spread__cards--list')).toBeVisible();
    await expect(images.first()).toHaveAttribute('data-reference-mount', 'original');
  } finally {
    await fixture.close();
  }
});
