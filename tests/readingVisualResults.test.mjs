import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createD1 } from './helpers/d1Sqlite.mjs';
import * as visualResults from '../functions/lib/readingVisualResults.js';
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


test('full saved fingerprint includes trusted edition, catalog, exact raw and all context', async () => {
  assert.equal(typeof visualResults.fingerprintSavedVisualSource, 'function');
  const fp = overrides => visualResults.fingerprintSavedVisualSource({ source, artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1', ...overrides });
  const baseline = await fp();
  for (const change of [{ artworkEdition: 'another' }, { catalogVersion: 'v2' }, { source: { ...source, raw: source.raw + '\n' } }, { source: { ...source, reflections: { Overall: 'Changed' } } }, { source: { ...source, cards: [{ ...cards[0], orientation: 'Reversed' }] } }]) assert.notEqual(await fp(change), baseline);
});

test('failed owned cloud result retains validated cached cues independently of successful links', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding);
  await commit(db, binding, await populated(binding), { status: 'failed' });
  const saved = await save(db, binding.readingResultId);
  assert.equal(saved.body.visualState.attachmentStatus, 'failed');
  assert.equal(saved.body.visualState.retryStatus, 'unavailable');
  assert.equal(saved.body.visualState.visualSnapshot.cueLedger.cues[0].id, 'vc:fixture');
  await db.prepare('DELETE FROM journal_visual_links WHERE journal_entry_id = ?').bind(saved.body.entry.id).run();
  const restored = await visualResults.loadJournalVisualState({ db, userId: user.id, entryId: saved.body.entry.id });
  assert.equal(restored.visualSnapshot.cueLedger.raw, source.raw);
  assert.equal(restored.attachmentStatus, 'failed');
  assert.equal(await visualResults.loadJournalVisualState({ db, userId: 'user-2', entryId: saved.body.entry.id }), null);
});

test('state commits reject same-timestamp Overall edits during hashing and retain cached snapshots', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding); await commit(db, binding, await populated(binding));
  const saved = await save(db, binding.readingResultId);
  const original = saved.body.visualState;
  assert.ok(original);
  const prepare = db.prepare.bind(db);
  let edited = false;
  db.prepare = sql => {
    const statement = prepare(sql);
    if (!sql.startsWith('INSERT INTO journal_visual_state')) return statement;
    const bind = statement.bind.bind(statement);
    statement.bind = (...params) => {
      const bound = bind(...params); const run = bound.run.bind(bound);
      bound.run = async () => {
        if (!edited) { edited = true; await prepare('UPDATE journal_entries SET reflections_json = ? WHERE id = ?').bind(JSON.stringify({ Overall: 'Changed during hashing' }), saved.body.entry.id).run(); }
        return run();
      };
      return bound;
    };
    return statement;
  };
  const outcome = await visualResults.persistJournalVisualState({ db, userId: user.id, entryId: saved.body.entry.id, sourceFingerprint: original.sourceFingerprint, attachmentStatus: 'failed', reason: 'attachment-error' });
  assert.equal(outcome.ok, false);
  const current = await visualResults.loadJournalVisualState({ db, userId: user.id, entryId: saved.body.entry.id });
  assert.equal(current.attachmentStatus, 'missing');
  assert.equal(current.reason, 'source-changed');
  assert.equal(current.visualSnapshot.cueLedger.cues[0].id, 'vc:fixture');
  assert.equal(db.rows('SELECT narrative FROM journal_entries')[0].narrative, source.raw);
});

