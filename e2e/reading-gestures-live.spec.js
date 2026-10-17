import { test, expect } from '@playwright/test';
import { createNarrativeFixture, startReading, expectNoHorizontalOverflow } from './helpers/narrativeFixtures.js';
import { createVisualCueLedger, applyVisualCueBatch } from '../shared/reading/visualCueLedger.js';
import { hashVisualCueText } from '../shared/contracts/visualCueBatches.js';
import { getVectorGestureDetails } from '../src/data/cardGestureArtwork.js';

// Real setup/draw/reveal/interpret components, mocked authentication and two
// independent controlled HTTP transports. This does not qualify model quality.
test.setTimeout(60000);
const raw = '## Tu lectura\n\nPuedes observar un detalle de la imagen mientras reflexionas sobre tu pregunta. Cada paso pequeño te permite reconocer lo que necesitas hoy.';

test('the normal reading route exposes revealed cards without translated annotations', async ({ page }) => {
  const fixture = await createNarrativeFixture(page, { narrative: raw, signedOut: true, sourceUsage: null });
  try {
    await startReading(page, fixture);
    await expect(page.getByTestId('reading-gestures-fixture')).toHaveCount(0);
    const shelf = page.locator('[data-gesture-shelf]');
    const count = fixture.requests.reading[0].cardsInfo.length;
    await expect(shelf.locator('button:enabled')).toHaveCount(count);
    await expect(shelf.locator('[data-introduced="true"]')).toHaveCount(0);
    await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-association', '');
    const images = shelf.locator('img');
    await expect(images).toHaveCount(count);
    expect(await images.evaluateAll(nodes => nodes.every(image => image.src.includes('/images/cards/rws-vector/') && image.complete && image.naturalWidth > 0))).toBe(true);
    const first = shelf.locator('button').first();
    await first.press('Enter');
    await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
    await expect(page.locator('[data-focus-card]')).toHaveAttribute('data-details', '');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-gesture-window]')).not.toHaveAttribute('data-held', 'true');
    await expect(page.locator('.narrative-stream')).toContainText('Cada paso pequeño');
  } finally { await fixture.close(); }
});

test('inspection of an available card survives progress before any translated introduction', async ({ page }) => {
  const fixture = await createNarrativeFixture(page, { narrative: raw, signedOut: true, sourceUsage: null });
  try {
    await startReading(page, fixture, { complete: false });
    const split = raw.indexOf('Cada paso');
    await fixture.emit('reading', 'delta', { text: raw.slice(0, split) });
    await expect(page.locator('.narrative-stream')).toContainText('tu pregunta.');
    const shelf = page.locator('[data-gesture-shelf]');
    const first = shelf.locator('button').first();
    await expect(first).toBeEnabled();
    await first.press('Enter');
    const occurrence = await first.getAttribute('data-occurrence-id');
    const focus = page.locator('[data-gesture-window]');
    await expect(focus).toHaveAttribute('data-held', 'true');
    await fixture.emit('reading', 'delta', { text: raw.slice(split) });
    await expect(page.locator('.narrative-stream')).toContainText('lo que necesitas hoy.');
    await expect(focus).toHaveAttribute('data-held', 'true');
    await expect(focus).toHaveAttribute('data-association', `identity-${occurrence}`);
    await expect(shelf.locator('button:enabled')).toHaveCount(fixture.requests.reading[0].cardsInfo.length);
    await expect(shelf.locator('[data-introduced="true"]')).toHaveCount(0);
    const mountedPanel = await page.locator('.narrative-panel').elementHandle();
    await fixture.completeReading();
    expect(await mountedPanel.evaluate(node => node.isConnected)).toBe(true);
    await expect(focus).toHaveAttribute('data-held', 'true');
    await expect(focus).toHaveAttribute('data-association', `identity-${occurrence}`);
  } finally { await fixture.close(); }
});

