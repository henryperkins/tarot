import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getVariantPromptOverrides,
  isKnownPromptVariant
} from '../functions/lib/abTesting.js';

describe('prompt variant registry', () => {
  it('recognizes control and known prompt variants', () => {
    assert.equal(isKnownPromptVariant('control'), true);
    assert.equal(isKnownPromptVariant('concise'), true);
    assert.ok(getVariantPromptOverrides('concise'));
  });

  it('rejects unknown prompt variants instead of silently treating them as control', () => {
    assert.equal(isKnownPromptVariant('unregistered-treatment'), false);
    assert.equal(getVariantPromptOverrides('unregistered-treatment'), null);
  });
});
