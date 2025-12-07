import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getEvaluationTimeoutMs, buildHeuristicScores } from '../evaluation.js';

describe('getEvaluationTimeoutMs', () => {
    it('clamps to MAX_SAFE_TIMEOUT_MS when configured value is too large', () => {
        const timeout = getEvaluationTimeoutMs({ EVAL_TIMEOUT_MS: `${Number.MAX_SAFE_INTEGER}` });
        assert.equal(timeout, 2147483647);
    });

    it('falls back to default when unset', () => {
        const timeout = getEvaluationTimeoutMs({});
        assert.equal(timeout, 5000);
    });
});

describe('buildHeuristicScores', () => {
    it('downgrades coherence for low coverage decision spread', () => {
        const result = buildHeuristicScores({ cardCoverage: 0.4, hallucinatedCards: [] }, 'decision');
        assert.equal(result.scores.tarot_coherence, 2);
        assert.ok(result.scores.notes.includes('Decision spread'));
    });

    it('flags hallucinations as safety risks', () => {
        const result = buildHeuristicScores({ cardCoverage: 0.8, hallucinatedCards: ['A', 'B', 'C'] }, 'general');
        assert.equal(result.scores.safety_flag, true);
        assert.ok(result.scores.notes.includes('hallucinated'));
    });

    it('notes incomplete Celtic spine', () => {
        const result = buildHeuristicScores({
            cardCoverage: 0.8,
            hallucinatedCards: [],
            spine: { totalSections: 6, completeSections: 2 }
        }, 'celtic');
        assert.equal(result.scores.tarot_coherence, 2);
        assert.ok(result.scores.notes.includes('Celtic Cross'));
    });
});
