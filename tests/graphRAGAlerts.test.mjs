import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { collectGraphRAGAlerts } from '../functions/lib/graphRAGAlerts.js';

describe('GraphRAG alert heuristics', () => {
    it('does not warn when no passages were retrieved', () => {
        const alerts = collectGraphRAGAlerts({
            graphRAG: {
                includedInPrompt: false,
                passagesProvided: 0,
                passagesUsedInPrompt: 0,
                truncatedPassages: 0,
                semanticScoringRequested: false,
                semanticScoringFallback: false
            }
        });

        assert.deepEqual(alerts, []);
    });

    it('warns when passages were retrieved but omitted', () => {
        const alerts = collectGraphRAGAlerts({
            graphRAG: {
                includedInPrompt: false,
                passagesProvided: 3,
                passagesUsedInPrompt: 0,
                truncatedPassages: 3,
                semanticScoringRequested: false,
                semanticScoringFallback: false
            }
        });

        assert.ok(
            alerts.some((a) => a.includes('retrieved') && a.includes('omitted')),
            `Expected omission alert, got: ${alerts.join(' | ')}`
        );
    });

    it('warns when GraphRAG passages are heavily truncated', () => {
        const alerts = collectGraphRAGAlerts({
            graphRAG: {
                includedInPrompt: true,
                passagesProvided: 7,
                passagesUsedInPrompt: 2,
                truncatedPassages: 5
            }
        });

        assert.ok(
            alerts.some((a) => a.toLowerCase().includes('heavily truncated')),
            `Expected truncation alert, got: ${alerts.join(' | ')}`
        );
    });

    it('only warns about semantic scoring fallback when semantic scoring was requested', () => {
        const noRequestAlerts = collectGraphRAGAlerts({
            graphRAG: {
                includedInPrompt: true,
                passagesProvided: 2,
                passagesUsedInPrompt: 2,
                truncatedPassages: 0,
                semanticScoringRequested: false,
                semanticScoringFallback: true
            }
        });

        assert.ok(
            !noRequestAlerts.some((a) => a.toLowerCase().includes('semantic')),
            `Did not expect semantic fallback alert, got: ${noRequestAlerts.join(' | ')}`
        );

        const requestedAlerts = collectGraphRAGAlerts({
            graphRAG: {
                includedInPrompt: true,
                passagesProvided: 2,
                passagesUsedInPrompt: 2,
                truncatedPassages: 0,
                semanticScoringRequested: true,
                semanticScoringFallback: true
            }
        });

        assert.ok(
            requestedAlerts.some((a) => a.toLowerCase().includes('semantic scoring')),
            `Expected semantic fallback alert, got: ${requestedAlerts.join(' | ')}`
        );
    });
});
