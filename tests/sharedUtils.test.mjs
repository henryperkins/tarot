import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  safeJsonParse,
  hashString,
  xorshift32,
  seededShuffle,
  ensureQuestionMark,
  truncateText
} from '../shared/utils.js';

describe('shared/utils.js', () => {
  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      assert.deepStrictEqual(safeJsonParse('{"a":1}', null), { a: 1 });
      assert.deepStrictEqual(safeJsonParse('[1,2,3]', null), [1, 2, 3]);
      assert.strictEqual(safeJsonParse('"hello"', null), 'hello');
    });

    it('should return fallback for invalid JSON', () => {
      assert.strictEqual(safeJsonParse('invalid', 'fallback'), 'fallback');
      assert.deepStrictEqual(safeJsonParse('{broken', []), []);
    });

    it('should return fallback for null/undefined', () => {
      assert.strictEqual(safeJsonParse(null, 'fb'), 'fb');
      assert.strictEqual(safeJsonParse(undefined, 'fb'), 'fb');
    });

    it('should return non-string values as-is (already parsed)', () => {
      const obj = { a: 1 };
      const arr = [1, 2, 3];
      assert.strictEqual(safeJsonParse(obj, null), obj);
      assert.strictEqual(safeJsonParse(arr, null), arr);
      assert.strictEqual(safeJsonParse(42, null), 42);
    });

    it('should handle empty string', () => {
      assert.strictEqual(safeJsonParse('', 'fallback'), 'fallback');
    });
  });

  describe('hashString (FNV-1a)', () => {
    it('should produce deterministic hashes', () => {
      assert.strictEqual(hashString('test'), hashString('test'));
      assert.strictEqual(hashString('hello world'), hashString('hello world'));
    });

    it('should produce different hashes for different inputs', () => {
      assert.notStrictEqual(hashString('test1'), hashString('test2'));
      assert.notStrictEqual(hashString('a'), hashString('b'));
    });

    it('should handle empty string', () => {
      const hash = hashString('');
      assert.strictEqual(typeof hash, 'number');
      assert.ok(hash >= 0);
    });

    it('should return unsigned 32-bit integers', () => {
      const hash = hashString('test');
      assert.ok(hash >= 0);
      assert.ok(hash <= 0xFFFFFFFF);
    });
  });

  describe('xorshift32', () => {
    it('should return a generator function', () => {
      const rand = xorshift32(12345);
      assert.strictEqual(typeof rand, 'function');
    });

    it('should produce values in [0, 1)', () => {
      const rand = xorshift32(12345);
      for (let i = 0; i < 100; i++) {
        const value = rand();
        assert.ok(value >= 0, `Value ${value} should be >= 0`);
        assert.ok(value < 1, `Value ${value} should be < 1`);
      }
    });

    it('should be deterministic with same seed', () => {
      const rand1 = xorshift32(42);
      const rand2 = xorshift32(42);
      for (let i = 0; i < 10; i++) {
        assert.strictEqual(rand1(), rand2());
      }
    });

    it('should produce different sequences for different seeds', () => {
      const rand1 = xorshift32(1);
      const rand2 = xorshift32(2);
      // At least one of the first 10 values should differ
      let allSame = true;
      for (let i = 0; i < 10; i++) {
        if (rand1() !== rand2()) {
          allSame = false;
          break;
        }
      }
      assert.ok(!allSame, 'Different seeds should produce different sequences');
    });
  });

  describe('seededShuffle', () => {
    it('should return a new array (not mutate original)', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = seededShuffle(original, 12345);
      assert.notStrictEqual(shuffled, original);
      assert.deepStrictEqual(original, [1, 2, 3, 4, 5]);
    });

    it('should contain all original elements', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = seededShuffle(original, 12345);
      assert.strictEqual(shuffled.length, original.length);
      original.forEach(item => {
        assert.ok(shuffled.includes(item));
      });
    });

    it('should be deterministic with same seed', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const shuffle1 = seededShuffle(arr, 42);
      const shuffle2 = seededShuffle(arr, 42);
      assert.deepStrictEqual(shuffle1, shuffle2);
    });

    it('should produce different results for different seeds', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const shuffle1 = seededShuffle(arr, 1);
      const shuffle2 = seededShuffle(arr, 2);
      // Arrays should differ (extremely unlikely to be same with different seeds)
      assert.notDeepStrictEqual(shuffle1, shuffle2);
    });

    it('should handle empty array', () => {
      assert.deepStrictEqual(seededShuffle([], 123), []);
    });

    it('should handle single element', () => {
      assert.deepStrictEqual(seededShuffle([42], 123), [42]);
    });
  });

  describe('ensureQuestionMark', () => {
    it('should add question mark if missing', () => {
      assert.strictEqual(ensureQuestionMark('What is my path'), 'What is my path?');
      assert.strictEqual(ensureQuestionMark('How can I grow'), 'How can I grow?');
    });

    it('should not add duplicate question mark', () => {
      assert.strictEqual(ensureQuestionMark('What is my path?'), 'What is my path?');
    });

    it('should trim whitespace', () => {
      assert.strictEqual(ensureQuestionMark('  Hello  '), 'Hello?');
      assert.strictEqual(ensureQuestionMark('  Hello?  '), 'Hello?');
    });

    it('should return empty string for empty/null input', () => {
      assert.strictEqual(ensureQuestionMark(''), '');
      assert.strictEqual(ensureQuestionMark(null), '');
      assert.strictEqual(ensureQuestionMark(undefined), '');
    });
  });

  describe('truncateText', () => {
    it('should return text unchanged if within limit', () => {
      assert.strictEqual(truncateText('Hello', 10), 'Hello');
      assert.strictEqual(truncateText('Hello', 5), 'Hello');
    });

    it('should truncate and add ellipsis when over limit', () => {
      // Default: accountForEllipsis=true, so cutoff = max - 1
      assert.strictEqual(truncateText('Hello World', 8), 'Hello W\u2026');
    });

    it('should respect accountForEllipsis option', () => {
      // With accountForEllipsis: false, full max chars + ellipsis
      assert.strictEqual(
        truncateText('Hello World', 8, { accountForEllipsis: false }),
        'Hello Wo\u2026'
      );
    });

    it('should use custom ellipsis', () => {
      // max=8, ellipsis='...' (3 chars), cutoff = 8-3 = 5, so 'Hello' + '...'
      assert.strictEqual(
        truncateText('Hello World', 8, { ellipsis: '...' }),
        'Hello...'
      );
    });

    it('should handle empty/non-string input', () => {
      assert.strictEqual(truncateText('', 10), '');
      assert.strictEqual(truncateText(null, 10), '');
      assert.strictEqual(truncateText(undefined, 10), '');
      assert.strictEqual(truncateText(123, 10), '');
    });

    it('should trim whitespace', () => {
      assert.strictEqual(truncateText('  Hello  ', 10), 'Hello');
    });

    it('should handle edge case of max = 1', () => {
      // With accountForEllipsis=true and unicode ellipsis (length 1), cutoff = 0
      assert.strictEqual(truncateText('Hello', 1), '\u2026');
    });
  });
});
