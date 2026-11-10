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

test('composeRelevanceScore restores legacy threshold behavior and preserves lexical fallback', () => {
  assert.equal(typeof scoringModule.composeRelevanceScore, 'function', 'composeRelevanceScore must be exported');
  const { composeRelevanceScore } = scoringModule;

  // Qualified rollback: score = 0.3 * k + 0.7 * s; F3b remains unresolved.
  assertClose(composeRelevanceScore({ keywordScore: 0, semanticScore: 0.4 }), 0.28);
  assertClose(composeRelevanceScore({ keywordScore: 0, semanticScore: 0.2 }), 0.14);
  assertClose(composeRelevanceScore({ keywordScore: 1, semanticScore: 0.4 }), 0.58);
  assertClose(composeRelevanceScore({ keywordScore: 1, semanticScore: -0.2 }), 0.16);

  // Immediately around the 0.3 threshold
  assertClose(composeRelevanceScore({ keywordScore: 0, semanticScore: 0.427 }), 0.2989);
  assertClose(composeRelevanceScore({ keywordScore: 0.3, semanticScore: 0.3 }), 0.3);
  assertClose(composeRelevanceScore({ keywordScore: 0, semanticScore: 0.429 }), 0.3003);

  // Negative cosine and perfect similarity
  assertClose(composeRelevanceScore({ keywordScore: 0, semanticScore: -0.5 }), -0.35);
  assertClose(composeRelevanceScore({ keywordScore: 1, semanticScore: -1 }), -0.4);
  assertClose(composeRelevanceScore({ keywordScore: 0, semanticScore: 1 }), 0.7);
  assertClose(composeRelevanceScore({ keywordScore: 1, semanticScore: 1 }), 1);

  // Floating-point excursion clamping
  assertClose(composeRelevanceScore({ keywordScore: 0.5, semanticScore: 1.0000000000000004 }), 0.85);
  assertClose(composeRelevanceScore({ keywordScore: 0, semanticScore: -1.0000000000000004 }), -0.7);

  // Null or omitted semanticScore returns lexical score
  assertClose(composeRelevanceScore({ keywordScore: 0.625, semanticScore: null }), 0.625);
  assertClose(composeRelevanceScore({ keywordScore: 0.625 }), 0.625);
  assertClose(composeRelevanceScore({ keywordScore: 0.625, semanticScore: NaN }), 0.625);
  assertClose(composeRelevanceScore({ keywordScore: 0.625, semanticScore: Infinity }), 0.625);
});

test('scorePassageRelevance uses the restored default and preserves explicit custom weights', async (t) => {
  clearEmbeddingCache();
  t.after(clearEmbeddingCache);

  // Zero lexical overlap, cosine = 0.4 -> 0.28 under the restored default.
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
  assertClose(defaultScore, 0.28, 1e-6);

  // Explicit non-default weights remain independent of the default policy.
  const customWeightedScore = await scorePassageRelevance(
    'The Star offers quiet renewal after grief.',
    '悲しみのあとの再生',
    { enableSemanticScoring: true, keywordWeight: 0.8, semanticWeight: 0.2, env: zeroOverlapEnv }
  );
  assertClose(customWeightedScore, 0.08, 1e-6);
});

test('retrievePassagesWithQuality keeps cosine 0.4 zero-overlap and negative-cosine candidates on the weak floor', async (t) => {
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
  assertClose(selected[0].relevanceScore, 0.28, 1e-6);
  assert.equal(selected[0].belowRelevanceThreshold, true);

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
        cosine: relevantSet.has(c.candidateId) ? 0.5 : 0.18
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
  assert.equal(syntheticReport.macroByClass.multilingual_retrieval.candidateMacroRecall, syntheticReport.macroByClass.multilingual_retrieval.baselineMacroRecall);
  assert.equal(syntheticReport.policy.id, 'legacy-weighted-v1');
  assert.equal(syntheticReport.policy.formula, '0.3 * k + 0.7 * s');

  // Restore rejection of the observed unrelated cosine floor (0.7*0.41=0.287).
  const counterexampleCosines = structuredClone(cosinesByCase);
  for (const entry of Object.values(counterexampleCosines.REL10.candidates)) {
    entry.cosine = 0.41;
  }
  const preservedAcceptance = evaluateGraphRAGRelevance({
    fixturesDoc,
    evidenceDoc: {
      model: '@cf/baai/bge-m3',
      providerMetadata: { mode: 'synthetic-counterexample' },
      caseOrder: fixturesDoc.cases.map((c) => c.id),
      cosinesByCase: counterexampleCosines
    },
    fixturesRaw
  });
  assert.equal(preservedAcceptance.ok, true);
  assert.deepEqual(preservedAcceptance.acceptanceChecks.newFalsePositives, []);
  assert.equal(preservedAcceptance.perCase.find(row => row.id === 'REL10').candidate.strongSelectedIds.length, 0);

  // A multilingual miss must still fail the original F3b gate after rollback.
  for (const entry of Object.values(counterexampleCosines.REL02.candidates)) entry.cosine = 0.42;
  const unresolved = evaluateGraphRAGRelevance({
    fixturesDoc, fixturesRaw,
    evidenceDoc: { model: '@cf/baai/bge-m3', caseOrder: fixturesDoc.cases.map(c => c.id), cosinesByCase: counterexampleCosines }
  });
  assert.equal(unresolved.ok, false);
  assert.equal(unresolved.status, 'failed_acceptance_criteria');
  assert.equal(unresolved.acceptanceChecks.zeroOverlapPositivesPass, false);
  assert.deepEqual(unresolved.acceptanceChecks.recallRegressions, []);
});
