import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { jsonRequest } from './helpers/journalFixtures.mjs';
import { drawForSpread } from '../functions/lib/serverDraw.js';
import { onRequestPost as drawRoute } from '../functions/api/tarot-reading-draw.js';
import { canonicalizeCardName } from '../shared/vision/cardNameMapping.js';
import { hashString } from '../shared/utils.js';
import { SPREADS } from '../src/data/spreads.js';

const THREE = { name: SPREADS.threeCard.name, key: 'threeCard' };

describe('drawForSpread', () => {
  it('draws the same cards for the same seed and spread, one per position', () => {
    const a = drawForSpread({ spreadInfo: THREE, seed: 'rose' });
    const b = drawForSpread({ spreadInfo: THREE, seed: 'rose' });

    assert.equal(a.ok, true);
    assert.deepEqual(a.cardsInfo, b.cardsInfo);
    assert.equal(a.seed, b.seed);
    assert.equal(typeof a.seed, 'number');
    assert.deepEqual(a.cardsInfo.map((card) => card.position), SPREADS.threeCard.positions);
    assert.deepEqual(a.spreadInfo, { key: 'threeCard', name: SPREADS.threeCard.name });
    assert.equal(a.deckStyle, 'rws-1909');
  });

  it('keeps the existing /api semantics for numeric string seeds', () => {
    const textSeed = drawForSpread({ spreadInfo: THREE, seed: '4242' });
    const numericSeed = drawForSpread({ spreadInfo: THREE, seed: 4242 });
    assert.equal(textSeed.seed, hashString('4242'));
    assert.equal(numericSeed.seed, 4242);
    assert.notEqual(textSeed.seed, numericSeed.seed);
  });

  it('never reverses cards when allowReversals is false', () => {
    const drawn = drawForSpread({ spreadInfo: { name: SPREADS.celtic.name, key: 'celtic' }, seed: 'upright', allowReversals: false });
    assert.ok(drawn.cardsInfo.every((card) => card.orientation === 'Upright'));
  });

  it('labels cards for the selected deck and keeps their canonical identity', () => {
    const drawn = drawForSpread({ spreadInfo: { name: SPREADS.celtic.name, key: 'celtic' }, seed: 'thoth', deckStyle: 'thoth-a1' });
    assert.equal(drawn.deckStyle, 'thoth-a1');
    for (const card of drawn.cardsInfo) {
      assert.equal(canonicalizeCardName(card.card, 'thoth-a1'), card.canonicalName);
    }
  });

  it('rejects unknown, custom and nameless spreads with 400', () => {
    assert.deepEqual(
      [drawForSpread({ spreadInfo: { name: 'Nope' } }).status, drawForSpread({ spreadInfo: { name: 'Mine', key: 'custom' } }).status, drawForSpread({}).status],
      [400, 400, 400]
    );
  });
});

describe('POST /api/tarot-reading/draw after the extraction', () => {
  it('still answers 400 with the same message for an unknown spread', async () => {
    const response = await drawRoute({
      request: jsonRequest('https://example.com/api/tarot-reading/draw', { body: { spreadInfo: { name: 'Nope' } } }),
      env: {},
      waitUntil: () => {}
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /^Unknown spread "Nope"/);
  });
});
