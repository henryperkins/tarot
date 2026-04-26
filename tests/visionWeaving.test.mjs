import assert from 'node:assert/strict';
import test from 'node:test';

import { buildEnhancedClaudePrompt } from '../functions/lib/narrativeBuilder.js';

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
