import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
import { createNarrativeFixture, startReading, settleReadingLayout } from './helpers/narrativeFixtures.js';

// Keep native touch assertions valid when selected through the default runner.
test.use({ viewport: { width: 402, height: 724 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

const DRAW_TIME = 1790500049291;

async function readingFixture(page, options = {}) {
  const { spreadName, drawTime = DRAW_TIME, ...fixtureOptions } = options;
  await page.clock.setFixedTime(drawTime);
  const fixture = await createNarrativeFixture(page, fixtureOptions);
  await startReading(page, fixture, { complete: false, spreadName });
  await expect.poll(() => fixture.requests.reading.length).toBe(1);
  const cards = fixture.requests.reading[0].cardsInfo;
  const fullText = [
    '## Opening', '', `${cards.map(card => card.card).join(', ')} offer a useful moment to pause.`, '',
    ...(cards.length > 3 ? ['## A shared pattern', '', `${cards[0].card} and ${cards[1].card} invite you to notice a practical choice together.`, ''] : []),
    ...cards.flatMap(card => [`## ${card.position}: ${card.card}`, '', `${card.card} invites you to notice one practical choice.`, '']),
    '## Next steps', '', 'Choose one manageable step and make room to rest.'
  ].join('\n');
  await fixture.emit('reading', 'done', { fullText, requestId: 'card-inspection', provider: 'fixture' });
  await expect(page.getByText('Narrative ready.', { exact: true })).toBeAttached();
  await expect(page.locator('.narrative-stream')).toContainText('make room to rest');
  await settleReadingLayout(page);
  await page.clock.setSystemTime(Date.now());
  return { fixture, cards };
}

function inspector(page) {
  return page.getByRole('dialog').filter({ has: page.locator('[data-reading-full-artwork]') });
}

async function openFirstCard(page) {
  const opener = page.locator('.narrative-stream [data-spread-index="0"] button').first();
  await opener.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await settleReadingLayout(page);
  const scrollBeforeOpen = await page.evaluate(() => scrollY);
  const stylesBeforeOpen = await bodyStyles(page);
  await opener.click();
  const dialog = inspector(page);
  await expect(dialog).toBeVisible();
  return { opener, dialog, scrollBeforeOpen, stylesBeforeOpen };
}

async function paintedOpacity(locator) {
  return locator.evaluate(element => {
    let opacity = 1;
    for (let node = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    return opacity;
  });
}

async function openSymbols(page, dialog) {
  await dialog.getByRole('button', { name: /^Symbols$/i }).click();
  // Keep the dismissal regression valid during RED against the legacy nested
  // sheet and after the repair replaces it with one inline disclosure.
  const legacyTrigger = dialog.getByRole('button', { name: /^Card symbols$/i });
  if (await legacyTrigger.count()) await legacyTrigger.click();
}

async function bodyStyles(page) {
  return page.locator('body').evaluate(element => Object.fromEntries(
    ['position', 'overflow', 'top', 'left', 'right', 'width', 'paddingRight'].map(key => [key, element.style[key]])
  ));
}

async function expectPainted(panel) {
  // The 240ms entrance must finish before sampling. Visibility assertions do
  // not detect an otherwise actionable dialog whose computed opacity is zero.
  await panel.evaluate(() => new Promise(resolve => setTimeout(resolve, 400)));
  await expect.poll(() => paintedOpacity(panel)).toBeGreaterThanOrEqual(0.99);
  expect(await panel.evaluate(element => element.getAnimations().filter(animation => animation.playState === 'paused').length)).toBe(0);
}

async function expectOnscreenControl(locator) {
  const geometry = await locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    return {
      width: rect.width, height: rect.height,
      onscreen: x >= 0 && x < innerWidth && y >= 0 && y < innerHeight,
      foreground: element.contains(document.elementFromPoint(x, y))
    };
  });
  expect(geometry.onscreen).toBe(true);
  expect(geometry.foreground).toBe(true);
  expect(geometry.width).toBeGreaterThanOrEqual(44);
  expect(geometry.height).toBeGreaterThanOrEqual(44);
}

test('@P1 browsing keeps the inspector painted after Next and Previous', async ({ page }) => {
  const { fixture, cards } = await readingFixture(page);
  try {
    const { dialog } = await openFirstCard(page);
    const panel = dialog.getByRole('document');
    await expectPainted(panel);
    await dialog.getByRole('button', { name: 'Next card', exact: true }).click();
    await expect(dialog.getByRole('heading', { level: 2 })).toContainText(cards[1].card);
    await expectPainted(panel);
    await expect.poll(() => paintedOpacity(panel), { message: 'The next card text must remain visibly painted.' }).toBeGreaterThanOrEqual(0.99);
    await dialog.getByRole('button', { name: 'Previous card', exact: true }).click();
    await expect(dialog.getByRole('heading', { level: 2 })).toContainText(cards[0].card);
    await expectPainted(panel);
    await expect.poll(() => paintedOpacity(panel), { message: 'The previous card text must remain visibly painted.' }).toBeGreaterThanOrEqual(0.99);
  } finally { await fixture.close(); }
});

for (const dismissal of ['Escape', 'history Back', 'return button', 'backdrop']) {
  test(`@P1 Symbols then ${dismissal} releases body scrolling and the original reference`, async ({ page }, testInfo) => {
    const { fixture } = await readingFixture(page);
    try {
      const { opener, dialog, scrollBeforeOpen, stylesBeforeOpen } = await openFirstCard(page);
      const lockedTop = await page.locator('body').evaluate(element => element.style.top);
      // Clicking may scroll the reference a few pixels to its actionable center.
      // Restore the position actually locked when the dialog opened.
      const lockedScroll = -Number.parseFloat(lockedTop);
      await openSymbols(page, dialog);
      if (dismissal === 'Escape') await page.keyboard.press('Escape');
      else if (dismissal === 'history Back') await page.evaluate(() => history.back());
      else if (dismissal === 'backdrop') await page.mouse.click(1, 1);
      else await dialog.getByRole('button', { name: 'Back to reading', exact: true }).click();
      await expect(page.getByRole('dialog').filter({ visible: true })).toHaveCount(0);
      await expect.poll(() => bodyStyles(page), { message: 'Dismissal must release every body scroll lock.' }).toEqual(stylesBeforeOpen);
      await expect(opener).toBeFocused();
      const evidencePath = testInfo.outputPath('scroll-restoration.json');
      await writeFile(evidencePath, JSON.stringify({ before: scrollBeforeOpen, lockedTop, lockedScroll,
        after: await page.evaluate(() => scrollY), styles: await bodyStyles(page) }, null, 2));
      await testInfo.attach('scroll-restoration', { path: evidencePath, contentType: 'application/json' });
      await expect.poll(async () => Math.abs(await page.evaluate(() => scrollY) - lockedScroll)).toBeLessThanOrEqual(8);
      await page.evaluate(() => scrollBy(0, 80));
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(lockedScroll + 40);
    } finally { await fixture.close(); }
  });
}

test('@references a caption tap opens its card with one native keyboard stop', async ({ page }) => {
  const { fixture, cards } = await readingFixture(page);
  try {
    const figure = page.locator('.narrative-stream [data-spread-index="0"]').first();
    const caption = figure.locator('figcaption');
    await caption.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    // The native button's stretched hit area intentionally owns the caption's
    // coordinates, so exercise the tap instead of requiring figcaption itself
    // to receive the pointer event.
    const captionBox = await caption.boundingBox();
    await page.touchscreen.tap(captionBox.x + captionBox.width / 2, captionBox.y + captionBox.height / 2);
    await expect(inspector(page)).toBeVisible();
    await expect(inspector(page).getByRole('heading', { level: 2 })).toContainText(cards[0].card);
    await page.keyboard.press('Escape');
    await expect(figure.locator('button')).toBeFocused();
    await expect(figure.locator('button, [tabindex="0"], [role="button"]')).toHaveCount(1);
    await figure.locator('button').press('Enter');
    await expect(inspector(page)).toBeVisible();
  } finally { await fixture.close(); }
});

test('@references narrow chapter references preserve readable words', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 724 });
  const { fixture } = await readingFixture(page, { spreadName: 'Celtic Cross' });
  try {
    const figures = page.locator('.reading-chapter__cards .reading-card');
    await expect(figures.first()).toBeAttached();
    for (const width of [320, 360, 402, 430]) {
      await page.setViewportSize({ width, height: 724 });
      const names = await figures.locator('.reading-card__name').evaluateAll(elements => elements.map(element => {
      const parent = element.closest('.reading-chapter__cards');
      const text = element.firstChild;
      const splitWords = text?.nodeType === Node.TEXT_NODE ? [...text.textContent.matchAll(/\S+/g)].filter(match => {
        const range = document.createRange();
        range.setStart(text, match.index);
        range.setEnd(text, match.index + match[0].length);
        return range.getClientRects().length > 1;
      }).map(match => match[0]) : [];
      return {
        name: element.textContent,
        font: Number.parseFloat(getComputedStyle(element).fontSize),
        width: element.closest('figure').getBoundingClientRect().width,
        available: parent.getBoundingClientRect().width,
        splitWords,
        clipped: element.scrollWidth > element.clientWidth + 1
      };
    }));
    expect(names.length).toBeGreaterThanOrEqual(2);
    for (const name of names) {
      expect(name.font, name.name).toBeGreaterThanOrEqual(14);
      expect(name.clipped, name.name).toBe(false);
      expect(name.width, `${name.name} needs room for whole words.`).toBeGreaterThan(name.available * 0.85);
      expect(name.splitWords, `${name.name} at ${width}px`).toEqual([]);
    }
    }
  } finally { await fixture.close(); }
});

