import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet, onRequestPost } from '../functions/api/tts.js';
import { onRequestGet as health } from '../functions/api/health/tts.js';
import { createD1 } from './helpers/d1Sqlite.mjs';

const request = stream => new Request(`https://example.test/api/tts${stream ? '?stream=true' : ''}`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.52' },
  body: JSON.stringify({ text: 'The Star offers a moment of renewal.' })
});

test('both narration health routes describe Deepgram as default even with an ElevenLabs key', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('Health must not synthesize'); });
  let auraCalls = 0;
  const env = { ELEVENLABS_API_KEY: 'test-only-elevenlabs-key', AI: { run() { auraCalls++; throw new Error('Health must not synthesize'); } } };
  for (const handler of [onRequestGet, health]) {
    const response = await handler({ env });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.provider, 'workers-ai-aura-2');
    assert.equal(body.model, '@cf/deepgram/aura-2-en');
    assert.equal(body.voice, 'cora');
    assert.ok(body.providers.find(provider => provider.id === 'elevenlabs').available);
  }
  assert.equal(auraCalls, 0);
  assert.equal(fetch.mock.callCount(), 0);
});

for (const stream of [false, true]) {
  test(`omitting the provider uses Deepgram for ${stream ? 'streamed' : 'buffered'} speech while ElevenLabs is unavailable`, async t => {
    const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('ElevenLabs unavailable', { status: 503 }));
    const DB = await createD1();
    const calls = [];
    const response = await onRequestPost({ request: request(stream), env: {
      DB, ELEVENLABS_API_KEY: 'test-only-elevenlabs-key',
      AI: { async run(model, input) { calls.push({ model, input }); return new Response('Deepgram MP3').body; } }
    } });
    assert.equal(response.status, 200);
    if (stream) {
      assert.equal(response.headers.get('x-tts-provider'), 'workers-ai-aura-2');
      assert.equal(await response.text(), 'Deepgram MP3');
    } else {
      const body = await response.json();
      assert.equal(body.provider, 'workers-ai-aura-2');
      assert.equal(Buffer.from(body.audio.split(',')[1], 'base64').toString(), 'Deepgram MP3');
    }
    assert.deepEqual(calls, [{ model: '@cf/deepgram/aura-2-en', input: { text: 'The Star offers a moment of renewal.', speaker: 'cora' } }]);
    assert.equal(fetch.mock.callCount(), 0);
    assert.deepEqual(DB.rows('SELECT used, reserved FROM narration_monthly_usage'), [{ used: 1, reserved: 0 }]);
  });
}

test('missing default Deepgram configuration fails before accounting without choosing ElevenLabs', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('Unexpected ElevenLabs MP3', { headers: { 'content-type': 'audio/mpeg' } }));
  const DB = await createD1();
  const env = { DB, ELEVENLABS_API_KEY: 'test-only-elevenlabs-key' };
  const response = await onRequestPost({ request: request(false), env });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).errorCode, 'SERVICE_UNAVAILABLE');
  assert.equal((await (await onRequestGet({ env })).json()).provider, 'unavailable');
  assert.equal(fetch.mock.callCount(), 0);
  assert.deepEqual(DB.rows('SELECT * FROM narration_requests'), []);
});
