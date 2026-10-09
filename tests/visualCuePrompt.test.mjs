import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildVisualCuePrompt } from '../shared/generation/visualCuePrompt.js';
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
