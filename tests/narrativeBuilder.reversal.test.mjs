import assert from 'node:assert/strict';

import {
  analyzeCelticCross,
  analyzeSpreadThemes
} from '../functions/lib/spreadAnalysis.js';

import {
  buildCelticCrossReading,
  buildEnhancedClaudePrompt,
  buildThreeCardReading
} from '../functions/lib/narrativeBuilder.js';

function buildReversedCelticCards() {
  const majors = [
    { num: 0, name: 'The Fool', meaning: 'New beginnings and leaps of faith.' },
    { num: 1, name: 'The Magician', meaning: 'Personal power and focused will.' },
    { num: 2, name: 'The High Priestess', meaning: 'Intuition and mystery.' },
    { num: 3, name: 'The Empress', meaning: 'Nurturing abundance.' },
    { num: 4, name: 'The Emperor', meaning: 'Structure and authority.' },
    { num: 5, name: 'The Hierophant', meaning: 'Tradition and spiritual mentorship.' },
    { num: 6, name: 'The Lovers', meaning: 'Aligned choices from the heart.' },
    { num: 7, name: 'The Chariot', meaning: 'Determined progress.' },
    { num: 8, name: 'Strength', meaning: 'Inner resilience and compassion.' },
    { num: 9, name: 'The Hermit', meaning: 'Introspective guidance.' }
  ];

  const positions = [
    'Present — core situation (Card 1)',
    'Challenge — crossing / tension (Card 2)',
    'Past — what lies behind (Card 3)',
    'Near Future — what lies before (Card 4)',
    'Conscious — goals & focus (Card 5)',
    'Subconscious — roots / hidden forces (Card 6)',
    'Self / Advice — how to meet this (Card 7)',
    'External Influences — people & environment (Card 8)',
    'Hopes & Fears — deepest wishes & worries (Card 9)',
    'Outcome — likely path if unchanged (Card 10)'
  ];

  return majors.map((major, index) => ({
    position: positions[index],
    card: major.name,
    orientation: 'Reversed',
    meaning: major.meaning,
    number: major.num
  }));
}

function buildReversedThreeCards() {
  return [
    {
      position: 'Past — influences that led here',
      card: 'Five of Wands',
      orientation: 'Reversed',
      meaning: 'Conflict and competition surface around you.',
      number: null
    },
    {
      position: 'Present — where you stand now',
      card: 'Two of Cups',
      orientation: 'Reversed',
      meaning: 'Partnership asks for renewed trust.',
      number: null
    },
    {
      position: 'Future — trajectory if nothing shifts',
      card: 'Six of Swords',
      orientation: 'Reversed',
      meaning: 'Transition requires deliberate effort.',
      number: null
    }
  ];
}

function buildBlockedThemes(cardsInfo) {
  const themes = analyzeSpreadThemes(cardsInfo);
  // Force framework to blocked for predictable assertions
  themes.reversalFramework = 'blocked';
  themes.reversalDescription = {
    name: 'Blocked Energy',
    description: 'Reversals show the energy is present yet meeting resistance.',
    guidance: 'Interpret reversals as energies encountering resistance that must be consciously released.'
  };
  return themes;
}

function sectionSlice(text, heading, nextHeading) {
  const start = text.indexOf(heading);
  assert.notStrictEqual(start, -1, `Expected heading ${heading} to be present`);
  const end = nextHeading ? text.indexOf(nextHeading, start + heading.length) : -1;
  return end === -1 ? text.slice(start) : text.slice(start, end);
}

const CELTIC_HEADINGS = [
  '**THE HEART OF THE MATTER**',
  '**THE TIMELINE**',
  '**CONSCIOUSNESS FLOW**',
  '**THE STAFF**',
  '**KEY RELATIONSHIPS**',
  '**SYNTHESIS & GUIDANCE**'
];

{
  const cardsInfo = buildReversedCelticCards();
  const themes = buildBlockedThemes(cardsInfo);
  const celticAnalysis = analyzeCelticCross(cardsInfo);

  const reading = buildCelticCrossReading({
    cardsInfo,
    userQuestion: 'How can I navigate this turning point?',
    reflectionsText: '',
    celticAnalysis,
    themes
  });

  CELTIC_HEADINGS.forEach((heading, idx) => {
    const nextHeading = CELTIC_HEADINGS[idx + 1];
    const slice = sectionSlice(reading, heading, nextHeading);
    assert.ok(
      slice.includes('Within the Blocked Energy lens'),
      `Section ${heading} should reinforce the reversal framework`
    );
  });

  const { userPrompt } = buildEnhancedClaudePrompt({
    spreadInfo: { name: 'Celtic Cross (Classic 10-Card)' },
    cardsInfo,
    userQuestion: 'How can I navigate this turning point?',
    reflectionsText: '',
    themes,
    spreadAnalysis: celticAnalysis
  });

  ['Goal vs Outcome', 'Advice vs Outcome', 'Near Future vs Outcome', 'Subconscious vs Hopes/Fears'].forEach(label => {
    assert.ok(
      userPrompt.includes(label),
      `Claude prompt should surface the ${label} cross-check data`
    );
  });

  assert.ok(
    userPrompt.includes('Within the Blocked Energy lens'),
    'Claude prompt should reinforce the selected reversal framework'
  );
}

{
  const cardsInfo = buildReversedThreeCards();
  const themes = buildBlockedThemes(cardsInfo);
  const threeCardAnalysis = null;

  const reading = buildThreeCardReading({
    cardsInfo,
    userQuestion: 'What is unfolding right now?',
    reflectionsText: '',
    threeCardAnalysis,
    themes
  });

  assert.ok(
    reading.includes('Within the Blocked Energy lens'),
    'Three-card readings should propagate reversal guidance'
  );
}

console.log('narrativeBuilder reversal tests passed');
