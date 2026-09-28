import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSpreadInsightSections, findInsightCardMentions } from '../src/lib/spreadInsights.js';
import { getCardForDeck } from '../src/lib/cardLookup.js';
import { getPassageSource } from '../shared/passageSource.js';

test('insight summary prioritizes detected patterns and retains every item once', () => {
  const spread = [
    { key: 'deck-scope', text: 'Deck context.' },
    { key: 'rel-story', text: 'Story flow.' },
    { key: 'reversal-framework', text: 'Reversal context.' }
  ];
  const archetypes = [
    { id: 'dyad', text: 'Two connected cards.', priority: 4 },
    { id: 'triad', text: 'Three connected cards.', priority: 1 }
  ];
  const result = buildSpreadInsightSections(spread, archetypes);
  assert.deepEqual(result.highlights.map(item => item.id || item.key), ['triad', 'rel-story', 'dyad']);
  const all = [...result.highlights, ...result.spreadDetails, ...result.archetypes];
  assert.equal(all.length, 5);
  assert.equal(new Set(all.map(item => item.id || item.key)).size, 5);
  assert.equal(archetypes[0].id, 'dyad', 'Input order is not mutated');
});

test('empty or malformed insight collections do not create empty sections', () => {
  assert.deepEqual(buildSpreadInsightSections([null, {}, { text: ' ' }], null), {
    highlights: [], spreadDetails: [], archetypes: []
  });
});

test('card mentions use whole names and retain their spread indices', () => {
  const text = 'The heart of Art, Temperance, DEATH; The Star is not drawn. Earth.';
  const cards = [{ name: 'Death' }, { name: 'Art', canonicalName: 'Temperance' }];
  const result = findInsightCardMentions(text, cards);
  assert.deepEqual(result.map(match => [text.slice(match.start, match.end), match.index]), [
    ['Art', 1], ['Temperance', 1], ['DEATH', 0]
  ]);
  assert.equal(findInsightCardMentions('éArt Arté', cards).length, 0);
});

test('Thoth court aliases resolve by the tradition of the text', () => {
  const cards = [
    getCardForDeck({ name: 'Knight of Cups' }, 'thoth-a1'),
    getCardForDeck({ name: 'King of Cups' }, 'thoth-a1')
  ];
  assert.equal(findInsightCardMentions('Knight of Cups', cards)[0].index, 1);
  assert.equal(findInsightCardMentions('Knight of Cups', cards, { sourceDeck: 'rws-1909' })[0].index, 0);
  assert.equal(findInsightCardMentions('Prince of Cups', cards, { sourceDeck: 'thoth-a1' })[0].index, 0);
});

test('deck display preserves canonical identity, orientation, and matching artwork', () => {
  const original = { name: 'Temperance', isReversed: true };
  const thoth = getCardForDeck(original, 'thoth-a1');
  assert.equal(thoth.name, 'Art');
  assert.equal(thoth.canonicalName, 'Temperance');
  assert.equal(thoth.isReversed, true);
  assert.match(thoth.image, /thoth.*art/);
  const marseille = getCardForDeck(thoth, 'marseille-classic');
  assert.match(marseille.name, /Temperance/);
  assert.match(marseille.image, /marseille\/major14/);
  assert.equal(marseille.canonicalName, 'Temperance');
  assert.deepEqual(original, { name: 'Temperance', isReversed: true });
});

test('source labels cover legacy passages without inventing unknown provenance', () => {
  assert.equal(getPassageSource({ type: 'triad' }).deckStyle, 'rws-1909');
  assert.equal(getPassageSource({ type: 'thoth-suit' }).label, 'Thoth');
  assert.equal(getPassageSource({ type: 'marseille-numerology' }).deckStyle, 'marseille-classic');
  assert.equal(getPassageSource({ type: 'triad', sourceDeck: 'thoth-a1' }).label, 'Thoth');
  assert.equal(getPassageSource({ type: 'custom' }), null);
  assert.equal(getPassageSource({ type: 'triad', sourceDeck: 'unknown' }), null);
});
