import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createNarrativeFixture } from './helpers/narrativeFixtures.js';
import { applyVisualCueBatch, createVisualCueLedger } from '../shared/reading/visualCueLedger.js';
import { hashVisualCueText } from '../shared/contracts/visualCueBatches.js';
import { publicVisualSnapshot, savedVisualSource, writeVisualResume } from '../src/lib/readingVisualStorage.js';
import { fingerprintSavedVisualSource, loadOwnedJournalVisualSource, loadJournalVisualState, attachJournalVisualResult } from '../functions/lib/readingVisualResults.js';
import { normalizeVisualSource } from '../shared/reading/visualSourceIdentity.js';
import { acceptedLedger, createRecoveryBackend as createBackend, sourceBinding, STAR as RECOVERY_STAR, STAR_PROPOSALS, starEntry } from './helpers/journalVisualRecoveryBridge.mjs';

// Every recovery lane fails on an unexpected page error. The only allowed one is
// the duplicate-tab init script touching localStorage from its about:blank page.
const backends = [];
const createRecoveryBackend = async (...args) => { const backend = await createBackend(...args); backends.push(backend); return backend; };
const EXPECTED_PAGE_ERROR = /SecurityError: Failed to read the 'localStorage' property from 'Window'/;
test.afterEach(async ({ page: _page }, testInfo) => {
  const unexpected = backends.splice(0).flatMap(backend => backend.pageErrors).filter(error => !EXPECTED_PAGE_ERROR.test(error));
  if (testInfo.status === testInfo.expectedStatus && unexpected.length) throw new Error(`Unexpected page errors: ${unexpected.join(' | ')}`);
});

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

// Wrapped inline cues have separate painted fragments; their union center may
// hit a neighboring cue. Find an exposed fragment, then use the native pointer
// action with normal visibility, stability, enabled and hit-target checks.
async function clickForeground(locator) {
  await expect(locator).toBeVisible();
  await locator.evaluate(element => element.scrollIntoView({
    block: 'nearest', inline: 'nearest', behavior: 'instant'
  }));
  let position = null;
  await expect.poll(async () => {
    position = await locator.evaluate(element => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const borderLeft = parseFloat(style.borderLeftWidth) || 0;
      const borderTop = parseFloat(style.borderTopWidth) || 0;
      for (const fragment of element.getClientRects()) {
        const left = Math.max(0, fragment.left), right = Math.min(innerWidth, fragment.right);
        const top = Math.max(0, fragment.top), bottom = Math.min(innerHeight, fragment.bottom);
        if (right <= left || bottom <= top) continue;
        const x = (left + right) / 2, y = (top + bottom) / 2;
        if (element.contains(document.elementFromPoint(x, y))) {
          // Playwright's click position is relative to the padding-box origin.
          return { x: x - box.left - borderLeft, y: y - box.top - borderTop };
        }
      }
      return null;
    });
    return Boolean(position);
  }, { timeout: 5000 }).toBe(true);
  await locator.click({ position });
}

// Phone layouts start with the narrative collapsed; expand only when needed.
async function expandNarrative(page) {
  const toggle = page.getByRole('button', { name: 'Reading narrative' }).first();
  await expect(toggle).toBeVisible();
  if (await toggle.getAttribute('aria-expanded') === 'false') await clickForeground(toggle);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

async function inspectStatic(page, cue) {
  await expandNarrative(page);
  const restored = page.getByTestId('restored-reading-gestures');
  await expect(restored).toBeVisible();
  const phrase = page.locator(`[data-gesture-id="${cue.id}"]`);
  await expect(phrase).toBeVisible();
  await expect(restored.locator('[data-gesture-window]')).not.toHaveAttribute('data-phase', /active|settling/);
  await clickForeground(phrase);
  // Phone inspection portals the same static artwork into the active dialog.
  const inspection = page.locator('[data-gesture-window]').filter({ visible: true });
  await expect(inspection).toHaveCount(1);
  await expect(inspection).toHaveAttribute('data-held', 'true');
  await expect(inspection).toHaveAttribute('data-phase', /^(held|static)$/);
  await expect(inspection.locator('[data-focus-card]')).toHaveAttribute('data-details', 'pool-pour');
  expect(await runningAnimations(inspection)).toEqual([]);
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
      await expandNarrative(page);
      await expect.poll(() => fixture.connected('visual')).toBeGreaterThan(0);
      // Task 11: pending original work resumes; status only, no inference action.
      await expect(page.getByTestId('saved-visual-recovery')).toHaveAttribute('data-recovery-phase', 'pending');
      await expect(page.getByRole('button', { name: 'Retry card connections' })).toHaveCount(0);
      const beforeReload = fixture.connectionGeneration('visual');
      await page.reload();
      await expect(page.getByTestId('journal-count')).toHaveText('1');
      await expandNarrative(page);
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
      await expect(page.getByRole('button', { name: 'Retry card connections' })).toHaveCount(0);
      // Mount, save, reload and stream reconnect never request annotation work.
      expect(fixture.requests.visual.every(request => request.method === 'GET')).toBe(true);
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
    await expandNarrative(page);
    await inspectStatic(page, ledger.cues[0]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await fixture.close(); }
});

// ---------------------------------------------------------------------------
// Task 11: saved-visual recovery through the real /journal parent, entry card
// and journal hook. Backend: real Task 9/10 handlers + in-process SQLite D1 +
// real ReadingVisualJob DO class (journalVisualRecoveryBridge.mjs). MOCKED:
// provider receipts, fixture users/tiers/sessions, trusted guest identity and
// the guest principal cookie jar. Motion follows the project (normal/reduced).
// ---------------------------------------------------------------------------

const FAKE_ORIGINAL = { readingResultId: 'expired-original', sourceRevision: 0, spreadHash: 'c'.repeat(64), contextHash: 'd'.repeat(64),
  artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };
const pendingOriginal = () => ({ readingResultId: FAKE_ORIGINAL.readingResultId, visualBinding: FAKE_ORIGINAL,
  visual: { readingResultId: FAKE_ORIGINAL.readingResultId, binding: FAKE_ORIGINAL, status: 'pending', sourceRevision: 0, ledgerRevision: 0, snapshot: null } });
const sha256 = text => createHash('sha256').update(text).digest('hex');
const recoveryOf = card => card.getByTestId('saved-visual-recovery');
const retryOf = card => card.getByRole('button', { name: 'Retry card connections' });
const READY = 'Card connections are ready.';
const UNAVAILABLE = 'Your reading is saved. Card connections are unavailable.';

