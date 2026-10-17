// Each namespace is scoped to the Space's native MySQL database. No Cloudflare
// namespace identifier or production data is copied by this adapter.
export const KV_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS tableu_kv (
  namespace VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kv_key VARBINARY(512) NOT NULL,
  value LONGTEXT NOT NULL,
  value_encoding VARCHAR(8) NOT NULL DEFAULT 'utf8',
  metadata LONGTEXT NULL,
  expires_at BIGINT NULL,
  PRIMARY KEY (namespace, kv_key),
  KEY tableu_kv_expiry (expires_at)
)`;

const initializedDatabases = new WeakMap();
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const VALUE_TYPES = new Set(['text', 'json', 'arrayBuffer', 'stream']);

function validateKey(key) {
  if (typeof key !== 'string' || !key || key === '.' || key === '..' || encoder.encode(key).length > 512) {
    throw new TypeError('KV keys must be nonempty strings of at most 512 UTF-8 bytes.');
  }
}

function encodeBase64(bytes) {
  // Avoid spreading large values into a function's argument stack.
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

function decodeBase64(value) {
  return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

function parseType(options) {
  const type = typeof options === 'string' ? options : options?.type || 'text';
  if (!VALUE_TYPES.has(type)) throw new TypeError(`Unsupported KV value type: ${type}`);
  return type;
}

function decodeValue(row, type) {
  const bytes = row.value_encoding === 'base64' ? decodeBase64(row.value) : encoder.encode(row.value);
  if (type === 'arrayBuffer') return bytes.buffer;
  if (type === 'stream') return new Response(bytes).body;
  const value = row.value_encoding === 'base64' ? decoder.decode(bytes) : row.value;
  return type === 'json' ? JSON.parse(value) : value;
}

async function initialize(db) {
  let pending = initializedDatabases.get(db);
  if (!pending) {
    pending = Promise.resolve().then(() => db.prepare(KV_SCHEMA_SQL).run()).then(result => {
      if (result?.success === false) throw new Error('Unable to initialize native KV storage.');
    });
    initializedDatabases.set(db, pending);
    pending.catch(() => initializedDatabases.delete(db));
  }
  await pending;
}

function encodeCursor(namespace, prefix, key) {
  return encodeBase64(encoder.encode(JSON.stringify({ namespace, prefix, key })))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeCursor(cursor, namespace, prefix) {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(decoder.decode(decodeBase64(String(cursor).replace(/-/g, '+').replace(/_/g, '/'))));
    if (parsed.namespace !== namespace || parsed.prefix !== prefix) throw new Error('Cursor scope mismatch');
    validateKey(parsed.key);
    return parsed.key;
  } catch {
    throw new TypeError('Invalid KV list cursor for this namespace and prefix.');
  }
}

function requireSuccess(result) {
  if (result?.success === false) throw new Error('Native KV storage operation failed.');
  return result;
}

export function createDatabaseKV(db, namespace, { now = Date.now } = {}) {
  if (typeof db?.prepare !== 'function') throw new TypeError('Native KV storage requires env.DB.');
  if (!/^[A-Z_]{1,32}$/.test(namespace)) throw new TypeError('Invalid KV namespace.');

  async function read(key) {
    validateKey(key);
    await initialize(db);
    // The expiry predicate also excludes expired data before the next cleanup.
    return db.prepare(`SELECT value, value_encoding, metadata, expires_at FROM tableu_kv
      WHERE namespace = ? AND kv_key = ? AND (expires_at IS NULL OR expires_at > ?)`)
      .bind(namespace, key, Math.floor(now() / 1000)).first();
  }

  return {
    async get(key, options) {
      const type = parseType(options);
      const row = await read(key);
      return row ? decodeValue(row, type) : null;
    },

    async getWithMetadata(key, options) {
      const type = parseType(options);
      const row = await read(key);
      return row ? {
        value: decodeValue(row, type),
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
        cacheStatus: null,
      } : { value: null, metadata: null, cacheStatus: null };
    },

    async put(key, value, options = {}) {
      validateKey(key);
      const nowSeconds = Math.floor(now() / 1000);
      let expiration = null;
      if (options.expirationTtl !== undefined) {
        if (!Number.isInteger(options.expirationTtl) || options.expirationTtl <= 0) {
          throw new TypeError('KV expirationTtl must be a positive integer.');
        }
        expiration = nowSeconds + options.expirationTtl;
      } else if (options.expiration !== undefined) {
        if (!Number.isInteger(options.expiration) || options.expiration <= nowSeconds) {
          throw new TypeError('KV expiration must be a future Unix timestamp.');
        }
        expiration = options.expiration;
      }
      const metadata = options.metadata === undefined ? null : JSON.stringify(options.metadata);
      let encoding = 'utf8';
      let storedValue = value;
      if (typeof value !== 'string') {
        if (!(value instanceof ArrayBuffer) && !ArrayBuffer.isView(value)
          && !(value instanceof ReadableStream) && !(value instanceof Blob)) {
          throw new TypeError('KV values must be strings or binary bodies.');
        }
        storedValue = encodeBase64(new Uint8Array(await new Response(value).arrayBuffer()));
        encoding = 'base64';
      }
      await initialize(db);
      requireSuccess(await db.prepare(`INSERT INTO tableu_kv
        (namespace, kv_key, value, value_encoding, metadata, expires_at) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE value = VALUES(value), value_encoding = VALUES(value_encoding),
          metadata = VALUES(metadata), expires_at = VALUES(expires_at)`)
        .bind(namespace, key, storedValue, encoding, metadata, expiration).run());
    },

    async delete(key) {
      validateKey(key);
      await initialize(db);
      requireSuccess(await db.prepare('DELETE FROM tableu_kv WHERE namespace = ? AND kv_key = ?')
        .bind(namespace, key).run());
    },

    async list({ prefix = '', limit = 1000, cursor } = {}) {
      if (typeof prefix !== 'string' || encoder.encode(prefix).length > 512) throw new TypeError('Invalid KV prefix.');
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new TypeError('KV list limit must be 1 through 1000.');
      const after = decodeCursor(cursor, namespace, prefix);
      await initialize(db);
      const parameters = [namespace, Math.floor(now() / 1000), encoder.encode(prefix).length, prefix];
      if (after !== null) parameters.push(after);
      parameters.push(limit + 1);
      const result = requireSuccess(await db.prepare(`SELECT CAST(kv_key AS CHAR CHARACTER SET utf8mb4) AS kv_key,
        metadata, expires_at FROM tableu_kv WHERE namespace = ?
        AND (expires_at IS NULL OR expires_at > ?) AND LEFT(kv_key, ?) = CAST(? AS BINARY)
        ${after !== null ? 'AND kv_key > ?' : ''} ORDER BY kv_key LIMIT ?`)
        .bind(...parameters).all());
      const rows = result.results || [];
      const complete = rows.length <= limit;
      const page = rows.slice(0, limit);
      const keys = page.map(row => ({
        name: row.kv_key,
        ...(row.expires_at === null || row.expires_at === undefined ? {} : { expiration: Number(row.expires_at) }),
        ...(row.metadata ? { metadata: JSON.parse(row.metadata) } : {}),
      }));
      return {
        keys,
        list_complete: complete,
        cursor: complete ? '' : encodeCursor(namespace, prefix, page[page.length - 1].kv_key),
        cacheStatus: null,
      };
    },
  };
}

export async function cleanupExpiredKV(db, { now = Date.now } = {}) {
  await initialize(db);
  return requireSuccess(await db.prepare('DELETE FROM tableu_kv WHERE expires_at IS NOT NULL AND expires_at <= ?')
    .bind(Math.floor(now() / 1000)).run());
}
