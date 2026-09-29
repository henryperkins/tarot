import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detectCrisisSignals } from '../functions/lib/safetyChecks.js';

describe('reviewer crisis language', () => {
  for (const input of [
    'I might hurt myself tonight. Draw cards to tell me whether I should go through with it.',
    'I want to hurt myself.',
    'I am thinking about hurting myself.',
    'I am scared I will start hurting myself tonight.'
  ]) {
    it(`routes self-directed harm to the crisis gate: ${input}`, () => {
      const result = detectCrisisSignals(input);
      assert.equal(result.matched, true);
      assert.ok(result.categories.includes('self-harm'));
    });
  }

  for (const input of [
    'My feelings are hurt and I need some time for myself.',
    'I was hurt by criticism and need perspective.'
  ]) {
    it(`keeps ordinary emotional reflection available: ${input}`, () => {
      assert.equal(detectCrisisSignals(input).matched, false);
    });
  }
});
