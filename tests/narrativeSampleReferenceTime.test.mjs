import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';

const execute = promisify(execFile);
const fixture = (id, referenceTime) => ({
  id, referenceTime, spreadKey: 'single', deckStyle: 'rws-1909',
  userQuestion: 'What can support a focused week?', reflectionsText: '',
  cards: [{ name: 'The Sun', orientation: 'Upright' }], memories: []
});

async function runCorpus(t, cases) {
  const directory = await mkdtemp(path.join(tmpdir(), 'tarot-sample-time-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = path.join(directory, 'fixtures.json');
  const output = path.join(directory, 'samples.json');
  await writeFile(input, JSON.stringify({ referenceTime: '2026-10-20T16:00:00.000Z', cases }));
  await execute(process.execPath, ['scripts/evaluation/runNarrativeSamples.js', '--fixtures', input,
    '--out', output, '--backend', 'local-composer', '--env-profile', 'shell'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, GRAPHRAG_ENABLED: 'false', ENABLE_SEMANTIC_SCORING: 'false' },
    maxBuffer: 1024 * 1024
  });
  return JSON.parse(await readFile(output, 'utf8'));
}

test('fixture sample exports the actual reference time used rather than the CLI default', async t => {
  const referenceTime = '2026-10-22T16:00:00.000Z';
  const output = await runCorpus(t, [fixture('actual-clock', referenceTime)]);
  assert.equal(output.referenceTime, referenceTime);
  assert.equal(output.samples[0].referenceTime, referenceTime);
});

test('mixed fixture clocks remain explicit per sample and have no invented common clock', async t => {
  const clocks = ['2026-10-21T16:00:00.000Z', '2026-10-22T16:00:00.000Z'];
  const output = await runCorpus(t, clocks.map((time, index) => fixture(`clock-${index}`, time)));
  assert.equal(output.referenceTime, null);
  assert.deepEqual(output.referenceTimes, clocks);
  assert.deepEqual(output.samples.map(sample => sample.referenceTime), clocks);
});