async function prepareJournal(page, { key = 'tarot_journal', entries = [] } = {}) {
  await page.context().addInitScript(({ key, entries }) => {
    localStorage.setItem('tarot-onboarding-complete', 'true');
    // Seed once per browser context; reloads and second tabs keep app writes.
    if (!localStorage.getItem('__task11_seeded')) {
      localStorage.setItem('__task11_seeded', 'true');
      if (entries.length) localStorage.setItem(key, JSON.stringify(entries));
    }
    const automaticAdoptions = [];
    let last = '';
    const sample = () => {
      for (const stage of document.querySelectorAll('[data-testid="restored-reading-gestures"] [data-gesture-window]')) {
        const cueId = stage.dataset.association;
        const origin = stage.dataset.held === 'true' ? 'explicit' : stage.dataset.phase === 'static' ? 'static' : 'automatic';
        const sampleKey = `${cueId}:${origin}:${stage.dataset.phase}`;
        // Same classification as the qualification browser collector.
        if (cueId && origin === 'automatic' && sampleKey !== last) automaticAdoptions.push({ cueId, phase: stage.dataset.phase, at: performance.now() });
        last = sampleKey;
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    window.__journalCueMonitor = { automaticAdoptions };
  }, { key, entries });
}

const entryCard = (page, id) => page.locator(`[id="journal-entry-${id}"] article`);
async function openEntry(page, id, { centerEntryToggle = false } = {}) {
  const card = entryCard(page, id);
  await expect(card).toBeVisible({ timeout: 20000 });
  const toggle = card.locator('button[aria-controls]:not([aria-haspopup])').first();
  if (await toggle.getAttribute('aria-expanded') === 'false') {
    // Duplicate-tab setup positions the control before the native click's
    // stability wait. Keep foreground hit-testing and native input unchanged.
    if (centerEntryToggle) {
      await toggle.evaluate(element => element.scrollIntoView({
        block: 'center', inline: 'nearest', behavior: 'instant'
      }));
    } else {
      await toggle.scrollIntoViewIfNeeded();
    }
    await clickForeground(toggle);
  }
  const narrative = card.getByRole('button', { name: 'Reading narrative' });
  await expect(narrative).toBeVisible();
  if (await narrative.getAttribute('aria-expanded') === 'false') {
    await narrative.scrollIntoViewIfNeeded();
    await clickForeground(narrative);
  }
  return card;
}

async function motionReport(page, testInfo, label) {
  const report = await page.evaluate(() => ({ reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    automaticAdoptions: window.__journalCueMonitor?.automaticAdoptions || [] }));
  await testInfo.attach(`motion-${label}.json`, { body: JSON.stringify({ project: testInfo.project.name, ...report }, null, 2), contentType: 'application/json' });
  expect(report.reducedMotion).toBe(testInfo.project.use?.contextOptions?.reducedMotion === 'reduce');
  expect(report.automaticAdoptions).toEqual([]);
}

const focusCards = restored => restored.locator('[data-gesture-window] .gesture-focus-layer:not(.gesture-focus-layer--departing) [data-focus-card]');
// Zero running animations while held; a failure names each one for diagnosis.
// The app's global reduced-motion rule (src/styles/tarot.css) clamps every
// transition to 0.01ms; WebKit reports those instantaneous style changes as
// running CSSTransitions at currentTime 0. They are not motion, so only that
// exact clamp is excluded; any real-duration animation or transition fails.
const runningAnimations = restored => restored.evaluate(root => root.getAnimations({ subtree: true })
  .filter(animation => animation.playState === 'running' && !(typeof CSSTransition !== 'undefined'
    && animation instanceof CSSTransition && Number(animation.effect?.getTiming?.().duration) <= 0.01)).map(animation => {
    const target = animation.effect?.target;
    const timing = animation.effect?.getTiming?.() || {};
    return { type: animation.constructor?.name || 'Animation', name: animation.animationName || animation.transitionProperty || null,
      target: target ? [target.tagName?.toLowerCase(), String(target.className?.baseVal ?? target.className ?? '').trim().split(/\s+/).slice(0, 2).join('.'),
        target.hasAttribute?.('data-gesture-finite') ? 'finite' : '', target.hasAttribute?.('data-gesture-water') ? 'water' : ''].filter(Boolean).join(' ') : null,
      currentTime: Math.round(Number(animation.currentTime) || 0), duration: timing.duration ?? null, iterations: timing.iterations ?? null };
  }));
async function inspectRecovered(page, card) {
  const restored = card.getByTestId('restored-reading-gestures');
  const stage = restored.locator('[data-gesture-window]');
  await expect(restored).toBeVisible();
  await expect(stage).not.toHaveAttribute('data-phase', /active|settling/);
  // Literal, then the grounded same-card pair, each held and released by keyboard.
  for (const [quote, details] of [['one pitcher into a pool', ['pool-pour']], ['Neither pitcher gets dropped.', ['land-pour', 'pool-pour']]]) {
    const phrase = restored.locator('[data-gesture-id]').filter({ hasText: quote }).first();
    await clickForeground(phrase);
    await expect(stage).toHaveAttribute('data-held', 'true');
    await expect(stage).toHaveAttribute('data-phase', 'held');
    await expect.poll(async () => (await focusCards(restored).first().getAttribute('data-details') || '').split(' ').filter(Boolean).sort()).toEqual(details);
    expect(await runningAnimations(restored)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(stage).not.toHaveAttribute('data-held', 'true');
  }
  // Whole-card identity inspection from the shelf.
  const shelfCard = restored.locator('[data-gesture-shelf] button').nth(2);
  // Nearest-edge scrolling can leave the shelf behind the sticky phone header.
  // Position the actual card first; the unchanged foreground/native click must
  // still establish an exposed fragment and pass normal actionability checks.
  await shelfCard.evaluate(element => element.scrollIntoView({
    block: 'center', inline: 'nearest', behavior: 'instant'
  }));
  await clickForeground(shelfCard);
  await expect(stage).toHaveAttribute('data-held', 'true');
  await expect(focusCards(restored).first()).toHaveAttribute('data-details', '');
  await page.keyboard.press('Escape');
  await expect(stage).not.toHaveAttribute('data-held', 'true');
  await expect(restored.locator('.narrative-stream__text')).toHaveText(RECOVERY_STAR.excerpt);
}

async function privateValues(page) {
  return page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('tarot_visual_resume:'))
    .flatMap(key => { const record = JSON.parse(localStorage.getItem(key)); return [record.visualJobToken, record.visualJobId, record.attemptId].filter(Boolean); }));
}
async function expectNoPrivateExposure(page, values, journalKey) {
  const exposed = await page.evaluate(({ values, journalKey }) => {
    const journal = localStorage.getItem(journalKey) || '';
    const dom = document.documentElement.outerHTML;
    return values.filter(value => journal.includes(value) || dom.includes(value));
  }, { values, journalKey });
  expect(exposed).toEqual([]);
}
// The journal shows its user chip only below the sm breakpoint; cross it if needed.
async function signOut(page) {
  const visibleMenu = () => page.locator('button[aria-label^="User menu for"]').filter({ visible: true }).first();
  let restore = null;
  if (!await visibleMenu().count()) {
    restore = page.viewportSize();
    await page.setViewportSize({ width: restore.width >= 640 ? 600 : 800, height: restore.height });
  }
  await clickForeground(visibleMenu());
  const item = page.getByRole('menuitem', { name: 'Sign Out' });
  await expect(item).toBeVisible();
  await clickForeground(item);
  await expect(page.locator('button[aria-label^="User menu for"]')).toHaveCount(0);
  if (restore) await page.setViewportSize(restore);
}
const ownerLeftovers = (page, userId) => page.evaluate(id => Object.keys(localStorage)
  .filter(key => key === `tarot_journal_cache_${id}` || key.startsWith(`tarot_visual_resume:user:${id}`)), userId);

const storedEntry = (page, key, id) => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key) || '[]').find(item => item.id === id) || null, { key, id });

