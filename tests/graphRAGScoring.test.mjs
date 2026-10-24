import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { scorePassageRelevance, retrievePassagesWithQuality } from '../functions/lib/graphRAG.js';
import { clearEmbeddingCache } from '../functions/lib/embeddings.js';
import { buildGraphContext } from '../functions/lib/graphContext.js';
import { resolveContextSelection } from '../functions/lib/contextDetection.js';
import { collectPassageCandidates } from '../functions/lib/graphRAGCandidates.js';
import { evaluateGraphRAGRelevance, sha256Hex } from '../scripts/evaluation/verifyGraphRAGRelevance.js';

const scoringModule = await import('../functions/lib/graphRAGScoring.js').catch(() => ({}));

function assertClose(actual, expected, epsilon = 1e-12) {
  assert.equal(typeof actual, 'number');
  assert.ok(Math.abs(actual - expected) <= epsilon, `Expected ${actual} to be within ${epsilon} of ${expected}`);
}

test('composeRelevanceScore satisfies design contract boundary values and null semantic fallback', () => {
  assert.equal(typeof scoringModule.composeRelevanceScore, 'function', 'composeRelevanceScore must be exported');
  const { composeRelevanceScore } = scoringModule;

  // Design contract examples: score = s + 0.3 * k * (1 - s)
  assertClose(composeRelevanceScore({ keywordScore: 0, semanticScore: 0.4 }), 0.4);
  assertClose(composeRelevanceScore({ keywordScore: 0, semanticScore: 0.2 }), 0.2);
  assertClose(composeRelevanceScore({ keywordScore: 1, semanticScore: 0.4 }), 0.58);
  assertClose(composeRelevanceScore({ keywordScore: 1, semanticScore: -0.2 }), 0.16);

  // Immediately around the 0.3 threshold
  assertClose(composeRelevanceScore({ keywordScore: 0, semanticScore: 0.299 }), 0.299);
  assertClose(composeRelevanceScore({ keywordScore: 0, semanticScore: 0.3 }), 0.3);
  assertClose(composeRelevanceScore({ keywordScore: 0, semanticScore: 0.301 }), 0.301);

  // Negative cosine and perfect similarity
  assertClose(composeRelevanceScore({ keywordScore: 0, semanticScore: -0.5 }), -0.5);
  assertClose(composeRelevanceScore({ keywordScore: 1, semanticScore: -1 }), -0.4);
  assertClose(composeRelevanceScore({ keywordScore: 0, semanticScore: 1 }), 1);
  assertClose(composeRelevanceScore({ keywordScore: 1, semanticScore: 1 }), 1);

  // Floating-point excursion clamping
  assertClose(composeRelevanceScore({ keywordScore: 0.5, semanticScore: 1.0000000000000004 }), 1);
  assertClose(composeRelevanceScore({ keywordScore: 0, semanticScore: -1.0000000000000004 }), -1);

  // Null or omitted semanticScore returns lexical score
  assertClose(composeRelevanceScore({ keywordScore: 0.625, semanticScore: null }), 0.625);
  assertClose(composeRelevanceScore({ keywordScore: 0.625 }), 0.625);
});

test('scorePassageRelevance uses semantic-primary default composition and preserves explicit custom weights', async (t) => {
  clearEmbeddingCache();
  t.after(clearEmbeddingCache);

  // Zero lexical overlap, cosine = 0.4 -> 0.4 under default policy
  const zeroOverlapEnv = {
    AI: {
      run: async (_model, { text }) => ({
        data: text.map((entry) => (entry === '悲しみのあとの再生' ? [1, 0] : [0.4, Math.sqrt(1 - 0.16)]))
      })
    }
  };
  const defaultScore = await scorePassageRelevance(
    'The Star offers quiet renewal after grief.',
    '悲しみのあとの再生',
    { enableSemanticScoring: true, env: zeroOverlapEnv }
  );
  assertClose(defaultScore, 0.4, 1e-6);

  // Explicit custom weights preserve weighted linear combination: 0.3 * 0 + 0.7 * 0.4 = 0.28
  const customWeightedScore = await scorePassageRelevance(
    'The Star offers quiet renewal after grief.',
    '悲しみのあとの再生',
    { enableSemanticScoring: true, keywordWeight: 0.3, semanticWeight: 0.7, env: zeroOverlapEnv }
  );
  assertClose(customWeightedScore, 0.28, 1e-6);
});

