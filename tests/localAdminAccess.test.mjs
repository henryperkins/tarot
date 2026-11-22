import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { isLocalAdminOrigin, isLocalAdminSession, onRequestGet, onRequestPost } from '../functions/api/admin/local-access.js';
import { onRequestGet as getStats, onRequestPost as postStats } from '../functions/api/admin/quality-stats.js';
import { ADMIN_FIXTURE_KEY, createAiConfigWorker } from './helpers/aiConfigWorker.mjs';
import { createD1 } from './helpers/d1Sqlite.mjs';

const proof = 'fixture-only-setup-proof';
const password = 'fixture admin password';
const nextPassword = 'fixture updated password';
const accessPath = '/api/admin/local-access';
const bindings = { AI_CONFIG_ENVIRONMENT: 'local', LOCAL_ADMIN_SETUP_TOKEN: proof };

test('local admin setup rejects hosted, forwarded and cross-origin requests before database access', async () => {
  for (const [url, env, peer] of [
    ['http://localhost' + accessPath, { AI_CONFIG_ENVIRONMENT: 'preview' }],
    ['https://web.example' + accessPath, bindings],
    ['http://127.0.0.1' + accessPath, bindings, '192.0.2.7']
  ]) {
    const request = new Request(url, { headers: peer ? { 'CF-Connecting-IP': peer } : {} });
    assert.equal(isLocalAdminOrigin(request, env), false);
    assert.deepEqual(await (await onRequestGet({ request, env })).json(), { available: false });
    assert.equal((await onRequestPost({ request, env })).status, 403);
  }
  for (const origin of [null, 'null', 'http://localhost:9999', 'https://other.example']) {
    const request = new Request('http://localhost:8787' + accessPath, { method: 'POST', headers: origin ? { Origin: origin } : {} });
    assert.equal((await onRequestPost({ request, env: bindings })).status, 403);
  }
  const unrelated = new Request('http://localhost/api/admin/archive', { headers: { Authorization: 'Bearer local_admin_' + '0'.repeat(64) } });
  assert.equal(await isLocalAdminSession(unrelated, bindings), false);
});

test('quality stats returns JSON when local session storage has not been migrated', async t => {
  const DB = await createD1({ throughMigration: '0041_ai_provider_connections.sql' });
  t.after(() => DB.sqlite.close());
  const env = { ...bindings, DB };
  for (const [method, handler, error] of [['GET', getStats, 'Failed to fetch quality stats'], ['POST', postStats, 'Action failed']]) {
    const request = new Request('http://localhost/api/admin/quality-stats', {
      method, headers: { Authorization: 'Bearer local_admin_' + '0'.repeat(64) }
    });
    const response = await handler({ request, env });
    assert.equal(response.status, 500);
    assert.equal(response.headers.get('Content-Type'), 'application/json');
    const body = await response.json();
    assert.equal(body.error, error);
    assert.match(body.message, /no such table: local_admin_sessions/);
  }
});

