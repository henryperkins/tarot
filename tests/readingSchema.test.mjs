import test from 'node:test';
import assert from 'node:assert/strict';

import { safeParseReadingRequest } from '../shared/contracts/readingSchema.js';

const basePayload = {
  spreadInfo: {
    name: 'Three-Card Story (Past · Present · Future)',
    key: 'threeCard',
    deckStyle: 'rws-1909'
  },
  cardsInfo: [
    {
      position: ' Past ',
      card: ' The Fool ',
      canonicalName: 'The Fool',
      canonicalKey: 'major-00',
      aliases: [],
      orientation: 'Upright',
      meaning: 'Fresh starts and boundless curiosity.',
      number: 0,
      suit: null,
      rank: null,
      rankValue: 0,
      userReflection: null
    },
    {
      position: 'Present',
      card: 'The Magician',
      canonicalName: 'The Magician',
      canonicalKey: 'major-01',
      aliases: [],
      orientation: 'Reversed',
      meaning: 'Paused manifestation momentum.',
      number: 1,
      suit: null,
      rank: null,
      rankValue: 1,
      userReflection: null
    },
    {
      position: 'Future',
      card: 'The High Priestess',
      canonicalName: 'The High Priestess',
      canonicalKey: 'major-02',
      aliases: [],
      orientation: 'Upright',
      meaning: 'Deep intuition moments',
      number: 2,
      suit: null,
      rank: null,
      rankValue: 2,
      userReflection: null
    }
  ],
  userQuestion: 'What should I focus on next?',
  reflectionsText: 'Past: leaned into the unknown',
  deckStyle: 'rws-1909'
};

test('safeParseReadingRequest trims and validates core payloads', () => {
  const result = safeParseReadingRequest(basePayload);
  assert.equal(result.success, true, result.error || 'payload should be valid');

  assert.equal(result.data.spreadInfo.name, 'Three-Card Story (Past · Present · Future)');
  assert.equal(result.data.cardsInfo[0].position, 'Past'); // trimmed
  assert.equal(result.data.cardsInfo[0].card, 'The Fool');
});

test('safeParseReadingRequest surfaces orientation errors', () => {
  const invalid = {
    ...basePayload,
    cardsInfo: [
      {
        ...basePayload.cardsInfo[0],
        orientation: 'Sideways'
      }
    ]
  };

  const result = safeParseReadingRequest(invalid);
  assert.equal(result.success, false, 'orientation mismatch should fail');
  assert.match(result.error, /orientation/i);
});
