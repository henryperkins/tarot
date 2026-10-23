import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js';
import { buildOpenAIResponsesPrompts, composeReadingEnhanced } from '../functions/lib/narrativeBackends.js';
import { performSpreadAnalysis } from '../functions/lib/spreadAnalysisOrchestrator.js';
import { resolveReadingCards } from '../functions/lib/readingCardResolution.js';
import { getTraditionalPassages, deriveNarrativeVisibility } from '../src/hooks/narrativeReadingModelUtils.js';
import { readingMetadataFromEntry } from '../src/lib/readingMetadata.js';
import { sanitizeSourceUsage } from '../shared/readingSourceUsage.js';
import { onRequestPost } from '../functions/api/tarot-reading.js';

const env = { GRAPHRAG_ENABLED: 'true' };
const card = { card: 'The Sun', number: 19, orientation: 'Upright', position: 'Theme', meaning: 'Warmth and renewal.' };

function quiet(t) {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
}

test('budget ranking retains the exact passages rather than the first retrieved entries', t => {
  quiet(t);
  const passages = [0.1, 0.9, 0.3, 0.8].map((relevanceScore, index) => ({
    type: 'major-arcana', patternId: String(index), sourceDeck: 'rws-1909', source: 'Tableu Tarot Canon',
    id: `reference-${index}`, title: `Reference ${index}`, relevanceScore,
    text: `Reference ${index} explores practice and reflection. `.repeat(280)
  }));
  const graphRAGPayload = { passages, maxPassages: 4 };
  const themes = { knowledgeGraph: { graphRAGPayload } };
  const built = buildEnhancedClaudePrompt({
    spreadInfo: { key: 'single', name: 'One-Card Insight' }, cardsInfo: [card], themes,
    graphRAGPayload, budgetTarget: 'openai', promptBudgetEnv: env
  });
  assert.ok(built.promptMeta.slimmingSteps.some(step => step.includes('trim-graphrag-passages')));
  assert.match(built.userPrompt, /Reference 1 explores/);
  assert.match(built.userPrompt, /Reference 3 explores/);
  assert.doesNotMatch(built.userPrompt, /Reference [02] explores/);
  const metadata = readingMetadataFromEntry({ sourceUsage: built.promptMeta.sourceUsage });
  assert.deepEqual(getTraditionalPassages(themes, metadata).map(passage => passage.id), ['reference-1', 'reference-3']);
  assert.deepEqual(metadata.sourceUsage.graphRAG.passageIndices, [1, 3]);
  assert.equal(graphRAGPayload.passages.length, 4, 'provider fallback keeps every retrieved candidate');
});

for (const noteLength of [500, 1000]) {
  test(`OpenAI passage display follows the final prompt with ${noteLength}-character Japanese notes`, async t => {
    quiet(t);
    const cardsInfo = resolveReadingCards(['The Moon', 'The Star', 'Death', 'Temperance', 'The Tower', 'Wheel of Fortune', 'The Hermit', 'Judgement', 'The World', 'The Sun'].map((name, index) => ({
      card: name, position: `Position ${index + 1}`, orientation: index % 3 ? 'Upright' : 'Reversed',
      userReflection: 'このカードを見ると、長い通勤と子どもたちとの夜を思い出します。'.repeat(100).slice(0, noteLength)
    })), 'rws-1909');
    const spreadInfo = { key: 'celtic', name: 'Celtic Cross (Classic 10-Card)' };
    const analysis = await performSpreadAnalysis(spreadInfo, cardsInfo, { subscriptionTier: 'pro', deckStyle: 'rws-1909' }, 'retention-test', env);
    const payload = { spreadInfo, cardsInfo, analysis, subscriptionTier: 'pro', personalization: { readingTone: 'gentle', spiritualFrame: 'mixed', preferredSpreadDepth: 'deep', displayName: 'Ana', focusAreas: ['career', 'family'], tarotExperience: 'newbie' } };
    const built = buildOpenAIResponsesPrompts(env, payload, 'retention-test');
    const metadata = readingMetadataFromEntry({ provider: 'openai-native', sourceUsage: built.promptMeta.sourceUsage });
    const passages = getTraditionalPassages(analysis.themes, metadata);
    if (noteLength === 1000) {
      assert.equal(built.promptMeta.sourceUsage.graphRAG.used, false);
      assert.deepEqual(passages, []);
    } else {
      assert.equal(built.promptMeta.sourceUsage.graphRAG.used, true);
      assert.ok(passages.length > 0);
      for (const passage of passages) assert.ok(built.userPrompt.includes(passage.text));
    }
  });
}

