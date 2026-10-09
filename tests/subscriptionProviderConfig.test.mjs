import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const script = fileURLToPath(new URL('../scripts/checkEnv.js', import.meta.url));
function check(env) {
  const dir = mkdtempSync(path.join(tmpdir(), 'tarot-subscription-config-'));
  try {
    writeFileSync(path.join(dir, '.dev.vars'), Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n'), { mode: 0o600 });
    return spawnSync(process.execPath, [script], { cwd: dir, env: { PATH: process.env.PATH }, encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const [provider, prefix] of [['claude-code', 'CLAUDE_CODE'], ['codex-subscription', 'CODEX_SUBSCRIPTION']]) {
  const configured = { TEXT_PROVIDER: provider, [`${prefix}_GATEWAY_URL`]: 'http://127.0.0.1:8789', [`${prefix}_GATEWAY_TOKEN`]: 'private-fixture-token', [`${prefix}_OWNER_USER_ID`]: 'private-fixture-owner' };
  test(`configuration check recognizes ${provider} without requiring paid API keys`, () => {
    const result = check(configured);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(provider));
    assert.match(result.stdout, /gateway availability and subscription login are not checked/i);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /private-fixture/);
  });

  test(`${provider} configuration fails closed on missing owner or gateway even when paid keys exist`, () => {
    for (const suffix of ['OWNER_USER_ID', 'GATEWAY_TOKEN', 'GATEWAY_URL']) {
      const result = check({ ...configured, [`${prefix}_${suffix}`]: '', OPENAI_API_KEY: 'paid-key-must-not-help' });
      assert.equal(result.status, 1, suffix);
      assert.doesNotMatch(`${result.stdout}${result.stderr}`, /private-fixture|paid-key-must-not-help/);
    }
  });

  test(`${provider} configuration rejects non-loopback HTTP and enforces enabled vision prerequisites`, () => {
    assert.equal(check({ ...configured, [`${prefix}_GATEWAY_URL`]: 'http://external.test' }).status, 1);
    const vision = check({ ...configured, VITE_ENABLE_VISION_RESEARCH: 'true' });
    assert.equal(vision.status, 1);
    assert.match(vision.stderr, /VISION_PROOF_SECRET/);
  });
}

test('configuration check rejects an unknown TEXT_PROVIDER instead of announcing a paid fallback', () => {
  const result = check({ TEXT_PROVIDER: 'codex', OPENAI_API_KEY: 'private-fixture-key' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid TEXT_PROVIDER/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /private-fixture-key/);
});
