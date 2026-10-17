import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { KV_SCHEMA_SQL, cleanupExpiredKV, createDatabaseKV } from '../spacefast/bindings/kv.js';
import { createSpacefastBindings } from '../spacefast/bindings/index.js';
import { createMySqlD1 } from './spacefastDatabaseHarness.mjs';

describe('Spacefast binding construction', () => {
  it('retains the native database for every isolated KV namespace and existing email fallback', async () => {
    const namespaceValues = new Map();
    const nativeDB = { prepare(sql) {
      return { bind(namespace, key, value) {
        return { run: async () => { namespaceValues.set(`${namespace}:${key}`, value); return { success: true }; } };
      }, run: async () => ({ success: true }), sql };
    } };
    const bindings = createSpacefastBindings({ TABLEU_NATIVE_DB: nativeDB,
      DB: { prepare() { throw new Error('SQLite application adapter must not run KV SQL'); } }, RESEND_API_KEY: 'email-test' });
    for (const name of ['RATELIMIT', 'FEEDBACK_KV', 'METRICS_DB', 'OAUTH_KV']) {
      await bindings[name].put('one', name);
      assert.equal(namespaceValues.get(`${name}:one`), name);
    }
    assert.equal(bindings.EMAIL, undefined);
    assert.equal(bindings.AI, undefined);
    assert.equal(bindings.R2_LOGS, undefined);
  });

  it('retries schema initialization after a transient database failure', async () => {
    let creates = 0;
    const db = { prepare(sql) { return {
      bind() { return this; },
      async run() {
        if (sql === KV_SCHEMA_SQL && ++creates === 1) throw new Error('Temporarily unavailable');
        return { success: true };
      },
    }; } };
    const kv = createDatabaseKV(db, 'RATELIMIT');
    await assert.rejects(kv.put('key', 'value'), /Temporarily unavailable/);
    await kv.put('key', 'value');
    assert.equal(creates, 2);
  });
});