test('unlinked deletion revokes durable attempts and rejects late state resurrection', async t => {
  const { db } = await setup(t);
  const saved = await save(db, 'missing-job');
  const state = saved.body.visualState;
  assert.ok(state);
  await db.prepare(`INSERT INTO visual_retry_claims (id, admission_scope, source_fingerprint, user_id, journal_entry_id, attempt_id, visual_job_id, state_version, dispatch_status, retry_status, created_at, updated_at) VALUES ('claim', 'user:user-1', ?, ?, ?, 'attempt', 'replay-job', 1, 'reserved', 'pending', 1, 1)`).bind(state.sourceFingerprint, user.id, saved.body.entry.id).run();
  await db.prepare("UPDATE journal_visual_state SET claim_id = 'claim', attempt_id = 'attempt', retry_status = 'pending' WHERE journal_entry_id = ?").bind(saved.body.entry.id).run();
  const revoked = [];
  await deleteJournalVisualLink({ db, userId: user.id, entryId: saved.body.entry.id, deleteEntry: true, env: { READING_VISUAL_JOBS: { idFromName: id => id, get: id => ({ fetch: async () => { revoked.push(id); return new Response('{}'); } }) } } });
  assert.deepEqual(revoked, ['replay-job']);
  assert.equal(db.rows('SELECT retry_status FROM visual_retry_claims')[0].retry_status, 'revoked');
  assert.equal(db.rows('SELECT * FROM journal_visual_state').length, 0);
  assert.equal((await visualResults.persistJournalVisualState({ db, userId: user.id, entryId: saved.body.entry.id, sourceFingerprint: state.sourceFingerprint, attachmentStatus: 'attached' })).ok, false);
});

test('original commits and attachment cannot overwrite an active durable retry', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding);
  const saved = await save(db, binding.readingResultId);
  await db.prepare("UPDATE journal_visual_state SET attempt_id = 'successor-attempt', retry_status = 'pending' WHERE journal_entry_id = ?").bind(saved.body.entry.id).run();
  const before = db.rows('SELECT * FROM journal_visual_state')[0];
  assert.equal((await commit(db, binding, await populated(binding))).ok, false);
  assert.equal((await attachJournalVisualResult({ db, userId: user.id, entryId: saved.body.entry.id, readingResultId: binding.readingResultId })).attached, false);
  assert.deepEqual(db.rows('SELECT * FROM journal_visual_state')[0], before);
});

test('deleted original result and account revocation cannot be registered again', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding);
  const saved = await save(db, binding.readingResultId);
  await deleteJournalVisualLink({ db, userId: user.id, entryId: saved.body.entry.id, deleteEntry: true });
  assert.equal((await registerVisualResult({ db, userId: user.id, readingResultId: binding.readingResultId, binding })).ok, false);
  await revokeUserVisualResults({ env: { DB: db }, userId: user.id });
  const late = { ...binding, readingResultId: 'late-account-result' };
  assert.equal((await registerVisualResult({ db, userId: user.id, readingResultId: late.readingResultId, binding: late })).ok, false);
});

test('final original commit rejects a concurrent Overall edit even with unchanged updated_at', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding);
  const saved = await save(db, binding.readingResultId);
  const ledger = await populated(binding);
  const prepare = db.prepare.bind(db);
  db.prepare = sql => {
    const stmt = prepare(sql);
    if (!sql.startsWith('UPDATE reading_visual_results SET updated_at = ?, ledger_revision')) return stmt;
    const bind = stmt.bind.bind(stmt);
    stmt.bind = (...params) => {
      const bound = bind(...params); const run = bound.run.bind(bound);
      bound.run = async () => {
        await prepare('UPDATE journal_entries SET reflections_json = ? WHERE id = ?').bind(JSON.stringify({ Overall: 'New note' }), saved.body.entry.id).run();
        return run();
      }; return bound;
    }; return stmt;
  };
  assert.equal((await commit(db, binding, ledger)).ok, false);
  assert.equal(db.rows('SELECT ledger_revision FROM reading_visual_results')[0].ledger_revision, 0);
  assert.equal(db.rows('SELECT narrative FROM journal_entries')[0].narrative, source.raw);
});

test('foreign unverified fallback cannot be persisted as cloud authority and public reason is bounded', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding); await commit(db, binding, await populated(binding));
  const saved = await save(db, null);
  const foreign = { ...binding, readingResultId: 'foreign' };
  await registerVisualResult({ db, userId: 'user-2', readingResultId: foreign.readingResultId, binding: foreign });
  const snapshot = { readingResultId: foreign.readingResultId, binding: foreign, cueLedger: await populated(foreign) };
  assert.equal((await visualResults.persistJournalVisualState({ db, userId: user.id, entryId: saved.body.entry.id, attachmentStatus: 'failed', validatedSnapshot: snapshot })).ok, false);
  await visualResults.persistJournalVisualState({ db, userId: user.id, entryId: saved.body.entry.id, attachmentStatus: 'failed', reason: 'private-token-in-error' });
  const state = await visualResults.loadJournalVisualState({ db, userId: user.id, entryId: saved.body.entry.id });
  assert.equal(state.reason, 'attachment-error');
  assert.equal(state.visualSnapshot, null);
  assert.deepEqual(Object.keys(state).sort(), ['attachmentStatus', 'retryStatus', 'sourceFingerprint', 'attemptId', 'stateVersion', 'reason', 'visualSnapshot'].sort());
});

