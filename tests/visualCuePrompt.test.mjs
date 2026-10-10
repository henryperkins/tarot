import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildVisualCuePrompt } from '../shared/generation/visualCuePrompt.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js';
import { visualCueResponseSchema } from '../shared/contracts/visualCueBatches.js';

const SAMPLE_CARDS = [
  { index: 0, canonicalName: 'The Star', detailIds: ['pool-pour', 'land-pour'] },
  { index: 1, canonicalName: 'The Hermit', detailIds: ['lantern', 'rocky-path'] }
];

test('buildVisualCuePrompt generates prompt with cards, supported details, and exact raw text', () => {
  const prompt = buildVisualCuePrompt({
    rawPrefix: 'A figure pours one pitcher into a pool. The lantern shines bright.',
    cards: SAMPLE_CARDS,
    artworkEdition: 'rws-immanuelle-vector',
    question: 'How do I proceed?'
  });

  assert.ok(prompt.systemPrompt, 'systemPrompt should exist');
  assert.ok(prompt.userPrompt, 'userPrompt should exist');
  assert.match(prompt.systemPrompt, /proposal/i);
  assert.match(prompt.systemPrompt, /do not rewrite/i);
  assert.match(prompt.userPrompt, /The Star/);
  assert.match(prompt.userPrompt, /pool-pour/);
  assert.match(prompt.userPrompt, /The Hermit/);
  assert.match(prompt.userPrompt, /lantern/);
  assert.match(prompt.userPrompt, /A figure pours one pitcher into a pool/);
  assert.match(prompt.userPrompt, /How do I proceed\?/);
});

test('buildVisualCuePrompt supplies prior accepted literals with their application IDs', () => {
  const priorCues = [
    {
      id: 'vc:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      kind: 'literal',
      quote: 'A figure pours one pitcher into a pool.',
      targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }]
    }
  ];

  const prompt = buildVisualCuePrompt({
    rawPrefix: 'A figure pours one pitcher into a pool. That water represents renewal.',
    cards: SAMPLE_CARDS,
    artworkEdition: 'rws-immanuelle-vector',
    priorAcceptedCues: priorCues
  });

  assert.match(prompt.userPrompt, /vc:0123456789abcdef/);
  assert.match(prompt.userPrompt, /acceptedCueId/);
});

test('visual cue instructions never pollute or touch the narrative reading schema', () => {
  const prompt = buildVisualCuePrompt({
    rawPrefix: 'Text here',
    cards: SAMPLE_CARDS,
    artworkEdition: 'rws-immanuelle-vector'
  });

  assert.doesNotMatch(prompt.systemPrompt, /tarot-reading/);
  // Response schema parses valid proposal envelopes
  const sampleValid = {
    proposals: [
      {
        localAlias: 'p1',
        kind: 'literal',
        quote: 'Text here',
        targets: [{ spreadIndex: 0, detailIds: ['pool-pour'] }]
      }
    ]
  };
  const parseResult = visualCueResponseSchema.safeParse(sampleValid);
  assert.ok(parseResult.success);
});

test('unindexed input cards receive distinct occurrence indexes and empty geometry stays identity-only', () => {
  const prompt = buildVisualCuePrompt({ rawPrefix: 'Two cards in an unfamiliar edition.', artworkEdition: 'marseille',
    cards: [{ card: 'The Star' }, { card: 'The Hermit' }] });
  assert.match(prompt.userPrompt, /Card #0: "The Star"/);
  assert.match(prompt.userPrompt, /Card #1: "The Hermit"/);
  assert.match(prompt.userPrompt, /Supported details: none/);
  assert.match(prompt.systemPrompt, /identity-only cues/);
});

test('independent prompt preserves occurrence-specific position, orientation and optional reflection', () => {
  const note = 'I keep saying "later", even when I want to begin.';
  const prompt = buildVisualCuePrompt({ rawPrefix: 'The Hermit raises his lantern.', cards: [
    { ...SAMPLE_CARDS[1], index: 0, position: 'Challenge', orientation: 'Reversed', userReflection: note },
    { ...SAMPLE_CARDS[1], index: 1, position: 'Support', orientation: 'Upright' }
  ] });
  assert.match(prompt.userPrompt, /Position: "Challenge"; Orientation: Reversed/);
  assert.match(prompt.userPrompt, /Position: "Support"; Orientation: Upright/);
  assert.ok(prompt.userPrompt.includes(`Card #0 reflection: ${JSON.stringify(note)}`));
  assert.doesNotMatch(prompt.userPrompt, /Card #1 reflection:/);
  assert.match(prompt.systemPrompt, /card-reflection.*spreadIndex/);
});

test('annotation prompt requests source-ordered non-overlapping physical evidence and preserves source language', () => {
  const prompt = buildVisualCuePrompt({ rawPrefix: 'El Ermitaño sostiene un farol.', cards: SAMPLE_CARDS });
  assert.match(prompt.systemPrompt, /non-overlapping/);
  assert.match(prompt.systemPrompt, /source order/);
  assert.match(prompt.systemPrompt, /negated|imagined/);
  assert.match(prompt.systemPrompt, /Do not translate/);
  assert.match(prompt.userPrompt, /El Ermitaño sostiene un farol\./);
});

// These regressions exercise serialized model inputs, not semantic model output.
test('caller detail claims are intersected with trusted card ownership and deduplicated', () => {
  const { userPrompt } = buildVisualCuePrompt({ cards: [
    { canonicalName: 'The Star', detailIds: ['pool-pour', 'lantern', 'pool-pour', 'imaginary'] },
    { canonicalName: 'The Hermit', detailIds: ['pool-pour', 'lantern'] },
    { canonicalName: 'Unknown Card', detailIds: ['lantern'] }
  ] });
  const lines = userPrompt.split('\n').filter(line => line.startsWith('- Card #'));
  assert.match(lines[0], /Supported details: pool-pour\)/);
  assert.match(lines[1], /Supported details: lantern\)/);
  assert.match(lines[2], /Supported details: none\)/);
});

