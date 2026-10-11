import test from 'node:test';
import assert from 'node:assert/strict';
import { applyVisualCueBatch, createVisualCueLedger } from '../shared/reading/visualCueLedger.js';
import { hashVisualCueText } from '../shared/contracts/visualCueBatches.js';
import { fingerprintVisualSource, normalizeVisualSource } from '../shared/reading/visualSourceIdentity.js';
import { fingerprintSavedVisualSource } from '../functions/lib/readingVisualResults.js';
import { visualStorageNamespace, writeVisualResume, readVisualResume, removeVisualResume, clearVisualResumes,
  patchSavedVisualSnapshot, publicVisualSnapshot, persistJournalWithVisualFallback, VISUAL_SNAPSHOT_EVENT,
  publicVisualRetryState, projectJournalEntryVisuals, savedVisualSource, savedVisualSourceKey,
  fingerprintSavedVisualEntry, savedVisualRecovery, commitSavedVisualEntry, adoptSavedVisualReplay,
  mergeCachedJournalVisuals, needsCloudVisualRefresh, adoptEntryVisuals, requestSavedVisualRetry, readSavedVisualEntry } from '../src/lib/readingVisualStorage.js';
import { hydrateEntryVisuals } from '../src/utils/journalStorage.js';

function storage() {
  const map = new Map();
  return { get length() { return map.size; }, key: index => [...map.keys()][index],
    getItem: key => map.get(key) || null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
}
const binding = { readingResultId: 'result', sourceRevision: 0, spreadHash: 'a'.repeat(64), contextHash: 'b'.repeat(64),
  artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };
const raw = 'The Star pours into a pool.';
function entry() { return { id: 'local-one', readingResultId: binding.readingResultId, visualBinding: binding,
  personalReading: raw, visual: publicVisualSnapshot({ binding, raw, status: 'pending' }) }; }
function ledger() { return { ...createVisualCueLedger(binding), raw, analyzedEnd: raw.length, ledgerRevision: 1,
  cues: [{ id: 'literal', passage: { start: 9, end: raw.length, quote: raw.slice(9) }, targets: [] }] }; }

test('pending local save restores later source-bound snapshot with private resume excluded from entry', () => {
  const store = storage();
  const namespace = visualStorageNamespace(null);
  const saved = persistJournalWithVisualFallback({ key: 'tarot_journal', entries: [entry()], storage: store });
  assert.equal(saved.ok, true);
  assert.equal(writeVisualResume({ namespace, binding,
    resumeHandle: { visualBinding: binding, visualJobToken: 'private-token' }, storage: store }), true);
  const restored = JSON.parse(store.getItem('tarot_journal'))[0];
  assert.equal(hydrateEntryVisuals(restored).status, 'pending');
  assert.equal(JSON.stringify(restored).includes('private-token'), false);
  assert.equal(readVisualResume({ namespace, readingResultId: 'result', binding, storage: store }).visualJobToken, 'private-token');
  assert.equal(patchSavedVisualSnapshot({ namespace, binding, cueLedger: ledger(), status: 'complete', storage: store }), 1);
  const completed = hydrateEntryVisuals(JSON.parse(store.getItem('tarot_journal'))[0]);
  assert.equal(completed.status, 'complete');
  assert.equal(completed.ledgerRevision, 1);
  assert.equal(completed.snapshot.raw, raw);
  assert.equal(readVisualResume({ namespace, readingResultId: 'result', binding, storage: store }), null);
});

test('account namespaces cannot read or patch another account and clearing resumes preserves entries', () => {
  const store = storage();
  const a = visualStorageNamespace('a'), b = visualStorageNamespace('b');
  store.setItem('tarot_journal_a', JSON.stringify([entry()]));
  writeVisualResume({ namespace: a, binding, resumeHandle: { visualBinding: binding, visualJobToken: 'private' }, storage: store });
  assert.equal(readVisualResume({ namespace: b, readingResultId: 'result', binding, storage: store }), null);
  assert.equal(patchSavedVisualSnapshot({ namespace: b, binding, cueLedger: ledger(), status: 'complete', storage: store }), 0);
  clearVisualResumes(a, store);
  assert.equal(readVisualResume({ namespace: a, readingResultId: 'result', binding, storage: store }), null);
  assert.equal(JSON.parse(store.getItem('tarot_journal_a'))[0].personalReading, raw);
});

test('deleted entries never reappear from late results', () => {
  const store = storage();
  store.setItem('tarot_journal', '[]');
  assert.equal(patchSavedVisualSnapshot({ namespace: 'anon', binding, cueLedger: ledger(), status: 'complete', storage: store }), 0);
  assert.equal(store.getItem('tarot_journal'), '[]');
});

test('late source replacement, wrong prose and old ledger revisions cannot mutate a saved entry', () => {
  const store = storage();
  store.setItem('tarot_journal', JSON.stringify([entry()]));
  const original = store.getItem('tarot_journal');
  assert.equal(patchSavedVisualSnapshot({ namespace: 'anon', binding: { ...binding, sourceRevision: 1 }, cueLedger: ledger(), storage: store }), 0);
  assert.equal(patchSavedVisualSnapshot({ namespace: 'anon', binding, cueLedger: { ...ledger(), raw: 'Wrong', analyzedEnd: 5 }, storage: store }), 0);
  assert.equal(store.getItem('tarot_journal'), original);
  patchSavedVisualSnapshot({ namespace: 'anon', binding, cueLedger: ledger(), status: 'complete', storage: store });
  assert.equal(patchSavedVisualSnapshot({ namespace: 'anon', binding, cueLedger: createVisualCueLedger(binding), status: 'pending', storage: store }), 0);
});

test('expired or mismatched resume handles disappear without removing saved prose', () => {
  const store = storage();
  store.setItem('tarot_journal', JSON.stringify([entry()]));
  writeVisualResume({ namespace: 'anon', binding, resumeHandle: { visualBinding: binding, visualJobToken: 'expired' }, storage: store });
  assert.equal(readVisualResume({ namespace: 'anon', readingResultId: 'result', binding, storage: store, now: Date.now() + 3600001 }), null);
  assert.equal(JSON.parse(store.getItem('tarot_journal'))[0].personalReading, raw);
});

test('optional cue quota failure retries prose save and private storage failure remains nonblocking', () => {
  const store = storage();
  const set = store.setItem;
  store.setItem = (key, value) => { if (key.includes('resume') || value.includes('snapshot')) throw new Error('Quota'); set(key, value); };
  const result = persistJournalWithVisualFallback({ key: 'tarot_journal', entries: [entry()], storage: store });
  assert.equal(result.ok, true);
  assert.equal(result.entries[0].personalReading, raw);
  assert.equal(writeVisualResume({ namespace: 'anon', binding, resumeHandle: { visualBinding: binding, visualJobToken: 'token' }, storage: store }), false);
  assert.equal(JSON.parse(store.getItem('tarot_journal'))[0].visual, undefined);
});

test('late cue storage errors preserve the original cache; true prose quota failures are reported', () => {
  const store = storage();
  store.setItem('tarot_journal', JSON.stringify([entry()]));
  const before = store.getItem('tarot_journal');
  store.setItem = () => { throw new Error('Quota'); };
  assert.equal(patchSavedVisualSnapshot({ namespace: 'anon', binding, cueLedger: ledger(), storage: store }), 0);
  assert.equal(store.getItem('tarot_journal'), before);
  assert.equal(persistJournalWithVisualFallback({ key: 'tarot_journal', entries: [entry()], storage: store }).ok, false);
});

test('restoration rejects unbound snapshots rather than decorating unrelated prose', () => {
  assert.equal(hydrateEntryVisuals({ personalReading: raw, visual: { cues: [{ id: 'fake' }] } }).hasVisuals, false);
  assert.equal(publicVisualSnapshot({ binding, raw, cueLedger: { ...ledger(), binding: { ...binding, contextHash: 'c'.repeat(64) } } }), null);
});

// Task 11: saved-reading recovery. Prose deliberately contains words that look
// like private field names; structural projection must keep it byte-for-byte.
const SAVED_RAW = 'The Star pours into a pool. A note about "visualJobToken", attemptId and resumeHandle stays exactly as written.';
const SAVED = Object.freeze({ id: 'local-star', ts: 1, personalReading: SAVED_RAW, question: 'What renews me?', deckId: 'rws-1909',
  cards: [{ name: 'The Star', position: 'Present', orientation: 'Upright' }], reflections: { 0: 'water', Overall: 'Hope' } });
const FP = 'f'.repeat(64);
const pick = (value, keys) => Object.fromEntries(keys.map(key => [key, value?.[key]]));
async function bindingFor(entry, readingResultId, sourceRevision = 0) {
  const { spreadHash, contextHash } = await fingerprintVisualSource(savedVisualSource(entry));
  const { artworkEdition, catalogVersion } = normalizeVisualSource(savedVisualSource(entry));
  return { readingResultId, sourceRevision, spreadHash, contextHash, artworkEdition, catalogVersion };
}
async function acceptedLedger(visualBinding, raw = SAVED_RAW, quote = 'pours into a pool') {
  const result = await applyVisualCueBatch({ ledger: createVisualCueLedger(visualBinding), authoritativeRaw: raw,
    issuedRequest: { binding: visualBinding, batchId: `batch-${visualBinding.readingResultId}`, requestSequence: 1, status: 'active',
      analyzedEnd: raw.length, analyzedHash: await hashVisualCueText(raw), baseLedgerRevision: 0 },
    response: { proposals: [{ localAlias: 'pool', kind: 'literal', quote, targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }] }] },
    validationContext: { cards: [{ index: 0, canonicalName: 'The Star' }], getSupportedDetails: () => ['pool-pour', 'land-pour'] } });
  assert.deepEqual(result.rejected, []);
  return result.ledger;
}
function replayHandle(visualBinding, attemptId = 'attempt-1', overrides = {}) {
  return { readingResultId: visualBinding.readingResultId, visualJobId: `job-${attemptId}`, attemptId,
    visualJobToken: `replay-token-${attemptId}`, visualBinding, expiresAt: Date.now() + 60000, ...overrides };
}
function withWindowEvents(run) {
  const previous = globalThis.window;
  const events = [];
  globalThis.window = new EventTarget();
  globalThis.window.addEventListener(VISUAL_SNAPSHOT_EVENT, event => events.push(event.detail));
  return Promise.resolve().then(() => run(events)).finally(() => { globalThis.window = previous; });
}