test('known omissions and ambiguous legacy trimming do not create a traditional passage panel', () => {
  const themes = { knowledgeGraph: { graphRAGPayload: { passages: [
    { text: 'First candidate.' }, { text: 'Second candidate.' }
  ] } } };
  for (const readingMeta of [
    { sourceUsage: { graphRAG: { used: false, mode: 'none', passageIndices: [] } } },
    { sourceUsage: { graphRAG: { used: true, mode: 'summary', passagesUsedInPrompt: 0 } } },
    { sourceUsage: { graphRAG: { used: true, mode: 'full', passagesUsedInPrompt: 1 } } },
    { provider: 'safe-fallback' }
  ]) {
    const state = deriveNarrativeVisibility({ themes, readingMeta, visibleCount: 2, revealedCardsSize: 2 });
    assert.deepEqual(state.traditionalPassages, []);
    assert.equal(state.hasTraditionalInsights, false);
    assert.equal(state.shouldShowSpreadInsights, false);
  }
  assert.equal(getTraditionalPassages(themes).length, 2, 'legacy entries without retention metadata keep their existing display');
});

test('retained passage indices survive bounded journal normalization without arbitrary text', () => {
  const clean = sanitizeSourceUsage({ graphRAG: { used: true, mode: 'full', passageIndices: [1, 3, 3, -1, 0.5, 'private', 1000000] } });
  assert.deepEqual(clean.graphRAG.passageIndices, [1, 3]);
  assert.doesNotMatch(JSON.stringify(clean), /private/);
});

test('local fallback replaces the previous provider passage selection', async t => {
  quiet(t);
  const cardsInfo = [card];
  const spreadInfo = { key: 'single', name: 'One-Card Insight' };
  const analysis = await performSpreadAnalysis(spreadInfo, cardsInfo, {}, 'fallback-test', env);
  const payload = { spreadInfo, cardsInfo, analysis, userQuestion: 'What supports me today?' };
  const built = buildOpenAIResponsesPrompts(env, payload, 'fallback-test');
  assert.equal(built.promptMeta.sourceUsage.graphRAG.used, true);
  const local = await composeReadingEnhanced(payload);
  assert.deepEqual(getTraditionalPassages(analysis.themes, { provider: 'local-composer', sourceUsage: local.promptMeta.sourceUsage }), []);
});

for (const streaming of [false, true]) {
  test(`retained passage selection reaches the browser over ${streaming ? 'SSE' : 'JSON'}`, async t => {
    quiet(t);
    t.mock.method(globalThis, 'fetch', async () => Response.json({ status: 'completed', output_text: 'The Sun invites warmth and reflection. Consider what supports you today.' }));
    const response = await onRequestPost({
      request: new Request(`https://tableau.test/api/tarot-reading${streaming ? '?stream=true' : ''}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ spreadInfo: { key: 'single', name: 'One-Card Insight' }, cardsInfo: [card] }) }),
      env: { ...env, OPENAI_API_KEY: 'test', OPENAI_BASE_URL: 'https://provider.test', OPENAI_MODEL: 'gpt-5', OPENAI_STREAMING_ENABLED: 'false', EVAL_ENABLED: 'false' },
      waitUntil: promise => promise.catch(() => {})
    });
    assert.equal(response.status, 200);
    const body = streaming ? JSON.parse((await response.text()).match(/event: meta\ndata: (.+)/)[1]) : await response.json();
    assert.equal(body.sourceUsage.graphRAG.used, true);
    assert.ok(body.sourceUsage.graphRAG.passageIndices.length > 0);
    assert.equal(getTraditionalPassages(body.themes, { sourceUsage: body.sourceUsage }).length, body.sourceUsage.graphRAG.passagesUsedInPrompt);
  });
}
