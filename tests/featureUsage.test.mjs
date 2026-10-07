import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { reserveFeatureUsage, settleFeatureUsage, resolveFeatureIdentity, readFeatureJsonBody } from '../functions/lib/featureUsage.js';

const user = { id: 'reader', subscription_tier: 'plus', subscription_status: 'active' };
const request = (ip = '192.0.2.10') => new Request('https://tableu.test', { headers: { 'CF-Connecting-IP': ip } });

test('guest identities are hashed and do not trust forwarded or user-agent headers', async () => {
  const identity = await resolveFeatureIdentity(request(), null);
  assert.match(identity, /^guest:[a-f0-9]{64}$/);
  assert.ok(!identity.includes('192.0.2.10'));
  assert.equal(await resolveFeatureIdentity(request(), user), 'user:reader');
  await assert.rejects(resolveFeatureIdentity(new Request('https://tableu.test', { headers: { 'X-Forwarded-For': '192.0.2.10' } }), null), /identity/);
});

test('atomic SQLite reservations allow only one concurrent request per identity and feature', async () => {
  const DB = await createD1();
  const env = { DB };
  const results = await Promise.all(Array.from({ length: 20 }, () => reserveFeatureUsage({ env, request: request(), user, feature: 'question' })));
  assert.equal(results.filter((result) => result.allowed).length, 1);
  assert.ok(results.filter((result) => !result.allowed).every((result) => result.status === 429 && result.payload.code === 'feature_busy'));
  const [active] = DB.rows("SELECT * FROM feature_usage WHERE state = 'reserved'");
  assert.equal(active.identity_key, 'user:reader');
});

test('daily exhaustion, feature isolation and idempotent failure release use real SQL', async () => {
  const DB = await createD1();
  const env = { DB, FEATURE_QUESTION_PLUS_DAILY_LIMIT: '2' };
  const args = { env, request: request(), user, feature: 'question' };
  const failed = await reserveFeatureUsage(args);
  await settleFeatureUsage(env, failed.reservationId, { completed: false });
  await settleFeatureUsage(env, failed.reservationId, { completed: false });
  for (let index = 0; index < 2; index++) {
    const result = await reserveFeatureUsage(args);
    assert.equal(result.allowed, true);
    await settleFeatureUsage(env, result.reservationId, { completed: true });
    await settleFeatureUsage(env, result.reservationId, { completed: false });
  }
  const exhausted = await reserveFeatureUsage(args);
  assert.equal(exhausted.status, 429);
  assert.equal(exhausted.payload.code, 'feature_daily_limit');
  const otherFeature = await reserveFeatureUsage({ ...args, feature: 'summary' });
  assert.equal(otherFeature.allowed, true);
  assert.equal(DB.rows("SELECT * FROM feature_usage WHERE state = 'completed'").length, 2);
});

test('daily final slot cannot be oversubscribed concurrently', async () => {
  const DB = await createD1();
  const env = { DB, FEATURE_VISION_FREE_DAILY_LIMIT: '1' };
  const args = { env, request: request(), feature: 'vision' };
  const results = await Promise.all(Array.from({ length: 10 }, () => reserveFeatureUsage(args)));
  const accepted = results.find((result) => result.allowed);
  assert.equal(results.filter((result) => result.allowed).length, 1);
  await settleFeatureUsage(env, accepted.reservationId, { completed: true });
  assert.equal((await reserveFeatureUsage(args)).payload.code, 'feature_daily_limit');
});

test('expired orphan is conservatively charged and releases active lock across UTC days', async () => {
  const DB = await createD1();
  const env = { DB, FEATURE_QUESTION_PLUS_DAILY_LIMIT: '1' };
  const old = Date.UTC(2026, 9, 7, 23, 59);
  const first = await reserveFeatureUsage({ env, request: request(), user, feature: 'question', nowMs: old });
  assert.equal(first.allowed, true);
  const blocked = await reserveFeatureUsage({ env, request: request(), user, feature: 'question', nowMs: old + 2 * 60000 });
  assert.equal(blocked.payload.code, 'feature_busy');
  const fresh = await reserveFeatureUsage({ env, request: request(), user, feature: 'question', nowMs: old + 16 * 60000 });
  assert.equal(fresh.allowed, true);
  assert.equal(DB.rows('SELECT state FROM feature_usage WHERE id = ?', [first.reservationId])[0].state, 'completed');
});

