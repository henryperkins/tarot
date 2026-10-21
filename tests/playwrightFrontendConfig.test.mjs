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

test('Gate 2 Vite lanes own separate dependency caches and keep visual flags scoped', async () => {
  const { default: config } = await import('../playwright.navigation-gate2.config.js');
  const caches = config.webServer.map(server => server.env?.NAV_GATE2_VITE_CACHE_DIR);
  assert.ok(caches.every(value => typeof value === 'string' && path.isAbsolute(value)), 'each lane needs an explicit private cache');
  assert.equal(new Set(caches).size, config.webServer.length, 'normal and visual lanes must never rewrite the same cache');
  assert.ok(config.webServer.every(server => server.command.includes('--config vite.navigation-gate2.config.js')));
  assert.equal(config.webServer[0].env.VITE_READING_GESTURES, undefined);
  assert.equal(config.webServer[1].env.VITE_READING_GESTURES, 'true');
  assert.equal(config.webServer[1].env.VITE_READING_MODEL_ANNOTATIONS, 'true');
});

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

  const mobileThemes = [];
  const collect = suite => {
    for (const spec of suite.specs || []) {
      if (!spec.title.startsWith('saved Markdown headings')) continue;
      if (spec.tests.some(item => item.projectName === 'mobile')) mobileThemes.push(spec.title);
    }
    suite.suites?.forEach(collect);
  };
  report.suites.forEach(collect);
  assert.deepEqual(mobileThemes.sort(), [
    'saved Markdown headings and expanded question follow the dark theme',
    'saved Markdown headings and expanded question follow the light theme'
  ], 'default frontend collection must keep both WebKit Journal theme regressions');
});
