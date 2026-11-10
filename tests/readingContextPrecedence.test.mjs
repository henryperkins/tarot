import assert from 'node:assert/strict';
import { it } from 'node:test';
import { onRequestPost } from '../functions/api/tarot-reading.js';
import { performSpreadAnalysis } from '../functions/lib/spreadAnalysisOrchestrator.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrativeBuilder.js';
import { buildContextInferenceInput } from '../functions/lib/contextDetection.js';
import { clearEmbeddingCache } from '../functions/lib/embeddings.js';

const userQuestion = 'How can I prepare for my job interview?';
const focusAreas = ['Love & relationships'];
const cardsInfo = [
  { card: 'Death', number: 13, position: 'Past', orientation: 'Upright', meaning: 'Transformation.' },
  { card: 'Temperance', number: 14, position: 'Present', orientation: 'Upright', meaning: 'Integration.' },
  { card: 'The Star', number: 17, position: 'Future', orientation: 'Upright', meaning: 'Hope.' }
];

it('keeps a career question in the final provider context despite unrelated personal focus', async (t) => {
  let providerRequest;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    providerRequest = JSON.parse(options.body);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '### The Star\nThe Star invites reflection on your interview preparation. Your choices shape outcomes.' } }] });
  });
  const response = await onRequestPost({
    request: new Request('https://tableau.test/api/tarot-reading', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ spreadInfo: { key: 'single', name: 'One-Card Insight' }, cardsInfo: [cardsInfo[2]], userQuestion, personalization: { focusAreas } })
    }),
    env: { MODAL_ENDPOINT_URL: 'https://modal.test', MODAL_MODEL: 'test-qwen', MODAL_PROXY_TOKEN: 'test-only', GRAPHRAG_ENABLED: 'false', EVAL_ENABLED: 'false' },
    waitUntil: promise => promise.catch(() => {})
  });
  assert.equal(response.status, 200);
  const system = providerRequest.messages.find(message => message.role === 'system').content;
  assert.match(system, /CONTEXT LENS:.*career/);
  assert.doesNotMatch(system, /CONTEXT LENS:.*relationship/);
});

it('uses the selected current source for the real GraphRAG embedding query', async (t) => {
  clearEmbeddingCache();
  t.after(clearEmbeddingCache);
  const embeddedTexts = [];
  const run = async (_model, { text }) => {
    embeddedTexts.push(...text);
    return { data: text.map(() => [1, 0]) };
  };
  const contextSources = { userQuestion, focusAreas };
  const analysis = await performSpreadAnalysis({ key: 'threeCard', name: 'Three-Card Story' }, cardsInfo, {
    userQuestion, contextSources, contextInputText: buildContextInferenceInput(contextSources), enableSemanticScoring: true
  }, 'context-precedence-test', { GRAPHRAG_ENABLED: 'true', AI: { run } });
  const query = embeddedTexts.find(value => value.includes('job interview'));
  assert.ok(query, 'The actual retrieval query must be embedded');
  assert.doesNotMatch(query, /Love & relationships/);
  assert.equal(analysis.graphRAGPayload.retrievalSummary.contextSource, 'question');
  assert.equal(analysis.graphRAGPayload.retrievalSummary.questionContext, 'career');
});

it('uses the same context precedence in prompt-builder fallback retrieval', () => {
  const { promptMeta } = buildEnhancedClaudePrompt({
    spreadInfo: { key: 'threeCard', name: 'Three-Card Story' }, cardsInfo, userQuestion,
    contextInputText: buildContextInferenceInput({ userQuestion, focusAreas }),
    personalization: { focusAreas },
    themes: { knowledgeGraph: { graphKeys: { completeTriadIds: ['death-temperance-star'] } } },
    context: 'career', promptBudgetEnv: { GRAPHRAG_ENABLED: 'true' }
  });
  assert.equal(promptMeta.graphRAG.contextSource, 'question');
  assert.equal(promptMeta.graphRAG.questionContext, 'career');
});

