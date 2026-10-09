import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createNarrativeFixture } from './helpers/narrativeFixtures.js';

const browserErrors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const errors = [];
  browserErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(async ({ page }) => { expect(browserErrors.get(page)).toEqual([]); });

const star = JSON.parse(fs.readFileSync(new URL('../output/reading-motion/fixtures/gesture-sidecars.json', import.meta.url))).star;
const diagnostics = page => page.getByTestId('gesture-source-diagnostics');
const windowArt = page => page.locator('[data-gesture-window]');
const phrase = (page, id) => page.locator(`[data-gesture-id="${id}"]`);
const prose = page => page.locator('.narrative-stream');
const waterHandles = page => page.evaluate(() => [...document.querySelectorAll('[data-gesture-window] [data-gesture-water]')].flatMap(element => element.getAnimations()).map(animation => ({ state: animation.playState, rate: animation.playbackRate })));
const runningWater = async page => (await waterHandles(page)).filter(handle => handle.state === 'running').length;

async function open(page, query = 'sourceMode=job-sse') {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1100, height: 1000 });
  await page.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
  await page.goto(`/__e2e/reading-gestures?${query}`);
  await expect(page.getByTestId('reading-gestures-fixture')).toBeVisible();
}
async function fixtureFor(page) {
  return createNarrativeFixture(page, { narrative: star.expectedRaw, question: star.recordedContext.userQuestion });
}
async function deliverPool(page, fixture) {
  const end = star.associations.find(item => item.id === 'pool').passage.end;
  await fixture.emit('reading', 'delta', { text: star.expectedRaw.slice(0, end) });
  await expect(phrase(page, 'pool')).toBeVisible();
  await phrase(page, 'pool').click();
  await expect(windowArt(page)).toHaveAttribute('data-held', 'true');
  return end;
}

test('partial arrived text is accessible before the complete activation target', async ({ page }) => {
  const fixture = await fixtureFor(page);
  try {
    await open(page);
    const pool = star.associations.find(item => item.id === 'pool');
    await fixture.emit('reading', 'delta', { text: star.expectedRaw.slice(0, pool.passage.end - 4) });
    await expect(prose(page)).toContainText('pitcher into a');
    await expect(phrase(page, 'pool')).toHaveCount(0);
    await fixture.emit('reading', 'delta', { text: star.expectedRaw.slice(pool.passage.end - 4, pool.passage.end) });
    await expect(phrase(page, 'pool')).toHaveCount(1);
    await phrase(page, 'pool').focus();
    await expect(windowArt(page)).not.toHaveAttribute('data-held', 'true');
    await page.keyboard.press('Space');
    await expect(windowArt(page)).toHaveAttribute('data-held', 'true');
    await page.keyboard.press('Space');
    await expect(windowArt(page)).not.toHaveAttribute('data-held', 'true');
  } finally { await fixture.close(); }
});

test('non-prefix SSE snapshot invalidates old hold and source revision', async ({ page }) => {
  const fixture = await fixtureFor(page);
  try {
    await open(page);
    await deliverPool(page, fixture);
    const run = await diagnostics(page).getAttribute('data-run-id');
    await fixture.emit('reading', 'snapshot', { fullText: 'A replacement source with no authored card association.' });
    await expect(diagnostics(page)).toHaveAttribute('data-source-revision', '1');
    await expect(diagnostics(page)).toHaveAttribute('data-run-id', run);
    await expect(prose(page)).toContainText('A replacement source');
    await expect(phrase(page, 'pool')).toHaveCount(0);
    await expect(page.locator('[data-gesture-window] [data-gesture-water]')).toHaveCount(0);
    await fixture.emit('reading', 'done', { fullText: 'A replacement source with no authored card association.' });
    await expect(diagnostics(page)).toHaveAttribute('data-source-status', 'complete');
  } finally { await fixture.close(); }
});

test('same-spread regeneration changes run and retains occurrence positions; terminal errors retain raw source', async ({ page }) => {
  const fixture = await fixtureFor(page);
  try {
    await open(page);
    await deliverPool(page, fixture);
    const firstRun = await diagnostics(page).getAttribute('data-run-id');
    await fixture.emit('reading', 'done', { fullText: star.expectedRaw });
    await expect(diagnostics(page)).toHaveAttribute('data-source-status', 'complete');
    await page.getByRole('button', { name: 'Restart study' }).click();
    await expect.poll(() => fixture.requests.reading.length).toBe(2);
    await expect(diagnostics(page)).not.toHaveAttribute('data-run-id', firstRun);
    const newRun = await diagnostics(page).getAttribute('data-run-id');
    const occurrences = await page.locator('[data-gesture-shelf] button').evaluateAll(nodes => nodes.map(node => node.dataset.occurrenceId));
    expect(occurrences).toEqual([0, 1, 2].map(index => `${newRun}:${index}`));
    await fixture.emit('reading', 'delta', { text: 'The Star' });
    await fixture.emit('reading', 'error', { message: 'Controlled transport failure', code: 'FIXTURE_ERROR' });
    await expect(diagnostics(page)).toHaveAttribute('data-source-status', 'error');
    await expect(diagnostics(page)).toHaveAttribute('data-raw-length', '8');
    await expect(page.getByRole('alert').filter({ hasText: 'Controlled transport failure' })).toBeVisible();
    expect(await runningWater(page)).toBe(0);
  } finally { await fixture.close(); }
});

