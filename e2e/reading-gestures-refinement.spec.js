import { test, expect } from '@playwright/test';
import { observeNarrativeUiHealth, createNarrativeFixture, startReading, expectNoHorizontalOverflow } from './helpers/narrativeFixtures.js';
import { createVisualCueLedger, applyVisualCueBatch } from '../shared/reading/visualCueLedger.js';
import { hashVisualCueText } from '../shared/contracts/visualCueBatches.js';
import { getVectorGestureDetails } from '../src/data/cardGestureArtwork.js';

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

const focusArt = page => page.locator('[data-gesture-window] .gesture-focus-layer:not(.gesture-focus-layer--departing) .gesture-art');
const backgroundParagraph = 'Take time to consider the question you brought. Notice what feels familiar and what invites a different response. A small practical step can leave room for both movement and reflection.';

async function expectStaticCompanion(page) {
  await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-phase', 'static');
  const motion = await page.locator('.gesture-companion').evaluate(element => ({
    reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    calm: element.getAttribute('data-calm'),
    running: element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').map(animation => {
      const target = animation.effect?.target, style = target && getComputedStyle(target);
      return { type: animation.constructor.name, target: target?.tagName, classes: target?.getAttribute('class'),
        calm: target?.closest('[data-calm]')?.getAttribute('data-calm'), name: animation.animationName,
        property: animation.transitionProperty, timing: animation.effect?.getTiming(), keyframes: animation.effect?.getKeyframes(),
        cssAnimation: style?.animation, cssTransition: style?.transition, currentTime: animation.currentTime };
    })
  }));
  expect(motion.running, JSON.stringify({ reduced: motion.reduced, calm: motion.calm })).toEqual([]);
}

async function waitForSettledQuoteLayout(page, sourceIds) {
  // Font readiness before a viewport/text-size change does not establish the
  // final reading layout. Wait for stable geometry before asserting exposure
  // or clipping; a stable clipped layout still reaches the strict assertions.
  await page.evaluate(async ids => {
    const geometry = () => {
      const sources = ids.map(id => document.querySelector(`[data-gesture-id="${id}"]`));
      const question = document.querySelector('.narrative-panel__column bdi');
      const header = document.querySelector('.header-sticky');
      const companion = document.querySelector('.gesture-companion');
      if (sources.some(source => !source) || !question || !header || !companion) return null;
      const font = element => {
        const style = getComputedStyle(element);
        return [style.fontSize, style.lineHeight, style.fontFamily, style.fontStyle, style.fontWeight];
      };
      const bounds = rect => [rect.left, rect.right, rect.top + scrollY, rect.bottom + scrollY];
      const lines = element => {
        const range = document.createRange(); range.selectNodeContents(element);
        return [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0).map(bounds);
      };
      const elementGeometry = (element, text = false) => element && ({
        bounds: bounds(element.getBoundingClientRect()), width: element.clientWidth, font: font(element),
        ...(text ? { lines: lines(element) } : {})
      });
      const sourceGeometry = sources.map(source => ({
        ...elementGeometry(source, true), paragraph: elementGeometry(source.closest('p'), true)
      }));
      const questionGeometry = elementGeometry(question, true);
      const companionStyle = getComputedStyle(companion);
      const dock = document.querySelector('.mobile-action-bar');
      const signature = JSON.stringify({
        sources: sourceGeometry, question: questionGeometry, header: elementGeometry(header, true),
        containers: [...document.querySelectorAll('main, .narrative-panel, .narrative-panel__layout, .narrative-panel__column, .narrative-stream')].map(element => elementGeometry(element)),
        companion: { ...elementGeometry(companion), top: companionStyle.top, position: companionStyle.position },
        context: elementGeometry(document.querySelector('.gesture-context'), true),
        dock: dock && { ...elementGeometry(dock), position: getComputedStyle(dock).position },
        viewport: [innerWidth, innerHeight, visualViewport?.width, visualViewport?.height, visualViewport?.offsetTop, visualViewport?.scale],
        media: [matchMedia('(max-width: 768px), ((hover: none) and (pointer: coarse) and (max-height: 960px))').matches,
          matchMedia('(prefers-reduced-motion: reduce)').matches],
        reservation: document.documentElement.style.getPropertyValue('--mobile-action-bar-height')
      });
      return document.fonts.status === 'loaded' && sourceGeometry.every(source => source.lines.length > 0)
        && questionGeometry.lines.length > 0 ? signature : null;
    };
    geometry(); // Force the current resized typography before fonts.ready.
    await document.fonts.ready;
    let previous = null, stableFrames = 0;
    while (stableFrames < 3) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const current = geometry();
      stableFrames = current && current === previous ? stableFrames + 1 : current ? 1 : 0;
      previous = current;
    }
  }, sourceIds);
}