test('accounting fails closed when database is missing or unavailable', async () => {
  for (const env of [{}, { DB: { prepare() { throw new Error('private database error'); } } }]) {
    const result = await reserveFeatureUsage({ env, request: request(), user, feature: 'question' });
    assert.equal(result.allowed, false);
    assert.equal(result.status, 503);
    assert.equal(result.payload.code, 'feature_accounting_unavailable');
    assert.ok(!JSON.stringify(result).includes('private'));
  }
});

test('effective tiers and service users receive configured operational safeguards', async () => {
  const DB = await createD1();
  const env = { DB, FEATURE_QUESTION_PRO_DAILY_LIMIT: '1' };
  const service = { id: 'service:gpt', auth_provider: 'service', subscription_tier: 'pro', subscription_status: 'active' };
  const result = await reserveFeatureUsage({ env, request: request(), user: service, feature: 'question' });
  await settleFeatureUsage(env, result.reservationId, { completed: true });
  assert.equal((await reserveFeatureUsage({ env, request: request(), user: service, feature: 'question' })).payload.code, 'feature_daily_limit');
  const inactive = { ...user, subscription_tier: 'pro', subscription_status: 'canceled' };
  assert.equal((await reserveFeatureUsage({ env, request: request(), user: inactive, feature: 'question' })).status, 403);
});

test('bounded JSON reader refuses advertised and streamed overflow before buffering body', async () => {
  const advertised = new Request('https://tableu.test', { method: 'POST', body: '{}', headers: { 'Content-Length': '100' } });
  await assert.rejects(readFeatureJsonBody(advertised, 10), (error) => error.status === 413);
  const streamed = new Request('https://tableu.test', { method: 'POST', body: '{"value":"123456789"}' });
  await assert.rejects(readFeatureJsonBody(streamed, 10), (error) => error.status === 413);
  assert.deepEqual(await readFeatureJsonBody(new Request('https://tableu.test', { method: 'POST', body: '{"ok":true}' }), 30), { ok: true });
});

test('settlement storage failure keeps the slot locked until conservative orphan recovery', async () => {
  const DB = await createD1();
  const args = { env: { DB }, request: request(), user, feature: 'question' };
  const active = await reserveFeatureUsage(args);
  assert.equal(await settleFeatureUsage({ DB: { prepare() { throw new Error('offline'); } } }, active.reservationId, { completed: false }), false);
  assert.equal((await reserveFeatureUsage(args)).payload.code, 'feature_busy');
});