test('replay handles are owner/entry scoped and attempt guarded while legacy original handles stay compatible', async () => {
  const store = storage();
  const replayBinding = { ...binding, readingResultId: 'replay-result' };
  // A record written by the prior release has no transport/attempt fields.
  store.setItem('tarot_visual_resume:anon:result', JSON.stringify({ binding, visualJobToken: 'legacy-token', expiresAt: Date.now() + 60000 }));
  assert.equal(readVisualResume({ namespace: 'anon', readingResultId: 'result', binding, storage: store }).visualJobToken, 'legacy-token');
  assert.equal(writeVisualResume({ namespace: 'anon', entryId: SAVED.id, binding: replayBinding, resumeHandle: replayHandle(replayBinding),
    sourceFingerprint: FP, stateVersion: 1, storage: store }), true);
  const replay = readVisualResume({ namespace: 'anon', entryId: SAVED.id, storage: store });
  assert.deepEqual(pick(replay, ['readingResultId', 'visualJobId', 'attemptId', 'visualJobToken', 'entryId', 'sourceFingerprint', 'stateVersion']),
    { readingResultId: 'replay-result', visualJobId: 'job-attempt-1', attemptId: 'attempt-1', visualJobToken: 'replay-token-attempt-1',
      entryId: SAVED.id, sourceFingerprint: FP, stateVersion: 1 });
  assert.deepEqual(replay.visualBinding, replayBinding);
  // The original handle remains independently readable under its result key.
  assert.equal(readVisualResume({ namespace: 'anon', readingResultId: 'result', binding, storage: store }).visualJobToken, 'legacy-token');
  // Removal/replacement must name the active attempt.
  assert.equal(removeVisualResume({ namespace: 'anon', entryId: SAVED.id, attemptId: 'attempt-0', storage: store }), false);
  assert.equal(writeVisualResume({ namespace: 'anon', entryId: SAVED.id, binding: replayBinding, expectedAttemptId: 'attempt-0',
    resumeHandle: replayHandle(replayBinding, 'attempt-2'), sourceFingerprint: FP, stateVersion: 1, storage: store }), false);
  assert.equal(readVisualResume({ namespace: 'anon', entryId: SAVED.id, storage: store }).attemptId, 'attempt-1');
  // An original terminal callback for another binding cannot delete either handle.
  store.setItem('tarot_journal', JSON.stringify([entry()]));
  patchSavedVisualSnapshot({ namespace: 'anon', binding: { ...binding, sourceRevision: 3 }, cueLedger: ledger(), status: 'complete', storage: store });
  assert.equal(readVisualResume({ namespace: 'anon', entryId: SAVED.id, storage: store }).attemptId, 'attempt-1');
  assert.equal(removeVisualResume({ namespace: 'anon', readingResultId: 'result', binding: { ...binding, sourceRevision: 3 }, storage: store }), false);
  assert.ok(readVisualResume({ namespace: 'anon', readingResultId: 'result', binding, storage: store }));
  // Other owners cannot read it; clearing an owner removes replay records too.
  assert.equal(readVisualResume({ namespace: visualStorageNamespace('other'), entryId: SAVED.id, storage: store }), null);
  assert.equal(JSON.stringify(JSON.parse(store.getItem('tarot_journal'))).includes('replay-token'), false);
  assert.equal(removeVisualResume({ namespace: 'anon', entryId: SAVED.id, attemptId: 'attempt-1', storage: store }), true);
  writeVisualResume({ namespace: 'anon', entryId: SAVED.id, binding: replayBinding, resumeHandle: replayHandle(replayBinding), storage: store });
  clearVisualResumes('anon', store);
  assert.equal(readVisualResume({ namespace: 'anon', entryId: SAVED.id, storage: store }), null);
  // Expired replay handles disappear on read.
  writeVisualResume({ namespace: 'anon', entryId: SAVED.id, binding: replayBinding, resumeHandle: replayHandle(replayBinding), storage: store });
  assert.equal(readVisualResume({ namespace: 'anon', entryId: SAVED.id, storage: store, now: Date.now() + 120000 }), null);
  assert.equal([...Array(store.length).keys()].map(index => store.key(index)).some(key => key.includes(':entry:')), false);
});

