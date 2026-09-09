// tests/graphRAGPatternCoverage.test.mjs
// Regression tests for pattern families the knowledge base covers but
// retrievePassages() historically never looked up: court lineages, partial
// triads and medium-significance dyads. Spreads that detect only these
// surfaced in the UI as "Traditional wisdom — SKIPPED (retrieval failed or
// empty)" even though curated passages existed for them.
// Run with: npm test -- tests/graphRAGPatternCoverage.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildQualityRetrievalSummary,
  buildRetrievalSummary,
  retrievePassages,
  retrievePassagesWithQuality
} from '../functions/lib/graphRAG.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts.js';
import { buildGraphRAGReferenceBlock } from '../functions/lib/narrative/prompts/graphRAGReferenceBlock.js';
import { clearEmbeddingCache } from '../functions/lib/embeddings.js';
import { performSpreadAnalysis } from '../functions/lib/spreadAnalysisOrchestrator.js';
import { buildGraphRAGTelemetry } from '../functions/lib/telemetrySchema.js';
import { TRIAD_PASSAGES } from '../functions/lib/knowledgeBase.js';

describe('GraphRAG court lineage retrieval', () => {
  test('retrievePassages: court lineage alliance (priority 5)', () => {
    const graphKeys = {
      courtLineages: [{ suit: 'Cups', significance: 'alliance' }]
    };

    const passages = retrievePassages(graphKeys, { maxPassages: 5 });

    assert.strictEqual(passages.length, 1, 'Should retrieve the curated court lineage passage');
    assert.strictEqual(passages[0].type, 'court-lineage');
    assert.strictEqual(passages[0].patternId, 'Cups:alliance');
    assert.strictEqual(passages[0].priority, 5, 'Court lineages should have priority 5');
    assert.strictEqual(passages[0].suit, 'Cups');
    assert.ok(passages[0].text, 'Should carry passage text');
    assert.ok(passages[0].source, 'Should carry a source');
  });

  test('retrievePassages: court lineage council', () => {
    const graphKeys = {
      courtLineages: [{ suit: 'Swords', significance: 'council' }]
    };

    const passages = retrievePassages(graphKeys, { maxPassages: 5 });

    assert.strictEqual(passages.length, 1);
    assert.strictEqual(passages[0].patternId, 'Swords:council');
    assert.strictEqual(passages[0].title, 'Swords Court Council');
  });

  test('retrievePassages: includes court lineage metadata when requested', () => {
    const graphKeys = {
      courtLineages: [{ suit: 'Wands', significance: 'alliance' }]
    };

    const passages = retrievePassages(graphKeys, { maxPassages: 5, includeMetadata: true });

    assert.deepStrictEqual(passages[0].metadata, { suit: 'Wands', significance: 'alliance' });
  });

  test('retrievePassages: ignores court lineages with no curated passages', () => {
    const graphKeys = {
      courtLineages: [{ suit: 'Coins', significance: 'alliance' }]
    };

    assert.strictEqual(retrievePassages(graphKeys, { maxPassages: 5 }).length, 0);
  });
});

