import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCreativeQuestion, callLlmApi } from '../src/lib/intentionCoach.js';

const PARAMS = { topic: 'relationships', timeframe: 'week', depth: 'guided', seed: 'refinement' };
const ORIGINAL = 'What can help me speak more openly with my sister before November 2?';
const jsonResponse = body => ({ ok: true, json: async () => body });

describe('coach explicit question refinement boundary', () => {
  it('sends current wording as refinement input with defaults subordinate to its concern and timing', async (t) => {
    let sent;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      sent = JSON.parse(options.body);
      return jsonResponse({ question: 'How can I speak openly with my sister before November 2?', provider: 'workers-ai', forecast: null });
    });
    const result = await buildCreativeQuestion({ ...PARAMS, questionText: ORIGINAL });
    assert.equal(sent.metadata.questionText, ORIGINAL);
    assert.ok(/refine/i.test(sent.prompt));
    assert.ok(sent.prompt.includes(ORIGINAL));
    assert.ok(/preserve.*subject|subject.*preserve/i.test(sent.prompt));
    assert.ok(/timeframe|timing/i.test(sent.prompt));
    assert.equal(result.question, 'How can I speak openly with my sister before November 2?');
  });

  it('retains exact current wording after a network failure', async (t) => {
    t.mock.method(console, 'error', () => {});
    t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });
    assert.deepEqual(await buildCreativeQuestion({ ...PARAMS, questionText: ORIGINAL }), {
      question: ORIGINAL, source: 'local-preserved', forecast: null
    });
  });

  it('rejects non-string, blank, array and object questions before they can become editor text', async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => jsonResponse({ question: null }));
    for (const question of [{ text: 'bad shape' }, ['bad shape'], 42, true, '   ', null]) {
      fetchMock.mock.mockImplementation(async () => jsonResponse({ question, provider: 'workers-ai', forecast: null }));
      assert.deepEqual(await buildCreativeQuestion({ ...PARAMS, questionText: ORIGINAL }), {
        question: ORIGINAL, source: 'local-preserved', forecast: null
      }, JSON.stringify(question));
    }
  });

  it('uses a local template for malformed questions when there is no existing wording', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => jsonResponse({ question: { text: 'bad shape' }, provider: 'workers-ai' }));
    const result = await buildCreativeQuestion(PARAMS);
    assert.equal(result.source, 'local');
    assert.equal(typeof result.question, 'string');
    assert.ok(result.question.endsWith('?'));
  });

  it('rejects malformed forecast collections rather than sending truthy values to the view', async (t) => {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => jsonResponse({}));
    for (const forecast of [
      { highlights: { text: 'not an array' } },
      { highlights: ['Full Moon', { text: 'not text' }] },
      { highlights: 'not an array' },
      { highlights: ['Full Moon'], source: { name: 'bad source' } },
      { highlights: ['Full Moon'], days: { number: 30 } },
      ['Full Moon']
    ]) {
      fetchMock.mock.mockImplementation(async () => jsonResponse({ question: 'How can I speak openly with my sister?', provider: 'workers-ai', forecast }));
      assert.deepEqual(await buildCreativeQuestion({ ...PARAMS, questionText: ORIGINAL }), {
        question: ORIGINAL, source: 'local-preserved', forecast: null
      }, JSON.stringify(forecast));
    }
  });

  it('accepts valid optional forecast data and keeps the model question intact', async (t) => {
    const forecast = { days: 30, highlights: ['Full Moon in Aries'], source: 'astronomy-engine' };
    t.mock.method(globalThis, 'fetch', async () => jsonResponse({ question: 'How can I speak openly with my sister?', provider: 'workers-ai', forecast }));
    assert.deepEqual(await buildCreativeQuestion({ ...PARAMS, questionText: ORIGINAL }), {
      question: 'How can I speak openly with my sister?', source: 'workers-ai', forecast
    });
  });

  it('propagates aborts instead of returning fallback wording', async (t) => {
    const controller = new AbortController();
    t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
      controller.abort();
      throw signal.reason;
    });
    await assert.rejects(buildCreativeQuestion({ ...PARAMS, questionText: ORIGINAL }, { signal: controller.signal }), { name: 'AbortError' });
  });

  it('refuses already-aborted requests before starting a fetch', async (t) => {
    const controller = new AbortController();
    controller.abort();
    t.mock.method(globalThis, 'fetch', () => assert.fail('An aborted refinement must not start a request'));
    await assert.rejects(callLlmApi('Refine my question', {}, { signal: controller.signal }), { name: 'AbortError' });
  });
});
