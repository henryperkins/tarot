import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  analyzeCelticCross,
  analyzeDecision,
  analyzeFiveCard,
  analyzeRelationship,
  analyzeSingleCard,
  analyzeSpreadThemes
} from '../functions/lib/spreadAnalysis.js';
import { resolveReadingCards } from '../functions/lib/readingCardResolution.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../src/data/minorArcana.js';

const RELATIONSHIP = ['You / your energy', 'Them / their energy', 'The connection / shared lesson', 'Dynamics / guidance', 'Outcome / what this can become'];
const CATALOG = new Map([...MAJOR_ARCANA, ...MINOR_ARCANA].map(card => [card.name, card]));

// Entries are a card name, or [name, 'Reversed'].
function draw(entries, positions = RELATIONSHIP) {
  return resolveReadingCards(entries.map((entry, index) => {
    const [card, orientation = 'Upright'] = [].concat(entry);
    return { card, position: positions[index] || `Card ${index + 1}`, orientation };
  }), 'rws-1909');
}
const meaning = (name, orientation = 'Upright') => CATALOG.get(name)[orientation === 'Reversed' ? 'reversed' : 'upright'];
const summaryOf = (analysis, type) => analysis.relationships.find(rel => rel.type === type)?.summary;
const count = (text, pattern) => (text.match(pattern) || []).length;

test('Shared Connection ends the card meaning and covers a shared element in one sentence', () => {
  // You, Them and the Connection are all Water.
  const allWater = analyzeRelationship(draw(['Nine of Cups', 'Two of Cups', ['Ace of Cups', 'Reversed']]));
  assert.equal(summaryOf(allWater, 'connection'),
    `Ace of Cups Reversed anchors the shared lesson between you. ${meaning('Ace of Cups', 'Reversed')}. ` +
    'With your card and theirs alike, all three Water cards reinforce and intensify this elemental energy.');

  // You and Them are both Air; the Connection is Fire.
  const sharedAir = analyzeRelationship(draw(['Queen of Swords', ['Eight of Swords', 'Reversed'], 'Page of Wands']));
  assert.equal(summaryOf(sharedAir, 'connection'),
    `Page of Wands Upright anchors the shared lesson between you. ${meaning('Page of Wands')}. ` +
    'With your card and theirs alike, Fire and Air work harmoniously together, each supporting the other\'s expression.');

  // Different elements keep one sentence each; "Both" is lowercased after the lead-in.
  const different = analyzeRelationship(draw(['Nine of Cups', 'Four of Pentacles', 'Two of Cups']));
  assert.equal(summaryOf(different, 'connection'),
    `Two of Cups Upright anchors the shared lesson between you. ${meaning('Two of Cups')}. ` +
    'With your card, both Water cards reinforce and intensify this elemental energy. ' +
    'With their card, Water and Earth work harmoniously together, each supporting the other\'s expression.');
});

test('Relationship guidance and outcome end the meaning, and the outcome covers a shared element once', () => {
  // The Connection and Dynamics are both Air; the Outcome is Earth.
  const shared = analyzeRelationship(draw(['Ace of Wands', ['The Moon', 'Reversed'], 'Five of Swords', 'Seven of Swords', ['King of Pentacles', 'Reversed']]));
  assert.equal(summaryOf(shared, 'axis'),
    'You / your energy (Ace of Wands Upright) and Them / their energy (The Moon Reversed): Fire and Water create friction that must be balanced and integrated.');
  assert.equal(summaryOf(shared, 'guidance'),
    `Seven of Swords Upright offers guidance on how to work with the dynamic in real time. ${meaning('Seven of Swords')}. ` +
    'In relation to the shared lesson, both Air cards reinforce and intensify this elemental energy.');
  assert.equal(summaryOf(shared, 'outcome'),
    `King of Pentacles Reversed sketches a likely trajectory for what this connection can become if current patterns continue. ${meaning('King of Pentacles', 'Reversed')}. ` +
    'Relative to the shared lesson and current guidance alike, Air and Earth create friction that must be balanced and integrated.');

  const allEarth = analyzeRelationship(draw(['Three of Cups', 'Six of Wands', 'Ace of Pentacles', ['Nine of Pentacles', 'Reversed'], 'Page of Pentacles']));
  assert.match(summaryOf(allEarth, 'outcome'),
    /\. Relative to the shared lesson and current guidance alike, all three Earth cards reinforce and intensify this elemental energy\.$/);

  const different = analyzeRelationship(draw(['Ace of Wands', 'Two of Cups', 'Three of Swords', 'Four of Wands', 'Five of Pentacles']));
  assert.match(summaryOf(different, 'outcome'),
    /\. Relative to the shared lesson, Air and Earth create friction that must be balanced and integrated\. Relative to current guidance, Fire and Earth operate independently, neither reinforcing nor opposing each other\.$/);
});

