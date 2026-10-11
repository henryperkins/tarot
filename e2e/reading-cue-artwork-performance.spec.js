import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { observeNarrativeUiHealth, createNarrativeFixture, openSetup, startReading, expectNoHorizontalOverflow } from './helpers/narrativeFixtures.js';

const uiHealth = new WeakMap();
test.beforeEach(async ({ page }) => {
  uiHealth.set(page, observeNarrativeUiHealth(page, {}));
  await page.route(/https:\/\/[^/]*sentry\.io\/.*\/envelope\//, route => route.fulfill({ json: {} }));
});
test.afterEach(async ({ page }) => { uiHealth.get(page)?.(); });

// Task 13 measurement lane: the separately identified optimized build on the normal
// reading route, mocked auth and controlled narrative transport, emulated
// engines. Structural budgets are asserted; transfer, decode, memory and layout
// numbers are recorded under these conditions only. They are not handset
// budgets; physical iPhone and mid-range devices are separate evidence.
test.setTimeout(180000);
// Ordinary e2e runs proxy /api to the shared development Worker; measure only the owned optimized build.
test.skip(process.env.CUE_VALIDATION_LANE !== 'optimized', 'Measures only the owned optimized validation lane.');
const SPREADS = [['Three-Card Story', 3], ['Five-Card Clarity', 5], ['Celtic Cross', 10]];
const paragraph = 'Take time with the question you brought. Notice what feels familiar and what asks for a different response before you choose a small next step.';
const narrative = `## Your reading\n\n${Array.from({ length: 40 }, () => paragraph).join('\n\n')}`;
const FACE = /\/images\/cards\/rws-vector\/[^/]+\.webp$/;

async function installObservers(page) {
  await page.addInitScript(() => {
    window.__layoutShift = { total: 0, entries: 0 };
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          window.__layoutShift.total += entry.value; window.__layoutShift.entries += 1;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch { window.__layoutShift = null; }
  });
}

async function readingPass(page, fixture, spreadName, count) {
  await openSetup(page);
  await page.getByRole('radio', { name: new RegExp(spreadName, 'i') }).click();
  await startReading(page, fixture, { setup: false });
  const shelf = page.locator('[data-gesture-shelf] img');
  await expect(shelf).toHaveCount(count);
  await expect.poll(() => shelf.evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
  await expect(page.locator('.narrative-stream')).toContainText('small next step');
  const drawnFaces = [...new Set(await shelf.evaluateAll(images => images.map(image => new URL(image.currentSrc || image.src).pathname)))].sort();
  return drawnFaces;
}

async function snapshot(page) {
  return page.evaluate(() => ({
    resources: performance.getEntriesByType('resource').map(entry => ({ path: new URL(entry.name).pathname, initiatorType: entry.initiatorType,
      transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize, durationMs: entry.duration })),
    // Gesture motion handles only; unrelated page chrome is outside this budget.
    runningAnimations: (document.querySelector('.gesture-companion')?.getAnimations({ subtree: true }) || [])
      .filter(animation => animation.playState === 'running').length,
    layoutShift: window.__layoutShift,
    overflowPx: document.documentElement.scrollWidth - innerWidth,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }
  }));
}

test('streaming prose grows without enlarging its decorative raster surface', async ({ page, browserName }, testInfo) => {
  const chunks = Array.from({ length: 40 }, (_, index) => `Stream checkpoint ${index + 1}. ${paragraph}`);
  const fullText = `## Your reading\n\n${chunks.join('\n\n')}`;
  const fixture = await createNarrativeFixture(page, { narrative: fullText, sourceUsage: null });
  const decoration = page.locator('.narrative-atmosphere-host > .narrative-atmosphere__decoration');
  const prose = page.locator('.narrative-stream__text');
  const samples = [];
  const measure = () => decoration.evaluate(node => {
    const host = node.parentElement;
    const box = node.getBoundingClientRect();
    const wash = getComputedStyle(node, '::after');
    const dust = getComputedStyle(node, '::before');
    return {
      proseHeight: host.getBoundingClientRect().height,
      decorationWidth: box.width,
      decorationHeight: box.height,
      washHeight: parseFloat(wash.height),
      washDisplay: wash.display,
      dustDisplay: dust.display,
      dustAnimation: dust.animationName,
      contain: getComputedStyle(node).contain,
      hiddenFromAccessibility: node.getAttribute('aria-hidden'),
      viewportHeight: innerHeight,
      mobileStableMode: Boolean(node.closest('.mobile-stable-mode')),
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches
    };
  });
  try {
    await startReading(page, fixture, { complete: false });
    for (const count of [2, 10, 25, 40]) {
      await fixture.emit('reading', 'snapshot', { fullText: `## Your reading\n\n${chunks.slice(0, count).join('\n\n')}` });
      await expect(prose).toContainText(`Stream checkpoint ${count}.`);
      await expect(decoration).toHaveCount(1);
      samples.push({ paragraphs: count, ...await measure() });
    }
    expect(samples.at(-1).proseHeight - samples[0].proseHeight).toBeGreaterThan(2000);
    for (const sample of samples) {
      expect(sample.decorationHeight).toBeGreaterThan(0);
      expect(sample.decorationHeight).toBeLessThanOrEqual(sample.viewportHeight + 1);
      expect(sample.decorationHeight).toBeCloseTo(samples[0].decorationHeight, 1);
      expect(sample.decorationWidth).toBeCloseTo(samples[0].decorationWidth, 1);
      if (sample.mobileStableMode) {
        expect(sample.washDisplay).toBe('none');
        expect(sample.dustDisplay).toBe('none');
      } else {
        expect(sample.washHeight).toBeCloseTo(sample.decorationHeight, 1);
        expect(sample.washDisplay).not.toBe('none');
      }
      expect(sample.contain).toBe('strict');
      expect(sample.hiddenFromAccessibility).toBe('true');
      expect(sample.dustAnimation).toBe(sample.reducedMotion ? 'none' : 'narrativeDustDrift');
    }
    // Completion preserves the bounded layer and the full, selectable reading.
    await fixture.completeReading();
    const completed = await measure();
    expect(completed.decorationHeight).toBeCloseTo(samples[0].decorationHeight, 1);
    await expect(prose).toContainText('Stream checkpoint 40.');
    await expectNoHorizontalOverflow(page);
    const output = testInfo.outputPath('streaming-background-bounds.json');
    await mkdir(testInfo.outputDir, { recursive: true });
    await writeFile(output, `${JSON.stringify({
      scope: 'optimized build, mocked auth and controlled real SSE, emulated engine; structural raster bounds, not physical GPU timing',
      project: testInfo.project.name, browserName, samples, completed
    }, null, 2)}\n`, { flag: 'wx' });
    await testInfo.attach('streaming-background-bounds', { path: output, contentType: 'application/json' });
    const screenshot = testInfo.outputPath('streaming-background.png');
    await prose.evaluate(node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.screenshot({ path: screenshot });
    await testInfo.attach('streaming-background', { path: screenshot, contentType: 'image/png' });
  } finally { await fixture.close(); }
});

for (const [spreadName, count] of SPREADS) {
  test(`${count}-card reading transfers only drawn artwork, cold then warm`, async ({ page, browserName }, testInfo) => {
    await installObservers(page);
    const fixture = await createNarrativeFixture(page, { narrative, sourceUsage: null });
    const network = [];
    page.on('response', response => {
      const url = new URL(response.url());
      if (FACE.test(url.pathname)) network.push({ path: url.pathname, type: response.request().resourceType(), status: response.status(),
        cacheControl: response.headers()['cache-control'] || null, contentType: response.headers()['content-type'] || null });
    });
    const cdp = browserName === 'chromium' ? await page.context().newCDPSession(page) : null;
    // The warm pass is a second reading: a fresh transport fixture (its routes take
    // precedence) keeps one reading per fixture while the page's HTTP cache persists.
    let warmFixture = null;
    try {
      if (cdp) await cdp.send('Performance.enable');
      const coldFaces = await readingPass(page, fixture, spreadName, count);
      const cold = await snapshot(page);
      const coldMetrics = cdp ? Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(metric => [metric.name, metric.value])) : null;
      // Long reading: scroll to the end and back, then let any motion settle.
      await page.evaluate(async () => {
        for (const y of [document.body.scrollHeight, 0]) { scrollTo({ top: y, behavior: 'instant' }); await new Promise(resolve => setTimeout(resolve, 400)); }
      });
      await page.waitForTimeout(3600);
      const settled = await snapshot(page);
      const settledMetrics = cdp ? Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(metric => [metric.name, metric.value])) : null;
      const coldFaceRequests = network.filter(item => FACE.test(item.path));
      // Warm pass in the same context and HTTP cache.
      network.length = 0;
      warmFixture = await createNarrativeFixture(page, { narrative, sourceUsage: null });
      const warmFaces = await readingPass(page, warmFixture, spreadName, count);
      const warm = await snapshot(page);
      const warmFaceRequests = network.filter(item => FACE.test(item.path));

      // Structural budgets.
      expect(coldFaces).toHaveLength(count);
      expect([...new Set(coldFaceRequests.map(item => item.path))].sort()).toEqual(coldFaces);
      expect(warmFaces).toHaveLength(count);
      expect(warmFaceRequests.filter(item => !warmFaces.includes(item.path))).toEqual([]);
      expect(cold.resources.filter(entry => /cardGestureDetails|gesture-registry|\/rws-vector\/.*\.svg$/.test(entry.path))).toEqual([]);
      expect(settled.runningAnimations).toBe(0);
      expect(cold.overflowPx).toBeLessThanOrEqual(0);
      await expectNoHorizontalOverflow(page);

      const facesBytes = entries => entries.filter(entry => FACE.test(entry.path))
        .reduce((sum, entry) => ({ transfer: sum.transfer + entry.transferSize, encoded: sum.encoded + entry.encodedBodySize, decoded: sum.decoded + entry.decodedBodySize }), { transfer: 0, encoded: 0, decoded: 0 });
      const measurement = {
        scope: 'optimized build, normal reading route, mocked auth/narrative transports, emulated engine; not a physical device',
        project: testInfo.project.name, browserName, browserVersion: page.context().browser()?.version() ?? null,
        spread: spreadName, drawnCards: count, viewport: cold.viewport, reducedMotion: cold.reducedMotion,
        cold: { faces: coldFaces, faceRequests: coldFaceRequests, bytes: facesBytes(cold.resources), layoutShift: cold.layoutShift },
        settled: { runningAnimations: settled.runningAnimations, layoutShift: settled.layoutShift },
        warm: { faces: warmFaces, faceRequests: warmFaceRequests, bytes: facesBytes(warm.resources.slice(cold.resources.length)) },
        chromiumMetrics: cdp ? { cold: { JSHeapUsedSize: coldMetrics.JSHeapUsedSize, Nodes: coldMetrics.Nodes, LayoutCount: coldMetrics.LayoutCount,
          LayoutDuration: coldMetrics.LayoutDuration, ScriptDuration: coldMetrics.ScriptDuration, TaskDuration: coldMetrics.TaskDuration },
        settled: { JSHeapUsedSize: settledMetrics.JSHeapUsedSize, Nodes: settledMetrics.Nodes } } : 'not available in this engine'
      };
      await mkdir(testInfo.outputDir, { recursive: true });
      const output = testInfo.outputPath(`artwork-performance-${count}-card.json`);
      await writeFile(output, `${JSON.stringify(measurement, null, 2)}\n`, { flag: 'wx' });
      await testInfo.attach('artwork-performance', { path: output, contentType: 'application/json' });
    } finally { await cdp?.detach().catch(() => {}); await warmFixture?.close(); await fixture.close(); }
  });
}
