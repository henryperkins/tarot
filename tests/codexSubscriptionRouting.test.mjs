import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAvailableNarrativeBackends, runNarrativeBackend } from '../functions/lib/narrativeBackends.js';
import { analyzeSpreadThemes } from '../functions/lib/spreadAnalysis.js';
import { onRequestPost as readingRoute } from '../functions/api/tarot-reading.js';
import { onRequestPost as followupRoute } from '../functions/api/reading-followup.js';
import { onRequestPost as summaryRoute } from '../functions/api/journal-summary.js';
import { onRequestPost as questionRoute } from '../functions/api/generate-question.js';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser, seedSession, seedEntry, jsonRequest } from './helpers/journalFixtures.mjs';
import { SPREADS } from '../src/data/spreads.js';

const env = {
  TEXT_PROVIDER: 'codex-subscription', CODEX_SUBSCRIPTION_OWNER_USER_ID: 'owner',
  CODEX_SUBSCRIPTION_GATEWAY_URL: 'https://codex.example.test', CODEX_SUBSCRIPTION_GATEWAY_TOKEN: 'test-token',
  CLAUDE_CODE_GATEWAY_URL: 'https://claude.example.test', CLAUDE_CODE_GATEWAY_TOKEN: 'must-not-use',
  OPENAI_API_KEY: 'must-not-use', OPENAI_BASE_URL: 'https://openai.test',
  MODAL_ENDPOINT_URL: 'https://modal.test', MODAL_PROXY_TOKEN: 'must-not-use', ANTHROPIC_API_KEY: 'must-not-use',
  FEATURE_FOLLOW_UP_ENABLED: 'true', FEATURE_FOLLOW_UP_JOURNAL_CONTEXT: 'false'
};
const completion = (text, structured = null) => ({ provider: 'codex-subscription', text, structured, model: 'codex-test', modelSource: 'configured', usage: { input_tokens: 42, output_tokens: 12 } });
const answer = 'The Star in your Theme position invites you to take a small creative step. You can choose ten minutes of painting and notice how it feels.';
const memory = { text: 'User prefers concrete creative steps.', category: 'communication', keywords: ['creative', 'steps'] };
const readingInput = {
  spreadInfo: { name: SPREADS.single.name, key: 'single' },
  cardsInfo: [{ position: SPREADS.single.positions[0], card: 'The Star', orientation: 'Upright', meaning: 'Hope' }],
  userQuestion: 'How can I start painting again?'
};
const followupInput = {
  requestId: 'reading-1', followUpQuestion: 'How could I build a painting habit?',
  readingContext: { cardsInfo: [{ card: 'The Star', position: 'Theme', orientation: 'Upright' }], spreadKey: 'single', deckStyle: 'rws-1909', narrative: 'The Star invites a gentle creative practice.' }
};
async function setup() {
  const DB = await createD1();
  for (const id of ['owner', 'other']) {
    await seedUser(DB, { id, tier: 'pro' });
    await seedSession(DB, { id: `session-${id}`, userId: id });
  }
  await seedEntry(DB, { userId: 'owner', requestId: 'reading-1', narrative: 'The Star invites a gentle creative practice.', cards: [{ name: 'The Star', position: 'Theme', orientation: 'Upright' }] });
  return { ...env, DB };
}
const request = (route, body, user = 'owner') => jsonRequest(`https://tableu.test/api/${route}`, { body, headers: { Cookie: `session=session-${user}` } });
function responses(t, values) {
  const inputs = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://codex.example.test/v1/generate', 'must never call another subscription or paid API');
    inputs.push(JSON.parse(options.body));
    assert.ok(values.length, 'unexpected inference call');
    const next = values.shift();
    return next instanceof Response ? next : Response.json(next);
  });
  return inputs;
}

test('Codex selection excludes paid and Claude backends even with missing gateway configuration', async () => {
  for (const configured of [env, { ...env, CODEX_SUBSCRIPTION_GATEWAY_URL: '' }]) {
    assert.deepEqual(getAvailableNarrativeBackends(configured).map(backend => backend.id), ['codex-subscription', 'local-composer']);
    for (const backend of ['azure-gpt5', 'claude-api', 'modal-qwen', 'claude-code']) {
      await assert.rejects(runNarrativeBackend(backend, configured, {}, 'test'), /subscription mode/i);
    }
  }
});