for (const legacy of [false, true]) {
  it(`preserves reflection context in fallback retrieval with ${legacy ? 'legacy combined' : 'structured'} inputs`, async () => {
    const reflectionsText = 'My job interview is tomorrow.';
    const question = legacy ? 'Any guidance?' : undefined;
    const contextInputText = buildContextInferenceInput({ userQuestion: question, reflectionsText, focusAreas: legacy ? [] : focusAreas });
    const { promptMeta } = buildEnhancedClaudePrompt({
      spreadInfo: { key: 'threeCard', name: 'Three-Card Story' }, cardsInfo, userQuestion: question,
      contextInputText,
      ...(!legacy ? { reflectionsText, personalization: { focusAreas } } : {}),
      themes: { knowledgeGraph: { graphKeys: { completeTriadIds: ['death-temperance-star'] } } },
      context: 'career', promptBudgetEnv: { GRAPHRAG_ENABLED: 'true' }
    });
    assert.equal(promptMeta.graphRAG.questionContext, 'career');
    assert.equal(promptMeta.graphRAG.contextSource, 'reflections');
    const analysis = await performSpreadAnalysis({ key: 'threeCard', name: 'Three-Card Story' }, cardsInfo, {
      userQuestion: question, contextInputText,
      ...(!legacy ? { reflectionsText, focusAreas } : {})
    }, 'reflection-fallback-test', { GRAPHRAG_ENABLED: 'true' });
    assert.equal(analysis.graphRAGPayload.retrievalSummary.questionContext, 'career');
    assert.equal(analysis.graphRAGPayload.retrievalSummary.contextSource, 'reflections');
  });
}

it('preserves a supplied server selection through analysis, provider builds, rebuilds and local composition', async () => {
  const { resolveContextSelection } = await import('../functions/lib/contextDetection.js');
  const { buildOpenAIResponsesPrompts, composeReadingEnhanced } = await import('../functions/lib/narrativeBackends.js');
  const { sanitizeContextSelection, sanitizeQueryCoverage } = await import('../shared/readingSourceUsage.js');
  const selection = Object.freeze(resolveContextSelection({ userQuestion: 'Any guidance?', cardsInfo: [{ userReflection: 'My career and job interview are urgent.' }] }, 'single'));
  const suppliedCards = [cardsInfo[2]];
  const analysis = await performSpreadAnalysis({ key: 'single', name: 'One-Card Insight' }, suppliedCards, {
    contextSelection: selection, userQuestion: 'My relationship and marriage need love.', focusAreas: ['Romance']
  }, 'authoritative-selection', { GRAPHRAG_ENABLED: 'false' });
  assert.deepEqual(analysis.graphRAGPayload.retrievalSummary.contextSelection, sanitizeContextSelection(selection));
  for (const budgetTarget of ['claude', 'openai', 'modal']) {
    const payload = { spreadInfo: { key: 'single', name: 'One-Card Insight' }, cardsInfo: suppliedCards, analysis, userQuestion: 'My relationship and marriage need love.', context: 'love', contextSelection: selection };
    for (let rebuild = 0; rebuild < 2; rebuild += 1) {
      const result = buildOpenAIResponsesPrompts({ GRAPHRAG_ENABLED: 'false' }, payload, `selection-${budgetTarget}`, { budgetTarget });
      assert.match(result.systemPrompt, /CONTEXT LENS:.*career/);
      assert.deepEqual(result.promptMeta.contextSelection, sanitizeContextSelection(selection));
      assert.deepEqual(result.promptMeta.queryCoverage, sanitizeQueryCoverage(selection.queryCoverage));
      assert.equal(payload.contextSelection, selection);
    }
  }
  const localPayload = { spreadInfo: { key: 'single', name: 'One-Card Insight' }, cardsInfo: suppliedCards, analysis, userQuestion: 'Any guidance?', context: 'love', contextSelection: selection };
  await composeReadingEnhanced(localPayload, { GRAPHRAG_ENABLED: 'false' });
  assert.equal(localPayload.contextSelection, selection);
  assert.deepEqual(localPayload.promptMeta.contextSelection, sanitizeContextSelection(selection));
  assert.equal(localPayload.promptMeta.context.normalized, 'career');
});

