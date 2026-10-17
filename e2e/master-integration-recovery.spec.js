import { test, expect } from './helpers/frontendTest.js';
import { createNarrativeFixture } from './helpers/narrativeFixtures.js';
import { buildReadingSnapshot } from '../src/lib/readingSnapshot.js';
import { getCanonicalCard } from '../src/lib/cardLookup.js';
import { createVisualCueLedger, applyVisualCueBatch } from '../shared/reading/visualCueLedger.js';
import { hashVisualCueText } from '../shared/contracts/visualCueBatches.js';

const RAW = '## Opening\n\nThe Fool holds a white rose. Two of Cups offers a meeting. Three of Swords acknowledges hurt.\n\n## Closing\n\nKeep this private reflection.';
const USER = { id: 'integration-reader', username: 'reader', email: 'reader@example.invalid', subscription_tier: 'pro', subscription_status: 'active' };
const binding = { readingResultId: 'recovery-result', sourceRevision: 0, spreadHash: 'a'.repeat(64), contextHash: 'b'.repeat(64), artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };
const cards = ['The Fool', 'Two of Cups', 'Three of Swords'].map(getCanonicalCard);
async function seed(page, owner, visual = false, expired = false, visualLedger = null) {
  const snapshot = buildReadingSnapshot({ owner, spreadKey: 'threeCard', reading: cards,
    isSpreadDealt: true, revealedCards: new Set([0, 1, 2]), dealIndex: 3, hasConfirmedSpread: true,
    sessionSeed: 'integration-recovery', question: 'A private question', reflections: { Overall: 'A private note' },
    narrative: { raw: RAW, provider: 'local-composer' },
    analysis: { readingMeta: { readingResultId: binding.readingResultId,
      ...((visual || visualLedger) ? { visualBinding: binding, visualStatus: visualLedger ? 'complete' : 'pending', visualSnapshot: visualLedger } : {}) } } });
  await page.addInitScript(({ snapshot, visual, expired, binding }) => {
    if (sessionStorage.getItem('integration-seeded')) return;
    sessionStorage.setItem('integration-seeded', '1');
    localStorage.setItem('tarot-onboarding-complete', 'true');
    sessionStorage.setItem('tarot:reading-snapshot', JSON.stringify(snapshot));
    if (visual) localStorage.setItem(`tarot_visual_resume:anon:${binding.readingResultId}`, JSON.stringify({ binding,
      visualJobToken: 'controlled-private-capability', expiresAt: expired ? 1 : Date.now() + 60000 }));
  }, { snapshot, visual, expired, binding });
}
const snapshot = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('tarot:reading-snapshot') || 'null'));

test('an unresolved auth request cannot render another owner’s restored prose or notes', async ({ page }) => {
  const fixture = await createNarrativeFixture(page, { signedOut: true });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/auth/me', async route => { await gate; await route.fulfill({ json: { user: USER } }); });
  try {
    await seed(page, 'user:previous-reader');
    await page.goto('/');
    await expect(page.getByText('Restoring your reading…')).toBeVisible();
    await expect(page.getByText('Keep this private reflection.')).toHaveCount(0);
    await expect(page.getByText('A private note')).toHaveCount(0);
    release();
    await expect(page.getByText('Restoring your reading…')).toHaveCount(0);
    await expect(page.getByText('Keep this private reflection.')).toHaveCount(0);
    await expect.poll(() => snapshot(page)).toBeNull();
  } finally { release(); await fixture.close(); }
});

