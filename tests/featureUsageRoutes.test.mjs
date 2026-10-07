import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser, seedSession, seedEntry, jsonRequest } from './helpers/journalFixtures.mjs';
import { onRequestPost as visionRoute } from '../functions/api/vision-proof.js';
import { onRequestPost as questionRoute } from '../functions/api/generate-question.js';
import { onRequestPost as summaryRoute } from '../functions/api/journal-summary.js';
import { TarotVisionPipeline } from '../shared/vision/tarotVisionPipeline.js';
import { claudeSseResponse, claudeErrorResponse } from './helpers/claudeSse.mjs';

async function setup(tier = 'plus') {
  const DB = await createD1();
  await seedUser(DB, { id: 'reader', tier });
  await seedSession(DB, { id: 'session-reader', userId: 'reader' });
  await seedEntry(DB, { userId: 'reader' });
  return { DB };
}
const headers = { Cookie: 'session=session-reader' };
const req = (route, body, extraHeaders = headers) => jsonRequest(`https://tableu.test/api/${route}`, { body, headers: extraHeaders });
const visionBody = { backendId: 'hybrid', evidence: [{ label: 'photo', dataUrl: 'data:image/jpeg;base64,AA==' }] };
const prediction = { response: JSON.stringify({ card: 'The Star', confidence: 0.9, orientation: 'upright' }) };

test('guest vision ignores forged backend and retains recognition on server-selected backend', async () => {
  let calls = 0;
  const env = { DB: await createD1(), VISION_BACKEND_DEFAULT: 'llama-vision', VISION_PROOF_SECRET: 'test-secret', AI: { run: async () => { calls++; return prediction; } } };
  const response = await visionRoute({ env, request: req('vision-proof', visionBody, { 'CF-Connecting-IP': '192.0.2.31' }) });
  assert.equal(response.status, 201);
  assert.equal(calls, 1);
  const payload = await response.json();
  assert.equal(payload.proof.insights[0].basis, 'llama');
  const [row] = env.DB.rows('SELECT * FROM feature_usage');
  assert.equal(row.state, 'completed');
  assert.match(row.identity_key, /^guest:[a-f0-9]{64}$/);
});

test('vision does no costly work when accounting is unavailable', async () => {
  let calls = 0;
  const env = { VISION_BACKEND_DEFAULT: 'llama-vision', VISION_PROOF_SECRET: 'test-secret', AI: { run: async () => { calls++; return prediction; } } };
  const response = await visionRoute({ env, request: req('vision-proof', visionBody, { 'CF-Connecting-IP': '192.0.2.32' }) });
  assert.equal(response.status, 503);
  assert.equal(calls, 0);
});

test('vision concurrent burst admits one and releases after provider failure', async () => {
  let release;
  let start;
  const started = new Promise((resolve) => { start = resolve; });
  const env = { DB: await createD1(), VISION_BACKEND_DEFAULT: 'llama-vision', VISION_PROOF_SECRET: 'test-secret', AI: { run: async () => { start(); return new Promise((resolve) => { release = resolve; }); } } };
  const first = visionRoute({ env, request: req('vision-proof', visionBody, { 'CF-Connecting-IP': '192.0.2.33' }) });
  await started;
  const burst = await Promise.all(Array.from({ length: 5 }, () => visionRoute({ env, request: req('vision-proof', visionBody, { 'CF-Connecting-IP': '192.0.2.33' }) })));
  assert.ok(burst.every((response) => response.status === 429));
  release({ response: 'not JSON' });
  assert.equal((await first).status, 400);
  assert.equal(env.DB.rows("SELECT * FROM feature_usage WHERE state = 'reserved'").length, 0);
});

test('vision daily exhaustion prevents another model call and oversized body fails before inference', async () => {
  let calls = 0;
  const env = { DB: await createD1(), FEATURE_VISION_FREE_DAILY_LIMIT: '1', VISION_BACKEND_DEFAULT: 'llama-vision', VISION_PROOF_SECRET: 'test-secret', AI: { run: async () => { calls++; return prediction; } } };
  const photo = () => req('vision-proof', visionBody, { 'CF-Connecting-IP': '192.0.2.34' });
  assert.equal((await visionRoute({ env, request: photo() })).status, 201);
  assert.equal((await visionRoute({ env, request: photo() })).status, 429);
  const oversized = req('vision-proof', visionBody, { 'CF-Connecting-IP': '192.0.2.35', 'Content-Length': '999999999' });
  assert.equal((await visionRoute({ env, request: oversized })).status, 413);
  assert.equal(calls, 1);
});

