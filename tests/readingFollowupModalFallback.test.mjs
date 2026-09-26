import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { onRequestPost } from '../functions/api/reading-followup.js';

const OPENAI_URL = 'https://openai.test/v1/responses';
const MODAL_URL = 'https://modal.test/v1/chat/completions';
const QUESTION = 'What does The Hermit ask of me this week?';
const MODAL_TEXT = 'The Hermit in your Theme position asks you to slow down and listen before you act. The Sun in your Support position shows warmth from people who already back you.';
const OPENAI_TEXT = 'The Hermit in your Theme position invites a quieter week. The Sun in your Support position brings encouragement.';
const RETRY_MESSAGE = 'Failed to generate response. Please try again.';

const cardsInfo = [
  { card: 'The Hermit', position: 'Theme', orientation: 'upright' },
  { card: 'The Sun', position: 'Support', orientation: 'upright' }
];

const ENV = {
  FEATURE_FOLLOW_UP_ENABLED: 'true',
  FEATURE_FOLLOW_UP_JOURNAL_CONTEXT: 'false',
  OPENAI_API_KEY: 'test-only',
  OPENAI_BASE_URL: 'https://openai.test',
  OPENAI_MODEL: 'test-only',
  MODAL_PROXY_TOKEN: 'test-only',
  MODAL_ENDPOINT_URL: 'https://modal.test',
  MODAL_MODEL: 'test-only'
};

function database() {
  const writes = [];
  return {
    writes,
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() {
          if (sql.includes('FROM sessions')) return { session_id: 's', user_id: 'owner', username: 'reader', is_active: 1, subscription_tier: 'plus', subscription_status: 'active' };
          if (sql.includes('COUNT(*)')) return { count: 0 };
          if (sql.includes('SELECT turn_number')) return { turn_number: 1 };
          return null;
        },
        async all() { return { results: [] }; },
        async run() {
          writes.push({ sql, args });
          return { success: true, meta: { changes: 1 } };
        }
      };
    }
  };
}

function followUpRequest(options) {
  return new Request('https://example.test/api/reading-followup', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Cookie: 'session=fake' },
    body: JSON.stringify({
      requestId: 'reading-1',
      followUpQuestion: QUESTION,
      readingContext: { cardsInfo, spreadKey: 'threeCard', deckStyle: 'rws-1909' },
      options
    })
  });
}

function sse(...events) {
  return new Response(events.map(data => `event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`).join(''), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' }
  });
}

function modalCompletion(content, finishReason = 'stop') {
  return Response.json({
    id: 'modal-completion-test',
    object: 'chat.completion',
    model: 'test-only',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: finishReason }]
  });
}

