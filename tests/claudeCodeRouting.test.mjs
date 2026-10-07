import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getAvailableNarrativeBackends, runNarrativeBackend } from '../functions/lib/narrativeBackends.js';
import { analyzeSpreadThemes } from '../functions/lib/spreadAnalysis.js';
import { onRequestPost as questionRoute } from '../functions/api/generate-question.js';
import { onRequestPost as summaryRoute } from '../functions/api/journal-summary.js';
import { onRequestPost as readingRoute } from '../functions/api/tarot-reading.js';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser, seedSession, seedEntry, jsonRequest } from './helpers/journalFixtures.mjs';
import { SPREADS } from '../src/data/spreads.js';

const env = {
  TEXT_PROVIDER: 'claude-code', CLAUDE_CODE_OWNER_USER_ID: 'owner',
  CLAUDE_CODE_GATEWAY_URL: 'https://claude.example.test', CLAUDE_CODE_GATEWAY_TOKEN: 'test-token',
  OPENAI_API_KEY: 'must-not-use', OPENAI_BASE_URL: 'https://openai.test',
  MODAL_ENDPOINT_URL: 'https://modal.test', MODAL_PROXY_TOKEN: 'must-not-use',
  ANTHROPIC_API_KEY: 'must-not-use'
};
const completion = text => ({ provider: 'claude-code', text, structured: null, model: 'claude-pinned-test', usage: { input_tokens: 42, output_tokens: 12 } });
async function setup() {
  const db = await createD1();
  for (const id of ['owner', 'other']) {
    await seedUser(db, { id, tier: 'pro' });
    await seedSession(db, { id: `session-${id}`, userId: id });
  }
  await seedEntry(db, { userId: 'owner' });
  return { ...env, DB: db };
}
const request = (route, body, user = 'owner') => jsonRequest(`https://tableu.test/api/${route}`, { body, headers: { Cookie: `session=session-${user}` } });

test('subscription narrative order excludes paid backends even when their keys exist', () => {
  assert.deepEqual(getAvailableNarrativeBackends(env).map(backend => backend.id), ['claude-code', 'local-composer']);
  assert.deepEqual(getAvailableNarrativeBackends({ ...env, CLAUDE_CODE_GATEWAY_URL: '' }).map(backend => backend.id), ['claude-code', 'local-composer']);
});

test('explicit paid narrative backend cannot override personal subscription mode', async () => {
  for (const backend of ['azure-gpt5', 'claude-api', 'modal-qwen']) {
    await assert.rejects(runNarrativeBackend(backend, env, {}, 'test'), /subscription mode/i);
  }
});

test('Claude narrative retains personalized prompts and source usage metadata', async t => {
  const cardsInfo = [{ card: 'The Star', name: 'The Star', number: 17, position: 'Theme', orientation: 'Upright', meaning: 'Hope and renewal' }];
  const themes = await analyzeSpreadThemes(cardsInfo);
  const payload = {
    spreadInfo: { name: SPREADS.single.name, key: 'single' }, cardsInfo,
    userQuestion: 'How can I make space for painting?', reflectionsText: 'I have just twenty minutes after work.',
    analysis: { themes, spreadAnalysis: null, spreadKey: 'single' }, context: 'creative',
    personalization: { displayName: 'River', readingTone: 'gentle' },
    memories: [{ text: 'User prefers concrete next steps', category: 'communication' }], subscriptionTier: 'pro'
  };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://claude.example.test/v1/generate');
    const sent = JSON.parse(options.body);
    assert.equal(sent.task, 'reading');
    assert.match(sent.messages[0].content, /painting|twenty minutes/);
    return Response.json(completion('The Star invites a small, repeatable painting practice.'));
  });
  const result = await runNarrativeBackend('claude-code', env, payload, 'test');
  assert.equal(result.reading, 'The Star invites a small, repeatable painting practice.');
  assert.equal(result.model, 'claude-pinned-test');
  assert.equal(result.usage.input_tokens, 42);
  assert.ok(result.promptMeta);
  assert.equal(result.promptMeta, payload.promptMeta);
  assert.match(result.prompts.user, /painting/);
});