describe('GraphRAG partial triad retrieval', () => {
  test('retrievePassages: passage data cannot disable the partial-pattern guardrail', () => {
    const entry = TRIAD_PASSAGES['magician-chariot-world'];
    const originalPassages = entry.passages;
    entry.passages = originalPassages.map((passage) => ({
      ...passage,
      isPartialPattern: false
    }));

    try {
      const passages = retrievePassages({ triadIds: ['magician-chariot-world'] });
      assert.strictEqual(passages.length, 1);
      assert.strictEqual(passages[0].isPartialPattern, true);
    } finally {
      entry.passages = originalPassages;
    }
  });

  test('retrievePassages: partial triad (priority 6)', () => {
    const graphKeys = {
      triadIds: ['magician-chariot-world'],
      completeTriadIds: []
    };

    const passages = retrievePassages(graphKeys, { maxPassages: 5 });

    assert.strictEqual(passages.length, 1, 'Should retrieve the partial triad passage');
    assert.strictEqual(passages[0].type, 'triad');
    assert.strictEqual(passages[0].patternId, 'magician-chariot-world');
    assert.strictEqual(passages[0].priority, 6, 'Partial triads rank below every complete pattern');
  });

  test('retrievePassages: partial triad metadata marks it incomplete', () => {
    const graphKeys = {
      triadIds: ['hermit-hangedman-moon'],
      completeTriadIds: []
    };

    const passages = retrievePassages(graphKeys, { maxPassages: 5, includeMetadata: true });

    assert.deepStrictEqual(passages[0].metadata, {
      triadId: 'hermit-hangedman-moon',
      isComplete: false
    });
  });

  test('retrievePassages: does not emit a complete triad twice', () => {
    const graphKeys = {
      triadIds: ['death-temperance-star'],
      completeTriadIds: ['death-temperance-star']
    };

    const passages = retrievePassages(graphKeys, { maxPassages: 5 });

    const triads = passages.filter((p) => p.type === 'triad');
    assert.strictEqual(triads.length, 1, 'A complete triad must not also retrieve as partial');
    assert.strictEqual(triads[0].priority, 1);
  });

  test('retrievePassages: complete triads outrank partial triads', () => {
    const graphKeys = {
      triadIds: ['death-temperance-star', 'magician-chariot-world'],
      completeTriadIds: ['death-temperance-star']
    };

    const passages = retrievePassages(graphKeys, { maxPassages: 5 });

    assert.strictEqual(passages[0].patternId, 'death-temperance-star');
    assert.strictEqual(passages[0].priority, 1);
    assert.strictEqual(passages[1].patternId, 'magician-chariot-world');
    assert.strictEqual(passages[1].priority, 6);
  });
});

describe('GraphRAG medium-significance dyad retrieval', () => {
  test('retrievePassages: medium dyad (priority 5)', () => {
    const graphKeys = {
      dyadPairs: [{ cards: [8, 11], category: 'balance', significance: 'medium' }]
    };

    const passages = retrievePassages(graphKeys, { maxPassages: 5 });

    assert.strictEqual(passages.length, 1);
    assert.strictEqual(passages[0].type, 'dyad');
    assert.strictEqual(passages[0].patternId, '8-11');
    assert.strictEqual(passages[0].priority, 5, 'Medium dyads rank below medium-high dyads');
  });

  test('retrievePassages: still filters dyads below medium significance', () => {
    const graphKeys = {
      dyadPairs: [
        { cards: [8, 11], category: 'balance', significance: 'medium' },
        { cards: [1, 2], category: 'test', significance: 'low' }
      ]
    };

    const passages = retrievePassages(graphKeys, { maxPassages: 5 });

    const dyads = passages.filter((p) => p.type === 'dyad');
    assert.strictEqual(dyads.length, 1);
    assert.strictEqual(dyads[0].patternId, '8-11');
  });
});

describe('GraphRAG pattern coverage telemetry', () => {
  test('buildRetrievalSummary counts medium dyads and court lineages', () => {
    const summary = buildRetrievalSummary({
      dyadPairs: [
        { cards: [8, 11], significance: 'medium' },
        { cards: [13, 17], significance: 'high' }
      ],
      courtLineages: [
        { suit: 'Cups', significance: 'alliance' },
        { suit: 'Wands', significance: 'council' }
      ]
    }, []);

    assert.strictEqual(summary.patternsDetected.mediumDyads, 1);
    assert.strictEqual(summary.patternsDetected.courtLineages, 2);
  });

  test('summary-only prompts name newly retrieved pattern families', () => {
    const block = buildGraphRAGReferenceBlock('celtic', {}, {
      env: { GRAPHRAG_ENABLED: 'true' },
      graphRAGSummaryOnly: true,
      graphRAGPayload: {
        retrievalSummary: {
          patternsDetected: {
            partialTriads: 1,
            mediumDyads: 2,
            courtLineages: 1
          }
        }
      }
    });

    assert.match(block, /1 partial triad\(s\)/);
    assert.match(block, /2 medium-significance dyad\(s\)/);
    assert.match(block, /1 court lineage\(s\)/);
  });
});

