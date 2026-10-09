import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createNarrativeFixture, expectNoHorizontalOverflow } from './helpers/narrativeFixtures.js';

const first = 'The Star. A pitcher sends water into the pool.';
const last = ' That same water can hold a place for home while you try something new.';
const raw = first + last;
const target = { spreadIndex: 2, detailIds: ['pool-pour'] };
const semanticDocument = { version: 1, artworkEdition: 'rws-immanuelle-vector', raw, annotations: [
  { id: 'arrival', kind: 'identity', quote: 'The Star', targets: [{ spreadIndex: 2, detailIds: [] }] },
  { id: 'water', kind: 'literal', quote: 'A pitcher sends water into the pool', targets: [target] },
  { id: 'belonging', kind: 'interpretation', quote: 'That same water can hold a place for home', targets: [target], establishedBy: ['water'], personalContext: { type: 'question', quote: 'leaving my hometown' } }
] };
const stage = page => page.locator('[data-gesture-window]');
const active = page => stage(page).locator('.gesture-focus-layer:not(.gesture-focus-layer--departing) [data-focus-card]');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
});

test('SSE semantic metadata connects an independent interpretation and question while text keeps streaming', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 1000 });
  const fixture = await createNarrativeFixture(page, { narrative: raw, meta: { semanticDocument } });
  try {
    await page.goto('/__e2e/reading-gestures?associations=dynamic&sourceMode=job-sse');
    await fixture.emit('reading', 'delta', { text: first });
    const water = page.locator('[data-gesture-id="water"]');
    await expect(water).toBeVisible();
    await expect(page.locator('[data-gesture-id="belonging"]')).toHaveCount(0);
    await water.click();
    await fixture.emit('reading', 'delta', { text: last });
    await expect(page.locator('.narrative-stream')).toContainText('try something new');
    await expect(stage(page)).toHaveAttribute('data-association', 'water');
    await page.keyboard.press('Escape');
    await page.locator('[data-gesture-id="belonging"]').click();
    await expect(active(page)).toHaveAttribute('data-details', 'pool-pour');
    await expect(page.locator('.gesture-context')).toHaveText('“leaving my hometown”');
    await fixture.completeReading();
    await expect(page.locator('[data-gesture-id="arrival"]')).not.toHaveAttribute('role', 'button');
  } finally { await fixture.close(); }
});

test('replacement source revokes stale generated claims before exposing new text', async ({ page }) => {
  const fixture = await createNarrativeFixture(page, { narrative: raw, meta: { semanticDocument } });
  try {
    await page.goto('/__e2e/reading-gestures?associations=dynamic&sourceMode=job-sse');
    await fixture.emit('reading', 'delta', { text: raw });
    await page.locator('[data-gesture-id="belonging"]').click();
    await fixture.emit('reading', 'snapshot', { fullText: 'The Tower invites a pause before making a new commitment.' });
    await expect(page.locator('.narrative-stream')).toContainText('The Tower invites a pause');
    await expect(page.locator('[data-gesture-id="belonging"]')).toHaveCount(0);
    await expect(page.locator('.gesture-context')).toHaveText('');
    await expect(stage(page)).not.toHaveAttribute('data-held', 'true');
  } finally { await fixture.close(); }
});

test('late semantic metadata preserves a held fallback phrase until the reader releases it', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 1000 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const fixture = await createNarrativeFixture(page, { narrative: raw });
  try {
    await page.goto('/__e2e/reading-gestures?associations=dynamic&sourceMode=job-sse');
    await fixture.emit('reading', 'delta', { text: first });
    const fallback = page.locator('[data-gesture-id^="literal-"]');
    await expect(fallback).toHaveCount(1);
    const heldId = await fallback.getAttribute('data-gesture-id');
    await fallback.click();
    await expect(stage(page)).toHaveAttribute('data-held', 'true');
    await fixture.emit('reading', 'meta', { semanticDocument });
    await expect(page.locator(`[data-gesture-id="${heldId}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`[data-gesture-id="${heldId}"]`)).toBeFocused();
    await expect(stage(page)).toHaveAttribute('data-association', heldId);
    await expect(page.locator('[data-gesture-id="water"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator(`[data-gesture-id="${heldId}"]`)).toHaveCount(0);
    await expect(page.locator('[data-gesture-id="water"]')).toBeVisible();
    await expect(stage(page)).toHaveAttribute('data-association', 'water');
    await expect(stage(page)).not.toHaveAttribute('data-held', 'true');
    await fixture.emit('reading', 'delta', { text: last });
    await expect(page.locator('[data-gesture-id="belonging"]')).toBeVisible();
    await fixture.completeReading();
    expect(errors).toEqual([]);
  } finally { await fixture.close(); }
});

test('fresh generated Spanish associations retain personal meaning with reduced motion on a phone @mobile', async ({ page }) => {
  const dataset = JSON.parse(fs.readFileSync(new URL('../output/reading-motion/fixtures/generated-gesture-readings.json', import.meta.url)));
  const sample = dataset.samples.find(item => item.language === 'es' && item.document && item.reflectionsText);
  expect(sample, 'fresh Spanish generation evidence must be present').toBeTruthy();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/__e2e/reading-gestures?study=generated&sample=${sample.id}&arrival=complete`);
  const cue = sample.document.annotations.find(item => item.kind === 'interpretation' && item.personalContext);
  expect(cue).toBeTruthy();
  await page.locator(`[data-gesture-id="${cue.id}"]`).click();
  await expect(stage(page)).toHaveAttribute('data-held', 'true');
  await expect(page.locator('.gesture-context')).toHaveText(`“${cue.personalContext.quote}”`);
  await expectNoHorizontalOverflow(page);
  expect(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0);
  await page.goto(`/__e2e/reading-gestures?study=generated&sample=${sample.id}&arrival=complete&reflection=off`);
  await page.locator(`[data-gesture-id="${cue.id}"]`).click();
  if (cue.personalContext.type === 'querent-reflection') await expect(page.locator('.gesture-context')).toHaveText('');
  await expect(active(page)).toHaveAttribute('data-details', cue.targets[0].detailIds.join(' '));
});
