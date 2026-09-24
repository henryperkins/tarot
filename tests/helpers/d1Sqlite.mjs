/**
 * In-memory D1 stand-in backed by real SQLite (sql.js, compiled to WASM).
 *
 * Every migrations/*.sql file is applied in name order, so tables, unique and
 * partial indexes, and constraint errors behave as in production. Each call
 * first yields to the event loop, like D1's network round-trip, so two
 * concurrent requests can interleave between a SELECT and an INSERT exactly
 * as they can in production.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations');

let sqlModulePromise = null;

function yieldToEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

function toSqlParam(value) {
  if (value === undefined) {
    // D1 rejects undefined bindings; mirror it so tests catch the bug.
    throw new TypeError("D1_TYPE_ERROR: Type 'undefined' not supported for value 'undefined'");
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

class PreparedStatement {
  constructor(database, sql, params = []) {
    this.database = database;
    this.sql = sql;
    this.params = params;
  }

  bind(...params) {
    return new PreparedStatement(this.database, this.sql, params.map(toSqlParam));
  }

  execute() {
    const statement = this.database.sqlite.prepare(this.sql);
    try {
      statement.bind(this.params);
      const rows = [];
      while (statement.step()) rows.push(statement.getAsObject());
      return {
        success: true,
        results: rows,
        meta: { changes: this.database.sqlite.getRowsModified() }
      };
    } finally {
      statement.free();
    }
  }

  async first(column) {
    await yieldToEventLoop();
    const [row] = this.execute().results;
    if (!row) return null;
    return column === undefined ? row : (row[column] ?? null);
  }

  async all() {
    await yieldToEventLoop();
    const { results } = this.execute();
    return { success: true, results, meta: {} };
  }

  async run() {
    await yieldToEventLoop();
    return this.execute();
  }
}

export class SqliteD1 {
  constructor(sqlite) {
    this.sqlite = sqlite;
  }

  prepare(sql) {
    return new PreparedStatement(this, sql);
  }

  async batch(statements) {
    await yieldToEventLoop();
    this.sqlite.run('BEGIN');
    try {
      const results = statements.map((statement) => statement.execute());
      this.sqlite.run('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.run('ROLLBACK');
      throw error;
    }
  }

  /** Synchronous query for test assertions. */
  rows(sql, params = []) {
    return new PreparedStatement(this, sql, params.map(toSqlParam)).execute().results;
  }
}

export async function createD1() {
  sqlModulePromise ??= initSqlJs();
  const SQL = await sqlModulePromise;
  const sqlite = new SQL.Database();
  sqlite.run('PRAGMA foreign_keys = ON');
  const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql')).sort();
  for (const file of files) {
    sqlite.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  return new SqliteD1(sqlite);
}