async function controlledQuote(page, { quote, question, context = false, queued = false }) {
  const readingViewport = page.viewportSize();
  const meaning = 'This detail can leave room for your question.';
  const nextMeaning = 'Another view can make this detail useful.';
  const raw = `## Your reading\n\n${Array(6).fill(backgroundParagraph).join('\n\n')}\n\n${quote}\n\n${meaning}${queued ? ` ${nextMeaning}` : ''}\n\n${Array(6).fill(backgroundParagraph).join('\n\n')}`;
  const binding = { readingResultId: `controlled-quote-${context ? 'context' : 'source'}`, sourceRevision: 0,
    spreadHash: 'a'.repeat(64), contextHash: 'b'.repeat(64), artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'quote-test-v1' };
  const fixture = await createNarrativeFixture(page, { narrative: raw, question, sourceUsage: null, signedOut: true,
    startData: { readingResultId: binding.readingResultId, visualBinding: binding, visualJobToken: 'controlled-quote' } });
  try {
    // Wide touch setup puts the question on another step. Use the same usable
    // portrait setup before restoring the actual reading acceptance viewport.
    await page.setViewportSize({ width: 375, height: 844 });
    await startReading(page, fixture);
    if (readingViewport) await page.setViewportSize(readingViewport);
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; scrollTo({ top: 0, behavior: 'instant' }); });
    const cards = fixture.requests.reading[0].cardsInfo.map((card, index) => ({ index,
      canonicalName: card.canonicalName || card.card || card.name, artworkEdition: binding.artworkEdition }));
    const detail = getVectorGestureDetails(cards[0].canonicalName)[0];
    const targets = [{ spreadIndex: 0, detailIds: [detail.id] }];
    const result = await applyVisualCueBatch({ ledger: createVisualCueLedger(binding), authoritativeRaw: raw,
      issuedRequest: { binding, batchId: 'quote', requestSequence: 1, status: 'active',
        analyzedEnd: raw.length, analyzedHash: await hashVisualCueText(raw), baseLedgerRevision: 0 },
      response: { proposals: [{ localAlias: 'literal', kind: 'literal', quote, targets }, ...(context ? [{
        localAlias: 'meaning', kind: 'interpretation', quote: meaning, targets, establishedBy: [{ localAlias: 'literal' }],
        personalContext: { type: 'question', quote: question }
      }, ...(queued ? [{ localAlias: 'next-meaning', kind: 'interpretation', quote: nextMeaning, targets,
        establishedBy: [{ localAlias: 'literal' }], personalContext: { type: 'question', quote: 'End of my question.' } }] : [])] : [])] },
      validationContext: { cards, userQuestion: fixture.question, getSupportedDetails: name => getVectorGestureDetails(name).map(item => item.id) } });
    expect(result.rejected).toEqual([]);
    if (context) expect(result.ledger.cues.find(cue => cue.passage.quote === meaning).personalContext)
      .toEqual({ type: 'question', quote: question });
    await fixture.emit('visual', 'cues', { binding, status: 'complete', cueLedger: result.ledger });
    return { fixture, raw, cue: queued ? result.ledger.cues.find(cue => cue.passage.quote === meaning) : result.ledger.cues.at(-1),
      nextCue: queued ? result.ledger.cues.at(-1) : null };
  } catch (error) { await fixture.close(); throw error; }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
});