test('completed guest prose and notes survive sign-in and save under the new owner', async ({ page }) => {
  const fixture = await createNarrativeFixture(page, { signedOut: true });
  await page.route('**/api/auth/login', route => route.fulfill({ json: { user: USER } }));
  try {
    await seed(page, 'guest');
    await page.goto('/');
    await expect(page.locator('.narrative-stream')).toContainText('Keep this private reflection.');
    await page.getByRole('button', { name: /^Step 2:/ }).click();
    await page.getByRole('button', { name: 'Sign In', exact: true }).filter({ visible: true }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Email', { exact: true }).fill(USER.email);
    await dialog.getByLabel('Password', { exact: true }).fill('fixture-password');
    await dialog.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole('button', { name: /^Step 4:/ }).click();
    await expect(page.locator('.narrative-stream')).toContainText('Keep this private reflection.');
    await page.getByRole('button', { name: 'Save to journal', exact: true }).filter({ visible: true }).click();
    await expect.poll(() => fixture.requests.journal.length).toBe(1);
    expect(fixture.requests.journal[0].personalReading).toBe(RAW);
    expect(fixture.requests.journal[0].reflections.Overall).toBe('A private note');
    expect(fixture.requests.journal[0].visualResume).toBeFalsy();
  } finally { await fixture.close(); }
});

for (const expired of [false, true]) {
  test(`completed prose restores pending visuals with ${expired ? 'expired' : 'valid'} private recovery`, async ({ page }) => {
    const fixture = await createNarrativeFixture(page, { signedOut: true, startData: {
      readingResultId: binding.readingResultId, visualBinding: binding, visualJobToken: 'controlled-private-capability' } });
    try {
      await seed(page, 'guest', true, expired);
      await page.goto('/');
      await expect(page.locator('.narrative-stream')).toContainText('Keep this private reflection.');
      if (expired) {
        await expect.poll(async () => (await snapshot(page))?.analysis?.readingMeta?.visualStatus).toBe('expired');
        expect(fixture.requests.visual).toHaveLength(0);
      } else {
        await expect.poll(() => fixture.connectionGeneration('visual')).toBe(1);
        await page.reload();
        await expect.poll(() => fixture.connectionGeneration('visual')).toBe(2);
        const ledger = createVisualCueLedger(binding);
        ledger.raw = RAW; ledger.analyzedEnd = RAW.length; ledger.analyzedHash = await hashVisualCueText(RAW);
        ledger.ledgerRevision = 1;
        await fixture.emit('visual', 'done', { binding, cueLedger: ledger, status: 'complete', ledgerRevision: 1 });
        await expect.poll(async () => (await snapshot(page))?.analysis?.readingMeta?.visualStatus).toBe('complete');
      }
      expect(fixture.requests.reading).toHaveLength(0);
      expect(JSON.stringify(await snapshot(page))).not.toContain('controlled-private-capability');
    } finally { await fixture.close(); }
  });
}


test('prose inspection opens one full-art dialog in the gesture edition and restores focus', async ({ page }) => {
  const fixture = await createNarrativeFixture(page, { signedOut: true });
  try {
    await seed(page, 'guest');
    await page.goto('/');
    const phrase = page.locator('[data-gesture-id][role="button"]').filter({ hasText: /^The Fool$/ }).first();
    await expect(phrase).toBeAttached();
    await phrase.scrollIntoViewIfNeeded();
    await phrase.click();
    const dialog = page.getByRole('dialog').filter({ visible: true });
    await expect(dialog).toHaveCount(1);
    await expect(dialog.getByRole('img', { name: 'The Fool', exact: true })).toHaveAttribute('src', /rws-vector/);
    await dialog.getByRole('button', { name: 'Next card', exact: true }).click();
    await expect(dialog.getByRole('img', { name: 'Two of Cups', exact: true })).toHaveAttribute('src', /rws-vector/);
    await dialog.getByRole('button', { name: 'Back to reading', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(phrase).toBeFocused();
  } finally { await fixture.close(); }
});


test('a held paired passage opens either card without overlapping mobile dialogs', async ({ page }) => {
  const quote = 'The Fool holds a white rose. Two of Cups offers a meeting.';
  const result = await applyVisualCueBatch({ ledger: createVisualCueLedger(binding), authoritativeRaw: RAW,
    issuedRequest: { binding, batchId: 'pair', requestSequence: 1, status: 'active', analyzedEnd: RAW.length,
      analyzedHash: await hashVisualCueText(RAW), baseLedgerRevision: 0 },
    response: { proposals: [{ localAlias: 'pair', kind: 'relationship', quote,
      targets: [{ spreadIndex: 0, detailIds: [] }, { spreadIndex: 1, detailIds: [] }] }] },
    validationContext: { cards: cards.map((card, index) => ({ index, canonicalName: card.name, artworkEdition: binding.artworkEdition })), getSupportedDetails: () => [] } });
  expect(result.rejected).toEqual([]);
  const fixture = await createNarrativeFixture(page, { signedOut: true });
  try {
    await seed(page, 'guest', false, false, result.ledger);
    await page.goto('/');
    const phrase = page.locator('[data-gesture-id][role="button"]').filter({ hasText: quote }).first();
    await expect(phrase).toBeAttached();
    await phrase.click();
    await page.getByRole('button', { name: 'Open Two of Cups', exact: true }).click();
    const dialog = page.getByRole('dialog').filter({ visible: true });
    await expect(dialog).toHaveCount(1);
    await expect(dialog.getByRole('img', { name: 'Two of Cups', exact: true })).toHaveAttribute('src', /rws-vector/);
    await dialog.getByRole('button', { name: 'Back to reading', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(phrase).toBeFocused();
  } finally { await fixture.close(); }
});
