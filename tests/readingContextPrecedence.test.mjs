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
  const embeddedInputs = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(url, /embeddings/);
    embeddedInputs.push(JSON.parse(options.body).input);
    return Response.json({ data: [{ embedding: [1, 0] }] });
  });
  const contextSources = { userQuestion, focusAreas };
  const analysis = await performSpreadAnalysis({ key: 'threeCard', name: 'Three-Card Story' }, cardsInfo, {
    userQuestion, contextSources, contextInputText: buildContextInferenceInput(contextSources), enableSemanticScoring: true
  }, 'context-precedence-test', {
    GRAPHRAG_ENABLED: 'true', AZURE_OPENAI_ENDPOINT: 'https://embeddings.test', AZURE_OPENAI_API_KEY: 'test-only'
  });
  const query = embeddedInputs.find(value => typeof value === 'string' && value.includes('job interview'));
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