test('held and reduced-motion details remain distinguishable on bright artwork', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/__e2e/reading-gestures?associations=dynamic&arrival=complete');
  await page.locator('[data-gesture-id]').filter({ hasText: /^pool$/ }).click();
  const art = focusArt(page);
  await expect(art).toHaveAttribute('data-held', 'true');
  await expect(art.locator('.gesture-art__image')).toHaveCSS('opacity', '1');
  const illuminated = await art.screenshot();
  await art.locator('.gesture-art__light').evaluate(element => { element.style.visibility = 'hidden'; });
  const unaccompanied = await art.screenshot();
  // Compare rendered pixels, rather than accepting a present but invisible mask.
  const difference = await page.evaluate(async ([first, second]) => {
    const pixels = async base64 => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return context.getImageData(0, 0, image.width, image.height).data;
    };
    const [a, b] = await Promise.all([pixels(first), pixels(second)]);
    const width = Math.round(Math.sqrt(a.length / 4 * 3 / 5));
    const height = a.length / 4 / width;
    const region = (x, y, radius = 3) => {
      const samples = [];
      for (let row = Math.round(y * height) - radius; row <= Math.round(y * height) + radius; row++) {
        for (let column = Math.round(x * width) - radius; column <= Math.round(x * width) + radius; column++) {
          const index = (row * width + column) * 4;
          samples.push((b[index] + b[index + 1] + b[index + 2] - a[index] - a[index + 1] - a[index + 2]) / 3);
        }
      }
      return samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
    };
    return { mean: a.reduce((sum, value, index) => sum + Math.abs(value - b[index]), 0) / a.length,
      surroundDarkening: region(.8, .2), detailDarkening: region(.275, .70) };
  }, [illuminated.toString('base64'), unaccompanied.toString('base64')]);
  // The described pool stays bright while unrelated sky recedes visibly.
  // A whole-image delta alone could pass with a barely perceptible haze.
  expect(difference.mean).toBeGreaterThan(5);
  expect(difference.surroundDarkening).toBeGreaterThan(20);
  expect(Math.abs(difference.detailDarkening)).toBeLessThan(8);
  expect(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0);
});

test('phone targets stay usable and both planted swords fit the return frame @mobile', async ({ page }) => {
  for (const height of [667, 568]) {
    await page.setViewportSize({ width: 375, height });
    await page.goto('/__e2e/reading-gestures?associations=authored&study=five-card&arrival=complete');
    await expect(page.locator('[data-gesture-shelf] button:enabled')).toHaveCount(5);
    for (const button of await page.locator('[data-gesture-shelf] button').all()) {
      const target = await button.boundingBox();
      const artwork = await button.locator('.gesture-art').boundingBox();
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.height).toBeGreaterThanOrEqual(44);
      expect(artwork.width).toBe(height < 600 ? 29 : 40);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await page.locator('[data-gesture-id]').filter({ hasText: 'Write down the two missing swords' }).click();
    await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
    await expect(focusArt(page).locator('[data-reversed]')).toHaveAttribute('data-reversed', 'true');
    const visibleSwords = await page.locator('[data-gesture-window]').evaluate(window => {
      const frame = window.getBoundingClientRect();
      return [...window.querySelectorAll('.gesture-focus-layer:not(.gesture-focus-layer--departing) .gesture-art__trace')].map(path => {
        const bounds = path.getBBox();
        const transform = path.getScreenCTM();
        return [new DOMPoint(bounds.x, bounds.y), new DOMPoint(bounds.x + bounds.width, bounds.y + bounds.height)]
          .map(point => point.matrixTransform(transform))
          .every(point => point.x >= frame.left && point.x <= frame.right && point.y >= frame.top && point.y <= frame.bottom);
      });
    });
    expect(visibleSwords).toEqual([true, true]);
  }
});

test('card names remain prose while the shelf and meaningful details stay keyboard accessible', async ({ page }) => {
  await page.goto('/__e2e/reading-gestures?associations=dynamic&study=five-card&arrival=complete');
  const identities = page.locator('.reading-gesture-identity');
  await expect(identities.first()).toBeVisible();
  expect(await identities.count()).toBeGreaterThan(5);
  for (const identity of await identities.all()) {
    await expect(identity).not.toHaveAttribute('role', 'button');
    await expect(identity).not.toHaveAttribute('tabindex', '0');
    await expect(identity).toHaveCSS('text-decoration-line', 'none');
  }
  const shelf = page.locator('[data-gesture-shelf] button').first();
  await shelf.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
  await expect(page.locator('.gesture-focus-layer:not(.gesture-focus-layer--departing) [data-focus-card]')).toHaveAttribute('data-details', '');
  const detail = page.locator('[data-gesture-id][role="button"]').filter({ hasText: /sprouting leaves/ }).first();
  await detail.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.gesture-focus-layer:not(.gesture-focus-layer--departing) [data-focus-card]')).toHaveAttribute('data-details', 'sprout');
});

