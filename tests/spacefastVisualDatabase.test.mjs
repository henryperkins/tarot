import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSpacefastDatabase } from '../spacefast/database/index.js';
import { createMySqlD1 } from './spacefastDatabaseHarness.mjs';
import { seedUser } from './helpers/journalFixtures.mjs';
import { saveAppJournalEntry } from '../functions/lib/journalEntries.js';
import { registerVisualResult, updateVisualResultSource, commitVisualResult, computeSourceFingerprint,
  loadJournalVisualState, deleteJournalVisualLink, revokeUserVisualResults } from '../functions/lib/readingVisualResults.js';
import { createVisualInitialAdmission, reserveVisualInitialDispatch } from '../functions/lib/readingVisualAdmission.js';
import { withInitialVisualAdmission } from './helpers/visualInitialAdmissionFixtures.mjs';
import { createVisualCueLedger } from '../shared/reading/visualCueLedger.js';
import { hashVisualCueText } from '../shared/contracts/visualCueBatches.js';

const nativeEnabled = Boolean(process.env.TABLEU_TEST_MYSQL_PORT);
const body = { spread: 'One Card', spreadKey: 'single', cards: [{ name: 'The Star', position: 'Present', orientation: 'Upright' }],
  question: 'Where is my hope?', personalReading: 'The Star pours into a pool.' };
async function fixture(t) {
  const native = await createMySqlD1();
  const db = createSpacefastDatabase(native);
  const user = { id: `sf-visual-${crypto.randomUUID()}`, subscription_tier: 'pro', subscription_status: 'active', auth_provider: 'session' };
  await seedUser(db, user);
  t.after(async () => {
    for (const table of ['visual_initial_reservations']) await native.prepare(`DELETE FROM ${table} WHERE dispatch_id LIKE ?`).bind(`${user.id}%`).run();
    for (const table of ['visual_initial_admissions', 'journal_visual_links', 'journal_visual_state', 'visual_retry_claims',
      'reading_visual_results', 'visual_owner_revocations', 'visual_result_revocations', 'journal_entries']) {
      await native.prepare(`DELETE FROM ${table} WHERE user_id = ?`).bind(user.id).run();
    }
    await native.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();
    await native.close();
  });
  const env = withInitialVisualAdmission({ DB: db, VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: 'offline-fixture' },
    { globalTotalLimit: 3, globalRateLimit: 3 });
  async function register(suffix = 'result') {
    const id = `${user.id}-${suffix}`;
    const { spreadHash, contextHash } = await computeSourceFingerprint(body);
    const binding = { readingResultId: id, sourceRevision: 0, spreadHash, contextHash,
      artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };
    assert.equal((await registerVisualResult({ db, userId: user.id, readingResultId: id, binding })).ok, true);
    return binding;
  }
  return { native, db, user, env, register };
}

test('native visual source, journal attachment, exact parent fences and deletion retain current contracts', { skip: !nativeEnabled }, async t => {
  const { db, user, env, register } = await fixture(t);
  const binding = await register();
  const args = { db, userId: user.id, readingResultId: binding.readingResultId, binding };
  assert.equal((await updateVisualResultSource({ ...args, raw: body.personalReading, complete: true })).ok, true);
  const ledger = createVisualCueLedger(binding);
  Object.assign(ledger, { raw: body.personalReading, analyzedEnd: body.personalReading.length,
    analyzedHash: await hashVisualCueText(body.personalReading), ledgerRevision: 1 });
  assert.equal((await commitVisualResult({ ...args, ledger, expectedLedgerRevision: 0, finalRaw: body.personalReading })).ok, true);
  const saved = await saveAppJournalEntry({ env, user, body: { ...body, readingResultId: binding.readingResultId } });
  assert.equal(saved.status, 201);
  assert.equal(saved.body.visual.status, 'complete');
  const entryId = saved.body.entry.id;
  assert.equal((await loadJournalVisualState({ env, db, userId: user.id, entryId })).attachmentStatus, 'attached');
  // Exact source fences include nullable reflections and deck fields inside JSON_TABLE.
  assert.equal((await updateVisualResultSource({ ...args, raw: body.personalReading, complete: true })).ok, true);
  await db.prepare('UPDATE journal_entries SET question = ? WHERE id = ?').bind('Changed question', entryId).run();
  assert.equal((await updateVisualResultSource({ ...args, raw: body.personalReading, complete: true })).ok, false);
  const deleted = await deleteJournalVisualLink({ db, env, userId: user.id, entryId, deleteEntry: true });
  assert.equal(deleted.cleanedResult, true);
  assert.equal(await db.prepare('SELECT id FROM journal_entries WHERE id = ?').bind(entryId).first(), null);
  assert.equal((await registerVisualResult(args)).ok, false, 'deletion tombstone rejects late registration');
});

