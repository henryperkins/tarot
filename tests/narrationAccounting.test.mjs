import assert from 'node:assert/strict';
import test from 'node:test';
import * as limits from '../functions/lib/ttsLimits.js';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { getMonthKeyUtc } from '../functions/lib/usageTracking.js';

const request = () => new Request('https://example.test/api/tts', { headers: { 'cf-connecting-ip': '192.0.2.20' } });
const allowance = { monthly: 3, premium: false };
async function reserve(DB, extra = {}) {
  assert.equal(typeof limits.reserveNarration, 'function', 'Narration uses an atomic reservation before synthesis');
  return limits.reserveNarration({ env: { DB }, request: request(), limits: allowance, ...extra });
}

test('concurrent guest requests allow only one active synthesis and hash the IP', async () => {
  const DB = await createD1();
  const results = await Promise.all([reserve(DB), reserve(DB)]);
  assert.equal(results.filter(result => result.allowed).length, 1);
  assert.equal(results.find(result => !result.allowed).payload.errorCode, 'NARRATION_BUSY');
  const [row] = DB.rows('SELECT * FROM narration_requests');
  assert.ok(row.identity.startsWith('guest:'));
  assert.ok(!JSON.stringify(row).includes('192.0.2.20'));
});

test('provider failure releases once and successful settlement preserves the monthly limit', async () => {
  const DB = await createD1();
  const first = await reserve(DB);
  await limits.releaseNarration({ DB }, first.reservation);
  await limits.releaseNarration({ DB }, first.reservation);
  assert.equal(DB.rows('SELECT used, reserved FROM narration_monthly_usage')[0].used, 0);
  for (let i = 0; i < 3; i++) {
    const next = await reserve(DB);
    assert.equal(next.allowed, true);
    await limits.settleNarration({ DB }, next.reservation);
    await limits.settleNarration({ DB }, next.reservation);
  }
  assert.deepEqual(DB.rows('SELECT used, reserved FROM narration_monthly_usage'), [{ used: 3, reserved: 0 }]);
  assert.equal((await reserve(DB)).payload.errorCode, 'TIER_LIMIT');
});

test('signed-in accounting seeds the existing counter and settles concurrent requests once', async () => {
  const DB = await createD1();
  await DB.prepare("INSERT INTO users (id, email, username, password_hash, password_salt, created_at, updated_at) VALUES ('narrator', 'narrator@example.test', 'narrator', 'unused', 'unused', 1, 1)").run();
  const month = getMonthKeyUtc();
  await DB.prepare('INSERT INTO usage_tracking (user_id, month, tts_count, created_at, updated_at) VALUES (?, ?, 2, 1, 1)').bind('narrator', month).run();
  const results = await Promise.all([reserve(DB, { user: { id: 'narrator' } }), reserve(DB, { user: { id: 'narrator' } })]);
  const accepted = results.find(result => result.allowed);
  assert.equal(results.filter(result => result.allowed).length, 1);
  await limits.settleNarration({ DB }, accepted.reservation);
  await limits.settleNarration({ DB }, accepted.reservation);
  assert.equal(DB.rows('SELECT tts_count FROM usage_tracking WHERE user_id = ?', ['narrator'])[0].tts_count, 3);
  assert.equal((await reserve(DB, { user: { id: 'narrator' } })).payload.errorCode, 'TIER_LIMIT');
});

test('unavailable accounting fails closed before paid inference', async () => {
  const result = await reserve(null);
  assert.equal(result.allowed, false);
  assert.equal(result.status, 503);
});
