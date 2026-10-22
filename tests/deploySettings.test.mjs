import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { buildDeploymentConfig, createWorkerSettingsReader, getDeploymentEnvironment, verifyPreservedSettings } from '../scripts/lib/deploySettings.js';

const config = { name: 'tableau', account_id: 'a'.repeat(32), vars: { NEW_FLAG: false }, observability: { enabled: true, issues: { enabled: true } } };

it('preserves typed JSON variables including false, zero, and empty strings', () => {
  const before = { bindings: [{ name: 'JSON', type: 'json', json: '{"empty":"","flag":false,"count":0}' }], observability: config.observability };
  const after = { ...before, bindings: [{ name: 'JSON', type: 'json', json: { count: 0, flag: false, empty: '' } }, { name: 'NEW_FLAG', type: 'json', json: 'false' }] };
  verifyPreservedSettings(before, after, buildDeploymentConfig(config, before));
  assert.throws(() => verifyPreservedSettings(before, { ...after, bindings: [{ name: 'JSON', type: 'json', json: '{"count":1}' }] }, buildDeploymentConfig(config, before)), /variable: JSON/);
});

it('detects a secret changing type or disappearing without comparing secret values', () => {
  const before = { bindings: [{ name: 'KEY', type: 'secret_text' }], observability: config.observability };
  const deployed = { ...config, vars: {} };
  verifyPreservedSettings(before, before, deployed);
  assert.throws(() => verifyPreservedSettings(before, { ...before, bindings: [] }, deployed), /variable: KEY/);
  assert.throws(() => verifyPreservedSettings(before, { ...before, bindings: [{ name: 'KEY', type: 'plain_text', text: 'value' }] }, deployed), /variable: KEY/);
});

it('checks monitoring settings including disabled logs, zero sampling, and destinations', () => {
  const before = { bindings: [], observability: { enabled: false, issues: { enabled: true }, logs: { enabled: false, head_sampling_rate: 0, destinations: ['destination'] } } };
  const deployed = buildDeploymentConfig({ ...config, vars: {} }, before);
  const after = structuredClone(before);
  after.observability.traces = { enabled: false }; // Server-added defaults are fine.
  verifyPreservedSettings(before, after, deployed);
  after.observability.logs.head_sampling_rate = 1;
  assert.throws(() => verifyPreservedSettings(before, after, deployed), /observability/);
});

