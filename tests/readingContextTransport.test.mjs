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
const cardsInfo = ['Theme', 'Path A: old job', 'Path B: new home'].map(position => ({ ...card, position }));

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
