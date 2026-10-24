import assert from 'node:assert/strict';
import { test } from 'node:test';
import { retrievePassages, retrievePassagesWithQuality, buildQualityRetrievalSummary } from '../functions/lib/graphRAG.js';
import { clearEmbeddingCache, getEmbeddingCacheStats } from '../functions/lib/embeddings.js';
import * as canon from '../functions/lib/knowledgeBase.js';
const { TRIAD_PASSAGES } = canon;
import { scorePassageRelevance, getPassageCountForSpread, MAX_SEMANTIC_REGISTRY_PASSAGES } from '../functions/lib/graphRAG.js';
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

// A specific variant needs a matching question context; graphRAGContextVariants.test.mjs covers the unmatched case.
test('semantic relevance can select a matching non-default variant and only one variant survives', async (t) => {
  clearEmbeddingCache(); t.after(clearEmbeddingCache);
  const grief = TRIAD_PASSAGES['death-temperance-star'].passages.find(p => p.context === 'grief');
  const env = { AI: { run: async (_model, { text }) => ({ data: text.map(input => input === 'Question sans keywords' || input === grief.text ? [1, 0] : [0, 1]) }) } };
  const result = await retrievePassagesWithQuality({ completeTriadIds: ['death-temperance-star'] }, { userQuery: 'Question sans keywords', questionContext: 'grief', maxPassages: 5, env });
  assert.equal(result.length, 1);
  assert.equal(result[0].context, 'grief');
});

test('all variants enumerate with unique stable candidate identities', () => {
  assert.equal(typeof candidatesModule.collectPassageCandidates, 'function');
  const result = candidatesModule.collectPassageCandidates(keys, { deckStyle: 'thoth-a1' });
  assert.equal(new Set(result.map(p => p.candidateId)).size, result.length);
  assert.equal(result.filter(p => p.type === 'triad').length, 4);
  assert.ok(result.every(p => p.crossDeckReference && !p.promptVisualAnchors.length));
  for (const candidate of result) assert.deepEqual(JSON.parse(candidate.candidateId), [candidate.type, candidate.patternId, candidate.context || 'general', candidate.isPartialPattern ? candidate.matchedCards : null, candidate.sourceId]);
});

