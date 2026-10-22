import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleScheduled } from '../functions/lib/scheduled.js';

function environment({ failures = [], reading = false } = {}) {
  const statements = [];
  const removed = [];
  const failing = (sql) => failures.some((fragment) => sql.includes(fragment));
  const db = {
    prepare(sql) {
      statements.push(sql);
      const statement = {
        bind() { return statement; },
        async run() {
          if (failing(sql)) throw new Error('Test database operation failed.');
          return { success: true, meta: { changes: 0 } };
        },
        async all() {
          if (failing(sql)) throw new Error('Test database query failed.');
          return { success: true, results: [] };
        }
      };
      return statement;
    }
  };
  const kv = {
    async list({ prefix }) {
      if (failures.includes(`list:${prefix}`)) throw new Error('Test KV list failed.');
      return { keys: reading && prefix === 'reading:' ? [{ name: 'reading:test' }] : [], list_complete: true };
    },
    async get() { return { provider: 'test' }; },
    async delete(key) {
      if (failures.includes('deleteKV')) throw new Error('Test KV delete failed.');
      removed.push(key);
    }
  };
  return { env: { DB: db, METRICS_DB: kv, FEEDBACK_KV: kv }, statements, removed };
}

function silence(t) {
  for (const method of ['log', 'warn', 'error']) t.mock.method(console, method, () => {});
}

test('retired video scheduling reports a skip without touching bindings', async (t) => {
  silence(t);
  const f = environment();
  f.env.METRICS_DB.list = async () => { throw new Error('KV unavailable.'); };
  const result = await handleScheduled({ cron: '*/10 * * * *' }, f.env, {}, { reportFailures: true });
  assert.equal(result.success, true);
  assert.equal(result.skipped, 'retired-video-schedule');
  assert.deepEqual(result.failedTasks, []);
  assert.equal(f.statements.length, 0, 'video-only scheduling must keep its early return');
});

test('Spacefast archival failure keeps source data and exposes failed task', async (t) => {
  silence(t);
  const f = environment({ reading: true, failures: ['INSERT OR REPLACE INTO metrics_archive'] });
  const result = await handleScheduled({ cron: '0 3 * * *' }, f.env, {}, { reportFailures: true });
  assert.equal(result.success, false);
  assert.deepEqual(result.failedTasks, ['metrics']);
  assert.equal(result.results.metrics.errors, 1);
  assert.deepEqual(f.removed, [], 'failed archival must never delete the source record');
});

test('Spacefast detects missing bindings, cleanup errors and archival summary failure', async (t) => {
  silence(t);
  const f = environment({ failures: ['DELETE FROM sessions', 'INSERT OR REPLACE INTO archival_summaries'] });
  delete f.env.FEEDBACK_KV;
  const result = await handleScheduled({ cron: '0 3 * * *' }, f.env, {}, { reportFailures: true });
  assert.equal(result.success, false);
  assert.deepEqual(new Set(result.failedTasks), new Set(['feedback', 'sessions', 'archivalSummary']));
});

test('Spacefast catches the nested memory-trim failure while continuing other cleanup', async (t) => {
  silence(t);
  const f = environment({ failures: ['SELECT user_id, COUNT(*) as cnt FROM user_memories'] });
  const result = await handleScheduled({ cron: '0 3 * * *' }, f.env, {}, { reportFailures: true });
  assert.equal(result.success, false);
  assert.deepEqual(result.failedTasks, ['memories']);
  assert.ok(f.statements.some(sql => sql.includes('DELETE FROM sessions')));
  assert.ok(f.statements.some(sql => sql.includes('INSERT OR REPLACE INTO archival_summaries')));
});

test('Spacefast successful maintenance reports success and existing Cloudflare callers keep best effort', async (t) => {
  silence(t);
  const healthy = environment({ reading: true });
  const result = await handleScheduled({ cron: '0 3 * * *' }, healthy.env, {}, { reportFailures: true });
  assert.equal(result.success, true);
  assert.deepEqual(result.failedTasks, []);
  assert.deepEqual(healthy.removed, ['reading:test']);
  const failing = environment({ reading: true, failures: ['DELETE FROM sessions'] });
  const legacy = await handleScheduled({ cron: '0 3 * * *' }, failing.env, {});
  assert.equal(legacy, undefined);
  assert.deepEqual(failing.removed, ['reading:test'], 'a cleanup failure must not skip independent archival');
});
