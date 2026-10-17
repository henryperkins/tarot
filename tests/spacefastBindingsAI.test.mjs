import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createWorkersAI } from '../spacefast/bindings/ai.js';

const credentials = { CLOUDFLARE_ACCOUNT_ID: 'example-account', CLOUDFLARE_API_TOKEN: 'test-token' };
const model = '@cf/zai-org/glm-5.3';

describe('Spacefast Workers AI HTTP adapter', () => {
  it('keeps the binding absent without both required credentials', () => {
    assert.equal(createWorkersAI({}), undefined);
    assert.equal(createWorkersAI({ CLOUDFLARE_ACCOUNT_ID: 'account' }), undefined);
    assert.equal(createWorkersAI({ CLOUDFLARE_API_TOKEN: 'token' }), undefined);
  });

  it('authenticates model calls, unwraps REST envelopes and passes abort signals', async () => {
    let request;
    const signal = new AbortController().signal;
    const ai = createWorkersAI(credentials, { fetch: async (url, init) => {
      request = { url, init };
      return Response.json({ success: true, result: { response: 'answer', usage: { total_tokens: 12 } } });
    } });
    assert.deepEqual(await ai.run(model, { messages: [{ role: 'user', content: 'Question' }] }, { signal }), {
      response: 'answer', usage: { total_tokens: 12 },
    });
    assert.equal(request.url, `https://api.cloudflare.com/client/v4/accounts/example-account/ai/run/${model}`);
    assert.equal(request.init.method, 'POST');
    assert.equal(request.init.headers.get('authorization'), 'Bearer test-token');
    assert.equal(request.init.headers.get('content-type'), 'application/json');
    assert.equal(request.init.signal, signal);
    assert.equal(request.init.redirect, 'error');
    assert.deepEqual(JSON.parse(request.init.body), { messages: [{ role: 'user', content: 'Question' }] });
  });

  it('returns raw model JSON when the provider supplies no envelope', async () => {
    const ai = createWorkersAI(credentials, { fetch: async () => Response.json({ data: [[0.2, 0.8]] }) });
    assert.deepEqual(await ai.run('@cf/baai/bge-base-en-v1.5', { text: ['a'] }), { data: [[0.2, 0.8]] });
  });

  it('preserves audio bytes and incremental SSE bodies', async () => {
    let streamingController;
    const stream = new ReadableStream({ start(controller) { streamingController = controller; } });
    const ai = createWorkersAI(credentials, { fetch: async (_url, { body }) => JSON.parse(body).stream
      ? new Response(stream, { headers: { 'content-type': 'text/event-stream' } })
      : new Response(new Uint8Array([0, 255, 127]), { headers: { 'content-type': 'audio/mpeg' } }) });
    const audio = await ai.run('@cf/deepgram/aura-2-en', { text: 'hello', speaker: 'cora' });
    assert.deepEqual(new Uint8Array(await new Response(audio).arrayBuffer()), new Uint8Array([0, 255, 127]));
    const events = await ai.run(model, { prompt: 'question', stream: true });
    const reader = events.getReader();
    streamingController.enqueue(new TextEncoder().encode('data: first\n\n'));
    assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: first\n\n');
    streamingController.enqueue(new TextEncoder().encode('data: second\n\n'));
    streamingController.close();
    assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: second\n\n');
    assert.equal((await reader.read()).done, true);
  });

  it('sends FLUX multipart data with its original boundary and no JSON wrapper', async () => {
    const form = new FormData();
    form.append('prompt', 'sunlight');
    form.append('width', '1024');
    const multipart = new Response(form);
    let sent;
    const ai = createWorkersAI(credentials, { fetch: async (_url, init) => {
      sent = new Response(init.body, { headers: init.headers });
      return Response.json({ success: true, result: { image: 'an-image' } });
    } });
    assert.deepEqual(await ai.run('@cf/black-forest-labs/flux-2-dev', {
      multipart: { body: multipart.body, contentType: multipart.headers.get('content-type') },
    }), { image: 'an-image' });
    const parsed = await sent.formData();
    assert.equal(parsed.get('prompt'), 'sunlight');
    assert.equal(parsed.get('width'), '1024');
  });

  it('routes optional gateway calls and patches their log metadata', async () => {
    const requests = [];
    const ai = createWorkersAI(credentials, { fetch: async (url, init) => {
      requests.push({ url, init });
      return Response.json({ success: true, result: { response: 'ok' } }, { headers: { 'cf-aig-log-id': 'log-123' } });
    } });
    await ai.run(model, { prompt: 'question' }, { gateway: { id: 'eval', skipCache: true, cacheTtl: 120 } });
    assert.equal(requests[0].init.headers.get('cf-aig-gateway-id'), 'eval');
    assert.equal(requests[0].init.headers.get('cf-aig-skip-cache'), 'true');
    assert.equal(requests[0].init.headers.get('cf-aig-cache-ttl'), '120');
    assert.equal(ai.aiGatewayLogId, 'log-123');
    await ai.gateway('eval').patchLog('log-123', { metadata: { requestId: 'reading-1' } });
    assert.equal(requests[1].url, 'https://api.cloudflare.com/client/v4/accounts/example-account/ai-gateway/gateways/eval/logs/log-123');
    assert.equal(requests[1].init.method, 'PATCH');
    assert.deepEqual(JSON.parse(requests[1].init.body), { metadata: { requestId: 'reading-1' } });
  });

  it('reports failed HTTP and API-envelope statuses without reflecting private upstream bodies', async () => {
    for (const status of [401, 429, 503]) {
      const ai = createWorkersAI(credentials, { fetch: async () => new Response('PRIVATE UPSTREAM BODY', { status }) });
      await assert.rejects(ai.run(model, { prompt: 'question' }), error => {
        assert.equal(error.status, status);
        assert.equal(error.message.includes('PRIVATE'), false);
        return true;
      });
    }
    const ai = createWorkersAI(credentials, { fetch: async () => Response.json({ success: false, errors: [{ code: 1000, message: 'PRIVATE' }] }) });
    await assert.rejects(ai.run(model, {}), error => error.code === 1000 && !error.message.includes('PRIVATE'));
  });

  it('lets an aborted request reject instead of converting it to an empty model answer', async () => {
    const controller = new AbortController();
    const ai = createWorkersAI(credentials, { fetch: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }) });
    const result = ai.run(model, {}, { signal: controller.signal });
    controller.abort(new DOMException('cancelled', 'AbortError'));
    await assert.rejects(result, { name: 'AbortError' });
  });

  it('rejects unsafe identifiers and incomplete multipart data before fetching', async () => {
    const ai = createWorkersAI(credentials, { fetch: async () => { throw new Error('Must not fetch'); } });
    await assert.rejects(ai.run('@cf/vendor/../../private', {}), /Invalid Workers AI model/);
    await assert.rejects(ai.run(model, { multipart: { body: new Uint8Array(), contentType: 'application/json' } }), /multipart/);
    await assert.rejects(ai.run(model, {}, { gateway: { id: '../other' } }), /Invalid AI Gateway/);
  });
});
