import assert from 'node:assert/strict';
import { test } from 'node:test';
import { retrievePassagesWithQuality } from '../functions/lib/graphRAG.js';
import { clearEmbeddingCache } from '../functions/lib/embeddings.js';
import { selectPassageCandidates } from '../functions/lib/graphRAGCandidates.js';
import { resolveContextSelection } from '../functions/lib/contextDetection.js';
import { TRIAD_PASSAGES } from '../functions/lib/knowledgeBase.js';

const variant = (context, relevanceScore, contextMatch) => ({
  candidateId: `variant-${context}`, patternKey: 'pattern-a', patternId: 'pattern-a', context, promptText: `${context} text`,
  relevanceScore, _contextMatch: contextMatch, priority: 1
});

test('an unrelated question uses the general variant even when a specific variant scores higher', () => {
  const result = selectPassageCandidates([variant('grief', 0.42, 0), variant('general', 0.4, 1)]);
  assert.deepEqual(result.map(row => row.context), ['general']);
  assert.equal(result.retrievalStats.contextVariantsGated, 1);
});

test('a matching question context keeps its specific variant', () => {
  const result = selectPassageCandidates([variant('grief', 0.42, 2), variant('general', 0.4, 1)]);
  assert.deepEqual(result.map(row => row.context), ['grief']);
  assert.equal(result.retrievalStats.contextVariantsGated, 0);
});

test('a pattern without a general variant keeps its specific variants', () => {
  assert.deepEqual(selectPassageCandidates([variant('grief', 0.42, 0)]).map(row => row.context), ['grief']);
});

test('an unrelated question cannot inherit the grief framing of a semantically closer variant', async t => {
  clearEmbeddingCache(); t.after(clearEmbeddingCache);
  const grief = TRIAD_PASSAGES['death-temperance-star'].passages.find(passage => passage.context === 'grief');
  const query = 'question: What might a maroon ribbon remind me to consider?';
  const env = { AI: { run: async (_model, { text }) => ({ data: text.map(input => input === query || input === grief.text ? [1, 0] : [0.8, 0.6]) }) } };
  const result = await retrievePassagesWithQuality({ completeTriadIds: ['death-temperance-star'] },
    { userQuery: query, questionContext: 'general', maxPassages: 3, env, enableSemanticScoring: true });
  assert.equal(result.retrievalStats.semanticScoringUsed, true);
  assert.deepEqual(result.map(row => row.context || 'general'), ['general']);
  assert.ok(result.retrievalStats.contextVariantsGated >= 1);
});

test('a grief question still receives the grief variant through semantic scoring', async t => {
  clearEmbeddingCache(); t.after(clearEmbeddingCache);
  const grief = TRIAD_PASSAGES['death-temperance-star'].passages.find(passage => passage.context === 'grief');
  const query = 'question: How can I carry my grief this month?';
  const env = { AI: { run: async (_model, { text }) => ({ data: text.map(input => input === query || input === grief.text ? [1, 0] : [0.8, 0.6]) }) } };
  const result = await retrievePassagesWithQuality({ completeTriadIds: ['death-temperance-star'] },
    { userQuery: query, questionContext: 'grief', maxPassages: 3, env, enableSemanticScoring: true });
  assert.deepEqual(result.map(row => row.context), ['grief']);
});

test('everyday words alone do not route retrieval to shadow-work passages', () => {
  for (const question of ['How might a quiet pattern invite a moment of attention?', 'How can I build a better exercise habit?',
    'I fear my presentation will not go well. What can help?', 'What should I avoid when choosing a new apartment?',
    'What can trigger more momentum in my week?']) {
    assert.notEqual(resolveContextSelection({ userQuestion: question }, 'general').graphRAGContext, 'shadow', question);
  }
});

test('explicit shadow-work signals still select shadow retrieval', () => {
  for (const question of ['How can I approach my shadow work this month?', 'Where does my shame come from?',
    'How can I reconnect with my inner child?', 'What keeps my avoidance going?']) {
    assert.equal(resolveContextSelection({ userQuestion: question }, 'general').graphRAGContext, 'shadow', question);
  }
});
