import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { selectPassageCandidates } from '../functions/lib/graphRAGCandidates.js';
import { rankPassagesForPrompt } from '../functions/lib/graphRAG.js';
import { evaluateGraphRAGRelevance, sha256Hex } from '../scripts/evaluation/verifyGraphRAGRelevance.js';

const passage = (pattern, context, semanticScore, overrides = {}) => ({
  candidateId: `${pattern}:${context}`, patternKey: pattern, patternId: pattern,
  type: 'dyad', priority: 3, context, promptText: `${pattern} ${context} text`,
  relevance: 0, relevanceScore: 0.7 * semanticScore,
  _semanticScore: semanticScore, _semanticScoringSucceeded: true,
  _contextMatch: context === 'general' ? 1 : 0,
  ...overrides
});
const options = { maxPassages: 1, minRelevanceScore: 0.3 };

test('a gated variant can identify a pattern without authorizing its context-specific prose', () => {
  const general = passage('renewal', 'general', 0.6);
  const specific = passage('renewal', 'grief', 0.8);
  const broader = passage('journey', 'general', 0.65);
  const input = [general, specific, broader];
  const before = structuredClone(input);
  const selected = selectPassageCandidates(input, options);
  assert.deepEqual(selected.map(p => p.candidateId), ['renewal:general']);
  assert.equal(selected[0].relevanceScore, general.relevanceScore, 'Admission score stays passage-specific');
  assert.equal(selected[0].promptText, general.promptText);
  assert.equal(selected.retrievalStats.contextVariantsGated, 1);
  assert.deepEqual(input, before, 'Selection must not mutate caller candidates');
});

test('pattern affinity never promotes a passage below the original threshold', () => {
  const selected = selectPassageCandidates([
    passage('renewal', 'general', 0.4), passage('renewal', 'grief', 0.99),
    passage('journey', 'general', 0.5)
  ], options);
  assert.deepEqual(selected.map(p => p.candidateId), ['journey:general']);
});

test('pattern affinity cannot admit a supplemental Major without lexical support', () => {
  const selected = selectPassageCandidates([
    passage('major', 'general', 0.9, { type: 'major-arcana', priority: 7 }),
    passage('journey', 'general', 0.5)
  ], options);
  assert.deepEqual(selected.map(p => p.candidateId), ['journey:general']);
});

test('weak-floor selection remains weak and does not borrow a gated variant score', () => {
  const selected = selectPassageCandidates([
    passage('renewal', 'general', 0.4), passage('renewal', 'grief', 0.99)
  ], options);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].belowRelevanceThreshold, true);
  assert.equal(selected[0].relevanceScore, 0.7 * 0.4);
});

test('same names in different authenticated pattern keys cannot share affinity', () => {
  const selected = selectPassageCandidates([
    passage('renewal:deck-a:partial', 'general', 0.5),
    passage('renewal:deck-b:complete', 'grief', 0.99),
    passage('renewal:deck-b:complete', 'general', 0.2),
    passage('journey', 'general', 0.6)
  ], options);
  assert.deepEqual(selected.map(p => p.candidateId), ['journey:general']);
});

for (const invalid of [null, NaN, Infinity, -1.1, 1.1]) {
  test(`invalid semantic evidence (${invalid}) keeps the original ranking`, () => {
    const selected = selectPassageCandidates([
      passage('renewal', 'general', 0.6),
      passage('renewal', 'grief', 0.8, { _semanticScore: invalid }),
      passage('journey', 'general', 0.65)
    ], options);
    assert.deepEqual(selected.map(p => p.candidateId), ['journey:general']);
  });
}

test('keyword fallback and quality bypass retain their existing ordering', () => {
  const rows = [passage('renewal', 'general', 0.6), passage('renewal', 'grief', 0.8), passage('journey', 'general', 0.65)];
  const keyword = rows.map(p => ({ ...p, _semanticScoringSucceeded: false }));
  assert.deepEqual(selectPassageCandidates(keyword, options).map(p => p.candidateId), ['journey:general']);
  const bypassed = rows.map(p => ({ ...p, _qualityFilteringDisabled: true, _priorityOnly: true, priority: p.patternId === 'journey' ? 1 : 3 }));
  assert.deepEqual(selectPassageCandidates(bypassed, { ...options, qualityFilteringDisabled: true }).map(p => p.candidateId), ['journey:general']);
});

test('prompt-budget trimming preserves the qualified selection ranking', () => {
  const selected = selectPassageCandidates([
    passage('renewal', 'general', 0.6), passage('renewal', 'grief', 0.8),
    passage('journey', 'general', 0.65)
  ], { ...options, maxPassages: 2 });
  const ranked = rankPassagesForPrompt(selected, { limit: 1 });
  assert.deepEqual(ranked.passages.map(p => p.candidateId), ['renewal:general']);
});

test('equal pattern affinities keep the passage-score tie-break during prompt fitting', () => {
  const rows = [
    passage('a', 'general', 0.5, { priority: 1 }), passage('a', 'grief', 0.8),
    passage('b', 'general', 0.6, { priority: 3 }), passage('b', 'grief', 0.8)
  ];
  const direct = selectPassageCandidates(rows, options);
  const larger = selectPassageCandidates(rows, { ...options, maxPassages: 2 });
  const trimmed = rankPassagesForPrompt(larger, { limit: 1 }).passages;
  assert.equal(direct[0].candidateId, 'b:general');
  assert.deepEqual(trimmed.map(p => p.candidateId), direct.map(p => p.candidateId));
});

test('the unchanged F3b corpus passes its original predicates on frozen real cosines', () => {
  const fixturesRaw = fs.readFileSync(new URL('fixtures/graph-rag-relevance-cases.json', import.meta.url), 'utf8');
  const fixturesDoc = JSON.parse(fixturesRaw);
  const evidenceDoc = JSON.parse(fs.readFileSync(new URL('fixtures/graph-rag-relevance-cosines.json', import.meta.url), 'utf8'));
  assert.equal(sha256Hex(fixturesRaw), evidenceDoc.providerMetadata.fixtureSha256);
  const result = evaluateGraphRAGRelevance({ fixturesRaw, fixturesDoc, evidenceDoc });
  assert.equal(result.ok, true, JSON.stringify(result.acceptanceChecks));
  assert.equal(result.acceptanceChecks.zeroOverlapPositivesPass, true);
  assert.deepEqual(result.acceptanceChecks.newFalsePositives, []);
  assert.deepEqual(result.acceptanceChecks.recallRegressions, []);
  assert.deepEqual(result.acceptanceChecks.capRegressions, []);
  const multilingual = result.perCase.find(row => row.id === 'REL02');
  assert.equal(multilingual.baseline.relevantHits.length, 0);
  assert.ok(multilingual.candidate.relevantHits.length > 0);
});
