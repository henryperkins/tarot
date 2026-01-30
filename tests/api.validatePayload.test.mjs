import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validatePayload } from '../functions/api/tarot-reading.js';

function card(position) {
  return {
    position,
    card: 'The Fool',
    orientation: 'Upright',
    meaning: 'New beginnings and open horizons.'
  };
}

describe('validatePayload spread count enforcement', () => {
  it('rejects incorrect card counts for known spreads', () => {
    const payload = {
      spreadInfo: { name: 'Relationship Snapshot' },
      cardsInfo: [
        card('You / your energy'),
        card('Them / their energy')
      ]
    };

    const err = validatePayload(payload);
    assert.match(err, /expects 3 cards/);
  });

  it('rejects insufficient cards for larger spreads', () => {
    const payload = {
      spreadInfo: { name: 'Decision / Two-Path' },
      cardsInfo: [
        card('Heart of the decision'),
        card('Path A — energy & likely outcome'),
        card('Path B — energy & likely outcome')
      ]
    };

    const err = validatePayload(payload);
    assert.match(err, /expects 5 cards/);
  });

  it('accepts correct card counts for known spreads', () => {
    const payload = {
      spreadInfo: { name: 'Relationship Snapshot' },
      cardsInfo: [
        card('You / your energy'),
        card('Them / their energy'),
        card('The connection / shared lesson')
      ]
    };

    const err = validatePayload(payload);
    assert.equal(err, null);
  });
});

describe('tarot-reading invalid JSON handling', () => {
  it('returns 400 for invalid JSON body', async () => {
    const { onRequestPost } = await import('../functions/api/tarot-reading.js');

    // Create a request that returns invalid JSON
    const request = {
      url: 'https://example.com/api/tarot-reading',
      method: 'POST',
      headers: {
        get: () => null,
        set: () => {},
        has: () => false
      },
      text: async () => 'not valid json {'
    };
    const env = {};

    const response = await onRequestPost({ request, env, waitUntil: () => {} });
    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.strictEqual(body.error, 'Invalid JSON payload.');
  });
});