test('@references the three-card overview keeps long names within their captions', async ({ page }) => {
  const { fixture } = await readingFixture(page);
  try {
    for (const width of [320, 360, 390, 430]) {
      await page.setViewportSize({ width, height: 724 });
      const captions = await page.locator('[data-reading-overview] .reading-card__name').evaluateAll(elements => elements.map(element => ({
        name: element.textContent,
        available: element.getBoundingClientRect().width,
        textWidth: element.scrollWidth,
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize)
      })));
      expect(captions).toHaveLength(3);
      for (const caption of captions) {
        expect(caption.fontSize).toBeGreaterThanOrEqual(14);
        expect(caption.textWidth, `${caption.name} at ${width}px`).toBeLessThanOrEqual(caption.available + 1);
      }
    }
  } finally { await fixture.close(); }
});

test('Symbols opens inline in one dialog and keeps keyboard focus with the artwork', async ({ page }) => {
  const { fixture } = await readingFixture(page);
  try {
    const { dialog } = await openFirstCard(page);
    await dialog.getByRole('button', { name: /^Symbols$/i }).click();
    await expect(page.getByRole('dialog').filter({ visible: true })).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: /^Card symbols$/i })).toHaveCount(0);
    const contentId = await dialog.getByRole('button', { name: /^Symbols$/i }).getAttribute('aria-controls');
    const symbols = dialog.locator(`[id="${contentId}"]`);
    await expect(symbols).toBeVisible();
    await expect(symbols.getByRole('list').first()).toBeVisible();
    await expect(dialog.locator('[data-reading-full-artwork] img')).toBeAttached();
    for (let index = 0; index < 8; index++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    }
    await dialog.getByRole('button', { name: 'Next card', exact: true }).click();
    await expect(dialog).toContainText(/Your spread/);
    await expect(page.getByRole('dialog').filter({ visible: true })).toHaveCount(1);
  } finally { await fixture.close(); }
});