test('Codex narrative preserves personal context and returns its provider and model provenance', async t => {
  const cardsInfo = [{ card: 'The Star', name: 'The Star', number: 17, position: 'Theme', orientation: 'Upright', meaning: 'Hope and renewal' }];
  const payload = { ...readingInput, cardsInfo, reflectionsText: 'I have twenty minutes after work.',
    analysis: { themes: await analyzeSpreadThemes(cardsInfo), spreadAnalysis: null, spreadKey: 'single' }, context: 'creative', subscriptionTier: 'pro' };
  const inputs = responses(t, [completion(answer)]);
  const result = await runNarrativeBackend('codex-subscription', env, payload, 'test');
  assert.equal(result.reading, answer);
  assert.equal(result.model, 'codex-test');
  assert.equal(result.usage.input_tokens, 42);
  assert.deepEqual(result.promptMeta.inference, { provider: 'codex-subscription', model: 'codex-test', modelSource: 'configured' });
  assert.equal(inputs[0].task, 'reading');
  assert.match(inputs[0].messages[0].content, /twenty minutes/);
});

test('all Codex text routes enforce owner access before inference and quota reservation', async t => {
  const configured = await setup();
  responses(t, []);
  for (const [route, name, body] of [[readingRoute, 'tarot-reading', readingInput], [followupRoute, 'reading-followup', followupInput], [summaryRoute, 'journal-summary', {}]]) {
    const response = await route({ env: configured, request: request(name, body, 'other') });
    assert.equal(response.status, 403, name);
    assert.equal((await response.json()).code, 'codex_owner_only');
  }
  assert.equal(configured.DB.rows('SELECT * FROM follow_up_usage').length, 0);
});

test('Codex journal summaries report provider and model provenance and use only the local heuristic after gateway failure', async t => {
  const configured = await setup();
  const inputs = responses(t, [completion('Your journal invites a gentler pace.'), new Response(null, { status: 429 })]);
  const success = await summaryRoute({ env: configured, request: request('journal-summary', {}) });
  assert.equal(success.status, 200);
  const completed = await success.json();
  assert.equal(completed.meta.provider, 'codex-subscription');
  assert.equal(completed.meta.model, 'codex-test');
  assert.equal(completed.meta.modelSource, 'configured');
  const failed = await summaryRoute({ env: configured, request: request('journal-summary', {}) });
  assert.equal(failed.status, 200);
  assert.equal((await failed.json()).meta.provider, 'heuristic');
  assert.deepEqual(inputs.map(input => input.task), ['journal-summary', 'journal-summary']);
});

for (const stream of [false, true]) {
  test(`Codex reading uses its gateway with Azure streaming configured (${stream ? 'SSE' : 'JSON'})`, async t => {
    const configured = await setup();
    Object.assign(configured, { OPENAI_STREAMING_ENABLED: 'true', ALLOW_STREAMING_WITH_EVAL_GATE: 'true', EVAL_ENABLED: 'false', EVAL_GATE_ENABLED: 'false' });
    const text = ['### Opening', 'There is room to begin with what you have.', '### The Star — One-Card Insight',
      'The Star invites you to bring patient attention to your creative practice. Its quiet renewal suggests that hope becomes useful when you give it a small, repeatable shape. For your painting, try setting out one brush and one color before work ends. The Star asks you to notice what restores your interest, and to build from that experience at a pace you can sustain. You can choose which steps fit your energy and resources.',
      '### Guidance', 'Set aside ten minutes for one color study and notice whether the practice gives you room to breathe.',
      '### Closing', 'You can begin gently and decide what to keep after trying it.'].join('\n\n');
    const inputs = responses(t, [completion(text)]);
    const response = await readingRoute({ env: configured, request: request(`tarot-reading${stream ? '?stream=true' : ''}`, readingInput) });
    const delivered = await response.text();
    assert.equal(response.status, 200);
    assert.match(delivered, /codex-subscription/);
    assert.match(delivered, /one brush/);
    assert.deepEqual(inputs.map(input => input.task), ['reading']);
    const attempt = configured.DB.rows('SELECT provider, requested_model, model FROM inference_attempts')[0];
    assert.deepEqual(attempt, { provider: 'codex-subscription', requested_model: 'codex-test', model: null });
  });

  test(`Codex follow-up preserves memory ownership and repairs undrawn cards (${stream ? 'SSE' : 'JSON'})`, async t => {
    const configured = await setup();
    const inputs = responses(t, [completion('', { response: null, memory }), completion('', { response: 'The Tower says to rebuild your painting routine.', memory: null }), completion(answer)]);
    const waits = [];
    const response = await followupRoute({ env: configured, request: request('reading-followup', { ...followupInput, options: { stream } }), ctx: { waitUntil: promise => waits.push(promise) } });
    const delivered = await response.text();
    await Promise.all(waits);
    assert.equal(response.status, 200);
    assert.match(delivered, /small creative step/);
    assert.match(delivered, /codex-subscription/);
    assert.ok(!delivered.includes('The Tower says'));
    assert.deepEqual(inputs.map(input => input.task), ['followup', 'followup', 'followup-repair']);
    const decisionSchema = inputs[0].responseSchema.properties.memory.anyOf[1];
    assert.deepEqual(decisionSchema.required, ['text', 'category', 'keywords']);
    assert.match(inputs[1].messages.at(-1).content, /success/);
    assert.equal(configured.DB.rows('SELECT user_id FROM user_memories')[0]?.user_id, 'owner');
    assert.equal(configured.DB.rows('SELECT provider FROM follow_up_usage')[0]?.provider, 'codex-subscription');
  });
}

