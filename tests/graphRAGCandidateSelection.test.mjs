import assert from 'node:assert/strict';
import { test } from 'node:test';
import { retrievePassages, retrievePassagesWithQuality, buildQualityRetrievalSummary } from '../functions/lib/graphRAG.js';
import { clearEmbeddingCache } from '../functions/lib/embeddings.js';
import * as canon from '../functions/lib/knowledgeBase.js';
const { TRIAD_PASSAGES } = canon;
import { projectPassageForDeck } from '../functions/lib/graphRAGProjection.js';
const candidatesModule = await import('../functions/lib/graphRAGCandidates.js').catch(() => ({}));
const keys = { completeTriadIds: ['death-temperance-star'], foolsJourneyStageKey: 'integration', dyadPairs: [{ cards: [13, 17], significance: 'high' }, { cards: [13, 14], significance: 'medium' }] };

test('a best candidate beyond twice the final allowance can win', async (t) => {
  clearEmbeddingCache(); t.after(clearEmbeddingCache);
  const embedded = [];
  const env = { AI: { run: async (_model, { text }) => {
    embedded.push(...text);
    return { data: text.map((input) => input === 'Which horizon?' || input.startsWith('Letting go is not the end of the story.') ? [1, 0] : [0, 1]) };
  } } };
  const result = await retrievePassagesWithQuality(keys, { maxPassages: 1, userQuery: 'Which horizon?', env, enableSemanticScoring: true });
  assert.ok(embedded.some(text => text.startsWith('Letting go is not the end of the story.')), 'The previously excluded dyad must compete');
  assert.equal(result[0].patternId, '13-17');
});

test('semantic relevance can select a non-default variant and only one variant survives', async (t) => {
  clearEmbeddingCache(); t.after(clearEmbeddingCache);
  const grief = TRIAD_PASSAGES['death-temperance-star'].passages.find(p => p.context === 'grief');
  const env = { AI: { run: async (_model, { text }) => ({ data: text.map(input => input === 'Question sans keywords' || input === grief.text ? [1, 0] : [0, 1]) }) } };
  const result = await retrievePassagesWithQuality({ completeTriadIds: ['death-temperance-star'] }, { userQuery: 'Question sans keywords', maxPassages: 5, env });
  assert.equal(result.length, 1);
  assert.equal(result[0].context, 'grief');
});

test('all variants enumerate with unique stable candidate identities', () => {
  assert.equal(typeof candidatesModule.collectPassageCandidates, 'function');
  const result = candidatesModule.collectPassageCandidates(keys, { deckStyle: 'thoth-a1' });
  assert.equal(new Set(result.map(p => p.candidateId)).size, result.length);
  assert.equal(result.filter(p => p.type === 'triad').length, 4);
  assert.ok(result.every(p => p.crossDeckReference && !p.promptVisualAnchors.length));
  for (const candidate of result) assert.deepEqual(JSON.parse(candidate.candidateId), [candidate.type, candidate.patternId, candidate.context || 'general', candidate.sourceDeck]);
});

const candidate = (id, text, score = 0.8) => ({ ...projectPassageForDeck({ type: 'major-arcana', patternId: id, text, archetypalText: text }), relevanceScore: score });
test('full content deduplication preserves different tails beyond 100 characters', () => {
  assert.equal(typeof candidatesModule.selectPassageCandidates, 'function');
  const prefix = 'A'.repeat(120);
  const result = candidatesModule.selectPassageCandidates([candidate('1', prefix + ' first'), candidate('2', prefix + ' second'), candidate('3', prefix + ' first')]);
  assert.deepEqual(result.map(p => p.patternId), ['1', '2']);
});

test('repeated identities never consume slots even when text deduplication is disabled', () => {
  assert.equal(typeof candidatesModule.selectPassageCandidates, 'function');
  const first = candidate('1', 'First meaning.');
  const result = candidatesModule.selectPassageCandidates([first, first, candidate('2', 'Second meaning.')], { maxPassages: 2, enableDeduplication: false });
  assert.deepEqual(result.map(p => p.patternId), ['1', '2']);
});

