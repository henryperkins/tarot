import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js';
import { buildOpenAIResponsesPrompts, composeReadingEnhanced } from '../functions/lib/narrativeBackends.js';
import { performSpreadAnalysis } from '../functions/lib/spreadAnalysisOrchestrator.js';
import { resolveReadingCards } from '../functions/lib/readingCardResolution.js';
import { getTraditionalPassages, deriveNarrativeVisibility } from '../src/hooks/narrativeReadingModelUtils.js';
import * as modelUtils from '../src/hooks/narrativeReadingModelUtils.js';
import { buildGraphContext } from '../functions/lib/graphContext.js';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { collectPassageCandidates } from '../functions/lib/graphRAGCandidates.js';
import { readingMetadataFromEntry } from '../src/lib/readingMetadata.js';
import { sanitizeSourceUsage } from '../shared/readingSourceUsage.js';
import { onRequestPost } from '../functions/api/tarot-reading.js';

const env = { GRAPHRAG_ENABLED: 'true' };
const card = { card: 'The Sun', number: 19, orientation: 'Upright', position: 'Theme', meaning: 'Warmth and renewal.' };

test('disabled full references have parsed zero retention, independent of initial nominal counts', () => {
  const passages = collectPassageCandidates({ singleMajorNumber: 19, singleMajorName: 'The Sun', totalMajors: 1 });
  const built = buildEnhancedClaudePrompt({ spreadInfo: { key: 'single', name: 'One-Card Insight' }, cardsInfo: [card], themes: {}, graphRAGPayload: { passages, initialPassageCount: 77 }, promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' } });
  assert.equal(built.promptMeta.graphRAG.passagesUsedInPrompt, 0);
  assert.equal(built.promptMeta.graphRAG.parseStatus, 'absent');
  assert.equal(built.promptMeta.graphRAG.retainedPassageCount, 0);
  assert.deepEqual(built.promptMeta.sourceUsage.graphRAG.passageIndices, []);
});

test('final display needs verified selected indices and uses projected text; legacy material is a preview', () => {
  const [record] = collectPassageCandidates({ singleMajorNumber: 19, singleMajorName: 'The Sun', totalMajors: 1 }, { deckStyle: 'thoth-a1' });
  const themes = { knowledgeGraph: { graphRAGPayload: { passages: [record] }, retrievedPassages: [{ text: 'Earlier context-independent preview.' }] } };
  assert.deepEqual(getTraditionalPassages(themes), []);
  assert.deepEqual(modelUtils.getTraditionalPassagePreview(themes, null, 'thoth-a1'), [], 'Unverifiable legacy prose requires saved-card reconstruction.');
  assert.deepEqual(getTraditionalPassages(themes, { sourceUsage: { graphRAG: { used: true, mode: 'full', passagesUsedInPrompt: 1 } } }), []);
  const meta = { sourceUsage: { graphRAG: { used: true, mode: 'full', passagesUsedInPrompt: 1, passageIndices: [0] } } };
  assert.equal(getTraditionalPassages(themes, meta)[0].text, record.promptText);
  assert.deepEqual(modelUtils.getTraditionalPassagePreview(themes, meta), []);
  assert.deepEqual(getTraditionalPassages(themes, { sourceUsage: { graphRAG: { ...meta.sourceUsage.graphRAG, passagesUsedInPrompt: 2 } } }), []);
});

function quiet(t) {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
}

function rankedReferenceFixture() {
  const passages = [0, 13, 17, 19].map((number, index) => ({
    ...collectPassageCandidates({ singleMajorNumber: number, totalMajors: 1 })[0],
    relevanceScore: [0.1, 0.9, 0.3, 0.8][index]
  }));
  const graphRAGPayload = { passages, maxPassages: 4 };
  const cardsInfo = resolveReadingCards([0, 13, 17, 19, 1, 2, 3, 4, 5, 6].map((number, index) => ({ card: MAJOR_ARCANA[number].name, number, position: `Position ${index + 1}`, orientation: 'Upright' })));
  const themes = { knowledgeGraph: { ...buildGraphContext(cardsInfo), graphRAGPayload } };
  return { passages, graphRAGPayload, themes, cardsInfo, subscriptionTier: 'pro', spreadInfo: { key: 'celtic', name: 'Celtic Cross (Classic 10-Card)' }, budgetTarget: 'openai' };

}

test('budget ranking retains the exact passages rather than the first retrieved entries', t => {
  quiet(t);
  const fixture = rankedReferenceFixture();
  const { passages, graphRAGPayload, themes } = fixture;
  const built = buildEnhancedClaudePrompt({
    ...fixture, promptBudgetEnv: { ...env, ENABLE_PROMPT_SLIMMING: 'true', PROMPT_BUDGET_OPENAI: '6200' }
  });
  assert.ok(built.promptMeta.slimmingSteps.some(step => step.includes('trim-graphrag-passages')));
  for (const index of [1, 3]) assert.ok(built.userPrompt.includes(passages[index].promptText));
  for (const index of [0, 2]) assert.ok(!built.userPrompt.includes(passages[index].promptText));
  const metadata = readingMetadataFromEntry({ sourceUsage: built.promptMeta.sourceUsage });
  assert.deepEqual(getTraditionalPassages(themes, metadata).map(passage => passage.candidateId), [passages[1].candidateId, passages[3].candidateId]);
  assert.deepEqual(metadata.sourceUsage.graphRAG.passageIndices, [1, 3]);
  assert.equal(graphRAGPayload.passages.length, 4, 'provider fallback keeps every retrieved candidate');
});

test('summary retention is zero full passages and intermediate ranking is not final inclusion', t => {
  quiet(t);
  const fixture = rankedReferenceFixture();
  const built = buildEnhancedClaudePrompt({ ...fixture, promptBudgetEnv: { ...env, ENABLE_PROMPT_SLIMMING: 'true', PROMPT_BUDGET_OPENAI: '6000' } });
  const graph = built.promptMeta.graphRAG;
  assert.equal(graph.injectionMode, 'summary');
  assert.equal(graph.passagesUsedInPrompt, 0);
  assert.equal(graph.retainedPassageCount, 0);
  assert.equal(graph.budgetTrimmedTo, 2);
  assert.equal(graph.intermediateBudgetPassageCount, 2);
  assert.deepEqual(built.promptMeta.sourceUsage.graphRAG.passageIndices, []);
  assert.doesNotMatch(built.userPrompt, /<reference>/);
});

test('verified normalization preserves invalid-first original index and counts duplicate rendered records honestly', t => {
  quiet(t);
  const [valid] = collectPassageCandidates({ singleMajorNumber: 19, totalMajors: 1 });
  const base = { spreadInfo: { key: 'single', name: 'One-Card Insight' }, cardsInfo: [card], themes: {}, promptBudgetEnv: env };
  const mixed = buildEnhancedClaudePrompt({ ...base, graphRAGPayload: { passages: [{ type: 'major-arcana', patternId: '19', text: 'Unverified text.' }, valid] } });
  assert.deepEqual(mixed.promptMeta.sourceUsage.graphRAG.passageIndices, [1]);
  assert.equal(mixed.promptMeta.graphRAG.passagesUsedInPrompt, 1);
  assert.doesNotMatch(mixed.userPrompt, /Unverified text/);
  const duplicate = buildEnhancedClaudePrompt({ ...base, graphRAGPayload: { passages: [valid, valid], maxPassages: 2 } });
  assert.deepEqual(duplicate.promptMeta.sourceUsage.graphRAG.passageIndices, [0, 1]);
  assert.equal(duplicate.promptMeta.graphRAG.passagesUsedInPrompt, 2);
  assert.equal(duplicate.userPrompt.split(valid.promptText).length - 1, 2);
});

test('opaque legacy material cannot turn its nominal count into final passage precision', t => {
  quiet(t);
  const built = buildEnhancedClaudePrompt({ spreadInfo: { key: 'single', name: 'One-Card Insight' }, cardsInfo: [card], themes: {}, graphRAGPayload: { formattedBlock: 'PRIVATE OPAQUE LEGACY TEXT', initialPassageCount: 99 }, promptBudgetEnv: env });
  assert.equal(built.promptMeta.graphRAG.passagesProvided, 0);
  assert.equal(built.promptMeta.graphRAG.passagesUsedInPrompt, 0);
  assert.equal(built.promptMeta.graphRAG.parseStatus, 'absent');
  assert.equal(built.promptMeta.sourceUsage.graphRAG.skippedReason, 'unverified_reference_provenance');
  assert.equal(built.promptMeta.sourceUsage.graphRAG.finalSelectedCount, undefined);
  assert.doesNotMatch(built.userPrompt, /PRIVATE OPAQUE LEGACY TEXT/);
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
  assert.equal(getTraditionalPassages(themes).length, 0, 'legacy counts do not prove final inclusion');
  assert.deepEqual(modelUtils.getTraditionalPassagePreview(themes, null, 'rws-1909'), [], 'Legacy prose without identity is omitted; narrative display is independent.');
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
