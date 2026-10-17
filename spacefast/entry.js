import worker from '../src/worker/index.js';
import { handleScheduled } from '../functions/lib/scheduled.js';
import { createShellAssets } from './assets.js';
import { createSpacefastDatabase } from './database/index.js';
import { createSpacefastBindings, cleanupExpiredKV } from './bindings/index.js';
import { createReadingJobsNamespace } from './jobs/index.js';
import { applySpacefastFeatureProfile } from './featureProfile.js';
import { timingSafeEqual } from '../functions/lib/crypto.js';
import { handleRuntimeCanary, RUNTIME_CANARY_PATH } from './canary.js';
import { handleDatabaseProbe, DATABASE_PROBE_PATH } from './database/probe.js';
import { html, defaults, revision } from 'tableu:spacefast-build';

async function runtimeHealth(nativeDb, ctx) {
  let database = 'unavailable';
  let dialect = 'unknown';
  try {
    const row = await nativeDb?.prepare('SELECT 1 AS ok').first();
    if (Number(row?.ok) === 1) database = 'ok';
    try {
      const version = await nativeDb.prepare('SELECT VERSION() AS version').first();
      if (version?.version) dialect = 'mysql';
    } catch {
      const version = await nativeDb.prepare('SELECT sqlite_version() AS version').first();
      if (version?.version) dialect = 'sqlite';
    }
  } catch {
    database = 'error';
  }
  return Response.json({
    status: database === 'ok' ? 'ok' : 'degraded',
    runtime: 'spacefast',
    revision,
    database,
    dialect,
    backgroundTasks: typeof ctx?.waitUntil === 'function',
  }, { status: database === 'ok' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}

export default {
  async fetch(request, nativeEnv, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/health/runtime' && request.method === 'GET') {
      return runtimeHealth(nativeEnv.DB, ctx);
    }
    const origin = new URL(request.url).origin;
    const env = applySpacefastFeatureProfile({
      ...defaults,
      ...nativeEnv,
      APP_URL: nativeEnv.APP_URL || origin,
      MCP_RESOURCE_URL: nativeEnv.MCP_RESOURCE_URL || `${origin}/mcp`,
      TABLEU_NATIVE_DB: nativeEnv.DB,
      DB: createSpacefastDatabase(nativeEnv.DB),
      ASSETS: createShellAssets(html),
      CF_VERSION_METADATA: { id: revision },
    });
    Object.assign(env, createSpacefastBindings(env));
    if (pathname === DATABASE_PROBE_PATH) return handleDatabaseProbe({ request, env, revision });
    if (pathname === RUNTIME_CANARY_PATH || pathname.startsWith(`${RUNTIME_CANARY_PATH}/`)) {
      return handleRuntimeCanary({ request, env, ctx, revision });
    }
    // Background lifetime must be verified with the configured provider before
    // enabling detached reading jobs on a production Spacefast version.
    if (env.TABLEU_READING_JOBS_ENABLED === 'true') env.READING_JOBS = createReadingJobsNamespace(env, ctx);
    // A scheduled HTTP request is explicit and authenticated. It never relies
    // on the platform exposing Cloudflare's scheduled() callback.
    const maintenance = pathname.match(/^\/api\/maintenance\/spacefast\/(video|daily)(?:\/([A-Za-z0-9_-]{32,128}))?$/);
    if (maintenance) {
      // Scheduled GETs support path-variable substitution. Header presence is
      // insufficient until the platform's inbound-header contract is verified.
      const scheduled = env.TABLEU_CRON_SECRET && maintenance[2] && timingSafeEqual(maintenance[2], env.TABLEU_CRON_SECRET);
      const manual = env.ADMIN_API_KEY && timingSafeEqual(request.headers.get('Authorization') || '', `Bearer ${env.ADMIN_API_KEY}`);
      if (!scheduled && !manual) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } });
      if (maintenance[1] === 'video') return Response.json({ status: 'retired' }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
      try {
        const outcome = await handleScheduled({ cron: '0 3 * * *', scheduledTime: Date.now() }, env, ctx, { reportFailures: true });
        if (!outcome.success) return Response.json({ status: 'error', failedTasks: outcome.failedTasks }, { status: 503 });
        if (maintenance[1] === 'daily') {
          await cleanupExpiredKV(nativeEnv.DB);
          await createReadingJobsNamespace(env, ctx).cleanupExpired();
        }
      } catch {
        return Response.json({ status: 'error' }, { status: 503 });
      }
      return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return worker.fetch(request, env, ctx);
  },
};
