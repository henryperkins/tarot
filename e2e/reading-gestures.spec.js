import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createNarrativeFixture, expectNoHorizontalOverflow } from './helpers/narrativeFixtures.js';

const sidecars = JSON.parse(fs.readFileSync(new URL('../output/reading-motion/fixtures/gesture-sidecars.json', import.meta.url)));
const star = sidecars.star;
const reading = page => page.locator('.narrative-stream');
const windowArt = page => page.locator('[data-gesture-window]');
const currentCards = page => windowArt(page).locator('.gesture-focus-layer:not(.gesture-focus-layer--departing) [data-focus-card]');
const phrase = (page, id) => page.locator(`[data-gesture-id="${id}"]`);
async function open(page, query = '') {
  await page.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
  await page.goto(`/__e2e/reading-gestures?${query}`);
  await expect(page.getByTestId('reading-gestures-fixture')).toBeVisible();
  await expect(windowArt(page)).toBeVisible();
}

test('completed Star is static and every connection can be revisited without changing prose', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1100, height: 1000 });
  await open(page, 'arrival=complete');
  await expect(reading(page)).toHaveText(new RegExp('Neither pitcher gets dropped'));
  const raw = await reading(page).locator('.narrative-stream__markdown p').last().textContent();
  expect(raw).toBe(star.expectedRaw);
  await expect(windowArt(page)).toHaveAttribute('data-phase', 'static');
  for (const [id, detail] of [['arrival', ''], ['pool', 'pool-pour'], ['land', 'land-pour'], ['memory', 'pool-pour'], ['ground', 'land-pour'], ['balance', 'pool-pour land-pour']]) {
    await phrase(page, id).click();
    await expect(windowArt(page)).toHaveAttribute('data-association', id);
    await expect(currentCards(page).first()).toHaveAttribute('data-details', detail);
    await expect(phrase(page, id)).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(phrase(page, id)).toHaveAttribute('aria-pressed', 'false');
  }
  expect(await reading(page).locator('.narrative-stream__markdown p').last().textContent()).toBe(star.expectedRaw);
  await expect(page.getByRole('button', { name: /play|hold|look closer/i })).toHaveCount(0);
});

test('actual SSE advances raw/rendered text while a held pool remains and latest cue replaces backlog', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const fixture = await createNarrativeFixture(page, { narrative: star.expectedRaw, question: 'How can I navigate the transition after leaving my hometown?' });
  try {
    await open(page, 'sourceMode=job-sse');
    const pool = star.associations.find(item => item.id === 'pool');
    await fixture.emit('reading', 'delta', { text: star.expectedRaw.slice(0, pool.passage.end) });
    await expect(phrase(page, 'pool')).toBeVisible();
    await phrase(page, 'pool').click();
    await fixture.emit('reading', 'delta', { text: star.expectedRaw.slice(pool.passage.end) });
    await expect(page.getByTestId('gesture-source-diagnostics')).toHaveAttribute('data-raw-length', String(star.expectedRaw.length));
    await expect(reading(page)).toContainText('Neither pitcher gets dropped');
    await expect(windowArt(page)).toHaveAttribute('data-association', 'pool');
    await page.keyboard.press('Escape');
    await expect(windowArt(page)).toHaveAttribute('data-association', 'balance');
    await fixture.completeReading();
    expect(fixture.requests.reading).toHaveLength(1);
  } finally { await fixture.close(); }
});

test('five-card relationships and identity shelf preserve distinct targets', async ({ page }) => {
  await open(page, 'study=five-card&arrival=complete');
  await expect(page.locator('[data-gesture-shelf] button')).toHaveCount(5);
  for (const association of sidecars.fiveCard.associations) {
    const id = association.id;
    await phrase(page, id).click();
    await expect(windowArt(page)).toHaveAttribute('data-association', id);
    for (let index = 0; index < association.targets.length; index++) {
      await expect(currentCards(page).nth(index)).toHaveAttribute('data-details', association.targets[index].detailIds.join(' '));
    }
  }
  await phrase(page, 'drive-and-sensitivity').click();
  await expect(currentCards(page)).toHaveCount(2);
  await expect(currentCards(page).nth(0)).toHaveAttribute('data-details', 'sprout');
  await expect(currentCards(page).nth(1)).toHaveAttribute('data-details', 'cup');
  const shelf = page.locator('[data-gesture-shelf] button');
  await shelf.first().focus();
  await page.keyboard.press('End');
  await expect(shelf.last()).toBeFocused();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(currentCards(page)).toHaveAttribute('data-details', '');
  await expect(reading(page).locator('li')).toHaveCount(4);
});