async function historicalStaticEntry(id) {
  const entry = starEntry({ id });
  const binding = await sourceBinding(entry, `${id}-historical`);
  const ledger = await acceptedLedger(binding, entry.personalReading, STAR_PROPOSALS);
  return { ...entry, readingResultId: binding.readingResultId, visualBinding: binding,
    visual: { readingResultId: binding.readingResultId, binding, status: 'expired', sourceRevision: 0,
      ledgerRevision: ledger.ledgerRevision, snapshot: ledger } };
}

test('guest local expiry: explicit retry admits no new work and historical static cues survive reload', async ({ page }, testInfo) => {
  const backend = await createRecoveryBackend(page.context());
  const entry = await historicalStaticEntry('guest-star');
  try {
    await prepareJournal(page, { entries: [entry] });
    await page.goto('/journal');
    const card = await openEntry(page, entry.id);
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'eligible');
    await expect(recoveryOf(card).getByRole('status')).toHaveText(UNAVAILABLE);
    expect(backend.retryPosts()).toHaveLength(0);
    expect(backend.transportRequests()).toHaveLength(0);
    // Keyboard activation of the explicit action.
    await retryOf(card).focus();
    await page.keyboard.press('Enter');
    await expect(recoveryOf(card).getByRole('status')).toHaveText(UNAVAILABLE, { timeout: 20000 });
    await expect(recoveryOf(card).getByRole('status')).toBeFocused();
    expect(backend.retryPosts().map(item => item.path)).toEqual(['/api/tarot-reading/visual-retry']);
    expect(backend.transportRequests().every(item => item.method === 'GET')).toBe(true);
    expect(backend.providerCalls()).toBe(0);
    expect(backend.db.rows('SELECT id FROM visual_retry_claims')).toHaveLength(0);
    await expect(retryOf(card)).toHaveCount(0);
    await inspectRecovered(page, card);
    const stored = await storedEntry(page, 'tarot_journal', entry.id);
    expect(sha256(stored.personalReading)).toBe(sha256(entry.personalReading));
    expect(stored.visualState).toMatchObject({ retryStatus: 'unavailable', reason: 'configuration-unavailable' });
    expect(Object.keys(stored.visualState).sort()).toEqual(['attachmentStatus', 'reason', 'retryStatus', 'sourceFingerprint', 'stateVersion']);
    expect(await privateValues(page)).toEqual([]);
    await motionReport(page, testInfo, 'after-retry');
    await page.reload();
    const reloaded = await openEntry(page, entry.id);
    await expect(reloaded.getByTestId('restored-reading-gestures').locator('[data-gesture-id]').first()).toBeVisible();
    await expect(recoveryOf(reloaded)).toHaveAttribute('data-recovery-phase', 'unavailable');
    await expect(retryOf(reloaded)).toHaveCount(0);
    await inspectRecovered(page, reloaded);
    expect(backend.retryPosts()).toHaveLength(1);
    expect(backend.providerCalls()).toBe(0);
    await motionReport(page, testInfo, 'after-reload');
  } finally {
    await test.info().attach('recovery-backend.json', { body: JSON.stringify(backend.diagnostics(), null, 2), contentType: 'application/json' });
    await backend.close();
  }
});

test('local Free refusal preserves static cues; paid cloud double activation admits one authenticated retry', async ({ page }, testInfo) => {
  const backend = await createRecoveryBackend(page.context());
  try {
    backend.setSession(await backend.seedAccount({ id: 'free-reader', tier: 'free' }));
    const entry = await historicalStaticEntry('free-star');
    await prepareJournal(page, { key: 'tarot_journal_free-reader', entries: [entry] });
    await page.goto('/journal');
    const card = await openEntry(page, entry.id);
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'eligible');
    let values = [];
    // A rapid double activation still produces one explicit request.
    await retryOf(card).dblclick();
    await expect(recoveryOf(card).getByRole('status')).toHaveText(UNAVAILABLE, { timeout: 20000 });
    values = await privateValues(page);
    expect(backend.retryPosts().map(item => item.path)).toEqual(['/api/tarot-reading/visual-retry']);
    expect(backend.providerCalls()).toBe(0);
    expect(backend.db.rows('SELECT admission_scope FROM visual_retry_claims').map(row => row.admission_scope)).toEqual([]);
    await inspectRecovered(page, card);
    await expectNoPrivateExposure(page, values, 'tarot_journal_free-reader');
    await motionReport(page, testInfo, 'free-local');
    // The paid web lane uses its real cloud journal and cookie-authenticated POST.
    backend.setSession(await backend.seedAccount({ id: 'plus-double' }));
    const paid = starEntry({ id: 'paid-double' });
    await backend.seedCloudEntry({ userId: 'plus-double', entry: paid });
    await page.goto('/journal');
    const paidCard = await openEntry(page, paid.id);
    await retryOf(paidCard).dblclick();
    await expect(recoveryOf(paidCard).getByRole('status')).toHaveText(READY, { timeout: 20000 });
    expect(backend.retryPosts().map(item => item.path)).toEqual(['/api/tarot-reading/visual-retry', '/api/journal/paid-double/visual-retry']);
    expect(backend.providerCalls()).toBe(1);
    expect(backend.db.rows('SELECT admission_scope FROM visual_retry_claims').map(row => row.admission_scope)).toEqual(['user:plus-double']);
    await inspectRecovered(page, paidCard);
    await expectNoPrivateExposure(page, await privateValues(page), 'tarot_journal_cache_plus-double');
    await motionReport(page, testInfo, 'paid-double');
  } finally {
    await test.info().attach('recovery-backend.json', { body: JSON.stringify(backend.diagnostics(), null, 2), contentType: 'application/json' });
    await backend.close();
  }
});

test('cloud failed attachment survives reload and repairs a same-owner registration without inference', async ({ page }, testInfo) => {
  const backend = await createRecoveryBackend(page.context());
  try {
    backend.setSession(await backend.seedAccount({ id: 'plus-reader' }));
    const entry = starEntry({ id: 'cloud-repair' });
    await backend.seedCloudEntry({ userId: 'plus-reader', entry, registered: true });
    await prepareJournal(page);
    await page.goto('/journal');
    let card = await openEntry(page, entry.id);
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'eligible');
    await page.reload();
    card = await openEntry(page, entry.id);
    await expect(recoveryOf(card).getByRole('status')).toHaveText(UNAVAILABLE);
    expect(backend.retryPosts()).toHaveLength(0);
    // The repair completes without a pending phase; keyboard activation must still
    // end on an announced, focused status rather than on <body>.
    await retryOf(card).focus();
    await page.keyboard.press('Enter');
    await expect(card.getByTestId('restored-reading-gestures').locator('[data-gesture-id]').first()).toBeVisible({ timeout: 20000 });
    await expect(recoveryOf(card).getByRole('status')).toHaveText(READY);
    await expect(recoveryOf(card).getByRole('status')).toBeFocused();
    expect(backend.retryPosts().map(item => item.path)).toEqual(['/api/journal/cloud-repair/visual-retry']);
    expect(backend.providerCalls()).toBe(0);
    await page.reload();
    card = await openEntry(page, entry.id);
    await expect(card.getByTestId('restored-reading-gestures').locator('[data-gesture-id]').first()).toBeVisible();
    await expect(recoveryOf(card)).toHaveCount(0);
    expect(backend.db.rows('SELECT narrative FROM journal_entries')[0].narrative).toBe(entry.personalReading);
    expect(backend.retryPosts()).toHaveLength(1);
    await motionReport(page, testInfo, 'cloud-repair');
  } finally {
    await test.info().attach('recovery-backend.json', { body: JSON.stringify(backend.diagnostics(), null, 2), contentType: 'application/json' });
    await backend.close();
  }
});

