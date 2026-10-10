import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser, seedSession } from './helpers/journalFixtures.mjs';
import { saveAppJournalEntry } from '../functions/lib/journalEntries.js';
import { onRequestGet as getEntry, onRequestDelete as deleteEntry } from '../functions/api/journal/[id].js';
import { onRequestGet as getJournal } from '../functions/api/journal.js';
import { registerVisualResult, updateVisualResultSource, commitVisualResult, computeSourceFingerprint } from '../functions/lib/readingVisualResults.js';
import { createVisualCueLedger } from '../shared/reading/visualCueLedger.js';
import { hashVisualCueText } from '../shared/contracts/visualCueBatches.js';

const USER = { id: 'visual-integration', subscription_tier: 'plus', subscription_status: 'active', auth_provider: 'session' };
const BODY = { spread: 'One Card', spreadKey: 'single', cards: [{ name: 'The Star', position: 'Present', orientation: 'Upright' }],
  question: 'Where is my hope?', personalReading: 'The Star pours into a pool.', readingResultId: 'integration-result' };
async function setup(t) {
  const db = await createD1();
  t.after(() => db.sqlite.close());
  await seedUser(db, { id: USER.id });
  await seedSession(db, { id: 'visual-session', userId: USER.id });
  return { DB: db };
}
async function register(env) {
  const { spreadHash, contextHash } = await computeSourceFingerprint(BODY);
  const binding = { readingResultId: BODY.readingResultId, sourceRevision: 0, spreadHash, contextHash, artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };
  assert.equal((await registerVisualResult({ db: env.DB, userId: USER.id, readingResultId: BODY.readingResultId, binding })).ok, true);
  await updateVisualResultSource({ db: env.DB, userId: USER.id, readingResultId: BODY.readingResultId, binding, raw: BODY.personalReading, complete: true });
  const ledger = createVisualCueLedger(binding);
  ledger.raw = BODY.personalReading; ledger.analyzedEnd = ledger.raw.length; ledger.analyzedHash = await hashVisualCueText(ledger.raw);
  ledger.ledgerRevision = 1;
  ledger.cues = [{ id: 'vc:integration', kind: 'literal', passage: { start: 0, end: 8, quote: 'The Star' }, targets: [{ spreadIndex: 0, canonicalName: 'The Star', detailIds: ['pool-pour'] }] }];
  assert.equal((await commitVisualResult({ db: env.DB, userId: USER.id, readingResultId: BODY.readingResultId, binding, ledger, expectedLedgerRevision: 0, finalRaw: BODY.personalReading })).ok, true);
}
function request(path, method = 'GET') { return new Request(`https://test.invalid/api/journal${path}`, { method, headers: { Cookie: 'session=visual-session' } }); }

test('prose saves succeed without visual identity and with an unregistered ID', async t => {
  const env = await setup(t);
  for (const readingResultId of [null, 'unregistered']) {
    const saved = await saveAppJournalEntry({ env, user: USER, body: { ...BODY, readingResultId } });
    assert.equal(saved.status, 201);
    assert.equal(saved.body.visual, undefined);
  }
});

test('registered completion survives save and real journal GET/list routes return source-bound ledger', async t => {
  const env = await setup(t);
  await register(env);
  const saved = await saveAppJournalEntry({ env, user: USER, body: BODY });
  const id = saved.body.entry.id;
  assert.equal(saved.body.visual.status, 'complete');
  const response = await getEntry({ env, request: request(`/${id}`), params: { id } });
  assert.equal(response.status, 200);
  const detail = await response.json();
  assert.equal(detail.entry.visual.snapshot.raw, BODY.personalReading);
  assert.equal(detail.entry.visual.binding.readingResultId, BODY.readingResultId);
  const list = await getJournal({ env, request: request('') });
  assert.equal(list.status, 200);
  const data = await list.json();
  assert.equal(data.entries[0].visual.snapshot.raw, BODY.personalReading);
});