test('held water owns actual handles, settles and responds to reduced motion and simulated visibility', async ({ page }) => {
  const fixture = await fixtureFor(page);
  try {
    await open(page);
    await deliverPool(page, fixture);
    await expect.poll(() => runningWater(page)).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await waterHandles(page)).some(handle => handle.state === 'running' && handle.rate < 1)).toBe(true);
    await expect.poll(() => runningWater(page), { timeout: 2200 }).toBe(0);
    await phrase(page, 'pool').click();
    await expect.poll(() => runningWater(page)).toBeGreaterThan(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(() => runningWater(page)).toBe(0);
    await expect(windowArt(page)).toHaveAttribute('data-held', 'true');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(() => runningWater(page)).toBeGreaterThan(0);
    // Simulated visibilitychange validates listeners; this is not native background/BFCache evidence.
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect.poll(() => runningWater(page)).toBe(0);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect.poll(() => runningWater(page)).toBeGreaterThan(0);
    // Real scroll/intersection observation; extra fixture-only space permits moving artwork offscreen.
    await page.evaluate(() => { const spacer = document.createElement('div'); spacer.style.height = '2200px'; document.body.append(spacer); window.scrollTo(0, document.documentElement.scrollHeight); });
    await expect.poll(() => runningWater(page)).toBe(0);
    await windowArt(page).scrollIntoViewIfNeeded();
    await expect.poll(() => runningWater(page)).toBeGreaterThan(0);
    await page.setViewportSize({ width: 900, height: 800 });
    await expect.poll(() => runningWater(page)).toBeGreaterThan(0);
    const byOwner = await page.locator('[data-gesture-art]').evaluateAll(nodes => nodes.filter(node => [...node.querySelectorAll('[data-gesture-water]')].some(element => element.getAnimations().some(animation => animation.playState === 'running'))).length);
    expect(byOwner).toBe(1);
  } finally { await fixture.close(); }
});

test('completed burst settles even when a timer wakes before its deadline', async ({ page }) => {
  // Browser timers truncate fractional delays. Make that early wake observable
  // without relying on the machine happening to hit the sub-millisecond race.
  await page.addInitScript(() => {
    const schedule = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => schedule(callback,
      delay > 1000 && delay <= 1800 ? delay - 50 : delay, ...args);
  });
  await open(page, 'arrival=burst&associations=authored');
  await expect(diagnostics(page)).toHaveAttribute('data-source-status', 'complete');
  await expect(windowArt(page)).toHaveAttribute('data-association', 'balance');
  await expect(windowArt(page)).toHaveAttribute('data-phase', 'static', { timeout: 6000 });
  await expect.poll(() => runningWater(page)).toBe(0);
});

test('fast paired handoff leaves inert exits, bounded motion owners and intact keyboard focus', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await open(page, 'study=five-card&arrival=complete');
  for (const id of ['ace-meaning', 'drive-and-sensitivity', 'readiness', 'closing-spark']) {
    await phrase(page, id).focus();
    await page.keyboard.press('Enter');
    await expect(windowArt(page)).toHaveAttribute('data-association', id);
    const ownerCount = await page.locator('[data-gesture-art]').evaluateAll(nodes => nodes.filter(node => node.querySelector('[data-gesture-finite]')?.getAnimations().some(animation => animation.playState === 'running')).length);
    expect(ownerCount).toBeLessThanOrEqual(2);
    await expect(phrase(page, id)).toBeFocused();
    const departing = windowArt(page).locator('.gesture-focus-layer--departing');
    if (await departing.count()) {
      await expect(departing).toHaveAttribute('inert', '');
      await expect(departing.locator('button').first()).toHaveAttribute('tabindex', '-1');
    }
  }
  await expect(windowArt(page).locator('.gesture-focus-layer--departing')).toHaveCount(0, { timeout: 1200 });
  await expect(phrase(page, 'closing-spark')).toBeFocused();
  await expect(windowArt(page)).toHaveAttribute('data-association', 'closing-spark');
  expect(errors).toEqual([]);
});

test('actual route departure pauses and return resumes the same source generation', async ({ page }) => {
  const fixture = await fixtureFor(page);
  try {
    await open(page);
    await deliverPool(page, fixture);
    const run = await diagnostics(page).getAttribute('data-run-id');
    // The internal fixture omits navigation chrome; drive the browser history
    // interface so React Router actually leaves the route, preserving provider.
    await page.evaluate(() => { history.pushState({}, '', '/journal'); dispatchEvent(new PopStateEvent('popstate')); });
    await expect(page).toHaveURL(/\/journal/);
    await page.goBack();
    await expect(page.getByTestId('reading-gestures-fixture')).toBeVisible();
    await expect(diagnostics(page)).toHaveAttribute('data-run-id', run);
    await fixture.emit('reading', 'snapshot', { fullText: star.expectedRaw });
    await expect(diagnostics(page)).toHaveAttribute('data-raw-length', String(star.expectedRaw.length));
    expect(fixture.requests.reading).toHaveLength(1);
  } finally { await fixture.close(); }
});

