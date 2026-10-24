import assert from 'node:assert/strict';
import { test } from 'node:test';
import { safeParseReadingRequest } from '../shared/contracts/readingSchema.js';
import { startReadingJob } from '../functions/lib/readingJobs.js';
import { resolveReadingCards } from '../functions/lib/readingCardResolution.js';
import { resolveDecisionPathContext } from '../functions/lib/decisionPathContext.js';
import { resolveReadingPersonalizationContext } from '../functions/lib/userPersonalization.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { connectMcpClient } from './helpers/mcpClient.mjs';
import { createFakeReadingJobs, readingRunner } from './helpers/fakeReadingJobs.mjs';

const card = { card: 'The Sun', position: 'Theme', orientation: 'Upright', meaning: 'defeat and betrayal' };
const spreadInfo = { name: 'Decision', key: 'decision' };
const cardsInfo = ['Theme', 'Path A: old job', 'Path B: new home'].map((position, index) => ({ ...card, card: ['The Sun', 'The Star', 'Temperance'][index], position }));

test('explicit_clear_does_not_restore_position', () => {
  const result = resolveDecisionPathContext({ spreadKey: 'decision', cardsInfo, decisionPaths: { a: '' } });
  assert.deepEqual(result.decisionPaths, { a: '', b: 'new home' });
  assert.equal(cardsInfo[1].position, 'Path A: old job');
});

test('client_meaning_cannot_replace_catalog_meaning', () => {
  const [resolved] = resolveReadingCards([{ ...card, callerMeaning: 'forged internal meaning' }]);
  assert.equal(resolved.meaning, MAJOR_ARCANA.find(item => item.name === 'The Sun').upright);
  assert.equal(resolved.callerMeaning, card.meaning);
  const prompt = buildEnhancedClaudePrompt({ spreadInfo: { name: 'One-Card Insight', key: 'single' }, cardsInfo: [resolved], themes: {}, context: 'general', promptBudgetEnv: { GRAPHRAG_ENABLED: 'false' } });
  assert.match(prompt.userPrompt, /untrusted.*interpretation/i);
  assert.match(prompt.userPrompt, /source="interpretation-0"/);
  assert.equal(prompt.promptMeta.sourceUsage.userContext.fields['interpretation-0'].includedLength, card.meaning.length);
  assert.equal(resolveReadingCards([{ ...card, meaning: resolved.meaning }])[0].callerMeaning, undefined);
});

test('memory reuse is boolean and false bypasses candidate reads', async () => {
  const payload = { spreadInfo, cardsInfo, useSavedMemories: false };
  assert.equal(safeParseReadingRequest(payload).data.useSavedMemories, false);
  for (const useSavedMemories of ['false', null, 0]) assert.equal(safeParseReadingRequest({ ...payload, useSavedMemories }).success, false);
  let reads = 0;
  const db = { prepare: () => ({ bind: () => ({ first: async () => null }) }) };
  const result = await resolveReadingPersonalizationContext(db, 'user', null, { useSavedMemories: false, loadMemories: async () => { reads++; return []; } });
  assert.equal(reads, 0);
  assert.deepEqual(result.memories, []);
});

test('decision_context_survives_public_job_and_mcp', async () => {
  const calls = [];
  const jobs = createFakeReadingJobs({ runReading: readingRunner({ calls }) });
  const env = { READING_JOBS: jobs.namespace };
  const payload = { spreadInfo, cardsInfo, decisionPaths: { a: '', b: 'Path B: new home' }, reflectionsText: 'A general note', useSavedMemories: false };
  const started = await startReadingJob({ env, payload });
  assert.equal(started.ok, true);
  await jobs.settle();
  const web = await calls[0].request.json();
  assert.deepEqual(web.decisionPaths, payload.decisionPaths);
  assert.equal(web.useSavedMemories, false);
  const connection = await connectMcpClient({ env, user: { id: 'user-1', subscription_tier: 'pro' } });
  try {
    const start = await connection.client.callTool({ name: 'start_tarot_reading', arguments: { ...payload, cardsInfo: cardsInfo.map(c => ({ ...c, userReflection: 'My card note' })) } });
    assert.notEqual(start.isError, true, JSON.stringify(start));
    await jobs.settle();
    const mcp = await calls[1].request.json();
    assert.deepEqual(mcp.decisionPaths, payload.decisionPaths);
    assert.equal(mcp.useSavedMemories, false);
    assert.equal(mcp.cardsInfo[0].userReflection, 'My card note');
    const job = jobs.instances.get(start.structuredContent.jobId);
    const snapshot = job.state.stored.get('job').job.snapshot;
    assert.equal(snapshot.useSavedMemories, false);
    assert.deepEqual(snapshot.decisionPaths, { a: '', b: 'new home' });
    assert.equal(snapshot.cardsInfo[0].callerMeaning, card.meaning);
  } finally { await connection.close(); }
});