test('public retry state and projected entries exclude replay identity and private fields but keep exact prose', () => {
  const state = { attachmentStatus: 'failed', retryStatus: 'unavailable', sourceFingerprint: FP, attemptId: 'secret-attempt-a',
    stateVersion: 2, reason: 'attachment-error', visualSnapshot: { visualJobToken: 'secret-token-a' }, visualJobId: 'secret-job-a' };
  assert.deepEqual(publicVisualRetryState(state), { attachmentStatus: 'failed', retryStatus: 'unavailable', sourceFingerprint: FP, stateVersion: 2, reason: 'attachment-error' });
  assert.equal(publicVisualRetryState({ ...state, retryStatus: 'maybe' }), null);
  assert.equal(publicVisualRetryState({ ...state, sourceFingerprint: 'short' }), null);
  const projected = projectJournalEntryVisuals({ ...SAVED, visualJobToken: 'secret-token-b', attemptId: 'secret-attempt-b',
    resumeHandle: { visualJobToken: 'secret-token-c' }, visualResume: { visualJobToken: 'secret-token-d' }, visualJobId: 'secret-job-b', visualState: state,
    visualSnapshot: { visualJobToken: 'secret-token-e', attemptId: 'secret-attempt-e' } });
  assert.equal(projected.personalReading, SAVED_RAW);
  assert.deepEqual(Object.keys(projected.visualState).sort(), ['attachmentStatus', 'reason', 'retryStatus', 'sourceFingerprint', 'stateVersion']);
  assert.equal(/secret-/.test(JSON.stringify(projected)), false);
});

test('a valid top-level visual snapshot keeps its cues and loses nested private fields', async () => {
  const binding = await bindingFor(SAVED, 'result-snapshot');
  const valid = publicVisualSnapshot({ binding, raw: SAVED_RAW, status: 'pending' });
  const projected = projectJournalEntryVisuals({ ...SAVED, visualSnapshot: { ...valid, visualJobToken: 'secret-token-f', attemptId: 'secret-attempt-f' } });
  assert.ok(projected.visualSnapshot);
  assert.deepEqual(projected.visualSnapshot, projectJournalEntryVisuals({ ...SAVED, visualSnapshot: valid }).visualSnapshot);
  assert.equal(/secret-/.test(JSON.stringify(projected)), false);
});

test('saved visual recovery offers an explicit retry only for eligible failed, expired or missing visuals', () => {
  const withState = (attachmentStatus, retryStatus, reason = null) => ({ ...SAVED,
    visualState: { attachmentStatus, retryStatus, sourceFingerprint: FP, stateVersion: 1, reason } });
  const view = (entry, options) => pick(savedVisualRecovery(entry, options), ['phase', 'canRetry']);
  assert.deepEqual(view(withState('failed', 'unavailable', 'unregistered-result')), { phase: 'eligible', canRetry: true });
  assert.deepEqual(view(withState('expired', 'available', 'expired'), { cloud: true }), { phase: 'eligible', canRetry: true });
  assert.deepEqual(view(withState('missing', 'unavailable', 'source-changed'), { cloud: true }), { phase: 'eligible', canRetry: true });
  for (const retryStatus of ['exhausted', 'revoked']) assert.deepEqual(view(withState('failed', retryStatus)), { phase: 'unavailable', canRetry: false });
  assert.deepEqual(view(withState('failed', 'unavailable', 'configuration-unavailable')), { phase: 'unavailable', canRetry: false });
  assert.deepEqual(view(withState('attached', 'complete')), { phase: 'complete', canRetry: false });
  // Cloud pending work resumes through owned polling; local pending replay resumes through its private handle.
  assert.deepEqual(view(withState('pending', 'unavailable'), { cloud: true }), { phase: 'pending', canRetry: false });
  assert.deepEqual(view(withState('pending', 'pending'), { cloud: true }), { phase: 'pending', canRetry: false });
  assert.deepEqual(view(withState('pending', 'pending'), { replayResume: { attemptId: 'attempt-1' } }), { phase: 'pending', canRetry: false });
  // Without a usable private handle only an explicit (server-deduplicated) POST can resynchronize local state.
  assert.deepEqual(view(withState('pending', 'pending')), { phase: 'eligible', canRetry: true });
  // Local entries without durable state.
  const pendingVisual = { ...SAVED, readingResultId: binding.readingResultId, visualBinding: binding,
    visual: publicVisualSnapshot({ binding, raw: SAVED_RAW, status: 'pending' }) };
  assert.deepEqual(view(pendingVisual, { originalResume: { visualJobToken: 'token' } }), { phase: 'pending', canRetry: false });
  assert.deepEqual(view(pendingVisual), { phase: 'eligible', canRetry: true });
  assert.deepEqual(view({ ...pendingVisual, visual: { ...pendingVisual.visual, status: 'failed' } }), { phase: 'eligible', canRetry: true });
  assert.deepEqual(view({ ...SAVED }), { phase: 'eligible', canRetry: true });
  assert.deepEqual(view({ ...SAVED, personalReading: '' }), { phase: 'none', canRetry: false });
  assert.deepEqual(view({ ...SAVED, cards: Array.from({ length: 21 }, () => SAVED.cards[0]) }), { phase: 'unavailable', canRetry: false });
});

