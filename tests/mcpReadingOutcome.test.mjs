import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { classifyReadingResult, READING_OUTCOME } from '../functions/lib/mcp/readingOutcome.js';

describe('classifyReadingResult', () => {
  const cases = [
    ['a narrative', { reading: 'The Star returns.', provider: 'modal-qwen' }, READING_OUTCOME.READING],
    ['a reading after a failed streamed draft', { reading: 'Vetted.', provider: 'azure-gpt5', gateBlocked: true, gateReason: 'quality_gate_streaming' }, READING_OUTCOME.READING],
    ['a crisis response by provider', { reading: 'Please reach out.', provider: 'safety-gate' }, READING_OUTCOME.SUPPORT],
    ['a crisis response by reason', { reading: 'Please reach out.', provider: 'x', gateBlocked: true, gateReason: 'crisis_gate' }, READING_OUTCOME.SUPPORT],
    ['an eval-gate fallback', { reading: 'A pause.', provider: 'safe-fallback', gateBlocked: true, gateReason: 'tone_lt_2' }, READING_OUTCOME.WITHHELD],
    ['a fallback without gate fields', { reading: 'A pause.', provider: 'safe-fallback' }, READING_OUTCOME.WITHHELD],
    ['an unknown gate reason', { reading: 'Text.', provider: 'modal-qwen', gateBlocked: true, gateReason: 'new_gate' }, READING_OUTCOME.WITHHELD],
    ['a gate block without a reason', { reading: 'Text.', provider: 'modal-qwen', gateBlocked: true }, READING_OUTCOME.WITHHELD],
    ['blank text', { reading: '  \n', provider: 'modal-qwen' }, READING_OUTCOME.EMPTY],
    ['missing text', { reading: null, provider: 'modal-qwen' }, READING_OUTCOME.EMPTY],
    ['no result', null, READING_OUTCOME.EMPTY]
  ];
  for (const [label, result, expected] of cases) {
    it(`classifies ${label} as ${expected}`, () => {
      assert.equal(classifyReadingResult(result), expected);
    });
  }
});