it('uses content-only query projection for lexical ranking and safe selection metadata for telemetry', async () => {
  const { retrievePassages, retrievePassagesWithQuality } = await import('../functions/lib/graphRAG.js');
  const { buildPromptTelemetry, buildGraphRAGTelemetry } = await import('../functions/lib/telemetrySchema.js');
  const graphKeys = { completeTriadIds: ['fool-magician-world'], dyadKeys: ['2-5'] };
  const options = { maxPassages: 5, minRelevanceScore: 0, enableSemanticScoring: false };
  const plain = retrievePassages(graphKeys, { ...options, userQuery: 'Zebra.' });
  const labeled = retrievePassages(graphKeys, { ...options, userQuery: 'question: Zebra.', keywordQuery: 'Zebra.' });
  assert.deepEqual(labeled, plain);
  const qualityPlain = await retrievePassagesWithQuality(graphKeys, { ...options, userQuery: 'Zebra.' });
  const qualityLabeled = await retrievePassagesWithQuality(graphKeys, { ...options, userQuery: 'question: Zebra.', keywordQuery: 'Zebra.' });
  assert.deepEqual(qualityLabeled.map(entry => [entry.candidateId, entry.relevanceScore]), qualityPlain.map(entry => [entry.candidateId, entry.relevanceScore]));
  const noKeywords = await retrievePassagesWithQuality(graphKeys, { ...options, userQuery: 'question: Any guidance?', keywordQuery: '' });
  assert.equal(noKeywords.retrievalStats.scoringMethod, 'priority');
  const contextSelection = { version: 1, context: 'career', graphRAGContext: 'career', source: 'reflections', clarifiedBy: null, selectedSourceIds: ['card-77', 'private-note-secret'], retrievalQuery: 'private question and note', retrievalContentText: 'private keywords', text: 'private label' };
  const input = { contextSelection, queryCoverage: [{ id: 'card-77', classifiedLength: 2000, includedLength: 0, eligibleLength: 2000, classificationSupport: 'limited', reason: 'query_budget', text: 'private note' }] };
  for (const metadata of [buildPromptTelemetry(input), buildGraphRAGTelemetry(input)]) {
    assert.deepEqual(metadata.contextSelection.selectedSourceIds, ['card-77']);
    assert.equal(metadata.queryCoverage[0].classifiedLength, 2000);
    assert.equal(metadata.queryCoverage[0].classificationSupport, 'limited');
    assert.doesNotMatch(JSON.stringify(metadata), /private/);
  }
});

it('derives a missing internal provider selection once and preserves it on later rebuilds', async () => {
  const { buildOpenAIResponsesPrompts } = await import('../functions/lib/narrativeBackends.js');
  const analysis = await performSpreadAnalysis({ key: 'single', name: 'One-Card Insight' }, [cardsInfo[2]], {}, 'internal-once', { GRAPHRAG_ENABLED: 'false' });
  const payload = { spreadInfo: { key: 'single', name: 'One-Card Insight' }, cardsInfo: [cardsInfo[2]], userQuestion: 'My job interview is tomorrow.', analysis };
  buildOpenAIResponsesPrompts({ GRAPHRAG_ENABLED: 'false' }, payload, 'internal-first');
  const original = payload.contextSelection;
  assert.ok(original);
  payload.userQuestion = 'My partner and marriage need love.';
  const rebuilt = buildOpenAIResponsesPrompts({ GRAPHRAG_ENABLED: 'false' }, payload, 'internal-second');
  assert.equal(payload.contextSelection, original);
  assert.equal(rebuilt.promptMeta.context.normalized, 'career');
});