for (const maxPassages of [0, -1, 0.5, Infinity, NaN]) {
  test(`invalid final allowance ${maxPassages} avoids embeddings in both paths`, async () => {
    let calls = 0;
    const env = { AI: { run: async () => { calls++; throw new Error('Unexpected embedding'); } } };
    assert.deepEqual(await retrievePassagesWithQuality(keys, { userQuery: 'hope', maxPassages, env }), []);
    assert.deepEqual(retrievePassages(keys, { maxPassages }), []);
    assert.equal(calls, 0);
  });
}

for (const badVector of [[0, 0], [1, NaN], [1, 0, 0]]) {
  test(`one invalid vector ${JSON.stringify(badVector)} makes the entire ranking keyword-only`, async (t) => {
    clearEmbeddingCache(); t.after(clearEmbeddingCache);
    const env = { AI: { run: async (_model, { text }) => ({ data: text.map((input, i) => i === 2 ? badVector : [1, 0]) }) } };
    const result = await retrievePassagesWithQuality(keys, { userQuery: 'healing hope', maxPassages: 5, env });
    assert.ok(result.length);
    assert.ok(result.every(p => p._semanticScoringSucceeded === false));
    const summary = buildQualityRetrievalSummary(keys, result);
    assert.equal(summary.scoringMethod, 'keyword');
    assert.equal(summary.semanticScoringFallbackReason, 'embeddings-partial-failure');
    assert.ok(summary.candidatesScored > result.length);
  });
}

test('bypass keeps context defaults and pattern priority without claiming measured relevance', async () => {
  let calls = 0;
  const result = await retrievePassagesWithQuality(keys, { userQuery: 'hope', questionContext: 'grief', maxPassages: 5, env: { DISABLE_QUALITY_FILTERING: 'true', AI: { run() { calls++; } } } });
  assert.equal(result[0].patternId, 'death-temperance-star');
  assert.equal(result[0].context, 'grief');
  assert.equal(buildQualityRetrievalSummary(keys, result).scoringMethod, 'bypassed');
  assert.equal(calls, 0);
});

function bulkGraphKeys() {
  return {
    completeTriadIds: Object.keys(canon.TRIAD_PASSAGES),
    foolsJourneyStageKey: 'integration', totalMajors: 1, singleMajorNumber: 0,
    dyadPairs: Object.values(canon.DYAD_PASSAGES).map(entry => ({ cards: entry.cards, significance: 'high' })),
    suitProgressions: Object.entries(canon.SUIT_PROGRESSION_PASSAGES).flatMap(([suit, entries]) => Object.keys(entries).map(stage => ({ suit, stage, significance: 'strong-progression' }))),
    courtLineages: Object.entries(canon.COURT_LINEAGE_PASSAGES).flatMap(([suit, entries]) => Object.keys(entries).map(significance => ({ suit, significance }))),
    thothSuits: Object.keys(canon.THOTH_SUIT_PASSAGES), marseilleRanks: Object.keys(canon.MARSEILLE_NUMEROLOGY_PASSAGES)
  };
}

