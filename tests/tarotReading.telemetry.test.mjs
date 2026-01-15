import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveGraphRAGStats } from '../functions/lib/readingTelemetry.js';

describe('resolveGraphRAGStats', () => {
  it('returns promptMeta.graphRAG when available', () => {
    const promptMeta = {
      graphRAG: {
        passagesRetrieved: 3,
        includedInPrompt: true
      }
    };
    const analysis = {
      graphRAGPayload: {
        retrievalSummary: { passagesRetrieved: 5 }
      }
    };

    const result = resolveGraphRAGStats(analysis, promptMeta);

    assert.deepEqual(result, promptMeta.graphRAG);
    assert.equal(result.includedInPrompt, true);
  });

  it('adds injectedIntoPrompt: false when falling back to analysis', () => {
    const analysis = {
      graphRAGPayload: {
        retrievalSummary: {
          passagesRetrieved: 3,
          keywords: ['transformation']
        }
      }
    };

    const result = resolveGraphRAGStats(analysis, null);

    assert.equal(result.injectedIntoPrompt, false);
    assert.equal(result.source, 'analysis-fallback');
    assert.equal(result.passagesRetrieved, 3);
  });

  it('returns null when neither promptMeta nor analysis available', () => {
    assert.equal(resolveGraphRAGStats(null, null), null);
    assert.equal(resolveGraphRAGStats({}, null), null);
    assert.equal(resolveGraphRAGStats({ graphRAGPayload: {} }, null), null);
  });

  it('preserves original summary fields when falling back', () => {
    const analysis = {
      graphRAGPayload: {
        retrievalSummary: {
          passagesRetrieved: 2,
          topPatterns: ['death-star'],
          relevanceScores: [0.8, 0.6]
        }
      }
    };

    const result = resolveGraphRAGStats(analysis, null);

    assert.equal(result.passagesRetrieved, 2);
    assert.deepEqual(result.topPatterns, ['death-star']);
    assert.deepEqual(result.relevanceScores, [0.8, 0.6]);
    assert.equal(result.injectedIntoPrompt, false);
  });
});
