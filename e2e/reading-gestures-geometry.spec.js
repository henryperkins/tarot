import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { observeNarrativeUiHealth, createNarrativeFixture, startReading, expectNoHorizontalOverflow } from './helpers/narrativeFixtures.js';
import { createVisualCueLedger, applyVisualCueBatch } from '../shared/reading/visualCueLedger.js';
import { hashVisualCueText } from '../shared/contracts/visualCueBatches.js';
import { getVectorGestureDetails } from '../src/data/cardGestureArtwork.js';
import { measureGestureFocusLayer, settleGestureFocusLayer } from './helpers/artworkGeometry.mjs';
import { loadArtworkMatrixReadingCase } from './helpers/artworkMatrixCorpus.mjs';
import { evaluatePaintedEndpoints } from './helpers/artworkPaintedEndpoints.mjs';

const uiHealth = new WeakMap();
test.beforeEach(async ({ page }) => {
  uiHealth.set(page, observeNarrativeUiHealth(page, { allowGuestAuthRejection: true }));
  await page.route(/https:\/\/[^/]*sentry\.io\/.*\/envelope\//, route => route.fulfill({ json: {} }));
  // WebKit unload keepalive requests can bypass Playwright routing. Install
  // the envelope-only fixture response before Sentry captures native fetch.
  await page.addInitScript(() => {
    const nativeFetch = window.fetch;
    window.fetch = function(input, init) {
      let url;
      try {
        url = new URL(input instanceof Request ? input.url : String(input), location.href);
      } catch {
        return nativeFetch.call(this, input, init);
      }
      if (url.protocol === 'https:' && (url.hostname === 'sentry.io' || url.hostname.endsWith('.sentry.io'))
        && /\/envelope\/?$/.test(url.pathname)) {
        return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return nativeFetch.call(this, input, init);
    };
  });
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
    independentOracleSha256: sha256(await readFile(new URL('./helpers/artworkPaintedEndpoints.mjs', import.meta.url))),
    evidenceRunDirectory: process.env.CUE_VALIDATION_EVIDENCE_DIR ? path.basename(process.env.CUE_VALIDATION_EVIDENCE_DIR) : null };
}

// Isolated browser DOM exercises the real shared settlement helper. Animation
// handles and finished promises are native; no application motion is changed.
async function openSettlementProbe(page) {
  await page.setContent(`<div data-gesture-window data-held="true" data-association="settlement-probe">
    <div class="gesture-focus-layer">
      <button data-focus-card data-occurrence-id="probe:0" data-details="probe">
        <span data-gesture-art data-gesture-owner="probe:0">
          <img class="gesture-art__image" alt="Settlement probe" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">
          <span class="settlement-arrival">Arrival</span><span class="gesture-art__trace">Trace</span><span class="settlement-water">Water</span>
        </span>
      </button>
    </div>
  </div>`);
}

test('artwork settlement awaits finite work created after its first animation snapshot', async ({ page }, testInfo) => {
  await openSettlementProbe(page);
  await page.evaluate(() => {
    const nativeGetAnimations = document.getAnimations.bind(document);
    const state = window.__gestureSettlementProbe = { scheduled: false, late: null, water: null, finishedAt: null, cancelled: 0 };
    document.getAnimations = (...args) => {
      if (!state.scheduled) {
        state.scheduled = true;
        const arrival = document.querySelector('.settlement-arrival').animate([{ opacity: .4 }, { opacity: 1 }], { duration: 120, fill: 'forwards' });
        arrival.addEventListener('cancel', () => { state.cancelled += 1; });
        state.water = document.querySelector('.settlement-water').animate([{ opacity: .4 }, { opacity: 1 }], { duration: 120, iterations: Infinity });
        state.water.addEventListener('cancel', () => { state.cancelled += 1; });
        // Return an unmodified native snapshot, then create real late finite
        // work on the next rendered frame, as a passive effect can do.
        requestAnimationFrame(() => {
          state.late = document.querySelector('.gesture-art__trace').animate([{ opacity: .2 }, { opacity: 1 }], { duration: 900, fill: 'forwards' });
          state.late.addEventListener('cancel', () => { state.cancelled += 1; });
          state.late.finished.then(() => { state.finishedAt = performance.now(); }, () => {});
        });
      }
      return nativeGetAnimations(...args);
    };
    state.restore = () => { document.getAnimations = nativeGetAnimations; };
  });
  try {
    const settled = await settleGestureFocusLayer(page);
    const actual = await page.evaluate(() => {
      const state = window.__gestureSettlementProbe;
      return { lateCreated: Boolean(state.late), lateState: state.late?.playState, waterState: state.water?.playState, finishedAt: state.finishedAt,
        observedAt: performance.now(), cancelled: state.cancelled,
        runningFinite: document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity
          && animation.playState === 'running').length };
    });
    expect(actual.lateCreated).toBe(true);
    expect(actual.lateState, 'late native trace must finish before settlement returns').toBe('finished');
    expect(actual.finishedAt).not.toBeNull();
    expect(actual.observedAt).toBeGreaterThanOrEqual(actual.finishedAt);
    expect(actual.runningFinite).toBe(0);
    expect(actual.waterState, 'held infinite water is excluded and must keep running').toBe('running');
    expect(actual.cancelled, 'settlement must not cancel native motion').toBe(0);
    expect(settled.decoded).toEqual([true]);
    expect(settled.finiteAnimationsAwaited).toBeGreaterThanOrEqual(2);
    await testInfo.attach('late-finite-settlement', { body: JSON.stringify({ settled, actual }, null, 2), contentType: 'application/json' });
  } finally {
    await page.evaluate(() => { window.__gestureSettlementProbe.restore(); });
  }
});

test('artwork settlement rejects persistent finite work without cancelling it', async ({ page }, testInfo) => {
  await openSettlementProbe(page);
  await page.evaluate(() => {
    const nativeGetAnimations = document.getAnimations.bind(document);
    const trace = document.querySelector('.gesture-art__trace');
    const state = window.__gestureSettlementProbe = { active: true, started: false, created: 0, cancelled: 0, current: null };
    const start = () => {
      const animation = trace.animate([{ opacity: .2 }, { opacity: 1 }], { duration: 120 });
      state.current = animation;
      state.created += 1;
      animation.addEventListener('cancel', () => { state.cancelled += 1; });
      animation.finished.then(() => { if (state.active) start(); }, () => {});
    };
    document.getAnimations = (...args) => {
      if (!state.started) { state.started = true; start(); }
      return nativeGetAnimations(...args);
    };
    state.restore = () => { document.getAnimations = nativeGetAnimations; };
  });
  try {
    const waitStartedAt = performance.now();
    await expect(settleGestureFocusLayer(page)).rejects.toThrow(/did not settle within 5000ms/);
    const observedWaitMs = performance.now() - waitStartedAt;
    const actual = await page.evaluate(() => {
      const state = window.__gestureSettlementProbe;
      return { created: state.created, cancelled: state.cancelled, currentState: state.current?.playState,
        runningFinite: document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity
          && animation.playState === 'running').length };
    });
    expect(actual.created, 'successive real finite handles must keep the layer busy').toBeGreaterThan(2);
    expect(actual.runningFinite).toBeGreaterThan(0);
    expect(actual.currentState).toBe('running');
    expect(actual.cancelled, 'a timeout must not retire the current native handle').toBe(0);
    await testInfo.attach('persistent-finite-settlement', { body: JSON.stringify({ ...actual, observedWaitMs,
      clock: 'Node monotonic performance.now; includes helper execution and browser transport' }, null, 2), contentType: 'application/json' });
  } finally {
    await page.evaluate(async () => {
      const state = window.__gestureSettlementProbe;
      state.active = false;
      state.restore();
      await state.current?.finished;
    });
  }
  // A paused real finite handle has an unresolved finished promise. The same
  // bound must reject that wait, as well as the chain of new finite handles.
  await openSettlementProbe(page);
  await page.evaluate(() => {
    const state = window.__gestureSettlementProbe = { cancelled: 0,
      current: document.querySelector('.gesture-art__trace').animate([{ opacity: .2 }, { opacity: 1 }], { duration: 120 }) };
    state.current.addEventListener('cancel', () => { state.cancelled += 1; });
    state.current.pause();
  });
  try {
    const waitStartedAt = performance.now();
    await expect(settleGestureFocusLayer(page)).rejects.toThrow(/did not settle within 5000ms/);
    const observedWaitMs = performance.now() - waitStartedAt;
    const actual = await page.evaluate(() => ({ currentState: window.__gestureSettlementProbe.current.playState,
      cancelled: window.__gestureSettlementProbe.cancelled }));
    expect(actual.currentState, 'settlement must not advance a paused finite handle').toBe('paused');
    expect(actual.cancelled).toBe(0);
    await testInfo.attach('paused-finite-settlement', { body: JSON.stringify({ ...actual, observedWaitMs,
      clock: 'Node monotonic performance.now; includes helper execution and browser transport' }, null, 2), contentType: 'application/json' });
  } finally {
    await page.evaluate(async () => {
      const animation = window.__gestureSettlementProbe.current;
      animation.play();
      await animation.finished;
    });
  }
});

