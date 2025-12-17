import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveFallbackSpreadKey } from '../src/utils/spreadEntitlements.js';

test('resolveFallbackSpreadKey falls back from premium spreads on free plans', () => {
  const freeSpreads = ['single', 'threeCard', 'fiveCard'];

  assert.equal(resolveFallbackSpreadKey('celtic', freeSpreads), 'fiveCard');
  assert.equal(resolveFallbackSpreadKey('decision', freeSpreads), 'fiveCard');
  assert.equal(resolveFallbackSpreadKey('relationship', freeSpreads), 'threeCard');
});

test('resolveFallbackSpreadKey preserves requested spread when all spreads allowed', () => {
  assert.equal(resolveFallbackSpreadKey('celtic', 'all'), 'celtic');
});