test('retrievePassagesWithQuality admits a cosine 0.4 zero-lexical-overlap candidate above the 0.3 threshold while keeping negative cosine weak', async (t) => {
  clearEmbeddingCache();
  t.after(clearEmbeddingCache);

  const keys = { completeTriadIds: ['death-temperance-star'] };
  const query = '悲しみのあとに静かな再生へ向かう';
  const env = {
    AI: {
      run: async (_model, { text }) => ({
        data: text.map((entry) => (entry === query ? [1, 0] : [0.4, Math.sqrt(1 - 0.16)]))
      })
    }
  };

  const selected = await retrievePassagesWithQuality(keys, {
    userQuery: query,
    maxPassages: 1,
    env
  });
  assert.equal(selected.length, 1);
  assertClose(selected[0].relevanceScore, 0.4, 1e-6);
  assert.notEqual(selected[0].belowRelevanceThreshold, true);

  clearEmbeddingCache();
  const negativeEnv = {
    AI: {
      run: async (_model, { text }) => ({
        data: text.map((entry) => (entry === 'healing grief' ? [1, 0] : [-0.2, Math.sqrt(1 - 0.04)]))
      })
    }
  };
  const negativeResult = await retrievePassagesWithQuality(keys, {
    userQuery: 'healing grief',
    questionContext: 'grief',
    maxPassages: 1,
    env: negativeEnv
  });
  assert.equal(negativeResult.length, 1);
  assert.ok(negativeResult[0].relevanceScore < 0.3, 'Negative cosine with lexical match must remain below 0.3 threshold');
  assert.equal(negativeResult[0].belowRelevanceThreshold, true);
});

test('verifyGraphRAGRelevance fails when evidence is missing or mismatched and reports macro metrics on frozen synthetic evidence', () => {
  const fixturesRaw = fs.readFileSync('tests/fixtures/graph-rag-relevance-cases.json', 'utf8');
  const fixturesDoc = JSON.parse(fixturesRaw);

  // CLI fails without --embeddings
  assert.throws(() => {
    execFileSync('node', ['scripts/evaluation/verifyGraphRAGRelevance.js', '--fixtures', 'tests/fixtures/graph-rag-relevance-cases.json', '--json'], { stdio: 'pipe' });
  });

  // Evaluator fails on missing or mismatched case order
  const missingResult = evaluateGraphRAGRelevance({ fixturesDoc, evidenceDoc: null, fixturesRaw });
  assert.equal(missingResult.ok, false);
  assert.equal(missingResult.status, 'failed_missing_or_mismatched_evidence');

  const wrongOrderResult = evaluateGraphRAGRelevance({
    fixturesDoc,
    evidenceDoc: { model: '@cf/baai/bge-m3', caseOrder: ['REL02', 'REL01'] },
    fixturesRaw
  });
  assert.equal(wrongOrderResult.ok, false);
  assert.equal(wrongOrderResult.status, 'failed_missing_or_mismatched_evidence');

  // Build complete synthetic frozen cosine evidence for the 10 fixtures
  const cosinesByCase = {};
  for (const fixture of fixturesDoc.cases) {
    const selection = resolveContextSelection({ userQuestion: fixture.acceptedQuery }, fixture.spreadKey || 'general');
    const gk = buildGraphContext(fixture.cards, { deckStyle: fixture.deck });
    const candidates = collectPassageCandidates(gk.graphKeys, {
      deckStyle: fixture.deck,
      questionContext: selection.graphRAGContext,
      includeMetadata: true
    });
    const relevantSet = new Set(fixture.expectedRelevantCandidateIds);
    const candidateMap = {};
    for (const c of candidates) {
      candidateMap[c.candidateId] = {
        promptTextHash: sha256Hex(c.promptText),
        cosine: relevantSet.has(c.candidateId) ? 0.42 : 0.18
      };
    }
    cosinesByCase[fixture.id] = {
      queryHash: sha256Hex(selection.retrievalQuery),
      candidates: candidateMap
    };
  }

  const syntheticReport = evaluateGraphRAGRelevance({
    fixturesDoc,
    evidenceDoc: {
      model: '@cf/baai/bge-m3',
      providerMetadata: { mode: 'synthetic-unit-test' },
      caseOrder: fixturesDoc.cases.map((c) => c.id),
      cosinesByCase
    },
    fixturesRaw
  });
  assert.equal(syntheticReport.ok, true);
  assert.equal(syntheticReport.status, 'passed');
  assert.equal(syntheticReport.acceptanceChecks.zeroOverlapPositivesPass, true);
  assert.deepEqual(syntheticReport.acceptanceChecks.newFalsePositives, []);
  assert.ok(syntheticReport.macroByClass.multilingual_retrieval.candidateMacroRecall > syntheticReport.macroByClass.multilingual_retrieval.baselineMacroRecall);

  // If an unrelated fixture has cosine 0.41 on an irrelevant candidate, baseline rejects it (0.7*0.41=0.287 < 0.3) while candidate admits it (>=0.3), failing acceptance
  const counterexampleCosines = structuredClone(cosinesByCase);
  for (const entry of Object.values(counterexampleCosines.REL10.candidates)) {
    entry.cosine = 0.41;
  }
  const failedAcceptance = evaluateGraphRAGRelevance({
    fixturesDoc,
    evidenceDoc: {
      model: '@cf/baai/bge-m3',
      providerMetadata: { mode: 'synthetic-counterexample' },
      caseOrder: fixturesDoc.cases.map((c) => c.id),
      cosinesByCase: counterexampleCosines
    },
    fixturesRaw
  });
  assert.equal(failedAcceptance.ok, false);
  assert.equal(failedAcceptance.status, 'failed_acceptance_criteria');
  assert.ok(failedAcceptance.acceptanceChecks.newFalsePositives.length > 0);
});
