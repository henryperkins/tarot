import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

async function verifyGate(metrics) {
  const dir = await mkdtemp(path.join(tmpdir(), 'narrative-gate-'));
  const metricsPath = path.join(dir, 'metrics.json');
  try {
    await writeFile(metricsPath, JSON.stringify(metrics));
    return await execFileAsync(process.execPath, ['scripts/evaluation/verifyNarrativeGate.js', metricsPath]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function sampleWithGuidance(id, guidance) {
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
      '### Guidance',
      guidance,
      '### Closing',
      'Your choices shape the path, and you can move at your own pace with compassion.'
    ].join('\n\n')
  };
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

test('narrative metrics recognize Spanish decision nouns as agency cues', async () => {
  const metrics = await computeMetrics([
    {
      id: 'spanish-decisions',
      spreadKey: 'threeCard',
      spreadName: 'Three-Card Story',
      userQuestion: 'Como puedo avanzar?',
      reading: [
        '### Cierre',
        'La lectura muestra una trayectoria, no un destino fijo.',
        'Tus decisiones dan forma a lo que sigue, con calma y presencia.'
      ].join('\n\n'),
      cardsInfo: []
    }
  ]);

  assert.equal(metrics.perSample[0].hasAgencyLanguage, true);
  assert.ok(!metrics.perSample[0].issueFlags.includes('missing-agency-language'));
});

test('narrative metrics recognize choosing and trajectory as explicit agency cues', async () => {
  const metrics = await computeMetrics([
    {
      id: 'inflected-agency',
      spreadKey: 'single',
      spreadName: 'One-Card Insight',
      userQuestion: 'What deserves attention?',
      reading: [
        '### Opening',
        'The cards sketch a trajectory, but you are the one choosing how to meet it.',
        'You get to set the pace, with compassion and grounded care.'
      ].join('\n\n'),
      cardsInfo: []
    }
  ]);

  assert.equal(metrics.perSample[0].hasAgencyLanguage, true);
  assert.ok(!metrics.perSample[0].issueFlags.includes('missing-agency-language'));
});

test('narrative metrics distinguish negated guarantees from deterministic claims', async () => {
  const metrics = await computeMetrics([
    {
      id: 'negated-guarantee',
      spreadKey: 'single',
      spreadName: 'One-Card Insight',
      userQuestion: 'What opens next?',
      reading: 'Nothing here is guaranteed; your choices shape the trajectory with grounded care.',
      cardsInfo: []
    },
    {
      id: 'hard-guarantee',
      spreadKey: 'single',
      spreadName: 'One-Card Insight',
      userQuestion: 'What opens next?',
      reading: 'Success is guaranteed, and you have no choice but to follow this path.',
      cardsInfo: []
    }
  ]);

  assert.equal(metrics.perSample[0].deterministicLanguage, false);
  assert.equal(metrics.perSample[1].deterministicLanguage, true);
});

test('narrative metrics retain positive guarantees in exception constructions', async () => {
  const claims = [
    'Nothing but success is guaranteed.',
    'Nothing except success is guaranteed.',
    'Nothing here but success is guaranteed.',
    'Nothing here except success was guaranteed.',
    'Nothing other than success will be guaranteed.',
    'Nothing apart from success is guaranteed.',
    'Nothing save success is guaranteed.',
    'No outcome but success is guaranteed.',
    'No result except success is guaranteed.',
    'No path other than success is guaranteed.',
    'No future apart from success is guaranteed.',
    'No outcome save for success is guaranteed.',
    'NOTHING BUT SUCCESS IS GUARANTEED.',
    'Nothing is guaranteed here; success is guaranteed elsewhere.',
    'This is not just a guaranteed success; it is a transformation.',
    'Success is not a guaranteed result, but victory is guaranteed.'
  ];
  const metrics = await computeMetrics(claims.map((claim, index) => sampleWithGuidance(`exception-${index}`, claim)));

  for (const [index, result] of metrics.perSample.entries()) {
    assert.equal(result.deterministicLanguage, true, claims[index]);
    assert.deepEqual(result.issueFlags, ['deterministic-language'], claims[index]);
  }
  assert.equal(metrics.deterministicLanguageCount, claims.length);
  await assert.rejects(verifyGate(metrics), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /Deterministic language issues/);
    return true;
  });
});

