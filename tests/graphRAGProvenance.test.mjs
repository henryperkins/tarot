import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { rankPassagesForPrompt } from '../functions/lib/graphRAG.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts.js';
import { buildGraphRAGReferenceBlock } from '../functions/lib/narrative/prompts/graphRAGReferenceBlock.js';
import { TRIAD_PASSAGES } from '../functions/lib/knowledgeBase.js';
import { clearEmbeddingCache } from '../functions/lib/embeddings.js';
import { performSpreadAnalysis } from '../functions/lib/spreadAnalysisOrchestrator.js';
import { buildGraphRAGTelemetry } from '../functions/lib/telemetrySchema.js';

const TRIAD_SPREAD = { key: 'threeCard', name: 'Three-Card Story' };
const TRIAD_CARDS = [
  { card: 'Death', number: 13, position: 'Past', orientation: 'Upright', meaning: 'Endings that clear space.' },
  { card: 'Temperance', number: 14, position: 'Present', orientation: 'Upright', meaning: 'Patient blending.' },
  { card: 'The Star', number: 17, position: 'Future', orientation: 'Upright', meaning: 'Renewed hope.' }
];
// Shares no keywords with the triad passages, so keyword scoring lands at 0.
const UNRELATED_QUESTION = 'zzyzx quorbit';
// Env with a Workers AI binding; by default no embedding request is expected.
function embeddingsEnv(run = async () => { throw new Error('No embedding request expected'); }) {
  return { GRAPHRAG_ENABLED: 'true', AI: { run } };
}
// Workers AI run() stub answering every text with vectorFor(text).
const embedEach = (vectorFor = () => [1, 0]) => async (_model, { text }) => ({ data: text.map(vectorFor) });

function analyzeTriad(env) {
  return performSpreadAnalysis(
    TRIAD_SPREAD,
    TRIAD_CARDS,
    { userQuestion: UNRELATED_QUESTION, enableSemanticScoring: true, subscriptionTier: 'pro' },
    'graphrag-provenance-test',
    env
  );
}