test('journal summary uses Claude and exposes actual model', async t => {
  const configured = await setup();
  const tasks = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://claude.example.test/v1/generate');
    const sent = JSON.parse(options.body);
    tasks.push(sent.task);
    return Response.json(completion('Your journal invites a gentler pace.'));
  });
  const summary = await summaryRoute({ env: configured, request: request('journal-summary', {}) });
  assert.equal(summary.status, 200);
  const s = await summary.json();
  assert.equal(s.meta.provider, 'claude-code');
  assert.equal(s.meta.model, 'claude-pinned-test');
  assert.deepEqual(tasks, ['journal-summary']);
});

test('personal text routes reject another account before inference', async t => {
  const configured = await setup();
  t.mock.method(globalThis, 'fetch', async () => assert.fail('unauthorized inference'));
  const inputs = [
    [summaryRoute, 'journal-summary', {}],
    [readingRoute, 'tarot-reading', { spreadInfo: { name: SPREADS.single.name, key: 'single' }, cardsInfo: [{ position: SPREADS.single.positions[0], card: 'The Star', orientation: 'Upright', meaning: 'Hope' }] }]
  ];
  for (const [route, name, body] of inputs) {
    const response = await route({ env: configured, request: request(name, body, 'other') });
    assert.equal(response.status, 403, name);
    assert.equal((await response.json()).code, 'claude_owner_only');
  }
});

test('questions retain local fallback when Workers AI is missing even in personal mode', async t => {
  const configured = await setup();
  const urls = [];
  t.mock.method(globalThis, 'fetch', async url => {
    urls.push(url);
    return new Response(null, { status: 429 });
  });
  const response = await questionRoute({ env: configured, request: request('generate-question', { prompt: 'Craft a question about career.' }) });
  const body = await response.json();
  assert.equal(body.provider, 'local-fallback');
  assert.equal(body.model, null);
  assert.ok(body.question.endsWith('?'));
  assert.deepEqual(urls, []);
});

for (const stream of [false, true]) {
  test(`subscription readings honor Claude selection with Azure streaming enabled (${stream ? 'SSE' : 'JSON'})`, async t => {
    const configured = await setup();
    Object.assign(configured, { OPENAI_STREAMING_ENABLED: 'true', ALLOW_STREAMING_WITH_EVAL_GATE: 'true', EVAL_ENABLED: 'false', EVAL_GATE_ENABLED: 'false' });
    const urls = [];
    const text = [
      '### Opening', 'There is room to begin with what you have.',
      '### The Star — One-Card Insight',
      'The Star invites you to bring patient attention to your creative practice. Its quiet renewal suggests that hope becomes useful when you give it a small, repeatable shape. For your painting, try setting out one brush and one color before work ends. The Star asks you to notice what restores your interest, and to build from that experience at a pace you can sustain. You can choose which steps fit your energy and resources.',
      '### Guidance', 'Set aside ten minutes for one color study and notice whether the practice gives you room to breathe.',
      '### Closing', 'You can begin gently and decide what to keep after trying it.'
    ].join('\n\n');
    t.mock.method(globalThis, 'fetch', async url => {
      urls.push(url);
      return Response.json(completion(text));
    });
    const response = await readingRoute({ env: configured, request: request(`tarot-reading${stream ? '?stream=true' : ''}`, {
      spreadInfo: { name: SPREADS.single.name, key: 'single' },
      cardsInfo: [{ position: SPREADS.single.positions[0], card: 'The Star', orientation: 'Upright', meaning: 'Hope' }],
      userQuestion: 'How can I start painting again?'
    }) });
    const delivered = await response.text();
    assert.equal(response.status, 200);
    assert.match(delivered, /claude-code/);
    assert.match(delivered, /one brush/);
    assert.deepEqual(urls, ['https://claude.example.test/v1/generate']);
  });
}
