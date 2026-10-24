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
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../src/data/minorArcana.js';
import { parseGraphRAGReferenceBlock } from '../functions/lib/narrative/prompts/graphRAGPromptIntegrity.js';

const corpus = JSON.parse(readFileSync(new URL('./fixtures/knowledge-graph-context-cases.json', import.meta.url)));
const remediationFixtures = JSON.parse(readFileSync(new URL('./fixtures/graph-rag-remediation-v1-cases.json', import.meta.url)));
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
  assert.equal(graph.referenceGuardrailsComplete, parseGraphRAGReferenceBlock(user).guardrailsComplete);
  assert.equal(graph.integrityRemovedBlocks, 0);
  assert.deepEqual(graph.integrityRemovalReasons, []);
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

test('remediation fixture preservation reaches each serialized provider request', async t => {
  const gate = await import('../scripts/evaluation/verifyNarrativePromptAssembly.js');
  assert.equal(typeof gate.withGraphRAGRemediationCase, 'function');
  assert.equal(typeof gate.verifyGraphRAGRemediationPrompt, 'function');
  for (const row of remediationFixtures.cases) {
    for (const target of ['claude', 'openai', 'modal']) {
      await t.test(`${row.id} ${target}`, async subtest => {
        for (const method of ['log', 'warn']) subtest.mock.method(console, method, () => {});
        await gate.withGraphRAGRemediationCase(row, async (payload, caseEnv) => {
          const providerEnv = { ...env, ...caseEnv };
          let user;
          let system;
          let result;
          if (target === 'claude') {
            result = await generateWithClaudeApi(providerEnv, payload, row.id, { send: async (_env, request) => {
              user = request.messages[0].content;
              system = request.system;
              return { text: 'A synthetic reading.', model: 'synthetic' };
            } });
          } else {
            subtest.mock.method(globalThis, 'fetch', async (_url, request) => {
              const body = JSON.parse(request.body);
              user = target === 'modal' ? body.messages.at(-1).content : body.input;
              system = target === 'modal' ? body.messages.find(message => message.role === 'system').content : body.instructions;
              return Response.json(target === 'modal'
                ? { choices: [{ message: { content: 'A synthetic reading.' }, finish_reason: 'stop' }], model: 'synthetic' }
                : { output_text: 'A synthetic reading.', model: 'synthetic' });
            });
            result = await (target === 'modal' ? generateWithModalQwen : generateWithOpenAIResponses)(providerEnv, payload, row.id);
          }
          assert.equal(result.promptMeta.readingPromptVersion, '1.6.0');
          gate.verifyGraphRAGRemediationPrompt(row, target, payload, {
            systemPrompt: system, userPrompt: user, promptMeta: result.promptMeta, memoryRetention: payload.memoryRetention
          });
          const graph = result.promptMeta.sourceUsage.graphRAG;
          // The reader still suppresses legacy partial arcs even when their
          // guarded reference was retained for generation.
          assert.equal(getTraditionalPassages(payload.analysis.themes, result.promptMeta).length,
            row.expected.visiblePassages ?? graph.passagesUsedInPrompt);
          assert.deepEqual(sanitizeSourceUsage(result.promptMeta.sourceUsage).graphRAG, graph);
        });
      });
    }
  }
});

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

