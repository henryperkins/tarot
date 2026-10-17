import { timingSafeEqual } from '../../functions/lib/crypto.js';
import { RUNTIME_CANARY_SCHEMA } from '../canary.js';

export const DATABASE_PROBE_PATH = '/api/health/runtime/database';

function reply(status, body, headers = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function check(result) {
  if (!result || result.success === false) throw new Error('Database probe unavailable.');
  return result;
}

function supportedVersion(row) {
  const version = String(row?.version || '');
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:[.-]|$)/);
  if (!match || /mariadb|tidb/i.test(`${version} ${row?.engine || ''}`)) return false;
  const [major, minor, patch] = match.slice(1).map(Number);
  return major > 8 || major === 8 && (minor > 0 || patch >= 17);
}

/** Administrator-only broker verification; touches only two disposable UUIDs. */
export async function handleDatabaseProbe({ request, env, revision }) {
  if (env.TABLEU_RUNTIME_CANARY_ENABLED !== 'true') return reply(404, { error: 'Not found.' });
  const secret = env.TABLEU_RUNTIME_CANARY_TOKEN || env.ADMIN_API_KEY;
  if (typeof secret !== 'string' || secret.length < 24) return reply(503, { error: 'Database probe authentication unavailable.' });
  if (!timingSafeEqual(request.headers.get('Authorization') || '', `Bearer ${secret}`)) return reply(401, { error: 'Unauthorized.' });
  if (new URL(request.url).pathname !== DATABASE_PROBE_PATH) return reply(404, { error: 'Not found.' });
  if (!['GET', 'POST'].includes(request.method)) return reply(405, { error: 'Method not allowed.' }, { Allow: 'GET, POST' });
  if (typeof revision !== 'string' || !revision || revision.length > 128) return reply(503, { error: 'Database probe build identity unavailable.' });

  const db = env.TABLEU_NATIVE_DB || env.DB;
  const checks = { nativeBinding: Boolean(db?.prepare), batchApi: typeof db?.batch === 'function' };
  const write = request.method === 'POST';
  const ids = write ? [crypto.randomUUID(), crypto.randomUUID()] : [];
  let available = checks.nativeBinding && checks.batchApi;
  try {
    if (!available) throw new Error('Database probe binding unavailable.');
    const version = await db.prepare('SELECT VERSION() AS version, @@version_comment AS engine').first();
    checks.mysqlVersion = supportedVersion(version);
    const collation = await db.prepare(`SELECT COLLATION_NAME AS name, PAD_ATTRIBUTE AS padding
      FROM INFORMATION_SCHEMA.COLLATIONS WHERE COLLATION_NAME = 'utf8mb4_0900_bin'`).first();
    checks.noPadCollation = collation?.name === 'utf8mb4_0900_bin' && collation.padding === 'NO PAD';
    const table = await db.prepare(`SELECT ENGINE AS engine, TABLE_COLLATION AS collation
      FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`).first();
    checks.applicationSchema = table?.engine === 'InnoDB' && table.collation === 'utf8mb4_0900_bin';
    available = checks.mysqlVersion && checks.noPadCollation && checks.applicationSchema;
    if (write && available) {
      check(await db.prepare(RUNTIME_CANARY_SCHEMA).run());
      const marker = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
      const now = Date.now();
      const insert = id => db.prepare(`INSERT INTO tableu_runtime_canaries
        (id, revision, status, delay_ms, started_at, completed_at, expires_at)
        VALUES (?, ?, 'db-probe', IF(LAST_INSERT_ID(?), 0, 0), ?, NULL, ?)`)
        .bind(id, revision, marker, now, now + 60000);
      const committed = await db.batch([
        insert(ids[0]),
        db.prepare('SELECT LAST_INSERT_ID() AS marker, id FROM tableu_runtime_canaries WHERE id = ?').bind(ids[0])
      ]);
      const complete = Array.isArray(committed) && committed.length === 2
        && committed.every(result => result?.success === true && Array.isArray(result.results));
      checks.mutationMetadata = complete && Number(committed[0]?.meta?.changes) === 1;
      checks.lastRowId = complete && Number(committed[0]?.meta?.last_row_id) === marker;
      checks.batchConnectionAffinity = complete && committed[1]?.results?.[0]?.id === ids[0]
        && Number(committed[1].results[0].marker) === marker;
      checks.batchCommit = (await db.prepare('SELECT id FROM tableu_runtime_canaries WHERE id = ?').bind(ids[0]).first())?.id === ids[0];
      let failed = false;
      try {
        const rejected = await db.batch([insert(ids[1]), insert(ids[0])]);
        failed = Array.isArray(rejected) && rejected.some(result => result?.success === false);
      } catch { failed = true; }
      // This independent request distinguishes rollback from a failed second
      // statement in a batch whose first insert was already committed.
      checks.batchRollback = failed && (await db.prepare('SELECT id FROM tableu_runtime_canaries WHERE id = ?').bind(ids[1]).first()) === null;
      available = checks.mutationMetadata && checks.lastRowId && checks.batchConnectionAffinity && checks.batchCommit && checks.batchRollback;
    }
  } catch { available = false; }
  finally {
    if (write && db?.prepare) {
      try {
        check(await db.prepare('DELETE FROM tableu_runtime_canaries WHERE id IN (?, ?)').bind(...ids).run());
        checks.cleanup = true;
      } catch { checks.cleanup = false; available = false; }
    }
  }
  return reply(available ? 200 : 503, {
    status: available ? 'ok' : 'unavailable', revision, writes: write,
    transactionVerified: write && available, checks,
    ...(available ? {} : { error: 'Runtime database contract unavailable.' })
  });
}
