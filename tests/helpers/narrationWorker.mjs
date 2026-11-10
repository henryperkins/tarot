import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions, Log, LogLevel } from 'miniflare';
import { readFile } from 'node:fs/promises';

// No .dev.vars, remote bindings, credentials or external provider traffic.
export async function createNarrationWorkerFixture({ mode = 'headers' } = {}) {
  const config = await readFile(new URL('../../wrangler.jsonc', import.meta.url), 'utf8');
  const compatibilityDate = config.match(/"compatibility_date":\s*"([^"]+)"/)[1];
  const compatibilityFlags = JSON.parse(config.match(/"compatibility_flags":\s*(\[[\s\S]*?\])/)[1]);
  let calls = 0;
  let observed = 0;
  let bodyController;
  const headers = Promise.withResolvers();
  const provider = {
    get calls() { return calls; },
    get observed() { return observed; },
    releaseHeaders() { headers.resolve(); },
    finish() { try { bodyController?.close(); } catch { /* Already cancelled. */ } },
    async fetch() {
      calls++;
      if (calls > 1) return new Response('ID3 complete', { headers: { 'content-type': 'audio/mpeg' } });
      if (mode === 'headers') await headers.promise;
      return new Response(new ReadableStream({
        start(controller) {
          bodyController = controller;
          if (mode === 'body') controller.enqueue(new Uint8Array([73, 68, 51, 1]));
        }
      }), { headers: { 'content-type': 'audio/mpeg' } });
    }
  };
  const built = await build({
    stdin: { contents: `
      import { onRequestPost } from './functions/api/tts.js';
      export default { async fetch(request, env, ctx) {
        const observe = body => {
          const reader = body.getReader();
          return new ReadableStream({
            async pull(controller) {
              const { value, done } = await reader.read();
              if (done) controller.close();
              else {
                controller.enqueue(value);
                if (value.byteLength) await env.OBSERVED.fetch('https://fixture.invalid/observed');
              }
            },
            cancel() { void reader.cancel().catch(() => {}); }
          });
        };
        const fake = async () => {
          const response = await env.PROVIDER.fetch('https://fixture.invalid/synthesize');
          return new Response(observe(response.body), { headers: response.headers });
        };
        globalThis.fetch = async input => {
          if (!String(input).startsWith('https://api.elevenlabs.io/')) throw new Error('External network blocked');
          return fake();
        };
        return onRequestPost({ request, env: { ...env, AI: { run: async () => (await fake()).body } }, waitUntil: ctx.waitUntil.bind(ctx) });
      } };`, resolveDir: new URL('../../', import.meta.url).pathname },
    bundle: true, write: false, platform: 'browser', format: 'esm', target: 'es2022',
    logLevel: 'silent', external: ['cloudflare:*', 'node:*'], conditions: ['workerd', 'worker', 'browser']
  });
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: built.outputFiles[0].text,
    compatibilityDate, compatibilityFlags, host: '127.0.0.1', port: 0,
    unsafeDirectSockets: [{ entrypoint: 'default', host: '127.0.0.1', port: 0 }],
    d1Databases: ['DB'], bindings: { ELEVENLABS_API_KEY: 'fixture-not-a-credential' },
    serviceBindings: { PROVIDER: () => provider.fetch(), OBSERVED: () => { observed++; return new Response(null, { status: 204 }); } },
    outboundService: () => { throw new Error('External network blocked'); },
    log: new Log(LogLevel.NONE)
  }));
  try {
    await mf.ready;
    // Use workerd's actual HTTP socket, with Miniflare's development proxy
    // outside the disconnect path.
    const url = String(await mf.unsafeGetDirectURL());
    const db = await mf.getD1Database('DB');
    await db.prepare('CREATE TABLE users (id TEXT PRIMARY KEY)').run();
    await db.prepare('CREATE TABLE usage_tracking (user_id TEXT, month TEXT, tts_count INTEGER, created_at INTEGER, updated_at INTEGER, UNIQUE(user_id, month))').run();
    const migration = await readFile(new URL('../../migrations/0034_add_narration_reservations.sql', import.meta.url), 'utf8');
    let statement = '';
    let trigger = false;
    for (const line of migration.split('\n')) {
      const sql = line.replace(/--.*$/, '').trim();
      if (!sql) continue;
      statement += `${sql}\n`;
      if (/^CREATE TRIGGER/.test(sql)) trigger = true;
      if ((!trigger && sql.endsWith(';')) || (trigger && sql === 'END;')) {
        await db.prepare(statement).run();
        statement = ''; trigger = false;
      }
    }
    return { url, db, provider, async close() { provider.releaseHeaders(); provider.finish(); await mf.dispose(); } };
  } catch (error) { await mf.dispose(); throw error; }
}