test('actual DELETE route removes result before FK link loss and revokes the private job', async t => {
  const env = await setup(t);
  await register(env);
  let revoked = 0;
  env.READING_VISUAL_JOBS = { idFromName: id => id, get: () => ({ fetch: async url => { assert.ok(url.endsWith('/revoke')); revoked++; return new Response('{}'); } }) };
  const saved = await saveAppJournalEntry({ env, user: USER, body: BODY });
  const id = saved.body.entry.id;
  const response = await deleteEntry({ env, request: request(`/${id}`, 'DELETE'), params: { id } });
  assert.equal(response.status, 200);
  assert.equal(revoked, 1);
  assert.equal(await env.DB.prepare('SELECT id FROM reading_visual_results WHERE id = ?').bind(BODY.readingResultId).first(), null);
  assert.equal(await env.DB.prepare('SELECT id FROM journal_entries WHERE id = ?').bind(id).first(), null);
});


test('failed unregistered attachment is durable across save, deduplication, GET and list without configuration', async t => {
  const env = await setup(t);
  const saved = await saveAppJournalEntry({ env, user: USER, body: { ...BODY, sessionSeed: 'durable-failure', visual: { secret: 'untrusted-sidecar' } } });
  assert.equal(saved.status, 201);
  assert.equal(saved.body.visualState.attachmentStatus, 'failed');
  assert.equal(saved.body.visualState.reason, 'unregistered-result');
  assert.equal(saved.body.visualState.retryStatus, 'unavailable');
  assert.equal(saved.body.visualState.visualSnapshot, null);
  const id = saved.body.entry.id;
  const again = await saveAppJournalEntry({ env, user: USER, body: { ...BODY, sessionSeed: 'durable-failure', personalReading: 'Replacement prose', readingResultId: null } });
  assert.deepEqual(again.body.visualState, saved.body.visualState);
  const detail = await (await getEntry({ env, request: request(`/${id}`), params: { id } })).json();
  const list = await (await getJournal({ env, request: request('') })).json();
  assert.deepEqual(detail.entry.visualState, saved.body.visualState);
  assert.deepEqual(list.entries[0].visualState, saved.body.visualState);
  assert.equal(detail.entry.personalReading, BODY.personalReading);
});

test('account deletion revokes unlinked claims before transport cleanup and blocks late registration', async t => {
  const env = await setup(t);
  const saved = await saveAppJournalEntry({ env, user: USER, body: BODY });
  const id = saved.body.entry.id;
  await env.DB.prepare(`INSERT INTO visual_retry_claims (id, admission_scope, source_fingerprint, user_id, journal_entry_id, attempt_id, visual_job_id, state_version, dispatch_status, retry_status, created_at, updated_at) VALUES ('account-claim', 'account-scope', ?, ?, ?, 'attempt', 'account-replay', 1, 'reserved', 'pending', 1, 1)`).bind(saved.body.visualState.sourceFingerprint, USER.id, id).run();
  let revoked = 0;
  env.READING_VISUAL_JOBS = { idFromName: id => id, get: () => ({ fetch: async () => {
    revoked++;
    assert.equal(env.DB.rows('SELECT retry_status FROM visual_retry_claims')[0].retry_status, 'revoked');
    const hashes = await computeSourceFingerprint(BODY);
    const binding = { readingResultId: 'late', sourceRevision: 0, ...hashes, artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };
    delete binding.rawHash;
    assert.equal((await registerVisualResult({ db: env.DB, userId: USER.id, readingResultId: 'late', binding })).ok, false);
    return new Response('{}', { status: 503 });
  } }) };
  const { onRequestPost } = await import('../functions/api/account/delete.js');
  const response = await onRequestPost({ env, request: new Request('https://test.invalid/api/account/delete', { method: 'POST', headers: { Cookie: 'session=visual-session', 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) }) });
  assert.equal(response.status, 200);
  assert.equal(revoked, 1);
  assert.equal(env.DB.rows('SELECT * FROM journal_entries').length, 0);
  assert.equal(env.DB.rows('SELECT * FROM journal_visual_state').length, 0);
  assert.equal(env.DB.rows('SELECT * FROM users WHERE id = ?', [USER.id]).length, 0);
});