test('caller interpretations never become classification or memory support sources', async () => {
  const { prepareReadingContextSources } = await import('../functions/lib/readingContextSources.js');
  const [resolved] = resolveReadingCards([{ ...card, meaning: 'My partner is 42 and I am seeking a career change.' }]);
  assert.deepEqual(prepareReadingContextSources({ cardsInfo: [resolved], spreadKey: 'single' }), []);
});

test('interpretation retention and request opt-out diagnostics survive public usage sanitization', async () => {
  const { sanitizeSourceUsage } = await import('../shared/readingSourceUsage.js');
  const cleaned = sanitizeSourceUsage({ memories: { requested: false, used: false, skippedReason: 'disabled_by_request' }, userContext: { used: true, fields: { 'interpretation-77': { originalLength: 40, includedLength: 20 }, 'interpretation-78': { originalLength: 10, includedLength: 10 } } } });
  assert.equal(cleaned.memories.skippedReason, 'disabled_by_request');
  assert.equal(cleaned.userContext.fields['interpretation-77'].includedLength, 20);
  assert.equal(cleaned.userContext.fields['interpretation-78'], undefined);
});

test('nondecision labels are ignored with not_applicable diagnostics', () => {
  const resolved = resolveDecisionPathContext({ spreadKey: 'single', cardsInfo, decisionPaths: { a: 'Career' } });
  assert.deepEqual(resolved.decisionPaths, {});
  assert.ok(resolved.diagnostics.includes('decisionPaths:not_applicable'));
});

test('MCP original meaning survives durable forwarding and real API catalog resolution', async t => {
  const { onRequestPost } = await import('../functions/api/tarot-reading.js');
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  const prompts = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    prompts.push(JSON.parse(init.body));
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'The Sun invites reflection. Your choices shape outcomes.' } }] });
  });
  const env = { MODAL_ENDPOINT_URL: 'https://modal.test', MODAL_PROXY_TOKEN: 'synthetic-test', MODAL_MODEL: 'test', GRAPHRAG_ENABLED: 'false', EVAL_ENABLED: 'false', EVAL_GATE_ENABLED: 'false' };
  const jobs = createFakeReadingJobs({ runReading: context => onRequestPost({ ...context, env, principal: null }) });
  const connection = await connectMcpClient({ env: { READING_JOBS: jobs.namespace }, user: { id: 'test-user' } });
  try {
    const result = await connection.client.callTool({ name: 'start_tarot_reading', arguments: { spreadInfo: { name: 'One-Card Insight', key: 'single' }, cardsInfo: [card], useSavedMemories: false } });
    assert.equal(result.isError, undefined, JSON.stringify(result));
    await jobs.settle();
    assert.equal(prompts.length, 1);
    const prompt = prompts[0].messages.map(message => message.content).join('\n');
    assert.match(prompt, /Positivity, fun, warmth, success, vitality/);
    assert.match(prompt, /source="interpretation-0">"defeat and betrayal"/);
    assert.match(prompt, /Caller interpretation \(untrusted personal interpretation/);
  } finally { await connection.close(); }
});

async function receiptDatabase() {
  const { createD1 } = await import('./helpers/d1Sqlite.mjs');
  const DB = await createD1();
  await DB.prepare("INSERT INTO users (id,email,username,password_hash,password_salt,created_at,updated_at,is_active,subscription_tier,subscription_status) VALUES ('receipt-owner','reader@example.test','reader','synthetic','synthetic',1,1,1,'pro','active')").run();
  await DB.prepare("INSERT INTO user_memories (id,user_id,text,category,scope,created_at) VALUES ('private-style','receipt-owner','Prefers concise practical advice','communication','global',1)").run();
  return DB;
}

test('accepted provider stages a private immutable receipt with request and unique attempt identity', async t => {
  const { onRequestPost } = await import('../functions/api/tarot-reading.js');
  const DB = await receiptDatabase();
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  t.mock.method(globalThis, 'fetch', async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'The Sun invites career exploration. Your choices shape outcomes.' } }] }));
  const receipts = [];
  const tasks = [];
  for (let index = 0; index < 2; index++) {
    const response = await onRequestPost({ env: { DB, MODAL_ENDPOINT_URL: 'https://modal.test', MODAL_PROXY_TOKEN: 'synthetic', GRAPHRAG_ENABLED: 'false', EVAL_ENABLED: 'false', EVAL_GATE_ENABLED: 'false' }, principal: { userId: 'receipt-owner' }, waitUntil: task => tasks.push(task), onReadingMemoryUsage: usage => receipts.push(usage), request: new Request('https://tableau.test/api/tarot-reading', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ spreadInfo: { key: 'single', name: 'One-Card Insight' }, cardsInfo: [card], userQuestion: 'How can I approach a career change?' }) }) });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(receipts.length, index + 1);
    const usage = receipts[index];
    assert.deepEqual(Object.keys(usage).sort(), ['attemptId', 'completedAt', 'ids', 'requestId', 'userId']);
    assert.deepEqual(usage.ids, ['private-style']);
    assert.equal(usage.requestId, body.requestId);
    assert.equal(typeof usage.attemptId, 'string');
    assert.notEqual(usage.attemptId, body.requestId);
    assert.ok(Object.isFrozen(usage) && Object.isFrozen(usage.ids));
    assert.doesNotMatch(JSON.stringify(body), /private-style|attemptId|memoryRetention|slotToId/);
  }
  assert.notEqual(receipts[0].attemptId, receipts[1].attemptId);
  await Promise.all(tasks);
});

