import { compileSpacefastSql } from './sql.js';

function normalizeError(error) {
  const message = String(error?.message || error);
  if (/narration_monthly_limit/.test(message)) return new Error('narration_monthly_limit', { cause: error });
  if (/narration_one_active_identity/.test(message)) return new Error('UNIQUE constraint failed: narration_requests.identity', { cause: error });
  const missing = message.match(/Table ['`](?:[^.'`]+\.)?([^'`]+)['`] doesn't exist/i);
  if (missing) return new Error(`no such table: ${missing[1]}`, { cause: error });
  if (/Duplicate entry/i.test(message)) {
    const columns = message.includes('idx_journal_user_idempotency_key_unique') ? 'journal_entries.user_id, journal_entries.idempotency_key'
      : message.includes('idx_journal_user_request_id_unique') ? 'journal_entries.user_id, journal_entries.request_id'
        : message.includes('idx_journal_user_session_seed_unique') ? 'journal_entries.user_id, journal_entries.session_seed' : null;
    if (columns) return new Error(`UNIQUE constraint failed: ${columns}`, { cause: error });
  }
  return error;
}

function normalizeResult(result, plan) {
  if (result?.success === false) throw new Error(result.error || 'Spacefast database execution failed');
  if (!result || !result.meta) throw new Error('Spacefast database returned no D1 metadata');
  if ((plan.marker || plan.returnColumn) && !Number.isFinite(Number(result.meta.last_row_id))) {
    throw new Error('Native Spacefast database must expose last_row_id for atomic quota statements');
  }
  const lastId = Number(result.meta.last_row_id ?? 0);
  const changed = plan.marker ? (lastId > 0 ? 1 : 0) : plan.normalizeChanges ? (Number(result.meta.changes) > 0 ? 1 : 0) : Number(result.meta.changes || 0);
  return {
    ...result,
    success: true,
    results: plan.returnColumn ? (lastId > 0 ? [{ [plan.returnColumn]: lastId }] : []) : (result.results || []),
    meta: { ...result.meta, changes: changed }
  };
}

class Statement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.plan = compileSpacefastSql(sql);
    this.values = values;
  }
  bind(...values) {
    const statement = Object.create(Statement.prototype);
    Object.assign(statement, this, { values });
    return statement;
  }
  native() {
    const values = this.plan.parameters.map(index => {
      if (index >= this.values.length) throw new Error('Spacefast database parameter is missing');
      return this.values[index];
    });
    return this.database.native.prepare(this.plan.sql).bind(...values);
  }
  async all() {
    if (this.plan.lock) return (await this.database.batch([this]))[0];
    try { return normalizeResult(await this.native().all(), this.plan); }
    catch (error) { throw normalizeError(error); }
  }
  async run() { return this.all(); }
  async first(column) {
    const row = (await this.all()).results[0] ?? null;
    return column === undefined || row === null ? row : row[column];
  }
  async raw({ columnNames = false } = {}) {
    const rows = (await this.all()).results;
    return columnNames && rows.length ? [Object.keys(rows[0]), ...rows.map(Object.values)] : rows.map(Object.values);
  }
}

/** The original binding is also retained by the runtime as TABLEU_NATIVE_DB. */
export function createSpacefastDatabase(native) {
  if (!native?.prepare) throw new Error('Native Spacefast DB binding is required');
  const database = {
    native,
    prepare(sql) { return new Statement(database, sql); },
    async exec(sql) {
      // D1 telemetry expects exec to exist even when application handlers use
      // prepared statements. The bounded compiler deliberately rejects scripts.
      const startedAt = Date.now();
      const result = await database.prepare(sql).run();
      return { count: result.meta.changes, duration: Date.now() - startedAt };
    },
    async batch(statements) {
      if (!native.batch) throw new Error('Native Spacefast DB.batch is required for atomic application batches');
      if (statements.some(statement => statement.database !== database)) throw new Error('Spacefast database batch mixes bindings');
      const operations = [];
      const slots = [];
      for (const statement of statements) {
        const lock = statement.plan.lock;
        let countSlot = null;
        if (lock?.kind === 'followup') {
          operations.push(native.prepare('SELECT id FROM users WHERE id = ? FOR UPDATE').bind(statement.values[lock.userParameter]));
        } else if (lock?.kind === 'feature') {
          const identity = `feature:${statement.values[lock.identityParameter]}:${statement.values[lock.featureParameter]}`;
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
          const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
          operations.push(native.prepare('INSERT IGNORE INTO tableu_quota_locks (identity_key) VALUES (?)').bind(key));
          operations.push(native.prepare('SELECT identity_key FROM tableu_quota_locks WHERE identity_key = ? FOR UPDATE').bind(key));
        } else if (lock?.kind === 'matched-update') {
          countSlot = operations.length;
          operations.push(native.prepare(lock.sql).bind(...lock.parameters.map(index => statement.values[index])));
        }
        slots.push({ result: operations.length, count: countSlot });
        operations.push(statement.native());
      }
      for (let attempt = 0; ; attempt++) {
        try {
          const results = await native.batch(operations);
          if (!Array.isArray(results) || results.length !== operations.length) throw new Error('Spacefast database batch returned an incomplete result');
          return slots.map((slot, index) => {
            const result = normalizeResult(results[slot.result], statements[index].plan);
            if (slot.count !== null) {
              const matched = Number(results[slot.count]?.results?.[0]?.tableu_matched);
              if (!Number.isFinite(matched)) throw new Error('Native Spacefast database omitted matched-update count');
              result.meta.changes = matched;
            }
            return result;
          });
        } catch (error) {
          // InnoDB always rolls back a deadlock victim's whole transaction.
          // Retrying this database-only batch cannot replay external effects.
          if (attempt < 5 && /deadlock/i.test(String(error?.message || error))) {
            await new Promise(resolve => setTimeout(resolve, 10 * (2 ** attempt) + Math.floor(Math.random() * 10)));
            continue;
          }
          throw normalizeError(error);
        }
      }
    }
  };
  return database;
}

export { compileSpacefastSql } from './sql.js';
