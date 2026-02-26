import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
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
  it('rejects relationship spreads with fewer than three cards', () => {
    const payload = {
      spreadInfo: { name: 'Relationship Snapshot' },
      cardsInfo: [
        card('You / your energy'),
        card('Them / their energy')
      ]
    };

    const err = validatePayload(payload);
    assert.match(err, /requires at least 3 cards/);
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

  it('accepts relationship spread clarifier cards beyond the core three', () => {
    const payload = {
      spreadInfo: { name: 'Relationship Snapshot' },
      cardsInfo: [
        card('You / your energy'),
        card('Them / their energy'),
        card('The connection / shared lesson'),
        card('Dynamics / guidance'),
        card('Outcome / what this can become')
      ]
    };

    const err = validatePayload(payload);
    assert.equal(err, null);
  });

  it('rejects relationship spread payloads above the clarifier limit', () => {
    const payload = {
      spreadInfo: { name: 'Relationship Snapshot' },
      cardsInfo: [
        card('You / your energy'),
        card('Them / their energy'),
        card('The connection / shared lesson'),
        card('Dynamics / guidance'),
        card('Outcome / what this can become'),
        card('Additional clarifier 3')
      ]
    };

    const err = validatePayload(payload);
    assert.match(err, /allows at most 5 cards/);
  });

  it('accepts native spread aliases for name/key pairs', () => {
    const payload = {
      spreadInfo: { name: 'Three Card', key: 'three-card' },
      cardsInfo: [
        card('Past'),
        card('Present'),
        card('Future')
      ]
    };

    const err = validatePayload(payload);
    assert.equal(err, null);
  });

  it('skips alias resolution for explicitly custom spreads', () => {
    // "Daily Draw" would normally alias to the single-card built-in,
    // but key="custom" tells the validator to treat it as user-created.
    const payload = {
      spreadInfo: { name: 'Daily Draw', key: 'custom' },
      cardsInfo: [
        card('Situation'),
        card('Advice'),
        card('Outcome')
      ]
    };

    const err = validatePayload(payload);
    // Should NOT reject with "expects 1 cards" because alias was skipped
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

describe('initial tarot-reading boundary', () => {
  it('does not import follow-up journal or memory tooling', () => {
    const source = readFileSync(new URL('../functions/api/tarot-reading.js', import.meta.url), 'utf8');

    assert.equal(source.includes('reading-followup'), false);
    assert.equal(source.includes('findSimilarJournalEntries'), false);
    assert.equal(source.includes('getRecurringCardPatterns'), false);
    assert.equal(source.includes('handleMemoryToolCall'), false);
    assert.equal(source.includes('MEMORY_TOOL_AZURE_RESPONSES_FORMAT'), false);
  });
});
