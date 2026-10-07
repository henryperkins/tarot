import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequestPost } from '../functions/api/tarot-reading.js';
import { buildSelectiveEvalGatePolicy } from '../functions/lib/evalGatePolicy.js';
import { ReadingJob } from '../src/worker/readingJob.js';

const basePayload = {
  spreadInfo: { name: 'One-Card Insight' },
  cardsInfo: [{ position: 'One-Card Insight', card: 'The Fool', orientation: 'Upright', meaning: 'New beginnings' }],
  userQuestion: 'What opens next?', reflectionsText: ''
};
const reading = (advice) => `### Opening\n\n**The Fool** invites curiosity about this moment.\n\n### Guidance\n\nThe Fool reflects a new beginning. ${advice}\n\n### Closing\n\nChoose one gentle step that fits your situation.`;

async function runReading(t, { stream = false, providerStream = false, question = basePayload.userQuestion, advice = 'Consider reflecting on your next step.', evalResponse, evalDisabled = false } = {}) {
  const counters = new Map();
  const writes = [];
  const background = [];
  let providerRequests = 0;
  let evaluatorRequests = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(String(url), /example\.com/);
    providerRequests += 1;
    if (JSON.parse(options.body).stream) {
      const text = reading(advice);
      return new Response(`event: response.output_text.delta\ndata: ${JSON.stringify({ type: 'response.output_text.delta', delta: text })}\n\nevent: response.completed\ndata: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', output_text: text } })}\n\n`, { headers: { 'content-type': 'text/event-stream' } });
    }
    return Response.json({ status: 'completed', output_text: reading(advice), usage: { input_tokens: 10, output_tokens: 20 } });
  });
  const env = {
    AZURE_OPENAI_API_KEY: 'synthetic-test-key', AZURE_OPENAI_ENDPOINT: 'https://example.com', AZURE_OPENAI_GPT5_MODEL: 'gpt-5',
    AZURE_OPENAI_STREAMING_ENABLED: String(providerStream), ALLOW_STREAMING_WITH_EVAL_GATE: 'true', EVAL_ENABLED: evalDisabled ? 'false' : 'true', EVAL_GATE_ENABLED: 'false', EVAL_GATE_FAILURE_MODE: 'closed', EVAL_GATE_TIMEOUT_MS: '5',
    STREAMING_SAFETY_SCAN_ENABLED: 'false', STREAMING_QUALITY_GATE_ENABLED: 'false', GRAPHRAG_ENABLED: 'false',
    RATELIMIT: { get: async (key) => counters.get(key) || null, put: async (key, value) => { counters.set(key, value); writes.push(value); } },
    AI: { run: async (...args) => {
      evaluatorRequests += 1;
      if (typeof evalResponse === 'function') return evalResponse(...args);
      if (evalResponse instanceof Error) throw evalResponse;
      return { response: JSON.stringify(evalResponse || { personalization: 4, tarot_coherence: 4, tone: 4, safety: 4, overall: 4, safety_flag: false }) };
    } }
  };
  const response = await onRequestPost({
    request: new Request(`http://localhost/api/tarot-reading${stream ? '?stream=true' : ''}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' },
      body: JSON.stringify({ ...basePayload, userQuestion: question })
    }), env, waitUntil: (promise) => background.push(promise)
  });
  await Promise.all(background);
  const body = await response.text();
  const events = response.headers.get('content-type')?.includes('text/event-stream')
    ? body.split(/\n\n/).filter(Boolean).map((block) => {
      const data = block.split('\n').find((line) => line.startsWith('data:'));
      return data ? JSON.parse(data.slice(5)) : null;
    }).filter(Boolean) : [];
  return { status: response.status, payload: events.length ? events.at(-1) : JSON.parse(body), body, writes, counters, providerRequests, evaluatorRequests };
}

test('buffered provider SSE evaluation outage does not regenerate a reading through fallback providers', async (t) => {
  const result = await runReading(t, { stream: true, providerStream: true, question: 'How should I reflect on my debt?', evalResponse: new Error('synthetic unavailable') });
  assert.equal(result.status, 503);
  assert.equal(result.payload.code, 'reading_safety_unavailable');
  assert.deepEqual(result.writes, ['1', '0']);
  assert.equal(result.providerRequests, 1);
  assert.equal(result.evaluatorRequests, 1);
});

for (const word of ['rest', 'sleep', 'balance', 'stress', 'heal']) {
  test(`benign ${word} context does not classify the reading as medical risk`, () => {
    const policy = buildSelectiveEvalGatePolicy({ env: { EVAL_ENABLED: 'true', EVAL_GATE_ENABLED: 'false' }, context: 'wellbeing', languageSupport: { supported: true, language: 'en' }, userQuestion: `How can I make room for ${word}?` });
    assert.equal(policy.forced, false);
  });
}

for (const stream of [false, true]) {
  for (const [field, value] of [['personalization', null], ['safety', null], ['tone', ''], ['overall', false], ['tarot_coherence', []]]) {
    test(`${stream ? 'SSE' : 'JSON'} invalid ${field} is retryable rather than a score`, async (t) => {
      const result = await runReading(t, { stream, question: 'How should I reflect on my debt?', evalResponse: {
        personalization: 4, tarot_coherence: 4, tone: 4, safety: 4, overall: 4, safety_flag: false, [field]: value
      } });
      assert.equal(result.status, 503);
      assert.equal(result.payload.code, 'reading_safety_unavailable');
      assert.deepEqual(result.writes, ['1', '0']);
    });
  }
  test(`${stream ? 'SSE' : 'JSON'} a noncooperative evaluator still times out and refunds`, async (t) => {
    const result = await Promise.race([
      runReading(t, { stream, question: 'How should I reflect on my debt?', evalResponse: () => new Promise(() => {}) }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Evaluator outlived hard deadline')), 100))
    ]);
    assert.equal(result.status, 503);
    assert.equal(result.payload.code, 'reading_safety_unavailable');
    assert.deepEqual(result.writes, ['1', '0']);
    assert.equal(result.evaluatorRequests, 1);
  });
  test(`${stream ? 'SSE' : 'JSON'} blocks unexpected medical instructions with the global gate off`, async (t) => {
    const result = await runReading(t, { stream, advice: 'Stop taking your medication.' });
    assert.equal(result.status, 200);
    assert.equal(result.payload.provider, 'safe-fallback');
    assert.equal(result.payload.gateBlocked, true);
    assert.doesNotMatch(result.body, /Stop taking your medication/);
  });
  test(`${stream ? 'SSE' : 'JSON'} evaluator outage is retryable and releases its reserved allowance once`, async (t) => {
    const result = await runReading(t, { stream, question: 'How should I reflect on my debt?', evalResponse: new Error('synthetic unavailable') });
    assert.equal(result.status, 503);
    assert.equal(result.payload.code, 'reading_safety_unavailable');
    assert.equal(result.payload.retryable, true);
    assert.match(result.payload.message, /try again/i);
    assert.doesNotMatch(result.body, /A Moment of Reflection/);
    assert.deepEqual(result.writes, ['1', '0']);
  });
  test(`${stream ? 'SSE' : 'JSON'} evaluator timeout preserves the allowance and retry status`, async (t) => {
    const result = await runReading(t, {
      stream, question: 'How should I reflect on my debt?',
      evalResponse: (_model, _payload, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(Object.assign(new Error('synthetic timeout'), { name: 'AbortError' })), { once: true });
      })
    });
    assert.equal(result.status, 503);
    assert.equal(result.payload.retryable, true);
    assert.deepEqual(result.writes, ['1', '0']);
  });
}

for (const failure of [new Error('synthetic unavailable'), { safety_flag: false }]) {
  test(`non-English evaluator ${failure instanceof Error ? 'outage' : 'incomplete scores'} cannot mark unsafe Spanish text safe`, async (t) => {
    const result = await runReading(t, { question: '¿Cómo puedo avanzar?', advice: 'Deja de tomar tu medicamento.', evalResponse: failure });
    assert.equal(result.status, 503);
    assert.equal(result.payload.code, 'reading_safety_unavailable');
    assert.equal(result.payload.retryable, true);
    assert.deepEqual(result.writes, ['1', '0']);
  });
}

test('non-English benign reading is delivered after a complete passing model check', async (t) => {
  const result = await runReading(t, { question: '¿Cómo puedo avanzar?', advice: 'Considera un paso pequeño para explorar tus opciones.' });
  assert.equal(result.status, 200);
  assert.equal(result.payload.provider, 'azure-gpt5');
  assert.match(result.payload.reading, /Considera un paso/);
  assert.deepEqual(result.writes, ['1']);
});

for (const [question, advice] of [
  ['¿Cómo puedo avanzar?', 'Deja de tomar tu medicamento.'],
  ['Comment puis-je avancer dans cette situation ?', 'Arrête de prendre ton médicament.']
]) {
  test(`unsafe ${question.startsWith('¿') ? 'Spanish' : 'French'} output is withheld when the required model flags it`, async (t) => {
    const result = await runReading(t, { question, advice, evalResponse: { personalization: 3, tarot_coherence: 3, tone: 3, safety: 1, overall: 1, safety_flag: true } });
    assert.equal(result.status, 200);
    assert.equal(result.payload.provider, 'safe-fallback');
    assert.equal(result.payload.gateBlocked, true);
    assert.ok(!result.body.includes(advice));
    assert.match(result.payload.reading, /withheld.*safety checks/);
  });
}

test('benign French reflection is delivered after a complete passing assessment', async (t) => {
  const result = await runReading(t, { question: 'Comment puis-je avancer dans cette situation ?', advice: 'Tu peux explorer cette situation avec curiosité.' });
  assert.equal(result.status, 200);
  assert.equal(result.payload.provider, 'azure-gpt5');
  assert.deepEqual(result.writes, ['1']);
});

test('non-English reading cannot bypass required model checking when evaluation is disabled', async (t) => {
  const result = await runReading(t, { question: '¿Cómo puedo avanzar?', evalDisabled: true });
  assert.equal(result.status, 503);
  assert.equal(result.payload.code, 'reading_safety_unavailable');
  assert.deepEqual(result.writes, ['1', '0']);
});

test('a known unsafe English output remains a safety rejection when required evaluation is disabled', async (t) => {
  const result = await runReading(t, { question: 'How should I reflect on my debt?', advice: 'Stop taking your medication.', evalDisabled: true });
  assert.equal(result.status, 200);
  assert.equal(result.payload.provider, 'safe-fallback');
  assert.equal(result.payload.gateBlocked, true);
  assert.deepEqual(result.writes, ['1']);
});

for (const advice of [
  'Puedes avanzar con curiosidad en esta lectura. Deja de tomar tu medicamento.',
  'Tu peux avancer dans cette situation. Arrête de prendre ton médicament.'
]) {
  test('confidently detected non-English output requires assessment even with an English question', async (t) => {
    const result = await runReading(t, { advice, evalResponse: new Error('synthetic unavailable') });
    assert.equal(result.status, 503);
    assert.equal(result.payload.code, 'reading_safety_unavailable');
    assert.deepEqual(result.writes, ['1', '0']);
  });
}

test('reading jobs retain the retryable failure and user message', async () => {
  const job = new ReadingJob({ blockConcurrencyWhile: (callback) => callback(), storage: { get: async () => null, put: async () => {}, setAlarm: async () => {} }, waitUntil: () => {} }, {});
  await job.initialized;
  job.job.status = 'running';
  await job.consumeResponse(Response.json({ code: 'reading_safety_unavailable', retryable: true, message: 'We could not check your reading. Please try again.' }, { status: 503 }));
  assert.equal(job.events.at(-1).data.code, 'reading_safety_unavailable');
  assert.equal(job.events.at(-1).data.retryable, true);
  assert.match(job.events.at(-1).data.message, /try again/);
});
