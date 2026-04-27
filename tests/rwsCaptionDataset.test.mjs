import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildRwsCaptionDataset,
  buildRwsCaptionRecord
} from '../scripts/training/generateRwsCaptionDataset.mjs';

describe('rws multimodal caption dataset', () => {
  it('emits symbol-rich captions and hard negatives for The Fool', () => {
    const record = buildRwsCaptionRecord('The Fool');

    assert.equal(record.deck, 'rider_waite_smith');
    assert.equal(record.card, 'The Fool');
    assert.equal(record.stable_id, 'major_00_fool');
    assert.equal(record.image, 'data/raw_images/rws/major_00_fool.jpg');
    assert.equal(record.orientation, 'upright');
    assert.equal(record.positive_captions.length, 3);

    const captionText = record.positive_captions.join(' ');
    assert.match(captionText, /cliff/i);
    assert.match(captionText, /dog/i);
    assert.match(captionText, /white rose/i);

    const symbolIds = record.symbols.map((symbol) => symbol.symbolId);
    assert.ok(symbolIds.includes('rws.fool.cliff'));
    assert.ok(record.symbols.find((symbol) => symbol.symbol === 'cliff')?.salience > 0.9);

    const hardNegativeCards = record.hard_negative_captions.map((entry) => entry.card);
    assert.deepEqual(hardNegativeCards, ['The Sun', 'Strength']);
  });

  it('emits minor-card records from generated minor annotations without coordinates', () => {
    const record = buildRwsCaptionRecord('Two of Swords');

    assert.equal(record.stable_id, 'swords_02');
    assert.ok(record.symbols.length > 0);
    assert.ok(record.symbols.every((symbol) => symbol.symbolId.startsWith('rws.two_of_swords.')));
    assert.ok(record.symbols.some((symbol) => symbol.symbol === 'two_razor_sharp_swords'));
    assert.ok(record.symbols.every((symbol) => symbol.expectedRegion === null));
  });

  it('builds one upright row per card by default', () => {
    const rows = buildRwsCaptionDataset({ limit: 78 });

    assert.equal(rows.length, 78);
    assert.equal(rows[0].orientation, 'upright');
    assert.equal(rows.at(-1).deck, 'rider_waite_smith');
  });

  it('can generate upright and reversed rows', () => {
    const rows = buildRwsCaptionDataset({ limit: 1, orientation: 'both' });

    assert.deepEqual(rows.map((row) => row.orientation), ['upright', 'reversed']);
  });
});