test('local password enrollment, login, rotation and logout use scoped, hashed sessions in D1', { timeout: 90000 }, async t => {
  const worker = await createAiConfigWorker({ bindings });
  t.after(() => worker.close());
  const url = worker.url + accessPath;
  const auth = token => token ? { Authorization: 'Bearer ' + token } : {};
  const post = (body, token) => fetch(url, { method: 'POST', headers: {
    Origin: worker.url, 'Content-Type': 'application/json', ...auth(token)
  }, body: JSON.stringify(body) });
  const overview = token => fetch(worker.url + '/api/admin/ai-configuration', { headers: auth(token) });
  assert.deepEqual(await (await fetch(url)).json(), { available: true, passwordConfigured: false });
  const nonce = 'ab'.repeat(32);
  const challenged = url + '?challenge=' + nonce;
  assert.equal((await fetch(url + '?challenge=wrong-length')).status, 400);
  assert.equal((await fetch(challenged, { headers: { Origin: 'https://other.example' } })).status, 403);
  assert.deepEqual(await (await fetch(challenged)).json(), {
    available: true, passwordConfigured: false,
    launchProof: createHmac('sha256', proof).update('tableu/local-admin/first-launch/v1:' + nonce).digest('hex')
  });
  const db = { prepare() { return { async first() { return null; } }; } };
  const emptySecret = await onRequestGet({ request: new Request(challenged), env: { ...bindings, LOCAL_ADMIN_SETUP_TOKEN: '', DB: db } });
  assert.deepEqual(await emptySecret.json(), { available: true, passwordConfigured: false });
  assert.equal((await post({ action: 'setup', password })).status, 401);
  assert.equal((await post({ action: 'setup', password, setupToken: 'incorrect' })).status, 401);
  assert.equal((await post({ action: 'setup', password: 'short', setupToken: proof })).status, 422);
  const setup = await Promise.all([
    post({ action: 'setup', password, setupToken: proof }), post({ action: 'setup', password }, ADMIN_FIXTURE_KEY)
  ]);
  assert.deepEqual(setup.map(res => res.status).sort(), [200, 409]);
  const { token } = await setup.find(res => res.ok).json();
  assert.deepEqual(await (await fetch(url)).json(), { available: true, passwordConfigured: true });
  assert.deepEqual(await (await fetch(challenged)).json(), { available: true, passwordConfigured: true });
  assert.equal((await post({ action: 'setup', password, setupToken: proof })).status, 409);
  assert.equal((await post({ action: 'login', password: 'wrong' })).status, 401);
  const signedIn = await (await post({ action: 'login', password })).json();
  assert.ok(signedIn.expiresAt > Date.now());
  assert.notEqual(signedIn.token, token);
  const catalog = await overview(signedIn.token);
  assert.equal(catalog.status, 200);
  const { features } = await catalog.json();
  const { policy, baseToken, revision } = features.find(feature => feature.id === 'readings');
  policy.primary.reasoningEffort = 'medium';
  const configUrl = worker.url + '/api/admin/ai-configuration';
  const save = credential => fetch(configUrl + '/features/readings', {
    method: 'PUT', headers: { ...auth(credential), 'Content-Type': 'application/json' },
    body: JSON.stringify({ policy, baseToken, baseRevision: revision, mutationId: 'local-password-save' })
  });
  assert.equal((await save(signedIn.token)).status, 200);
  assert.equal((await save(ADMIN_FIXTURE_KEY)).status, 200);
  const history = await fetch(configUrl + '/history?feature=readings', { headers: auth(signedIn.token) });
  assert.deepEqual((await history.json()).entries.map(entry => entry.actor), ['Local password session']);
  assert.equal((await fetch(configUrl + '/release-settings', { headers: auth(signedIn.token) })).status, 401);
  assert.equal((await fetch(worker.url + '/api/admin/quality-stats', { headers: auth(token) })).status, 200);
  const account = await worker.db.prepare('SELECT * FROM local_admin_access').first();
  assert.equal(account.password_hash.length, 64);
  assert.equal(account.salt.length, 32);
  assert.ok(!JSON.stringify(account).includes(password));
  const receipt = await worker.db.prepare('SELECT digest FROM local_admin_sessions').first();
  assert.equal(receipt.digest.length, 64);
  assert.notEqual(receipt.digest, token);
  assert.equal((await post({ action: 'change', password: nextPassword }, signedIn.token)).status, 401);
  const changed = await post({ action: 'change', currentPassword: password, password: nextPassword }, signedIn.token);
  assert.equal(changed.status, 200);
  const replacement = (await changed.json()).token;
  assert.equal((await overview(token)).status, 401);
  assert.equal((await overview(signedIn.token)).status, 401);
  assert.equal((await overview(replacement)).status, 200);
  assert.equal((await post({ action: 'login', password })).status, 401);
  assert.equal((await post({ action: 'logout' }, replacement)).status, 200);
  assert.equal((await overview(replacement)).status, 401);
  const expiring = (await (await post({ action: 'login', password: nextPassword })).json()).token;
  await worker.db.prepare('UPDATE local_admin_sessions SET expires_at=0').run();
  assert.equal((await overview(expiring)).status, 401);
  for (let i = 0; i < 10; i++) assert.equal((await post({ action: 'login', password })).status, 401);
  assert.equal((await post({ action: 'login', password: nextPassword })).status, 429);
  const adminReset = await post({ action: 'change', password }, ADMIN_FIXTURE_KEY);
  assert.equal(adminReset.status, 200);
  assert.equal((await post({ action: 'login', password })).status, 200);
});
