// Saved journal cards are shown in the reading's own deck (art and names),
// while their canonical identity stays available for meanings and lookups.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { access } from 'node:fs/promises';
import { hasOwnDeckArt, toDeckCard, toDeckCards } from '../src/lib/journal/deckCards.js';
import { getCanonicalCard, getCardImage, getCardTinyImage } from '../src/lib/cardLookup.js';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../src/data/minorArcana.js';

// The shape useSaveReading stores: canonical names, no image.
const SAVED = [
  { position: 'Present', name: 'The High Priestess', number: 2, suit: null, rank: null, rankValue: null, orientation: 'Upright' },
  { position: 'Challenge', name: 'Justice', number: 11, suit: null, rank: null, rankValue: null, orientation: 'Reversed' },
  { position: 'Advice', name: 'Knight of Cups', number: null, suit: 'Cups', rank: 'Knight', rankValue: 12, orientation: 'Upright' }
];

test('Rider-Waite and unknown decks keep the saved cards as they are', () => {
  for (const deck of ['rws-1909', null, undefined, 'unknown-deck']) {
    assert.equal(toDeckCards(SAVED, deck), SAVED);
    assert.equal(hasOwnDeckArt(deck), false);
  }
  assert.deepEqual(toDeckCards(null, 'thoth-a1'), []);
  assert.equal(toDeckCard(null, 'thoth-a1'), null);
});

test('a Thoth reading shows Thoth names and art, keeping canonical identity', async () => {
  const [priestess, justice, knight] = toDeckCards(SAVED, 'thoth-a1');
  assert.equal(priestess.name, 'The Priestess');
  assert.equal(priestess.canonicalName, 'The High Priestess');
  assert.equal(justice.name, 'Adjustment');
  assert.equal(justice.orientation, 'Reversed');
  assert.equal(knight.name, 'Prince of Cups');
  assert.equal(getCanonicalCard(knight)?.name, 'Knight of Cups');
  for (const card of [priestess, justice, knight]) {
    assert.match(getCardImage(card), /^\/images\/cards\/thoth\/thoth_.+\.png$/);
    await access(new URL(`../public${getCardImage(card)}`, import.meta.url));
  }
  // The saved list itself is not rewritten.
  assert.equal(SAVED[0].name, 'The High Priestess');
});

test('a Marseille reading shows Marseille titles and art', async () => {
  const [priestess, , knight] = toDeckCards(SAVED, 'marseille-classic');
  assert.match(priestess.name, /^La Papesse/);
  assert.equal(priestess.canonicalName, 'The High Priestess');
  assert.equal(getCanonicalCard(priestess)?.upright, getCanonicalCard({ name: 'The High Priestess' })?.upright);
  for (const card of [priestess, knight]) {
    assert.match(getCardImage(card), /^\/images\/cards\/marseille\/.+\.jpg$/);
    await access(new URL(`../public${getCardImage(card)}`, import.meta.url));
  }
});

test('cards saved with a Thoth label and canonical identity map back to the same card', () => {
  const saved = { name: 'Prince of Cups', canonicalName: 'Knight of Cups', suit: 'Cups', rank: 'Knight', rankValue: 12, orientation: 'Upright' };
  const shown = toDeckCard(saved, 'thoth-a1');
  assert.equal(shown.name, 'Prince of Cups');
  assert.equal(shown.canonicalName, 'Knight of Cups');
});

// Collapsed rows show each reading's art about 34 CSS px wide; every card in
// every deck needs its 120 px rendition, or a row would load the full image.
test('every card in all three decks has its small rendition', async () => {
  const cards = [...MAJOR_ARCANA, ...MINOR_ARCANA];
  assert.equal(cards.length, 78);
  for (const deck of ['rws-1909', 'thoth-a1', 'marseille-classic']) {
    for (const card of cards) {
      const image = getCardImage(toDeckCard(card, deck));
      const tiny = getCardTinyImage(image);
      assert.ok(tiny, `${deck} ${card.name} (${image}) has no small rendition path`);
      assert.match(tiny, /^\/images\/cards\/w120\/.+\.webp$/);
      await access(new URL(`../public${tiny}`, import.meta.url));
    }
  }
  assert.equal(getCardTinyImage('/images/card-back.png'), null);
  assert.equal(getCardTinyImage(undefined), null);
});
