import assert from 'node:assert/strict';
import test from 'node:test';

import { buildEnhancedClaudePrompt } from '../functions/lib/narrativeBuilder.js';
import { buildVisionEvidencePackets } from '../functions/lib/visionEvidence.js';
import { buildVisionValidationSection } from '../functions/lib/narrative/prompts/visionValidation.js';

const baseCardsInfo = [
  {
    card: 'The Fool',
    number: 0,
    position: 'Past — influences that led here',
    orientation: 'Upright',
    meaning: 'New beginnings, innocence, spontaneity'
  },
  {
    card: 'The Magician',
    number: 1,
    position: 'Present — where you stand now',
    orientation: 'Upright',
    meaning: 'Manifestation, resourcefulness, power'
  },
  {
    card: 'The High Priestess',
    number: 2,
    position: 'Future — trajectory if nothing shifts',
    orientation: 'Reversed',
    meaning: 'Hidden agendas, need to listen to inner voice'
  }
];

const baseSpreadInfo = {
  name: 'Three-Card Story (Past · Present · Future)',
  deckStyle: 'rws-1909'
};

const baseThemes = {
  reversalCount: 1,
  reversalFramework: 'contextual',
  reversalDescription: {
    name: 'Context-Dependent',
    description: 'Reversed cards interpreted based on position and context',
    guidance: 'Read each reversal in light of its position'
  },
  elementalBalance: 'Mixed elemental energies: Air (3)',
  deckStyle: 'rws-1909'
};

const baseSpreadAnalysis = {
  transitions: {
    firstToSecond: { relationship: 'supportive', elements: ['Air', 'Air'] },
    secondToThird: { relationship: 'tension', elements: ['Air', 'Water'] }
  }
};

function buildPrompt(visionInsights) {
  return buildEnhancedClaudePrompt({
    spreadInfo: baseSpreadInfo,
    cardsInfo: baseCardsInfo,
    userQuestion: 'How can I navigate this new phase?',
    reflectionsText: null,
    themes: baseThemes,
    spreadAnalysis: baseSpreadAnalysis,
    context: 'self',
    visionInsights,
    deckStyle: 'rws-1909'
  });
}

test('weaves verified visual profiles into the matching card body', () => {
  const visionInsights = [
    {
      label: 'fool-upload',
      predictedCard: 'The Fool',
      confidence: 0.92,
      basis: 'image',
      matchesDrawnCard: true,
      visualProfile: {
        tone: ['mystical', 'ethereal'],
        emotion: ['joyful', 'carefree']
      }
    }
  ];

  const { userPrompt, promptMeta } = buildPrompt(visionInsights);
  const [promptBody] = userPrompt.split('**Vision Validation**');

  assert.match(promptBody, /\*Vision-detected tone: mystical, ethereal/i);
  assert.match(promptBody, /\*Emotional quality: joyful, carefree\*/i);
  assert.equal(promptMeta.sourceUsage?.vision?.eligibleUploads, 1);
  assert.equal(promptMeta.sourceUsage?.vision?.telemetryOnlyUploads, 0);
  assert.equal(promptMeta.sourceUsage?.vision?.cardCuesUsed, true);
});