test('failed link storage still saves prose, failure reason and owned validated fallback', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding); await commit(db, binding, await populated(binding));
  const prepare = db.prepare.bind(db);
  db.prepare = sql => {
    if (sql.startsWith('INSERT INTO journal_visual_links')) throw new Error('simulated link storage failure');
    return prepare(sql);
  };
  const saved = await save(db, binding.readingResultId);
  assert.equal(saved.status, 201);
  assert.equal(saved.body.visual, undefined);
  assert.equal(saved.body.visualState.attachmentStatus, 'failed');
  assert.equal(saved.body.visualState.reason, 'attachment-error');
  assert.ok(saved.body.visualState.visualSnapshot);
  assert.equal(saved.body.visualState.visualSnapshot.cueLedger.cues[0].id, 'vc:fixture');
});

test('state cannot claim successful attachment from an unverified sidecar or absent link', async t => {
  const { db } = await setup(t);
  const saved = await save(db, 'absent');
  assert.equal((await visualResults.persistJournalVisualState({ db, userId: user.id, entryId: saved.body.entry.id, attachmentStatus: 'attached', retryStatus: 'complete' })).ok, false);
});

for (const populatedDatabase of [false, true]) test(`migration 0037 upgrades ${populatedDatabase ? 'saved linked/unlinked/failed rows' : 'an empty database'} without losing source or legacy snapshots`, async t => {
  const db = await createD1({ throughMigration: '0036_reading_visual_results.sql' });
  t.after(() => db.sqlite.close());
  assert.equal(db.rows("SELECT name FROM sqlite_master WHERE name = 'journal_visual_state'").length, 0);
  await seedUser(db, { id: user.id });
  let ids = [];
  if (populatedDatabase) {
    const { seedEntry } = await import('./helpers/journalFixtures.mjs');
    for (const id of ['legacy-linked', 'legacy-unlinked', 'legacy-failed']) {
      await seedEntry(db, { id, userId: user.id, cards, narrative: source.raw });
      await db.prepare('UPDATE journal_entries SET question = ? WHERE id = ?').bind(source.question, id).run();
    }
    const hashes = await computeSourceFingerprint(source);
    const binding = { readingResultId: 'legacy-result', sourceRevision: 0, spreadHash: hashes.spreadHash, contextHash: hashes.contextHash, artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };
    const ledger = await populated(binding);
    await db.prepare(`INSERT INTO reading_visual_results (id, user_id, created_at, updated_at, binding_json, source_revision, raw_hash, observed_raw, final_raw, ledger_revision, ledger_json, status) VALUES (?, ?, 1, 1, ?, 0, ?, ?, ?, 1, ?, 'complete')`).bind(binding.readingResultId, user.id, JSON.stringify(binding), await hashVisualCueText(source.raw), source.raw, source.raw, JSON.stringify(ledger)).run();
    for (const id of ['legacy-linked', 'legacy-failed']) await db.prepare(`INSERT INTO journal_visual_links (journal_entry_id, reading_result_id, user_id, created_at, expected_raw_hash, source_revision) VALUES (?, ?, ?, 1, ?, 0)`).bind(id, binding.readingResultId, user.id, await hashVisualCueText(source.raw)).run();
    const archived = { readingResultId: binding.readingResultId, binding, sourceRevision: 0, ledgerRevision: 1,
      cues: ledger.cues, introductions: [], status: 'failed', cueLedger: ledger, snapshot: ledger, finalRaw: source.raw };
    await db.prepare('UPDATE journal_visual_links SET archived_visual_json = ? WHERE journal_entry_id = ?').bind(JSON.stringify(archived), 'legacy-failed').run();
    ids = ['legacy-linked', 'legacy-unlinked', 'legacy-failed'];
  }
  const before = db.rows('SELECT * FROM journal_entries');
  const { applyD1Migration } = await import('./helpers/d1Sqlite.mjs');
  applyD1Migration(db, '0037_reading_visual_retry_state.sql');
  assert.deepEqual(db.rows('SELECT * FROM journal_entries'), before);
  for (const id of ids) {
    const state = await visualResults.loadJournalVisualState({ db, userId: user.id, entryId: id });
    assert.equal(state.attachmentStatus, id === 'legacy-unlinked' ? 'missing' : id === 'legacy-failed' ? 'failed' : 'attached');
    if (id !== 'legacy-unlinked') assert.equal(state.visualSnapshot.cueLedger.cues[0].id, 'vc:fixture');
  }
  const insertClaim = id => db.prepare(`INSERT INTO visual_retry_claims (id, admission_scope, source_fingerprint, retry_status, created_at, updated_at) VALUES (?, 'trusted-scope', 'full-fingerprint', 'exhausted', 1, 1)`).bind(id).run();
  await insertClaim('one');
  await assert.rejects(insertClaim('another-entry-id'), /UNIQUE constraint failed/);
  assert.equal(db.rows('SELECT count(*) AS n FROM visual_retry_claims')[0].n, 1);
});

