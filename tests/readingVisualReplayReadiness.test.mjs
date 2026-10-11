import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser, seedSession, seedEntry } from './helpers/journalFixtures.mjs';
import { loadJournalVisualState, loadJournalVisualStates, persistJournalVisualState, loadOwnedJournalVisualSource,
  registerVisualResult, updateVisualResultSource, commitVisualResult, fingerprintSavedVisualSource, attachJournalVisualResult } from '../functions/lib/readingVisualResults.js';
import { claimVisualRetry, initializeVisualReplay, reserveVisualReplay, retryLocalVisuals } from '../functions/lib/readingVisualRetry.js';
import { retryJournalVisuals, createVisualReplayAdmission } from './helpers/webVisualAdmissionFixtures.mjs';
import { projectVisualReplayReadiness } from '../functions/lib/readingVisualReplayReadiness.js';
import { onRequestGet as getEntry } from '../functions/api/journal/[id].js';
import { onRequestGet as getJournal } from '../functions/api/journal.js';
import { onRequestPost as retryCloud } from '../functions/api/journal/[id]/visual-retry.js';
import { onRequestPost as retryLocal } from '../functions/api/reading-visual-retry.js';
import { fingerprintVisualSource, normalizeVisualSource } from '../shared/reading/visualSourceIdentity.js';
import { createVisualCueLedger, applyVisualCueBatch } from '../shared/reading/visualCueLedger.js';
import { hashVisualCueText } from '../shared/contracts/visualCueBatches.js';
import { requestSavedVisualRetry, publicVisualSnapshot, savedVisualRecovery, needsCloudVisualRefresh,
  readVisualResume, writeVisualResume, projectJournalEntryVisuals, publicVisualRetryState, savedVisualSourceKey, adoptEntryVisuals } from '../src/lib/readingVisualStorage.js';

async function fixture(t) {
  const db = await createD1();
  t.after(() => db.sqlite.close());
  await seedUser(db);
  await seedSession(db);
  await seedEntry(db);
  await persistJournalVisualState({ db, userId: 'user-1', entryId: 'entry-1',
    attachmentStatus: 'expired', retryStatus: 'available', reason: 'expired' });
  const env = { DB: db, VISUAL_REPLAY_LIMITS: JSON.stringify({ rateLimit: 3, windowMs: 60000, totalLimit: 5 }),
    VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: 'fake',
    AI: { run() { assert.fail('Readiness and refusal cannot infer'); } },
    READING_VISUAL_JOBS: { idFromName() { assert.fail('Readiness and refusal cannot initialize a job'); } } };
  return { db, env };
}

for (const missing of ['VISUAL_REPLAY_LIMITS', 'VISUAL_CUE_PROVIDER', 'READING_VISUAL_JOBS']) {
  test(`expired cloud projection is unavailable without ${missing}`, async t => {
    const { db, env } = await fixture(t);
    delete env[missing];
    const before = db.rows('SELECT * FROM journal_visual_state');
    const single = await loadJournalVisualState({ env, db, userId: 'user-1', entryId: 'entry-1' });
    const batch = await loadJournalVisualStates({ env, db, userId: 'user-1', entryIds: ['entry-1'] });
    for (const state of [single, batch.get('entry-1')]) {
      assert.equal(state.attachmentStatus, 'expired');
      assert.equal(state.retryStatus, 'unavailable');
      assert.equal(state.reason, 'configuration-unavailable');
      assert.equal(state.stateVersion, before[0].state_version);
      assert.equal(state.sourceFingerprint, before[0].source_fingerprint);
    }
    assert.deepEqual(db.rows('SELECT * FROM journal_visual_state'), before);
    assert.equal(db.rows('SELECT * FROM visual_retry_claims').length, 0);
  });
}

test('expired explicit cloud retry reports configuration refusal instead of unchanged eligibility', async t => {
  const { db, env } = await fixture(t);
  delete env.VISUAL_REPLAY_LIMITS;
  const before = db.rows('SELECT * FROM journal_visual_state');
  const result = await retryJournalVisuals({ env, userId: 'user-1', entryId: 'entry-1' });
  assert.equal(result.state.retryStatus, 'unavailable');
  assert.equal(result.state.reason, 'configuration-unavailable');
  assert.equal(result.state.attachmentStatus, 'expired');
  assert.equal(result.resumeHandle, null);
  assert.deepEqual(db.rows('SELECT * FROM journal_visual_state'), before);
  assert.equal(db.rows('SELECT * FROM visual_retry_claims').length, 0);
});

