import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateClaudeFollowUp } from '../functions/lib/claudeFollowUp.js';
import { onRequestPost } from '../functions/api/reading-followup.js';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser, seedSession, seedEntry, jsonRequest } from './helpers/journalFixtures.mjs';

const env = { TEXT_PROVIDER: 'claude-code', CLAUDE_CODE_GATEWAY_URL: 'https://claude.test', CLAUDE_CODE_GATEWAY_TOKEN: 'test', CLAUDE_CODE_OWNER_USER_ID: 'owner', FEATURE_FOLLOW_UP_ENABLED: 'true', FEATURE_FOLLOW_UP_JOURNAL_CONTEXT: 'false', OPENAI_API_KEY: 'must-not-use', OPENAI_BASE_URL: 'https://openai.test', MODAL_PROXY_TOKEN: 'must-not-use', MODAL_ENDPOINT_URL: 'https://modal.test' };
const answer = 'The Star in your Theme position invites you to take a small creative step. You can choose ten minutes of painting and notice how it feels.';
const memory = { text: 'User prefers concrete creative steps.', category: 'communication', keywords: ['creative', 'steps'] };
const result = (structured, text = '') => ({ provider: 'claude-code', model: 'claude-test', text, structured, usage: {} });
function responses(t, values) {
  const inputs = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    inputs.push({ url, ...JSON.parse(options.body) });
    if (url !== 'https://claude.test/v1/generate') return new Response(null, { status: 400 });
    assert.ok(values.length, 'unexpected inference call');
    const next = values.shift();
    return next instanceof Response ? next : Response.json(next);
  });
  return inputs;
}

test('follow-up executes a validated memory decision and supplies its real result before answering', async t => {
  const inputs = responses(t, [result({ response: null, memory }), result({ response: answer, memory: null })]);
  const saved = [];
  const text = await generateClaudeFollowUp(env, { systemPrompt: 'Continue the reading.', userPrompt: 'Help me paint.', enableMemoryTool: true,
    onToolCall: async (name, args) => { saved.push({ name, args }); return { success: true, message: 'Memory saved' }; }
  });
  assert.equal(text, answer);
  assert.deepEqual(saved, [{ name: 'save_memory_note', args: memory }]);
  assert.match(inputs[1].messages.at(-1).content, /Memory saved/);
  assert.equal(inputs[0].task, 'followup');
});

test('follow-up rejects malformed tool output without executing it', async t => {
  responses(t, [result({ response: null, memory: { text: 'x', category: 'shell' } })]);
  await assert.rejects(generateClaudeFollowUp(env, { systemPrompt: 'Continue.', userPrompt: 'Help me.', enableMemoryTool: true,
    onToolCall: async () => assert.fail('invalid memory executed') }), /structured|memory/i);
});

test('follow-up bounds tool rounds and avoids repeat memory writes', async t => {
  responses(t, [result({ response: null, memory }), result({ response: null, memory })]);
  let writes = 0;
  await assert.rejects(generateClaudeFollowUp(env, { systemPrompt: 'Continue.', userPrompt: 'Help me.', enableMemoryTool: true,
    onToolCall: async () => { writes++; return { success: true }; } }), /repeat|limit/i);
  assert.equal(writes, 1);
});

test('follow-up with memory disabled requests plain text and no tool decisions', async t => {
  const inputs = responses(t, [result(null, answer)]);
  const text = await generateClaudeFollowUp(env, { systemPrompt: 'Continue.', userPrompt: 'Help me.', enableMemoryTool: false });
  assert.equal(text, answer);
  assert.equal(inputs[0].responseSchema, undefined);
});

async function setup() {
  const DB = await createD1();
  await seedUser(DB, { id: 'owner', tier: 'pro' });
  await seedSession(DB, { id: 'owner-session', userId: 'owner' });
  await seedEntry(DB, { userId: 'owner', requestId: 'reading-1', narrative: 'The Star invites a gentle creative practice.', cards: [{ name: 'The Star', position: 'Theme', orientation: 'Upright' }] });
  return { ...env, DB };
}
function request(stream = false) {
  return jsonRequest('https://tableu.test/api/reading-followup', { headers: { Cookie: 'session=owner-session' }, body: {
    requestId: 'reading-1', followUpQuestion: 'How could I build a painting habit?',
    readingContext: { cardsInfo: [{ card: 'The Star', position: 'Theme', orientation: 'Upright' }], spreadKey: 'single', deckStyle: 'rws-1909', narrative: 'The Star invites a gentle creative practice.' }, options: { stream }
  } });
}

for (const stream of [false, true]) {
  test(`Claude follow-up preserves memory ownership and usage finalization (${stream ? 'SSE' : 'JSON'})`, async t => {
    const configured = await setup();
    const inputs = responses(t, [result({ response: null, memory }), result({ response: answer, memory: null })]);
    const waits = [];
    const response = await onRequestPost({ request: request(stream), env: configured, ctx: { waitUntil: promise => waits.push(promise) } });
    const delivered = await response.text();
    await Promise.all(waits);
    assert.equal(response.status, 200);
    assert.match(delivered, /small creative step/);
    assert.match(delivered, /claude-code/);
    assert.ok(inputs.every(input => input.url === 'https://claude.test/v1/generate'));
    assert.equal(configured.DB.rows('SELECT user_id FROM user_memories')[0]?.user_id, 'owner');
    assert.equal(configured.DB.rows('SELECT provider FROM follow_up_usage')[0]?.provider, 'claude-code');
  });
}

test('Claude follow-up failure releases reservation without a paid fallback', async t => {
  const configured = await setup();
  const inputs = responses(t, [new Response(null, { status: 429 })]);
  const response = await onRequestPost({ request: request(), env: configured });
  assert.equal(response.status, 503);
  assert.equal(inputs.length, 1);
  assert.equal(inputs[0].url, 'https://claude.test/v1/generate');
  assert.equal(configured.DB.rows('SELECT * FROM follow_up_usage').length, 0);
});

for (const stream of [false, true]) {
  test(`Claude repairs an undrawn card before follow-up delivery (${stream ? 'SSE' : 'JSON'})`, async t => {
    const configured = await setup();
    const inputs = responses(t, [result({ response: 'The Tower says to rebuild your painting routine.', memory: null }), result(null, answer)]);
    const waits = [];
    const response = await onRequestPost({ request: request(stream), env: configured, ctx: { waitUntil: promise => waits.push(promise) } });
    const delivered = await response.text();
    await Promise.all(waits);
    assert.equal(response.status, 200);
    assert.match(delivered, /small creative step/);
    assert.ok(!delivered.includes('The Tower says'));
    assert.deepEqual(inputs.map(input => input.task), ['followup', 'followup-repair']);
    assert.ok(inputs.every(input => input.url === 'https://claude.test/v1/generate'));
  });
}

test('personal follow-ups reject another account without reserving quota or requesting inference', async t => {
  const configured = await setup();
  configured.CLAUDE_CODE_OWNER_USER_ID = 'different-owner';
  const inputs = responses(t, []);
  const response = await onRequestPost({ request: request(), env: configured });
  assert.equal(response.status, 403);
  assert.equal(inputs.length, 0);
  assert.equal(configured.DB.rows('SELECT * FROM follow_up_usage').length, 0);
});
