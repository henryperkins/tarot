import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildRwsGroundingRecordsForCard } from '../scripts/training/buildRwsGroundingDataset.js';

describe('rws grounding dataset builder', () => {
  it('emits card identification, symbol grounding, vqa, and absence records', () => {
    const records = buildRwsGroundingRecordsForCard('The Fool');
    assert.ok(records.some((record) => record.task_type === 'card_identification'));
    assert.ok(records.some((record) => record.task_type === 'symbol_grounding'));
    assert.ok(records.some((record) => record.task_type === 'tarot_vqa'));
    assert.ok(records.some((record) => record.task_type === 'symbol_absence_check'));
    assert.ok(records.every((record) => record.deck === 'Rider-Waite-Smith'));
  });

  it('returns empty array for unknown cards', () => {
    const records = buildRwsGroundingRecordsForCard('Card That Does Not Exist');
    assert.deepEqual(records, []);
  });

  it('includes the canonical card name on every record', () => {
    const records = buildRwsGroundingRecordsForCard('The Magician');
    assert.ok(records.length > 0);
    assert.ok(records.every((record) => record.card === 'The Magician'));
  });
});