for (const [feature, tier, limit] of [
  ['vision', 'free', 5], ['vision', 'plus', 20], ['vision', 'pro', 100],
  ['question', 'plus', 30], ['question', 'pro', 100], ['summary', 'plus', 3], ['summary', 'pro', 10]
]) {
  test(`${feature} ${tier} default daily safeguard is ${limit}`, async () => {
    const DB = await createD1();
    const tierUser = { ...user, subscription_tier: tier };
    const day = new Date().toISOString().slice(0, 10);
    for (let index = 0; index < limit; index++) {
      await DB.prepare('INSERT INTO feature_usage (id, identity_key, feature, day_key, state, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(String(index), 'user:reader', feature, day, 'completed', Date.now(), Date.now()).run();
    }
    const exhausted = await reserveFeatureUsage({ env: { DB }, request: request(), user: tierUser, feature });
    assert.equal(exhausted.payload.code, 'feature_daily_limit');
    assert.equal(exhausted.payload.limit, limit);
  });
}

test('released daily attempts cannot reset the independent attempt budget', async () => {
  const env = { DB: await createD1(), FEATURE_SUMMARY_PLUS_DAILY_LIMIT: '1' };
  const base = Date.UTC(2026, 9, 7, 12);
  for (let index = 0; index < 3; index++) {
    const result = await reserveFeatureUsage({ env, request: request(), user, feature: 'summary', nowMs: base + index * 61000 });
    assert.equal(result.allowed, true);
    await settleFeatureUsage(env, result.reservationId, { completed: false });
    await settleFeatureUsage(env, result.reservationId, { completed: false });
  }
  assert.equal(env.DB.rows("SELECT * FROM feature_usage WHERE state = 'released'").length, 3);
  assert.equal(env.DB.rows("SELECT * FROM feature_usage WHERE state = 'completed'").length, 0);
  const result = await reserveFeatureUsage({ env, request: request(), user, feature: 'summary', nowMs: base + 4 * 61000 });
  assert.equal(result.payload.code, 'feature_attempt_daily_limit');
  assert.equal(result.status, 429);
});

test('attempt burst persists across refunds and expires after sixty seconds', async () => {
  const env = { DB: await createD1() };
  const base = Date.UTC(2026, 9, 7, 12);
  for (let index = 0; index < 5; index++) {
    const result = await reserveFeatureUsage({ env, request: request(), feature: 'vision', nowMs: base + index });
    await settleFeatureUsage(env, result.reservationId, { completed: false });
  }
  const blocked = await reserveFeatureUsage({ env, request: request(), feature: 'vision', nowMs: base + 10 });
  assert.equal(blocked.payload.code, 'feature_attempt_rate_limit');
  assert.equal(blocked.payload.resetAt, new Date(base + 60000).toISOString());
  assert.equal((await reserveFeatureUsage({ env, request: request(), feature: 'vision', nowMs: base + 60000 })).allowed, true);
});

test('the last independent daily attempt is atomic under concurrent admissions', async () => {
  const env = { DB: await createD1(), FEATURE_QUESTION_PLUS_DAILY_LIMIT: '1', FEATURE_QUESTION_PLUS_DAILY_ATTEMPT_LIMIT: '2' };
  const base = Date.UTC(2026, 9, 7, 12);
  const initial = await reserveFeatureUsage({ env, request: request(), user, feature: 'question', nowMs: base });
  await settleFeatureUsage(env, initial.reservationId, { completed: false });
  const burst = await Promise.all(Array.from({ length: 20 }, () => reserveFeatureUsage({ env, request: request(), user, feature: 'question', nowMs: base + 61000 })));
  const admitted = burst.filter((result) => result.allowed);
  assert.equal(admitted.length, 1);
  await settleFeatureUsage(env, admitted[0].reservationId, { completed: false });
  assert.equal((await reserveFeatureUsage({ env, request: request(), user, feature: 'question', nowMs: base + 122000 })).payload.code, 'feature_attempt_daily_limit');
});

test('attempt override cannot undercut daily allowance and retention removes only old settled rows', async () => {
  const env = { DB: await createD1(), FEATURE_QUESTION_PLUS_DAILY_LIMIT: '2', FEATURE_QUESTION_PLUS_DAILY_ATTEMPT_LIMIT: '1' };
  const base = Date.UTC(2026, 9, 7, 12);
  for (let index = 0; index < 2; index++) {
    const result = await reserveFeatureUsage({ env, request: request(), user, feature: 'question', nowMs: base + index * 61000 });
    assert.equal(result.allowed, true);
    await settleFeatureUsage(env, result.reservationId, { completed: false });
  }
  assert.equal((await reserveFeatureUsage({ env, request: request(), user, feature: 'question', nowMs: base + 122000 })).payload.code, 'feature_attempt_daily_limit');
  const next = await reserveFeatureUsage({ env, request: request(), user, feature: 'question', nowMs: base + 31 * 86400000 });
  assert.equal(next.allowed, true);
  assert.equal(env.DB.rows('SELECT * FROM feature_usage').length, 1);
});

test('minute attempt protection crosses UTC midnight while the daily allowance resets', async () => {
  const env = { DB: await createD1() };
  const base = Date.UTC(2026, 9, 7, 23, 59, 30);
  for (let index = 0; index < 5; index++) {
    const result = await reserveFeatureUsage({ env, request: request(), feature: 'vision', nowMs: base });
    await settleFeatureUsage(env, result.reservationId, { completed: false });
  }
  assert.equal((await reserveFeatureUsage({ env, request: request(), feature: 'vision', nowMs: base + 31000 })).payload.code, 'feature_attempt_rate_limit');
  assert.equal((await reserveFeatureUsage({ env, request: request(), feature: 'vision', nowMs: base + 60000 })).allowed, true);
});