it('derives and caches effective legacy decision paths without reflections across internal entry points', async () => {
  const { buildOpenAIResponsesPrompts } = await import('../functions/lib/narrativeBackends.js');
  const positions = ['Heart of decision', 'Path A: accept the job offer', 'Path B: stay in my career', 'What clarifies', 'What to remember'];
  const decisionCards = ['The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor'].map((card, number) => ({ card, number, position: positions[number], orientation: 'Upright', meaning: 'Reflect on possibilities.' }));
  const spreadInfo = { key: 'decision', name: 'Decision / Two Paths' };
  const direct = buildEnhancedClaudePrompt({ spreadInfo, cardsInfo: decisionCards, userQuestion: 'Any guidance?', themes: {}, promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' } });
  const analysis = await performSpreadAnalysis(spreadInfo, decisionCards, { userQuestion: 'Any guidance?', contextInputText: 'reflections: My romance and wedding need attention.' }, 'legacy-path-parity', { GRAPHRAG_ENABLED: 'false' });
  assert.equal(direct.promptMeta.contextSelection.context, 'career');
  assert.equal(direct.promptMeta.contextSelection.source, 'decisionPaths');
  assert.deepEqual(direct.promptMeta.contextSelection.selectedSourceIds, ['pathA', 'pathB']);
  assert.deepEqual(analysis.graphRAGPayload.retrievalSummary.contextSelection, direct.promptMeta.contextSelection);
  const groupedAnalysis = await performSpreadAnalysis(spreadInfo, decisionCards, { contextSources: { userQuestion: 'Any guidance?' } }, 'legacy-grouped-path-parity', { GRAPHRAG_ENABLED: 'false' });
  assert.deepEqual(groupedAnalysis.graphRAGPayload.retrievalSummary.contextSelection, direct.promptMeta.contextSelection);
  for (const budgetTarget of ['claude', 'openai', 'modal']) {
    const payload = { spreadInfo, cardsInfo: decisionCards, userQuestion: 'Any guidance?', contextInputText: 'reflections: My romance and wedding need attention.', analysis };
    const first = buildOpenAIResponsesPrompts({ GRAPHRAG_ENABLED: 'false' }, payload, 'legacy-path-first', { budgetTarget });
    assert.deepEqual(first.promptMeta.contextSelection, direct.promptMeta.contextSelection);
    assert.match(payload.contextSelection.retrievalQuery, /pathA: accept the job offer/);
    assert.match(payload.contextSelection.retrievalQuery, /pathB: stay in my career/);
    const authoritative = payload.contextSelection;
    payload.cardsInfo = decisionCards.map((card, index) => ({ ...card, position: index === 1 ? 'Path A: plan a wedding' : card.position }));
    const rebuilt = buildOpenAIResponsesPrompts({ GRAPHRAG_ENABLED: 'false' }, payload, 'legacy-path-rebuilt', { budgetTarget });
    assert.equal(payload.contextSelection, authoritative);
    assert.deepEqual(rebuilt.promptMeta.contextSelection, direct.promptMeta.contextSelection);
  }
});

it('keeps combined-string compatibility when decision positions have no usable path evidence', async () => {
  const { buildOpenAIResponsesPrompts } = await import('../functions/lib/narrativeBackends.js');
  const spreadInfo = { key: 'decision', name: 'Decision / Two Paths' };
  const positions = ['Heart of decision', 'Path A: energy & likely outcome', 'Path B: energy & likely outcome', 'What clarifies', 'What to remember'];
  const decisionCards = ['The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor'].map((card, number) => ({ card, number, position: positions[number], orientation: 'Upright', meaning: 'Reflect on possibilities.' }));
  const contextInputText = 'reflections: My job and career need attention.';
  const analysis = await performSpreadAnalysis(spreadInfo, decisionCards, { userQuestion: 'Any guidance?', contextInputText }, 'legacy-combined-without-paths', { GRAPHRAG_ENABLED: 'false' });
  const payload = { spreadInfo, cardsInfo: decisionCards, userQuestion: 'Any guidance?', contextInputText, analysis };
  const provider = buildOpenAIResponsesPrompts({ GRAPHRAG_ENABLED: 'false' }, payload, 'legacy-combined-without-paths');
  for (const selection of [analysis.graphRAGPayload.retrievalSummary.contextSelection, provider.promptMeta.contextSelection]) {
    assert.equal(selection.context, 'career');
    assert.equal(selection.source, 'reflections');
  }
});