test('list state loading stays scoped and bounded across the D1 parameter limit', async t => {
  const { db } = await setup(t);
  const { seedEntry } = await import('./helpers/journalFixtures.mjs');
  const ids = Array.from({ length: 95 }, (_, i) => `batch-${i}`);
  for (const id of ids) await seedEntry(db, { id, userId: user.id, cards, narrative: source.raw });
  await seedEntry(db, { id: 'foreign-entry', userId: 'user-2', cards, narrative: source.raw });
  const prepare = db.prepare.bind(db);
  let queries = 0;
  db.prepare = sql => {
    queries++;
    const stmt = prepare(sql); const bind = stmt.bind.bind(stmt);
    stmt.bind = (...params) => { assert.ok(params.length <= 100, 'D1 bound parameter limit'); return bind(...params); };
    return stmt;
  };
  const states = await visualResults.loadJournalVisualStates({ db, userId: user.id, entryIds: [...ids, 'foreign-entry'] });
  assert.equal(states.get(ids[94]).attachmentStatus, 'missing');
  assert.ok(!states.get('foreign-entry'));
  assert.ok(queries <= 6, `list must batch database reads (observed ${queries})`);
});

test('unlinked owned fallback result is revoked and removed on entry deletion', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding); await commit(db, binding, await populated(binding), { status: 'failed' });
  const saved = await save(db, binding.readingResultId);
  await db.prepare('DELETE FROM journal_visual_links WHERE journal_entry_id = ?').bind(saved.body.entry.id).run();
  const ids = [];
  await deleteJournalVisualLink({ db, userId: user.id, entryId: saved.body.entry.id, deleteEntry: true,
    env: { READING_VISUAL_JOBS: { idFromName: id => id, get: id => ({ fetch: async () => { ids.push(id); return new Response('{}'); } }) } } });
  assert.deepEqual(ids, [binding.readingResultId]);
  assert.equal(db.rows('SELECT * FROM reading_visual_results').length, 0);
  assert.equal((await registerVisualResult({ db, userId: user.id, readingResultId: binding.readingResultId, binding })).ok, false);
});