describe('GraphRAG quality filtering floor', () => {
  const env = {
    AZURE_OPENAI_ENDPOINT: 'https://embeddings.test',
    AZURE_OPENAI_API_KEY: 'test-only'
  };

  test('retrievePassagesWithQuality: keeps the best passage when all score below the threshold', async (t) => {
    clearEmbeddingCache();
    t.after(clearEmbeddingCache);
    // Orthogonal embeddings => cosine similarity 0, and a query sharing no
    // keywords with the passages => every relevance score lands at 0.
    t.mock.method(globalThis, 'fetch', async (_url, init) => {
      const { input } = JSON.parse(init.body);
      const isQuery = input.includes('zzyzx');
      return Response.json({ data: [{ embedding: isQuery ? [1, 0] : [0, 1] }] });
    });

    const passages = await retrievePassagesWithQuality(
      { completeTriadIds: ['death-temperance-star'] },
      { maxPassages: 3, userQuery: 'zzyzx quorbit', minRelevanceScore: 0.3, env }
    );

    assert.strictEqual(passages.length, 1, 'Should keep exactly one best-effort passage');
    assert.strictEqual(passages[0].type, 'triad');
    assert.ok(passages[0].relevanceScore < 0.3, 'The kept passage is below threshold by definition');
    assert.strictEqual(passages[0].belowRelevanceThreshold, true, 'Kept passage should be flagged');
  });

  test('retrievePassagesWithQuality: returns nothing when retrieval itself is empty', async () => {
    const passages = await retrievePassagesWithQuality(
      { completeTriadIds: [], triadIds: [], dyadPairs: [], suitProgressions: [], courtLineages: [] },
      { maxPassages: 3, userQuery: 'anything', env: null }
    );

    assert.strictEqual(passages.length, 0, 'The floor must not invent passages out of nothing');
  });

  test('reports a grounded fallback when semantic scoring is unavailable', async () => {
    const graphKeys = { completeTriadIds: ['death-temperance-star'] };
    const passages = await retrievePassagesWithQuality(graphKeys, {
      maxPassages: 3,
      userQuery: 'zzyzx quorbit',
      minRelevanceScore: 0.3,
      enableSemanticScoring: true,
      env: {}
    });
    const summary = buildQualityRetrievalSummary(graphKeys, passages);

    assert.strictEqual(passages.length, 1, 'Detected card patterns should retain one grounded passage');
    assert.strictEqual(passages[0].relevanceScore, 0, 'The fallback score must remain honest');
    assert.strictEqual(passages[0].belowRelevanceThreshold, true);
    assert.strictEqual(summary.qualityMetrics.averageRelevance, 0);
    assert.strictEqual(summary.qualityMetrics.belowRelevanceThresholdPassages, 1);
    assert.strictEqual(summary.qualityMetrics.semanticScoringUsed, false);
  });

  test('spread analysis preserves the quality floor when requested embeddings are unavailable', async () => {
    const cardsInfo = [
      { card: 'Death', number: 13, position: 'Past', orientation: 'Upright' },
      { card: 'Temperance', number: 14, position: 'Present', orientation: 'Upright' },
      { card: 'The Star', number: 17, position: 'Future', orientation: 'Upright' }
    ];
    const analysis = await performSpreadAnalysis(
      { key: 'threeCard', name: 'Three-Card Story' },
      cardsInfo,
      { userQuestion: 'zzyzx quorbit', enableSemanticScoring: true, subscriptionTier: 'pro' },
      'unavailable-embeddings-floor-test',
      { GRAPHRAG_ENABLED: 'true' }
    );
    const { passages, retrievalSummary } = analysis.graphRAGPayload;
    const telemetry = buildGraphRAGTelemetry(retrievalSummary);

    assert.strictEqual(passages.length, 1);
    assert.strictEqual(passages[0].belowRelevanceThreshold, true);
    assert.strictEqual(passages[0].relevanceScore, 0);
    assert.strictEqual(telemetry.semanticScoring.requested, true);
    assert.strictEqual(telemetry.semanticScoring.used, false);
    assert.strictEqual(telemetry.semanticScoring.fallback, true);
    assert.strictEqual(telemetry.quality.averageRelevance, 0);
    assert.strictEqual(telemetry.quality.belowRelevanceThresholdPassages, 1);
  });
});