test('cloud entry saved while original cues were pending shows status and resumes by polling, never by retry', async ({ page }, testInfo) => {
  const backend = await createRecoveryBackend(page.context());
  try {
    backend.setSession(await backend.seedAccount({ id: 'plus-pending' }));
    const entry = starEntry({ id: 'cloud-pending' });
    const { binding } = await backend.seedCloudEntry({ userId: 'plus-pending', entry, pendingOriginal: true });
    await prepareJournal(page);
    await page.goto('/journal');
    const card = await openEntry(page, entry.id);
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'pending');
    await expect(recoveryOf(card).getByRole('status')).toHaveText('Your reading is saved. Card connections are being prepared.');
    await expect(retryOf(card)).toHaveCount(0);
    expect(await backend.completeOriginal({ userId: 'plus-pending', entry, binding })).toEqual({ ok: true });
    await expect(recoveryOf(card).getByRole('status')).toHaveText(READY, { timeout: 20000 });
    await expect(card.getByTestId('restored-reading-gestures').locator('[data-gesture-id]').first()).toBeVisible();
    expect(backend.retryPosts()).toHaveLength(0);
    expect(backend.providerCalls()).toBe(0);
    expect(backend.requests.filter(item => item.path === '/api/journal/cloud-pending').length).toBeGreaterThan(0);
    await motionReport(page, testInfo, 'cloud-pending');
  } finally {
    await test.info().attach('recovery-backend.json', { body: JSON.stringify(backend.diagnostics(), null, 2), contentType: 'application/json' });
    await backend.close();
  }
});

test('duplicate tabs share one server claim and one dispatch and converge on static cues', async ({ page, context }, testInfo) => {
  const backend = await createRecoveryBackend(context);
  const entry = starEntry({ id: 'tabs-star', ...pendingOriginal() });
  try {
    backend.setSession(await backend.seedAccount({ id: 'plus-tabs' }));
    await backend.seedCloudEntry({ userId: 'plus-tabs', entry });
    await prepareJournal(page, { key: 'tarot_journal_cache_plus-tabs', entries: [entry] });
    await page.goto('/journal');
    const first = await openEntry(page, entry.id, { centerEntryToggle: true });
    const second = await context.newPage();
    await second.goto('/journal');
    const other = await openEntry(second, entry.id, { centerEntryToggle: true });
    const gate = backend.holdNext('POST', /visual-retry$/);
    await retryOf(first).click();
    await gate.reachedPromise;
    await retryOf(other).click();
    await expect(recoveryOf(other).getByRole('status')).toHaveText(READY, { timeout: 20000 });
    gate.release();
    await expect(first.getByTestId('restored-reading-gestures').locator('[data-gesture-id]').first()).toBeVisible({ timeout: 20000 });
    expect(backend.retryPosts()).toHaveLength(2);
    expect(backend.providerCalls()).toBe(1);
    expect(backend.db.rows('SELECT id FROM visual_retry_claims')).toHaveLength(1);
    await motionReport(page, testInfo, 'tab-a');
    await motionReport(second, testInfo, 'tab-b');
    await second.close();
    await page.reload();
    const reloaded = await openEntry(page, entry.id, { centerEntryToggle: true });
    await inspectRecovered(page, reloaded);
    expect(backend.retryPosts()).toHaveLength(2);
    expect(backend.providerCalls()).toBe(1);
    await motionReport(page, testInfo, 'paid-reload');
  } finally {
    await test.info().attach('recovery-backend.json', { body: JSON.stringify(backend.diagnostics(), null, 2), contentType: 'application/json' });
    await backend.close();
  }
});

test('a rejected successor keeps the cached cues and the exhausted status survives reload', async ({ page }, testInfo) => {
  const backend = await createRecoveryBackend(page.context(), { provider: 'reject' });
  const base = starEntry({ id: 'cached-star' });
  backend.setSession(await backend.seedAccount({ id: 'plus-cached' }));
  const binding = await seedExpiredCloudOriginal(backend, { userId: 'plus-cached', entry: base });
  const ledger = await acceptedLedger(binding, base.personalReading);
  const entry = { ...base, readingResultId: binding.readingResultId, visualBinding: binding,
    visual: { readingResultId: binding.readingResultId, binding, status: 'expired', sourceRevision: 0, ledgerRevision: ledger.ledgerRevision, snapshot: ledger } };
  try {
    await prepareJournal(page, { key: 'tarot_journal_cache_plus-cached', entries: [entry] });
    await page.goto('/journal');
    let card = await openEntry(page, entry.id);
    const cached = card.getByTestId('restored-reading-gestures').locator('[data-gesture-id]').filter({ hasText: 'one pitcher into a pool' });
    await expect(cached).toBeVisible();
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'eligible');
    await retryOf(card).click();
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'unavailable', { timeout: 20000 });
    await expect(recoveryOf(card).getByRole('status')).toHaveText(UNAVAILABLE);
    await expect(retryOf(card)).toHaveCount(0);
    await expect(cached).toBeVisible();
    expect((await storedEntry(page, 'tarot_journal_cache_plus-cached', entry.id)).visual.snapshot.cues.map(cue => cue.id)).toEqual(ledger.cues.map(cue => cue.id));
    await page.reload();
    card = await openEntry(page, entry.id);
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'unavailable');
    await expect(retryOf(card)).toHaveCount(0);
    const restored = card.getByTestId('restored-reading-gestures');
    await restored.locator('[data-gesture-id]').filter({ hasText: 'one pitcher into a pool' }).click();
    await expect(focusCards(restored).first()).toHaveAttribute('data-details', 'pool-pour');
    await page.keyboard.press('Escape');
    expect(backend.retryPosts()).toHaveLength(1);
    expect(backend.providerCalls()).toBe(1);
    expect(backend.db.rows('SELECT retry_status FROM visual_retry_claims')[0].retry_status).toBe('exhausted');
    await motionReport(page, testInfo, 'rejected-successor');
  } finally {
    await test.info().attach('recovery-backend.json', { body: JSON.stringify(backend.diagnostics(), null, 2), contentType: 'application/json' });
    await backend.close();
  }
});

// Preserve the local persistence race while using only actual paid admission.
// After the real paid POST reserves work, a tier downgrade routes this owner to
// the local journal. The existing handle stays observable; no Free work starts.
async function reservePaidLocalWork(backend, userId, entry) {
  backend.setSession(await backend.seedAccount({ id: userId }));
  const response = await backend.postLocalRetry(savedVisualSource(entry));
  expect(response.status).toBe(200);
  expect((await response.json()).resumeHandle?.visualJobToken).toEqual(expect.any(String));
  await expect.poll(() => backend.providerCalls()).toBe(1);
  await backend.db.prepare("UPDATE users SET subscription_tier = 'free', subscription_status = 'inactive' WHERE id = ?")
    .bind(userId).run();
}