test('real journal GET and list project configuration refusal without waking visual work', async t => {
  const { db, env } = await fixture(t);
  delete env.VISUAL_REPLAY_LIMITS;
  const detail = await getEntry({ env, params: { id: 'entry-1' }, request: new Request('https://test/api/journal/entry-1', { headers: { Cookie: 'session=session-1' } }) });
  const list = await getJournal({ env, request: new Request('https://test/api/journal', { headers: { Cookie: 'session=session-1' } }) });
  assert.equal(detail.status, 200);
  assert.equal(list.status, 200);
  for (const entry of [(await detail.json()).entry, (await list.json()).entries[0]]) {
    assert.equal(entry.visualState.retryStatus, 'unavailable');
    assert.equal(entry.visualState.reason, 'configuration-unavailable');
    assert.equal(entry.personalReading, 'A reading.');
  }
  assert.equal(db.rows('SELECT * FROM visual_retry_claims').length, 0);
});

test('fresh configured projection restores eligibility without changing durable failure state', async t => {
  const { db, env } = await fixture(t);
  const before = db.rows('SELECT * FROM journal_visual_state');
  const unavailable = await loadJournalVisualState({ db, userId: 'user-1', entryId: 'entry-1' });
  assert.equal(unavailable.retryStatus, 'unavailable');
  const configured = await loadJournalVisualState({ env, db, userId: 'user-1', entryId: 'entry-1' });
  assert.equal(configured.retryStatus, 'available');
  assert.equal(configured.reason, 'expired');
  assert.deepEqual(db.rows('SELECT * FROM journal_visual_state'), before);
});

for (const status of ['pending', 'complete', 'exhausted', 'revoked']) {
  test(`missing replay configuration preserves ${status} state`, async t => {
    const { db } = await fixture(t);
    await db.prepare('UPDATE journal_visual_state SET retry_status = ?, attachment_status = ?, attempt_id = ?')
      .bind(status, status === 'complete' ? 'attached' : 'failed', status === 'pending' ? 'active-attempt' : null).run();
    const state = await loadJournalVisualState({ db, userId: 'user-1', entryId: 'entry-1' });
    assert.equal(state.retryStatus, status);
    const refused = await retryJournalVisuals({ env: { DB: db }, userId: 'user-1', entryId: 'entry-1' });
    assert.equal(refused.state.retryStatus, status);
    assert.equal(refused.resumeHandle, null);
    assert.equal(db.rows('SELECT * FROM visual_retry_claims').length, 0);
  });
}

const durableRows = db => Object.fromEntries(['journal_visual_state', 'journal_visual_links', 'reading_visual_results', 'visual_retry_claims', 'visual_guest_principals']
  .map(table => [table, db.rows(`SELECT * FROM ${table} ORDER BY 1`)]));
const sourceBinding = async (source, readingResultId) => {
  const hashes = await fingerprintVisualSource(source);
  const { artworkEdition, catalogVersion } = normalizeVisualSource(source);
  return { readingResultId, sourceRevision: 0, spreadHash: hashes.spreadHash, contextHash: hashes.contextHash, artworkEdition, catalogVersion };
};
const retryRequest = (savedSource, cookie) => new Request('https://test/api/tarot-reading/visual-retry', { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify({ savedSource }) });

