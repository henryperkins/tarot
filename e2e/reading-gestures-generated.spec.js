import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createNarrativeFixture, expectNoHorizontalOverflow } from './helpers/narrativeFixtures.js';
import { createVisualCueLedger, applyVisualCueBatch } from '../shared/reading/visualCueLedger.js';
import { hashVisualCueText } from '../shared/contracts/visualCueBatches.js';

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

const visualCards = ['Six of Cups', 'The Tower', 'The Star'].map((canonicalName, index) => ({ index, canonicalName, artworkEdition: 'rws-immanuelle-vector' }));
const pour = 'Water runs from the lowered vessel into the blue basin.';
const meaning = 'That water leaves room for home as you begin again.';
const land = 'The second vessel sends its water onto the green earth.';
const proposal = (localAlias, quote, detailId = 'pool-pour') => ({ localAlias, kind: 'literal', quote,
  targets: [{ spreadIndex: 2, detailIds: [detailId] }] });
const deliverVisual = (page, detail) => page.evaluate(value => window.dispatchEvent(new CustomEvent('reading-visual-fixture', { detail: value })), detail);
async function openVisualFixture(page) {
  await page.goto('/__e2e/reading-gestures?associations=dynamic&sourceMode=visual-cues&reflection=off');
  const diagnostics = page.getByTestId('gesture-source-diagnostics');
  await expect(diagnostics).toHaveAttribute('data-visual-binding', /readingResultId/);
  return createVisualCueLedger(JSON.parse(await diagnostics.getAttribute('data-visual-binding')));
}
async function compileBatch(ledger, proposals, analyzedRaw, authoritativeRaw = analyzedRaw) {
  const result = await applyVisualCueBatch({ ledger, response: { proposals }, authoritativeRaw,
    issuedRequest: { binding: ledger.binding, status: 'active', batchId: `batch-${ledger.receipts.length + 1}`,
      requestSequence: ledger.receipts.length + 1, analyzedEnd: analyzedRaw.length,
      analyzedHash: await hashVisualCueText(analyzedRaw), baseLedgerRevision: ledger.ledgerRevision },
    validationContext: { cards: visualCards, getSupportedDetails: () => ['pool-pour', 'land-pour'] } });
  expect(result.rejected).toEqual([]);
  return result.ledger;
}

test('late cumulative cues select the visible passage after completion and a duplicate cannot restart it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1100, height: 1000 });
  let ledger = await openVisualFixture(page);
  const filler = Array.from({ length: 24 }, () => 'There is time to consider the choices in front of you. Let each possibility have enough space.').join('\n\n');
  const reading = `${pour}\n\n${filler}\n\n${land}`;
  await deliverVisual(page, { raw: reading, status: 'complete', kind: 'complete' });
  await expect(page.locator('.narrative-stream')).toContainText(land);
  ledger = await compileBatch(ledger, [proposal('pool', pour), proposal('land', land, 'land-pour')], reading);
  await deliverVisual(page, { cueLedger: ledger });
  const poolId = ledger.cues[0].id;
  const landId = ledger.cues[1].id;
  await expect(stage(page)).toHaveAttribute('data-association', poolId);
  await expect(stage(page)).toHaveAttribute('data-phase', 'active');
  await expect(stage(page)).toHaveAttribute('data-pending', '');
  await expect(stage(page)).toHaveAttribute('data-phase', 'static', { timeout: 6000 });
  await deliverVisual(page, { cueLedger: structuredClone(ledger) });
  await expect(stage(page)).toHaveAttribute('data-phase', 'static');
  await page.locator(`[data-gesture-id="${landId}"]`).scrollIntoViewIfNeeded();
  await expect(stage(page)).toHaveAttribute('data-association', landId);
  await expect(stage(page)).toHaveAttribute('data-phase', 'active');
  await page.locator(`[data-gesture-id="${poolId}"]`).click();
  await expect(stage(page)).toHaveAttribute('data-held', 'true');
  await expect(stage(page)).toHaveAttribute('data-association', poolId);
});

test('a second batch references the accepted literal while inspection and prose remain independent', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1100, height: 1000 });
  let ledger = await openVisualFixture(page);
  await deliverVisual(page, { raw: pour, status: 'streaming', kind: 'append' });
  ledger = await compileBatch(ledger, [proposal('pool', pour)], pour);
  await deliverVisual(page, { cueLedger: ledger });
  const poolId = ledger.cues[0].id;
  await page.locator(`[data-gesture-id="${poolId}"]`).click();
  const analyzed = `${pour}\n\n${meaning}`;
  const fullText = `${analyzed}\n\nYou can take your next step at your own pace.`;
  await deliverVisual(page, { raw: fullText, status: 'complete', kind: 'complete' });
  ledger = await compileBatch(ledger, [{ ...proposal('memory', meaning), kind: 'interpretation', establishedBy: [{ acceptedCueId: poolId }] }], analyzed, fullText);
  await deliverVisual(page, { cueLedger: ledger });
  const meaningId = ledger.cues[1].id;
  await expect(page.locator(`[data-gesture-id="${meaningId}"]`)).toBeVisible();
  await expect(page.locator('.narrative-stream')).toContainText('at your own pace');
  await expect(stage(page)).toHaveAttribute('data-association', poolId);
  await expect(stage(page)).toHaveAttribute('data-held', 'true');
  await page.keyboard.press('Escape');
  await expect(stage(page)).toHaveAttribute('data-association', meaningId);
  await expect(active(page)).toHaveAttribute('data-details', 'pool-pour');
  await deliverVisual(page, { raw: 'An entirely different reading.', kind: 'snapshot', status: 'complete' });
  await deliverVisual(page, { cueLedger: ledger });
  await expect(page.locator('[data-gesture-id^="vc:"]')).toHaveCount(0);
  await expect(stage(page)).not.toHaveAttribute('data-held', 'true');
});

test('late cumulative cues stay static and revisitable with reduced motion on a phone @mobile', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let ledger = await openVisualFixture(page);
  const reading = `${pour}\n\n${meaning}`;
  await deliverVisual(page, { raw: reading, kind: 'complete', status: 'complete' });
  ledger = await compileBatch(ledger, [proposal('pool', pour), { ...proposal('memory', meaning), kind: 'interpretation', establishedBy: [{ localAlias: 'pool' }] }], reading);
  await deliverVisual(page, { cueLedger: ledger });
  const phrase = page.locator(`[data-gesture-id="${ledger.cues[1].id}"]`);
  await phrase.scrollIntoViewIfNeeded();
  await expect(stage(page)).toHaveAttribute('data-phase', 'static');
  await phrase.click();
  await expect(stage(page)).toHaveAttribute('data-held', 'true');
  await expect(active(page)).toHaveAttribute('data-details', 'pool-pour');
  await expectNoHorizontalOverflow(page);
  expect(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0);
});
