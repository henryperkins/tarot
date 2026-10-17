import { timingSafeEqual } from '../functions/lib/crypto.js';

export const RUNTIME_CANARY_PATH = '/api/health/runtime/background';
export const RUNTIME_CANARY_DELAY_MS = 45000;
const RETENTION_MS = 60 * 60 * 1000;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const RUNTIME_CANARY_SCHEMA = `CREATE TABLE IF NOT EXISTS tableu_runtime_canaries (
  id VARCHAR(36) COLLATE utf8mb4_bin PRIMARY KEY,
  revision VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  status VARCHAR(16) NOT NULL,
  delay_ms BIGINT NOT NULL,
  started_at BIGINT NOT NULL,
  completed_at BIGINT NULL,
  expires_at BIGINT NOT NULL,
  INDEX tableu_runtime_canaries_expiry (expires_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`;
const schemas = new WeakMap();

function reply(status, data, headers = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function check(result) {
  if (result?.success === false) throw new Error('Runtime canary database unavailable.');
  return result;
}

async function schema(db) {
  let pending = schemas.get(db);
  if (!pending) {
    pending = Promise.resolve(db.prepare(RUNTIME_CANARY_SCHEMA).run()).then(check).catch((error) => {
      schemas.delete(db);
      throw error;
    });
    schemas.set(db, pending);
  }
  await pending;
}

/**
 * Explicitly enabled, administrator-only probe. It performs no provider calls,
 * stores no credentials, and cannot enable reading jobs. A pending result is
 * inconclusive: only a durable completion observed from a later request proves
 * this probe's lower bound on the background lifetime of this exact build.
 *
 * Parent handler calls this only for RUNTIME_CANARY_PATH and its /id suffix.
 * Tests inject the clock/sleep; deployed calls use a real 45-second timer.
 */
export async function handleRuntimeCanary({ request, env, ctx, revision }, {
  now = Date.now,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  delayMs = RUNTIME_CANARY_DELAY_MS
} = {}) {
  if (env.TABLEU_RUNTIME_CANARY_ENABLED !== 'true') return reply(404, { error: 'Not found.' });
  const secret = env.TABLEU_RUNTIME_CANARY_TOKEN || env.ADMIN_API_KEY;
  if (typeof secret !== 'string' || secret.length < 24) {
    return reply(503, { error: 'Runtime canary authentication unavailable.' });
  }
  if (!timingSafeEqual(request.headers.get('Authorization') || '', `Bearer ${secret}`)) {
    return reply(401, { error: 'Unauthorized.' });
  }
  if (typeof revision !== 'string' || !revision || revision.length > 128) {
    return reply(503, { error: 'Runtime canary build identity unavailable.' });
  }
  if (!Number.isInteger(delayMs) || delayMs <= 30000 || delayMs > 65000) {
    return reply(503, { error: 'Runtime canary delay must exceed 30 seconds and remain bounded.' });
  }
  const pathname = new URL(request.url).pathname;
  const id = pathname.startsWith(`${RUNTIME_CANARY_PATH}/`)
    ? pathname.slice(RUNTIME_CANARY_PATH.length + 1) : null;
  if ((id !== null && !ID_PATTERN.test(id)) || (id === null && pathname !== RUNTIME_CANARY_PATH)) {
    return reply(404, { error: 'Not found.' });
  }
  const expectedMethod = id === null ? 'POST' : 'GET';
  if (request.method !== expectedMethod) return reply(405, { error: 'Method not allowed.' }, { Allow: expectedMethod });
  if (id === null && typeof ctx?.waitUntil !== 'function') {
    return reply(503, { error: 'Runtime canary requires background execution support.' });
  }
  const db = env.TABLEU_NATIVE_DB || env.DB;
  if (!db?.prepare) return reply(503, { error: 'Runtime canary database unavailable.' });
  try {
    await schema(db);
    if (id !== null) {
      const row = await db.prepare('SELECT * FROM tableu_runtime_canaries WHERE id = ?').bind(id).first();
      if (!row) return reply(404, { error: 'Runtime canary not found.' });
      if (now() >= Number(row.expires_at)) {
        await db.prepare('DELETE FROM tableu_runtime_canaries WHERE id = ?').bind(id).run();
        return reply(410, { error: 'Runtime canary expired.' });
      }
      if (row.revision !== revision) return reply(409, { error: 'Runtime canary belongs to a different build.' });
      const startedAt = Number(row.started_at);
      const completedAt = row.completed_at === null ? null : Number(row.completed_at);
      const elapsedMs = completedAt === null ? null : completedAt - startedAt;
      const completed = row.status === 'complete' && elapsedMs >= Number(row.delay_ms);
      return reply(200, {
        id, revision, status: row.status, delayMs: Number(row.delay_ms), startedAt,
        completedAt, elapsedMs, expiresAt: Number(row.expires_at),
        completedAfterDelay: completed,
        // The client must also measure elapsed time from receipt of POST's
        // 202 response and confirm the exact published source/file hash.
        providerLifetimeVerified: false
      });
    }

    const created = crypto.randomUUID();
    const startedAt = now();
    const expiresAt = startedAt + RETENTION_MS;
    check(await db.prepare('DELETE FROM tableu_runtime_canaries WHERE expires_at <= ?').bind(startedAt).run());
    check(await db.prepare(`INSERT INTO tableu_runtime_canaries
      (id, revision, status, delay_ms, started_at, completed_at, expires_at)
      VALUES (?, ?, 'pending', ?, ?, NULL, ?)`)
      .bind(created, revision, delayMs, startedAt, expiresAt).run());
    const task = async () => {
      try {
        await sleep(delayMs);
        check(await db.prepare(`UPDATE tableu_runtime_canaries SET status = 'complete', completed_at = ?
          WHERE id = ? AND revision = ? AND status = 'pending' AND expires_at > ?`)
          .bind(now(), created, revision, now()).run());
      } catch {
        // Leave pending rather than falsely reporting success. Requesting this
        // probe again cannot rerun provider work or write application state.
      }
    };
    ctx.waitUntil(task());
    return reply(202, { id: created, revision, status: 'pending', delayMs, startedAt, expiresAt }, {
      Location: `${RUNTIME_CANARY_PATH}/${created}`
    });
  } catch {
    return reply(503, { error: 'Runtime canary temporarily unavailable.' });
  }
}
