import { test, expect } from '@playwright/test';
import { createNarrativeFixture, openSetup } from './helpers/narrativeFixtures.js';
import { applyVisualCueBatch, createVisualCueLedger } from '../shared/reading/visualCueLedger.js';
import { hashVisualCueText } from '../shared/contracts/visualCueBatches.js';

test.setTimeout(60000);
const raw = '## Your reading\n\nA patient first step can give you room to listen.';
const note = 'I need room to listen before acting.';
const binding = { readingResultId: 'reflection-reading', sourceRevision: 0,
  spreadHash: 'a'.repeat(64), contextHash: 'b'.repeat(64),
  artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'reflection-test-v1' };

async function reflectedLedger(cards, spreadIndex) {
  const result = await applyVisualCueBatch({ ledger: createVisualCueLedger(binding), authoritativeRaw: raw,
    issuedRequest: { binding, batchId: 'reflection-batch', requestSequence: 1, status: 'active',
      analyzedEnd: raw.length, analyzedHash: await hashVisualCueText(raw), baseLedgerRevision: 0 },
    response: { proposals: [{ localAlias: 'connection', kind: 'relationship', quote: 'A patient first step',
      targets: [{ spreadIndex, detailIds: [] }],
      personalContext: { type: 'card-reflection', spreadIndex, quote: note } }] },
    validationContext: { cards, getSupportedDetails: () => [] } });
  expect(result.rejected).toEqual([]);
  expect(result.ledger.cues[0].personalContext?.quote).toBe(note);
  return result.ledger;
}

async function expectReflectedCue(page, ledger) {
  const phrase = page.locator(`[data-gesture-id="${ledger.cues[0].id}"]`);
  await expect(phrase).toHaveCount(1);
  await phrase.press('Enter');
  await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
  await expect(page.locator('.gesture-context')).toHaveText(`“${note}”`);
}

test('normal reading retains the card note supplied before generation', async ({ page }) => {
  const fixture = await createNarrativeFixture(page, { narrative: raw, sourceUsage: null,
    startData: { readingResultId: binding.readingResultId, visualBinding: binding, visualJobToken: 'controlled-note' } });
  try {
    await openSetup(page);
    await page.locator('#question-input, #quick-intention').filter({ visible: true }).first().fill(fixture.question);
    await page.getByRole('button', { name: /^Draw cards$/ }).filter({ visible: true }).first().click();
    await page.getByRole('button', { name: /^Deal spread/ }).filter({ visible: true }).first().click();
    await page.getByRole('button', { name: /^Reveal next:/ }).filter({ visible: true }).first().click();
    await page.getByRole('region', { name: 'Selected card meaning' }).getByLabel('What resonates for you?').fill(note);
    await page.getByRole('button', { name: /^Reveal all cards/ }).filter({ visible: true }).first().click();
    await page.getByRole('button', { name: /^Interpret cards/ }).filter({ visible: true }).first().press('Enter');
    await fixture.completeReading();
    const requestCards = fixture.requests.reading[0].cardsInfo;
    expect(requestCards[0].userReflection).toBe(note);
    const cards = requestCards.map((card, index) => ({ ...card, index,
      canonicalName: card.canonicalName || card.card || card.name }));
    const ledger = await reflectedLedger(cards, 0);
    await fixture.emit('visual', 'cues', { binding, status: 'complete', cueLedger: ledger });
    await expectReflectedCue(page, ledger);
  } finally { await fixture.close(); }
});

test('journal restoration keeps indexed notes separate for duplicate cards', async ({ page }) => {
  const cards = [0, 1].map(index => ({ index, name: 'The Star', canonicalName: 'The Star',
    position: `Position ${index + 1}`, orientation: 'Upright', userReflection: index === 1 ? note : 'I need movement.' }));
  const ledger = await reflectedLedger(cards, 1);
  const entry = { id: 'saved-card-notes', personalReading: raw, question: 'What deserves attention?',
    cards: cards.map(({ userReflection: _note, ...card }) => card), reflections: { 0: 'I need movement.', 1: note },
    deckId: 'rws-1909', readingResultId: binding.readingResultId, visualBinding: binding,
    visual: { binding, status: 'complete', ledgerRevision: ledger.ledgerRevision, snapshot: ledger } };
  const fixture = await createNarrativeFixture(page, { signedOut: true });
  await page.addInitScript(saved => localStorage.setItem('tarot_journal', JSON.stringify([saved])), entry);
  try {
    await page.goto('/__e2e/journal-visual');
    await expect(page.getByTestId('restored-reading-gestures')).toBeVisible();
    await expectReflectedCue(page, ledger);
  } finally { await fixture.close(); }
});
