import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser, seedEntry } from './helpers/journalFixtures.mjs';
import { ReadingVisualJob } from '../src/worker/readingVisualJob.js';
import { admitInitialVisualFixture, withInitialVisualAdmission } from './helpers/visualInitialAdmissionFixtures.mjs';
const replay = await import('../functions/lib/readingVisualRetry.js').catch(() => null);
const SOURCE = { raw: 'The Star pours into a pool.', cards: [{ name: 'The Star', position: 'Present', orientation: 'Upright' }], question: '', reflections: { Overall: 'Hope' }, deckId: 'rws-1909' };
async function fixture(t, { response = { response: { proposals: [] } }, limits = true, configured = true } = {}) {
  assert.ok(replay, 'saved replay implementation exists');
  const db = await createD1(); t.after(() => db.sqlite.close());
  await seedUser(db); await seedEntry(db, { cards: SOURCE.cards, narrative: SOURCE.raw, reflections: SOURCE.reflections, deckId: SOURCE.deckId });
  const jobs = new Map(), pending = []; let calls = 0;
  const env = withInitialVisualAdmission({ DB: db, ...(limits ? { VISUAL_REPLAY_LIMITS: JSON.stringify({ rateLimit: 3, windowMs: 60000, totalLimit: 5 }) } : {}),
    ...(configured ? { VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: 'fake', AI: { async run(...args) { calls++; return typeof response === 'function' ? response(...args) : response; } } } : {}) });
  env.READING_VISUAL_JOBS = { idFromName: id => id, get(id) {
    if (!jobs.has(id)) {
      let stored; const state = { storage: { get: async () => stored, put: async (_, value) => { stored = structuredClone(value); }, setAlarm: async () => {} },
        blockConcurrencyWhile: fn => fn(), waitUntil: p => pending.push(p) };
      jobs.set(id, { state, job: new ReadingVisualJob(state, env) });
    }
    return { fetch: async (url, options) => {
      const request = new Request(url, options);
      if (new URL(url).pathname === '/init') await admitInitialVisualFixture(env, await request.clone().json());
      return jobs.get(id).job.fetch(request);
    } };
  } };
  const admission = await replay.createVisualReplayAdmission({ env, userId: 'user-1' });
  const drain = async () => { while (pending.length) await Promise.all(pending.splice(0)); };
  return { env, db, admission, jobs, drain, calls: () => calls };
}
test('concurrent cloud clicks and tabs dispatch exactly once with stable narrative identity', async t => {
  const f = await fixture(t);
  const results = await Promise.all(Array.from({ length: 5 }, () => replay.retryJournalVisuals({ env: f.env, userId: 'user-1', entryId: 'entry-1' })));
  await f.drain(); assert.equal(f.calls(), 1);
  assert.equal(new Set(results.map(r => r.resumeHandle?.visualJobId)).size, 1);
  const row = f.db.rows('SELECT * FROM visual_retry_claims')[0]; assert.equal(row.dispatch_status, 'settled');
  assert.equal(row.retry_status, 'complete'); assert.notEqual(row.visual_job_id, row.reading_result_id);
  assert.equal(f.db.rows('SELECT narrative FROM journal_entries')[0].narrative, SOURCE.raw);
});
test('local source IDs and reload cannot reset the one-source claim or inspect old opaque IDs', async t => {
  const f = await fixture(t);
  const a = await replay.retryLocalVisuals({ env: f.env, admission: f.admission, savedSource: { ...SOURCE, id: 'one', readingResultId: 'private-old' } });
  await f.drain();
  const b = await replay.retryLocalVisuals({ env: f.env, admission: f.admission, savedSource: { ...SOURCE, id: 'two', readingResultId: 'foreign' } });
  await f.drain(); assert.equal(f.calls(), 1); assert.deepEqual(b.resumeHandle, a.resumeHandle); assert.notEqual(a.resumeHandle.readingResultId, 'private-old');
});
for (const reason of ['no config', 'no limits', 'untrusted admission', 'no DB']) test(`${reason} makes zero calls and preserves retry allowance`, async t => {
  const f = await fixture(t, { configured: reason !== 'no config', limits: reason !== 'no limits' });
  const env = reason === 'no DB' ? { ...f.env, DB: null } : f.env;
  const result = await replay.retryLocalVisuals({ env, admission: reason === 'untrusted admission' ? { userId: 'user-1', scope: 'user:user-1' } : f.admission, savedSource: SOURCE });
  await f.drain(); assert.equal(f.calls(), 0); assert.equal(result.resumeHandle, null); assert.equal(f.db.rows("SELECT * FROM visual_retry_claims WHERE dispatch_status != 'prepared'").length, 0);
});
for (const failure of ['rejected', 'malformed', 'timeout']) test(`${failure} exhausts a durable dispatch across cold recovery`, async t => {
  const f = await fixture(t, { response: failure === 'malformed' ? { response: 'not-json' } : () => failure === 'timeout' ? new Promise(() => {}) : Promise.reject(new Error('fake rejection')) });
  f.env.VISUAL_CUE_TIMEOUT_MS = 10;
  const r = await replay.retryLocalVisuals({ env: f.env, admission: f.admission, savedSource: SOURCE }); await f.drain();
  const item = f.jobs.get(r.resumeHandle.visualJobId); item.job = new ReadingVisualJob(item.state, f.env); await item.job.initialized;
  await item.job.fetch(new Request('https://reading-visual-jobs/snapshot', { headers: { 'X-Visual-Token': r.resumeHandle.visualJobToken } }));
  await replay.retryLocalVisuals({ env: f.env, admission: f.admission, savedSource: SOURCE }); await f.drain();
  assert.equal(f.calls(), 1); assert.equal(f.db.rows('SELECT retry_status FROM visual_retry_claims')[0].retry_status, 'exhausted');
});
for (const field of ['narrative', 'cards_json', 'deck_id', 'reflections_json', 'question', 'delete', 'account']) test(`cloud ${field} change during inference rejects commit and leaves prose authoritative`, async t => {
  let finish; const f = await fixture(t, { response: () => new Promise(resolve => { finish = resolve; }) });
  const r = await replay.retryJournalVisuals({ env: f.env, userId: 'user-1', entryId: 'entry-1' });
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  if (field === 'delete') await f.db.prepare("DELETE FROM journal_entries WHERE id = 'entry-1'").run();
  else if (field === 'account') await f.db.prepare("INSERT INTO visual_owner_revocations VALUES ('user-1', 1)").run();
  else await f.db.prepare(`UPDATE journal_entries SET ${field} = ? WHERE id = 'entry-1'`).bind(field === 'cards_json' ? JSON.stringify([{ ...SOURCE.cards[0], orientation: 'Reversed' }]) : field === 'reflections_json' ? JSON.stringify({ Overall: 'Changed' }) : 'changed').run();
  finish({ response: { proposals: [] } }); await f.drain();
  assert.equal(f.calls(), 1); assert.notEqual(f.db.rows('SELECT retry_status FROM visual_retry_claims')[0].retry_status, 'complete');
  assert.equal(f.db.rows('SELECT ledger_revision FROM reading_visual_results')[0]?.ledger_revision || 0, 0);
  assert.ok(r.resumeHandle.attemptId);
});
test('transport rejects wrong tokens, foreign owners, expired capabilities and expired re-init', async t => {
  const f = await fixture(t); const r = await replay.retryLocalVisuals({ env: f.env, admission: f.admission, savedSource: SOURCE }); await f.drain();
  const job = f.jobs.get(r.resumeHandle.visualJobId).job;
  assert.equal((await job.fetch(new Request('https://reading-visual-jobs/snapshot', { headers: { 'X-Visual-Token': 'wrong', 'X-User-Id': 'foreign' } }))).status, 403);
  job.expiresAt = Date.now() - 1;
  assert.equal((await job.fetch(new Request('https://reading-visual-jobs/snapshot', { headers: { 'X-Visual-Token': r.resumeHandle.visualJobToken } }))).status, 410);
  assert.equal((await job.fetch(new Request('https://reading-visual-jobs/replay-init', { method: 'POST', body: JSON.stringify({ claimId: f.db.rows('SELECT id FROM visual_retry_claims')[0].id }) }))).status, 410);
  assert.equal(f.calls(), 1);
});

