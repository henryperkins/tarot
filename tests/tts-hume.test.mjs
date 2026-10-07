import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet, onRequestPost } from '../functions/api/tts-hume.js';

for (const handler of [onRequestGet, onRequestPost]) {
  test(`${handler === onRequestGet ? 'GET' : 'POST'} retired Hume does not touch authentication, accounting or inference`, async () => {
    const env = new Proxy({}, { get() { throw new Error('Retired route must not read configuration'); } });
    const response = await handler({ env });
    assert.equal(response.status, 410);
    const payload = await response.json();
    assert.ok(payload.provider === 'retired' || payload.errorCode === 'TTS_RETIRED');
  });
}