test('deleting an entry while its retry response is pending cannot resurrect it or keep a private handle', async ({ page }) => {
  const backend = await createRecoveryBackend(page.context(), { provider: 'hold' });
  try {
    const entry = starEntry({ id: 'delete-star', ...pendingOriginal() });
    await reservePaidLocalWork(backend, 'paid-delete', entry);
    await prepareJournal(page, { key: 'tarot_journal_paid-delete', entries: [entry] });
    await page.goto('/journal');
    const card = await openEntry(page, entry.id);
    const gate = backend.holdNext('POST', /visual-retry$/);
    await retryOf(card).click();
    await gate.reachedPromise;
    expect(gate.response.resumeHandle?.visualJobToken).toEqual(expect.any(String));
    expect(gate.response.resumeHandle?.visualJobId).toEqual(expect.any(String));
    await expect.poll(() => backend.providerCalls()).toBe(1);
    const claim = backend.db.rows('SELECT * FROM visual_retry_claims')[0];
    expect(claim?.visual_job_id).toBe(gate.response.resumeHandle.visualJobId);
    expect(claim?.reserved_at).toBeGreaterThan(0);
    expect(backend.db.rows('SELECT id FROM visual_retry_claims')).toHaveLength(1);
    await card.getByRole('button', { name: 'Open entry actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete entry' }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(entryCard(page, entry.id)).toHaveCount(0);
    gate.release();
    backend.releaseProvider();
    await backend.settle();
    await page.waitForTimeout(500);
    expect(await storedEntry(page, 'tarot_journal_paid-delete', entry.id)).toBeNull();
    expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.includes(':entry:')))).toEqual([]);
    await expect(entryCard(page, entry.id)).toHaveCount(0);
    expect(backend.retryPosts()).toHaveLength(1);
    expect(backend.providerCalls()).toBe(1);
    expect(backend.db.rows('SELECT id FROM visual_retry_claims')).toHaveLength(1);
  } finally {
    await test.info().attach('recovery-backend.json', { body: JSON.stringify(backend.diagnostics(), null, 2), contentType: 'application/json' });
    await backend.close();
  }
});

test('switching accounts while a cloud retry response is pending writes nothing for either owner', async ({ page }) => {
  const backend = await createRecoveryBackend(page.context());
  try {
    backend.setSession(await backend.seedAccount({ id: 'plus-switch' }));
    const entry = starEntry({ id: 'switch-star' });
    await backend.seedCloudEntry({ userId: 'plus-switch', entry });
    await prepareJournal(page);
    await page.goto('/journal');
    const card = await openEntry(page, entry.id);
    expect(await page.evaluate(() => localStorage.getItem('tarot_journal_cache_plus-switch'))).not.toBeNull();
    const gate = backend.holdNext('POST', /visual-retry$/);
    await retryOf(card).click();
    await gate.reachedPromise;
    expect(gate.response.resumeHandle?.visualJobToken).toEqual(expect.any(String));
    expect(gate.response.resumeHandle?.visualJobId).toEqual(expect.any(String));
    await expect.poll(() => backend.providerCalls()).toBe(1);
    const claim = backend.db.rows('SELECT * FROM visual_retry_claims')[0];
    expect(claim?.visual_job_id).toBe(gate.response.resumeHandle.visualJobId);
    expect(claim?.reserved_at).toBeGreaterThan(0);
    expect(backend.db.rows('SELECT id FROM visual_retry_claims')).toHaveLength(1);
    await signOut(page);
    await expect(entryCard(page, entry.id)).toHaveCount(0);
    gate.release();
    backend.releaseProvider();
    await backend.settle();
    await page.waitForTimeout(500);
    // Neither the signed-out owner's journal cache nor any private handle is recreated.
    expect(await ownerLeftovers(page, 'plus-switch')).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem('tarot_journal'))).toBeNull();
    expect(backend.retryPosts()).toHaveLength(1);
  } finally {
    await test.info().attach('recovery-backend.json', { body: JSON.stringify(backend.diagnostics(), null, 2), contentType: 'application/json' });
    await backend.close();
  }
});

test('leaving the journal and signing out while a retry response is pending leaves nothing for the old owner', async ({ page }) => {
  const backend = await createRecoveryBackend(page.context());
  try {
    backend.setSession(await backend.seedAccount({ id: 'plus-leave' }));
    const entry = starEntry({ id: 'leave-star' });
    await backend.seedCloudEntry({ userId: 'plus-leave', entry });
    await prepareJournal(page);
    await page.goto('/journal');
    const card = await openEntry(page, entry.id);
    const gate = backend.holdNext('POST', /visual-retry$/);
    await retryOf(card).click();
    await gate.reachedPromise;
    expect(gate.response.resumeHandle?.visualJobToken).toEqual(expect.any(String));
    expect(gate.response.resumeHandle?.visualJobId).toEqual(expect.any(String));
    await expect.poll(() => backend.providerCalls()).toBe(1);
    const claim = backend.db.rows('SELECT * FROM visual_retry_claims')[0];
    expect(claim?.visual_job_id).toBe(gate.response.resumeHandle.visualJobId);
    expect(claim?.reserved_at).toBeGreaterThan(0);
    expect(backend.db.rows('SELECT id FROM visual_retry_claims')).toHaveLength(1);
    // Client-side navigation unmounts the journal while the response is in flight.
    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Reading', exact: true }).first().click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('main.journal-page')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Reading setup', exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    await signOut(page);
    await expect(page.locator('button[aria-label^="User menu for"]')).toHaveCount(0);
    gate.release();
    backend.releaseProvider();
    await backend.settle();
    await page.waitForTimeout(500);
    expect(await ownerLeftovers(page, 'plus-leave')).toEqual([]);
    expect(backend.retryPosts()).toHaveLength(1);
  } finally {
    await test.info().attach('recovery-backend.json', { body: JSON.stringify(backend.diagnostics(), null, 2), contentType: 'application/json' });
    await backend.close();
  }
});

test('replacing the saved source while the retry response is pending patches nothing', async ({ page }) => {
  const backend = await createRecoveryBackend(page.context(), { provider: 'hold' });
  const entry = starEntry({ id: 'replace-star', ...pendingOriginal() });
  try {
    await reservePaidLocalWork(backend, 'paid-replace', entry);
    await prepareJournal(page, { key: 'tarot_journal_paid-replace', entries: [entry] });
    await page.goto('/journal');
    const card = await openEntry(page, entry.id);
    const gate = backend.holdNext('POST', /visual-retry$/);
    await retryOf(card).click();
    await gate.reachedPromise;
    expect(gate.response.resumeHandle?.visualJobToken).toEqual(expect.any(String));
    expect(gate.response.resumeHandle?.visualJobId).toEqual(expect.any(String));
    await expect.poll(() => backend.providerCalls()).toBe(1);
    const claim = backend.db.rows('SELECT * FROM visual_retry_claims')[0];
    expect(claim?.visual_job_id).toBe(gate.response.resumeHandle.visualJobId);
    expect(claim?.reserved_at).toBeGreaterThan(0);
    expect(backend.db.rows('SELECT id FROM visual_retry_claims')).toHaveLength(1);
    // Another tab edits the saved context of this entry.
    await page.evaluate(id => {
      const entries = JSON.parse(localStorage.getItem('tarot_journal_paid-replace'));
      localStorage.setItem('tarot_journal_paid-replace', JSON.stringify(entries.map(item => item.id === id ? { ...item, reflections: { Overall: 'Edited elsewhere' } } : item)));
    }, entry.id);
    gate.release();
    backend.releaseProvider();
    await expect(recoveryOf(card).getByRole('status')).toHaveText('Your reading changed while card connections were being checked.', { timeout: 20000 });
    const stored = await storedEntry(page, 'tarot_journal_paid-replace', entry.id);
    expect(stored.visualState).toBeUndefined();
    expect(stored.reflections).toEqual({ Overall: 'Edited elsewhere' });
    expect(stored.personalReading).toBe(entry.personalReading);
    expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.includes(':entry:')))).toEqual([]);
    expect(backend.retryPosts()).toHaveLength(1);
  } finally {
    await test.info().attach('recovery-backend.json', { body: JSON.stringify(backend.diagnostics(), null, 2), contentType: 'application/json' });
    await backend.close();
  }
});