test('accepted capped provider reports only its own references and memory receipts after a rejected full-reference attempt', async t => {
  const { onRequestPost } = await import('../functions/api/tarot-reading.js');
  const { createD1 } = await import('./helpers/d1Sqlite.mjs');
  const db = await createD1();
  await db.prepare("INSERT INTO users (id,email,username,password_hash,password_salt,created_at,updated_at,is_active,subscription_tier,subscription_status) VALUES ('pipeline-owner','pipeline@example.test','pipeline','synthetic','synthetic',1,1,1,'pro','active')").run();
  await db.prepare("INSERT INTO user_memories (id,user_id,text,category,scope,created_at) VALUES ('private-pipeline-note','pipeline-owner','Navigating career uncertainty','general','global',1)").run();
  for (const method of ['log', 'warn', 'error']) t.mock.method(console, method, () => {});
  const catalog = [...MAJOR_ARCANA, ...MINOR_ARCANA];
  const acceptedReading = catalog.map(card => `**${card.name}** invites career reflection.`).join(' ') + ' Your choices shape outcomes.';
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, request) => {
    const body = JSON.parse(request.body);
    if (String(url).startsWith('https://modal.test/')) {
      requests.push({ provider: 'modal', user: body.messages.at(-1).content });
      return Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'No card coverage.' } }] });
    }
    assert.ok(String(url).startsWith('https://openai.test/'), `Unexpected external transport: ${url}`);
    requests.push({ provider: 'openai', user: body.input });
    return Response.json({ id: 'accepted', model: 'test-openai', output_text: acceptedReading, usage: { input_tokens: 10, output_tokens: 10 } });
  });
  const pending = [];
  const receipts = [];
  const response = await onRequestPost({
    request: new Request('https://tableau.test/api/tarot-reading', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      spreadInfo: { name: 'Custom Spread', key: 'custom' },
      cardsInfo: catalog.map((card, index) => ({ card: card.name, ...(Number.isInteger(card.number) ? { number: card.number } : {}), position: `Focus ${index}`, orientation: 'Upright', meaning: card.upright, userReflection: 'Career exploration and workplace choices. '.repeat(47) })),
      userQuestion: 'How can I approach a career change?', reflectionsText: ''
    }) }),
    env: {
      DB: db, MODAL_ENDPOINT_URL: 'https://modal.test', MODAL_PROXY_TOKEN: 'synthetic', MODAL_MODEL: 'test', MODAL_STREAM: 'false',
      OPENAI_API_KEY: 'synthetic', OPENAI_BASE_URL: 'https://openai.test', OPENAI_MODEL: 'test-openai', OPENAI_STREAMING_ENABLED: 'false',
      GRAPHRAG_ENABLED: 'true', ENABLE_SEMANTIC_SCORING: 'false', EVAL_ENABLED: 'false', EVAL_GATE_ENABLED: 'false', READING_TASK_TIMEOUT_MS: '60000'
    },
    principal: { userId: 'pipeline-owner' }, waitUntil: promise => pending.push(promise), onReadingMemoryUsage: receipt => receipts.push(receipt)
  });
  const body = await response.json();
  await Promise.all(pending);
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.provider, 'openai-native');
  assert.deepEqual(requests.map(request => request.provider), ['modal', 'openai']);
  assert.equal(parseGraphRAGReferenceBlock(requests[0].user).status, 'complete');
  assert.deepEqual([...parseMemoryBlocks(requests[0].user).keys()], ['memory-0']);
  assert.equal(parseGraphRAGReferenceBlock(requests[1].user).status, 'absent');
  assert.deepEqual([...parseMemoryBlocks(requests[1].user).keys()], []);
  const graph = body.sourceUsage.graphRAG;
  assert.equal(graph.used, false);
  assert.equal(graph.mode, 'none');
  assert.equal(graph.passagesUsedInPrompt, 0);
  assert.equal(graph.retainedPassageCount, 0);
  assert.deepEqual(graph.passageIndices, []);
  assert.equal(graph.referenceGuardrailsComplete, false);
  assert.equal(graph.integrityRemovedBlocks, 0, 'Budget omission is not an integrity rejection');
  assert.equal(graph.skippedReason, 'removed_for_budget');
  assert.deepEqual(getTraditionalPassages(body.themes, { sourceUsage: body.sourceUsage }), []);
  assert.equal(body.sourceUsage.memories.memoriesSelected, 1);
  assert.equal(body.sourceUsage.memories.memoriesUsedInPrompt, 0);
  assert.equal(body.sourceUsage.memories.used, false);
  assert.deepEqual(receipts, []);
  assert.equal((await db.prepare("SELECT last_accessed_at FROM user_memories WHERE id = 'private-pipeline-note'").first()).last_accessed_at, null);
  assert.doesNotMatch(JSON.stringify(body.sourceUsage), /private-pipeline-note|memoryRetention|attemptId/);
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

