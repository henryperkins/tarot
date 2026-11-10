import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildGraphContext } from '../functions/lib/graphContext.js';
import { collectPassageCandidates } from '../functions/lib/graphRAGCandidates.js';
import { projectPassageForDeck } from '../functions/lib/graphRAGProjection.js';
import { getPassagesForPattern } from '../functions/lib/knowledgeBase.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts.js';
import { MINOR_ARCANA } from '../src/data/minorArcana.js';
import { getDeckAlias } from '../shared/vision/deckAssets.js';
import { getTraditionalPassages } from '../src/hooks/narrativeReadingModelUtils.js';
import { sanitizeSourceUsage } from '../shared/readingSourceUsage.js';

const decks = ['rws-1909', 'thoth-a1', 'marseille-classic'];
const { stages } = JSON.parse(readFileSync(new URL('./fixtures/minor-stage-expectations.json', import.meta.url)));
const cardsFor = (names, deck) => names.map((name, index) => {
  const card = MINOR_ARCANA.find(row => row.name === name);
  return { ...card, card: getDeckAlias(card, deck), canonicalName: name,
    orientation: index % 2 ? 'Reversed' : 'Upright', position: `Slot ${index + 1}`, meaning: 'Reflect on the drawn card.' };
});
function build(cardsInfo, deckStyle, passages, budgetTarget = 'claude') {
  const knowledgeGraph = buildGraphContext(cardsInfo, { deckStyle });
  return buildEnhancedClaudePrompt({ spreadInfo: { name: 'General Reading' }, cardsInfo, deckStyle,
    userQuestion: 'What could these cards help me consider?', themes: { knowledgeGraph }, budgetTarget,
    graphRAGPayload: { passages, maxPassages: 5 }, promptBudgetEnv: { GRAPHRAG_ENABLED: 'true' } });
}
const reference = built => {
  const match = built.userPrompt.match(/<reference>([\s\S]*?)<\/reference>/);
  assert.ok(match, 'A retained reference, not just a direct highlight, must be exercised');
  assert.equal(built.promptMeta.graphRAG.passagesUsedInPrompt, 1);
  return match[1];
};

for (const deck of decks) {
  test(`${deck}: partial retrieved families cannot supply an absent role`, () => {
    for (const [type, patternId, names, forbidden] of [
      ['suit-progression', 'Cups:challenge', ['Four of Cups', 'Six of Cups', 'Seven of Cups'], /grief|mourning/],
      ['suit-progression', 'Swords:mastery', ['Eight of Swords', 'Nine of Swords'], /rock bottom|then release|Crisis & Release|an ending|Ten of Swords/],
      ['court-lineage', 'Cups:council', ['Page of Cups', 'Queen of Cups', 'King of Cups'], /full spectrum|pursuit|romantic expression/],
      ['court-lineage', 'Wands:alliance', ['Queen of Wands', 'King of Wands'], /the spark, the charge|curiosity and inspiration|bold initiative/]
    ]) {
      const cards = cardsFor(names, deck);
      const keys = buildGraphContext(cards, { deckStyle: deck }).graphKeys;
      const candidate = collectPassageCandidates(keys, { deckStyle: deck }).find(row => row.type === type && row.patternId === patternId);
      assert.ok(candidate);
      assert.deepEqual(new Set(candidate.matchedCardKeys), new Set(names.map(name => name.toLowerCase())));
      assert.doesNotMatch(candidate.promptText, forbidden);
      const block = reference(build(cards, deck, [candidate]));
      assert.doesNotMatch(block, forbidden);
      for (const card of cards) assert.ok(block.includes(card.card));
      assert.match(block, /partial symbolic grouping/i);
    }
  });
}

test('final prompt rebinds raw and stale full-family payloads to actual drawn cards', () => {
  const raw = { ...getPassagesForPattern('suit-progression', 'Swords:mastery').passages[0], type: 'suit-progression', patternId: 'Swords:mastery' };
  const partial = cardsFor(['Eight of Swords', 'Nine of Swords'], 'rws-1909');
  const full = cardsFor(['Eight of Swords', 'Nine of Swords', 'Ten of Swords'], 'rws-1909');
  const stale = collectPassageCandidates(buildGraphContext(full).graphKeys).find(row => row.patternId === 'Swords:mastery');
  for (const supplied of [raw, stale, { ...stale, matchedCardKeys: ['king of cups'], isPartialPattern: false }]) {
    const block = reference(build(partial, 'rws-1909', [supplied]));
    assert.doesNotMatch(block, /rock bottom|then release|Ten of Swords|King of Cups/);
    assert.match(block, /partial symbolic grouping/i);
  }
  const absent = build(cardsFor(['Page of Cups', 'Queen of Cups'], 'rws-1909'), 'rws-1909', [raw]);
  assert.equal(absent.promptMeta.graphRAG.passagesUsedInPrompt, 0);
});

