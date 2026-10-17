import test from 'node:test';
import assert from 'node:assert/strict';
import { isVisualCueBinding, sameVisualCueBinding } from '../shared/contracts/visualCueBinding.js';
import { visualCueBindingSchema } from '../shared/contracts/visualCueBatches.js';

const valid = { readingResultId: 'reading-1', sourceRevision: 0, spreadHash: 'a'.repeat(64),
  contextHash: 'b'.repeat(64), artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'v1' };

test('startup binding validation agrees with the authoritative strict schema', () => {
  const values = [undefined, null, [], '', true, 0, {}, valid, { ...valid, extra: true }];
  for (const key of Object.keys(valid)) {
    const missing = { ...valid }; delete missing[key]; values.push(missing);
    for (const value of [undefined, null, '', 0, 1, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1,
      Number.MAX_SAFE_INTEGER, [], {}, ' ', 'a'.repeat(63), 'a'.repeat(65), 'A'.repeat(64), '0'.repeat(64)]) {
      values.push({ ...valid, [key]: value });
    }
  }
  for (const value of values) assert.equal(isVisualCueBinding(value), visualCueBindingSchema.safeParse(value).success, JSON.stringify(value));
});

test('binding equality rejects stale epochs, invalid fields and added fields', () => {
  assert.equal(sameVisualCueBinding(valid, { ...valid }), true);
  for (const key of Object.keys(valid)) {
    assert.equal(sameVisualCueBinding(valid, { ...valid, [key]: key === 'sourceRevision' ? 1 : `${valid[key]}x` }), false);
  }
  assert.equal(sameVisualCueBinding(valid, { ...valid, extra: true }), false);
  assert.equal(sameVisualCueBinding(null, null), false);
});
