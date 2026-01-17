import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getEvaluationTimeoutMs, buildHeuristicScores } from '../lib/evaluation.js';

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
    describe('conservative defaults for non-assessable dimensions', () => {
        it('provides default score of 3 for personalization', () => {
            const result = buildHeuristicScores({ cardCoverage: 0.8 }, 'general');
            assert.equal(result.scores.personalization, 3);
        });

        it('provides default score of 3 for tone', () => {
            const result = buildHeuristicScores({ cardCoverage: 0.8 }, 'general');
            assert.equal(result.scores.tone, 3);
        });

        it('provides default score of 3 for safety', () => {
            const result = buildHeuristicScores({ cardCoverage: 0.8 }, 'general');
            assert.equal(result.scores.safety, 3);
        });

        it('sets overall based on tarot_coherence', () => {
            const result = buildHeuristicScores({ cardCoverage: 0.95 }, 'general');
            // High coverage = tarot_coherence 5, but overall capped at min(3, 5) = 3
            assert.equal(result.scores.tarot_coherence, 5);
            assert.equal(result.scores.overall, 3);
        });

        it('lowers overall when tarot_coherence is low', () => {
            const result = buildHeuristicScores({ cardCoverage: 0.4 }, 'general');
            // Low coverage = tarot_coherence 2, overall = min(3, 2) = 2
            assert.equal(result.scores.tarot_coherence, 2);
            assert.equal(result.scores.overall, 2);
        });
    });

    describe('spread-specific adjustments', () => {
        it('downgrades coherence for low coverage decision spread', () => {
            const result = buildHeuristicScores({ cardCoverage: 0.4, hallucinatedCards: [] }, 'decision');
            assert.equal(result.scores.tarot_coherence, 2);
            assert.ok(result.scores.notes.includes('Decision spread'));
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

        it('downgrades relationship spread with low coverage', () => {
            const result = buildHeuristicScores({ cardCoverage: 0.5, hallucinatedCards: [] }, 'relationship');
            assert.equal(result.scores.tarot_coherence, 2);
            assert.ok(result.scores.notes.includes('Relationship spread'));
        });
    });

    describe('safety flag detection', () => {
        it('flags hallucinations as safety risks', () => {
            const result = buildHeuristicScores({ cardCoverage: 0.8, hallucinatedCards: ['A', 'B', 'C'] }, 'general');
            assert.equal(result.scores.safety_flag, true);
            assert.ok(result.scores.notes.includes('hallucinated'));
        });

        it('does not flag minor hallucinations within allowance', () => {
            const result = buildHeuristicScores(
                { cardCoverage: 0.9, hallucinatedCards: ['A'], cardCount: 3 },
                'general'
            );
            assert.equal(result.scores.safety_flag, false);
            assert.ok(result.scores.notes.includes('within allowance'));
        });

        it('flags very low coverage as safety concern', () => {
            const result = buildHeuristicScores({ cardCoverage: 0.2, hallucinatedCards: [] }, 'general');
            assert.equal(result.scores.safety_flag, true);
            assert.ok(result.scores.notes.includes('Very low card coverage'));
        });

        it('does not flag acceptable coverage', () => {
            const result = buildHeuristicScores({ cardCoverage: 0.7, hallucinatedCards: [] }, 'general');
            assert.equal(result.scores.safety_flag, false);
        });
    });

    describe('mode and metadata', () => {
        it('marks mode as heuristic', () => {
            const result = buildHeuristicScores({ cardCoverage: 0.8 }, 'general');
            assert.equal(result.mode, 'heuristic');
        });

        it('uses heuristic-fallback as model identifier', () => {
            const result = buildHeuristicScores({ cardCoverage: 0.8 }, 'general');
            assert.equal(result.model, 'heuristic-fallback');
        });

        it('includes timestamp', () => {
            const result = buildHeuristicScores({ cardCoverage: 0.8 }, 'general');
            assert.ok(result.timestamp);
            assert.ok(new Date(result.timestamp).getTime() > 0);
        });
    });
});