describe('Spacefast KV on native MySQL', { skip: !process.env.TABLEU_TEST_MYSQL_PORT }, () => {
  let db;
  let clockMs;
  let kv;
  before(async () => {
    const admin = await createMySqlD1();
    try { await admin.prepare('CREATE DATABASE IF NOT EXISTS tableu_bindings_test CHARACTER SET utf8mb4').run(); }
    finally { await admin.close(); }
    db = await createMySqlD1({ database: 'tableu_bindings_test' });
    await db.prepare(KV_SCHEMA_SQL).run();
  });
  beforeEach(async () => {
    await db.prepare('DELETE FROM tableu_kv').run();
    clockMs = 2_000_000;
    kv = createDatabaseKV(db, 'OAUTH_KV', { now: () => clockMs });
  });
  after(async () => { await db?.close(); });

  it('stores permanent OAuth clients and expires tokens exactly at their TTL', async () => {
    await kv.put('client:one', JSON.stringify({ clientId: 'one' }));
    await kv.put('token:one', JSON.stringify({ grantId: 'grant-1' }), { expirationTtl: 60 });
    assert.deepEqual(await kv.get('client:one', { type: 'json' }), { clientId: 'one' });
    clockMs += 59_999;
    assert.deepEqual(await kv.get('token:one', 'json'), { grantId: 'grant-1' });
    clockMs += 1;
    assert.equal(await kv.get('token:one'), null);
    assert.deepEqual((await kv.list()).keys.map(key => key.name), ['client:one']);
    assert.deepEqual(await kv.get('client:one', 'json'), { clientId: 'one' });
    assert.equal((await cleanupExpiredKV(db, { now: () => clockMs })).meta.changes, 1);
    assert.equal(await db.prepare('SELECT COUNT(*) AS total FROM tableu_kv').first('total'), 1);
  });

  it('preserves feedback metadata and clears old metadata/expiry when overwritten', async () => {
    await kv.put('feedback:one', '{"overallAccuracy":5}', { expiration: 2100, metadata: { requestId: 'reading-1', spreadKey: 'threeCard' } });
    assert.deepEqual(await kv.getWithMetadata('feedback:one', 'json'), {
      value: { overallAccuracy: 5 }, metadata: { requestId: 'reading-1', spreadKey: 'threeCard' }, cacheStatus: null,
    });
    assert.deepEqual((await kv.list()).keys, [{ name: 'feedback:one', expiration: 2100, metadata: { requestId: 'reading-1', spreadKey: 'threeCard' } }]);
    await kv.put('feedback:one', 'updated');
    clockMs = 2_200_000;
    assert.deepEqual(await kv.getWithMetadata('feedback:one'), { value: 'updated', metadata: null, cacheStatus: null });
    await kv.delete('feedback:one');
    assert.deepEqual(await kv.getWithMetadata('feedback:one'), { value: null, metadata: null, cacheStatus: null });
  });

  it('keeps namespaces and case-sensitive/trailing-space/Unicode keys distinct', async () => {
    const metrics = createDatabaseKV(db, 'METRICS_DB', { now: () => clockMs });
    for (const key of ['key', 'Key', 'key ', 'é', 'é']) await kv.put(key, key);
    await metrics.put('key', 'metric');
    for (const key of ['key', 'Key', 'key ', 'é', 'é']) assert.equal(await kv.get(key), key);
    assert.equal(await metrics.get('key'), 'metric');
    assert.equal((await kv.list()).keys.length, 5);
  });

  it('uses literal prefixes and key cursors without skipping records after deletion', async () => {
    for (const key of ['a%_\\:1', 'a%_\\:2', 'a%_\\:3', 'a-other', 'other']) await kv.put(key, 'value');
    const first = await kv.list({ prefix: 'a%_\\:', limit: 1 });
    assert.equal(first.list_complete, false);
    assert.deepEqual(first.keys.map(key => key.name), ['a%_\\:1']);
    await kv.delete(first.keys[0].name);
    const second = await kv.list({ prefix: 'a%_\\:', limit: 1, cursor: first.cursor });
    assert.deepEqual(second.keys.map(key => key.name), ['a%_\\:2']);
    const last = await kv.list({ prefix: 'a%_\\:', limit: 1, cursor: second.cursor });
    assert.deepEqual(last.keys.map(key => key.name), ['a%_\\:3']);
    assert.equal(last.list_complete, true);
    assert.equal(last.cursor, '');
    await assert.rejects(kv.list({ prefix: 'other', cursor: first.cursor }), /Invalid KV list cursor/);
    await assert.rejects(createDatabaseKV(db, 'METRICS_DB').list({ prefix: 'a%_\\:', cursor: first.cursor }), /Invalid KV list cursor/);
  });

  it('stores binary values without UTF-8 corruption and serves typed reads', async () => {
    const bytes = new Uint8Array([0, 255, 128, 10]);
    await kv.put('binary', bytes);
    assert.deepEqual(new Uint8Array(await kv.get('binary', 'arrayBuffer')), bytes);
    assert.deepEqual(new Uint8Array(await new Response(await kv.get('binary', 'stream')).arrayBuffer()), bytes);
    await kv.put('utf8', 'é');
    assert.deepEqual(new Uint8Array(await kv.get('utf8', 'arrayBuffer')), new TextEncoder().encode('é'));
    await assert.rejects(kv.get('binary', 'json'), SyntaxError);
  });

  it('rejects invalid key/value/expiry/options before persisting them', async () => {
    await assert.rejects(kv.put('é'.repeat(257), 'value'), /512 UTF-8 bytes/);
    await assert.rejects(kv.put('key', { unexpected: true }), /strings or binary/);
    await assert.rejects(kv.put('key', 'value', { expirationTtl: 0 }), /positive integer/);
    await assert.rejects(kv.put('key', 'value', { expiration: 2000 }), /future Unix timestamp/);
    await assert.rejects(kv.list({ limit: 1001 }), /1 through 1000/);
    await assert.rejects(kv.list({ cursor: 'not-json' }), /Invalid KV list cursor/);
    await assert.rejects(kv.get('key', 'unknown'), /Unsupported KV value type/);
    assert.equal((await kv.list()).keys.length, 0);
  });
});