test('short phone frames retain the Emperor scepter and Justice scale extents @mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [name, phrase] of [['The Emperor', 'scepter'], ['Justice', 'scales']]) {
    await page.goto(`/__e2e/reading-gestures?study=deck&card=${encodeURIComponent(name)}&arrival=complete`);
    await page.locator('[data-gesture-id][role="button"]').filter({ hasText: phrase }).click();
    const bounds = await focusArt(page).evaluate(art => {
      const frame = art.getBoundingClientRect();
      const spot = art.querySelector('mask ellipse');
      const transform = art.querySelector('.gesture-art__light').getScreenCTM();
      const y = Number(spot.getAttribute('cy')), radius = Number(spot.getAttribute('ry'));
      return [y - radius, y + radius].map(y => new DOMPoint(Number(spot.getAttribute('cx')), y).matrixTransform(transform).y)
        .every(y => y >= frame.top && y <= frame.bottom);
    });
    expect(bounds).toBe(true);
    await expect(page.locator('[data-gesture-window]')).toHaveCSS('height', '72px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  }
});

for (const size of [{ width: 375, height: 568 }, { width: 844, height: 390 }]) {
  test(`an oversized source quotation at doubled text size waits for a full exposed line and remains manually readable (${size.width}x${size.height}) @mobile`, async ({ page }, testInfo) => {
    test.setTimeout(60000);
    await page.setViewportSize(size);
    const quote = `A painted detail invites a closer look. ${Array(6).fill(backgroundParagraph).join(' ')}`;
    const { fixture, raw, cue } = await controlledQuote(page, { quote });
    try {
      const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
      const readingBar = page.locator('.mobile-action-bar');
      // A resized desktop profile has no handset dock above 768px. Touch-first
      // phone profiles retain their dock in landscape and must give prose room.
      if (size.width <= 768 || testInfo.project.use.hasTouch) {
        await expect(readingBar).toHaveAttribute('data-reading-flow', 'true');
        await expect(readingBar).toHaveCSS('position', 'static');
      } else {
        await expect(readingBar).toHaveCount(0);
      }
      const phrase = page.locator(`[data-gesture-id="${cue.id}"]`);
      await expect(phrase).toBeAttached();
      const alignFirstSourceLine = async partial => {
        await expect.poll(() => phrase.evaluate(async (element, partialOnly) => {
          const sourceRects = () => {
            const range = document.createRange(); range.selectNodeContents(element);
            return [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
          };
          const readableBounds = () => {
            const companion = document.querySelector('.gesture-companion').getBoundingClientRect();
            const header = document.querySelector('.header-sticky')?.getBoundingClientRect();
            const dock = document.querySelector('.mobile-action-bar'), dockRect = dock?.getBoundingClientRect();
            return { top: Math.max(0, companion.bottom, header?.top <= 1 ? header.bottom : 0),
              bottom: dock && getComputedStyle(dock).position === 'fixed' && dockRect.height > 0 && dockRect.top < innerHeight
                ? Math.max(0, dockRect.top) : innerHeight };
          };
          const first = sourceRects()[0];
          if (!first) return false;
          const bottom = readableBounds().bottom;
          const distance = partialOnly ? first.top - bottom + 2 : first.bottom - bottom + 6;
          if (Math.abs(distance) > 1) scrollBy({ top: distance, behavior: 'instant' });
          // Sticky header resizing can move prose after the initial scroll.
          // Check the current source geometry after those layout frames.
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          const rects = sourceRects(), current = rects[0], bounds = readableBounds();
          if (!current) return false;
          const fullyInside = rect => rect.left >= 0 && rect.right <= innerWidth
            && rect.top >= bounds.top && rect.bottom <= bounds.bottom;
          if (partialOnly) {
            return current.top >= bounds.bottom - 3 && current.top < bounds.bottom
              && current.bottom > bounds.bottom && !rects.some(fullyInside);
          }
          const hit = document.elementFromPoint((current.left + current.right) / 2, (current.top + current.bottom) / 2);
          return fullyInside(current) && Boolean(hit && (element.contains(hit) || hit.contains(element)));
        }, partial)).toBe(true);
      };
      await alignFirstSourceLine(true);
      const geometry = await phrase.evaluate(element => {
        const range = document.createRange(); range.selectNodeContents(element);
        const rects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
        const companion = document.querySelector('.gesture-companion').getBoundingClientRect();
        return { top: rects[0].top, bottom: rects[0].bottom, firstLineHeight: rects[0].height,
          height: Math.max(...rects.map(rect => rect.bottom)) - Math.min(...rects.map(rect => rect.top)),
          readableHeight: innerHeight - companion.bottom, viewportHeight: innerHeight };
      });
      expect(geometry.height).toBeGreaterThan(geometry.readableHeight);
      expect(geometry.top).toBeLessThan(geometry.viewportHeight);
      expect(geometry.bottom).toBeGreaterThan(geometry.viewportHeight);
      await page.waitForTimeout(250);
      await expect(page.locator('[data-gesture-window]')).not.toHaveAttribute('data-association', cue.id);
      await alignFirstSourceLine(false);
      await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-association', cue.id);
      await expect(page.locator('[data-gesture-window]')).not.toHaveAttribute('data-held', 'true');
      if (reduced) await expectStaticCompanion(page);
      await expect(phrase).toHaveText(quote);
      await phrase.press('Enter');
      await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
      await page.evaluate(() => scrollBy({ top: 1000, behavior: 'instant' }));
      await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-association', cue.id);
      await expect(phrase).toHaveText(quote);
      expect(await page.locator('.narrative-stream__text').innerText()).toContain(raw.split('\n\n').at(-1));
      await expectNoHorizontalOverflow(page);
      const screenshot = testInfo.outputPath('oversized-source-quotation.png');
      await page.screenshot({ path: screenshot });
      await testInfo.attach('oversized-source-quotation', { path: screenshot, contentType: 'image/png' });
      const opener = page.getByRole('button', { name: 'Open visual studio', exact: true });
      await opener.press('Enter');
      const studio = page.getByRole('dialog', { name: 'Visual Companion Studio', exact: true });
      await expect(studio).toBeVisible();
      const caption = studio.locator('#visual-companion-modal-description');
      await expect(caption).toHaveText('Generate artwork that stays anchored to this reading.');
      const captionBounds = await caption.evaluate(element => {
        const rect = element.getBoundingClientRect(), dialog = element.closest('[role="dialog"]').getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: element.clientWidth, scrollWidth: element.scrollWidth,
          dialogLeft: dialog.left, dialogRight: dialog.right, viewportWidth: innerWidth };
      });
      expect(captionBounds.scrollWidth).toBeLessThanOrEqual(captionBounds.width + 1);
      expect(captionBounds.left).toBeGreaterThanOrEqual(Math.max(0, captionBounds.dialogLeft));
      expect(captionBounds.right).toBeLessThanOrEqual(Math.min(captionBounds.viewportWidth, captionBounds.dialogRight));
      await expectNoHorizontalOverflow(page);
      const headerScreenshot = testInfo.outputPath('visual-studio-doubled-text-header.png');
      await page.screenshot({ path: headerScreenshot });
      await testInfo.attach('visual-studio-doubled-text-header', { path: headerScreenshot, contentType: 'image/png' });
      const studioContent = studio.getByRole('region', { name: 'Visual companion studio content', exact: true });
      const studioAction = studio.getByRole('button', { name: 'Upgrade to Plus', exact: true });
      await expect(studioAction).toBeAttached();
      await studioContent.focus();
      await expect(studioContent).toBeFocused();
      await page.keyboard.press('End');
      await expect.poll(() => studioContent.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      await studioAction.focus();
      await studioAction.scrollIntoViewIfNeeded();
      await expect(studioAction).toBeFocused();
      await expect(studioAction).toBeEnabled();
      await expect.poll(() => studioAction.evaluate(element => {
        const rect = element.getBoundingClientRect(), clip = element.closest('[role="region"]').getBoundingClientRect();
        const range = document.createRange(); range.selectNodeContents(element);
        const text = [...range.getClientRects()].filter(line => line.width > 0 && line.height > 0);
        const exposed = bounds => bounds.left >= Math.max(0, clip.left) && bounds.right <= Math.min(innerWidth, clip.right)
          && bounds.top >= Math.max(0, clip.top) && bounds.bottom <= Math.min(innerHeight, clip.bottom);
        const hit = document.elementFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
        return { targetExposed: exposed(rect), labelExposed: text.length > 0 && text.every(exposed),
          hit: Boolean(hit && element.contains(hit)) };
      })).toEqual({ targetExposed: true, labelExposed: true, hit: true });
      const studioClose = studio.getByRole('button', { name: 'Close visual companion studio', exact: true });
      await expect.poll(() => studioClose.evaluate(element => {
        const rect = element.getBoundingClientRect(), hit = document.elementFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
        return rect.width >= 44 && rect.height >= 44 && rect.left >= 0 && rect.right <= innerWidth
          && rect.top >= 0 && rect.bottom <= innerHeight && Boolean(hit && element.contains(hit));
      })).toBe(true);
      await expectNoHorizontalOverflow(page);
      const modalScreenshot = testInfo.outputPath('visual-studio-doubled-text.png');
      await page.screenshot({ path: modalScreenshot });
      await testInfo.attach('visual-studio-doubled-text', { path: modalScreenshot, contentType: 'image/png' });
      await studioClose.click();
      await expect(studio).not.toBeVisible();
      await expect(opener).toBeFocused();
      await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-association', cue.id);
      await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
      await page.evaluate(() => { document.documentElement.style.fontSize = '100%'; });
      await page.setViewportSize({ width: 375, height: 844 });
      await expect(readingBar).not.toHaveAttribute('data-reading-flow', 'true');
      await expect(readingBar).toHaveCSS('position', 'fixed');
    } finally { await fixture.close(); }
  });
}

test('long personal quotations remain fully accessible in a bounded sticky companion at doubled text size @mobile', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 844, height: 390 });
  const question = `How can I make room for this change? ${Array(4).fill(backgroundParagraph).join(' ')} End of my question.`;
  const { fixture, cue } = await controlledQuote(page, { quote: 'A painted detail invites a closer look.', question, context: true });
  try {
    const phrase = page.locator(`[data-gesture-id="${cue.id}"]`);
    await phrase.scrollIntoViewIfNeeded();
    await phrase.press('Enter');
    const context = page.getByRole('region', { name: 'Related personal context' });
    await expect(context).toHaveText(`“${question}”`);
    await expect(context).toHaveCSS('font-size', '24px');
    for (const size of [{ width: 844, height: 390 }, { width: 375, height: 568 }]) {
      await page.setViewportSize(size);
      await waitForSettledQuoteLayout(page, [cue.id]);
      const dimensions = await context.evaluate(element => ({ height: element.clientHeight, contentHeight: element.scrollHeight }));
      expect(dimensions.height).toBeLessThanOrEqual(size.height * .2 + 1);
      expect(dimensions.contentHeight).toBeGreaterThan(dimensions.height);
      await context.focus();
      await expect(context).toBeFocused();
      await page.keyboard.press('End');
      await expect.poll(() => context.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      await expect(context).toHaveText(`“${question}”`);
      await expectNoHorizontalOverflow(page);
    }
    const screenshot = testInfo.outputPath('long-personal-quotation.png');
    await page.screenshot({ path: screenshot });
    await testInfo.attach('long-personal-quotation', { path: screenshot, contentType: 'image/png' });
  } finally { await fixture.close(); }
});