test('scrolled inspection retains return and browsing controls and resets each new card', async ({ page }) => {
  const { fixture, cards } = await readingFixture(page);
  try {
    const { opener, dialog } = await openFirstCard(page);
    const body = dialog.locator('.card-inspector__body');
    await dialog.getByRole('button', { name: /^Symbols$/i }).click();
    await expect.poll(() => body.evaluate(element => element.scrollHeight - element.clientHeight)).toBeGreaterThan(50);
    await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
    expect(await body.evaluate(element => element.scrollTop)).toBeGreaterThan(50);
    for (const name of ['Back to reading', 'Next card', 'Previous card']) await expectOnscreenControl(dialog.getByRole('button', { name, exact: true }));
    await dialog.getByRole('button', { name: 'Next card', exact: true }).click();
    await expect(dialog.getByRole('heading', { level: 2 })).toContainText(cards[1].card);
    await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeLessThanOrEqual(2);
    await expectOnscreenControl(dialog.getByRole('button', { name: 'Back to reading', exact: true }));
    await dialog.getByRole('button', { name: 'Back to reading', exact: true }).click();
    await expect(opener).toBeFocused();
    await expect.poll(() => bodyStyles(page)).toEqual({ position: '', overflow: '', top: '', left: '', right: '', width: '', paddingRight: '' });
  } finally { await fixture.close(); }
});

