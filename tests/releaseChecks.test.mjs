import assert from 'node:assert/strict';
import { it } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../src/data/minorArcana.js';

function release(env = {}) {
  const result = spawnSync(process.execPath, ['--import', './tests/helpers/releaseCheckCommandStub.mjs', 'scripts/evaluation/runReleaseChecks.js'], {
    encoding: 'utf8',
    env: { ...process.env, VISION_EVAL_MANIFEST_DIR: '', NARRATIVE_EVAL_BACKEND: '', TEST_RELEASE_CHECK_FAIL: '',
      TEST_RELEASE_LOGIN_FAIL: '', CLAUDE_CODE_GATEWAY_URL: '', CLAUDE_CODE_GATEWAY_TOKEN: '', ANTHROPIC_API_KEY: 'offline-test-key',
      OPENAI_API_KEY: 'offline-openai-test-key', NARRATIVE_EVAL_OPENAI_API_KEY: '', ...env }
  });
  const checks = result.stdout.split('\n').filter(line => line.startsWith('CHECK:')).map(line => JSON.parse(line.slice(6)));
  return { ...result, checks, scripts: checks.map(check => check.script) };
}

async function corpus(t, { complete = true, kind = 'held-out-photos' } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'release-corpus-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const cards = [...MAJOR_ARCANA, ...MINOR_ARCANA].slice(0, complete ? 78 : 1);
  for (const deckStyle of ['rws-1909', 'thoth-a1', 'marseille-classic']) {
    const samples = [];
    for (const [index, card] of cards.entries()) {
      // Bytes exercise manifest integrity only; these are not photo evidence.
      const bytes = `release manifest test fixture ${deckStyle} ${index}`;
      const image = `${deckStyle}-${index}.jpg`;
      await writeFile(join(directory, image), bytes);
      samples.push({ id: `${deckStyle}-${index}`, image, expected: card.name, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
    await writeFile(join(directory, `${deckStyle}.json`), JSON.stringify({
      schemaVersion: 1, id: 'test-only', kind, deckStyle,
      labelSource: kind === 'synthetic' ? 'synthetic-derived' : 'independent-human', samples
    }));
  }
  return directory;
}

it('runs required release checks without a photo corpus and reports vision as unrun', () => {
  const result = release();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.scripts, ['test', 'test:deploy', 'lint:cloudflare', 'docs:check', 'ci:narrative-check']);
  assert.match(result.stdout, /vision qualification not run/i);
  assert.ok(result.checks.every(check => check.backend === 'openai-native' && check.textProvider === 'legacy'));
});

it('grades production OpenAI readings with the key passed only to the narrative check', () => {
  const result = release({ TEST_RELEASE_LOGIN_FAIL: '1' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /grading openai-native readings through the paid OpenAI Responses API/);
  assert.doesNotMatch(result.stdout, /LOGIN_CHECK/, 'the OpenAI gate needs no subscription login');
  for (const check of result.checks) {
    assert.equal(check.openaiKey, false, `${check.script} must not receive OPENAI_API_KEY`);
    assert.equal(check.evalOpenaiKey, check.script === 'ci:narrative-check', `${check.script} evaluation key`);
  }
});

it('accepts an explicit evaluation key without OPENAI_API_KEY', () => {
  const result = release({ OPENAI_API_KEY: '', NARRATIVE_EVAL_OPENAI_API_KEY: 'offline-eval-key' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.checks.every(check => !check.openaiKey && check.evalOpenaiKey === (check.script === 'ci:narrative-check')));
});

it('refuses a missing OpenAI key before starting any release check', () => {
  const result = release({ OPENAI_API_KEY: '', NARRATIVE_EVAL_OPENAI_API_KEY: '' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /needs OPENAI_API_KEY or NARRATIVE_EVAL_OPENAI_API_KEY; it never falls back/);
  assert.deepEqual(result.checks, []);
});

for (const script of ['test', 'ci:narrative-check']) {
  it(`still blocks release when ${script} fails without a photo corpus`, () => {
    const result = release({ TEST_RELEASE_CHECK_FAIL: script });
    assert.equal(result.status, 1);
    assert.equal(result.scripts.at(-1), script);
    assert.match(result.stderr, new RegExp(`Release check ${script} failed`));
  });
}

it('still requires a live narrative provider when vision qualification is omitted', () => {
  const result = release({ NARRATIVE_EVAL_BACKEND: 'local-composer' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /subscription.*local-composer is diagnostic only/i);
  assert.deepEqual(result.checks, []);
});

it('does not silently skip a configured but missing photo corpus', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'missing-release-corpus-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const result = release({ VISION_EVAL_MANIFEST_DIR: directory });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ENOENT/);
  assert.deepEqual(result.checks, []);
});

for (const [name, options] of [['incomplete', { complete: false }], ['synthetic', { kind: 'synthetic' }]]) {
  it(`rejects an explicitly configured ${name} corpus before inference`, async (t) => {
    const result = release({ VISION_EVAL_MANIFEST_DIR: await corpus(t, options) });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /independent photos covering all 78/);
    assert.deepEqual(result.checks, []);
  });
}

it('runs the strict vision gate when a complete corpus is explicitly configured', async (t) => {
  const result = release({ VISION_EVAL_MANIFEST_DIR: await corpus(t) });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.scripts, ['test', 'test:deploy', 'lint:cloudflare', 'docs:check', 'ci:vision-check', 'ci:narrative-check']);
  assert.doesNotMatch(result.stdout, /vision qualification not run/i);
});

it('keeps an explicitly requested failing vision gate fatal', async (t) => {
  const result = release({ VISION_EVAL_MANIFEST_DIR: await corpus(t), TEST_RELEASE_CHECK_FAIL: 'ci:vision-check' });
  assert.equal(result.status, 1);
  assert.equal(result.scripts.at(-1), 'ci:vision-check');
  assert.match(result.stderr, /Release check ci:vision-check failed/);
});

it('runs the OpenAI release gate without an Anthropic API key', () => {
  const result = release({ ANTHROPIC_API_KEY: '' });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.checks.every(check => check.backend === 'openai-native'));
});

for (const backend of ['claude-api', 'modal-qwen']) {
  it(`rejects the paid ${backend} backend before release checks`, () => {
    const result = release({ NARRATIVE_EVAL_BACKEND: backend });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /paid API backends are disabled/i);
    assert.deepEqual(result.checks, []);
  });
}

for (const backend of ['auto', 'openai-native']) {
  it(`runs ${backend} release QA on the production OpenAI backend even with personal runtime settings`, () => {
    const result = release({ NARRATIVE_EVAL_BACKEND: backend, TEXT_PROVIDER: 'claude-code' });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.checks.every(check => check.backend === 'openai-native' && check.textProvider === 'legacy'));
  });
}

it('refuses a subscription release gate while OpenAI serves production readings', () => {
  const result = release({ NARRATIVE_EVAL_BACKEND: 'claude-code' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /production primary provider \(openai-native\); NARRATIVE_EVAL_BACKEND=claude-code would not qualify it/);
  assert.deepEqual(result.checks, []);
});
