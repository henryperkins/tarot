import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequestGet, onRequestPost, splitForSpeech } from '../functions/api/tts.js';
import { createD1 } from './helpers/d1Sqlite.mjs';

const request = (body, suffix = '') => new Request(`https://example.test/api/tts${suffix}`, { method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.40' }, body: JSON.stringify(body) });
function aura() {
  const calls = [];
  return { calls, async run(model, input) { calls.push({ model, input }); return new Response(`<${calls.length}>`).body; } };
}

for (const [body, title] of [[{}, 'missing'], [{ text: '' }, 'empty'], [{ text: '   ' }, 'blank'], [{ text: 123 }, 'non-string']]) {
  test(`rejects ${title} narration text before inference`, async () => {
    const AI = aura();
    const response = await onRequestPost({ request: request(body), env: { AI } });
    assert.equal(response.status, 400);
    assert.equal(AI.calls.length, 0);
  });
}

test('health describes the narration size and actual configured availability', async () => {
  const configured = await (await onRequestGet({ env: { AI: aura() } })).json();
  assert.equal(configured.model, '@cf/deepgram/aura-2-en');
  assert.equal(configured.maxCharacters, 64000);
  assert.equal((await (await onRequestGet({ env: {} })).json()).provider, 'unavailable');
});

test('invalid JSON returns 400', async () => {
  const invalid = new Request('https://example.test/api/tts', { method: 'POST', body: '{invalid' });
  const response = await onRequestPost({ request: invalid, env: { AI: aura() } });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'Invalid JSON payload.');
});

test('configured Aura speaks with the Cora voice and MP3 MIME type', async () => {
  const AI = aura();
  const response = await onRequestPost({ request: request({ text: '  The Fool represents beginnings.  ' }), env: { AI, DB: await createD1() } });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.provider, 'workers-ai-aura-2');
  assert.ok(payload.audio.startsWith('data:audio/mpeg;base64,'));
  assert.deepEqual(AI.calls, [{ model: '@cf/deepgram/aura-2-en', input: { text: 'The Fool represents beginnings.', speaker: 'cora' } }]);
});

test('streams ordered provider pieces and counts the complete narration once', async () => {
  const AI = aura();
  const DB = await createD1();
  const text = 'The Tower asks what was never built to last. '.repeat(160).trim();
  const response = await onRequestPost({ request: request({ text }, '?stream=true'), env: { AI, DB } });
  assert.equal(response.headers.get('content-type'), 'audio/mpeg');
  assert.equal(response.headers.get('x-tts-provider'), 'workers-ai-aura-2');
  assert.equal(await response.text(), AI.calls.map((_, i) => `<${i + 1}>`).join(''));
  assert.ok(AI.calls.length > 3);
  assert.ok(AI.calls.every(call => call.input.text.length <= 1900));
  assert.deepEqual(DB.rows('SELECT used, reserved FROM narration_monthly_usage'), [{ used: 1, reserved: 0 }]);
});

test('provider configuration absence does not produce a successful waveform or debit', async () => {
  const DB = await createD1();
  const response = await onRequestPost({ request: request({ text: 'A reading.' }), env: { DB } });
  assert.equal(response.status, 503);
  assert.deepEqual(DB.rows('SELECT * FROM narration_requests'), []);
});

test('missing accounting denies synthesis even with a configured provider', async () => {
  const AI = aura();
  const response = await onRequestPost({ request: request({ text: 'A reading.' }), env: { AI } });
  assert.equal(response.status, 503);
  assert.equal(AI.calls.length, 0);
});

test('rejects an oversized JSON body before inference', async () => {
  const AI = aura();
  const response = await onRequestPost({ request: request({ text: 'A reading.', ignored: 'x'.repeat(512 * 1024) }), env: { AI } });
  assert.equal(response.status, 413);
  assert.equal(AI.calls.length, 0);
});

test('piece splitting prefers a sentence boundary and handles unbroken text', () => {
  assert.deepEqual(splitForSpeech(' One short line. '), ['One short line.']);
  const text = 'A sentence that should end here. '.repeat(100).trim();
  assert.ok(splitForSpeech(text).every(piece => piece.length <= 1900 && piece.endsWith('.')));
  assert.deepEqual(splitForSpeech('x'.repeat(1901)).map(piece => piece.length), [1900, 1]);
});
