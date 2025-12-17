// tests/crypto.test.mjs
// Tests for cryptographic utilities
// Run with: npm test -- tests/crypto.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { timingSafeEqual } from '../functions/lib/crypto.js';

describe('timingSafeEqual', () => {
  test('returns true for identical strings', () => {
    assert.strictEqual(timingSafeEqual('hello', 'hello'), true);
    assert.strictEqual(timingSafeEqual('secret123', 'secret123'), true);
    assert.strictEqual(timingSafeEqual('', ''), true);
  });

  test('returns false for different strings of same length', () => {
    assert.strictEqual(timingSafeEqual('hello', 'hella'), false);
    assert.strictEqual(timingSafeEqual('abc', 'abd'), false);
    assert.strictEqual(timingSafeEqual('123', '124'), false);
  });

  test('returns false for strings of different lengths', () => {
    assert.strictEqual(timingSafeEqual('hello', 'hello!'), false);
    assert.strictEqual(timingSafeEqual('short', 'much longer string'), false);
    assert.strictEqual(timingSafeEqual('a', 'ab'), false);
    assert.strictEqual(timingSafeEqual('', 'nonempty'), false);
  });

  test('returns false for non-string inputs', () => {
    assert.strictEqual(timingSafeEqual(null, 'test'), false);
    assert.strictEqual(timingSafeEqual('test', null), false);
    assert.strictEqual(timingSafeEqual(null, null), false);
    assert.strictEqual(timingSafeEqual(undefined, 'test'), false);
    assert.strictEqual(timingSafeEqual('test', undefined), false);
    assert.strictEqual(timingSafeEqual(undefined, undefined), false);
    assert.strictEqual(timingSafeEqual(123, '123'), false);
    assert.strictEqual(timingSafeEqual('123', 123), false);
    assert.strictEqual(timingSafeEqual({}, 'test'), false);
    assert.strictEqual(timingSafeEqual([], 'test'), false);
  });

  test('handles special characters correctly', () => {
    assert.strictEqual(timingSafeEqual('hello!@#$%', 'hello!@#$%'), true);
    assert.strictEqual(timingSafeEqual('hello!@#$%', 'hello!@#$&'), false);
    assert.strictEqual(timingSafeEqual('Bearer sk_test_123', 'Bearer sk_test_123'), true);
    assert.strictEqual(timingSafeEqual('Bearer sk_test_123', 'Bearer sk_test_124'), false);
  });

  test('handles unicode characters correctly', () => {
    assert.strictEqual(timingSafeEqual('héllo', 'héllo'), true);
    assert.strictEqual(timingSafeEqual('héllo', 'hello'), false);
    assert.strictEqual(timingSafeEqual('日本語', '日本語'), true);
    assert.strictEqual(timingSafeEqual('日本語', '日本人'), false);
  });

  test('handles whitespace correctly', () => {
    assert.strictEqual(timingSafeEqual('hello world', 'hello world'), true);
    assert.strictEqual(timingSafeEqual('hello world', 'helloworld'), false);
    assert.strictEqual(timingSafeEqual(' hello', 'hello'), false);
    assert.strictEqual(timingSafeEqual('hello ', 'hello'), false);
    assert.strictEqual(timingSafeEqual('\t\n', '\t\n'), true);
  });

  test('handles typical API key comparison scenarios', () => {
    const secret = 'whsec_abcdef123456789';
    assert.strictEqual(timingSafeEqual(secret, secret), true);
    assert.strictEqual(timingSafeEqual(secret, 'whsec_abcdef123456788'), false);
    assert.strictEqual(timingSafeEqual(secret, 'whsec_abcdef12345678'), false);

    const adminKey = 'sk_admin_very_secret_key_12345';
    assert.strictEqual(timingSafeEqual(`Bearer ${adminKey}`, `Bearer ${adminKey}`), true);
    assert.strictEqual(timingSafeEqual(`Bearer ${adminKey}`, `Bearer wrong_key`), false);
  });

  test('handles hex strings (password hashes)', () => {
    const hash1 = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    const hash2 = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b3';
    assert.strictEqual(timingSafeEqual(hash1, hash1), true);
    assert.strictEqual(timingSafeEqual(hash1, hash2), false);
  });
});

describe('timingSafeEqual timing characteristics', () => {
  // Note: This test verifies the function completes without throwing,
  // not that it's actually constant-time (which requires statistical analysis)
  test('completes for very long strings', () => {
    const long1 = 'a'.repeat(10000);
    const long2 = 'a'.repeat(10000);
    const long3 = 'a'.repeat(9999) + 'b';

    assert.strictEqual(timingSafeEqual(long1, long2), true);
    assert.strictEqual(timingSafeEqual(long1, long3), false);
  });

  test('handles strings differing only at the end', () => {
    // This is a common timing attack vector - difference only at end
    const base = 'abcdefghijklmnopqrstuvwxyz';
    assert.strictEqual(timingSafeEqual(base + 'A', base + 'A'), true);
    assert.strictEqual(timingSafeEqual(base + 'A', base + 'B'), false);
  });

  test('handles strings differing only at the beginning', () => {
    const base = 'bcdefghijklmnopqrstuvwxyz';
    assert.strictEqual(timingSafeEqual('a' + base, 'a' + base), true);
    assert.strictEqual(timingSafeEqual('a' + base, 'b' + base), false);
  });
});
