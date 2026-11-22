import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parseEnv } from 'node:util';
import { localAdminUrl, prepareLocalAdmin } from '../scripts/local-admin.mjs';

async function workspace(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'tableu-local-admin-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('concurrent local starts preserve existing settings and initialize only missing credentials', async t => {
  const root = await workspace(t);
  const file = path.join(root, '.dev.vars');
  const existing = '# existing settings\r\nADMIN_API_KEY="retained-local-test-value"';
  await writeFile(file, existing);
  const tokens = await Promise.all([prepareLocalAdmin(root), prepareLocalAdmin(root)]);
  assert.equal(tokens[0], tokens[1]);
  assert.match(tokens[0], /^[a-f0-9]{64}$/);
  const updated = await readFile(file, 'utf8');
  assert.ok(updated.startsWith(existing + '\r\n'));
  assert.equal(parseEnv(updated).ADMIN_API_KEY, 'retained-local-test-value');
  assert.equal(updated.match(/^LOCAL_ADMIN_SETUP_TOKEN=/gm).length, 1);
  await prepareLocalAdmin(root);
  assert.equal(await readFile(file, 'utf8'), updated);
});

test('local setup preserves Wrangler dotenv inheritance on a checkout without .dev.vars', async t => {
  const root = await workspace(t);
  const base = 'ADMIN_API_KEY=existing\nOPENAI_API_KEY=example\n';
  await writeFile(path.join(root, '.env'), base);
  await prepareLocalAdmin(root);
  assert.equal(await readFile(path.join(root, '.env'), 'utf8'), base);
  const local = parseEnv(await readFile(path.join(root, '.env.local'), 'utf8'));
  assert.deepEqual(Object.keys(local), ['LOCAL_ADMIN_SETUP_TOKEN']);
  await assert.rejects(readFile(path.join(root, '.dev.vars')), { code: 'ENOENT' });
});

test('launcher only puts proof in a fragment on first setup and never sends it to the status endpoint', async t => {
  const root = await workspace(t);
  const proof = await prepareLocalAdmin(root);
  const seen = new Set();
  let capturedSignature;
  const get = configured => (url, options) => {
    assert.equal(url.origin + url.pathname, 'http://localhost:8787/api/admin/local-access');
    assert.ok(!url.href.includes(proof));
    assert.equal(url.hash, '');
    const nonce = url.searchParams.get('challenge');
    assert.match(nonce, /^[a-f0-9]{64}$/);
    assert.ok(!seen.has(nonce));
    seen.add(nonce);
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers, undefined);
    assert.equal(options.body, undefined);
    capturedSignature = createHmac('sha256', proof).update('tableu/local-admin/first-launch/v1:' + nonce).digest('hex');
    return Response.json({ available: true, passwordConfigured: configured, ...(!configured && { launchProof: capturedSignature }) });
  };
  const first = new URL(await localAdminUrl(root, get(false)));
  assert.equal(new URLSearchParams(first.hash.slice(1)).get('setup'), proof);
  for (const launchProof of [capturedSignature, '0'.repeat(64), 'malformed', undefined]) {
    await assert.rejects(localAdminUrl(root, () => Response.json({ available: true, passwordConfigured: false, launchProof })), error =>
      error.message.includes('Restart it with npm run dev') && !error.message.includes(proof));
  }
  const next = await localAdminUrl(root, get(true));
  assert.equal(next, 'http://localhost:8787/admin/ai-configuration');
  await assert.rejects(localAdminUrl(root, () => Response.json({ available: false })), /unavailable/);
});