test('small phones, landscape and enlarged text keep identity and return controls reachable', async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    const events = [];
    const log = (type, state) => events.push({ type, at: performance.now(), state,
      url: location.href, scroll: scrollY, top: document.body?.style.top });
    for (const method of ['pushState', 'replaceState', 'back']) {
      const original = history[method].bind(history);
      history[method] = (...args) => { log(method, args[0]); return original(...args); };
    }
    addEventListener('popstate', event => log('popstate', event.state));
    window.__cardInspectionHistory = events;
  });
  const { fixture, cards } = await readingFixture(page, { drawTime: 1790500049306 });
  expect(cards[0].card).toBe('Knight of Pentacles');
  try {
    for (const viewport of [
      { width: 320, height: 724 }, { width: 360, height: 740 },
      { width: 375, height: 724 }, { width: 390, height: 700 },
      { width: 402, height: 724 }, { width: 430, height: 724 },
      { width: 874, height: 360 }
    ]) {
      await page.setViewportSize(viewport);
      if (viewport.width === 874) {
        await page.evaluate(() => {
          document.documentElement.style.setProperty('--safe-pad-left', '44px');
          document.documentElement.style.setProperty('--safe-pad-right', '44px');
          document.documentElement.style.setProperty('--safe-pad-bottom', '21px');
        });
      }
      const { dialog } = await openFirstCard(page);
      const panel = dialog.getByRole('document');
      await expectPainted(panel);
      const bounds = await panel.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
      for (const name of ['Back to reading', 'Next card']) await expectOnscreenControl(dialog.getByRole('button', { name, exact: true }));
      const heading = await dialog.getByRole('heading', { level: 2 }).boundingBox();
      const artwork = await dialog.locator('[data-reading-full-artwork]').boundingBox();
      expect(heading.y, `Identity must precede the artwork at ${viewport.width}×${viewport.height}.`).toBeLessThan(artwork.y);
      const body = dialog.locator('.card-inspector__body');
      expect(await body.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      if (viewport.width === 874) {
        expect(await dialog.evaluate(element => getComputedStyle(element).paddingLeft)).toBe('44px');
        expect(await dialog.locator('.card-inspector__header').evaluate(element => getComputedStyle(element).paddingLeft)).toBe('16px');
        expect(await body.evaluate(element => getComputedStyle(element).paddingLeft)).toBe('16px');
        await dialog.getByRole('button', { name: /^Symbols$/i }).tap();
        await expect(dialog.getByRole('button', { name: /^Symbols$/i })).toHaveAttribute('aria-expanded', 'true');
        await page.screenshot({ path: testInfo.outputPath('landscape.png') });
      }
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    }
    await page.evaluate(() => {
      for (const name of ['--safe-pad-left', '--safe-pad-right', '--safe-pad-bottom']) document.documentElement.style.removeProperty(name);
    });
    await page.setViewportSize({ width: 320, height: 724 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    const { dialog } = await openFirstCard(page);
    await expectPainted(dialog.getByRole('document'));
    for (const name of ['Back to reading', 'Next card']) await expectOnscreenControl(dialog.getByRole('button', { name, exact: true }));
    const body = dialog.locator('.card-inspector__body');
    await dialog.getByRole('button', { name: /^Symbols$/i }).click();
    await dialog.locator('.card-inspector__sections').evaluate(async element => {
      await Promise.allSettled(element.getAnimations({ subtree: true }).map(animation => animation.finished));
    });
    expect(await body.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(dialog.locator('.card-inspector__sections li').last()).toBeInViewport({ ratio: 0.9 });
    await page.screenshot({ path: testInfo.outputPath('enlarged-320.png') });
    await page.setViewportSize({ width: 874, height: 360 });
    for (const name of ['Back to reading', 'Next card']) await expectOnscreenControl(dialog.getByRole('button', { name, exact: true }));
    expect(await body.evaluate(element => element.clientHeight)).toBeGreaterThan(0);
    await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeGreaterThan(50);
    await expect(dialog.locator('.card-inspector__sections li').last()).toBeInViewport({ ratio: 0.9 });
    await page.screenshot({ path: testInfo.outputPath('enlarged-landscape.png') });
  } finally {
    const evidencePath = testInfo.outputPath('responsive-history.json');
    await writeFile(evidencePath, JSON.stringify(await page.evaluate(() => window.__cardInspectionHistory), null, 2));
    await testInfo.attach('responsive-history', { path: evidencePath, contentType: 'application/json' });
    await fixture.close();
  }
});

for (const theme of ['dark', 'light']) {
  test(`${theme} inline Symbols uses readable text and passes scoped axe checks`, async ({ page }, testInfo) => {
    await page.addInitScript(value => localStorage.setItem('tarot-theme', value), theme);
    const { fixture } = await readingFixture(page);
    try {
      const { dialog } = await openFirstCard(page);
      await dialog.getByRole('button', { name: /^Symbols$/i }).click();
      const contentId = await dialog.getByRole('button', { name: /^Symbols$/i }).getAttribute('aria-controls');
      const symbols = dialog.locator(`[id="${contentId}"]`);
      await expect(symbols.getByRole('list').first()).toBeVisible();
      const sizes = await symbols.locator('p, li, h3, h4, span').evaluateAll(elements => elements
        .filter(element => element.getClientRects().length && element.textContent.trim())
        .map(element => Number.parseFloat(getComputedStyle(element).fontSize)));
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14);
      await expectPainted(dialog.getByRole('document'));
      const report = await new AxeBuilder({ page }).include('[role="dialog"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      await testInfo.attach(`${theme}-axe`, { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
      expect(report.violations.map(violation => ({ id: violation.id, impact: violation.impact,
        nodes: violation.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }))).toEqual([]);
      await dialog.locator('.card-inspector__body').evaluate(element => { element.scrollTop = element.scrollHeight; });
      await page.screenshot({ path: testInfo.outputPath(`${theme}-symbols.png`) });
    } finally { await fixture.close(); }
  });
}

// These dispatched events exercise the real browser event handlers and intent
// classification. They do not establish physical-device gesture behavior.
async function dispatchGesture(surface, { dx = -130, dy = 0, duration = 70, cancel = false, multi = false, multiOutside = false, mismatch = false, edge = false } = {}) {
  await surface.evaluate(async (element, gesture) => {
    const rect = element.getBoundingClientRect();
    const start = { identifier: 17, clientX: gesture.edge ? 12 : rect.left + rect.width * 0.8, clientY: rect.top + rect.height * 0.4, target: element };
    const end = { ...start, clientX: start.clientX + gesture.dx, clientY: start.clientY + gesture.dy };
    const emit = (type, touches, changedTouches = touches, target = element) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(event, { touches: { value: touches }, changedTouches: { value: changedTouches } });
      target.dispatchEvent(event);
    };
    emit('touchstart', [start]);
    if (gesture.multi) emit('touchstart', [start, { ...start, identifier: 18, clientX: start.clientX + 20 }]);
    if (gesture.multiOutside) {
      const header = element.closest('[role="dialog"]').querySelector('header');
      const second = { ...start, identifier: 18, clientX: 24, clientY: 24, target: header };
      emit('touchstart', [start, second], [second], header);
      emit('touchend', [start], [second], header);
    }
    emit('touchmove', [end]);
    if (gesture.cancel) emit('touchcancel', [], [end]);
    await new Promise(resolve => setTimeout(resolve, gesture.duration));
    emit('touchend', [], [{ ...end, identifier: gesture.mismatch ? 99 : 17 }]);
  }, { dx, dy, duration, cancel, multi, multiOutside, mismatch, edge });
}

test('only deliberate single-finger artwork gestures browse one card', async ({ page }) => {
  const { fixture, cards } = await readingFixture(page);
  try {
    const { dialog } = await openFirstCard(page);
    const artwork = dialog.locator('[data-reading-full-artwork]');
    const title = dialog.getByRole('heading', { level: 2 });
    for (const gesture of [
      { dx: -70, dy: -240 }, { dx: -100, dy: -90 },
      { duration: 500 }, { cancel: true }, { multi: true }, { multiOutside: true }, { mismatch: true }, { edge: true }
    ]) {
      await dispatchGesture(artwork, gesture);
      await expect(title).toContainText(cards[0].card);
    }
    await dispatchGesture(title);
    await expect(title).toContainText(cards[0].card);
    await title.evaluate(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    });
    await dispatchGesture(artwork);
    await expect(title).toContainText(cards[0].card);
    await page.evaluate(() => getSelection().removeAllRanges());
    await dispatchGesture(artwork);
    await expect(title).toContainText(cards[1].card);
    await expectPainted(dialog.getByRole('document'));
    await expect(title).toContainText(cards[1].card);
    await dialog.getByRole('button', { name: /^Symbols$/i }).click();
    const contentId = await dialog.getByRole('button', { name: /^Symbols$/i }).getAttribute('aria-controls');
    await dispatchGesture(dialog.locator(`[id="${contentId}"]`));
    await expect(title).toContainText(cards[1].card);
    await dispatchGesture(artwork, { dx: 130 });
    await expect(title).toContainText(cards[0].card);
  } finally { await fixture.close(); }
});

