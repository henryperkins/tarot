import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as graph from '../functions/lib/knowledgeGraph.js';
import { ARCHETYPAL_TRIADS } from '../src/data/knowledgeGraphData.js';
import { buildGraphContext } from '../functions/lib/graphContext.js';

// Explicit authored expectations: never derive these keys from the lookup under test.
const pairs = [
  ['death-temperance-star', [13, 14], 'Transformation actively seeking balance'],
  ['death-temperance-star', [14, 17], 'Patient integration leading to renewal'],
  ['death-temperance-star', [13, 17], 'Dramatic shift from ending to rebirth (skipping integration)'],
  ['devil-tower-sun', [15, 16], 'Attachments meet necessary disruption'],
  ['devil-tower-sun', [16, 19], 'Upheaval clearing the path to clarity'],
  ['devil-tower-sun', [15, 19], 'From shadow to light (sudden liberation)'],
  ['hermit-hangedman-moon', [9, 12], 'Introspection leading to necessary pause'],
  ['hermit-hangedman-moon', [12, 18], 'Suspension opening to shadow realm'],
  ['hermit-hangedman-moon', [9, 18], 'Solo journey into the unconscious'],
  ['magician-chariot-world', [1, 7], 'Potential directed into decisive movement'],
  ['magician-chariot-world', [7, 21], 'Determined effort reaching culmination'],
  ['magician-chariot-world', [1, 21], 'From first spark to full realization'],
  ['empress-lovers-hierophant', [3, 6], 'Creative fertility meeting decisive choice'],
  ['empress-lovers-hierophant', [6, 5], 'Personal values versus collective tradition'],
  ['empress-lovers-hierophant', [3, 5], 'Nurturing energy seeking formal structure'],
  ['fool-magician-world', [0, 1], 'Pure potential meeting conscious will'],
  ['fool-magician-world', [1, 21], 'Skillful action achieving total integration'],
  ['fool-magician-world', [0, 21], 'From zero to wholeness (quantum leap)'],
  ['empress-emperor-hierophant', [3, 4], 'Nurturing meets structure'],
  ['empress-emperor-hierophant', [4, 5], 'Authority seeking traditional validation'],
  ['empress-emperor-hierophant', [3, 5], 'Abundance channeled through tradition'],
  ['wheel-justice-hangedman', [10, 11], 'Fate meeting accountability'],
  ['wheel-justice-hangedman', [11, 12], 'Truth requiring suspension of judgment'],
  ['wheel-justice-hangedman', [10, 12], 'Cycles demanding surrender'],
  ['tower-star-moon', [16, 17], 'Destruction clearing space for hope'],
  ['tower-star-moon', [17, 18], 'Hope meeting shadow work'],
  ['tower-star-moon', [16, 18], 'Upheaval plunging into deep mystery'],
  ['strength-hermit-wheel', [8, 9], 'Inner fortitude seeking deeper wisdom'],
  ['strength-hermit-wheel', [9, 10], 'Solitary truth-seeking accepting fate'],
  ['strength-hermit-wheel', [8, 10], "Gentle mastery meeting life's cycles"]
];

for (const [id, numbers, expected] of pairs) {
  test(`authored partial ${id} ${numbers.join('+')} resolves in either order and orientation`, () => {
    for (const order of [numbers, [...numbers].reverse()]) {
      for (const orientations of [['Upright', 'Upright'], ['Upright', 'Reversed'], ['Reversed', 'Upright'], ['Reversed', 'Reversed']]) {
        const cards = order.map((number, index) => ({ number, orientation: orientations[index] }));
        const triad = graph.detectArchetypalTriads(cards).find((entry) => entry.id === id);
        assert.equal(triad?.narrative, expected);
        assert.equal(triad.isComplete, false);
        assert.deepEqual([...triad.matchedCards].sort((a, b) => a - b), [...numbers].sort((a, b) => a - b));
      }
    }
  });
}

