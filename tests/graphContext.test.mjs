import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildGraphContext } from '../functions/lib/graphContext.js';

// These tests exercise the small graphContext helper as a stable façade over
// the more complex pattern detectors in knowledgeGraph.js. We keep the
// assertions structural so that future extensions to the underlying
// knowledge graph will not require frequent test rewrites.

describe('graphContext.buildGraphContext', () => {
    it('returns null for missing or empty card arrays', () => {
        assert.strictEqual(buildGraphContext(null), null);
        assert.strictEqual(buildGraphContext(undefined), null);
        assert.strictEqual(buildGraphContext([]), null);
    });

    it('builds Fool\'s Journey context when multiple Majors share a stage', () => {
        const cards = [
            { number: 0, card: 'The Fool' },
            { number: 1, card: 'The Magician' },
            { number: 7, card: 'The Chariot' }
        ];

        const ctx = buildGraphContext(cards, { deckStyle: 'rws-1909' });
        assert.ok(ctx, 'graph context should be returned');
        assert.ok(ctx.patterns, 'patterns should be present');
        assert.ok(ctx.patterns.foolsJourney, 'Fool\'s Journey pattern should be detected');
        assert.strictEqual(
            ctx.patterns.foolsJourney.cardCount,
            3,
            'Fool\'s Journey should count all contributing Majors'
        );

        // Graph keys should include a stable journey stage key for retrieval/training.
        assert.ok(ctx.graphKeys, 'graphKeys should be present');
        assert.strictEqual(ctx.graphKeys.foolsJourneyStageKey, 'initiation');
    });

    it('includes complete triads and their narratives when present', () => {
        // This specific triad (Death–Temperance–Star) is documented in
        // knowledgeGraph.js comments and should be present in ARCHETYPAL_TRIADS.
        const cards = [
            { number: 13, card: 'Death' },
            { number: 14, card: 'Temperance' },
            { number: 17, card: 'The Star' }
        ];

        const ctx = buildGraphContext(cards, { deckStyle: 'rws-1909' });
        assert.ok(ctx, 'graph context should be returned for triad cards');
        assert.ok(ctx.patterns?.triads?.length, 'triads collection should be non-empty');

        const completeTriad = ctx.patterns.triads.find((t) => t.isComplete);
        assert.ok(completeTriad, 'at least one complete triad should be detected');
        assert.ok(
            typeof completeTriad.narrative === 'string' && completeTriad.narrative.length > 0,
            'complete triad should include a narrative string'
        );

        // Graph keys should carry stable triad identifiers.
        assert.ok(Array.isArray(ctx.graphKeys.triadIds), 'triadIds should be an array');
        assert.ok(ctx.graphKeys.triadIds.includes('death-temperance-star'));
        assert.ok(
            Array.isArray(ctx.graphKeys.completeTriadIds) &&
                ctx.graphKeys.completeTriadIds.includes('death-temperance-star'),
            'completeTriadIds should include the full Healing Arc triad id'
        );
    });

    it('always returns narrativeHighlights array with length <= 5', () => {
        const cards = [
            { number: 0, card: 'The Fool' },
            { number: 1, card: 'The Magician' },
            { number: 2, card: 'The High Priestess' },
            { number: 3, card: 'The Empress' },
            { number: 4, card: 'The Emperor' },
            { number: 5, card: 'The Hierophant' },
            { number: 6, card: 'The Lovers' },
            { number: 7, card: 'The Chariot' }
        ];

        const ctx = buildGraphContext(cards, { deckStyle: 'rws-1909' });
        assert.ok(ctx, 'graph context should be returned for rich major spread');
        assert.ok(Array.isArray(ctx.narrativeHighlights), 'narrativeHighlights should be an array');
        assert.ok(
            ctx.narrativeHighlights.length <= 5,
            'narrativeHighlights should be bounded to at most 5 entries'
        );

        // graphKeys should always be present when patterns exist, even if
        // some collections are empty.
        assert.ok(ctx.graphKeys, 'graphKeys should be present when patterns exist');
        assert.ok(Array.isArray(ctx.graphKeys.triadIds), 'triadIds should be an array (possibly empty)');
        assert.ok(Array.isArray(ctx.graphKeys.dyadPairs), 'dyadPairs should be an array (possibly empty)');
    });
});
