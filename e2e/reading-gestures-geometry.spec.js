import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { observeNarrativeUiHealth, createNarrativeFixture, startReading, expectNoHorizontalOverflow } from './helpers/narrativeFixtures.js';
import { createVisualCueLedger, applyVisualCueBatch } from '../shared/reading/visualCueLedger.js';
import { hashVisualCueText } from '../shared/contracts/visualCueBatches.js';
import { getVectorGestureDetails } from '../src/data/cardGestureArtwork.js';
import { settleGestureFocusLayer } from './helpers/artworkGeometry.mjs';

const uiHealth = new WeakMap();
test.beforeEach(async ({ page }) => {
  uiHealth.set(page, observeNarrativeUiHealth(page, { allowGuestAuthRejection: true }));
  await page.route(/https:\/\/[^/]*sentry\.io\/.*\/envelope\//, route => route.fulfill({ json: {} }));
  // Authored pages still mount AuthProvider. Later controlled-reading routes
  // take precedence over this exact guest response, including mock Pro users.
  await page.route(url => ['localhost', '127.0.0.1'].includes(url.hostname)
    && url.pathname === '/api/auth/me' && !url.search, route => route.request().method() === 'GET'
    ? route.fulfill({ status: 401, json: { user: null } }) : route.fallback());
});
test.afterEach(async ({ page }) => { uiHealth.get(page)?.(); });

test.setTimeout(60000);
const paragraph = 'Take time to consider the question you brought. Notice what feels familiar and what invites a different response. A small practical step can leave room for both movement and reflection.';
const raw = `## Your reading\n\n${Array(5).fill(paragraph).join('\n\n')}\n\nA painted detail can accompany this moment of reflection.\n\n${Array(7).fill(paragraph).join('\n\n')}`;
// Historical captures, including live-beta-2026-10-09, are immutable. Every
// run writes only beneath its own Playwright output directory: the owned
// remediation lane supplies a unique run directory, other configs their own
// per-run output. Files are created exclusively and carry runtime identity.
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function runtimeIdentity() {
  if (!process.env.CUE_VALIDATION_MANIFEST) return { owned: false, note: 'No owned runtime manifest; source/build identity is not attested for this server.' };
  const bytes = await readFile(process.env.CUE_VALIDATION_MANIFEST);
  const { buildIdentity } = JSON.parse(bytes);
  return { owned: true, lane: process.env.CUE_VALIDATION_LANE, runId: buildIdentity.runId, snapshotDigest: buildIdentity.snapshotDigest,
    outputDigest: buildIdentity.outputDigest, sourceAllowlistVersion: buildIdentity.sourceAllowlistVersion, manifestSha256: sha256(bytes),
    evidenceRunDirectory: process.env.CUE_VALIDATION_EVIDENCE_DIR ? path.basename(process.env.CUE_VALIDATION_EVIDENCE_DIR) : null };
}

test('compact split and paired cards retain their painted detail extents after stage resizing @mobile', async ({ page }, testInfo) => {
  const sizes = [{ width: 375, height: 667 }, { width: 320, height: 568 }, { width: 844, height: 390 }];
  const studies = [
    { key: 'five-card', ids: ['ace-meaning', 'drive-and-sensitivity', 'swords-carried', 'pentacles-group', 'wheel-image'] },
    { key: 'star', ids: ['balance'] },
    { key: 'celtic', ids: ['relationship'] }
  ];
  const measurements = [];
  for (const study of studies) {
    await page.setViewportSize(sizes[0]);
    await page.goto(`/__e2e/reading-gestures?associations=authored&study=${study.key}&arrival=complete`);
    for (const id of study.ids) {
      const phrase = page.locator(`[data-gesture-id="${id}"]`);
      await phrase.scrollIntoViewIfNeeded();
      await phrase.press('Enter');
      await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-association', id);
      for (const size of sizes) {
        await page.setViewportSize(size);
        const settled = await settleGestureFocusLayer(page);
        expect(settled.decoded.every(Boolean)).toBe(true);
        const geometry = await page.locator('.gesture-focus-layer:not(.gesture-focus-layer--departing)').evaluate(layer => {
          const stage = layer.parentElement.getBoundingClientRect();
          const arts = [...layer.querySelectorAll('[data-gesture-art]')].map(art => {
            const bounds = art.getBoundingClientRect(), image = art.querySelector('img').getBoundingClientRect();
            const transformedBox = (shape, padding = 0) => {
              const box = shape.getBBox(), matrix = shape.getScreenCTM();
              const corners = [[box.x - padding, box.y - padding], [box.x + box.width + padding, box.y - padding],
                [box.x - padding, box.y + box.height + padding], [box.x + box.width + padding, box.y + box.height + padding]]
                .map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
              return { left: Math.min(...corners.map(point => point.x)), right: Math.max(...corners.map(point => point.x)),
                top: Math.min(...corners.map(point => point.y)), bottom: Math.max(...corners.map(point => point.y)) };
            };
            const intersect = (a, b) => ({ left: Math.max(a.left, b.left), right: Math.min(a.right, b.right), top: Math.max(a.top, b.top), bottom: Math.min(a.bottom, b.bottom) });
            const overlays = [...art.querySelectorAll('[data-gesture-finite], [data-gesture-water]')].map(shape => {
              let paint = transformedBox(shape, Number.parseFloat(getComputedStyle(shape).strokeWidth || '0') / 2);
              for (let parent = shape.parentElement; parent && parent !== art; parent = parent.parentElement) {
                const clipId = parent.getAttribute('clip-path')?.match(/url\(#(.+)\)/)?.[1];
                const clip = clipId && document.getElementById(clipId)?.firstElementChild;
                if (clip) paint = intersect(paint, transformedBox(clip));
              }
              paint = intersect(paint, image);
              return { kind: shape.hasAttribute('data-gesture-finite') ? 'trace' : 'water', empty: paint.right <= paint.left || paint.bottom <= paint.top,
                margin: Math.min(paint.left - bounds.left, bounds.right - paint.right, paint.top - bounds.top, bounds.bottom - paint.bottom) };
            }).filter(overlay => !overlay.empty);
            const mask = art.querySelector('mask');
            const points = [...(mask?.querySelectorAll('ellipse') || [])].flatMap(ellipse => Array.from({ length: 96 }, (_, index) => {
              const angle = index * Math.PI / 48;
              return new DOMPoint(Number(ellipse.getAttribute('cx')) + Number(ellipse.getAttribute('rx')) * Math.cos(angle),
                Number(ellipse.getAttribute('cy')) + Number(ellipse.getAttribute('ry')) * Math.sin(angle)).matrixTransform(ellipse.getScreenCTM());
            })).filter(point => point.x >= image.left && point.x <= image.right && point.y >= image.top && point.y <= image.bottom);
            return { card: art.dataset.cardName, reversed: art.querySelector('.gesture-art__upright').dataset.reversed === 'true',
              width: bounds.width, height: bounds.height, margin: Math.min(...points.map(point => Math.min(point.x - bounds.left, bounds.right - point.x, point.y - bounds.top, bounds.bottom - point.y))),
              paintedMaskSamples: points.length,
              overlays,
              cropped: points.some(point => point.x < bounds.left - .1 || point.x > bounds.right + .1 || point.y < bounds.top - .1 || point.y > bounds.bottom + .1),
              imageComplete: art.querySelector('img').complete };
          });
          return { arts, stageHeight: stage.height, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
            running: document.getAnimations().filter(animation => animation.playState === 'running' && layer.contains(animation.effect?.target)).length };
        });
        expect(geometry.arts.length).toBeGreaterThan(0);
        for (const art of geometry.arts) {
          expect(art.imageComplete, `${id}/${art.card}`).toBe(true);
          expect(art.paintedMaskSamples, `${id}/${art.card} rendered mask`).toBeGreaterThan(20);
          expect(art.cropped, `${id}/${art.card} ${size.width}x${size.height}`).toBe(false);
          expect(art.margin, `${id}/${art.card} breathing room`).toBeGreaterThan(2.5);
          for (const overlay of art.overlays) expect(overlay.margin, `${id}/${art.card} complete ${overlay.kind} paint`).toBeGreaterThanOrEqual(-.2);
        }
        expect(geometry.stageHeight).toBe(size.height < 600 ? 72 : size.width < 359 ? 96 : 106);
        if (geometry.reducedMotion) expect(geometry.running).toBe(0);
        await expectNoHorizontalOverflow(page);
        measurements.push({ study: study.key, id, size, ...geometry });
        if (size.width === 320 && ['ace-meaning', 'swords-carried', 'balance', 'relationship'].includes(id)) {
          const screenshot = testInfo.outputPath(`compact-${study.key}-${id}.png`);
          await page.locator('.gesture-companion').screenshot({ path: screenshot });
          await testInfo.attach(`compact-${study.key}-${id}`, { path: screenshot, contentType: 'image/png' });
        }
      }
      await page.keyboard.press('Escape');
    }
  }
  await writeFile(testInfo.outputPath('compact-detail-extents.json'), `${JSON.stringify({ scope: 'Authored fixture artwork; held inspection, emulated engines, no inference or physical device.',
    runtime: await runtimeIdentity(), measurements }, null, 2)}\n`, { flag: 'wx' });
});

for (const size of [{ label: 'desktop', width: 1100, height: 1000 }, { label: 'phone', width: 390, height: 844 }]) {
  test(`settled companion clears the actual reading header at ${size.width}px${size.label === 'phone' ? ' @mobile' : ''}`, async ({ page, browser }, testInfo) => {
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
      const screenshotPath = testInfo.outputPath(`controlled-${size.label}-settled.png`);
      await mkdir(testInfo.outputDir, { recursive: true });
      const screenshot = await page.screenshot();
      await writeFile(screenshotPath, screenshot, { flag: 'wx' });
      await writeFile(testInfo.outputPath(`controlled-${size.label}-geometry.json`), `${JSON.stringify({
        scope: 'Controlled narrative and cue transports on normal reading route; guest auth; no model inference. Generic prose verifies layout, not semantic quality.',
        viewport: size, browser: testInfo.project.use.browserName, browserVersion: browser.version(), project: testInfo.project.name,
        actual: await page.evaluate(() => ({ reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, viewport: { width: innerWidth, height: innerHeight }, devicePixelRatio })),
        actualReducedMotion: await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), physicalDevice: false,
        runtime: await runtimeIdentity(), screenshot: { file: path.basename(screenshotPath), sha256: sha256(screenshot), bytes: screenshot.length },
        card: cards[0].canonicalName, detail: detail.id, ...geometry
      }, null, 2)}\n`, { flag: 'wx' });
    } finally { await fixture.close(); }
  });
}