test('without annotation configuration an explicit retry makes no inference and leaves status only, across reload', async ({ page }) => {
  const backend = await createRecoveryBackend(page.context(), { configured: false });
  const entry = starEntry({ id: 'unconfigured-star', ...pendingOriginal() });
  try {
    await prepareJournal(page, { entries: [entry] });
    await page.goto('/journal');
    let card = await openEntry(page, entry.id);
    await retryOf(card).click();
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'unavailable', { timeout: 20000 });
    await expect(recoveryOf(card).getByRole('status')).toHaveText(UNAVAILABLE);
    await expect(retryOf(card)).toHaveCount(0);
    await page.reload();
    card = await openEntry(page, entry.id);
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'unavailable');
    await expect(retryOf(card)).toHaveCount(0);
    expect(backend.retryPosts()).toHaveLength(1);
    expect(backend.providerCalls()).toBe(0);
    expect(backend.db.rows('SELECT id FROM visual_retry_claims')).toHaveLength(0);
    await expect(card.locator('.narrative-stream__text, .prose').first()).toContainText('Neither pitcher gets dropped.');
  } finally {
    await test.info().attach('recovery-backend.json', { body: JSON.stringify(backend.diagnostics(), null, 2), contentType: 'application/json' });
    await backend.close();
  }
});

test('cloud without annotation configuration shows status-only unavailability before any action and across reload', async ({ page }) => {
  const backend = await createRecoveryBackend(page.context(), { configured: false });
  try {
    backend.setSession(await backend.seedAccount({ id: 'plus-unconfigured' }));
    const entry = starEntry({ id: 'cloud-unconfigured' });
    await backend.seedCloudEntry({ userId: 'plus-unconfigured', entry });
    await prepareJournal(page);
    await page.goto('/journal');
    let card = await openEntry(page, entry.id);
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'unavailable', { timeout: 20000 });
    await expect(recoveryOf(card).getByRole('status')).toHaveText(UNAVAILABLE);
    await expect(retryOf(card)).toHaveCount(0);
    await page.reload();
    card = await openEntry(page, entry.id);
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'unavailable');
    await expect(retryOf(card)).toHaveCount(0);
    expect(backend.retryPosts()).toHaveLength(0);
    expect(backend.providerCalls()).toBe(0);
  } finally {
    await test.info().attach('recovery-backend.json', { body: JSON.stringify(backend.diagnostics(), null, 2), contentType: 'application/json' });
    await backend.close();
  }
});

async function seedExpiredCloudOriginal(backend, { userId, entry }) {
  const { binding } = await backend.seedCloudEntry({ userId, entry, registered: true });
  await backend.db.prepare("UPDATE reading_visual_results SET status = 'pending', expires_at = ? WHERE id = ?")
    .bind(Date.now() - 1, binding.readingResultId).run();
  return binding;
}

test('expired cloud original without replay configuration shows status only on first load and reload', async ({ page }) => {
  const backend = await createRecoveryBackend(page.context(), { configured: false });
  try {
    backend.setSession(await backend.seedAccount({ id: 'plus-expired-unconfigured' }));
    const entry = starEntry({ id: 'cloud-expired-unconfigured' });
    await seedExpiredCloudOriginal(backend, { userId: 'plus-expired-unconfigured', entry });
    await prepareJournal(page);
    await page.goto('/journal');
    let card = await openEntry(page, entry.id);
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'unavailable');
    await expect(recoveryOf(card).getByRole('status')).toHaveText(UNAVAILABLE);
    await expect(retryOf(card)).toHaveCount(0);
    await page.reload();
    card = await openEntry(page, entry.id);
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'unavailable');
    await expect(retryOf(card)).toHaveCount(0);
    await expect(card.locator('.narrative-stream__text, .prose').first()).toContainText('Neither pitcher gets dropped.');
    expect(backend.retryPosts()).toHaveLength(0);
    expect(backend.transportRequests()).toHaveLength(0);
    expect(backend.providerCalls()).toBe(0);
    expect(backend.db.rows('SELECT id FROM visual_retry_claims')).toHaveLength(0);
    expect(backend.db.rows('SELECT narrative FROM journal_entries')[0].narrative).toBe(entry.personalReading);
  } finally {
    await test.info().attach('recovery-backend.json', { body: JSON.stringify(backend.diagnostics(), null, 2), contentType: 'application/json' });
    await backend.close();
  }
});

