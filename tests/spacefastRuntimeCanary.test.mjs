import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { handleRuntimeCanary, RUNTIME_CANARY_PATH } from '../spacefast/canary.js';
import { createMySqlD1 } from './spacefastDatabaseHarness.mjs';

const TOKEN = 'test-only-canary-token-long-enough';
const REVISION = 'test-exact-build-fingerprint';

function sqliteBinding(t) {
  const database = new DatabaseSync(':memory:');
  t.after(() => database.close());
  return {
    prepare(sql) {
      let values = [];
      const statement = {
        bind(...parameters) { values = parameters; return statement; },
        async first() { return database.prepare(sql).get(...values) ?? null; },
        async run() {
          if (sql.startsWith('CREATE TABLE')) {
            database.exec(`CREATE TABLE IF NOT EXISTS tableu_runtime_canaries (
              id TEXT PRIMARY KEY, revision TEXT NOT NULL, status TEXT NOT NULL,
              delay_ms INTEGER NOT NULL, started_at INTEGER NOT NULL, completed_at INTEGER,
              expires_at INTEGER NOT NULL)`);
            return { success: true, meta: { changes: 0 } };
          }
          const result = database.prepare(sql).run(...values);
          return { success: true, meta: { changes: Number(result.changes) } };
        }
      };
      return statement;
    }
  };
}

async function fixture(t) {
  const db = process.env.TABLEU_TEST_MYSQL_PORT ? await createMySqlD1() : sqliteBinding(t);
  const owned = [];
  if (process.env.TABLEU_TEST_MYSQL_PORT) t.after(async () => {
    for (const id of owned) await db.prepare('DELETE FROM tableu_runtime_canaries WHERE id = ?').bind(id).run();
    await db.close();
  });
  const env = { DB: db, TABLEU_RUNTIME_CANARY_ENABLED: 'true', TABLEU_RUNTIME_CANARY_TOKEN: TOKEN };
  const tasks = [];
  const ctx = { waitUntil(promise) { tasks.push(promise); } };
  let clock = Date.now();
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const options = {
    now: () => clock,
    sleep: async (duration) => { await held; clock += duration; }
  };
  async function call({ path = RUNTIME_CANARY_PATH, method = 'POST', headers = {}, environment = env,
    context = ctx, revision = REVISION, testOptions = options } = {}) {
    const response = await handleRuntimeCanary({
      request: new Request(`https://preview.example.invalid${path}`, {
        method, headers: { Authorization: `Bearer ${TOKEN}`, ...headers }
      }), env: environment, ctx: context, revision
    }, testOptions);
    if (response.status === 202) owned.push((await response.clone().json()).id);
    return response;
  }
  return { call, env, db, ctx, tasks, options, release, advance(milliseconds) { clock += milliseconds; } };
}

test('runtime canary is disabled by default and rejects missing/invalid authentication before DB access', async () => {
  const db = { prepare() { assert.fail('Unauthorized probe touched the database.'); } };
  const request = new Request(`https://preview.example.invalid${RUNTIME_CANARY_PATH}`, { method: 'POST' });
  assert.equal((await handleRuntimeCanary({ request, env: { DB: db }, ctx: {}, revision: REVISION })).status, 404);
  assert.equal((await handleRuntimeCanary({ request, env: {
    DB: db, TABLEU_RUNTIME_CANARY_ENABLED: 'true'
  }, ctx: {}, revision: REVISION })).status, 503);
  assert.equal((await handleRuntimeCanary({ request, env: {
    DB: db, TABLEU_RUNTIME_CANARY_ENABLED: 'true', TABLEU_RUNTIME_CANARY_TOKEN: TOKEN
  }, ctx: {}, revision: REVISION })).status, 401);
});

test('probe requires waitUntil, a build identity, a bounded >30-second delay and the right method', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.call({ context: {} })).status, 503);
  assert.equal((await f.call({ revision: '' })).status, 503);
  assert.equal((await f.call({ testOptions: { ...f.options, delayMs: 30000 } })).status, 503);
  assert.equal((await f.call({ testOptions: { ...f.options, delayMs: 65001 } })).status, 503);
  assert.equal((await f.call({ method: 'GET' })).status, 405);
  assert.equal(f.tasks.length, 0);
});

test('202 is returned while detached task is pending; later SQL observation records the lower bound', async (t) => {
  const f = await fixture(t);
  const response = await f.call();
  assert.equal(response.status, 202);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  const { id } = await response.json();
  const path = `${RUNTIME_CANARY_PATH}/${id}`;
  const pending = await (await f.call({ path, method: 'GET' })).json();
  assert.equal(pending.status, 'pending');
  assert.equal(pending.completedAfterDelay, false);
  assert.equal(pending.providerLifetimeVerified, false);
  f.release();
  await Promise.all(f.tasks);
  const complete = await (await f.call({ path, method: 'GET' })).json();
  assert.equal(complete.status, 'complete');
  assert.equal(complete.elapsedMs, 45000);
  assert.equal(complete.completedAfterDelay, true);
  assert.equal(complete.providerLifetimeVerified, false);
  const row = await f.db.prepare('SELECT * FROM tableu_runtime_canaries WHERE id = ?').bind(id).first();
  assert.doesNotMatch(JSON.stringify(row), new RegExp(TOKEN));
});

test('a canary outcome from another source/build cannot prove this build', async (t) => {
  const f = await fixture(t);
  const { id } = await (await f.call()).json();
  f.release();
  await Promise.all(f.tasks);
  assert.equal((await f.call({ path: `${RUNTIME_CANARY_PATH}/${id}`, method: 'GET', revision: 'another-build' })).status, 409);
});

test('failed background persistence remains inconclusive and expired observations are deleted', async (t) => {
  const f = await fixture(t);
  const { id } = await (await f.call({ testOptions: {
    ...f.options, sleep: async () => { throw new Error('Execution cancelled.'); }
  } })).json();
  await Promise.all(f.tasks);
  const path = `${RUNTIME_CANARY_PATH}/${id}`;
  const pending = await (await f.call({ path, method: 'GET' })).json();
  assert.equal(pending.status, 'pending');
  assert.equal(pending.completedAfterDelay, false);
  f.advance(3600001);
  assert.equal((await f.call({ path, method: 'GET' })).status, 410);
  assert.equal((await f.call({ path, method: 'GET' })).status, 404);
});