// Pure selection records exercise ranking without weakening registry projection.
const candidate = (id, text, score = 0.8, variant = 'general') => ({ candidateId: `${id}:${variant}`, patternKey: id, patternId: id, promptText: text, relevanceScore: score, priority: 3 });
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
  const majorNumbers = Object.keys(canon.MAJOR_ARCANA_PASSAGES).map(Number).sort((a, b) => a - b);
  return {
    completeTriadIds: Object.keys(canon.TRIAD_PASSAGES),
    foolsJourneyStageKey: 'integration', totalMajors: majorNumbers.length, majorNumbers,
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
  assert.ok(firstStats.candidatesScored <= canon.listKnowledgeBasePassages().length);
  assert.equal(first.filter(p => p.type === 'major-arcana').length >= 0, true);
  assert.equal(candidatesModule.collectPassageCandidates(graphKeys).filter(p => p.type === 'major-arcana').length, Object.values(canon.MAJOR_ARCANA_PASSAGES).reduce((sum, entry) => sum + entry.passages.length, 0));
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
  const env = { AI: { run: async (_model, { text }) => ({ data: text.map(input => broken && input.startsWith('If grief is part') ? [1, 0, 0] : [1, 0]) }) } };
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


test('distinct meaningful Unicode terms share one scorer and labels add no relevance', async () => {
  for (const query of ['café hope mystery', 'café hope hope hope mystery', 'question: café hope mystery reflections:']) {
    assert.equal(await scorePassageRelevance('café hope', query), 2 / 3);
    assert.equal(candidatesModule.scoreKeywordRelevance('café hope', query), 2 / 3);
  }
  assert.deepEqual(candidatesModule.retrievalQueryTerms('ＣＡＦÉ café hope'), ['café', 'hope']);
});

test('global selection lets the next variant compete after its best text duplicates a winner', () => {
  const result = candidatesModule.selectPassageCandidates([
    candidate('first', 'shared text', 1),
    candidate('second', 'shared text', 0.9),
    candidate('second', 'distinct text', 0.8, 'career'),
    candidate('third', 'other text', 0.7)
  ], { maxPassages: 3 });
  assert.deepEqual(result.map(row => row.candidateId), ['first:general', 'second:career', 'third:general']);
});

test('Fool Magician World scores every safe candidate at cap one', async (t) => {
  clearEmbeddingCache(); t.after(clearEmbeddingCache);
  const graphKeys = { completeTriadIds: ['fool-magician-world'], foolsJourneyStageKey: 'initiation', dyadPairs: [{ cards: [0, 1], significance: 'high' }, { cards: [0, 21], significance: 'high' }], triadIds: ['fool-magician-world', 'magician-chariot-world'], partialTriads: [{ id: 'magician-chariot-world', matchedCards: [1, 21], missingCards: [7] }] };
  const candidates = candidatesModule.collectPassageCandidates(graphKeys);
  const winner = candidates.find(row => row.patternId === '0-1');
  const embedded = [];
  const result = await retrievePassagesWithQuality(graphKeys, { userQuery: 'quorbit', maxPassages: 1, env: { AI: { run: async (_model, { text }) => { embedded.push(...text); return { data: text.map(value => value === 'quorbit' || value === winner.promptText ? [1, 0] : [0, 1]) }; } } } });
  assert.equal(result[0].patternId, '0-1');
  assert.ok(candidates.every(row => embedded.includes(row.promptText)));
  assert.equal(result.retrievalStats.candidatesScored, candidates.length);
});

test('semantic scorer includes safe content beyond character 500', async (t) => {
  clearEmbeddingCache(); t.after(clearEmbeddingCache);
  const text = 'neutral '.repeat(80) + 'career';
  const score = await scorePassageRelevance(text, 'career', { enableSemanticScoring: true, env: { AI: { run: async (_model, { text: inputs }) => ({ data: inputs.map(input => input.includes('career') ? [1, 0] : [0, 1]) }) } } });
  assert.equal(score, 1);
});

test('mode precedence resolves once before dispatch', () => {
  const awaitMode = candidatesModule.resolveRetrievalMode || (() => 'missing');
  assert.equal((awaitMode)({ graphEnabled: false, qualityFilteringDisabled: true, semanticRequested: true, keywordQuery: 'hope' }), 'disabled');
  assert.equal((awaitMode)({ qualityFilteringDisabled: true, semanticRequested: true, keywordQuery: 'hope' }), 'bypassed');
  assert.equal((awaitMode)({ semanticRequested: true, keywordQuery: 'hope' }), 'semantic');
  assert.equal((awaitMode)({ semanticRequested: false, keywordQuery: 'hope' }), 'keyword');
  assert.equal((awaitMode)({ semanticRequested: false, keywordQuery: '' }), 'priority');
});

test('bypass without semantic mode skips lexical scores and no-query priority has no confidence', () => {
  const bypass = retrievePassages(keys, { userQuery: 'hope hope hope', env: { DISABLE_QUALITY_FILTERING: true } });
  assert.ok(bypass.every(row => row.relevance === undefined && row.relevanceScore === undefined));
  assert.equal(bypass.retrievalStats.semanticScoringAttempted, false);
  assert.equal(bypass.retrievalStats.semanticScoringFallbackReason, 'quality-filtering-disabled');
  const priority = retrievePassages(keys);
  assert.ok(priority.every(row => row.relevanceScore === undefined));
  assert.equal(priority.retrievalStats.candidatesScored, 0);
});

for (const [spread, paid] of Object.entries({ single: 1, threeCard: 2, fiveCard: 3, celtic: 5, decision: 3, relationship: 2, general: 3 })) {
  for (const tier of ['free', 'plus', 'pro']) test(`${spread} ${tier} cap is final only`, () => {
    const cap = tier === 'free' ? Math.max(1, Math.floor(paid / 2)) : paid;
    assert.equal(getPassageCountForSpread(spread, tier), cap);
    const result = retrievePassages(keys, { userQuery: 'hope', maxPassages: cap });
    assert.ok(result.length <= cap);
    assert.equal(result.retrievalStats.candidatesProjected, candidatesModule.collectPassageCandidates(keys).length);
  });
}


test('ordinary question is a content term while keywordQuery excludes semantic labels', async () => {
  assert.deepEqual(candidatesModule.retrievalQueryTerms('a question about hope'), ['question', 'hope']);
  assert.equal(await scorePassageRelevance('question', 'question: zebra', { keywordQuery: 'zebra' }), 0);
});

test('compiled registry stays within the reviewed semantic runtime budget', () => {
  assert.ok(canon.listKnowledgeBasePassages().length <= MAX_SEMANTIC_REGISTRY_PASSAGES, 'Registry growth requires explicit runtime budget review');
});

test('registry overflow falls back across all candidates without embedding a first-N subset', async (t) => {
  const entry = TRIAD_PASSAGES['death-temperance-star'];
  const originalLength = entry.passages.length;
  t.after(() => { entry.passages.length = originalLength; });
  for (let index = 0; index < MAX_SEMANTIC_REGISTRY_PASSAGES; index++) entry.passages.push({ ...entry.passages[0], sourceId: `growth-${index}`, text: `Unique safe registry meaning ${index}.`, archetypalText: `Unique safe registry meaning ${index}.` });
  let calls = 0;
  const result = await retrievePassagesWithQuality({ completeTriadIds: ['death-temperance-star'] }, { userQuery: 'meaning', env: { AI: { run() { calls++; } } } });
  assert.equal(calls, 0);
  assert.equal(result.retrievalStats.semanticScoringFallbackReason, 'embeddings-registry-overflow');
  assert.equal(result.retrievalStats.candidatesProjected, originalLength + MAX_SEMANTIC_REGISTRY_PASSAGES);
  assert.equal(result.retrievalStats.candidatesScored, originalLength + MAX_SEMANTIC_REGISTRY_PASSAGES);
  assert.equal(result.retrievalStats.scoringMethod, 'keyword');
});

test('all invalid query and candidate vectors use a coherent keyword scale', async (t) => {
  clearEmbeddingCache(); t.after(clearEmbeddingCache);
  const result = await retrievePassagesWithQuality(keys, { userQuery: 'hope mystery', env: { AI: { run: async (_model, { text }) => ({ data: text.map(() => [0, 0]) }) } } });
  assert.ok(result.every(row => !row._semanticScoringSucceeded));
  assert.equal(result.retrievalStats.scoringMethod, 'keyword');
  assert.equal(result.retrievalStats.semanticScoringFallbackReason, 'embeddings-partial-failure');
});


test('empty scorer input never fabricates a neutral confidence', async () => {
  assert.equal(await scorePassageRelevance('meaning', ''), 0);
  assert.equal(await scorePassageRelevance('', 'hope'), 0);
});

for (const limit of [null, '1']) test(`noninteger explicit limit ${JSON.stringify(limit)} avoids embeddings`, async () => {
  let calls = 0;
  const env = { AI: { run() { calls++; } } };
  assert.deepEqual(retrievePassages(keys, { maxPassages: limit }), []);
  assert.deepEqual(await retrievePassagesWithQuality(keys, { maxPassages: limit, userQuery: 'hope', env }), []);
  assert.equal(calls, 0);
});


test('bypass selection ignores preexisting relevance even within one structural priority', () => {
  const result = candidatesModule.selectPassageCandidates([
    { ...candidate('high-score', 'same text', 1), _contextMatch: 0 },
    { ...candidate('context-match', 'same text', 0), _contextMatch: 2 }
  ], { qualityFilteringDisabled: true, maxPassages: 2 });
  assert.deepEqual(result.map(row => row.patternId), ['context-match', 'high-score']);
});

test('relevance then context then structural priority then stable identity determine ties', () => {
  const records = [
    { ...candidate('z', 'z', 0.8), priority: 1, _contextMatch: 0 },
    { ...candidate('b', 'b', 0.8), priority: 6, _contextMatch: 2 },
    { ...candidate('a', 'a', 0.8), priority: 6, _contextMatch: 2 },
    { ...candidate('best', 'best', 0.9), priority: 6, _contextMatch: 0 }
  ];
  assert.deepEqual(candidatesModule.selectPassageCandidates(records).map(row => row.patternId), ['best', 'a', 'b', 'z']);
  assert.deepEqual(candidatesModule.selectPassageCandidates(records.map(row => ({ ...row }))).map(row => row.patternId), ['best', 'a', 'b', 'z']);
});

test('a late batch makes the entire eligible ranking keyword-only and cannot change its cache', { timeout: 1000 }, async t => {
  clearEmbeddingCache(); t.after(clearEmbeddingCache);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let started, finish, lateSize;
  const ready = new Promise(resolve => { started = resolve; });
  const pending = retrievePassagesWithQuality(bulkGraphKeys(), { userQuery: 'hope mystery', maxPassages: 5, env: { AI: { run: async (_model, { text }) => {
    if (text.length === 100) return { data: text.map(() => [1, 0]) };
    lateSize = text.length; started();
    return new Promise(resolve => { finish = resolve; });
  } } } });
  await ready;
  t.mock.timers.tick(3000);
  const result = await pending;
  assert.equal(result.retrievalStats.semanticScoringFallbackReason, 'embeddings-timeout');
  assert.equal(result.retrievalStats.scoringMethod, 'keyword');
  assert.ok(result.every(row => row._semanticScoringAttempted && !row._semanticScoringSucceeded && row.relevanceScore === candidatesModule.scoreKeywordRelevance(row.promptText, 'hope mystery')));
  const before = getEmbeddingCacheStats().size;
  finish({ data: Array.from({ length: lateSize }, () => [1, 0]) });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(getEmbeddingCacheStats().size, before);
});

test('multi-Major spreads enumerate every distinct valid Major at priority 7 while preserving single-Major priority 2 and legacy fallback', async (t) => {
  clearEmbeddingCache(); t.after(clearEmbeddingCache);
  const singleCandidates = candidatesModule.collectPassageCandidates({ totalMajors: 1, majorNumbers: [17], singleMajorNumber: 17, singleMajorName: 'The Star', foolsJourneyStageKey: 'integration' }, { includeMetadata: true });
  const singleStar = singleCandidates.filter(c => c.type === 'major-arcana');
  assert.ok(singleStar.length > 0);
  assert.ok(singleStar.every(c => c.priority === 2 && c.patternId === '17' && c.metadata?.cardNumber === 17));
  assert.ok(singleCandidates.filter(c => c.type === 'fools-journey').every(c => c.priority === 3));

  const legacySingle = candidatesModule.collectPassageCandidates({ totalMajors: 1, singleMajorNumber: 8, singleMajorName: 'Strength' }, { deckStyle: 'thoth-a1', includeMetadata: true });
  assert.ok(legacySingle.some(c => c.type === 'major-arcana' && c.patternId === '8' && c.priority === 2 && c.cardNames.includes('Lust')));

  const noJourneyPair = candidatesModule.collectPassageCandidates({ totalMajors: 2, majorNumbers: [8, 0, 8, -1, 22, '8', null, NaN, 1.5] }, { includeMetadata: true });
  const pairMajors = noJourneyPair.filter(c => c.type === 'major-arcana');
  assert.deepEqual([...new Set(pairMajors.map(c => c.patternId))], ['0', '8']);
  assert.ok(pairMajors.every(c => c.priority === 7));

  for (const invalidMajorNumbers of [[], null, '17', 17, {}, false]) {
    const empty = candidatesModule.collectPassageCandidates({ totalMajors: 1, singleMajorNumber: 17, majorNumbers: invalidMajorNumbers });
    assert.equal(empty.filter(c => c.type === 'major-arcana').length, 0);
  }

  const triadSpreadKeys = {
    totalMajors: 3,
    majorNumbers: [13, 14, 17],
    completeTriadIds: ['death-temperance-star'],
    triadIds: ['death-temperance-star'],
    foolsJourneyStageKey: 'integration',
    dyadPairs: [{ cards: [13, 17], significance: 'high' }, { cards: [13, 14], significance: 'medium' }]
  };
  const triadCandidates = candidatesModule.collectPassageCandidates(triadSpreadKeys);
  assert.deepEqual([...new Set(triadCandidates.filter(c => c.type === 'major-arcana').map(c => c.patternId))], ['13', '14', '17']);
  assert.ok(triadCandidates.filter(c => c.type === 'major-arcana').every(c => c.priority === 7));

  // Equal or weaker evidence keeps pre-existing pattern priority ahead of priority-7 individual Majors.
  const priorityOrdered = retrievePassages(triadSpreadKeys, { maxPassages: 3 });
  assert.deepEqual(priorityOrdered.map(c => c.type), ['triad', 'fools-journey', 'dyad']);

  // A strongly relevant individual Major in a multi-Major spread can still win on relevance.
  const starPassage = triadCandidates.find(c => c.type === 'major-arcana' && c.patternId === '17');
  const semanticWin = await retrievePassagesWithQuality(triadSpreadKeys, {
    maxPassages: 1,
    userQuery: 'aquarian starlight renewal',
    env: { AI: { run: async (_model, { text }) => ({ data: text.map(input => input === 'aquarian starlight renewal' || input === starPassage.promptText ? [1, 0] : [0, 1]) }) } }
  });
  assert.equal(semanticWin[0].type, 'major-arcana');
  assert.equal(semanticWin[0].patternId, '17');

  clearEmbeddingCache();
  const cosinePointFour = await retrievePassagesWithQuality({ completeTriadIds: ['death-temperance-star'] }, {
    maxPassages: 1,
    userQuery: 'quorbit',
    env: { AI: { run: async (_model, { text }) => ({ data: text.map(input => input === 'quorbit' ? [1, 0] : [0.4, Math.sqrt(1 - 0.16)]) }) } }
  });
  assert.equal(cosinePointFour.length, 1);
  assert.ok(Math.abs(cosinePointFour[0].relevanceScore - 0.4) < 1e-6);
  assert.notEqual(cosinePointFour[0].belowRelevanceThreshold, true);
});