test('guarded commits patch only an existing matching entry for the current owner, source and state version', () => {
  const store = storage();
  const current = { ...SAVED, visualState: { attachmentStatus: 'failed', retryStatus: 'unavailable', sourceFingerprint: FP, stateVersion: 1, reason: null } };
  const sourceKey = savedVisualSourceKey(current);
  const update = entry => ({ ...entry, visualState: { ...entry.visualState, retryStatus: 'pending', stateVersion: entry.visualState.stateVersion + 1 } });
  const commit = (overrides = {}) => commitSavedVisualEntry({ namespace: 'anon', entryId: current.id, sourceKey, expectedStateVersion: 1,
    update, storage: store, isCurrent: () => true, ...overrides });
  store.setItem('tarot_journal', JSON.stringify([current]));
  store.setItem('tarot_journal_other', JSON.stringify([current]));
  const before = store.getItem('tarot_journal');
  assert.equal(commit({ isCurrent: () => false }).committed, false);
  assert.equal(commit({ expectedStateVersion: 0 }).reason, 'stale-state');
  store.setItem('tarot_journal', JSON.stringify([{ ...current, reflections: { ...current.reflections, Overall: 'Edited' } }]));
  assert.equal(commit().reason, 'source-changed');
  store.setItem('tarot_journal', JSON.stringify([{ ...current, personalReading: `${SAVED_RAW} More.` }]));
  assert.equal(commit().reason, 'source-changed');
  // Deleted entries are never upserted or recreated.
  store.setItem('tarot_journal', '[]');
  assert.equal(commit().reason, 'entry-not-found');
  assert.equal(store.getItem('tarot_journal'), '[]');
  store.setItem('tarot_journal', before);
  const result = commit();
  assert.equal(result.committed, true);
  assert.equal(result.entry.visualState.stateVersion, 2);
  assert.equal(JSON.parse(store.getItem('tarot_journal'))[0].personalReading, SAVED_RAW);
  // Another owner's bucket is never touched by this namespace.
  assert.equal(JSON.parse(store.getItem('tarot_journal_other'))[0].visualState.stateVersion, 1);
});

test('a validated replay successor becomes the static snapshot; late originals and older attempts cannot replace it', async () => {
  await withWindowEvents(async events => {
    const store = storage();
    const original = await bindingFor(SAVED, 'original-result');
    const prior = await acceptedLedger(original);
    const saved = { ...SAVED, readingResultId: original.readingResultId, visualBinding: original,
      visual: publicVisualSnapshot({ binding: original, cueLedger: prior, status: 'expired', raw: SAVED_RAW }),
      visualState: { attachmentStatus: 'pending', retryStatus: 'pending', sourceFingerprint: await fingerprintSavedVisualEntry(SAVED), stateVersion: 1, reason: null } };
    store.setItem('tarot_journal', JSON.stringify([saved]));
    const replayBinding = await bindingFor(SAVED, 'replay-result');
    const handle = replayHandle(replayBinding, 'attempt-1');
    assert.equal(writeVisualResume({ namespace: 'anon', entryId: SAVED.id, binding: replayBinding, resumeHandle: handle,
      sourceFingerprint: saved.visualState.sourceFingerprint, stateVersion: 1, storage: store }), true);
    const resume = readVisualResume({ namespace: 'anon', entryId: SAVED.id, storage: store });
    const successor = await acceptedLedger(replayBinding, SAVED_RAW, 'The Star pours');
    // An older attempt is fenced even with a valid ledger.
    assert.equal((await adoptSavedVisualReplay({ namespace: 'anon', entryId: SAVED.id, resume: { ...resume, attemptId: 'attempt-0' },
      cueLedger: successor, status: 'complete', storage: store })).adopted, false);
    const adopted = await adoptSavedVisualReplay({ namespace: 'anon', entryId: SAVED.id, resume, cueLedger: successor, status: 'complete', storage: store });
    assert.equal(adopted.adopted, true);
    const stored = JSON.parse(store.getItem('tarot_journal'))[0];
    assert.equal(stored.personalReading, SAVED_RAW);
    assert.equal(stored.readingResultId, 'original-result');
    assert.deepEqual(stored.visualBinding, replayBinding);
    assert.deepEqual(pick(stored.visualState, ['attachmentStatus', 'retryStatus', 'stateVersion']), { attachmentStatus: 'attached', retryStatus: 'complete', stateVersion: 2 });
    const restored = hydrateEntryVisuals(stored);
    assert.equal(restored.hasVisuals, true);
    assert.deepEqual(restored.cues.map(cue => cue.id), successor.cues.map(cue => cue.id));
    assert.equal(readVisualResume({ namespace: 'anon', entryId: SAVED.id, storage: store }), null);
    const afterAdoption = store.getItem('tarot_journal');
    // A late original callback (old binding) cannot overwrite the successor.
    assert.equal(patchSavedVisualSnapshot({ namespace: 'anon', binding: original, cueLedger: prior, status: 'complete', storage: store }), 0);
    // A duplicate completion (another tab) is a no-op once the successor is adopted.
    assert.equal((await adoptSavedVisualReplay({ namespace: 'anon', entryId: SAVED.id, resume, cueLedger: successor, status: 'complete', storage: store })).adopted, false);
    assert.equal(store.getItem('tarot_journal'), afterAdoption);
    assert.equal(/replay-token|job-attempt|attempt-1/.test(JSON.stringify(events) + afterAdoption), false);
  });
});

