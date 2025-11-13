import assert from 'node:assert/strict';

import {
  analyzeCelticCross,
  analyzeSpreadThemes
} from '../functions/lib/spreadAnalysis.js';

import {
  buildCelticCrossReading,
  buildEnhancedClaudePrompt,
  buildThreeCardReading,
  buildPositionCardText
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

async function buildBlockedThemes(cardsInfo) {
  const themes = await analyzeSpreadThemes(cardsInfo);
  // Force framework to blocked for predictable assertions
  themes.reversalFramework = 'blocked';
  themes.reversalDescription = {
    name: 'Blocked Energy',
    description: 'Reversals show the energy is present yet meeting resistance.',
    guidance: 'Interpret reversals as energies encountering resistance that must be consciously released.'
  };
  return themes;
}

(async () => {
  const cardsInfo = buildReversedCelticCards();
  const themes = await buildBlockedThemes(cardsInfo);
  const celticAnalysis = analyzeCelticCross(cardsInfo);

  const reading = buildCelticCrossReading({
    cardsInfo,
    userQuestion: 'How can I navigate this turning point?',
    reflectionsText: '',
    celticAnalysis,
    themes
  });

  const expectedReminder = `*Reversal lens reminder: Within the ${themes.reversalDescription.name} lens, ${themes.reversalDescription.guidance}*`;
  assert.ok(
    reading.trim().endsWith(expectedReminder),
    'Celtic Cross reading should append a single reversal reminder note at the end'
  );

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
})();

(async () => {
  const cardsInfo = buildReversedThreeCards();
  const themes = await buildBlockedThemes(cardsInfo);
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

  // Spot-check Minor metadata enrichment via buildPositionCardText for a representative Minor
  const sample = {
    position: 'Present — where you stand now',
    card: 'Two of Cups',
    orientation: 'Upright',
    meaning: 'Connection, partnership, mutual respect, heartfelt unity',
    suit: 'Cups',
    rank: 'Two',
    rankValue: 2
  };

  const text = buildPositionCardText(sample, sample.position, { reversalDescription: themes.reversalDescription });

  assert.ok(
    text.includes('As a Cups card, this speaks to'),
    'Minor summary should include suit-level theme'
  );
  assert.ok(
    /At this rank, it marks/.test(text),
    'Minor summary should include pip-level numerology for non-court ranks'
  );
})();

console.log('narrativeBuilder reversal tests passed');
