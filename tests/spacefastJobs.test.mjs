import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { after, before, test } from 'node:test';
import { createReadingJobsNamespace } from '../spacefast/jobs/index.js';
import { ReadingJobsStore } from '../spacefast/jobs/store.js';
import { startReadingJob, getMcpJobSnapshot, cancelMcpJob } from '../functions/lib/readingJobs.js';
import { readingRunner } from './helpers/fakeReadingJobs.mjs';
import { SPREADS } from '../src/data/spreads.js';

const PAYLOAD = {
  spreadInfo: { name: SPREADS.single.name, key: 'single' },
  cardsInfo: [{ position: SPREADS.single.positions[0], card: 'The Star', orientation: 'Upright', meaning: 'Hope' }]
};
const ownedIds = new Set();
let nativePool = null;

// Run this same behavioral suite against MySQL with both test environment
// variables set. The SQLite default exercises real SQL CAS/restart behavior;
// its schema/INSERT shim is not evidence of MySQL dialect compatibility.
before(async () => {
  if (process.env.SPACEFAST_JOBS_TEST_MYSQL_URL) {
    const { createPool } = await import(process.env.SPACEFAST_JOBS_TEST_MYSQL_DRIVER || 'mysql2/promise');
    nativePool = createPool(process.env.SPACEFAST_JOBS_TEST_MYSQL_URL);
  }
});
after(async () => {
  if (nativePool) {
    for (const id of ownedIds) await nativePool.execute('DELETE FROM tableu_reading_jobs WHERE id = ?', [id]);
    await nativePool.end();
  }
});

