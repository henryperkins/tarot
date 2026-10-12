import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { FALLBACK_IMAGE, getCanonicalCard, getCardImage, getCardForDeck } from '../src/lib/cardLookup.js';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';

test('unknown saved cards use an existing card back in every companion deck', async () => {
  const unknown = { name: 'Unknown traveler' };
  assert.equal(getCardImage(unknown), FALLBACK_IMAGE);
  for (const deck of ['rws-1909', 'thoth-a1', 'marseille-classic']) {
    assert.equal(getCardForDeck(unknown, deck).image, FALLBACK_IMAGE);
  }
  const asset = await readFile(new URL(`../public${FALLBACK_IMAGE}`, import.meta.url));
  assert.deepEqual([...asset.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test('journal display aliases preserve distinct canonical Thoth court identities', () => {
  const prince = { name: 'Prince of Cups', canonicalName: 'Knight of Cups', canonicalKey: 'knight of cups' };
  const knight = { name: 'Knight of Cups', canonicalName: 'King of Cups', canonicalKey: 'king of cups' };
  assert.equal(getCanonicalCard(prince)?.name, 'Knight of Cups');
  assert.equal(getCanonicalCard(knight)?.name, 'King of Cups');
  assert.equal(getCardImage(prince), '/images/cards/RWS1909_-_Cups_12.jpeg');
  assert.equal(getCardImage(knight), '/images/cards/RWS1909_-_Cups_14.jpeg');
  assert.equal(prince.name, 'Prince of Cups');
  assert.equal(knight.name, 'Knight of Cups');
});

test('journal card identity falls back to the name when explicit identity is unusable', () => {
  const judgement = MAJOR_ARCANA.find(card => card.name === 'Judgement');
  assert.equal(getCanonicalCard({ name: 'Judgement', canonicalName: 'Judgment' })?.name, 'Judgement');
  assert.equal(getCanonicalCard({ name: 'Judgement', canonicalName: 7 })?.name, 'Judgement');
  assert.equal(getCardImage({ name: 'Judgement', canonicalName: 'Judgment' }), judgement.image);
  assert.equal(getCanonicalCard({ name: 'Knight of Cups', displayName: 'Prince of Cups', canonicalName: 'Knight of Cups' })?.name, 'Knight of Cups');
});
