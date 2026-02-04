import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReadingTextForTtsHighlight } from '../src/lib/formatting.js';

test('normalizeReadingTextForTtsHighlight strips markdown and normalizes block breaks', () => {
  const input = '### Opening\n\n**The Star** shines.\n\n- First\n- Second';
  const output = normalizeReadingTextForTtsHighlight(input);
  assert.equal(output, 'Opening\n\nThe Star shines.\n\nFirst\n\nSecond');
});
