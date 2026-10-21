import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));

test('default frontend collection keeps ordinary specs and leaves owned reading-cue lanes explicit', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'playwright-frontend-collection-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), 'test',
    '--config', path.join(root, 'playwright.config.js'), '--list', '--reporter=json', '--output', directory], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 10 * 1024 * 1024
  });
  assert.ifError(result.error);
  const report = JSON.parse(result.stdout);
  assert.equal(result.status, 0, result.stderr || JSON.stringify(report.errors));

  const files = new Set(report.suites.map(suite => path.basename(suite.file)));
  for (const file of ['account-plan-hardening.spec.js', 'reading-gestures-deck.spec.js', 'reading-cue-pro-streaming.spec.js']) {
    assert.ok(files.has(file), `ordinary frontend spec must remain discoverable: ${file}`);
  }
  for (const file of ['reading-cue-qualification.spec.js', 'reading-cue-runtime-lane.spec.js', 'reading-cue-artwork-performance.spec.js']) {
    assert.ok(!files.has(file), `owned reading-cue spec requires its explicit lane: ${file}`);
  }
});
