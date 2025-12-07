import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectCrisisSignals } from '../safetyChecks.js';

describe('detectCrisisSignals', () => {
    it('detects self-harm and crisis language', () => {
        const text = 'I feel suicidal and want to end my life';
        const result = detectCrisisSignals(text);
        assert.equal(result.matched, true);
        assert.ok(result.categories.includes('self-harm'));
        assert.ok(result.categories.includes('mental-health-crisis'));
    });

    it('detects medical emergencies', () => {
        const text = 'Severe chest pain and I think I am having a heart attack';
        const result = detectCrisisSignals(text);
        assert.equal(result.matched, true);
        assert.ok(result.categories.includes('medical-emergency'));
    });

    it('returns false for neutral text', () => {
        const result = detectCrisisSignals('How should I approach my new job?');
        assert.equal(result.matched, false);
        assert.deepEqual(result.categories, []);
    });
});
