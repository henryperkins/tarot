import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpacefastDatabase, compileSpacefastSql } from '../spacefast/database/index.js';
import { incrementUsageCounter } from '../functions/lib/usageTracking.js';
import { reserveNarration, settleNarration, releaseNarration } from '../functions/lib/ttsLimits.js';
import { enforceRegistrationRateLimit } from '../functions/lib/mcp/registrationLimit.js';
import { reserveFeatureUsage, settleFeatureUsage } from '../functions/lib/featureUsage.js';
import { reserveFollowUpSlot } from '../functions/api/reading-followup.js';
import { createMySqlD1 } from './spacefastDatabaseHarness.mjs';
import { auditApplicationSql } from '../scripts/spacefast-database-audit.mjs';
import { verifySpacefastSchemaSources } from '../scripts/spacefast-database-migrations.mjs';

test('SQL compiler keeps literals and reorders only parameter references', () => {
  const original = `INSERT INTO usage_tracking (user_id, month, readings_count, created_at, updated_at)
    VALUES (?, ?, 1, ?, ?) ON CONFLICT(user_id, month) DO UPDATE SET
    readings_count = readings_count + 1, updated_at = excluded.updated_at WHERE readings_count < ?`;
  const plan = compileSpacefastSql(original);
  assert.match(plan.sql, /IF \( readings_count < \? , LAST_INSERT_ID/);
  assert.deepEqual(plan.parameters, [0, 1, 2, 3, 4]);
  assert.match(compileSpacefastSql("SELECT 'datetime(''now'') ON CONFLICT' AS sample").sql, /'datetime/);
  assert.throws(() => compileSpacefastSql('PRAGMA foreign_keys'), /Unsupported Spacefast SQL/);
  assert.throws(() => compileSpacefastSql('SELECT 1; DELETE FROM users'), /multiple statements/);
  assert.throws(() => compileSpacefastSql('INSERT INTO arbitrary (id) VALUES (?) ON CONFLICT(id) DO NOTHING'), /unreviewed conflict target/);
});

test('application SQL inventory is fully accounted for and migration sources match the native port', async () => {
  await verifySpacefastSchemaSources();
  const result = await auditApplicationSql();
  assert.deepEqual(result.unresolved, []);
  assert.deepEqual(result.failures, []);
  assert.ok(result.preparedCalls >= 241);
});

const nativeEnabled = Boolean(process.env.TABLEU_TEST_MYSQL_PORT);
test('native MySQL quotas, settlement, idempotency and registration remain atomic', { skip: !nativeEnabled }, async t => {
  const native = await createMySqlD1();
  const db = createSpacefastDatabase(native);
  const id = `sf-db-test-${crypto.randomUUID()}`;
  const month = '2099-01';
  const user = { id, subscription_tier: 'pro', subscription_status: 'active' };
  let registrationKey = null;
  await native.prepare('INSERT INTO users (id,email,username,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    .bind(id, `${id}@example.invalid`, id, 'test', 'test', 1, 1).run();
  t.after(async () => {
    if (registrationKey) await native.prepare('DELETE FROM oauth_registration_counters WHERE client_key = ?').bind(registrationKey).run();
    await native.prepare('DELETE FROM follow_up_usage WHERE user_id = ?').bind(id).run();
    await native.prepare('DELETE FROM feature_usage WHERE identity_key = ?').bind(`user:${id}`).run();
    await native.prepare('DELETE FROM narration_requests WHERE user_id = ?').bind(id).run();
    await native.prepare('DELETE FROM narration_monthly_usage WHERE identity = ?').bind(`user:${id}`).run();
    await native.prepare('DELETE FROM narration_request_limits WHERE identity = ?').bind(`user:${id}`).run();
    await native.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
    await native.close();
  });

  const increments = await Promise.all(Array.from({ length: 24 }, (_, index) => incrementUsageCounter(db, { userId: id, month, counter: 'readings', limit: 5, nowMs: index + 1 })));
  assert.equal(increments.reduce((sum, result) => sum + result.changed, 0), 5);
  assert.equal((await db.prepare('SELECT readings_count FROM usage_tracking WHERE user_id = ? AND month = ?').bind(id, month).first()).readings_count, 5);

  const request = new Request('https://example.invalid/api/tts');
  const simultaneous = await Promise.all(Array.from({ length: 12 }, () => reserveNarration({ env: { DB: db }, request, user, limits: { monthly: 2 } })));
  assert.equal(simultaneous.filter(result => result.allowed).length, 1);
  const reservation = simultaneous.find(result => result.allowed).reservation;
  await settleNarration({ DB: db }, reservation);
  await settleNarration({ DB: db }, reservation);
  let usage = await native.prepare('SELECT used,reserved FROM narration_monthly_usage WHERE identity = ?').bind(`user:${id}`).first();
  assert.deepEqual(usage, { used: 1, reserved: 0 });
  const second = await reserveNarration({ env: { DB: db }, request, user, limits: { monthly: 2 } });
  assert.equal(second.allowed, true);
  await releaseNarration({ DB: db }, second.reservation);
  usage = await native.prepare('SELECT used,reserved FROM narration_monthly_usage WHERE identity = ?').bind(`user:${id}`).first();
  assert.deepEqual(usage, { used: 1, reserved: 0 });
  const third = await reserveNarration({ env: { DB: db }, request, user, limits: { monthly: 2 } });
  await settleNarration({ DB: db }, third.reservation);
  const exhausted = await reserveNarration({ env: { DB: db }, request, user, limits: { monthly: 2 } });
  assert.equal(exhausted.allowed, false);
  assert.equal(exhausted.status, 429);

  const features = await Promise.all(Array.from({ length: 12 }, () => reserveFeatureUsage({ env: { DB: db }, request, user, feature: 'summary' })));
  assert.equal(features.filter(result => result.allowed).length, 1);
  assert.equal(features.filter(result => result.status === 429).length, 11);
  await settleFeatureUsage({ DB: db }, features.find(result => result.allowed).reservationId, { completed: true });

  const followups = await Promise.all(Array.from({ length: 12 }, (_, index) => reserveFollowUpSlot(db, { userId: id, requestId: `${id}-${index}`, readingIdentifier: `${id}-reading`, questionLength: 10, limits: { perReading: 3, perDay: 3 } })));
  assert.equal(followups.filter(result => result.reserved).length, 3);
  assert.deepEqual(followups.filter(result => result.reserved).map(result => result.turnNumber).sort(), [1, 2, 3]);

  const event = `evt-${id}`;
  const claims = await Promise.all(Array.from({ length: 8 }, () => db.prepare('INSERT OR IGNORE INTO processed_webhook_events (provider,event_id,event_type,processed_at) VALUES (?,?,?,?)').bind('stripe', event, 'test', 1).run()));
  assert.equal(claims.filter(result => result.meta.changes === 1).length, 1);
  await native.prepare('DELETE FROM processed_webhook_events WHERE event_id = ?').bind(event).run();

  // Stable private test address yields a unique identity without persisted IPs.
  const registration = new Request('https://example.invalid/oauth/register', { headers: { 'cf-connecting-ip': id } });
  const { getHashedClientIdentifier } = await import('../functions/lib/clientId.js');
  registrationKey = await getHashedClientIdentifier(registration);
  const admitted = await Promise.all(Array.from({ length: 18 }, () => enforceRegistrationRateLimit({ DB: db }, registration, { now: 4070908800000 })));
  assert.equal(admitted.filter(result => result === null).length, 10);
  assert.equal(admitted.filter(result => result?.status === 429).length, 8);
});

test('native no-pad comparisons and SQLite matched-row counts are preserved', { skip: !nativeEnabled }, async () => {
  const native = await createMySqlD1();
  const db = createSpacefastDatabase(native);
  const prefix = `sf-equality-${crypto.randomUUID()}`;
  const names = [`${prefix}:x`, `${prefix}:x `, `${prefix}:X`, `${prefix}:é`, `${prefix}:e\u0301`];
  try {
    for (const name of names) await native.prepare('INSERT INTO users (id,email,username,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(name, `${name}@invalid`, name, 'test', 'test', 1, 1).run();
    for (const name of names) {
      const { results } = await db.prepare('SELECT id FROM users WHERE id = ?').bind(name).all();
      assert.deepEqual(results, [{ id: name }]);
    }
    const unchanged = await db.prepare('UPDATE users SET updated_at = ? WHERE id = ?').bind(1, names[0]).run();
    assert.equal(unchanged.meta.changes, 1);
    const absent = await db.prepare('UPDATE users SET updated_at = ? WHERE id = ?').bind(1, `${prefix}:absent`).run();
    assert.equal(absent.meta.changes, 0);
    const executed = await db.exec('SELECT 1 AS one');
    assert.equal(executed.count, 0);
    assert.ok(executed.duration >= 0);
    await assert.rejects(db.exec('SELECT 1; SELECT 2'), /multiple statements/);
    const bulk = await db.prepare('DELETE FROM users WHERE id IN (?, ?, ?, ?, ?)').bind(...names).run();
    assert.equal(bulk.meta.changes, names.length);
  } finally {
    await native.prepare('DELETE FROM users WHERE id IN (?, ?, ?, ?, ?)').bind(...names).run();
    await native.close();
  }
});

test('native MySQL rejects ignored foreign-key failures and rolls back application batches', { skip: !nativeEnabled }, async () => {
  const native = await createMySqlD1();
  const db = createSpacefastDatabase(native);
  const id = `sf-invalid-${crypto.randomUUID()}`;
  try {
    await assert.rejects(db.prepare('INSERT OR IGNORE INTO user_memories (id,user_id,text,created_at) VALUES (?,?,?,?)').bind(id, id, 'memory', 1).run(), /foreign key/i);
    await assert.rejects(db.batch([
      db.prepare('INSERT OR IGNORE INTO processed_webhook_events (provider,event_id,event_type,processed_at) VALUES (?,?,?,?)').bind('stripe', id, 'test', 1),
      db.prepare('INSERT INTO sessions (id,user_id,created_at,expires_at,last_used_at) VALUES (?,?,?,?,?)').bind(id, id, 1, 2, 1)
    ]), /foreign key/i);
    assert.equal(await native.prepare('SELECT event_id FROM processed_webhook_events WHERE event_id = ?').bind(id).first(), null);
  } finally { await native.close(); }
});