test('registered expired cloud refusal leaves every durable attachment and link row unchanged', async t => {
  const { db, env } = await fixture(t);
  const owned = await loadOwnedJournalVisualSource({ db, userId: 'user-1', entryId: 'entry-1' });
  const binding = await sourceBinding(owned.source, 'registered-expired');
  await registerVisualResult({ db, userId: 'user-1', readingResultId: binding.readingResultId, binding });
  await updateVisualResultSource({ db, userId: 'user-1', readingResultId: binding.readingResultId, binding, raw: owned.source.raw, complete: true });
  const ledger = { ...createVisualCueLedger(binding), raw: owned.source.raw, analyzedEnd: owned.source.raw.length,
    analyzedHash: await hashVisualCueText(owned.source.raw) };
  await commitVisualResult({ db, userId: 'user-1', readingResultId: binding.readingResultId, binding,
    expectedLedgerRevision: 0, ledger, finalRaw: owned.source.raw });
  await persistJournalVisualState({ db, userId: 'user-1', entryId: 'entry-1', sourceFingerprint: await fingerprintSavedVisualSource(owned),
    attachmentStatus: 'failed', reason: 'attachment-error', readingResultId: binding.readingResultId });
  await db.prepare("UPDATE reading_visual_results SET status = 'pending', expires_at = ? WHERE id = ?")
    .bind(Date.now() - 1, binding.readingResultId).run();
  const prior = await loadJournalVisualState({ env, db, userId: 'user-1', entryId: 'entry-1' });
  assert.equal(prior.retryStatus, 'available');
  const before = durableRows(db);
  const limits = env.VISUAL_REPLAY_LIMITS;
  delete env.VISUAL_REPLAY_LIMITS;
  const response = await retryCloud({ env, params: { entryId: 'entry-1' },
    request: new Request('https://test/api/journal/entry-1/visual-retry', { method: 'POST', headers: { Cookie: 'session=session-1' } }) });
  assert.equal(response.status, 200);
  const refused = await response.json();
  assert.deepEqual(refused, { state: { ...prior, retryStatus: 'unavailable', reason: 'configuration-unavailable' }, resumeHandle: null });
  assert.deepEqual(durableRows(db), before);
  env.VISUAL_REPLAY_LIMITS = limits;
  assert.deepEqual(await loadJournalVisualState({ env, db, userId: 'user-1', entryId: 'entry-1' }), prior);
  assert.deepEqual(durableRows(db), before);
});

const LOCAL_SOURCE = { raw: 'The Star pours into a pool.', cards: [{ name: 'The Star', position: 'Present', orientation: 'Upright' }],
  question: '', reflections: '', deckId: 'rws-1909' };
// Seed immutable V9 guest identity directly: V10 may read it, never mint it.
async function historicalGuestAdmission(f) {
  const token = crypto.randomUUID(), principalId = crypto.randomUUID();
  const scope = `guest-edge:${await hashVisualCueText('trusted-read-only-guest-edge')}`;
  await f.db.prepare('INSERT INTO visual_guest_principals VALUES (?, ?, ?, ?)')
    .bind(await hashVisualCueText(token), principalId, scope, Date.now() + 86400000).run();
  const admission = await createVisualReplayAdmission({ env: f.env, request: retryRequest(LOCAL_SOURCE, `visual_replay_principal=${token}`) });
  assert.ok(admission); return { admission, token };
}