test('real route cancellation reaches pending retrieval and rejects late embedding cache writes', async t => {
  const { onRequestPost } = await import('../functions/api/tarot-reading.js');
  const { clearEmbeddingCache, getEmbeddingCacheStats } = await import('../functions/lib/embeddings.js');
  clearEmbeddingCache();
  t.after(clearEmbeddingCache);
  for (const name of ['log', 'warn', 'error']) t.mock.method(console, name, () => {});
  let providers = 0;
  t.mock.method(globalThis, 'fetch', async () => { providers++; throw new Error('Provider must not run'); });
  const controller = new AbortController();
  let release;
  let didStart;
  const started = new Promise(resolve => { didStart = resolve; });
  const AI = { run: async (_model, input) => { didStart(); return new Promise(resolve => { release = () => resolve({ data: input.text.map(() => [1, 0]) }); }); } };
  const pending = onRequestPost({ env: { AI, ENABLE_SEMANTIC_SCORING: 'true', GRAPHRAG_ENABLED: 'true', EVAL_ENABLED: 'false', EVAL_GATE_ENABLED: 'false' }, request: new Request('https://tableau.test/api/tarot-reading', { signal: controller.signal, method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ spreadInfo: { key: 'single', name: 'One-Card Insight' }, cardsInfo: [card], userQuestion: 'How can I approach a career change?', useSavedMemories: false }) }) });
  await started;
  controller.abort(new DOMException('Cancelled reading', 'AbortError'));
  let timeout;
  const result = await Promise.race([pending.then(response => ({ response })), new Promise(resolve => { timeout = setTimeout(() => resolve({ timedOut: true }), 100); })]);
  clearTimeout(timeout);
  release();
  await pending;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(result.timedOut, undefined, 'Retrieval must observe reading cancellation before its own deadline');
  assert.equal(providers, 0);
  assert.equal(getEmbeddingCacheStats().size, 0, 'Late vectors from a cancelled reading cannot enter cache');
});

test('discarded Claude attempt and accepted Modal fallback have distinct private attempt identities', async t => {
  const { onRequestPost } = await import('../functions/api/tarot-reading.js');
  const DB = await receiptDatabase();
  for (const name of ['log', 'warn', 'error']) t.mock.method(console, name, () => {});
  const uuid = crypto.randomUUID.bind(crypto);
  const identities = [];
  t.mock.method(crypto, 'randomUUID', () => { const id = uuid(); identities.push(id); return id; });
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    const sent = JSON.parse(init.body);
    requests.push({ sent, attemptId: identities.at(-1) });
    if (requests.length === 1) return Response.json({ error: { type: 'invalid_request_error', message: 'Synthetic rejected attempt' } }, { status: 400 });
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'The Sun invites career exploration. Your choices shape outcomes.' } }] });
  });
  const receipts = [];
  const tasks = [];
  const response = await onRequestPost({ env: { DB, ANTHROPIC_API_KEY: 'synthetic', MODAL_ENDPOINT_URL: 'https://modal.test', MODAL_PROXY_TOKEN: 'synthetic', GRAPHRAG_ENABLED: 'false', EVAL_ENABLED: 'false', EVAL_GATE_ENABLED: 'false' }, principal: { userId: 'receipt-owner' }, onReadingMemoryUsage: usage => receipts.push(usage), waitUntil: task => tasks.push(task), request: new Request('https://tableau.test/api/tarot-reading?stream=true', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ spreadInfo: { key: 'single', name: 'One-Card Insight' }, cardsInfo: [card], userQuestion: 'How can I approach a career change?' }) }) });
  const events = await response.text();
  assert.equal(response.status, 200, events);
  assert.equal(requests.length, 2);
  assert.ok(requests[0].sent.system);
  assert.ok(requests[1].sent.messages.some(message => message.role === 'system'));
  assert.notEqual(requests[0].attemptId, requests[1].attemptId);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].attemptId, requests[1].attemptId);
  assert.doesNotMatch(events, new RegExp(`${receipts[0].attemptId}|private-style|memoryRetention|slotToId`));
  await Promise.all(tasks);
});
