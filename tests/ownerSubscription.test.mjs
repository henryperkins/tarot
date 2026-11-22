import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createAiConfigWorker, ADMIN_FIXTURE_KEY } from './helpers/aiConfigWorker.mjs';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { changeOwnerLink, readOwnerLink, resolveOwnerSubscriptionEnv } from '../functions/lib/ownerSubscription.js';
import { ownerGatewayToken } from '../shared/contracts/ownerSubscriptionHost.js';
import { READING_CONFIG_FIXTURE } from '../shared/contracts/aiConfigSample.js';
import { OwnerSubscriptionSamples } from '../src/worker/ownerSubscriptionSamples.js';

const alice = { id: 'reader-a', sessionId: 'session-a' };
const bob = { id: 'reader-b', sessionId: 'session-b' };
const codex = 'codex-subscription';
const claude = 'claude-code';
const hostBindings = {
  AI_CONFIG_ENABLED: 'true',
  AI_CONFIG_ENVIRONMENT: 'local',
  LOCAL_OWNER_HOST_SECRET: 'a'.repeat(64),
  OWNER_HOST_INSTANCE: crypto.randomUUID(),
  OWNER_HOST_CODEX_URL: 'http://127.0.0.1:12881',
  OWNER_HOST_CLAUDE_URL: 'http://127.0.0.1:12882'
};

async function addReader(db, { id, sessionId }, authProvider = 'password') {
  await db.batch([
    db.prepare('INSERT INTO users (id,email,username,password_hash,password_salt,created_at,updated_at,auth_provider) VALUES (?,?,?,\'x\',\'y\',1,1,?)')
      .bind(id, id + '@example.com', id, authProvider),
    db.prepare('INSERT INTO sessions (id,user_id,created_at,expires_at,last_used_at) VALUES (?,?,1,?,1)')
      .bind(sessionId, id, Math.floor(Date.now() / 1000) + 3600)
  ]);
}

test('concurrent owner claims, session scope and account revocation', async () => {
  const db = await createD1();
  const env = { ...hostBindings, DB: db };
  await addReader(db, alice);
  await addReader(db, bob);
  const outcomes = await Promise.allSettled([alice, bob].map(reader =>
    changeOwnerLink(db, reader, { baseRevision: 0, providerId: codex })));
  assert.equal(outcomes.filter(o => o.status === 'fulfilled').length, 1);
  const row = await readOwnerLink(db);
  const [owner, other] = row.owner_id === alice.id ? [alice, bob] : [bob, alice];
  const resolved = await resolveOwnerSubscriptionEnv(env, owner);
  assert.equal(resolved.TEXT_PROVIDER, codex);
  assert.equal(resolved.CODEX_SUBSCRIPTION_OWNER_USER_ID, owner.id);
  assert.equal(resolved.CODEX_SUBSCRIPTION_GATEWAY_URL, env.OWNER_HOST_CODEX_URL);
  for (const user of [null, other, { id: owner.id }, { ...owner, auth_provider: 'service' }, { ...owner, auth_provider: 'api_key' }]) {
    assert.equal(await resolveOwnerSubscriptionEnv(env, user), env);
  }
  await assert.rejects(resolveOwnerSubscriptionEnv({ ...env, OWNER_HOST_INSTANCE: undefined }, owner), { code: 'owner_gateway_unavailable' });
  await assert.rejects(changeOwnerLink(db, other, { baseRevision: 1, providerId: null }), { code: 'owner_required' });
  await db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').bind(owner.id).run();
  assert.deepEqual(await readOwnerLink(db), { revision: 2, owner_id: null, provider_id: null });
  await changeOwnerLink(db, other, { baseRevision: 2, providerId: claude });
  await db.prepare('DELETE FROM users WHERE id = ?').bind(other.id).run();
  assert.deepEqual(await readOwnerLink(db), { revision: 4, owner_id: null, provider_id: null });
});

test('durable alarm fails an interrupted dispatch and rejects a revoked queued sample', async () => {
  const db = await createD1();
  const storage = {
    sql: { exec(query, ...params) {
      const result = db.rows(query, params);
      return { toArray: () => result };
    } },
    setAlarm: async () => {}
  };
  const job = new OwnerSubscriptionSamples({ storage }, { AI_CONFIG_ENABLED: true, AI_CONFIG_ENVIRONMENT: 'local', DB: db });
  const expires = Date.now() + 30000;
  const add = 'INSERT INTO owner_samples (id,owner,revision,provider,status,expires) VALUES (?,?,1,?,?,?)';
  db.rows(add, ['interrupted', alice.id, codex, 'dispatching', expires]);
  db.rows(add, ['revoked', alice.id, claude, 'queued', expires]);
  await job.alarm();
  await job.alarm();
  const rows = db.rows('SELECT id,status,details FROM owner_samples ORDER BY id');
  assert.deepEqual(rows.map(r => r.status), ['failed', 'failed']);
  assert.match(JSON.parse(rows[0].details).reason, /interrupted/);
  assert.match(JSON.parse(rows[1].details).reason, /link changed/);
});

