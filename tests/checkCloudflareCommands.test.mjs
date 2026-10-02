import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const script = path.resolve('scripts/check-cloudflare-commands.mjs');

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'cloudflare-commands-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const directory of ['docs/nested', 'scripts', 'functions/api']) {
    await mkdir(path.join(root, directory), { recursive: true });
  }
  await writeFile(path.join(root, 'README.md'), 'Use wrangler secret put TOKEN.\n');
  await writeFile(path.join(root, 'test-telemetry.js'), '// Worker telemetry\n');
  return root;
}

function check(root) {
  // The build image need only provide Node; no bash, Git, or ripgrep is required.
  return spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PATH: '' }
  });
}

test('Cloudflare command validation runs without external executables', async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'docs/nested/valid.md'), 'pagesXdev is not a legacy hostname.\n');
  const result = check(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /checked/i);
});

for (const [file, text] of [
  ['README.md', 'Heading\nwrangler pages secret put TOKEN\n'],
  ['docs/nested/deploy.md', 'Heading\nhttps://old-project.pages.dev\n']
]) {
  test(`Cloudflare command validation reports forbidden content in ${file}`, async (t) => {
    const root = await fixture(t);
    await writeFile(path.join(root, file), text);
    const result = check(root);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(`${file}:2:`), result.stderr);
  });
}

test('Cloudflare command validation fails when a required search target is missing', async (t) => {
  const root = await fixture(t);
  await rm(path.join(root, 'test-telemetry.js'));
  const result = check(root);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /test-telemetry\.js/);
  assert.doesNotMatch(result.stdout, /passed/i);
});
