import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createNarrativeFixture, expectNoHorizontalOverflow } from './helpers/narrativeFixtures.js';

const fiveCard = JSON.parse(fs.readFileSync(new URL('../output/reading-motion/fixtures/gestures-five-card-creative-project.json', import.meta.url)));
const diagnostics = page => page.getByTestId('gesture-source-diagnostics');
const windowArt = page => page.locator('[data-gesture-window]');
const currentCards = page => windowArt(page).locator('.gesture-focus-layer:not(.gesture-focus-layer--departing) [data-focus-card]');
const phrase = (page, text) => page.locator('[data-gesture-id]').filter({ hasText: text });
const shelf = page => page.locator('[data-gesture-shelf] li');
const STAR_QUESTION = 'How can I navigate the transition after leaving my hometown?';
const browserErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  browserErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
});
test.afterEach(async ({ page }) => { expect(browserErrors.get(page)).toEqual([]); });

async function open(page, query = 'sourceMode=job-sse') {
  await page.goto(`/__e2e/reading-gestures?associations=dynamic&${query}`);
  await expect(diagnostics(page)).toHaveAttribute('data-association-mode', 'dynamic');
  await expect(windowArt(page)).toBeVisible();
}

async function emitText(page, fixture, text, total) {
  await fixture.emit('reading', 'delta', { text });
  await expect(diagnostics(page)).toHaveAttribute('data-raw-length', String(total));
}

