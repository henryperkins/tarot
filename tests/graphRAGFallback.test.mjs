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

  it('injects payload-driven GraphRAG even when themes.graphKeys are absent', () => {
    const graphRAGPayload = {
      passages: [
        {
          title: 'Temperance',
          source: 'Tableu Tarot Canon',
          text: 'Integration comes through steady blending of opposites.'
        }
      ],
      formattedBlock: [
        '**Retrieved Wisdom from Tarot Tradition:**',
        '',
        '1. **Temperance**',
        '   "Integration comes through steady blending of opposites."',
        '   — Tableu Tarot Canon'
      ].join('\n'),
      retrievalSummary: {
        passagesRetrieved: 1
      },
      initialPassageCount: 1,
      maxPassages: 1
    };

    const { userPrompt, promptMeta } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'One-Card Insight' },
      cardsInfo: [{ card: 'Temperance', number: 14, position: 'Theme', orientation: 'Upright', meaning: 'Balance.' }],
      userQuestion: 'What should I integrate right now?',
      reflectionsText: '',
      themes: { knowledgeGraph: {} },
      spreadAnalysis: null,
      context: 'general',
      graphRAGPayload
    });

    assert.ok(userPrompt.includes('TRADITIONAL WISDOM (GraphRAG)'));
    assert.equal(promptMeta.graphRAG?.includedInPrompt, true);
    assert.equal(promptMeta.graphRAG?.passagesProvided, 1);
    assert.equal(promptMeta.graphRAG?.passagesUsedInPrompt, 1);
  });

  it('injects legacy formattedBlock-only payloads and preserves GraphRAG telemetry', () => {
    const graphRAGPayload = {
      formattedBlock: [
        '**Retrieved Wisdom from Tarot Tradition:**',
        '',
        '1. **Temperance**',
        '   "Integration comes through steady blending of opposites."',
        '   — Tableu Tarot Canon'
      ].join('\n'),
      retrievalSummary: {
        passagesRetrieved: 1
      }
    };

    const { userPrompt, promptMeta } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'One-Card Insight' },
      cardsInfo: [{ card: 'Temperance', number: 14, position: 'Theme', orientation: 'Upright', meaning: 'Balance.' }],
      userQuestion: 'What should I integrate right now?',
      reflectionsText: '',
      themes: { knowledgeGraph: {} },
      spreadAnalysis: null,
      context: 'general',
      graphRAGPayload
    });

    assert.ok(userPrompt.includes('TRADITIONAL WISDOM (GraphRAG)'));
    assert.ok(userPrompt.includes('Integration comes through steady blending of opposites.'));
    assert.equal(promptMeta.graphRAG?.includedInPrompt, true);
    assert.equal(promptMeta.graphRAG?.injectionMode, 'full');
    assert.equal(promptMeta.graphRAG?.parseStatus, 'complete');
    assert.equal(promptMeta.graphRAG?.passagesProvided, 1);
    assert.equal(promptMeta.graphRAG?.passagesUsedInPrompt, 1);
    assert.equal(promptMeta.graphRAG?.skippedReason ?? null, null);
  });

  it('rebuilds GraphRAG from the effective capped passage list instead of stale formattedBlock text', () => {
    const graphRAGPayload = {
      passages: [
        {
          title: 'Temperance',
          source: 'Tableu Tarot Canon',
          text: 'Integration comes through steady blending of opposites.'
        },
        {
          title: 'The Tower',
          source: 'Tableu Tarot Canon',
          text: 'Sudden upheaval breaks false structures apart.'
        }
      ],
      formattedBlock: [
        '**Retrieved Wisdom from Tarot Tradition:**',
        '',
        '1. **Temperance**',
        '   "Integration comes through steady blending of opposites."',
        '   — Tableu Tarot Canon',
        '',
        '2. **The Tower**',
        '   "Sudden upheaval breaks false structures apart."',
        '   — Tableu Tarot Canon'
      ].join('\n'),
      retrievalSummary: {
        passagesRetrieved: 2
      },
      initialPassageCount: 2,
      maxPassages: 1
    };

    const { userPrompt, promptMeta } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'One-Card Insight' },
      cardsInfo: [{ card: 'Temperance', number: 14, position: 'Theme', orientation: 'Upright', meaning: 'Balance.' }],
      userQuestion: 'What should I integrate right now?',
      reflectionsText: '',
      themes: { knowledgeGraph: {} },
      spreadAnalysis: null,
      context: 'general',
      graphRAGPayload
    });

    assert.ok(userPrompt.includes('Temperance'));
    assert.ok(!userPrompt.includes('Sudden upheaval breaks false structures apart.'));
    assert.equal(promptMeta.graphRAG?.passagesProvided, 2);
    assert.equal(promptMeta.graphRAG?.passagesUsedInPrompt, 1);
  });
});