describe('Traditional wisdom reaches the prompt for court-lineage-only spreads', () => {
  const cardsInfo = [
    { card: 'Page of Cups', position: 'Present', orientation: 'Upright', meaning: 'A tender invitation.', suit: 'Cups', rank: 'Page', rankValue: 11 },
    { card: 'Queen of Cups', position: 'Challenge', orientation: 'Upright', meaning: 'Deep feeling.', suit: 'Cups', rank: 'Queen', rankValue: 13 },
    { card: 'Three of Wands', position: 'Outcome', orientation: 'Upright', meaning: 'Expansion.', suit: 'Wands', rank: 'Three', rankValue: 3 }
  ];

  test('a spread whose only pattern is a court lineage still gets a GraphRAG block', () => {
    const { promptMeta } = buildEnhancedClaudePrompt({
      spreadInfo: { key: 'celtic', name: 'Celtic Cross' },
      cardsInfo,
      userQuestion: 'How can I move forward in my career?',
      themes: {
        knowledgeGraph: {
          graphKeys: {
            triadIds: [],
            completeTriadIds: [],
            dyadPairs: [],
            suitProgressions: [],
            courtLineages: [{ suit: 'Cups', significance: 'alliance' }]
          }
        }
      },
      context: 'career',
      promptBudgetEnv: { GRAPHRAG_ENABLED: 'true' }
    });

    assert.strictEqual(promptMeta.graphRAG.includedInPrompt, true);
    assert.strictEqual(promptMeta.graphRAG.skippedReason, undefined);
    assert.ok(promptMeta.graphRAG.passagesProvided > 0, 'Should provide at least one passage');
  });
});

describe('Partial-triad passages carry an explicit absent-card guardrail', () => {
  const partialTriadPayload = {
    passages: [
      {
        type: 'triad',
        patternId: 'magician-chariot-world',
        title: 'The Mastery Arc',
        text: 'You have tools and agency (The Magician). Align competing impulses (The Chariot).',
        source: 'Tableu Tarot Canon',
        isPartialPattern: true
      }
    ]
  };

  const completePatternPayload = {
    passages: [
      {
        type: 'court-lineage',
        patternId: 'Cups:alliance',
        title: 'Cups Court Alliance',
        text: 'Multiple Cups courts suggest feelings are organizing into relationship.',
        source: 'Tableu Tarot Canon'
      }
    ]
  };

  test('warns that a partial arc names cards which may be absent', () => {
    const block = buildGraphRAGReferenceBlock('celtic', {}, {
      env: { GRAPHRAG_ENABLED: 'true' },
      graphRAGPayload: partialTriadPayload
    });

    assert.match(
      block,
      /PARTIAL PATTERN/,
      'A partial arc must be flagged so absent cards are not asserted as drawn'
    );
  });

  test('omits the partial-pattern warning when every pattern is fully present', () => {
    const block = buildGraphRAGReferenceBlock('celtic', {}, {
      env: { GRAPHRAG_ENABLED: 'true' },
      graphRAGPayload: completePatternPayload
    });

    assert.doesNotMatch(block, /PARTIAL PATTERN/);
  });

  test('retrievePassages flags partial triads independently of includeMetadata', () => {
    const [passage] = retrievePassages(
      { triadIds: ['magician-chariot-world'], completeTriadIds: [] },
      { maxPassages: 1 }
    );

    assert.strictEqual(passage.isPartialPattern, true);
  });

  test('retrievePassages does not flag complete patterns as partial', () => {
    const [passage] = retrievePassages(
      { completeTriadIds: ['death-temperance-star'] },
      { maxPassages: 1 }
    );

    assert.strictEqual(passage.isPartialPattern, undefined);
  });
});