test('final prompts filter focus without losing relevant interests or style settings', () => {
  for (const budgetTarget of ['claude', 'openai', 'modal']) {
    const built = buildEnhancedClaudePrompt({
      spreadInfo: { name: 'One-Card Insight' },
      cardsInfo: [{ card: 'The Sun', orientation: 'Upright', position: 'Theme', meaning: 'Warmth' }],
      userQuestion: 'I am not asking about quitting my job. How can I handle my boss at work?',
      personalization: { focusAreas: ['Love & relationships', 'Career & purpose'], readingTone: 'gentle', preferredSpreadDepth: 'short' },
      budgetTarget, promptBudgetEnv: { GRAPHRAG_ENABLED: 'true' }
    });
    assert.equal(built.promptMeta.context.normalized, 'career');
    assert.match(built.userPrompt, /Career & purpose/);
    assert.doesNotMatch(built.userPrompt, /Love & relationships/);
    assert.equal(built.promptMeta.sourceUsage.userContext.focusAreasUsed, true);
  }
});

for (const delivery of ['direct', 'job']) test(`scoped workplace ${delivery} keeps one context at embedding and actual provider boundaries`, async t => {
  const { onRequestPost } = await import('../functions/api/tarot-reading.js');
  const { startReadingJob } = await import('../functions/lib/readingJobs.js');
  const { clearEmbeddingCache } = await import('../functions/lib/embeddings.js');
  clearEmbeddingCache();
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  const embeddings = [];
  const messages = [];
  const routeEnv = { GRAPHRAG_ENABLED: 'true', ENABLE_SEMANTIC_SCORING: 'true',
    EVAL_ENABLED: 'false', EVAL_GATE_ENABLED: 'false', MODAL_ENDPOINT_URL: 'https://modal.invalid', MODAL_PROXY_TOKEN: 'synthetic', MODAL_STREAM: 'false',
    AI: { run: async (_model, { text }) => { embeddings.push(...text); return { data: text.map(() => [1, 0]) }; } } };
  t.mock.method(globalThis, 'fetch', async (_url, request) => {
    messages.push(JSON.parse(request.body).messages);
    return Response.json({ choices: [{ message: { content: 'The Sun invites you to consider a practical workplace boundary. Choose one small action that fits your circumstances. Your choices shape outcomes.' }, finish_reason: 'stop' }] });
  });
  const payload = { spreadInfo: { name: 'One-Card Insight' },
    cardsInfo: [{ card: 'The Sun', position: 'Theme', orientation: 'Upright', meaning: 'Warmth' }],
    userQuestion: 'I am not asking about quitting my job. How can I handle my boss at work?',
    personalization: { focusAreas: ['Love & relationships', 'Career & purpose'] } };
  let result;
  if (delivery === 'direct') {
    const response = await onRequestPost({ env: routeEnv, waitUntil: promise => promise.catch(() => {}), request: new Request('https://tableau.test/api/tarot-reading', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }) });
    assert.equal(response.status, 200);
    result = await response.json();
  } else {
    const jobs = createFakeReadingJobs({ env: routeEnv, runReading: onRequestPost });
    const started = await startReadingJob({ env: { ...routeEnv, READING_JOBS: jobs.namespace }, payload });
    assert.equal(started.ok, true);
    await jobs.settle();
    const job = jobs.instances.get(started.jobId).object.job;
    assert.equal(job.status, 'complete');
    result = job.meta;
    t.after(() => { for (const instance of jobs.instances.values()) instance.object.closeSubscribers(); });
  }
  assert.equal(messages.length, 1);
  const user = messages[0].at(-1).content;
  assert.ok(user.includes(payload.userQuestion));
  assert.match(user, /Career & purpose/);
  assert.doesNotMatch(user, /Love & relationships/);
  assert.match(messages[0][0].content, /career|work|professional/i);
  assert.ok(embeddings.some(text => text.includes('handle my boss at work')));
  assert.ok(embeddings.every(text => !/Love & relationships|Career & purpose/.test(text)));
  assert.equal(result.sourceUsage.userContext.focusAreasUsed, true);
});
