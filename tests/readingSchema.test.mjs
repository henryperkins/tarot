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

// Location schema tests
test('safeParseReadingRequest accepts valid location object', () => {
  const payload = {
    ...basePayload,
    location: {
      latitude: 40.7128,
      longitude: -74.0060,
      timezone: 'America/New_York',
      accuracy: 100,
      source: 'browser'
    },
    persistLocationToJournal: true
  };

  const result = safeParseReadingRequest(payload);
  assert.equal(result.success, true, result.error || 'payload with location should be valid');
  assert.equal(result.data.location.latitude, 40.7128);
  assert.equal(result.data.location.longitude, -74.0060);
  assert.equal(result.data.location.timezone, 'America/New_York');
  assert.equal(result.data.persistLocationToJournal, true);
});

test('safeParseReadingRequest accepts payload without location', () => {
  const result = safeParseReadingRequest(basePayload);
  assert.equal(result.success, true, result.error || 'payload without location should be valid');
  assert.equal(result.data.location, undefined);
});

test('safeParseReadingRequest rejects invalid latitude out of range', () => {
  const invalidPayload = {
    ...basePayload,
    location: {
      latitude: 91, // Invalid: must be -90 to 90
      longitude: -74.0060
    }
  };

  const result = safeParseReadingRequest(invalidPayload);
  assert.equal(result.success, false, 'latitude > 90 should fail');
});

test('safeParseReadingRequest rejects invalid longitude out of range', () => {
  const invalidPayload = {
    ...basePayload,
    location: {
      latitude: 40.7128,
      longitude: 181 // Invalid: must be -180 to 180
    }
  };

  const result = safeParseReadingRequest(invalidPayload);
  assert.equal(result.success, false, 'longitude > 180 should fail');
});

test('safeParseReadingRequest accepts location with minimal fields', () => {
  const minimalPayload = {
    ...basePayload,
    location: {
      latitude: 51.5074,
      longitude: -0.1278
    }
  };

  const result = safeParseReadingRequest(minimalPayload);
  assert.equal(result.success, true, result.error || 'minimal location should be valid');
  assert.equal(result.data.location.latitude, 51.5074);
  assert.equal(result.data.location.timezone, undefined);
});

test('safeParseReadingRequest strips journal and memory context fields from initial reading payloads', () => {
  const payload = {
    ...basePayload,
    journalContext: {
      entries: [{ id: 'entry-1', summary: 'old reading' }]
    },
    memoryContext: {
      notes: ['remember this']
    },
    followUpHistory: [
      { question: 'What does this mean?', answer: 'context from another endpoint' }
    ]
  };

  const result = safeParseReadingRequest(payload);
  assert.equal(result.success, true, result.error || 'payload should still validate');
  assert.equal(Object.prototype.hasOwnProperty.call(result.data, 'journalContext'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.data, 'memoryContext'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.data, 'followUpHistory'), false);
});
