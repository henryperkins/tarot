import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createVisualInitialAdmission, getVisualInitialLimits, getVisualInitialReadiness,
  prepareVisualInitialAdmission, reserveVisualInitialDispatch } from '../functions/lib/readingVisualAdmission.js';
import { registerVisualResult } from '../functions/lib/readingVisualResults.js';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser } from './helpers/journalFixtures.mjs';
import { withInitialVisualAdmission } from './helpers/visualInitialAdmissionFixtures.mjs';

const configured = { VISUAL_CUE_PROVIDER: 'workers-ai', VISUAL_CUE_MODEL: '@cf/controlled/model' };
const binding = id => ({ readingResultId: id, sourceRevision: 0,
  spreadHash: '1'.repeat(64), contextHash: '2'.repeat(64), artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' });

async function fixture(t, limits = {}) {
  const DB = await createD1(); t.after(() => DB.sqlite.close());
  const env = withInitialVisualAdmission({ ...configured, DB }, limits);
  const prepare = async (id, { userId = null, edge = 'same-edge', token = `${id}-private-token` } = {}) => {
    const scopeEnv = { ...env, VISUAL_INITIAL_TRUSTED_IDENTITY: { resolve: () => edge } };
    const sourceBinding = binding(id);
    assert.equal(await createVisualInitialAdmission({ env: scopeEnv, userId,
      readingResultId: id, visualToken: token, binding: sourceBinding }), true);
    assert.equal((await registerVisualResult({ db: DB, userId, readingResultId: id, binding: sourceBinding })).ok, true);
    return { env: scopeEnv, userId, binding: sourceBinding, visualToken: token };
  };
  return { env, DB, prepare };
}

test('initial spending configuration has no default allowance and pins the explicitly bounded model', () => {
  const env = withInitialVisualAdmission(configured);
  assert.ok(getVisualInitialLimits(env));
  for (const value of [undefined, '', 'invalid', '{}', 'null', '[]']) {
    assert.equal(getVisualInitialLimits({ ...env, VISUAL_INITIAL_LIMITS: value }), null);
  }
  for (const key of ['rateLimit', 'windowMs', 'totalLimit', 'globalRateLimit', 'globalTotalLimit',
    'maxDispatchCostMicrousd', 'scopeCostLimitMicrousd', 'globalCostLimitMicrousd']) {
    for (const value of [undefined, 0, -1, 0.5, '1', Number.MAX_SAFE_INTEGER + 1]) {
      assert.equal(getVisualInitialLimits(withInitialVisualAdmission(configured, { [key]: value })), null, `${key}=${value}`);
    }
  }
  for (const overrides of [{ provider: 'unapproved' }, { model: '@cf/new/model' }, { provider: '' }, { model: '' }]) {
    assert.equal(getVisualInitialLimits(withInitialVisualAdmission(configured, overrides)), null);
  }
  assert.equal(getVisualInitialLimits({ ...env, VISUAL_CUE_MODEL: '@cf/changed/model' }), null);
  assert.equal(getVisualInitialReadiness(env).ready, false, 'Durable storage is mandatory');
});

test('readiness only reads configuration and never reserves, hashes attribution or calls providers', () => {
  let touches = 0;
  const env = withInitialVisualAdmission({ ...configured,
    DB: { prepare() { touches++; throw new Error('Must not access storage'); } },
    AI: { run() { touches++; throw new Error('Must not infer'); } } });
  assert.deepEqual(getVisualInitialReadiness(env), { ready: true, reason: null });
  assert.equal(touches, 0);
});

test('initial attribution ignores asynchronous resolved/rejected values without recording a late scope', async () => {
  let storageCalls = 0;
  const env = withInitialVisualAdmission({ ...configured, DB: { prepare() { storageCalls++; } } });
  for (const resolve of [() => Promise.resolve('late-edge'), () => Promise.reject(new Error('Optional identity unavailable'))]) {
    env.VISUAL_INITIAL_TRUSTED_IDENTITY = { resolve };
    assert.equal(await prepareVisualInitialAdmission({ env }), null);
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(storageCalls, 0);
});

test('only trusted edge identity or a live authenticated owner can mint initial admission', async t => {
  const { env, DB } = await fixture(t);
  const params = { binding: binding('result'), readingResultId: 'result', visualToken: 'server-issued' };
  const noResolver = { ...env, VISUAL_INITIAL_TRUSTED_IDENTITY: undefined };
  const spoofedRequest = new Request('https://test.invalid', { headers: {
    'CF-Connecting-IP': 'forged', 'X-Forwarded-For': 'forged', Cookie: 'visual_replay_principal=forged'
  } });
  assert.equal(await createVisualInitialAdmission({ env: noResolver, request: spoofedRequest, ...params }), false);
  assert.equal(await createVisualInitialAdmission({ env: noResolver, userId: 'missing-user', ...params }), false);
  await seedUser(DB, { id: 'inactive-user', active: 0 });
  assert.equal(await createVisualInitialAdmission({ env: noResolver, userId: 'inactive-user', ...params }), false);
  await seedUser(DB, { id: 'live-user' });
  assert.equal(await createVisualInitialAdmission({ env: noResolver, userId: 'live-user', ...params }), true);
  const row = DB.rows('SELECT * FROM visual_initial_admissions')[0];
  assert.equal(row.user_id, 'live-user');
  assert.match(row.aggregate_scope, /^user:[a-f0-9]{64}$/);
  assert.ok(!row.aggregate_scope.includes('live-user'));
  assert.notEqual(row.token_hash, 'server-issued');
  assert.equal(await createVisualInitialAdmission({ env, ...params }), false, 'Repeated result IDs cannot change an admitted owner');
});

test('guests on a trusted edge share aggregate scope despite request/cookie/result churn', async t => {
  const { prepare, DB } = await fixture(t, { totalLimit: 1 });
  const first = await prepare('first');
  assert.equal(await reserveVisualInitialDispatch({ ...first, dispatchId: 'dispatch-1' }), true);
  await DB.prepare('DELETE FROM visual_initial_admissions WHERE reading_result_id = ?').bind('first').run();
  await DB.prepare('DELETE FROM reading_visual_results WHERE id = ?').bind('first').run();
  const second = await prepare('second');
  assert.equal(await reserveVisualInitialDispatch({ ...second, dispatchId: 'dispatch-2' }), false);
  assert.equal(DB.rows('SELECT * FROM visual_initial_reservations').length, 1);
});

test('authenticated identity is independent of edge churn and cannot borrow another owner admission', async t => {
  const { prepare, DB } = await fixture(t, { totalLimit: 1 });
  await seedUser(DB, { id: 'owner' }); await seedUser(DB, { id: 'other-owner' });
  const first = await prepare('owner-first', { userId: 'owner', edge: 'edge-one' });
  assert.equal(await reserveVisualInitialDispatch({ ...first, userId: 'other-owner', dispatchId: 'spoofed-owner' }), false);
  assert.equal(await reserveVisualInitialDispatch({ ...first, visualToken: 'forged', dispatchId: 'spoofed-token' }), false);
  assert.equal(await reserveVisualInitialDispatch({ ...first, dispatchId: 'owner-one' }), true);
  const second = await prepare('owner-second', { userId: 'owner', edge: 'edge-two' });
  assert.equal(await reserveVisualInitialDispatch({ ...second, dispatchId: 'owner-two' }), false);
  const other = await prepare('other-source', { userId: 'other-owner', edge: 'edge-one' });
  assert.equal(await reserveVisualInitialDispatch({ ...other, dispatchId: 'other-one' }), true);
});

test('concurrent original jobs atomically reserve one remaining scope allowance', async t => {
  const { prepare, DB } = await fixture(t, { rateLimit: 1 });
  const jobs = await Promise.all(Array.from({ length: 8 }, (_, index) => prepare(`job-${index}`)));
  const reserved = await Promise.all(jobs.map((job, index) => reserveVisualInitialDispatch({ ...job, dispatchId: `dispatch-${index}` })));
  assert.equal(reserved.filter(Boolean).length, 1);
  assert.equal(DB.rows('SELECT * FROM visual_initial_reservations').length, 1);
});

test('global count allowance remains atomic across distinct trusted identities', async t => {
  const { prepare, DB } = await fixture(t, { globalTotalLimit: 1 });
  const jobs = await Promise.all(Array.from({ length: 5 }, (_, index) => prepare(`global-${index}`, { edge: `edge-${index}` })));
  const reserved = await Promise.all(jobs.map((job, index) => reserveVisualInitialDispatch({ ...job, dispatchId: `global-call-${index}` })));
  assert.equal(reserved.filter(Boolean).length, 1);
  assert.equal(DB.rows('SELECT * FROM visual_initial_reservations').length, 1);
});

test('integer monetary ceilings fence scope and global dispatches independently of generous counts', async t => {
  const { prepare, DB } = await fixture(t, { maxDispatchCostMicrousd: 100,
    scopeCostLimitMicrousd: 150, globalCostLimitMicrousd: 250 });
  const first = await prepare('cost-one');
  assert.equal(await reserveVisualInitialDispatch({ ...first, dispatchId: 'cost-call-one' }), true);
  const same = await prepare('cost-same');
  assert.equal(await reserveVisualInitialDispatch({ ...same, dispatchId: 'cost-call-same' }), false);
  const other = await prepare('cost-other', { edge: 'different-edge' });
  assert.equal(await reserveVisualInitialDispatch({ ...other, dispatchId: 'cost-call-other' }), true);
  const third = await prepare('cost-third', { edge: 'third-edge' });
  assert.equal(await reserveVisualInitialDispatch({ ...third, dispatchId: 'cost-call-third' }), false);
  assert.equal(DB.rows('SELECT SUM(reserved_cost_microusd) AS cost FROM visual_initial_reservations')[0].cost, 200);
});

test('limits smaller than one conservative call fail without creating a reservation', async t => {
  const { prepare, DB } = await fixture(t, { scopeCostLimitMicrousd: 99 });
  const job = await prepare('zero-cost');
  assert.equal(await reserveVisualInitialDispatch({ ...job, dispatchId: 'zero-cost-call' }), false);
  assert.equal(DB.rows('SELECT * FROM visual_initial_reservations').length, 0);
});

test('changing the model after admission cannot use the old monetary authorization', async t => {
  const { prepare, DB } = await fixture(t);
  const job = await prepare('model-pinned');
  job.env.VISUAL_CUE_MODEL = '@cf/unapproved/new-model';
  assert.equal(await reserveVisualInitialDispatch({ ...job, dispatchId: 'unapproved-dispatch' }), false);
  assert.equal(DB.rows('SELECT * FROM visual_initial_reservations').length, 0);
});

test('duplicate dispatch IDs never grant a second invocation and revoked/expired admission cannot reserve', async t => {
  const { prepare, DB } = await fixture(t);
  const job = await prepare('duplicate');
  assert.equal(await reserveVisualInitialDispatch({ ...job, dispatchId: 'same-dispatch' }), true);
  assert.equal(await reserveVisualInitialDispatch({ ...job, dispatchId: 'same-dispatch' }), false);
  await DB.prepare('UPDATE visual_initial_admissions SET expires_at = 1').run();
  assert.equal(await reserveVisualInitialDispatch({ ...job, dispatchId: 'expired-dispatch' }), false);
  const revoked = await prepare('revoked');
  await DB.prepare('INSERT INTO visual_result_revocations VALUES (?, ?, ?)').bind('revoked', null, Date.now()).run();
  assert.equal(await reserveVisualInitialDispatch({ ...revoked, dispatchId: 'revoked-dispatch' }), false);
  assert.equal(DB.rows('SELECT * FROM visual_initial_reservations').length, 1);
});