test('pre-fix Overall binding stays cached with its original receipts and is never certified for new context', async t => {
  const { db } = await setup(t);
  const { canonicalVisualCueJSON } = await import('../shared/contracts/visualCueBatches.js');
  const { spreadHash } = await computeSourceFingerprint(source);
  const contextHash = await hashVisualCueText(canonicalVisualCueJSON({ question: source.question, reflections: '', cardReflections: [''] }));
  const binding = { readingResultId: 'legacy-overall', sourceRevision: 0, spreadHash, contextHash, artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };
  const ledger = await populated(binding);
  ledger.receipts = [{ batchId: 'original-receipt', binding }];
  await registerVisualResult({ db, userId: user.id, readingResultId: binding.readingResultId, binding });
  await observe(db, binding);
  await commit(db, binding, ledger);
  const saved = await save(db, null, { reflections: { Overall: 'Original whole-reading note' } });
  await db.prepare(`INSERT INTO journal_visual_links (journal_entry_id, reading_result_id, user_id, created_at, expected_raw_hash, source_revision) VALUES (?, ?, ?, 1, ?, 0)`).bind(saved.body.entry.id, binding.readingResultId, user.id, await hashVisualCueText(source.raw)).run();
  const state = await visualResults.loadJournalVisualState({ db, userId: user.id, entryId: saved.body.entry.id });
  assert.equal(state.attachmentStatus, 'missing');
  assert.equal(state.visualSnapshot.binding.contextHash, contextHash);
  assert.deepEqual(state.visualSnapshot.cueLedger.receipts, ledger.receipts);
  assert.equal((await attachJournalVisualResult({ db, userId: user.id, entryId: saved.body.entry.id, readingResultId: binding.readingResultId })).reason, 'fingerprint-mismatch');
  assert.equal((await loadJournalVisualResult({ db, userId: user.id, entryId: saved.body.entry.id })).cueLedger.cues[0].id, 'vc:fixture');
  assert.equal(db.rows('SELECT binding_json FROM reading_visual_results WHERE id = ?', [binding.readingResultId])[0].binding_json, JSON.stringify(binding));
});

test('original commit rejects a newer saved-state version while asynchronous validation was pending', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding);
  const saved = await save(db, binding.readingResultId);
  const ledger = await populated(binding);
  const prepare = db.prepare.bind(db);
  db.prepare = sql => {
    const stmt = prepare(sql);
    if (!sql.startsWith('UPDATE reading_visual_results SET updated_at = ?, ledger_revision')) return stmt;
    const bind = stmt.bind.bind(stmt);
    stmt.bind = (...params) => {
      const bound = bind(...params); const run = bound.run.bind(bound);
      bound.run = async () => {
        await prepare('UPDATE journal_visual_state SET state_version = state_version + 1 WHERE journal_entry_id = ?').bind(saved.body.entry.id).run();
        return run();
      }; return bound;
    }; return stmt;
  };
  assert.equal((await commit(db, binding, ledger)).ok, false);
});

test('claim and journal counters are independently fenced during durable state transitions', async t => {
  const { db } = await setup(t);
  const saved = await save(db, 'missing');
  const id = saved.body.entry.id;
  const fp = saved.body.visualState.sourceFingerprint;
  await db.prepare(`INSERT INTO visual_retry_claims (id, admission_scope, source_fingerprint, user_id, journal_entry_id, attempt_id, state_version, dispatch_status, retry_status, created_at, updated_at) VALUES ('version-claim', 'scope', ?, ?, ?, 'attempt', 7, 'reserved', 'pending', 1, 1)`).bind(fp, user.id, id).run();
  await db.prepare("UPDATE journal_visual_state SET claim_id = 'version-claim', attempt_id = 'attempt', retry_status = 'pending' WHERE journal_entry_id = ?").bind(id).run();
  const input = { db, userId: user.id, entryId: id, sourceFingerprint: fp, attachmentStatus: 'failed', retryStatus: 'exhausted', attemptId: 'attempt', claimId: 'version-claim' };
  assert.equal((await visualResults.persistJournalVisualState({ ...input, expectedStateVersion: 1, expectedClaimVersion: 6 })).ok, false);
  assert.equal((await visualResults.persistJournalVisualState({ ...input, expectedStateVersion: 1, expectedClaimVersion: 7 })).ok, true);
  assert.equal((await visualResults.persistJournalVisualState({ ...input, expectedStateVersion: 2, expectedClaimVersion: 7 })).ok, true);
  assert.equal(db.rows('SELECT state_version FROM journal_visual_state')[0].state_version, 3);
  assert.equal(db.rows('SELECT state_version FROM visual_retry_claims')[0].state_version, 7);
});

