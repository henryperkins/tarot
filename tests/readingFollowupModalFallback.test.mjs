import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { onRequestPost } from '../functions/api/reading-followup.js';
import { modalSseResponse } from './helpers/modalSse.mjs';
import { CLAUDE_API_URL_PREFIX, claudeErrorResponse, claudeSseResponse } from './helpers/claudeSse.mjs';

const OPENAI_URL = 'https://openai.test/v1/responses';
const MODAL_URL = 'https://modal.test/v1/chat/completions';
const QUESTION = 'What does The Hermit ask of me this week?';
const MODAL_TEXT = 'The Hermit in your Theme position asks you to slow down and listen before you act. The Sun in your Support position shows warmth from people who already back you.';
const OPENAI_TEXT = 'The Hermit in your Theme position invites a quieter week. The Sun in your Support position brings encouragement.';
const CLAUDE_TEXT = 'The Hermit in your Theme position asks for an unhurried week of listening. The Sun in your Support position shows the encouragement already around you.';
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
function mockProviders(t, { openai = [], modal = [], claude = [] }) {
  const calls = { openai: [], modal: [], claude: [] };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const body = JSON.parse(options.body);
    if (String(url).startsWith(CLAUDE_API_URL_PREFIX)) {
      calls.claude.push(body);
      const next = claude.shift();
      assert.ok(next, 'unexpected Claude API call');
      return next();
    }
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
      const calls = mockProviders(t, { openai: [failure], modal: [() => modalSseResponse(MODAL_TEXT)] });
      const db = database();

      const response = await onRequestPost({ env: { ...ENV, DB: db }, request: followUpRequest({ stream: true }) });

      assert.equal(response.status, 200);
      const events = await readEvents(response);
      assert.equal(events.find(e => e.event === 'meta').data.provider, 'modal-qwen');
      assert.equal(events.find(e => e.event === 'done').data.fullText, MODAL_TEXT);
      assert.equal(finalizedProvider(db), 'modal-qwen');
      assert.equal(calls.modal[0].stream, true);
      assert.ok(!JSON.stringify(events).includes('Private provider reasoning'));

      // This fallback supplies no tools, so its prompt must not offer the Responses memory tool.
      assert.ok(calls.openai[0].instructions.includes('save_memory_note'));
      const [system, user] = calls.modal[0].messages;
      assert.equal(system.role, 'system');
      assert.ok(!system.content.includes('save_memory_note'));
      assert.ok(user.content.includes(QUESTION));
    });
  }

  test('accepts paired Modal credentials without a legacy token or explicit model', async (t) => {
    const calls = mockProviders(t, {
      openai: [failures['an in-stream credits error']],
      modal: [() => modalSseResponse(MODAL_TEXT)]
    });
    const response = await onRequestPost({
      env: {
        ...ENV,
        MODAL_PROXY_TOKEN: '',
        MODAL_PROXY_TOKEN_ID: 'followup-test-id',
        MODAL_PROXY_TOKEN_SECRET: 'followup-test-secret',
        MODAL_MODEL: '',
        DB: database()
      },
      request: followUpRequest({ stream: true })
    });
    assert.equal(response.status, 200);
    const events = await readEvents(response);
    assert.equal(events.find(e => e.event === 'done').data.fullText, MODAL_TEXT);
    assert.equal(calls.modal[0].model, 'Qwen/Qwen3.8-Max-VL-Thinking');
    assert.equal(calls.modal[0].reasoning_effort, 'high');
  });

  test('withholds unsafe fragmented Modal content before emitting any follow-up event', async (t) => {
    const unsafeText = `${MODAL_TEXT} You should hurt him to make a point.`;
    const calls = mockProviders(t, {
      openai: [failures['an in-stream credits error']],
      modal: [() => modalSseResponse(unsafeText)]
    });
    const db = database();
    const response = await onRequestPost({
      env: { ...ENV, DB: db },
      request: followUpRequest({ stream: true })
    });
    assert.equal(response.status, 200);
    const events = await readEvents(response);
    assert.ok(events.find(e => e.event === 'done').data.fullText.length > 0);
    assert.doesNotMatch(JSON.stringify(events), /hurt him|Private provider reasoning/);
    assert.doesNotMatch(JSON.stringify(db.writes), /hurt him|Private provider reasoning/);
    assert.equal(calls.modal[0].stream, true);
  });

  test('keeps the Responses API answer when it succeeds', async (t) => {
    const calls = mockProviders(t, {
      openai: [() => sse(
        { type: 'response.output_text.delta', delta: OPENAI_TEXT },
        { type: 'response.output_text.done', text: OPENAI_TEXT },
        { type: 'response.completed', response: { status: 'completed' } }
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

describe('follow-up answers come from the Claude API first', () => {
  const CLAUDE_ENV = { ...ENV, ANTHROPIC_API_KEY: 'test-only' };

  test('streams a Claude answer without calling the Responses API or Modal', async (t) => {
    const calls = mockProviders(t, { claude: [() => claudeSseResponse([{ type: 'thinking' }, { type: 'text', text: CLAUDE_TEXT }])] });
    const db = database();

    const response = await onRequestPost({ env: { ...CLAUDE_ENV, DB: db }, request: followUpRequest({ stream: true }) });

    assert.equal(response.status, 200);
    const events = await readEvents(response);
    assert.equal(events.find(e => e.event === 'meta').data.provider, 'claude-api');
    assert.equal(events.find(e => e.event === 'done').data.fullText, CLAUDE_TEXT);
    assert.equal(finalizedProvider(db), 'claude-api');
    assert.equal(calls.openai.length + calls.modal.length, 0);
    assert.equal(calls.claude[0].model, 'claude-opus-5-5');
    assert.equal(calls.claude[0].tools[0].name, 'save_memory_note');
    assert.match(calls.claude[0].messages[0].content, /Hermit/);
  });

  test('falls back to the Responses API when Claude fails', async (t) => {
    const calls = mockProviders(t, {
      claude: [() => claudeErrorResponse(400)],
      openai: [() => sse(
        { type: 'response.output_text.delta', delta: OPENAI_TEXT },
        { type: 'response.output_text.done', text: OPENAI_TEXT },
        { type: 'response.completed', response: { status: 'completed' } }
      )]
    });
    const db = database();

    const response = await onRequestPost({ env: { ...CLAUDE_ENV, DB: db }, request: followUpRequest({ stream: true }) });

    const events = await readEvents(response);
    assert.equal(events.find(e => e.event === 'meta').data.provider, 'azure-responses-stream-buffered');
    assert.equal(events.find(e => e.event === 'done').data.fullText, OPENAI_TEXT);
    assert.equal(calls.claude.length, 1);
    assert.equal(calls.modal.length, 0);
    assert.doesNotMatch(JSON.stringify(events), /private upstream details/);
  });

  test('repairs an out-of-spread card with Claude when Claude answered', async (t) => {
    const calls = mockProviders(t, {
      claude: [
        () => claudeSseResponse(`${CLAUDE_TEXT} The Tower in your path warns of sudden change.`),
        () => claudeSseResponse(CLAUDE_TEXT)
      ]
    });

    const response = await onRequestPost({ env: { ...CLAUDE_ENV, DB: database() }, request: followUpRequest({ stream: true }) });

    const events = await readEvents(response);
    assert.equal(events.find(e => e.event === 'done').data.fullText, CLAUDE_TEXT);
    assert.equal(calls.claude.length, 2);
    assert.match(calls.claude[1].system, /card-set grounding/);
    assert.deepEqual(calls.claude[1].output_config, { effort: 'low' });
    assert.equal(calls.openai.length + calls.modal.length, 0);
  });

  test('non-streaming requests use Claude too', async (t) => {
    mockProviders(t, { claude: [() => claudeSseResponse(CLAUDE_TEXT)] });
    const db = database();

    const response = await onRequestPost({
      env: { ...CLAUDE_ENV, FEATURE_FOLLOW_UP_MEMORY: 'false', DB: db },
      request: followUpRequest({ stream: false })
    });

    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.response, CLAUDE_TEXT);
    assert.equal(data.meta.provider, 'claude-api');
    assert.equal(finalizedProvider(db), 'claude-api');
  });
});