test('bounded Chromium trace measures water while controlled SSE arrives', async ({ page }, testInfo) => {
  const fixture = await fixtureFor(page);
  const cdp = await page.context().newCDPSession(page);
  try {
    await open(page);
    const end = await deliverPool(page, fixture);
    await expect.poll(() => runningWater(page)).toBeGreaterThan(0);
    await cdp.send('Performance.enable');
    const before = await cdp.send('Performance.getMetrics');
    await cdp.send('Tracing.start', { categories: 'devtools.timeline,blink.user_timing', transferMode: 'ReturnAsStream' });
    const frameSample = page.evaluate(async () => {
      const times = []; const started = performance.now(); let previous = started;
      await new Promise(resolve => { const sample = now => { times.push(now - previous); previous = now; if (now - started < 1200) requestAnimationFrame(sample); else resolve(); }; requestAnimationFrame(sample); });
      return { frames: times.length, longFrameIntervals: times.filter(time => time > 34).length, maximumIntervalMs: Math.max(...times) };
    });
    await fixture.emit('reading', 'delta', { text: star.expectedRaw.slice(end) });
    await expect(diagnostics(page)).toHaveAttribute('data-raw-length', String(star.expectedRaw.length));
    await page.keyboard.press('Escape');
    await expect(windowArt(page)).toHaveAttribute('data-association', 'balance');
    const frames = await frameSample;
    const after = await cdp.send('Performance.getMetrics');
    const completed = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.end');
    const { stream } = await completed;
    let trace = ''; let eof = false;
    while (!eof) { const chunk = await cdp.send('IO.read', { handle: stream }); trace += chunk.data; eof = chunk.eof; }
    await cdp.send('IO.close', { handle: stream });
    const events = JSON.parse(trace).traceEvents;
    const delta = name => after.metrics.find(metric => metric.name === name)?.value - before.metrics.find(metric => metric.name === name)?.value;
    const result = { lane: 'headless Chromium mocked-auth controlled real SSE; emulated desktop', ...frames,
      scriptSeconds: delta('ScriptDuration'), taskSeconds: delta('TaskDuration'), layoutSeconds: delta('LayoutDuration'),
      paintEvents: events.filter(event => event.name === 'Paint').length,
      longMainThreadTasks: events.filter(event => event.name === 'RunTask' && event.dur > 50000).length,
      limitation: 'Bounded browser measurement, no physical handset or GPU proof; frame intervals are observed, not compositor dropped-frame counts.' };
    const summaryPath = testInfo.outputPath('gesture-performance-summary.json');
    const tracePath = testInfo.outputPath('gesture-performance-trace.json.gz');
    fs.mkdirSync(testInfo.outputDir, { recursive: true });
    fs.writeFileSync(summaryPath, JSON.stringify(result, null, 2));
    fs.writeFileSync(tracePath, gzipSync(trace));
    console.log(`Gesture performance: ${JSON.stringify(result)}`);
    await testInfo.attach('gesture-performance-summary', { path: summaryPath, contentType: 'application/json' });
    await testInfo.attach('gesture-performance-trace', { path: tracePath, contentType: 'application/gzip' });
    expect(result.frames).toBeGreaterThan(0);
    await fixture.emit('reading', 'done', { fullText: star.expectedRaw });
  } finally { await cdp.detach(); await fixture.close(); }
});


test('source-driven card emergence is hidden before identity and perceptible around authored midpoint', async ({ page }) => {
  const fixture = await fixtureFor(page);
  try {
    await open(page);
    const introduction = star.introductions[0];
    const shelfArt = page.locator('[data-gesture-shelf] li').nth(2).locator('[data-gesture-art]');
    const presence = () => shelfArt.evaluate(element => Number(getComputedStyle(element).opacity));
    await expect(shelfArt).toHaveCSS('visibility', 'hidden');
    await fixture.emit('reading', 'snapshot', { fullText: star.expectedRaw.slice(0, introduction.namedEnd) });
    await expect.poll(presence).toBeGreaterThan(0);
    expect(await presence()).toBeLessThan(0.06);
    await fixture.emit('reading', 'snapshot', { fullText: star.expectedRaw.slice(0, introduction.midpoint) });
    await expect.poll(presence).toBeGreaterThan(0.4);
    expect(await presence()).toBeLessThan(0.8);
    await fixture.emit('reading', 'snapshot', { fullText: star.expectedRaw.slice(0, introduction.end) });
    await expect.poll(presence).toBe(1);
    await expect(diagnostics(page)).toHaveAttribute('data-source-revision', '0');
  } finally { await fixture.close(); }
});