test('new guest principals remain behind the same trusted aggregate inference cap', async t => {
  const f = await fixture(t); f.env.VISUAL_REPLAY_LIMITS = JSON.stringify({ rateLimit: 1, windowMs: 60000, totalLimit: 1 });
  f.env.VISUAL_REPLAY_TRUSTED_IDENTITY = { resolve: async () => 'trusted-test-edge' };
  const a = await replay.createVisualReplayAdmission({ env: f.env, request: new Request('https://test/retry') });
  const b = await replay.createVisualReplayAdmission({ env: f.env, request: new Request('https://test/retry') });
  assert.notEqual(a.scope, b.scope);
  await replay.retryLocalVisuals({ env: f.env, admission: a, savedSource: SOURCE }); await f.drain();
  await replay.retryLocalVisuals({ env: f.env, admission: b, savedSource: { ...SOURCE, raw: SOURCE.raw + ' changed' } }); await f.drain();
  assert.equal(f.calls(), 1);
  assert.equal(f.db.rows('SELECT * FROM visual_retry_claims WHERE reserved_at IS NOT NULL').length, 1);
  assert.equal(await replay.createVisualReplayAdmission({ env: { ...f.env, VISUAL_REPLAY_TRUSTED_IDENTITY: null },
    request: new Request('https://test/retry', { headers: { 'x-forwarded-for': 'forged', 'x-real-ip': 'forged', 'CF-Connecting-IP': 'forged' } }) }), null);
});

test('a saved valid same-owner unlinked registration is repaired with zero calls', async t => {
  const f = await fixture(t);
  const { fingerprintVisualSource } = await import('../shared/reading/visualSourceIdentity.js');
  const { registerVisualResult, updateVisualResultSource, commitVisualResult, persistJournalVisualState, fingerprintSavedVisualSource, loadOwnedJournalVisualSource } = await import('../functions/lib/readingVisualResults.js');
  const { createVisualCueLedger } = await import('../shared/reading/visualCueLedger.js');
  const { hashVisualCueText } = await import('../shared/contracts/visualCueBatches.js');
  const owned = await loadOwnedJournalVisualSource({ db: f.db, userId: 'user-1', entryId: 'entry-1' });
  const hashes = await fingerprintVisualSource(owned.source);
  const binding = { readingResultId: 'unlinked-current', sourceRevision: 0, spreadHash: hashes.spreadHash, contextHash: hashes.contextHash, artworkEdition: owned.artworkEdition, catalogVersion: owned.catalogVersion };
  await registerVisualResult({ db: f.db, userId: 'user-1', readingResultId: binding.readingResultId, binding });
  await updateVisualResultSource({ db: f.db, userId: 'user-1', readingResultId: binding.readingResultId, binding, raw: SOURCE.raw, complete: true });
  const ledger = createVisualCueLedger(binding); ledger.raw = SOURCE.raw; ledger.analyzedEnd = SOURCE.raw.length; ledger.analyzedHash = await hashVisualCueText(SOURCE.raw);
  await commitVisualResult({ db: f.db, userId: 'user-1', readingResultId: binding.readingResultId, binding, ledger, expectedLedgerRevision: 0, finalRaw: SOURCE.raw });
  await persistJournalVisualState({ db: f.db, userId: 'user-1', entryId: 'entry-1', sourceFingerprint: await fingerprintSavedVisualSource(owned),
    attachmentStatus: 'failed', readingResultId: binding.readingResultId });
  const result = await replay.retryJournalVisuals({ env: f.env, userId: 'user-1', entryId: 'entry-1' }); await f.drain();
  assert.equal(f.calls(), 0); assert.equal(result.state.retryStatus, 'complete'); assert.equal(result.resumeHandle, null);
});

for (const boundary of ['claim', 'init', 'reservation', 'commit']) {
  for (const edit of ['source', 'owner deletion', 'entry deletion']) test(`${edit} at ${boundary} await cannot dispatch or commit stale cloud replay`, async t => {
    const f = await fixture(t); let triggered = false;
    const pattern = { claim: 'INSERT INTO visual_retry_claims', init: 'INSERT INTO reading_visual_results', reservation: "SET dispatch_status = 'reserved'", commit: 'SET ledger_json = ?' }[boundary];
    const originalPrepare = f.db.prepare.bind(f.db);
    f.db.prepare = sql => {
      const statement = originalPrepare(sql);
      const wrap = target => new Proxy(target, { get(object, key) {
        if (key === 'bind') return (...args) => wrap(object.bind(...args));
        if (['execute', 'first', 'run', 'all'].includes(key)) return (...args) => {
          if (!triggered && sql.includes(pattern)) {
            triggered = true;
            if (edit === 'source') f.db.sqlite.run("UPDATE journal_entries SET reflections_json = '{\"Overall\":\"new\"}' WHERE id = 'entry-1'");
            if (edit === 'owner deletion') f.db.sqlite.run("INSERT INTO visual_owner_revocations VALUES ('user-1', 1)");
            if (edit === 'entry deletion') f.db.sqlite.run("DELETE FROM journal_entries WHERE id = 'entry-1'");
          }
          return object[key](...args);
        };
        return Reflect.get(object, key);
      } });
      return wrap(statement);
    };
    const result = await replay.retryJournalVisuals({ env: f.env, userId: 'user-1', entryId: 'entry-1' }); await f.drain();
    assert.equal(triggered, true); assert.equal(f.calls(), boundary === 'commit' ? 1 : 0);
    assert.equal(f.db.rows("SELECT * FROM visual_retry_claims WHERE retry_status = 'complete'").length, 0);
    assert.equal(f.db.rows('SELECT ledger_revision FROM reading_visual_results')[0]?.ledger_revision || 0, 0);
    assert.equal(result.state?.visualSnapshot?.cueLedger?.cues?.length || 0, 0);
  });
}

test('explicit cancellation after reservation aborts the provider and cannot dispatch again', async t => {
  let receivedSignal, resolveCall, actualCalls = 0;
  const f = await fixture(t); f.env.AI.run = async (_model, _body, { signal }) => { actualCalls++; receivedSignal = signal; return new Promise(resolve => { resolveCall = resolve; }); };
  const result = await replay.retryLocalVisuals({ env: f.env, admission: f.admission, savedSource: SOURCE });
  while (!receivedSignal) await new Promise(resolve => setImmediate(resolve));
  const item = f.jobs.get(result.resumeHandle.visualJobId);
  const cancelled = await item.job.fetch(new Request('https://reading-visual-jobs/cancel', { method: 'POST', headers: { 'X-Visual-Token': result.resumeHandle.visualJobToken } }));
  assert.equal(cancelled.status, 200); assert.equal(receivedSignal.aborted, true);
  resolveCall({ response: { proposals: [] } }); await f.drain();
  const retry = await replay.retryLocalVisuals({ env: f.env, admission: f.admission, savedSource: SOURCE }); await f.drain();
  assert.equal(retry.resumeHandle, null); assert.equal(f.db.rows('SELECT dispatch_status FROM visual_retry_claims')[0].dispatch_status, 'revoked');
  assert.ok(f.db.rows('SELECT reserved_at FROM visual_retry_claims')[0].reserved_at); assert.equal(actualCalls, 1);
});

