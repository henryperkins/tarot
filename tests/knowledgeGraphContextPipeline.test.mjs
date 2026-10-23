import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { prepareNarrativeSamplePayload } from '../scripts/evaluation/runNarrativeSamples.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts.js';
import { generateWithClaudeApi, generateWithOpenAIResponses, generateWithModalQwen, composeReadingEnhanced } from '../functions/lib/narrativeBackends.js';
import { sanitizeSourceUsage } from '../shared/readingSourceUsage.js';
import { buildPromptTelemetry, buildGraphRAGTelemetry } from '../functions/lib/telemetrySchema.js';
import { formatUsageSummary } from '../src/components/reading/complete/sourceUsageSummary.js';
import { collectGraphRAGAlerts } from '../functions/lib/graphRAGAlerts.js';
import { getTraditionalPassages } from '../src/hooks/narrativeReadingModelUtils.js';
import { createFakeReadingJobs } from './helpers/fakeReadingJobs.mjs';
import { connectMcpClient } from './helpers/mcpClient.mjs';
import { parseMemoryBlocks } from '../functions/lib/userMemory.js';
import { sanitizeContextSelection } from '../shared/readingSourceUsage.js';

const corpus = JSON.parse(readFileSync(new URL('./fixtures/knowledge-graph-context-cases.json', import.meta.url)));
const env = { GRAPHRAG_ENABLED: 'true', OPENAI_API_KEY: 'synthetic', MODAL_PROXY_TOKEN: 'synthetic', MODAL_ENDPOINT_URL: 'https://modal.invalid', MODAL_STREAM: 'false' };
const regressionCases = [0, 42, 43, 46, 45, 44, 30];
async function fixture(index = 0) {
  const sample = corpus.cases[regressionCases[index]];
  return prepareNarrativeSamplePayload({ ...sample, memories: sample.memories.length ? sample.memories : [{ id: 'private-memory-id', category: 'communication', text: 'Prefers concise practical advice' }] }, { env });
}
function verifyFinal(payload, result, user, system) {
  assert.equal(typeof system, 'string');
  assert.ok(system.length > 100, 'Capture the actual provider system/instructions boundary');
  assert.deepEqual(result.promptMeta.contextSelection, sanitizeContextSelection(payload.contextSelection));
  assert.deepEqual(result.promptMeta.queryCoverage, payload.analysis.graphRAGPayload?.retrievalSummary?.queryCoverage || result.promptMeta.queryCoverage);
  const blocks = parseMemoryBlocks(user);
  for (const slot of payload.memoryRetention.retainedSlots) {
    const index = Number(slot.slice('memory-'.length));
    assert.equal(payload.memoryRetention.slotToId[slot], payload.memories[index].id);
    assert.equal(blocks.get(slot).text, payload.memories[index].text);
  }
  const selected = payload.memories.length;
  assert.equal(result.promptMeta.sourceUsage.memories.candidatesProvided, payload.memorySelection.candidateCount);
  assert.equal(result.promptMeta.sourceUsage.memories.memoriesSelected, selected);
  assert.equal(result.promptMeta.sourceUsage.memories.memoriesUsedInPrompt, selected);
  assert.equal(payload.memoryRetention.retainedSlots.length, selected);
  for (const slot of payload.memoryRetention.retainedSlots) assert.ok(user.includes(`<reading_memory slot="${slot}">`));
  if (payload.userQuestion) assert.ok(result.promptMeta.queryCoverage.some(source => source.id === 'question'));
  assert.equal(result.promptMeta.context.normalized, payload.context);
  assert.equal(JSON.stringify(result.promptMeta).includes('private-memory-id'), false);
  const graph = result.promptMeta.sourceUsage.graphRAG;
  assert.equal(graph.passagesUsedInPrompt, graph.passageIndices.length);
  for (const index of graph.passageIndices) {
    const passage = payload.analysis.graphRAGPayload.passages[index];
    assert.ok(passage.candidateId);
    assert.ok(user.includes(passage.promptText));
  }
  if (graph.passagesUsedInPrompt) {
    assert.match(user, /<reference>/);
    assert.match(user, /<\/reference>/);
    assert.match(user, /internally authored Tableu Tarot Canon/);
    assert.doesNotMatch(user, /respected tarot literature/);
  }
}

