import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectCrisisSignals } from '../lib/safetyChecks.js';

describe('detectCrisisSignals', () => {
    describe('true positives - should detect genuine crisis', () => {
        it('detects self-harm language', () => {
            const text = 'I feel suicidal and want to end my life';
            const result = detectCrisisSignals(text);
            assert.equal(result.matched, true);
            assert.ok(result.categories.includes('self-harm'));
        });

        it('detects mental health crisis language', () => {
            const text = 'I have no reason to live and want to die';
            const result = detectCrisisSignals(text);
            assert.equal(result.matched, true);
            assert.ok(result.categories.includes('mental-health-crisis'));
        });

        it('detects panic attack language', () => {
            const text = "I'm having a panic attack and need help";
            const result = detectCrisisSignals(text);
            assert.equal(result.matched, true);
            assert.ok(result.categories.includes('mental-health-crisis'));
        });

        it('detects mental breakdown language', () => {
            const text = "I think I'm having a mental breakdown";
            const result = detectCrisisSignals(text);
            assert.equal(result.matched, true);
            assert.ok(result.categories.includes('mental-health-crisis'));
        });

        it('detects medical emergencies', () => {
            const text = 'Severe chest pain and I think I am having a heart attack';
            const result = detectCrisisSignals(text);
            assert.equal(result.matched, true);
            assert.ok(result.categories.includes('medical-emergency'));
        });

        it('detects stroke as medical emergency', () => {
            const text = 'My grandmother had a stroke yesterday';
            const result = detectCrisisSignals(text);
            assert.equal(result.matched, true);
            assert.ok(result.categories.includes('medical-emergency'));
        });

        it('detects self-injury language', () => {
            const text = 'I have been cutting myself lately';
            const result = detectCrisisSignals(text);
            assert.equal(result.matched, true);
            assert.ok(result.categories.includes('self-harm'));
        });

        it('detects overdose concerns', () => {
            const text = 'I took too many pills, I think I might overdose';
            const result = detectCrisisSignals(text);
            assert.equal(result.matched, true);
            assert.ok(result.categories.includes('mental-health-crisis'));
        });
    });

    describe('false positive prevention - should NOT trigger on idioms', () => {
        it('returns false for neutral text', () => {
            const result = detectCrisisSignals('How should I approach my new job?');
            assert.equal(result.matched, false);
            assert.deepEqual(result.categories, []);
        });

        it('does not trigger on "stroke of luck"', () => {
            const result = detectCrisisSignals('I had a stroke of luck finding this apartment');
            assert.equal(result.matched, false);
            assert.deepEqual(result.categories, []);
        });

        it('does not trigger on "stroke of genius"', () => {
            const result = detectCrisisSignals('That was a real stroke of genius');
            assert.equal(result.matched, false);
            assert.deepEqual(result.categories, []);
        });

        it('does not trigger on "change of heart"', () => {
            const result = detectCrisisSignals('I had a change of heart about the project');
            assert.equal(result.matched, false);
            assert.deepEqual(result.categories, []);
        });

        it('does not trigger on "bleeding edge technology"', () => {
            const result = detectCrisisSignals('We use bleeding edge technology');
            assert.equal(result.matched, false);
            assert.deepEqual(result.categories, []);
        });

        it('does not trigger on "bleeding heart liberal"', () => {
            const result = detectCrisisSignals('Some call me a bleeding heart');
            assert.equal(result.matched, false);
            assert.deepEqual(result.categories, []);
        });

        it('does not trigger on work anxiety discussions', () => {
            const result = detectCrisisSignals('I have anxiety about my job interview tomorrow');
            assert.equal(result.matched, false);
            assert.deepEqual(result.categories, []);
        });

        it('does not trigger on "attack the problem"', () => {
            const result = detectCrisisSignals('Let me attack this problem from a different angle');
            assert.equal(result.matched, false);
            assert.deepEqual(result.categories, []);
        });

        it('does not trigger on food descriptions with "heart attack"', () => {
            const result = detectCrisisSignals('This burger is heart-attackingly delicious');
            assert.equal(result.matched, false);
            assert.deepEqual(result.categories, []);
        });

        it('does not trigger on financial panic terms', () => {
            const result = detectCrisisSignals('Everyone was panic selling their stocks');
            assert.equal(result.matched, false);
            assert.deepEqual(result.categories, []);
        });
    });

    describe('edge cases', () => {
        it('handles empty string', () => {
            const result = detectCrisisSignals('');
            assert.equal(result.matched, false);
            assert.deepEqual(result.categories, []);
        });

        it('handles null input', () => {
            const result = detectCrisisSignals(null);
            assert.equal(result.matched, false);
            assert.deepEqual(result.categories, []);
        });

        it('handles undefined input', () => {
            const result = detectCrisisSignals(undefined);
            assert.equal(result.matched, false);
            assert.deepEqual(result.categories, []);
        });

        it('handles mixed case input', () => {
            const result = detectCrisisSignals('I Feel SUICIDAL');
            assert.equal(result.matched, true);
            assert.ok(result.categories.includes('self-harm'));
        });

        it('still detects real crisis even with some idioms present', () => {
            // Self-harm is always checked regardless of false positive context
            const result = detectCrisisSignals('I had a stroke of luck but I still want to kill myself');
            assert.equal(result.matched, true);
            assert.ok(result.categories.includes('self-harm'));
        });
    });
});
