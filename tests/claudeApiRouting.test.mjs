import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequestPost as questionRoute } from '../functions/api/generate-question.js';
import { onRequestPost as summaryRoute } from '../functions/api/journal-summary.js';
import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser, seedSession, seedEntry, jsonRequest } from './helpers/journalFixtures.mjs';
import { CLAUDE_API_URL_PREFIX, claudeErrorResponse, claudeSseResponse } from './helpers/claudeSse.mjs';

const OPENAI_URL = 'https://openai.test/v1/responses';
const env = {
  ANTHROPIC_API_KEY: 'test-only',
  OPENAI_API_KEY: 'test-only',
  OPENAI_BASE_URL: 'https://openai.test',
  OPENAI_MODEL: 'openai-test-model'
};

async function setup() {
  const db = await createD1();
  await seedUser(db, { id: 'reader', tier: 'plus' });
  await seedSession(db, { id: 'session-reader', userId: 'reader' });
  await seedEntry(db, { userId: 'reader' });
  return { ...env, DB: db };
}

const request = (route, body) => jsonRequest(`https://tableu.test/api/${route}`, {
  body,
  headers: { Cookie: 'session=session-reader' }
});

const openAIText = (text) => Response.json({
  id: 'resp-test',
  model: 'openai-test-model',
  output: [{ type: 'message', content: [{ type: 'output_text', text }] }]
});

function mockProviders(t, { claude = [], openai = [] }) {
  const calls = { claude: [], openai: [] };
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const body = JSON.parse(init.body);
    if (String(url).startsWith(CLAUDE_API_URL_PREFIX)) {
      calls.claude.push(body);
      const next = claude.shift();
      assert.ok(next, 'unexpected Claude API call');
      return next();
    }
    if (String(url) === OPENAI_URL) {
      calls.openai.push(body);
      const next = openai.shift();
      assert.ok(next, 'unexpected Responses API call');
      return next();
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  return calls;
}

test('suggested questions come from Claude at low effort', async (t) => {
  const calls = mockProviders(t, { claude: [() => claudeSseResponse('What would help me steady my work this month?')] });
  const response = await questionRoute({ env: await setup(), request: request('generate-question', { prompt: 'Craft a question about career.', metadata: {} }) });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.provider, 'claude-api');
  assert.equal(body.model, 'claude-opus-5-5');
  assert.equal(body.question, 'What would help me steady my work this month?');
  assert.deepEqual(calls.claude[0].output_config, { effort: 'low' });
  assert.equal(calls.openai.length, 0);
});

test('suggested questions fall back to the Responses API when Claude fails', async (t) => {
  const calls = mockProviders(t, {
    claude: [() => claudeErrorResponse(400)],
    openai: [() => openAIText('What is asking for my attention at work?')]
  });
  const response = await questionRoute({ env: await setup(), request: request('generate-question', { prompt: 'Craft a question about career.', metadata: {} }) });
  const body = await response.json();
  assert.equal(body.provider, 'openai-native');
  assert.equal(body.model, 'openai-test-model');
  assert.equal(body.question, 'What is asking for my attention at work?');
  assert.equal(calls.claude.length, 1);
});

test('journal summaries come from Claude', async (t) => {
  const summaryText = '### Arc of the Journey\nYour readings return to steady, patient work.';
  const calls = mockProviders(t, { claude: [() => claudeSseResponse(summaryText)] });
  const response = await summaryRoute({ env: await setup(), request: request('journal-summary', {}) });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.summary, summaryText);
  assert.equal(body.meta.provider, 'claude-api');
  assert.equal(body.meta.model, 'claude-opus-5-5');
  assert.deepEqual(calls.claude[0].output_config, { effort: 'medium' });
  assert.match(calls.claude[0].system, /journal summary/);
  assert.equal(calls.openai.length, 0);
});

test('journal summaries fall back to the heuristic when every provider fails', async (t) => {
  const calls = mockProviders(t, {
    claude: [() => claudeErrorResponse(400)],
    openai: [() => new Response('{}', { status: 401 })]
  });
  const response = await summaryRoute({ env: await setup(), request: request('journal-summary', {}) });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.meta.provider, 'heuristic');
  assert.ok(body.summary.length > 0);
  assert.equal(calls.claude.length, 1);
});