test('replay successors must match the saved source and the current owner before adoption', async () => {
  const store = storage();
  const saved = { ...SAVED, visualState: { attachmentStatus: 'missing', retryStatus: 'pending', sourceFingerprint: await fingerprintSavedVisualEntry(SAVED), stateVersion: 1, reason: null } };
  store.setItem('tarot_journal', JSON.stringify([saved]));
  const foreignBinding = await bindingFor({ ...SAVED, question: 'Different context' }, 'replay-result');
  writeVisualResume({ namespace: 'anon', entryId: SAVED.id, binding: foreignBinding, resumeHandle: replayHandle(foreignBinding),
    sourceFingerprint: saved.visualState.sourceFingerprint, stateVersion: 1, storage: store });
  const resume = readVisualResume({ namespace: 'anon', entryId: SAVED.id, storage: store });
  const before = store.getItem('tarot_journal');
  assert.equal((await adoptSavedVisualReplay({ namespace: 'anon', entryId: SAVED.id, resume, status: 'complete',
    cueLedger: await acceptedLedger(foreignBinding), storage: store })).reason, 'binding-mismatch');
  const goodBinding = await bindingFor(SAVED, 'replay-result');
  const goodResume = { ...resume, visualBinding: goodBinding };
  // Account switch while the hash was computing: nothing is written.
  assert.equal((await adoptSavedVisualReplay({ namespace: 'anon', entryId: SAVED.id, resume: goodResume, status: 'complete',
    cueLedger: await acceptedLedger(goodBinding), storage: store, isCurrent: () => false })).adopted, false);
  // Source replacement after the handle was issued.
  store.setItem('tarot_journal', JSON.stringify([{ ...saved, reflections: { Overall: 'Replaced' } }]));
  assert.equal((await adoptSavedVisualReplay({ namespace: 'anon', entryId: SAVED.id, resume: goodResume, status: 'complete',
    cueLedger: await acceptedLedger(goodBinding), storage: store })).reason, 'source-changed');
  // Deletion while the response is pending.
  store.setItem('tarot_journal', '[]');
  assert.equal((await adoptSavedVisualReplay({ namespace: 'anon', entryId: SAVED.id, resume: goodResume, status: 'complete',
    cueLedger: await acceptedLedger(goodBinding), storage: store })).reason, 'entry-not-found');
  assert.equal(store.getItem('tarot_journal'), '[]');
  assert.notEqual(before, null);
});

test('rejected, empty or unstorable successors keep the previously validated cached snapshot', async () => {
  const store = storage();
  const original = await bindingFor(SAVED, 'original-result');
  const prior = await acceptedLedger(original);
  const cached = publicVisualSnapshot({ binding: original, cueLedger: prior, status: 'expired', raw: SAVED_RAW });
  const fingerprint = await fingerprintSavedVisualEntry(SAVED);
  const saved = { ...SAVED, readingResultId: original.readingResultId, visualBinding: original, visual: cached, visualSnapshot: cached,
    visualState: { attachmentStatus: 'expired', retryStatus: 'pending', sourceFingerprint: fingerprint, stateVersion: 3, reason: null } };
  const replayBinding = await bindingFor(SAVED, 'replay-result');
  const reset = attemptId => {
    store.setItem('tarot_journal', JSON.stringify([saved]));
    writeVisualResume({ namespace: 'anon', entryId: SAVED.id, binding: replayBinding, resumeHandle: replayHandle(replayBinding, attemptId),
      sourceFingerprint: fingerprint, stateVersion: 3, storage: store });
    return readVisualResume({ namespace: 'anon', entryId: SAVED.id, storage: store });
  };
  // A failed successor exhausts this local attempt without touching cached cues.
  let resume = reset('attempt-failed');
  assert.equal((await adoptSavedVisualReplay({ namespace: 'anon', entryId: SAVED.id, resume, status: 'failed', storage: store })).adopted, true);
  let stored = JSON.parse(store.getItem('tarot_journal'))[0];
  assert.deepEqual(stored.visual, cached);
  assert.deepEqual(pick(stored.visualState, ['retryStatus', 'stateVersion']), { retryStatus: 'exhausted', stateVersion: 4 });
  assert.equal(savedVisualRecovery(stored).canRetry, false);
  assert.equal(readVisualResume({ namespace: 'anon', entryId: SAVED.id, storage: store }), null);
  // An empty valid successor cannot replace the good cached ledger.
  resume = reset('attempt-empty');
  const empty = { ...createVisualCueLedger(replayBinding), raw: SAVED_RAW, analyzedEnd: SAVED_RAW.length, analyzedHash: await hashVisualCueText(SAVED_RAW), ledgerRevision: 1 };
  assert.equal((await adoptSavedVisualReplay({ namespace: 'anon', entryId: SAVED.id, resume, cueLedger: empty, status: 'complete', storage: store })).adopted, true);
  stored = JSON.parse(store.getItem('tarot_journal'))[0];
  assert.deepEqual(stored.visual, cached);
  assert.deepEqual(stored.visualBinding, original);
  assert.equal(stored.visualState.retryStatus, 'complete');
  // Quota failure while writing a successor leaves prose and cached cues untouched.
  resume = reset('attempt-quota');
  const before = store.getItem('tarot_journal');
  const set = store.setItem;
  store.setItem = (key, value) => { if (key === 'tarot_journal') throw new Error('Quota'); set(key, value); };
  const quota = await adoptSavedVisualReplay({ namespace: 'anon', entryId: SAVED.id, resume, cueLedger: await acceptedLedger(replayBinding, SAVED_RAW, 'The Star pours'), status: 'complete', storage: store });
  store.setItem = set;
  assert.equal(quota.adopted, false);
  assert.equal(quota.reason, 'storage-error');
  assert.equal(store.getItem('tarot_journal'), before);
  // New-entry quota fallback strips only the new entry's optional cues; existing cached cues survive.
  const other = { ...saved, id: 'older', ts: 0 };
  store.setItem('tarot_journal', JSON.stringify([other]));
  const fresh = { ...SAVED, id: 'newest', visual: publicVisualSnapshot({ binding: replayBinding, cueLedger: empty, status: 'complete', raw: SAVED_RAW }) };
  store.setItem = (key, value) => { if (JSON.parse(value).some(item => item.id === 'newest' && item.visual)) throw new Error('Quota'); set(key, value); };
  const persisted = persistJournalWithVisualFallback({ key: 'tarot_journal', entries: [fresh, other], storage: store });
  store.setItem = set;
  assert.equal(persisted.ok, true);
  const written = JSON.parse(store.getItem('tarot_journal'));
  assert.equal(written.find(item => item.id === 'newest').visual, undefined);
  assert.deepEqual(written.find(item => item.id === 'older').visual, cached);
});

