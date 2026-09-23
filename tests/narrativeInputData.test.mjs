import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildMinorSummary } from '../functions/lib/minorMeta.js';
import { buildPositionCardText } from '../functions/lib/narrative/helpers.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts.js';
import { analyzeSpreadThemes, selectReversalFramework } from '../functions/lib/spreadAnalysis.js';
import { detectAllPatterns, getPriorityPatternNarratives } from '../functions/lib/knowledgeGraph.js';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../src/data/minorArcana.js';

function cardInfo(name, position, orientation = 'Upright') {
  const card = [...MAJOR_ARCANA, ...MINOR_ARCANA].find((entry) => entry.name === name);
  assert.ok(card, `Unknown card ${name}`);
  return {
    position,
    card: card.name,
    orientation,
    meaning: orientation === 'Reversed' ? card.reversed : card.upright,
    number: card.number,
    suit: card.suit || null,
    rank: card.rank || null,
    rankValue: card.rankValue ?? null
  };
}

describe('Minor Arcana rank themes', () => {
  it('do not give the Six of Cups or Nine of Swords another suit’s outcome', () => {
    const suitSpecificOutcomes = /victory|recognition|public acknowledgment|self-sufficiency|fruition|legacy|dedication|collaboration/i;
    for (const name of ['Six of Cups', 'Six of Swords', 'Nine of Swords', 'Nine of Wands', 'Three of Swords', 'Eight of Cups', 'Ten of Swords']) {
      const summary = buildMinorSummary(cardInfo(name, 'Present'));
      assert.match(summary, /At this rank, it marks/, name);
      assert.doesNotMatch(summary, suitSpecificOutcomes, name);
    }
  });
});

describe('Plus/Pro key symbols', () => {
  const position = 'Challenge or tension';

  it('use the card’s own annotations instead of rank/suit vision templates', () => {
    const expectations = [
      ['Eight of Pentacles', /craftsman/, /departure|quick progress/],
      ['Nine of Swords', /waking nightmare/, /luxury|fruits of labor/],
      ['Five of Wands', /youths/, /pyramid/]
    ];
    for (const [name, expected, templated] of expectations) {
      const text = buildPositionCardText(cardInfo(name, position), position, { includeSymbols: true, deckStyle: 'rws-1909' });
      assert.match(text, /Key symbols:/, name);
      assert.match(text, expected, name);
      assert.doesNotMatch(text, templated, name);
    }
  });

  it('omit Rider–Waite scenes for decks with different artwork', () => {
    for (const deckStyle of ['thoth-a1', 'marseille-classic']) {
      const minor = buildPositionCardText(cardInfo('Nine of Swords', position), position, { includeSymbols: true, deckStyle });
      assert.doesNotMatch(minor, /Key symbols:|Picture /, deckStyle);
      assert.match(minor, /Archetype: Anxious Mind/, deckStyle);

      const major = buildPositionCardText(cardInfo('The Hierophant', position), position, { includeSymbols: true, deckStyle });
      assert.doesNotMatch(major, /Key symbols:|blessing hand|keys/i, deckStyle);
    }
  });
});

describe('deck-aware Major Arcana imagery in prompts', () => {
  async function buildPrompt(deckStyle) {
    const cardsInfo = [
      cardInfo('The Hierophant', 'Past — influences that led here'),
      cardInfo('The High Priestess', 'Present — where you stand now', 'Reversed'),
      cardInfo('The Star', 'Future — trajectory if nothing shifts')
    ];
    const themes = await analyzeSpreadThemes(cardsInfo, { deckStyle, enableKnowledgeGraph: false });
    themes.includeSymbols = true;
    return buildEnhancedClaudePrompt({
      spreadInfo: { name: 'Three-Card Story', key: 'threeCard' },
      cardsInfo,
      userQuestion: 'What spiritual practice should I commit to this season?',
      reflectionsText: '',
      themes,
      spreadAnalysis: null,
      context: 'spiritual',
      deckStyle
    }).userPrompt;
  }

  it('keeps canonical RWS imagery for the Rider–Waite–Smith deck', async () => {
    assert.match(await buildPrompt('rws-1909'), /Canonical RWS imagery:/);
  });

  it('does not describe RWS scenes such as keys, acolytes, or the veil for Thoth readings', async () => {
    const prompt = await buildPrompt('thoth-a1');
    assert.doesNotMatch(prompt, /Canonical RWS imagery|acolyte|crossed keys|\bveil\b|blessing hand/i);
  });
});