for (const [feature, route, handler, body, setting] of [
  ['question', 'generate-question', questionRoute, { prompt: 'Help me reflect.' }, 'FEATURE_QUESTION_PLUS_DAILY_LIMIT'],
  ['summary', 'journal-summary', summaryRoute, {}, 'FEATURE_SUMMARY_PLUS_DAILY_LIMIT']
]) {
  test(`${feature} daily limit and burst are enforced for paid sessions`, async (t) => {
    const env = { ...await setup(), ANTHROPIC_API_KEY: 'test-only', [setting]: '1' };
    let release;
    let start;
    const started = new Promise((resolve) => { start = resolve; });
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => { calls++; start(); return new Promise((resolve) => { release = resolve; }); });
    const pending = handler({ env, request: req(route, body) });
    await started;
    const burst = await handler({ env, request: req(route, body) });
    assert.equal(burst.status, 429);
    release(claudeSseResponse(feature === 'question' ? 'What helps me move forward?' : 'Your journal invites patience.'));
    assert.equal((await pending).status, 200);
    assert.equal((await handler({ env, request: req(route, body) })).status, 429);
    assert.equal(calls, 1);
  });

  test(`${feature} releases local fallback and fails closed on missing accounting table`, async (t) => {
    const env = await setup();
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected external inference'); });
    assert.equal((await handler({ env, request: req(route, body) })).status, 200);
    assert.equal(env.DB.rows("SELECT * FROM feature_usage WHERE state = 'reserved'").length, 0);
    assert.equal(env.DB.rows("SELECT * FROM feature_usage WHERE state = 'completed'").length, 0);
    env.DB.sqlite.run('DROP TABLE feature_usage');
    const response = await handler({ env: { ...env, ANTHROPIC_API_KEY: 'test-only' }, request: req(route, body) });
    assert.equal(response.status, 503);
  });
}

test('free questions still use local template without accounting storage', async () => {
  const response = await questionRoute({ env: {}, request: req('generate-question', { prompt: 'Help me reflect.' }, {}) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).provider, 'local-template');
});

test('unauthenticated client cannot upgrade a server CLIP backend to paid Llama vision', async (t) => {
  t.mock.method(TarotVisionPipeline.prototype, '_ensureCardEmbeddings', async () => {});
  t.mock.method(TarotVisionPipeline.prototype, 'analyzeImages', async () => [{ label: 'photo', topMatch: { cardName: 'The Star', score: 0.9, basis: 'clip' } }]);
  let paidCalls = 0;
  const env = { DB: await createD1(), VISION_BACKEND_DEFAULT: 'clip-default', VISION_PROOF_SECRET: 'test-secret', AI: { run: async () => { paidCalls++; return prediction; } } };
  const response = await visionRoute({ env, request: req('vision-proof', { ...visionBody, backendId: 'llama-vision' }, { 'CF-Connecting-IP': '192.0.2.36' }) });
  assert.equal(response.status, 201);
  assert.equal(paidCalls, 0);
  assert.equal((await response.json()).proof.insights[0].basis, 'clip');
});

test('guest vision fails closed when no trusted client identity is available', async () => {
  let paidCalls = 0;
  const env = { DB: await createD1(), VISION_BACKEND_DEFAULT: 'llama-vision', AI: { run: async () => { paidCalls++; return prediction; } } };
  const response = await visionRoute({ env, request: req('vision-proof', visionBody, { 'X-Forwarded-For': '192.0.2.37' }) });
  assert.equal(response.status, 503);
  assert.equal(paidCalls, 0);
});

test('service-token question safeguards use the service tier without requiring a cookie', async (t) => {
  const env = { DB: await createD1(), GPT_SERVICE_TOKEN: 'test-service-token-with-more-than-24-characters', FEATURE_QUESTION_PLUS_DAILY_LIMIT: '1', ANTHROPIC_API_KEY: 'test-only' };
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return claudeSseResponse('What helps me move forward?'); });
  const authorized = () => req('generate-question', { prompt: 'Help me reflect.' }, { Authorization: `Bearer ${env.GPT_SERVICE_TOKEN}` });
  assert.equal((await questionRoute({ env, request: authorized() })).status, 200);
  assert.equal((await questionRoute({ env, request: authorized() })).status, 429);
  assert.equal(calls, 1);
  assert.equal(env.DB.rows('SELECT identity_key FROM feature_usage')[0].identity_key, 'user:service:gpt');
});