// F1-F7 exercise the complete backend assembly, including request serialization.
for (let index = 0; index < 7; index++) {
  for (const provider of ['claude', 'openai', 'modal']) {
    test(`F${index + 1} ${provider} final request carries matching provenance`, async t => {
      const payload = await fixture(index);
      if (index === 0) assert.equal(payload.memories.length, 1, 'The shared-boundary fixture must exercise real selected memory identity');
      let user;
      let system;
      let result;
      if (provider === 'claude') {
        result = await generateWithClaudeApi(env, payload, 'pipeline', { send: async (_env, request) => {
          user = request.messages[0].content;
          system = request.system;
          return { text: 'A synthetic reading.', model: 'synthetic' };
        } });
      } else {
        t.mock.method(globalThis, 'fetch', async (_url, request) => {
          const body = JSON.parse(request.body);
          user = provider === 'modal' ? body.messages.at(-1).content : body.input;
          system = provider === 'modal' ? body.messages.find(message => message.role === 'system').content : body.instructions;
          return Response.json(provider === 'modal'
            ? { choices: [{ message: { content: 'A synthetic reading.' }, finish_reason: 'stop' }], model: 'synthetic' }
            : { output: [{ type: 'message', content: [{ type: 'output_text', text: 'A synthetic reading.' }] }], model: 'synthetic' });
        });
        result = await (provider === 'modal' ? generateWithModalQwen : generateWithOpenAIResponses)(env, payload, 'pipeline');
      }
      verifyFinal(payload, result, user, system);
    });
  }
}

test('bounded source usage drops text and private IDs, clamps independent memory counts', () => {
  const usage = sanitizeSourceUsage({ memories: { requested: true, used: true, candidatesProvided: 200, memoriesSelected: 50, memoriesUsedInPrompt: 50, ids: ['secret'], text: 'private' }, graphRAG: { used: false, skippedReason: 'unverified_reference_provenance' } });
  assert.deepEqual(usage.memories, { used: true, requested: true, candidatesProvided: 100, memoriesSelected: 3, memoriesUsedInPrompt: 3 });
  assert.equal(usage.graphRAG.skippedReason, 'unverified_reference_provenance');
  assert.ok(formatUsageSummary(usage).rows.some(row => row.label === 'Saved memories'));
});

test('telemetry keeps bounded query coverage and candidate counts while dropping arbitrary source metadata', () => {
  const coverage = [{ id: 'pathA', originalLength: 200, includedLength: 20, truncated: true, text: 'Secret Name' }, { id: 'Secret Name', originalLength: 2 }];
  const prompt = buildPromptTelemetry({ queryCoverage: coverage, sourceUsage: { memories: { used: true, candidatesProvided: 1, text: 'Secret Name' }, secret: { used: true } } });
  assert.deepEqual(prompt.queryCoverage, [{ id: 'pathA', originalLength: 200, includedLength: 20, truncated: true }]);
  assert.equal(JSON.stringify(prompt).includes('Secret Name'), false);
  const graph = buildGraphRAGTelemetry({ candidatesDiscovered: 12, candidatesProjected: 11, candidatesScored: 11, finalSelectedCount: 2, scoringMethod: 'keyword', queryCoverage: coverage });
  assert.equal(graph.candidatesDiscovered, 12);
  assert.equal(graph.candidatesScored, 11);
  assert.equal(graph.scoringMethod, 'keyword');
  assert.equal(JSON.stringify(graph).includes('Secret Name'), false);
});

test('local fallback discards the failed attempt provenance and reports unrendered memories', async () => {
  const payload = await fixture();
  payload.promptMeta = { backend: 'failed-provider', ephemeris: { available: true }, graphRAG: { includedInPrompt: true } };
  const result = await composeReadingEnhanced(payload, env);
  assert.equal(result.promptMeta.backend, 'local-composer');
  assert.equal(result.promptMeta.ephemeris, undefined);
  assert.equal(result.promptMeta.sourceUsage.memories.used, false);
  assert.equal(result.promptMeta.sourceUsage.memories.memoriesUsedInPrompt, 0);
  assert.deepEqual(payload.memoryRetention.retainedSlots, []);
  assert.ok(result.promptMeta.queryCoverage.some(source => source.id === 'question'));
});

test('the client never treats the unconditioned preview as retained server references', () => {
  const themes = { knowledgeGraph: { retrievedPassages: [{ text: 'preview only' }] } };
  assert.deepEqual(getTraditionalPassages(themes, { sourceUsage: { graphRAG: { used: true, passageIndices: [0], passagesUsedInPrompt: 1 } } }), []);
});

