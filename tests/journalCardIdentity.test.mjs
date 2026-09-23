import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCanonicalCard, getCardImage } from '../src/lib/cardLookup.js';

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
