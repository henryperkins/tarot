import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REVERSAL_FRAMEWORK_OPTIONS, REVERSAL_FRAMEWORK_KEYS } from '../src/lib/preferenceStorage.js';
import { REVERSAL_FRAMEWORK_OVERRIDES } from '../functions/lib/spreadAnalysis.js';

test('persisted reversal lens options cover every supported reading override', () => {
  assert.deepEqual([...REVERSAL_FRAMEWORK_KEYS].sort(), [...REVERSAL_FRAMEWORK_OVERRIDES].sort());
  assert.equal(new Set(REVERSAL_FRAMEWORK_KEYS).size, REVERSAL_FRAMEWORK_KEYS.length);
  assert.equal(REVERSAL_FRAMEWORK_OPTIONS[0].value, 'auto');
  assert.deepEqual(REVERSAL_FRAMEWORK_OPTIONS.slice(1).map(option => option.value), [...REVERSAL_FRAMEWORK_KEYS]);
  for (const option of REVERSAL_FRAMEWORK_OPTIONS) {
    assert.ok(option.label);
    assert.ok(option.description);
  }
});
