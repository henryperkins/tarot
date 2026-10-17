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
import * as visualRetry from '../functions/lib/readingVisualRetry.js';
import { ReadingVisualJob } from '../src/worker/readingVisualJob.js';
import { createVisualInitialAdmission } from '../functions/lib/readingVisualAdmission.js';

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
function replayEnv(db) {
  return { DB: db, VISUAL_REPLAY_LIMITS: JSON.stringify({ rateLimit: 3, windowMs: 60000, totalLimit: 5 }),
    VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: 'fake',
    AI: { run() { assert.fail('Saved visual reads cannot infer'); } }, READING_VISUAL_JOBS: {} };
}
function initialEnv(db) {
  return { ...replayEnv(db), VISUAL_INITIAL_LIMITS: JSON.stringify({ provider: 'workers-ai', model: 'fake',
    rateLimit: 5, windowMs: 60000, totalLimit: 10, globalRateLimit: 20, globalTotalLimit: 100,
    maxDispatchCostMicrousd: 175, scopeCostLimitMicrousd: 1750, globalCostLimitMicrousd: 17500 }) };
}
async function save(db, readingResultId, extra = {}) {
  return saveAppJournalEntry({ env: replayEnv(db), user, body: {
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

const CLAIM_TOMBSTONE_FIELDS = new Set(['id', 'admission_scope', 'source_fingerprint', 'user_id', 'state_version',
  'dispatch_status', 'retry_status', 'created_at', 'updated_at', 'aggregate_scope', 'reserved_at']);
function assertPrivateClaimPurged(claim, original, account = false) {
  assert.equal(claim.retry_status, 'revoked');
  assert.equal(claim.dispatch_status, 'revoked');
  assert.equal(claim.state_version, original.state_version + 1);
  for (const [key, value] of Object.entries(claim)) {
    if (!CLAIM_TOMBSTONE_FIELDS.has(key)) assert.equal(value, null, `${key} must be purged`);
  }
  for (const key of ['id', 'admission_scope', 'source_fingerprint', 'aggregate_scope', 'reserved_at', 'created_at']) {
    assert.equal(claim[key], original[key], `${key} must preserve allowance fencing`);
  }
  assert.equal(claim.user_id, account ? null : original.user_id);
}

async function sensitiveReplayFixture(t, dispatchStatus = 'reserved') {
  const { db } = await setup(t);
  const saved = await save(db, 'private-replay-result');
  const entryId = saved.body.entry.id;
  const owned = await visualResults.loadOwnedJournalVisualSource({ db, userId: user.id, entryId });
  const hashes = await computeSourceFingerprint(owned.source);
  const binding = { readingResultId: 'private-replay-result', sourceRevision: 0, spreadHash: hashes.spreadHash,
    contextHash: hashes.contextHash, artworkEdition: owned.artworkEdition, catalogVersion: owned.catalogVersion };
  const now = Date.now();
  await db.prepare(`INSERT INTO visual_retry_claims
    (id, admission_scope, source_fingerprint, user_id, journal_entry_id, reading_result_id, attempt_id, visual_job_id,
      state_version, dispatch_status, retry_status, created_at, updated_at, aggregate_scope, source_json,
      saved_fields_json, journal_state_version, binding_json, visual_token, expires_at, reserved_at)
    VALUES ('private-claim', ?, ?, ?, ?, ?, 'private-attempt', 'private-transport', 1, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, 'private-capability', ?, ?)`)
    .bind(`user:${user.id}`, saved.body.visualState.sourceFingerprint, user.id, entryId, binding.readingResultId,
      dispatchStatus, now, now, `user:${user.id}`, JSON.stringify(owned.source), JSON.stringify(Object.fromEntries(
        ['narrative', 'cards_json', 'question', 'reflections_json', 'deck_id'].map(key => [key, owned.row[key]]))),
      saved.body.visualState.stateVersion, JSON.stringify(binding), now + 60000, dispatchStatus === 'reserved' ? now : null).run();
  await db.prepare(`UPDATE journal_visual_state SET claim_id = 'private-claim', attempt_id = 'private-attempt',
    retry_status = 'pending' WHERE journal_entry_id = ?`).bind(entryId).run();
  const claim = db.rows("SELECT * FROM visual_retry_claims WHERE id = 'private-claim'")[0];
  return { db, saved, entryId, owned, binding, claim };
}

test('entry deletion purges replay source and capabilities before transport cancellation, retaining only its allowance tombstone', async t => {
  const f = await sensitiveReplayFixture(t);
  assert.ok(await visualRetry.initializeVisualReplay({ db: f.db, claim: f.claim }));
  const cancelled = [];
  const atCancellation = [];
  await deleteJournalVisualLink({ db: f.db, userId: user.id, entryId: f.entryId, deleteEntry: true,
    env: { READING_VISUAL_JOBS: { idFromName: id => id, get: id => ({ fetch: async () => {
      atCancellation.push({ claim: f.db.rows("SELECT * FROM visual_retry_claims WHERE id = 'private-claim'")[0],
        resultCount: f.db.rows('SELECT * FROM reading_visual_results WHERE id = ?', [f.binding.readingResultId]).length });
      cancelled.push(id); return new Response('{}');
    } }) } } });
  assert.ok(cancelled.includes('private-transport'));
  for (const { claim, resultCount } of atCancellation) {
    assertPrivateClaimPurged(claim, f.claim);
    assert.equal(resultCount, 0);
  }
  assert.equal(f.db.rows('SELECT * FROM journal_entries').length, 0);
  assertPrivateClaimPurged(f.db.rows("SELECT * FROM visual_retry_claims WHERE id = 'private-claim'")[0], f.claim);
});

test('entry deletion before result initialization fences a stale init, reservation, hash completion and commit', async t => {
  const f = await sensitiveReplayFixture(t);
  await deleteJournalVisualLink({ db: f.db, userId: user.id, entryId: f.entryId, deleteEntry: true });
  assert.equal(await visualRetry.initializeVisualReplay({ db: f.db, claim: f.claim }), null);
  const env = { DB: f.db, VISUAL_REPLAY_LIMITS: JSON.stringify({ rateLimit: 3, windowMs: 60000, totalLimit: 5 }),
    VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: 'fake', AI: { run: async () => assert.fail('deleted source must not infer') } };
  assert.equal(await visualRetry.reserveVisualReplay({ env, claim: f.claim }), false);
  assert.equal(await visualRetry.settleVisualReplay({ db: f.db, claim: f.claim, ledger: await populated(f.binding) }), false);
  assert.equal((await registerVisualResult({ db: f.db, userId: user.id, readingResultId: f.binding.readingResultId, binding: f.binding })).ok, false);
  assertPrivateClaimPurged(f.db.rows("SELECT * FROM visual_retry_claims WHERE id = 'private-claim'")[0], f.claim);
  assert.equal(f.db.rows('SELECT * FROM reading_visual_results WHERE id = ?', [f.binding.readingResultId]).length, 0);
});

test('purged entry claim still prevents same-source replay when local, result and journal IDs change', async t => {
  const f = await sensitiveReplayFixture(t);
  await deleteJournalVisualLink({ db: f.db, userId: user.id, entryId: f.entryId, deleteEntry: true });
  let transportCalls = 0;
  const env = { DB: f.db, VISUAL_REPLAY_LIMITS: JSON.stringify({ rateLimit: 3, windowMs: 60000, totalLimit: 5 }),
    VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: 'fake', AI: { run: async () => assert.fail('same source allowance was consumed') },
    READING_VISUAL_JOBS: { idFromName: id => id, get: () => ({ fetch: async () => { transportCalls++; return new Response('{}'); } }) } };
  const admission = await visualRetry.createVisualReplayAdmission({ env, userId: user.id });
  for (const id of ['replacement-local', 'another-local']) {
    const outcome = await visualRetry.retryLocalVisuals({ env, admission,
      savedSource: { ...f.owned.source, id, readingResultId: id, visualJobToken: 'replacement-token' } });
    assert.equal(outcome.resumeHandle, null);
  }
  const replacement = await save(f.db, 'replacement-result');
  assert.notEqual(replacement.body.entry.id, f.entryId);
  const cloud = await visualRetry.retryJournalVisuals({ env, userId: user.id, entryId: replacement.body.entry.id });
  assert.equal(cloud.resumeHandle, null);
  assert.equal(transportCalls, 0);
  assert.equal(f.db.rows('SELECT * FROM visual_retry_claims').length, 1);
  assertPrivateClaimPurged(f.db.rows('SELECT * FROM visual_retry_claims')[0], f.claim);
});

test('account revocation purges linked and local replay payloads before cancellation and blocks stale work', async t => {
  const f = await sensitiveReplayFixture(t);
  assert.ok(await visualRetry.initializeVisualReplay({ db: f.db, claim: f.claim }));
  await f.db.prepare(`INSERT INTO visual_retry_claims SELECT 'local-private-claim', admission_scope, 'different-source', user_id,
    NULL, 'local-private-result', 'local-private-attempt', 'local-private-transport', state_version, dispatch_status,
    retry_status, created_at, updated_at, aggregate_scope, source_json, saved_fields_json, journal_state_version,
    binding_json, visual_token, expires_at, reserved_at FROM visual_retry_claims WHERE id = 'private-claim'`).run();
  const local = f.db.rows("SELECT * FROM visual_retry_claims WHERE id = 'local-private-claim'")[0];
  const cancelled = [];
  const atCancellation = [];
  await revokeUserVisualResults({ userId: user.id, env: { DB: f.db, READING_VISUAL_JOBS: { idFromName: id => id,
    get: id => ({ fetch: async () => {
      atCancellation.push(f.db.rows('SELECT * FROM visual_retry_claims'));
      cancelled.push(id); return new Response('{}', { status: 503 });
    } }) } } });
  assert.ok(cancelled.includes('private-transport'));
  assert.ok(cancelled.includes('local-private-transport'));
  for (const claims of atCancellation) for (const claim of claims) assertPrivateClaimPurged(claim, claim.id === f.claim.id ? f.claim : local, true);
  assert.equal(await visualRetry.initializeVisualReplay({ db: f.db, claim: f.claim }), null);
  assert.equal(await visualRetry.settleVisualReplay({ db: f.db, claim: f.claim, ledger: await populated(f.binding) }), false);
  assert.equal(f.db.rows('SELECT * FROM reading_visual_results').length, 0);
  for (const claim of f.db.rows('SELECT * FROM visual_retry_claims')) assertPrivateClaimPurged(claim, claim.id === f.claim.id ? f.claim : local, true);
});

for (const deletion of ['entry', 'account']) test(`${deletion} deletion aborts owned replay inference, purges transport source and rejects its late response`, async t => {
  const f = await sensitiveReplayFixture(t, 'prepared');
  let finish, signal, stored;
  const pending = [];
  const env = { DB: f.db, VISUAL_REPLAY_LIMITS: JSON.stringify({ rateLimit: 3, windowMs: 60000, totalLimit: 5 }),
    VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: 'fake', AI: { run: async (_model, _body, options) => {
      signal = options.signal; return new Promise(resolve => { finish = resolve; });
    } } };
  const job = new ReadingVisualJob({ storage: { get: async () => stored, put: async (_key, value) => { stored = structuredClone(value); }, setAlarm: async () => {} },
    blockConcurrencyWhile: fn => fn(), waitUntil: promise => pending.push(promise) }, env);
  env.READING_VISUAL_JOBS = { idFromName: id => id, get: id => ({ fetch: (url, options) => id === 'private-transport'
    ? job.fetch(new Request(url, options)) : Promise.resolve(new Response('{}')) }) };
  await job.fetch(new Request('https://reading-visual-jobs/replay-init', { method: 'POST', body: JSON.stringify({ claimId: f.claim.id,
    attemptId: f.claim.attempt_id, expectedClaimVersion: f.claim.state_version, visualJobId: f.claim.visual_job_id }) }));
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  const active = f.db.rows("SELECT * FROM visual_retry_claims WHERE id = 'private-claim'")[0];
  if (deletion === 'entry') await deleteJournalVisualLink({ db: f.db, env, userId: user.id, entryId: f.entryId, deleteEntry: true });
  else await revokeUserVisualResults({ env, userId: user.id });
  assert.equal(signal.aborted, true);
  assert.equal(job.ledger, null); assert.equal(job.authoritativeRaw, ''); assert.equal(job.visualToken, null);
  assert.deepEqual(job.validationContext, { cards: [] });
  assert.equal(JSON.stringify(stored).includes(source.raw), false);
  finish({ response: { proposals: [] } });
  await Promise.all(pending);
  assertPrivateClaimPurged(f.db.rows("SELECT * FROM visual_retry_claims WHERE id = 'private-claim'")[0], active, deletion === 'account');
  assert.equal(f.db.rows('SELECT * FROM reading_visual_results WHERE id = ?', [f.binding.readingResultId]).length, 0);
  assert.equal((await job.fetch(new Request('https://reading-visual-jobs/snapshot', { headers: { 'X-Visual-Token': 'private-capability' } }))).status, 410);
});

for (const deletion of ['entry', 'account']) test(`${deletion} deletion atomically captures a replay claim inserted just before the cleanup transaction`, async t => {
  const f = await sensitiveReplayFixture(t);
  let concurrent;
  const batch = f.db.batch.bind(f.db);
  f.db.batch = async statements => {
    await f.db.prepare(`INSERT INTO visual_retry_claims SELECT 'concurrent-private-claim', admission_scope, 'concurrent-source', user_id,
      journal_entry_id, 'concurrent-private-result', 'concurrent-private-attempt', 'concurrent-private-transport', state_version,
      dispatch_status, retry_status, created_at, updated_at, aggregate_scope, source_json, saved_fields_json, journal_state_version,
      binding_json, visual_token, expires_at, reserved_at FROM visual_retry_claims WHERE id = 'private-claim'`).run();
    concurrent = f.db.rows("SELECT * FROM visual_retry_claims WHERE id = 'concurrent-private-claim'")[0];
    f.db.batch = batch;
    return batch(statements);
  };
  const cancelled = [];
  const env = { DB: f.db, READING_VISUAL_JOBS: { idFromName: id => id, get: id => ({ fetch: async () => { cancelled.push(id); return new Response('{}'); } }) } };
  if (deletion === 'entry') await deleteJournalVisualLink({ db: f.db, env, userId: user.id, entryId: f.entryId, deleteEntry: true });
  else await revokeUserVisualResults({ env, userId: user.id });
  assert.ok(cancelled.includes('private-transport'));
  assert.ok(cancelled.includes('concurrent-private-transport'));
  assertPrivateClaimPurged(f.db.rows("SELECT * FROM visual_retry_claims WHERE id = 'concurrent-private-claim'")[0], concurrent, deletion === 'account');
});

for (const deletion of ['entry', 'account']) test(`${deletion} deletion erases pending initial admissions and anonymizes the consumed budget ledger`, async t => {
  const f = await sensitiveReplayFixture(t);
  const now = Date.now();
  await f.db.prepare(`INSERT INTO visual_initial_admissions
    (reading_result_id, user_id, aggregate_scope, binding_json, token_hash, expires_at, created_at)
    VALUES (?, ?, 'hashed-owner-scope', ?, 'private-token-hash', ?, ?)`)
    .bind(f.binding.readingResultId, user.id, JSON.stringify(f.binding), now + 60000, now).run();
  await f.db.prepare(`INSERT INTO visual_initial_reservations
    (dispatch_id, reading_result_id, aggregate_scope, reserved_cost_microusd, reserved_at)
    VALUES ('private-initial-dispatch', ?, 'hashed-owner-scope', 175, ?)`)
    .bind(f.binding.readingResultId, now).run();
  await f.db.prepare(`INSERT INTO visual_initial_admissions
    (reading_result_id, user_id, aggregate_scope, binding_json, token_hash, expires_at, created_at)
    VALUES ('foreign-initial-result', 'user-2', 'foreign-scope', '{}', 'foreign-token-hash', ?, ?)`)
    .bind(now + 60000, now).run();
  const foreign = f.db.rows("SELECT * FROM visual_initial_admissions WHERE user_id = 'user-2'")[0];
  const cancelled = [];
  const env = { DB: f.db, READING_VISUAL_JOBS: { idFromName: id => id, get: id => ({ fetch: async () => {
    cancelled.push(id); assert.equal(f.db.rows('SELECT * FROM visual_initial_admissions WHERE user_id = ?', [user.id]).length, 0);
    return new Response('{}');
  } }) } };
  if (deletion === 'entry') await deleteJournalVisualLink({ db: f.db, env, userId: user.id, entryId: f.entryId, deleteEntry: true });
  else await revokeUserVisualResults({ env, userId: user.id });
  assert.ok(cancelled.includes(f.binding.readingResultId));
  assert.equal(f.db.rows('SELECT * FROM visual_initial_admissions WHERE user_id = ?', [user.id]).length, 0);
  assert.deepEqual(f.db.rows('SELECT * FROM visual_initial_reservations')[0], {
    dispatch_id: 'private-initial-dispatch', reading_result_id: null, aggregate_scope: 'hashed-owner-scope', reserved_cost_microusd: 175, reserved_at: now
  });
  assert.deepEqual(f.db.rows("SELECT * FROM visual_initial_admissions WHERE user_id = 'user-2'")[0], foreign);
  assert.equal((await registerVisualResult({ db: f.db, userId: user.id, readingResultId: f.binding.readingResultId, binding: f.binding })).ok, false);
});

test('entry deletion revokes a server-admitted initial job before it has a result or replay claim', async t => {
  const { db, binding: registered } = await setup(t);
  const binding = { ...registered, readingResultId: 'private-pending-initial-result' };
  const env = { DB: db, VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: 'fake',
    VISUAL_INITIAL_LIMITS: JSON.stringify({ provider: 'workers-ai', model: 'fake', rateLimit: 5, windowMs: 60000, totalLimit: 10,
      globalRateLimit: 20, globalTotalLimit: 100, maxDispatchCostMicrousd: 175, scopeCostLimitMicrousd: 1750, globalCostLimitMicrousd: 17500 }) };
  assert.equal(await createVisualInitialAdmission({ env, userId: user.id, readingResultId: binding.readingResultId,
    visualToken: 'private-pending-token', binding }), true);
  const saved = await save(db, binding.readingResultId);
  assert.equal(saved.body.visual, undefined);
  assert.equal(saved.body.visualState.attachmentStatus, 'pending');
  assert.equal(db.rows('SELECT reading_result_id FROM journal_visual_state')[0].reading_result_id, binding.readingResultId);
  const cancelled = [];
  await deleteJournalVisualLink({ db, userId: user.id, entryId: saved.body.entry.id, deleteEntry: true,
    env: { READING_VISUAL_JOBS: { idFromName: id => id, get: id => ({ fetch: async () => { cancelled.push(id); return new Response('{}'); } }) } } });
  assert.deepEqual(cancelled, [binding.readingResultId]);
  assert.equal(db.rows('SELECT * FROM visual_initial_admissions').length, 0);
  assert.equal((await registerVisualResult({ db, userId: user.id, readingResultId: binding.readingResultId, binding })).ok, false);
});

for (const configured of [true, false]) test(`pending initial admission expiry projects ${configured ? 'available' : 'unavailable'} recovery without creating a result or mutating saved state`, async t => {
  const { db, binding: original } = await setup(t);
  const binding = { ...original, readingResultId: 'expired-before-registration' };
  const env = initialEnv(db);
  assert.equal(await createVisualInitialAdmission({ env, userId: user.id, readingResultId: binding.readingResultId,
    binding, visualToken: 'initial-expiry-token' }), true);
  const saved = await save(db, binding.readingResultId);
  assert.equal(saved.body.visualState.attachmentStatus, 'pending');
  await db.prepare('UPDATE visual_initial_admissions SET expires_at = 1 WHERE reading_result_id = ?').bind(binding.readingResultId).run();
  const before = db.rows('SELECT * FROM journal_visual_state');
  const entries = db.rows('SELECT * FROM journal_entries');
  const results = db.rows('SELECT * FROM reading_visual_results');
  if (!configured) delete env.VISUAL_REPLAY_LIMITS;
  const single = await visualResults.loadJournalVisualState({ env, db, userId: user.id, entryId: saved.body.entry.id });
  const batch = await visualResults.loadJournalVisualStates({ env, db, userId: user.id, entryIds: [saved.body.entry.id] });
  for (const state of [single, batch.get(saved.body.entry.id)]) {
    assert.equal(state.attachmentStatus, 'expired');
    assert.equal(state.retryStatus, configured ? 'available' : 'unavailable');
    assert.equal(state.reason, configured ? 'expired' : 'configuration-unavailable');
    assert.equal(state.sourceFingerprint, before[0].source_fingerprint);
    assert.equal(state.stateVersion, before[0].state_version);
  }
  assert.deepEqual(db.rows('SELECT * FROM journal_visual_state'), before);
  assert.deepEqual(db.rows('SELECT * FROM journal_entries'), entries);
  assert.deepEqual(db.rows('SELECT * FROM reading_visual_results'), results);
  assert.equal(db.rows('SELECT * FROM visual_retry_claims').length, 0);
  assert.equal(db.rows('SELECT * FROM visual_initial_reservations').length, 0);
});

for (const linked of [true, false]) test(`pending initial expiry preserves previously accepted ${linked ? 'linked' : 'unlinked'} cached cues and exact saved prose`, async t => {
  const { db, binding: original } = await setup(t);
  await observe(db, original);
  await commit(db, original, await populated(original));
  const saved = await save(db, original.readingResultId);
  // A cached validated snapshot remains durable after independent link loss.
  if (!linked) await db.prepare('DELETE FROM journal_visual_links WHERE journal_entry_id = ?').bind(saved.body.entry.id).run();
  const env = initialEnv(db), binding = { ...original, readingResultId: 'pending-with-cached-cues' };
  assert.equal(await createVisualInitialAdmission({ env, userId: user.id, readingResultId: binding.readingResultId,
    binding, visualToken: 'initial-cached-token' }), true);
  assert.equal((await attachJournalVisualResult({ db, userId: user.id, entryId: saved.body.entry.id, readingResultId: binding.readingResultId })).status, 'pending');
  await db.prepare('UPDATE visual_initial_admissions SET expires_at = 1 WHERE reading_result_id = ?').bind(binding.readingResultId).run();
  const before = db.rows('SELECT * FROM journal_visual_state');
  const state = await visualResults.loadJournalVisualState({ env, db, userId: user.id, entryId: saved.body.entry.id });
  const batch = await visualResults.loadJournalVisualStates({ env, db, userId: user.id, entryIds: [saved.body.entry.id] });
  for (const projected of [state, batch.get(saved.body.entry.id)]) {
    assert.equal(projected.attachmentStatus, 'expired');
    assert.equal(projected.visualSnapshot.cueLedger.cues[0].id, 'vc:fixture');
    assert.equal(projected.visualSnapshot.cueLedger.raw, source.raw);
  }
  assert.deepEqual(db.rows('SELECT * FROM journal_visual_state'), before);
  assert.equal(db.rows('SELECT narrative FROM journal_entries')[0].narrative, source.raw);
});

test('registered transport deadline takes priority over an initial admission deadline', async t => {
  const { db, binding: original } = await setup(t);
  const env = initialEnv(db), binding = { ...original, readingResultId: 'registered-deadline-priority' };
  assert.equal(await createVisualInitialAdmission({ env, userId: user.id, readingResultId: binding.readingResultId,
    binding, visualToken: 'initial-priority-token' }), true);
  const saved = await save(db, binding.readingResultId);
  assert.equal((await registerVisualResult({ db, userId: user.id, readingResultId: binding.readingResultId, binding, expiresAt: Date.now() + 60000 })).ok, true);
  await db.prepare('UPDATE visual_initial_admissions SET expires_at = 1 WHERE reading_result_id = ?').bind(binding.readingResultId).run();
  for (const read of [async () => visualResults.loadJournalVisualState({ env, db, userId: user.id, entryId: saved.body.entry.id }),
    async () => (await visualResults.loadJournalVisualStates({ env, db, userId: user.id, entryIds: [saved.body.entry.id] })).get(saved.body.entry.id)]) {
    assert.equal((await read()).attachmentStatus, 'pending');
  }
  await db.prepare('UPDATE reading_visual_results SET expires_at = 1 WHERE id = ?').bind(binding.readingResultId).run();
  await db.prepare('UPDATE visual_initial_admissions SET expires_at = ? WHERE reading_result_id = ?').bind(Date.now() + 60000, binding.readingResultId).run();
  assert.equal((await visualResults.loadJournalVisualState({ env, db, userId: user.id, entryId: saved.body.entry.id })).attachmentStatus, 'expired');
  assert.equal((await visualResults.loadJournalVisualStates({ env, db, userId: user.id, entryIds: [saved.body.entry.id] })).get(saved.body.entry.id).attachmentStatus, 'expired');
});

for (const mismatch of ['owner', 'binding']) test(`pending initial expiry ignores an admission whose ${mismatch} no longer matches the trusted saved hint`, async t => {
  const { db, binding: original } = await setup(t);
  const env = initialEnv(db), binding = { ...original, readingResultId: 'changed-initial-admission' };
  assert.equal(await createVisualInitialAdmission({ env, userId: user.id, readingResultId: binding.readingResultId,
    binding, visualToken: 'changed-initial-token' }), true);
  const saved = await save(db, binding.readingResultId);
  await db.prepare('UPDATE visual_initial_admissions SET expires_at = 1 WHERE reading_result_id = ?').bind(binding.readingResultId).run();
  if (mismatch === 'owner') await db.prepare("UPDATE visual_initial_admissions SET user_id = 'user-2' WHERE reading_result_id = ?").bind(binding.readingResultId).run();
  else await db.prepare('UPDATE visual_initial_admissions SET binding_json = ? WHERE reading_result_id = ?')
    .bind(JSON.stringify({ ...binding, contextHash: '0'.repeat(64) }), binding.readingResultId).run();
  const before = db.rows('SELECT * FROM journal_visual_state');
  const single = await visualResults.loadJournalVisualState({ env, db, userId: user.id, entryId: saved.body.entry.id });
  const batch = await visualResults.loadJournalVisualStates({ env, db, userId: user.id, entryIds: [saved.body.entry.id] });
  for (const state of [single, batch.get(saved.body.entry.id)]) {
    assert.equal(state.attachmentStatus, 'pending');
    assert.equal(state.retryStatus, 'unavailable');
  }
  assert.deepEqual(db.rows('SELECT * FROM journal_visual_state'), before);
});

test('pre-0038 saved-state reads retain optional-schema compatibility', async t => {
  const db = await createD1({ throughMigration: '0037_reading_visual_retry_state.sql' });
  t.after(() => db.sqlite.close());
  await seedUser(db, { id: user.id });
  const saved = await save(db, null);
  const env = replayEnv(db);
  await visualResults.persistJournalVisualState({ db, userId: user.id, entryId: saved.body.entry.id, attachmentStatus: 'expired', retryStatus: 'available', reason: 'expired' });
  const state = await visualResults.loadJournalVisualState({ env, db, userId: user.id, entryId: saved.body.entry.id });
  const batch = await visualResults.loadJournalVisualStates({ env, db, userId: user.id, entryIds: [saved.body.entry.id] });
  assert.equal(state.attachmentStatus, 'expired');
  assert.deepEqual(batch.get(saved.body.entry.id), state);
});

test('saved-state reads fail closed on partial initial-admission schema', async t => {
  const { db } = await setup(t);
  const saved = await save(db, null);
  await db.prepare('DROP TABLE visual_initial_reservations').run();
  await assert.rejects(visualResults.loadJournalVisualState({ db, userId: user.id, entryId: saved.body.entry.id }), /Incomplete initial visual admission schema/);
  await assert.rejects(visualResults.loadJournalVisualStates({ db, userId: user.id, entryIds: [saved.body.entry.id] }), /Incomplete initial visual admission schema/);
});

for (const mismatch of ['owner', 'contextHash', 'spreadHash', 'artworkEdition', 'catalogVersion', 'expired']) {
  test(`saved unknown result cannot gain initial-job authority from a ${mismatch} mismatch`, async t => {
    const { db, binding: registered } = await setup(t);
    const binding = { ...registered, readingResultId: 'mismatched-initial-result',
      ...(mismatch === 'contextHash' || mismatch === 'spreadHash' ? { [mismatch]: '0'.repeat(64) } : {}),
      ...(mismatch === 'artworkEdition' ? { artworkEdition: 'identity:thoth-a1' } : {}),
      ...(mismatch === 'catalogVersion' ? { catalogVersion: 'other-version' } : {}) };
    await db.prepare(`INSERT INTO visual_initial_admissions
      (reading_result_id, user_id, aggregate_scope, binding_json, token_hash, expires_at, created_at)
      VALUES (?, ?, 'initial-mismatch-scope', ?, 'mismatch-token-hash', ?, ?)`)
      .bind(binding.readingResultId, mismatch === 'owner' ? 'user-2' : user.id, JSON.stringify(binding),
        mismatch === 'expired' ? Date.now() - 1 : Date.now() + 60000, Date.now()).run();
    const before = db.rows('SELECT * FROM visual_initial_admissions')[0];
    const saved = await save(db, binding.readingResultId);
    assert.equal(saved.body.visual, undefined);
    assert.equal(saved.body.visualState.attachmentStatus, 'failed');
    assert.equal(db.rows('SELECT reading_result_id FROM journal_visual_state')[0].reading_result_id, null);
    await deleteJournalVisualLink({ db, userId: user.id, entryId: saved.body.entry.id, deleteEntry: true });
    assert.deepEqual(db.rows('SELECT * FROM visual_initial_admissions')[0], before);
    assert.equal(db.rows('SELECT * FROM visual_result_revocations WHERE reading_result_id = ?', [binding.readingResultId]).length, 0);
  });
}

for (const race of ['admission deletion', 'admission expiry', 'binding replacement', 'token replacement', 'saved source edit']) {
  test(`${race} during pending initial attachment hashing cannot restore a trusted job hint`, async t => {
    const { db, binding: registered } = await setup(t);
    const binding = { ...registered, readingResultId: 'racing-initial-result' };
    const saved = await save(db, null);
    await db.prepare(`INSERT INTO visual_initial_admissions
      (reading_result_id, user_id, aggregate_scope, binding_json, token_hash, expires_at, created_at)
      VALUES (?, ?, 'initial-race-scope', ?, 'race-token-hash', ?, ?)`)
      .bind(binding.readingResultId, user.id, JSON.stringify(binding), Date.now() + 60000, Date.now()).run();
    const prepare = db.prepare.bind(db);
    let raced = false;
    db.prepare = sql => {
      const statement = prepare(sql);
      if (!sql.startsWith('INSERT INTO journal_visual_state') || !sql.includes('visual_initial_admissions a')) return statement;
      const bind = statement.bind.bind(statement);
      statement.bind = (...params) => {
        const bound = bind(...params), run = bound.run.bind(bound);
        bound.run = async () => {
          raced = true;
          if (race === 'admission deletion') await prepare('DELETE FROM visual_initial_admissions WHERE reading_result_id = ?').bind(binding.readingResultId).run();
          else if (race === 'admission expiry') await prepare('UPDATE visual_initial_admissions SET expires_at = 1 WHERE reading_result_id = ?').bind(binding.readingResultId).run();
          else if (race === 'binding replacement') await prepare('UPDATE visual_initial_admissions SET binding_json = ? WHERE reading_result_id = ?')
            .bind(JSON.stringify({ ...binding, contextHash: '0'.repeat(64) }), binding.readingResultId).run();
          else if (race === 'token replacement') await prepare("UPDATE visual_initial_admissions SET token_hash = 'changed-token-hash' WHERE reading_result_id = ?").bind(binding.readingResultId).run();
          else await prepare('UPDATE journal_entries SET question = ? WHERE id = ?').bind('New question during hashing', saved.body.entry.id).run();
          return run();
        };
        return bound;
      };
      return statement;
    };
    const outcome = await attachJournalVisualResult({ db, userId: user.id, entryId: saved.body.entry.id, readingResultId: binding.readingResultId });
    assert.equal(raced, true);
    assert.equal(outcome.attached, false);
    assert.equal(outcome.reason, 'source-conflict');
    assert.equal(db.rows('SELECT reading_result_id FROM journal_visual_state')[0].reading_result_id, null);
    assert.equal(db.rows('SELECT * FROM journal_visual_links').length, 0);
  });
}

test('deleting one shared entry preserves the surviving source, initial admission and consumed reservation', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding);
  const first = await save(db, binding.readingResultId);
  // Historical clients could save several entries attached to one result.
  await db.prepare('UPDATE journal_entries SET idempotency_key = NULL WHERE id = ?').bind(first.body.entry.id).run();
  const second = await save(db, binding.readingResultId);
  const now = Date.now();
  await db.prepare(`INSERT INTO visual_initial_admissions
    (reading_result_id, user_id, aggregate_scope, binding_json, token_hash, expires_at, created_at)
    VALUES (?, ?, 'initial-shared-scope', ?, 'shared-token-hash', ?, ?)`)
    .bind(binding.readingResultId, user.id, JSON.stringify(binding), now + 60000, now).run();
  await db.prepare(`INSERT INTO visual_initial_reservations
    (dispatch_id, reading_result_id, aggregate_scope, reserved_cost_microusd, reserved_at)
    VALUES ('shared-dispatch', ?, 'initial-shared-scope', 175, ?)`)
    .bind(binding.readingResultId, now).run();
  const before = db.rows('SELECT * FROM visual_initial_admissions')[0];
  const deleted = await deleteJournalVisualLink({ db, userId: user.id, entryId: first.body.entry.id, deleteEntry: true });
  assert.equal(deleted.cleanedResult, false);
  assert.deepEqual(db.rows('SELECT * FROM visual_initial_admissions')[0], before);
  assert.equal(db.rows('SELECT reading_result_id FROM visual_initial_reservations')[0].reading_result_id, binding.readingResultId);
  assert.equal((await loadJournalVisualResult({ db, userId: user.id, entryId: second.body.entry.id })).finalRaw, source.raw);
  await deleteJournalVisualLink({ db, userId: user.id, entryId: second.body.entry.id, deleteEntry: true });
  assert.equal(db.rows('SELECT * FROM visual_initial_admissions').length, 0);
  assert.equal(db.rows('SELECT reading_result_id FROM visual_initial_reservations')[0].reading_result_id, null);
});

for (const deletion of ['entry', 'account']) test(`${deletion} deletion fails closed on a partial initial-admission schema`, async t => {
  const f = await sensitiveReplayFixture(t);
  await f.db.prepare('DROP TABLE visual_initial_reservations').run();
  await assert.rejects(deletion === 'entry'
    ? deleteJournalVisualLink({ db: f.db, userId: user.id, entryId: f.entryId, deleteEntry: true })
    : revokeUserVisualResults({ env: { DB: f.db }, userId: user.id }), /Incomplete initial visual admission schema/);
  assert.equal(f.db.rows('SELECT id FROM journal_entries')[0].id, f.entryId);
  assert.deepEqual(f.db.rows("SELECT * FROM visual_retry_claims WHERE id = 'private-claim'")[0], f.claim);
});

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

test('a regenerated result with the same seed retains both prose and visual identities', async t => {
  const { db, binding } = await setup(t);
  await observe(db, binding);
  const first = await save(db, binding.readingResultId, { sessionSeed: 'same-session' });
  const secondBinding = { ...binding, readingResultId: 'result-2' };
  await registerVisualResult({ db, userId: user.id, readingResultId: 'result-2', binding: secondBinding });
  await observe(db, secondBinding, 'Replacement prose.');
  const retry = await save(db, 'result-2', { sessionSeed: 'same-session', personalReading: 'Replacement prose.' });
  assert.equal(retry.status, 201);
  assert.notEqual(retry.body.entry.id, first.body.entry.id);
  assert.equal(retry.body.visual.readingResultId, 'result-2');
  assert.equal((await loadJournalVisualResult({ db, userId: user.id, entryId: first.body.entry.id })).readingResultId, binding.readingResultId);
  const repeated = await save(db, 'result-2', { sessionSeed: 'same-session', personalReading: 'Replacement prose.' });
  assert.equal(repeated.body.deduplicated, true);
  assert.equal(repeated.body.entry.id, retry.body.entry.id);
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
  // Historical clients could save several entries attached to one result.
  await db.prepare('UPDATE journal_entries SET idempotency_key = NULL WHERE id = ?').bind(first.body.entry.id).run();
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
  const restored = await visualResults.loadJournalVisualState({ env: replayEnv(db), db, userId: user.id, entryId: saved.body.entry.id });
  assert.equal(restored.visualSnapshot.cueLedger.raw, source.raw);
  assert.equal(restored.attachmentStatus, 'failed');
  assert.equal(await visualResults.loadJournalVisualState({ env: replayEnv(db), db, userId: 'user-2', entryId: saved.body.entry.id }), null);
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
  const current = await visualResults.loadJournalVisualState({ env: replayEnv(db), db, userId: user.id, entryId: saved.body.entry.id });
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
  const state = await visualResults.loadJournalVisualState({ env: replayEnv(db), db, userId: user.id, entryId: saved.body.entry.id });
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
    const state = await visualResults.loadJournalVisualState({ env: replayEnv(db), db, userId: user.id, entryId: id });
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
  const states = await visualResults.loadJournalVisualStates({ env: replayEnv(db), db, userId: user.id, entryIds: [...ids, 'foreign-entry'] });
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
  const state = await visualResults.loadJournalVisualState({ env: replayEnv(db), db, userId: user.id, entryId: saved.body.entry.id });
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
  assert.equal((await visualResults.loadJournalVisualState({ env: replayEnv(db), db, userId: user.id, entryId: saved.body.entry.id })).attachmentStatus, 'missing');
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
  const restored = await visualResults.loadJournalVisualState({ env: replayEnv(db), db, userId: user.id, entryId: id });
  assert.equal(restored.attachmentStatus, 'failed');
  assert.equal(restored.reason, 'fingerprint-mismatch');
  assert.equal(restored.retryStatus, 'unavailable');
  assert.equal(restored.stateVersion, 1);
  assert.equal(db.rows('SELECT * FROM journal_visual_state').length, 1);
  assert.equal(restored.visualSnapshot.binding.contextHash, contextHash);
  assert.deepEqual(restored.visualSnapshot.cueLedger.receipts, ledger.receipts);
  assert.equal(db.rows('SELECT binding_json FROM reading_visual_results WHERE id = ?', [binding.readingResultId])[0].binding_json, JSON.stringify(binding));
});