test('unknown reserved dispatch survives fresh DO recovery without a second provider invocation', async t => {
  const f = await fixture(t);
  let finish, actualCalls = 0; f.env.AI.run = () => { actualCalls++; return new Promise(resolve => { finish = resolve; }); };
  const result = await replay.retryLocalVisuals({ env: f.env, admission: f.admission, savedSource: SOURCE });
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  const item = f.jobs.get(result.resumeHandle.visualJobId);
  const fresh = new ReadingVisualJob(item.state, f.env); await fresh.initialized;
  assert.equal(f.db.rows('SELECT retry_status FROM visual_retry_claims')[0].retry_status, 'exhausted');
  finish({ response: { proposals: [] } }); await f.drain();
  assert.equal(f.db.rows('SELECT ledger_revision FROM reading_visual_results')[0].ledger_revision, 0); assert.equal(actualCalls, 1);
  assert.equal((await fresh.fetch(new Request('https://visual/snapshot', { headers: { 'X-Visual-Token': result.resumeHandle.visualJobToken } }))).status, 200);
});

test('a complete replay exposes its accepted snapshot through real journal state after reload', async t => {
  const f = await fixture(t, { response: { response: { proposals: [{ localAlias: 'pool', kind: 'literal', quote: SOURCE.raw,
    targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }] }] } } });
  await replay.retryJournalVisuals({ env: f.env, userId: 'user-1', entryId: 'entry-1' }); await f.drain();
  const { loadJournalVisualState } = await import('../functions/lib/readingVisualResults.js');
  const state = await loadJournalVisualState({ env: f.env, db: f.db, userId: 'user-1', entryId: 'entry-1' });
  assert.equal(state.retryStatus, 'complete'); assert.equal(state.visualSnapshot.cueLedger.cues.length, 1);
  const again = await replay.retryJournalVisuals({ env: f.env, userId: 'user-1', entryId: 'entry-1' }); await f.drain();
  assert.equal(f.calls(), 1); assert.equal(again.resumeHandle, null);
});

test('configuration removed at reservation await makes zero calls and preserves the explicit slot', async t => {
  const f = await fixture(t); let edited = false;
  const prepare = f.db.prepare.bind(f.db);
  f.db.prepare = sql => {
    const wrap = statement => new Proxy(statement, { get(object, key) {
      if (key === 'bind') return (...args) => wrap(object.bind(...args));
      if (key === 'execute') return (...args) => {
        const result = object.execute(...args);
        if (!edited && sql.includes("SET dispatch_status = 'reserved'")) { edited = true; delete f.env.VISUAL_CUE_PROVIDER; }
        return result;
      };
      return Reflect.get(object, key);
    } }); return wrap(prepare(sql));
  };
  await replay.retryLocalVisuals({ env: f.env, admission: f.admission, savedSource: SOURCE }); await f.drain();
  assert.equal(edited, true); assert.equal(f.calls(), 0); assert.equal(f.db.rows('SELECT dispatch_status FROM visual_retry_claims')[0].dispatch_status, 'prepared');
  f.env.VISUAL_CUE_PROVIDER = 'workers-ai';
  await replay.retryLocalVisuals({ env: f.env, admission: f.admission, savedSource: SOURCE }); await f.drain(); assert.equal(f.calls(), 1);
});

async function seedFailedOriginal(f) {
  const resultLib = await import('../functions/lib/readingVisualResults.js');
  const { applyVisualCueBatch, createVisualCueLedger } = await import('../shared/reading/visualCueLedger.js');
  const { hashVisualCueText } = await import('../shared/contracts/visualCueBatches.js');
  const owned = await resultLib.loadOwnedJournalVisualSource({ db: f.db, userId: 'user-1', entryId: 'entry-1' });
  const hashes = await resultLib.computeSourceFingerprint(owned.source);
  const binding = { readingResultId: 'original-result', sourceRevision: 0, spreadHash: hashes.spreadHash, contextHash: hashes.contextHash,
    artworkEdition: owned.artworkEdition, catalogVersion: owned.catalogVersion };
  await resultLib.registerVisualResult({ db: f.db, userId: 'user-1', readingResultId: binding.readingResultId, binding });
  await resultLib.updateVisualResultSource({ db: f.db, userId: 'user-1', readingResultId: binding.readingResultId, binding, raw: SOURCE.raw, complete: true });
  const result = await applyVisualCueBatch({ ledger: createVisualCueLedger(binding), issuedRequest: { binding, status: 'active', batchId: 'original-cue', requestSequence: 1,
    analyzedEnd: SOURCE.raw.length, analyzedHash: await hashVisualCueText(SOURCE.raw), baseLedgerRevision: 0 }, response: { proposals: [{ localAlias: 'pool', kind: 'literal', quote: 'pours into a pool',
      targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }] }] }, authoritativeRaw: SOURCE.raw,
    validationContext: { cards: [{ index: 0, canonicalName: 'The Star' }], getSupportedDetails: () => [{ id: 'pool-pour' }] } });
  assert.equal(result.ledger.cues.length, 1);
  await resultLib.commitVisualResult({ db: f.db, userId: 'user-1', readingResultId: binding.readingResultId, binding, expectedLedgerRevision: 0,
    ledger: result.ledger, finalRaw: SOURCE.raw, status: 'failed' });
  await resultLib.attachJournalVisualResult({ db: f.db, userId: 'user-1', entryId: 'entry-1', readingResultId: binding.readingResultId });
  return { resultLib, binding, ledger: result.ledger };
}

for (const successor of ['failed', 'accepted']) test(`${successor} successor preserves original cue IDs and stable binding until a fenced replacement`, async t => {
  const f = await fixture(t, { response: successor === 'failed' ? () => Promise.reject(new Error('failed')) : { response: { proposals: [{ localAlias: 'identity', kind: 'identity',
    quote: 'The Star', targets: [{ spreadIndex: 0, detailIds: [] }] }] } } });
  const original = await seedFailedOriginal(f);
  const r = await replay.retryJournalVisuals({ env: f.env, userId: 'user-1', entryId: 'entry-1' }); await f.drain();
  assert.equal(f.calls(), 1); assert.equal(r.resumeHandle.readingResultId, original.binding.readingResultId);
  assert.deepEqual(r.resumeHandle.visualBinding, original.binding);
  const current = await original.resultLib.loadJournalVisualState({ env: f.env, db: f.db, userId: 'user-1', entryId: 'entry-1' });
  assert.ok(current.visualSnapshot.cues.some(cue => cue.id === original.ledger.cues[0].id));
  assert.equal(current.visualSnapshot.cues.length, successor === 'failed' ? 1 : 2);
  assert.equal(current.retryStatus, successor === 'failed' ? 'exhausted' : 'complete');
  const late = await original.resultLib.commitVisualResult({ db: f.db, userId: 'user-1', readingResultId: original.binding.readingResultId, binding: original.binding,
    expectedLedgerRevision: original.ledger.ledgerRevision, expectedReceiptCount: original.ledger.receipts.length, ledger: original.ledger, status: 'complete', finalRaw: SOURCE.raw });
  assert.equal(late.ok, false);
  await original.resultLib.expireVisualResult({ db: f.db, userId: 'user-1', readingResultId: original.binding.readingResultId });
  assert.equal((await original.resultLib.loadJournalVisualState({ env: f.env, db: f.db, userId: 'user-1', entryId: 'entry-1' })).retryStatus, current.retryStatus);
});

