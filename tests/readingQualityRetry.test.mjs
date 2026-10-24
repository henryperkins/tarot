import assert from 'node:assert/strict';
import { test } from 'node:test';

import { modalSseResponse } from './helpers/modalSse.mjs';
import { onRequestPost } from '../functions/api/tarot-reading.js';
import { summarizeRejectedNarrative } from '../functions/lib/readingQuality.js';

const MODAL_URL = 'https://example.modal.direct/v1/chat/completions';
const OPENAI_URL = 'https://api.openai.example/v1/responses';
const PAYLOAD = {
  spreadInfo: { name: 'One-Card Insight' },
  cardsInfo: [{ position: 'One-Card Insight', card: 'The Fool', orientation: 'Upright', meaning: 'New beginnings' }],
  userQuestion: 'What opens next?',
  reflectionsText: ''
};
const VALID_READING = [
  '### Opening', '',
  'A fresh threshold is visible, but it asks for curiosity rather than certainty.', '',
  '### The Fool — One-Card Insight', '',
  'The Fool is the central card in this reading, showing an opening that has not yet been overplanned. Because its energy favors direct experience over perfect preparation, the uncertainty around your question can become useful information. This card invites you to take one reversible next step, notice what changes, and let the path answer you through experience.', '',
  '### Guidance', '',
  'Choose a small action that preserves freedom. Write down what you expect, take the step, and compare the real result with the fear or hope that came before it.', '',
  '### Closing', '',
  'You do not need the whole route today. You need enough trust to meet the next honest moment.'
].join('\n');
// Like production reading 9feabf09: a fluent answer about cards that were not drawn.
const UNDRAWN_CARDS_READING = [
  '### Opening', '',
  'Private wording: change arrives through the people around you.', '',
  '### King of Cups', '',
  'The King of Cups asks for emotional steadiness, while The Hermit counsels quiet reflection.', '',
  '### Eight of Pentacles', '',
  'The Eight of Pentacles rewards patient practice.', '',
  '### Closing', '',
  'Trust the slow work.'
].join('\n');
const ENV = {
  MODAL_PROXY_TOKEN: 'wk-test.ws-test', MODAL_ENDPOINT_URL: 'https://example.modal.direct',
  OPENAI_API_KEY: 'fixture-key', OPENAI_BASE_URL: 'https://api.openai.example', OPENAI_MODEL: 'gpt-5-test',
  EVAL_ENABLED: 'false', EVAL_GATE_ENABLED: 'false', GRAPHRAG_ENABLED: 'false'
};

function mockProviders(t, modalReadings) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(String(url));
    if (String(url) === MODAL_URL) {
      const next = modalReadings.shift();
      assert.ok(next, 'unexpected Modal call');
      return modalSseResponse(next);
    }
    if (String(url) === OPENAI_URL) return Response.json({ output_text: VALID_READING });
    throw new Error(`Unexpected URL: ${url}`);
  });
  return calls;
}

function captureWarnings(t) {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  const warn = t.mock.method(console, 'warn', () => {});
  return () => warn.mock.calls.map((call) => call.arguments.join(' '));
}

const readingRequest = () => new Request('http://localhost/api/tarot-reading', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(PAYLOAD)
});

test('a Modal reading about undrawn cards is retried once and the fresh answer is accepted', async (t) => {
  const warnings = captureWarnings(t);
  const calls = mockProviders(t, [UNDRAWN_CARDS_READING, VALID_READING]);
  const response = await onRequestPost({ request: readingRequest(), env: ENV });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.provider, 'modal-qwen');
  assert.equal(body.reading, VALID_READING);
  assert.deepEqual(calls, [MODAL_URL, MODAL_URL]);
  assert.deepEqual(body.backendErrors.map((entry) => entry.backend), ['modal-qwen']);
  assert.ok(warnings().some((line) => line.includes('Retrying modal-qwen once after its output failed the quality gate')));
});

test('a second rejected Modal reading falls through to the next provider without another retry', async (t) => {
  captureWarnings(t);
  const calls = mockProviders(t, [UNDRAWN_CARDS_READING, UNDRAWN_CARDS_READING]);
  const response = await onRequestPost({ request: readingRequest(), env: ENV });
  const body = await response.json();
  assert.equal(body.provider, 'openai-native');
  assert.equal(body.reading, VALID_READING);
  assert.deepEqual(calls, [MODAL_URL, MODAL_URL, OPENAI_URL]);
});

test('Modal is not retried when the task budget cannot fit another attempt', async (t) => {
  captureWarnings(t);
  const calls = mockProviders(t, [UNDRAWN_CARDS_READING]);
  const response = await onRequestPost({ request: readingRequest(), env: { ...ENV, READING_TASK_TIMEOUT_MS: '60000' } });
  const body = await response.json();
  assert.equal(body.provider, 'openai-native');
  assert.deepEqual(calls, [MODAL_URL, OPENAI_URL]);
});

test('a rejected answer is logged as a summary without its text', async (t) => {
  const warnings = captureWarnings(t);
  mockProviders(t, [UNDRAWN_CARDS_READING, VALID_READING]);
  await onRequestPost({ request: readingRequest(), env: ENV });
  const line = warnings().find((entry) => entry.includes('Backend modal-qwen rejected output: '));
  assert.ok(line, 'expected a rejected-output summary');
  assert.ok(!line.includes('Private wording') && !line.includes('emotional steadiness'));
  const summary = JSON.parse(line.slice(line.indexOf('rejected output: ') + 'rejected output: '.length));
  assert.equal(summary.characters, UNDRAWN_CARDS_READING.length);
  assert.equal(summary.headings, 4);
  assert.deepEqual(summary.scripts, { latin: 1 });
  assert.deepEqual(summary.drawnCardsMentioned, []);
  assert.deepEqual([...summary.undrawnCardsMentioned].sort(), ['Eight of Pentacles', 'King of Cups', 'The Hermit']);
});

test('summaries measure answer tokens and writing scripts', () => {
  const usage = { output_tokens: 900, output_tokens_details: { reasoning_tokens: 300 } };
  const summary = summarizeRejectedNarrative('### 开场\n愚者 The Fool', [{ card: 'The Fool' }], { missingCards: [] }, usage);
  assert.equal(summary.answerTokens, 600);
  assert.equal(summary.charactersPerAnswerToken, Number((summary.characters / 600).toFixed(2)));
  assert.deepEqual(summary.scripts, { han: 0.36, latin: 0.64 }); // 4 Han letters, 7 Latin
  assert.deepEqual(summary.drawnCardsMentioned, ['The Fool']);
  assert.equal(summarizeRejectedNarrative('text', [], {}, { output_tokens: 100 }).answerTokens, null);
  assert.equal(summarizeRejectedNarrative(undefined).characters, 0);
});