test('keeps unverified or mismatched visual profiles telemetry-only', () => {
  const visionInsights = [
    {
      label: 'magician-upload',
      predictedCard: 'The Magician',
      confidence: 0.88,
      basis: 'text',
      visualProfile: {
        tone: ['vibrant', 'bold'],
        emotion: ['confident', 'focused']
      }
    },
    {
      label: 'priestess-upload',
      predictedCard: 'The High Priestess',
      confidence: 0.85,
      basis: 'adapter',
      matchesDrawnCard: false,
      visualProfile: {
        tone: ['dark', 'mysterious'],
        emotion: ['contemplative', 'introspective']
      }
    }
  ];

  const { userPrompt, promptMeta } = buildPrompt(visionInsights);
  const [promptBody, validationSection = ''] = userPrompt.split('**Vision Validation**');

  assert.equal(/vibrant, bold/i.test(promptBody), false);
  assert.equal(/confident, focused/i.test(promptBody), false);
  assert.equal(/dark, mysterious/i.test(promptBody), false);
  assert.match(validationSection, /magician-upload: recognized as The Magician via text/i);
  assert.match(validationSection, /\[unverified upload\]/i);
  assert.match(validationSection, /Visual Profile: Tone: \[vibrant, bold\] \| Emotion: \[confident, focused\]/i);
  assert.match(validationSection, /priestess-upload: vision detected a card not in the drawn spread/i);
  assert.match(validationSection, /\[mismatch\]/i);

  assert.equal(promptMeta.sourceUsage?.vision?.eligibleUploads, 0);
  assert.equal(promptMeta.sourceUsage?.vision?.telemetryOnlyUploads, 2);
  assert.equal(promptMeta.sourceUsage?.vision?.suppressionReasons?.match_unverified, 1);
  assert.equal(promptMeta.sourceUsage?.vision?.suppressionReasons?.card_mismatch, 1);
  assert.equal(promptMeta.sourceUsage?.vision?.diagnosticsIncluded, true);
  assert.equal(promptMeta.sourceUsage?.vision?.cardCuesUsed, false);
});

test('separates uploaded visible evidence from canonical rws imagery', () => {
  const { userPrompt, systemPrompt, promptMeta } = buildEnhancedClaudePrompt({
    spreadInfo: baseSpreadInfo,
    cardsInfo: baseCardsInfo,
    userQuestion: 'How can I navigate this new phase?',
    reflectionsText: null,
    themes: baseThemes,
    spreadAnalysis: baseSpreadAnalysis,
    context: 'self',
    visionInsights: [],
    visionEvidence: [
      {
        label: 'fool-photo',
        card: 'The Fool',
        evidenceMode: 'uploaded_image',
        confidence: 0.92,
        visibleEvidence: [
          {
            symbol: 'cliff',
            label: 'cliff',
            literalObservation: 'The figure is near a precipice.',
            symbolicMeaning: ['threshold', 'risk', 'unknown outcome']
          }
        ]
      }
    ],
    deckStyle: 'rws-1909'
  });

  assert.match(systemPrompt, /If uploaded image evidence is present/i);
  assert.match(systemPrompt, /If only card names are present/i);
  assert.match(userPrompt, /\*\*Uploaded Visible Evidence\*\*/);
  assert.match(userPrompt, /Literal: The figure is near a precipice\./);
  assert.match(userPrompt, /Symbolic: threshold, risk, unknown outcome/);
  assert.equal(promptMeta.sourceUsage?.vision?.evidencePacketsUsed, 1);
});

const visionStates = [
  { name: 'verified', matchesDrawnCard: true, confidence: 0.92, promptEligible: true },
  { name: 'unverified', matchesDrawnCard: null, confidence: 0.92, promptEligible: false },
  { name: 'telemetry-only', matchesDrawnCard: true, confidence: 0.4, promptEligible: false }
];

function sunInsight(overrides = {}) {
  return {
    label: 'selected-photo',
    predictedCard: 'The Sun',
    matchesDrawnCard: true,
    confidence: 0.92,
    promptEligible: true,
    reasoning: 'A gold border surrounds the bright portrait.',
    visualDetails: ['A gold border surrounds the bright portrait.'],
    visualProfile: { tone: ['radiant'], emotion: ['hopeful'] },
    mergeSource: 'combined',
    symbolVerification: {
      matchRate: 0.9,
      matches: [{ object: 'sunflowers', found: true, confidence: 0.9 }],
      missingSymbols: []
    },
    ...overrides
  };
}

function buildSunPrompt(visionInsights, deckStyle, displayName, visionEvidence) {
  const cardsInfo = [{ card: displayName, number: 19, position: 'Focus', orientation: 'Upright' }];
  return buildEnhancedClaudePrompt({
    spreadInfo: { name: 'One-Card Insight', deckStyle },
    cardsInfo,
    userQuestion: 'What supports clarity today?',
    themes: { deckStyle },
    context: 'self',
    visionInsights,
    visionEvidence: visionEvidence ?? buildVisionEvidencePackets(visionInsights, cardsInfo, deckStyle),
    deckStyle
  });
}

