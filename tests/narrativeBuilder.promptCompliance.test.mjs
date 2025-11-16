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
import { validateReadingNarrative } from '../functions/lib/narrativeSpine.js';

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

async function buildThemes(cardsInfo, reversalFramework = 'blocked') {
  const base = await analyzeSpreadThemes(cardsInfo);
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
      !lowered.includes('100% certain') &&
      !lowered.includes('fate demands'),
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
  it('buildCelticCrossReading and buildEnhancedClaudePrompt follow narrative guide', async () => {
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

    const themes = await buildThemes(cardsInfo, 'blocked');
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
      ['### The Heart of the Matter (Nucleus)'],
      ['### The Timeline (Horizontal Axis)'],
      ['### Consciousness Flow (Vertical Axis)'],
      ['### The Staff (Context & Trajectory)'],
      ['### Key Relationships'],
      ['### Synthesis & Guidance', '### Synthesis &amp; Guidance'] // tolerate either HTML-escaped or raw ampersand
    ].forEach(headings => {
      assert.ok(
        headings.some(heading => reading.includes(heading)),
        `Celtic Cross reading should include section heading: ${headings[0]}`
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

    const readingValidation = validateReadingNarrative(reading);
    assert.ok(
      readingValidation.isValid,
      'Celtic Cross reading should satisfy narrative spine validation'
    );

    // System prompt: ethics + structure + reversal + minors guidance (high level).
    assert.ok(
      systemPrompt.includes('agency-forward professional tarot storyteller'),
      'System prompt should set agency-forward tarot storyteller persona'
    );
    assert.ok(
      systemPrompt.includes('WHAT → WHY → WHAT’S NEXT') ||
        systemPrompt.includes('WHAT -> WHY -> WHAT'),
      'System prompt should encode story spine guidance'
    );
    assert.ok(
      systemPrompt.includes('NARRATIVE GUIDELINES'),
      'System prompt should highlight narrative guidelines section'
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
    assert.ok(
      userPrompt.includes('Apply Minor Arcana interpretation rules'),
      'User prompt should remind Claude to apply Minor Arcana interpretation rules'
    );
    assert.ok(
      userPrompt.includes('Remember ethical constraints'),
      'User prompt should append concise ethics reminder'
    );

    assertAgencyForward(userPrompt);
    assertNoBannedDeterminism(userPrompt);
    assertUsesCardsAndPositions(userPrompt, cardsInfo);
    assertStorySpineSignals(userPrompt);

  });
});

// 2. THREE-CARD COMPLIANCE

describe('Three-Card narrative + Claude prompt compliance', () => {
  it('buildThreeCardReading and prompt respect causal story + ethics', async () => {
    const cardsInfo = [
      minor('Two of Wands', 'Wands', 'Two', 2, 'Past — influences that led here', 'Upright'),
      minor('Three of Cups', 'Cups', 'Three', 3, 'Present — where you stand now', 'Upright'),
      minor('Six of Swords', 'Swords', 'Six', 6, 'Future — trajectory if nothing shifts', 'Reversed')
    ];

    const themes = await buildThemes(cardsInfo, 'internalized');
    const threeCardAnalysis = analyzeThreeCard(cardsInfo);

    const reading = buildThreeCardReading({
      cardsInfo,
      userQuestion: 'What is unfolding in this chapter?',
      reflectionsText: '',
      threeCardAnalysis,
      themes
    });

    assert.ok(
      reading.includes('### The Story'),
      'Three-card reading should include The Story section'
    );
    assert.ok(
      reading.includes('### Guidance'),
      'Three-card reading should include Guidance section'
    );

    assertAgencyForward(reading);
    assertNoBannedDeterminism(reading);
    assertUsesCardsAndPositions(reading, cardsInfo);
    assertReversalLensConsistency(reading, themes);
    assertStorySpineSignals(reading);
    const threeCardValidation = validateReadingNarrative(reading);
    assert.ok(
      threeCardValidation.isValid,
      'Three-card reading should satisfy narrative spine validation'
    );

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
  it('Five-Card Clarity respects narrative rules', async () => {
    const cardsInfo = [
      major('The Fool', 0, 'Core of the matter', 'Upright'),
      major('The Magician', 1, 'Challenge or tension', 'Reversed'),
      minor('Two of Cups', 'Cups', 'Two', 2, 'Hidden / subconscious influence', 'Upright'),
      minor('Nine of Pentacles', 'Pentacles', 'Nine', 9, 'Support / helpful energy', 'Upright'),
      major('The World', 21, 'Likely direction on current path', 'Upright')
    ];

    const themes = await buildThemes(cardsInfo, 'blocked');
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
    const relationshipValidation = validateReadingNarrative(reading);
    assert.ok(
      relationshipValidation.isValid,
      'Relationship reading should satisfy narrative spine validation'
    );
  });

  it('Relationship Snapshot respects narrative rules', async () => {
    const cardsInfo = [
      minor('Knight of Cups', 'Cups', 'Knight', 12, 'You / your energy', 'Upright'),
      minor('Queen of Swords', 'Swords', 'Queen', 13, 'Them / their energy', 'Upright'),
      major('The Lovers', 6, 'The connection / shared lesson', 'Upright')
    ];

    const themes = await buildThemes(cardsInfo, 'internalized');

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
    const relationshipValidation = validateReadingNarrative(reading);
    assert.ok(
      relationshipValidation.isValid,
      'Relationship reading should satisfy narrative spine validation'
    );
  });

  it('Decision / Two-Path respects narrative rules', async () => {
    const cardsInfo = [
      major('The High Priestess', 2, 'Heart of the decision', 'Upright'),
      major('The Sun', 19, 'Path A — energy & likely outcome', 'Upright'),
      major('The Moon', 18, 'Path B — energy & likely outcome', 'Reversed'),
      minor('Page of Pentacles', 'Pentacles', 'Page', 11, 'What clarifies the best path', 'Upright'),
      major('Justice', 11, 'What to remember about your free will', 'Upright')
    ];

    const themes = await buildThemes(cardsInfo, 'blocked');

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
    const decisionValidation = validateReadingNarrative(reading);
    assert.ok(
      decisionValidation.isValid,
      'Decision reading should satisfy narrative spine validation'
    );
  });

  it('Single-Card Insight respects narrative rules', async () => {
    const cardsInfo = [
      major('The Star', 17, 'Theme / Guidance of the Moment', 'Upright')
    ];

    const themes = await buildThemes(cardsInfo, 'internalized');

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
    const singleValidation = validateReadingNarrative(reading);
    assert.ok(
      singleValidation.isValid,
      'Single-card reading should satisfy narrative spine validation'
    );
  });

  it('surfaces amplified elemental imagery when elements repeat', async () => {
    const cardsInfo = [
      minor('Two of Wands', 'Wands', 'Two', 2, 'Past — influences that led here', 'Upright'),
      minor('Four of Wands', 'Wands', 'Four', 4, 'Present — where you stand now', 'Upright'),
      minor('Six of Wands', 'Wands', 'Six', 6, 'Future — trajectory if nothing shifts', 'Upright')
    ];

    const themes = await buildThemes(cardsInfo, 'blocked');
    const threeCardAnalysis = analyzeThreeCard(cardsInfo);

    const reading = buildThreeCardReading({
      cardsInfo,
      userQuestion: 'How is this momentum building?',
      reflectionsText: '',
      threeCardAnalysis,
      themes
    });

    assert.ok(
      reading.includes('Flame meeting flame'),
      'Reading should reference amplified fire imagery when elemental dignity repeats'
    );

    // Prompt imagery handled in spread-specific builders (e.g., Celtic Cross). Reading check suffices here.
  });

  it('enriches Minor pip cards with rank-specific imagery hooks', async () => {
    const cardsInfo = [
      minor('Ace of Cups', 'Cups', 'Ace', 1, 'Theme / Guidance of the Moment', 'Upright')
    ];

    const themes = await buildThemes(cardsInfo, 'internalized');

    const { userPrompt } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'One-Card Insight' },
      cardsInfo,
      userQuestion: 'What emotion should I honor?',
      reflectionsText: '',
      themes,
      spreadAnalysis: null
    });

    assert.ok(
      userPrompt.toLowerCase().includes('picture hand emerging from a cloud presenting an overflowing chalice'),
      'Minor pip cards should include rank-and-suit specific imagery text in prompts'
    );
  });
});