describe('GraphRAG scoring provenance', () => {
  it('labels relevance scores from keyword fallback as keyword ranking', () => {
    const { passages, strategy } = rankPassagesForPrompt([
      { title: 'A', relevanceScore: 0.2, _semanticScoringAttempted: true, _semanticScoringSucceeded: false },
      { title: 'B', relevanceScore: 0.6, _semanticScoringAttempted: true, _semanticScoringSucceeded: false }
    ]);

    assert.equal(strategy, 'keyword');
    assert.deepEqual(passages.map((p) => p.title), ['B', 'A'], 'Fallback scores still order the passages');
  });

  it('labels a mix of embedded and fallback scores as mixed ranking', () => {
    const { strategy } = rankPassagesForPrompt([
      { title: 'A', relevanceScore: 0.9, _semanticScoringAttempted: true, _semanticScoringSucceeded: true },
      { title: 'B', relevanceScore: 0.6, _semanticScoringAttempted: true, _semanticScoringSucceeded: false }
    ]);

    assert.equal(strategy, 'mixed');
  });

  it('uses one consistent keyword ranking when embeddings fail for any candidate', async (t) => {
    clearEmbeddingCache();
    t.after(clearEmbeddingCache);
    // Give only the Fool's Journey stage passage an unusable vector; the question
    // shares its keywords, so its keyword-fallback score keeps it above the
    // relevance threshold.
    const run = embedEach((text) => (text.includes('Here the work turns inward') ? [0, 0] : [1, 0]));

    const { graphRAGPayload } = await performSpreadAnalysis(
      TRIAD_SPREAD,
      TRIAD_CARDS,
      { userQuestion: 'reality checks surrender', enableSemanticScoring: true, subscriptionTier: 'pro' },
      'graphrag-mixed-test',
      embeddingsEnv(run)
    );

    assert.ok(graphRAGPayload.passages.some((p) => p._semanticScoringSucceeded === false), 'Scenario precondition');
    assert.equal(graphRAGPayload.rankingStrategy, 'keyword');
    assert.ok(graphRAGPayload.passages.every(p => p._semanticScoringSucceeded === false));
    assert.equal(graphRAGPayload.retrievalSummary.semanticScoringFallbackReason, 'embeddings-partial-failure');
  });

  it('reports that nothing was scored when there is no question to score against', async () => {
    const { graphRAGPayload } = await performSpreadAnalysis(
      TRIAD_SPREAD,
      TRIAD_CARDS,
      { userQuestion: '', enableSemanticScoring: true, subscriptionTier: 'pro' },
      'graphrag-no-query-test',
      embeddingsEnv()
    );

    assert.equal(graphRAGPayload.retrievalSummary.semanticScoringFallbackReason, 'no-query');
  });

  it('reports that quality filtering was disabled instead of an embeddings failure', async () => {
    const { graphRAGPayload } = await analyzeTriad({ ...embeddingsEnv(), DISABLE_QUALITY_FILTERING: 'true' });

    assert.equal(graphRAGPayload.retrievalSummary.semanticScoringFallbackReason, 'quality-filtering-disabled');
  });

  it('gives graph-disabled precedence when semantic scoring is requested without graph opt-in', async () => {
    const { graphRAGPayload } = await analyzeTriad({});

    assert.equal(graphRAGPayload.semanticScoringFallback, true, 'Scenario precondition');
    assert.equal(graphRAGPayload.retrievalSummary.semanticScoringFallbackReason, 'graphrag-disabled');
  });

  it('reports keyword ranking and why, when configured embeddings fail', async (t) => {
    clearEmbeddingCache();
    t.after(clearEmbeddingCache);
    const { graphRAGPayload } = await analyzeTriad(embeddingsEnv(async () => {
      throw new Error('Synthetic outage');
    }));

    assert.equal(graphRAGPayload.semanticScoringUsed, false);
    assert.equal(graphRAGPayload.rankingStrategy, 'keyword');
    assert.equal(graphRAGPayload.retrievalSummary.semanticScoringFallbackReason, 'embeddings-failed');
    assert.equal(
      buildGraphRAGTelemetry(graphRAGPayload.retrievalSummary).semanticScoring.fallbackReason,
      'embeddings-failed'
    );
  });

  it('reports why semantic scoring fell back when embeddings are not configured', async () => {
    const { graphRAGPayload } = await analyzeTriad({ GRAPHRAG_ENABLED: 'true' });

    assert.equal(graphRAGPayload.rankingStrategy, 'keyword');
    assert.equal(graphRAGPayload.retrievalSummary.semanticScoringFallbackReason, 'embeddings-not-configured');
  });

  it('reports why semantic scoring fell back when no scored payload was prefetched', () => {
    const { promptMeta } = buildEnhancedClaudePrompt({
      spreadInfo: TRIAD_SPREAD,
      cardsInfo: TRIAD_CARDS,
      userQuestion: 'What is changing for me?',
      reflectionsText: '',
      themes: { knowledgeGraph: { graphKeys: { completeTriadIds: ['death-temperance-star'] } } },
      enableSemanticScoring: true,
      promptBudgetEnv: { GRAPHRAG_ENABLED: 'true' }
    });

    assert.equal(promptMeta.graphRAG.semanticScoringFallback, true);
    assert.equal(promptMeta.graphRAG.semanticScoringFallbackReason, 'not-prefetched');
    assert.equal(buildGraphRAGTelemetry(promptMeta.graphRAG).semanticScoring.fallbackReason, 'not-prefetched');
  });

  it('reports semantic ranking with no fallback reason when embeddings score the passages', async (t) => {
    clearEmbeddingCache();
    t.after(clearEmbeddingCache);
    const { graphRAGPayload } = await analyzeTriad(embeddingsEnv(embedEach()));

    assert.equal(graphRAGPayload.semanticScoringUsed, true);
    assert.equal(graphRAGPayload.rankingStrategy, 'semantic');
    assert.equal(graphRAGPayload.retrievalSummary.semanticScoringFallbackReason, null);
  });
});

