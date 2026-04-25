import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);

async function computeMetrics(samples) {
  const dir = await mkdtemp(path.join(tmpdir(), 'narrative-metrics-'));
  const input = path.join(dir, 'samples.json');
  const metricsOut = path.join(dir, 'metrics.json');
  const reviewOut = path.join(dir, 'review.csv');

  await writeFile(input, JSON.stringify({ samples }, null, 2));
  await execFileAsync(process.execPath, [
    'scripts/evaluation/computeNarrativeMetrics.js',
    '--in',
    input,
    '--metrics-out',
    metricsOut,
    '--review-out',
    reviewOut
  ]);

  return JSON.parse(await readFile(metricsOut, 'utf8'));
}

test('narrative metrics do not flag neutral never/always phrasing as harsh tone', async () => {
  const metrics = await computeMetrics([
    {
      id: 'neutral-english',
      spreadKey: 'single',
      spreadName: 'One-Card Insight',
      userQuestion: 'How can I move with care?',
      reading: [
        '### Opening',
        'This is a gentle reading about choices and grounded agency.',
        'Some resentment never quite gets named, and growth is not always the more dramatic path.',
        'Consider one small choice that supports self-compassion.'
      ].join('\n\n'),
      cardsInfo: []
    }
  ]);

  assert.equal(metrics.perSample[0].hasHarshTone, false);
  assert.ok(!metrics.perSample[0].issueFlags.includes('harsh-tone'));
});

test('narrative metrics detect Spanish agency and supportive tone cues', async () => {
  const metrics = await computeMetrics([
    {
      id: 'spanish-supportive',
      spreadKey: 'threeCard',
      spreadName: 'Three-Card Story',
      userQuestion: 'Como puedo sostener mi energia?',
      reading: [
        '### Apertura',
        'Esta lectura ofrece pasos suaves para recuperar presencia y cuidar tu energia.',
        'Tus elecciones importan; puedes decidir que si merece tu atencion hoy.',
        'Haz espacio para descanso, calma y un respiro antes de responder.'
      ].join('\n\n'),
      cardsInfo: []
    }
  ]);

  assert.equal(metrics.perSample[0].hasAgencyLanguage, true);
  assert.equal(metrics.perSample[0].hasSupportiveTone, true);
  assert.ok(!metrics.perSample[0].issueFlags.includes('missing-agency-language'));
  assert.ok(!metrics.perSample[0].issueFlags.includes('missing-supportive-tone'));
});