test('Codex follow-up failure releases usage without paid fallback', async t => {
  const configured = await setup();
  const inputs = responses(t, [new Response(null, { status: 429 })]);
  const response = await followupRoute({ env: configured, request: request('reading-followup', followupInput) });
  assert.equal(response.status, 503);
  assert.equal(inputs.length, 1);
  assert.equal(configured.DB.rows('SELECT * FROM follow_up_usage').length, 0);
});

test('question suggestions remain independent of Codex subscription selection', async t => {
  const configured = await setup();
  responses(t, []);
  const response = await questionRoute({ env: configured, request: request('generate-question', { prompt: 'Craft a question about career.' }) });
  const body = await response.json();
  assert.equal(body.provider, 'local-fallback');
  assert.ok(body.question.endsWith('?'));
});

const liveReading = ['### Opening', 'There is room to begin with what you have.', '### The Star — One-Card Insight',
  'The Star invites you to bring patient attention to your creative practice. Its quiet renewal suggests that hope becomes useful when you give it a small, repeatable shape. For your painting, try setting out one brush and one color before work ends. The Star asks you to notice what restores your interest, and to build from that experience at a pace you can sustain. You can choose which steps fit your energy and resources.',
  '### Guidance', 'Set aside ten minutes for one color study and notice whether the practice gives you room to breathe.',
  '### Closing', 'You can begin gently and decide what to keep after trying it.'].join('\n\n');
const encodeEvent = (type, data) => new TextEncoder().encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
const parseEvent = bytes => {
  const text = new TextDecoder().decode(bytes);
  return { type: text.match(/^event: (.+)/m)[1], data: JSON.parse(text.match(/^data: (.+)/m)[1]) };
};
async function liveSetup(t, overrides = {}) {
  const configured = { ...await setup(), CODEX_SUBSCRIPTION_STREAMING_ENABLED: 'true', EVAL_ENABLED: 'false', EVAL_GATE_ENABLED: 'false', ...overrides };
  let upstream;
  let upstreamSignal;
  let calls = 0;
  let cancelled = false;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    assert.equal(url, 'https://codex.example.test/v1/generate');
    assert.equal(options.headers.Accept, 'text/event-stream');
    upstreamSignal = options.signal;
    return new Response(new ReadableStream({ start(controller) { upstream = controller; }, cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'text/event-stream' } });
  });
  const waits = [];
  const response = await readingRoute({ env: configured, request: request('tarot-reading?stream=true', readingInput), waitUntil: promise => waits.push(promise) });
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  const received = [];
  const next = async () => {
    const item = await reader.read();
    if (item.done) return null;
    const parsed = parseEvent(item.value);
    received.push(parsed);
    return parsed;
  };
  assert.equal((await next()).type, 'meta');
  return { configured, reader, received, next, waits,
    get calls() { return calls; }, get cancelled() { return cancelled; }, get signal() { return upstreamSignal; },
    send: (type, data) => upstream.enqueue(encodeEvent(type, data)) };
}

