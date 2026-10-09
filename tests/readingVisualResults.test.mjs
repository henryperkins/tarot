import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser } from './helpers/journalFixtures.mjs';
import { saveAppJournalEntry } from '../functions/lib/journalEntries.js';
import {
  registerVisualResult, updateVisualResultSource, computeSourceFingerprint,
  attachJournalVisualResult, commitVisualResult, deleteJournalVisualLink,
  loadJournalVisualResult, revokeUserVisualResults, expireVisualResult
} from '../functions/lib/readingVisualResults.js';
import { createVisualCueLedger } from '../shared/reading/visualCueLedger.js';
import { hashVisualCueText } from '../shared/contracts/visualCueBatches.js';

const cards = [{ name: 'The Star', position: 'Present', orientation: 'Upright' }];
const source = { raw: 'The Star pours into a pool.', cards, question: 'Where is my hope?', reflections: '' };
const user = { id: 'user-1', subscription_tier: 'plus', subscription_status: 'active' };

async function setup(t, id = 'result-1') {
  const db = await createD1();
  t.after(() => db.sqlite.close());
  await seedUser(db, { id: user.id });
  await seedUser(db, { id: 'user-2' });
  const { spreadHash, contextHash } = await computeSourceFingerprint(source);
  const binding = { readingResultId: id, sourceRevision: 0, spreadHash, contextHash, artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };
  assert.equal((await registerVisualResult({ db, userId: user.id, readingResultId: id, binding })).ok, true);
  return { db, binding };
}
async function observe(db, binding, raw = source.raw, complete = true) {
  return updateVisualResultSource({ db, userId: user.id, readingResultId: binding.readingResultId, binding, raw, complete });
}
async function save(db, readingResultId, extra = {}) {
  return saveAppJournalEntry({ env: { DB: db }, user, body: {
    ...source, spread: 'One Card', spreadKey: 'single', personalReading: source.raw, readingResultId, ...extra
  } });
}
async function populated(binding) {
  const ledger = createVisualCueLedger(binding);
  ledger.raw = source.raw;
  ledger.analyzedEnd = source.raw.length;
  ledger.analyzedHash = await hashVisualCueText(source.raw);
  ledger.cues = [{ id: 'vc:fixture', kind: 'literal', passage: { start: 0, end: 8, quote: 'The Star' }, targets: [{ spreadIndex: 0, canonicalName: 'The Star', detailIds: ['pool-pour'] }] }];
  ledger.ledgerRevision = 1;
  return ledger;
}
async function commit(db, binding, ledger, extra = {}) {
  return commitVisualResult({ db, userId: user.id, readingResultId: binding.readingResultId, binding, expectedLedgerRevision: 0, ledger, finalRaw: source.raw, ...extra });
}

test('trusted registration retains completion before save and restores full ledger', async t => {
  const { db, binding } = await setup(t);
  assert.equal((await observe(db, binding)).ok, true);
  assert.equal((await commit(db, binding, await populated(binding))).ok, true);
  const saved = await save(db, binding.readingResultId);
  assert.equal(saved.body.visual.status, 'complete');
  const restored = await loadJournalVisualResult({ db, userId: user.id, entryId: saved.body.entry.id });
  assert.equal(restored.cueLedger.raw, source.raw);
  assert.equal(restored.cueLedger.cues.length, 1);
});

test('save before observer finalization attaches pending owned result and later restores cues', async t => {
  const { db, binding } = await setup(t);
  const saved = await save(db, binding.readingResultId);
  assert.equal(saved.body.visual.status, 'pending');
  await observe(db, binding);
  await commit(db, binding, await populated(binding));
  const restored = await loadJournalVisualResult({ db, userId: user.id, entryId: saved.body.entry.id });
  assert.equal(restored.status, 'complete');
  assert.equal(restored.cueLedger.raw, source.raw);
});

test('arbitrary unknown IDs and foreign results never create placeholders or attachments', async t => {
  const { db, binding } = await setup(t);
  const saved = await save(db, 'unverified-result');
  assert.equal(saved.body.success, true);
  assert.equal(saved.body.visual, undefined);
  assert.equal(await db.prepare('SELECT id FROM reading_visual_results WHERE id = ?').bind('unverified-result').first(), null);
  assert.equal((await attachJournalVisualResult({ db, userId: 'user-2', entryId: saved.body.entry.id, readingResultId: binding.readingResultId })).reason, 'ownership-mismatch');
  assert.equal((await commit(db, binding, await populated(binding), { userId: null })).reason, 'ownership-mismatch');
});

test('saved source, context and edition determine attachment; incoming savedSource cannot override it', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding);
  const saved = await save(db, null, { personalReading: 'Other prose.' });
  const attach = await attachJournalVisualResult({ db, userId: user.id, entryId: saved.body.entry.id, readingResultId: binding.readingResultId, savedSource: source });
  assert.equal(attach.reason, 'fingerprint-mismatch');
  const wrongDeck = await save(db, binding.readingResultId, { deckId: 'thoth-a1' });
  assert.equal(wrongDeck.body.visual, undefined);
});

