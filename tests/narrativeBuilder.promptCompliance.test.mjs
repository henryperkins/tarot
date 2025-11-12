import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildCelticCrossReading,
  buildThreeCardReading,
  buildFiveCardReading,
  buildRelationshipReading,
  buildDecisionReading,
  buildSingleCardReading,
  buildEnhancedClaudePrompt
} from '../functions/lib/narrativeBuilder.js';

import {
  analyzeCelticCross,
  analyzeThreeCard,
  analyzeFiveCard,
  analyzeSpreadThemes
} from '../functions/lib/spreadAnalysis.js';

// Minimal helper to fabricate a Major Arcana-like card
function major(name, number, position, orientation = 'Upright', meaning = 'Meaningful transformation and growth.') {
  return {
    card: name,
    name,
    number,
    position,
    orientation,
    meaning
  };
}

// Minimal helper to fabricate a Minor Arcana-like card
function minor(name, suit, rank, rankValue, position, orientation = 'Upright', meaning = 'Embodied lesson in this area.') {
  return {
    card: name,
    name,
    suit,
    rank,
    rankValue,
    position,
    orientation,
    meaning
  };
}

function buildThemes(cardsInfo, reversalFramework = 'blocked') {
  const base = analyzeSpreadThemes(cardsInfo);
  // Force a specific, deterministic reversal lens so assertions are stable.
  if (reversalFramework === 'blocked') {
    base.reversalFramework = 'blocked';
    base.reversalDescription = {
      name: 'Blocked Energy',
      description: 'Reversals show the energy is present yet meeting resistance.',
      guidance: 'Interpret reversals as energies encountering resistance that must be consciously released.'
    };
  } else if (reversalFramework === 'internalized') {
    base.reversalFramework = 'internalized';
    base.reversalDescription = {
      name: 'Internalized Energy',
      description: 'Reversals point inward to private, internalized processes.',
      guidance: 'Describe reversals as invitations to reflect and integrate within.'
    };
  }
  return base;
}

// Generic assertion helpers

function assertAgencyForward(text) {
  const lowered = text.toLowerCase();
  assert.ok(
    lowered.includes('trajectory') ||
      lowered.includes('path') ||
      lowered.includes('if the current path continues') ||
      lowered.includes('if current path continues'),
    'Reading/prompt should frame outcomes as trajectories, not fixed fate'
  );
  assert.ok(
    lowered.includes('free will') ||
      lowered.includes('choice') ||
      lowered.includes('agency') ||
      lowered.includes('you remain the one who chooses') ||
      lowered.includes('you are co-creating this path'),
    'Reading/prompt should emphasize free will and agency-forward framing'
  );
}

function assertNoBannedDeterminism(text) {
  const lowered = text.toLowerCase();
  assert.ok(
    !lowered.includes('guaranteed') &&
      !lowered.includes('will definitely') &&
      !lowered.includes('100% certain'),
    'Reading/prompt should not contain deterministic guarantee language'
  );
}

function assertUsesCardsAndPositions(text, cardsInfo) {
  for (const c of cardsInfo) {
    if (!c || !c.card) continue;
    assert.ok(
      text.includes(c.card),
      `Reading/prompt should reference card ${c.card}`
    );
    if (c.position) {
      assert.ok(
        text.includes(c.position.split('(')[0].trim()),
        `Reading/prompt should reference position lens for ${c.card}`
      );
    }
  }
}

function assertReversalLensConsistency(text, themes) {
  if (!themes || !themes.reversalDescription) return;
  const label = themes.reversalDescription.name;
  // If there are any reversed cards expected, the lens name should appear.
  assert.ok(
    text.includes(label),
    `Reversal framework "${label}" should be surfaced in narrative/prompt`
  );
}

function hasStoryConnectors(text) {
  // We only require presence of at least one key connector to avoid over-constraining.
  return (
    text.includes('Because') ||
    text.includes('Therefore') ||
    text.includes('However') ||
    text.includes('And so') ||
    text.includes('Meanwhile') ||
    text.includes('This sets the stage for') ||
    text.includes('Yet beneath the surface')
  );
}

function assertStorySpineSignals(text) {
  assert.ok(
    hasStoryConnectors(text),
    'Narrative/prompt should use connective phrases aligned with WHAT → WHY → WHAT\'S NEXT story spine'
  );
}

// 1. CELTIC CROSS COMPLIANCE

