import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collectGraphRAGAlerts } from '../lib/graphRAGAlerts.js';

describe('collectGraphRAGAlerts', () => {
    it('flags omitted GraphRAG block when passages were retrieved', () => {
        const alerts = collectGraphRAGAlerts({
            graphRAG: { includedInPrompt: false, passagesProvided: 3 }
        });
        assert.ok(alerts.some((msg) => msg.includes('omitted')));
    });

    it('does not flag omitted block when no passages were provided', () => {
        const alerts = collectGraphRAGAlerts({ graphRAG: { includedInPrompt: false } });
        assert.deepEqual(alerts, []);
    });

    it('flags heavy truncation when truncated > used', () => {
        const alerts = collectGraphRAGAlerts({
            graphRAG: {
                includedInPrompt: true,
                passagesUsedInPrompt: 2,
                truncatedPassages: 5
            }
        });
        assert.ok(alerts.some((msg) => msg.includes('heavily truncated')));
    });

    it('flags semantic scoring fallback when requested and fell back', () => {
        const alerts = collectGraphRAGAlerts({
            graphRAG: {
                includedInPrompt: true,
                semanticScoringRequested: true,
                semanticScoringFallback: true
            }
        });
        assert.ok(alerts.some((msg) => msg.includes('semantic scoring')));
    });

    it('returns empty array when no graph metadata', () => {
        assert.deepEqual(collectGraphRAGAlerts(), []);
    });
});