test('expired cloud retry after configuration disappears keeps cached cues and prose and removes the action across reload', async ({ page }, testInfo) => {
  const backend = await createRecoveryBackend(page.context());
  const userId = 'plus-expired-config-flip';
  const cacheKey = `tarot_journal_cache_${userId}`;
  try {
    backend.setSession(await backend.seedAccount({ id: userId }));
    const entry = starEntry({ id: 'cloud-expired-config-flip' });
    const binding = await seedExpiredCloudOriginal(backend, { userId, entry });
    const visual = publicVisualSnapshot({ binding, raw: entry.personalReading, status: 'expired',
      cueLedger: await acceptedLedger(binding, entry.personalReading) });
    await prepareJournal(page, { key: cacheKey, entries: [{ ...entry, readingResultId: binding.readingResultId, visualBinding: binding, visual }] });
    await page.goto('/journal');
    let card = await openEntry(page, entry.id);
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'eligible');
    const restored = card.getByTestId('restored-reading-gestures');
    await expect(restored.locator('[data-gesture-id]').filter({ hasText: 'one pitcher into a pool' }).first()).toBeVisible();
    expect(backend.retryPosts()).toHaveLength(0);
    const before = await storedEntry(page, cacheKey, entry.id);
    const durableBefore = Object.fromEntries(['journal_visual_state', 'journal_visual_links', 'reading_visual_results']
      .map(table => [table, backend.db.rows(`SELECT * FROM ${table} ORDER BY 1`)]));
    delete backend.env.VISUAL_REPLAY_LIMITS;
    await retryOf(card).focus();
    await page.keyboard.press('Enter');
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'unavailable');
    await expect(recoveryOf(card).getByRole('status')).toHaveText(UNAVAILABLE);
    await expect(recoveryOf(card).getByRole('status')).toBeFocused();
    await expect(retryOf(card)).toHaveCount(0);
    const saved = await storedEntry(page, cacheKey, entry.id);
    expect(saved.personalReading).toBe(entry.personalReading);
    expect(saved.visual).toEqual(visual);
    expect(saved.visualState).toMatchObject({ attachmentStatus: 'expired', retryStatus: 'unavailable', reason: 'configuration-unavailable' });
    expect(saved.visualState.stateVersion).toBe(before.visualState.stateVersion);
    expect(saved.visualState.sourceFingerprint).toBe(before.visualState.sourceFingerprint);
    expect(Object.fromEntries(Object.keys(durableBefore).map(table => [table, backend.db.rows(`SELECT * FROM ${table} ORDER BY 1`)]))).toEqual(durableBefore);
    expect(await privateValues(page)).toEqual([]);
    await motionReport(page, testInfo, 'unavailable-config-flip');
    await page.reload();
    card = await openEntry(page, entry.id);
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'unavailable');
    await expect(retryOf(card)).toHaveCount(0);
    await expect(card.getByTestId('restored-reading-gestures').locator('[data-gesture-id]').filter({ hasText: 'one pitcher into a pool' }).first()).toBeVisible();
    await page.evaluate(() => { window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('online')); });
    expect(backend.retryPosts()).toHaveLength(1);
    expect(backend.transportRequests()).toHaveLength(0);
    expect(backend.providerCalls()).toBe(0);
    expect(backend.db.rows('SELECT id FROM visual_retry_claims')).toHaveLength(0);
    expect((await storedEntry(page, cacheKey, entry.id)).visual).toEqual(visual);
    expect(Object.fromEntries(Object.keys(durableBefore).map(table => [table, backend.db.rows(`SELECT * FROM ${table} ORDER BY 1`)]))).toEqual(durableBefore);
    expect(backend.db.rows('SELECT narrative FROM journal_entries')[0].narrative).toBe(entry.personalReading);
    await motionReport(page, testInfo, 'unavailable-config-flip-reload');
  } finally {
    await test.info().attach('recovery-backend.json', { body: JSON.stringify(backend.diagnostics(), null, 2), contentType: 'application/json' });
    await backend.close();
  }
});

test('pending local retry without transport configuration preserves pending state and cached cues with status only', async ({ page }, testInfo) => {
  const backend = await createRecoveryBackend(page.context());
  const userId = 'free-pending-without-transport';
  const key = `tarot_journal_${userId}`;
  try {
    backend.setSession(await backend.seedAccount({ id: userId, tier: 'free' }));
    const entry = starEntry({ id: 'pending-local-without-transport' });
    const source = savedVisualSource(entry);
    const binding = await sourceBinding(entry, 'existing-pending-local');
    const fingerprint = await fingerprintSavedVisualSource({ source, ...normalizeVisualSource(source) });
    const { claim } = await backend.seedHistoricalReplay({ userId, entry, binding, stateVersion: 7 });
    const ledger = await acceptedLedger(binding, entry.personalReading);
    await backend.db.prepare("UPDATE reading_visual_results SET ledger_json = ?, ledger_revision = ?, active_state_version = 7, status = 'running' WHERE id = ?")
      .bind(JSON.stringify(ledger), ledger.ledgerRevision, binding.readingResultId).run();
    await backend.db.prepare("UPDATE visual_retry_claims SET state_version = 7, dispatch_status = 'reserved', reserved_at = ? WHERE id = ?")
      .bind(Date.now() - 1000, claim.id).run();
    const visual = publicVisualSnapshot({ binding, raw: entry.personalReading, cueLedger: ledger, status: 'running' });
    const saved = { ...entry, visual, visualBinding: binding,
      visualState: { attachmentStatus: 'pending', retryStatus: 'pending', sourceFingerprint: fingerprint, stateVersion: 7, reason: null } };
    await prepareJournal(page, { key, entries: [saved] });
    await page.goto('/journal');
    let card = await openEntry(page, entry.id);
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'eligible');
    const before = Object.fromEntries(['reading_visual_results', 'visual_retry_claims'].map(table => [table, backend.db.rows(`SELECT * FROM ${table} ORDER BY 1`)]));
    delete backend.env.READING_VISUAL_JOBS;
    await retryOf(card).focus();
    await page.keyboard.press('Enter');
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'unavailable');
    await expect(recoveryOf(card).getByRole('status')).toHaveText(UNAVAILABLE);
    await expect(recoveryOf(card).getByRole('status')).toBeFocused();
    await expect(retryOf(card)).toHaveCount(0);
    const stored = await storedEntry(page, key, entry.id);
    expect(stored.visualState).toEqual({ ...saved.visualState, reason: 'configuration-unavailable' });
    expect(stored.visual).toEqual(visual);
    expect(stored.personalReading).toBe(entry.personalReading);
    expect(await privateValues(page)).toEqual([]);
    expect(Object.fromEntries(Object.keys(before).map(table => [table, backend.db.rows(`SELECT * FROM ${table} ORDER BY 1`)]))).toEqual(before);
    await page.reload();
    card = await openEntry(page, entry.id);
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'unavailable');
    await expect(retryOf(card)).toHaveCount(0);
    await expect(card.getByTestId('restored-reading-gestures').locator('[data-gesture-id]').filter({ hasText: 'one pitcher into a pool' }).first()).toBeVisible();
    expect((await storedEntry(page, key, entry.id)).visual).toEqual(visual);
    expect(backend.retryPosts()).toHaveLength(1);
    expect(backend.transportRequests()).toHaveLength(0);
    expect(backend.providerCalls()).toBe(0);
    await motionReport(page, testInfo, 'pending-without-transport');
  } finally {
    await test.info().attach('recovery-backend.json', { body: JSON.stringify(backend.diagnostics(), null, 2), contentType: 'application/json' });
    await backend.close();
  }
});