it('supports existing API key credentials without passing them on the command line', async () => {
  const originalFetch = globalThis.fetch;
  try {
    let seen;
    globalThis.fetch = async (url, options) => {
      seen = { url, options };
      return Response.json({ success: true, result: { bindings: [], observability: config.observability } });
    };
    const read = createWorkerSettingsReader({ config, env: {}, runWrangler: (args, options) => {
      assert.deepEqual(args, ['auth', 'token', '--json']);
      assert.equal(options.env.WRANGLER_WRITE_LOGS, 'false');
      assert.equal(options.env.WRANGLER_LOG, 'log');
      return { status: 0, stdout: JSON.stringify({ type: 'api_key', key: 'private-key', email: 'private-email' }) };
    } });
    await read();
    assert.equal(seen.options.headers['X-Auth-Key'], 'private-key');
    assert.equal(seen.options.headers['X-Auth-Email'], 'private-email');
    assert.equal(seen.options.redirect, 'error');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it('fails closed on unrelated 404s, invalid JSON, and network failures', async () => {
  const originalFetch = globalThis.fetch;
  try {
    const read = createWorkerSettingsReader({ config, env: {}, runWrangler: () => ({ status: 0, stdout: '{"type":"api_token","token":"private-token"}' }) });
    for (const response of [new Response('{}', { status: 404 }), new Response('private-unparseable-body'), Response.json({ success: false })]) {
      globalThis.fetch = async () => response;
      await assert.rejects(read, error => {
        assert.doesNotMatch(error.message, /private-/);
        return /Cannot read Worker settings/.test(error.message);
      });
    }
    globalThis.fetch = async () => { throw new Error('private-network-detail'); };
    await assert.rejects(read, /Cannot read Worker settings/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it('rejects a Worker-name override before authentication or remote reads', () => {
  assert.throws(() => createWorkerSettingsReader({ config, env: { WRANGLER_CI_OVERRIDE_NAME: 'another-worker' }, runWrangler: () => assert.fail('must not authenticate') }), /name override/);
});

it('matches Wrangler account precedence when the shell specifies another account', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async url => {
      assert.ok(String(url).includes(`/accounts/${config.account_id}/`));
      return Response.json({ success: true, result: { bindings: [] } });
    };
    const read = createWorkerSettingsReader({ config, env: { CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32) }, runWrangler: () => ({ status: 0, stdout: '{"type":"oauth","token":"fixture"}' }) });
    await read();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it('rejects configured bindings that could replace a dashboard variable or secret', () => {
  const before = { bindings: [{ name: 'COLLISION', type: 'plain_text', text: 'existing' }] };
  for (const binding of [{ assets: { binding: 'COLLISION' } }, { durable_objects: { bindings: [{ name: 'COLLISION', class_name: 'Object' }] } }, { send_email: [{ name: 'COLLISION' }] }, { unsafe: { bindings: [{ name: 'COLLISION', type: 'service' }] } }, { logfwdr: { bindings: [{ name: 'COLLISION', destination: 'test' }] } }, { wasm_modules: { COLLISION: './module.wasm' } }]) {
    assert.throws(() => buildDeploymentConfig({ ...config, ...binding }, before), /binding.*COLLISION/);
  }
  for (const metadata of [{ bindings: [] }, { keep_bindings: [] }, { observability: { issues: { enabled: false } } }]) {
    assert.throws(() => buildDeploymentConfig({ ...config, unsafe: { metadata } }, before), /Unsafe upload metadata/);
  }
});

it('retrieves Wrangler credentials without creating a debug log even when verbose logging is inherited', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'deploy-auth-'));
  try {
    const logPath = join(directory, 'auth.log');
    createWorkerSettingsReader({
      config,
      env: { ...process.env, CLOUDFLARE_API_TOKEN: 'fixture-auth-token', WRANGLER_LOG_PATH: logPath, WRANGLER_LOG: 'debug' },
      runWrangler: (args, options) => spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url)), ...args], { cwd: directory, encoding: 'utf8', timeout: 10_000, ...options })
    });
    assert.equal(existsSync(logPath), false, 'auth token output must stay out of Wrangler logs');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('rejects malformed variable payloads and duplicate names while reading settings', async () => {
  const originalFetch = globalThis.fetch;
  try {
    const read = createWorkerSettingsReader({ config, env: {}, runWrangler: () => ({ status: 0, stdout: '{"type":"oauth","token":"fixture"}' }) });
    for (const bindings of [
      [{ name: 'JSON', type: 'json', json: 'invalid-json' }],
      [{ name: 'JSON', type: 'json' }],
      [{ name: 'TEXT', type: 'plain_text' }],
      [{ name: 'KEY', type: 'secret_text' }, { name: 'KEY', type: 'secret_text' }],
      [{ name: 1, type: 'plain_text', text: 'value' }]
    ]) {
      globalThis.fetch = async () => Response.json({ success: true, result: { bindings } });
      await assert.rejects(read, /invalid Worker settings/);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

it('the installed Wrangler inherits vars and sends Issues in BOTH upload metadata and its later monitoring patch', { timeout: 30_000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'deploy-settings-wrangler-'));
  const versionId = '10000000-0000-4000-8000-000000000001';
  const before = { bindings: [{ type: 'plain_text', name: 'EXISTING', text: 'dashboard-canary' }], observability: { enabled: true, issues: { enabled: true }, logs: { enabled: true, persist: false, invocation_logs: false } } };
  const uploads = [];
  const patches = [];
  const unexpected = [];
  const server = createServer(async (request, response) => {
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const path = new URL(request.url, 'http://fixture').pathname;
      let result;
      if (request.method === 'POST' && path.endsWith('/versions')) {
        const form = await new Response(body, { headers: { 'Content-Type': request.headers['content-type'] } }).formData();
        uploads.push(JSON.parse(form.get('metadata')));
        result = { id: versionId, resources: { script: { etag: 'fixture' }, bindings: [] }, startup_time_ms: 1 };
      } else if (request.method === 'PATCH' && path.endsWith('/script-settings')) {
        patches.push(JSON.parse(body.toString()));
        result = { ...before, ...patches.at(-1) };
      } else if (path.endsWith('/settings')) result = before;
      else if (path.endsWith('/services/tableau')) result = { default_environment: { script: { tag: 'fixture', last_deployed_from: 'wrangler' } } };
      else if (path.endsWith('/deployments')) result = request.method === 'POST' ? { id: 'deployment', versions: [{ version_id: versionId, percentage: 100 }] } : { deployments: [] };
      else if (path.endsWith('/subdomain')) result = { enabled: false, previews_enabled: false };
      else if (path.endsWith('/secrets')) result = [];
      else if (path.endsWith('/workers/workers/tableau')) result = { id: 'tableau', tags: [], subdomain: { enabled: false, previews_enabled: false } };
      else unexpected.push(`${request.method} ${path}`);
      response.writeHead(result === undefined ? 404 : 200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ success: result !== undefined, result, errors: result === undefined ? [{ code: 10007, message: 'Unexpected fixture endpoint' }] : [] }));
    } catch {
      response.writeHead(500);
      response.end();
    }
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const deployed = buildDeploymentConfig({ ...config, main: './worker.mjs', compatibility_date: '2026-10-01', workers_dev: false, preview_urls: false, vars: { EXISTING: 'local-default', NEW: 'new-default' } }, before);
  await writeFile(join(directory, 'wrangler.json'), JSON.stringify(deployed));
  await writeFile(join(directory, 'worker.mjs'), 'export default { fetch() { return new Response("ok"); } };');
  await writeFile(join(directory, '.env'), 'WRANGLER_CI_OVERRIDE_NAME=wrong-worker\nCLOUDFLARE_API_BASE_URL=http://127.0.0.1:1\nCLOUDFLARE_ACCOUNT_ID=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n');
  const child = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url)), 'deploy', '--config', join(directory, 'wrangler.json')], {
    cwd: directory,
    env: getDeploymentEnvironment(deployed, { ...process.env, CLOUDFLARE_API_TOKEN: 'fixture-token', CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32), CLOUDFLARE_API_BASE_URL: `http://127.0.0.1:${server.address().port}`, WRANGLER_WRITE_LOGS: 'false', WRANGLER_SEND_METRICS: 'false', CI: 'true' }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const exitCode = await new Promise((resolve, reject) => { child.on('close', resolve); child.on('error', reject); });
  assert.equal(exitCode, 0, output);
  assert.deepEqual(unexpected, []);
  assert.equal(uploads.length, 1);
  assert.deepEqual(uploads[0].bindings, [{ name: 'NEW', type: 'plain_text', text: 'new-default' }]);
  for (const type of ['plain_text', 'json', 'secret_text', 'secret_key']) assert.ok(uploads[0].keep_bindings.includes(type), type);
  assert.deepEqual(uploads[0].observability, deployed.observability);
  assert.equal(patches.length, 1);
  assert.deepEqual(patches[0].observability, deployed.observability);
  assert.doesNotMatch(output, /dashboard-canary|fixture-token/);
});
