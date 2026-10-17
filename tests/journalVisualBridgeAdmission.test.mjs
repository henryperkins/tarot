import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRecoveryBackend, starEntry } from '../e2e/helpers/journalVisualRecoveryBridge.mjs';
import { onRequestPost as localPost } from '../functions/api/reading-visual-retry.js';
import { onRequestPost as cloudPost } from '../functions/api/journal/[id]/visual-retry.js';
import { savedVisualRecovery, savedVisualSource } from '../src/lib/readingVisualStorage.js';
import { loadJournalVisualState, attachJournalVisualResult } from '../functions/lib/readingVisualResults.js';

const tables = ['journal_entries', 'journal_visual_state', 'journal_visual_links', 'reading_visual_results', 'visual_retry_claims'];
const rows = backend => Object.fromEntries(tables.map(table => [table, backend.db.rows(`SELECT * FROM ${table} ORDER BY 1`)]));
const request = (path, { session = null, display = '1', body = {} } = {}) => new Request(`https://journal.test${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(session ? { Cookie: `session=${session}` } : {}),
    ...(display === null ? {} : { 'X-Reading-Cue-Display': display }) }, body: JSON.stringify(body)
});
async function fixture(t) {
  const backend = await createRecoveryBackend({ on() {}, async route() {} });
  t.after(() => backend.close());
  return backend;
}

for (const tier of ['guest', 'free', 'plus', 'pro']) test(`real browser bridge ${tier} local POST admits only paid cookie readers`, async t => {
  const backend = await fixture(t);
  const session = tier === 'guest' ? null : await backend.seedAccount({ id: `${tier}-reader`, tier });
  const entry = starEntry();
  const response = await localPost({ env: backend.env, request: request('/api/tarot-reading/visual-retry', {
    session, body: { savedSource: savedVisualSource(entry) } }) });
  assert.equal(response.status, 200);
  const result = await response.json();
  await backend.settle();
  const paid = ['plus', 'pro'].includes(tier);
  assert.equal(backend.db.rows('SELECT * FROM visual_retry_claims').length, paid ? 1 : 0);
  assert.equal(backend.providerCalls(), paid ? 1 : 0);
  assert.equal(Boolean(result.resumeHandle), paid);
  if (!paid) {
    const recovery = savedVisualRecovery({ ...entry, visualState: result.state });
    assert.equal(recovery.phase, 'unavailable'); assert.equal(recovery.canRetry, false);
  }
});

const denied = [ ['missing allowlist', { allowlist: null }], ['empty allowlist', { allowlist: '[]' }],
  ['tier excluded', { allowlist: '["pro"]' }], ['display absent', { display: null }], ['display malformed', { display: 'true' }] ];
for (const [name, options] of denied) test(`cloud ${name} projects nonretryable refusal without changing owned data`, async t => {
  const backend = await fixture(t);
  // Explicit configuration isolates refusal behavior from the bridge policy test.
  backend.env.VISUAL_CUE_ALLOWED_TIERS = options.allowlist ?? '["plus","pro"]';
  if (options.allowlist === null) delete backend.env.VISUAL_CUE_ALLOWED_TIERS;
  const userId = 'cloud-reader'; const session = await backend.seedAccount({ id: userId });
  const entry = starEntry({ id: 'cloud-failed' });
  await backend.seedCloudEntry({ userId, entry, registered: true });
  const prior = await loadJournalVisualState({ env: backend.env, db: backend.db, userId, entryId: entry.id });
  const before = rows(backend);
  const response = await cloudPost({ env: backend.env, params: { entryId: entry.id },
    request: request(`/api/journal/${entry.id}/visual-retry`, { session, display: Object.hasOwn(options, 'display') ? options.display : '1' }) });
  assert.equal(response.status, 200); const result = await response.json(); await backend.settle();
  assert.deepEqual(result, { state: { ...prior, retryStatus: 'unavailable', reason: 'configuration-unavailable' }, resumeHandle: null });
  const recovery = savedVisualRecovery({ ...entry, visualState: result.state }, { cloud: true });
  assert.equal(recovery.phase, 'unavailable'); assert.equal(recovery.canRetry, false);
  assert.deepEqual(rows(backend), before, 'snapshot, original reason, version, links and source bytes stay durable');
  assert.equal(backend.providerCalls(), 0);
});

for (const status of ['complete', 'pending', 'exhausted', 'revoked']) test(`cloud capability refusal retains stronger ${status} work state`, async t => {
  const backend = await fixture(t); backend.env.VISUAL_CUE_ALLOWED_TIERS = '[]';
  const userId = 'strong-reader'; const session = await backend.seedAccount({ id: userId });
  const entry = starEntry({ id: 'strong-entry' });
  const { binding } = await backend.seedCloudEntry({ userId, entry, registered: status === 'complete', pendingOriginal: status === 'pending' });
  if (status === 'complete') await attachJournalVisualResult({ db: backend.db, userId, entryId: entry.id, readingResultId: binding.readingResultId });
  if (['exhausted', 'revoked'].includes(status)) await backend.db.prepare('UPDATE journal_visual_state SET retry_status = ? WHERE journal_entry_id = ?').bind(status, entry.id).run();
  const before = rows(backend); const prior = await loadJournalVisualState({ env: backend.env, db: backend.db, userId, entryId: entry.id });
  const response = await cloudPost({ env: backend.env, params: { entryId: entry.id }, request: request(`/api/journal/${entry.id}/visual-retry`, { session }) });
  assert.deepEqual(await response.json(), { state: prior, resumeHandle: null });
  assert.deepEqual(rows(backend), before); assert.equal(backend.providerCalls(), 0);
});

for (const cloud of [false, true]) test(`historical ${cloud ? 'paid cloud' : 'Free local'} pending fixture remains readable without new admission`, async t => {
  const backend = await fixture(t); const userId = cloud ? 'historical-plus' : 'historical-free';
  const session = await backend.seedAccount({ id: userId, tier: cloud ? 'plus' : 'free' });
  const entry = starEntry({ id: `historical-${cloud}` });
  if (cloud) await backend.seedCloudEntry({ userId, entry });
  const { sourceBinding } = await import('../e2e/helpers/journalVisualRecoveryBridge.mjs');
  const binding = await sourceBinding(entry, `historical-result-${cloud}`);
  await backend.seedHistoricalReplay({ userId, entry, binding, cloud, stateVersion: 7 });
  const before = rows(backend); delete backend.env.READING_VISUAL_JOBS;
  const response = cloud ? await cloudPost({ env: backend.env, params: { entryId: entry.id }, request: request(`/api/journal/${entry.id}/visual-retry`, { session }) })
    : await localPost({ env: backend.env, request: request('/api/tarot-reading/visual-retry', { session, body: { savedSource: savedVisualSource(entry) } }) });
  assert.equal(response.status, 200); const result = await response.json();
  assert.equal(result.state.retryStatus, 'pending'); assert.equal(result.state.reason, 'configuration-unavailable');
  assert.equal(result.resumeHandle, null); assert.equal(savedVisualRecovery({ ...entry, visualState: result.state }, { cloud }).canRetry, false);
  assert.deepEqual(rows(backend), before); assert.equal(backend.providerCalls(), 0);
});

test('capability denial retains an accepted cloud snapshot and its complete source bytes', async t => {
  const backend = await fixture(t); const userId = 'cached-plus'; const session = await backend.seedAccount({ id: userId });
  const entry = starEntry({ id: 'cached-denied' }); const { binding } = await backend.seedCloudEntry({ userId, entry, registered: true });
  await attachJournalVisualResult({ db: backend.db, userId, entryId: entry.id, readingResultId: binding.readingResultId });
  await backend.db.prepare("UPDATE reading_visual_results SET status = 'pending', expires_at = ? WHERE id = ?").bind(Date.now() - 1, binding.readingResultId).run();
  const prior = await loadJournalVisualState({ env: backend.env, db: backend.db, userId, entryId: entry.id });
  assert.ok(prior.visualSnapshot?.snapshot?.cues?.length || prior.visualSnapshot?.cueLedger?.cues?.length, 'real accepted snapshot exists');
  backend.env.VISUAL_CUE_ALLOWED_TIERS = '[]'; const before = rows(backend);
  const response = await cloudPost({ env: backend.env, params: { entryId: entry.id }, request: request(`/api/journal/${entry.id}/visual-retry`, { session }) });
  const result = await response.json();
  assert.equal(result.state.reason, 'configuration-unavailable'); assert.equal(result.state.retryStatus, 'unavailable');
  assert.deepEqual(result.state.visualSnapshot, prior.visualSnapshot); assert.deepEqual(rows(backend), before);
  assert.equal(backend.providerCalls(), 0);
});

test('paid public reservation remains observable after downgrade without new Free work', async t => {
  const backend = await createRecoveryBackend({ on() {}, async route() {} }, { provider: 'hold' });
  t.after(() => backend.close());
  backend.setSession(await backend.seedAccount({ id: 'downgraded-reader' }));
  const source = savedVisualSource(starEntry());
  const first = await backend.postLocalRetry(source);
  assert.equal(first.status, 200);
  const reserved = await first.json(); assert.ok(reserved.resumeHandle);
  await backend.db.prepare("UPDATE users SET subscription_tier = 'free', subscription_status = 'inactive' WHERE id = ?")
    .bind('downgraded-reader').run();
  const resumed = await (await backend.postLocalRetry(source)).json();
  assert.equal(resumed.resumeHandle?.visualJobId, reserved.resumeHandle.visualJobId);
  assert.equal(backend.db.rows('SELECT * FROM visual_retry_claims').length, 1);
  backend.releaseProvider(); await backend.settle();
  assert.equal(backend.providerCalls(), 1);
  const completed = await (await backend.postLocalRetry(source)).json();
  assert.equal(completed.state.retryStatus, 'complete');
  const different = savedVisualSource(starEntry({ personalReading: 'A different saved reading.' }));
  const denied = await (await backend.postLocalRetry(different)).json();
  assert.equal(denied.resumeHandle, null); assert.equal(denied.state.reason, 'configuration-unavailable');
  assert.equal(backend.db.rows('SELECT * FROM visual_retry_claims').length, 1);
  assert.equal(backend.providerCalls(), 1);
});
