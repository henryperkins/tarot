import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createNarrativeFixture } from './helpers/narrativeFixtures.js';
import { createVisualCueLedger, applyVisualCueBatch } from '../shared/reading/visualCueLedger.js';
import { canonicalVisualCueJSON, hashVisualCueText } from '../shared/contracts/visualCueBatches.js';

// Recorded reading-only prose, deterministic proposals and controlled HTTP SSE.
// No model call, direct client cue injection, live auth or live Worker is involved.
const star = JSON.parse(fs.readFileSync(new URL('../output/reading-motion/fixtures/three-card-transition.json', import.meta.url)));
const raw = star.excerpt;
const cards = star.cards.map((card, index) => ({
  index, canonicalName: card.card, artworkEdition: 'rws-immanuelle-vector'
}));
const quote = 'pouring one pitcher into a pool';

async function visualFixture(page, label) {
  const binding = {
    readingResultId: `controlled-visual-${label}`, sourceRevision: 0,
    spreadHash: await hashVisualCueText(canonicalVisualCueJSON(star.cards)),
    contextHash: await hashVisualCueText(canonicalVisualCueJSON({ question: star.userQuestion, reflections: star.reflectionsText })),
    artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'controlled-acceptance-v1'
  };
  const result = await applyVisualCueBatch({
    ledger: createVisualCueLedger(binding), authoritativeRaw: raw,
    issuedRequest: {
      binding, batchId: 'controlled-batch-1', requestSequence: 1, status: 'active',
      analyzedEnd: raw.length, analyzedHash: await hashVisualCueText(raw), baseLedgerRevision: 0
    },
    response: { proposals: [{ localAlias: 'pool', kind: 'literal', quote, targets: [{ spreadIndex: 2, detailIds: ['pool-pour'] }] }] },
    validationContext: { cards, getSupportedDetails: () => ['pool-pour', 'land-pour'] }
  });
  expect(result.rejected, 'the controlled proposal must pass the actual compiler').toEqual([]);
  expect(result.ledger.cues).toHaveLength(1);
  const fixture = await createNarrativeFixture(page, {
    narrative: raw, question: star.userQuestion, sourceUsage: null,
    startData: { readingResultId: binding.readingResultId, visualBinding: binding, visualJobToken: 'controlled-visual-token' }
  });
  return { fixture, binding, ledger: result.ledger };
}

async function deliverReading(page, fixture, mode) {
  if (mode === 'paced') {
    const ends = [raw.indexOf('That image'), raw.indexOf('Neither pitcher'), raw.length];
    let cursor = 0;
    for (const end of ends) {
      await fixture.emit('reading', 'delta', { text: raw.slice(cursor, end) });
      await expect(page.getByTestId('gesture-source-diagnostics')).toHaveAttribute('data-raw-length', String(end));
      cursor = end;
    }
  } else if (mode === 'burst') {
    await fixture.emit('reading', 'delta', { text: raw });
  }
  // final-only means a done-only job SSE delivery here, not the direct JSON API.
  await fixture.completeReading();
  await expect(page.locator('.narrative-stream__text')).toHaveText(raw);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tarot-onboarding-complete', 'true'));
});

