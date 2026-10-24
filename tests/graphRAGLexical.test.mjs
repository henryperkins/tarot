import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeRetrievalTerms } from '../functions/lib/graphRAGLexical.js';
import { retrievalQueryTerms, scoreKeywordRelevance, resolveRetrievalMode } from '../functions/lib/graphRAGCandidates.js';
import { retrievePassages, retrievePassagesWithQuality } from '../functions/lib/graphRAG.js';
import { resolveContextSelection } from '../functions/lib/contextDetection.js';

test('short content words and recognized plurals/inflections score 1.0', () => {
  assert.equal(scoreKeywordRelevance('job', 'job'), 1);
  assert.equal(scoreKeywordRelevance('job', 'jobs'), 1);
  assert.equal(scoreKeywordRelevance('jobs', 'job'), 1);
  assert.equal(scoreKeywordRelevance('boundary', 'boundaries'), 1);
  assert.equal(scoreKeywordRelevance('boundaries', 'boundary'), 1);
  assert.equal(scoreKeywordRelevance('grief', 'grieving'), 1);
  assert.equal(scoreKeywordRelevance('grieving', 'grief'), 1);
  assert.equal(scoreKeywordRelevance('work', 'working'), 1);
  assert.equal(scoreKeywordRelevance('working', 'work'), 1);

  for (const shortWord of ['job', 'law', 'art', 'end', 'joy', 'new']) {
    assert.deepEqual(retrievalQueryTerms(shortWord), [shortWord]);
    assert.equal(scoreKeywordRelevance(`Focus on ${shortWord} today.`, shortWord), 1);
  }
});

test('NFKC, punctuation, mixed case, and repeated terms normalize deterministically', () => {
  assert.deepEqual(normalizeRetrievalTerms('ＪＯＢＳ, Boundaries; grieving—WORKING!'), ['job', 'boundary', 'grief', 'work']);
  assert.deepEqual(retrievalQueryTerms('question: ＪＯＢ job jobs reflections: working work'), ['job', 'work']);
  assert.equal(scoreKeywordRelevance('Calm grief and clear boundaries at work.', 'GRIEVING, boundaries, and working!'), 1);
});

test('substring and negation preservation controls prevent false matches and preserve raw reader text', () => {
  assert.equal(scoreKeywordRelevance('interests', 'rest'), 0);
  assert.equal(scoreKeywordRelevance('rest', 'interests'), 0);
  assert.equal(scoreKeywordRelevance('partner', 'art'), 0);
  assert.equal(scoreKeywordRelevance('art', 'partner'), 0);

  // "new" alone is a retrieval term, not a whole-topic transition classifier.
  const newOnly = resolveContextSelection({ userQuestion: 'What is new today?' }, 'single');
  assert.equal(newOnly.context, 'general');
  assert.equal(newOnly.graphRAGContext, 'general');
  assert.equal(newOnly.retrievalQuery, 'question: What is new today?');
  const newChapter = resolveContextSelection({ userQuestion: 'What does this new chapter invite?' }, 'single');
  assert.equal(newChapter.graphRAGContext, 'transition');

  // Raw query, negation, dates, and Unicode remain unchanged in context selection (lexical normalization never mutates user text).
  const rawQuestion = 'I do not want to quit my job on 2026-10-24 — 日本語!';
  const selection = resolveContextSelection({ userQuestion: rawQuestion }, 'single');
  assert.ok(selection.retrievalQuery.includes(rawQuestion));
  assert.ok(selection.retrievalContentText.includes(rawQuestion));
});

test('quality filtering bypass and single-pass lexical scoring reuse behave consistently', async () => {
  const keys = { completeTriadIds: ['death-temperance-star'] };
  const bypassedSync = retrievePassages(keys, {
    userQuery: 'How do I process grief and boundaries at work?',
    env: { DISABLE_QUALITY_FILTERING: 'true' }
  });
  assert.equal(bypassedSync.retrievalStats.scoringMethod, 'bypassed');
  assert.equal(bypassedSync.retrievalStats.candidatesScored, 0);
  assert.ok(bypassedSync.every(p => p.relevanceScore === undefined));

  const bypassedAsync = await retrievePassagesWithQuality(keys, {
    userQuery: 'How do I process grief and boundaries at work?',
    enableSemanticScoring: false,
    env: { DISABLE_QUALITY_FILTERING: 'true' }
  });
  assert.equal(bypassedAsync.retrievalStats.scoringMethod, 'bypassed');
  assert.equal(bypassedAsync.retrievalStats.candidatesScored, 0);
  assert.ok(bypassedAsync.every(p => p.relevanceScore === undefined));
});

test('empty or stop-word-only queries enter priority mode and unknown synonyms with exact context stay on weak floor', async () => {
  for (const emptyOrStopQuery of ['', '   ', 'What does the card about this reading?', 'how can I do it now?', 'question: reflections:']) {
    assert.deepEqual(retrievalQueryTerms(emptyOrStopQuery), []);
    assert.equal(resolveRetrievalMode({ keywordQuery: emptyOrStopQuery }), 'priority');
  }

  const keys = { completeTriadIds: ['death-temperance-star'] };
  const prioritySync = retrievePassages(keys, { userQuery: 'What is this card reading about?' });
  assert.equal(prioritySync.retrievalStats.scoringMethod, 'priority');
  assert.ok(prioritySync.every(p => p.relevanceScore === undefined));

  // Unknown synonym with exact questionContext does not manufacture a passing lexical score.
  const unknownSynonymSync = retrievePassages(keys, {
    userQuery: 'bereft',
    keywordQuery: 'bereft',
    questionContext: 'grief',
    maxPassages: 1
  });
  const unknownSynonymAsync = await retrievePassagesWithQuality(keys, {
    userQuery: 'bereft',
    keywordQuery: 'bereft',
    questionContext: 'grief',
    maxPassages: 1,
    enableSemanticScoring: false
  });
  assert.equal(unknownSynonymSync.length, 1);
  assert.equal(unknownSynonymSync[0].belowRelevanceThreshold, true);
  assert.equal(unknownSynonymSync[0].relevanceScore, 0);
  assert.equal(unknownSynonymSync[0].relevance, unknownSynonymSync[0].relevanceScore);
  assert.equal(unknownSynonymAsync.length, 1);
  assert.equal(unknownSynonymAsync[0].belowRelevanceThreshold, true);
  assert.equal(unknownSynonymAsync[0].relevanceScore, 0);
  assert.equal(unknownSynonymAsync[0].relevance, unknownSynonymAsync[0].relevanceScore);
});