for (const fixture of [
  { deckStyle: 'rws-1909', sun: 'The Sun', moon: 'The Moon' },
  { deckStyle: 'marseille-classic', sun: 'Le Soleil', moon: 'La Lune' }
]) {
  for (const state of visionStates) {
    test(`excludes undrawn secondary candidates from both ${state.name} ${fixture.deckStyle} messages`, () => {
      const insights = [sunInsight({
        ...state,
        predictedCard: fixture.sun,
        matches: [
          { card: fixture.moon, score: 0.85, reasoning: 'SILVER_HOWL_CUE', visualProfile: { tone: ['lunar-cue'] } },
          { card: 'The Sun', score: 0.8 }
        ]
      })];
      const original = structuredClone(insights);
      const { systemPrompt, userPrompt } = buildSunPrompt(insights, fixture.deckStyle, fixture.sun);

      for (const message of [systemPrompt, userPrompt]) {
        assert.doesNotMatch(message, /\bThe Moon\b|La Lune|SILVER[ _]HOWL[ _]CUE|lunar-cue/);
      }
      assert.match(userPrompt, /selected-photo: recognized as (?:The Sun|Le Soleil)/);
      if (state.name !== 'telemetry-only') {
        assert.match(userPrompt, /Secondary matches: The Sun 80\.0%/);
        assert.match(userPrompt, /A gold border surrounds the bright portrait\./);
        assert.match(userPrompt, /source: combined/);
      }
      assert.deepEqual(insights, original, 'excluded candidates must remain available to diagnostics outside the prompt');
    });

    test(`withholds undrawn primary names and cues from both ${state.name} ${fixture.deckStyle} messages`, () => {
      const insights = [
        sunInsight({ predictedCard: fixture.sun }),
        sunInsight({
          ...state,
          label: 'alternate-photo',
          predictedCard: fixture.moon,
          reasoning: 'SILVER_HOWL_CUE',
          visualDetails: ['SILVER_HOWL_CUE'],
          visualProfile: { tone: ['lunar-cue'], emotion: ['shadow-dread-cue'] },
          symbolVerification: {
            matchRate: 0.9,
            matches: [{ object: 'SILVER_HOWL_CUE', found: true, confidence: 0.9 }],
            missingSymbols: ['UNDRAWN_SYMBOL_CUE']
          },
          matches: [{ card: fixture.moon, score: 0.9 }]
        })
      ];
      const { systemPrompt, userPrompt } = buildSunPrompt(insights, fixture.deckStyle, fixture.sun);

      for (const message of [systemPrompt, userPrompt]) {
        assert.doesNotMatch(message, /\bThe Moon\b|La Lune|SILVER[ _]HOWL[ _]CUE|lunar-cue|shadow-dread-cue|UNDRAWN[ _]SYMBOL[ _]CUE/);
      }
      assert.match(userPrompt, /selected-photo: recognized as (?:The Sun|Le Soleil)/);
      assert.match(userPrompt, /A gold border surrounds the bright portrait\./);
      assert.match(userPrompt, /\*\*Uploaded Visible Evidence\*\*/);
      assert.match(userPrompt, /The Sun \(selected-photo, 92\.0%\)/);
      assert.match(userPrompt, /alternate-photo:/, 'retain identity-free mismatch diagnostics');
    });
  }
}

test('filters supplied evidence packets against the drawn cards during final prompt assembly', () => {
  const packet = (card, literalObservation) => ({
    card,
    label: 'source-photo',
    evidenceMode: 'uploaded_image',
    confidence: 0.92,
    visibleEvidence: [{ literalObservation, symbolicMeaning: [literalObservation] }]
  });
  const { systemPrompt, userPrompt, promptMeta } = buildSunPrompt([], 'rws-1909', 'The Sun', [
    packet('The Moon', 'UNDRAWN_PACKET_CUE'),
    packet('The Sun', 'A gold border surrounds the bright portrait.')
  ]);

  for (const message of [systemPrompt, userPrompt]) {
    assert.doesNotMatch(message, /\bThe Moon\b|UNDRAWN[ _]PACKET[ _]CUE/);
  }
  assert.match(userPrompt, /The Sun \(source-photo, 92\.0%\)/);
  assert.match(userPrompt, /Literal: A gold border surrounds the bright portrait\./);
  assert.equal(promptMeta.sourceUsage.vision.evidencePacketsUsed, 1);
  assert.equal(promptMeta.sourceUsage.vision.evidenceMode, 'uploaded_image');
});