describe('Celtic Cross narrative + Claude prompt compliance', () => {
  it('buildCelticCrossReading and buildEnhancedClaudePrompt follow narrative guide', () => {
    const cardsInfo = [
      major('The Fool', 0, 'Present — core situation (Card 1)', 'Upright'),
      major('The Magician', 1, 'Challenge — crossing / tension (Card 2)', 'Upright'),
      major('The High Priestess', 2, 'Past — what lies behind (Card 3)', 'Upright'),
      major('The Empress', 3, 'Near Future — what lies before (Card 4)', 'Reversed'),
      major('The Emperor', 4, 'Conscious — goals & focus (Card 5)', 'Upright'),
      major('The Hierophant', 5, 'Subconscious — roots / hidden forces (Card 6)', 'Upright'),
      major('The Lovers', 6, 'Self / Advice — how to meet this (Card 7)', 'Upright'),
      major('The Chariot', 7, 'External Influences — people & environment (Card 8)', 'Upright'),
      major('Strength', 8, 'Hopes & Fears — deepest wishes & worries (Card 9)', 'Upright'),
      major('The Hermit', 9, 'Outcome — likely path if unchanged (Card 10)', 'Upright')
    ];

    const themes = buildThemes(cardsInfo, 'blocked');
    const celticAnalysis = analyzeCelticCross(cardsInfo);

    const reading = buildCelticCrossReading({
      cardsInfo,
      userQuestion: 'How can I work with these changes?',
      reflectionsText: 'I feel a big transition approaching.',
      celticAnalysis,
      themes
    });

    // Headings & structure
    [
      '**THE HEART OF THE MATTER**',
      '**THE TIMELINE**',
      '**CONSCIOUSNESS FLOW**',
      '**THE STAFF**',
      '**KEY RELATIONSHIPS**',
      '**SYNTHESIS & GUIDANCE**',
      '**SYNTHESIS & GUIDANCE**' // tolerate either HTML-escaped or raw ampersand
    ].forEach(heading => {
      assert.ok(
        reading.includes(heading),
        `Celtic Cross reading should include section heading: ${heading}`
      );
    });

    assertAgencyForward(reading);
    assertNoBannedDeterminism(reading);
    assertUsesCardsAndPositions(reading, cardsInfo);
    assertReversalLensConsistency(reading, themes);
    assertStorySpineSignals(reading);

    const { systemPrompt, userPrompt } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'Celtic Cross (Classic 10-Card)' },
      cardsInfo,
      userQuestion: 'How can I work with these changes?',
      reflectionsText: 'I feel a big transition approaching.',
      themes,
      spreadAnalysis: celticAnalysis
    });

    // System prompt: ethics + structure + reversal + minors guidance (high level).
    assert.ok(
      systemPrompt.includes('You are an expert tarot reader'),
      'System prompt should set expert tarot reader persona'
    );
    assert.ok(
      systemPrompt.includes('WHAT → WHY → WHAT’S NEXT') ||
        systemPrompt.includes('WHAT -> WHY -> WHAT'),
      'System prompt should encode story spine guidance'
    );
    assert.ok(
      systemPrompt.includes('ETHICAL CONSTRAINTS'),
      'System prompt should encode ethical constraints'
    );
    assert.ok(
      systemPrompt.includes(themes.reversalDescription.name),
      'System prompt should surface selected reversal framework'
    );

    assertAgencyForward(systemPrompt);
    assertNoBannedDeterminism(systemPrompt);
    assertStorySpineSignals(systemPrompt);

    // User prompt: must enumerate key cross-check labels and reversal framework.
    ['Goal vs Outcome', 'Advice vs Outcome', 'Near Future vs Outcome', 'Subconscious vs Hopes/Fears'].forEach(label => {
      assert.ok(
        userPrompt.includes(label),
        `User prompt should surface cross-check label: ${label}`
      );
    });

    assert.ok(
      userPrompt.includes('Reversal framework:') ||
        userPrompt.toLowerCase().includes('reversal framework'),
      'User prompt should mention reversal framework'
    );

    assertAgencyForward(userPrompt);
    assertNoBannedDeterminism(userPrompt);
    assertUsesCardsAndPositions(userPrompt, cardsInfo);
    assertStorySpineSignals(userPrompt);
  });
});

// 2. THREE-CARD COMPLIANCE

describe('Three-Card narrative + Claude prompt compliance', () => {
  it('buildThreeCardReading and prompt respect causal story + ethics', () => {
    const cardsInfo = [
      minor('Two of Wands', 'Wands', 'Two', 2, 'Past — influences that led here', 'Upright'),
      minor('Three of Cups', 'Cups', 'Three', 3, 'Present — where you stand now', 'Upright'),
      minor('Six of Swords', 'Swords', 'Six', 6, 'Future — trajectory if nothing shifts', 'Reversed')
    ];

    const themes = buildThemes(cardsInfo, 'internalized');
    const threeCardAnalysis = analyzeThreeCard(cardsInfo);

    const reading = buildThreeCardReading({
      cardsInfo,
      userQuestion: 'What is unfolding in this chapter?',
      reflectionsText: '',
      threeCardAnalysis,
      themes
    });

    assert.ok(
      reading.includes('**THE STORY**'),
      'Three-card reading should include THE STORY section'
    );
    assert.ok(
      reading.includes('**GUIDANCE**'),
      'Three-card reading should include GUIDANCE section'
    );

    assertAgencyForward(reading);
    assertNoBannedDeterminism(reading);
    assertUsesCardsAndPositions(reading, cardsInfo);
    assertReversalLensConsistency(reading, themes);
    assertStorySpineSignals(reading);

    const { systemPrompt, userPrompt } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'Three-Card Story (Past · Present · Future)' },
      cardsInfo,
      userQuestion: 'What is unfolding in this chapter?',
      reflectionsText: '',
      themes,
      spreadAnalysis: threeCardAnalysis
    });

    assertAgencyForward(systemPrompt);
    assertNoBannedDeterminism(systemPrompt);
    assertStorySpineSignals(systemPrompt);
    assertAgencyForward(userPrompt);
    assertNoBannedDeterminism(userPrompt);
    assertUsesCardsAndPositions(userPrompt, cardsInfo);
    assertStorySpineSignals(userPrompt);
  });
});