test('closing during entrance and rapid browsing leave the reading usable', async ({ page }) => {
  const { fixture, cards } = await readingFixture(page);
  try {
    const { opener, dialog } = await openFirstCard(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    await opener.press('Enter');
    await expect(dialog).toBeVisible();
    for (let index = 0; index < 3; index++) {
      await dialog.getByRole('button', { name: 'Next card', exact: true }).click();
      await dialog.getByRole('button', { name: 'Previous card', exact: true }).click();
    }
    await expect(dialog.getByRole('heading', { level: 2 })).toContainText(cards[0].card);
    await expectPainted(dialog.getByRole('document'));
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    await expect.poll(() => bodyStyles(page)).toEqual({ position: '', overflow: '', top: '', left: '', right: '', width: '', paddingRight: '' });
    await expect(page.locator('.narrative-stream')).toContainText('make room to rest');
  } finally { await fixture.close(); }
});

for (const [deck, path] of [['thoth-a1', '/thoth/'], ['marseille-classic', '/marseille/']]) {
  test(`${deck} artwork keeps its frame, identity and readable recovery`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('tarot-deck-style', value), deck);
    // Fail the seeded second card before dealing can warm the image cache.
    const failedScan = deck === 'thoth-a1' ? '**/thoth/thoth_major_14_art.png' : '**/marseille/major14.jpg';
    await page.route(failedScan, route => route.abort());
    const { fixture } = await readingFixture(page);
    try {
      const { opener, dialog } = await openFirstCard(page);
      await expectPainted(dialog.getByRole('document'));
      const artwork = dialog.locator('[data-reading-full-artwork]');
      const image = artwork.locator('img');
      await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
      expect(await image.getAttribute('src')).toContain(path);
      const frame = await artwork.boundingBox();
      expect(frame.height).toBeGreaterThan(100);
      await dialog.getByRole('button', { name: 'Next card', exact: true }).click();
      await expect(dialog.getByRole('status')).toContainText('Artwork unavailable');
      await expect(dialog.locator('.card-inspector__meaning')).not.toBeEmpty();
      expect(Math.abs((await artwork.boundingBox()).height - frame.height)).toBeLessThanOrEqual(2);
      await page.keyboard.press('Escape');
      await expect(opener).toBeFocused();
    } finally { await fixture.close(); }
  });
}

