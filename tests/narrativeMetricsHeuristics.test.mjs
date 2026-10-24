import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { analyzeTemplateRepetition } from '../scripts/evaluation/lib/narrativeSignals.js';

const execFileAsync = promisify(execFile);

async function computeMetrics(samples, { includeReview = false } = {}) {
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

  const metrics = JSON.parse(await readFile(metricsOut, 'utf8'));
  return includeReview ? { metrics, reviewQueue: await readFile(reviewOut, 'utf8') } : metrics;
}

async function verifyGate(metrics) {
  const dir = await mkdtemp(path.join(tmpdir(), 'narrative-gate-'));
  const metricsPath = path.join(dir, 'metrics.json');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^NARRATIVE_(?:MIN|MAX)_/.test(key)));
  try {
    await writeFile(metricsPath, JSON.stringify(metrics));
    return await execFileAsync(process.execPath, ['scripts/evaluation/verifyNarrativeGate.js', metricsPath], { env });
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

function sampleWithTone(id, tone) {
  return {
    id,
    spreadKey: 'single',
    spreadName: 'One-Card Insight',
    userQuestion: 'What deserves attention?',
    cardsInfo: [{ card: 'The Fool', position: 'Present', orientation: 'Upright' }],
    reading: [
      '### Opening',
      'This reading explores what deserves attention.',
      '### The Fool — Present',
      '**The Fool** suggests a fresh beginning. Because starting small can reveal what works, you can choose one reversible step before going further.',
      '### Guidance', tone,
      '### Closing',
      'Your decisions shape the path ahead.'
    ].join('\n\n')
  };
}

test('narrative gate accepts the saved transition reading without base-form tone keywords', async () => {
  // Preserve the reading that failed the 2026-10-20 subscription gate verbatim.
  const sample = JSON.parse(await readFile(new URL('./fixtures/narrative-supportive-transition.json', import.meta.url), 'utf8'));
  const metrics = await computeMetrics([sample]);

  assert.equal(metrics.perSample[0].hasSupportiveTone, true);
  assert.deepEqual(metrics.perSample[0].rubric, { accuracy: 1, coherence: 1, agency: 1, compassion: 1 });
  assert.deepEqual(metrics.perSample[0].issueFlags, []);
  assert.equal(metrics.missingSupportiveToneCount, 0);
  assert.equal(metrics.flaggedSampleCount, 0);
  await verifyGate(metrics);
});

test('narrative tone recognition accepts ordinary forms of existing supportive cues', async () => {
  const cues = [
    'A gentle pace may help.',
    'Move **gently** as you begin.',
    'Meet this moment with gentleness.',
    'Invite yourself to pause.',
    'This invites you to pause.',
    'You are invited to pause.',
    'This is inviting you to pause.',
    'You retain a choice about the pace.',
    'Your choices about the pace matter.'
  ];
  const metrics = await computeMetrics(cues.map((cue, index) => sampleWithTone(`supportive-form-${index}`, cue)));

  for (const [index, result] of metrics.perSample.entries()) {
    assert.equal(result.hasSupportiveTone, true, cues[index]);
    assert.equal(result.rubric.compassion, 1, cues[index]);
    assert.deepEqual(result.issueFlags, [], cues[index]);
  }
  await verifyGate(metrics);
});

test('narrative gate still rejects missing supportive tone and unrelated word fragments', async () => {
  const neutralPhrases = [
    'Name one reversible step.',
    'A gentleman waits by the door.',
    'The room looks uninviting.',
    'The organizer disinvited a guest.',
    'The choicest date appears on the calendar.'
  ];

  for (const [index, phrase] of neutralPhrases.entries()) {
    const metrics = await computeMetrics([sampleWithTone(`unsupported-form-${index}`, phrase)]);
    assert.equal(metrics.perSample[0].hasAgencyLanguage, true, phrase);
    assert.equal(metrics.perSample[0].hasSupportiveTone, false, phrase);
    assert.equal(metrics.perSample[0].rubric.compassion, 0, phrase);
    assert.deepEqual(metrics.perSample[0].issueFlags, ['missing-supportive-tone'], phrase);
    await assert.rejects(verifyGate(metrics), (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /Missing supportive tone issues 1 > limit 0/);
      return true;
    });
  }
});