test('same-seed retries retain saved prose and the original visual result', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding);
  const first = await save(db, binding.readingResultId, { sessionSeed: 'same-session' });
  const secondBinding = { ...binding, readingResultId: 'result-2' };
  await registerVisualResult({ db, userId: user.id, readingResultId: 'result-2', binding: secondBinding });
  await observe(db, secondBinding, 'Replacement prose.');
  const retry = await save(db, 'result-2', { sessionSeed: 'same-session', personalReading: 'Replacement prose.' });
  assert.equal(retry.body.deduplicated, true);
  assert.equal(retry.body.entry.id, first.body.entry.id);
  assert.equal(retry.body.visual.readingResultId, binding.readingResultId);
});

test('source replacement preserves saved old cues and rejects late old-source commits', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding);
  await commit(db, binding, await populated(binding));
  const saved = await save(db, binding.readingResultId);
  const next = { ...binding, sourceRevision: 1 };
  assert.equal((await observe(db, next, 'Replacement.')).ok, true);
  const restored = await loadJournalVisualResult({ db, userId: user.id, entryId: saved.body.entry.id });
  assert.equal(restored.binding.sourceRevision, 0);
  assert.equal(restored.cueLedger.raw, source.raw);
  assert.equal(restored.cueLedger.cues.length, 1);
  assert.equal(restored.status, 'cancelled');
  assert.equal((await commit(db, binding, await populated(binding))).reason, 'source-revision-conflict');
  assert.equal((await observe(db, binding)).reason, 'source-revision-conflict');
});

test('concurrent same-base commits accept only one cumulative ledger', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding);
  const a = await populated(binding);
  const b = structuredClone(a); b.cues[0].id = 'vc:different';
  const outcomes = await Promise.all([commit(db, binding, a), commit(db, binding, b)]);
  assert.equal(outcomes.filter(result => result.ok).length, 1);
});

test('receipt-only batches can advance the prefix without a new cue revision', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding);
  const ledger = createVisualCueLedger(binding);
  ledger.raw = source.raw; ledger.analyzedEnd = source.raw.length; ledger.analyzedHash = await hashVisualCueText(source.raw);
  ledger.receipts = [{ batchId: 'empty-batch' }];
  assert.equal((await commit(db, binding, ledger)).ok, true);
  assert.equal((await commit(db, binding, ledger)).reason, 'stale-ledger');
  assert.equal((await commit(db, binding, ledger, { expectedReceiptCount: 1 })).ok, true);
});

test('deleting last reference revokes capability before removal and rejects late commits', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding);
  const saved = await save(db, binding.readingResultId);
  const calls = [];
  const env = { READING_VISUAL_JOBS: { idFromName: id => id, get: id => ({ fetch: async url => { calls.push([id, url]); return new Response('{}'); } }) } };
  assert.equal((await deleteJournalVisualLink({ db, env, userId: user.id, entryId: saved.body.entry.id })).cleanedResult, true);
  assert.deepEqual(calls, [[binding.readingResultId, 'https://reading-visual-jobs/revoke']]);
  assert.equal((await commit(db, binding, await populated(binding))).reason, 'not-found');
});

test('expiry keeps saved static results, removes unsaved private data, and account deletion revokes all jobs', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding);
  await save(db, binding.readingResultId);
  assert.equal((await expireVisualResult({ db, userId: user.id, readingResultId: binding.readingResultId })).deleted, false);
  const unsaved = { ...binding, readingResultId: 'unsaved' };
  await registerVisualResult({ db, userId: user.id, readingResultId: 'unsaved', binding: unsaved });
  assert.equal((await expireVisualResult({ db, userId: user.id, readingResultId: 'unsaved' })).deleted, true);
  let revoked = 0;
  await revokeUserVisualResults({ env: { DB: db, READING_VISUAL_JOBS: { idFromName: id => id, get: () => ({ fetch: async () => { revoked++; return new Response('{}'); } }) } }, userId: user.id });
  assert.equal(revoked, 1);
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM reading_visual_results').first()).count, 0);
});

test('concurrent deletion of all references still revokes the final result', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding);
  const first = await save(db, binding.readingResultId);
  const second = await save(db, binding.readingResultId);
  let revoked = 0;
  const env = { READING_VISUAL_JOBS: { idFromName: id => id, get: () => ({ fetch: async () => { revoked++; return new Response('{}'); } }) } };
  const outcomes = await Promise.all([first, second].map(saved => deleteJournalVisualLink({ db, env, userId: user.id, entryId: saved.body.entry.id, deleteEntry: true })));
  assert.equal(outcomes.filter(result => result.cleanedResult).length, 1);
  assert.equal(revoked, 1);
});