for (const [feature, route, handler, body] of [
  ['question', 'generate-question', questionRoute, { prompt: 'Help me reflect.' }],
  ['summary', 'journal-summary', summaryRoute, {}]
]) {
  test(`${feature} streamed input overflow is refused without a reservation or provider call`, async (t) => {
    const env = { ...await setup(), ANTHROPIC_API_KEY: 'test-only' };
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Provider must not run'); });
    const response = await handler({ env, request: req(route, { ...body, excess: 'a'.repeat(65536) }) });
    assert.equal(response.status, 413);
    assert.equal(fetchMock.mock.callCount(), 0);
    assert.equal(env.DB.rows('SELECT * FROM feature_usage').length, 0);
  });
}

test('eight failed guest vision requests stop costly calls at the five-per-minute attempt bound', async () => {
  let calls = 0;
  const env = { DB: await createD1(), VISION_BACKEND_DEFAULT: 'llama-vision', VISION_PROOF_SECRET: 'test-secret', AI: { run: async () => { calls++; return { response: 'not JSON' }; } } };
  const statuses = [];
  for (let index = 0; index < 8; index++) statuses.push((await visionRoute({ env, request: req('vision-proof', visionBody, { 'CF-Connecting-IP': '192.0.2.99' }) })).status);
  assert.deepEqual(statuses, [400, 400, 400, 400, 400, 429, 429, 429]);
  assert.equal(calls, 5);
  assert.equal(env.DB.rows("SELECT * FROM feature_usage WHERE state = 'released'").length, 5);
  assert.equal(env.DB.rows("SELECT * FROM feature_usage WHERE state = 'completed'").length, 0);
});


for (const [feature, handler, body, setting] of [
  ['question', questionRoute, { prompt: 'Help me reflect.' }, 'FEATURE_QUESTION_PLUS_DAILY_LIMIT'],
  ['summary', summaryRoute, {}, 'FEATURE_SUMMARY_PLUS_DAILY_LIMIT']
]) {
  test(`${feature} repeated paid failures refund allowance but stop after three independent attempts`, async (t) => {
    const env = { ...await setup(), ANTHROPIC_API_KEY: 'test-only', [setting]: '1' };
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => { calls++; return claudeErrorResponse(400, 'invalid_request_error', 'Mock failure'); });
    const statuses = [];
    for (let index = 0; index < 8; index++) statuses.push((await handler({ env, request: req(feature, body) })).status);
    assert.deepEqual(statuses, [200, 200, 200, 429, 429, 429, 429, 429]);
    assert.equal(calls, 3);
    assert.equal(env.DB.rows("SELECT * FROM feature_usage WHERE state = 'released'").length, 3);
    assert.equal(env.DB.rows("SELECT * FROM feature_usage WHERE state = 'completed'").length, 0);
  });

  test(`${feature} aborted paid attempts cannot erase the attempt budget`, async (t) => {
    const env = { ...await setup(), ANTHROPIC_API_KEY: 'test-only', [setting]: '1' };
    let calls = 0;
    let controller;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      calls++;
      setImmediate(() => controller.abort());
      return new Promise((_resolve, reject) => {
        const abort = () => reject(Object.assign(new Error('Mock cancelled'), { name: 'AbortError' }));
        if (options.signal.aborted) abort();
        else options.signal.addEventListener('abort', abort, { once: true });
      });
    });
    const statuses = [];
    for (let index = 0; index < 8; index++) {
      controller = new AbortController();
      const pendingRequest = new Request(req(feature, body), { signal: controller.signal });
      statuses.push((await handler({ env, request: pendingRequest })).status);
    }
    assert.deepEqual(statuses, [503, 503, 503, 429, 429, 429, 429, 429]);
    assert.equal(calls, 3);
    assert.equal(env.DB.rows("SELECT * FROM feature_usage WHERE state = 'released'").length, 3);
    assert.equal(env.DB.rows("SELECT * FROM feature_usage WHERE state = 'completed'").length, 0);
  });
}