test('a held full scan keeps a stable frame with art belonging to the selected card', async ({ page }, testInfo) => {
  let release;
  let held = 0;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/images/cards/RWS1909_-_14_Temperance.jpeg', async route => {
    held++;
    await gate;
    await route.continue();
  });
  const { fixture } = await readingFixture(page);
  try {
    const { dialog } = await openFirstCard(page);
    await expectPainted(dialog.getByRole('document'));
    await expect.poll(() => dialog.locator('[data-reading-full-artwork] img').evaluateAll(elements => elements.some(image => image.complete && image.naturalWidth > 0))).toBe(true);
    const frame = dialog.locator('[data-reading-full-artwork]');
    const firstHeight = (await frame.boundingBox()).height;
    expect(firstHeight).toBeGreaterThan(100);
    await dialog.getByRole('button', { name: 'Next card', exact: true }).click();
    await expect(dialog.getByRole('heading', { level: 2 })).toContainText('Temperance');
    await expect.poll(() => held).toBeGreaterThan(0);
    const before = await frame.boundingBox();
    expect(before.height).toBeGreaterThan(100);
    expect(Math.abs(before.height - firstHeight)).toBeLessThanOrEqual(2);
    const painted = await frame.locator('img').evaluateAll(elements => elements.filter(image => {
      const style = getComputedStyle(image);
      return image.getClientRects().length && style.visibility !== 'hidden' && Number(style.opacity) > 0.01 && image.complete && image.naturalWidth > 0;
    }).map(image => ({ alt: image.alt, source: new URL(image.currentSrc || image.src).pathname })));
    for (const image of painted) {
      expect(image.alt).toBe('Temperance');
      expect(image.source).toContain('14_Temperance');
      expect(image.source).not.toContain('17_Star');
    }
    await page.screenshot({ path: testInfo.outputPath('held-temperance-scan.png') });
    release();
    await expect.poll(() => frame.locator('img').evaluateAll(elements => elements.some(image => image.complete && image.naturalWidth > 360))).toBe(true);
    const after = await frame.boundingBox();
    expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(2);
    const rotation = await frame.locator('img').first().evaluate(element => getComputedStyle(element).transform);
    expect(rotation, 'Seeded Temperance is reversed.').toMatch(/^matrix\(-1,\s*0,\s*0,\s*-1/);
  } finally {
    release();
    await fixture.close();
  }
});

test('missing artwork reports the failure without losing card meaning or dismissal', async ({ page }) => {
  await page.route(/\/images\/cards\/(?:w360\/)?RWS1909_-_17_Star\.(?:jpe?g|webp)$/, route => route.abort());
  const { fixture } = await readingFixture(page);
  try {
    const { opener, dialog } = await openFirstCard(page);
    await expect(dialog.getByRole('status')).toContainText(/Artwork unavailable|Full artwork unavailable|Full scan unavailable/i);
    await expect(dialog.getByRole('heading', { level: 2 })).toContainText('The Star');
    await expect(dialog.locator('p').filter({ hasText: /hope|faith|renew|heal|lost/i }).first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Back to reading', exact: true }).click();
    await expect(opener).toBeFocused();
  } finally { await fixture.close(); }
});