test('native initial admission consumes one reservation per dispatch and serializes global limits', { skip: !nativeEnabled }, async t => {
  const { user, env, register } = await fixture(t);
  const bindings = await Promise.all(Array.from({ length: 8 }, (_, i) => register(`quota-${i}`)));
  for (const binding of bindings) assert.equal(await createVisualInitialAdmission({ env, userId: user.id, binding,
    readingResultId: binding.readingResultId, visualToken: 'offline-visual-token' }), true);
  const outcomes = await Promise.all(bindings.map((binding, i) => reserveVisualInitialDispatch({ env, userId: user.id,
    binding, visualToken: 'offline-visual-token', dispatchId: `${user.id}-${i}` })));
  assert.equal(outcomes.filter(Boolean).length, 3);
  const first = outcomes.indexOf(true);
  assert.equal(await reserveVisualInitialDispatch({ env, userId: user.id, binding: bindings[first],
    visualToken: 'offline-visual-token', dispatchId: `${user.id}-${first}` }), false);
});

test('native owner revocation inspects current schema and prevents result resurrection', { skip: !nativeEnabled }, async t => {
  const { db, env, user, register } = await fixture(t);
  const binding = await register();
  await revokeUserVisualResults({ env, userId: user.id });
  assert.equal((await registerVisualResult({ db, userId: user.id, readingResultId: binding.readingResultId, binding })).ok, false);
  assert.equal(await db.prepare('SELECT id FROM reading_visual_results WHERE id = ?').bind(binding.readingResultId).first(), null);
});

for (const editDuringInference of [false, true]) test(`native replay preserves one dispatch and fences source edits (${editDuringInference ? 'edited' : 'unchanged'})`, { skip: !nativeEnabled }, async t => {
  const { db, user, env } = await fixture(t);
  const { ReadingVisualJob } = await import('../src/worker/readingVisualJob.js');
  const { createWebVisualCapability } = await import('../functions/lib/readingVisualWebAdmission.js');
  const { retryJournalVisuals } = await import('../functions/lib/readingVisualRetry.js');
  let calls = 0, finish;
  env.VISUAL_CUE_ALLOWED_TIERS = '["plus","pro"]';
  env.VISUAL_REPLAY_LIMITS = JSON.stringify({ rateLimit: 3, totalLimit: 3, windowMs: 60000 });
  env.AI = { async run() { calls++; return new Promise(resolve => { finish = resolve; }); } };
  const jobs = new Map(), pending = [];
  env.READING_VISUAL_JOBS = { idFromName: id => id, get(id) {
    if (!jobs.has(id)) {
      let stored;
      const state = { storage: { get: async () => stored, put: async (_, value) => { stored = structuredClone(value); }, setAlarm: async () => {} },
        blockConcurrencyWhile: fn => fn(), waitUntil: promise => pending.push(promise) };
      jobs.set(id, new ReadingVisualJob(state, env));
    }
    return { fetch: (url, init) => jobs.get(id).fetch(new Request(url, init)) };
  } };
  const saved = await saveAppJournalEntry({ env, user, body });
  const entryId = saved.body.entry.id;
  const visualCapability = createWebVisualCapability({ env, user,
    request: new Request(`https://test.invalid/api/journal/${entryId}/visual-retry`, { method: 'POST', headers: { 'X-Reading-Cue-Display': '1' } }) });
  const results = await Promise.all(Array.from({ length: 5 }, () => retryJournalVisuals({ env, userId: user.id, entryId, visualCapability })));
  for (let n = 0; !finish && n < 200; n++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(calls, 1);
  assert.equal(new Set(results.map(result => result.resumeHandle?.visualJobId)).size, 1);
  if (editDuringInference) await db.prepare('UPDATE journal_entries SET question = ? WHERE id = ?').bind('A new question', entryId).run();
  finish({ response: { proposals: [] } });
  while (pending.length) await Promise.all(pending.splice(0));
  const claim = await db.prepare('SELECT * FROM visual_retry_claims WHERE user_id = ?').bind(user.id).first();
  assert.equal(claim.retry_status, editDuringInference ? 'exhausted' : 'complete');
  assert.equal((await db.prepare('SELECT narrative FROM journal_entries WHERE id = ?').bind(entryId).first()).narrative, body.personalReading);
  if (!editDuringInference) {
    const retried = await retryJournalVisuals({ env, userId: user.id, entryId, visualCapability });
    assert.equal(retried.state.retryStatus, 'complete');
    assert.equal(calls, 1, 'a completed replay cannot be spent twice');
  }
});
