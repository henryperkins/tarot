import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collectGraphRAGAlerts } from '../graphRAGAlerts.js';

describe('collectGraphRAGAlerts', () => {
    it('flags omitted GraphRAG block', () => {
        const alerts = collectGraphRAGAlerts({ graphRAG: { includedInPrompt: false } });
        assert.ok(alerts.some((msg) => msg.includes('omitted')));
    });

    it('flags heavy truncation and fallback ranking', () => {
        const alerts = collectGraphRAGAlerts({
            graphRAG: {
                includedInPrompt: true,
                passagesUsedInPrompt: 2,
                truncatedPassages: 5,
                semanticScoringFallback: true
            }
        });

        assert.ok(alerts.some((msg) => msg.includes('heavily truncated')));
        assert.ok(alerts.some((msg) => msg.includes('semantic scoring')));
    });

    it('returns empty array when no graph metadata', () => {
        assert.deepEqual(collectGraphRAGAlerts(), []);
    });
});
