import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

function sample(id, guidance) {
  return {
    id,
    spreadKey: 'single',
    spreadName: 'One-Card Insight',
    userQuestion: 'What deserves attention?',
    cardsInfo: [{ card: 'The Fool', position: 'Present', orientation: 'Upright' }],
    reading: [
      '### Opening',
      'This gentle reading offers room for curiosity and choice.',
      '### The Fool — Present',
      '**The Fool** suggests a fresh beginning. Because this card favors curiosity over a perfect plan, a small experiment can help you learn what fits. You can choose one reversible step and consider how it feels before going further.',
      '### Guidance', guidance,
      '### Closing',
      'Your choices shape the path, and you can move at your own pace with compassion.'
    ].join('\n\n')
  };
}

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'narrative-evidence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return {
    root,
    input: path.join(root, 'samples.json'),
    metrics: path.join(root, 'metrics.json'),
    review: path.join(root, 'review.csv')
  };
}

async function evaluate(files, samples) {
  await writeFile(files.input, JSON.stringify({ samples }));
  const result = spawnSync(process.execPath, [
    'scripts/evaluation/computeNarrativeMetrics.js',
    '--in', files.input, '--metrics-out', files.metrics, '--review-out', files.review
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(await readFile(files.metrics, 'utf8'));
}

function gate(metricsPath) {
  return spawnSync(process.execPath, ['scripts/evaluation/verifyNarrativeGate.js', metricsPath], { encoding: 'utf8' });
}

test('narrative gate reports sample ids, matched claims, and detected cards', async (t) => {
  const files = await fixture(t);
  const metrics = await evaluate(files, [
    sample('claim-fixture', 'Nothing here is guaranteed, but you will definitely succeed. Private reading sentinel.'),
    sample('card-fixture', '**The Tower** suggests a sudden change. You can consider a gentle step.')
  ]);
  assert.deepEqual(metrics.perSample[0].deterministicLanguageMatches, ['will definitely']);
  const result = gate(files.metrics);
  assert.equal(result.status, 1);
  for (const evidence of ['claim-fixture', 'will definitely', 'card-fixture', 'The Tower']) {
    assert.ok(result.stderr.includes(evidence), result.stderr);
  }
  assert.doesNotMatch(result.stderr, /Private reading sentinel/);
  assert.match(await readFile(files.review, 'utf8'), /will definitely/);
});

test('narrative evidence survives later evaluations replacing the current output files', async (t) => {
  const files = await fixture(t);
  const first = await evaluate(files, [sample('first-run', 'Success is guaranteed. You can choose a gentle step.')]);
  assert.equal(typeof first.artifactsDirectory, 'string');
  const directory = path.resolve(first.artifactsDirectory);
  const names = ['narrative-samples.json', 'narrative-metrics.json', 'narrative-review-queue.csv'];
  const before = await Promise.all(names.map(name => readFile(path.join(directory, name), 'utf8')));
  assert.equal(JSON.parse(before[0]).samples[0].id, 'first-run');
  assert.equal(JSON.parse(before[1]).flaggedSampleCount, 1);
  assert.match(before[2], /first-run/);

  const second = await evaluate(files, [sample('second-run', 'You can consider one gentle step today.')]);
  assert.notEqual(first.artifactsDirectory, second.artifactsDirectory);
  assert.deepEqual(await Promise.all(names.map(name => readFile(path.join(directory, name), 'utf8'))), before);
  assert.equal(gate(files.metrics).status, 0);
  const failedGate = gate(path.join(directory, 'narrative-metrics.json'));
  assert.equal(failedGate.status, 1);
  assert.ok(failedGate.stderr.includes(first.artifactsDirectory));
});

test('legacy flagged metrics remain fatal when diagnostic evidence fields are absent', async (t) => {
  const files = await fixture(t);
  await writeFile(files.metrics, JSON.stringify({
    spinePassRate: 1, avgCardCoverage: 1, deterministicLanguageCount: 1, flaggedSampleCount: 1,
    avgRubricScores: { accuracy: 1, coherence: 1, agency: 1, compassion: 1 },
    perSample: [{ id: 'legacy-claim', issueFlags: ['deterministic-language'], deterministicLanguage: true }]
  }));
  const result = gate(files.metrics);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /legacy-claim/);
  assert.doesNotMatch(result.stderr, /TypeError/);
});
