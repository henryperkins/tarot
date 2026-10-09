import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createServer } from 'vite';
import baseViteConfig from '../vite.config.js';
import { parseJsoncConfig } from '../scripts/deploy.js';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { developmentConfig, developmentEnvironment, developmentPaths, developmentViteConfig, LOCAL_DATABASE_ID,
  localMigrationArguments, parseDevelopmentOptions, resolveDevelopmentOwner, validateLocalReviewer, VISUAL_MODEL, workerArguments } from '../scripts/lib/readingGesturesDev.mjs';

test('local owner selection resolves an existing active account and refuses absent, disabled or service accounts', async t => {
  const db = await createD1();
  t.after(() => db.sqlite.close());
  for (const [id, active, provider] of [['chosen', 1, 'password'], ['disabled', 0, 'password'], ['service', 1, 'service']]) {
    await db.prepare(`INSERT INTO users (id, email, username, password_hash, password_salt, created_at, updated_at, is_active, auth_provider)
      VALUES (?, ?, ?, 'synthetic', 'synthetic', 1, 1, ?, ?)`).bind(id, `${id}@example.invalid`, id, active, provider).run();
  }
  assert.equal(await resolveDevelopmentOwner(db, 'chosen@example.invalid', 'reviewer'), 'chosen');
  assert.equal(await resolveDevelopmentOwner(db, null, 'reviewer'), 'reviewer');
  for (const email of ['missing@example.invalid', 'disabled@example.invalid', 'service@example.invalid', "' OR 1=1 --"]) {
    await assert.rejects(resolveDevelopmentOwner(db, email, 'reviewer'), /existing active local account/);
  }
  assert.equal(db.rows('SELECT count(*) AS count FROM users')[0].count, 3);
});

test('beta provider selection rejects unknown or incomplete options before starting services', () => {
  assert.deepEqual(parseDevelopmentOptions([]), { check: false, provider: 'claude-code', ownerEmail: null });
  assert.deepEqual(parseDevelopmentOptions(['--provider', 'claude-code', '--owner-email', 'Owner@example.invalid', '--check']),
    { check: true, provider: 'claude-code', ownerEmail: 'owner@example.invalid' });
  for (const argv of [['--provider'], ['--provider', 'openai'], ['--provider', 'codex-subscription'], ['--owner-email'],
    ['--owner-email', 'invalid'], ['--unknown'], ['--provider', 'claude-code', '--provider', 'claude-code']]) {
    assert.throws(() => parseDevelopmentOptions(argv));
  }
});

test('Claude beta config selects its owner and gateway without inheriting other provider settings', () => {
  const config = developmentConfig({ vars: { TEXT_PROVIDER: 'legacy',
    CODEX_SUBSCRIPTION_MODEL: 'untrusted-override', CODEX_SUBSCRIPTION_OWNER_USER_ID: 'production-owner',
    CLAUDE_CODE_OWNER_USER_ID: 'claude-owner', CLAUDE_CODE_TIMEOUT_MS: '1',
    OPENAI_API_KEY: 'paid', VISUAL_CUE_PROVIDER: 'other' } },
  { root: '/worktree', ownerUserId: 'local-owner', provider: 'claude-code' });
  assert.equal(config.vars.TEXT_PROVIDER, 'claude-code');
  assert.equal(config.vars.CLAUDE_CODE_OWNER_USER_ID, 'local-owner');
  assert.equal(config.vars.CLAUDE_CODE_GATEWAY_URL, 'http://127.0.0.1:8789');
  assert.equal(config.vars.CLAUDE_CODE_TIMEOUT_MS, '300000');
  assert.equal(config.vars.CODEX_SUBSCRIPTION_OWNER_USER_ID, undefined);
  assert.equal(config.vars.CODEX_SUBSCRIPTION_GATEWAY_URL, undefined);
  assert.equal(config.vars.CODEX_SUBSCRIPTION_STREAMING_ENABLED, undefined);
  assert.equal(config.vars.OPENAI_API_KEY, undefined);
  assert.equal(config.vars.CODEX_SUBSCRIPTION_MODEL, undefined);
  assert.equal(config.vars.VISUAL_CUE_PROVIDER, 'workers-ai');
  assert.throws(() => developmentConfig({}, { root: '/worktree', ownerUserId: 'owner', provider: 'openai' }));
  assert.throws(() => developmentConfig({}, { root: '/worktree', ownerUserId: 'owner', provider: 'codex-subscription' }));
});

