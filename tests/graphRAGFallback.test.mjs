import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';

import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts.js';
import { clearEmbeddingCache } from '../functions/lib/embeddings.js';
import {
  scorePassageRelevance,
  retrievePassagesWithQuality,
  buildQualityRetrievalSummary
} from '../functions/lib/graphRAG.js';

describe('GraphRAG embedding failures', () => {
  const env = {
    AZURE_OPENAI_ENDPOINT: 'https://embeddings.test',
    AZURE_OPENAI_API_KEY: 'test-key'
  };
  const userQuery = 'hope career';
  const passage = 'The Star offers hope through change.';

  beforeEach(clearEmbeddingCache);
  afterEach(clearEmbeddingCache);

  for (const [failure, response] of [
    ['HTTP failure', () => new Response('Synthetic outage', { status: 503 })],
    ['network failure', () => { throw new Error('Synthetic network failure'); }],
    ['missing embedding', () => Response.json({ data: [] })],
    ['invalid embedding', () => Response.json({ data: [{ embedding: [null, 1] }] })],
    ['zero embedding', () => Response.json({ data: [{ embedding: [0, 0] }] })]
  ]) {
    it(`uses keyword-only scoring after ${failure}`, async (t) => {
      t.mock.method(globalThis, 'fetch', async () => response());
      const semanticStatus = { attempted: false, succeeded: false };

      const score = await scorePassageRelevance(passage, userQuery, {
        env,
        enableSemanticScoring: true,
        semanticStatus
      });

      assert.deepEqual(semanticStatus, { attempted: true, succeeded: false });
      assert.equal(score, 0.5, 'One of the two query keywords matches the passage');
    });
  }

  for (const failedInput of [userQuery, passage]) {
    it(`uses keyword-only scoring when only the ${failedInput === userQuery ? 'query' : 'passage'} embedding fails`, async (t) => {
      t.mock.method(globalThis, 'fetch', async (_url, init) => {
        const { input } = JSON.parse(init.body);
        return input === failedInput
          ? new Response('Synthetic outage', { status: 503 })
          : Response.json({ data: [{ embedding: [1, 0] }] });
      });
      const semanticStatus = { attempted: false, succeeded: false };

      const score = await scorePassageRelevance(passage, userQuery, {
        env,
        enableSemanticScoring: true,
        semanticStatus
      });

      assert.deepEqual(semanticStatus, { attempted: true, succeeded: false });
      assert.equal(score, 0.5);
    });
  }

  it('uses keyword-only scoring when the embedding API is not configured', async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
      throw new Error('No embedding request expected');
    });
    const semanticStatus = { attempted: false, succeeded: false };

    const score = await scorePassageRelevance(passage, userQuery, {
      env: {},
      enableSemanticScoring: true,
      semanticStatus
    });

    assert.deepEqual(semanticStatus, { attempted: true, succeeded: false });
    assert.equal(score, 0.5);
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  it('uses genuine semantic embeddings again after the provider recovers, including cache hits', async (t) => {
    let available = false;
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => available
      ? Response.json({ data: [{ embedding: [1, 0] }] })
      : new Response('Synthetic outage', { status: 503 }));
    const semanticStatus = { attempted: false, succeeded: false };
    const options = { env, enableSemanticScoring: true, semanticStatus };

    assert.equal(await scorePassageRelevance(passage, userQuery, options), 0.5);
    assert.equal(semanticStatus.succeeded, false);

    available = true;
    for (let attempt = 0; attempt < 2; attempt++) {
      const score = await scorePassageRelevance(passage, userQuery, options);
      assert.ok(Math.abs(score - 0.85) < 0.00001);
      assert.deepEqual(semanticStatus, { attempted: true, succeeded: true });
    }
    assert.equal(fetchMock.mock.callCount(), 4, 'Fallbacks must not prevent recovery; genuine vectors are cached');
  });

  it('reports embedding outages in retrieval and prompt metadata', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response('Synthetic outage', { status: 503 }));
    const graphKeys = { completeTriadIds: ['death-temperance-star'] };
    const passages = await retrievePassagesWithQuality(graphKeys, {
      userQuery: 'hope transition',
      enableSemanticScoring: true,
      env
    });
    assert.ok(passages.length > 0, 'Keyword retrieval should retain relevant wisdom');
    const retrievalSummary = buildQualityRetrievalSummary(graphKeys, passages);
    assert.equal(retrievalSummary.qualityMetrics.semanticScoringAttempted, true);
    assert.equal(retrievalSummary.qualityMetrics.semanticScoringUsed, false);

    const { promptMeta } = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'One-Card Insight' },
      cardsInfo: [{ card: 'The Star', number: 17, position: 'Theme', orientation: 'Upright', meaning: 'Hope.' }],
      userQuestion: 'hope transition',
      reflectionsText: '',
      themes: { knowledgeGraph: { graphKeys } },
      spreadAnalysis: null,
      context: 'general',
      graphRAGPayload: { passages, retrievalSummary, semanticScoringRequested: true },
      promptBudgetEnv: { GRAPHRAG_ENABLED: 'true' }
    });

    assert.equal(promptMeta.graphRAG.includedInPrompt, true);
    assert.equal(promptMeta.graphRAG.semanticScoringAttempted, true);
    assert.equal(promptMeta.graphRAG.semanticScoringRequested, true);
    assert.equal(promptMeta.graphRAG.semanticScoringUsed, false);
    assert.equal(promptMeta.graphRAG.semanticScoringFallback, true);
  });
});

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