test('newly recognized supportive cues do not bypass harsh, deterministic or agency failures', async () => {
  const cases = [
    { tone: 'Move gently. You must ignore your limits.', flag: 'harsh-tone', gateFailure: /Harsh-tone issues 1 > limit 0/ },
    { tone: 'Your choices matter. Success is guaranteed.', flag: 'deterministic-language', gateFailure: /Deterministic language issues 1 > limit 0/ },
    { tone: 'This is inviting you to pause.', flag: 'missing-agency-language', gateFailure: /Missing agency language issues 1 > limit 0/, removeAgency: true }
  ];

  for (const { tone, flag, gateFailure, removeAgency } of cases) {
    const sample = sampleWithTone(`supportive-with-${flag}`, tone);
    if (removeAgency) {
      sample.reading = sample.reading.replace('you can choose', 'you can take').replace('Your decisions shape the path ahead.', 'The path remains open.');
    }
    const metrics = await computeMetrics([sample]);
    assert.equal(metrics.perSample[0].hasSupportiveTone, true, flag);
    assert.deepEqual(metrics.perSample[0].issueFlags, [flag]);
    await assert.rejects(verifyGate(metrics), (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, gateFailure);
      return true;
    });
  }
});

test('narrative gate rejects denied choice in both singular and plural forms', async () => {
  for (const claim of ['You have no choice.', 'You have no choices.']) {
    const metrics = await computeMetrics([sampleWithTone('denied-choice', claim)]);
    assert.equal(metrics.perSample[0].hasSupportiveTone, true, claim);
    assert.equal(metrics.perSample[0].deterministicLanguage, true, claim);
    assert.equal(metrics.perSample[0].hasHarshTone, true, claim);
    assert.deepEqual(metrics.perSample[0].issueFlags, ['deterministic-language', 'harsh-tone'], claim);
    await assert.rejects(verifyGate(metrics), (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /Deterministic language issues 1 > limit 0/);
      assert.match(error.stderr, /Harsh-tone issues 1 > limit 0/);
      return true;
    });
  }
});

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

test('narrative metrics recognize affirmative decisions shaping the outcome', async () => {
  const readings = [
    'Your decisions about when and how to share this work are what shape where it goes from here.',
    'Your decisions shape the path ahead.',
    'Your decisions influence the direction of this project.',
    'Your decisions can influence the direction.'
  ];
  const metrics = await computeMetrics(readings.map((reading, index) => ({
    id: `affirmative-decisions-${index}`, spreadKey: 'single', reading, cardsInfo: []
  })));

  assert.equal(metrics.missingAgencyCount, 0);
  for (const [index, sample] of metrics.perSample.entries()) {
    assert.equal(sample.hasAgencyLanguage, true, readings[index]);
    assert.ok(!sample.issueFlags.includes('missing-agency-language'), readings[index]);
  }
});