test('snapshot events and stored ledgers project only public cue data while preserving prose', async () => {
  await withWindowEvents(async events => {
    const store = storage();
    store.setItem('tarot_journal', JSON.stringify([entry()]));
    const base = ledger();
    const leaky = { ...base, visualJobToken: 'secret-token-e', attemptId: 'secret-attempt-e',
      cues: base.cues.map(cue => ({ ...cue, visualJobId: 'secret-job-e', resumeHandle: { visualJobToken: 'secret-token-f' } })) };
    assert.equal(patchSavedVisualSnapshot({ namespace: 'anon', binding, cueLedger: leaky, status: 'complete', storage: store }), 1);
    assert.equal(events.length, 1);
    const serialized = JSON.stringify(events) + store.getItem('tarot_journal');
    assert.equal(/secret-/.test(serialized), false);
    assert.equal(events[0].cueLedger.cues[0].passage.quote, base.cues[0].passage.quote);
    assert.equal(JSON.parse(store.getItem('tarot_journal'))[0].personalReading, raw);
  });
});

test('client saved-source fingerprint equals the trusted server fingerprint for saved and GET-shaped entries', async () => {
  const variants = [SAVED, { ...SAVED, deckId: 'thoth-a1' }, { ...SAVED, reflections: 'Whole reading note' },
    { ...SAVED, reflections: {}, question: null, deckId: null },
    { ...SAVED, cards: [{ ...SAVED.cards[0], orientation: 'Reversed' }, { name: 'The Moon', position: 'Future', orientation: 'Upright' }], reflections: { 1: 'tides', Legacy: 'kept' } }];
  for (const variant of variants) {
    // Server reconstruction from a D1 row: null columns become empty strings.
    const row = { raw: variant.personalReading, cards: variant.cards, question: variant.question || '',
      reflections: variant.reflections && (typeof variant.reflections === 'string' || Object.keys(variant.reflections).length) ? variant.reflections : '', deckId: variant.deckId ?? null };
    const server = await fingerprintSavedVisualSource({ source: row, ...normalizeVisualSource(row) });
    assert.equal(await fingerprintSavedVisualEntry(variant), server);
  }
  assert.notEqual(await fingerprintSavedVisualEntry(SAVED), await fingerprintSavedVisualEntry({ ...SAVED, reflections: { ...SAVED.reflections, Overall: 'Changed' } }));
});

test('cloud reload keeps a recorded explicit unavailable outcome and a locally validated cache only for the same source state', async () => {
  const original = await bindingFor(SAVED, 'original-result');
  const cachedVisual = publicVisualSnapshot({ binding: original, cueLedger: await acceptedLedger(original), status: 'complete', raw: SAVED_RAW });
  const server = { ...SAVED, visualState: { attachmentStatus: 'failed', retryStatus: 'unavailable', sourceFingerprint: FP, stateVersion: 2, reason: 'attachment-error' } };
  const cached = { ...server, visual: cachedVisual, visualState: { ...server.visualState, reason: 'configuration-unavailable' } };
  const merged = mergeCachedJournalVisuals(projectJournalEntryVisuals(server), cached);
  assert.equal(merged.visualState.reason, 'configuration-unavailable');
  assert.deepEqual(merged.visual, cachedVisual);
  assert.equal(savedVisualRecovery(merged, { cloud: true }).canRetry, false);
  // Restored configuration is an explicit server decision for this same source;
  // an earlier local refusal cannot hide its now-available recovery action.
  const configured = mergeCachedJournalVisuals(projectJournalEntryVisuals({ ...server,
    visualState: { ...server.visualState, attachmentStatus: 'expired', retryStatus: 'available', reason: 'expired' } }), cached);
  assert.equal(savedVisualRecovery(configured, { cloud: true }).canRetry, true);
  assert.deepEqual(configured.visual, cachedVisual);
  // A newer server state or changed source wins.
  const newer = mergeCachedJournalVisuals(projectJournalEntryVisuals({ ...server, visualState: { ...server.visualState, stateVersion: 3 } }), cached);
  assert.equal(newer.visualState.reason, 'attachment-error');
  const edited = mergeCachedJournalVisuals(projectJournalEntryVisuals({ ...server, personalReading: `${SAVED_RAW} Edited.` }), cached);
  assert.equal(edited.visual, undefined);
  assert.equal(edited.visualState.reason, 'attachment-error');
});

test('a claimed replay fences late original-stream patches even while the original binding is still saved', async () => {
  const store = storage();
  const pendingReplay = { ...entry(), visualState: { attachmentStatus: 'pending', retryStatus: 'pending', sourceFingerprint: FP, stateVersion: 1, reason: null } };
  store.setItem('tarot_journal', JSON.stringify([pendingReplay]));
  const before = store.getItem('tarot_journal');
  assert.equal(patchSavedVisualSnapshot({ namespace: 'anon', binding, cueLedger: ledger(), status: 'complete', storage: store }), 0);
  assert.equal(store.getItem('tarot_journal'), before);
  // Without a replay claim the same original update is still accepted.
  store.setItem('tarot_journal', JSON.stringify([entry()]));
  assert.equal(patchSavedVisualSnapshot({ namespace: 'anon', binding, cueLedger: ledger(), status: 'complete', storage: store }), 1);
});