test('keyboard inspection of an automatic personal quotation pauses queued turns without a card hold @mobile', async ({ page }, testInfo) => {
  test.setTimeout(60000);
  // At 200% text this focus test needs room for both complete source quotes
  // below the sticky context. Short screens are covered separately.
  await page.setViewportSize({ width: 844, height: 1400 });
  const question = `How can I make room for this change? ${Array(4).fill(backgroundParagraph).join(' ')} End of my question.`;
  const { fixture, cue, nextCue } = await controlledQuote(page, { quote: 'A painted detail invites a closer look.', question, context: true, queued: true });
  try {
    const reduced = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
    const next = page.locator(`[data-gesture-id="${nextCue.id}"]`);
    const exposeSources = async sourceIds => {
      await expect.poll(() => page.evaluate(async ids => {
        const sources = ids.map(id => document.querySelector(`[data-gesture-id="${id}"]`));
        const sourceRects = source => {
          const range = document.createRange(); range.selectNodeContents(source);
          return [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
        };
        const readableBottom = () => {
          const dock = document.querySelector('.mobile-action-bar'), rect = dock?.getBoundingClientRect();
          return dock && getComputedStyle(dock).position === 'fixed' && rect.height > 0 && rect.top < innerHeight
            ? Math.max(0, rect.top) : innerHeight;
        };
        if (sources.some(source => !source)) return ids.map(() => false);
        const rects = sources.flatMap(sourceRects);
        if (!rects.length) return ids.map(() => false);
        const distance = Math.max(...rects.map(rect => rect.bottom)) - readableBottom() + 20;
        if (Math.abs(distance) > 1) scrollBy({ top: distance, behavior: 'instant' });
        // Let resized sticky geometry and native focus scrolling settle before
        // requiring every line to be exposed and hit its actual source.
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const companion = document.querySelector('.gesture-companion').getBoundingClientRect();
        const header = document.querySelector('.header-sticky')?.getBoundingClientRect();
        const top = Math.max(0, companion.bottom, header?.top <= 1 ? header.bottom : 0);
        const bottom = readableBottom();
        return sources.map(source => {
          const lines = sourceRects(source);
          return lines.length > 0 && lines.every(rect => {
            const hit = document.elementFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
            return rect.left >= 0 && rect.right <= innerWidth && rect.top >= top && rect.bottom <= bottom
              && Boolean(hit && (source.contains(hit) || hit.contains(source)));
          });
        });
      }, sourceIds)).toEqual(sourceIds.map(() => true));
    };
    await expect(next).toBeAttached();
    // This wide, tall viewport leaves handset layout. Await its actual dock
    // teardown before aligning quotes against the final reading geometry.
    await expect(page.locator('.mobile-action-bar')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--mobile-action-bar-height'))).toBe('0px');
    const literalId = await page.locator('[data-gesture-id]').filter({ hasText: /^A painted detail invites a closer look\.$/ }).getAttribute('data-gesture-id');
    await waitForSettledQuoteLayout(page, [literalId, cue.id, nextCue.id]);
    await exposeSources([literalId, cue.id, nextCue.id]);
    const stage = page.locator('[data-gesture-window]');
    await expect(stage).toHaveAttribute('data-association', cue.id, { timeout: 10000 });
    const context = page.getByRole('region', { name: 'Related personal context' });
    // Tab across the artwork/context boundary without activating either card.
    await page.locator('.gesture-focus-layer:not(.gesture-focus-layer--departing) [data-focus-card]').focus();
    await page.keyboard.press('Tab');
    await expect(context).toBeFocused();
    await expect(context).toHaveText(`“${question}”`);
    await expect(stage).not.toHaveAttribute('data-held', 'true');
    // The newly rendered context grows the sticky companion and moves the
    // source paragraph. Keep inspection active while exposing both real quotes.
    await exposeSources([cue.id, nextCue.id]);
    await expect(stage).toHaveAttribute('data-association', cue.id);
    await expect(stage).toHaveAttribute('data-pending', nextCue.id);
    if (reduced) await expectStaticCompanion(page);
    await page.keyboard.press('End');
    await page.waitForTimeout(2100);
    await expect(stage).toHaveAttribute('data-association', cue.id);
    await expect(context).toBeFocused();
    await expect(context).toHaveText(`“${question}”`);
    if (reduced) await expectStaticCompanion(page);
    const screenshot = testInfo.outputPath('automatic-personal-context-inspection.png');
    await page.screenshot({ path: screenshot });
    await testInfo.attach('automatic-personal-context-inspection', { path: screenshot, contentType: 'image/png' });
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Focus on narrative', exact: true })).toBeFocused();
    await expect(context).not.toBeFocused();
    await expect(page.locator('.gesture-companion:focus-within')).toHaveCount(0);
    // Native Tab scrolling may leave the quoted prose above/below the viewport.
    // Resume only after both real source quotes are visible again.
    await exposeSources([cue.id, nextCue.id]);
    await expect(stage).toHaveAttribute('data-association', nextCue.id, { timeout: 6000 });
    await expect(context).toHaveText('“End of my question.”');
    await expect(stage).not.toHaveAttribute('data-held', 'true');
    if (reduced) await expectStaticCompanion(page);
  } finally { await fixture.close(); }
});