test('dynamic SSE reserves emergence and preserves a held passage while later text arrives', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1100, height: 1000 });
  const first = 'The Star shows a figure pouring one pitcher into a pool.';
  const next = ' The other pitcher pours water onto the land. Memory and reinvention can coexist.';
  const fixture = await createNarrativeFixture(page, { narrative: first + next, question: STAR_QUESTION });
  try {
    await open(page);
    await emitText(page, fixture, 'The Star', 8);
    const presence = await shelf(page).nth(2).locator('[data-gesture-art]').evaluate(element => Number(element.style.getPropertyValue('--presence')));
    expect(presence).toBeLessThan(1);
    await emitText(page, fixture, first.slice(8), first.length);
    const pool = phrase(page, /pool/).last();
    await expect(pool).toBeVisible();
    await pool.click();
    const heldId = await pool.getAttribute('data-gesture-id');
    await expect(currentCards(page)).toHaveAttribute('data-details', 'pool-pour');
    await emitText(page, fixture, next, first.length + next.length);
    await expect(windowArt(page)).toHaveAttribute('data-held', 'true');
    await expect(windowArt(page)).toHaveAttribute('data-association', heldId);
    await expect(page.locator(`[data-gesture-id="${heldId}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.narrative-stream')).toContainText('Memory and reinvention can coexist');
    await page.keyboard.press('Escape');
    await expect(currentCards(page)).toHaveAttribute('data-details', 'land-pour');
    await fixture.completeReading();
  } finally { await fixture.close(); }
});

test('dynamic literal ordering follows prose and metaphors or Markdown URLs add no water cues', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1100, height: 1000 });
  const literal = 'The Star shows water pouring onto the land and then into the pool.';
  const metaphor = '\n\nYou can pool your resources and land a new role. [A reference](https://example.invalid/pool/land) may offer another perspective. There is still room to make a thoughtful choice.';
  const fixture = await createNarrativeFixture(page, { narrative: literal + metaphor, question: STAR_QUESTION });
  try {
    await open(page);
    await emitText(page, fixture, literal, literal.length);
    await expect(currentCards(page)).toHaveAttribute('data-details', 'pool-pour');
    const before = await page.locator('[data-gesture-id]').count();
    await emitText(page, fixture, metaphor, literal.length + metaphor.length);
    await expect(page.locator('.narrative-stream')).toContainText('pool your resources');
    await expect(page.locator('[data-gesture-id]')).toHaveCount(before);
    await expect(page.locator('.narrative-stream a[href="https://example.invalid/pool/land"]')).toHaveText('A reference');
    await expect(currentCards(page)).toHaveAttribute('data-details', 'pool-pour');
    await fixture.completeReading();
  } finally { await fixture.close(); }
});

test('dynamic card headings introduce cards and whole-card revisits stay on the shelf', async ({ page }) => {
  const first = '### Future — The Star\n\nA figure pours water from one pitcher into a pool.\n\n';
  const middle = '### Present — The Tower\n\nA sudden change invites you to reconsider the structures you rely on.\n\n';
  const last = '### Putting It Together\n\nReturn to The Star when you need a reminder that renewal takes time.';
  const fixture = await createNarrativeFixture(page, { narrative: first + middle + last, question: STAR_QUESTION });
  try {
    await open(page);
    await emitText(page, fixture, first, first.length);
    await expect(shelf(page).nth(2)).toHaveAttribute('data-introduced', 'true');
    await expect(phrase(page, /pool/)).toBeVisible();
    await emitText(page, fixture, middle + last, first.length + middle.length + last.length);
    await expect(shelf(page).nth(1)).toHaveAttribute('data-introduced', 'true');
    const returned = page.locator('.narrative-stream p').filter({ hasText: 'Return to The Star' }).locator('[data-gesture-id]');
    await expect(returned).toHaveCount(1);
    await expect(returned).not.toHaveAttribute('role', 'button');
    await shelf(page).nth(2).locator('button').click();
    await expect(currentCards(page)).toHaveAttribute('aria-label', /The Star/);
    await expect(currentCards(page)).toHaveAttribute('data-details', '');
    await fixture.completeReading();
  } finally { await fixture.close(); }
});

test('a first sentence naming two cards retains their relationship without overlapping introductions', async ({ page }) => {
  const narrative = 'The Tower and The Star suggest that disruption and renewal can belong to the same transition.';
  const fixture = await createNarrativeFixture(page, { narrative, question: STAR_QUESTION });
  try {
    await open(page);
    await emitText(page, fixture, narrative, narrative.length);
    const relationship = phrase(page, /The Tower and The Star/);
    await expect(relationship).toHaveCount(1);
    await relationship.click();
    await expect(currentCards(page)).toHaveCount(2);
    await expect(currentCards(page).nth(0)).toHaveAttribute('aria-label', /The Tower/);
    await expect(currentCards(page).nth(1)).toHaveAttribute('aria-label', /The Star/);
    await expect(shelf(page).nth(1)).toHaveAttribute('data-introduced', 'true');
    await expect(shelf(page).nth(2)).toHaveAttribute('data-introduced', 'true');
    await fixture.completeReading();
  } finally { await fixture.close(); }
});

test('literal fallback preserves the reading without fabricating fixture-specific interpretive returns', async ({ page }) => {
  const fixture = await createNarrativeFixture(page, { narrative: fiveCard.reading, question: fiveCard.userQuestion });
  try {
    await open(page, 'study=five-card&sourceMode=job-sse');
    await fixture.completeReading();
    await expect(page.locator('[data-gesture-shelf] button:enabled')).toHaveCount(5);
    await expect(page.locator('.narrative-stream h3')).toHaveCount(5);
    await expect(page.locator('.narrative-stream li')).toHaveCount(4);
    await phrase(page, /The Ace of Wands and Queen of Cups/).click();
    await expect(currentCards(page)).toHaveCount(2);
    await expect(currentCards(page).nth(0)).toHaveAttribute('aria-label', /Ace of Wands/);
    await expect(currentCards(page).nth(1)).toHaveAttribute('aria-label', /Queen of Cups/);
    const returnPhrase = page.locator('.narrative-stream li').filter({ hasText: 'Write down the two missing swords' }).locator('[data-gesture-id]');
    await expect(returnPhrase).toHaveCount(0);
    await expect(currentCards(page).nth(0)).toHaveAttribute('data-details', '');
    await expect(currentCards(page).nth(1)).toHaveAttribute('data-details', '');
  } finally { await fixture.close(); }
});

test('dynamic hydrated relationships preserve static meaning on a reduced-motion phone @mobile', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'study=five-card&arrival=complete&reflection=off');
  await expect(diagnostics(page)).toHaveAttribute('data-source-status', 'complete');
  await expect(page.locator('[data-gesture-shelf] button:enabled')).toHaveCount(5);
  await expect(windowArt(page)).toBeVisible();
  await expect(page.getByTestId('recorded-reflection')).toHaveCount(0);
  const before = await windowArt(page).boundingBox();
  await phrase(page, /The Ace of Wands and Queen of Cups/).click();
  await expect(currentCards(page)).toHaveCount(2);
  const paired = await windowArt(page).boundingBox();
  expect(Math.abs(before.height - paired.height)).toBeLessThanOrEqual(1);
  await expectNoHorizontalOverflow(page);
  expect(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running' && animation.effect?.target?.closest('[data-gesture-window]')).length)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(windowArt(page)).not.toHaveAttribute('data-held', 'true');
});