test('claim version is independent of a preexisting journal state version', async t => {
  const f = await fixture(t); const original = await seedFailedOriginal(f);
  await f.db.prepare("UPDATE journal_visual_state SET state_version = 7 WHERE journal_entry_id = 'entry-1'").run();
  const r = await replay.retryJournalVisuals({ env: f.env, userId: 'user-1', entryId: 'entry-1' }); await f.drain();
  assert.equal(f.calls(), 1); assert.equal(f.db.rows('SELECT state_version FROM visual_retry_claims')[0].state_version, 1);
  assert.equal(f.db.rows('SELECT state_version FROM journal_visual_state')[0].state_version, 9); // repair 7→8, replay claim 8→9
  assert.equal((await original.resultLib.loadJournalVisualState({ env: f.env, db: f.db, userId: 'user-1', entryId: 'entry-1' })).retryStatus, 'complete');
  assert.ok(r.resumeHandle.attemptId);
});

for (const phase of ['hash source', 'hash owner']) test(`${phase} changes invalidate cloud admission without a call`, async t => {
  const f = await fixture(t); const digest = crypto.subtle.digest.bind(crypto.subtle); let changed = false;
  const own = Object.getOwnPropertyDescriptor(crypto.subtle, 'digest');
  crypto.subtle.digest = async (...args) => {
    const value = await digest(...args);
    if (!changed) { changed = true;
      if (phase === 'hash source') f.db.sqlite.run("UPDATE journal_entries SET narrative = 'edited at hash' WHERE id = 'entry-1'");
      else f.db.sqlite.run("INSERT INTO visual_owner_revocations VALUES ('user-1', 1)");
    }
    return value;
  };
  try { await replay.retryJournalVisuals({ env: f.env, userId: 'user-1', entryId: 'entry-1' }); await f.drain(); }
  finally { if (own) Object.defineProperty(crypto.subtle, 'digest', own); else delete crypto.subtle.digest; }
  assert.equal(changed, true); assert.equal(f.calls(), 0); assert.equal(f.db.rows("SELECT * FROM visual_retry_claims WHERE reserved_at IS NOT NULL").length, 0);
});

for (const configured of [undefined, 999999]) test(`replay uses actual ${configured ? 'capped' : 'default'} provider deadline`, async t => {
  const f = await fixture(t); f.env.VISUAL_CUE_TIMEOUT_MS = configured;
  const timer = globalThis.setTimeout; const durations = [];
  globalThis.setTimeout = (fn, milliseconds, ...args) => { durations.push(milliseconds); return timer(fn, milliseconds, ...args); };
  try { await replay.retryLocalVisuals({ env: f.env, admission: f.admission, savedSource: SOURCE }); await f.drain(); }
  finally { globalThis.setTimeout = timer; }
  assert.ok(durations.some(ms => ms > (configured ? 59000 : 29000) && ms <= (configured ? 60000 : 30000)));
  assert.equal(f.calls(), 1);
});

test('public replay routes reject spoofed owners and guessed IDs while allowing authenticated private transport', async t => {
  const f = await fixture(t); const { seedSession } = await import('./helpers/journalFixtures.mjs');
  const route = await import('../functions/api/reading-visual-replay.js');
  await seedSession(f.db);
  const result = await replay.retryLocalVisuals({ env: f.env, admission: f.admission, savedSource: SOURCE }); await f.drain();
  const context = (id, headers = {}) => ({ env: f.env, params: { visualJobId: id }, request: new Request(`https://test/api/tarot-reading/visual-replays/${id}`, { headers }) });
  assert.equal((await route.onRequestGet(context(result.resumeHandle.visualJobId, { 'X-User-Id': 'user-1' }))).status, 401);
  assert.equal((await route.onRequestGet(context('guessed', { Cookie: 'session=session-1' }))).status, 403);
  await seedUser(f.db, { id: 'foreign' }); await seedSession(f.db, { id: 'foreign-session', userId: 'foreign' });
  assert.equal((await route.onRequestGet(context(result.resumeHandle.visualJobId, { Cookie: 'session=foreign-session' }))).status, 403);
  assert.equal((await route.onRequestGet(context(result.resumeHandle.visualJobId, { Cookie: 'session=session-1' }))).status, 200);
  assert.equal((await route.onRequestGet(context(result.resumeHandle.visualJobId, { 'X-Visual-Token': result.resumeHandle.visualJobToken }))).status, 200);
  const stream = await route.onRequestGet({ ...context(result.resumeHandle.visualJobId, { 'X-Visual-Token': result.resumeHandle.visualJobToken }),
    request: new Request(`https://test/api/tarot-reading/visual-replays/${result.resumeHandle.visualJobId}/stream`, { headers: { 'X-Visual-Token': result.resumeHandle.visualJobToken } }) });
  assert.equal(stream.status, 200); await stream.body.cancel(); assert.equal(f.calls(), 1);
});

test('free authenticated local-source route derives admission from session and ignores submitted old capabilities', async t => {
  const f = await fixture(t); const { seedSession } = await import('./helpers/journalFixtures.mjs');
  await f.db.prepare("UPDATE users SET subscription_tier = 'free' WHERE id = 'user-1'").run(); await seedSession(f.db);
  const localRoute = await import('../functions/api/reading-visual-retry.js');
  const cloudRoute = await import('../functions/api/journal/[id]/visual-retry.js');
  const request = new Request('https://test/api/tarot-reading/visual-retry', { method: 'POST', headers: { Cookie: 'session=session-1', 'Content-Type': 'application/json' },
    body: JSON.stringify({ savedSource: { ...SOURCE, readingResultId: 'old-private', visualJobToken: 'opaque', visualBinding: { owner: 'foreign' } }, admission: { scope: 'forged' } }) });
  const response = await localRoute.onRequestPost({ env: f.env, request }); assert.equal(response.status, 200);
  const data = await response.json(); assert.notEqual(data.resumeHandle.readingResultId, 'old-private'); await f.drain(); assert.equal(f.calls(), 1);
  assert.equal((await cloudRoute.onRequestPost({ env: f.env, params: { entryId: 'entry-1' }, request: new Request('https://test/cloud-retry', { method: 'POST', headers: { Cookie: 'session=session-1' } }) })).status, 403);
});

test('cold recovery before reservation never dispatches until another explicit retry POST', async t => {
  const f = await fixture(t); let first = true;
  const originalGet = f.env.READING_VISUAL_JOBS.get;
  f.env.READING_VISUAL_JOBS.get = id => { const stub = originalGet(id); return { fetch: async (url, options) => {
    if (first && String(url).endsWith('/replay-init')) { first = false; delete f.env.VISUAL_CUE_PROVIDER; }
    return stub.fetch(url, options);
  } }; };
  const result = await replay.retryLocalVisuals({ env: f.env, admission: f.admission, savedSource: SOURCE }); await f.drain();
  const item = f.jobs.get(result.resumeHandle.visualJobId); item.job = new ReadingVisualJob(item.state, f.env); await item.job.initialized;
  f.env.VISUAL_CUE_PROVIDER = 'workers-ai';
  await item.job.fetch(new Request('https://visual/snapshot', { headers: { 'X-Visual-Token': result.resumeHandle.visualJobToken } })); await f.drain();
  assert.equal(f.calls(), 0); assert.equal(f.db.rows('SELECT dispatch_status FROM visual_retry_claims')[0].dispatch_status, 'prepared');
  await replay.retryLocalVisuals({ env: f.env, admission: f.admission, savedSource: SOURCE }); await f.drain(); assert.equal(f.calls(), 1);
});