describe('below-threshold passages keep their qualification in the prompt', () => {
  const weakPayload = {
    passages: [
      {
        ...TRIAD_PASSAGES['death-temperance-star'].passages[0],
        type: 'triad', patternId: 'death-temperance-star',
        relevanceScore: 0,
        belowRelevanceThreshold: true
      }
    ]
  };
  const strongPayload = {
    passages: [{ ...weakPayload.passages[0], relevanceScore: 0.8, belowRelevanceThreshold: undefined }]
  };

  it('marks a weakly matched passage as card background, not evidence', () => {
    const block = buildGraphRAGReferenceBlock('threeCard', {}, {
      env: { GRAPHRAG_ENABLED: 'true' },
      graphRAGPayload: weakPayload
    });
    const reference = block.match(/<reference>([\s\S]*?)<\/reference>/)?.[1] || '';

    assert.match(reference, /weak match to the question/i, 'The passage itself carries the qualification');
    assert.match(block, /WEAK QUESTION MATCH:[^\n]*not[^\n]*evidence[^\n]*outcome/i);
  });

  it('adds no weak-match qualification when passages cleared the threshold', () => {
    const block = buildGraphRAGReferenceBlock('threeCard', {}, {
      env: { GRAPHRAG_ENABLED: 'true' },
      graphRAGPayload: strongPayload
    });

    assert.doesNotMatch(block, /weak match|WEAK QUESTION MATCH/i);
  });

  it('keeps the qualification through full prompt assembly', async () => {
    const analysis = await analyzeTriad({ GRAPHRAG_ENABLED: 'true' });
    assert.equal(analysis.graphRAGPayload.passages[0].belowRelevanceThreshold, true, 'Scenario precondition');

    const { userPrompt } = buildEnhancedClaudePrompt({
      spreadInfo: TRIAD_SPREAD,
      cardsInfo: TRIAD_CARDS,
      userQuestion: UNRELATED_QUESTION,
      reflectionsText: '',
      themes: analysis.themes,
      spreadAnalysis: analysis.spreadAnalysis,
      graphRAGPayload: analysis.graphRAGPayload,
      promptBudgetEnv: { GRAPHRAG_ENABLED: 'true' }
    });

    assert.match(userPrompt, /weak match to the question/i);
    assert.match(userPrompt, /WEAK QUESTION MATCH:/);
  });
});

for (const reason of ['embeddings-timeout', 'embeddings-invalid-response']) {
  it(`keeps ${reason} through actual retrieval and bounded telemetry`, async t => {
    clearEmbeddingCache();
    t.after(clearEmbeddingCache);
    t.mock.method(console, 'warn', () => {});
    const run = reason === 'embeddings-timeout'
      ? async () => { throw new DOMException('Synthetic timeout', 'AbortError'); }
      : async () => ({ data: [] });
    const { graphRAGPayload } = await analyzeTriad(embeddingsEnv(run));
    assert.equal(graphRAGPayload.retrievalSummary.semanticScoringFallbackReason, reason);
    const telemetry = buildGraphRAGTelemetry(graphRAGPayload.retrievalSummary);
    assert.equal(telemetry.semanticScoring.fallback, true);
    assert.equal(telemetry.semanticScoring.fallbackReason, reason);
    assert.equal(buildGraphRAGTelemetry({ semanticScoringFallbackReason: 'Private name from a note' }).semanticScoring.fallbackReason, null);
  });
}


for (const semantic of [false, true]) for (const binding of [false, true]) {
  it(`orchestration bypass precedes semantic=${semantic} binding=${binding}`, async t => {
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'warn', () => {});
    let calls = 0;
    const env = { GRAPHRAG_ENABLED: true, DISABLE_QUALITY_FILTERING: true, ...(binding ? { AI: { run() { calls++; } } } : {}) };
    const { graphRAGPayload: payload } = await performSpreadAnalysis(TRIAD_SPREAD, TRIAD_CARDS, { userQuestion: 'hope', enableSemanticScoring: semantic, subscriptionTier: 'pro' }, 'bypass-mode', env);
    assert.equal(calls, 0);
    assert.equal(payload.rankingStrategy, 'bypassed');
    assert.equal(payload.retrievalSummary.retrievalMode, 'bypassed');
    assert.equal(payload.retrievalSummary.semanticScoringFallbackReason, 'quality-filtering-disabled');
    assert.equal(payload.qualityMetrics.semanticScoringAttempted, false);
    assert.equal(payload.qualityMetrics.semanticScoringUsed, false);
    assert.ok(payload.passages.every(row => row.relevanceScore === undefined));
  });
}

it('graph disabled precedes bypass and semantic requests at orchestration', async t => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  let calls = 0;
  const { graphRAGPayload: payload } = await performSpreadAnalysis(TRIAD_SPREAD, TRIAD_CARDS, { userQuestion: 'hope', enableSemanticScoring: true }, 'disabled-mode', { GRAPHRAG_ENABLED: false, DISABLE_QUALITY_FILTERING: true, AI: { run() { calls++; } } });
  assert.equal(calls, 0);
  assert.equal(payload.retrievalSummary.retrievalMode, 'disabled');
  assert.equal(payload.retrievalSummary.semanticScoringFallbackReason, 'graphrag-disabled');
  assert.deepEqual(payload.passages, []);
});