test('numeric pair keys reject duplicate and noncanonical Major IDs', () => {
  assert.equal(typeof graph.getMajorPairKey, 'function');
  assert.equal(graph.getMajorPairKey([17, 14]), '14-17');
  for (const value of [[1, 1], [-1, 1], [1, 22], [1, 1.5], ['1', 2], [], [1], [1, 2, 3], null]) {
    assert.equal(graph.getMajorPairKey(value), null);
  }
  assert.deepEqual(graph.detectArchetypalTriads([{ number: 14 }, { number: 14 }]), []);
});

test('authored pair registry covers exactly the three canonical pairs of every triad', () => {
  for (const triad of ARCHETYPAL_TRIADS) {
    const expected = triad.cards.flatMap((first, index) => triad.cards.slice(index + 1)
      .map((second) => [first, second].sort((a, b) => a - b).join('-'))).sort();
    assert.deepEqual(Object.keys(triad.partialNarrative).sort(), expected);
    assert.equal(new Set(expected).size, 3);
    for (const text of Object.values(triad.partialNarrative)) assert.ok(text.trim().length > 0);
  }
});

test('all partial highlights qualify the matched theme and carry real slot indices', () => {
  for (const [id, numbers, expected] of pairs) {
    for (const order of [numbers, [...numbers].reverse()]) {
      for (const orientations of [['Upright', 'Upright'], ['Upright', 'Reversed'], ['Reversed', 'Upright'], ['Reversed', 'Reversed']]) {
        const cards = order.map((number, index) => ({ number, orientation: orientations[index], position: index ? 'Path B' : 'Path A' }));
        const triad = graph.detectArchetypalTriads(cards).find((entry) => entry.id === id);
        const [highlight] = graph.getPriorityPatternNarratives({ triads: [triad] });
        assert.ok(highlight.text.includes(expected));
        assert.match(highlight.text, /possible shared theme/i);
        assert.match(highlight.text, /missing arc members are not drawn evidence/i);
        assert.match(highlight.text, /positions and orientations/i);
        assert.equal(highlight.isComplete, false);
        assert.deepEqual(highlight.matchedCardIndices, [0, 1]);
      }
    }
  }
});

test('complete arc highlights do not impose chronology on reordered or reversed spread slots', () => {
  for (const entry of ARCHETYPAL_TRIADS) {
    const cards = [...entry.cards].reverse().map((number, index) => ({ number, orientation: index ? 'Reversed' : 'Upright' }));
    const triad = graph.detectArchetypalTriads(cards).find((value) => value.id === entry.id);
    const [highlight] = graph.getPriorityPatternNarratives({ triads: [triad] });
    assert.match(highlight.text, /possible shared theme/i);
    assert.match(highlight.text, /without assuming chronological order/i);
    assert.equal(highlight.isComplete, true);
    assert.deepEqual(highlight.matchedCardIndices, [0, 1, 2]);
  }
});

test('journey and dyad highlights are qualified themes rather than claims about events', () => {
  const context = buildGraphContext([{ number: 0, card: 'The Fool' }, { number: 1, card: 'The Magician' }]);
  const supporting = context.narrativeHighlights.filter((highlight) => !highlight.type.endsWith('triad'));
  assert.ok(supporting.length > 0);
  for (const highlight of supporting) {
    assert.match(highlight.text, /possible shared theme/i);
    assert.match(highlight.text, /positions and orientations/i);
    assert.match(highlight.text, /without assuming chronological order/i);
    assert.deepEqual(highlight.matchedCardIndices, [0, 1]);
  }
});