test('artwork settlement rejects replaced focus ownership or source images', async ({ page }, testInfo) => {
  const observations = [];
  for (const change of ['layer', 'association', 'held', 'card', 'motion-owner', 'card-element', 'art-element', 'image-element', 'image-source']) {
    await openSettlementProbe(page);
    await page.evaluate(change => {
      const nativeGetAnimations = document.getAnimations.bind(document);
      const stage = document.querySelector('[data-gesture-window]');
      const layer = stage.querySelector('.gesture-focus-layer');
      const state = window.__gestureSettlementProbe = { scheduled: false, mutated: false, cancelled: 0 };
      document.getAnimations = (...args) => {
        if (!state.scheduled) {
          state.scheduled = true;
          const animation = layer.querySelector('.settlement-arrival').animate([{ opacity: .4 }, { opacity: 1 }], { duration: 120 });
          animation.addEventListener('cancel', () => { state.cancelled += 1; });
          requestAnimationFrame(() => {
            if (change === 'layer') layer.replaceWith(layer.cloneNode(true));
            if (change === 'association') stage.dataset.association = 'replacement-association';
            if (change === 'held') stage.dataset.held = 'false';
            if (change === 'card') layer.querySelector('[data-focus-card]').dataset.occurrenceId = 'replacement:0';
            if (change === 'motion-owner') layer.querySelector('[data-gesture-art]').dataset.gestureOwner = 'replacement:0';
            if (change === 'card-element') { const card = layer.querySelector('[data-focus-card]'); card.replaceWith(card.cloneNode(true)); }
            if (change === 'art-element') { const art = layer.querySelector('[data-gesture-art]'); art.replaceWith(art.cloneNode(true)); }
            if (change === 'image-element') { const image = layer.querySelector('img.gesture-art__image'); image.replaceWith(image.cloneNode(true)); }
            if (change === 'image-source') layer.querySelector('img.gesture-art__image').src = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%222%22%20height%3D%222%22%2F%3E';
            state.mutated = true;
          });
        }
        return nativeGetAnimations(...args);
      };
      state.restore = () => { document.getAnimations = nativeGetAnimations; };
    }, change);
    try {
      await expect(settleGestureFocusLayer(page), change).rejects.toThrow(/focus ownership changed while settling/);
      const actual = await page.evaluate(() => ({ mutated: window.__gestureSettlementProbe.mutated,
        cancelled: window.__gestureSettlementProbe.cancelled }));
      expect(actual.mutated, change).toBe(true);
      expect(actual.cancelled, 'settlement must leave native handles alone').toBe(0);
      observations.push({ change, ...actual });
    } finally {
      await page.evaluate(() => { window.__gestureSettlementProbe.restore(); });
    }
  }
  await testInfo.attach('replaced-focus-owner-settlement', { body: JSON.stringify(observations, null, 2), contentType: 'application/json' });
});