test('D1 replay commit before DO storage failure recovers accepted cues with zero extra calls', async t => {
  const f = await fixture(t, { response: { response: { proposals: [{ localAlias: 'literal', kind: 'literal', quote: SOURCE.raw,
    targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }] }] } } });
  const originalGet = f.env.READING_VISUAL_JOBS.get;
  f.env.READING_VISUAL_JOBS.get = id => {
    const stub = originalGet(id), item = f.jobs.get(id), put = item.state.storage.put;
    item.state.storage.put = async (key, value) => { if (value.status === 'complete') throw new Error('fake storage gap'); return put(key, value); };
    return stub;
  };
  const result = await replay.retryLocalVisuals({ env: f.env, admission: f.admission, savedSource: SOURCE }); await f.drain();
  const item = f.jobs.get(result.resumeHandle.visualJobId); item.state.storage.put = async () => {};
  const fresh = new ReadingVisualJob(item.state, f.env); await fresh.initialized; await f.drain();
  assert.equal(f.calls(), 1); assert.equal(fresh.status, 'complete'); assert.equal(fresh.ledger.cues.length, 1);
});

test('malformed proposal-only response exhausts replay without replacing accepted cached cues', async t => {
  const f = await fixture(t, { response: { response: { proposals: [{ kind: 'literal', quote: 'invented', targets: [] }] } } });
  const original = await seedFailedOriginal(f);
  await replay.retryJournalVisuals({ env: f.env, userId: 'user-1', entryId: 'entry-1' }); await f.drain();
  const state = await original.resultLib.loadJournalVisualState({ env: f.env, db: f.db, userId: 'user-1', entryId: 'entry-1' });
  assert.equal(f.calls(), 1); assert.equal(state.retryStatus, 'exhausted');
  assert.deepEqual(state.visualSnapshot.cueLedger.cues.map(c => c.id), original.ledger.cues.map(c => c.id));
});

test('older original DO response and capability cannot supersede a claimed replay', async t => {
  let finishOriginal, providerIndex = 0;
  const f = await fixture(t, { response: () => ++providerIndex === 1 ? new Promise(resolve => { finishOriginal = resolve; }) : { response: { proposals: [] } } });
  const { computeSourceFingerprint, attachJournalVisualResult } = await import('../functions/lib/readingVisualResults.js');
  const hashes = await computeSourceFingerprint(SOURCE), binding = { readingResultId: 'late-original', sourceRevision: 0,
    spreadHash: hashes.spreadHash, contextHash: hashes.contextHash, artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };
  const stub = f.env.READING_VISUAL_JOBS.get(binding.readingResultId);
  await stub.fetch('https://visual/init', { method: 'POST', body: JSON.stringify({ binding, ownerUserId: 'user-1', visualToken: 'old-token',
    validationContext: { cards: [{ index: 0, canonicalName: 'The Star' }] } }) });
  await stub.fetch('https://visual/observe', { method: 'POST', body: JSON.stringify({ binding, raw: SOURCE.raw, complete: true }) });
  while (!finishOriginal) await new Promise(resolve => setImmediate(resolve));
  await f.db.prepare("UPDATE reading_visual_results SET status = 'failed' WHERE id = 'late-original'").run();
  await attachJournalVisualResult({ db: f.db, userId: 'user-1', entryId: 'entry-1', readingResultId: binding.readingResultId });
  const replayResult = await replay.retryJournalVisuals({ env: f.env, userId: 'user-1', entryId: 'entry-1' });
  finishOriginal({ response: { proposals: [{ localAlias: 'old', kind: 'literal', quote: SOURCE.raw, targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }] }] } });
  await f.drain(); assert.equal(f.calls(), 2);
  const current = f.db.rows("SELECT * FROM reading_visual_results WHERE id = 'late-original'")[0];
  assert.equal(current.active_attempt_id, replayResult.resumeHandle.attemptId); assert.equal(current.status, 'complete');
  assert.equal(JSON.parse(current.ledger_json).cues.length, 0);
  assert.equal((await stub.fetch('https://visual/snapshot', { headers: { 'X-Visual-Token': 'old-token' } })).status, 410);
});

test('trusted explicit replay revocation is durable and blocks another dispatch', async t => {
  const f = await fixture(t); const r = await replay.retryLocalVisuals({ env: f.env, admission: f.admission, savedSource: SOURCE }); await f.drain();
  const job = f.jobs.get(r.resumeHandle.visualJobId).job;
  await job.fetch(new Request('https://visual/revoke', { method: 'POST' }));
  const next = await replay.retryLocalVisuals({ env: f.env, admission: f.admission, savedSource: SOURCE }); await f.drain();
  assert.equal(next.resumeHandle, null); assert.equal(f.calls(), 1); assert.equal(f.db.rows('SELECT retry_status FROM visual_retry_claims')[0].retry_status, 'revoked');
});

test('concurrent independent guest principals share an atomic aggregate cap', async t => {
  const f = await fixture(t); f.env.VISUAL_REPLAY_LIMITS = JSON.stringify({ rateLimit: 1, windowMs: 60000, totalLimit: 1 });
  f.env.VISUAL_REPLAY_TRUSTED_IDENTITY = { resolve: async () => 'same-trusted-edge' };
  const principals = await Promise.all(Array.from({ length: 4 }, () => replay.createVisualReplayAdmission({ env: f.env, request: new Request('https://test/retry') })));
  await Promise.all(principals.map((admission, index) => replay.retryLocalVisuals({ env: f.env, admission, savedSource: { ...SOURCE, raw: SOURCE.raw + ` ${index}` } })));
  await f.drain(); assert.equal(f.calls(), 1); assert.equal(f.db.rows('SELECT * FROM visual_retry_claims WHERE reserved_at IS NOT NULL').length, 1);
});

test('pre-dispatch hash failure preserves the durable slot for an explicit retry', async t => {
  const f = await fixture(t); const digest = crypto.subtle.digest.bind(crypto.subtle), own = Object.getOwnPropertyDescriptor(crypto.subtle, 'digest'); let failed = false;
  crypto.subtle.digest = (...args) => {
    if (!failed && [...f.jobs.values()].some(item => item.job.inFlightRequest?.preparing)) { failed = true; throw new Error('fake offline hash'); }
    return digest(...args);
  };
  try { await replay.retryLocalVisuals({ env: f.env, admission: f.admission, savedSource: SOURCE }); await f.drain(); }
  finally { if (own) Object.defineProperty(crypto.subtle, 'digest', own); else delete crypto.subtle.digest; }
  assert.equal(failed, true); assert.equal(f.calls(), 0); assert.equal(f.db.rows('SELECT dispatch_status FROM visual_retry_claims')[0].dispatch_status, 'prepared');
  await replay.retryLocalVisuals({ env: f.env, admission: f.admission, savedSource: SOURCE }); await f.drain(); assert.equal(f.calls(), 1);
});

test('configuration loss after admission reports unavailable while preserving cached cloud cues and unused slot', async t => {
  const f = await fixture(t); const original = await seedFailedOriginal(f), get = f.env.READING_VISUAL_JOBS.get;
  f.env.READING_VISUAL_JOBS.get = id => { const stub = get(id); return { fetch: (url, options) => {
    delete f.env.VISUAL_CUE_PROVIDER; return stub.fetch(url, options);
  } }; };
  await replay.retryJournalVisuals({ env: f.env, userId: 'user-1', entryId: 'entry-1' }); await f.drain();
  const state = await original.resultLib.loadJournalVisualState({ env: f.env, db: f.db, userId: 'user-1', entryId: 'entry-1' });
  assert.equal(state.retryStatus, 'unavailable'); assert.equal(f.calls(), 0);
  assert.equal(state.visualSnapshot.cues[0].id, original.ledger.cues[0].id);
  assert.equal(f.db.rows('SELECT dispatch_status FROM visual_retry_claims')[0].dispatch_status, 'prepared');
});