test('state storage read errors preserve independently readable cached visuals in dedup, GET and list', async t => {
  const env = await setup(t);
  await register(env);
  const saved = await saveAppJournalEntry({ env, user: USER, body: { ...BODY, sessionSeed: 'state-read-failure' } });
  const id = saved.body.entry.id;
  const prepare = env.DB.prepare.bind(env.DB);
  env.DB.prepare = sql => {
    if (sql.includes('journal_visual_state')) throw new Error('isolated state read failure');
    return prepare(sql);
  };
  const warn = t.mock.method(console, 'warn', () => {});
  const dedup = await saveAppJournalEntry({ env, user: USER, body: { ...BODY, sessionSeed: 'state-read-failure' } });
  assert.equal(dedup.status, 200);
  assert.equal(dedup.body.visual?.cueLedger.cues[0].id, 'vc:integration');
  const detail = await (await getEntry({ env, request: request(`/${id}`), params: { id } })).json();
  const list = await (await getJournal({ env, request: request('') })).json();
  assert.equal(detail.entry.visual?.cueLedger.cues[0].id, 'vc:integration');
  assert.equal(list.entries[0].visual?.cueLedger.cues[0].id, 'vc:integration');
  assert.equal(detail.entry.personalReading, BODY.personalReading);
  const proseSave = await saveAppJournalEntry({ env, user: USER, body: { ...BODY, readingResultId: null } });
  assert.equal(proseSave.status, 201);
  assert.equal(env.DB.rows('SELECT narrative FROM journal_entries WHERE id = ?', [proseSave.body.entry.id])[0].narrative, BODY.personalReading);
  assert.ok(warn.mock.calls.length >= 1);
});

test('pre-0037 account deletion cleans legacy original jobs without requiring replay schema', async t => {
  const db = await createD1({ throughMigration: '0036_reading_visual_results.sql' });
  t.after(() => db.sqlite.close());
  await seedUser(db, { id: USER.id });
  await seedSession(db, { id: 'visual-session', userId: USER.id });
  const { seedEntry } = await import('./helpers/journalFixtures.mjs');
  await seedEntry(db, { id: 'legacy-account-entry', userId: USER.id, narrative: BODY.personalReading, cards: BODY.cards });
  const { spreadHash, contextHash } = await computeSourceFingerprint(BODY);
  const binding = { readingResultId: BODY.readingResultId, sourceRevision: 0, spreadHash, contextHash, artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };
  await db.prepare(`INSERT INTO reading_visual_results (id, user_id, created_at, updated_at, binding_json, source_revision, raw_hash, ledger_json, status) VALUES (?, ?, 1, 1, ?, 0, ?, ?, 'pending')`).bind(BODY.readingResultId, USER.id, JSON.stringify(binding), await hashVisualCueText(''), JSON.stringify(createVisualCueLedger(binding))).run();
  await db.prepare(`INSERT INTO journal_visual_links (journal_entry_id, reading_result_id, user_id, created_at, expected_raw_hash) VALUES ('legacy-account-entry', ?, ?, 1, ?)`).bind(BODY.readingResultId, USER.id, await hashVisualCueText(BODY.personalReading)).run();
  const revoked = [];
  const env = { DB: db, READING_VISUAL_JOBS: { idFromName: id => id, get: id => ({ fetch: async () => {
    revoked.push(id);
    assert.equal(db.rows('SELECT * FROM reading_visual_results').length, 0);
    assert.equal(db.rows('SELECT is_active FROM users WHERE id = ?', [USER.id])[0].is_active, 0);
    return new Response('{}');
  } }) } };
  const warn = t.mock.method(console, 'warn', () => {});
  const { onRequestPost } = await import('../functions/api/account/delete.js');
  const response = await onRequestPost({ env, request: new Request('https://test.invalid/api/account/delete', { method: 'POST', headers: { Cookie: 'session=visual-session', 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) }) });
  assert.equal(response.status, 200);
  assert.deepEqual(revoked, [BODY.readingResultId]);
  assert.equal(db.rows('SELECT * FROM users').length, 0);
  assert.equal(db.rows('SELECT * FROM journal_entries').length, 0);
  assert.equal(warn.mock.calls.length, 0);
});