async function seedLocalClaim(f, { status = 'complete', guest = false } = {}) {
  f.env.VISUAL_REPLAY_TRUSTED_IDENTITY = { resolve: async () => 'trusted-read-only-guest-edge' };
  const historical = guest ? await historicalGuestAdmission(f) : null;
  const admission = historical?.admission || await createVisualReplayAdmission({ env: f.env, userId: 'user-1' });
  const binding = await sourceBinding(LOCAL_SOURCE, `existing-${guest ? 'guest' : 'user'}-${status}`);
  const fingerprint = await fingerprintSavedVisualSource({ source: LOCAL_SOURCE, ...normalizeVisualSource(LOCAL_SOURCE) });
  let claim;
  if (guest) {
    // Historical claim with immutable source/binding and no live inference.
    const id = crypto.randomUUID();
    await f.db.prepare(`INSERT INTO visual_retry_claims (id, admission_scope, source_fingerprint, reading_result_id,
      attempt_id, visual_job_id, retry_status, created_at, updated_at, aggregate_scope, source_json, binding_json, visual_token, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, admission.scope, fingerprint, binding.readingResultId, crypto.randomUUID(), crypto.randomUUID(), Date.now(), Date.now(),
        admission.aggregateScope, JSON.stringify(LOCAL_SOURCE), JSON.stringify(binding), crypto.randomUUID(), Date.now() + 86400000).run();
    claim = f.db.rows('SELECT * FROM visual_retry_claims WHERE id = ?', [id])[0];
  } else claim = await claimVisualRetry({ db: f.db, admissionScope: admission.scope, sourceFingerprint: fingerprint,
    admission, source: LOCAL_SOURCE, binding });
  assert.ok(claim);
  assert.ok(await initializeVisualReplay({ db: f.db, claim }));
  const accepted = await applyVisualCueBatch({ ledger: createVisualCueLedger(binding), authoritativeRaw: LOCAL_SOURCE.raw,
    issuedRequest: { binding, batchId: 'existing-accepted', requestSequence: 1, status: 'active',
      analyzedEnd: LOCAL_SOURCE.raw.length, analyzedHash: await hashVisualCueText(LOCAL_SOURCE.raw), baseLedgerRevision: 0 },
    response: { proposals: [{ localAlias: 'pool', kind: 'literal', quote: 'pours into a pool', targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }] }] },
    validationContext: { cards: [{ index: 0, canonicalName: 'The Star' }], getSupportedDetails: () => ['pool-pour'] } });
  assert.deepEqual(accepted.rejected, []);
  await f.db.prepare('UPDATE reading_visual_results SET ledger_json = ?, ledger_revision = ?, active_state_version = 7, status = ? WHERE id = ?')
    .bind(JSON.stringify(accepted.ledger), accepted.ledger.ledgerRevision, status === 'complete' ? 'complete' : 'running', binding.readingResultId).run();
  await f.db.prepare('UPDATE visual_retry_claims SET state_version = 7, retry_status = ?, dispatch_status = ?, reserved_at = ? WHERE id = ?')
    .bind(status, status === 'pending' ? 'reserved' : status === 'revoked' ? 'revoked' : 'settled', Date.now() - 1000, claim.id).run();
  return { admission, fingerprint, binding, claim: f.db.rows('SELECT * FROM visual_retry_claims WHERE id = ?', [claim.id])[0],
    cookie: guest ? `visual_replay_principal=${historical.token}` : 'session=session-1' };
}

for (const guest of [false, true]) for (const missing of ['VISUAL_REPLAY_LIMITS', 'VISUAL_CUE_PROVIDER']) {
  for (const status of ['pending', 'complete', 'exhausted', 'revoked']) {
    test(`${guest ? 'guest' : 'authenticated'} local ${status} claim survives missing ${missing} without durable mutation or inference`, async t => {
      const f = await fixture(t);
      const saved = await seedLocalClaim(f, { status, guest });
      delete f.env[missing];
      const before = durableRows(f.db);
      const response = await retryLocal({ env: f.env, request: retryRequest({ ...LOCAL_SOURCE,
        visualState: { retryStatus: 'available', stateVersion: 999 }, readingResultId: 'untrusted-result' }, saved.cookie) });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.state.retryStatus, status);
      assert.equal(result.state.stateVersion, 7);
      assert.equal(result.state.sourceFingerprint, saved.fingerprint);
      assert.equal(result.state.attemptId, saved.claim.attempt_id);
      assert.equal(result.state.visualSnapshot.cueLedger.cues[0].passage.quote, 'pours into a pool');
      if (status === 'pending') assert.equal(result.resumeHandle.visualJobId, saved.claim.visual_job_id);
      else assert.equal(result.resumeHandle, null);
      assert.deepEqual(durableRows(f.db), before);
    });
  }
}

test('unconfigured local reads require the trusted owner or existing guest principal and exact source', async t => {
  const f = await fixture(t);
  const user = await seedLocalClaim(f);
  const guest = await seedLocalClaim(f, { guest: true });
  const otherGuest = await historicalGuestAdmission(f);
  await seedUser(f.db, { id: 'other-reader' });
  await seedSession(f.db, { id: 'other-session', userId: 'other-reader' });
  delete f.env.VISUAL_REPLAY_LIMITS;
  const before = durableRows(f.db);
  const attempts = [
    retryLocal({ env: f.env, request: retryRequest(LOCAL_SOURCE, 'session=other-session') }),
    retryLocal({ env: f.env, request: retryRequest(LOCAL_SOURCE) }),
    retryLocal({ env: f.env, request: retryRequest(LOCAL_SOURCE, `visual_replay_principal=${otherGuest.token}`) }),
    retryLocal({ env: f.env, request: retryRequest({ ...LOCAL_SOURCE, raw: `${LOCAL_SOURCE.raw} Edited.` }, guest.cookie) }),
    retryLocal({ env: { ...f.env, VISUAL_REPLAY_TRUSTED_IDENTITY: { resolve: async () => 'another-trusted-edge' } },
      request: retryRequest(LOCAL_SOURCE, guest.cookie) }),
    retryLocalVisuals({ env: f.env, admission: { db: f.db, scope: user.admission.scope }, savedSource: LOCAL_SOURCE })
  ];
  for (const result of await Promise.all(attempts)) {
    const outcome = result instanceof Response ? await result.json() : result;
    assert.equal(outcome.state.retryStatus, 'unavailable');
    assert.equal(outcome.state.stateVersion, 0);
    assert.equal(outcome.state.attemptId, null);
    assert.equal(outcome.state.visualSnapshot, null);
    assert.equal(outcome.resumeHandle, null);
  }
  assert.deepEqual(durableRows(f.db), before);
});

test('a trusted read-only identity cannot create a claim after replay configuration disappears', async t => {
  const f = await fixture(t);
  const priorAdmission = await createVisualReplayAdmission({ env: f.env, userId: 'user-1' });
  delete f.env.VISUAL_REPLAY_LIMITS;
  const admission = await createVisualReplayAdmission({ env: f.env, userId: 'user-1' });
  assert.ok(admission);
  for (const identity of [priorAdmission, admission]) {
    const result = await claimVisualRetry({ db: f.db, admissionScope: identity.scope,
      sourceFingerprint: await fingerprintSavedVisualSource({ source: LOCAL_SOURCE, ...normalizeVisualSource(LOCAL_SOURCE) }),
      admission: identity, source: LOCAL_SOURCE, binding: await sourceBinding(LOCAL_SOURCE, 'forbidden-new-claim') });
    assert.equal(result, null);
  }
  assert.equal(f.db.rows('SELECT id FROM visual_retry_claims').length, 0);
});

for (const guest of [false, true]) for (const cache of [false, true]) {
  test(`${guest ? 'guest' : 'authenticated'} pending local claim with ${cache ? 'saved' : 'server'} cues remains status-only when transport configuration disappears`, async t => {
    const f = await fixture(t);
    const saved = await seedLocalClaim(f, { status: 'pending', guest });
    const ledger = JSON.parse(f.db.rows('SELECT ledger_json FROM reading_visual_results WHERE id = ?', [saved.binding.readingResultId])[0].ledger_json);
    const visual = publicVisualSnapshot({ binding: saved.binding, raw: LOCAL_SOURCE.raw, status: 'running', cueLedger: ledger });
    const entry = { id: 'pending-local-source', personalReading: LOCAL_SOURCE.raw, cards: LOCAL_SOURCE.cards,
      deckId: LOCAL_SOURCE.deckId, question: '', reflections: '',
      visualState: { attachmentStatus: 'pending', retryStatus: 'pending', sourceFingerprint: saved.fingerprint, stateVersion: 7, reason: null },
      ...(cache ? { visual, visualBinding: saved.binding } : {}) };
    const namespace = guest ? 'anon' : 'user:user-1';
    const journalKey = guest ? 'tarot_journal' : 'tarot_journal_user-1';
    const values = new Map([[journalKey, JSON.stringify([entry])]]);
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
    delete f.env.READING_VISUAL_JOBS;
    const before = durableRows(f.db);
    let posts = 0;
    const fetchImpl = async (_url, init) => {
      posts++;
      // Another tab left the same existing capability while this explicit
      // status request was in flight. Refusal must retire it after committing.
      writeVisualResume({ namespace, entryId: entry.id, binding: saved.binding, storage,
        sourceFingerprint: saved.fingerprint, stateVersion: 7, resumeHandle: { readingResultId: saved.claim.reading_result_id,
          visualJobId: saved.claim.visual_job_id, visualJobToken: saved.claim.visual_token, attemptId: saved.claim.attempt_id,
          visualBinding: saved.binding, expiresAt: saved.claim.expires_at } });
      return retryLocal({ env: f.env, request: retryRequest(JSON.parse(init.body).savedSource, saved.cookie) });
    };
    const result = await requestSavedVisualRetry({ namespace, entry, storage, fetchImpl });
    assert.deepEqual(result.entry.visualState, { ...entry.visualState, reason: 'configuration-unavailable' });
    assert.equal(result.state.attemptId, saved.claim.attempt_id);
    assert.equal(result.entry.personalReading, LOCAL_SOURCE.raw);
    if (cache) assert.deepEqual(result.entry.visual, visual);
    else assert.equal(result.entry.visual.snapshot.cues[0].passage.quote, 'pours into a pool');
    assert.equal(savedVisualRecovery(result.entry).phase, 'unavailable');
    assert.equal(savedVisualRecovery(result.entry).canRetry, false);
    assert.equal(needsCloudVisualRefresh(result.entry), false);
    assert.equal(readVisualResume({ namespace, entryId: entry.id, storage }), null);
    await assert.rejects(requestSavedVisualRetry({ namespace, entry: result.entry, storage, fetchImpl }), { code: 'ineligible' });
    assert.equal(posts, 1);
    assert.deepEqual(durableRows(f.db), before);
  });
}

for (const guest of [false, true]) {
  test(`${guest ? 'guest' : 'authenticated'} expired local pending claim still retires after transport configuration disappears`, async t => {
    const f = await fixture(t);
    const saved = await seedLocalClaim(f, { status: 'pending', guest });
    await f.db.prepare('UPDATE visual_retry_claims SET expires_at = ? WHERE id = ?').bind(Date.now() - 1, saved.claim.id).run();
    delete f.env.READING_VISUAL_JOBS;
    const response = await retryLocal({ env: f.env, request: retryRequest(LOCAL_SOURCE, saved.cookie) });
    const result = await response.json();
    assert.equal(result.state.retryStatus, 'revoked');
    assert.equal(result.state.reason, 'expired');
    assert.equal(result.resumeHandle, null);
  });
}

async function seedPendingCloudClaim(f) {
  const entryId = 'pending-cloud';
  await seedEntry(f.db, { id: entryId, cards: LOCAL_SOURCE.cards, narrative: LOCAL_SOURCE.raw, deckId: LOCAL_SOURCE.deckId });
  const owned = await loadOwnedJournalVisualSource({ db: f.db, userId: 'user-1', entryId });
  const binding = await sourceBinding(owned.source, 'accepted-cloud-original');
  await registerVisualResult({ db: f.db, userId: 'user-1', readingResultId: binding.readingResultId, binding });
  await updateVisualResultSource({ db: f.db, userId: 'user-1', readingResultId: binding.readingResultId,
    binding, raw: owned.source.raw, complete: true });
  const accepted = await applyVisualCueBatch({ ledger: createVisualCueLedger(binding), authoritativeRaw: owned.source.raw,
    issuedRequest: { binding, batchId: 'cloud-accepted', requestSequence: 1, status: 'active',
      analyzedEnd: owned.source.raw.length, analyzedHash: await hashVisualCueText(owned.source.raw), baseLedgerRevision: 0 },
    response: { proposals: [{ localAlias: 'pool', kind: 'literal', quote: 'pours into a pool', targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }] }] },
    validationContext: { cards: [{ index: 0, canonicalName: 'The Star' }], getSupportedDetails: () => ['pool-pour'] } });
  assert.deepEqual(accepted.rejected, []);
  await commitVisualResult({ db: f.db, userId: 'user-1', readingResultId: binding.readingResultId, binding,
    expectedLedgerRevision: 0, ledger: accepted.ledger, finalRaw: owned.source.raw });
  assert.equal((await attachJournalVisualResult({ db: f.db, userId: 'user-1', entryId, readingResultId: binding.readingResultId })).attached, true);
  await f.db.prepare("UPDATE reading_visual_results SET status = 'pending', expires_at = ? WHERE id = ?")
    .bind(Date.now() - 1, binding.readingResultId).run();
  const prior = await loadJournalVisualState({ env: f.env, db: f.db, userId: 'user-1', entryId });
  assert.equal(prior.retryStatus, 'available');
  const detail = await getEntry({ env: f.env, params: { id: entryId },
    request: new Request(`https://test/api/journal/${entryId}`, { headers: { Cookie: 'session=session-1' } }) });
  const staleEntry = projectJournalEntryVisuals((await detail.json()).entry);
  const admission = await createVisualReplayAdmission({ env: f.env, userId: 'user-1' });
  const replayBinding = await sourceBinding(owned.source, 'reserved-cloud-replay');
  const fingerprint = await fingerprintSavedVisualSource(owned);
  const claim = await claimVisualRetry({ db: f.db, admission, admissionScope: admission.scope, sourceFingerprint: fingerprint,
    entryId, expectedStateVersion: prior.stateVersion, owned, source: owned.source, binding: replayBinding, priorState: prior });
  assert.ok(claim);
  assert.ok(await initializeVisualReplay({ db: f.db, claim }));
  assert.equal(await reserveVisualReplay({ env: f.env, claim }), true);
  const pending = await loadJournalVisualState({ env: f.env, db: f.db, userId: 'user-1', entryId });
  const handle = { readingResultId: claim.reading_result_id, visualJobId: claim.visual_job_id, attemptId: claim.attempt_id,
    visualJobToken: claim.visual_token, visualBinding: replayBinding, expiresAt: claim.expires_at };
  return { entryId, staleEntry, pending, claim, binding: replayBinding, handle, fingerprint };
}

test('pending cloud detail, list and explicit retry report missing observation transport without changing accepted work', async t => {
  const f = await fixture(t);
  const saved = await seedPendingCloudClaim(f);
  const before = durableRows(f.db);
  delete f.env.READING_VISUAL_JOBS;
  const request = path => new Request(`https://test${path}`, { headers: { Cookie: 'session=session-1' } });
  const detail = await getEntry({ env: f.env, params: { id: saved.entryId }, request: request(`/api/journal/${saved.entryId}`) });
  const list = await getJournal({ env: f.env, request: request('/api/journal') });
  const refusal = await retryCloud({ env: f.env, params: { entryId: saved.entryId },
    request: new Request(`https://test/api/journal/${saved.entryId}/visual-retry`, { method: 'POST', headers: { Cookie: 'session=session-1' } }) });
  assert.deepEqual([detail.status, list.status, refusal.status], [200, 200, 200]);
  const detailEntry = (await detail.json()).entry;
  const listEntry = (await list.json()).entries.find(entry => entry.id === saved.entryId);
  const refused = await refusal.json();
  for (const state of [detailEntry.visualState, listEntry.visualState, refused.state]) {
    assert.deepEqual(state, { ...saved.pending, reason: 'configuration-unavailable' });
    assert.equal(state.visualSnapshot.cueLedger.cues[0].passage.quote, 'pours into a pool');
  }
  assert.equal(refused.resumeHandle, null);
  for (const entry of [detailEntry, listEntry].map(projectJournalEntryVisuals)) {
    const recovery = savedVisualRecovery(entry, { cloud: true, replayResume: saved.handle });
    assert.equal(recovery.phase, 'unavailable');
    assert.equal(recovery.canRetry, false);
    assert.equal(needsCloudVisualRefresh(entry), false);
    assert.equal(recovery.phase === 'pending' && publicVisualRetryState(entry.visualState)?.retryStatus === 'pending', false);
    assert.equal(entry.personalReading, LOCAL_SOURCE.raw);
  }
  assert.deepEqual(durableRows(f.db), before);
});

for (const missing of ['VISUAL_REPLAY_LIMITS', 'VISUAL_CUE_PROVIDER']) {
  test(`reserved cloud work remains observable with its DO despite missing ${missing}`, async t => {
    const f = await fixture(t);
    const saved = await seedPendingCloudClaim(f);
    const before = durableRows(f.db);
    delete f.env[missing];
    const state = await loadJournalVisualState({ env: f.env, db: f.db, userId: 'user-1', entryId: saved.entryId });
    const refused = await retryJournalVisuals({ env: f.env, userId: 'user-1', entryId: saved.entryId });
    assert.deepEqual(state, saved.pending);
    assert.deepEqual(refused.state, saved.pending);
    const entry = projectJournalEntryVisuals({ ...saved.staleEntry, visualState: state });
    const recovery = savedVisualRecovery(entry, { cloud: true, replayResume: saved.handle });
    assert.equal(recovery.phase, 'pending');
    assert.equal(needsCloudVisualRefresh(entry), true);
    assert.deepEqual(durableRows(f.db), before);
  });
}

for (const ownershipChanged of [false, true]) {
  test(`pending cloud transport refusal ${ownershipChanged ? 'rejects a stale owner before changing' : 'guardedly retires'} the prior private handle`, async t => {
    const f = await fixture(t);
    const saved = await seedPendingCloudClaim(f);
    const values = new Map();
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
    const namespace = 'user:user-1';
    assert.equal(writeVisualResume({ namespace, entryId: saved.entryId, binding: saved.binding, resumeHandle: saved.handle,
      sourceFingerprint: saved.fingerprint, stateVersion: saved.pending.stateVersion, storage }), true);
    const before = durableRows(f.db);
    delete f.env.READING_VISUAL_JOBS;
    const memory = { entry: saved.staleEntry };
    let current = true;
    let posts = 0;
    const fetchImpl = async (_url, init) => {
      posts++;
      assert.equal(init.method, 'POST');
      const response = await retryCloud({ env: f.env, params: { entryId: saved.entryId },
        request: new Request(`https://test/api/journal/${saved.entryId}/visual-retry`, { method: 'POST', headers: { Cookie: 'session=session-1' } }) });
      if (ownershipChanged) current = false;
      return response;
    };
    const commit = ({ sourceKey, update }) => {
      assert.equal(savedVisualSourceKey(memory.entry), sourceKey);
      const next = update(memory.entry);
      memory.entry = adoptEntryVisuals(memory.entry, next);
      return { committed: true, entry: next };
    };
    const action = () => requestSavedVisualRetry({ namespace, entry: saved.staleEntry, cloud: true, storage,
      fetchImpl, commit, isCurrent: () => current });
    if (ownershipChanged) {
      await assert.rejects(action(), { code: 'stale' });
      assert.deepEqual(memory.entry, saved.staleEntry);
      assert.equal(readVisualResume({ namespace, entryId: saved.entryId, storage }).attemptId, saved.claim.attempt_id);
    } else {
      const result = await action();
      assert.deepEqual(result.entry.visualState, { ...publicVisualRetryState(saved.pending), reason: 'configuration-unavailable' });
      assert.equal(result.state.attemptId, saved.claim.attempt_id);
      assert.deepEqual(result.entry.visual, saved.staleEntry.visual);
      assert.equal(result.entry.personalReading, LOCAL_SOURCE.raw);
      assert.equal(readVisualResume({ namespace, entryId: saved.entryId, storage }), null);
      assert.equal(savedVisualRecovery(result.entry, { cloud: true }).phase, 'unavailable');
      assert.equal(needsCloudVisualRefresh(result.entry), false);
      await assert.rejects(requestSavedVisualRetry({ namespace, entry: result.entry, cloud: true, storage, fetchImpl, commit }), { code: 'ineligible' });
    }
    assert.equal(posts, 1);
    assert.deepEqual(durableRows(f.db), before);
  });
}

test('missing DO annotates original pending attachments while leaving complete, exhausted and revoked reasons intact', () => {
  const state = { attachmentStatus: 'pending', retryStatus: 'unavailable', sourceFingerprint: 'a'.repeat(64),
    attemptId: null, stateVersion: 3, reason: null, visualSnapshot: null };
  assert.deepEqual(projectVisualReplayReadiness(state, {}), { ...state, reason: 'configuration-unavailable' });
  assert.deepEqual(projectVisualReplayReadiness(state, { READING_VISUAL_JOBS: {} }), state);
  for (const retryStatus of ['complete', 'exhausted', 'revoked']) {
    const terminal = { ...state, retryStatus, reason: 'revoked' };
    assert.deepEqual(projectVisualReplayReadiness(terminal, {}), terminal);
  }
});