for (const mode of ['paced', 'burst', 'final-only']) {
  test(`${mode}: independent late cues reach the completed reading through ReadingContext`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1100, height: 1000 });
    const { fixture, binding, ledger } = await visualFixture(page, mode);
    try {
      await page.goto('/__e2e/reading-gestures?associations=dynamic&sourceMode=job-sse');
      // Nothing is ever sent to the visual channel until prose is complete.
      await deliverReading(page, fixture, mode);
      await testInfo.attach('controlled-delivery.json', { contentType: 'application/json', body: JSON.stringify({
        mode, scope: 'mock Pro auth; controlled job SSE; real ReadingContext and gesture renderer',
        sourceRun: star.provenance.sourceRun, excerptSha256: await hashVisualCueText(raw),
        narrativeCompletedBeforeVisualRelease: true, visualRequests: fixture.requests.visual,
        observedRunId: await page.getByTestId('gesture-source-diagnostics').getAttribute('data-run-id')
      }, null, 2) });
      await expect.poll(() => fixture.connected('visual'), {
        message: 'ReadingContext must keep an independent visual subscription after narrative completion', timeout: 5000
      }).toBeGreaterThan(0);

      await fixture.emit('visual', 'cues', {
        // ReadingVisualJob publishes the complete validated source-bound ledger.
        binding, ledgerRevision: ledger.ledgerRevision,
        addedCueIds: ledger.cues.map(cue => cue.id), cues: ledger.cues,
        introductions: ledger.introductions, cueLedger: ledger, status: 'running',
        timing: { availableAt: 0, annotationStartedAt: 0, annotationFinishedAt: 0, ledgerCommittedAt: 0 }
      });
      const diagnostics = page.getByTestId('gesture-source-diagnostics');
      await expect(diagnostics).toHaveAttribute('data-run-id', binding.readingResultId);
      await expect(diagnostics).toHaveAttribute('data-ledger-revision', String(ledger.ledgerRevision));
      const phrase = page.locator(`[data-gesture-id="${ledger.cues[0].id}"]`);
      await expect(phrase).toBeVisible();
      await phrase.click();
      await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
      await expect(page.locator('.narrative-stream__text')).toHaveText(raw);
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-gesture-window]')).not.toHaveAttribute('data-held', 'true');
      await fixture.emit('visual', 'done', { binding, cueLedger: ledger, status: 'complete', ledgerRevision: ledger.ledgerRevision });
    } finally { await fixture.close(); }
  });
}

test('reading-only delivery remains complete with no visual capability', async ({ page }) => {
  const fixture = await createNarrativeFixture(page, { narrative: raw, question: star.userQuestion, sourceUsage: null });
  try {
    await page.goto('/__e2e/reading-gestures?associations=dynamic&sourceMode=job-sse');
    await deliverReading(page, fixture, 'final-only');
    expect(fixture.requests.visual).toEqual([]);
    await expect(page.getByTestId('gesture-source-diagnostics')).toHaveAttribute('data-source-status', 'complete');
  } finally { await fixture.close(); }
});

test('a cue arriving ahead of prose waits for its exact source; duplicates and foreign results cannot replace it', async ({ page }) => {
  const { fixture, binding, ledger } = await visualFixture(page, 'ahead');
  try {
    await page.goto('/__e2e/reading-gestures?associations=dynamic&sourceMode=job-sse');
    await fixture.emit('reading', 'delta', { text: raw.slice(0, 170) });
    await expect.poll(() => fixture.connected('visual')).toBeGreaterThan(0);
    await fixture.emit('visual', 'cues', { binding, cueLedger: ledger, status: 'running' });
    await expect(page.locator('[data-gesture-id^="vc:"]')).toHaveCount(0);
    await fixture.completeReading();
    const phrase = page.locator(`[data-gesture-id="${ledger.cues[0].id}"]`);
    await phrase.click();
    const stage = page.locator('[data-gesture-window]');
    await expect(stage).toHaveAttribute('data-held', 'true');
    const foreign = { ...binding, readingResultId: 'another-reading' };
    await fixture.emit('visual', 'cues', { binding: foreign, cueLedger: { ...ledger, binding: foreign, cues: [] }, status: 'running' });
    await fixture.emit('visual', 'cues', { binding, cueLedger: createVisualCueLedger(binding), status: 'running' });
    await fixture.emit('visual', 'cues', { binding, cueLedger: ledger, status: 'running' });
    await expect(stage).toHaveAttribute('data-association', ledger.cues[0].id);
    await expect(stage).toHaveAttribute('data-held', 'true');
    await expect(phrase).toBeFocused();
    await fixture.emit('visual', 'done', { binding, cueLedger: ledger, status: 'complete' });
  } finally { await fixture.close(); }
});