test('live Codex route delivers accepted prose before generation completes and preserves the exact source once', async t => {
  const live = await liveSetup(t);
  const prefix = liveReading.slice(0, liveReading.indexOf('### The Star'));
  live.send('delta', { text: prefix });
  const first = await live.next();
  assert.equal(first.type, 'delta');
  assert.ok(prefix.startsWith(first.data.text));
  assert.equal(live.received.some(event => event.type === 'done'), false);
  assert.equal(live.configured.DB.rows('SELECT * FROM inference_attempts').length, 0);
  live.send('delta', { text: liveReading.slice(prefix.length) });
  live.send('done', completion(liveReading));
  while (await live.next()) { /* drain */ }
  await Promise.all(live.waits);
  const deltas = live.received.filter(event => event.type === 'delta').map(event => event.data.text).join('');
  const done = live.received.filter(event => event.type === 'done');
  assert.equal(deltas, liveReading);
  assert.equal(done.length, 1);
  assert.equal(done[0].data.fullText, deltas);
  assert.equal(done[0].data.modelSource, 'configured');
  assert.equal(live.calls, 1);
  assert.equal(live.configured.DB.rows('SELECT state FROM inference_attempts')[0].state, 'accepted');
  assert.equal(live.cancelled, true);
});

for (const failure of ['provider', 'quality', 'unsafe']) {
  test(`live Codex ${failure} failure after an accepted passage errors without fallback, completion, or charged quota`, async t => {
    const live = await liveSetup(t);
    const prefix = '### Opening\n\nThere is room to begin with what you have.\n\n';
    live.send('delta', { text: prefix });
    assert.equal((await live.next()).type, 'delta');
    if (failure === 'provider') live.send('error', { message: 'private failure detail' });
    if (failure === 'quality') live.send('done', completion(prefix));
    if (failure === 'unsafe') live.send('delta', { text: 'You should stop taking your medication immediately.\n\n' });
    while (await live.next()) { /* drain */ }
    await Promise.all(live.waits);
    assert.equal(live.received.filter(event => event.type === 'error').length, 1);
    assert.equal(live.received.filter(event => event.type === 'done').length, 0);
    assert.doesNotMatch(JSON.stringify(live.received), /private failure|stop taking/);
    assert.equal(live.calls, 1);
    assert.equal(live.configured.DB.rows('SELECT readings_count FROM usage_tracking')[0]?.readings_count, 0);
    assert.equal(live.configured.DB.rows('SELECT * FROM eval_metrics').length, 0);
  });
}

test('cancelling a live reading body aborts Codex work and releases quota', async t => {
  const live = await liveSetup(t);
  live.send('delta', { text: '### Opening\n\nThere is room to begin.\n\n' });
  assert.equal((await live.next()).type, 'delta');
  await live.reader.cancel();
  await Promise.all(live.waits);
  assert.equal(live.signal.aborted, true);
  assert.equal(live.cancelled, true);
  assert.equal(live.configured.DB.rows('SELECT readings_count FROM usage_tracking')[0]?.readings_count, 0);
});

test('live body keeps the request deadline active after the route returns', async t => {
  const live = await liveSetup(t, { READING_TASK_TIMEOUT_MS: 1000 });
  while (await live.next()) { /* waits for the request deadline */ }
  await Promise.all(live.waits);
  assert.equal(live.received.at(-1).type, 'error');
  assert.equal(live.signal.aborted, true);
  assert.equal(live.configured.DB.rows('SELECT readings_count FROM usage_tracking')[0]?.readings_count, 0);
});

for (const policy of ['global', 'restricted']) {
  test(`Codex live opt-in preserves the complete-reading ${policy} evaluation gate`, async t => {
    const configured = { ...await setup(), CODEX_SUBSCRIPTION_STREAMING_ENABLED: 'true',
      EVAL_ENABLED: policy === 'global' ? 'true' : 'false', EVAL_GATE_ENABLED: policy === 'global' ? 'true' : 'false' };
    const requests = [];
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      requests.push(options.headers.Accept || 'application/json');
      return Response.json(completion(liveReading));
    });
    const response = await readingRoute({ env: configured, request: request('tarot-reading?stream=true', {
      ...readingInput, ...(policy === 'restricted' ? { userQuestion: 'How can I reflect on my medication concerns?' } : {})
    }) });
    await response.text();
    assert.deepEqual(requests, ['application/json']);
    if (policy === 'restricted') assert.equal(response.status, 503, 'missing required model assessment must not become a live reading');
  });
}
