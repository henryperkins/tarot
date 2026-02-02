import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts.js';

describe('GraphRAG fallback behavior', () => {
  it('falls back to keyword retrieval when semantic scoring is requested without prefetch', () => {
    const cardsInfo = [
      { card: 'The Fool', position: 'Past', orientation: 'Upright' },
      { card: 'The Magician', position: 'Present', orientation: 'Upright' },
      { card: 'The High Priestess', position: 'Future', orientation: 'Upright' }
    ];

    const themes = {
      knowledgeGraph: {
        graphKeys: {
          completeTriadIds: ['death-temperance-star']
        }
      }
    };

    const { userPrompt, promptMeta } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'Three-Card Story (Past - Present - Future)' },
      cardsInfo,
      userQuestion: 'How do I heal from this ending?',
      reflectionsText: '',
      themes,
      spreadAnalysis: null,
      context: 'general',
      enableSemanticScoring: true,
      promptBudgetEnv: { GRAPHRAG_ENABLED: 'true' }
    });

    assert.ok(
      userPrompt.includes('TRADITIONAL WISDOM (GraphRAG)'),
      'GraphRAG block should be included via keyword fallback'
    );
    assert.ok(
      /\n1\.\s+/.test(userPrompt),
      'GraphRAG block should include numbered passages'
    );

    assert.ok(promptMeta.graphRAG, 'graphRAG metadata should be present');
    assert.equal(promptMeta.graphRAG.includedInPrompt, true);
    assert.equal(promptMeta.graphRAG.semanticScoringRequested, true);
    assert.equal(promptMeta.graphRAG.semanticScoringUsed, false);
    assert.equal(promptMeta.graphRAG.semanticScoringFallback, true);
  });
});