test('decision agency detection rejects bare mentions, negation and fatalistic contexts', async () => {
  const readings = [
    'Decisions are difficult.',
    'Your decisions cannot shape what happens.',
    "Your decisions can't shape what happens.",
    'Your decisions can’t shape what happens.',
    'Your decisions are not what shape what follows.',
    'Your decisions about timing never are what shape the outcome.',
    'Your decisions shape nothing; destiny determines the outcome.',
    'Nobody believes your decisions shape what comes next.',
    'Your decisions. Fate shapes your future.',
    'Fate, not your decisions, is what shapes the outcome.',
    'Your decisions about timing are powerless to shape the outcome.',
    'It is a myth that your decisions shape the future.',
    'Your decisions about timing are what shape nothing.',
    "Your decisions about timing aren't what shape what follows.",
    'Your decisions about timing guide nobody.',
    "Your decisions about timing can't shape what happens.",
    'Your decisions about timing can’t shape what happens.',
    "Your decisions about timing won't shape what happens.",
    'Your decisions about timing won’t shape what happens.',
    'Your decisions about timing are meaningless because the cards shape what happens.',
    'Your decisions about sharing the work are unimportant because outside forces guide the outcome.',
    'Your decisions about when to share this work are meaningless because the cards shape what happens.',
    'Your decisions about when to share this work are unimportant because outside forces are what shape the outcome.',
    'Your decisions about how to share this work are not what shape the outcome.'
  ];
  const metrics = await computeMetrics(readings.map((reading, index) => ({
    id: `non-agency-decisions-${index}`, spreadKey: 'single', reading, cardsInfo: []
  })));

  assert.equal(metrics.missingAgencyCount, readings.length);
  for (const [index, sample] of metrics.perSample.entries()) {
    assert.equal(sample.hasAgencyLanguage, false, readings[index]);
    assert.ok(sample.issueFlags.includes('missing-agency-language'), readings[index]);
  }
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
    'Success is not a guaranteed result, but victory is guaranteed.',
    "This isn't just a guaranteed success; it is a transformation.",
    'This isn’t just a guaranteed success; it is a transformation.',
    "Success isn't a guaranteed result, but victory is guaranteed.",
    'Success isn’t a guaranteed result, but victory is guaranteed.'
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

test('narrative gate accepts ordinary negated certainty including copular contractions', async () => {
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
    'This is not set in stone.',
    "The likely outcome isn't a guaranteed yes but an expanded sense of authorship.",
    'The likely outcome isn’t a guaranteed yes but an expanded sense of authorship.',
    "These outcomes aren't guaranteed.",
    'These outcomes aren’t guaranteed.',
    "The result wasn't guaranteed.",
    'The result wasn’t guaranteed.',
    "The outcomes weren't guaranteed.",
    'The outcomes weren’t guaranteed.'
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

test('narrative gate accepts literal cup imagery without inventing a Page of Cups', async () => {
  const metrics = await computeMetrics([
    sampleWithGuidance('literal-cups', 'That pair of cups works as a brief for your question: receive what comes, then ground it.')
  ]);

  assert.deepEqual(metrics.perSample[0].hallucinatedCards, []);
  await verifyGate(metrics);
});

test('narrative gate rejects an incorrect explicit suit count and explains it in the review queue', async () => {
  const sample = {
    id: 'incorrect-cups-count',
    spreadKey: 'threeCard',
    spreadName: 'Three-Card Story',
    userQuestion: 'What deserves attention?',
    cardsInfo: [
      { position: 'Past', card: 'Five of Cups', suit: 'Cups', orientation: 'Upright' },
      { position: 'Present', card: 'Six of Cups', suit: 'Cups', orientation: 'Upright' },
      { position: 'Future', card: 'Eight of Cups', suit: 'Cups', orientation: 'Upright' }
    ],
    reading: [
      '### Opening',
      'These four Cups cards invite gentle attention to your emotional life.',
      '### Past — Five of Cups',
      '**Five of Cups** suggests grief over what has changed. Because loss can narrow your focus, you can choose to name what remains alongside what you miss.',
      '### Present — Six of Cups',
      '**Six of Cups** brings a memory of familiar support. This is a reminder that you can consider reaching out to someone who knows your history and respects your pace.',
      '### Future — Eight of Cups',
      '**Eight of Cups** points toward leaving an unsatisfying pattern. Since your needs may have shifted, a small reversible experiment can help you explore a different direction.',
      '### Closing',
      'Your choices shape the path, and you can move at your own pace with compassion.'
    ].join('\n\n')
  };
  const { metrics, reviewQueue } = await computeMetrics([sample], { includeReview: true });

  assert.deepEqual(metrics.perSample[0].suitCountMismatches, [{ suit: 'Cups', claimed: 4, actual: 3 }]);
  assert.deepEqual(metrics.perSample[0].issueFlags, ['suit-count-mismatch(1)']);
  assert.equal(metrics.suitCountMismatchCount, 1);
  assert.equal(metrics.flaggedSampleCount, 1);
  assert.match(reviewQueue, /Suit count mismatch: Cups claimed 4, actual 3/);
  await assert.rejects(verifyGate(metrics), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /Suit count mismatch issues 1 > limit 0/);
    return true;
  });

  const accurate = await computeMetrics([{
    ...sample,
    id: 'accurate-cups-count',
    reading: sample.reading.replace('four Cups cards', 'three Cups cards')
  }]);
  assert.deepEqual(accurate.perSample[0].suitCountMismatches, []);
  assert.deepEqual(accurate.perSample[0].issueFlags, []);
  assert.equal(accurate.suitCountMismatchCount, 0);
  await verifyGate(accurate);
});

test('narrative gate checks suit counts independently and accepts metrics predating the field', async () => {
  const metrics = await computeMetrics([
    sampleWithGuidance('legacy-metrics', 'You can consider one gentle step today.')
  ]);
  delete metrics.suitCountMismatchCount;
  for (const sample of metrics.perSample) delete sample.suitCountMismatches;
  await verifyGate(metrics);

  await assert.rejects(verifyGate({ ...metrics, suitCountMismatchCount: 1 }), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /Suit count mismatch issues 1 > limit 0/);
    return true;
  });
});