test('a foreign guessed sidecar ID never selects its private result as cloud replay authority', async t => {
  const f = await fixture(t); await seedUser(f.db, { id: 'foreign' });
  const { registerVisualResult, persistJournalVisualState, loadOwnedJournalVisualSource, fingerprintSavedVisualSource } = await import('../functions/lib/readingVisualResults.js');
  const binding = { readingResultId: 'foreign-private', sourceRevision: 0, spreadHash: '1'.repeat(64), contextHash: '2'.repeat(64), artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };
  await registerVisualResult({ db: f.db, userId: 'foreign', readingResultId: binding.readingResultId, binding });
  const before = f.db.rows("SELECT * FROM reading_visual_results WHERE id = 'foreign-private'")[0];
  const owned = await loadOwnedJournalVisualSource({ db: f.db, userId: 'user-1', entryId: 'entry-1' });
  await persistJournalVisualState({ db: f.db, userId: 'user-1', entryId: 'entry-1', sourceFingerprint: await fingerprintSavedVisualSource(owned),
    attachmentStatus: 'failed', reason: 'ownership-mismatch', readingResultId: 'foreign-private' });
  const result = await replay.retryJournalVisuals({ env: f.env, userId: 'user-1', entryId: 'entry-1' }); await f.drain();
  assert.equal(f.calls(), 1); assert.notEqual(result.resumeHandle.readingResultId, 'foreign-private');
  assert.deepEqual(f.db.rows("SELECT * FROM reading_visual_results WHERE id = 'foreign-private'")[0], before);
});

// Recovery no longer has dispatch/hash/issued-request phases: reconstruction is
// read-only. Retain races at the three real reconstruction boundaries below.
for (const boundary of ['already claimed', 'durable recovery read', 'recovery storage write']) {
  test(`superseded original cold recovery makes zero extra calls at ${boundary}`, async t => {
    const finishes = [];
    const f = await fixture(t, { response: () => finishes.length < 2 ? new Promise(resolve => finishes.push(resolve)) : { response: { proposals: [] } } });
    const lib = await import('../functions/lib/readingVisualResults.js');
    const hashes = await lib.computeSourceFingerprint(SOURCE), binding = { readingResultId: `cold-original-${boundary}`, sourceRevision: 0,
      spreadHash: hashes.spreadHash, contextHash: hashes.contextHash, artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };
    const original = f.env.READING_VISUAL_JOBS.get(binding.readingResultId);
    await original.fetch('https://visual/init', { method: 'POST', body: JSON.stringify({ binding, visualToken: 'original-cold-token', ownerUserId: 'user-1',
      validationContext: { cards: [{ index: 0, canonicalName: 'The Star' }], reflections: 'Overall: Hope' } }) });
    await original.fetch('https://visual/observe', { method: 'POST', body: JSON.stringify({ binding, raw: SOURCE.raw, complete: true }) });
    while (f.calls() < 1) await new Promise(resolve => setImmediate(resolve));
    await lib.attachJournalVisualResult({ db: f.db, userId: 'user-1', entryId: 'entry-1', readingResultId: binding.readingResultId });
    const item = f.jobs.get(binding.readingResultId), coldPending = [];
    let release, paused = false, cold;
    const gate = new Promise(resolve => { release = resolve; });
    const prepare = f.db.prepare.bind(f.db);
    const coldState = { ...item.state, waitUntil: promise => coldPending.push(promise), storage: { ...item.state.storage,
      put: async (key, value) => {
        if (!paused && boundary === 'recovery storage write' && !value.inFlightRequest) { paused = true; await gate; }
        return item.state.storage.put(key, value);
      } } };
    if (boundary === 'durable recovery read') f.db.prepare = sql => {
      const wrap = statement => new Proxy(statement, { get(object, key) {
        if (key === 'bind') return (...args) => wrap(object.bind(...args));
        if (key === 'first') return async (...args) => {
          const row = await object.first(...args);
          if (!paused && sql === 'SELECT * FROM reading_visual_results WHERE id = ?') { paused = true; await gate; }
          return row;
        };
        return Reflect.get(object, key);
      } }); return wrap(prepare(sql));
    };
    const claimReplay = async () => {
      await prepare("UPDATE journal_entries SET reflections_json = '{\"Overall\":\"Changed\"}' WHERE id = 'entry-1'").run();
      const result = await replay.retryJournalVisuals({ env: f.env, userId: 'user-1', entryId: 'entry-1' });
      while (f.calls() < 2) await new Promise(resolve => setImmediate(resolve));
      return result;
    };
    try {
      let result;
      if (boundary === 'already claimed') result = await claimReplay();
      cold = new ReadingVisualJob(coldState, f.env);
      if (boundary !== 'already claimed') {
        while (!paused) await new Promise(resolve => setImmediate(resolve));
        result = await claimReplay(); release();
      }
      await cold.initialized;
      while (coldPending.length) await Promise.all(coldPending.splice(0));
      assert.equal(f.calls(), 2, 'only the original call and explicitly authorized replay are invoked');
      assert.equal(cold.status, 'revoked'); assert.equal(cold.visualToken, null); assert.equal(cold.ledger, null);
      assert.equal(f.db.rows('SELECT active_attempt_id FROM reading_visual_results')[0].active_attempt_id, result.resumeHandle.attemptId);
      assert.equal((await cold.fetch(new Request('https://visual/snapshot', { headers: { 'X-Visual-Token': 'original-cold-token' } }))).status, 410);
    } finally {
      release(); f.db.prepare = prepare;
      for (const finish of finishes) finish({ response: { proposals: [] } });
      await f.drain(); while (coldPending.length) await Promise.all(coldPending.splice(0));
    }
  });
}

for (const phase of ['annotation source hash', 'issued request storage', 'spending admission']) {
  test(`reconstruction and polling never enter the former original dispatch phase: ${phase}`, async t => {
    let finishOriginal;
    const f = await fixture(t, { response: () => new Promise(resolve => { finishOriginal = resolve; }) });
    const lib = await import('../functions/lib/readingVisualResults.js');
    const hashes = await lib.computeSourceFingerprint(SOURCE), binding = {
      readingResultId: `read-only-original-${phase}`, sourceRevision: 0,
      spreadHash: hashes.spreadHash, contextHash: hashes.contextHash,
      artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1'
    };
    const original = f.env.READING_VISUAL_JOBS.get(binding.readingResultId);
    await original.fetch('https://visual/init', { method: 'POST', body: JSON.stringify({ binding,
      visualToken: 'original-read-only-token', ownerUserId: 'user-1', validationContext: {
        cards: [{ index: 0, canonicalName: 'The Star' }], reflections: 'Overall: Hope'
      } }) });
    await original.fetch('https://visual/observe', { method: 'POST', body: JSON.stringify({ binding, raw: SOURCE.raw, complete: true }) });
    while (!finishOriginal) await new Promise(resolve => setImmediate(resolve));
    const item = f.jobs.get(binding.readingResultId);
    const prepare = f.db.prepare.bind(f.db), digest = crypto.subtle.digest.bind(crypto.subtle);
    const ownDigest = Object.getOwnPropertyDescriptor(crypto.subtle, 'digest');
    let phaseEntries = 0, providerEntries = 0, scheduled = 0;
    const provider = f.env.AI.run;
    const trap = () => { phaseEntries++; throw new Error('Reconstruction cannot enter a dispatch phase'); };
    if (phase === 'annotation source hash') crypto.subtle.digest = (...args) => {
      if (new TextDecoder().decode(args[1]) === SOURCE.raw) trap();
      return digest(...args);
    };
    if (phase === 'spending admission') f.db.prepare = sql => {
      if (/INSERT INTO visual_initial_reservations/.test(sql)) trap();
      return prepare(sql);
    };
    f.env.AI.run = () => { providerEntries++; throw new Error('Read cannot invoke provider'); };
    const coldState = { ...item.state, waitUntil: () => { scheduled++; }, storage: { ...item.state.storage,
      put: async (key, value) => {
        if (phase === 'issued request storage' && value.inFlightRequest?.preparing === false) trap();
        return item.state.storage.put(key, value);
      } } };
    try {
      const cold = new ReadingVisualJob(coldState, f.env);
      await cold.initialized;
      assert.equal(cold.status, 'failed');
      for (const path of ['status', 'snapshot']) {
        assert.equal((await cold.fetch(new Request(`https://visual/${path}`, { headers: { 'X-Visual-Token': 'original-read-only-token' } }))).status, 200);
      }
      const stream = await cold.fetch(new Request('https://visual/stream', { headers: { 'X-Visual-Token': 'original-read-only-token' } }));
      assert.equal(stream.status, 200); await stream.body.cancel();
      assert.equal(phaseEntries, 0);
      assert.equal(providerEntries, 0);
      assert.equal(scheduled, 0);
      assert.equal(f.calls(), 1);
      assert.equal(f.db.rows('SELECT * FROM visual_initial_reservations').length, 1);
    } finally {
      f.db.prepare = prepare; f.env.AI.run = provider;
      if (ownDigest) Object.defineProperty(crypto.subtle, 'digest', ownDigest); else delete crypto.subtle.digest;
      finishOriginal({ response: { proposals: [] } }); await f.drain();
    }
  });
}