test('every element combination gives one bridge sentence per distinct pairing without run-ons', () => {
  const SUITS = { Fire: 'Wands', Water: 'Cups', Air: 'Swords', Earth: 'Pentacles' };
  const RANKS = ['Ace', 'Two', 'Three', 'Four', 'Five'];
  const elements = Object.keys(SUITS);
  let combinations = 0;
  for (let index = 0; index < 4 ** 5; index++) {
    const tuple = RANKS.map((_, position) => elements[Math.floor(index / 4 ** position) % 4]);
    const names = tuple.map((element, position) => `${RANKS[position]} of ${SUITS[element]}`);
    const analysis = analyzeRelationship(draw(names));
    const [you, them, connection, dynamics, outcome] = tuple;
    const label = tuple.join('/');

    const connectionSummary = summaryOf(analysis, 'connection');
    assert.equal(count(connectionSummary, /With (?:your|their) card\b/g), you === them ? 1 : 2, label);
    assert.equal(connectionSummary.includes('all three'), you === them && them === connection, label);
    const outcomeSummary = summaryOf(analysis, 'outcome');
    assert.equal(count(outcomeSummary, /Relative to /g), connection === dynamics ? 1 : 2, label);
    assert.equal(outcomeSummary.includes('all three'), connection === dynamics && dynamics === outcome, label);

    for (const [type, name] of [['connection', names[2]], ['guidance', names[3]], ['outcome', names[4]]]) {
      assert.ok(summaryOf(analysis, type).includes(`${meaning(name)}. `), `${label} ${type}`);
    }
    for (const { summary } of analysis.relationships) {
      assert.match(summary, /\.$/, label);
      assert.doesNotMatch(summary, /, Both\b/, label);
      // Every sentence is distinct: a shared element is never described twice.
      const sentences = summary.split(/(?<=\.) /);
      assert.equal(new Set(sentences).size, sentences.length, label);
    }
    combinations++;
  }
  assert.equal(combinations, 1024);
});

test('single-card synthesis ends every catalog meaning without doubling existing punctuation', () => {
  for (const card of [...MAJOR_ARCANA, ...MINOR_ARCANA]) {
    for (const orientation of ['Upright', 'Reversed']) {
      const { synthesis } = analyzeSingleCard(draw([[card.name, orientation]], ['Theme / Guidance of the Moment']));
      assert.ok(synthesis.includes(`". ${meaning(card.name, orientation)}. Treat this as `), `${card.name} ${orientation}: ${synthesis}`);
    }
  }
  const synthesisFor = value => analyzeSingleCard([{ card: 'The Sun', number: 19, orientation: 'Upright', position: 'Theme', ...(value === undefined ? {} : { meaning: value }) }]).synthesis;
  for (const [value, expected] of [
    ['Warmth and renewed confidence.', 'Warmth and renewed confidence. Treat'],
    ['Warmth, renewed confidence,', 'Warmth, renewed confidence. Treat'],
    ['Is the warmth returning?', 'Is the warmth returning? Treat'],
    ['Warmth (renewed confidence)', 'Warmth (renewed confidence). Treat'],
    ['', 'This card is the central lens for interpreting the current moment. Treat'],
    [undefined, 'This card is the central lens for interpreting the current moment. Treat']
  ]) {
    assert.ok(synthesisFor(value).includes(`". ${expected} this as `), `${JSON.stringify(value)}: ${synthesisFor(value)}`);
  }
});

test('Decision, five-card and Celtic Cross summaries end each elemental description as a sentence', () => {
  const decision = analyzeDecision(draw(['Nine of Wands', 'Two of Pentacles', 'Ace of Swords', ['The Hierophant', 'Reversed'], 'King of Wands'],
    ['Heart of the decision', 'Path A', 'Path B', 'Clarifier', 'Free will']));
  const axes = decision.relationships.filter(rel => rel.type === 'axis');
  assert.equal(axes.length, 3);
  for (const rel of axes) assert.ok(rel.summary.endsWith(`: ${rel.elementalRelationship.description}.`), rel.summary);

  const fiveCard = analyzeFiveCard(draw(['Seven of Cups', 'Two of Swords', 'Four of Cups', ['Seven of Pentacles', 'Reversed'], 'Page of Cups']));
  assert.deepEqual(fiveCard.relationships.map(rel => rel.summary),
    [`${fiveCard.coreVsChallenge.description}.`, `${fiveCard.supportVsDirection.description}.`]);

  const celtic = analyzeCelticCross(draw(['Three of Swords', 'King of Wands', 'Queen of Pentacles', 'Nine of Cups', 'Ten of Cups',
    'The Lovers', 'Two of Wands', 'Five of Pentacles', 'The Star', 'Ace of Cups']));
  const crossChecks = celtic.relationships.filter(rel => rel.type === 'cross-check');
  assert.equal(crossChecks.length, 4);
  for (const rel of crossChecks) {
    // The alignment sentence follows the description instead of running on from it.
    assert.match(rel.summary, new RegExp(`: ${rel.elementalRelationship.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\. [A-Z][^.]+\\.$`), rel.summary);
  }
});

test('the relationship prompt carries a shared-element bridge once', async () => {
  const cardsInfo = draw(['Queen of Swords', ['Eight of Swords', 'Reversed'], 'Page of Wands']);
  const { userPrompt } = buildEnhancedClaudePrompt({
    spreadInfo: { key: 'relationship', name: 'Relationship Snapshot' },
    cardsInfo,
    userQuestion: 'What would help this connection feel more honest?',
    reflectionsText: '',
    themes: await analyzeSpreadThemes(cardsInfo, { enableKnowledgeGraph: false }),
    spreadAnalysis: analyzeRelationship(cardsInfo)
  });
  const block = userPrompt.slice(userPrompt.indexOf('**RELATIONSHIP DYNAMICS TO WEAVE**'), userPrompt.indexOf('**POSITION NOTES**'));
  assert.ok(block.includes(`${meaning('Page of Wands')}. With your card and theirs alike, Fire and Air work harmoniously together`), block);
  assert.equal(count(block, /work harmoniously together/g), 1, block);
});