test('a rebound reference cannot disclose stale full-council prose as used, including journal transport', () => {
  const full = cardsFor(['Page of Cups', 'Knight of Cups', 'Queen of Cups', 'King of Cups'], 'rws-1909');
  const actual = cardsFor(['Page of Cups', 'Queen of Cups', 'King of Cups'], 'rws-1909');
  const stale = collectPassageCandidates(buildGraphContext(full).graphKeys).find(row => row.type === 'court-lineage');
  const graphRAGPayload = { passages: [stale], maxPassages: 5 };
  const themes = { knowledgeGraph: { ...buildGraphContext(actual), graphRAGPayload } };
  const built = build(actual, 'rws-1909', graphRAGPayload.passages);
  assert.doesNotMatch(reference(built), /Knight of Cups|Complete symbolic grouping/);
  const sourceUsage = JSON.parse(JSON.stringify(sanitizeSourceUsage(built.promptMeta.sourceUsage)));
  assert.equal(sourceUsage.graphRAG.passagesUsedInPrompt, 1, 'Actual provider retention remains truthful');
  assert.deepEqual(getTraditionalPassages(themes, { sourceUsage }, 'rws-1909'), [], 'An original candidate with different final membership cannot be attributed as used');
  assert.match(stale.promptText, /Knight of Cups/, 'Caller payload stays unchanged for fallback/history');

  const current = collectPassageCandidates(buildGraphContext(actual).graphKeys).find(row => row.type === 'court-lineage');
  themes.knowledgeGraph.graphRAGPayload.passages = [current];
  const valid = build(actual, 'rws-1909', [current]);
  const retained = getTraditionalPassages(themes, { sourceUsage: sanitizeSourceUsage(valid.promptMeta.sourceUsage) }, 'rws-1909');
  assert.equal(retained.length, 1, 'Matching current references remain displayable');
  assert.equal(retained[0].text, current.promptText);
});

test('explicit malformed or unknown membership never authorizes a full-family reference', () => {
  const raw = { ...getPassagesForPattern('suit-progression', 'Swords:mastery').passages[0], type: 'suit-progression', patternId: 'Swords:mastery' };
  for (const matchedCardKeys of [[], null, ['eight of swords'], ['eight of swords', 'eight of swords'], ['eight of swords', 'king of cups'], ['eight of swords', 9]]) {
    assert.equal(projectPassageForDeck({ ...raw, matchedCardKeys, isPartialPattern: false }), null);
  }
  assert.equal(collectPassageCandidates({ suitProgressions: [{ suit: 'Swords', stage: 'mastery', significance: 'emerging-progression' }] }).length, 0);
});

test('684 provider-target reference builds preserve every Minor subset and complete-group roles', () => {
  let count = 0;
  for (const stage of stages) for (let mask = 0; mask < 2 ** stage.members.length; mask++) {
    const selected = stage.members.filter((_, index) => mask & (1 << index));
    if (selected.length < 2) continue;
    for (const deck of decks) for (const target of ['claude', 'openai', 'modal']) {
      const cards = cardsFor(selected.map(row => row.name).reverse(), deck);
      const candidate = collectPassageCandidates(buildGraphContext(cards, { deckStyle: deck }).graphKeys, { deckStyle: deck })
        .find(row => row.type === 'suit-progression' && row.patternId === `${stage.suit}:${stage.stage}`);
      const block = reference(build(cards, deck, [candidate], target));
      for (const member of stage.members) assert.equal(block.includes(member.role), selected.includes(member), member.name);
      assert.match(block, selected.length === stage.members.length ? /Complete symbolic grouping/ : /Partial symbolic grouping/);
      assert.match(block, /positions and orientations/);
      assert.match(block, /without assuming chronological order/);
      count++;
    }
  }
  assert.equal(count, 684);
});

test('132 court subset/deck references include only drawn ranks and distinguish full councils', () => {
  const ranks = ['Page', 'Knight', 'Queen', 'King'];
  let count = 0;
  for (const suit of ['Wands', 'Cups', 'Swords', 'Pentacles']) for (let mask = 0; mask < 16; mask++) {
    const selected = ranks.filter((_, index) => mask & (1 << index));
    if (selected.length < 2) continue;
    for (const deck of decks) {
      const cards = cardsFor(selected.map(rank => `${rank} of ${suit}`), deck);
      const candidate = collectPassageCandidates(buildGraphContext(cards, { deckStyle: deck }).graphKeys, { deckStyle: deck }).find(row => row.type === 'court-lineage');
      const block = reference(build(cards, deck, [candidate]));
      for (const rank of ranks) {
        const label = getDeckAlias(MINOR_ARCANA.find(row => row.name === `${rank} of ${suit}`), deck);
        assert.equal(block.includes(`${label}:`), selected.includes(rank), label);
      }
      assert.match(block, selected.length === 4 ? /Complete symbolic grouping/ : /Partial symbolic grouping/);
      assert.match(block, /do not infer actual people, family history, or events/);
      count++;
    }
  }
  assert.equal(count, 132);
});