function sqliteBinding(t) {
  const database = new DatabaseSync(':memory:');
  t.after(() => database.close());
  return {
    prepare(sql) {
      const schema = sql.startsWith('CREATE TABLE');
      const query = sql.replace('INSERT IGNORE', 'INSERT OR IGNORE');
      let values = [];
      const statement = {
        bind(...parameters) { values = parameters; return statement; },
        async first() { return database.prepare(query).get(...values) ?? null; },
        async run() {
          if (schema) {
            database.exec(`CREATE TABLE IF NOT EXISTS tableu_reading_jobs (
              id TEXT PRIMARY KEY, state_json TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0,
              status TEXT NOT NULL, lease_owner TEXT, lease_expires_at INTEGER,
              delete_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
            return { success: true, meta: { changes: 0 } };
          }
          const result = database.prepare(query).run(...values);
          return { success: true, meta: { changes: Number(result.changes) } };
        }
      };
      return statement;
    }
  };
}

function mysqlBinding() {
  return {
    prepare(sql) {
      let values = [];
      const statement = {
        bind(...parameters) { values = parameters; return statement; },
        async first() { const [rows] = await nativePool.execute(sql, values); return rows[0] ?? null; },
        async run() {
          const [result] = await nativePool.execute(sql, values);
          return { success: true, meta: { changes: result.affectedRows } };
        }
      };
      return statement;
    }
  };
}

function fixture(t, runReading = readingRunner(), options = {}) {
  const db = nativePool ? mysqlBinding() : sqliteBinding(t);
  const pending = new Set();
  const ctx = {
    waitUntil(promise) {
      const tracked = Promise.resolve(promise).finally(() => pending.delete(tracked));
      pending.add(tracked);
    }
  };
  const env = { TABLEU_NATIVE_DB: db };
  const defaults = { runReading, pollIntervalMs: 10, leaseMs: 2000, ...options };
  const namespace = () => createReadingJobsNamespace(env, ctx, defaults);
  env.READING_JOBS = namespace();
  return {
    env, db, ctx, namespace,
    async settle() { while (pending.size) await Promise.all([...pending]); },
    async start(parameters = {}) {
      const result = await startReadingJob({ env, payload: PAYLOAD, ...parameters });
      if (result.jobId) ownedIds.add(result.jobId);
      return result;
    }
  };
}

function call(namespace, { jobId, jobToken }, path = '/status', init = {}) {
  return namespace.get(namespace.idFromName(jobId)).fetch(`https://reading-jobs${path}`, {
    ...init, headers: { 'X-Job-Token': jobToken, ...init.headers }
  });
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function until(predicate) {
  for (let count = 0; count < 100; count += 1) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail('Condition did not become true.');
}

test('SQL state survives a new namespace and keeps forwarded credentials out of persistence', async (t) => {
  const calls = [];
  const f = fixture(t, readingRunner({ calls, reading: 'A persistent reading.' }));
  const started = await f.start({ forwardHeaders: { authorization: 'Bearer private-app-token', cookie: 'session=private-session' } });
  assert.equal(started.ok, true);
  await f.settle();
  const response = await call(f.namespace(), started);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.status, 'complete');
  assert.equal(data.result.reading, 'A persistent reading.');
  assert.equal(calls[0].request.headers.get('Authorization'), 'Bearer private-app-token');
  const row = await f.env.READING_JOBS.store.read(started.jobId);
  assert.equal(row.leaseOwner, null);
  assert.doesNotMatch(JSON.stringify(row), /private-app-token|private-session/);
});

test('principal ownership survives restart and remains hidden from public routes', async (t) => {
  const calls = [];
  const f = fixture(t, readingRunner({ calls }));
  const started = await f.start({
    principal: { userId: 'owner-1' }, snapshot: { cards: ['The Star'] },
    forwardHeaders: { authorization: 'Bearer private-mcp-token', cookie: 'session=private-mcp-session' }
  });
  await f.settle();
  const env = { ...f.env, READING_JOBS: f.namespace() };
  const owner = await getMcpJobSnapshot({ env, jobId: started.jobId, userId: 'owner-1' });
  assert.equal(owner.data.status, 'complete');
  assert.deepEqual(owner.data.snapshot, { cards: ['The Star'] });
  assert.deepEqual(owner.data.meta.themes, { dominantSuit: 'Cups' });
  assert.deepEqual(calls[0].principal, { userId: 'owner-1' });
  assert.equal(calls[0].request.headers.get('Authorization'), null);
  assert.equal(calls[0].request.headers.get('Cookie'), null);
  const wrong = await getMcpJobSnapshot({ env, jobId: started.jobId, userId: 'other' });
  assert.equal(wrong.status, 404);
  for (const path of ['/status', '/stream', '/cancel']) {
    assert.equal((await call(env.READING_JOBS, started, path, path === '/cancel' ? { method: 'POST' } : {})).status, 404);
  }
  assert.deepEqual(await cancelMcpJob({ env, jobId: started.jobId, userId: 'owner-1' }), {
    ok: true, data: { status: 'complete' }
  });
});

test('concurrent starts across namespaces admit one runner and reject another token', async (t) => {
  const ready = deferred();
  const calls = [];
  const f = fixture(t, async (context) => {
    calls.push(context);
    await ready.promise;
    return readingRunner()(context);
  });
  const jobId = crypto.randomUUID();
  ownedIds.add(jobId);
  const started = { jobId, jobToken: 'one-token' };
  const init = { method: 'POST', body: JSON.stringify({ payload: PAYLOAD, jobId }) };
  const responses = await Promise.all([
    call(f.namespace(), started, '/start', init), call(f.namespace(), started, '/start', init)
  ]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  await until(() => calls.length === 1);
  assert.equal((await call(f.namespace(), { ...started, jobToken: 'other-token' }, '/start', init)).status, 403);
  ready.resolve();
  await f.settle();
  assert.equal(calls.length, 1);
});

test('missing waitUntil fails before admitting a job', async (t) => {
  const f = fixture(t);
  const namespace = createReadingJobsNamespace(f.env, {});
  const jobId = crypto.randomUUID();
  const response = await call(namespace, { jobId, jobToken: 'token' }, '/start', {
    method: 'POST', body: JSON.stringify({ payload: PAYLOAD, jobId })
  });
  assert.equal(response.status, 503);
  assert.equal(await namespace.store.read(jobId), null);
});

test('cross-isolate cancellation is durable and fences a late provider completion', async (t) => {
  const ready = deferred();
  const calls = [];
  const f = fixture(t, async (context) => {
    calls.push(context);
    await ready.promise; // Deliberately ignore the provider AbortSignal.
    return readingRunner({ reading: 'A result that must not replace cancellation.' })(context);
  });
  const started = await f.start();
  await until(() => calls.length === 1);
  const response = await call(f.namespace(), started, '/cancel', { method: 'POST' });
  assert.deepEqual(await response.json(), { status: 'cancelled' });
  await until(() => calls[0].request.signal.aborted);
  ready.resolve();
  await f.settle();
  const status = await (await call(f.namespace(), started)).json();
  assert.equal(status.status, 'error');
  assert.equal(status.error, 'Reading cancelled.');
  assert.equal(status.result, null);
  const replay = await call(f.namespace(), started, '/stream');
  assert.match(await replay.text(), /Reading cancelled/);
});

test('cancellation before the admitted background task starts prevents provider work', async (t) => {
  const calls = [];
  const db = nativePool ? mysqlBinding() : sqliteBinding(t);
  const store = new ReadingJobsStore(db);
  const insert = store.insert.bind(store);
  const f = fixture(t, readingRunner({ calls }), { store });
  store.insert = async (id, state, ...parameters) => {
    const admitted = await insert(id, state, ...parameters);
    if (admitted) {
      await call(f.namespace(), { jobId: id, jobToken: state.job.token }, '/cancel', { method: 'POST' });
    }
    return admitted;
  };
  const started = await f.start();
  await f.settle();
  assert.equal(calls.length, 0);
  assert.equal((await (await call(f.namespace(), started)).json()).error, 'Reading cancelled.');
});

test('cancellation wakes a blocked SSE response even when upstream ignores AbortSignal', async (t) => {
  let upstreamCancelled = false;
  const f = fixture(t, async () => new Response(new ReadableStream({
    cancel() { upstreamCancelled = true; }
  }), { headers: { 'Content-Type': 'text/event-stream' } }));
  const started = await f.start();
  await call(f.namespace(), started, '/cancel', { method: 'POST' });
  await f.settle();
  assert.equal(upstreamCancelled, true);
  assert.equal((await (await call(f.namespace(), started)).json()).error, 'Reading cancelled.');
});

test('lost runner lease reports an interruption without rerunning or accepting late writes', async (t) => {
  const ready = deferred();
  const calls = [];
  let clock = Date.now();
  const f = fixture(t, async (context) => {
    calls.push(context);
    await ready.promise;
    return readingRunner()(context);
  }, { now: () => clock });
  const started = await f.start();
  await until(() => calls.length === 1);
  clock += 3000;
  const status = await (await call(f.namespace(), started)).json();
  assert.equal(status.status, 'error');
  assert.match(status.error, /Reading interrupted/);
  ready.resolve();
  await f.settle();
  assert.equal(calls.length, 1);
  assert.match((await (await call(f.namespace(), started)).json()).error, /Reading interrupted/);
});

test('an active lease cannot complete after absolute job expiry or extend its retention', async (t) => {
  const ready = deferred();
  const calls = [];
  let clock = Date.now();
  const f = fixture(t, async (context) => {
    calls.push(context);
    await ready.promise;
    return readingRunner({ reading: 'Too late to retain.' })(context);
  }, { now: () => clock });
  const started = await f.start();
  await until(() => calls.length === 1);
  const original = await f.env.READING_JOBS.store.read(started.jobId);
  // Represent a lease renewed immediately before the job's absolute expiry.
  // The runner still owns it, but expiry must independently fence the write.
  await f.db.prepare('UPDATE tableu_reading_jobs SET lease_expires_at = ? WHERE id = ?')
    .bind(original.deleteAt + 2000, started.jobId).run();
  clock = original.deleteAt + 1;
  ready.resolve();
  await f.settle();
  const retained = await f.env.READING_JOBS.store.read(started.jobId);
  assert.equal(retained.status, 'running', 'late completion must not persist');
  assert.equal(retained.state.job.result, null);
  assert.equal(retained.deleteAt, original.deleteAt, 'late completion must not move the expiry');
  assert.equal((await call(f.namespace(), started)).status, 410);
  assert.equal(await f.env.READING_JOBS.store.read(started.jobId), null);
});

test('SSE polling crosses namespaces and restores metadata after a persisted cursor', async (t) => {
  let source;
  const f = fixture(t, async () => new Response(new ReadableStream({
    start(controller) { source = controller; }
  }), { headers: { 'Content-Type': 'text/event-stream' } }));
  const started = await f.start();
  await until(() => Boolean(source));
  const live = await call(f.namespace(), started, '/stream');
  const text = live.text();
  const encoder = new TextEncoder();
  for (const [event, data] of [
    ['meta', { provider: 'test', sourceUsage: { spreadCards: { used: true } } }],
    ['delta', { text: 'Partial text.' }],
    ['done', { fullText: 'Complete text.' }]
  ]) source.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  source.close();
  await f.settle();
  assert.match(await text, /event: done/);
  const replay = await call(f.namespace(), started, '/stream?cursor=2');
  const replayed = await replay.text();
  assert.match(replayed, /event: meta/);
  assert.match(replayed, /event: done/);
  assert.doesNotMatch(replayed, /event: delta/);
  assert.match(replayed, /sourceUsage/);
});

test('bounded event replay keeps metadata and a full text snapshot after truncation', async (t) => {
  const encoder = new TextEncoder();
  const delta = 'x';
  const f = fixture(t, async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('event: meta\ndata: {"provider":"test"}\n\n'));
      for (let count = 0; count < 400; count += 1) {
        controller.enqueue(encoder.encode(`event: delta\ndata: {"text":"${delta}"}\n\n`));
      }
      controller.enqueue(encoder.encode(`event: done\ndata: {"fullText":"${delta.repeat(400)}"}\n\n`));
      controller.close();
    }
  }), { headers: { 'Content-Type': 'text/event-stream' } }));
  const started = await f.start();
  await f.settle();
  const row = await f.env.READING_JOBS.store.read(started.jobId);
  assert.equal(row.state.events.length, 300);
  assert.equal(row.state.events[0].event, 'meta');
  assert.ok(row.state.truncatedBeforeId > 0);
  const replay = await (await call(f.namespace(), started, '/stream?cursor=1')).text();
  assert.match(replay, /event: snapshot/);
  assert.match(replay, /event: meta/);
  assert.match(replay, /event: done/);
});

