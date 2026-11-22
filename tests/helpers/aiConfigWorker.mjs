import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { convertV4MiniflareOptions, Log, LogLevel, Miniflare } from 'miniflare';
import { unstable_splitSqlQuery as splitSql } from 'wrangler';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const ADMIN_FIXTURE_KEY = 'local-dashboard-fixture';

// The real Worker entrypoint, D1, and SQLite DO. Its in-memory state and
// random loopback port are independent of the developer's Wrangler instance.
export async function createAiConfigWorker({ openAIStub, workersAiStub, ownerGatewayStub, bindings = {} } = {}) {
  const config = await readFile(path.join(root, 'wrangler.jsonc'), 'utf8');
  // The real AI binding accepts AbortSignal in AI.run's options. Keep that
  // signal in the calling isolate when translating its call to the local stub.
  const entry = workersAiStub ? { stdin: { resolveDir: root, contents: `
    import application, { AdminAiSamples as Samples } from './src/worker/index.js';
    export * from './src/worker/index.js';
    function withStub(env) {
      return { ...env, AI: { async run(model, input, options = {}) {
        const response = await env.MODEL_FIXTURE.fetch('https://synthetic.invalid/run', {
          method: 'POST', body: JSON.stringify({model, input}), signal: options.signal
        });
        if (!response.ok) throw new Error('Fixture model unavailable');
        return response.json();
      } } };
    }
    export default { fetch: (request, env, ctx) => application.fetch(request, withStub(env), ctx) };
    export class AdminAiSamples extends Samples {
      constructor(state, env) { super(state, withStub(env)); }
    }` } } : { entryPoints: [path.join(root, 'src/worker/index.js')] };
  const built = await build({
    ...entry,
    bundle: true, write: false, platform: 'browser', format: 'esm', target: 'es2022',
    logLevel: 'silent', external: ['cloudflare:*', 'node:*'], conditions: ['workerd', 'worker', 'browser']
  });
  const outboundOrigins = [];
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: built.outputFiles[0].text,
    compatibilityDate: config.match(/"compatibility_date":\s*"([^"]+)"/)[1],
    compatibilityFlags: JSON.parse(config.match(/"compatibility_flags":\s*(\[[\s\S]*?\])/)[1]),
    host: '127.0.0.1', port: 0, unsafeDirectSockets: [{ entrypoint: 'default', host: '127.0.0.1', port: 0 }],
    ...(workersAiStub && { serviceBindings: { MODEL_FIXTURE: workersAiStub } }),
    bindings: {
      ADMIN_API_KEY: ADMIN_FIXTURE_KEY, AI_CONFIG_ENABLED: 'true', AI_CONFIG_ENVIRONMENT: 'preview',
      OPENAI_MODEL: 'gpt-6.1-sol', OPENAI_REASONING_EFFORT: 'high', GRAPHRAG_ENABLED: 'false',
      ...(openAIStub && { OPENAI_API_KEY: 'stub-transport-only' }),
      EVAL_ENABLED: workersAiStub ? 'true' : 'false', EVAL_GATE_ENABLED: 'false', OTEL_TRACE_SAMPLE_RATIO: '0',
      OTLP_ENDPOINT: 'https://trace-sink.invalid/v1/traces', ...bindings
    },
    durableObjects: {
      ADMIN_AI_SAMPLES: { className: 'AdminAiSamples', useSQLite: true },
      PROVIDER_CREDENTIAL_KEYS: { className: 'ProviderCredentialKeys', useSQLite: true },
      OWNER_SUBSCRIPTION_SAMPLES: { className: 'OwnerSubscriptionSamples', useSQLite: true }
    },
    d1Databases: ['DB'],
    outboundService: request => {
      const { hostname, origin, pathname } = new URL(request.url);
      if (ownerGatewayStub && hostname === '127.0.0.1' &&
          ['/v1/subscription-status', '/v1/generate', '/v1/generate/stream'].includes(pathname)) {
        if (origin === bindings.OWNER_HOST_CODEX_URL) return ownerGatewayStub(request, 'codex-subscription');
        if (origin === bindings.OWNER_HOST_CLAUDE_URL) return ownerGatewayStub(request, 'claude-code');
      }
      if (openAIStub && request.url === 'https://api.openai.com/v1/responses') return openAIStub(request);
      // Exercise the production tracing wrappers and terminate exports inside
      // the fixture. Sentry's DSN is compiled into the Worker entrypoint.
      if (hostname === 'trace-sink.invalid' || hostname.endsWith('.sentry.io')) return Response.json({});
      outboundOrigins.push(new URL(request.url).origin);
      throw new Error('External network blocked in the dashboard fixture');
    },
    log: new Log(LogLevel.NONE)
  }));
  try {
    await mf.ready;
    const db = await mf.getD1Database('DB');
    const migrations = path.join(root, 'migrations');
    const files = (await readdir(migrations)).filter(file => /^\d+.*\.sql$/.test(file)).sort();
    for (const file of files) {
      const statements = splitSql(await readFile(path.join(migrations, file), 'utf8'));
      if (statements.length) await db.batch(statements.map(sql => db.prepare(sql)));
    }
    return { url: new URL(await mf.unsafeGetDirectURL()).origin, db, close: () => mf.dispose(), outboundOrigins };
  } catch (error) {
    await mf.dispose();
    throw error;
  }
}