test('local owner API authenticates both identities, runs a fixed sample and isolates receipts', async t => {
  const calls = [];
  let ready = true;
  let failed = false;
  const worker = await createAiConfigWorker({
    bindings: hostBindings,
    ownerGatewayStub: async (request, provider) => {
      const bearer = await ownerGatewayToken(hostBindings.LOCAL_OWNER_HOST_SECRET, hostBindings.OWNER_HOST_INSTANCE, provider);
      assert.equal(request.headers.get('Authorization'), 'Bearer ' + bearer);
      if (request.method === 'GET') return Response.json({ provider, ready, reason: 'login_required' });
      calls.push({ provider, body: await request.json() });
      if (failed) return new Response('internal diagnostics must stay private', { status: 500 });
      return Response.json({ provider, model: provider + '-fixture', modelSource: provider === codex ? 'configured' : 'reported',
        text: 'A synthetic reading using the three drawn cards.', usage: {} });
    }
  });
  t.after(() => worker.close());
  await addReader(worker.db, alice);
  await addReader(worker.db, bob);
  await addReader(worker.db, { id: 'service-principal', sessionId: 'service-session' }, 'service');
  const base = worker.url + '/api/admin/ai-configuration/owner-subscription';
  async function request(path = '', method = 'GET', data, headers = {}) {
    const res = await fetch(base + path, {
      method, headers: { Cookie: 'session=' + alice.sessionId, Authorization: 'Bearer ' + ADMIN_FIXTURE_KEY,
        'Content-Type': 'application/json', Origin: worker.url, ...headers }, body: JSON.stringify(data)
    });
    return { status: res.status, data: await res.json() };
  }
  const put = (providerId, baseRevision, headers) => request('', 'PUT', { providerId, baseRevision }, headers);
  const start = (runId, baseRevision, headers) => request('/samples', 'POST', { runId, baseRevision }, headers);
  async function receipt(runId) {
    const until = Date.now() + 15000;
    while (Date.now() < until) {
      const result = await request('/samples/' + runId);
      assert.equal(result.status, 200, JSON.stringify(result));
      if (result.data.status !== 'running') return result.data;
      await delay(100);
    }
    assert.fail('Owner sample did not finish within the fixture deadline');
  }
  assert.equal((await request('', 'GET', undefined, { Authorization: '' })).status, 401);
  for (const Cookie of ['', 'session=invalid', 'session=service-session', 'session=session-a; session=session-b']) {
    assert.equal((await request('', 'GET', undefined, { Cookie })).data.code, 'reader_sign_in_required');
  }
  assert.equal((await put(codex, 0, { Origin: 'https://example.com' })).status, 403);
  assert.equal((await request('', 'PUT', { providerId: codex, baseRevision: 0, ownerId: bob.id })).status, 422);
  assert.equal((await request('', 'PUT', { providerId: 'x'.repeat(2080), baseRevision: 0 })).status, 413);
  assert.equal((await put('openai-native', 0)).status, 422);
  const saved = await put(codex, 0);
  assert.equal(saved.status, 200, JSON.stringify(saved));
  assert.deepEqual(saved.data.link, { revision: 1, providerId: codex, ownedByReader: true });
  assert.ok(saved.data.providers.every(p => p.configured));
  assert.equal((await put(claude, 0)).status, 409);
  const other = { Cookie: 'session=' + bob.sessionId };
  const foreign = await request('', 'GET', undefined, other);
  assert.equal(foreign.data.editable, false);
  assert.equal(foreign.data.link.providerId, null);
  assert.deepEqual(foreign.data.providers, []);
  assert.ok(!JSON.stringify(foreign.data).includes(alice.id));
  assert.equal((await put(null, 1, other)).status, 403);
  const codexRun = crypto.randomUUID();
  assert.equal((await start(codexRun, 1, other)).status, 403);
  assert.equal((await request('/samples', 'POST', { runId: codexRun, baseRevision: 1, prompt: 'custom input' })).status, 422);
  assert.equal((await start(codexRun, 1)).status, 202);
  assert.equal((await start(codexRun, 1)).status, 202);
  const result = await receipt(codexRun);
  assert.deepEqual(result, { runId: codexRun, providerId: codex, status: 'completed', model: codex + '-fixture',
    modelSource: 'configured', excerpt: 'A synthetic reading using the three drawn cards.' });
  assert.equal((await request('/samples/' + codexRun, 'GET', undefined, other)).status, 403);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].provider, codex);
  const message = calls[0].body.messages[0].content;
  for (const expected of [READING_CONFIG_FIXTURE.question, ...READING_CONFIG_FIXTURE.cards]) assert.ok(message.includes(expected));
  assert.deepEqual(Object.keys(calls[0].body).sort(), ['messages', 'systemPrompt', 'task']);
  assert.equal((await put(claude, 1)).data.link.revision, 2);
  assert.equal((await request('/samples/' + codexRun)).status, 404);
  const claudeRun = crypto.randomUUID();
  assert.equal((await start(claudeRun, 2)).status, 202);
  assert.equal((await receipt(claudeRun)).modelSource, 'reported');
  assert.equal(calls.at(-1).provider, claude);
  failed = true;
  const failedRun = crypto.randomUUID();
  assert.equal((await start(failedRun, 2)).status, 202);
  const failure = await receipt(failedRun);
  assert.equal(failure.status, 'failed');
  assert.ok(!JSON.stringify(failure).includes('internal diagnostics'));
  ready = false;
  assert.equal((await request()).data.providers.find(p => p.id === claude).configured, false);
  const unavailableRun = crypto.randomUUID();
  assert.equal((await start(unavailableRun, 2)).status, 202);
  assert.equal((await receipt(unavailableRun)).status, 'failed');
  assert.equal(calls.length, 3);
  assert.equal((await put(null, 2)).data.link.revision, 3);
  assert.equal((await request('/samples/' + claudeRun)).status, 403);
  assert.deepEqual(worker.outboundOrigins, []);
});