test('expired authorized jobs return 410 then disappear; maintenance removes unread expired jobs', async (t) => {
  let clock = Date.now();
  const f = fixture(t, readingRunner(), { now: () => clock });
  const started = await f.start();
  await f.settle();
  const row = await f.env.READING_JOBS.store.read(started.jobId);
  clock = row.deleteAt + 1;
  assert.equal((await call(f.namespace(), { ...started, jobToken: 'wrong' })).status, 403);
  assert.equal((await call(f.namespace(), started)).status, 410);
  assert.equal((await call(f.namespace(), started)).status, 404);
  const unread = await f.start();
  await f.settle();
  const unreadRow = await f.env.READING_JOBS.store.read(unread.jobId);
  clock = unreadRow.deleteAt + 1;
  assert.ok(await f.namespace().cleanupExpired() >= 1);
  assert.equal(await f.env.READING_JOBS.store.read(unread.jobId), null);
});

test('failure to persist completion stops the runner and becomes an interruption', async (t) => {
  let clock = Date.now();
  const db = nativePool ? mysqlBinding() : sqliteBinding(t);
  const store = new ReadingJobsStore(db);
  store.saveOwned = async () => { throw new Error('Storage unavailable.'); };
  const f = fixture(t, readingRunner(), { store, now: () => clock });
  const started = await f.start();
  await f.settle();
  clock += 3000;
  const status = await (await call(f.namespace(), started)).json();
  assert.equal(status.status, 'error');
  assert.match(status.error, /Reading interrupted/);
  assert.equal(status.result, null);
});