test('pending cloud retry without transport configuration preserves owned work and cached cues with status only', async ({ page }, testInfo) => {
  const backend = await createRecoveryBackend(page.context());
  const userId = 'plus-pending-without-transport';
  const cacheKey = `tarot_journal_cache_${userId}`;
  try {
    backend.setSession(await backend.seedAccount({ id: userId }));
    const entry = starEntry({ id: 'pending-cloud-without-transport' });
    const originalBinding = await seedExpiredCloudOriginal(backend, { userId, entry });
    expect((await attachJournalVisualResult({ db: backend.db, userId, entryId: entry.id,
      readingResultId: originalBinding.readingResultId })).attached).toBe(true);
    const visual = publicVisualSnapshot({ binding: originalBinding, raw: entry.personalReading, status: 'expired',
      cueLedger: await acceptedLedger(originalBinding, entry.personalReading) });
    await prepareJournal(page, { key: cacheKey, entries: [{ ...entry, visual, visualBinding: originalBinding }] });
    await page.goto('/journal');
    let card = await openEntry(page, entry.id);
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'eligible');
    await expect(card.getByTestId('restored-reading-gestures').locator('[data-gesture-id]').filter({ hasText: 'one pitcher into a pool' }).first()).toBeVisible();
    const cachedBefore = await storedEntry(page, cacheKey, entry.id);
    // An already-reserved historical retry becomes visible after this tab
    // rendered its action. Fixture insertion creates no new model admission.
    const owned = await loadOwnedJournalVisualSource({ db: backend.db, userId, entryId: entry.id });
    const binding = await sourceBinding(entry, 'existing-pending-cloud');
    const fingerprint = await fingerprintSavedVisualSource(owned);
    const { claim } = await backend.seedHistoricalReplay({ userId, entry, binding, cloud: true });
    expect(claim).not.toBeNull();
    const pending = await loadJournalVisualState({ env: backend.env, db: backend.db, userId, entryId: entry.id });
    const privateRecords = [];
    expect(writeVisualResume({ namespace: `user:${userId}`, entryId: entry.id, binding, sourceFingerprint: fingerprint,
      stateVersion: pending.stateVersion, storage: { getItem: () => null, setItem: (key, value) => privateRecords.push([key, value]) },
      resumeHandle: { readingResultId: claim.reading_result_id, visualJobId: claim.visual_job_id, attemptId: claim.attempt_id,
        visualJobToken: claim.visual_token, visualBinding: binding, expiresAt: claim.expires_at } })).toBe(true);
    await page.evaluate(records => records.forEach(([key, value]) => localStorage.setItem(key, value)), privateRecords);
    expect(await privateValues(page)).toHaveLength(3);
    const before = Object.fromEntries(['journal_visual_state', 'journal_visual_links', 'reading_visual_results', 'visual_retry_claims']
      .map(table => [table, backend.db.rows(`SELECT * FROM ${table} ORDER BY 1`)]));
    delete backend.env.READING_VISUAL_JOBS;
    await retryOf(card).focus();
    await page.keyboard.press('Enter');
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'unavailable');
    await expect(recoveryOf(card).getByRole('status')).toHaveText(UNAVAILABLE);
    await expect(recoveryOf(card).getByRole('status')).toBeFocused();
    await expect(retryOf(card)).toHaveCount(0);
    const stored = await storedEntry(page, cacheKey, entry.id);
    expect(stored.visualState).toEqual({ attachmentStatus: pending.attachmentStatus, retryStatus: 'pending',
      sourceFingerprint: pending.sourceFingerprint, stateVersion: pending.stateVersion, reason: 'configuration-unavailable' });
    expect(stored.visualState.sourceFingerprint).toBe(cachedBefore.visualState.sourceFingerprint);
    expect(stored.visual).toEqual(cachedBefore.visual);
    expect(stored.personalReading).toBe(entry.personalReading);
    expect(await privateValues(page)).toEqual([]);
    expect(Object.fromEntries(Object.keys(before).map(table => [table, backend.db.rows(`SELECT * FROM ${table} ORDER BY 1`)]))).toEqual(before);
    await page.reload();
    card = await openEntry(page, entry.id);
    await expect(recoveryOf(card)).toHaveAttribute('data-recovery-phase', 'unavailable');
    await expect(retryOf(card)).toHaveCount(0);
    await expect(card.getByTestId('restored-reading-gestures').locator('[data-gesture-id]').filter({ hasText: 'one pitcher into a pool' }).first()).toBeVisible();
    await page.evaluate(() => { window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('online')); });
    expect((await storedEntry(page, cacheKey, entry.id)).visualState).toEqual(stored.visualState);
    expect((await storedEntry(page, cacheKey, entry.id)).visual).toEqual(cachedBefore.visual);
    expect(backend.retryPosts()).toHaveLength(1);
    expect(backend.transportRequests()).toHaveLength(0);
    expect(backend.providerCalls()).toBe(0);
    expect(Object.fromEntries(Object.keys(before).map(table => [table, backend.db.rows(`SELECT * FROM ${table} ORDER BY 1`)]))).toEqual(before);
    await motionReport(page, testInfo, 'pending-cloud-without-transport');
  } finally {
    await test.info().attach('recovery-backend.json', { body: JSON.stringify(backend.diagnostics(), null, 2), contentType: 'application/json' });
    await backend.close();
  }
});

test('offline and storage-quota failures keep prose readable and a later explicit retry reuses the one dispatch', async ({ page }, testInfo) => {
  const backend = await createRecoveryBackend(page.context(), { provider: 'hold' });
  const entry = starEntry({ id: 'quota-star', ...pendingOriginal() });
  try {
    // Establish the local journal before starting the real dispatch lifetime.
    backend.setSession(await backend.seedAccount({ id: 'plus-quota', tier: 'free' }));
    await prepareJournal(page, { key: 'tarot_journal_plus-quota', entries: [entry] });
    await page.goto('/journal');
    const card = await openEntry(page, entry.id);
    const beforeRetry = await storedEntry(page, 'tarot_journal_plus-quota', entry.id);
    await retryOf(card).scrollIntoViewIfNeeded();
    // Upgrade this same fixture owner only for actual paid-cookie admission,
    // then downgrade before the browser observes the existing reservation.
    // The held provider keeps its original 30-second deadline throughout.
    await backend.db.prepare("UPDATE users SET subscription_tier = 'plus', subscription_status = 'active' WHERE id = ?")
      .bind('plus-quota').run();
    const reserved = await backend.postLocalRetry(savedVisualSource(entry));
    expect(reserved.status).toBe(200);
    expect((await reserved.json()).resumeHandle).not.toBeNull();
    await expect.poll(() => backend.providerCalls()).toBe(1);
    await backend.db.prepare("UPDATE users SET subscription_tier = 'free', subscription_status = 'inactive' WHERE id = ?")
      .bind('plus-quota').run();
    backend.failNext('POST', /visual-retry$/);
    await retryOf(card).click();
    await expect(recoveryOf(card).getByRole('status')).toHaveText('Your reading is saved. Card connections could not be reached. Try again when you are online.');
    await expect(retryOf(card)).toBeVisible();
    expect(backend.db.rows('SELECT id FROM visual_retry_claims')).toHaveLength(1);
    // Private storage is full: the server claim exists, the client stores nothing.
    await page.evaluate(() => {
      window.__task11SetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItem(key, value) {
        if (String(key).includes(':entry:')) throw new DOMException('Quota exceeded', 'QuotaExceededError');
        return window.__task11SetItem.call(this, key, value);
      };
    });
    await retryOf(card).click();
    await expect(recoveryOf(card).getByRole('status')).toHaveText('Your reading is saved, but this device could not store card connection progress.');
    await expect(retryOf(card)).toBeVisible();
    expect((await storedEntry(page, 'tarot_journal_plus-quota', entry.id)).visualState).toEqual(beforeRetry.visualState);
    backend.releaseProvider();
    await backend.settle();
    expect(backend.providerCalls()).toBe(1);
    await page.evaluate(() => { Storage.prototype.setItem = window.__task11SetItem; });
    await retryOf(card).click();
    await expect(recoveryOf(card).getByRole('status')).toHaveText(READY, { timeout: 20000 });
    await expect(card.getByTestId('restored-reading-gestures').locator('[data-gesture-id]').first()).toBeVisible();
    expect(backend.providerCalls()).toBe(1);
    expect(backend.db.rows('SELECT id FROM visual_retry_claims')).toHaveLength(1);
    expect(backend.retryPosts()).toHaveLength(3);
    expect((await storedEntry(page, 'tarot_journal_plus-quota', entry.id)).personalReading).toBe(entry.personalReading);
    await motionReport(page, testInfo, 'quota');
  } finally {
    await test.info().attach('recovery-backend.json', { body: JSON.stringify(backend.diagnostics(), null, 2), contentType: 'application/json' });
    await backend.close();
  }
});