test('clean visual EOF adopts the complete snapshot through fallback after narrative completion', async ({ page }) => {
  const { fixture, binding, ledger } = await visualFixture(page, 'fallback');
  try {
    await page.goto('/__e2e/reading-gestures?associations=dynamic&sourceMode=job-sse');
    await deliverReading(page, fixture, 'final-only');
    await expect.poll(() => fixture.connected('visual')).toBeGreaterThan(0);
    fixture.setVisualSnapshot({ binding, cueLedger: ledger, ledgerRevision: ledger.ledgerRevision, status: 'complete', eventId: 3 });
    fixture.disconnect('visual');
    await expect(page.locator(`[data-gesture-id="${ledger.cues[0].id}"]`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.narrative-stream__text')).toHaveText(raw);
  } finally { await fixture.close(); }
});

test('replacement prose rejects old visual results and reconnects with the new source revision', async ({ page }) => {
  const { fixture, binding, ledger } = await visualFixture(page, 'replacement');
  try {
    await page.goto('/__e2e/reading-gestures?associations=dynamic&sourceMode=job-sse');
    await fixture.emit('reading', 'delta', { text: raw });
    await expect.poll(() => fixture.connected('visual')).toBeGreaterThan(0);
    await fixture.emit('visual', 'cues', { binding, cueLedger: ledger, status: 'running' });
    await page.locator(`[data-gesture-id="${ledger.cues[0].id}"]`).click();
    const replacement = 'The Tower invites a pause before making a new commitment.';
    await fixture.emit('reading', 'snapshot', { fullText: replacement });
    await expect(page.getByTestId('gesture-source-diagnostics')).toHaveAttribute('data-source-revision', '1');
    await fixture.emit('visual', 'cues', { binding, cueLedger: ledger, status: 'running' });
    await expect(page.locator('[data-gesture-id^="vc:"]')).toHaveCount(0);
    await expect(page.locator('[data-gesture-window]')).not.toHaveAttribute('data-held', 'true');
    await expect(page.locator('.narrative-stream__text')).toHaveText(replacement);
  } finally { await fixture.close(); }
});

test('held inspection survives continuing prose and a cross-batch interpretation', async ({ page }) => {
  const { fixture, binding } = await visualFixture(page, 'held');
  const prefix = raw.slice(0, raw.indexOf('That image'));
  const compile = async (ledger, source, proposals) => {
    const result = await applyVisualCueBatch({ ledger, authoritativeRaw: source,
      issuedRequest: { binding, batchId: `held-${ledger.receipts.length}`, requestSequence: ledger.receipts.length + 1,
        analyzedEnd: source.length, analyzedHash: await hashVisualCueText(source), baseLedgerRevision: ledger.ledgerRevision, status: 'active' },
      response: { proposals }, validationContext: { cards, getSupportedDetails: () => ['pool-pour'] } });
    expect(result.rejected).toEqual([]);
    return result.ledger;
  };
  const literal = await compile(createVisualCueLedger(binding), prefix, [{ localAlias: 'pool', kind: 'literal', quote,
    targets: [{ spreadIndex: 2, detailIds: ['pool-pour'] }] }]);
  const returned = await compile(literal, raw, [{ localAlias: 'memory', kind: 'interpretation',
    quote: 'One hand tends the emotional reservoir of memory and the people back home',
    targets: [{ spreadIndex: 2, detailIds: ['pool-pour'] }], establishedBy: [{ acceptedCueId: literal.cues[0].id }] }]);
  try {
    await page.setViewportSize({ width: 1100, height: 1000 });
    await page.goto('/__e2e/reading-gestures?associations=dynamic&sourceMode=job-sse');
    await fixture.emit('reading', 'delta', { text: prefix });
    await expect.poll(() => fixture.connected('visual')).toBeGreaterThan(0);
    await fixture.emit('visual', 'cues', { binding, cueLedger: literal, status: 'running' });
    await page.locator(`[data-gesture-id="${literal.cues[0].id}"]`).click();
    await fixture.completeReading();
    await fixture.emit('visual', 'cues', { binding, cueLedger: returned, status: 'running' });
    await expect(page.locator(`[data-gesture-id="${returned.cues[1].id}"]`)).toBeVisible();
    const stage = page.locator('[data-gesture-window]');
    await expect(stage).toHaveAttribute('data-association', literal.cues[0].id);
    await expect(stage).toHaveAttribute('data-held', 'true');
    await expect(page.locator('.narrative-stream__text')).toHaveText(raw);
    await page.keyboard.press('Escape');
    await expect(stage).toHaveAttribute('data-association', returned.cues[1].id);
  } finally { await fixture.close(); }
});

test('authoritative done revision replaces an unseen suffix and accepts only that revision', async ({ page }) => {
  const { fixture, binding, ledger } = await visualFixture(page, 'authoritative');
  const revisedBinding = { ...binding, sourceRevision: 1 };
  const revised = await applyVisualCueBatch({ ledger: createVisualCueLedger(revisedBinding), authoritativeRaw: raw,
    issuedRequest: { binding: revisedBinding, batchId: 'revised-1', requestSequence: 1, status: 'active',
      analyzedEnd: raw.length, analyzedHash: await hashVisualCueText(raw), baseLedgerRevision: 0 },
    response: { proposals: [{ localAlias: 'pool', kind: 'literal', quote, targets: [{ spreadIndex: 2, detailIds: ['pool-pour'] }] }] },
    validationContext: { cards, getSupportedDetails: () => ['pool-pour'] } });
  expect(revised.rejected).toEqual([]);
  try {
    await page.goto('/__e2e/reading-gestures?associations=dynamic&sourceMode=job-sse');
    const prefix = raw.slice(0, raw.indexOf('A figure'));
    await fixture.emit('reading', 'delta', { text: prefix, visualBinding: binding });
    await expect(page.getByTestId('gesture-source-diagnostics')).toHaveAttribute('data-raw-length', String(prefix.length));
    await expect.poll(() => fixture.connected('visual')).toBeGreaterThan(0);
    const beforeRevision = fixture.connectionGeneration('visual');
    // The client cannot infer the server's replaced, buffered suffix from this
    // valid shared prefix. Its source identity must follow the trusted event.
    await fixture.emit('reading', 'done', { fullText: raw, visualBinding: revisedBinding });
    await expect(page.getByTestId('gesture-source-diagnostics')).toHaveAttribute('data-source-revision', '1');
    // This controlled server does not replay snapshots on connection. Wait for
    // the new binding's subscription before releasing its saved cue envelope.
    await expect.poll(() => fixture.connected('visual', beforeRevision)).toBeGreaterThan(0);
    await fixture.emit('visual', 'cues', { binding, cueLedger: ledger, status: 'running' });
    await fixture.emit('visual', 'cues', { binding: revisedBinding, cueLedger: revised.ledger, status: 'running' });
    await expect(page.locator(`[data-gesture-id="${revised.ledger.cues[0].id}"]`)).toBeVisible();
    await expect(page.locator(`[data-gesture-id="${ledger.cues[0].id}"]`)).toHaveCount(0);
  } finally { await fixture.close(); }
});

test('late independent cues remain static and revisitable on a reduced-motion phone @mobile', async ({ page }, testInfo) => {
  const diagnostics = [];
  page.on('console', message => { if (message.type() === 'error') diagnostics.push(message.text()); });
  page.on('requestfailed', request => diagnostics.push(`${new URL(request.url()).pathname}: ${request.failure()?.errorText}`));
  const { fixture, binding, ledger } = await visualFixture(page, 'phone');
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/__e2e/reading-gestures?associations=dynamic&sourceMode=job-sse');
    await deliverReading(page, fixture, 'final-only');
    await expect.poll(() => fixture.connected('visual')).toBeGreaterThan(0);
    await fixture.emit('visual', 'cues', { binding, cueLedger: ledger, status: 'running' });
    const phrase = page.locator(`[data-gesture-id="${ledger.cues[0].id}"]`);
    await phrase.scrollIntoViewIfNeeded();
    await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-phase', 'static');
    await phrase.click();
    await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
    expect(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await testInfo.attach('controlled-phone-diagnostics', { body: JSON.stringify({ diagnostics, readingRequests: fixture.requests.reading.length }), contentType: 'application/json' });
    await fixture.close();
  }
});