test('cloud polling covers only pending durable work and never terminal or complete states', () => {
  const at = (attachmentStatus, retryStatus) => ({ ...SAVED, visualState: { attachmentStatus, retryStatus, sourceFingerprint: FP, stateVersion: 1, reason: null } });
  assert.equal(needsCloudVisualRefresh(at('pending', 'unavailable')), true);
  assert.equal(needsCloudVisualRefresh(at('failed', 'pending')), true);
  for (const [attachment, retry] of [['attached', 'complete'], ['failed', 'exhausted'], ['failed', 'revoked'], ['expired', 'available'], ['failed', 'unavailable']]) {
    assert.equal(needsCloudVisualRefresh(at(attachment, retry)), false, `${attachment}/${retry}`);
  }
  assert.equal(needsCloudVisualRefresh({ ...SAVED, visual: { status: 'pending' } }), true);
  assert.equal(needsCloudVisualRefresh({ ...SAVED, visual: { status: 'revoked' } }), false);
});

test('configuration-unavailable status never waits for stale pending attachment or private transports', () => {
  const unavailable = { ...SAVED, visualState: { attachmentStatus: 'pending', retryStatus: 'unavailable',
    sourceFingerprint: FP, stateVersion: 4, reason: 'configuration-unavailable' } };
  for (const options of [{}, { cloud: true }, { originalResume: { visualJobToken: 'private-original' } },
    { replayResume: { visualJobToken: 'private-replay', attemptId: 'private-attempt' } }]) {
    assert.deepEqual(pick(savedVisualRecovery(unavailable, options), ['phase', 'canRetry']), { phase: 'unavailable', canRetry: false });
  }
  assert.equal(needsCloudVisualRefresh(unavailable), false);
});

test('authoritative available state remains explicitly eligible despite a historical configuration-unavailable reason', () => {
  const prepared = { ...SAVED, visualState: { attachmentStatus: 'failed', retryStatus: 'available',
    sourceFingerprint: FP, stateVersion: 2, reason: 'configuration-unavailable' } };
  for (const cloud of [false, true]) {
    assert.deepEqual(pick(savedVisualRecovery(prepared, { cloud }), ['phase', 'canRetry']), { phase: 'eligible', canRetry: true });
  }
  assert.equal(needsCloudVisualRefresh(prepared), false);
});

test('committed public visual fields never move backwards or across sources', () => {
  const state = version => ({ attachmentStatus: 'pending', retryStatus: 'pending', sourceFingerprint: FP, stateVersion: version, reason: null });
  const current = { ...SAVED, visualState: state(3) };
  assert.equal(adoptEntryVisuals(current, { ...SAVED, visualState: state(2) }), current);
  assert.equal(adoptEntryVisuals(current, { ...SAVED, question: 'Other', visualState: state(9) }), current);
  const next = adoptEntryVisuals(current, { ...SAVED, visualState: { ...state(4), retryStatus: 'complete', attachmentStatus: 'attached' } });
  assert.equal(next.visualState.retryStatus, 'complete');
  assert.equal(next.personalReading, SAVED_RAW);
  assert.equal(adoptEntryVisuals(next, next), next);
});

function retryResponse(state, resumeHandle = null) {
  return async () => Response.json({ state, resumeHandle });
}

test('a prepared available response with an old configuration reason retains explicit local recovery and private claim capability', async () => {
  const store = storage();
  const fingerprint = await fingerprintSavedVisualEntry(SAVED);
  const visualBinding = await bindingFor(SAVED, 'prepared-existing-local');
  store.setItem('tarot_journal', JSON.stringify([SAVED]));
  const handle = replayHandle(visualBinding, 'prepared-attempt');
  assert.equal(writeVisualResume({ namespace: 'anon', entryId: SAVED.id, binding: visualBinding,
    sourceFingerprint: fingerprint, stateVersion: 0, storage: store, resumeHandle: handle }), true);
  const result = await requestSavedVisualRetry({ namespace: 'anon', entry: SAVED, storage: store,
    fetchImpl: retryResponse({ attachmentStatus: 'failed', retryStatus: 'available', sourceFingerprint: fingerprint,
      stateVersion: 1, reason: 'configuration-unavailable', attemptId: 'prepared-attempt' }, handle) });
  assert.equal(result.entry.visualState.retryStatus, 'available');
  assert.equal(result.entry.visualState.stateVersion, 1);
  assert.equal(savedVisualRecovery(result.entry).canRetry, true);
  assert.equal(readVisualResume({ namespace: 'anon', entryId: SAVED.id, storage: store }).attemptId, 'prepared-attempt');
});

test('first unconfigured local refusal keeps the saved original attachment and version after exact source verification', async () => {
  const store = storage();
  const fingerprint = await fingerprintSavedVisualEntry(SAVED);
  const original = await bindingFor(SAVED, 'retained-expired-original');
  const visual = publicVisualSnapshot({ binding: original, cueLedger: await acceptedLedger(original), status: 'expired', raw: SAVED_RAW });
  const saved = { ...SAVED, visual, visualBinding: original,
    visualState: { attachmentStatus: 'expired', retryStatus: 'available', sourceFingerprint: fingerprint, stateVersion: 4, reason: 'expired' } };
  store.setItem('tarot_journal', JSON.stringify([saved]));
  const refusal = { attachmentStatus: 'missing', retryStatus: 'unavailable', sourceFingerprint: fingerprint,
    stateVersion: 0, reason: 'configuration-unavailable', attemptId: null, visualSnapshot: null };
  const result = await requestSavedVisualRetry({ namespace: 'anon', entry: saved, storage: store, fetchImpl: retryResponse(refusal) });
  assert.deepEqual(result.entry.visualState, { ...saved.visualState, retryStatus: 'unavailable', reason: 'configuration-unavailable' });
  assert.deepEqual(result.entry.visual, visual);
  assert.equal(result.entry.personalReading, SAVED_RAW);
});

