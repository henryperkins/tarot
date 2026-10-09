import { test, expect } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers/narrativeFixtures.js';

const stage = page => page.locator('[data-gesture-window]');
const current = page => stage(page).locator('.gesture-focus-layer:not(.gesture-focus-layer--departing) [data-focus-card]');
const phrase = (page, text) => page.locator('[data-gesture-id]').filter({ hasText: text });

async function openDeck(page, card, extra = '') {
  await page.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
  await page.goto(`/__e2e/reading-gestures?study=deck&card=${encodeURIComponent(card)}&arrival=complete${extra}`);
  await expect(page.getByRole('heading', { name: 'Authored visual probe', exact: true })).toBeVisible();
  await expect(page.getByTestId('gesture-source-diagnostics')).toHaveAttribute('data-source-status', 'complete');
  await expect(page.getByTestId('gesture-source-diagnostics')).toHaveAttribute('data-association-mode', 'dynamic');
}

test('deck study exposes all 78 vector faces and keeps synthetic prose distinct from recorded readings', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 1000 });
  const jobs = [];
  page.on('request', request => { if (/\/api\/tarot-reading/.test(request.url())) jobs.push(request.url()); });
  await openDeck(page, 'The Fool', '&sourceMode=job-sse&associations=authored');
  await expect(page.getByRole('combobox', { name: 'Card', exact: true }).locator('option')).toHaveCount(78);
  await expect(page.getByText('Synthetic descriptions of painted details; this is not a recorded or personalized reading.', { exact: true })).toBeVisible();
  await expect(page.getByText('Your Personalized Narrative', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('recorded-reflection')).toHaveCount(0);
  await expect(page.locator('[data-gesture-shelf] img')).toHaveAttribute('src', /major-00-fool\.svg$/);
  await expect.poll(() => page.locator('[data-gesture-shelf] img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(phrase(page, /white dog/)).toBeVisible();
  await phrase(page, /white dog/).click();
  await expect(current(page)).toHaveAttribute('data-details', 'white-dog');
  await expect(stage(page)).toHaveAttribute('data-held', 'true');
  expect((await page.locator('[data-gesture-shelf] button').boundingBox()).width).toBeLessThanOrEqual(108);
  expect((await stage(page).boundingBox()).y).toBeLessThan(600);
  await page.getByRole('combobox', { name: 'Card', exact: true }).selectOption('Ace of Wands');
  await expect(phrase(page, /sprouting leaves/)).toBeVisible();
  await phrase(page, /sprouting leaves/).click();
  await expect(current(page)).toHaveAttribute('data-details', 'sprout');
  await expect(page.locator('[data-gesture-shelf] img')).toHaveAttribute('src', /wands-01\.svg$/);
  expect(jobs).toEqual([]);
});

test('deck study allows keyboard detail inspection across the new suits', async ({ page }) => {
  await openDeck(page, 'Queen of Wands');
  const cat = phrase(page, /black cat/);
  await cat.focus();
  await page.keyboard.press('Enter');
  await expect(current(page)).toHaveAttribute('data-details', 'black-cat');
  await expect(cat).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(cat).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('combobox', { name: 'Card', exact: true }).selectOption('Ace of Cups');
  await phrase(page, /dove/).click();
  await expect(current(page)).toHaveAttribute('data-details', 'descending-dove');
  await expect(page.locator('[data-gesture-shelf] img')).toHaveAttribute('src', /cups-01\.svg$/);
  await page.getByRole('combobox', { name: 'Card', exact: true }).selectOption('Four of Pentacles');
  const physical = page.locator('[data-gesture-id]').filter({ hasText: /pentacle/ }).last();
  await expect(physical).toBeVisible();
  await physical.click();
  await expect(current(page)).toHaveAttribute('data-details', /.+/);
  await expect(page.locator('[data-gesture-shelf] img')).toHaveAttribute('src', /pentacles-04\.svg$/);
});

test('reversed deck details remain usable and still on a reduced-motion phone @mobile', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openDeck(page, 'Eight of Swords', '&orientation=reversed');
  await expect(page.getByRole('combobox', { name: 'Orientation', exact: true })).toHaveValue('reversed');
  const bindings = phrase(page, /Bindings/);
  await bindings.click();
  await expect(current(page)).toHaveAttribute('data-details', 'bindings');
  await expect(current(page).locator('[data-reversed]')).toHaveAttribute('data-reversed', 'true');
  await expect(current(page)).toHaveAttribute('aria-label', /Eight of Swords, reversed/);
  await expectNoHorizontalOverflow(page);
  expect(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running' && animation.effect?.target?.closest('[data-gesture-window]')).length)).toBe(0);
  await page.getByRole('combobox', { name: 'Orientation', exact: true }).selectOption('upright');
  await phrase(page, /Bindings/).click();
  await expect(current(page).locator('.gesture-art__upright')).toHaveCSS('transform', 'none');
  await expectNoHorizontalOverflow(page);
});


test('gentle deck arrival introduces a new detail and preserves inspection while the next paragraph arrives', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
  await page.goto('/__e2e/reading-gestures?study=deck&card=Temperance&arrival=gentle');
  const diagnostics = page.getByTestId('gesture-source-diagnostics');
  const firstDetail = phrase(page, /water between/);
  await expect(firstDetail).toBeVisible();
  await expect(diagnostics).toHaveAttribute('data-source-status', 'streaming');
  await firstDetail.click();
  const heldId = await firstDetail.getAttribute('data-gesture-id');
  const runId = await diagnostics.getAttribute('data-run-id');
  const heldLength = Number(await diagnostics.getAttribute('data-raw-length'));
  await expect(current(page)).toHaveAttribute('data-details', 'cup-stream');
  await expect(stage(page)).toHaveAttribute('data-held', 'true');
  await expect(diagnostics).toHaveAttribute('data-source-status', 'complete');
  expect(Number(await diagnostics.getAttribute('data-raw-length'))).toBeGreaterThan(heldLength);
  await expect(diagnostics).toHaveAttribute('data-run-id', runId);
  await expect(diagnostics).toHaveAttribute('data-selection-calls', '0');
  await expect(stage(page)).toHaveAttribute('data-association', heldId);
  await expect(firstDetail).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.narrative-stream')).toContainText('the angel across both surfaces');
  await page.keyboard.press('Escape');
  await expect(stage(page)).not.toHaveAttribute('data-held', 'true');
  await expect(current(page)).toHaveAttribute('data-details', 'two-feet');
});
