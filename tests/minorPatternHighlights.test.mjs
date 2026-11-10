import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { detectSuitProgressions, getPriorityPatternNarratives } from '../functions/lib/knowledgeGraph.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts.js';
import { getDeckAlias } from '../shared/vision/deckAssets.js';
import { MINOR_ARCANA } from '../src/data/minorArcana.js';

const { stages } = JSON.parse(readFileSync(new URL('./fixtures/minor-stage-expectations.json', import.meta.url)));
const decks = ['rws-1909', 'thoth-a1', 'marseille-classic'];
const memberships = stages.flatMap(stage => Array.from({ length: 2 ** stage.members.length }, (_, mask) => ({
  ...stage, selected: stage.members.filter((_, index) => mask & (1 << index))
})).filter(row => row.selected.length >= 2));
function cardsFor(row, deck, reverse = false, orientation = 0) {
  return (reverse ? [...row.selected].reverse() : row.selected).map((member, index) => {
    const catalog = MINOR_ARCANA.find(card => card.name === member.name);
    return { ...catalog, card: getDeckAlias(catalog, deck), canonicalName: catalog.name, canonicalKey: catalog.name.toLowerCase(),
      orientation: orientation === 1 || (orientation === 2 && index % 2) ? 'Reversed' : 'Upright', position: `Slot ${index + 1}`, meaning: catalog.upright };
  });
}
function assertHighlight(row, text) {
  assert.match(text, /possible/i);
  assert.match(text, /positions and orientations/i);
  assert.doesNotMatch(text, /You're in|The dawn is coming|promises breakthrough|dawn is promised|daybreak coming/);
  for (const member of row.members) {
    if (row.selected.includes(member)) assert.ok(text.includes(member.role), `Missing ${member.role}`);
    else assert.ok(!text.includes(member.role), `Absent member ${member.name}: ${text}`);
  }
}

test('all 1368 membership/deck/order/orientation highlights contain only drawn member roles', () => {
  assert.equal(memberships.length, 76);
  let count = 0;
  for (const row of memberships) for (const deck of decks) for (const reverse of [false, true]) for (const orientation of [0, 1, 2]) {
    const cards = cardsFor(row, deck, reverse, orientation);
    const progressions = detectSuitProgressions(cards, { deckStyle: deck });
    const highlight = getPriorityPatternNarratives({ suitProgressions: progressions }, deck)[0];
    assertHighlight(row, highlight.text);
    assert.deepEqual(highlight.matchedCardIndices, cards.map((_, index) => index));
    for (const card of cards) assert.ok(highlight.text.includes(card.card));
    count++;
  }
  assert.equal(count, 1368);
});

test('684 provider-target prompts retain matched-only Minor highlights', () => {
  let count = 0;
  for (const row of memberships) for (const deck of decks) for (const budgetTarget of ['claude', 'openai', 'modal']) {
    const cardsInfo = cardsFor(row, deck, false, 2);
    const built = buildEnhancedClaudePrompt({ spreadInfo: { name: 'General Reading' }, cardsInfo,
      userQuestion: 'What might these themes help me consider?', deckStyle: deck, budgetTarget,
      promptBudgetEnv: { GRAPHRAG_ENABLED: 'true' } });
    const match = built.userPrompt.match(/\*\*Archetypal Patterns\*\*[^\n]*\n([\s\S]*?)\n\n/);
    assert.ok(match, 'Actual final prompt contains the highlight section');
    assertHighlight(row, match[1]);
    assert.equal(built.promptMeta.sourceUsage.patterns.used, true);
    count++;
  }
  assert.equal(count, 684);
});

test('empty and single-member stages cannot form a progression', () => {
  assert.deepEqual(detectSuitProgressions([]), []);
  assert.deepEqual(detectSuitProgressions([{ card: 'Eight of Swords' }]), []);
});
