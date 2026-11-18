import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { createNarrationWorkerFixture } from './helpers/narrationWorker.mjs';

const require = createRequire(import.meta.resolve('miniflare'));
const skipTcpReset = process.platform === 'win32' && require('workerd/package.json').version === '1.20260926.1'
  && !process.env.MINIFLARE_WORKERD_PATH && process.env.TABLEU_TEST_NARRATION_TCP_RESET !== '1'
  ? 'Bundled Windows workerd does not signal the TCP reset. Set TABLEU_TEST_NARRATION_TCP_RESET=1 to retest.'
  : false;

async function until(predicate, message) {
  const end = Date.now() + 4500;
  while (Date.now() < end) {
    if (await predicate()) return;
    await delay(20);
  }
  assert.fail(message);
}
for (const explicitAbort of [false, true]) for (const providerId of ['deepgram', 'elevenlabs']) for (const stream of [false, true]) for (const mode of ['headers', 'body']) {
  const reason = explicitAbort ? 'Request abort' : 'HTTP disconnect';
  test(`${reason}: ${providerId}, ${stream ? 'streamed' : 'buffered'}, ${mode === 'headers' ? 'before provider headers' : 'after provider bytes'}`, {
    timeout: 20000, skip: !explicitAbort && skipTcpReset
  }, async () => {
    const fixture = await createNarrationWorkerFixture({ mode });
    const { url, db, provider } = fixture;
    let headersSeen = false;
    let bytesSeen = false;
    const headers = { 'content-type': 'application/json' };
    if (explicitAbort) headers['x-fixture-abort'] = 'true';
    const req = http.request(new URL(`api/tts${stream ? '?stream=true' : ''}`, url), {
      method: 'POST', headers
    });
    req.on('error', () => {});
    req.on('response', response => {
      headersSeen = true;
      response.on('error', () => {});
      response.on('data', () => { bytesSeen = true; });
    });
    try {
      req.end(JSON.stringify({ text: 'Synthetic disconnect fixture.', provider: providerId }));
      await until(() => provider.calls === 1, 'provider never dispatched');
      if (mode === 'body') {
        await until(() => provider.observed > 0, 'Worker never consumed provider bytes');
        if (stream) await until(() => bytesSeen, 'stream never reached HTTP client');
        else assert.equal(headersSeen, false, 'buffered assembly must still be pending');
      }
      if (explicitAbort) fixture.abort();
      else {
        // A FIN alone can be interpreted as a valid request half-close.
        req.socket.resetAndDestroy();
        req.destroy();
      }
      await until(async () => (await db.prepare('SELECT reserved FROM narration_monthly_usage').first())?.reserved === 0,
        'cancellation did not resolve reservation within five seconds');
      const usage = await db.prepare('SELECT used, reserved FROM narration_monthly_usage').first();
      assert.deepEqual(usage, { used: providerId === 'elevenlabs' && mode === 'body' ? 1 : 0, reserved: 0 });
      assert.equal(provider.calls, 1);
      const followup = await fetch(new URL('api/tts', url), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Follow-up fixture.', provider: providerId }) });
      assert.equal(followup.status, 200, await followup.clone().text());
      await followup.arrayBuffer();
      assert.equal(provider.calls, 2);
    } finally { req.destroy(); await fixture.close(); }
  });
}
