import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createNarrativeFixture } from './helpers/narrativeFixtures.js';
import { applyVisualCueBatch, createVisualCueLedger } from '../shared/reading/visualCueLedger.js';
import { hashVisualCueText } from '../shared/contracts/visualCueBatches.js';

const star = JSON.parse(fs.readFileSync(new URL('../output/reading-motion/fixtures/three-card-transition.json', import.meta.url)));
const binding = { readingResultId: 'controlled-journal-star', sourceRevision: 0,
  spreadHash: 'a'.repeat(64), contextHash: 'b'.repeat(64), artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'controlled-journal-v1' };
async function completedLedger() {
  const result = await applyVisualCueBatch({ ledger: createVisualCueLedger(binding), authoritativeRaw: star.excerpt,
    issuedRequest: { binding, batchId: 'journal-batch', requestSequence: 1, status: 'active', analyzedEnd: star.excerpt.length,
      analyzedHash: await hashVisualCueText(star.excerpt), baseLedgerRevision: 0 },
    response: { proposals: [{ localAlias: 'pool', kind: 'literal', quote: 'pouring one pitcher into a pool',
      targets: [{ spreadIndex: 2, detailIds: ['pool-pour'] }] }] },
    validationContext: { cards: star.cards.map((card, index) => ({ index, canonicalName: card.card })),
      getSupportedDetails: () => ['pool-pour', 'land-pour'] } });
  expect(result.rejected).toEqual([]);
  return result.ledger;
}

async function inspectStatic(page, cue) {
  const restored = page.getByTestId('restored-reading-gestures');
  await expect(restored).toBeVisible();
  const phrase = page.locator(`[data-gesture-id="${cue.id}"]`);
  await expect(phrase).toBeVisible();
  await expect(restored.locator('[data-gesture-window]')).not.toHaveAttribute('data-phase', /active|settling/);
  await phrase.click();
  await expect(restored.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
  await expect(restored.locator('[data-gesture-window]')).toHaveAttribute('data-phase', 'held');
  await expect(restored.locator('[data-focus-card]')).toHaveAttribute('data-details', 'pool-pour');
  expect(await restored.evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === 'running').length)).toBe(0);
  await page.keyboard.press('Escape');
  await expect(restored.locator('[data-gesture-window]')).not.toHaveAttribute('data-held', 'true');
  await expect(restored.locator('.narrative-stream__text')).toHaveText(star.excerpt);
}

for (const reducedMotion of ['reduce', 'no-preference']) {
  test(`local pending save reload resumes cues and revisits statically (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    const ledger = await completedLedger();
    const fixture = await createNarrativeFixture(page, { signedOut: true, startData: { readingResultId: binding.readingResultId } });
    try {
      await page.goto('/__e2e/journal-visual');
      await page.getByRole('button', { name: 'Save pending reading' }).click();
      await expect(page.getByTestId('journal-count')).toHaveText('1');
      const stored = await page.evaluate(() => localStorage.getItem('tarot_journal'));
      expect(stored).toContain(star.excerpt.slice(0, 40));
      expect(stored).not.toContain('controlled-private-resume');
      expect(stored).not.toContain('visualJobToken');
      await expect.poll(() => fixture.connected('visual')).toBeGreaterThan(0);
      const beforeReload = fixture.connectionGeneration('visual');
      await page.reload();
      await expect(page.getByTestId('journal-count')).toHaveText('1');
      // A pre-reload server socket may outlive its document until close fires.
      // Wait for a new accepted connection, not merely a nonempty client set.
      await expect.poll(() => fixture.connected('visual', beforeReload)).toBeGreaterThan(0);
      const envelope = { binding, cueLedger: ledger, status: 'complete' };
      fixture.setVisualSnapshot(envelope);
      await fixture.emit('visual', 'cues', envelope);
      await inspectStatic(page, ledger.cues[0]);
      const latest = await page.evaluate(() => JSON.parse(localStorage.getItem('tarot_journal'))[0]);
      expect(latest.visual.ledgerRevision).toBe(1);
      await page.reload();
      await inspectStatic(page, ledger.cues[0]);
    } finally { await fixture.close(); }
  });
}

test('cloud restore uses latest owned journal snapshot with static revisit', async ({ page }) => {
  const ledger = await completedLedger();
  const fixture = await createNarrativeFixture(page);
  const saved = { id: 'cloud-star', ts: Date.now(), personalReading: star.excerpt, question: star.userQuestion,
    reflections: star.reflectionsText, cards: star.cards.map(card => ({ name: card.card, position: card.position,
      orientation: card.orientation })), deckId: 'rws-1909', readingResultId: binding.readingResultId,
    visual: { readingResultId: binding.readingResultId, binding, status: 'pending', ledgerRevision: 0, snapshot: null } };
  await page.route('**/api/journal?*', route => route.fulfill({ json: { entries: [saved], pagination: { hasMore: false } } }));
  await page.route('**/api/journal/cloud-star?*', route => route.fulfill({ json: { entry: { ...saved,
    visual: { ...saved.visual, status: 'complete', ledgerRevision: 1, snapshot: ledger } } } }));
  try {
    await page.goto('/__e2e/journal-visual');
    await expect(page.getByTestId('journal-count')).toHaveText('1');
    await inspectStatic(page, ledger.cues[0]);
    expect(fixture.requests.visual).toHaveLength(0);
  } finally { await fixture.close(); }
});

test('restored gestures protect phone reading width @mobile', async ({ page }) => {
  const ledger = await completedLedger();
  const fixture = await createNarrativeFixture(page, { signedOut: true });
  await page.addInitScript(({ binding, ledger, star }) => {
    localStorage.setItem('tarot_journal', JSON.stringify([{ id: 'phone-star', personalReading: star.excerpt,
      question: star.userQuestion, cards: star.cards.map(card => ({ name: card.card, position: card.position, orientation: card.orientation })),
      readingResultId: binding.readingResultId, visualBinding: binding,
      visual: { binding, status: 'complete', ledgerRevision: 1, snapshot: ledger } }]));
  }, { binding, ledger, star });
  try {
    await page.goto('/__e2e/journal-visual');
    await page.getByRole('button', { name: 'Reading narrative' }).click();
    await inspectStatic(page, ledger.cues[0]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await fixture.close(); }
});