test('reports no uploaded evidence when every supplied packet is off-spread', () => {
  const { userPrompt, promptMeta } = buildSunPrompt([], 'rws-1909', 'The Sun', [{
    card: 'The Moon',
    label: 'alternate-photo',
    evidenceMode: 'uploaded_image',
    visibleEvidence: [{ literalObservation: 'UNDRAWN_PACKET_CUE' }]
  }]);

  assert.doesNotMatch(userPrompt, /\*\*Uploaded Visible Evidence\*\*/);
  assert.equal(promptMeta.sourceUsage.vision.evidencePacketsUsed, 0);
  assert.equal(promptMeta.sourceUsage.vision.evidenceMode, 'none');
});

test('counts only rendered packets when uploads exceed the evidence preview limit', () => {
  const packets = Array.from({ length: 6 }, () => ({
    card: 'The Sun',
    label: 'same-photo',
    confidence: 0.92,
    evidenceMode: 'uploaded_image',
    visibleEvidence: [{ literalObservation: 'A gold border surrounds the bright portrait.' }]
  }));
  const { userPrompt, promptMeta } = buildSunPrompt([], 'rws-1909', 'The Sun', packets);

  assert.equal((userPrompt.match(/The Sun \(same-photo, 92\.0%\)/g) || []).length, 5);
  assert.equal(promptMeta.sourceUsage.vision.evidencePacketsUsed, 5);
  assert.equal(promptMeta.sourceUsage.vision.evidenceMode, 'uploaded_image');
});

test('counts only evidence packet headings retained after hard-cap truncation', () => {
  const packets = Array.from({ length: 5 }, (_, index) => ({
    card: 'The Sun',
    label: `source-photo-${index}`,
    confidence: 0.92,
    evidenceMode: 'uploaded_image',
    cardKnowledge: { coreThemes: Array(5).fill('Clarity and vitality support the current chapter.'.repeat(2)) },
    expectedRiderSymbols: Array(8).fill({ label: 'An upright figure stands within a radiant garden scene.'.repeat(2) }),
    verifiedUploadedEvidence: Array(5).fill({ literalObservation: 'A gold border surrounds the bright portrait and its sunlit garden. '.repeat(4) }),
    uncertainSymbols: Array(6).fill({ label: 'The edge of the garden and distant details remain indistinct.'.repeat(2) }),
    forbiddenClaims: Array.from({ length: 5 }, (_, claim) => `${claim}: ${'Only describe the uploaded observations supplied in this evidence packet. '.repeat(3)}`)
  }));
  const { userPrompt, promptMeta } = buildEnhancedClaudePrompt({
    spreadInfo: { name: 'One-Card Insight' },
    cardsInfo: [{ card: 'The Sun', number: 19, position: 'Focus', orientation: 'Upright' }],
    userQuestion: 'What supports clarity today?',
    themes: {
      reversalDescription: {
        name: 'Upright Emphasis',
        description: 'Read each position in context. '.repeat(10000),
        guidance: 'Preserve the requested orientation.'
      }
    },
    context: 'self',
    visionEvidence: packets,
    budgetTarget: 'default'
  });
  const retainedCount = (userPrompt.match(/The Sun \(source-photo-\d, 92\.0%\)/g) || []).length;

  assert.equal(promptMeta.truncation?.userTruncated, true);
  assert.ok(retainedCount < 5, 'the fixture must remove at least one complete packet heading');
  assert.equal(promptMeta.sourceUsage.vision.evidencePacketsUsed, retainedCount);
  assert.equal(promptMeta.sourceUsage.vision.evidenceMode, retainedCount > 0 ? 'uploaded_image' : 'none');
});

