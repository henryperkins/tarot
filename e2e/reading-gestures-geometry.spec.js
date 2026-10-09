import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { createNarrativeFixture, startReading, expectNoHorizontalOverflow } from './helpers/narrativeFixtures.js';
import { createVisualCueLedger, applyVisualCueBatch } from '../shared/reading/visualCueLedger.js';
import { hashVisualCueText } from '../shared/contracts/visualCueBatches.js';
import { getVectorGestureDetails } from '../src/data/cardGestureArtwork.js';

test.setTimeout(60000);
const paragraph = 'Take time to consider the question you brought. Notice what feels familiar and what invites a different response. A small practical step can leave room for both movement and reflection.';
const raw = `## Your reading\n\n${Array(5).fill(paragraph).join('\n\n')}\n\nA painted detail can accompany this moment of reflection.\n\n${Array(7).fill(paragraph).join('\n\n')}`;
const evidenceRoot = 'output/reading-motion/evidence/live-beta-2026-10-09';

for (const size of [{ label: 'desktop', width: 1100, height: 1000 }, { label: 'phone', width: 390, height: 844 }]) {
  test(`settled companion clears the actual reading header at ${size.width}px${size.label === 'phone' ? ' @mobile' : ''}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const binding = { readingResultId: `controlled-geometry-${size.label}`, sourceRevision: 0,
      spreadHash: 'a'.repeat(64), contextHash: 'b'.repeat(64), artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'geometry-test-v1' };
    const fixture = await createNarrativeFixture(page, { narrative: raw, sourceUsage: null, signedOut: true,
      startData: { readingResultId: binding.readingResultId, visualBinding: binding, visualJobToken: 'controlled-geometry' } });
    try {
      await startReading(page, fixture);
      const cards = fixture.requests.reading[0].cardsInfo.map((card, index) => ({ index,
        canonicalName: card.canonicalName || card.card || card.name, artworkEdition: binding.artworkEdition }));
      const detail = getVectorGestureDetails(cards[0].canonicalName)[0];
      const result = await applyVisualCueBatch({ ledger: createVisualCueLedger(binding), authoritativeRaw: raw,
        issuedRequest: { binding, batchId: 'geometry', requestSequence: 1, status: 'active',
          analyzedEnd: raw.length, analyzedHash: await hashVisualCueText(raw), baseLedgerRevision: 0 },
        response: { proposals: [{ localAlias: 'detail', kind: 'literal', quote: 'A painted detail',
          targets: [{ spreadIndex: 0, detailIds: [detail.id] }] }] },
        validationContext: { cards, getSupportedDetails: name => getVectorGestureDetails(name).map(item => item.id) } });
      expect(result.rejected).toEqual([]);
      await fixture.emit('visual', 'cues', { binding, status: 'complete', cueLedger: result.ledger });
      const phrase = page.locator(`[data-gesture-id="${result.ledger.cues[0].id}"]`);
      await phrase.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await phrase.press('Enter');
      await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
      const activeArt = page.locator('.gesture-focus-layer:not(.gesture-focus-layer--departing) [data-gesture-art]');
      // The 550ms arrival and crop transitions must finish before judging or capturing art.
      await activeArt.evaluate(async element => {
        const layer = element.closest('.gesture-focus-layer');
        const finite = layer.getAnimations({ subtree: true }).filter(animation =>
          animation.effect?.getComputedTiming().iterations !== Infinity);
        await Promise.allSettled(finite.map(animation => animation.finished));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      await expect(activeArt).toBeVisible();
      await expect.poll(() => activeArt.evaluate(element => Number(getComputedStyle(element).opacity))).toBe(1);
      await expect.poll(() => activeArt.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
      await expect.poll(() => activeArt.evaluate(element => Number(getComputedStyle(element.closest('.gesture-focus-layer')).opacity))).toBe(1);
      const geometry = await page.evaluate(() => {
        const bounds = element => { const r = element.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; };
        const companion = document.querySelector('.gesture-companion');
        const first = document.querySelector('[data-gesture-shelf] button');
        const art = document.querySelector('.gesture-focus-layer:not(.gesture-focus-layer--departing) [data-gesture-art]');
        const shelf = bounds(first);
        return { header: bounds(document.querySelector('.header-sticky')), shelf,
          artwork: bounds(art), companion: bounds(companion),
          measuredHeaderHeight: Number.parseFloat(getComputedStyle(companion).getPropertyValue('--sticky-header-height')),
          shelfReceivesPointer: first.contains(document.elementFromPoint((shelf.left + shelf.right) / 2, (shelf.top + shelf.bottom) / 2)) };
      });
      expect(geometry.measuredHeaderHeight).toBeGreaterThan(0);
      expect(geometry.shelf.top).toBeGreaterThanOrEqual(geometry.header.bottom - 1);
      expect(geometry.shelfReceivesPointer).toBe(true);
      expect(geometry.artwork.top).toBeGreaterThanOrEqual(geometry.header.bottom - 1);
      expect(geometry.artwork.bottom).toBeLessThan(size.height);
      expect(geometry.artwork.width).toBeGreaterThan(100);
      expect(geometry.artwork.height).toBeGreaterThan(90);
      await expectNoHorizontalOverflow(page);
      await page.screenshot({ path: `${evidenceRoot}/controlled-${size.label}-settled.png` });
      await writeFile(`${evidenceRoot}/controlled-${size.label}-geometry.json`, `${JSON.stringify({
        scope: 'Controlled narrative and cue transports on normal reading route; guest auth; no model inference. Generic prose verifies layout, not semantic quality.',
        viewport: size, browser: size.label === 'phone' ? 'emulated iPhone WebKit' : 'headless Chromium',
        card: cards[0].canonicalName, detail: detail.id, ...geometry
      }, null, 2)}\n`);
    } finally { await fixture.close(); }
  });
}