test('migrated revocation write failure remains fail closed rather than taking legacy cleanup', async t => {
  const env = await setup(t);
  const saved = await saveAppJournalEntry({ env, user: USER, body: BODY });
  const prepare = env.DB.prepare.bind(env.DB);
  env.DB.prepare = sql => {
    if (sql.startsWith('INSERT INTO visual_owner_revocations')) throw new Error('revocation storage unavailable');
    return prepare(sql);
  };
  t.mock.method(console, 'error', () => {});
  let revoked = 0;
  env.READING_VISUAL_JOBS = { idFromName: id => id, get: () => ({ fetch: async () => { revoked++; return new Response('{}'); } }) };
  const { onRequestPost } = await import('../functions/api/account/delete.js');
  const response = await onRequestPost({ env, request: new Request('https://test.invalid/api/account/delete', { method: 'POST', headers: { Cookie: 'session=visual-session', 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) }) });
  assert.equal(response.status, 500);
  assert.equal(env.DB.rows('SELECT id FROM users')[0].id, USER.id);
  assert.equal(env.DB.rows('SELECT id FROM journal_entries')[0].id, saved.body.entry.id);
  assert.equal(revoked, 0);
});

test('partial replay schema cannot silently enter account legacy cleanup', async t => {
  const env = await setup(t);
  await env.DB.prepare('DROP TABLE visual_result_revocations').run();
  t.mock.method(console, 'error', () => {});
  const { onRequestPost } = await import('../functions/api/account/delete.js');
  const response = await onRequestPost({ env, request: new Request('https://test.invalid/api/account/delete', { method: 'POST', headers: { Cookie: 'session=visual-session', 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) }) });
  assert.equal(response.status, 500);
  assert.equal(env.DB.rows('SELECT is_active FROM users WHERE id = ?', [USER.id])[0].is_active, 1);
});

test('account deletion also supports confirmed absence of all optional visual schema', async t => {
  const db = await createD1({ throughMigration: '0035_add_inference_provenance.sql' });
  t.after(() => db.sqlite.close());
  await seedUser(db, { id: USER.id });
  await seedSession(db, { id: 'visual-session', userId: USER.id });
  const { onRequestPost } = await import('../functions/api/account/delete.js');
  const response = await onRequestPost({ env: { DB: db }, request: new Request('https://test.invalid/api/account/delete', { method: 'POST', headers: { Cookie: 'session=visual-session', 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }) }) });
  assert.equal(response.status, 200);
  assert.equal(db.rows('SELECT * FROM users').length, 0);
});

test('owned cloud replay route returns current attachment without configuration or inference and rejects foreign entry', async t => {
  const env = await setup(t); await register(env);
  const saved = await saveAppJournalEntry({ env, user: USER, body: BODY });
  const retryRoute = await import('../functions/api/journal/[id]/visual-retry.js');
  const response = await retryRoute.onRequestPost({ env, params: { entryId: saved.body.entry.id }, request: request(`/${saved.body.entry.id}/visual-retry`, 'POST') });
  assert.equal(response.status, 200); const result = await response.json();
  assert.equal(result.state.retryStatus, 'complete'); assert.equal(result.resumeHandle, null);
  assert.equal(result.state.visualSnapshot.cues[0].id, 'vc:integration');
  const foreign = await retryRoute.onRequestPost({ env, params: { entryId: 'foreign' }, request: request('/foreign/visual-retry', 'POST') });
  assert.equal(foreign.status, 404);
  const guest = await retryRoute.onRequestPost({ env, params: { entryId: saved.body.entry.id }, request: new Request('https://test/cloud-retry', { method: 'POST' }) });
  assert.equal(guest.status, 401);
});