test('restart and SSE replay retain visual source identity while keeping transport capabilities private', async t => {
  const f = fixture(t, readingRunner({ reading: 'The Star offers hope.' }));
  const jobId = crypto.randomUUID();
  ownedIds.add(jobId);
  const started = { jobId, jobToken: 'offline-reading-token' };
  const visualBinding = { readingResultId: crypto.randomUUID(), sourceRevision: 0,
    spreadHash: 'a'.repeat(64), contextHash: 'b'.repeat(64), artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };
  const visualInit = { binding: visualBinding, visualToken: 'private-initial-token', ownerUserId: null };
  const response = await call(f.env.READING_JOBS, started, '/start', { method: 'POST', body: JSON.stringify({
    jobId, payload: PAYLOAD, readingResultId: visualBinding.readingResultId, visualBinding,
    visualJobToken: 'private-visual-token', visualInit
  }) });
  assert.equal(response.status, 200);
  await f.settle();
  const row = await f.namespace().store.read(jobId);
  assert.deepEqual(row.state.visualBinding, visualBinding);
  assert.equal(row.state.readingResultId, visualBinding.readingResultId);
  assert.equal(row.state.visualJobToken, 'private-visual-token');
  assert.deepEqual(row.state.visualInit, visualInit);
  const replay = await (await call(f.namespace(), started, '/stream')).text();
  assert.ok(replay.includes(visualBinding.readingResultId));
  assert.doesNotMatch(replay, /private-visual-token|private-initial-token|offline-reading-token/);
});

test('MCP error codes survive persistence and a new namespace', async t => {
  const f = fixture(t, async () => Response.json({ error: 'Account inactive.', code: 'account_inactive' }, { status: 403 }));
  const started = await f.start({ principal: { userId: 'owner-error' } });
  await f.settle();
  const result = await getMcpJobSnapshot({ env: { ...f.env, READING_JOBS: f.namespace() }, jobId: started.jobId, userId: 'owner-error' });
  assert.equal(result.data.status, 'error');
  assert.equal(result.data.errorCode, 'account_inactive');
});