test('Hermit and reversed Wands retain their relationship across a return', async ({ page }) => {
  await open(page, 'study=celtic&arrival=complete');
  await expect(reading(page).locator('.narrative-stream__markdown p')).toHaveCount(3);
  for (const association of sidecars.related.associations) {
    await phrase(page, association.id).click();
    await expect(windowArt(page)).toHaveAttribute('data-association', association.id);
    for (let index = 0; index < association.targets.length; index++) {
      await expect(currentCards(page).nth(index)).toHaveAttribute('data-details', association.targets[index].detailIds.join(' '));
    }
  }
  await expect(currentCards(page)).toHaveCount(2);
  await expect(currentCards(page).nth(1).locator('[data-reversed]')).toHaveAttribute('data-reversed', 'true');
});

test('five actual streamed introductions retain the same shelf nodes and prose position', async ({ page }) => {
  const source = sidecars.fiveCard;
  const fixture = await createNarrativeFixture(page, { narrative: source.expectedRaw, question: source.recordedContext.userQuestion });
  try {
    await open(page, 'study=five-card&sourceMode=job-sse');
    const shelf = page.locator('[data-gesture-shelf] li');
    await shelf.evaluateAll(nodes => nodes.forEach((node, index) => { node.dataset.persistenceProbe = String(index); }));
    let end = 0;
    for (let index = 0; index < source.introductions.length; index++) {
      const intro = source.introductions[index];
      const scroll = await page.evaluate(() => scrollY);
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      await fixture.emit('reading', 'delta', { text: source.expectedRaw.slice(end, intro.end) });
      end = intro.end;
      await expect(shelf.nth(index)).toHaveAttribute('data-introduced', 'true');
      for (let earlier = 0; earlier <= index; earlier++) {
        await expect(shelf.nth(earlier)).toHaveAttribute('data-persistence-probe', String(earlier));
        await expect(shelf.nth(earlier).locator('button')).toBeEnabled();
      }
      expect(await page.evaluate(() => scrollY)).toBe(scroll);
      expect(await page.evaluate(() => document.activeElement?.tagName)).toBe(focused);
      await expect(page.getByTestId('gesture-source-diagnostics')).toHaveAttribute('data-selection-calls', '0');
    }
    await fixture.completeReading();
    await expect(reading(page).locator('h3')).toHaveCount(5);
    await expect(reading(page).locator('li')).toHaveCount(4);
  } finally { await fixture.close(); }
});

test('missing WAAPI preserves static crop and accessible prose', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => { Element.prototype.animate = undefined; Element.prototype.getAnimations = undefined; });
  await open(page, 'study=five-card&arrival=complete');
  await phrase(page, 'ace-sprout').click();
  await expect(currentCards(page)).toHaveAttribute('data-details', 'sprout');
  await expect(phrase(page, 'ace-sprout')).toHaveAttribute('aria-pressed', 'true');
  await expect(reading(page)).toContainText('The spark in this spread is clearly yours');
});

test('compact relationship and reduced-motion meaning @mobile', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'study=five-card&arrival=complete&reflection=off');
  await expect(page.getByTestId('recorded-reflection')).toHaveCount(0);
  for (const width of [390, 375, 320]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 667 });
    await expect(windowArt(page)).toBeVisible();
    const before = await windowArt(page).boundingBox();
    await phrase(page, 'drive-and-sensitivity').click();
    await expect(windowArt(page)).toBeVisible();
    const paired = await windowArt(page).boundingBox();
    expect(Math.abs(before.height - paired.height)).toBeLessThanOrEqual(1);
    await expect(currentCards(page)).toHaveCount(2);
    await phrase(page, 'ace-meaning').click();
    await expect(windowArt(page).locator('[data-gesture-art]')).toHaveCount(2);
    await expectNoHorizontalOverflow(page);
    expect(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running' && animation.effect?.target?.closest('[data-gesture-window]')).length)).toBe(0);
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const zoomedPhrase = phrase(page, 'drive-and-sensitivity');
  await zoomedPhrase.scrollIntoViewIfNeeded();
  // A long inline phrase can exceed the space below the sticky artwork at 200%.
  // Tap an actual visible line, as a reader would, rather than its full box's center.
  const point = await zoomedPhrase.evaluate(element => {
    const shelfBottom = document.querySelector('.gesture-companion').getBoundingClientRect().bottom;
    return [...element.getClientRects()].map(rect => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }))
      .find(({ x, y }) => y > shelfBottom && y < innerHeight && element.contains(document.elementFromPoint(x, y))) || null;
  });
  expect(point).not.toBeNull();
  await page.touchscreen.tap(point.x, point.y);
  await expect(currentCards(page)).toHaveCount(2);
  await expect(zoomedPhrase).toHaveAttribute('aria-pressed', 'true');
  await zoomedPhrase.focus();
  await page.keyboard.press('Enter');
  await expect(zoomedPhrase).toHaveAttribute('aria-pressed', 'false');
  await expectNoHorizontalOverflow(page);
  await expect(reading(page)).toContainText('both your drive and your sensitivity');
});
