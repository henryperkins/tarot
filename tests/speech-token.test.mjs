import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet, onRequestPost } from '../functions/api/speech-token.js';

for (const [method, handler] of [['GET', onRequestGet], ['POST', onRequestPost]]) {
  test(`retired speech-token ${method} cannot authenticate, debit, read secrets, or call Azure`, async t => {
    const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Retired speech tokens must never call an upstream'); });
    const env = new Proxy({}, { get() { throw new Error('Retired speech tokens must never read environment bindings'); } });
    const request = new Proxy({}, { get() { throw new Error('Retired speech tokens must never resolve authentication'); } });
    const response = await handler({ request, env });
    assert.equal(response.status, 410);
    assert.match(response.headers.get('content-type'), /application\/json/);
    const payload = await response.json();
    assert.equal(payload.errorCode, 'SPEECH_PROVIDER_RETIRED');
    assert.equal(payload.token, undefined);
    assert.equal(fetch.mock.callCount(), 0);
  });
}