test('narrative gate rejects a templated reading that covers every card but ignores the question', async () => {
  const section = (heading, card) => [
    `### ${heading}`,
    `**${card}** is present here. This energy invites you to consider your choices with gentle curiosity, because it shows what is happening now. Consider what this invites you to do next.`
  ].join('\n\n');
  const metrics = await computeMetrics([
    {
      id: 'templated-no-question',
      spreadKey: 'threeCard',
      spreadName: 'Three-Card Story',
      userQuestion: 'How can I navigate the transition after leaving my hometown?',
      cardsInfo: [
        { position: 'Past — influences that led here', card: 'Six of Cups', orientation: 'Reversed' },
        { position: 'Present — where you stand now', card: 'The Tower', orientation: 'Upright' },
        { position: 'Future — trajectory if nothing shifts', card: 'The Star', orientation: 'Upright' }
      ],
      reading: [
        '### Opening',
        'This reading invites you to consider your choices with gentle curiosity and to ground yourself in what matters.',
        section('Past — influences that led here', 'Six of Cups Reversed'),
        section('Present — where you stand now', 'The Tower Upright'),
        section('Future — trajectory if nothing shifts', 'The Star Upright'),
        '### Closing',
        'Your choices shape what unfolds; nothing here is fixed.'
      ].join('\n\n')
    }
  ]);

  const [result] = metrics.perSample;
  assert.deepEqual(result.rubric, { accuracy: 1, coherence: 1, agency: 1, compassion: 1 });
  assert.deepEqual(result.issueFlags, ['question-not-addressed', 'templated-repetition']);
  assert.equal(metrics.questionNotAddressedCount, 1);
  assert.equal(metrics.templatedRepetitionCount, 1);
  await assert.rejects(verifyGate(metrics), (error) => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /Readings not engaging the question 1/);
    assert.match(error.stderr, /Templated card sections 1/);
    return true;
  });
});

test('narrative metrics credit inflected question terms and distinct card sections', async () => {
  const metrics = await computeMetrics([
    {
      id: 'engaged-reading',
      spreadKey: 'threeCard',
      spreadName: 'Three-Card Story',
      userQuestion: 'How can I navigate the transition after leaving my hometown?',
      cardsInfo: [
        { position: 'Past', card: 'Six of Cups', orientation: 'Reversed' },
        { position: 'Present', card: 'The Tower', orientation: 'Upright' },
        { position: 'Future', card: 'The Star', orientation: 'Upright' }
      ],
      reading: [
        '### Past — **Six of Cups Reversed**',
        'Leaving the town you grew up in can make memory feel sharper than the present, because the old streets still hold your sense of home.',
        '### Present — **The Tower Upright**',
        'The move has shaken familiar structures, so this transitional season asks for gentleness rather than a perfect plan.',
        '### Future — **The Star Upright**',
        'Hope returns as you choose small rituals that make the new place yours, one grounded step at a time.'
      ].join('\n\n')
    }
  ]);

  const [result] = metrics.perSample;
  assert.equal(result.questionEngagement.applicable, true);
  assert.equal(result.questionEngagement.addressed, true);
  assert.equal(result.templateRepetition.templated, false);
  assert.ok(!result.issueFlags.includes('question-not-addressed'));
  assert.ok(!result.issueFlags.includes('templated-repetition'));
});

test('template repetition recognizes Thoth and Marseille card names', () => {
  const section = (card) => [
    `${card} is present here and asks for a steady look.`,
    'This energy invites you to consider your choices with gentle curiosity.',
    `Consider what ${card} invites you to do next with your week.`
  ].join(' ');

  for (const [deckStyle, cards] of [
    ['rws-1909', ['Strength', 'Justice', 'Temperance']],
    ['thoth-a1', ['Lust', 'Adjustment', 'Art']],
    ['thoth-a1', ['Princess of Disks', 'The Magus', 'Fortune']],
    ['marseille-classic', ['La Force', 'La Justice', 'Tempérance']],
    ['marseille-classic', ['Valet of Coins', 'Le Bateleur', "L'Étoile"]]
  ]) {
    const result = analyzeTemplateRepetition(cards.map(section).join('\n\n'), { deckStyle });
    assert.equal(result.repeatedSentenceCount, 9, `${deckStyle}: ${cards.join(', ')}`);
    assert.equal(result.templated, true, `${deckStyle}: ${cards.join(', ')}`);
  }
});

test('template repetition leaves lowercase words that double as Thoth titles alone', () => {
  const reading = [
    'You deserve peace after a long season of effort and worry today.',
    'You deserve love after a long season of effort and worry today.',
    'You deserve rest after a long season of effort and worry today.'
  ].join(' ');
  assert.equal(analyzeTemplateRepetition(reading, { deckStyle: 'thoth-a1' }).repeatedSentenceCount, 0);
});

test('narrative metrics and its gate reject one affirmative undrawn assertion with a distinct field', async () => {
  const metrics = await computeMetrics([sampleWithGuidance('affirmative-undrawn-review', 'The Moon appears in your spread. You can consider a gentle pause.')]);
  assert.deepEqual(metrics.perSample[0].undrawnCardAssertions, ['The Moon']);
  assert.equal(metrics.undrawnCardAssertionCount, 1);
  assert.ok(metrics.perSample[0].issueFlags.includes('undrawn-card-assertion(1)'));
  await assert.rejects(verifyGate(metrics), error => {
    assert.match(error.stderr, /Undrawn card assertion/);
    return true;
  });
});
