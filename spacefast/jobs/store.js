/** MySQL persistence for reading jobs; provider work is never restarted by a lease. */
export const READING_JOBS_SCHEMA = `CREATE TABLE IF NOT EXISTS tableu_reading_jobs (
  id VARCHAR(128) COLLATE utf8mb4_bin PRIMARY KEY,
  state_json LONGTEXT NOT NULL,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL,
  lease_owner VARCHAR(64) NULL,
  lease_expires_at BIGINT NULL,
  delete_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX tableu_reading_jobs_delete_at (delete_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`;

const initializations = new WeakMap();

function assertSuccess(result) {
  if (result?.success === false) throw new Error('Reading-job database operation failed.');
  return result;
}

function changes(result) {
  assertSuccess(result);
  const changed = result?.meta?.changes ?? result?.changes;
  if (!Number.isFinite(Number(changed))) {
    throw new Error('Reading-job database must report affected rows.');
  }
  return Number(changed);
}

export function ensureReadingJobsSchema(db) {
  if (!db?.prepare) throw new Error('Reading jobs require a database binding.');
  let initialized = initializations.get(db);
  if (!initialized) {
    initialized = Promise.resolve(db.prepare(READING_JOBS_SCHEMA).run())
      .then(assertSuccess)
      .catch((error) => {
        initializations.delete(db);
        throw error;
      });
    initializations.set(db, initialized);
  }
  return initialized;
}

function decode(row) {
  if (!row) return null;
  return {
    id: row.id,
    state: JSON.parse(row.state_json),
    revision: Number(row.revision),
    status: row.status,
    leaseOwner: row.lease_owner,
    leaseExpiresAt: row.lease_expires_at === null ? null : Number(row.lease_expires_at),
    deleteAt: Number(row.delete_at)
  };
}

export class ReadingJobsStore {
  constructor(db, { initialize = true } = {}) {
    if (!db?.prepare) throw new Error('Reading jobs require a database binding.');
    this.db = db;
    this.initialize = initialize;
    this.initialized = null;
  }

  ready() {
    this.initialized ??= this.initialize ? ensureReadingJobsSchema(this.db) : Promise.resolve();
    return this.initialized;
  }

  async read(id) {
    await this.ready();
    return decode(await this.db.prepare('SELECT * FROM tableu_reading_jobs WHERE id = ?').bind(id).first());
  }

  async insert(id, state, owner, leaseExpiresAt, deleteAt, now) {
    await this.ready();
    const result = await this.db.prepare(`INSERT IGNORE INTO tableu_reading_jobs
      (id, state_json, revision, status, lease_owner, lease_expires_at, delete_at, updated_at)
      VALUES (?, ?, 0, ?, ?, ?, ?, ?)`)
      .bind(id, JSON.stringify(state), state.job.status, owner, leaseExpiresAt, deleteAt, now).run();
    // INSERT IGNORE admits at most one runner, including across Functions isolates.
    return changes(result) === 1;
  }

  async saveOwned(id, revision, owner, state, leaseExpiresAt, deleteAt, now) {
    await this.ready();
    const terminal = state.job.status !== 'running';
    return changes(await this.db.prepare(`UPDATE tableu_reading_jobs
      SET state_json = ?, revision = revision + 1, status = ?, lease_owner = ?,
          lease_expires_at = ?, delete_at = ?, updated_at = ?
      WHERE id = ? AND revision = ? AND lease_owner = ? AND status = 'running'
        AND lease_expires_at > ? AND delete_at > ?`)
      .bind(JSON.stringify(state), state.job.status, terminal ? null : owner,
        terminal ? null : leaseExpiresAt, deleteAt, now, id, revision, owner, now, now).run()) === 1;
  }

  async renew(id, owner, leaseExpiresAt, now) {
    await this.ready();
    const renewed = changes(await this.db.prepare(`UPDATE tableu_reading_jobs
      SET lease_expires_at = ? WHERE id = ? AND lease_owner = ?
        AND status = 'running' AND lease_expires_at > ? AND delete_at > ?`)
      .bind(leaseExpiresAt, id, owner, now, now).run());
    if (renewed === 1) return true;
    // Some MySQL clients report only changed rows, so renewing to the same
    // millisecond can return zero even while the existing lease remains valid.
    const row = await this.read(id);
    return row?.leaseOwner === owner && row.status === 'running'
      && row.leaseExpiresAt > now && row.deleteAt > now;
  }

  /** CAS makes cancellation/completion/interruption choose a single terminal state. */
  async finish(id, revision, state, deleteAt, now, { interrupted = false } = {}) {
    await this.ready();
    return changes(await this.db.prepare(`UPDATE tableu_reading_jobs
      SET state_json = ?, revision = revision + 1, status = ?, lease_owner = NULL,
          lease_expires_at = NULL, delete_at = ?, updated_at = ?
      WHERE id = ? AND revision = ? AND status = 'running'${interrupted ? ' AND lease_expires_at <= ?' : ''}`)
      .bind(JSON.stringify(state), state.job.status, deleteAt, now, id, revision,
        ...(interrupted ? [now] : [])).run()) === 1;
  }

  async delete(id, revision) {
    await this.ready();
    return changes(await this.db.prepare('DELETE FROM tableu_reading_jobs WHERE id = ? AND revision = ?')
      .bind(id, revision).run()) === 1;
  }

  async cleanupExpired(now) {
    await this.ready();
    return changes(await this.db.prepare('DELETE FROM tableu_reading_jobs WHERE delete_at <= ?').bind(now).run());
  }
}
