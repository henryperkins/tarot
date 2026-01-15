import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizePositionKey } from '../functions/lib/narrative/helpers.js';

describe('normalizePositionKey', () => {
  describe('Celtic Cross positions', () => {
    it('normalizes position without Card suffix to canonical form', () => {
      assert.strictEqual(
        normalizePositionKey('Present — core situation'),
        'Present — core situation (Card 1)'
      );
    });

    it('passes through already-canonical position unchanged', () => {
      assert.strictEqual(
        normalizePositionKey('Present — core situation (Card 1)'),
        'Present — core situation (Card 1)'
      );
    });

    it('normalizes all 10 Celtic Cross positions', () => {
      const mappings = [
        ['Present — core situation', 'Present — core situation (Card 1)'],
        ['Challenge — crossing / tension', 'Challenge — crossing / tension (Card 2)'],
        ['Past — what lies behind', 'Past — what lies behind (Card 3)'],
        ['Near Future — what lies before', 'Near Future — what lies before (Card 4)'],
        ['Conscious — goals & focus', 'Conscious — goals & focus (Card 5)'],
        ['Subconscious — roots / hidden forces', 'Subconscious — roots / hidden forces (Card 6)'],
        ['Self / Advice — how to meet this', 'Self / Advice — how to meet this (Card 7)'],
        ['External Influences — people & environment', 'External Influences — people & environment (Card 8)'],
        ['Hopes & Fears — deepest wishes & worries', 'Hopes & Fears — deepest wishes & worries (Card 9)'],
        ['Outcome — likely path if unchanged', 'Outcome — likely path if unchanged (Card 10)']
      ];

      for (const [input, expected] of mappings) {
        assert.strictEqual(normalizePositionKey(input), expected, `Failed for: ${input}`);
      }
    });
  });

  describe('Other spread positions', () => {
    it('passes through Three-Card positions unchanged (already match)', () => {
      assert.strictEqual(
        normalizePositionKey('Past — influences that led here'),
        'Past — influences that led here'
      );
    });

    it('passes through unknown positions unchanged', () => {
      assert.strictEqual(
        normalizePositionKey('Custom Position'),
        'Custom Position'
      );
    });
  });
});
