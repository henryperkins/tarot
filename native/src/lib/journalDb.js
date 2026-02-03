import * as SQLite from 'expo-sqlite';

export const JOURNAL_DB_NAME = 'tableu-journal.db';
const JOURNAL_SCHEMA_VERSION = 1;
const JOURNAL_TABLE = 'journal_entries';

const safeParse = (value, fallback = {}) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const createJournalId = () => `jn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function openJournalDb() {
  return SQLite.openDatabase(JOURNAL_DB_NAME);
}

export function initJournalSchema(db) {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          `CREATE TABLE IF NOT EXISTS ${JOURNAL_TABLE} (
            id TEXT PRIMARY KEY NOT NULL,
            payload TEXT NOT NULL,
            created_at INTEGER NOT NULL
          );`
        );
        tx.executeSql(
          `CREATE INDEX IF NOT EXISTS journal_entries_created_at
           ON ${JOURNAL_TABLE} (created_at DESC);`
        );
        tx.executeSql(`PRAGMA user_version = ${JOURNAL_SCHEMA_VERSION};`);
      },
      (error) => reject(error),
      () => resolve(true)
    );
  });
}

export async function ensureJournalDb() {
  const db = openJournalDb();
  await initJournalSchema(db);
  return db;
}

export function buildJournalEntry(entry = {}) {
  const id = entry.id || createJournalId();
  const createdAt = Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now();
  return {
    id,
    createdAt,
    question: entry.question || '',
    spreadKey: entry.spreadKey || null,
    spreadName: entry.spreadName || null,
    cards: Array.isArray(entry.cards) ? entry.cards : [],
    personalReading: entry.personalReading || '',
    context: entry.context || 'general'
  };
}

export function saveJournalEntry(db, entry) {
  const normalized = buildJournalEntry(entry);
  const { id, createdAt, ...payload } = normalized;
  const payloadJson = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          `INSERT INTO ${JOURNAL_TABLE} (id, payload, created_at) VALUES (?, ?, ?);`,
          [id, payloadJson, createdAt],
          () => resolve(normalized)
        );
      },
      (error) => reject(error)
    );
  });
}

export function listJournalEntries(db, limit = 25) {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          `SELECT id, payload, created_at FROM ${JOURNAL_TABLE} ORDER BY created_at DESC LIMIT ?;`,
          [limit],
          (_, result) => {
            const entries = [];
            for (let index = 0; index < result.rows.length; index += 1) {
              const row = result.rows.item(index);
              const payload = safeParse(row.payload, {});
              entries.push({
                ...payload,
                id: row.id,
                createdAt: row.created_at
              });
            }
            resolve(entries);
          }
        );
      },
      (error) => reject(error)
    );
  });
}

export function deleteJournalEntry(db, id) {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          `DELETE FROM ${JOURNAL_TABLE} WHERE id = ?;`,
          [id],
          () => resolve(true)
        );
      },
      (error) => reject(error)
    );
  });
}
