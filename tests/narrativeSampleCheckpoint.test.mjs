import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateWithClaudeApi } from '../functions/lib/narrativeBackends.js';
import * as batch from '../scripts/evaluation/lib/narrativeSampleCheckpoint.js';

test('a rejected raw completion and all earlier outputs survive a stopped qualification batch', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'tarot-scene-checkpoint-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const outputPath = path.join(directory, 'samples.json');
  const badRaw = '{"format":"card-scenes-v1","blocks":[';
  const first = { id: 'one', reading: 'Accepted symbolic text.', rawReading: 'Original model text 一', model: 'test' };
  let laterCaseStarted = false;
  await assert.rejects(batch.generateSamplesWithCheckpoint([{ id: 'one' }, { id: 'two' }, { id: 'three' }], async sample => {
    if (sample.id === 'one') return first;
    if (sample.id === 'three') laterCaseStarted = true;
    return generateWithClaudeApi({ GRAPHRAG_ENABLED: 'false' }, {
      cardsInfo: [{ card: 'The Hierophant', number: 5, position: 'Focus', orientation: 'Upright', meaning: 'Learning.' }],
      analysis: { spreadKey: 'single', themes: {} }, spreadInfo: { key: 'single', name: 'One-Card Insight' },
      deckStyle: 'rws-1909', userQuestion: 'What can a practice offer?'
    }, 'checkpoint-failure', { send: async () => ({ text: badRaw, model: 'claude-opus-5-5', usage: {} }) });
  }, outputPath), { code: 'invalid_card_fact_reference' });
  const saved = JSON.parse(await readFile(batch.checkpointPathFor(outputPath), 'utf8'));
  assert.equal(saved.status, 'failed');
  assert.deepEqual(saved.samples, [first]);
  assert.equal(saved.failedSample.id, 'two');
  assert.equal(saved.failedSample.rawReading, badRaw);
  assert.equal(saved.failedSample.error.code, 'invalid_card_fact_reference');
  assert.equal(laterCaseStarted, false);
});

test('each successful checkpoint preserves the complete original output records', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'tarot-scene-success-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const outputPath = path.join(directory, 'samples.json');
  const expected = [{ id: 'one', reading: 'First.', rawReading: '{"original":"一"}' }, { id: 'two', reading: 'Second.', rawReading: 'Original two.' }];
  const generated = await batch.generateSamplesWithCheckpoint(expected, async sample => {
    if (sample.id === 'two') {
      const previous = JSON.parse(await readFile(batch.checkpointPathFor(outputPath), 'utf8'));
      assert.deepEqual(previous.samples, [expected[0]]);
    }
    return sample;
  }, outputPath);
  assert.deepEqual(generated, expected);
  assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')).samples, expected);
});

test('an authentication failure before any completion creates no usable sample output', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'tarot-no-completion-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const outputPath = path.join(directory, 'samples.json');
  await assert.rejects(batch.generateSamplesWithCheckpoint([{ id: 'one' }], async () => {
    throw new Error('Subscription login unavailable');
  }, outputPath), /Subscription login unavailable/);
  await assert.rejects(readFile(outputPath), { code: 'ENOENT' });
  await assert.rejects(readFile(batch.checkpointPathFor(outputPath)), { code: 'ENOENT' });
});

test('a failed batch leaves the previous complete corpus at the output path untouched', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'tarot-corpus-preserved-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const outputPath = path.join(directory, 'samples.json');
  const corpus = JSON.stringify({ sampleCount: 11, samples: [{ id: 'qualified' }] });
  await writeFile(outputPath, corpus);
  await assert.rejects(batch.generateSamplesWithCheckpoint([{ id: 'one' }, { id: 'two' }], async sample => {
    if (sample.id === 'two') throw new Error('Request timed out.');
    return { id: sample.id, reading: 'Paid completion.' };
  }, outputPath), /Request timed out/);
  assert.equal(await readFile(outputPath, 'utf8'), corpus, 'partial samples must not replace the qualified corpus');
  const checkpoint = JSON.parse(await readFile(batch.checkpointPathFor(outputPath), 'utf8'));
  assert.equal(checkpoint.status, 'failed');
  assert.deepEqual(checkpoint.samples.map(sample => sample.id), ['one'], 'the paid completion survives in the sidecar');
});
