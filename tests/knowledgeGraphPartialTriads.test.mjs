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