test('minor and court highlights identify actual slots without confusing equal ranks across suits', () => {
  const fixtures = [
    ['rws-1909', [{ card: 'Two of Cups', suit: 'Cups', rankValue: 2 }, { card: 'Three of Swords', suit: 'Swords', rankValue: 3 }, { card: 'Three of Cups', suit: 'Cups', rankValue: 3 }], 'emerging-suit-progression', [0, 2]],
    ['rws-1909', [{ card: 'Queen of Cups', suit: 'Cups', rank: 'Queen', rankValue: 13 }, { card: 'Queen of Swords', suit: 'Swords', rank: 'Queen', rankValue: 13 }, { card: 'King of Cups', suit: 'Cups', rank: 'King', rankValue: 14 }], 'court-lineage', [0, 2]],
    ['thoth-a1', [{ card: 'Eight of Disks', suit: 'Pentacles', rankValue: 8 }], 'thoth-epithet', [0]],
    ['thoth-a1', [{ card: 'Eight of Disks', suit: 'Pentacles', rankValue: 8 }, { card: 'Nine of Disks', suit: 'Pentacles', rankValue: 9 }], 'thoth-suit', [0, 1]],
    ['marseille-classic', [{ card: 'Two of Cups', suit: 'Cups', rankValue: 2 }, { card: 'Three of Swords', suit: 'Swords', rankValue: 3 }, { card: 'Two of Coins', suit: 'Pentacles', rankValue: 2 }], 'marseille-numerology', [0, 2]]
  ];
  for (const [deckStyle, cards, type, indices] of fixtures) {
    const positions = ['Me', 'Partner', 'Relationship'];
    const input = cards.map((card, index) => ({ ...card, position: positions[index], orientation: index ? 'Reversed' : 'Upright' }));
    const before = structuredClone(input);
    const highlight = buildGraphContext(input, { deckStyle }).narrativeHighlights.find((entry) => entry.type === type);
    assert.ok(highlight, type);
    assert.deepEqual(highlight.matchedCardIndices, indices, type);
    assert.deepEqual(input, before, 'original positions/orientations must remain intact');
  }
});

test('journey and dyad slot accounting retains duplicates and skips interleaved unrelated cards', () => {
  const cards = [
    { number: 0, card: 'The Fool', position: 'Path A', orientation: 'Reversed' },
    { card: 'Two of Cups', suit: 'Cups', rankValue: 2, position: 'Path B', orientation: 'Upright' },
    { number: 1, card: 'The Magician', position: 'Advice', orientation: 'Upright' },
    { number: 0, card: 'The Fool', position: 'Outcome', orientation: 'Upright' }
  ];
  const ctx = buildGraphContext(cards);
  for (const type of ['fools-journey', 'high-dyad']) {
    const highlight = ctx.narrativeHighlights.find((entry) => entry.type === type);
    assert.ok(highlight, type);
    assert.deepEqual(highlight.matchedCardIndices, [0, 2, 3], type);
  }
});

test('all ten complete arcs preserve complete narratives', () => {
  for (const entry of ARCHETYPAL_TRIADS) {
    const found = graph.detectArchetypalTriads(entry.cards.map((number) => ({ number }))).find((triad) => triad.id === entry.id);
    assert.equal(found.isComplete, true);
    assert.equal(found.narrative, entry.narrative);
  }
});

test('partial highlights and graph keys name only the matched cards', () => {
  const result = buildGraphContext([{ number: 14, card: 'Temperance' }, { number: 17, card: 'The Star' }]);
  const highlight = result.narrativeHighlights.find((entry) => entry.id === 'death-temperance-star');
  assert.match(highlight.text, /Patient integration leading to renewal/);
  assert.doesNotMatch(highlight.text, /Death|complete narrative arc/);
  assert.deepEqual(result.graphKeys.partialTriads.find((entry) => entry.id === 'death-temperance-star'), {
    id: 'death-temperance-star', matchedCards: [14, 17], missingCards: [13]
  });
});

test('a missing authored pair uses a neutral matched-card statement', () => {
  const triad = ARCHETYPAL_TRIADS[0];
  const saved = triad.partialNarrative;
  triad.partialNarrative = {};
  try {
    const found = graph.detectArchetypalTriads([{ number: 14 }, { number: 17 }]).find((entry) => entry.id === triad.id);
    assert.doesNotMatch(found.narrative, /classic healing journey|Death|releasing what must die/i);
    assert.match(found.narrative, /Temperance/);
    assert.match(found.narrative, /Star/);
  } finally {
    triad.partialNarrative = saved;
  }
});