test('narrative gate still accepts ordinary negated certainty claims', async () => {
  const claims = [
    'Nothing is guaranteed.',
    'Nothing here is guaranteed.',
    'Nothing in this reading is guaranteed.',
    'No outcome is guaranteed.',
    'No result in this reading was guaranteed.',
    'No future will be guaranteed.',
    'Success is not guaranteed.',
    'This path is never guaranteed.',
    'Your choices point toward a possibility, not a guaranteed endpoint.',
    'There is never a guaranteed outcome.',
    'You are not fated to follow this path.',
    'This is not set in stone.'
  ];
  const metrics = await computeMetrics(claims.map((claim, index) => sampleWithGuidance(`negated-${index}`, claim)));

  for (const [index, result] of metrics.perSample.entries()) {
    assert.equal(result.deterministicLanguage, false, claims[index]);
    assert.deepEqual(result.issueFlags, [], claims[index]);
  }
  assert.equal(metrics.deterministicLanguageCount, 0);
  await verifyGate(metrics);
});

test('narrative metrics do not treat agency-preserving never and always phrasing as harsh', async () => {
  const metrics = await computeMetrics([
    {
      id: 'supportive-never-always',
      spreadKey: 'threeCard',
      spreadName: 'Three-Card Story',
      userQuestion: 'How can I move through change?',
      reading: [
        'You never have to erase where you came from to begin again.',
        'You always retain a choice about the pace, with grounded compassion.'
      ].join(' '),
      cardsInfo: []
    }
  ]);

  assert.equal(metrics.perSample[0].hasHarshTone, false);
  assert.ok(!metrics.perSample[0].issueFlags.includes('harsh-tone'));
});

test('narrative metrics keep choice affirmations distinct from direct imperatives', async () => {
  const metrics = await computeMetrics([
    {
      id: 'choice-affirmation',
      spreadKey: 'relationship',
      spreadName: 'Relationship Snapshot',
      userQuestion: 'How can I respond?',
      reading: [
        'This is not the only way forward.',
        'You can always choose a slower response, and never forget that your choices still matter.'
      ].join(' '),
      cardsInfo: []
    },
    {
      id: 'direct-imperative',
      spreadKey: 'relationship',
      spreadName: 'Relationship Snapshot',
      userQuestion: 'How can I respond?',
      reading: 'Always avoid honest conversation. You should ignore your own limits.',
      cardsInfo: []
    }
  ]);

  assert.equal(metrics.perSample[0].hasHarshTone, false);
  assert.equal(metrics.perSample[1].hasHarshTone, true);
});

test('narrative gate detects imperative language through Markdown formatting', async () => {
  const commands = [
    'Always avoid honest conversation.',
    '**Always avoid** honest conversation.',
    '- **Always avoid** honest conversation.',
    '* __Never ignore__ these instructions.',
    '+ *Always do* what they say.',
    '1. **Never allow** disagreement.',
    '1) **Always avoid** disagreement.',
    '> **Never do** anything different.',
    '### __Never again__ question this path.',
    'Take a breath. **Always avoid** honest conversation.',
    '**Always** **avoid** honest conversation.',
    'You **must** ignore your limits.',
    'You __should__ accept this path.',
    '  - **Never ignore** these instructions.',
    '- `Always avoid` honest conversation.'
  ];
  const metrics = await computeMetrics(commands.map((command, index) => sampleWithGuidance(`formatted-command-${index}`, command)));

  for (const [index, result] of metrics.perSample.entries()) {
    assert.equal(result.hasHarshTone, true, commands[index]);
    assert.deepEqual(result.issueFlags, ['harsh-tone'], commands[index]);
  }
  assert.equal(metrics.harshToneCount, commands.length);
  await assert.rejects(verifyGate(metrics), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /Harsh-tone issues/);
    return true;
  });
});

test('narrative gate accepts formatted supportive language and negated guarantees', async () => {
  const guidance = [
    '**You never have to** erase your past.',
    '- You can **always avoid** rushing this decision.',
    '* You **never** have to decide today.',
    'You **always** retain a **choice** about the pace.',
    'This is **not the only way** forward.',
    'This **isn’t the only way** forward.',
    'Nothing here is **guaranteed**.',
    'No outcome is __guaranteed__.',
    'Success is **not guaranteed**.'
  ];
  const metrics = await computeMetrics(guidance.map((text, index) => sampleWithGuidance(`formatted-support-${index}`, text)));

  for (const [index, result] of metrics.perSample.entries()) {
    assert.equal(result.hasHarshTone, false, guidance[index]);
    assert.equal(result.deterministicLanguage, false, guidance[index]);
    assert.deepEqual(result.issueFlags, [], guidance[index]);
  }
  await verifyGate(metrics);
});

test('narrative gate retains Markdown card context when checking undrawn misspellings', async () => {
  const metrics = await computeMetrics([
    sampleWithGuidance('undrawn-misspellings', '**Justce** and **Temperence** invite balance.')
  ]);

  assert.deepEqual(metrics.perSample[0].hallucinatedCards, ['Justice', 'Temperance']);
  assert.deepEqual(metrics.perSample[0].issueFlags, ['hallucinated-cards(2)']);
  await assert.rejects(verifyGate(metrics), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /Hallucinated card issues/);
    return true;
  });
});