test('unsupported editions reject caller-supplied RWS geometry on every occurrence', () => {
  for (const artworkEdition of ['marseille', 'identity:thoth', 'unknown']) {
    const { userPrompt } = buildVisualCuePrompt({ artworkEdition, cards: SAMPLE_CARDS });
    assert.doesNotMatch(userPrompt, /pool-pour|land-pour|lantern|rocky-path/);
    assert.equal(userPrompt.match(/Supported details: none/g)?.length, 2);
  }
});

test('exact Markdown and UTF-16 raw source are retained without trimming or repairs', () => {
  const rawPrefix = '  🌟 **The Star**\r\n"""\nWater pours\tonto land.  ';
  const { userPrompt } = buildVisualCuePrompt({ rawPrefix });
  const marker = '\nReading Text to Analyze:\n"""\n';
  const start = userPrompt.indexOf(marker) + marker.length;
  assert.equal(userPrompt.slice(start, start + rawPrefix.length), rawPrefix);
});

test('prior literal IDs, target occurrences and exact quoted Markdown survive serialization', () => {
  const id = `vc:${'a'.repeat(64)}`;
  const quote = '🌟 "water"\n**pool**\\';
  const { userPrompt } = buildVisualCuePrompt({ priorAcceptedCues: [
    { id, kind: 'literal', passage: { quote }, targets: [{ spreadIndex: 3, detailIds: ['pool-pour'] }] },
    { id: 'not-literal', kind: 'identity', targets: [] }
  ] });
  assert.ok(userPrompt.includes(JSON.stringify(id)));
  assert.ok(userPrompt.includes(JSON.stringify(quote)));
  assert.match(userPrompt, /#3 \[pool-pour\]/);
  assert.doesNotMatch(userPrompt, /not-literal/);
});

test('supplied question, legacy per-card reflections and Overall notes preserve exact context', () => {
  const question = '  Begin "now"?\n🌟  ';
  const cardNote = ' I fear "later".\n ';
  const overall = ' I want to keep \\ going. ';
  const { userPrompt } = buildVisualCuePrompt({ question, cards: [
    { canonicalName: 'The Star', spreadIndex: 2, reflection: cardNote },
    { canonicalName: 'The Hermit', spreadIndex: 7 }
  ], reflections: { Overall: overall, 7: ' Seven stays seven. ', Legacy: ' Other note. ' } });
  assert.ok(userPrompt.includes(JSON.stringify(question)));
  assert.ok(userPrompt.includes(`Card #2 reflection: ${JSON.stringify(cardNote)}`));
  assert.ok(userPrompt.includes(`Card #7 reflection: ${JSON.stringify(' Seven stays seven. ')}`));
  assert.ok(userPrompt.includes(`Overall: ${JSON.stringify(overall)}`));
  assert.ok(userPrompt.includes(`Legacy: ${JSON.stringify(' Other note. ')}`));
  assert.doesNotMatch(userPrompt, /\[object Object\]/);
});

test('absent context is omitted even when reading prose mentions a reflection', () => {
  const { userPrompt } = buildVisualCuePrompt({ rawPrefix: 'Your reflection suggests renewal.',
    cards: SAMPLE_CARDS, question: null, reflections: null });
  assert.doesNotMatch(userPrompt, /User Question:|User Reflections:|Card-specific reflections/);
});

test('narrative builder excludes annotation catalogs, proposal schema and cue metadata', () => {
  const options = { spreadInfo: { key: 'single', name: 'Single Card', positions: ['Theme'] },
    cardsInfo: [{ card: 'The Star', position: 'Theme', orientation: 'Upright', meaning: 'Renewal' }],
    userQuestion: 'How do I proceed?', themes: {}, context: {},
    promptBudgetEnv: { GRAPHRAG_ENABLED: false } };
  const clean = buildEnhancedClaudePrompt(options);
  const withVisualMetadata = buildEnhancedClaudePrompt({ ...options,
    cardsInfo: [{ ...options.cardsInfo[0], detailIds: ['pool-pour', 'land-pour'] }],
    visualCueSchema: visualCueResponseSchema, priorAcceptedCues: [{ localAlias: 'visual-only-alias' }] });
  for (const part of ['systemPrompt', 'userPrompt']) {
    assert.equal(withVisualMetadata[part], clean[part]);
    assert.doesNotMatch(withVisualMetadata[part], /pool-pour|land-pour|localAlias|acceptedCueId|visual-only-alias|Supported details/);
  }
});

test('unknown card names cannot borrow inherited catalog properties or crash the builder', () => {
  for (const canonicalName of ['constructor', '__proto__', 'toString']) {
    const { userPrompt } = buildVisualCuePrompt({ cards: [{ canonicalName, detailIds: ['lantern'] }] });
    assert.match(userPrompt, /Supported details: none\)/);
  }
});