test('development children exclude paid credentials and host overrides', () => {
  const env = developmentEnvironment({ HOME: '/home/test', PATH: '/bin',
    ANTHROPIC_API_KEY: 'paid', OPENAI_API_KEY: 'paid', AZURE_OPENAI_API_KEY: 'paid',
    NODE_OPTIONS: '--require malicious', CLAUDE_CODE_OAUTH_TOKEN: 'override',
    VITE_READING_GESTURES: 'false', VITE_SECRET: 'private', CLOUDFLARE_API_TOKEN: 'cf',
    CLOUDFLARE_ACCOUNT_ID: 'account' });
  assert.equal(env.HOME, '/home/test');
  assert.equal(env.CLOUDFLARE_API_TOKEN, 'cf');
  for (const name of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'AZURE_OPENAI_API_KEY',
    'NODE_OPTIONS', 'CLAUDE_CODE_OAUTH_TOKEN', 'VITE_SECRET', 'VITE_READING_GESTURES']) assert.equal(env[name], undefined);
  const frontend = developmentEnvironment({ CLOUDFLARE_API_TOKEN: 'cf', ANTHROPIC_API_KEY: 'paid' }, { frontend: true });
  assert.equal(frontend.CLOUDFLARE_API_TOKEN, undefined);
  assert.equal(frontend.ANTHROPIC_API_KEY, undefined);
  assert.equal(frontend.VITE_READING_GESTURES, 'true');
});