test('uncached complete candidate work fits two 100-text batches and cache hits reduce the next run', async (t) => {
  clearEmbeddingCache(); t.after(clearEmbeddingCache);
  const graphKeys = bulkGraphKeys();
  const batches = [];
  const env = { AI: { run: async (_model, { text }) => { batches.push(text.length); return { data: text.map(() => [1, 0]) }; } } };
  const options = { env, userQuery: '春の仕事と変化について', maxPassages: 5 };
  const first = await retrievePassagesWithQuality(graphKeys, options);
  const firstStats = buildQualityRetrievalSummary(graphKeys, first);
  assert.ok(firstStats.candidatesScored > 100);
  assert.ok(firstStats.candidatesScored <= 145);
  assert.equal(batches.length, 2);
  assert.ok(batches.every(size => size <= 100));
  assert.equal(batches.reduce((sum, size) => sum + size, 0), firstStats.candidatesScored + 1, 'One query vector is shared across both batches');
  assert.equal(firstStats.embeddingCacheHits, 0);
  const next = await retrievePassagesWithQuality(graphKeys, options);
  const nextStats = buildQualityRetrievalSummary(graphKeys, next);
  assert.ok(nextStats.embeddingCacheHits > 0);
  assert.ok(nextStats.embeddingBatchCount < firstStats.embeddingBatchCount);
  assert.ok(nextStats.embeddingInputCharacters > 0);
  assert.doesNotMatch(JSON.stringify(nextStats), /春の仕事|A clean ending|embedding":/);
});

test('wrong-sized cached vectors do not prevent semantic recovery', async (t) => {
  clearEmbeddingCache(); t.after(clearEmbeddingCache);
  let broken = true;
  const env = { AI: { run: async (_model, { text }) => ({ data: text.map(input => broken && input.startsWith('This is literal healing') ? [1, 0, 0] : [1, 0]) }) } };
  const options = { env, userQuery: 'healing hope', maxPassages: 5 };
  const first = await retrievePassagesWithQuality(keys, options);
  assert.ok(first.every(p => !p._semanticScoringSucceeded));
  broken = false;
  const recovered = await retrievePassagesWithQuality(keys, options);
  assert.ok(recovered.every(p => p._semanticScoringSucceeded));
});

test('no query skips embeddings, keeps context defaults, and reports priority ranking', async () => {
  let calls = 0;
  const result = await retrievePassagesWithQuality(keys, { questionContext: 'grief', maxPassages: 5, enableSemanticScoring: true, env: { AI: { run() { calls++; } } } });
  assert.equal(calls, 0);
  assert.equal(result[0].type, 'triad');
  assert.equal(result[0].context, 'grief');
  assert.equal(result[0]._semanticScoringAttempted, false);
  assert.equal(buildQualityRetrievalSummary(keys, result).scoringMethod, 'priority');
});

test('ranking embeds projected cross-deck prose rather than RWS display quotations', async (t) => {
  clearEmbeddingCache(); t.after(clearEmbeddingCache);
  const inputs = [];
  const result = await retrievePassagesWithQuality(keys, { userQuery: 'renewal', deckStyle: 'thoth-a1', env: { AI: { run: async (_model, { text }) => { inputs.push(...text); return { data: text.map(() => [1, 0]) }; } } } });
  assert.ok(result.length);
  assert.ok(inputs.length > 2);
  assert.ok(inputs.every(text => !/white horse|pitchers by the pool/.test(text)));
  assert.ok(result.some(p => p.text.includes('white horse')), 'Authored display quotes remain available');
});

test('a majority of wrong-sized candidate vectors cannot poison recovery of the valid query', async (t) => {
  clearEmbeddingCache(); t.after(clearEmbeddingCache);
  let broken = true;
  const query = 'repair after changes';
  const env = { AI: { run: async (_model, { text }) => ({ data: text.map(input => broken && input !== query ? [1, 0, 0] : [1, 0]) }) } };
  const options = { env, userQuery: query, maxPassages: 5 };
  const graphKeys = { completeTriadIds: ['death-temperance-star'] };
  const first = await retrievePassagesWithQuality(graphKeys, options);
  assert.equal(buildQualityRetrievalSummary(graphKeys, first).scoringMethod, 'keyword');
  broken = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const recovered = await retrievePassagesWithQuality(graphKeys, options);
    assert.equal(buildQualityRetrievalSummary(graphKeys, recovered).scoringMethod, 'semantic');
  }
});


test('a mixed two-batch outage uses one keyword scale and recovers with cached good vectors', async (t) => {
  clearEmbeddingCache(); t.after(clearEmbeddingCache);
  let broken = true;
  const sizes = [];
  const env = { AI: { run: async (_model, { text }) => {
    sizes.push(text.length);
    if (broken && text.length < 100) throw new Error('Synthetic second-batch outage');
    return { data: text.map(() => [1, 0]) };
  } } };
  const graphKeys = bulkGraphKeys();
  const options = { env, userQuery: 'hope and integration', maxPassages: 5 };
  const first = await retrievePassagesWithQuality(graphKeys, options);
  const before = buildQualityRetrievalSummary(graphKeys, first);
  assert.equal(before.embeddingBatchCount, 2);
  assert.equal(before.scoringMethod, 'keyword');
  assert.equal(before.semanticScoringFallbackReason, 'embeddings-partial-failure');
  assert.ok(first.every(p => p._semanticScoringSucceeded === false));
  broken = false;
  const recovered = await retrievePassagesWithQuality(graphKeys, options);
  const after = buildQualityRetrievalSummary(graphKeys, recovered);
  assert.equal(after.scoringMethod, 'semantic');
  assert.ok(after.embeddingCacheHits > 0);
  assert.equal(after.embeddingBatchCount, 1);
});