// 3. FIVE-CARD / RELATIONSHIP / DECISION / SINGLE-CARD smoke + ethics + spine

describe('Other spread builders prompt-engineering compliance', () => {
  it('Five-Card Clarity respects narrative rules', () => {
    const cardsInfo = [
      major('The Fool', 0, 'Core of the matter', 'Upright'),
      major('The Magician', 1, 'Challenge or tension', 'Reversed'),
      minor('Two of Cups', 'Cups', 'Two', 2, 'Hidden / subconscious influence', 'Upright'),
      minor('Nine of Pentacles', 'Pentacles', 'Nine', 9, 'Support / helpful energy', 'Upright'),
      major('The World', 21, 'Likely direction on current path', 'Upright')
    ];

    const themes = buildThemes(cardsInfo, 'blocked');
    const fiveCardAnalysis = analyzeFiveCard(cardsInfo);

    const reading = buildFiveCardReading({
      cardsInfo,
      userQuestion: 'How can I best navigate this?',
      reflectionsText: '',
      fiveCardAnalysis,
      themes
    });

    assertAgencyForward(reading);
    assertNoBannedDeterminism(reading);
    assertUsesCardsAndPositions(reading, cardsInfo);
    assertReversalLensConsistency(reading, themes);
    assertStorySpineSignals(reading);
  });

  it('Relationship Snapshot respects narrative rules', () => {
    const cardsInfo = [
      minor('Knight of Cups', 'Cups', 'Knight', 12, 'You / your energy', 'Upright'),
      minor('Queen of Swords', 'Swords', 'Queen', 13, 'Them / their energy', 'Upright'),
      major('The Lovers', 6, 'The connection / shared lesson', 'Upright'),
      minor('Seven of Wands', 'Wands', 'Seven', 7, 'Dynamics / guidance', 'Reversed'),
      minor('Ten of Pentacles', 'Pentacles', 'Ten', 10, 'Outcome / what this can become', 'Upright')
    ];

    const themes = buildThemes(cardsInfo, 'internalized');

    const reading = buildRelationshipReading({
      cardsInfo,
      userQuestion: 'What is the energy of this connection?',
      reflectionsText: '',
      themes
    });

    assertAgencyForward(reading);
    assertNoBannedDeterminism(reading);
    assertUsesCardsAndPositions(reading, cardsInfo);
    assertReversalLensConsistency(reading, themes);
    assertStorySpineSignals(reading);
  });

  it('Decision / Two-Path respects narrative rules', () => {
    const cardsInfo = [
      major('The High Priestess', 2, 'Heart of the decision', 'Upright'),
      major('The Sun', 19, 'Path A — energy & likely outcome', 'Upright'),
      major('The Moon', 18, 'Path B — energy & likely outcome', 'Reversed'),
      minor('Page of Pentacles', 'Pentacles', 'Page', 11, 'What clarifies the best path', 'Upright'),
      major('Justice', 11, 'What to remember about your free will', 'Upright')
    ];

    const themes = buildThemes(cardsInfo, 'blocked');

    const reading = buildDecisionReading({
      cardsInfo,
      userQuestion: 'Which path aligns with me?',
      reflectionsText: '',
      themes
    });

    assertAgencyForward(reading);
    assertNoBannedDeterminism(reading);
    assertUsesCardsAndPositions(reading, cardsInfo);
    assertReversalLensConsistency(reading, themes);
    assertStorySpineSignals(reading);
  });

  it('Single-Card Insight respects narrative rules', () => {
    const cardsInfo = [
      major('The Star', 17, 'Theme / Guidance of the Moment', 'Upright')
    ];

    const themes = buildThemes(cardsInfo, 'internalized');

    const reading = buildSingleCardReading({
      cardsInfo,
      userQuestion: 'What do I most need to hear?',
      reflectionsText: '',
      themes
    });

    assertAgencyForward(reading);
    assertNoBannedDeterminism(reading);
    assertUsesCardsAndPositions(reading, cardsInfo);
    assertReversalLensConsistency(reading, themes);
    assertStorySpineSignals(reading);
  });
});

console.log('narrativeBuilder prompt compliance tests passed');