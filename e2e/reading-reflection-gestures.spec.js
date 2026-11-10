import { test, expect } from '@playwright/test';
import { createNarrativeFixture, openSetup } from './helpers/narrativeFixtures.js';
import { applyVisualCueBatch, createVisualCueLedger } from '../shared/reading/visualCueLedger.js';
import { hashVisualCueText } from '../shared/contracts/visualCueBatches.js';

test.setTimeout(60000);
const raw = '## Your reading\n\nA patient first step can give you room to listen.';
const cueQuote = 'A patient first step';
const note = 'I need room to listen before acting.';
const binding = { readingResultId: 'reflection-reading', sourceRevision: 0,
  spreadHash: 'a'.repeat(64), contextHash: 'b'.repeat(64),
  artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'reflection-test-v1' };

async function reflectedLedger(cards, spreadIndex) {
  const result = await applyVisualCueBatch({ ledger: createVisualCueLedger(binding), authoritativeRaw: raw,
    issuedRequest: { binding, batchId: 'reflection-batch', requestSequence: 1, status: 'active',
      analyzedEnd: raw.length, analyzedHash: await hashVisualCueText(raw), baseLedgerRevision: 0 },
    response: { proposals: [{ localAlias: 'connection', kind: 'relationship', quote: cueQuote,
      targets: [{ spreadIndex, detailIds: [] }],
      personalContext: { type: 'card-reflection', spreadIndex, quote: note } }] },
    validationContext: { cards, getSupportedDetails: () => [] } });
  expect(result.rejected).toEqual([]);
  expect(result.ledger.cues).toHaveLength(1);
  expect(result.ledger.cues[0].personalContext).toMatchObject({ type: 'card-reflection', spreadIndex, quote: note });
  return result.ledger;
}

test('normal reading retains the card note supplied before generation', async ({ page, isMobile }) => {
  const fixture = await createNarrativeFixture(page, { narrative: raw, sourceUsage: null,
    startData: { readingResultId: binding.readingResultId, visualBinding: binding, visualJobToken: 'controlled-note' } });
  try {
    await openSetup(page);
    await page.locator('#question-input, #quick-intention').filter({ visible: true }).first().fill(fixture.question);
    await page.getByRole('button', { name: /^Draw cards$/ }).filter({ visible: true }).first().click();
    await page.getByRole('button', { name: /^Deal spread/ }).filter({ visible: true }).first().click();
    await page.getByRole('button', { name: /^Reveal next:/ }).filter({ visible: true }).first().click();
    await page.getByRole('region', { name: 'Selected card meaning' }).getByLabel('What resonates for you?').fill(note);
    await page.getByRole('button', { name: /^Reveal remaining cards/ }).filter({ visible: true }).first().click();
    await page.getByRole('button', { name: /^Interpret cards/ }).filter({ visible: true }).first().press('Enter');
    await fixture.completeReading();
    const requestCards = fixture.requests.reading[0].cardsInfo;
    expect(requestCards[0].userReflection).toBe(note);
    const cards = requestCards.map((card, index) => ({ ...card, index,
      canonicalName: card.canonicalName || card.card || card.name }));
    const ledger = await reflectedLedger(cards, 0);
    await fixture.emit('visual', 'cues', { binding, status: 'complete', cueLedger: ledger });
    const phrase = page.locator(`[data-gesture-id="${ledger.cues[0].id}"]`);
    await expect(phrase).toHaveCount(1);
    await expect(phrase).toHaveAttribute('aria-haspopup', 'dialog');
    await phrase.press('Enter');
    const dialog = page.getByRole('dialog').filter({ has: page.locator('[data-reading-full-artwork]') });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(dialog.getByRole('heading', { level: 2 })).toContainText(cards[0].canonicalName);
    await expect(dialog.locator('blockquote')).toHaveText(`“${cueQuote}”`);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(phrase).toBeFocused();

    const notes = page.locator('details.reading-options');
    await notes.locator('summary').click();
    await expect(notes.getByRole('heading', { level: 3 })).toContainText(cards[0].canonicalName);
    await expect(notes.getByText(note, { exact: true })).toBeVisible();
    const contextOpener = page.getByRole('button', { name: 'Your question and notes', exact: true });
    if (isMobile) {
      // The handset reading presents original context inline instead of in the side rail.
      await expect(page.locator('.reading-question p')).toHaveText(fixture.question);
      await expect(contextOpener).toHaveCount(0);
    } else {
      await contextOpener.click();
      const context = page.getByRole('dialog', { name: 'Your question and notes', exact: true });
      await expect(context).toBeVisible();
      await expect(context.locator('[data-personal-context-note]')).toHaveText(note);
      await expect(context.locator('[data-spread-index="0"] [data-personal-context-note]')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(context).toHaveCount(0);
      await expect(contextOpener).toBeFocused();
    }
  } finally { await fixture.close(); }
});

test('journal restoration keeps indexed notes separate for duplicate cards', async ({ page, isMobile }) => {
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
    const narrativeToggle = page.getByRole('button', { name: 'Reading narrative', exact: true });
    await expect(narrativeToggle).toBeVisible();
    if (await narrativeToggle.getAttribute('aria-expanded') === 'false') await narrativeToggle.click();
    await expect(narrativeToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('restored-reading-gestures')).toBeVisible();
    // The restoration fixture has no full-card inspector; its cue stays in the companion.
    const phrase = page.locator(`[data-gesture-id="${ledger.cues[0].id}"]`);
    await expect(phrase).toHaveCount(1);
    await phrase.press('Enter');
    await expect(page.locator('[data-gesture-window]')).toHaveAttribute('data-held', 'true');
    const context = isMobile
      ? page.getByRole('dialog', { name: 'Card detail', exact: true }).locator('.gesture-inspection-context')
      : page.locator('.gesture-context');
    await expect(context).toHaveText(`“${note}”`);
    await expect(context).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-gesture-window]')).not.toHaveAttribute('data-held', 'true');
    await expect(phrase).toBeFocused();
  } finally { await fixture.close(); }
});