test('public durable snapshots project cue fields and exclude private transport bookkeeping at every level', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding);
  const ledger = await populated(binding);
  ledger.visualJobToken = 'secret-marker';
  ledger.cues[0].visualJobId = 'secret-marker';
  ledger.cues[0].passage.resumeToken = 'secret-marker';
  ledger.cues[0].targets[0].attemptId = 'secret-marker';
  ledger.receipts = [{ batchId: 'batch', visualJobToken: 'secret-marker' }];
  await commit(db, binding, ledger);
  const saved = await save(db, binding.readingResultId);
  assert.ok(!JSON.stringify(saved.body.visualState).includes('secret-marker'));
  assert.ok(!JSON.stringify(saved.body.visual).includes('secret-marker'));
  assert.equal(saved.body.visualState.visualSnapshot.cueLedger.cues[0].id, 'vc:fixture');
});

test('attachment reports rejection when its final durable state write loses a source race', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding); await commit(db, binding, await populated(binding));
  const saved = await save(db, null);
  const prepare = db.prepare.bind(db);
  db.prepare = sql => {
    const stmt = prepare(sql);
    if (!sql.startsWith('INSERT INTO journal_visual_state')) return stmt;
    const bind = stmt.bind.bind(stmt);
    stmt.bind = (...params) => {
      const bound = bind(...params); const run = bound.run.bind(bound);
      bound.run = async () => {
        await prepare('UPDATE journal_entries SET reflections_json = ? WHERE id = ?').bind(JSON.stringify({ Overall: 'Later note' }), saved.body.entry.id).run();
        return run();
      }; return bound;
    }; return stmt;
  };
  const attached = await attachJournalVisualResult({ db, userId: user.id, entryId: saved.body.entry.id, readingResultId: binding.readingResultId });
  assert.equal(attached.attached, false);
  assert.equal((await visualResults.loadJournalVisualState({ db, userId: user.id, entryId: saved.body.entry.id })).attachmentStatus, 'missing');
});

test('legacy Overall attachment rejection persists failed reason while preserving historical binding and receipts', async t => {
  const { db } = await setup(t);
  const { canonicalVisualCueJSON } = await import('../shared/contracts/visualCueBatches.js');
  const { spreadHash } = await computeSourceFingerprint(source);
  const contextHash = await hashVisualCueText(canonicalVisualCueJSON({ question: source.question, reflections: '', cardReflections: [''] }));
  const binding = { readingResultId: 'legacy-failed-state', sourceRevision: 0, spreadHash, contextHash, artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };
  const ledger = await populated(binding);
  ledger.receipts = [{ batchId: 'historical-receipt', binding }];
  await registerVisualResult({ db, userId: user.id, readingResultId: binding.readingResultId, binding });
  await observe(db, binding); await commit(db, binding, ledger);
  const saved = await save(db, null, { reflections: { Overall: 'A whole-reading note' } });
  const id = saved.body.entry.id;
  await db.prepare('DELETE FROM journal_visual_state WHERE journal_entry_id = ?').bind(id).run();
  await db.prepare(`INSERT INTO journal_visual_links (journal_entry_id, reading_result_id, user_id, created_at, expected_raw_hash) VALUES (?, ?, ?, 1, ?)`).bind(id, binding.readingResultId, user.id, await hashVisualCueText(source.raw)).run();
  assert.equal((await attachJournalVisualResult({ db, userId: user.id, entryId: id, readingResultId: binding.readingResultId })).reason, 'fingerprint-mismatch');
  const restored = await visualResults.loadJournalVisualState({ db, userId: user.id, entryId: id });
  assert.equal(restored.attachmentStatus, 'failed');
  assert.equal(restored.reason, 'fingerprint-mismatch');
  assert.equal(restored.retryStatus, 'unavailable');
  assert.equal(restored.stateVersion, 1);
  assert.equal(db.rows('SELECT * FROM journal_visual_state').length, 1);
  assert.equal(restored.visualSnapshot.binding.contextHash, contextHash);
  assert.deepEqual(restored.visualSnapshot.cueLedger.receipts, ledger.receipts);
  assert.equal(db.rows('SELECT binding_json FROM reading_visual_results WHERE id = ?', [binding.readingResultId])[0].binding_json, JSON.stringify(binding));
});
