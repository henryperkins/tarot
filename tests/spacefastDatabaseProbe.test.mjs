import test from 'node:test';
import assert from 'node:assert/strict';
import { handleDatabaseProbe, DATABASE_PROBE_PATH } from '../spacefast/database/probe.js';
import { createMySqlD1 } from './spacefastDatabaseHarness.mjs';

const TOKEN = 'database-probe-test-token-32-characters';
function request(method = 'GET', token = TOKEN) {
  return new Request(`https://example.invalid${DATABASE_PROBE_PATH}`, { method, headers: { Authorization: `Bearer ${token}` } });
}
function env(db) { return { TABLEU_NATIVE_DB: db, TABLEU_RUNTIME_CANARY_ENABLED: 'true', TABLEU_RUNTIME_CANARY_TOKEN: TOKEN }; }

test('database probe requires explicit enablement, strong authentication and supported methods', async () => {
  const db = { prepare() { throw new Error('Unauthenticated probe must not reach database.'); } };
  const args = { request: request(), env: env(db), revision: 'test-build' };
  assert.equal((await handleDatabaseProbe({ ...args, env: { ...args.env, TABLEU_RUNTIME_CANARY_ENABLED: 'false' } })).status, 404);
  assert.equal((await handleDatabaseProbe({ ...args, env: { ...args.env, TABLEU_RUNTIME_CANARY_TOKEN: 'short' } })).status, 503);
  assert.equal((await handleDatabaseProbe({ ...args, request: request('GET', 'wrong') })).status, 401);
  const method = await handleDatabaseProbe({ ...args, request: request('DELETE') });
  assert.equal(method.status, 405);
  assert.equal(method.headers.get('Allow'), 'GET, POST');
});

test('read-only database probe rejects incompatible engines or pad-space schemas', async () => {
  const scenarios = [
    { version: '8.0.16', engine: 'MySQL Community Server', padding: 'NO PAD', collation: 'utf8mb4_0900_bin' },
    { version: '11.4.0-MariaDB', engine: 'MariaDB Server', padding: 'NO PAD', collation: 'utf8mb4_0900_bin' },
    { version: '8.4.0', engine: 'MySQL Community Server', padding: 'PAD SPACE', collation: 'utf8mb4_0900_bin' },
    { version: '8.4.0', engine: 'MySQL Community Server', padding: 'NO PAD', collation: 'utf8mb4_bin' }
  ];
  for (const scenario of scenarios) {
    const db = { batch() { throw new Error('GET must never execute a batch.'); }, prepare(sql) {
      assert.match(sql, /^SELECT\b/);
      return { async first() {
        if (sql.includes('VERSION()')) return scenario;
        if (sql.includes('INFORMATION_SCHEMA.COLLATIONS')) return { name: 'utf8mb4_0900_bin', padding: scenario.padding };
        return { engine: 'InnoDB', collation: scenario.collation };
      } };
    } };
    const response = await handleDatabaseProbe({ request: request(), env: env(db), revision: 'test-build' });
    assert.equal(response.status, 503, JSON.stringify(scenario));
    assert.equal((await response.json()).transactionVerified, false);
  }
});

const nativeEnabled = Boolean(process.env.TABLEU_TEST_MYSQL_PORT);
test('native database probe verifies actual MySQL metadata, connection affinity and rollback without retaining records', { skip: !nativeEnabled }, async t => {
  const native = await createMySqlD1();
  const revision = `probe-test-${crypto.randomUUID()}`;
  t.after(() => native.close());
  const readOnly = { ...native, prepare(sql) {
    assert.match(sql, /^SELECT\b/);
    return native.prepare(sql);
  } };
  const read = await handleDatabaseProbe({ request: request(), env: env(readOnly), revision });
  assert.equal(read.status, 200, JSON.stringify(await read.clone().json()));
  assert.equal((await read.json()).transactionVerified, false);
  const response = await handleDatabaseProbe({ request: request('POST'), env: env(native), revision });
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.transactionVerified, true);
  for (const value of Object.values(body.checks)) assert.equal(value, true);
  assert.equal((await native.prepare('SELECT COUNT(*) AS count FROM tableu_runtime_canaries WHERE revision = ?').bind(revision).first()).count, 0);
});

test('native database probe detects a nontransactional broker and removes its partial writes', { skip: !nativeEnabled }, async t => {
  const native = await createMySqlD1();
  const revision = `probe-broken-${crypto.randomUUID()}`;
  t.after(() => native.close());
  const broken = { ...native, async batch(statements) {
    const results = [];
    for (const statement of statements) results.push(await statement.all());
    return results;
  } };
  const response = await handleDatabaseProbe({ request: request('POST'), env: env(broken), revision });
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.transactionVerified, false);
  assert.equal(body.checks.batchRollback, false);
  assert.equal(body.checks.cleanup, true);
  assert.equal((await native.prepare('SELECT COUNT(*) AS count FROM tableu_runtime_canaries WHERE revision = ?').bind(revision).first()).count, 0);
  assert.doesNotMatch(JSON.stringify(body), /Duplicate entry|INSERT INTO|database-probe-test-token/);
});

test('native database probe rejects missing atomic quota metadata', { skip: !nativeEnabled }, async t => {
  const native = await createMySqlD1();
  const revision = `probe-meta-${crypto.randomUUID()}`;
  t.after(() => native.close());
  const incomplete = { ...native, async batch(statements) {
    const results = await native.batch(statements);
    delete results[0].meta.last_row_id;
    return results;
  } };
  const response = await handleDatabaseProbe({ request: request('POST'), env: env(incomplete), revision });
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.checks.lastRowId, false);
  assert.equal(body.checks.cleanup, true);
});