test('an expired local original without newer replay state keeps its saved attachment classification on refusal', async () => {
  const store = storage();
  const fingerprint = await fingerprintSavedVisualEntry(SAVED);
  const original = await bindingFor(SAVED, 'legacy-expired-original');
  const visual = publicVisualSnapshot({ binding: original, cueLedger: await acceptedLedger(original), status: 'expired', raw: SAVED_RAW });
  const saved = { ...SAVED, visual, visualBinding: original };
  store.setItem('tarot_journal', JSON.stringify([saved]));
  const result = await requestSavedVisualRetry({ namespace: 'anon', entry: saved, storage: store,
    fetchImpl: retryResponse({ attachmentStatus: 'missing', retryStatus: 'unavailable', sourceFingerprint: fingerprint,
      stateVersion: 0, reason: 'configuration-unavailable', attemptId: null, visualSnapshot: null }) });
  assert.equal(result.entry.visualState.attachmentStatus, 'expired');
  assert.equal(result.entry.visualState.stateVersion, 0);
  assert.deepEqual(result.entry.visual, visual);
});

for (const cloud of [false, true]) {
  test(`${cloud ? 'cloud' : 'local'} explicit unavailable response preserves saved cues and ignores a stale resume capability`, async () => {
    const store = storage();
    const original = await bindingFor(SAVED, 'original-cache');
    const visual = publicVisualSnapshot({ binding: original, cueLedger: await acceptedLedger(original), status: 'expired', raw: SAVED_RAW });
    const fingerprint = await fingerprintSavedVisualEntry(SAVED);
    const current = { ...SAVED, visual, visualBinding: original,
      visualState: { attachmentStatus: 'expired', retryStatus: 'available', sourceFingerprint: fingerprint, stateVersion: 2, reason: 'expired' } };
    store.setItem('tarot_journal', JSON.stringify([current]));
    const state = { attachmentStatus: 'pending', retryStatus: 'unavailable', sourceFingerprint: fingerprint,
      stateVersion: 2, reason: 'configuration-unavailable', attemptId: 'private-unused-attempt' };
    let calls = 0;
    const fetchImpl = async () => { calls++; return Response.json({ state, resumeHandle: replayHandle(original, 'private-unused-attempt') }); };
    let committedEntry = current;
    const commit = cloud ? ({ update }) => {
      committedEntry = update(committedEntry);
      return { committed: true, entry: committedEntry };
    } : null;
    const result = await requestSavedVisualRetry({ namespace: 'anon', entry: current, cloud, storage: store, fetchImpl, commit });
    const saved = cloud ? committedEntry : readSavedVisualEntry({ namespace: 'anon', entryId: current.id, storage: store });
    assert.equal(result.state.retryStatus, 'unavailable');
    assert.equal(saved.personalReading, SAVED_RAW);
    assert.deepEqual(saved.visual, visual);
    assert.deepEqual(pick(savedVisualRecovery(saved, { cloud }), ['phase', 'canRetry']), { phase: 'unavailable', canRetry: false });
    assert.equal(needsCloudVisualRefresh(saved), false);
    assert.equal(readVisualResume({ namespace: 'anon', entryId: current.id, storage: store }), null);
    assert.equal(JSON.stringify(saved).includes('private-unused'), false);
    await assert.rejects(requestSavedVisualRetry({ namespace: 'anon', entry: saved, cloud, storage: store, fetchImpl, commit }), { code: 'ineligible' });
    assert.equal(calls, 1);
  });
}

test('a duplicate tab converges on the stored claim state and never deletes the other tab handle', async () => {
  const store = storage();
  const fingerprint = await fingerprintSavedVisualEntry(SAVED);
  store.setItem('tarot_journal', JSON.stringify([SAVED]));
  const replayBinding = await bindingFor(SAVED, 'replay-result');
  const handle = replayHandle(replayBinding, 'attempt-shared');
  const pendingState = { attachmentStatus: 'pending', retryStatus: 'pending', sourceFingerprint: fingerprint, attemptId: 'attempt-shared', stateVersion: 1, reason: null, visualSnapshot: null };
  // Tab A already committed the same claim while tab B's request was in flight.
  const first = await requestSavedVisualRetry({ namespace: 'anon', entry: SAVED, storage: store, fetchImpl: retryResponse(pendingState, handle) });
  assert.equal(first.state.retryStatus, 'pending');
  const second = await requestSavedVisualRetry({ namespace: 'anon', entry: SAVED, storage: store, fetchImpl: retryResponse(pendingState, handle) });
  assert.equal(second.state.retryStatus, 'pending');
  assert.equal(second.state.stateVersion, 1);
  assert.equal(readVisualResume({ namespace: 'anon', entryId: SAVED.id, storage: store }).attemptId, 'attempt-shared');
  assert.equal(JSON.parse(store.getItem('tarot_journal'))[0].visualState.stateVersion, 1);
});

test('a failed public commit rolls back a newly written private handle and reports storage', async () => {
  const store = storage();
  const fingerprint = await fingerprintSavedVisualEntry(SAVED);
  store.setItem('tarot_journal', JSON.stringify([SAVED]));
  const replayBinding = await bindingFor(SAVED, 'replay-result');
  const set = store.setItem;
  store.setItem = (key, value) => { if (key === 'tarot_journal') throw new Error('Quota'); set(key, value); };
  await assert.rejects(requestSavedVisualRetry({ namespace: 'anon', entry: SAVED, storage: store,
    fetchImpl: retryResponse({ attachmentStatus: 'pending', retryStatus: 'pending', sourceFingerprint: fingerprint, attemptId: 'attempt-q',
      stateVersion: 1, reason: null, visualSnapshot: null }, replayHandle(replayBinding, 'attempt-q')) }), { code: 'storage' });
  store.setItem = set;
  assert.equal(readVisualResume({ namespace: 'anon', entryId: SAVED.id, storage: store }), null);
  assert.equal(JSON.parse(store.getItem('tarot_journal'))[0].visualState, undefined);
  // A response for a different source fingerprint is never committed.
  await assert.rejects(requestSavedVisualRetry({ namespace: 'anon', entry: SAVED, storage: store,
    fetchImpl: retryResponse({ attachmentStatus: 'pending', retryStatus: 'pending', sourceFingerprint: 'e'.repeat(64), attemptId: 'attempt-x',
      stateVersion: 1, reason: null, visualSnapshot: null }, replayHandle(replayBinding, 'attempt-x')) }), { code: 'stale' });
  assert.equal(readVisualResume({ namespace: 'anon', entryId: SAVED.id, storage: store }), null);
});