for (const edition of ['rws-immanuelle-vector', 'unknown-edition', 'identity:thoth-a1']) {
test(`normal reading adopts a separate ${edition} cue after prose completion`, async ({ page }) => {
  if (edition === 'identity:thoth-a1') await page.addInitScript(() => localStorage.setItem('tarot-deck-style', 'thoth-a1'));
  const binding = { readingResultId: 'normal-route-visual', sourceRevision: 0,
    spreadHash: 'a'.repeat(64), contextHash: 'b'.repeat(64), artworkEdition: edition, catalogVersion: 'controlled-v1' };
  const fixture = await createNarrativeFixture(page, { narrative: raw, sourceUsage: null,
    startData: { readingResultId: binding.readingResultId, visualBinding: binding, visualJobToken: 'controlled-visual' } });
  try {
    await startReading(page, fixture);
    const requestCards = fixture.requests.reading[0].cardsInfo;
    const cards = requestCards.map((card, index) => ({ index, canonicalName: card.canonicalName || card.card || card.name,
      artworkEdition: binding.artworkEdition }));
    const detail = edition === 'rws-immanuelle-vector' ? getVectorGestureDetails(cards[0].canonicalName)[0] : null;
    if (edition === 'rws-immanuelle-vector') expect(detail).toBeTruthy();
    const result = await applyVisualCueBatch({ ledger: createVisualCueLedger(binding), authoritativeRaw: raw,
      issuedRequest: { binding, batchId: 'normal-route-batch', requestSequence: 1, status: 'active',
        analyzedEnd: raw.length, analyzedHash: await hashVisualCueText(raw), baseLedgerRevision: 0 },
      response: { proposals: [{ localAlias: 'detail', kind: detail ? 'literal' : 'identity', quote: 'un detalle de la imagen',
        targets: [{ spreadIndex: 0, detailIds: detail ? [detail.id] : [] }] }] },
      validationContext: { cards, getSupportedDetails: name => edition === 'rws-immanuelle-vector' ? getVectorGestureDetails(name).map(item => item.id) : [] } });
    expect(result.rejected).toEqual([]);
    await fixture.emit('visual', 'cues', { binding, status: 'complete', cueLedger: result.ledger });
    const phrase = page.locator(`[data-gesture-id="${result.ledger.cues[0].id}"]`);
    await expect(phrase).toHaveCount(1);
    if (detail) await phrase.press('Enter');
    else {
      // Identity mentions remain ordinary prose; the shelf owns whole-card inspection.
      await phrase.scrollIntoViewIfNeeded();
      await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-association', result.ledger.cues[0].id);
      await page.locator('[data-gesture-shelf] button').first().press('Enter');
    }
    await expect(page.locator('[data-focus-card]:enabled')).toHaveAttribute('data-details', detail?.id || '');
    if (!detail) await expect(page.locator('[data-gesture-window] .gesture-art__light')).toHaveCount(0);
    await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
    await expect(page.locator('.narrative-stream')).toContainText('Cada paso pequeño');
    expect(fixture.requests.visual.length).toBeGreaterThan(0);
  } finally { await fixture.close(); }
});
}

test('phone fallback preserves the selected non-RWS deck and reading space @mobile', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tarot-deck-style', 'thoth-a1'));
  const fixture = await createNarrativeFixture(page, { narrative: raw, signedOut: true, sourceUsage: null });
  try {
    await startReading(page, fixture);
    const shelf = page.locator('[data-gesture-shelf]');
    await expect(shelf.locator('button:enabled')).toHaveCount(fixture.requests.reading[0].cardsInfo.length);
    expect(await shelf.locator('img').evaluateAll(nodes => nodes.every(image => image.src.includes('/thoth/')))).toBe(true);
    await shelf.locator('button').first().click();
    await expect(page.locator('[data-focus-card]')).toHaveAttribute('data-details', '');
    await expect(page.locator('[data-gesture-window] .gesture-art__light')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  } finally { await fixture.close(); }
});
