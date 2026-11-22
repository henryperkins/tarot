import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parseEnv } from 'node:util';
import { getOwnerHostStatus, withOwnerHostGateway } from '../functions/lib/ownerSubscriptionHost.js';
import { prepareLocalAdmin, prepareOwnerHostSecret } from '../scripts/local-admin.mjs';
import { startOwnerSubscriptionHosts } from '../scripts/lib/ownerSubscriptionHosts.mjs';
import { createSubscriptionStatus } from '../services/subscription-status.mjs';

test('local starts preserve user settings and persist a host key independent of the browser setup token', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'tableu-host-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const base = 'APP_VALUE=existing\n';
  await writeFile(path.join(dir, '.env'), base);
  const [secret, setup, concurrent] = await Promise.all([prepareOwnerHostSecret(dir), prepareLocalAdmin(dir), prepareOwnerHostSecret(dir)]);
  assert.match(secret, /^[0-9a-f]{64}$/);
  assert.notEqual(secret, setup);
  assert.equal(secret, concurrent);
  assert.equal(await readFile(path.join(dir, '.env'), 'utf8'), base);
  const local = await readFile(path.join(dir, '.env.local'), 'utf8');
  assert.equal(local.match(/^LOCAL_OWNER_HOST_SECRET=/gm).length, 1);
  assert.equal(parseEnv(local).LOCAL_OWNER_HOST_SECRET, secret);
});

test('dev listeners check subscription credentials independently and accept only their per-run tokens', async t => {
  const secret = randomBytes(32).toString('hex');
  let codexChecks = 0;
  let claudeChecks = 0;
  const options = {
    secret,
    codex: { checkLogin: async () => { codexChecks++; }, run: () => assert.fail('A status probe invoked generation') },
    claude: { checkLogin: async () => {
      claudeChecks++;
      throw Object.assign(new Error('sensitive diagnostic'), { code: 'login_required' });
    } }
  };
  const hosts = await startOwnerSubscriptionHosts(options);
  t.after(() => hosts.close());
  const env = { AI_CONFIG_ENVIRONMENT: 'local', LOCAL_OWNER_HOST_SECRET: secret, ...hosts.bindings };
  const effective = await withOwnerHostGateway(env, 'codex-subscription');
  const codexToken = effective.CODEX_SUBSCRIPTION_GATEWAY_TOKEN;
  const claudeUrl = hosts.bindings.OWNER_HOST_CLAUDE_URL + '/v1/subscription-status';
  const wrongToken = await fetch(claudeUrl, { headers: { Authorization: 'Bearer ' + codexToken } });
  assert.equal(wrongToken.status, 401);
  assert.equal(claudeChecks, 0);
  assert.equal(env.CODEX_SUBSCRIPTION_GATEWAY_TOKEN, undefined);
  assert.deepEqual(await getOwnerHostStatus(env, 'codex-subscription'), { ready: true });
  assert.deepEqual(await getOwnerHostStatus(env, 'claude-code'), { ready: false, reason: 'Run claude auth login on this computer and choose your Claude subscription.' });
  assert.equal(codexChecks, 1);
  assert.equal(claudeChecks, 1);
  const next = await startOwnerSubscriptionHosts(options);
  t.after(() => next.close());
  await hosts.close();
  const rejected = await fetch(next.bindings.OWNER_HOST_CODEX_URL + '/healthz', { headers: { Authorization: 'Bearer ' + codexToken } });
  assert.equal(rejected.status, 401);
  assert.equal((await getOwnerHostStatus(env, 'codex-subscription')).ready, false);
  assert.deepEqual(await getOwnerHostStatus({ ...env, ...next.bindings }, 'codex-subscription'), { ready: true });
});

test('only managed local host bindings can be used for portal requests', async () => {
  const valid = { AI_CONFIG_ENVIRONMENT: 'local', LOCAL_OWNER_HOST_SECRET: 'x'.repeat(32),
    OWNER_HOST_INSTANCE: '73ecbd35-ba52-4d25-b699-f0e4afb4b559', OWNER_HOST_CODEX_URL: 'http://127.0.0.1:43211' };
  for (const overrides of [
    { AI_CONFIG_ENVIRONMENT: 'production' }, { OWNER_HOST_INSTANCE: '' }, { LOCAL_OWNER_HOST_SECRET: '' },
    { OWNER_HOST_CODEX_URL: 'https://public.example' }, { OWNER_HOST_CODEX_URL: 'http://127.0.0.1:4567/path' }
  ]) await assert.rejects(withOwnerHostGateway({ ...valid, ...overrides }, 'codex-subscription'), /unavailable/);
  await assert.rejects(withOwnerHostGateway(valid, 'unrecognized'));
});

test('concurrent readiness checks are shared and shutdown cancels a pending login check', async () => {
  let calls = 0;
  const status = createSubscriptionStatus('codex-subscription', async ({ signal }) => {
    calls++;
    await new Promise((resolve, reject) => signal.addEventListener('abort', reject, { once: true }));
  });
  const first = status.read();
  const second = status.read();
  assert.equal(first, second);
  await status.stop();
  assert.deepEqual(await first, { provider: 'codex-subscription', ready: false, reason: 'cli_unavailable' });
  assert.equal(calls, 1);
});
