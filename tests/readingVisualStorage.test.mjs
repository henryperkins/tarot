import test from 'node:test';
import assert from 'node:assert/strict';
import { createVisualCueLedger } from '../shared/reading/visualCueLedger.js';
import { visualStorageNamespace, writeVisualResume, readVisualResume, clearVisualResumes,
  patchSavedVisualSnapshot, publicVisualSnapshot, persistJournalWithVisualFallback } from '../src/lib/readingVisualStorage.js';
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
