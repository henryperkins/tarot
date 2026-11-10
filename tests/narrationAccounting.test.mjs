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

// These probes keep the real SQLite triggers and inject transport failures only
// at the D1 boundary, including a write whose acknowledgement was lost.
const { onRequestPost: narrate } = await import('../functions/api/tts.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const speechRequest = signal => new Request('https://example.test/api/tts', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ text: 'Synthetic lifecycle reading.' }), signal
});
function interceptRuns(DB, match, intercept) {
  const prepare = DB.prepare.bind(DB);
  DB.prepare = sql => {
    const statement = prepare(sql);
    if (!match(sql)) return statement;
    const bind = statement.bind.bind(statement);
    statement.bind = (...args) => {
      const bound = bind(...args);
      const run = bound.run.bind(bound);
      bound.run = () => intercept(run, sql, args);
      return bound;
    };
    return statement;
  };
  return () => { DB.prepare = prepare; };
}
for (const committed of [false, true]) for (const abort of [false, true]) {
  test(`uncertain admission ${committed ? 'after' : 'before'} commit, caller ${abort ? 'gone' : 'connected'}, releases only its candidate`, async () => {
    const DB = await createD1();
    const caller = new AbortController();
    const lifetimes = [];
    let inserts = 0;
    const restore = interceptRuns(DB, sql => sql.startsWith('INSERT INTO narration_requests'), async run => {
      inserts++;
      if (committed) await run();
      if (abort) caller.abort();
      throw new Error('Synthetic lost admission acknowledgement');
    });
    let calls = 0;
    const AI = { async run() { calls++; return new Response('audio').body; } };
    const response = await narrate({ request: speechRequest(caller.signal), env: { DB, AI }, waitUntil: p => lifetimes.push(p) });
    restore();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).errorCode, 'ACCOUNTING_UNAVAILABLE');
    assert.equal(calls, 0);
    assert.equal(inserts, 1);
    assert.equal(lifetimes.length, 1, 'protect admission before its first write');
    await Promise.all(lifetimes);
    assert.deepEqual(DB.rows('SELECT used, reserved FROM narration_monthly_usage'), [{ used: 0, reserved: 0 }]);
    const followup = await narrate({ request: speechRequest(), env: { DB, AI } });
    assert.equal(followup.status, 200);
  });
}

test('cancellation during committed but unreturned admission keeps its lifecycle until release', async () => {
  const DB = await createD1();
  const caller = new AbortController();
  const lifetime = [];
  let protectedAtInsert = false;
  interceptRuns(DB, sql => sql.startsWith('INSERT INTO narration_requests'), async run => {
    protectedAtInsert = lifetime.length === 1;
    const result = await run();
    caller.abort();
    await tick();
    return result;
  });
  let calls = 0;
  const response = await narrate({ request: speechRequest(caller.signal), env: { DB, AI: { run() { calls++; } } }, waitUntil: p => lifetime.push(p) });
  assert.equal(protectedAtInsert, true);
  assert.equal(response.status, 503);
  await Promise.all(lifetime);
  assert.equal(calls, 0);
  assert.deepEqual(DB.rows('SELECT used, reserved FROM narration_monthly_usage'), [{ used: 0, reserved: 0 }]);
});

for (const outcome of ['settled', 'released']) for (const committed of [false, true]) {
  test(`${outcome} retries the same outcome after ${committed ? 'committed' : 'uncommitted'} transient finalization failure`, async () => {
    const DB = await createD1();
    let attempts = 0;
    interceptRuns(DB, sql => sql.includes('WHERE id = ?') && sql.startsWith('UPDATE narration_requests'), async run => {
      attempts++;
      if (attempts === 1) {
        if (committed) await run();
        throw new Error('Synthetic finalization acknowledgement failure');
      }
      return run();
    });
    const AI = { async run() { if (outcome === 'released') throw new Error('Synthetic provider failure'); return new Response('audio').body; } };
    const lifecycle = [];
    const response = await narrate({ request: speechRequest(), env: { DB, AI }, waitUntil: p => lifecycle.push(p) });
    await response.arrayBuffer();
    await Promise.all(lifecycle);
    assert.equal(attempts, 2);
    assert.equal(response.status, outcome === 'settled' ? 200 : 503);
    assert.deepEqual(DB.rows('SELECT used, reserved FROM narration_monthly_usage'), [{ used: outcome === 'settled' ? 1 : 0, reserved: 0 }]);
    assert.deepEqual(DB.rows('SELECT state FROM narration_requests'), [{ state: outcome }]);
  });
}

test('permanent finalization failure is bounded, logs safe fields, and leaves the crash lease recoverable', async t => {
  const DB = await createD1();
  let attempts = 0;
  const restore = interceptRuns(DB, sql => sql.includes('WHERE id = ?') && sql.startsWith('UPDATE narration_requests'), async () => {
    attempts++;
    throw new Error('PRIVATE-UPSTREAM-AND-ACCOUNT-DETAILS');
  });
  const reported = t.mock.method(console, 'error', () => {});
  const AI = { async run() { throw new Error('PRIVATE-READING-FAILURE'); } };
  const lifetime = [];
  await narrate({ request: speechRequest(), env: { DB, AI }, waitUntil: p => lifetime.push(p) });
  await Promise.all(lifetime);
  assert.equal(attempts, 3);
  assert.deepEqual(DB.rows('SELECT used, reserved FROM narration_monthly_usage'), [{ used: 0, reserved: 1 }]);
  const safeLogs = JSON.stringify(reported.mock.calls.map(call => call.arguments));
  assert.match(safeLogs, /reservationId/);
  assert.match(safeLogs, /provider/);
  assert.match(safeLogs, /stage/);
  assert.doesNotMatch(safeLogs, /PRIVATE|Synthetic lifecycle|local-anonymous/);
  restore();
  const expires = DB.rows('SELECT expires_at, updated_at FROM narration_requests')[0];
  assert.equal(expires.expires_at - expires.updated_at, 180000);
  t.mock.method(Date, 'now', () => expires.expires_at + 1);
  const recovered = await narrate({ request: speechRequest(), env: { DB, AI: { run: async () => new Response('audio').body } } });
  assert.equal(recovered.status, 200);
  assert.deepEqual(DB.rows('SELECT used, reserved FROM narration_monthly_usage'), [{ used: 1, reserved: 0 }]);
});

test('failed acquisition cleanup cannot release another active reservation', async () => {
  const DB = await createD1();
  const pending = await limits.reserveNarration({ env: { DB }, request: speechRequest(), limits: allowance });
  interceptRuns(DB, sql => sql.startsWith('INSERT INTO narration_requests'), async () => { throw new Error('Uncertain insert without a commit'); });
  const response = await narrate({ request: speechRequest(), env: { DB, AI: { run() { assert.fail('must not synthesize'); } } } });
  assert.equal(response.status, 503);
  assert.deepEqual(DB.rows('SELECT id, state FROM narration_requests'), [{ id: pending.reservation.id, state: 'reserved' }]);
});