test('ten-card shelf retains every position without colliding labels', async ({ page }, testInfo) => {
  const { caseData, sourceBinding } = await loadArtworkMatrixReadingCase();
  const cards = caseData.cards.map(card => ({ card: card.card, orientation: card.orientation, position: card.position }));
  const expectedLabels = cards.map(card => card.position.split(' — ')[0].split(' (')[0].split(' / ')[0].trim());
  await page.addInitScript(value => {
    window.__cueTimingSink = { active: true, emit() {} };
    window.__cueQualificationCase = value;
  }, { id: caseData.id, raw: caseData.raw, cards, spreadKey: 'celtic', userQuestion: caseData.question, reflectionsText: caseData.reflections });
  const measurements = [];
  for (const size of [{ width: 1100, height: 1000 }, { width: 375, height: 667 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(size);
    await page.goto('/__e2e/reading-gestures?study=five-card&associations=dynamic&arrival=complete');
    await expect(page.getByTestId('gesture-source-diagnostics')).toHaveAttribute('data-qualification-case', caseData.id);
    const buttons = page.locator('[data-gesture-shelf] button');
    await expect(buttons).toHaveCount(10);
    const phrase = page.locator('.reading-gesture-association').first();
    await phrase.scrollIntoViewIfNeeded();
    await phrase.press('Enter');
    for (const textScale of [1, 2]) {
      await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale * 16}px`; }, textScale);
      await settleGestureFocusLayer(page);
      const measured = await page.evaluate(measureGestureFocusLayer);
      expect(measured.shelf.map(item => item.shortLabel), `positions at ${size.width}px/${textScale * 100}%`).toEqual(expectedLabels);
      for (const [index, item] of measured.shelf.entries()) {
        expect(item.ariaLabel).toBe(`${expectedLabels[index]}: ${cards[index].card}, ${cards[index].orientation.toLowerCase()}`);
        expect(item.buttonRect.width, `${item.shortLabel} touch width`).toBeGreaterThanOrEqual(44);
        expect(item.buttonRect.height, `${item.shortLabel} touch height`).toBeGreaterThanOrEqual(44);
        expect(item.textRects.length, `${item.shortLabel} painted label`).toBeGreaterThan(0);
        for (const rect of item.textRects) {
          expect(rect.left, `${item.shortLabel} text left`).toBeGreaterThanOrEqual(item.itemRect.left - .5);
          expect(rect.right, `${item.shortLabel} text right`).toBeLessThanOrEqual(item.itemRect.right + .5);
          expect(rect.top).toBeGreaterThanOrEqual(item.labelRect.top - .5);
          expect(rect.bottom).toBeLessThanOrEqual(item.labelRect.bottom + .5);
        }
      }
      await expectNoHorizontalOverflow(page);
      measurements.push({ size, textScale, shelf: measured.shelf, overflow: measured.overflow });
    }
    await buttons.first().focus();
    await buttons.first().evaluate(async button => {
      await Promise.allSettled(document.getAnimations().filter(animation => animation.effect?.target === button).map(animation => animation.finished));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const focusPaint = await buttons.first().evaluate(button => {
      const rect = element => { const r = element.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
      const style = getComputedStyle(button);
      return { button: rect(button), shelf: rect(button.closest('[data-gesture-shelf]')),
        outline: Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset),
        focusVisible: button.matches(':focus-visible') };
    });
    expect(focusPaint.focusVisible).toBe(true);
    expect(focusPaint.button.top - focusPaint.outline, 'first-card focus ring top').toBeGreaterThanOrEqual(focusPaint.shelf.top - .5);
    expect(focusPaint.button.left - focusPaint.outline, 'first-card focus ring left').toBeGreaterThanOrEqual(focusPaint.shelf.left - .5);
    measurements.push({ size, textScale: 2, focusPaint });
    for (let index = 1; index < cards.length; index += 1) {
      await page.keyboard.press('ArrowRight');
      await expect(buttons.nth(index)).toBeFocused();
    }
    await page.keyboard.press('Home');
    await expect(buttons.first()).toBeFocused();
    await page.keyboard.press('End');
    await expect(buttons.last()).toBeFocused();
    const image = testInfo.outputPath(`ten-card-shelf-${size.width}-200.png`);
    await page.locator('.gesture-companion').screenshot({ path: image });
    await testInfo.attach(`ten-card-shelf-${size.width}-200`, { path: image, contentType: 'image/png' });
  }
  await writeFile(testInfo.outputPath('ten-card-shelf.json'), `${JSON.stringify({ runtime: await runtimeIdentity(), sourceBinding, measurements }, null, 2)}\n`, { flag: 'wx' });
});

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

test('complete painted objects retain independently identified endpoints through actual compact resizing @mobile', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const targets = [
    { cardName: 'Ace of Cups', detailId: 'overflowing-cup' },
    { cardName: 'Three of Pentacles', detailId: 'collaborators' },
    { cardName: 'Eight of Wands', detailId: 'flying-staffs' },
    { cardName: 'Justice', detailId: 'upright-sword' },
    { cardName: 'Ace of Wands', detailId: 'sprout' },
    { cardName: 'Five of Wands', detailId: 'staffs' },
    { cardName: 'Knight of Swords', detailId: 'charging-horse' },
    { cardName: 'Knight of Wands', detailId: 'rearing-horse' },
    { cardName: 'Six of Wands', detailId: 'white-horse' },
    { cardName: 'Knight of Cups', detailId: 'white-horse' },
    { cardName: 'Two of Swords', detailId: 'crossed-swords' }
  ];
  const sizes = [{ width: 375, height: 812 }, { width: 320, height: 700 }, { width: 844, height: 390 }];
  const measurements = [];
  for (const target of targets) {
    for (const orientation of ['upright', 'reversed']) {
      await page.setViewportSize(sizes[0]);
      await page.goto(`/__e2e/reading-gestures?study=deck&card=${encodeURIComponent(target.cardName)}&orientation=${orientation}&arrival=complete`);
      await expect(page.getByTestId('reading-gestures-fixture')).toBeVisible();
      await expect(page.getByTestId('gesture-source-diagnostics')).toHaveAttribute('data-source-status', 'complete');
      await expect(page.locator('[data-gesture-window]')).toBeVisible();
      await expect(page.getByTestId('gesture-source-diagnostics')).toHaveAttribute('data-association-mode', 'dynamic');
      await expect(page.getByRole('combobox', { name: 'Card', exact: true })).toHaveValue(target.cardName);
      await expect(page.getByRole('combobox', { name: 'Orientation', exact: true })).toHaveValue(orientation);
      const gestureIds = await page.locator('.reading-gesture-association').evaluateAll(elements => [...new Set(elements.map(element => element.dataset.gestureId))]);
      let selectedGestureId = null;
      for (const gestureId of gestureIds) {
        const phrase = page.locator(`[data-gesture-id="${gestureId}"]`).first();
        await phrase.scrollIntoViewIfNeeded();
        await phrase.press('Enter');
        await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
        await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-association', gestureId);
        const details = ((await page.locator('.gesture-focus-layer:not(.gesture-focus-layer--departing) [data-focus-card]').first().getAttribute('data-details')) || '').split(' ').filter(Boolean);
        if (details.length === 1 && details[0] === target.detailId) {
          selectedGestureId = gestureId;
          break;
        }
        await page.keyboard.press('Escape');
      }
      expect(selectedGestureId, `authored single-detail association for ${target.cardName}/${target.detailId}`).not.toBeNull();
      await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
      // Preserve actual DOM, occurrence and source identity through each resize.
      const heldArtwork = await page.evaluateHandle(() => {
        const stage = document.querySelector('[data-gesture-window]');
        const layer = stage?.querySelector('.gesture-focus-layer:not(.gesture-focus-layer--departing)');
        if (!stage || !layer) throw new Error('Held artwork is missing before resizing');
        return { stage, layer, association: stage.dataset.association,
          cards: [...layer.querySelectorAll('[data-focus-card]')].map(element => ({ element,
            occurrenceId: element.dataset.occurrenceId, details: element.dataset.details })),
          arts: [...layer.querySelectorAll('[data-gesture-art]')].map(element => ({ element, owner: element.dataset.gestureOwner })),
          images: [...layer.querySelectorAll('img.gesture-art__image')].map(element => ({ element, source: element.getAttribute('src') })) };
      });
      const expectSameHeldArtwork = async () => {
        const unchanged = await heldArtwork.evaluate(owner => {
          const { stage, layer } = owner;
          const cards = [...layer.querySelectorAll('[data-focus-card]')];
          const arts = [...layer.querySelectorAll('[data-gesture-art]')];
          const images = [...layer.querySelectorAll('img.gesture-art__image')];
          return stage.isConnected && layer.isConnected && document.querySelector('[data-gesture-window]') === stage
            && stage.querySelector('.gesture-focus-layer:not(.gesture-focus-layer--departing)') === layer
            && stage.dataset.held === 'true' && stage.dataset.association === owner.association
            && cards.length === owner.cards.length && owner.cards.every((card, index) => cards[index] === card.element
              && card.element.dataset.occurrenceId === card.occurrenceId && card.element.dataset.details === card.details)
            && arts.length === owner.arts.length && owner.arts.every((art, index) => arts[index] === art.element
              && art.element.dataset.gestureOwner === art.owner)
            && images.length === owner.images.length && owner.images.every((image, index) => images[index] === image.element
              && image.element.getAttribute('src') === image.source);
        });
        expect(unchanged, 'original held stage, layer, occurrence, art owner and image source survive resizing').toBe(true);
      };
      // Resize the same held artwork, exercising the real ResizeObserver crop fit.
      try {
        await expectSameHeldArtwork();
        for (const size of sizes) {
          await page.setViewportSize(size);
          await expectSameHeldArtwork();
          // Rotation can retain a scroll position that leaves this 72px stage
          // partly outside the viewport. Position the actual held stage before
          // measuring; all original painted-object thresholds remain unchanged.
          await heldArtwork.evaluate(owner => owner.stage.scrollIntoView({
            block: 'center', inline: 'center', behavior: 'instant'
          }));
          await expectSameHeldArtwork();
          const settled = await settleGestureFocusLayer(page);
          await expectSameHeldArtwork();
          expect(settled.decoded.every(Boolean), `${target.cardName} decoded original`).toBe(true);
          const geometry = await page.evaluate(measureGestureFocusLayer);
          expect(geometry.window.association).toBe(selectedGestureId);
          expect(geometry.window.held).toBe(true);
          expect(geometry.window.rect.left).toBeGreaterThanOrEqual(0);
          expect(geometry.window.rect.top).toBeGreaterThanOrEqual(0);
          expect(geometry.window.rect.right).toBeLessThanOrEqual(size.width);
          expect(geometry.window.rect.bottom).toBeLessThanOrEqual(size.height);
          expect(geometry.cards).toHaveLength(1);
          expect(geometry.cards[0].details).toEqual([target.detailId]);
          expect(geometry.cards[0].arts).toHaveLength(1);
          const art = geometry.cards[0].arts[0];
          expect(art.orientation.halfTurns).toHaveLength(orientation === 'reversed' ? 1 : 0);
          expect(art.orientation.unexpected).toEqual([]);
          const endpoints = evaluatePaintedEndpoints({ art, cardName: target.cardName,
            detailIds: [target.detailId], orientation, compact: true });
          expect(endpoints, `${target.cardName}/${target.detailId} independent literal reference`).toHaveLength(1);
          expect(endpoints[0].detailId).toBe(target.detailId);
          expect(endpoints[0].checks.originalImageMatches).toBe(true);
          expect(endpoints[0].checks.orientationMatches).toBe(true);
          for (const point of [...endpoints[0].corners, ...endpoints[0].landmarks]) {
            const label = `${target.cardName}/${target.detailId}/${orientation}/${size.width}x${size.height}/${point.name}`;
            expect(point.visibleMargin, `${label} visible painted extent`).toBeGreaterThanOrEqual(-.2);
            expect(point.slotMargin, `${label} breathing room`).toBeGreaterThan(2.5);
          }
          expect(geometry.window.rect.height).toBe(size.height < 600 ? 72 : size.width < 359 ? 96 : 106);
          await expectNoHorizontalOverflow(page);
          measurements.push({ ...target, orientation, selectedGestureId, size, geometry, endpoints });
        }
      } finally {
        await heldArtwork.dispose();
      }
      await page.keyboard.press('Escape');
    }
  }
  expect(measurements).toHaveLength(66);
  await writeFile(testInfo.outputPath('complete-painted-object-resize.json'), `${JSON.stringify({
    scope: 'Eleven representative tall, wide, grouped-object, whole-horse and complete-sword repairs, both orientations, three real compact resizes; all 36 previous measurements retained plus 30 complete-object measurements. Node and artwork matrix cover all 29 independent references.',
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
