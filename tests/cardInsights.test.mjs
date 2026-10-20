import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCardInsights } from '../src/lib/cardInsights.js';
import * as cards from '../src/lib/cardLookup.js';

test('full symbol details retain the dawn that explains reversed Ten of Swords recovery', () => {
  const details = buildCardInsights({ name: 'Ten of Swords', isReversed: true }, { includeAllSymbols: true });
  assert.ok(details.symbols.some(symbol => symbol.object === 'dawn light' && symbol.meaning === 'new beginning coming'));
  assert.ok(details.keywords.includes('slowly rising again'));
});

test('compact symbol summaries remain short for existing standalone callers', () => {
  assert.equal(buildCardInsights({ name: 'Ten of Swords' }).symbols.length, 3);
});

test('deck aliases use canonical card meaning and symbols', () => {
  const details = buildCardInsights({ name: 'Art', canonicalName: 'Temperance', number: 14 }, { includeAllSymbols: true });
  assert.ok(details.keywords.includes('moderation'));
  assert.ok(details.symbols.length > 0);
});

test('a scan preview belongs to the selected card and other decks keep their original artwork', () => {
  assert.equal(cards.getCardPreviewImage?.({ image: '/images/cards/RWS1909_-_10_Swords.jpeg' }), '/images/cards/w360/RWS1909_-_10_Swords.webp');
  assert.equal(cards.getCardPreviewImage?.({ image: '/images/cards/thoth/Art.webp' }), '/images/cards/thoth/Art.webp');
});