describe('reversal lens intent matching', () => {
  const cards = [
    { card: 'Ace of Wands', suit: 'Wands', orientation: 'Upright' },
    { card: 'Seven of Swords', suit: 'Swords', orientation: 'Reversed' },
    { card: 'Queen of Cups', suit: 'Cups', orientation: 'Upright' },
    { card: 'Three of Pentacles', suit: 'Pentacles', orientation: 'Upright' },
    { card: 'Two of Cups', suit: 'Cups', orientation: 'Reversed' }
  ];
  const cases = [
    ['What should I know about launching my creative project this quarter?', 'delayed'],
    ['How can I be fearless in this new role?', 'delayed'],
    ['What should I reflect on today?', 'delayed'],
    ['I have always wanted to write a book. What supports me?', 'delayed'],
    ['It feels unavoidable. What now?', 'delayed'],
    ['How do I unlock my hidden potential?', 'potentialBlocked'],
    ['What are my hidden talents?', 'potentialBlocked'],
    ['What am I afraid to face?', 'shadow'],
    ['What is hidden from me?', 'shadow'],
    ['What fear keeps me from starting?', 'shadow'],
    ['Why do I feel ashamed about asking for help?', 'shadow'],
    ['Why do I keep attracting the same patterns?', 'mirror'],
    ['What am I projecting onto my partner?', 'mirror'],
    ['What does my partner reflect back to me?', 'mirror'],
    ['Why do I always end up in the same situation?', 'mirror']
  ];

  for (const [question, expected] of cases) {
    it(`${expected} for "${question}"`, () => {
      assert.equal(selectReversalFramework(2 / 5, cards, { userQuestion: question }), expected);
    });
  }
});

describe("Fool's Journey stage labels", () => {
  it('label Major Arcana 8–14 as Integration, not Initiation', () => {
    const patterns = detectAllPatterns([
      { card: 'Death', number: 13, orientation: 'Upright' },
      { card: 'Temperance', number: 14, orientation: 'Upright' },
      { card: 'The Hermit', number: 9, orientation: 'Upright' }
    ]);
    const journey = getPriorityPatternNarratives(patterns).find((item) => item.type === 'fools-journey');
    assert.match(journey.text, /Fool's Journey — Integration/);
    assert.doesNotMatch(journey.text, /Initiation/);
  });

  it('name the stage by its key for a single Major', () => {
    const patterns = detectAllPatterns([{ card: 'Death', number: 13, orientation: 'Upright' }]);
    const journey = getPriorityPatternNarratives(patterns).find((item) => item.type === 'fools-journey-minimal');
    assert.match(journey.text, /appears in the integration stage/);
  });
});

describe('deck-aware card names', () => {
  it('name the RWS equivalent once for Marseille and Thoth minors', () => {
    const position = 'Challenge or tension';
    const marseille = buildPositionCardText(cardInfo('Six of Pentacles', position), position, { deckStyle: 'marseille-classic' });
    assert.match(marseille, /Six of Coins \(RWS: Six of Pentacles\)/);
    assert.doesNotMatch(marseille, /\(RWS: Six of Pentacles\) \(RWS: Six of Pentacles\)/);

    const thoth = buildPositionCardText(cardInfo('Nine of Swords', position), position, { deckStyle: 'thoth-a1' });
    assert.doesNotMatch(thoth, /Nine of Swords\) \(RWS: Nine of Swords\)/);
  });
});
