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

describe('GraphRAG stub telemetry', () => {
    it('processes stub telemetry when graphRAG disabled by env', () => {
        // Stub telemetry shape emitted when graphKeys exist but retrieval skipped
        const stubMeta = {
            graphRAG: {
                includedInPrompt: false,
                disabledByEnv: true,
                passagesProvided: 0,
                passagesUsedInPrompt: 0,
                skippedReason: 'disabled_by_env'
            }
        };

        const alerts = collectGraphRAGAlerts(stubMeta);
        // Should not produce misleading alerts for intentionally-disabled retrieval
        assert.ok(
            !alerts.some((a) => a.includes('omitted') && a.includes('retrieved')),
            'Should not warn about omitted passages when disabled by env'
        );
    });

    it('processes stub telemetry when retrieval failed', () => {
        const stubMeta = {
            graphRAG: {
                includedInPrompt: false,
                disabledByEnv: false,
                passagesProvided: 0,
                passagesUsedInPrompt: 0,
                skippedReason: 'retrieval_failed_or_empty'
            }
        };

        const alerts = collectGraphRAGAlerts(stubMeta);
        // Empty retrieval should not produce misleading "omitted" alerts
        assert.ok(
            !alerts.some((a) => a.includes('omitted')),
            'Should not warn about omitted passages when none were retrieved'
        );
    });
});