test('generated config isolates storage and production config remains unchanged', async () => {
  const base = parseJsoncConfig(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  const before = JSON.stringify(base);
  const config = developmentConfig({ ...base, vars: { ...base.vars, ANTHROPIC_API_KEY: 'paid', GPT_SERVICE_TOKEN: 'shared' },
    services: [{ binding: 'REMOTE', service: 'production' }], routes: ['example.com/*'] },
  { root: '/worktree', ownerUserId: 'local-owner', accountId: 'account' });
  assert.equal(JSON.stringify(base), before);
  assert.equal(config.vars.TEXT_PROVIDER, 'claude-code');
  assert.equal(config.vars.CLAUDE_CODE_OWNER_USER_ID, 'local-owner');
  assert.equal(config.vars.VISUAL_CUE_MODEL, VISUAL_MODEL);
  assert.equal(config.vars.VISUAL_CUE_REASONING_EFFORT, 'low');
  assert.equal(config.vars.ANTHROPIC_API_KEY, undefined);
  assert.equal(config.vars.GPT_SERVICE_TOKEN, undefined);
  assert.equal(config.vars.CLAUDE_CODE_GATEWAY_TOKEN, undefined);
  assert.equal(config.main, '/worktree/src/worker/index.js');
  assert.equal(config.assets.directory, '/worktree/dist');
  assert.equal(config.ai.remote, true);
  assert.equal(config.d1_databases[0].database_id, LOCAL_DATABASE_ID);
  assert.notEqual(config.d1_databases[0].database_id, base.d1_databases[0].database_id);
  assert.equal(config.d1_databases[0].migrations_dir, '/worktree/migrations');
  for (const binding of [...config.d1_databases, ...config.kv_namespaces, ...config.r2_buckets]) assert.equal(binding.remote, false);
  assert.ok(config.durable_objects.bindings.every(binding => !binding.script_name));
  for (const name of ['routes', 'services', 'env', 'triggers', 'tail_consumers', 'send_email']) assert.equal(config[name], undefined);
});

test('migration commands can only target isolated local persistence', () => {
  const paths = developmentPaths('/worktree');
  const args = localMigrationArguments(paths);
  assert.ok(args.includes('--local'));
  assert.ok(!args.includes('--remote'));
  assert.equal(args[args.indexOf('--persist-to') + 1], '/worktree/.wrangler/reading-gestures-beta/state');
  assert.equal(args[args.indexOf('--config') + 1], '/worktree/.wrangler/reading-gestures-beta/wrangler.json');
  assert.ok(!workerArguments(paths).includes('--remote'));
  assert.ok(!workerArguments(paths).includes('--local'), 'AI alone must remain available remotely');
});

test('reviewer credentials cannot be used against a nonlocal origin or wrong scope', () => {
  const credentials = { scope: 'local-development-only', baseUrl: 'http://localhost:8787',
    userId: 'local-id', email: 'local@example.invalid', username: 'local', password: 'private' };
  assert.equal(validateLocalReviewer(credentials), credentials);
  assert.throws(() => validateLocalReviewer({ ...credentials, baseUrl: 'https://tableu.app' }));
  assert.throws(() => validateLocalReviewer({ ...credentials, scope: 'production' }));
  assert.throws(() => validateLocalReviewer({ ...credentials, userId: '' }));
});

for (const profile of ['shared', 'beta']) test(`${profile} Vite restricts hosts and denies private files through normal and @fs URLs`, async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reading-gestures-vite-security-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const canary = 'synthetic-private-canary-not-a-credential';
  const paths = ['.wrangler/reading-gestures-beta/.dev.vars', '.wrangler/reading-gestures-beta/state/data.json',
    '.wrangler/reading-gestures-beta/logs/worker.log', '.env', '.env.local', '.dev.vars',
    '.dev.vars.preview', 'nested/.env.production', '.config/private.json', 'playwright/.auth/state.json'];
  for (const filename of paths) {
    await mkdir(path.dirname(path.join(root, filename)), { recursive: true });
    await writeFile(path.join(root, filename), canary);
  }
  await writeFile(path.join(root, 'visible.txt'), 'public control');
  const selected = profile === 'shared' ? baseViteConfig : developmentViteConfig({ ...baseViteConfig,
    server: { ...baseViteConfig.server, allowedHosts: true, fs: { deny: ['venv/**', '.git/**'] } } },
  { privateDirectory: path.join(root, '.wrangler/reading-gestures-beta') });
  const config = { ...selected, configFile: false, root, logLevel: 'silent',
    envDir: path.join(root, '.wrangler/reading-gestures-beta'),
    optimizeDeps: { noDiscovery: true, include: [], entries: [] },
    server: { ...selected.server, fs: { ...selected.server.fs, allow: [root] } } };
  assert.deepEqual(config.server.allowedHosts, ['localhost']);
  assert.equal(config.server.fs.strict, true);
  // Middleware mode lets Node allocate an ephemeral port instead of Vite's
  // default-port fallback, keeping this fixture clear of live development servers.
  config.server.middlewareMode = true;
  const server = await createServer(config);
  t.after(() => server.close());
  const canaryServer = http.createServer(server.middlewares);
  t.after(() => new Promise(resolve => canaryServer.close(resolve)));
  await new Promise(resolve => canaryServer.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${canaryServer.address().port}`;
  assert.equal(await (await fetch(`${origin}/visible.txt`)).text(), 'public control');
  for (const filename of paths) {
    for (const url of [`/${filename}`, `/@fs${path.join(root, filename)}`, `/${filename}?raw`,
      `/${filename.replace('.', '%2e')}?url`, `/@fs${path.join(root, filename)}?import&raw`]) {
      const response = await fetch(`${origin}${url}`);
      assert.notEqual(response.status, 200, `private file served: ${url}`);
      assert.ok(!(await response.text()).includes(canary), `private content exposed: ${url}`);
    }
  }
  // Node's fetch normalizes Host to the URL; use HTTP to exercise actual rebinding headers.
  const foreignHost = await new Promise((resolve, reject) => {
    const request = http.get(`${origin}/visible.txt`, { headers: { Host: 'attacker.example' } }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.on('error', reject);
  });
  assert.equal(foreignHost.status, 403);
  assert.ok(!foreignHost.body.includes('public control'));
});