for (const { complete, linked, processed } of [{ complete: false, linked: true }, { complete: true, linked: true }, { complete: false, linked: false },
  { complete: false, linked: false, processed: true }]) test(`actual expired ${complete ? 'complete' : 'pending'} ${linked ? 'linked' : 'unlinked'} original cache ${processed ? 'after expiry service' : 'before expiry service'} is exposed through GET/list before replay`, async t => {
  const f = await fixture(t);
  const lib = await import('../functions/lib/readingVisualResults.js');
  const { applyVisualCueBatch, createVisualCueLedger } = await import('../shared/reading/visualCueLedger.js');
  const { hashVisualCueText } = await import('../shared/contracts/visualCueBatches.js');
  const { seedSession } = await import('./helpers/journalFixtures.mjs');
  await seedSession(f.db);
  const hashes = await lib.computeSourceFingerprint(SOURCE), binding = { readingResultId: 'expired-original-cache', sourceRevision: 0,
    spreadHash: hashes.spreadHash, contextHash: hashes.contextHash, artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };
  const expiresAt = Date.now() - 1000;
  await lib.registerVisualResult({ db: f.db, userId: 'user-1', readingResultId: binding.readingResultId, binding, expiresAt });
  await lib.updateVisualResultSource({ db: f.db, userId: 'user-1', readingResultId: binding.readingResultId, binding, raw: SOURCE.raw, complete: true });
  const accepted = await applyVisualCueBatch({ ledger: createVisualCueLedger(binding), issuedRequest: { binding, status: 'active', batchId: 'cached-before-expiry', requestSequence: 1,
    analyzedEnd: SOURCE.raw.length, analyzedHash: await hashVisualCueText(SOURCE.raw), baseLedgerRevision: 0 },
    response: { proposals: [{ localAlias: 'cached', kind: 'literal', quote: 'pours into a pool', targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }] }] },
    authoritativeRaw: SOURCE.raw, validationContext: { cards: [{ index: 0, canonicalName: 'The Star' }], getSupportedDetails: () => [{ id: 'pool-pour' }] } });
  assert.equal(accepted.ledger.cues.length, 1);
  await lib.commitVisualResult({ db: f.db, userId: 'user-1', readingResultId: binding.readingResultId, binding, expectedLedgerRevision: 0, ledger: accepted.ledger,
    status: complete ? 'complete' : 'running', finalRaw: SOURCE.raw });
  if (linked) await lib.attachJournalVisualResult({ db: f.db, userId: 'user-1', entryId: 'entry-1', readingResultId: binding.readingResultId });
  else {
    const durable = await lib.loadVisualResultState({ db: f.db, userId: 'user-1', readingResultId: binding.readingResultId });
    const publicSnapshot = Object.fromEntries(['readingResultId', 'binding', 'sourceRevision', 'ledgerRevision', 'status', 'finalRaw', 'cues', 'introductions', 'snapshot']
      .map(key => [key, durable[key]]));
    publicSnapshot.cueLedger = lib.publicVisualLedger(durable.cueLedger);
    const owned = await lib.loadOwnedJournalVisualSource({ db: f.db, userId: 'user-1', entryId: 'entry-1' });
    assert.equal((await lib.persistJournalVisualState({ db: f.db, userId: 'user-1', entryId: 'entry-1',
      sourceFingerprint: await lib.fingerprintSavedVisualSource(owned), attachmentStatus: 'failed', retryStatus: 'unavailable',
      reason: 'attachment-error', validatedSnapshot: publicSnapshot, readingResultId: binding.readingResultId })).ok, true);
  }
  assert.equal(f.db.rows('SELECT status FROM reading_visual_results')[0].status, complete ? 'complete' : 'running', 'expiry comes from the stored deadline without manually rewriting status');
  if (processed) {
    const before = await lib.loadJournalVisualState({ env: f.env, db: f.db, userId: 'user-1', entryId: 'entry-1' });
    assert.equal(before.attachmentStatus, 'expired'); assert.equal(before.retryStatus, 'available');
    await lib.expireVisualResult({ db: f.db, userId: 'user-1', readingResultId: binding.readingResultId });
    assert.equal(f.db.rows('SELECT status FROM reading_visual_results')[0].status, 'expired', 'actual original expiry service processes the registration');
    assert.equal(f.db.rows('SELECT * FROM journal_visual_links').length, 0);
    assert.equal(f.db.rows('SELECT narrative FROM journal_entries')[0].narrative, SOURCE.raw);
  }
  const getEntry = await import('../functions/api/journal/[id].js'), getList = await import('../functions/api/journal.js');
  const detail = await getEntry.onRequestGet({ env: f.env, params: { id: 'entry-1' }, request: new Request('https://test/api/journal/entry-1', { headers: { Cookie: 'session=session-1' } }) });
  const list = await getList.onRequestGet({ env: f.env, request: new Request('https://test/api/journal', { headers: { Cookie: 'session=session-1' } }) });
  assert.equal(detail.status, 200); assert.equal(list.status, 200);
  for (const entry of [(await detail.json()).entry, (await list.json()).entries[0]]) {
    assert.equal(entry.visualState.attachmentStatus, complete ? 'attached' : 'expired');
    assert.equal(entry.visualState.retryStatus, complete ? 'complete' : 'available');
    assert.equal(entry.visualState.visualSnapshot.cues[0].id, accepted.ledger.cues[0].id);
    assert.equal(entry.personalReading, SOURCE.raw);
  }
  assert.equal(f.jobs.size, 0, 'ordinary GET/list neither wakes original transport nor initializes replay');
  assert.equal(f.calls(), 0); assert.equal(f.db.rows('SELECT * FROM visual_retry_claims').length, 0);
  const result = await replay.retryJournalVisuals({ env: f.env, userId: 'user-1', entryId: 'entry-1' }); await f.drain();
  assert.equal(f.calls(), complete ? 0 : 1);
  if (complete) assert.equal(result.resumeHandle, null);
  else {
    assert.equal(result.resumeHandle.readingResultId, binding.readingResultId); assert.deepEqual(result.resumeHandle.visualBinding, binding);
    assert.notEqual(result.resumeHandle.visualJobId, binding.readingResultId);
    const state = await lib.loadJournalVisualState({ env: f.env, db: f.db, userId: 'user-1', entryId: 'entry-1' });
    assert.equal(state.retryStatus, 'complete'); assert.equal(state.visualSnapshot.cues[0].id, accepted.ledger.cues[0].id);
    const oldState = { storage: { get: async () => ({ binding, visualToken: 'expired-original-token', ownerUserId: 'user-1', ledger: accepted.ledger,
      authoritativeRaw: SOURCE.raw, status: 'running', isComplete: true, expiresAt }), put: async () => {} }, blockConcurrencyWhile: fn => fn(), waitUntil: p => assert.fail(`old expired transport scheduled work ${p}`) };
    const old = new ReadingVisualJob(oldState, f.env);
    assert.equal((await old.fetch(new Request('https://visual/snapshot', { headers: { 'X-Visual-Token': 'expired-original-token' } }))).status, 410);
    assert.equal(f.calls(), 1);
  }
});

