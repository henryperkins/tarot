import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { shouldUseMobileStableMode } from '../src/lib/mobileStableMode.js';

describe('shouldUseMobileStableMode', () => {
  test('returns false for non-handset layouts', () => {
    const result = shouldUseMobileStableMode({
      isHandset: false,
      prefersReducedMotion: false,
      navigator: { connection: { saveData: true } }
    });

    assert.equal(result, false);
  });

  test('returns true on handset when reduced motion is preferred', () => {
    const result = shouldUseMobileStableMode({
      isHandset: true,
      prefersReducedMotion: true,
      navigator: null
    });

    assert.equal(result, true);
  });

  test('returns false when handset has no navigator capability signals', () => {
    const result = shouldUseMobileStableMode({
      isHandset: true,
      prefersReducedMotion: false,
      navigator: null
    });

    assert.equal(result, false);
  });

  test('returns true when save-data is enabled', () => {
    const result = shouldUseMobileStableMode({
      isHandset: true,
      navigator: { connection: { saveData: true } }
    });

    assert.equal(result, true);
  });

  test('returns true when device memory is low', () => {
    const result = shouldUseMobileStableMode({
      isHandset: true,
      navigator: { deviceMemory: 4, hardwareConcurrency: 8 }
    });

    assert.equal(result, true);
  });

  test('returns true when hardware concurrency is low', () => {
    const result = shouldUseMobileStableMode({
      isHandset: true,
      navigator: { deviceMemory: 8, hardwareConcurrency: 4 }
    });

    assert.equal(result, true);
  });

  test('returns false for capable handset when no low-resource signal exists', () => {
    const result = shouldUseMobileStableMode({
      isHandset: true,
      prefersReducedMotion: false,
      navigator: {
        connection: { saveData: false },
        deviceMemory: 8,
        hardwareConcurrency: 8
      }
    });

    assert.equal(result, false);
  });
});