for (const [reason, pattern] of [['no_patterns_detected', /patterns/i], ['projection_rejected', /projection/i], ['retrieval_failed_or_empty', /empty|available/i], ['removed_for_budget', /budget/i]]) {
  test(`alerts distinguish ${reason}`, () => {
    const alerts = collectGraphRAGAlerts({ graphRAG: { includedInPrompt: false, passagesProvided: reason === 'removed_for_budget' ? 2 : 0, skippedReason: reason } });
    assert.ok(alerts.some(alert => pattern.test(alert)));
  });
}

test('summary-only legacy references report zero retained full passages', async () => {
  const payload = await fixture();
  const built = buildEnhancedClaudePrompt({ ...payload, themes: payload.analysis.themes, graphRAGPayload: { passages: [], formattedBlock: 'Opaque unverified text' }, promptBudgetEnv: env });
  assert.equal(built.promptMeta.sourceUsage.graphRAG.passagesUsedInPrompt, 0);
  assert.deepEqual(built.promptMeta.sourceUsage.graphRAG.passageIndices, []);
  assert.equal(built.userPrompt.includes('Opaque unverified text'), false);
});

// Verify the public JSON/SSE contract and the Durable Object's actual route.
// The same upstream transport stub captures the serialized prompt in every mode.
for (const provider of ['claude-api', 'openai-native', 'modal-qwen']) {
  for (const mode of ['json', 'stream', 'job', 'mcp']) {
    test(`${provider} ${mode} route publishes the references retained by its final request`, async t => {
      const { onRequestPost } = await import('../functions/api/tarot-reading.js');
      const { onRequestPost: startPublicJob } = await import('../functions/api/tarot-reading-job-start.js');
      const { onRequestGet: publicJobStatus } = await import('../functions/api/tarot-reading-job-status.js');
      const { onRequestGet: publicJobStream } = await import('../functions/api/tarot-reading-job-stream.js');
      const { claudeSseResponse } = await import('./helpers/claudeSse.mjs');
      const routeEnv = {
        GRAPHRAG_ENABLED: 'true', ENABLE_SEMANTIC_SCORING: 'false', EVAL_ENABLED: 'false', EVAL_GATE_ENABLED: 'false',
        ...(provider === 'claude-api' ? { ANTHROPIC_API_KEY: 'synthetic' }
          : provider === 'openai-native' ? { OPENAI_API_KEY: 'synthetic', OPENAI_STREAMING_ENABLED: 'true', ALLOW_STREAMING_WITH_EVAL_GATE: 'true' }
            : { MODAL_ENDPOINT_URL: 'https://modal.invalid', MODAL_PROXY_TOKEN: 'synthetic', MODAL_STREAM: 'false' })
      };
      t.mock.method(console, 'log', () => {});
      t.mock.method(console, 'warn', () => {});
      const requests = [];
      const text = 'The Sun invites career exploration. Reflect on the skills you enjoy using and choose one small action. Your choices shape outcomes.';
      t.mock.method(globalThis, 'fetch', async (_url, request) => {
        const body = JSON.parse(request.body);
        requests.push(body);
        if (provider === 'claude-api') return claudeSseResponse(text);
        if (provider === 'modal-qwen') return Response.json({ choices: [{ message: { content: text }, finish_reason: 'stop' }], model: 'synthetic' });
        if (body.stream) return new Response(`event: response.output_text.delta\ndata: ${JSON.stringify({ type: 'response.output_text.delta', delta: text })}\n\nevent: response.completed\ndata: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', model: 'synthetic', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] } })}\n\n`, { headers: { 'content-type': 'text/event-stream' } });
        return Response.json({ output_text: text, model: 'synthetic' });
      });
      const input = {
        spreadInfo: { name: 'One-Card Insight', key: 'single', deckStyle: 'thoth-a1' },
        cardsInfo: [{ card: 'The Sun', number: 19, position: 'Theme', orientation: 'Upright', meaning: 'Warmth.', userReflection: 'My career is changing.' }],
        userQuestion: 'How can I approach a career change?', reflectionsText: ''
      };
      const pending = [];
      let metadata;
      if (mode === 'job' || mode === 'mcp') {
        const jobs = createFakeReadingJobs({ env: routeEnv, runReading: onRequestPost });
        const jobsEnv = { ...routeEnv, READING_JOBS: jobs.namespace };
        let started;
        let connection;
        if (mode === 'job') {
          const response = await startPublicJob({ env: jobsEnv, request: new Request('https://tableau.test/api/tarot-reading/jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }) });
          assert.equal(response.status, 200);
          started = await response.json();
        } else {
          const { createD1 } = await import('./helpers/d1Sqlite.mjs');
          routeEnv.DB = await createD1();
          await routeEnv.DB.prepare("INSERT INTO users (id,email,username,password_hash,password_salt,created_at,updated_at,is_active,subscription_tier,subscription_status) VALUES ('pipeline-owner','pipeline@example.test','pipeline','synthetic','synthetic',1,1,1,'pro','active')").run();
          await routeEnv.DB.prepare("INSERT INTO user_memories (id,user_id,text,category,scope,created_at) VALUES ('private-pipeline-note','pipeline-owner','Prefers concise practical advice','communication','global',1)").run();
          connection = await connectMcpClient({ env: jobsEnv, user: { id: 'pipeline-owner', subscription_tier: 'pro' } });
          t.after(() => connection.close());
          const result = await connection.client.callTool({ name: 'start_tarot_reading', arguments: { ...input, spreadInfo: { name: input.spreadInfo.name, key: input.spreadInfo.key }, deckStyle: input.spreadInfo.deckStyle, useSavedMemories: true } });
          assert.notEqual(result.isError, true, JSON.stringify(result));
          started = result.structuredContent;
        }
        await jobs.settle();
        t.after(() => { for (const entry of jobs.instances.values()) entry.object.closeSubscribers(); });
        let status;
        if (mode === 'job') {
          const request = new Request('https://tableau.test/api/tarot-reading/jobs/status', { headers: { 'X-Job-Token': started.jobToken } });
          status = await (await publicJobStatus({ env: jobsEnv, params: { id: started.jobId }, request })).json();
          assert.equal(status.status, 'complete', status.error);
          const replay = await (await publicJobStream({ env: jobsEnv, params: { id: started.jobId }, request })).text();
          assert.match(replay, /event: done/);
          const replayMeta = JSON.parse(replay.split('\n\n').find(event => event.startsWith('event: meta')).split('\ndata: ')[1]);
          assert.deepEqual(replayMeta.sourceUsage, status.meta.sourceUsage);
        } else {
          const result = await connection.client.callTool({ name: 'get_tarot_reading_status', arguments: { jobId: started.jobId } });
          assert.equal(result.structuredContent.status, 'complete', JSON.stringify(result));
          assert.match(result.structuredContent.reading, /The Sun/);
          status = jobs.instances.get(started.jobId).object.job;
          assert.doesNotMatch(JSON.stringify(result), /private-pipeline-note|memoryRetention|attemptId/);
        }
        metadata = status.meta;
      } else {
        const response = await onRequestPost({ env: routeEnv, waitUntil: promise => pending.push(promise), request: new Request(`https://tableau.test/api/tarot-reading${mode === 'stream' ? '?stream=true' : ''}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }) });
        assert.equal(response.status, 200);
        if (mode === 'json') metadata = await response.json();
        else {
          const stream = await response.text();
          assert.match(stream, /event: done/);
          metadata = JSON.parse(stream.split('\n\n').find(event => event.startsWith('event: meta')).split('\ndata: ')[1]);
        }
      }
      await Promise.all(pending);
      assert.equal(metadata.provider, provider);
      assert.equal(requests.length, 1, 'No hidden fallback attempt should satisfy this case');
      const sent = requests[0];
      const user = provider === 'openai-native' ? sent.input : sent.messages.at(-1).content;
      const userText = typeof user === 'string' ? user : user.map(part => part.text || '').join('');
      assert.match(userText, /My career is changing/);
      assert.equal(metadata.sourceUsage.memories.used, mode === 'mcp');
      const system = provider === 'openai-native' ? sent.instructions : sent.system || sent.messages.find(message => message.role === 'system')?.content;
      assert.ok(typeof system === 'string' && system.length > 100);
      if (mode === 'mcp') assert.match(userText, /Prefers concise practical advice/);
      assert.doesNotMatch(JSON.stringify(sent), /private-pipeline-note/);
      const graph = metadata.sourceUsage.graphRAG;
      assert.ok(graph.passagesUsedInPrompt > 0);
      const selected = metadata.themes.knowledgeGraph.graphRAGPayload.passages;
      for (const index of graph.passageIndices) assert.ok(userText.includes(selected[index].archetypalText));
      assert.equal(metadata.graphRAG.referenceBlockClosed, true);
      assert.equal(metadata.graphRAG.queryCoverage.some(source => source.id === 'card-0'), true);
      assert.ok(metadata.graphRAG.candidatesDiscovered >= selected.length);
      assert.equal(metadata.sourceUsage.userContext.cardReflectionsUsed, true);
    });
  }
}

test('telemetry reason codes cannot carry source text', () => {
  const graph = buildGraphRAGTelemetry({ skippedReason: 'Alice private label', semanticScoringFallbackReason: 'Bob private memory', scoringMethod: 'private note', parseStatus: 'personal detail' });
  assert.doesNotMatch(JSON.stringify(graph), /Alice|Bob|personal detail|private note/);
});

test('bounded source usage preserves actual retrieval diagnostics and distinguishes final retention', () => {
  const stats = { used: true, registryPassageCount: 145, candidatesDiscovered: 122, candidatesProjected: 120, candidatesScored: 120, finalSelectedCount: 3, passagesUsedInPrompt: 1, retainedPassageCount: 1, embeddingCacheSizeBefore: 0, embeddingCacheSizeAfter: 100, embeddingCacheMaxSize: 100, embeddingPeakConcurrency: 2, retrievalMode: 'keyword', scoringMethod: 'keyword', semanticScoringFallbackReason: 'embeddings-cancelled', selectedDeck: 'thoth-a1', sourceDecks: ['rws-1909', 'private label'] };
  const usage = sanitizeSourceUsage({ graphRAG: stats }).graphRAG;
  for (const key of ['registryPassageCount', 'candidatesDiscovered', 'candidatesProjected', 'candidatesScored', 'finalSelectedCount', 'retainedPassageCount', 'embeddingCacheSizeBefore', 'embeddingCacheSizeAfter', 'embeddingCacheMaxSize', 'embeddingPeakConcurrency', 'retrievalMode', 'scoringMethod', 'semanticScoringFallbackReason', 'selectedDeck']) assert.equal(usage[key], stats[key], key);
  assert.deepEqual(usage.sourceDecks, ['rws-1909']);
  for (const semanticScoringFallbackReason of ['embeddings-cancelled', 'embeddings-registry-overflow']) {
    const telemetry = buildGraphRAGTelemetry({ ...stats, semanticScoringFallbackReason });
    assert.equal(telemetry.semanticScoring.fallbackReason, semanticScoringFallbackReason);
    assert.equal(telemetry.embeddingPeakConcurrency, 2);
  }
});

for (const deckStyle of ['rws-1909', 'thoth-a1', 'marseille-classic']) {
  test(`${deckStyle} derives direct highlights from drawn cards despite contradictory prefetched themes`, async () => {
    const payload = await fixture();
    payload.cardsInfo = [payload.cardsInfo[0]];
    const themes = { ...payload.analysis.themes, deckStyle: 'rws-1909', customMetadata: 'preserved', knowledgeGraph: { ...payload.analysis.themes.knowledgeGraph, narrativeHighlights: [{ type: 'complete-triad', text: 'UNTRUSTED-HIGHLIGHT Death, Temperance, and The Star form a complete arc. White horse and angel pouring.' }] } };
    const built = buildEnhancedClaudePrompt({ ...payload, spreadInfo: { key: 'single', name: 'One-Card Insight', deckStyle }, themes, deckStyle, promptBudgetEnv: env });
    assert.equal(built.promptMeta.deckStyle, deckStyle);
    assert.doesNotMatch(built.userPrompt, /UNTRUSTED-HIGHLIGHT/);
    const patterns = built.userPrompt.split('**Archetypal Patterns**')[1]?.split('\n\n')[0];
    assert.ok(patterns);
    assert.match(patterns, /Death/);
    assert.doesNotMatch(patterns, /Temperance|The Star|White horse|angel pouring/);
    assert.equal(built.promptMeta.sourceUsage.patterns.patternsProvided, 1);
    assert.equal(built.promptMeta.sourceUsage.patterns.patternsUsedInPrompt, 1);
    assert.equal(themes.customMetadata, 'preserved');
    assert.match(themes.knowledgeGraph.narrativeHighlights[0].text, /UNTRUSTED-HIGHLIGHT/, 'Do not mutate shared prefetched inputs');
  });
}