test('saved full prose preserves pending original prefix recovery and a later cumulative commit', async t => {
  const finishes = [];
  const f = await fixture(t, { response: () => new Promise(resolve => finishes.push(resolve)) });
  const lib = await import('../functions/lib/readingVisualResults.js');
  const hashes = await lib.computeSourceFingerprint(SOURCE), binding = { readingResultId: 'saved-pending-prefix', sourceRevision: 0,
    spreadHash: hashes.spreadHash, contextHash: hashes.contextHash, artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };
  const original = f.env.READING_VISUAL_JOBS.get(binding.readingResultId), prefix = 'The Star ';
  await original.fetch('https://visual/init', { method: 'POST', body: JSON.stringify({ binding, visualToken: 'prefix-token', ownerUserId: 'user-1',
    validationContext: { cards: [{ index: 0, canonicalName: 'The Star' }], reflections: 'Overall: Hope' } }) });
  await original.fetch('https://visual/observe', { method: 'POST', body: JSON.stringify({ binding, raw: prefix, deliveredEventId: 1 }) });
  while (f.calls() < 1) await new Promise(resolve => setImmediate(resolve));
  try {
    const attached = await lib.attachJournalVisualResult({ db: f.db, userId: 'user-1', entryId: 'entry-1', readingResultId: binding.readingResultId });
    assert.equal(attached.attached, true); assert.equal(attached.status, 'pending');
    finishes[0]({ response: { proposals: [{ localAlias: 'identity', kind: 'identity', quote: 'The Star', targets: [{ spreadIndex: 0, detailIds: [] }] }] } });
    await f.drain();
    const before = await lib.loadVisualResultState({ db: f.db, userId: 'user-1', readingResultId: binding.readingResultId });
    assert.equal(before.observedRaw, prefix); assert.equal(before.cueLedger.cues.length, 1);
    assert.equal(f.db.rows('SELECT narrative FROM journal_entries')[0].narrative, SOURCE.raw);
    const item = f.jobs.get(binding.readingResultId);
    item.job = new ReadingVisualJob(item.state, f.env); await item.job.initialized; await f.drain();
    assert.equal(f.calls(), 1); assert.equal(item.job.status, 'running');
    assert.deepEqual(item.job.ledger.cues[0], before.cueLedger.cues[0]);
    await original.fetch('https://visual/observe', { method: 'POST', body: JSON.stringify({ binding, raw: SOURCE.raw, deliveredEventId: 2, complete: true }) });
    while (f.calls() < 2) await new Promise(resolve => setImmediate(resolve));
    finishes[1]({ response: { proposals: [{ localAlias: 'pool', kind: 'literal', quote: 'pours into a pool', targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }] }] } });
    await f.drain();
    const after = await lib.loadVisualResultState({ db: f.db, userId: 'user-1', readingResultId: binding.readingResultId });
    assert.equal(f.calls(), 2); assert.equal(after.status, 'complete'); assert.equal(after.cueLedger.cues.length, 2);
    assert.equal(after.cueLedger.receipts.length, 2); assert.equal(after.cueLedger.raw, SOURCE.raw);
    assert.deepEqual(after.cueLedger.cues[0], before.cueLedger.cues[0]);
    const saved = await lib.loadJournalVisualState({ env: f.env, db: f.db, userId: 'user-1', entryId: 'entry-1' });
    assert.equal(saved.attachmentStatus, 'attached'); assert.equal(saved.retryStatus, 'complete');
    assert.deepEqual(saved.visualSnapshot.cues.map(cue => cue.id), after.cueLedger.cues.map(cue => cue.id));
    assert.equal(f.db.rows('SELECT * FROM visual_retry_claims').length, 0);
    assert.equal(f.db.rows('SELECT narrative FROM journal_entries')[0].narrative, SOURCE.raw);
  } finally { for (const finish of finishes) finish({ response: { proposals: [] } }); await f.drain(); }
});

test('a prepared replay claim fences ordinary cold recovery before replay transport initialization', async t => {
  const finishes = [];
  const f = await fixture(t, { response: () => new Promise(resolve => finishes.push(resolve)) });
  const lib = await import('../functions/lib/readingVisualResults.js');
  const owned = await lib.loadOwnedJournalVisualSource({ db: f.db, userId: 'user-1', entryId: 'entry-1' });
  const hashes = await lib.computeSourceFingerprint(owned.source), binding = { readingResultId: 'prepared-claim-original', sourceRevision: 0,
    spreadHash: hashes.spreadHash, contextHash: hashes.contextHash, artworkEdition: owned.artworkEdition, catalogVersion: owned.catalogVersion };
  const stub = f.env.READING_VISUAL_JOBS.get(binding.readingResultId);
  await stub.fetch('https://visual/init', { method: 'POST', body: JSON.stringify({ binding, ownerUserId: 'user-1', visualToken: 'prepared-original-token',
    validationContext: { cards: [{ index: 0, canonicalName: 'The Star' }] } }) });
  await stub.fetch('https://visual/observe', { method: 'POST', body: JSON.stringify({ binding, raw: SOURCE.raw, complete: true }) });
  while (!finishes.length) await new Promise(resolve => setImmediate(resolve));
  await lib.attachJournalVisualResult({ db: f.db, userId: 'user-1', entryId: 'entry-1', readingResultId: binding.readingResultId });
  const state = await lib.loadJournalVisualState({ env: f.env, db: f.db, userId: 'user-1', entryId: 'entry-1' });
  const claim = await replay.claimVisualRetry({ db: f.db, admissionScope: f.admission.scope, sourceFingerprint: await lib.fingerprintSavedVisualSource(owned),
    entryId: 'entry-1', expectedStateVersion: state.stateVersion, admission: f.admission, owned, source: owned.source, binding, priorState: state });
  assert.ok(claim.attempt_id); assert.equal(claim.dispatch_status, 'prepared');
  assert.equal(f.db.rows('SELECT active_attempt_id FROM reading_visual_results')[0].active_attempt_id, null, 'DO init has not fenced the result column yet');
  const item = f.jobs.get(binding.readingResultId), background = [];
  const cold = new ReadingVisualJob({ ...item.state, waitUntil: promise => background.push(promise) }, f.env);
  try {
    await cold.initialized; while (background.length) await Promise.all(background.splice(0));
    assert.equal(f.calls(), 1); assert.equal(cold.status, 'revoked'); assert.equal(cold.visualToken, null);
    assert.equal(f.db.rows('SELECT dispatch_status FROM visual_retry_claims')[0].dispatch_status, 'prepared');
  } finally { for (const finish of finishes) finish({ response: { proposals: [] } }); await f.drain(); }
});