// Route each provider to its own queue of responses and record what was sent.
function mockProviders(t, { openai = [], modal = [] }) {
  const calls = { openai: [], modal: [] };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const body = JSON.parse(options.body);
    if (url === OPENAI_URL) {
      calls.openai.push(body);
      const next = openai.shift();
      assert.ok(next, 'unexpected Responses API call');
      return next();
    }
    if (url === MODAL_URL) {
      calls.modal.push(body);
      const next = modal.shift();
      assert.ok(next, 'unexpected Modal call');
      return next();
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  return calls;
}

async function readEvents(response) {
  const text = await response.text();
  return text.split(/\n\n/).filter(Boolean).map((block) => {
    const event = block.match(/^event: (.*)$/m)?.[1];
    const data = block.match(/^data: (.*)$/m)?.[1];
    return { event, data: data ? JSON.parse(data) : null };
  });
}

function finalizedProvider(db) {
  const update = db.writes.find(({ sql }) => sql.includes('UPDATE follow_up_usage') && sql.includes('provider = ?'));
  return update?.args[4];
}

describe('follow-up falls back to the reading provider', () => {
  const failures = {
    'an in-stream credits error': () => sse({ type: 'error', code: 'insufficient_quota', message: 'You have no credits remaining.' }),
    'an HTTP 429': () => new Response(JSON.stringify({ error: { message: 'You exceeded your current quota.' } }), { status: 429 }),
    'a stream with no text': () => sse({ type: 'response.completed', response: { status: 'completed' } })
  };

  for (const [label, failure] of Object.entries(failures)) {
    test(`answers from Modal after ${label}`, async (t) => {
      const calls = mockProviders(t, { openai: [failure], modal: [() => modalCompletion(MODAL_TEXT)] });
      const db = database();

      const response = await onRequestPost({ env: { ...ENV, DB: db }, request: followUpRequest({ stream: true }) });

      assert.equal(response.status, 200);
      const events = await readEvents(response);
      assert.equal(events.find(e => e.event === 'meta').data.provider, 'modal-qwen');
      assert.equal(events.find(e => e.event === 'done').data.fullText, MODAL_TEXT);
      assert.equal(finalizedProvider(db), 'modal-qwen');

      // Modal has no tools, so its prompt must not offer the memory tool the Responses call had.
      assert.ok(calls.openai[0].instructions.includes('save_memory_note'));
      const [system, user] = calls.modal[0].messages;
      assert.equal(system.role, 'system');
      assert.ok(!system.content.includes('save_memory_note'));
      assert.ok(user.content.includes(QUESTION));
    });
  }

  test('keeps the Responses API answer when it succeeds', async (t) => {
    const calls = mockProviders(t, {
      openai: [() => sse(
        { type: 'response.output_text.delta', delta: OPENAI_TEXT },
        { type: 'response.output_text.done', text: OPENAI_TEXT }
      )]
    });
    const db = database();

    const response = await onRequestPost({ env: { ...ENV, DB: db }, request: followUpRequest({ stream: true }) });

    const events = await readEvents(response);
    assert.equal(events.find(e => e.event === 'meta').data.provider, 'azure-responses-stream-buffered');
    assert.equal(events.find(e => e.event === 'done').data.fullText, OPENAI_TEXT);
    assert.equal(calls.modal.length, 0);
  });

  test('repairs an out-of-spread card with Modal once Modal has answered', async (t) => {
    const calls = mockProviders(t, {
      openai: [failures['an in-stream credits error']],
      modal: [
        () => modalCompletion(`${MODAL_TEXT} The Tower in your path warns of sudden change.`),
        () => modalCompletion(MODAL_TEXT)
      ]
    });

    const response = await onRequestPost({ env: { ...ENV, DB: database() }, request: followUpRequest({ stream: true }) });

    const events = await readEvents(response);
    assert.equal(events.find(e => e.event === 'done').data.fullText, MODAL_TEXT);
    assert.equal(calls.openai.length, 1, 'the failed Responses API is not asked to repair');
    assert.match(calls.modal[1].messages[0].content, /card-set grounding/);
  });

  test('returns the retry message when Modal fails too', async (t) => {
    mockProviders(t, {
      openai: [failures['an in-stream credits error']],
      modal: [() => modalCompletion('A reading cut short', 'length')]
    });
    const db = database();

    const response = await onRequestPost({ env: { ...ENV, DB: db }, request: followUpRequest({ stream: true }) });

    assert.equal(response.status, 503);
    const events = await readEvents(response);
    assert.equal(events.find(e => e.event === 'error').data.message, RETRY_MESSAGE);
    assert.ok(db.writes.some(({ sql }) => sql.includes('DELETE FROM follow_up_usage') && sql.includes('WHERE id = ?')), 'reservation released');
  });

  test('keeps the Responses API error when Modal is not configured', async (t) => {
    const calls = mockProviders(t, { openai: [failures['an in-stream credits error']] });
    const withoutModal = { ...ENV, MODAL_PROXY_TOKEN: '', MODAL_ENDPOINT_URL: '', MODAL_MODEL: '' };

    const response = await onRequestPost({ env: { ...withoutModal, DB: database() }, request: followUpRequest({ stream: true }) });

    assert.equal(response.status, 503);
    assert.equal(calls.modal.length, 0);
  });

  test('non-streaming requests fall back to Modal too', async (t) => {
    const calls = mockProviders(t, {
      openai: [() => new Response(JSON.stringify({ error: { message: 'Incorrect API key provided.' } }), { status: 401 })],
      modal: [() => modalCompletion(MODAL_TEXT)]
    });
    const db = database();

    const response = await onRequestPost({
      env: { ...ENV, FEATURE_FOLLOW_UP_MEMORY: 'false', DB: db },
      request: followUpRequest({ stream: false })
    });

    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.response, MODAL_TEXT);
    assert.equal(data.meta.provider, 'modal-qwen');
    assert.equal(finalizedProvider(db), 'modal-qwen');
    assert.equal(calls.openai.length, 1);
  });
});