for (const card of [
  { card: 'Prince of Cups' },
  { card: 'Prince of Cups', canonicalName: 'Knight of Cups' },
  { card: 'Prince of Cups', canonicalKey: 'knight of cups', canonicalName: 'Knight of Cups' }
]) {
  test(`resolves Thoth candidates once with drawn identity ${JSON.stringify(card)}`, () => {
    const validation = buildVisionValidationSection([{
      predictedCard: 'Prince of Cups',
      matchesDrawnCard: true,
      confidence: 0.9,
      matches: [
        { card: 'Knight of Cups', score: 0.95 },
        { card: 'Prince of Cups', score: 0.85 }
      ]
    }], { cardsInfo: [card], deckStyle: 'thoth-a1' });

    assert.match(validation, /recognized as Prince of Cups/);
    assert.match(validation, /Secondary matches: Prince of Cups 85\.0%/);
    assert.doesNotMatch(validation, /Knight of Cups/);
  });
}

test('keeps explicit canonical insight identities from being reinterpreted as Thoth display aliases', () => {
  const validation = buildVisionValidationSection([{
    predictedCard: 'Knight of Cups',
    canonicalName: 'Knight of Cups',
    canonicalKey: 'knight of cups',
    matchesDrawnCard: true,
    confidence: 0.9,
    reasoning: 'PRINCE_OBSERVATION',
    matches: [
      { card: 'Knight of Cups', canonicalName: 'Knight of Cups', canonicalKey: 'knight of cups', score: 0.9 },
      { card: 'King of Cups', canonicalName: 'King of Cups', canonicalKey: 'king of cups', score: 0.85 }
    ]
  }], {
    cardsInfo: [{ card: 'Prince of Cups', canonicalName: 'Knight of Cups', canonicalKey: 'knight of cups' }],
    deckStyle: 'thoth-a1'
  });

  assert.match(validation, /recognized as Knight of Cups/);
  assert.match(validation, /PRINCE OBSERVATION/);
  assert.match(validation, /Secondary matches: Knight of Cups 90\.0%/);
  assert.doesNotMatch(validation, /King of Cups/);
});

for (const includeCanonicalKey of [true, false]) {
  test(`weaves canonical Thoth Prince evidence using ${includeCanonicalKey ? 'canonicalKey' : 'canonicalName'} without undrawn Knight cues`, () => {
    const cardsInfo = [{
      card: 'Prince of Cups',
      canonicalName: 'Knight of Cups',
      ...(includeCanonicalKey ? { canonicalKey: 'knight of cups' } : {}),
      suit: 'Cups',
      rank: 'Knight',
      rankValue: 12,
      position: 'Focus',
      orientation: 'Upright'
    }];
    const visionInsights = [
      {
        label: 'selected-photo',
        predictedCard: 'Knight of Cups',
        canonicalName: 'Knight of Cups',
        ...(includeCanonicalKey ? { canonicalKey: 'knight of cups' } : {}),
        matchesDrawnCard: true,
        promptEligible: true,
        confidence: 0.92,
        visualProfile: { tone: ['PRINCE_BODY_CUE'], emotion: ['PRINCE_EMOTION_CUE'] }
      },
      {
        label: 'alternate-photo',
        predictedCard: 'King of Cups',
        canonicalName: 'King of Cups',
        canonicalKey: 'king of cups',
        matchesDrawnCard: true,
        promptEligible: true,
        confidence: 0.92,
        visualProfile: { tone: ['UNDRAWN_KNIGHT_CUE'], emotion: ['UNDRAWN_EMOTION_CUE'] }
      }
    ];
    const { systemPrompt, userPrompt } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'One-Card Insight', deckStyle: 'thoth-a1' },
      cardsInfo,
      userQuestion: 'What supports clarity today?',
      themes: { deckStyle: 'thoth-a1' },
      context: 'self',
      visionInsights,
      visionEvidence: buildVisionEvidencePackets(visionInsights, cardsInfo, 'thoth-a1'),
      deckStyle: 'thoth-a1'
    });

    const [cardBody] = userPrompt.split('**Vision Validation**');
    assert.match(cardBody, /Vision-detected emotion: PRINCE_EMOTION_CUE/);
    assert.match(userPrompt, /Knight of Cups \(selected-photo, 92\.0%\)/);
    for (const message of [systemPrompt, userPrompt]) {
      assert.doesNotMatch(message, /UNDRAWN_KNIGHT_CUE|UNDRAWN_EMOTION_CUE|King of Cups/);
    }
  });
}
