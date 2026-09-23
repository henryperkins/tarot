# ChatGPT MCP Journal Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner run draw → reading → save → reflection from the Tableu
ChatGPT plugin against production. Every write lands in the owner's own Tableu
account, behind OAuth 2.1 that Tableu issues.

**Architecture:** An MCP endpoint (`/mcp`) runs on the main Worker, wrapped by
`@cloudflare/workers-oauth-provider`, with Tableu's own consent page as the
authorization server. MCP tools call journal and reading-job service functions
with an explicit user that the server resolves. A save rebuilds the entry from
the completed job's snapshot, under an atomic reading identity. Reading jobs gain
a principal path, and jobs started from ChatGPT are reachable only through MCP.

**Tech Stack:** Cloudflare Workers, D1 (SQLite), Durable Objects,
`@modelcontextprotocol/sdk` 1.30 (web-standard Streamable HTTP, stateless),
`@cloudflare/workers-oauth-provider` 0.10.3, zod 4, and `node --test` with a
`sql.js` D1 harness.

**Spec:** `docs/superpowers/specs/2026-09-22-chatgpt-mcp-journal-design.md`.
Read it before starting. Section numbers such as "§7.2" refer to it.

**Review amendment (2026-09-23):** this plan replaces spec §5.1's KV
registration counter with atomic D1 admission and adds migration `0031`.
The limit remains ten registrations per client address per UTC hour. Follow
the amended mechanism, browser routing and regression checks below when the
older spec describes a KV counter or only migration `0030`.

**Working directory:** every command runs in the worktree
`C:/Users/htper/tarot-chatgpt-mcp` (branch `feat/chatgpt-mcp-journal`), using Git
Bash. Never run commands in `C:/Users/htper/tarot`: its uncommitted
`wrangler.jsonc` must not be touched or deployed.

## Global Constraints

- CI runs Node 20. The test command is `node --test tests/*.test.mjs`. Don't use Node-22-only APIs (no `node:sqlite`, no `mock.module`).
- The three `lib/` folders stay separate. `functions/` holds Worker code; `shared/` holds environment-agnostic code; `src/` holds browser code. `shared/` never imports from `functions/` or `src/lib/`.
- Pinned dependencies:
  - `@modelcontextprotocol/sdk` `~1.30.0`;
  - `@cloudflare/workers-oauth-provider` `0.10.3`, exact;
  - `@cfworker/json-schema` `^4.1.1`;
  - devDependency `sql.js` `^1.14.2`.
  - devDependency `js-yaml` `^4.1.1` for parsing the Actions contract in Task 15.
- Don't add compatibility flags; in particular, no `global_fetch_strictly_public`. CIMD stays disabled.
- The OAuth scope is exactly `tableu`. The resource is `MCP_RESOURCE_URL`, default `https://tarot.lakefrontdev.com/mcp`.
- The allowlist secret is `MCP_ALLOWED_USER_IDS`, comma-separated. When it is unset or empty, nobody can link.
- Tool names are exactly: `get_profile`, `draw_tarot_reading`, `start_tarot_reading`, `wait_for_tarot_reading`, `get_tarot_reading_status`, `cancel_tarot_reading`, `save_reading_to_journal`, `add_reflection_to_journal_entry`.
- `wait_for_tarot_reading` takes `timeoutSeconds`, an integer from 1 to 45, default 40.
- Reflections:
  - text is 1–2,000 characters;
  - each target holds at most 20,000 characters;
  - notes only append, separated by `"\n\n"`;
  - the whole-reading key is `Overall`.
- The reading identity key is `idempotency_key = "reading:" + requestId`. Its migration file is `migrations/0030_add_journal_idempotency_key.sql`.
- Registration admission uses `migrations/0031_add_oauth_registration_counters.sql` on `DB`, not the `RATELIMIT` KV. Both migrations must be applied before deploying the new Worker; missing admission storage fails closed with 503.
- The service-account refusal is 403 with `{ "error": "Journal requires a personal account", "code": "service_account_journal_forbidden" }`.
- Job retention: MCP jobs stay readable for 24 h after their terminal state; app jobs keep 1 h.
- Never log tokens, narratives, reflection text or questions.
- Never run `npm run deploy` or `wrangler deploy` without `--dry-run`. Production deploys happen only through CI after merge.
- End every commit message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

These are inputs the spec implies but no task would otherwise exercise. Each has
a test in the task named at the end of its line.

1. An allowlist secret pasted with spaces, a trailing newline, or `", "` separators still matches the owner's ID (Task 11).
2. A reflection re-sent with Windows line endings or trailing spaces counts as the same note, so nothing is duplicated (Task 6).
3. An account with no username, such as a social sign-up, links and calls `get_profile`. It gets `{ id, name? }` with no crash and no invented nickname (Task 11).
4. A consent form submitted after the CSRF cookie expired, when the user waited more than 10 minutes, gets a clear "start again" page. No grant is issued (Task 14).
5. An entry deleted in the app and then targeted by `add_reflection_to_journal_entry` returns "not found", and nothing is recreated (Task 13).

The 2026-09-23 review also requires these regression checks:

- A returned MCP draw seed reproduces the same cards and orientations when reused; the existing HTTP draw seed coercion stays compatible (Tasks 8 and 12).
- A returned Thoth reflection target can be reused without changing which card receives the note (Tasks 6 and 13).
- Real browser navigation reaches the OAuth consent handler, and concurrent registrations respect the hourly limit without relying on KV counters (Task 14).
- The Actions document parses as YAML, beyond passing text checks (Task 15).
- Local OAuth uses the localhost resource, and the journal walkthrough uses an explicitly entitled local test account (Tasks 16 and 17).

## File Map

| File | Responsibility | Task |
|---|---|---|
| `tests/helpers/d1Sqlite.mjs` | D1 API over real SQLite (`sql.js`), with all migrations applied | 1 |
| `tests/helpers/journalFixtures.mjs` | Seed users, sessions and entries; request helper | 1 |
| `migrations/0030_add_journal_idempotency_key.sql` | `idempotency_key` column plus its partial unique index | 2 |
| `migrations/0031_add_oauth_registration_counters.sql` | Atomic D1 admission counters for OAuth registration | 14 |
| `functions/lib/journalEntries.js` | App saves, and MCP reading saves with atomic identity | 2, 3 |
| `functions/lib/journalAccess.js` | Journal auth, service-account refusal and tier gate | 4 |
| `shared/journal/reflectionLabels.js` | Reflection key to display label, shared by the UI and the export | 5 |
| `functions/lib/journalReflections.js` | Append-only, idempotent, deck-aware reflections | 6 |
| `functions/lib/auth.js` (`loadActiveUserById`) | Principal user loading | 7 |
| `functions/lib/serverDraw.js` | Server-side draw, extracted from the draw route | 8 |
| `functions/lib/readingJobs.js` | Job start, MCP snapshot and MCP cancel | 9 |
| `src/worker/readingJob.js` | Principal, snapshot, retention, MCP-only paths | 9 |
| `tests/helpers/fakeReadingJobs.mjs` | `READING_JOBS` namespace backed by real `ReadingJob` instances | 9 |
| `functions/lib/mcp/journalMapping.js` | Job or payload to journal entry, with canonical card identity | 10 |
| `functions/lib/mcp/config.js` | Scope, resource URL, allowlist | 11 |
| `functions/lib/mcp/schemas.js` | Shared zod schemas | 11 |
| `functions/lib/mcp/tools/common.js` | Tool annotations, `_meta`, result helpers | 11 |
| `functions/lib/mcp/tools/profile.js` | `get_profile` | 11 |
| `functions/lib/mcp/server.js` | `McpServer` factory and instructions | 11–13 |
| `functions/lib/mcp/tools/readings.js` | Draw, start, wait, status and cancel tools | 12 |
| `functions/lib/mcp/tools/journal.js` | Save and reflect tools | 13 |
| `functions/lib/mcp/redirectUris.js` | Redirect URI allowlist for registration | 14 |
| `functions/lib/mcp/registrationLimit.js` | Atomic D1 per-address hourly admission for `/oauth/register` | 14 |
| `functions/lib/mcp/consent.js` | `/oauth/authorize` consent page | 14 |
| `functions/lib/mcp/mcpHandler.js` | `/mcp`: scope, allowlist, user, transport | 14 |
| `functions/lib/mcp/oauthProvider.js` | Provider options, path routing, entry point | 14 |
| `src/worker/index.js` | Hands MCP and OAuth paths to the provider | 14 |
| `playwright.mcp.config.js`, `e2e/mcpOAuthRouting.integration.spec.js` | Real browser routing check against the manually started local Worker | 14, 17 |
| `docs/integrations/openai/chatgpt-mcp.md`, `docs/integrations/openai/plugin/*` | Runbook and plugin files | 16 |

---

### Task 1: SQLite-backed D1 test harness

**Files:**
- Modify: `package.json`, `package-lock.json` (devDependency `sql.js`)
- Create: `tests/helpers/d1Sqlite.mjs`
- Create: `tests/helpers/journalFixtures.mjs`
- Test: `tests/d1SqliteHarness.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `createD1(): Promise<SqliteD1>`. `SqliteD1` has:
    - `prepare(sql)`, whose `.bind(...params)` returns a statement with `first(column?)`, `all()` and `run()` in the D1 result shapes;
    - `batch(statements)`;
    - `rows(sql, params?)`, synchronous, for assertions.
  - Fixtures in `tests/helpers/journalFixtures.mjs`:
    - `THREE_CARDS`;
    - `seedUser(d1, { id='user-1', tier='plus', status='active', authProvider=null, username=null, email=null, active=1 })`;
    - `seedSession(d1, { id='session-1', userId='user-1', ttlSeconds=3600 })`;
    - `seedEntry(d1, { id='entry-1', userId='user-1', cards=THREE_CARDS, reflections=null, deckId=null, spreadKey='threeCard', spreadName, sessionSeed=null, requestId=null, narrative='A reading.' })`;
    - `jsonRequest(url, { method='POST', body, headers={} })`.

- [ ] **Step 1: Install dependencies in the worktree**

Run:

```bash
cd C:/Users/htper/tarot-chatgpt-mcp && npm ci && npm install --save-dev sql.js@^1.14.2
```

Expected: `npm ci` completes, and `package.json` `devDependencies` gains `"sql.js": "^1.14.2"`.

- [ ] **Step 2: Write the failing test**

Create `tests/d1SqliteHarness.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedEntry, seedUser } from './helpers/journalFixtures.mjs';

describe('SQLite D1 test harness', () => {
  it('applies every migration, including the journal tables', async () => {
    const d1 = await createD1();
    const columns = d1.rows('PRAGMA table_info(journal_entries)').map((row) => row.name);
    assert.ok(columns.includes('session_seed'));
    assert.ok(columns.includes('request_id'));
    assert.ok(columns.includes('deck_id'));
  });

  it('returns D1-shaped results from first, all and run', async () => {
    const d1 = await createD1();
    await seedUser(d1, { id: 'user-1' });

    const row = await d1.prepare('SELECT id, subscription_tier FROM users WHERE id = ?').bind('user-1').first();
    assert.deepEqual(row, { id: 'user-1', subscription_tier: 'plus' });
    assert.equal(await d1.prepare('SELECT id FROM users WHERE id = ?').bind('user-1').first('id'), 'user-1');
    assert.equal(await d1.prepare('SELECT id FROM users WHERE id = ?').bind('nobody').first(), null);

    const { results } = await d1.prepare('SELECT id FROM users').all();
    assert.equal(results.length, 1);

    const run = await d1.prepare('UPDATE users SET username = ? WHERE id = ?').bind('renamed', 'user-1').run();
    assert.equal(run.meta.changes, 1);
  });

  it('rejects undefined bindings the way D1 does', async () => {
    const d1 = await createD1();
    assert.throws(() => d1.prepare('SELECT ?').bind(undefined), /D1_TYPE_ERROR/);
  });

  it('surfaces unique-constraint failures with the SQLite message', async () => {
    const d1 = await createD1();
    await seedUser(d1, { id: 'user-1' });
    await seedEntry(d1, { id: 'entry-1', sessionSeed: 'seed-1' });
    await assert.rejects(
      seedEntry(d1, { id: 'entry-2', sessionSeed: 'seed-1' }),
      /UNIQUE constraint failed: journal_entries\.user_id, journal_entries\.session_seed/
    );
  });

  it('interleaves concurrent calls at await boundaries, like network round-trips', async () => {
    const d1 = await createD1();
    const order = [];
    const worker = async (name) => {
      await d1.prepare('SELECT 1').first();
      order.push(`${name}1`);
      await d1.prepare('SELECT 1').first();
      order.push(`${name}2`);
    };
    await Promise.all([worker('a'), worker('b')]);
    assert.deepEqual(order, ['a1', 'b1', 'a2', 'b2']);
  });

  it('rolls back a batch when one statement fails', async () => {
    const d1 = await createD1();
    await seedUser(d1, { id: 'user-1' });
    await assert.rejects(d1.batch([
      d1.prepare('UPDATE users SET username = ? WHERE id = ?').bind('changed', 'user-1'),
      d1.prepare('INSERT INTO users (id) VALUES (?)').bind('broken')
    ]));
    assert.equal(d1.rows('SELECT username FROM users WHERE id = ?', ['user-1'])[0].username, 'user_1');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test tests/d1SqliteHarness.test.mjs`
Expected: FAIL with `Cannot find module` for `tests/helpers/d1Sqlite.mjs`.

- [ ] **Step 4: Write the harness**

Create `tests/helpers/d1Sqlite.mjs`:

```js
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
```

- [ ] **Step 5: Write the fixtures**

Create `tests/helpers/journalFixtures.mjs`:

```js
/** Seed helpers for tests that run against tests/helpers/d1Sqlite.mjs. */

// Journal card shape as written by src/hooks/useSaveReading.js: `name`, not `card`.
export const THREE_CARDS = Object.freeze([
  { position: 'Past', name: 'The Hermit', number: 9, orientation: 'Upright' },
  { position: 'Present', name: 'Three of Cups', suit: 'Cups', rank: 'Three', rankValue: 3, orientation: 'Reversed' },
  { position: 'Future', name: 'The Star', number: 17, orientation: 'Upright' }
]);

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export async function seedUser(d1, {
  id = 'user-1',
  tier = 'plus',
  status = 'active',
  authProvider = null,
  username = null,
  email = null,
  active = 1
} = {}) {
  const now = nowSeconds();
  await d1.prepare(
    `INSERT INTO users (
       id, email, username, password_hash, password_salt, created_at, updated_at,
       is_active, email_verified, subscription_tier, subscription_status, auth_provider
     ) VALUES (?, ?, ?, 'hash', 'salt', ?, ?, ?, 1, ?, ?, ?)`
  ).bind(
    id,
    email ?? `${id.replace(/[^A-Za-z0-9]/g, '.')}@example.com`,
    username ?? id.replace(/[^A-Za-z0-9_]/g, '_'),
    now,
    now,
    active,
    tier,
    status,
    authProvider
  ).run();
  return { id };
}

export async function seedSession(d1, { id = 'session-1', userId = 'user-1', ttlSeconds = 3600 } = {}) {
  const now = nowSeconds();
  await d1.prepare(
    'INSERT INTO sessions (id, user_id, created_at, expires_at, last_used_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, userId, now, now + ttlSeconds, now).run();
  return { id };
}

export async function seedEntry(d1, {
  id = 'entry-1',
  userId = 'user-1',
  cards = THREE_CARDS,
  reflections = null,
  deckId = null,
  spreadKey = 'threeCard',
  spreadName = 'Three-Card Story (Past · Present · Future)',
  sessionSeed = null,
  requestId = null,
  narrative = 'A reading.'
} = {}) {
  const now = nowSeconds();
  const reflectionsJson = reflections === null
    ? null
    : (typeof reflections === 'string' ? reflections : JSON.stringify(reflections));
  await d1.prepare(
    `INSERT INTO journal_entries (
       id, user_id, created_at, updated_at, spread_key, spread_name, cards_json,
       narrative, reflections_json, session_seed, request_id, deck_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, userId, now, now, spreadKey, spreadName, JSON.stringify(cards),
    narrative, reflectionsJson, sessionSeed, requestId, deckId
  ).run();
  return { id };
}

export function jsonRequest(url, { method = 'POST', body, headers = {} } = {}) {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `node --test tests/d1SqliteHarness.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tests/helpers/d1Sqlite.mjs tests/helpers/journalFixtures.mjs tests/d1SqliteHarness.test.mjs
git commit -m "test: add SQLite-backed D1 harness for journal tests" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Migration 0030 and the app save service

**Files:**
- Create: `migrations/0030_add_journal_idempotency_key.sql`
- Create: `functions/lib/journalEntries.js`
- Modify: `functions/api/journal.js` (imports; the `onRequestPost` handler)
- Test: `tests/journalEntriesService.test.mjs`

**Interfaces:**
- Consumes: `createD1`, `seedUser` and `THREE_CARDS` (Task 1).
- Produces:
  - `isUniqueViolation(error, column): boolean`;
  - `saveAppJournalEntry({ env, user, body, waitUntil }): Promise<{ status: number, body: object }>`.

- [ ] **Step 1: Write the failing test**

Create `tests/journalEntriesService.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createD1 } from './helpers/d1Sqlite.mjs';
import { seedUser, THREE_CARDS } from './helpers/journalFixtures.mjs';
import { isUniqueViolation, saveAppJournalEntry } from '../functions/lib/journalEntries.js';

const USER = Object.freeze({
  id: 'user-1',
  subscription_tier: 'plus',
  subscription_status: 'active',
  auth_provider: 'session'
});

const APP_BODY = Object.freeze({
  spread: 'Three-Card Story (Past · Present · Future)',
  spreadKey: 'threeCard',
  question: 'What should I focus on?',
  cards: THREE_CARDS,
  personalReading: 'The Hermit asks for patience.',
  sessionSeed: '12345',
  requestId: 'req-app-1',
  deckId: 'rws-1909'
});

async function setup() {
  const d1 = await createD1();
  await seedUser(d1, { id: 'user-1' });
  return { d1, env: { DB: d1 } };
}

function countEntries(d1) {
  return d1.rows('SELECT COUNT(*) AS n FROM journal_entries')[0].n;
}

describe('migration 0030', () => {
  it('adds a partial unique index on (user_id, idempotency_key)', async () => {
    const d1 = await createD1();
    const [index] = d1.rows(
      "SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'idx_journal_user_idempotency_key_unique'"
    );
    assert.ok(index, 'index should exist');
    assert.match(index.sql, /UNIQUE INDEX/i);
    assert.match(index.sql, /WHERE idempotency_key IS NOT NULL/i);
  });
});

describe('isUniqueViolation', () => {
  it('matches SQLite and D1-wrapped unique errors for the named column only', () => {
    const sqlite = new Error('UNIQUE constraint failed: journal_entries.user_id, journal_entries.session_seed');
    const d1 = new Error('D1_ERROR: UNIQUE constraint failed: journal_entries.user_id, journal_entries.idempotency_key: SQLITE_CONSTRAINT');
    assert.equal(isUniqueViolation(sqlite, 'session_seed'), true);
    assert.equal(isUniqueViolation(sqlite, 'idempotency_key'), false);
    assert.equal(isUniqueViolation(d1, 'idempotency_key'), true);
    assert.equal(isUniqueViolation(new Error('no such table'), 'session_seed'), false);
  });
});

describe('saveAppJournalEntry', () => {
  it('creates an entry and answers 201', async () => {
    const { d1, env } = await setup();
    const result = await saveAppJournalEntry({ env, user: USER, body: APP_BODY });

    assert.equal(result.status, 201);
    assert.equal(result.body.success, true);
    const [row] = d1.rows('SELECT user_id, session_seed, request_id, idempotency_key FROM journal_entries');
    assert.equal(row.user_id, 'user-1');
    assert.equal(row.session_seed, '12345');
    assert.equal(row.request_id, 'req-app-1');
    assert.equal(row.idempotency_key, null, 'app saves never set a reading identity');
  });

  it('answers 400 when spread, spreadKey or cards are missing', async () => {
    const { d1, env } = await setup();
    for (const missing of ['spread', 'spreadKey', 'cards']) {
      const body = { ...APP_BODY, [missing]: undefined };
      const result = await saveAppJournalEntry({ env, user: USER, body });
      assert.equal(result.status, 400, missing);
      assert.equal(result.body.error, 'Invalid journal entry data');
    }
    assert.equal(countEntries(d1), 0);
  });

  it('returns the existing entry with 200 for a repeated seed', async () => {
    const { d1, env } = await setup();
    const first = await saveAppJournalEntry({ env, user: USER, body: APP_BODY });
    const second = await saveAppJournalEntry({ env, user: USER, body: APP_BODY });

    assert.equal(second.status, 200);
    assert.equal(second.body.deduplicated, true);
    assert.equal(second.body.entry.id, first.body.entry.id);
    assert.equal(countEntries(d1), 1);
  });

  it('resolves two concurrent saves of one seed to a single row', async () => {
    const { d1, env } = await setup();
    const [a, b] = await Promise.all([
      saveAppJournalEntry({ env, user: USER, body: APP_BODY }),
      saveAppJournalEntry({ env, user: USER, body: APP_BODY })
    ]);

    assert.deepEqual([a.status, b.status].sort(), [200, 201]);
    assert.equal(a.body.entry.id, b.body.entry.id);
    assert.equal(countEntries(d1), 1);
  });

  it('always inserts saves without a seed', async () => {
    const { d1, env } = await setup();
    const body = { ...APP_BODY, sessionSeed: undefined };
    await saveAppJournalEntry({ env, user: USER, body });
    await saveAppJournalEntry({ env, user: USER, body });
    assert.equal(countEntries(d1), 2);
  });

  it('stores the narrative byte for byte', async () => {
    const { d1, env } = await setup();
    const narrative = '  Line one — ✨ café\r\n\r\nLine two with trailing space  ';
    await saveAppJournalEntry({ env, user: USER, body: { ...APP_BODY, personalReading: narrative } });
    assert.equal(d1.rows('SELECT narrative FROM journal_entries')[0].narrative, narrative);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/journalEntriesService.test.mjs`
Expected: FAIL with `Cannot find module` for `functions/lib/journalEntries.js`.

- [ ] **Step 3: Write the migration**

Create `migrations/0030_add_journal_idempotency_key.sql`:

```sql
-- Migration: 0030_add_journal_idempotency_key
-- Purpose: Atomic reading identity for journal saves from the ChatGPT MCP tools.
--
-- MCP saves set idempotency_key = 'reading:<requestId>'. The partial unique
-- index makes "is this reading already saved?" a constraint, not a
-- lookup-then-insert race (idx_journal_request_id is not unique). App saves
-- never set the column, and existing rows stay NULL, so the index builds on
-- any existing data.

ALTER TABLE journal_entries ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_journal_user_idempotency_key_unique
  ON journal_entries(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```

- [ ] **Step 4: Write the service**

Create `functions/lib/journalEntries.js`:

```js
/**
 * Journal entry persistence shared by POST /api/journal (the app, API keys,
 * bearer sessions) and the ChatGPT MCP tools.
 *
 * App saves keep the journal contract: sessionSeed is the only
 * deduplication key. MCP reading saves (saveReadingJournalEntry) add an
 * atomic reading identity; see migration 0030.
 */

import { scheduleCoachExtraction } from './coachSuggestion.js';
import { insertFollowUps, sanitizeFollowUps } from './journalFollowups.js';
import { normalizeJournalContext } from './journalContext.js';

/**
 * Whether a D1/SQLite error is a unique-constraint failure on the given
 * journal_entries column. Production D1 wraps the SQLite text
 * ("D1_ERROR: UNIQUE constraint failed: journal_entries.user_id, ..."),
 * so this matches substrings rather than the whole message.
 *
 * @param {unknown} error
 * @param {string} column - journal_entries column, e.g. 'session_seed'
 * @returns {boolean}
 */
export function isUniqueViolation(error, column) {
  const message = String(error?.message || error || '');
  return /UNIQUE constraint failed/i.test(message) && message.includes(`journal_entries.${column}`);
}

async function findEntryBySeed(db, userId, sessionSeed) {
  return db.prepare(
    `SELECT id, created_at FROM journal_entries WHERE user_id = ? AND session_seed = ?`
  ).bind(userId, sessionSeed).first();
}

/**
 * Save an entry posted to POST /api/journal.
 *
 * Unchanged contract, plus one fix: a seeded save that loses a race on
 * idx_journal_user_session_seed_unique returns the winner's entry (200,
 * deduplicated) instead of a 500.
 *
 * @param {object} params
 * @param {object} params.env - Worker bindings; env.DB is required
 * @param {object} params.user - Authenticated, journal-entitled user
 * @param {object} params.body - Parsed request body
 * @param {Function} [params.waitUntil]
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function saveAppJournalEntry({ env, user, body, waitUntil }) {
  const {
    spread,
    spreadKey,
    question,
    cards,
    personalReading,
    themes,
    reflections,
    context,
    provider,
    sessionSeed,
    // Optional: original timestamp in milliseconds (used for migrations)
    timestampMs,
    // User preferences snapshot at time of reading (Phase 5.2)
    userPreferences,
    // Deck style identifier (rws1909, marseille, thoth, etc.)
    deckId,
    // Request ID for API tracing/correlation
    requestId,
    // Optional: saved follow-up conversation (array of {question, answer, turnNumber, createdAt, journalContext})
    followUps,
    // Location data (only persisted if user explicitly consents)
    location,
    persistLocationConsent
  } = body || {};

  if (!spread || !spreadKey || !cards || !Array.isArray(cards)) {
    return { status: 400, body: { error: 'Invalid journal entry data' } };
  }
  const sanitizedFollowUps = sanitizeFollowUps(followUps);

  const returnExisting = async (existing) => {
    if (sanitizedFollowUps.length) {
      await insertFollowUps(env.DB, user.id, existing.id, sanitizedFollowUps, {
        readingRequestId: requestId,
        requestId
      });
    }
    return {
      status: 200,
      body: {
        success: true,
        entry: { id: existing.id, ts: existing.created_at * 1000 },
        deduplicated: true
      }
    };
  };

  // Deduplicate by session_seed to prevent double-saves
  if (sessionSeed) {
    const existing = await findEntryBySeed(env.DB, user.id, sessionSeed);
    if (existing) return returnExisting(existing);
  }

  const entryId = crypto.randomUUID();
  const nowSeconds = Math.floor(Date.now() / 1000);

  // Derive created_at/updated_at, allowing a **sanitized** client timestamp
  // for trusted flows like local-to-cloud migration.
  let createdAt = nowSeconds;
  if (typeof timestampMs === 'number' && Number.isFinite(timestampMs)) {
    const candidateSeconds = Math.floor(timestampMs / 1000);
    // Basic sanity window: >= 2000-01-01 and not more than 24h in the future
    const MIN_ALLOWED = 946684800; // 2000-01-01T00:00:00Z
    const MAX_ALLOWED = nowSeconds + 60 * 60 * 24;
    if (candidateSeconds >= MIN_ALLOWED && candidateSeconds <= MAX_ALLOWED) {
      createdAt = candidateSeconds;
    }
  }
  const updatedAt = createdAt;

  // Keep older/unknown context values nullable without rejecting the reading.
  const normalizedContext = normalizeJournalContext(context);

  // Location persistence: only store if BOTH location provided AND user explicitly consents
  const shouldPersistLocation = location?.latitude != null &&
                                location?.longitude != null &&
                                persistLocationConsent === true;
  const locationLatitude = shouldPersistLocation ? location.latitude : null;
  const locationLongitude = shouldPersistLocation ? location.longitude : null;
  const locationTimezone = shouldPersistLocation ? (location.timezone || null) : null;
  const locationConsent = shouldPersistLocation ? 1 : 0;

  try {
    await env.DB.prepare(`
      INSERT INTO journal_entries (
        id,
        user_id,
        created_at,
        updated_at,
        spread_key,
        spread_name,
        question,
        cards_json,
        narrative,
        themes_json,
        reflections_json,
        context,
        provider,
        session_seed,
        user_preferences_json,
        deck_id,
        request_id,
        location_latitude,
        location_longitude,
        location_timezone,
        location_consent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        entryId,
        user.id,
        createdAt,
        updatedAt,
        spreadKey,
        spread,
        question || null,
        JSON.stringify(cards),
        personalReading || null,
        themes ? JSON.stringify(themes) : null,
        reflections ? JSON.stringify(reflections) : null,
        normalizedContext,
        provider || null,
        sessionSeed || null,
        userPreferences ? JSON.stringify(userPreferences) : null,
        deckId || null,
        requestId || null,
        locationLatitude,
        locationLongitude,
        locationTimezone,
        locationConsent
      )
      .run();
  } catch (error) {
    // A concurrent save of the same seed won the unique index; answer with
    // its entry, exactly as the pre-insert lookup would have.
    if (sessionSeed && isUniqueViolation(error, 'session_seed')) {
      const existing = await findEntryBySeed(env.DB, user.id, sessionSeed);
      if (existing) return returnExisting(existing);
    }
    throw error;
  }

  if (sanitizedFollowUps.length) {
    await insertFollowUps(env.DB, user.id, entryId, sanitizedFollowUps, {
      readingRequestId: requestId,
      requestId
    });
  }

  // Schedule async extraction of coach suggestion data (steps + embeddings)
  if (personalReading && waitUntil) {
    scheduleCoachExtraction(env, entryId, personalReading, {
      waitUntil,
      requestId: requestId || entryId
    });
  }

  return {
    status: 201,
    body: {
      success: true,
      entry: { id: entryId, ts: createdAt * 1000 }
    }
  };
}
```

- [ ] **Step 5: Make `POST /api/journal` a thin wrapper**

In `functions/api/journal.js`, replace the import block (lines 7–13):

```js
import { getUserFromRequest } from '../lib/auth.js';
import { buildTierLimitedPayload, isEntitled } from '../lib/entitlements.js';
import { dedupeEntries } from '../../shared/journal/dedupe.js';
import { scheduleCoachExtraction } from '../lib/coachSuggestion.js';
import { safeJsonParse } from '../lib/utils.js';
import { insertFollowUps, loadFollowUpsByEntry, sanitizeFollowUps } from '../lib/journalFollowups.js';
import { normalizeJournalContext } from '../lib/journalContext.js';
```

with:

```js
import { getUserFromRequest } from '../lib/auth.js';
import { buildTierLimitedPayload, isEntitled } from '../lib/entitlements.js';
import { dedupeEntries } from '../../shared/journal/dedupe.js';
import { safeJsonParse } from '../lib/utils.js';
import { loadFollowUpsByEntry } from '../lib/journalFollowups.js';
import { saveAppJournalEntry } from '../lib/journalEntries.js';
```

Then replace everything from the doc comment `/**\n * POST /api/journal` to the end of the file with:

```js
/**
 * POST /api/journal
 * Save a new journal entry for the authenticated user.
 * Persistence and deduplication live in functions/lib/journalEntries.js.
 */
export async function onRequestPost(context) {
  const { request, env, waitUntil } = context;
  // Log-correlation id. Named distinctly because the request body carries its
  // own `requestId` (the reading's id).
  const logRequestId = crypto.randomUUID();

  try {
    // Authenticate user
    const user = await getUserFromRequest(request, env);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!isEntitled(user, 'plus')) {
      return new Response(
        JSON.stringify(
          buildTierLimitedPayload({
            message: 'Cloud journal sync requires an active Plus or Pro subscription',
            user,
            requiredTier: 'plus'
          })
        ),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const result = await saveAppJournalEntry({ env, user, body, waitUntil });
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error(`[${logRequestId}] [journal] Save entry error:`, error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
```

- [ ] **Step 6: Run the new and existing journal tests**

Run: `node --test tests/journalEntriesService.test.mjs tests/journalBearerAuth.test.mjs tests/journalFollowupPromptBoundary.test.mjs tests/journalEntryApi.test.mjs`
Expected: PASS across all four files. The existing files still pass because the SQL text is unchanged.

- [ ] **Step 7: Commit**

```bash
git add migrations/0030_add_journal_idempotency_key.sql functions/lib/journalEntries.js functions/api/journal.js tests/journalEntriesService.test.mjs
git commit -m "feat: move journal saves into a service and fix the seed race" -m "Adds migration 0030 (idempotency_key + partial unique index) for MCP reading saves." -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Atomic reading saves for MCP

**Files:**
- Modify: `functions/lib/journalEntries.js` (append the reading-save section)
- Test: `tests/journalEntriesService.test.mjs` (append a `describe` block)

**Interfaces:**
- Consumes: `isUniqueViolation` (Task 2) and migration 0030.
- Produces:
  - `READING_IDEMPOTENCY_PREFIX = 'reading:'`;
  - `cardFingerprint(spreadKey, cards): string`;
  - `saveReadingJournalEntry({ env, user, entry, waitUntil })`, which resolves to exactly one of:

    ```
    { outcome: 'saved', entry: { id, ts }, seedShared?: true }
    { outcome: 'already_saved', entry: { id, ts } }
    { outcome: 'conflict' }
    { outcome: 'not_saved' }
    { outcome: 'unconfirmed' }
    ```

    `entry` is `{ spread, spreadKey, question, cards, personalReading, themes, context, provider, sessionSeed, requestId, deckId, userPreferences }`. `cards` holds canonical journal cards, `requestId` is required, and every other field is a value or null.

- [ ] **Step 1: Write the failing tests**

Append to `tests/journalEntriesService.test.mjs` (add `saveReadingJournalEntry` to the existing import from `../functions/lib/journalEntries.js`):

```js
const READING_ENTRY = Object.freeze({
  spread: 'Three-Card Story (Past · Present · Future)',
  spreadKey: 'threeCard',
  question: 'What should I focus on?',
  cards: THREE_CARDS,
  personalReading: 'The Hermit asks for patience.',
  themes: { dominantSuit: 'Cups' },
  context: 'self',
  provider: 'openai-native',
  sessionSeed: null,
  requestId: 'req-mcp-1',
  deckId: 'rws-1909',
  userPreferences: null
});

/**
 * Wrap the SQLite D1 so the reading INSERT fails the way a lost D1 round
 * trip does: optionally after the row landed, optionally with the
 * verification lookup failing too.
 */
function failingInsertDb(d1, { landThenThrow = false, failVerify = false } = {}) {
  return {
    prepare(sql) {
      const statement = d1.prepare(sql);
      const isInsert = /INSERT INTO journal_entries/.test(sql);
      const isVerify = /idempotency_key = \?/.test(sql);
      return {
        bind(...args) {
          const bound = statement.bind(...args);
          return {
            first: (...rest) => (failVerify && isVerify
              ? Promise.reject(new Error('D1_ERROR: Network connection lost.'))
              : bound.first(...rest)),
            all: () => bound.all(),
            run: async () => {
              if (!isInsert) return bound.run();
              if (landThenThrow) await bound.run();
              throw new Error('D1_ERROR: Network connection lost.');
            }
          };
        }
      };
    },
    batch: (statements) => d1.batch(statements)
  };
}

describe('saveReadingJournalEntry (MCP)', () => {
  it('saves a new reading under its reading identity', async () => {
    const { d1, env } = await setup();
    const result = await saveReadingJournalEntry({ env, user: USER, entry: READING_ENTRY });

    assert.equal(result.outcome, 'saved');
    const [row] = d1.rows('SELECT id, user_id, idempotency_key, context, narrative, cards_json FROM journal_entries');
    assert.equal(row.id, result.entry.id);
    assert.equal(row.user_id, 'user-1');
    assert.equal(row.idempotency_key, 'reading:req-mcp-1');
    assert.equal(row.context, 'self');
    assert.equal(row.narrative, READING_ENTRY.personalReading);
    assert.deepEqual(JSON.parse(row.cards_json), THREE_CARDS);
  });

  it('answers already_saved for a second save of the same reading', async () => {
    const { d1, env } = await setup();
    const first = await saveReadingJournalEntry({ env, user: USER, entry: READING_ENTRY });
    const second = await saveReadingJournalEntry({ env, user: USER, entry: READING_ENTRY });

    assert.equal(second.outcome, 'already_saved');
    assert.equal(second.entry.id, first.entry.id);
    assert.equal(countEntries(d1), 1);
  });

  it('keeps one row when two saves of a seedless reading race', async () => {
    const { d1, env } = await setup();
    const [a, b] = await Promise.all([
      saveReadingJournalEntry({ env, user: USER, entry: READING_ENTRY }),
      saveReadingJournalEntry({ env, user: USER, entry: READING_ENTRY })
    ]);

    assert.deepEqual([a.outcome, b.outcome].sort(), ['already_saved', 'saved']);
    assert.equal(a.entry.id, b.entry.id);
    assert.equal(countEntries(d1), 1);
  });

  it('keeps one row when two saves of a seeded reading race', async () => {
    const { d1, env } = await setup();
    const entry = { ...READING_ENTRY, sessionSeed: '4242' };
    const [a, b] = await Promise.all([
      saveReadingJournalEntry({ env, user: USER, entry }),
      saveReadingJournalEntry({ env, user: USER, entry })
    ]);

    assert.equal(a.entry.id, b.entry.id);
    assert.equal(countEntries(d1), 1);
    assert.equal(d1.rows('SELECT session_seed FROM journal_entries')[0].session_seed, '4242');
  });

  it('refuses a request ID that already holds a different reading', async () => {
    const { d1, env } = await setup();
    await saveReadingJournalEntry({ env, user: USER, entry: READING_ENTRY });
    const other = { ...READING_ENTRY, cards: [{ ...THREE_CARDS[0], orientation: 'Reversed' }, THREE_CARDS[1], THREE_CARDS[2]] };

    const result = await saveReadingJournalEntry({ env, user: USER, entry: other });

    assert.deepEqual(result, { outcome: 'conflict' });
    assert.equal(countEntries(d1), 1);
  });

  it('stores a reading without its seed when another reading holds that seed', async () => {
    const { d1, env } = await setup();
    const first = await saveReadingJournalEntry({ env, user: USER, entry: { ...READING_ENTRY, sessionSeed: 'rose', requestId: 'req-a' } });
    const secondEntry = { ...READING_ENTRY, sessionSeed: 'rose', requestId: 'req-b', personalReading: 'A different reading.' };

    const second = await saveReadingJournalEntry({ env, user: USER, entry: secondEntry });

    assert.equal(second.outcome, 'saved');
    assert.equal(second.seedShared, true);
    assert.notEqual(second.entry.id, first.entry.id);
    const rows = d1.rows('SELECT idempotency_key, session_seed FROM journal_entries ORDER BY idempotency_key');
    assert.deepEqual(rows, [
      { idempotency_key: 'reading:req-a', session_seed: 'rose' },
      { idempotency_key: 'reading:req-b', session_seed: null }
    ]);

    const retry = await saveReadingJournalEntry({ env, user: USER, entry: secondEntry });
    assert.equal(retry.outcome, 'already_saved');
    assert.equal(retry.entry.id, second.entry.id, 'a shared seed never returns the other reading');
  });

  it('answers saved when the insert landed but its response was lost', async () => {
    const { d1, env } = await setup();
    const result = await saveReadingJournalEntry({
      env: { DB: failingInsertDb(d1, { landThenThrow: true }) },
      user: USER,
      entry: READING_ENTRY
    });

    assert.equal(result.outcome, 'saved');
    assert.equal(result.entry.id, d1.rows('SELECT id FROM journal_entries')[0].id);
  });

  it('answers not_saved when the insert failed and nothing landed', async () => {
    const { d1, env } = await setup();
    const result = await saveReadingJournalEntry({ env: { DB: failingInsertDb(d1) }, user: USER, entry: READING_ENTRY });

    assert.deepEqual(result, { outcome: 'not_saved' });
    assert.equal(countEntries(d1), 0);
  });

  it('answers unconfirmed when the verification also fails', async () => {
    const { d1 } = await setup();
    const result = await saveReadingJournalEntry({
      env: { DB: failingInsertDb(d1, { failVerify: true }) },
      user: USER,
      entry: READING_ENTRY
    });

    assert.deepEqual(result, { outcome: 'unconfirmed' });
  });

  it('stores the narrative byte for byte', async () => {
    const { d1, env } = await setup();
    const narrative = `  ${'Long passage ✨ café. '.repeat(1000)}\r\nEnd  `;
    await saveReadingJournalEntry({ env, user: USER, entry: { ...READING_ENTRY, personalReading: narrative } });
    assert.equal(d1.rows('SELECT narrative FROM journal_entries')[0].narrative, narrative);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/journalEntriesService.test.mjs`
Expected: FAIL, because `saveReadingJournalEntry` is not exported.

- [ ] **Step 3: Implement the reading save**

In `functions/lib/journalEntries.js`, add this import below the existing imports:

```js
import { safeJsonParse } from './utils.js';
```

Append this to the end of `functions/lib/journalEntries.js`:

```js
// ---------------------------------------------------------------------------
// Reading saves from the ChatGPT MCP tools (spec §7.2)
// ---------------------------------------------------------------------------

export const READING_IDEMPOTENCY_PREFIX = 'reading:';

/**
 * Content identity of a reading: spread key plus each card's position,
 * canonical name and orientation, in order. A request ID that already holds
 * a different fingerprint belongs to a different reading.
 *
 * @param {string|null} spreadKey
 * @param {Array<object>} cards - Journal cards (canonical `name`)
 * @returns {string}
 */
export function cardFingerprint(spreadKey, cards) {
  const list = Array.isArray(cards) ? cards : [];
  return JSON.stringify([
    spreadKey ?? null,
    ...list.map((card) => [card?.position ?? null, card?.name ?? null, card?.orientation ?? null])
  ]);
}

async function findEntryByIdempotencyKey(db, userId, idempotencyKey) {
  return db.prepare(
    'SELECT id, created_at, spread_key, cards_json FROM journal_entries WHERE user_id = ? AND idempotency_key = ?'
  ).bind(userId, idempotencyKey).first();
}

function isSameReading(row, fingerprint) {
  return cardFingerprint(row.spread_key, safeJsonParse(row.cards_json, [])) === fingerprint;
}

function entryRef(row) {
  return { id: row.id, ts: row.created_at * 1000 };
}

async function insertReadingEntry(db, { entryId, userId, now, entry, sessionSeed, idempotencyKey }) {
  await db.prepare(`
    INSERT INTO journal_entries (
      id, user_id, created_at, updated_at, spread_key, spread_name, question, cards_json,
      narrative, themes_json, reflections_json, context, provider, session_seed,
      user_preferences_json, deck_id, request_id, location_latitude, location_longitude,
      location_timezone, location_consent, idempotency_key
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, ?)
  `).bind(
    entryId,
    userId,
    now,
    now,
    entry.spreadKey,
    entry.spread,
    entry.question ?? null,
    JSON.stringify(entry.cards),
    entry.personalReading,
    entry.themes ? JSON.stringify(entry.themes) : null,
    normalizeJournalContext(entry.context),
    entry.provider ?? null,
    sessionSeed,
    entry.userPreferences ? JSON.stringify(entry.userPreferences) : null,
    entry.deckId ?? null,
    entry.requestId,
    idempotencyKey
  ).run();
}

async function verifyAfterError(db, userId, idempotencyKey, fingerprint, error) {
  console.error('[journal] Reading save failed; verifying before answering:', error?.message || error);
  let existing;
  try {
    existing = await findEntryByIdempotencyKey(db, userId, idempotencyKey);
  } catch (verifyError) {
    console.error('[journal] Verification after a failed reading save also failed:', verifyError?.message || verifyError);
    return { outcome: 'unconfirmed' };
  }
  if (!existing) return { outcome: 'not_saved' };
  return isSameReading(existing, fingerprint)
    ? { outcome: 'saved', entry: entryRef(existing) }
    : { outcome: 'conflict' };
}

/**
 * Save a completed reading from the MCP tools, from either a job snapshot or
 * a contract payload. The insert goes first, and the unique indexes decide:
 * - idempotency_key taken: the reading is already stored (same fingerprint,
 *   so already_saved), or the request ID belongs to a different reading
 *   (conflict, with nothing written);
 * - session_seed taken: a different reading holds the seed (for example a
 *   reused seed phrase), so store this reading without it (seedShared);
 * - anything else: re-read by identity before answering.
 *
 * @param {object} params
 * @param {object} params.env - Worker bindings; env.DB is required
 * @param {object} params.user - Authenticated, journal-entitled user
 * @param {object} params.entry - Normalized entry; see the plan's Task 3 interfaces
 * @param {Function} [params.waitUntil]
 */
export async function saveReadingJournalEntry({ env, user, entry, waitUntil }) {
  const db = env.DB;
  const idempotencyKey = `${READING_IDEMPOTENCY_PREFIX}${entry.requestId}`;
  const fingerprint = cardFingerprint(entry.spreadKey, entry.cards);

  const attempt = async (sessionSeed) => {
    const entryId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    try {
      await insertReadingEntry(db, { entryId, userId: user.id, now, entry, sessionSeed, idempotencyKey });
      return { outcome: 'saved', entry: { id: entryId, ts: now * 1000 }, inserted: true };
    } catch (error) {
      if (isUniqueViolation(error, 'idempotency_key')) {
        const existing = await findEntryByIdempotencyKey(db, user.id, idempotencyKey);
        if (existing && isSameReading(existing, fingerprint)) {
          return { outcome: 'already_saved', entry: entryRef(existing) };
        }
        return { outcome: 'conflict' };
      }
      if (sessionSeed && isUniqueViolation(error, 'session_seed')) {
        return { outcome: 'retry_without_seed' };
      }
      return verifyAfterError(db, user.id, idempotencyKey, fingerprint, error);
    }
  };

  let result = await attempt(entry.sessionSeed || null);
  let seedShared = false;
  if (result.outcome === 'retry_without_seed') {
    // The seed never identifies a reading on this path; the idempotency key
    // still dedupes retries of this one.
    seedShared = true;
    result = await attempt(null);
  }

  if (result.outcome !== 'saved') return result;

  if (result.inserted && entry.personalReading && waitUntil) {
    scheduleCoachExtraction(env, result.entry.id, entry.personalReading, {
      waitUntil,
      requestId: entry.requestId
    });
  }
  return { outcome: 'saved', entry: result.entry, ...(seedShared ? { seedShared: true } : {}) };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/journalEntriesService.test.mjs`
Expected: PASS, including every `saveReadingJournalEntry (MCP)` test.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/journalEntries.js tests/journalEntriesService.test.mjs
git commit -m "feat: save MCP readings under an atomic reading identity" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 4: Refuse the synthetic service account on journal routes

**Files:**
- Create: `functions/lib/journalAccess.js`
- Modify: `functions/api/journal.js`, `functions/api/journal/[id].js`, `functions/api/journal/reflections.js`
- Test: `tests/journalBearerAuth.test.mjs` (rewritten)

**Interfaces:**
- Consumes: `createD1`, `seedUser`, `seedSession`, `seedEntry`, `jsonRequest` and `THREE_CARDS` (Task 1).
- Produces:
  - `SERVICE_ACCOUNT_JOURNAL_ERROR`;
  - `isServiceAccount(user)`;
  - `checkJournalAccess(user): null | { status: 401|403, body: object }`;
  - `journalAccessDenied(user): Response | null`.

- [ ] **Step 1: Rewrite the bearer-auth test file**

Replace the whole of `tests/journalBearerAuth.test.mjs` with:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createD1 } from './helpers/d1Sqlite.mjs';
import { jsonRequest, seedEntry, seedSession, seedUser, THREE_CARDS } from './helpers/journalFixtures.mjs';
import { onRequestGet as listJournal, onRequestPost as saveJournal } from '../functions/api/journal.js';
import { onRequestDelete as deleteEntry, onRequestGet as getEntry } from '../functions/api/journal/[id].js';
import { onRequestPost as addReflection } from '../functions/api/journal/reflections.js';

// Realistic long random token (>= MIN_SERVICE_TOKEN_LENGTH chars, no sk_ prefix).
const SERVICE_TOKEN = 'svc_journal_guard_0123456789abcdef0123456789abcdef';

const SAVE_BODY = {
  spread: 'Three-Card Story (Past · Present · Future)',
  spreadKey: 'threeCard',
  cards: THREE_CARDS,
  personalReading: 'A reading.'
};

async function setup() {
  const d1 = await createD1();
  await seedUser(d1, { id: 'user-1' });
  await seedSession(d1, { id: 'session-1', userId: 'user-1' });
  await seedEntry(d1, { id: 'entry-1', userId: 'user-1' });
  const env = { DB: d1, GPT_SERVICE_TOKEN: SERVICE_TOKEN, GPT_SERVICE_USER_ID: 'service:journal-test' };
  return { d1, env };
}

function countEntries(d1) {
  return d1.rows('SELECT COUNT(*) AS n FROM journal_entries')[0].n;
}

const listRoute = (env, headers) => listJournal({
  request: new Request('https://example.com/api/journal', { headers }), env
});
const saveRoute = (env, headers) => saveJournal({
  request: jsonRequest('https://example.com/api/journal', { body: SAVE_BODY, headers }), env, waitUntil: () => {}
});
const getRoute = (env, headers) => getEntry({
  request: new Request('https://example.com/api/journal/entry-1', { headers }), env, params: { id: 'entry-1' }
});
const deleteRoute = (env, headers) => deleteEntry({
  request: new Request('https://example.com/api/journal/entry-1', { method: 'DELETE', headers }), env, params: { id: 'entry-1' }
});
const reflectRoute = (env, headers) => addReflection({
  request: jsonRequest('https://example.com/api/journal/entry-1/reflections', { body: { text: 'note', scope: 'reading' }, headers }),
  env,
  params: { id: 'entry-1' }
});

const ROUTES = [
  ['GET /api/journal', listRoute],
  ['POST /api/journal', saveRoute],
  ['GET /api/journal/:id', getRoute],
  ['DELETE /api/journal/:id', deleteRoute],
  ['POST /api/journal/:id/reflections', reflectRoute]
];

describe('journal routes refuse the synthetic GPT service account', () => {
  for (const [name, call] of ROUTES) {
    it(`${name} answers 403 service_account_journal_forbidden`, async () => {
      const { d1, env } = await setup();
      const response = await call(env, { Authorization: `Bearer ${SERVICE_TOKEN}` });

      assert.equal(response.status, 403);
      const payload = await response.json();
      assert.equal(payload.code, 'service_account_journal_forbidden');
      assert.equal(payload.error, 'Journal requires a personal account');
      assert.equal(countEntries(d1), 1, 'nothing written or deleted');
      assert.equal(d1.rows('SELECT reflections_json FROM journal_entries')[0].reflections_json, null);
    });
  }
});

describe('journal routes accept personal credentials', () => {
  it('POST /api/journal saves with a bearer session token', async () => {
    const { d1, env } = await setup();
    const response = await saveRoute(env, { Authorization: 'Bearer session-1' });

    assert.equal(response.status, 201);
    const { entry } = await response.json();
    assert.equal(d1.rows('SELECT user_id FROM journal_entries WHERE id = ?', [entry.id])[0].user_id, 'user-1');
  });

  it('POST /api/journal saves with the session cookie', async () => {
    const { env } = await setup();
    const response = await saveRoute(env, { Cookie: 'session=session-1' });
    assert.equal(response.status, 201);
  });

  it('GET /api/journal/:id returns the entry to its owner', async () => {
    const { env } = await setup();
    const response = await getRoute(env, { Authorization: 'Bearer session-1' });
    assert.equal(response.status, 200);
  });

  it('DELETE /api/journal/:id deletes for its owner', async () => {
    const { d1, env } = await setup();
    const response = await deleteRoute(env, { Authorization: 'Bearer session-1' });
    assert.equal(response.status, 200);
    assert.equal(countEntries(d1), 0);
  });

  it('POST /api/journal answers 401 without credentials', async () => {
    const { env } = await setup();
    const response = await saveRoute(env, {});
    assert.equal(response.status, 401);
  });

  it('POST /api/journal answers 401 for an unknown bearer token', async () => {
    const { env } = await setup();
    const response = await saveRoute(env, { Authorization: 'Bearer not-a-real-token-at-all-0123456789' });
    assert.equal(response.status, 401);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/journalBearerAuth.test.mjs`
Expected: the five `refuse the synthetic GPT service account` tests FAIL (status is 200 or 201, not 403). The personal-credential tests pass.

- [ ] **Step 3: Write the access helper**

Create `functions/lib/journalAccess.js`:

```js
/**
 * Journal access checks shared by the journal HTTP routes and the MCP tools.
 *
 * The synthetic GPT service account (GPT_SERVICE_TOKEN / GPT_OWNER_TOKEN)
 * is refused. Its users row can never sign in, so anything it saved would
 * sit in a journal no person can open. Personal credentials (session
 * cookie, bearer session token, `sk_` API key) are unaffected.
 */

import { buildTierLimitedPayload, isEntitled } from './entitlements.js';

export const SERVICE_ACCOUNT_JOURNAL_ERROR = Object.freeze({
  error: 'Journal requires a personal account',
  code: 'service_account_journal_forbidden'
});

export function isServiceAccount(user) {
  return user?.auth_provider === 'service' || user?.is_service_account === true;
}

/**
 * @param {object|null} user - Result of getUserFromRequest / loadActiveUserById
 * @returns {null | { status: 401|403, body: object }}
 */
export function checkJournalAccess(user) {
  if (!user) {
    return { status: 401, body: { error: 'Not authenticated' } };
  }
  if (isServiceAccount(user)) {
    return { status: 403, body: { ...SERVICE_ACCOUNT_JOURNAL_ERROR } };
  }
  if (!isEntitled(user, 'plus')) {
    return {
      status: 403,
      body: buildTierLimitedPayload({
        message: 'Cloud journal sync requires an active Plus or Pro subscription',
        user,
        requiredTier: 'plus'
      })
    };
  }
  return null;
}

/**
 * HTTP form of checkJournalAccess.
 * @returns {Response|null} A JSON error response, or null when access is allowed
 */
export function journalAccessDenied(user) {
  const denied = checkJournalAccess(user);
  if (!denied) return null;
  return new Response(JSON.stringify(denied.body), {
    status: denied.status,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

- [ ] **Step 4: Use the helper in `journal.js` and `[id].js`**

In both `functions/api/journal.js` and `functions/api/journal/[id].js`, replace every occurrence of this block (use replace-all; it appears twice in each file):

```js
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!isEntitled(user, 'plus')) {
      return new Response(
        JSON.stringify(
          buildTierLimitedPayload({
            message: 'Cloud journal sync requires an active Plus or Pro subscription',
            user,
            requiredTier: 'plus'
          })
        ),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
```

with:

```js
    const denied = journalAccessDenied(user);
    if (denied) return denied;
```

Then fix the imports.
- In `functions/api/journal.js`, replace `import { buildTierLimitedPayload, isEntitled } from '../lib/entitlements.js';` with `import { journalAccessDenied } from '../lib/journalAccess.js';`.
- In `functions/api/journal/[id].js`, replace `import { buildTierLimitedPayload, isEntitled } from '../../lib/entitlements.js';` with `import { journalAccessDenied } from '../../lib/journalAccess.js';`.

Check: `grep -n "isEntitled\|buildTierLimitedPayload" functions/api/journal.js "functions/api/journal/[id].js"` prints nothing.

- [ ] **Step 5: Use the helper in `reflections.js`**

In `functions/api/journal/reflections.js`, replace:

```js
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return json({ error: 'Not authenticated' }, 401);
    }

    if (!isEntitled(user, 'plus')) {
      return json(
        buildTierLimitedPayload({
          message: 'Cloud journal sync requires an active Plus or Pro subscription',
          user,
          requiredTier: 'plus'
        }),
        403
      );
    }
```

with:

```js
    const user = await getUserFromRequest(request, env);
    const denied = journalAccessDenied(user);
    if (denied) return denied;
```

Then replace `import { buildTierLimitedPayload, isEntitled } from '../../lib/entitlements.js';` with `import { journalAccessDenied } from '../../lib/journalAccess.js';`.

- [ ] **Step 6: Run the tests**

Run: `node --test tests/journalBearerAuth.test.mjs tests/journalEntryApi.test.mjs tests/journalFollowupPromptBoundary.test.mjs`
Expected: PASS for all three files.

Run: `node --test tests/journalReflections.test.mjs`
Expected: exactly one failure, "accepts the GPT service bearer token and writes as the service user", which now gets 403. That's the intended new behaviour, and Task 6 rewrites that file. Any other failure is a regression; fix it before committing.

- [ ] **Step 7: Commit**

```bash
git add functions/lib/journalAccess.js functions/api/journal.js "functions/api/journal/[id].js" functions/api/journal/reflections.js tests/journalBearerAuth.test.mjs
git commit -m "feat: refuse the synthetic service account on journal routes" -m "Entries saved through the shared GPT token landed in an account no one can sign in to." -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Human-readable reflection labels in the journal and export

**Files:**
- Create: `shared/journal/reflectionLabels.js`
- Modify: `src/components/journal/entry-card/hooks/useEntryMetadata.js`
- Modify: `src/components/journal/entry-card/EntrySections/ReflectionsSection.jsx`
- Modify: `functions/api/journal-export/index.js`
- Test: `tests/reflectionLabels.test.mjs`, `tests/journal-export.test.mjs` (append)

**Interfaces:**
- Produces:
  - `READING_REFLECTION_KEY = 'Overall'`;
  - `READING_REFLECTION_LABEL = 'Whole reading'`;
  - `buildReflectionEntries(reflections, cards): Array<[label: string, note: string]>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/reflectionLabels.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildReflectionEntries,
  READING_REFLECTION_KEY,
  READING_REFLECTION_LABEL
} from '../shared/journal/reflectionLabels.js';

const CARDS = [
  { position: 'Past', name: 'The Hermit' },
  { position: 'Present', name: 'Three of Cups' },
  { position: 'Future', name: 'The Star' }
];

describe('buildReflectionEntries', () => {
  it('puts the whole-reading note first, then cards in spread order with position and name', () => {
    const entries = buildReflectionEntries({ 2: 'hope returns', Overall: 'gentle overall', 0: 'six months alone' }, CARDS);
    assert.deepEqual(entries, [
      [READING_REFLECTION_LABEL, 'gentle overall'],
      ['Past · The Hermit', 'six months alone'],
      ['Future · The Star', 'hope returns']
    ]);
    assert.equal(READING_REFLECTION_KEY, 'Overall');
  });

  it('falls back to a numbered label when the index has no card', () => {
    assert.deepEqual(buildReflectionEntries({ 5: 'stray note' }, CARDS), [['Card 6', 'stray note']]);
  });

  it('uses the reading field name `card` when a stored card has no `name`', () => {
    assert.deepEqual(buildReflectionEntries({ 0: 'note' }, [{ position: 'Past', card: 'The Fool' }]), [['Past · The Fool', 'note']]);
  });

  it('keeps legacy non-index keys, after the cards', () => {
    assert.deepEqual(buildReflectionEntries({ Past: 'legacy', 0: 'indexed' }, CARDS), [
      ['Past · The Hermit', 'indexed'],
      ['Past', 'legacy']
    ]);
  });

  it('drops blank and non-string notes', () => {
    assert.deepEqual(buildReflectionEntries({ 0: '   ', 1: 42, 2: 'kept' }, CARDS), [['Future · The Star', 'kept']]);
  });

  it('returns an empty list for missing or malformed maps', () => {
    for (const value of [null, undefined, 'text', ['a'], 7]) {
      assert.deepEqual(buildReflectionEntries(value, CARDS), []);
    }
  });
});
```

Append to `tests/journal-export.test.mjs`:

```js
test('formatEntryAsText labels reflections by card and whole reading', () => {
  const text = formatEntryAsText({
    ts: Date.UTC(2026, 8, 22),
    spread: 'Three-Card Story (Past · Present · Future)',
    cards: [
      { position: 'Past', name: 'The Hermit', orientation: 'Upright' },
      { position: 'Present', name: 'Three of Cups', orientation: 'Reversed' }
    ],
    reflections: { 1: 'friends around me', Overall: 'gentle overall' }
  });

  assert.match(text, /## Personal Reflections\nWhole reading: gentle overall\nPresent · Three of Cups: friends around me/);
  assert.doesNotMatch(text, /Position 1:/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/reflectionLabels.test.mjs tests/journal-export.test.mjs`
Expected: FAIL. `reflectionLabels` can't find its module, and the export test sees `Position 1:`.

- [ ] **Step 3: Write the helper**

Create `shared/journal/reflectionLabels.js`:

```js
/**
 * Display labels for a journal entry's reflections map.
 *
 * Reflections are stored as a flat string map. Card notes are keyed by the
 * card's index in the entry ("0", "1", ...). A note on the whole reading
 * uses the reserved key "Overall". Keys that predate that scheme are shown
 * as-is. Shared by the journal UI and the text/PDF export.
 */

export const READING_REFLECTION_KEY = 'Overall';
export const READING_REFLECTION_LABEL = 'Whole reading';

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function labelForCard(card, index) {
  const position = cleanText(card?.position);
  const name = cleanText(card?.name) || cleanText(card?.card);
  if (position && name) return `${position} · ${name}`;
  return position || name || `Card ${index + 1}`;
}

/**
 * @param {Record<string, string>|null|undefined} reflections
 * @param {Array<object>} [cards] - The entry's cards, in spread order
 * @returns {Array<[string, string]>} [label, note] pairs: whole reading first,
 *   then cards in spread order, then any other keys
 */
export function buildReflectionEntries(reflections, cards = []) {
  if (!reflections || typeof reflections !== 'object' || Array.isArray(reflections)) return [];
  const safeCards = Array.isArray(cards) ? cards : [];

  const readingNotes = [];
  const cardNotes = [];
  const otherNotes = [];
  for (const [key, note] of Object.entries(reflections)) {
    if (typeof note !== 'string' || !note.trim()) continue;
    if (key === READING_REFLECTION_KEY) {
      readingNotes.push([READING_REFLECTION_LABEL, note]);
    } else if (/^\d+$/.test(key)) {
      const index = Number(key);
      cardNotes.push({ index, entry: [labelForCard(safeCards[index], index), note] });
    } else {
      otherNotes.push([key, note]);
    }
  }
  cardNotes.sort((a, b) => a.index - b.index);
  return [...readingNotes, ...cardNotes.map(({ entry }) => entry), ...otherNotes];
}
```

- [ ] **Step 4: Use the labels in the journal UI**

In `src/components/journal/entry-card/hooks/useEntryMetadata.js`, add this import after the `normalizeTimestamp` import:

```js
import { buildReflectionEntries } from '../../../../../shared/journal/reflectionLabels.js';
```

and replace:

```js
  const reflections = useMemo(() => {
    if (!entry?.reflections || typeof entry.reflections !== 'object') return [];
    return Object.entries(entry.reflections).filter(
      ([, note]) => typeof note === 'string' && note.trim()
    );
  }, [entry]);
```

with:

```js
  const reflections = useMemo(
    () => buildReflectionEntries(entry?.reflections, cards),
    [entry?.reflections, cards]
  );
```

In `src/components/journal/entry-card/EntrySections/ReflectionsSection.jsx`, replace:

```jsx
          {reflections.map(([position, note], index) => (
            <li
              key={`${position || 'reflection'}-${index}`}
              className="flex items-start gap-2 text-sm leading-relaxed"
            >
              <span className="font-semibold text-main">
                {position || `Note ${index + 1}`}
              </span>
              <span className="text-muted">{note}</span>
            </li>
          ))}
```

with:

```jsx
          {reflections.map(([label, note], index) => (
            <li
              key={`${label || 'reflection'}-${index}`}
              className="flex items-start gap-2 text-sm leading-relaxed"
            >
              <span className="font-semibold text-main">
                {label || `Note ${index + 1}`}
              </span>
              <span className="text-muted whitespace-pre-line">{note}</span>
            </li>
          ))}
```

and change the file's header comment line ` * Displays user reflections/notes for each card position.` to ` * Displays reflections labelled by card ("Past · The Hermit") or "Whole reading".`

- [ ] **Step 5: Use the labels in the export**

In `functions/api/journal-export/index.js`, add after the existing imports:

```js
import { buildReflectionEntries } from '../../../shared/journal/reflectionLabels.js';
```

and replace:

```js
  if (entry.reflections && Object.keys(entry.reflections).length > 0) {
    lines.push('## Personal Reflections');
    for (const [position, reflection] of Object.entries(entry.reflections)) {
      if (reflection) {
        lines.push(`Position ${position}: ${reflection}`);
      }
    }
    lines.push('');
  }
```

with:

```js
  const reflectionEntries = buildReflectionEntries(entry.reflections, entry.cards);
  if (reflectionEntries.length > 0) {
    lines.push('## Personal Reflections');
    for (const [label, note] of reflectionEntries) {
      lines.push(`${label}: ${note}`);
    }
    lines.push('');
  }
```

- [ ] **Step 6: Run the tests and the build**

Run: `node --test tests/reflectionLabels.test.mjs tests/journal-export.test.mjs && npm run build`
Expected: both test files PASS, and `vite build` completes without errors.

- [ ] **Step 7: Commit**

```bash
git add shared/journal/reflectionLabels.js src/components/journal/entry-card/hooks/useEntryMetadata.js src/components/journal/entry-card/EntrySections/ReflectionsSection.jsx functions/api/journal-export/index.js tests/reflectionLabels.test.mjs tests/journal-export.test.mjs
git commit -m "fix: label journal reflections by card instead of raw map keys" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 6: Reflections service aligned with the audited contract

**Files:**
- Create: `functions/lib/journalReflections.js`
- Modify: `functions/api/journal/reflections.js` (rewritten as a thin wrapper)
- Test: `tests/journalReflections.test.mjs` (rewritten)

**Interfaces:**
- Consumes:
  - `READING_REFLECTION_KEY` (Task 5);
  - `journalAccessDenied` (Task 4);
  - `canonicalizeCardName` from `shared/vision/cardNameMapping.js`;
  - `getDeckAlias` from `shared/vision/deckAssets.js`.
- Produces:
  - `MAX_REFLECTION_LENGTH = 2000`;
  - `MAX_TARGET_REFLECTION_LENGTH = 20000`;
  - `MAX_WRITE_ATTEMPTS = 3`;
  - `READING_REFLECTION_KEY`, re-exported;
  - `resolveCardIndex(cards, { card, position, cardIndex }, { deckId }) → { index } | { error }`;
  - `noteIsPresent(stored, text): boolean`;
  - `addJournalReflection({ env, user, entryId, input })`, which resolves to `{ status: 200|400|404|409, body }`. The 200 body is `{ success, entryId, key, reflection: { key, scope, cardIndex?, card?, position?, text }, reflections, alreadyPresent? }`. `reflection.card` is the reusable deck label; stored journal cards keep their canonical `name`.

- [ ] **Step 1: Rewrite the reflections tests**

Replace the whole of `tests/journalReflections.test.mjs` with:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createD1 } from './helpers/d1Sqlite.mjs';
import { jsonRequest, seedEntry, seedSession, seedUser } from './helpers/journalFixtures.mjs';
import { onRequestPost } from '../functions/api/journal/reflections.js';
import {
  addJournalReflection,
  MAX_REFLECTION_LENGTH,
  MAX_TARGET_REFLECTION_LENGTH
} from '../functions/lib/journalReflections.js';

const OWNER = Object.freeze({
  id: 'user-1',
  subscription_tier: 'plus',
  subscription_status: 'active',
  auth_provider: 'session'
});

const THOTH_CARDS = [
  { position: 'Past', name: 'Knight of Wands', suit: 'Wands', rank: 'Knight', rankValue: 12, orientation: 'Upright' },
  { position: 'Present', name: 'King of Wands', suit: 'Wands', rank: 'King', rankValue: 14, orientation: 'Upright' }
];

async function setup({ tier = 'plus', entry = {} } = {}) {
  const d1 = await createD1();
  await seedUser(d1, { id: 'user-1', tier });
  await seedSession(d1, { id: 'session-1', userId: 'user-1' });
  await seedUser(d1, { id: 'user-2' });
  await seedEntry(d1, { id: 'entry-1', userId: 'user-1', ...entry });
  await seedEntry(d1, { id: 'entry-other', userId: 'user-2' });
  return { d1, env: { DB: d1 } };
}

async function post(env, body, { entryId = 'entry-1', cookie = 'session=session-1' } = {}) {
  const response = await onRequestPost({
    request: jsonRequest(`https://example.com/api/journal/${entryId}/reflections`, {
      body,
      headers: cookie ? { Cookie: cookie } : {}
    }),
    env,
    params: { id: entryId }
  });
  return { response, payload: await response.json() };
}

function stored(d1, entryId = 'entry-1') {
  const [row] = d1.rows('SELECT reflections_json FROM journal_entries WHERE id = ?', [entryId]);
  return row.reflections_json === null ? null : JSON.parse(row.reflections_json);
}

/** Route UPDATE statements for the reflections map through `onUpdate`. */
function interceptUpdates(d1, onUpdate) {
  return {
    prepare(sql) {
      const statement = d1.prepare(sql);
      if (!/UPDATE journal_entries SET reflections_json/.test(sql)) return statement;
      return { bind: (...args) => ({ run: () => onUpdate(statement.bind(...args)) }) };
    }
  };
}

describe('reflections: access', () => {
  it('answers 401 without credentials', async () => {
    const { d1, env } = await setup();
    const { response, payload } = await post(env, { text: 'note', scope: 'reading' }, { cookie: null });
    assert.equal(response.status, 401);
    assert.equal(payload.error, 'Not authenticated');
    assert.equal(stored(d1), null);
  });

  it('answers a tier-limited 403 below Plus', async () => {
    const { env } = await setup({ tier: 'free' });
    const { response, payload } = await post(env, { text: 'note', scope: 'reading' });
    assert.equal(response.status, 403);
    assert.equal(payload.tierLimited, true);
    assert.equal(payload.requiredTier, 'plus');
  });

  it("answers the same 404 for a missing entry and for another user's entry", async () => {
    const { d1, env } = await setup();
    const missing = await post(env, { text: 'note', scope: 'reading' }, { entryId: 'nope' });
    const foreign = await post(env, { text: 'note', scope: 'reading' }, { entryId: 'entry-other' });
    assert.equal(missing.response.status, 404);
    assert.equal(foreign.response.status, 404);
    assert.deepEqual(foreign.payload, missing.payload);
    assert.equal(stored(d1, 'entry-other'), null);
  });
});

describe('reflections: validation', () => {
  it('accepts 1 and 2,000 characters; rejects blank and 2,001', async () => {
    const { env } = await setup();
    assert.equal(MAX_REFLECTION_LENGTH, 2000);
    assert.equal((await post(env, { text: 'x', scope: 'reading' })).response.status, 200);
    assert.equal((await post(env, { text: 'y'.repeat(2000), scope: 'reading' })).response.status, 200);
    const tooLong = await post(env, { text: 'z'.repeat(2001), scope: 'reading' });
    assert.equal(tooLong.response.status, 400);
    assert.equal(tooLong.payload.maxLength, 2000);
    assert.equal((await post(env, { text: '   ', scope: 'reading' })).response.status, 400);
  });

  it('rejects `mode`: reflections only append', async () => {
    const { d1, env } = await setup();
    const { response, payload } = await post(env, { text: 'note', scope: 'reading', mode: 'replace' });
    assert.equal(response.status, 400);
    assert.match(payload.error, /append-only/);
    assert.equal(stored(d1), null);
  });

  it('rejects an unknown scope', async () => {
    const { env } = await setup();
    const { response } = await post(env, { text: 'note', scope: 'deck' });
    assert.equal(response.status, 400);
  });
});

describe('reflections: targeting', () => {
  it('files a card note under the resolved index and reports the target', async () => {
    const { d1, env } = await setup();
    const { response, payload } = await post(env, { text: 'six months alone', scope: 'card', card: 'The Hermit', position: 'Past' });

    assert.equal(response.status, 200);
    assert.deepEqual(stored(d1), { 0: 'six months alone' });
    assert.equal(payload.success, true);
    assert.equal(payload.entryId, 'entry-1');
    assert.equal(payload.key, '0');
    assert.deepEqual(payload.reflection, {
      key: '0', scope: 'card', cardIndex: 0, card: 'The Hermit', position: 'Past', text: 'six months alone'
    });
    assert.equal(payload.alreadyPresent, undefined);
  });

  it('resolves a card by name alone, ignoring case and a leading "the"', async () => {
    const { d1, env } = await setup();
    const { payload } = await post(env, { text: 'hope returns', scope: 'card', card: 'star' });
    assert.equal(payload.key, '2');
    assert.deepEqual(stored(d1), { 2: 'hope returns' });
  });

  it('resolves a card by position alone and by cardIndex', async () => {
    const { d1, env } = await setup();
    await post(env, { text: 'friends around me', scope: 'card', position: 'present' });
    await post(env, { text: 'index note', cardIndex: 0 });
    assert.deepEqual(stored(d1), { 1: 'friends around me', 0: 'index note' });
  });

  it('requires a position when the card appears twice', async () => {
    const cards = [
      { position: 'Past', name: 'The Hermit', number: 9, orientation: 'Upright' },
      { position: 'Future', name: 'The Hermit', number: 9, orientation: 'Reversed' }
    ];
    const { env } = await setup({ entry: { cards } });
    const ambiguous = await post(env, { text: 'which one?', scope: 'card', card: 'The Hermit' });
    assert.equal(ambiguous.response.status, 400);
    assert.match(ambiguous.payload.error, /more than once/);

    const precise = await post(env, { text: 'the later one', scope: 'card', card: 'The Hermit', position: 'Future' });
    assert.equal(precise.payload.key, '1');
  });

  it('rejects a card that is not in the entry and lists the entry cards', async () => {
    const { d1, env } = await setup();
    const { response, payload } = await post(env, { text: 'note', scope: 'card', card: 'The Tower' });
    assert.equal(response.status, 400);
    assert.match(payload.error, /Tower/);
    assert.deepEqual(payload.cards.map((card) => card.name), ['The Hermit', 'Three of Cups', 'The Star']);
    assert.equal(stored(d1), null);
  });

  it('resolves a deck label through the entry deck (Thoth)', async () => {
    const { d1, env } = await setup({ entry: { deckId: 'thoth-a1', cards: THOTH_CARDS } });
    const prince = await post(env, { text: 'the Prince', scope: 'card', card: 'Prince of Wands', position: 'Past' });
    const knight = await post(env, { text: 'the Thoth Knight', scope: 'card', card: 'Knight of Wands', position: 'Present' });
    assert.equal(prince.payload.key, '0', 'Thoth Prince of Wands is canonical Knight of Wands');
    assert.equal(knight.payload.key, '1', 'Thoth Knight of Wands is canonical King of Wands');
    assert.equal(prince.payload.reflection.card, 'Prince of Wands');
    assert.equal(knight.payload.reflection.card, 'Knight of Wands');
    const [entry] = d1.rows('SELECT cards_json FROM journal_entries WHERE id = ?', ['entry-1']);
    assert.deepEqual(JSON.parse(entry.cards_json).map((card) => card.name), ['Knight of Wands', 'King of Wands']);

    // Each returned card is a reusable input, even where a Thoth label collides
    // with the canonical name of the other stored card.
    const princeRetry = await post(env, {
      text: 'the Prince', scope: 'card',
      card: prince.payload.reflection.card, position: prince.payload.reflection.position
    });
    const knightRetry = await post(env, {
      text: 'the Thoth Knight', scope: 'card', card: knight.payload.reflection.card
    });
    assert.equal(princeRetry.payload.key, '0');
    assert.equal(knightRetry.payload.key, '1');
    assert.equal(princeRetry.payload.alreadyPresent, true);
    assert.equal(knightRetry.payload.alreadyPresent, true);
    assert.deepEqual(stored(d1), { 0: 'the Prince', 1: 'the Thoth Knight' });
  });

  it('lists deck labels next to canonical names for non-RWS entries', async () => {
    const { env } = await setup({ entry: { deckId: 'thoth-a1', cards: THOTH_CARDS } });
    const { payload } = await post(env, { text: 'note', scope: 'card', card: 'The Tower' });
    assert.deepEqual(payload.cards.map((card) => card.label), ['Prince of Wands', 'Knight of Wands']);
  });

  it('files a reading note under Overall, and defaults to reading scope when no card is named', async () => {
    const { d1, env } = await setup();
    const explicit = await post(env, { text: 'whole reading felt gentle', scope: 'reading' });
    const implicit = await post(env, { text: 'and hopeful' });
    assert.equal(explicit.payload.key, 'Overall');
    assert.equal(implicit.payload.reflection.scope, 'reading');
    assert.deepEqual(stored(d1), { Overall: 'whole reading felt gentle\n\nand hopeful' });
  });
});

describe('reflections: append and idempotency', () => {
  it('appends with a blank line and keeps other keys', async () => {
    const { d1, env } = await setup({ entry: { reflections: { 0: 'first thought', 1: 'untouched' } } });
    const { payload } = await post(env, { text: 'second thought', scope: 'card', card: 'The Hermit' });
    assert.deepEqual(stored(d1), { 0: 'first thought\n\nsecond thought', 1: 'untouched' });
    assert.deepEqual(payload.reflections, stored(d1));
  });

  it('does not append the same note twice', async () => {
    const { d1, env } = await setup();
    await post(env, { text: 'same note', scope: 'reading' });
    const { response, payload } = await post(env, { text: 'same note', scope: 'reading' });
    assert.equal(response.status, 200);
    assert.equal(payload.alreadyPresent, true);
    assert.deepEqual(stored(d1), { Overall: 'same note' });
  });

  it('does not re-append an earlier note after a later one (A, B, retry A)', async () => {
    const { d1, env } = await setup();
    await post(env, { text: 'A', scope: 'reading' });
    await post(env, { text: 'B', scope: 'reading' });
    const retry = await post(env, { text: 'A', scope: 'reading' });
    assert.equal(retry.payload.alreadyPresent, true);
    assert.deepEqual(stored(d1), { Overall: 'A\n\nB' });
  });

  it('treats Windows line endings and trailing spaces as the same note', async () => {
    const { d1, env } = await setup();
    await post(env, { text: 'line one\nline two', scope: 'reading' });
    const retry = await post(env, { text: 'line one\r\nline two  ', scope: 'reading' });
    assert.equal(retry.payload.alreadyPresent, true);
    assert.deepEqual(stored(d1), { Overall: 'line one\nline two' });
  });

  it('writes once when two identical retries race', async () => {
    const { d1, env } = await setup();
    const body = { text: 'same note', scope: 'reading' };
    const [a, b] = await Promise.all([post(env, body), post(env, body)]);
    assert.deepEqual([Boolean(a.payload.alreadyPresent), Boolean(b.payload.alreadyPresent)].sort(), [false, true]);
    assert.deepEqual(stored(d1), { Overall: 'same note' });
  });

  it('refuses to grow one target past 20,000 characters', async () => {
    const { d1, env } = await setup({ entry: { reflections: { Overall: 'x'.repeat(MAX_TARGET_REFLECTION_LENGTH - 1) } } });
    const { response, payload } = await post(env, { text: 'more', scope: 'reading' });
    assert.equal(response.status, 400);
    assert.equal(payload.error, 'This reflection is full');
    assert.equal(stored(d1).Overall.length, MAX_TARGET_REFLECTION_LENGTH - 1);
  });

  it('treats malformed stored reflections as empty', async () => {
    const { d1, env } = await setup({ entry: { reflections: 'not json at all' } });
    const { response } = await post(env, { text: 'fresh start', scope: 'card', card: 'The Star' });
    assert.equal(response.status, 200);
    assert.deepEqual(stored(d1), { 2: 'fresh start' });
  });

  it('writes a map the journal UI renders (strings, not arrays)', async () => {
    const { env } = await setup();
    const { payload } = await post(env, { text: 'visible in the app', scope: 'card', card: 'The Hermit' });
    const rendered = Object.entries(payload.reflections).filter(([, note]) => typeof note === 'string' && note.trim());
    assert.deepEqual(rendered, [['0', 'visible in the app']]);
  });
});

describe('addJournalReflection: compare-and-swap', () => {
  it('re-reads and appends when the entry changes between read and write', async () => {
    const { d1 } = await setup();
    let interfered = false;
    const db = interceptUpdates(d1, (bound) => {
      if (!interfered) {
        interfered = true;
        d1.rows('UPDATE journal_entries SET reflections_json = ? WHERE id = ?', [JSON.stringify({ Overall: 'concurrent' }), 'entry-1']);
      }
      return bound.run();
    });

    const result = await addJournalReflection({ env: { DB: db }, user: OWNER, entryId: 'entry-1', input: { text: 'mine', scope: 'reading' } });

    assert.equal(result.status, 200);
    assert.deepEqual(stored(d1), { Overall: 'concurrent\n\nmine' });
  });

  it('answers 409 after three conflicting attempts', async () => {
    const { d1 } = await setup();
    let attempts = 0;
    const db = interceptUpdates(d1, async () => {
      attempts += 1;
      return { success: true, meta: { changes: 0 } };
    });

    const result = await addJournalReflection({ env: { DB: db }, user: OWNER, entryId: 'entry-1', input: { text: 'mine', scope: 'reading' } });

    assert.equal(result.status, 409);
    assert.equal(attempts, 3);
    assert.equal(stored(d1), null);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/journalReflections.test.mjs`
Expected: FAIL with `Cannot find module` for `functions/lib/journalReflections.js`.

- [ ] **Step 3: Write the service**

Create `functions/lib/journalReflections.js`:

```js
/**
 * Journal reflections (spec §7.3).
 *
 * Reflections live in journal_entries.reflections_json as a flat string map,
 * exactly as the app writes them. A card note is keyed by the card's index
 * ("0", "1", ...); a whole-reading note uses "Overall". The journal UI,
 * export and follow-up context all read that shape, so no other shape is
 * ever written.
 *
 * Contract rules:
 * - text is 1-2,000 characters (outer whitespace trimmed, CRLF -> LF);
 * - notes append only;
 * - a missing entry and another user's entry get the same 404.
 *
 * Retries are idempotent by the operation's identity (entry, target key,
 * exact text): a note already present anywhere on the target is not added
 * again. Writes use compare-and-swap on the previous JSON, so concurrent
 * appends can't lose each other.
 */

import { canonicalizeCardName } from '../../shared/vision/cardNameMapping.js';
import { getDeckAlias } from '../../shared/vision/deckAssets.js';
import { READING_REFLECTION_KEY } from '../../shared/journal/reflectionLabels.js';
import { safeJsonParse } from './utils.js';

export { READING_REFLECTION_KEY };
export const MAX_REFLECTION_LENGTH = 2000;
export const MAX_TARGET_REFLECTION_LENGTH = 20000;
export const MAX_WRITE_ATTEMPTS = 3;

const DEFAULT_DECK = 'rws-1909';
const NOTE_SEPARATOR = '\n\n';
const SCOPES = new Set(['card', 'reading']);

function isProvided(value) {
  return value !== undefined && value !== null && value !== '';
}

function normalizeLabel(value) {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : '';
}

// "the star", "Star" and "The Star" all name the same card.
function normalizeCardName(value) {
  return normalizeLabel(value).replace(/^the\s+/, '');
}

// Journal cards carry `name`; tolerate the reading API's `card`.
function cardName(card) {
  return card?.name || card?.card || '';
}

/**
 * The stored (canonical) name for a label as the reading showed it. Thoth
 * "Prince of Wands" is stored as "Knight of Wands"; deck aliases win over
 * RWS names, matching the reading pipeline's resolver.
 */
function storedNameFor(label, deckId) {
  if (typeof label !== 'string' || !label.trim()) return '';
  return canonicalizeCardName(label, deckId || DEFAULT_DECK) || label;
}

function summarizeCards(cards, deckId) {
  const showDeckLabels = Boolean(deckId) && deckId !== DEFAULT_DECK;
  return cards.map((card, index) => {
    const summary = { index, position: card?.position ?? null, name: cardName(card) || null };
    if (showDeckLabels) summary.label = getDeckAlias(card, deckId);
    return summary;
  });
}

/**
 * Resolve which card of the entry a card-scoped reflection belongs to.
 *
 * @param {Array<object>} cards - Entry cards, in spread order
 * @param {{ card?: string, position?: string, cardIndex?: number|string }} target - `card` is a deck label, including one returned in `reflection.card`
 * @param {{ deckId?: string|null }} [options] - The entry's deck
 * @returns {{ index: number } | { error: string }}
 */
export function resolveCardIndex(cards, { card, position, cardIndex } = {}, { deckId = null } = {}) {
  const wantedName = normalizeCardName(storedNameFor(card, deckId));
  const wantedPosition = normalizeLabel(position);
  const nameMatches = (candidate) => !wantedName || normalizeCardName(cardName(candidate)) === wantedName;
  const positionMatches = (candidate) => !wantedPosition || normalizeLabel(candidate?.position) === wantedPosition;
  const describe = (candidate) => `${cardName(candidate) || 'an unnamed card'} (${candidate?.position || 'no position'})`;

  if (isProvided(cardIndex)) {
    const index = Number(cardIndex);
    if (!Number.isInteger(index) || index < 0 || index >= cards.length) {
      return { error: `cardIndex must be an integer between 0 and ${cards.length - 1}` };
    }
    const candidate = cards[index];
    if (!nameMatches(candidate) || !positionMatches(candidate)) {
      return { error: `The card at index ${index} is ${describe(candidate)}, not ${card || position}` };
    }
    return { index };
  }

  if (!wantedName && !wantedPosition) {
    return { error: 'A card-scoped reflection needs card, position, or cardIndex' };
  }

  const matches = cards
    .map((candidate, index) => ({ candidate, index }))
    .filter(({ candidate }) => nameMatches(candidate) && positionMatches(candidate));

  if (matches.length === 1) return { index: matches[0].index };
  if (matches.length > 1) {
    return { error: `${card} appears more than once in this entry; specify position or cardIndex` };
  }

  // Nothing satisfied both constraints; say which one failed.
  if (wantedName && wantedPosition) {
    const byName = cards.find(nameMatches);
    return byName
      ? { error: `${card} is in the ${byName.position} position of this entry, not ${position}` }
      : { error: `${card} is not in this entry` };
  }
  return wantedName
    ? { error: `${card} is not in this entry` }
    : { error: `No card in this entry is in the ${position} position` };
}

/**
 * Whether `text` is already one of the notes on a target. The stored value
 * is its notes joined by a blank line, so this matches whole notes (or runs
 * of whole paragraphs), not substrings.
 */
export function noteIsPresent(stored, text) {
  if (!stored || !text) return false;
  return `${NOTE_SEPARATOR}${stored}${NOTE_SEPARATOR}`.includes(`${NOTE_SEPARATOR}${text}${NOTE_SEPARATOR}`);
}

function parseReflections(json) {
  const parsed = safeJsonParse(json, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...parsed } : {};
}

function successBody(entryId, key, target, text, reflections, extra = {}) {
  return {
    success: true,
    entryId,
    key,
    reflection: { key, ...target, text },
    reflections,
    ...extra
  };
}

/**
 * Append a reflection to one of the user's entries.
 *
 * @param {object} params
 * @param {object} params.env - Worker bindings; env.DB is required
 * @param {object} params.user - Authenticated, journal-entitled user
 * @param {string} params.entryId
 * @param {object} params.input - { text, scope?, card?, position?, cardIndex? }
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function addJournalReflection({ env, user, entryId, input }) {
  if (!entryId) return { status: 400, body: { error: 'Entry ID is required' } };
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { status: 400, body: { error: 'Invalid reflection payload' } };
  }
  if (isProvided(input.mode)) {
    return { status: 400, body: { error: 'Reflections are append-only; mode is not supported' } };
  }

  const text = typeof input.text === 'string' ? input.text.replace(/\r\n?/g, '\n').trim() : '';
  if (!text) return { status: 400, body: { error: 'Reflection text is required' } };
  if (text.length > MAX_REFLECTION_LENGTH) {
    return {
      status: 400,
      body: {
        error: `Reflection text must be ${MAX_REFLECTION_LENGTH} characters or fewer`,
        maxLength: MAX_REFLECTION_LENGTH
      }
    };
  }

  const namesCard = ['card', 'position', 'cardIndex'].some((field) => isProvided(input[field]));
  const scope = isProvided(input.scope) ? input.scope : (namesCard ? 'card' : 'reading');
  if (!SCOPES.has(scope)) return { status: 400, body: { error: 'scope must be "card" or "reading"' } };

  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt += 1) {
    // Scoped to the user: another user's entry is indistinguishable from none.
    const entry = await env.DB.prepare(
      'SELECT id, cards_json, reflections_json, deck_id FROM journal_entries WHERE id = ? AND user_id = ?'
    ).bind(entryId, user.id).first();
    if (!entry) return { status: 404, body: { error: 'Entry not found' } };

    const parsedCards = safeJsonParse(entry.cards_json, []);
    const cards = Array.isArray(parsedCards) ? parsedCards : [];

    let key = READING_REFLECTION_KEY;
    let target = { scope: 'reading' };
    if (scope === 'card') {
      const resolved = resolveCardIndex(cards, input, { deckId: entry.deck_id });
      if (resolved.error) {
        return { status: 400, body: { error: resolved.error, cards: summarizeCards(cards, entry.deck_id) } };
      }
      const card = cards[resolved.index];
      const canonicalName = cardName(card);
      key = String(resolved.index);
      // The input resolver treats card names as deck labels. Return that same
      // label so a caller can retry using reflection.card without changing cards.
      target = {
        scope: 'card', cardIndex: resolved.index,
        card: canonicalName
          ? getDeckAlias({ ...card, name: canonicalName }, entry.deck_id || DEFAULT_DECK)
          : null,
        position: card?.position ?? null
      };
    }

    const reflections = parseReflections(entry.reflections_json);
    const existing = typeof reflections[key] === 'string' ? reflections[key].trim() : '';
    if (noteIsPresent(existing, text)) {
      return { status: 200, body: successBody(entryId, key, target, existing, reflections, { alreadyPresent: true }) };
    }

    const value = existing ? `${existing}${NOTE_SEPARATOR}${text}` : text;
    if (value.length > MAX_TARGET_REFLECTION_LENGTH) {
      return { status: 400, body: { error: 'This reflection is full', maxLength: MAX_TARGET_REFLECTION_LENGTH } };
    }
    reflections[key] = value;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const result = await env.DB.prepare(
      'UPDATE journal_entries SET reflections_json = ?, updated_at = ? WHERE id = ? AND user_id = ? AND reflections_json IS ?'
    ).bind(JSON.stringify(reflections), nowSeconds, entryId, user.id, entry.reflections_json ?? null).run();

    if ((result?.meta?.changes ?? 0) === 1) {
      return { status: 200, body: successBody(entryId, key, target, value, reflections) };
    }
    // Someone else changed the entry since it was read: re-read and retry.
  }

  return { status: 409, body: { error: 'The entry changed while saving. Please retry.' } };
}
```

- [ ] **Step 4: Make the route a thin wrapper**

Replace the whole of `functions/api/journal/reflections.js` with:

```js
/**
 * Journal Reflections
 * POST /api/journal/:id/reflections - Append a reflection to a saved entry
 *
 * The behaviour lives in functions/lib/journalReflections.js, which is
 * shared with the ChatGPT MCP tools.
 *
 * Auth goes through getUserFromRequest (session cookie, bearer session
 * token, `sk_` API key). The synthetic GPT service account is refused by
 * journalAccessDenied.
 */

import { getUserFromRequest } from '../../lib/auth.js';
import { journalAccessDenied } from '../../lib/journalAccess.js';
import { addJournalReflection } from '../../lib/journalReflections.js';

export {
  MAX_REFLECTION_LENGTH,
  READING_REFLECTION_KEY,
  resolveCardIndex
} from '../../lib/journalReflections.js';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const logRequestId = crypto.randomUUID();

  try {
    const user = await getUserFromRequest(request, env);
    const denied = journalAccessDenied(user);
    if (denied) return denied;

    const input = await request.json().catch(() => null);
    const result = await addJournalReflection({ env, user, entryId: params?.id, input });
    return json(result.body, result.status);
  } catch (error) {
    console.error(`[${logRequestId}] [journal] Add reflection error:`, error);
    return json({ error: 'Internal server error' }, 500);
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/journalReflections.test.mjs tests/journalBearerAuth.test.mjs`
Expected: PASS for both files.

- [ ] **Step 6: Commit**

```bash
git add functions/lib/journalReflections.js functions/api/journal/reflections.js tests/journalReflections.test.mjs
git commit -m "feat: align journal reflections with the audited contract" -m "2,000-character notes, append-only, 404 for other users' entries, top-level entryId/key, content-identity retries, compare-and-swap writes, deck-aware card targeting." -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 7: In-Worker principal for readings

**Files:**
- Modify: `functions/lib/auth.js` (add `loadActiveUserById`)
- Modify: `functions/api/tarot-reading.js` (import; add `resolveReadingUser`; `onRequestPost` accepts `principal`)
- Test: `tests/readingPrincipal.test.mjs`

**Interfaces:**
- Consumes: `createD1`, `seedUser` and `seedSession` (Task 1).
- Produces:
  - `loadActiveUserById(db, userId): Promise<object|null>`. It returns the same shape as `validateSession`, with `sessionId: null`.
  - `resolveReadingUser({ request, env, principal }): Promise<{ user, unauthorized }>`.
  - `onRequestPost({ request, env, waitUntil, principal? })`.

- [ ] **Step 1: Write the failing test**

Create `tests/readingPrincipal.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createD1 } from './helpers/d1Sqlite.mjs';
import { jsonRequest, seedSession, seedUser } from './helpers/journalFixtures.mjs';
import { loadActiveUserById } from '../functions/lib/auth.js';
import { onRequestPost as tarotReading, resolveReadingUser } from '../functions/api/tarot-reading.js';
import { SPREADS } from '../src/data/spreads.js';

async function setup() {
  const d1 = await createD1();
  await seedUser(d1, { id: 'user-1', tier: 'plus', username: 'owner' });
  await seedUser(d1, { id: 'user-2', tier: 'free' });
  await seedSession(d1, { id: 'session-2', userId: 'user-2' });
  await seedUser(d1, { id: 'user-off', active: 0 });
  return { d1, env: { DB: d1 } };
}

describe('loadActiveUserById', () => {
  it('returns the validateSession user shape', async () => {
    const { env } = await setup();
    const user = await loadActiveUserById(env.DB, 'user-1');
    assert.equal(user.id, 'user-1');
    assert.equal(user.username, 'owner');
    assert.equal(user.subscription_tier, 'plus');
    assert.equal(user.subscription_status, 'active');
    assert.equal(user.auth_provider, 'session');
    assert.equal(user.sessionId, null);
  });

  it('returns null for an unknown, inactive or missing id', async () => {
    const { env } = await setup();
    assert.equal(await loadActiveUserById(env.DB, 'nobody'), null);
    assert.equal(await loadActiveUserById(env.DB, 'user-off'), null);
    assert.equal(await loadActiveUserById(env.DB, ''), null);
    assert.equal(await loadActiveUserById(null, 'user-1'), null);
  });
});

describe('resolveReadingUser', () => {
  it('uses the principal and ignores request credentials', async () => {
    const { env } = await setup();
    const request = new Request('https://internal/api/tarot-reading', { headers: { Cookie: 'session=session-2' } });
    const { user, unauthorized } = await resolveReadingUser({ request, env, principal: { userId: 'user-1' } });
    assert.equal(unauthorized, false);
    assert.equal(user.id, 'user-1');
  });

  it('refuses a principal that no longer resolves', async () => {
    const { env } = await setup();
    const request = new Request('https://internal/api/tarot-reading');
    const result = await resolveReadingUser({ request, env, principal: { userId: 'user-off' } });
    assert.deepEqual(result, { user: null, unauthorized: true });
  });

  it('falls back to request credentials without a principal', async () => {
    const { env } = await setup();
    const request = new Request('https://example.com/api/tarot-reading', { headers: { Cookie: 'session=session-2' } });
    const { user, unauthorized } = await resolveReadingUser({ request, env, principal: null });
    assert.equal(unauthorized, false);
    assert.equal(user.id, 'user-2');
  });
});

describe('tarot-reading with a principal', () => {
  it('answers 401 when the principal no longer resolves', async () => {
    const { env } = await setup();
    const payload = {
      spreadInfo: { name: SPREADS.single.name, key: 'single' },
      cardsInfo: [{ position: SPREADS.single.positions[0], card: 'The Star', orientation: 'Upright', meaning: 'Hope' }]
    };
    const response = await tarotReading({
      request: jsonRequest('https://internal/api/tarot-reading', { body: payload }),
      env,
      waitUntil: () => {},
      principal: { userId: 'user-off' }
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, 'Not authenticated');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/readingPrincipal.test.mjs`
Expected: FAIL, because `loadActiveUserById` is not exported from `functions/lib/auth.js`.

- [ ] **Step 3: Add `loadActiveUserById`**

In `functions/lib/auth.js`, insert this directly above the doc comment `/**\n * Delete a session (logout)`:

```js
/**
 * Load an active user by id, shaped like validateSession's result (session
 * fields are null). For in-Worker principals only: the ChatGPT MCP handler
 * and the ReadingJob Durable Object, which never carry a cookie or bearer
 * token. Never call this with an id taken from request input.
 *
 * @param {D1Database} db - D1 database binding
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function loadActiveUserById(db, userId) {
  if (!db || typeof userId !== 'string' || !userId) return null;

  const row = await db
    .prepare(`
      SELECT
        id,
        email,
        username,
        is_active,
        subscription_tier,
        subscription_status,
        subscription_provider,
        stripe_customer_id,
        email_verified,
        auth_provider,
        auth_subject,
        full_name,
        avatar_url
      FROM users
      WHERE id = ? AND is_active = 1
    `)
    .bind(userId)
    .first();

  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    username: row.username,
    sessionId: null,
    subscription_tier: row.subscription_tier || 'free',
    subscription_status: row.subscription_status || 'inactive',
    subscription_provider: row.subscription_provider || null,
    stripe_customer_id: row.stripe_customer_id || null,
    email_verified: Boolean(row.email_verified),
    auth_provider: row.auth_provider || 'session',
    auth_subject: row.auth_subject || null,
    full_name: row.full_name || null,
    avatar_url: row.avatar_url || null
  };
}
```

- [ ] **Step 4: Resolve the reading user through the principal**

In `functions/api/tarot-reading.js`:

1. Replace `import { getUserFromRequest } from '../lib/auth.js';` with `import { getUserFromRequest, loadActiveUserById } from '../lib/auth.js';`.
2. Insert this directly above `export const onRequestPost = async ({ request, env, waitUntil }) => {`:

```js
/**
 * Resolve the caller for a reading.
 *
 * `principal` is set only by in-Worker callers: the ReadingJob Durable
 * Object running a job started by the ChatGPT MCP tools. The router builds
 * handler contexts from fixed fields, so a public request can never carry
 * one. A principal that no longer resolves (deleted or deactivated account)
 * is refused rather than treated as anonymous.
 *
 * @returns {Promise<{ user: object|null, unauthorized: boolean }>}
 */
export async function resolveReadingUser({ request, env, principal }) {
  if (principal) {
    const user = principal.userId ? await loadActiveUserById(env?.DB, principal.userId) : null;
    return { user, unauthorized: !user };
  }
  return { user: await getUserFromRequest(request, env), unauthorized: false };
}

```

3. Change the handler signature to `export const onRequestPost = async ({ request, env, waitUntil, principal = null }) => {`.
4. Replace:

```js
    const user = await getUserFromRequest(request, env);
    const subscription = getSubscriptionContext(user);
```

with:

```js
    const { user, unauthorized } = await resolveReadingUser({ request, env, principal });
    if (unauthorized) {
      return jsonResponse({ error: 'Not authenticated' }, { status: 401 });
    }
    const subscription = getSubscriptionContext(user);
```

- [ ] **Step 5: Run the tests**

Run: `node --test tests/readingPrincipal.test.mjs tests/api.validatePayload.test.mjs tests/api.languageFallback.test.mjs`
Expected: PASS for all three files. The existing API tests are unaffected because no caller passes `principal`.

- [ ] **Step 6: Commit**

```bash
git add functions/lib/auth.js functions/api/tarot-reading.js tests/readingPrincipal.test.mjs
git commit -m "feat: let in-Worker callers run a reading as an explicit principal" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Extract the server-side draw

**Files:**
- Create: `functions/lib/serverDraw.js`
- Modify: `functions/api/tarot-reading-draw.js`
- Test: `tests/serverDraw.test.mjs`

**Interfaces:**
- Produces:
  - `resolveSpreadKey(spreadInfo): string|null`;
  - `coerceSeed(input): number`;
  - `drawForSpread(payload)`, which returns either

    ```
    { ok: true, spreadKey, spreadInfo: { key, name }, cardsInfo, seed: number, deckStyle }
    ```

    or `{ ok: false, status, error }`. Each item of `cardsInfo` is a `buildReadingRequestCard` output: `{ position, card, canonicalName, canonicalKey, aliases, orientation, meaning, number, suit, rank, rankValue, userReflection }`.

- [ ] **Step 1: Write the failing test**

Create `tests/serverDraw.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { jsonRequest } from './helpers/journalFixtures.mjs';
import { drawForSpread } from '../functions/lib/serverDraw.js';
import { onRequestPost as drawRoute } from '../functions/api/tarot-reading-draw.js';
import { canonicalizeCardName } from '../shared/vision/cardNameMapping.js';
import { hashString } from '../shared/utils.js';
import { SPREADS } from '../src/data/spreads.js';

const THREE = { name: SPREADS.threeCard.name, key: 'threeCard' };

describe('drawForSpread', () => {
  it('draws the same cards for the same seed and spread, one per position', () => {
    const a = drawForSpread({ spreadInfo: THREE, seed: 'rose' });
    const b = drawForSpread({ spreadInfo: THREE, seed: 'rose' });

    assert.equal(a.ok, true);
    assert.deepEqual(a.cardsInfo, b.cardsInfo);
    assert.equal(a.seed, b.seed);
    assert.equal(typeof a.seed, 'number');
    assert.deepEqual(a.cardsInfo.map((card) => card.position), SPREADS.threeCard.positions);
    assert.deepEqual(a.spreadInfo, { key: 'threeCard', name: SPREADS.threeCard.name });
    assert.equal(a.deckStyle, 'rws-1909');
  });

  it('keeps the existing /api semantics for numeric string seeds', () => {
    const textSeed = drawForSpread({ spreadInfo: THREE, seed: '4242' });
    const numericSeed = drawForSpread({ spreadInfo: THREE, seed: 4242 });
    assert.equal(textSeed.seed, hashString('4242'));
    assert.equal(numericSeed.seed, 4242);
    assert.notEqual(textSeed.seed, numericSeed.seed);
  });

  it('never reverses cards when allowReversals is false', () => {
    const drawn = drawForSpread({ spreadInfo: { name: SPREADS.celtic.name, key: 'celtic' }, seed: 'upright', allowReversals: false });
    assert.ok(drawn.cardsInfo.every((card) => card.orientation === 'Upright'));
  });

  it('labels cards for the selected deck and keeps their canonical identity', () => {
    const drawn = drawForSpread({ spreadInfo: { name: SPREADS.celtic.name, key: 'celtic' }, seed: 'thoth', deckStyle: 'thoth-a1' });
    assert.equal(drawn.deckStyle, 'thoth-a1');
    for (const card of drawn.cardsInfo) {
      assert.equal(canonicalizeCardName(card.card, 'thoth-a1'), card.canonicalName);
    }
  });

  it('rejects unknown, custom and nameless spreads with 400', () => {
    assert.deepEqual(
      [drawForSpread({ spreadInfo: { name: 'Nope' } }).status, drawForSpread({ spreadInfo: { name: 'Mine', key: 'custom' } }).status, drawForSpread({}).status],
      [400, 400, 400]
    );
  });
});

describe('POST /api/tarot-reading/draw after the extraction', () => {
  it('still answers 400 with the same message for an unknown spread', async () => {
    const response = await drawRoute({
      request: jsonRequest('https://example.com/api/tarot-reading/draw', { body: { spreadInfo: { name: 'Nope' } } }),
      env: {},
      waitUntil: () => {}
    });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /^Unknown spread "Nope"/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/serverDraw.test.mjs`
Expected: FAIL with `Cannot find module` for `functions/lib/serverDraw.js`.

- [ ] **Step 3: Write `serverDraw.js`**

Create `functions/lib/serverDraw.js`:

```js
/**
 * Server-side draw for a known spread, shared by POST /api/tarot-reading/draw
 * and the MCP draw_tarot_reading tool (spec §6.1).
 *
 * lib/ boundary note: imports src/lib/deck.js and src/data/spreads.js. Both
 * are environment-agnostic (pure data, plus a seeded shuffle that never
 * touches window); this is the same narrow exception the draw route already
 * made.
 */

import { drawSpread } from '../../src/lib/deck.js';
import { SPREADS } from '../../src/data/spreads.js';
import { getSpreadDefinition } from './readingQuality.js';
import { hashString } from '../../shared/utils.js';
import { buildReadingRequestCard } from '../../shared/contracts/readingRequestCards.js';

/**
 * Resolve the canonical spread key from a payload's spreadInfo.
 * Tries `spreadInfo.key` first, then `spreadInfo.name`, then the shared
 * alias map (`getSpreadDefinition`).
 */
export function resolveSpreadKey(spreadInfo) {
  if (!spreadInfo) return null;

  const rawKey = typeof spreadInfo.key === 'string' ? spreadInfo.key.trim() : '';
  if (rawKey && SPREADS[rawKey]) return rawKey;

  const def =
    getSpreadDefinition(spreadInfo.name) ||
    (rawKey ? getSpreadDefinition(rawKey) : null);

  if (def?.key && SPREADS[def.key]) return def.key;
  return null;
}

/** 32-bit unsigned seed from the Workers WebCrypto API. */
function generateRandomSeed() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] >>> 0) || 0x9e3779b9;
}

/**
 * Coerce a caller-supplied seed (number or string) into the 32-bit unsigned
 * integer that `drawSpread`'s seeded path expects. Preserve the existing
 * /api behavior: every nonempty string, including decimal text, is hashed.
 * The MCP tool converts returned decimal replay seeds to numbers before
 * calling this helper (Task 12). Falls back to a fresh crypto-random seed
 * when nothing usable is provided.
 */
export function coerceSeed(input) {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return (input >>> 0) || 0x9e3779b9;
  }
  if (typeof input === 'string' && input.trim()) {
    return (hashString(input.trim()) >>> 0) || 0x9e3779b9;
  }
  return generateRandomSeed();
}

/**
 * Draw cards for the requested spread.
 *
 * @param {object} payload - { spreadInfo, seed?, allowReversals?, includeMinors?, deckStyle? }
 */
export function drawForSpread(payload) {
  const spreadInfo = payload?.spreadInfo;
  if (!spreadInfo || typeof spreadInfo.name !== 'string' || !spreadInfo.name.trim()) {
    return { ok: false, status: 400, error: 'Missing spread information.' };
  }

  if (spreadInfo.key === 'custom') {
    return {
      ok: false,
      status: 400,
      error: 'Custom spreads cannot be drawn server-side; supply cardsInfo via createTarotReading instead.'
    };
  }

  const spreadKey = resolveSpreadKey(spreadInfo);
  if (!spreadKey) {
    return {
      ok: false,
      status: 400,
      error: `Unknown spread "${spreadInfo.name}". Provide a known spread.key (single, threeCard, fiveCard, decision, relationship, celtic) or display name.`
    };
  }

  const spread = SPREADS[spreadKey];
  const positions = Array.isArray(spread?.positions) ? spread.positions : null;
  if (!positions || positions.length === 0) {
    return { ok: false, status: 500, error: `Spread "${spreadKey}" has no position labels available.` };
  }

  // Defaults: full 78-card pool, reversals allowed. Both are caller-overridable.
  const allowReversals = payload?.allowReversals !== false;
  const includeMinors = payload?.includeMinors !== false;
  const seed = coerceSeed(payload?.seed);

  let drawn;
  try {
    drawn = drawSpread({ spreadKey, useSeed: true, seed, includeMinors });
  } catch (error) {
    return { ok: false, status: 422, error: error?.message || 'Failed to draw cards.' };
  }

  if (!allowReversals) {
    drawn = drawn.map((card) => ({ ...card, isReversed: false }));
  }

  if (drawn.length > positions.length) {
    return {
      ok: false,
      status: 500,
      error: `Drew ${drawn.length} cards but spread "${spreadKey}" defines only ${positions.length} positions.`
    };
  }

  const requestDeckStyle = typeof payload?.deckStyle === 'string' ? payload.deckStyle.trim() : '';
  const spreadDeckStyle = typeof spreadInfo.deckStyle === 'string' ? spreadInfo.deckStyle.trim() : '';
  const deckStyle = requestDeckStyle || spreadDeckStyle || 'rws-1909';
  const cardsInfo = drawn.map((card, i) => buildReadingRequestCard(card, {
    deckStyle,
    position: positions[i]
  }));

  return {
    ok: true,
    spreadKey,
    spreadInfo: { key: spreadKey, name: spread.name },
    cardsInfo,
    seed,
    deckStyle
  };
}
```

- [ ] **Step 4: Make the draw route use it**

In `functions/api/tarot-reading-draw.js`:

1. Replace the import block:

```js
import { jsonResponse, readJsonBody } from '../lib/utils.js';
import { onRequestPost as tarotReadingHandler } from './tarot-reading.js';
import { drawSpread } from '../../src/lib/deck.js';
import { SPREADS } from '../../src/data/spreads.js';
import { getSpreadDefinition } from '../lib/readingQuality.js';
import { hashString } from '../../shared/utils.js';
import { buildReadingRequestCard } from '../../shared/contracts/readingRequestCards.js';
```

with:

```js
import { jsonResponse, readJsonBody } from '../lib/utils.js';
import { onRequestPost as tarotReadingHandler } from './tarot-reading.js';
import { drawForSpread } from '../lib/serverDraw.js';
```

2. Delete the three helpers `resolveSpreadKey`, `generateRandomSeed` and `coerceSeed`, together with their doc comments; they now live in `functions/lib/serverDraw.js`.

3. In `onRequestPost`, replace everything from `  const spreadInfo = payload?.spreadInfo;` up to and including the `const cardsInfo = drawn.map(...)` statement with:

```js
  const drawn = drawForSpread(payload);
  if (!drawn.ok) {
    return jsonResponse({ error: drawn.error }, { status: drawn.status });
  }
  const { spreadKey, spreadInfo: drawnSpreadInfo, cardsInfo, seed } = drawn;
```

4. Replace `spreadInfo: { ...spreadInfo, key: spreadKey, name: spread.name },` (in `forwardedPayload`) with `spreadInfo: { ...payload.spreadInfo, key: spreadKey, name: drawnSpreadInfo.name },`.

5. Replace `spreadInfo: { key: spreadKey, name: spread.name },` (in `augmented`) with `spreadInfo: drawnSpreadInfo,`.

6. In the file's header comment, replace the paragraph starting `lib/ boundary note:` with `The shuffle and spread-position zip live in functions/lib/serverDraw.js, which the MCP draw tool shares.`

Check: `grep -n "SPREADS\|drawSpread\|coerceSeed" functions/api/tarot-reading-draw.js` prints nothing.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/serverDraw.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add functions/lib/serverDraw.js functions/api/tarot-reading-draw.js tests/serverDraw.test.mjs
git commit -m "refactor: extract the server-side draw for reuse by MCP" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Reading jobs with a principal, snapshot and MCP-only access

**Files:**
- Create: `functions/lib/readingJobs.js`
- Create: `tests/helpers/fakeReadingJobs.mjs`
- Modify: `functions/api/tarot-reading-job-start.js`
- Modify: `src/worker/readingJob.js`
- Test: `tests/readingJobPrincipal.test.mjs`

**Interfaces:**
- Consumes: `onRequestPost({ ..., principal })` (Task 7).
- Produces:
  - `startReadingJob({ env, payload, principal?, snapshot?, forwardHeaders? })`, which resolves to `{ ok: true, jobId, jobToken }` or `{ ok: false, status, error }`;
  - `getMcpJobSnapshot({ env, jobId, jobToken, userId })`, which resolves to `{ ok: true, data: { jobId, status, snapshot, result, error, meta: { themes } } }` or `{ ok: false, status: 404|410|503, error }`;
  - `cancelMcpJob({ env, jobId, jobToken, userId })`, which resolves to `{ ok: true, data: { status } }` or `{ ok: false, status, error }`;
  - `JOB_TTL_MS` and `MCP_JOB_TTL_MS`;
  - `new ReadingJob(state, env, { runReading })`.
- Test helpers:
  - `createFakeReadingJobs({ env, runReading }) → { namespace, instances, settle() }`, where `instances` is a `Map<jobId, { state, object }>`;
  - `readingRunner(options)` and `hangingRunner(calls)`.

- [ ] **Step 1: Write the fake namespace helper**

Create `tests/helpers/fakeReadingJobs.mjs`:

```js
/**
 * A READING_JOBS Durable Object namespace for Node tests, backed by real
 * ReadingJob instances with in-memory storage. The reading itself is
 * injected (`runReading`), so tests control what the "model" returns.
 */
import { ReadingJob } from '../../src/worker/readingJob.js';

function createState() {
  const data = new Map();
  const pending = new Set();
  return {
    storage: {
      async get(key) { return data.has(key) ? structuredClone(data.get(key)) : undefined; },
      async put(key, value) { data.set(key, structuredClone(value)); },
      async delete(key) { data.delete(key); }
    },
    blockConcurrencyWhile(fn) { return fn(); },
    waitUntil(promise) {
      const tracked = Promise.resolve(promise).finally(() => pending.delete(tracked));
      pending.add(tracked);
    },
    pending
  };
}

export function createFakeReadingJobs({ env = {}, runReading } = {}) {
  const instances = new Map();
  const namespace = {
    idFromName(name) {
      return name;
    },
    get(id) {
      return {
        fetch(input, init) {
          let entry = instances.get(id);
          if (!entry) {
            const state = createState();
            entry = { state, object: new ReadingJob(state, env, { runReading }) };
            instances.set(id, entry);
          }
          return entry.object.fetch(input instanceof Request ? input : new Request(input, init));
        }
      };
    }
  };
  return {
    namespace,
    instances,
    /** Wait for every running job's background work to finish. */
    async settle() {
      for (const { state } of instances.values()) {
        await Promise.all([...state.pending]);
      }
    }
  };
}

/** A reading runner that answers like /api/tarot-reading in JSON mode. */
export function readingRunner({
  reading = 'The cards speak of patience.',
  provider = 'test-provider',
  requestId = 'req-test-1',
  themes = { dominantSuit: 'Cups' },
  gateReason = null,
  status = 200,
  calls = []
} = {}) {
  return async (context) => {
    calls.push(context);
    if (status !== 200) {
      return new Response(JSON.stringify({ error: reading }), {
        status,
        headers: { 'content-type': 'application/json' }
      });
    }
    const body = { reading, provider, requestId, themes, ...(gateReason ? { gateBlocked: true, gateReason } : {}) };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

/** A reading runner that never finishes until the job is cancelled. */
export function hangingRunner(calls = []) {
  return (context) => {
    calls.push(context);
    return new Promise((_, reject) => {
      context.request.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });
  };
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/readingJobPrincipal.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createFakeReadingJobs, hangingRunner, readingRunner } from './helpers/fakeReadingJobs.mjs';
import { jsonRequest } from './helpers/journalFixtures.mjs';
import { cancelMcpJob, getMcpJobSnapshot, startReadingJob } from '../functions/lib/readingJobs.js';
import { onRequestPost as publicStart } from '../functions/api/tarot-reading-job-start.js';
import { onRequestGet as publicStatus } from '../functions/api/tarot-reading-job-status.js';
import { onRequestGet as publicStream } from '../functions/api/tarot-reading-job-stream.js';
import { onRequestPost as publicCancel } from '../functions/api/tarot-reading-job-cancel.js';
import { JOB_TTL_MS, MCP_JOB_TTL_MS } from '../src/worker/readingJob.js';
import { SPREADS } from '../src/data/spreads.js';

const PAYLOAD = {
  spreadInfo: { name: SPREADS.single.name, key: 'single' },
  cardsInfo: [{ position: SPREADS.single.positions[0], card: 'The Star', orientation: 'Upright', meaning: 'Hope' }]
};

const SNAPSHOT = {
  spreadInfo: { name: SPREADS.single.name, key: 'single' },
  cardsInfo: [{
    position: SPREADS.single.positions[0], card: 'The Star', orientation: 'Upright', meaning: 'Hope',
    number: 17, suit: null, rank: null, rankValue: null
  }],
  userQuestion: null,
  deckStyle: 'rws-1909',
  personalization: null,
  seed: null
};

function environment(runReading) {
  const jobs = createFakeReadingJobs({ runReading });
  return { jobs, env: { READING_JOBS: jobs.namespace } };
}

function publicCall(handler, env, { jobId, jobToken, method = 'GET', path = '' }) {
  return handler({
    request: new Request(`https://example.com/api/tarot-reading/jobs/${jobId}${path}`, { method, headers: { 'X-Job-Token': jobToken } }),
    env,
    params: { id: jobId }
  });
}

describe('startReadingJob with a principal', () => {
  it('runs the reading as the principal and forwards no request credentials', async () => {
    const calls = [];
    const { jobs, env } = environment(readingRunner({ calls }));

    const started = await startReadingJob({
      env, payload: PAYLOAD, principal: { userId: 'user-1' }, snapshot: SNAPSHOT,
      forwardHeaders: { authorization: 'Bearer must-not-leak', cookie: 'session=must-not-leak' }
    });
    await jobs.settle();

    assert.equal(started.ok, true);
    assert.deepEqual(calls[0].principal, { userId: 'user-1' });
    assert.equal(calls[0].request.headers.get('Authorization'), null);
    assert.equal(calls[0].request.headers.get('Cookie'), null);
  });

  it('keeps app jobs on forwarded request credentials', async () => {
    const calls = [];
    const { jobs, env } = environment(readingRunner({ calls }));

    await startReadingJob({ env, payload: PAYLOAD, forwardHeaders: { authorization: 'Bearer app-user' } });
    await jobs.settle();

    assert.equal(calls[0].principal, undefined);
    assert.equal(calls[0].request.headers.get('Authorization'), 'Bearer app-user');
  });

  it('serves the snapshot, result and themes to the owning principal', async () => {
    const { jobs, env } = environment(readingRunner({ reading: 'Hope returns.', requestId: 'req-42' }));
    const { jobId, jobToken } = await startReadingJob({ env, payload: PAYLOAD, principal: { userId: 'user-1' }, snapshot: SNAPSHOT });
    await jobs.settle();

    const result = await getMcpJobSnapshot({ env, jobId, jobToken, userId: 'user-1' });

    assert.equal(result.ok, true);
    assert.equal(result.data.status, 'complete');
    assert.deepEqual(result.data.snapshot, SNAPSHOT);
    assert.equal(result.data.result.reading, 'Hope returns.');
    assert.equal(result.data.result.requestId, 'req-42');
    assert.deepEqual(result.data.meta.themes, { dominantSuit: 'Cups' });
  });

  it('answers the same 404 for a wrong token or another principal', async () => {
    const { jobs, env } = environment(readingRunner());
    const { jobId, jobToken } = await startReadingJob({ env, payload: PAYLOAD, principal: { userId: 'user-1' }, snapshot: SNAPSHOT });
    await jobs.settle();

    const wrongToken = await getMcpJobSnapshot({ env, jobId, jobToken: 'nope', userId: 'user-1' });
    const wrongUser = await getMcpJobSnapshot({ env, jobId, jobToken, userId: 'user-2' });
    assert.deepEqual([wrongToken.status, wrongUser.status], [404, 404]);
    assert.equal(wrongToken.error, wrongUser.error);
  });

  it('rejects an invalid payload before creating a job', async () => {
    const { jobs, env } = environment(readingRunner());
    const result = await startReadingJob({ env, payload: { spreadInfo: {} }, principal: { userId: 'user-1' } });
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.equal(jobs.instances.size, 0);
  });

  it('answers 503 when reading jobs are not configured', async () => {
    const result = await startReadingJob({ env: {}, payload: PAYLOAD });
    assert.deepEqual(result, { ok: false, status: 503, error: 'Reading jobs not configured.' });
  });
});

describe('public job routes', () => {
  it('hide principal jobs from status, stream and cancel, even with the right token', async () => {
    const { jobs, env } = environment(readingRunner());
    const { jobId, jobToken } = await startReadingJob({ env, payload: PAYLOAD, principal: { userId: 'user-1' }, snapshot: SNAPSHOT });
    await jobs.settle();

    const status = await publicCall(publicStatus, env, { jobId, jobToken });
    const stream = await publicCall(publicStream, env, { jobId, jobToken, path: '/stream' });
    const cancel = await publicCall(publicCancel, env, { jobId, jobToken, method: 'POST', path: '/cancel' });

    assert.deepEqual([status.status, stream.status, cancel.status], [404, 404, 404]);
    const still = await getMcpJobSnapshot({ env, jobId, jobToken, userId: 'user-1' });
    assert.equal(still.data.status, 'complete', 'the public cancel must not touch the job');
  });

  it('keep working for app jobs', async () => {
    const { jobs, env } = environment(readingRunner());
    const { jobId, jobToken } = await startReadingJob({ env, payload: PAYLOAD, forwardHeaders: {} });
    await jobs.settle();

    const status = await publicCall(publicStatus, env, { jobId, jobToken });
    assert.equal(status.status, 200);
    assert.equal((await status.json()).status, 'complete');
  });

  it('never let a request body smuggle a principal through the public start route', async () => {
    const calls = [];
    const { jobs, env } = environment(readingRunner({ calls }));

    const response = await publicStart({
      request: jsonRequest('https://example.com/api/tarot-reading/jobs', { body: { ...PAYLOAD, principal: { userId: 'user-1' } } }),
      env
    });
    await jobs.settle();

    assert.equal(response.status, 200);
    assert.equal(calls[0].principal, undefined);
    const { jobId, jobToken } = await response.json();
    assert.equal((await publicCall(publicStatus, env, { jobId, jobToken })).status, 200);
  });
});

describe('retention and cancellation', () => {
  it('keeps MCP jobs for 24 hours and app jobs for 1 hour after they finish', async () => {
    const { jobs, env } = environment(readingRunner());
    const mcp = await startReadingJob({ env, payload: PAYLOAD, principal: { userId: 'user-1' }, snapshot: SNAPSHOT });
    const app = await startReadingJob({ env, payload: PAYLOAD, forwardHeaders: {} });
    await jobs.settle();

    const remaining = (jobId) => jobs.instances.get(jobId).object.job.expiresAt - Date.now();
    assert.ok(Math.abs(remaining(mcp.jobId) - MCP_JOB_TTL_MS) < 5000);
    assert.ok(Math.abs(remaining(app.jobId) - JOB_TTL_MS) < 5000);
  });

  it('cancels a running MCP job, and leaves a finished one intact', async () => {
    const { jobs, env } = environment(hangingRunner());
    const running = await startReadingJob({ env, payload: PAYLOAD, principal: { userId: 'user-1' }, snapshot: SNAPSHOT });

    const cancelled = await cancelMcpJob({ env, jobId: running.jobId, jobToken: running.jobToken, userId: 'user-1' });
    await jobs.settle();
    assert.deepEqual(cancelled, { ok: true, data: { status: 'cancelled' } });
    const after = await getMcpJobSnapshot({ env, jobId: running.jobId, jobToken: running.jobToken, userId: 'user-1' });
    assert.equal(after.data.status, 'error');
    assert.equal(after.data.error, 'Reading cancelled.');

    const done = environment(readingRunner());
    const finished = await startReadingJob({ env: done.env, payload: PAYLOAD, principal: { userId: 'user-1' }, snapshot: SNAPSHOT });
    await done.jobs.settle();
    const noop = await cancelMcpJob({ env: done.env, jobId: finished.jobId, jobToken: finished.jobToken, userId: 'user-1' });
    assert.deepEqual(noop, { ok: true, data: { status: 'complete' } });
  });

  it('reports an expired MCP job as 410', async () => {
    const { jobs, env } = environment(readingRunner());
    const { jobId, jobToken } = await startReadingJob({ env, payload: PAYLOAD, principal: { userId: 'user-1' }, snapshot: SNAPSHOT });
    await jobs.settle();
    jobs.instances.get(jobId).object.job.expiresAt = Date.now() - 1;

    const result = await getMcpJobSnapshot({ env, jobId, jobToken, userId: 'user-1' });
    assert.deepEqual([result.ok, result.status], [false, 410]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test tests/readingJobPrincipal.test.mjs`
Expected: FAIL with `Cannot find module` for `functions/lib/readingJobs.js`.

- [ ] **Step 4: Write `readingJobs.js`**

Create `functions/lib/readingJobs.js`:

```js
/**
 * Reading-job helpers shared by POST /api/tarot-reading/jobs (the app) and
 * the ChatGPT MCP tools.
 *
 * MCP jobs carry an in-Worker principal and a request snapshot. The
 * ReadingJob Durable Object serves them only on its MCP paths
 * (/mcp/snapshot, /mcp/cancel), never on the public status, stream and
 * cancel routes (spec §7.4). A job token that surfaces in a ChatGPT
 * conversation therefore grants nothing outside /mcp.
 */

import { safeParseReadingRequest } from '../../shared/contracts/readingSchema.js';

const DO_ORIGIN = 'https://reading-jobs';

function jobStub(env, jobId) {
  return env.READING_JOBS.get(env.READING_JOBS.idFromName(jobId));
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Validate a reading payload and start a job for it.
 *
 * @param {object} params
 * @param {object} params.env - Worker bindings; env.READING_JOBS is required
 * @param {object} params.payload - Reading request (readingRequestSchema)
 * @param {{ userId: string }|null} [params.principal] - In-Worker callers only
 * @param {object|null} [params.snapshot] - Stored with principal jobs, for saving later
 * @param {{ authorization?: string|null, cookie?: string|null }|null} [params.forwardHeaders]
 *   Request credentials, for app jobs only; ignored when a principal is given
 */
export async function startReadingJob({ env, payload, principal = null, snapshot = null, forwardHeaders = null }) {
  if (!env?.READING_JOBS) {
    return { ok: false, status: 503, error: 'Reading jobs not configured.' };
  }

  const schemaResult = safeParseReadingRequest(payload);
  if (!schemaResult.success) {
    return { ok: false, status: 400, error: schemaResult.error || 'Invalid reading request payload.' };
  }

  const jobId = crypto.randomUUID();
  const jobToken = crypto.randomUUID();
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Job-Token': jobToken
  });
  if (!principal) {
    if (forwardHeaders?.authorization) headers.set('Authorization', forwardHeaders.authorization);
    if (forwardHeaders?.cookie) headers.set('Cookie', forwardHeaders.cookie);
  }

  const body = { payload: schemaResult.data, jobId };
  if (principal?.userId) {
    body.principal = { userId: String(principal.userId) };
    body.snapshot = snapshot ?? null;
  }

  const response = await jobStub(env, jobId).fetch(`${DO_ORIGIN}/start`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const data = await readJson(response);
    return { ok: false, status: response.status, error: data?.error || 'Unable to start reading.' };
  }
  return { ok: true, jobId, jobToken };
}

async function callMcpPath(path, { env, jobId, jobToken, userId, method = 'GET' }) {
  if (!env?.READING_JOBS) {
    return { ok: false, status: 503, error: 'Reading jobs not configured.' };
  }
  if (!jobId || !jobToken || !userId) {
    return { ok: false, status: 404, error: 'Reading job not found.' };
  }
  const response = await jobStub(env, jobId).fetch(`${DO_ORIGIN}${path}`, {
    method,
    headers: { 'X-Job-Token': jobToken, 'X-Principal-User-Id': String(userId) }
  });
  const data = await readJson(response);
  if (!response.ok) {
    return { ok: false, status: response.status, error: data?.error || 'Reading job unavailable.' };
  }
  return { ok: true, data };
}

/** Snapshot, result and themes of a principal job owned by `userId`. */
export function getMcpJobSnapshot({ env, jobId, jobToken, userId }) {
  return callMcpPath('/mcp/snapshot', { env, jobId, jobToken, userId });
}

/** Cancel a principal job owned by `userId`; a finished job is left intact. */
export function cancelMcpJob({ env, jobId, jobToken, userId }) {
  return callMcpPath('/mcp/cancel', { env, jobId, jobToken, userId, method: 'POST' });
}
```

- [ ] **Step 5: Make the public start route use it**

Replace the whole of `functions/api/tarot-reading-job-start.js` with:

```js
import { jsonResponse, readJsonBody } from '../lib/utils.js';
import { startReadingJob } from '../lib/readingJobs.js';

/**
 * POST /api/tarot-reading/jobs
 * Starts a reading job for the app. The job authenticates with the caller's
 * forwarded credentials; a principal can never be supplied through this
 * route (see functions/lib/readingJobs.js).
 */
export const onRequestPost = async ({ request, env }) => {
  if (!env?.READING_JOBS) {
    return jsonResponse({ error: 'Reading jobs not configured.' }, { status: 503 });
  }

  let payload = null;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    return jsonResponse({ error: error?.message || 'Invalid JSON payload.' }, { status: 400 });
  }

  const result = await startReadingJob({
    env,
    payload,
    forwardHeaders: {
      authorization: request.headers.get('Authorization'),
      cookie: request.headers.get('Cookie')
    }
  });
  if (!result.ok) {
    return jsonResponse({ error: result.error }, { status: result.status });
  }
  return jsonResponse({ jobId: result.jobId, jobToken: result.jobToken });
};
```

- [ ] **Step 6: Update the `ReadingJob` Durable Object**

Make these edits in `src/worker/readingJob.js`, in order.

(a) Replace `const JOB_TTL_MS = 60 * 60 * 1000;` with:

```js
export const JOB_TTL_MS = 60 * 60 * 1000;
// Jobs started by the ChatGPT MCP tools stay readable for a day, so a reading
// can still be saved later in the same conversation (spec §7.4).
export const MCP_JOB_TTL_MS = 24 * 60 * 60 * 1000;
const JOB_NOT_FOUND = 'Reading job not found.';
```

(b) Directly after the `normalizeCursor` function, add:

```js

function emptyJob() {
  return {
    status: 'idle',
    jobId: null,
    token: null,
    createdAt: null,
    updatedAt: null,
    expiresAt: null,
    meta: null,
    result: null,
    error: null,
    // Set only for jobs started by the MCP tools (in-Worker callers).
    principalUserId: null,
    snapshot: null,
    retentionMs: null
  };
}
```

(c) Replace:

```js
  constructor(state, env) {
    this.state = state;
    this.env = env;
```

with:

```js
  /**
   * @param {DurableObjectState} state
   * @param {object} env
   * @param {{ runReading?: Function }} [options] - Tests inject the reading
   *   runner; the Workers runtime always uses the default.
   */
  constructor(state, env, { runReading = tarotReadingPost } = {}) {
    this.state = state;
    this.env = env;
    this.runReading = runReading;
```

and in the same constructor replace the inline `this.job = { status: 'idle', ... error: null };` literal (the eleven lines from `this.job = {` to `};`) with `this.job = emptyJob();`.

(d) In `fetch`, replace:

```js
    if (pathname === '/cancel') {
      return this.handleCancel(request);
    }

    return buildError(404, 'Not found');
```

with:

```js
    if (pathname === '/cancel') {
      return this.handleCancel(request);
    }
    if (pathname === '/mcp/snapshot') {
      return this.handleMcpSnapshot(request);
    }
    if (pathname === '/mcp/cancel') {
      return this.handleMcpCancel(request);
    }

    return buildError(404, 'Not found');
```

(e) In `handleStart`, replace:

```js
    const payload = body?.payload;
    const jobId = body?.jobId;
```

with:

```js
    const payload = body?.payload;
    const jobId = body?.jobId;
    // Only in-Worker callers (readingJobs.startReadingJob, for the MCP tools)
    // send a principal; the public job-start route never does.
    const principalUserId = typeof body?.principal?.userId === 'string' && body.principal.userId
      ? body.principal.userId
      : null;
```

Then, still in `handleStart`, replace:

```js
      error: null,
      meta: null,
      result: null
    };
    this.cancelled = false;

    await this.persistState();

    if (!this.runningPromise) {
      const authHeader = request.headers.get('Authorization') || '';
      const cookieHeader = request.headers.get('Cookie') || '';
      this.runningPromise = this.runJob(payload, {
        authorization: authHeader,
        cookie: cookieHeader
      });
      this.state.waitUntil(this.runningPromise);
    }
```

with:

```js
      error: null,
      meta: null,
      result: null,
      principalUserId,
      snapshot: principalUserId ? (body.snapshot ?? null) : null,
      retentionMs: principalUserId ? MCP_JOB_TTL_MS : JOB_TTL_MS
    };
    this.cancelled = false;

    await this.persistState();

    if (!this.runningPromise) {
      const authHeader = request.headers.get('Authorization') || '';
      const cookieHeader = request.headers.get('Cookie') || '';
      this.runningPromise = this.runJob(payload, {
        authorization: authHeader,
        cookie: cookieHeader
      }, principalUserId ? { userId: principalUserId } : null);
      this.state.waitUntil(this.runningPromise);
    }
```

(f) In `handleStatus` and in `handleStream`, replace:

```js
    const token = getJobToken(request);
    if (!this.job.jobId) {
      return buildError(404, 'Reading job not found.');
    }
```

with:

```js
    const token = getJobToken(request);
    if (!this.job.jobId || this.isPrincipalJob()) {
      return buildError(404, JOB_NOT_FOUND);
    }
```

(g) Replace the whole `handleCancel` method with:

```js
  async handleCancel(request) {
    const token = getJobToken(request);
    if (!this.job.jobId || this.isPrincipalJob()) {
      return buildError(404, JOB_NOT_FOUND);
    }
    if (!token || token !== this.job.token) {
      return buildError(403, 'Invalid job token.');
    }

    this.cancelRun();

    return jsonResponse({ status: 'cancelled' });
  }

  cancelRun() {
    this.cancelled = true;

    if (this.abortController) {
      this.abortController.abort();
    }

    this.appendEvent('error', { message: 'Reading cancelled.' });
  }

  isPrincipalJob() {
    return Boolean(this.job.principalUserId);
  }

  /**
   * Gate for the MCP-only paths. The job must be a principal job, and the
   * caller must present its token and the same principal. Every failure is
   * the same 404, so these paths reveal nothing about other jobs.
   */
  async authorizeMcp(request) {
    const token = getJobToken(request);
    const principal = request.headers.get('X-Principal-User-Id') || '';
    if (
      !this.job.jobId ||
      !this.isPrincipalJob() ||
      !token ||
      token !== this.job.token ||
      principal !== this.job.principalUserId
    ) {
      return buildError(404, JOB_NOT_FOUND);
    }
    if (await this.expireIfNeeded()) {
      return buildError(410, 'Reading job expired.');
    }
    return null;
  }

  async handleMcpSnapshot(request) {
    const denied = await this.authorizeMcp(request);
    if (denied) return denied;
    return jsonResponse({
      jobId: this.job.jobId,
      status: this.job.status,
      snapshot: this.job.snapshot ?? null,
      result: this.job.result,
      error: this.job.error,
      meta: { themes: this.job.meta?.themes ?? null }
    });
  }

  async handleMcpCancel(request) {
    const denied = await this.authorizeMcp(request);
    if (denied) return denied;
    // A finished reading keeps its result; only a running job is cancelled.
    if (this.job.status !== 'running') {
      return jsonResponse({ status: this.job.status });
    }
    this.cancelRun();
    return jsonResponse({ status: 'cancelled' });
  }
```

(h) In `runJob`, replace:

```js
  async runJob(payload, authHeaders) {
    this.abortController = new AbortController();

    try {
      const headers = new Headers({
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      });
      if (authHeaders.authorization) {
        headers.set('Authorization', authHeaders.authorization);
      }
      if (authHeaders.cookie) {
        headers.set('Cookie', authHeaders.cookie);
      }
```

with:

```js
  async runJob(payload, authHeaders, principal = null) {
    this.abortController = new AbortController();

    try {
      const headers = new Headers({
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      });
      // A principal job authenticates by principal alone; request
      // credentials are never forwarded for it.
      if (!principal && authHeaders.authorization) {
        headers.set('Authorization', authHeaders.authorization);
      }
      if (!principal && authHeaders.cookie) {
        headers.set('Cookie', authHeaders.cookie);
      }
```

and replace:

```js
      const response = await tarotReadingPost({
        request,
        env: this.env,
        waitUntil: this.state.waitUntil.bind(this.state)
      });
```

with:

```js
      const response = await this.runReading({
        request,
        env: this.env,
        waitUntil: this.state.waitUntil.bind(this.state),
        ...(principal ? { principal } : {})
      });
```

(i) Fix the JSON (non-SSE) response path. The SSE path fills `job.meta` and `job.result` in `processEventBlock`; the JSON path only appended events, so `/status` reported `complete` with `result: null`. In `consumeResponse`, replace:

```js
      if (payload?.reading) {
        this.appendEvent('meta', {
```

with:

```js
      if (payload?.reading) {
        const meta = {
```

then replace the lines that close that object literal and emit the done event:

```js
          backendErrors: payload.backendErrors || null
        });
        this.appendEvent('done', {
```

with:

```js
          backendErrors: payload.backendErrors || null
        };
        // Mirror processEventBlock, so JSON responses expose meta and result
        // through /status and /mcp/snapshot exactly as SSE responses do.
        this.job.meta = meta;
        this.appendEvent('meta', meta);
        this.job.result = {
          reading: payload.reading,
          provider: payload.provider || null,
          requestId: payload.requestId || null,
          gateBlocked: payload.gateBlocked || false,
          gateReason: payload.gateReason || null
        };
        this.appendEvent('done', {
```

(j) In `appendEvent`, replace both occurrences of `this.job.expiresAt = Date.now() + JOB_TTL_MS;` with `this.job.expiresAt = Date.now() + (this.job.retentionMs || JOB_TTL_MS);`.

(k) In `expireIfNeeded`, replace the inline reset literal `this.job = { status: 'idle', ... error: null };` (the eleven lines) with `this.job = emptyJob();`.

Check: `grep -n "tarotReadingPost" src/worker/readingJob.js` shows only the import and the constructor default.

- [ ] **Step 7: Run the tests**

Run: `node --test tests/readingJobPrincipal.test.mjs tests/tarotReadingJobTokenHandling.test.mjs`
Expected: PASS for both files.

- [ ] **Step 8: Commit**

```bash
git add functions/lib/readingJobs.js functions/api/tarot-reading-job-start.js src/worker/readingJob.js tests/helpers/fakeReadingJobs.mjs tests/readingJobPrincipal.test.mjs
git commit -m "feat: principal reading jobs reachable only through MCP" -m "Jobs started for ChatGPT run as an in-Worker principal, keep a request snapshot for 24 hours, and answer 404 on the public status/stream/cancel routes. Also fills job meta/result for JSON (non-SSE) readings." -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 10: Journal mapping with canonical card identity

**Files:**
- Create: `functions/lib/mcp/journalMapping.js`
- Test: `tests/mcpJournalMapping.test.mjs`

**Interfaces:**
- Consumes: `resolveReadingCards` and `ReadingCardResolutionError` from `functions/lib/readingCardResolution.js`, plus the job snapshot shape from Task 9.
- Produces:
  - constants `SPREAD_KEYS` and `JOURNAL_CONTEXTS`;
  - class `JournalMappingError`;
  - `normalizeOrientation(value): 'Upright'|'Reversed'`;
  - `toPublicCard(card, catalog?)`, which returns `{ position, card, orientation, meaning, number, suit, rank, rankValue }`;
  - `buildJournalEntryFromJob(job, { context })`, which returns a reading entry;
  - `buildJournalEntryFromPayload(input)`, which returns a reading entry.

  A reading entry is the `entry` input of `saveReadingJournalEntry` (Task 3).

- [ ] **Step 1: Write the failing test**

Create `tests/mcpJournalMapping.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildJournalEntryFromJob,
  buildJournalEntryFromPayload,
  JournalMappingError,
  toPublicCard
} from '../functions/lib/mcp/journalMapping.js';
import { FALLBACK_IMAGE, getCardImage } from '../src/lib/cardLookup.js';

const SPREAD = { name: 'Three-Card Story (Past · Present · Future)', key: 'threeCard' };

function job(overrides = {}, snapshotOverrides = {}) {
  return {
    jobId: 'job-1',
    status: 'complete',
    snapshot: {
      spreadInfo: SPREAD,
      cardsInfo: [
        { position: 'Past', card: 'The Hermit', orientation: 'Upright', meaning: 'Solitude', number: 9, suit: null, rank: null, rankValue: null },
        { position: 'Present', card: 'Three of Cups', orientation: 'reversed', meaning: 'Excess', number: null, suit: 'Cups', rank: 'Three', rankValue: 3 },
        { position: 'Future', card: 'The Star', orientation: 'Upright', meaning: 'Hope', number: 17, suit: null, rank: null, rankValue: null }
      ],
      userQuestion: 'What should I focus on?',
      deckStyle: 'rws-1909',
      personalization: { readingTone: 'gentle' },
      seed: '4242',
      ...snapshotOverrides
    },
    result: {
      reading: '  The Hermit asks for patience.\r\n\r\nThen hope.  ',
      provider: 'openai-native',
      requestId: 'req-1',
      gateBlocked: false,
      gateReason: null
    },
    error: null,
    meta: { themes: { dominantSuit: 'Cups' } },
    ...overrides
  };
}

const EXPECTED_CARDS = [
  { position: 'Past', name: 'The Hermit', orientation: 'Upright', number: 9 },
  { position: 'Present', name: 'Three of Cups', orientation: 'Reversed', suit: 'Cups', rank: 'Three', rankValue: 3 },
  { position: 'Future', name: 'The Star', orientation: 'Upright', number: 17 }
];

const PAYLOAD = {
  spread: SPREAD.name,
  spreadKey: 'threeCard',
  cards: [
    { position: 'Past', name: 'The Hermit', orientation: 'Upright', number: 9 },
    { position: 'Present', name: 'Three of Cups', orientation: 'Reversed', suit: 'Cups', rank: 'Three', rankValue: 3 },
    { position: 'Future', name: 'The Star', orientation: 'Upright', number: 17 }
  ],
  personalReading: 'The Hermit asks for patience.',
  requestId: 'req-1',
  deckId: 'rws-1909'
};

describe('buildJournalEntryFromJob', () => {
  it('maps every row of the audited field table', () => {
    const entry = buildJournalEntryFromJob(job(), { context: 'career' });
    assert.deepEqual(entry, {
      spread: SPREAD.name,
      spreadKey: 'threeCard',
      question: 'What should I focus on?',
      cards: EXPECTED_CARDS,
      personalReading: '  The Hermit asks for patience.\r\n\r\nThen hope.  ',
      themes: { dominantSuit: 'Cups' },
      context: 'career',
      provider: 'openai-native',
      sessionSeed: '4242',
      requestId: 'req-1',
      deckId: 'rws-1909',
      userPreferences: { readingTone: 'gentle' }
    });
  });

  it('takes context only from the tool input, never from the reading', () => {
    const withReadingContext = job({ meta: { themes: null, context: { primary: 'love', secret: 'x' } } });
    assert.equal(buildJournalEntryFromJob(withReadingContext).context, null);
  });

  it('stores Thoth deck labels under their canonical names', () => {
    const thoth = job({}, {
      deckStyle: 'thoth-a1',
      cardsInfo: [
        { position: 'Past', card: 'Prince of Wands', orientation: 'Upright', meaning: 'x' },
        { position: 'Present', card: 'Knight of Wands', orientation: 'Upright', meaning: 'y' },
        { position: 'Future', card: 'The Star', orientation: 'Upright', meaning: 'z' }
      ]
    });
    const { cards, deckId } = buildJournalEntryFromJob(thoth);

    assert.equal(deckId, 'thoth-a1');
    assert.deepEqual(cards.slice(0, 2), [
      { position: 'Past', name: 'Knight of Wands', orientation: 'Upright', suit: 'Wands', rank: 'Knight', rankValue: 12 },
      { position: 'Present', name: 'King of Wands', orientation: 'Upright', suit: 'Wands', rank: 'King', rankValue: 14 }
    ]);
    for (const card of cards) {
      assert.notEqual(getCardImage(card), FALLBACK_IMAGE, `${card.name} must resolve to a real card image`);
    }
    assert.equal(getCardImage({ name: 'Prince of Wands' }), FALLBACK_IMAGE, 'a stored deck label would show the card back');
  });

  it('stores Marseille labels, including the "(RWS: …)" form, canonically', () => {
    const marseille = job({}, {
      deckStyle: 'marseille-classic',
      cardsInfo: [
        { position: 'Past', card: 'Le Bateleur (RWS: The Magician)', orientation: 'Upright', meaning: 'x' },
        { position: 'Present', card: 'Chevalier of Batons (RWS: Knight of Wands)', orientation: 'Reversed', meaning: 'y' },
        { position: 'Future', card: 'The Star', orientation: 'Upright', meaning: 'z' }
      ]
    });
    const names = buildJournalEntryFromJob(marseille).cards.map((card) => card.name);
    assert.deepEqual(names.slice(0, 2), ['The Magician', 'Knight of Wands']);
  });

  it('refuses unfinished jobs, safety responses, and readings without identity', () => {
    const cases = [
      [job({ status: 'running' }), /not finished/],
      [job({ result: { reading: 'Please reach out…', provider: 'safety-gate', requestId: 'req-1', gateReason: 'crisis_gate' } }), /safety message/],
      [job({ result: { reading: 'Text', provider: 'x', requestId: null } }), /request ID/],
      [job({}, { spreadInfo: { name: 'Mine', key: 'custom' } }), /spread key/],
      [job({ snapshot: null }), /no saved reading details/]
    ];
    for (const [input, message] of cases) {
      assert.throws(() => buildJournalEntryFromJob(input), (error) => error instanceof JournalMappingError && message.test(error.message));
    }
  });

  it('refuses a label the deck does not know, naming its index', () => {
    const unknown = job({}, { cardsInfo: [{ position: 'Past', card: 'The Unicorn', orientation: 'Upright', meaning: 'x' }] });
    assert.throws(() => buildJournalEntryFromJob(unknown), (error) => error instanceof JournalMappingError && /cardsInfo\[0\]/.test(error.message));
  });
});

describe('buildJournalEntryFromPayload', () => {
  it('maps a payload save to the same canonical entry as the job would', () => {
    const entry = buildJournalEntryFromPayload(PAYLOAD);
    assert.deepEqual(entry.cards, EXPECTED_CARDS);
    assert.equal(entry.requestId, 'req-1');
    assert.equal(entry.sessionSeed, null);
    assert.equal(entry.context, null);
    assert.equal(entry.personalReading, PAYLOAD.personalReading);
  });

  it('requires identity metadata for every card', () => {
    const missing = { ...PAYLOAD, cards: [{ position: 'Past', name: 'The Hermit', orientation: 'Upright' }] };
    assert.throws(() => buildJournalEntryFromPayload(missing), /needs its number/);
    const minor = { ...PAYLOAD, cards: [{ position: 'Past', name: 'Three of Cups', orientation: 'Upright', suit: 'Cups' }] };
    assert.throws(() => buildJournalEntryFromPayload(minor), /needs its suit and rankValue/);
  });

  it('refuses a canonical name sent for a non-RWS deck', () => {
    const confused = {
      ...PAYLOAD,
      deckId: 'thoth-a1',
      cards: [{ position: 'Past', name: 'Knight of Wands', orientation: 'Upright', suit: 'Wands', rankValue: 12 }]
    };
    assert.throws(() => buildJournalEntryFromPayload(confused), /King of Wands/);
  });

  it('accepts the Thoth label with its catalog metadata', () => {
    const thoth = {
      ...PAYLOAD,
      deckId: 'thoth-a1',
      cards: [{ position: 'Past', name: 'Prince of Wands', orientation: 'upright', suit: 'Wands', rankValue: 12 }]
    };
    assert.deepEqual(buildJournalEntryFromPayload(thoth).cards, [
      { position: 'Past', name: 'Knight of Wands', orientation: 'Upright', suit: 'Wands', rank: 'Knight', rankValue: 12 }
    ]);
  });

  it('requires the narrative, the request ID and a known spread key', () => {
    assert.throws(() => buildJournalEntryFromPayload({ ...PAYLOAD, personalReading: '' }), /personalReading is required/);
    assert.throws(() => buildJournalEntryFromPayload({ ...PAYLOAD, requestId: undefined }), /requestId is required/);
    assert.throws(() => buildJournalEntryFromPayload({ ...PAYLOAD, spreadKey: 'three-card' }), /spreadKey must be one of/);
  });
});

describe('toPublicCard', () => {
  it('exposes the deck label with catalog metadata and nothing canonical-only', () => {
    const drawn = {
      position: 'Past', card: 'Prince of Wands', canonicalName: 'Knight of Wands', canonicalKey: 'knight of wands',
      aliases: ['Knight of Wands'], orientation: 'Upright', meaning: 'Momentum', number: null,
      suit: 'Wands', rank: 'Knight', rankValue: 12, userReflection: null
    };
    assert.deepEqual(toPublicCard(drawn), {
      position: 'Past', card: 'Prince of Wands', orientation: 'Upright', meaning: 'Momentum',
      number: null, suit: 'Wands', rank: 'Knight', rankValue: 12
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/mcpJournalMapping.test.mjs`
Expected: FAIL with `Cannot find module` for `functions/lib/mcp/journalMapping.js`.

- [ ] **Step 3: Write the mapping module**

Create `functions/lib/mcp/journalMapping.js`:

```js
/**
 * Mapping from a completed MCP reading (job snapshot, or the audited
 * SaveReadingRequest payload) to a journal entry (spec §6.4, D11).
 *
 * Cards are stored under their canonical catalog identity, the namespace the
 * app's own saves use, resolved with the reading pipeline's own resolver
 * (resolveReadingCards). Deck labels such as Thoth "Prince of Wands" are not
 * catalog names; stored as-is they render as a card back, or as the wrong
 * card.
 */

import { ReadingCardResolutionError, resolveReadingCards } from '../readingCardResolution.js';

export const SPREAD_KEYS = Object.freeze(['single', 'threeCard', 'fiveCard', 'decision', 'relationship', 'celtic']);
export const JOURNAL_CONTEXTS = Object.freeze(['love', 'career', 'self', 'spiritual', 'wellbeing', 'decision', 'general']);

const DEFAULT_DECK = 'rws-1909';

export class JournalMappingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'JournalMappingError';
  }
}

export function normalizeOrientation(value) {
  const lower = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (lower === 'upright') return 'Upright';
  if (lower === 'reversed') return 'Reversed';
  throw new JournalMappingError(`orientation must be Upright or Reversed, not ${JSON.stringify(value)}`);
}

function requireText(value, message) {
  if (typeof value !== 'string' || !value.trim()) throw new JournalMappingError(message);
  return value;
}

function nullableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * A card as the MCP tools show it: the deck label plus catalog metadata.
 *
 * @param {object} card - { position, card (deck label), orientation, meaning }
 * @param {object} [catalog] - Resolved catalog identity; defaults to `card`
 */
export function toPublicCard(card, catalog = card) {
  return {
    position: card.position,
    card: card.card,
    orientation: normalizeOrientation(card.orientation),
    meaning: typeof card.meaning === 'string' ? card.meaning : null,
    number: nullableNumber(catalog?.number),
    suit: catalog?.suit || null,
    rank: catalog?.rank || null,
    rankValue: nullableNumber(catalog?.rankValue)
  };
}

function readLabels(cards, labelField) {
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new JournalMappingError('the reading has no cards');
  }
  return cards.map((card, index) => ({
    card: requireText(card?.[labelField], `card ${index + 1} has no name`),
    position: requireText(card?.position, `card ${index + 1} has no position`),
    orientation: normalizeOrientation(card?.orientation)
  }));
}

function resolveCatalogCards(labels, deckStyle) {
  try {
    return resolveReadingCards(
      labels.map(({ card, position, orientation }) => ({ card, position, orientation, meaning: '' })),
      deckStyle
    );
  } catch (error) {
    if (error instanceof ReadingCardResolutionError) throw new JournalMappingError(error.message);
    throw error;
  }
}

function toJournalCard({ position, orientation }, catalog) {
  const card = { position, name: catalog.name, orientation };
  if (catalog.number !== null && catalog.number !== undefined) card.number = catalog.number;
  if (catalog.suit) card.suit = catalog.suit;
  if (catalog.rank) card.rank = catalog.rank;
  if (catalog.rankValue !== null && catalog.rankValue !== undefined) card.rankValue = catalog.rankValue;
  return card;
}

function normalizeContextInput(context) {
  if (context === undefined || context === null) return null;
  if (!JOURNAL_CONTEXTS.includes(context)) {
    throw new JournalMappingError(`context must be one of ${JOURNAL_CONTEXTS.join(', ')}`);
  }
  return context;
}

/**
 * Journal entry for a completed job, from the job's own snapshot and result.
 * The narrative is copied verbatim; `context` comes only from the tool input.
 *
 * @param {object} job - getMcpJobSnapshot(...).data
 * @param {{ context?: string }} [options]
 */
export function buildJournalEntryFromJob(job, { context } = {}) {
  const snapshot = job?.snapshot;
  const result = job?.result;
  if (!snapshot) throw new JournalMappingError('this job has no saved reading details');
  if (job.status !== 'complete' || typeof result?.reading !== 'string' || !result.reading.trim()) {
    throw new JournalMappingError('the reading has not finished; wait for it to complete first');
  }
  if (result.provider === 'safety-gate' || result.gateReason === 'crisis_gate') {
    throw new JournalMappingError('this response was a safety message, not a reading');
  }
  const requestId = requireText(result.requestId, 'the reading has no request ID');
  const spreadKey = snapshot.spreadInfo?.key;
  if (!SPREAD_KEYS.includes(spreadKey)) {
    throw new JournalMappingError('the reading has no recognised spread key');
  }

  const deckStyle = snapshot.deckStyle || DEFAULT_DECK;
  const labels = readLabels(snapshot.cardsInfo, 'card');
  const catalog = resolveCatalogCards(labels, deckStyle);

  return {
    spread: snapshot.spreadInfo?.name || spreadKey,
    spreadKey,
    question: snapshot.userQuestion ?? null,
    cards: labels.map((label, index) => toJournalCard(label, catalog[index])),
    personalReading: result.reading,
    themes: job.meta?.themes ?? null,
    context: normalizeContextInput(context),
    provider: result.provider ?? null,
    sessionSeed: snapshot.seed ?? null,
    requestId,
    deckId: deckStyle,
    userPreferences: snapshot.personalization ?? null
  };
}

function assertCatalogIdentity(card, catalog, index, deckStyle) {
  const where = `card ${index + 1} (${JSON.stringify(card.name)})`;
  if (catalog.number !== null && catalog.number !== undefined) {
    if (card.number === undefined || card.number === null) {
      throw new JournalMappingError(`${where} needs its number, as the reading returned it`);
    }
    if (card.number !== catalog.number) {
      throw new JournalMappingError(
        `${where} is ${catalog.name} (number ${catalog.number}) in deck ${deckStyle}, but number ${card.number} was sent`
      );
    }
    return;
  }
  if (!card.suit || card.rankValue === undefined || card.rankValue === null) {
    throw new JournalMappingError(`${where} needs its suit and rankValue, as the reading returned them`);
  }
  if (card.suit !== catalog.suit || card.rankValue !== catalog.rankValue) {
    throw new JournalMappingError(
      `${where} is ${catalog.name} (${catalog.suit}, rankValue ${catalog.rankValue}) in deck ${deckStyle}, but ${card.suit} rankValue ${card.rankValue} was sent`
    );
  }
}

/**
 * Journal entry from the audited SaveReadingRequest payload (the fallback
 * when a job has expired). Each card's label must agree with the catalog
 * metadata the reading returned, so a canonical name sent for a non-RWS deck
 * is refused rather than resolved to the wrong card.
 */
export function buildJournalEntryFromPayload(input) {
  const spreadKey = input?.spreadKey;
  if (!SPREAD_KEYS.includes(spreadKey)) {
    throw new JournalMappingError(`spreadKey must be one of ${SPREAD_KEYS.join(', ')}`);
  }
  const spread = requireText(input.spread, 'spread is required');
  const personalReading = requireText(
    input.personalReading,
    'personalReading is required: send the complete narrative exactly as the reading returned it'
  );
  const requestId = requireText(input.requestId, 'requestId is required: use the requestId the reading returned');

  const deckStyle = input.deckId || DEFAULT_DECK;
  const labels = readLabels(input.cards, 'name');
  const catalog = resolveCatalogCards(labels, deckStyle);
  input.cards.forEach((card, index) => assertCatalogIdentity(card, catalog[index], index, deckStyle));

  return {
    spread,
    spreadKey,
    question: input.question ?? null,
    cards: labels.map((label, index) => toJournalCard(label, catalog[index])),
    personalReading,
    themes: input.themes ?? null,
    context: normalizeContextInput(input.context),
    provider: input.provider ?? null,
    sessionSeed: input.sessionSeed ?? null,
    requestId,
    deckId: deckStyle,
    userPreferences: input.userPreferences ?? null
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/mcpJournalMapping.test.mjs`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add functions/lib/mcp/journalMapping.js tests/mcpJournalMapping.test.mjs
git commit -m "feat: map MCP readings to journal entries with canonical card identity" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: MCP server core, config and `get_profile`

**Files:**
- Modify: `package.json`, `package-lock.json` (runtime dependencies)
- Create: `functions/lib/mcp/config.js`
- Create: `functions/lib/mcp/schemas.js`
- Create: `functions/lib/mcp/tools/common.js`
- Create: `functions/lib/mcp/tools/profile.js`
- Create: `functions/lib/mcp/server.js`
- Create: `tests/helpers/mcpClient.mjs`
- Test: `tests/mcpConfig.test.mjs`, `tests/mcpServer.test.mjs`

**Interfaces:**
- Consumes: `SPREAD_KEYS` and `JOURNAL_CONTEXTS` (Task 10).
- Produces:
  - `MCP_SCOPE`, `DEFAULT_MCP_RESOURCE_URL`, `getMcpResourceUrl(env)`, `protectedResourceMetadataUrl(env)`, `parseAllowedUserIds(env): Set<string>` and `isAllowedMcpUser(env, userId)`;
  - zod schemas `spreadKeySchema`, `deckStyleSchema`, `journalContextSchema`, `orientationSchema`, `anyOrientationSchema`, `personalizationSchema`, `spreadInfoOutputSchema` and `publicCardSchema`;
  - tool helpers `READ_ONLY`, `WRITE`, `DESTRUCTIVE`, `toolMeta({ invoking, invoked, ...extra })`, `ok(structured, text)` and `fail(text)`;
  - `buildProfile(user)` and `registerProfileTool(server, { user })`;
  - `MCP_SERVER_INFO`, `MCP_INSTRUCTIONS` and `createTableuMcpServer({ env, user, waitUntil, sleep, now })`;
  - the test helper `connectMcpClient(options) → { client, close }`.

- [ ] **Step 1: Install the MCP and OAuth dependencies**

Run:

```bash
npm install @modelcontextprotocol/sdk@~1.30.0 @cfworker/json-schema@^4.1.1 && npm install --save-exact @cloudflare/workers-oauth-provider@0.10.3
```

Expected: `package.json` `dependencies` gains `"@modelcontextprotocol/sdk": "~1.30.0"`, `"@cfworker/json-schema": "^4.1.1"` and `"@cloudflare/workers-oauth-provider": "0.10.3"`.

- [ ] **Step 2: Write the failing tests**

Create `tests/mcpConfig.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_MCP_RESOURCE_URL,
  getMcpResourceUrl,
  isAllowedMcpUser,
  MCP_SCOPE,
  parseAllowedUserIds,
  protectedResourceMetadataUrl
} from '../functions/lib/mcp/config.js';

describe('MCP config', () => {
  it('uses the tableu scope and the production resource by default', () => {
    assert.equal(MCP_SCOPE, 'tableu');
    assert.equal(getMcpResourceUrl({}), DEFAULT_MCP_RESOURCE_URL);
    assert.equal(DEFAULT_MCP_RESOURCE_URL, 'https://tarot.lakefrontdev.com/mcp');
    assert.equal(getMcpResourceUrl({ MCP_RESOURCE_URL: ' https://tarot.example/mcp ' }), 'https://tarot.example/mcp');
  });

  it('builds the path-suffixed protected-resource metadata URL', () => {
    assert.equal(
      protectedResourceMetadataUrl({ MCP_RESOURCE_URL: 'https://tarot.example/mcp' }),
      'https://tarot.example/.well-known/oauth-protected-resource/mcp'
    );
  });

  it('matches allowlisted ids pasted with spaces, commas and newlines', () => {
    const env = { MCP_ALLOWED_USER_IDS: ' user-1 ,user-2\n' };
    assert.deepEqual([...parseAllowedUserIds(env)], ['user-1', 'user-2']);
    assert.equal(isAllowedMcpUser(env, 'user-1'), true);
    assert.equal(isAllowedMcpUser(env, 'user-2'), true);
    assert.equal(isAllowedMcpUser(env, 'user-3'), false);
  });

  it('allows nobody when the allowlist is unset or blank', () => {
    for (const env of [{}, { MCP_ALLOWED_USER_IDS: '' }, { MCP_ALLOWED_USER_IDS: ' , ' }]) {
      assert.equal(isAllowedMcpUser(env, 'user-1'), false);
    }
    assert.equal(isAllowedMcpUser({ MCP_ALLOWED_USER_IDS: 'user-1' }, ''), false);
    assert.equal(isAllowedMcpUser({ MCP_ALLOWED_USER_IDS: 'user-1' }, undefined), false);
  });
});
```

Create `tests/helpers/mcpClient.mjs`:

```js
/** Connect an MCP client to createTableuMcpServer over an in-memory transport. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createTableuMcpServer } from '../../functions/lib/mcp/server.js';

export async function connectMcpClient(options) {
  const server = createTableuMcpServer(options);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'tableu-test-client', version: '1.0.0' });
  await client.connect(clientTransport);
  return {
    client,
    async close() {
      await client.close();
      await server.close();
    }
  };
}
```

Create `tests/mcpServer.test.mjs`:

```js
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { connectMcpClient } from './helpers/mcpClient.mjs';

const OWNER = Object.freeze({
  id: 'user-1',
  username: 'henry',
  full_name: null,
  subscription_tier: 'plus',
  subscription_status: 'active',
  auth_provider: 'session'
});

const open = [];
async function connect(user = OWNER) {
  const connection = await connectMcpClient({ env: {}, user });
  open.push(connection);
  return connection.client;
}
after(async () => {
  await Promise.all(open.map((connection) => connection.close()));
});

describe('get_profile', () => {
  it('is advertised as the read-only OAuth profile tool', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    const tool = tools.find((candidate) => candidate.name === 'get_profile');

    assert.ok(tool, 'get_profile is listed');
    assert.deepEqual(tool.annotations, { readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    assert.equal(tool._meta['openai/profile'], true);
    assert.deepEqual(tool._meta.securitySchemes, [{ type: 'oauth2', scopes: ['tableu'] }]);
    assert.deepEqual(tool.outputSchema.required, ['id']);
    for (const key of ['openai/toolInvocation/invoking', 'openai/toolInvocation/invoked']) {
      assert.ok(tool._meta[key].length <= 64, `${key} is at most 64 characters`);
    }
  });

  it('returns the account the connection acts as', async () => {
    const client = await connect();
    const result = await client.callTool({ name: 'get_profile', arguments: {} });

    assert.deepEqual(result.structuredContent, { id: 'user-1', name: 'henry', nickname: 'Tableu · @henry' });
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  });

  it('prefers the full name for display', async () => {
    const client = await connect({ ...OWNER, full_name: 'Henry Perkins' });
    const { structuredContent } = await client.callTool({ name: 'get_profile', arguments: {} });
    assert.equal(structuredContent.name, 'Henry Perkins');
  });

  it('returns only the id for an account with no username or name', async () => {
    const client = await connect({ ...OWNER, id: 'user-9', username: null, full_name: null });
    const { structuredContent, isError } = await client.callTool({ name: 'get_profile', arguments: {} });
    assert.equal(isError, undefined);
    assert.deepEqual(structuredContent, { id: 'user-9' });
  });
});

describe('server instructions', () => {
  it('tell the model the order of use and when saving is allowed', async () => {
    const client = await connect();
    const instructions = client.getInstructions();
    assert.match(instructions, /wait_for_tarot_reading/);
    assert.match(instructions, /explicitly asks to save/);
    assert.match(instructions, /never start a second job/i);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test tests/mcpConfig.test.mjs tests/mcpServer.test.mjs`
Expected: FAIL with `Cannot find module` for `functions/lib/mcp/config.js` and `functions/lib/mcp/server.js`.

- [ ] **Step 4: Write `config.js`**

Create `functions/lib/mcp/config.js`:

```js
/**
 * Configuration for the ChatGPT MCP endpoint (spec §5).
 */

export const MCP_SCOPE = 'tableu';
export const DEFAULT_MCP_RESOURCE_URL = 'https://tarot.lakefrontdev.com/mcp';

/** Canonical RFC 8707 resource for /mcp (var MCP_RESOURCE_URL). */
export function getMcpResourceUrl(env) {
  const configured = typeof env?.MCP_RESOURCE_URL === 'string' ? env.MCP_RESOURCE_URL.trim() : '';
  return configured || DEFAULT_MCP_RESOURCE_URL;
}

/** RFC 9728 metadata URL in the path-suffixed form MCP clients request. */
export function protectedResourceMetadataUrl(env) {
  const resource = new URL(getMcpResourceUrl(env));
  return new URL(`/.well-known/oauth-protected-resource${resource.pathname}`, resource.origin).href;
}

/**
 * Owner allowlist from the MCP_ALLOWED_USER_IDS secret. Ids can be separated
 * by commas, spaces or newlines. An unset or blank secret allows nobody.
 */
export function parseAllowedUserIds(env) {
  const raw = typeof env?.MCP_ALLOWED_USER_IDS === 'string' ? env.MCP_ALLOWED_USER_IDS : '';
  return new Set(raw.split(/[\s,]+/).map((id) => id.trim()).filter(Boolean));
}

export function isAllowedMcpUser(env, userId) {
  return typeof userId === 'string' && userId.length > 0 && parseAllowedUserIds(env).has(userId);
}
```

- [ ] **Step 5: Write the shared schemas and tool helpers**

Create `functions/lib/mcp/schemas.js`:

```js
/** zod schemas shared by the MCP tools (spec §6). */
import * as z from 'zod';

import { DECK_CATALOG } from '../../../shared/vision/deckCatalog.js';
import { PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH } from '../../../shared/contracts/personalizationConstants.js';
import { JOURNAL_CONTEXTS, SPREAD_KEYS } from './journalMapping.js';

export const spreadKeySchema = z.enum(SPREAD_KEYS);
export const deckStyleSchema = z.enum(Object.keys(DECK_CATALOG));
export const journalContextSchema = z.enum(JOURNAL_CONTEXTS);
export const orientationSchema = z.enum(['Upright', 'Reversed']);
export const anyOrientationSchema = z.enum(['upright', 'reversed', 'Upright', 'Reversed']);

/** The contract's Personalization object. */
export const personalizationSchema = z.object({
  displayName: z.string().trim().max(PERSONALIZATION_DISPLAY_NAME_MAX_LENGTH).optional(),
  readingTone: z.enum(['gentle', 'balanced', 'blunt']).optional(),
  spiritualFrame: z.enum(['psychological', 'spiritual', 'mixed', 'playful']).optional(),
  tarotExperience: z.enum(['newbie', 'intermediate', 'experienced']).optional(),
  preferredSpreadDepth: z.enum(['short', 'standard', 'deep']).optional(),
  focusAreas: z.array(z.string().trim().min(1)).optional()
}).strict();

export const spreadInfoOutputSchema = z.object({
  name: z.string(),
  key: spreadKeySchema
});

/** A card as the tools show it: deck label plus catalog metadata. */
export const publicCardSchema = z.object({
  position: z.string(),
  card: z.string(),
  orientation: orientationSchema,
  meaning: z.string().nullable(),
  number: z.number().int().nullable(),
  suit: z.string().nullable(),
  rank: z.string().nullable(),
  rankValue: z.number().int().nullable()
});
```

Create `functions/lib/mcp/tools/common.js`:

```js
/** Shared descriptors and result helpers for the Tableu MCP tools. */
import { MCP_SCOPE } from '../config.js';

export const READ_ONLY = Object.freeze({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
export const WRITE = Object.freeze({ readOnlyHint: false, destructiveHint: false, openWorldHint: false });
export const DESTRUCTIVE = Object.freeze({ readOnlyHint: false, destructiveHint: true, openWorldHint: false });

/**
 * Tool descriptor `_meta`. ChatGPT reads each tool's OAuth requirement from
 * `securitySchemes`. The SDK passes custom descriptor fields only through
 * `_meta`, which OpenAI documents as the back-compatible mirror. Status
 * strings are at most 64 characters.
 */
export function toolMeta({ invoking, invoked, ...extra }) {
  return {
    securitySchemes: [{ type: 'oauth2', scopes: [MCP_SCOPE] }],
    'openai/toolInvocation/invoking': invoking,
    'openai/toolInvocation/invoked': invoked,
    ...extra
  };
}

/** Successful result: structured content plus a plain-language summary. */
export function ok(structuredContent, text) {
  return { structuredContent, content: [{ type: 'text', text }] };
}

/** Failed result. `text` states the outcome ("Not saved: …", "Could not confirm: …"). */
export function fail(text) {
  return { isError: true, content: [{ type: 'text', text }] };
}
```

- [ ] **Step 6: Write the profile tool and the server factory**

Create `functions/lib/mcp/tools/profile.js`:

```js
/** get_profile: which Tableu account this connection acts as (spec §5.4). */
import * as z from 'zod';

import { READ_ONLY, ok, toolMeta } from './common.js';

export const profileOutputSchema = z.object({
  id: z.string().min(1).regex(/\S/),
  name: z.string().optional(),
  email: z.string().optional(),
  nickname: z.string().optional()
}).strict();

function cleanText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** The resolved user as a profile. Unavailable fields are omitted, never invented. */
export function buildProfile(user) {
  const username = cleanText(user?.username);
  const fullName = cleanText(user?.full_name);
  const profile = { id: String(user.id) };
  const name = fullName || username;
  if (name) profile.name = name;
  if (username) profile.nickname = `Tableu · @${username}`;
  return profile;
}

export function registerProfileTool(server, { user }) {
  server.registerTool(
    'get_profile',
    {
      title: 'Get Tableu profile',
      description:
        'Returns the Tableu account this connection acts as. `id` is the Tableu user id: opaque, unique, and unchanged across token refresh, reconnection, and display-name changes. Read-only.',
      inputSchema: z.object({}).strict(),
      outputSchema: profileOutputSchema,
      annotations: READ_ONLY,
      _meta: toolMeta({
        invoking: 'Checking your Tableu account…',
        invoked: 'Tableu account checked',
        'openai/profile': true
      })
    },
    async () => {
      const profile = buildProfile(user);
      return ok(profile, JSON.stringify(profile));
    }
  );
}
```

Create `functions/lib/mcp/server.js`:

```js
/**
 * The Tableu MCP server (spec §6). One server per /mcp request, since the
 * transport is stateless. Every tool is bound to the user the OAuth grant
 * resolved to.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// Ajv (the SDK default) generates code at runtime, which Workers forbid.
import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/cfworker-provider.js';

import { registerProfileTool } from './tools/profile.js';

export const MCP_SERVER_INFO = Object.freeze({ name: 'tableu', version: '1.0.0' });

export const MCP_INSTRUCTIONS = [
  "Tableu draws and interprets tarot readings and keeps them in the user's Tableu journal.",
  '1. Start a reading with draw_tarot_reading when Tableu should draw the cards, or with start_tarot_reading when the user supplies cards (keep their cards, positions and orientations exactly).',
  '2. Call wait_for_tarot_reading with the returned jobId and jobToken until the status is complete or error. If it is still running, call it again; never start a second job for the same request.',
  '3. Present each card as "Position — Card (orientation)" and make the returned narrative the centerpiece.',
  '4. Call save_reading_to_journal only when the user explicitly asks to save, journal, keep or remember the reading, or says yes right after you offer. Keep the returned entry id.',
  '5. Call add_reflection_to_journal_entry only when the user explicitly asks to save or attach something they said, or says yes right after you offer. Send their exact words.',
  'Never say something was saved unless the tool returned success. get_profile shows which Tableu account these tools act as.'
].join('\n');

/**
 * @param {object} options
 * @param {object} options.env - Worker bindings
 * @param {object} options.user - Resolved Tableu user (loadActiveUserById)
 * @param {Function} [options.waitUntil]
 * @param {(ms: number) => Promise<void>} [options.sleep] - Injected in tests
 * @param {() => number} [options.now] - Injected in tests
 */
export function createTableuMcpServer({ env, user, waitUntil, sleep, now } = {}) {
  const server = new McpServer(MCP_SERVER_INFO, {
    instructions: MCP_INSTRUCTIONS,
    jsonSchemaValidator: new CfWorkerJsonSchemaValidator()
  });
  registerProfileTool(server, { user });
  return server;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node --test tests/mcpConfig.test.mjs tests/mcpServer.test.mjs`
Expected: PASS for both files.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json functions/lib/mcp/config.js functions/lib/mcp/schemas.js functions/lib/mcp/tools/common.js functions/lib/mcp/tools/profile.js functions/lib/mcp/server.js tests/helpers/mcpClient.mjs tests/mcpConfig.test.mjs tests/mcpServer.test.mjs
git commit -m "feat: add the Tableu MCP server core with get_profile" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 12: Reading tools

**Files:**
- Create: `functions/lib/mcp/tools/readings.js`
- Modify: `functions/lib/mcp/server.js`
- Test: `tests/mcpReadingTools.test.mjs`

**Interfaces:**
- Consumes:
  - `drawForSpread` (Task 8);
  - `startReadingJob`, `getMcpJobSnapshot` and `cancelMcpJob` (Task 9);
  - `toPublicCard` (Task 10);
  - the schemas and tool helpers (Task 11);
  - `resolveReadingCards`.
- Produces:
  - `WAIT_DEFAULT_SECONDS = 40` and `WAIT_MAX_SECONDS = 45`;
  - `toCompactStatus(data)`;
  - `registerReadingTools(server, { env, user, sleep, now })`, which registers `draw_tarot_reading`, `start_tarot_reading`, `get_tarot_reading_status`, `wait_for_tarot_reading` and `cancel_tarot_reading`.

- [ ] **Step 1: Write the failing test**

Create `tests/mcpReadingTools.test.mjs`:

```js
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { connectMcpClient } from './helpers/mcpClient.mjs';
import { createFakeReadingJobs, hangingRunner, readingRunner } from './helpers/fakeReadingJobs.mjs';
import { SPREADS } from '../src/data/spreads.js';

const OWNER = Object.freeze({
  id: 'user-1', username: 'henry', subscription_tier: 'plus', subscription_status: 'active', auth_provider: 'session'
});
const OTHER = Object.freeze({ ...OWNER, id: 'user-2', username: 'guest' });
const THREE = { name: SPREADS.threeCard.name, key: 'threeCard' };

const open = [];
after(async () => {
  await Promise.all(open.map((connection) => connection.close()));
});

/** A clock whose sleep advances time instantly, so waits finish at once. */
function fastClock() {
  let current = 1_000_000;
  return { now: () => current, sleep: async (ms) => { current += ms; } };
}

async function session({ runReading = readingRunner(), user = OWNER, jobs } = {}) {
  const shared = jobs ?? createFakeReadingJobs({ runReading });
  const env = { READING_JOBS: shared.namespace };
  const connection = await connectMcpClient({ env, user, ...fastClock() });
  open.push(connection);
  const call = (name, args) => connection.client.callTool({ name, arguments: args });
  return { client: connection.client, call, jobs: shared };
}

describe('draw_tarot_reading', () => {
  it('returns the drawn cards at once, and the narrative after waiting', async () => {
    const { call, jobs } = await session({ runReading: readingRunner({ reading: 'Patience, then momentum.', requestId: 'req-7' }) });
    const drawn = await call('draw_tarot_reading', { spreadInfo: THREE, userQuestion: 'What should I focus on?', seed: 'rose' });

    assert.equal(drawn.isError, undefined);
    const { jobId, jobToken, status, cardsInfo, seed, spreadInfo, deckStyle } = drawn.structuredContent;
    assert.equal(status, 'running');
    assert.deepEqual(cardsInfo.map((card) => card.position), SPREADS.threeCard.positions);
    assert.match(seed, /^\d+$/);
    assert.deepEqual(spreadInfo, { name: SPREADS.threeCard.name, key: 'threeCard' });
    assert.equal(deckStyle, 'rws-1909');
    assert.match(drawn.content[0].text, /call wait_for_tarot_reading/);

    await jobs.settle();
    const waited = await call('wait_for_tarot_reading', { jobId, jobToken });
    assert.equal(waited.structuredContent.status, 'complete');
    assert.equal(waited.structuredContent.reading, 'Patience, then momentum.');
    assert.equal(waited.structuredContent.requestId, 'req-7');
    assert.deepEqual(waited.structuredContent.cardsInfo, cardsInfo);
    assert.deepEqual(waited.structuredContent.themes, { dominantSuit: 'Cups' });
  });

  it('draws the same cards for the same seed', async () => {
    const { call } = await session();
    const first = await call('draw_tarot_reading', { spreadInfo: THREE, seed: 'rose' });
    const second = await call('draw_tarot_reading', { spreadInfo: THREE, seed: 'rose' });
    const replay = await call('draw_tarot_reading', { spreadInfo: THREE, seed: first.structuredContent.seed });
    assert.deepEqual(first.structuredContent.cardsInfo, second.structuredContent.cardsInfo);
    assert.equal(first.structuredContent.seed, second.structuredContent.seed);
    assert.deepEqual(replay.structuredContent.cardsInfo, first.structuredContent.cardsInfo, 'the returned seed replays cards and orientations');
    assert.equal(replay.structuredContent.seed, first.structuredContent.seed);
  });

  it('accepts the uint32 boundaries and rejects invalid decimal replay seeds before starting a job', async () => {
    const { call, jobs } = await session();
    const zero = await call('draw_tarot_reading', { spreadInfo: THREE, seed: '0' });
    const max = await call('draw_tarot_reading', { spreadInfo: THREE, seed: '4294967295' });
    assert.equal(zero.isError, undefined);
    assert.match(zero.structuredContent.seed, /^\d+$/);
    assert.equal(max.structuredContent.seed, '4294967295');

    const started = jobs.instances.size;
    for (const seed of ['-1', '1.5', '4294967296']) {
      const invalid = await call('draw_tarot_reading', { spreadInfo: THREE, seed });
      assert.equal(invalid.isError, true, seed);
      assert.match(invalid.content[0].text, /unsigned 32-bit decimal integer/);
      assert.equal(jobs.instances.size, started, 'invalid seeds do not start jobs');
    }
  });

  it('runs the reading as the signed-in user, with no request credentials', async () => {
    const calls = [];
    const { call, jobs } = await session({ runReading: readingRunner({ calls }) });
    await call('draw_tarot_reading', { spreadInfo: THREE, deckStyle: 'thoth-a1' });
    await jobs.settle();

    assert.deepEqual(calls[0].principal, { userId: 'user-1' });
    assert.equal(calls[0].request.headers.get('Authorization'), null);
    assert.equal(JSON.parse(await calls[0].request.text()).deckStyle, 'thoth-a1');
  });

  it('rejects a spread outside the six keys before drawing', async () => {
    const { call, jobs } = await session();
    const result = await call('draw_tarot_reading', { spreadInfo: { name: 'Mine', key: 'custom' } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /Input validation error/);
    assert.equal(jobs.instances.size, 0);
  });
});

describe('start_tarot_reading', () => {
  it('starts from supplied cards and normalizes orientation', async () => {
    const { call, jobs } = await session();
    const started = await call('start_tarot_reading', {
      spreadInfo: THREE,
      cardsInfo: [
        { position: 'Past', card: 'The Hermit', orientation: 'upright', meaning: 'Solitude' },
        { position: 'Present', card: 'Three of Cups', orientation: 'reversed', meaning: 'Excess' },
        { position: 'Future', card: 'The Star', orientation: 'Upright', meaning: 'Hope' }
      ]
    });
    assert.equal(started.structuredContent.status, 'running');
    await jobs.settle();

    const { structuredContent } = await call('get_tarot_reading_status', {
      jobId: started.structuredContent.jobId, jobToken: started.structuredContent.jobToken
    });
    assert.equal(structuredContent.status, 'complete');
    assert.deepEqual(structuredContent.cardsInfo[1], {
      position: 'Present', card: 'Three of Cups', orientation: 'Reversed', meaning: 'Excess',
      number: null, suit: 'Cups', rank: 'Three', rankValue: 3
    });
  });

  it('refuses an unknown card before any job starts', async () => {
    const { call, jobs } = await session();
    const result = await call('start_tarot_reading', {
      spreadInfo: THREE,
      cardsInfo: [{ position: 'Past', card: 'The Unicorn', orientation: 'Upright', meaning: 'x' }]
    });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /^Not started: cardsInfo\[0\]/);
    assert.equal(jobs.instances.size, 0);
  });
});

describe('waiting and status', () => {
  it('returns running with timedOut instead of blocking past the timeout', async () => {
    const { call, jobs } = await session({ runReading: hangingRunner() });
    const { jobId, jobToken } = (await call('draw_tarot_reading', { spreadInfo: THREE })).structuredContent;

    const waited = await call('wait_for_tarot_reading', { jobId, jobToken, timeoutSeconds: 3 });

    assert.equal(waited.structuredContent.status, 'running');
    assert.equal(waited.structuredContent.timedOut, true);
    assert.match(waited.content[0].text, /call wait_for_tarot_reading again/);
    assert.equal(jobs.instances.size, 1, 'no second job was started');
  });

  it('rejects a timeout above 45 seconds', async () => {
    const { call } = await session();
    const result = await call('wait_for_tarot_reading', { jobId: 'a', jobToken: 'b', timeoutSeconds: 46 });
    assert.equal(result.isError, true);
  });

  it("hides another user's job", async () => {
    const jobs = createFakeReadingJobs({ runReading: readingRunner() });
    const owner = await session({ jobs });
    const other = await session({ jobs, user: OTHER });
    const { jobId, jobToken } = (await owner.call('draw_tarot_reading', { spreadInfo: THREE })).structuredContent;
    await jobs.settle();

    const peek = await other.call('get_tarot_reading_status', { jobId, jobToken });
    assert.equal(peek.isError, true);
    assert.equal(peek.content[0].text, 'Reading job not found.');
  });

  it('reports a failed reading as an error status', async () => {
    const { call, jobs } = await session({
      runReading: readingRunner({ status: 403, reading: 'The "Celtic Cross" spread requires an active Plus subscription' })
    });
    const { jobId, jobToken } = (await call('draw_tarot_reading', { spreadInfo: THREE })).structuredContent;
    await jobs.settle();

    const { structuredContent } = await call('get_tarot_reading_status', { jobId, jobToken });
    assert.equal(structuredContent.status, 'error');
    assert.match(structuredContent.error, /Plus subscription/);
  });
});

describe('cancel_tarot_reading', () => {
  it('cancels a running reading', async () => {
    const { call, jobs } = await session({ runReading: hangingRunner() });
    const { jobId, jobToken } = (await call('draw_tarot_reading', { spreadInfo: THREE })).structuredContent;

    const cancelled = await call('cancel_tarot_reading', { jobId, jobToken });
    await jobs.settle();

    assert.deepEqual(cancelled.structuredContent, { jobId, status: 'cancelled' });
    const { structuredContent } = await call('get_tarot_reading_status', { jobId, jobToken });
    assert.equal(structuredContent.error, 'Reading cancelled.');
  });

  it('is marked destructive and leaves a finished reading intact', async () => {
    const { client, call, jobs } = await session();
    const { tools } = await client.listTools();
    assert.equal(tools.find((tool) => tool.name === 'cancel_tarot_reading').annotations.destructiveHint, true);

    const { jobId, jobToken } = (await call('draw_tarot_reading', { spreadInfo: THREE })).structuredContent;
    await jobs.settle();
    const result = await call('cancel_tarot_reading', { jobId, jobToken });
    assert.equal(result.structuredContent.status, 'complete');
    assert.match(result.content[0].text, /already finished/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/mcpReadingTools.test.mjs`
Expected: FAIL. The calls to `draw_tarot_reading` return `isError` with "Tool draw_tarot_reading not found".

- [ ] **Step 3: Write the reading tools**

Create `functions/lib/mcp/tools/readings.js`:

```js
/**
 * Reading tools (spec §6.1–6.3): draw_tarot_reading, start_tarot_reading,
 * get_tarot_reading_status, wait_for_tarot_reading and cancel_tarot_reading.
 *
 * Every call returns well inside ChatGPT's ~60 s tool limit: draws and
 * starts return at once, and waiting polls for at most 45 s.
 */
import * as z from 'zod';

import { ReadingCardResolutionError, resolveReadingCards } from '../../readingCardResolution.js';
import { cancelMcpJob, getMcpJobSnapshot, startReadingJob } from '../../readingJobs.js';
import { drawForSpread } from '../../serverDraw.js';
import { REFLECTIONS_TEXT_MAX_LENGTH, USER_QUESTION_MAX_LENGTH } from '../../../../shared/contracts/readingSchema.js';
import { toPublicCard } from '../journalMapping.js';
import {
  anyOrientationSchema,
  deckStyleSchema,
  personalizationSchema,
  publicCardSchema,
  spreadInfoOutputSchema,
  spreadKeySchema
} from '../schemas.js';
import { DESTRUCTIVE, READ_ONLY, WRITE, fail, ok, toolMeta } from './common.js';

export const WAIT_DEFAULT_SECONDS = 40;
export const WAIT_MAX_SECONDS = 45;
const POLL_INTERVAL_MS = 1000;
const SEED_MAX_LENGTH = 256;
const MAX_CARDS = 78;
const DEFAULT_DECK = 'rws-1909';

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * MCP returns the 32-bit draw seed as decimal text. Convert that form back
 * to a number so it replays exactly through serverDraw.coerceSeed. All other
 * text remains a phrase seed and keeps the existing seeded-hash behavior.
 * This conversion is MCP-only; /api/tarot-reading/draw still hashes every
 * string seed, including numeric strings (Task 8).
 */
function normalizeMcpDrawSeed(seed) {
  if (seed === undefined) return undefined;
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(seed)) {
    const numeric = Number(seed);
    if (!/^\d+$/.test(seed) || !Number.isSafeInteger(numeric) || numeric > 0xffffffff) {
      throw new RangeError('seed must be an unsigned 32-bit decimal integer');
    }
    return numeric;
  }
  return seed;
}

const spreadInfoInput = z.object({
  name: z.string().trim().min(1),
  key: spreadKeySchema
}).strict();

const readingContext = {
  userQuestion: z.string().max(USER_QUESTION_MAX_LENGTH).optional(),
  reflectionsText: z.string().max(REFLECTIONS_TEXT_MAX_LENGTH).optional(),
  reversalFrameworkOverride: z.string().min(1).optional(),
  deckStyle: deckStyleSchema.optional(),
  personalization: personalizationSchema.optional()
};

const drawInput = z.object({
  spreadInfo: spreadInfoInput,
  ...readingContext,
  allowReversals: z.boolean().optional(),
  seed: z.string().trim().min(1).max(SEED_MAX_LENGTH).optional()
}).strict();

const suppliedCard = z.object({
  position: z.string().trim().min(1),
  card: z.string().trim().min(1),
  orientation: anyOrientationSchema,
  meaning: z.string().trim().min(1),
  number: z.number().int().optional(),
  suit: z.string().optional(),
  rank: z.string().optional(),
  rankValue: z.number().int().optional()
}).strict();

const startInput = z.object({
  spreadInfo: spreadInfoInput,
  cardsInfo: z.array(suppliedCard).min(1).max(MAX_CARDS),
  ...readingContext
}).strict();

const jobRef = {
  jobId: z.string().min(1),
  jobToken: z.string().min(1)
};
const jobRefInput = z.object(jobRef).strict();
const waitInput = z.object({
  ...jobRef,
  timeoutSeconds: z.number().int().min(1).max(WAIT_MAX_SECONDS).optional()
}).strict();

const statusOutput = z.object({
  jobId: z.string(),
  status: z.enum(['running', 'complete', 'error']),
  spreadInfo: spreadInfoOutputSchema.nullable(),
  cardsInfo: z.array(publicCardSchema),
  seed: z.string().optional(),
  reading: z.string().optional(),
  provider: z.string().nullable().optional(),
  requestId: z.string().nullable().optional(),
  themes: z.record(z.string(), z.unknown()).optional(),
  gateBlocked: z.boolean().optional(),
  gateReason: z.string().nullable().optional(),
  error: z.string().optional(),
  timedOut: z.boolean().optional()
});

const drawOutput = z.object({
  jobId: z.string(),
  jobToken: z.string(),
  status: z.literal('running'),
  spreadInfo: spreadInfoOutputSchema,
  cardsInfo: z.array(publicCardSchema),
  seed: z.string(),
  deckStyle: z.string()
});

const startOutput = z.object({
  jobId: z.string(),
  jobToken: z.string(),
  status: z.literal('running')
});

const cancelOutput = z.object({
  jobId: z.string(),
  status: z.enum(['cancelled', 'complete', 'error'])
});

function jobStatus(status) {
  return status === 'complete' || status === 'error' ? status : 'running';
}

/**
 * Model-facing job status: the snapshot's cards are ground truth, and the
 * large analysis metadata is left out.
 */
export function toCompactStatus(data) {
  const snapshot = data?.snapshot || {};
  const status = jobStatus(data?.status);
  const compact = {
    jobId: String(data?.jobId ?? ''),
    status,
    spreadInfo: snapshot.spreadInfo ?? null,
    cardsInfo: Array.isArray(snapshot.cardsInfo) ? snapshot.cardsInfo : []
  };
  if (snapshot.seed) compact.seed = String(snapshot.seed);
  if (status === 'complete' && data?.result) {
    if (typeof data.result.reading === 'string') compact.reading = data.result.reading;
    compact.provider = data.result.provider ?? null;
    compact.requestId = data.result.requestId ?? null;
    if (data.meta?.themes && typeof data.meta.themes === 'object') compact.themes = data.meta.themes;
    if (data.result.gateBlocked) {
      compact.gateBlocked = true;
      compact.gateReason = data.result.gateReason ?? null;
    }
  }
  if (status === 'error') compact.error = data?.error || 'The reading failed.';
  return compact;
}

function describeCards(cards) {
  return cards
    .map((card) => `${card.position} — ${card.card} (${String(card.orientation).toLowerCase()})`)
    .join('; ');
}

function statusText(compact) {
  if (compact.status === 'complete') {
    return `The reading is complete (requestId ${compact.requestId ?? 'unknown'}). Present the narrative in \`reading\` with the cards: ${describeCards(compact.cardsInfo)}.`;
  }
  if (compact.status === 'error') return `The reading failed: ${compact.error}`;
  return 'The reading is still being written. Call wait_for_tarot_reading again with the same jobId and jobToken; do not start a new reading.';
}

function lookupFailure(result) {
  if (result.status === 404) return fail('Reading job not found.');
  if (result.status === 410) return fail('This reading job has expired.');
  return fail(`Could not check the reading: ${result.error || 'the reading service is unavailable.'}`);
}

/**
 * @param {McpServer} server
 * @param {object} deps
 * @param {object} deps.env - Worker bindings (READING_JOBS)
 * @param {object} deps.user - The resolved Tableu user
 * @param {(ms: number) => Promise<void>} [deps.sleep]
 * @param {() => number} [deps.now]
 */
export function registerReadingTools(server, { env, user, sleep = defaultSleep, now = Date.now }) {
  const principal = { userId: user.id };

  server.registerTool(
    'draw_tarot_reading',
    {
      title: 'Draw a tarot reading',
      description:
        "Draws cards on the Tableu backend for one of the six spreads and starts writing the reading. Returns the drawn cards at once, with a jobId and jobToken; then call wait_for_tarot_reading. Use only when the user has not supplied cards, and never invent cards. Uses one reading from the user's quota. A phrase seed is deterministic; pass the returned decimal seed back to replay the exact cards and orientations.",
      inputSchema: drawInput,
      outputSchema: drawOutput,
      annotations: WRITE,
      _meta: toolMeta({ invoking: 'Shuffling and drawing cards…', invoked: 'Cards drawn' })
    },
    async (input) => {
      let drawSeed;
      try {
        drawSeed = normalizeMcpDrawSeed(input.seed);
      } catch (error) {
        return fail(`Not started: ${error.message}`);
      }
      const drawn = drawForSpread({
        spreadInfo: input.spreadInfo,
        seed: drawSeed,
        allowReversals: input.allowReversals,
        deckStyle: input.deckStyle
      });
      if (!drawn.ok) return fail(`Not started: ${drawn.error}`);

      const cardsInfo = drawn.cardsInfo.map((card) => toPublicCard(card));
      const seed = String(drawn.seed);
      const started = await startReadingJob({
        env,
        payload: {
          spreadInfo: drawn.spreadInfo,
          cardsInfo: drawn.cardsInfo,
          userQuestion: input.userQuestion,
          reflectionsText: input.reflectionsText,
          reversalFrameworkOverride: input.reversalFrameworkOverride,
          deckStyle: drawn.deckStyle,
          personalization: input.personalization
        },
        principal,
        snapshot: {
          spreadInfo: drawn.spreadInfo,
          cardsInfo,
          userQuestion: input.userQuestion ?? null,
          deckStyle: drawn.deckStyle,
          personalization: input.personalization ?? null,
          seed
        }
      });
      if (!started.ok) return fail(`Not started: ${started.error}`);

      return ok(
        {
          jobId: started.jobId,
          jobToken: started.jobToken,
          status: 'running',
          spreadInfo: drawn.spreadInfo,
          cardsInfo,
          seed,
          deckStyle: drawn.deckStyle
        },
        `Drew ${cardsInfo.length} card${cardsInfo.length === 1 ? '' : 's'} for ${drawn.spreadInfo.name}: ${describeCards(cardsInfo)}. The reading is being written; call wait_for_tarot_reading with this jobId and jobToken.`
      );
    }
  );

  server.registerTool(
    'start_tarot_reading',
    {
      title: 'Start a reading from supplied cards',
      description:
        "Starts a Tableu reading for cards the user supplies: a physical deck, a photo, or an earlier draw. Keep their cards, positions and orientations exactly. Returns a jobId and jobToken at once; then call wait_for_tarot_reading. Uses one reading from the user's quota.",
      inputSchema: startInput,
      outputSchema: startOutput,
      annotations: WRITE,
      _meta: toolMeta({ invoking: 'Laying out your cards…', invoked: 'Reading started' })
    },
    async (input) => {
      const deckStyle = input.deckStyle || DEFAULT_DECK;
      const cardsInfo = input.cardsInfo.map((card) => ({
        ...card,
        orientation: card.orientation.toLowerCase() === 'reversed' ? 'Reversed' : 'Upright'
      }));

      // The same check the reading pipeline makes, done before any quota is used.
      let catalog;
      try {
        catalog = resolveReadingCards(cardsInfo, deckStyle);
      } catch (error) {
        if (error instanceof ReadingCardResolutionError) return fail(`Not started: ${error.message}`);
        throw error;
      }

      const started = await startReadingJob({
        env,
        payload: {
          spreadInfo: input.spreadInfo,
          cardsInfo,
          userQuestion: input.userQuestion,
          reflectionsText: input.reflectionsText,
          reversalFrameworkOverride: input.reversalFrameworkOverride,
          deckStyle,
          personalization: input.personalization
        },
        principal,
        snapshot: {
          spreadInfo: { name: input.spreadInfo.name, key: input.spreadInfo.key },
          cardsInfo: cardsInfo.map((card, index) => toPublicCard(card, catalog[index])),
          userQuestion: input.userQuestion ?? null,
          deckStyle,
          personalization: input.personalization ?? null,
          seed: null
        }
      });
      if (!started.ok) return fail(`Not started: ${started.error}`);

      return ok(
        { jobId: started.jobId, jobToken: started.jobToken, status: 'running' },
        'Reading started. Call wait_for_tarot_reading with this jobId and jobToken.'
      );
    }
  );

  server.registerTool(
    'get_tarot_reading_status',
    {
      title: 'Check a reading',
      description: 'Checks a reading job once. To wait for it to finish, use wait_for_tarot_reading instead.',
      inputSchema: jobRefInput,
      outputSchema: statusOutput,
      annotations: READ_ONLY,
      _meta: toolMeta({ invoking: 'Checking the reading…', invoked: 'Reading checked' })
    },
    async ({ jobId, jobToken }) => {
      const result = await getMcpJobSnapshot({ env, jobId, jobToken, userId: user.id });
      if (!result.ok) return lookupFailure(result);
      const compact = toCompactStatus(result.data);
      return ok(compact, statusText(compact));
    }
  );

  server.registerTool(
    'wait_for_tarot_reading',
    {
      title: 'Wait for a reading',
      description: `Waits up to timeoutSeconds (default ${WAIT_DEFAULT_SECONDS}, at most ${WAIT_MAX_SECONDS}) for a reading job to finish, then returns its status. When it is complete, \`reading\` holds the narrative. If it is still running, call this again with the same jobId and jobToken; never start a second reading for the same request.`,
      inputSchema: waitInput,
      outputSchema: statusOutput,
      annotations: READ_ONLY,
      _meta: toolMeta({ invoking: 'Waiting for the reading…', invoked: 'Reading checked' })
    },
    async ({ jobId, jobToken, timeoutSeconds = WAIT_DEFAULT_SECONDS }) => {
      const deadline = now() + timeoutSeconds * 1000;
      for (;;) {
        const result = await getMcpJobSnapshot({ env, jobId, jobToken, userId: user.id });
        if (!result.ok) return lookupFailure(result);
        const compact = toCompactStatus(result.data);
        if (compact.status !== 'running') return ok(compact, statusText(compact));
        if (now() + POLL_INTERVAL_MS >= deadline) {
          const pending = { ...compact, timedOut: true };
          return ok(pending, statusText(pending));
        }
        await sleep(POLL_INTERVAL_MS);
      }
    }
  );

  server.registerTool(
    'cancel_tarot_reading',
    {
      title: 'Cancel a reading',
      description: 'Cancels a reading job that is still being written. A finished reading is left as it is.',
      inputSchema: jobRefInput,
      outputSchema: cancelOutput,
      annotations: DESTRUCTIVE,
      _meta: toolMeta({ invoking: 'Cancelling the reading…', invoked: 'Reading cancelled' })
    },
    async ({ jobId, jobToken }) => {
      const result = await cancelMcpJob({ env, jobId, jobToken, userId: user.id });
      if (!result.ok) {
        return fail(result.status === 404 ? 'Not cancelled: Reading job not found.' : `Not cancelled: ${result.error}`);
      }
      const status = result.data?.status === 'complete' || result.data?.status === 'error'
        ? result.data.status
        : 'cancelled';
      return ok(
        { jobId, status },
        status === 'cancelled' ? 'Reading cancelled.' : `The reading had already finished (${status}); nothing was cancelled.`
      );
    }
  );
}
```

- [ ] **Step 4: Register the reading tools**

In `functions/lib/mcp/server.js`, add after the `registerProfileTool` import:

```js
import { registerReadingTools } from './tools/readings.js';
```

and after `registerProfileTool(server, { user });` add:

```js
  registerReadingTools(server, { env, user, sleep, now });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/mcpReadingTools.test.mjs tests/mcpServer.test.mjs`
Expected: PASS for both files.

- [ ] **Step 6: Commit**

```bash
git add functions/lib/mcp/tools/readings.js functions/lib/mcp/server.js tests/mcpReadingTools.test.mjs
git commit -m "feat: add MCP reading tools on the principal job workflow" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Journal tools

**Files:**
- Create: `functions/lib/mcp/tools/journal.js`
- Modify: `functions/lib/mcp/server.js`
- Test: `tests/mcpJournalTools.test.mjs`

**Interfaces:**
- Consumes:
  - `checkJournalAccess` (Task 4);
  - `saveReadingJournalEntry` (Task 3);
  - `addJournalReflection` and `MAX_REFLECTION_LENGTH` (Task 6);
  - `getMcpJobSnapshot` (Task 9);
  - `buildJournalEntryFromJob`, `buildJournalEntryFromPayload` and `JournalMappingError` (Task 10);
  - the schemas and tool helpers (Task 11).
- Produces: `registerJournalTools(server, { env, user, waitUntil })`, which registers `save_reading_to_journal` and `add_reflection_to_journal_entry`.

- [ ] **Step 1: Write the failing test**

Create `tests/mcpJournalTools.test.mjs`:

```js
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { createD1 } from './helpers/d1Sqlite.mjs';
import { connectMcpClient } from './helpers/mcpClient.mjs';
import { createFakeReadingJobs, hangingRunner, readingRunner } from './helpers/fakeReadingJobs.mjs';
import { seedEntry, seedUser } from './helpers/journalFixtures.mjs';
import { SPREADS } from '../src/data/spreads.js';

const OWNER = Object.freeze({
  id: 'user-1', username: 'henry', subscription_tier: 'plus', subscription_status: 'active', auth_provider: 'session'
});
const THREE = { name: SPREADS.threeCard.name, key: 'threeCard' };
const NARRATIVE = '  The Hermit asks for patience ✨\r\n\r\nThen momentum.  ';

const open = [];
after(async () => {
  await Promise.all(open.map((connection) => connection.close()));
});

async function session({ user = OWNER, runReading = readingRunner({ reading: NARRATIVE, requestId: 'req-save-1' }) } = {}) {
  const d1 = await createD1();
  await seedUser(d1, { id: 'user-1', username: 'henry' });
  await seedUser(d1, { id: 'user-2' });
  const jobs = createFakeReadingJobs({ runReading });
  const env = { DB: d1, READING_JOBS: jobs.namespace };
  const connection = await connectMcpClient({ env, user, waitUntil: () => {} });
  open.push(connection);
  const call = (name, args) => connection.client.callTool({ name, arguments: args });
  return { d1, jobs, call };
}

async function drawAndFinish(ctx, extra = {}) {
  const drawn = await ctx.call('draw_tarot_reading', { spreadInfo: THREE, seed: 'rose', ...extra });
  await ctx.jobs.settle();
  return drawn.structuredContent;
}

function entries(d1) {
  return d1.rows('SELECT * FROM journal_entries ORDER BY created_at');
}

/** The audited payload for a drawn reading: labels plus catalog metadata. */
function payloadFor(drawn, overrides = {}) {
  return {
    spread: drawn.spreadInfo.name,
    spreadKey: drawn.spreadInfo.key,
    cards: drawn.cardsInfo.map(({ position, card, orientation, number, suit, rankValue }) => ({
      position,
      name: card,
      orientation,
      ...(number !== null ? { number } : { suit, rankValue })
    })),
    personalReading: NARRATIVE,
    requestId: 'req-save-1',
    sessionSeed: drawn.seed,
    deckId: drawn.deckStyle,
    ...overrides
  };
}

describe('save_reading_to_journal', () => {
  it('saves a finished reading from its job, verbatim, under the signed-in user', async () => {
    const ctx = await session();
    const drawn = await drawAndFinish(ctx);

    const saved = await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken, context: 'self' });

    assert.equal(saved.isError, undefined);
    assert.equal(saved.structuredContent.outcome, 'saved');
    const [row] = entries(ctx.d1);
    assert.equal(row.id, saved.structuredContent.entry.id);
    assert.equal(row.user_id, 'user-1');
    assert.equal(row.narrative, NARRATIVE);
    assert.equal(row.request_id, 'req-save-1');
    assert.equal(row.idempotency_key, 'reading:req-save-1');
    assert.equal(row.session_seed, drawn.seed);
    assert.equal(row.context, 'self');
    assert.equal(row.spread_key, 'threeCard');
    const cards = JSON.parse(row.cards_json);
    assert.deepEqual(cards.map((card) => [card.position, card.orientation]), drawn.cardsInfo.map((card) => [card.position, card.orientation]));
    assert.ok(cards.every((card) => typeof card.name === 'string' && !('meaning' in card) && !('card' in card)));
  });

  it('answers already_saved when the same job is saved again', async () => {
    const ctx = await session();
    const drawn = await drawAndFinish(ctx);
    const first = await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken });
    const second = await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken });

    assert.equal(second.structuredContent.outcome, 'already_saved');
    assert.equal(second.structuredContent.entry.id, first.structuredContent.entry.id);
    assert.equal(entries(ctx.d1).length, 1);
  });

  it('keeps one row when two saves of one job race', async () => {
    const ctx = await session();
    const drawn = await drawAndFinish(ctx);
    const [a, b] = await Promise.all([
      ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken }),
      ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken })
    ]);
    assert.deepEqual([a.structuredContent.outcome, b.structuredContent.outcome].sort(), ['already_saved', 'saved']);
    assert.equal(entries(ctx.d1).length, 1);
  });

  it('recognises a payload save of a reading already saved from its job', async () => {
    const ctx = await session();
    const drawn = await drawAndFinish(ctx);
    const fromJob = await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken });
    const fromPayload = await ctx.call('save_reading_to_journal', payloadFor(drawn));

    assert.equal(fromPayload.structuredContent.outcome, 'already_saved');
    assert.equal(fromPayload.structuredContent.entry.id, fromJob.structuredContent.entry.id);
    assert.equal(entries(ctx.d1).length, 1);
  });

  it('refuses a payload whose request ID belongs to a different reading', async () => {
    const ctx = await session();
    const drawn = await drawAndFinish(ctx);
    await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken });
    const other = payloadFor(drawn);
    other.cards[0] = { ...other.cards[0], orientation: other.cards[0].orientation === 'Upright' ? 'Reversed' : 'Upright' };

    const result = await ctx.call('save_reading_to_journal', other);

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /different reading under this request ID/);
    assert.equal(entries(ctx.d1).length, 1);
  });

  it('refuses a job reference mixed with reading fields', async () => {
    const ctx = await session();
    const drawn = await drawAndFinish(ctx);
    const result = await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken, spread: 'x' });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /not both \(also sent: spread\)/);
    assert.equal(entries(ctx.d1).length, 0);
  });

  it('refuses a reading that has not finished', async () => {
    const ctx = await session({ runReading: hangingRunner() });
    const drawn = (await ctx.call('draw_tarot_reading', { spreadInfo: THREE })).structuredContent;
    const result = await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /^Not saved: the reading has not finished/);
  });

  it('refuses a crisis safety response', async () => {
    const ctx = await session({ runReading: readingRunner({ reading: 'Please reach out…', provider: 'safety-gate', gateReason: 'crisis_gate' }) });
    const drawn = await drawAndFinish(ctx);
    const result = await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /safety message, not a reading/);
    assert.equal(entries(ctx.d1).length, 0);
  });

  it('points to payload mode when the job has expired', async () => {
    const ctx = await session();
    const drawn = await drawAndFinish(ctx);
    ctx.jobs.instances.get(drawn.jobId).object.job.expiresAt = Date.now() - 1;

    const result = await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken });

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /job has expired\. Save it with the reading fields instead/);
    const fallback = await ctx.call('save_reading_to_journal', payloadFor(drawn));
    assert.equal(fallback.structuredContent.outcome, 'saved');
  });

  it('refuses accounts below Plus', async () => {
    const ctx = await session({ user: { ...OWNER, subscription_tier: 'free', subscription_status: 'inactive' } });
    const drawn = await drawAndFinish(ctx);
    const result = await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /^Not saved: Cloud journal sync requires an active Plus or Pro subscription/);
  });
});

describe('add_reflection_to_journal_entry', () => {
  async function savedReading(ctx, extra) {
    const drawn = await drawAndFinish(ctx, extra);
    const saved = await ctx.call('save_reading_to_journal', { jobId: drawn.jobId, jobToken: drawn.jobToken });
    return { drawn, entryId: saved.structuredContent.entry.id };
  }

  it('adds a card note by the label the reading showed, and a whole-reading note', async () => {
    const ctx = await session();
    const { drawn, entryId } = await savedReading(ctx, { deckStyle: 'thoth-a1' });
    const label = drawn.cardsInfo[1].card;

    const onCard = await ctx.call('add_reflection_to_journal_entry', { entryId, text: 'this one is me', scope: 'card', card: label });
    const onReading = await ctx.call('add_reflection_to_journal_entry', { entryId, text: 'gentle overall', scope: 'reading' });

    assert.equal(onCard.structuredContent.outcome, 'added');
    assert.equal(onCard.structuredContent.key, '1');
    assert.equal(onCard.structuredContent.target.cardIndex, 1);
    assert.equal(onReading.structuredContent.key, 'Overall');
    const stored = JSON.parse(ctx.d1.rows('SELECT reflections_json FROM journal_entries')[0].reflections_json);
    assert.deepEqual(stored, { 1: 'this one is me', Overall: 'gentle overall' });
  });

  it('returns reusable Thoth labels for both court cards, including a positioned retry', async () => {
    const ctx = await session();
    await seedEntry(ctx.d1, {
      id: 'thoth-entry', deckId: 'thoth-a1', cards: [
        { position: 'Past', name: 'Knight of Wands', suit: 'Wands', rank: 'Knight', rankValue: 12, orientation: 'Upright' },
        { position: 'Present', name: 'King of Wands', suit: 'Wands', rank: 'King', rankValue: 14, orientation: 'Upright' }
      ]
    });
    const prince = await ctx.call('add_reflection_to_journal_entry', {
      entryId: 'thoth-entry', text: 'Prince note', scope: 'card', card: 'Prince of Wands', position: 'Past'
    });
    const knight = await ctx.call('add_reflection_to_journal_entry', {
      entryId: 'thoth-entry', text: 'Knight note', scope: 'card', card: 'Knight of Wands', position: 'Present'
    });
    assert.equal(prince.structuredContent.key, '0');
    assert.equal(knight.structuredContent.key, '1');
    assert.equal(prince.structuredContent.target.card, 'Prince of Wands');
    assert.equal(knight.structuredContent.target.card, 'Knight of Wands');

    const princeRetry = await ctx.call('add_reflection_to_journal_entry', {
      entryId: 'thoth-entry', text: 'Prince note', scope: 'card',
      card: prince.structuredContent.target.card, position: prince.structuredContent.target.position
    });
    const knightRetry = await ctx.call('add_reflection_to_journal_entry', {
      entryId: 'thoth-entry', text: 'Knight note', scope: 'card', card: knight.structuredContent.target.card
    });
    assert.equal(princeRetry.structuredContent.outcome, 'already_present');
    assert.equal(knightRetry.structuredContent.outcome, 'already_present');
    assert.equal(princeRetry.structuredContent.key, '0');
    assert.equal(knightRetry.structuredContent.key, '1');
    const [row] = ctx.d1.rows('SELECT cards_json, reflections_json FROM journal_entries WHERE id = ?', ['thoth-entry']);
    assert.deepEqual(JSON.parse(row.cards_json).map((card) => card.name), ['Knight of Wands', 'King of Wands']);
    assert.deepEqual(JSON.parse(row.reflections_json), { 0: 'Prince note', 1: 'Knight note' });
  });

  it('treats a repeated note as already present', async () => {
    const ctx = await session();
    const { entryId } = await savedReading(ctx);
    await ctx.call('add_reflection_to_journal_entry', { entryId, text: 'same words', scope: 'reading' });
    const again = await ctx.call('add_reflection_to_journal_entry', { entryId, text: 'same words', scope: 'reading' });

    assert.equal(again.structuredContent.outcome, 'already_present');
    assert.match(again.content[0].text, /already attached/);
  });

  it("answers not found for another user's entry and for a deleted entry, recreating nothing", async () => {
    const ctx = await session();
    await seedEntry(ctx.d1, { id: 'entry-other', userId: 'user-2' });
    const { entryId } = await savedReading(ctx);
    ctx.d1.rows('DELETE FROM journal_entries WHERE id = ?', [entryId]);

    const foreign = await ctx.call('add_reflection_to_journal_entry', { entryId: 'entry-other', text: 'note', scope: 'reading' });
    const deleted = await ctx.call('add_reflection_to_journal_entry', { entryId, text: 'note', scope: 'reading' });

    for (const result of [foreign, deleted]) {
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /no saved entry with that id/);
    }
    assert.equal(ctx.d1.rows('SELECT COUNT(*) AS n FROM journal_entries WHERE user_id = ?', ['user-1'])[0].n, 0);
  });

  it('lists the entry cards when the card is not in the reading', async () => {
    const ctx = await session();
    const { entryId } = await savedReading(ctx);
    const result = await ctx.call('add_reflection_to_journal_entry', { entryId, text: 'note', scope: 'card', card: 'The Unicorn' });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /The Unicorn is not in this entry\. Cards in this entry:/);
  });

  it('requires a card name for a card note', async () => {
    const ctx = await session();
    const { entryId } = await savedReading(ctx);
    const result = await ctx.call('add_reflection_to_journal_entry', { entryId, text: 'note', scope: 'card' });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /name the card/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/mcpJournalTools.test.mjs`
Expected: FAIL. The calls to `save_reading_to_journal` return "Tool save_reading_to_journal not found".

- [ ] **Step 3: Write the journal tools**

Create `functions/lib/mcp/tools/journal.js`:

```js
/**
 * Journal tools (spec §6.4–6.5): save_reading_to_journal and
 * add_reflection_to_journal_entry. Both write only on an explicit request,
 * and both are idempotent, so a retry after an unclear failure is safe.
 */
import * as z from 'zod';

import { checkJournalAccess } from '../../journalAccess.js';
import { saveReadingJournalEntry } from '../../journalEntries.js';
import { addJournalReflection, MAX_REFLECTION_LENGTH } from '../../journalReflections.js';
import { getMcpJobSnapshot } from '../../readingJobs.js';
import { buildJournalEntryFromJob, buildJournalEntryFromPayload, JournalMappingError } from '../journalMapping.js';
import { anyOrientationSchema, deckStyleSchema, journalContextSchema, spreadKeySchema } from '../schemas.js';
import { WRITE, fail, ok, toolMeta } from './common.js';

const PAYLOAD_FIELDS = Object.freeze([
  'spread', 'spreadKey', 'question', 'cards', 'personalReading', 'themes',
  'provider', 'sessionSeed', 'requestId', 'deckId', 'userPreferences'
]);

const journalCardInput = z.object({
  position: z.string().trim().min(1),
  name: z.string().trim().min(1),
  orientation: anyOrientationSchema,
  number: z.number().int().optional(),
  suit: z.string().optional(),
  rank: z.string().optional(),
  rankValue: z.number().int().optional()
}).strict();

const saveInput = z.object({
  jobId: z.string().min(1).optional(),
  jobToken: z.string().min(1).optional(),
  context: journalContextSchema.optional(),
  spread: z.string().trim().min(1).optional(),
  spreadKey: spreadKeySchema.optional(),
  question: z.string().optional(),
  cards: z.array(journalCardInput).min(1).optional(),
  personalReading: z.string().optional(),
  themes: z.record(z.string(), z.unknown()).nullable().optional(),
  provider: z.string().optional(),
  sessionSeed: z.string().optional(),
  requestId: z.string().optional(),
  deckId: deckStyleSchema.optional(),
  userPreferences: z.record(z.string(), z.unknown()).nullable().optional()
}).strict();

const saveOutput = z.object({
  outcome: z.enum(['saved', 'already_saved']),
  entry: z.object({ id: z.string(), ts: z.number() }),
  deduplicated: z.boolean(),
  seedShared: z.boolean().optional()
});

const reflectInput = z.object({
  entryId: z.string().min(1),
  text: z.string().min(1).max(MAX_REFLECTION_LENGTH),
  scope: z.enum(['reading', 'card']),
  card: z.string().trim().min(1).optional(),
  position: z.string().trim().min(1).optional()
}).strict();

const reflectOutput = z.object({
  outcome: z.enum(['added', 'already_present']),
  entryId: z.string(),
  key: z.string(),
  target: z.object({
    scope: z.enum(['reading', 'card']),
    // Reusable deck label from addJournalReflection, not the stored canonical name.
    card: z.string().nullable().optional(),
    position: z.string().nullable().optional(),
    cardIndex: z.number().int().optional()
  }),
  text: z.string()
});

const EXPIRED_JOB =
  "Not saved: this reading's job has expired. Save it with the reading fields instead: spread, spreadKey, cards (name, position, orientation, and number or suit and rankValue, exactly as the reading returned them), personalReading (the complete narrative) and requestId.";

async function entryFromJob({ env, user, input }) {
  if (!input.jobId || !input.jobToken) {
    return { failure: fail('Not saved: send both jobId and jobToken from the reading.') };
  }
  const extras = PAYLOAD_FIELDS.filter((field) => input[field] !== undefined);
  if (extras.length) {
    return {
      failure: fail(`Not saved: send either jobId and jobToken, or the reading fields, not both (also sent: ${extras.join(', ')}).`)
    };
  }
  const job = await getMcpJobSnapshot({ env, jobId: input.jobId, jobToken: input.jobToken, userId: user.id });
  if (!job.ok) {
    if (job.status === 410) return { failure: fail(EXPIRED_JOB) };
    if (job.status === 404) return { failure: fail('Not saved: reading job not found.') };
    return { failure: fail(`Not saved: ${job.error || 'the reading service is unavailable.'}`) };
  }
  return { entry: buildJournalEntryFromJob(job.data, { context: input.context }) };
}

/**
 * @param {McpServer} server
 * @param {object} deps
 * @param {object} deps.env - Worker bindings (DB, READING_JOBS)
 * @param {object} deps.user - The resolved Tableu user
 * @param {Function} [deps.waitUntil]
 */
export function registerJournalTools(server, { env, user, waitUntil }) {
  server.registerTool(
    'save_reading_to_journal',
    {
      title: 'Save a reading to the Tableu journal',
      description:
        "Saves a finished Tableu reading to the user's journal. Call only when the user explicitly asks to save, journal, keep or remember the reading, or says yes right after you offer. Send the reading's jobId and jobToken; the server copies the narrative and cards exactly. Only if the job has expired, send the reading fields instead (spread, spreadKey, cards, personalReading, requestId). Retrying once after an unclear failure is safe. Keep the returned entry id for reflections.",
      inputSchema: saveInput,
      outputSchema: saveOutput,
      annotations: WRITE,
      _meta: toolMeta({ invoking: 'Saving to your journal…', invoked: 'Saved to your journal' })
    },
    async (input) => {
      const denied = checkJournalAccess(user);
      if (denied) return fail(`Not saved: ${denied.body.error}`);

      let entry;
      try {
        const usesJob = input.jobId !== undefined || input.jobToken !== undefined;
        if (usesJob) {
          const fromJob = await entryFromJob({ env, user, input });
          if (fromJob.failure) return fromJob.failure;
          entry = fromJob.entry;
        } else {
          entry = buildJournalEntryFromPayload(input);
        }
      } catch (error) {
        if (error instanceof JournalMappingError) return fail(`Not saved: ${error.message}`);
        throw error;
      }

      const result = await saveReadingJournalEntry({ env, user, entry, waitUntil });
      switch (result.outcome) {
        case 'saved':
          return ok(
            { outcome: 'saved', entry: result.entry, deduplicated: false, ...(result.seedShared ? { seedShared: true } : {}) },
            `Saved to the Tableu journal (entry ${result.entry.id}). Keep this entry id for reflections.${
              result.seedShared ? ' Another saved reading already uses this seed, so this entry was stored without it.' : ''
            }`
          );
        case 'already_saved':
          return ok(
            { outcome: 'already_saved', entry: result.entry, deduplicated: true },
            `This reading was already in the Tableu journal (entry ${result.entry.id}); nothing was changed.`
          );
        case 'conflict':
          return fail('Not saved: your journal already holds a different reading under this request ID.');
        case 'not_saved':
          return fail('Not saved: the journal write failed. Retrying once is safe.');
        default:
          return fail('Could not confirm whether the reading was saved. Check the Tableu app before trying again.');
      }
    }
  );

  server.registerTool(
    'add_reflection_to_journal_entry',
    {
      title: 'Add a reflection to a saved reading',
      description:
        "Attaches the user's own words to a reading saved earlier in this conversation. Call only when the user explicitly asks to save, attach or note what they said, or says yes right after you offer. Send their exact words, up to 2,000 characters; never summarize. Use scope \"reading\" for the whole spread, or scope \"card\" with the card name as the reading showed it (add the position when that card appears twice). The returned target.card is that same deck label and can be sent with target.position on a retry. Notes are added, never replaced, and the same note is never added twice, so retrying once after an unclear failure is safe.",
      inputSchema: reflectInput,
      outputSchema: reflectOutput,
      annotations: WRITE,
      _meta: toolMeta({ invoking: 'Adding your reflection…', invoked: 'Reflection added' })
    },
    async (input) => {
      const denied = checkJournalAccess(user);
      if (denied) return fail(`Not added: ${denied.body.error}`);
      if (input.scope === 'card' && !input.card) {
        return fail('Not added: name the card, as the reading showed it, when scope is card.');
      }

      const result = await addJournalReflection({
        env,
        user,
        entryId: input.entryId,
        input: { text: input.text, scope: input.scope, card: input.card, position: input.position }
      });

      if (result.status === 200) {
        const { entryId, key, reflection, alreadyPresent } = result.body;
        // Task 6 returns the deck label, which this tool accepts on retries.
        const target = reflection.scope === 'card'
          ? { scope: 'card', card: reflection.card, position: reflection.position, cardIndex: reflection.cardIndex }
          : { scope: 'reading' };
        return ok(
          { outcome: alreadyPresent ? 'already_present' : 'added', entryId, key, target, text: reflection.text },
          alreadyPresent
            ? 'That note is already attached to this reading; nothing was added.'
            : 'Reflection added to the journal entry.'
        );
      }
      if (result.status === 404) return fail('Not added: no saved entry with that id was found for this account.');
      if (result.status === 409) return fail('Not added: the entry changed while saving. Retrying once is safe.');

      const cards = Array.isArray(result.body?.cards)
        ? ` Cards in this entry: ${result.body.cards.map((card) => `${card.position} — ${card.label || card.name}`).join('; ')}.`
        : '';
      return fail(`Not added: ${result.body?.error || 'invalid reflection.'}${cards}`);
    }
  );
}
```

- [ ] **Step 4: Register the journal tools**

In `functions/lib/mcp/server.js`, add after the `registerReadingTools` import:

```js
import { registerJournalTools } from './tools/journal.js';
```

and after `registerReadingTools(server, { env, user, sleep, now });` add:

```js
  registerJournalTools(server, { env, user, waitUntil });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/mcpJournalTools.test.mjs tests/mcpReadingTools.test.mjs tests/mcpServer.test.mjs`
Expected: PASS for all three files.

- [ ] **Step 6: Commit**

```bash
git add functions/lib/mcp/tools/journal.js functions/lib/mcp/server.js tests/mcpJournalTools.test.mjs
git commit -m "feat: add MCP journal save and reflection tools" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 14: OAuth authorization server, consent page and `/mcp` wiring

**Files:**
- Create: `migrations/0031_add_oauth_registration_counters.sql`
- Create: `functions/lib/mcp/redirectUris.js`
- Create: `functions/lib/mcp/registrationLimit.js`
- Create: `functions/lib/mcp/consent.js`
- Create: `functions/lib/mcp/mcpHandler.js`
- Create: `functions/lib/mcp/oauthProvider.js`
- Create: `tests/helpers/cloudflareWorkersStub.mjs`, `tests/helpers/cloudflareWorkersHooks.mjs`, `tests/helpers/memoryKv.mjs`
- Modify: `src/worker/index.js`, `wrangler.jsonc`
- Test: `tests/mcpOAuth.test.mjs`
- Test: `e2e/mcpOAuthRouting.integration.spec.js` (real browser navigation through Wrangler's asset router)
- Create: `playwright.mcp.config.js` (browser test against an already running local Worker)

**Interfaces:**
- Consumes:
  - the config helpers (Task 11);
  - `createTableuMcpServer` (Tasks 11–13);
  - `loadActiveUserById` (Task 7);
  - `getSessionFromCookie`, `validateSession` and `isSecureRequest` from `functions/lib/auth.js`;
  - `timingSafeEqual` from `functions/lib/crypto.js`;
  - `getHashedClientIdentifier` from `functions/lib/clientId.js`.
- Produces:
  - `isAllowedRedirectUri(uri)`;
  - migration `0031`, an indexed D1 counter keyed by hashed client address and UTC hour;
  - `REGISTRATION_LIMIT_PER_HOUR = 10` and `enforceRegistrationRateLimit(env, request, { now })`, which atomically admits at most ten registrations per address per hour and resolves to a `Response` or null;
  - `CSRF_COOKIE` and `handleAuthorize(request, env)`;
  - `mcpApiHandler`, of the form `{ fetch(request, env, ctx) }`;
  - `OAUTH_PATHS`, `isMcpOrOAuthPath(pathname)`, `registrationCallback`, `buildOAuthProviderOptions(env)`, `getOAuthProvider(env)` and `handleMcpOrOAuthRequest(request, env, ctx)`.

- [ ] **Step 1: Write the Node test helpers**

`@cloudflare/workers-oauth-provider` imports `cloudflare:workers`, which exists only in the Workers runtime. The tests resolve it to a stub through a Node module hook (`module.register`, available in Node 20.6 and later).

Create `tests/helpers/cloudflareWorkersStub.mjs`:

```js
/** Minimal stand-in for the Workers runtime module `cloudflare:workers` (Node tests only). */
export class WorkerEntrypoint {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
}

export class DurableObject {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
}
```

Create `tests/helpers/cloudflareWorkersHooks.mjs`:

```js
/** Node module hook: resolve `cloudflare:workers` to the local stub. */
const STUB_URL = new URL('./cloudflareWorkersStub.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'cloudflare:workers') {
    return { url: STUB_URL, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
```

Create `tests/helpers/memoryKv.mjs`:

```js
/** In-memory KV namespace that records put options (for expiry assertions). */
export class MemoryKV {
  constructor() {
    this.store = new Map();
    this.puts = [];
  }

  async get(key, options) {
    if (!this.store.has(key)) return null;
    const value = this.store.get(key);
    const type = typeof options === 'string' ? options : options?.type;
    return type === 'json' ? JSON.parse(value) : value;
  }

  async put(key, value, options = {}) {
    this.puts.push({ key, options });
    this.store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  async delete(key) {
    this.store.delete(key);
  }

  async list({ prefix = '', limit = 1000, cursor } = {}) {
    const names = [...this.store.keys()].filter((key) => key.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) : 0;
    const page = names.slice(start, start + limit);
    const next = start + page.length;
    return {
      keys: page.map((name) => ({ name })),
      list_complete: next >= names.length,
      cursor: next >= names.length ? undefined : String(next)
    };
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/mcpOAuth.test.mjs`:

```js
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { describe, it } from 'node:test';

// @cloudflare/workers-oauth-provider imports `cloudflare:workers`; point it
// at the stub before anything imports the provider.
register('./helpers/cloudflareWorkersHooks.mjs', import.meta.url);

const { createD1 } = await import('./helpers/d1Sqlite.mjs');
const { seedSession, seedUser } = await import('./helpers/journalFixtures.mjs');
const { MemoryKV } = await import('./helpers/memoryKv.mjs');
const { getOAuthApi } = await import('@cloudflare/workers-oauth-provider');
const { buildOAuthProviderOptions, handleMcpOrOAuthRequest, isMcpOrOAuthPath } = await import('../functions/lib/mcp/oauthProvider.js');
const { enforceRegistrationRateLimit } = await import('../functions/lib/mcp/registrationLimit.js');

const ORIGIN = 'https://tarot.example';
const RESOURCE = `${ORIGIN}/mcp`;
const REDIRECT = 'https://chatgpt.com/connector_platform_oauth_redirect';

async function setup({ allowed = 'user-1' } = {}) {
  const d1 = await createD1();
  await seedUser(d1, { id: 'user-1', username: 'henry' });
  await seedSession(d1, { id: 'session-1', userId: 'user-1' });
  await seedUser(d1, { id: 'user-2', username: 'guest' });
  await seedSession(d1, { id: 'session-2', userId: 'user-2' });
  const env = {
    DB: d1,
    OAUTH_KV: new MemoryKV(),
    MCP_RESOURCE_URL: RESOURCE,
    MCP_ALLOWED_USER_IDS: allowed
  };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const call = (path, init = {}) => handleMcpOrOAuthRequest(new Request(`${ORIGIN}${path}`, init), env, ctx);
  return { d1, env, call };
}

async function registerClient(call, { redirectUris = [REDIRECT], ip = '203.0.113.7' } = {}) {
  const response = await call('/oauth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify({
      client_name: 'ChatGPT',
      redirect_uris: redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code']
    })
  });
  return { response, client: response.status === 201 ? await response.json() : null };
}

async function pkce() {
  const verifier = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: Buffer.from(digest).toString('base64url') };
}

function authorizePath(clientId, challenge, overrides = {}) {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT,
    state: 'state-1',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'tableu',
    resource: RESOURCE,
    ...overrides
  });
  return `/oauth/authorize?${query}`;
}

function cookieFrom(response, name) {
  return new RegExp(`${name}=([^;]*)`).exec(response.headers.get('set-cookie') || '')?.[1];
}

async function openConsent(call, path, session = 'session-1') {
  const response = await call(path, { headers: { cookie: `session=${session}` } });
  const html = await response.text();
  return {
    response,
    html,
    csrf: /name="csrf" value="([0-9a-f]+)"/.exec(html)?.[1],
    csrfCookie: cookieFrom(response, 'tableu_oauth_csrf')
  };
}

function postDecision(call, path, { decision, csrf, csrfCookie, session = 'session-1', origin = ORIGIN }) {
  const cookie = [`session=${session}`, csrfCookie !== undefined ? `tableu_oauth_csrf=${csrfCookie}` : null]
    .filter(Boolean)
    .join('; ');
  return call(path, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie, ...(origin ? { origin } : {}) },
    body: new URLSearchParams({ decision, ...(csrf ? { csrf } : {}) }).toString()
  });
}

async function exchangeCode(call, { clientId, code, verifier }) {
  const response = await call('/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: REDIRECT, client_id: clientId, code_verifier: verifier, resource: RESOURCE
    }).toString()
  });
  return response.json();
}

async function linkOwner(call) {
  const { client } = await registerClient(call);
  const { verifier, challenge } = await pkce();
  const path = authorizePath(client.client_id, challenge);
  const consent = await openConsent(call, path);
  const approved = await postDecision(call, path, { decision: 'allow', csrf: consent.csrf, csrfCookie: consent.csrfCookie });
  const location = new URL(approved.headers.get('location'));
  const token = await exchangeCode(call, { clientId: client.client_id, code: location.searchParams.get('code'), verifier });
  return { client, approved, location, token };
}

function mcp(call, token, message = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) {
  return call('/mcp', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(message)
  });
}

describe('OAuth discovery and routing', () => {
  it('serves discovery documents for the pinned resource', async () => {
    const { call } = await setup();
    const resource = await (await call('/.well-known/oauth-protected-resource/mcp')).json();
    assert.equal(resource.resource, RESOURCE);
    assert.deepEqual(resource.scopes_supported, ['tableu']);

    const server = await (await call('/.well-known/oauth-authorization-server')).json();
    assert.equal(server.registration_endpoint, `${ORIGIN}/oauth/register`);
    assert.ok(server.code_challenge_methods_supported.includes('S256'));
  });

  it('routes only MCP and OAuth paths to the provider', () => {
    for (const path of ['/mcp', '/mcp/x', '/oauth/token', '/oauth/authorize', '/.well-known/oauth-authorization-server', '/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
      assert.equal(isMcpOrOAuthPath(path), true, path);
    }
    for (const path of ['/mcpx', '/api/journal', '/', '/oauthx', '/.well-known/security.txt']) {
      assert.equal(isMcpOrOAuthPath(path), false, path);
    }
  });

  it('answers 404 when OAUTH_KV is not bound', async () => {
    const response = await handleMcpOrOAuthRequest(new Request(`${ORIGIN}/mcp`, { method: 'POST' }), { MCP_RESOURCE_URL: RESOURCE }, {});
    assert.equal(response.status, 404);
  });
});

describe('linking the owner', () => {
  it('links the allowlisted owner and serves the tools with the token', async () => {
    const { call } = await setup();
    const { approved, location, token } = await linkOwner(call);

    assert.equal(approved.status, 302);
    assert.equal(`${location.origin}${location.pathname}`, REDIRECT);
    assert.equal(location.searchParams.get('state'), 'state-1');
    assert.equal(location.searchParams.get('iss'), ORIGIN);
    assert.equal(token.scope, 'tableu');

    const listed = await mcp(call, token.access_token);
    assert.equal(listed.status, 200);
    const names = (await listed.json()).result.tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, [
      'add_reflection_to_journal_entry', 'cancel_tarot_reading', 'draw_tarot_reading', 'get_profile',
      'get_tarot_reading_status', 'save_reading_to_journal', 'start_tarot_reading', 'wait_for_tarot_reading'
    ]);

    const profile = await mcp(call, token.access_token, {
      jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_profile', arguments: {} }
    });
    assert.equal((await profile.json()).result.structuredContent.id, 'user-1');
  });

  it('asks a signed-out visitor to sign in first', async () => {
    const { call } = await setup();
    const { client } = await registerClient(call);
    const { challenge } = await pkce();
    const response = await call(authorizePath(client.client_id, challenge));

    assert.equal(response.status, 200);
    assert.match(await response.text(), /Sign in to Tableu to continue/);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });

  it('refuses an account that is not allowlisted, showing its id', async () => {
    const { call } = await setup();
    const { client } = await registerClient(call);
    const { challenge } = await pkce();
    const { response, html } = await openConsent(call, authorizePath(client.client_id, challenge), 'session-2');

    assert.equal(response.status, 403);
    assert.match(html, /<code>user-2<\/code>/);
    assert.doesNotMatch(html, /name="decision"/);
  });

  it('refuses everyone when the allowlist is empty', async () => {
    const { call } = await setup({ allowed: '' });
    const { client } = await registerClient(call);
    const { challenge } = await pkce();
    const { response } = await openConsent(call, authorizePath(client.client_id, challenge));
    assert.equal(response.status, 403);
  });

  it('refuses a consent POST with a mismatched CSRF token', async () => {
    const { call } = await setup();
    const { client } = await registerClient(call);
    const { challenge } = await pkce();
    const path = authorizePath(client.client_id, challenge);
    const consent = await openConsent(call, path);

    const response = await postDecision(call, path, { decision: 'allow', csrf: '0'.repeat(64), csrfCookie: consent.csrfCookie });

    assert.equal(response.status, 403);
    assert.equal(response.headers.get('location'), null);
  });

  it('treats an expired CSRF cookie as a fresh start', async () => {
    const { call } = await setup();
    const { client } = await registerClient(call);
    const { challenge } = await pkce();
    const path = authorizePath(client.client_id, challenge);
    const consent = await openConsent(call, path);

    const response = await postDecision(call, path, { decision: 'allow', csrf: consent.csrf, csrfCookie: undefined });

    assert.equal(response.status, 403);
    assert.match(await response.text(), /Start linking again/);
    assert.equal(response.headers.get('location'), null);
  });

  it('refuses a consent POST from another origin', async () => {
    const { call } = await setup();
    const { client } = await registerClient(call);
    const { challenge } = await pkce();
    const path = authorizePath(client.client_id, challenge);
    const consent = await openConsent(call, path);

    const response = await postDecision(call, path, {
      decision: 'allow', csrf: consent.csrf, csrfCookie: consent.csrfCookie, origin: 'https://evil.example'
    });

    assert.equal(response.status, 403);
    assert.equal(response.headers.get('location'), null);
  });

  it('redirects a denial to the registered redirect URI only', async () => {
    const { call } = await setup();
    const { client } = await registerClient(call);
    const { challenge } = await pkce();
    const path = authorizePath(client.client_id, challenge);
    const consent = await openConsent(call, path);

    const response = await postDecision(call, path, { decision: 'deny', csrf: consent.csrf, csrfCookie: consent.csrfCookie });

    assert.equal(response.status, 302);
    const location = new URL(response.headers.get('location'));
    assert.equal(`${location.origin}${location.pathname}`, REDIRECT);
    assert.equal(location.searchParams.get('error'), 'access_denied');
    assert.equal(location.searchParams.get('state'), 'state-1');
  });

  it('shows an error page, not a redirect, for an unregistered redirect URI', async () => {
    const { call } = await setup();
    const { client } = await registerClient(call);
    const { challenge } = await pkce();
    const response = await call(
      authorizePath(client.client_id, challenge, { redirect_uri: 'https://evil.example/cb' }),
      { headers: { cookie: 'session=session-1' } }
    );
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('location'), null);
  });
});

describe('/mcp authorization', () => {
  it('answers 401 with a resource-metadata challenge without a token', async () => {
    const { call } = await setup();
    const response = await mcp(call, null);
    assert.equal(response.status, 401);
    assert.match(
      response.headers.get('www-authenticate'),
      /resource_metadata="https:\/\/tarot\.example\/\.well-known\/oauth-protected-resource\/mcp"/
    );
  });

  it('rejects a token that lacks the tableu scope', async () => {
    const { env, call } = await setup();
    const { client } = await registerClient(call);
    const { verifier, challenge } = await pkce();
    const helpers = getOAuthApi(buildOAuthProviderOptions(env), env);
    const authRequest = await helpers.parseAuthRequest(new Request(`${ORIGIN}${authorizePath(client.client_id, challenge)}`));
    const { redirectTo } = await helpers.completeAuthorization({
      request: authRequest, userId: 'user-1', metadata: {}, scope: [], props: { userId: 'user-1' }
    });
    const token = await exchangeCode(call, {
      clientId: client.client_id, code: new URL(redirectTo).searchParams.get('code'), verifier
    });

    const response = await mcp(call, token.access_token);

    assert.equal(response.status, 403);
    assert.match(response.headers.get('www-authenticate'), /error="insufficient_scope"/);
    assert.match(response.headers.get('www-authenticate'), /scope="tableu"/);
  });

  it('stops honouring tokens once the owner leaves the allowlist', async () => {
    const { env, call } = await setup();
    const { token } = await linkOwner(call);
    env.MCP_ALLOWED_USER_IDS = '';

    const response = await mcp(call, token.access_token);

    assert.equal(response.status, 401);
    assert.match(response.headers.get('www-authenticate'), /error="invalid_token"/);
  });

  it('stops honouring tokens for a deactivated account', async () => {
    const { d1, call } = await setup();
    const { token } = await linkOwner(call);
    d1.rows('UPDATE users SET is_active = 0 WHERE id = ?', ['user-1']);

    const response = await mcp(call, token.access_token);
    assert.equal(response.status, 401);
  });

  it('rejects GET on /mcp', async () => {
    const { call } = await setup();
    const { token } = await linkOwner(call);
    const response = await call('/mcp', {
      method: 'GET', headers: { authorization: `Bearer ${token.access_token}`, accept: 'text/event-stream' }
    });
    assert.equal(response.status, 405);
  });
});

describe('client registration', () => {
  it('stores registered clients without an expiry', async () => {
    const { env, call } = await setup();
    const { response } = await registerClient(call);
    assert.equal(response.status, 201);
    const clientPuts = env.OAUTH_KV.puts.filter(({ key }) => key.startsWith('client:'));
    assert.ok(clientPuts.length > 0);
    assert.ok(clientPuts.every(({ options }) => options?.expirationTtl === undefined));
  });

  it('accepts ChatGPT callback and loopback redirect URIs, and rejects others', async () => {
    const { call } = await setup();
    for (const uri of [REDIRECT, 'https://chatgpt.com/connector/oauth/abc_123', 'http://localhost:6274/oauth/callback', 'http://127.0.0.1:8976/callback']) {
      assert.equal((await registerClient(call, { redirectUris: [uri] })).response.status, 201, uri);
    }
    for (const uri of ['https://evil.example/cb', 'https://chatgpt.com.evil.example/connector_platform_oauth_redirect', 'https://chatgpt.com/other']) {
      const { response } = await registerClient(call, { redirectUris: [uri] });
      assert.equal(response.status, 400, uri);
      assert.equal((await response.json()).error, 'invalid_redirect_uri');
    }
  });

  it('atomically admits exactly ten simultaneous registrations per address', async () => {
    const { d1, call } = await setup();
    const attempts = await Promise.all(Array.from({ length: 20 }, () =>
      registerClient(call, { ip: '198.51.100.1' })));
    assert.equal(attempts.filter(({ response }) => response.status === 201).length, 10);
    assert.equal(attempts.filter(({ response }) => response.status === 429).length, 10);
    assert.deepEqual(d1.rows('SELECT attempts FROM oauth_registration_counters'), [{ attempts: 10 }]);
    const other = await registerClient(call, { ip: '198.51.100.2' });
    assert.equal(other.response.status, 201);
  });

  it('opens a new hourly bucket and removes buckets older than the prior hour', async () => {
    const { d1, env } = await setup();
    const request = new Request(`${ORIGIN}/oauth/register`, {
      headers: { 'cf-connecting-ip': '198.51.100.3' }
    });
    const hourStart = 1_800_000_000_000;
    for (let i = 0; i < 10; i += 1) {
      assert.equal(await enforceRegistrationRateLimit(env, request, { now: hourStart }), null);
    }
    const limited = await enforceRegistrationRateLimit(env, request, { now: hourStart + 1 });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
    assert.equal(await enforceRegistrationRateLimit(env, request, { now: hourStart + 3_600_000 }), null);
    assert.equal(await enforceRegistrationRateLimit(env, request, { now: hourStart + 7_200_000 }), null);
    assert.deepEqual(d1.rows('SELECT attempts FROM oauth_registration_counters ORDER BY window_start_hour'), [
      { attempts: 1 }, { attempts: 1 }
    ]);
  });

  it('fails closed when D1 is missing or admission fails', async () => {
    const request = new Request(`${ORIGIN}/oauth/register`, {
      headers: { 'cf-connecting-ip': '198.51.100.4' }
    });
    assert.equal((await enforceRegistrationRateLimit({}, request)).status, 503);
    const broken = { DB: { prepare() { throw new Error('D1 unavailable'); }, batch() {} } };
    assert.equal((await enforceRegistrationRateLimit(broken, request)).status, 503);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test tests/mcpOAuth.test.mjs`
Expected: FAIL with `Cannot find module` for `functions/lib/mcp/oauthProvider.js`.

- [ ] **Step 4: Write the redirect-URI policy and the registration limit**

Create `functions/lib/mcp/redirectUris.js`:

```js
/**
 * Redirect URIs a dynamically registered OAuth client may use (spec §5.1,
 * D13): ChatGPT's two documented callbacks, plus loopback for local tools
 * such as MCP Inspector and Codex.
 */
const CHATGPT_ORIGIN = 'https://chatgpt.com';
const CHATGPT_STABLE_CALLBACK = '/connector_platform_oauth_redirect';
const CHATGPT_CALLBACK_PATTERN = /^\/connector\/oauth\/[A-Za-z0-9_-]+$/;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

export function isAllowedRedirectUri(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  if (url.origin === CHATGPT_ORIGIN) {
    return url.pathname === CHATGPT_STABLE_CALLBACK || CHATGPT_CALLBACK_PATTERN.test(url.pathname);
  }
  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
}
```

Create `migrations/0031_add_oauth_registration_counters.sql` before running the OAuth tests. Task 1's `createD1()` applies every numbered migration, so these tests exercise the real schema:

```sql
-- Migration: 0031_add_oauth_registration_counters
-- Atomic DCR admission, keyed by privacy-preserving address hash and UTC hour.
CREATE TABLE IF NOT EXISTS oauth_registration_counters (
  client_key TEXT NOT NULL,
  window_start_hour INTEGER NOT NULL,
  attempts INTEGER NOT NULL CHECK (attempts BETWEEN 1 AND 10),
  PRIMARY KEY (client_key, window_start_hour)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_oauth_registration_counters_hour
  ON oauth_registration_counters(window_start_hour);
```

Create `functions/lib/mcp/registrationLimit.js`:

```js
/**
 * Per-address rate limit for dynamic client registration. Registered clients
 * never expire (D13), so admission must be atomic across Worker isolates.
 * Workers KV is unsuitable for a read/modify/write counter and rejects rapid
 * writes to the same key. D1 serializes the conditional UPSERT.
 */
import { getHashedClientIdentifier } from '../clientId.js';

export const REGISTRATION_LIMIT_PER_HOUR = 10;
const WINDOW_MS = 3_600_000;

function unavailable() {
  return new Response(JSON.stringify({
    error: 'temporarily_unavailable',
    error_description: 'Client registration is temporarily unavailable.'
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': '60' }
  });
}

/**
 * @returns {Promise<Response|null>} A 429 response, or null when allowed
 */
export async function enforceRegistrationRateLimit(env, request, { now = Date.now() } = {}) {
  const db = env?.DB;
  if (!db?.prepare || !db?.batch) return unavailable();
  try {
    const windowStartHour = Math.floor(now / WINDOW_MS);
    const clientKey = await getHashedClientIdentifier(request);
    // D1 batches execute sequentially in one transaction. Keep the current
    // and prior hour; remove older buckets without a separate scheduled job.
    const [, admission] = await db.batch([
      db.prepare('DELETE FROM oauth_registration_counters WHERE window_start_hour < ?')
        .bind(windowStartHour - 1),
      db.prepare(`
        INSERT INTO oauth_registration_counters (client_key, window_start_hour, attempts)
        VALUES (?, ?, 1)
        ON CONFLICT (client_key, window_start_hour) DO UPDATE
          SET attempts = attempts + 1
          WHERE attempts < ?
        RETURNING attempts
      `).bind(clientKey, windowStartHour, REGISTRATION_LIMIT_PER_HOUR)
    ]);
    if (!admission?.success || !Array.isArray(admission.results)) return unavailable();
    if (admission.results.length === 1) return null;
    if (admission.results.length !== 0) return unavailable();
    const retryAfter = Math.max(1, Math.ceil(((windowStartHour + 1) * WINDOW_MS - now) / 1000));
    return new Response(
      JSON.stringify({
        error: 'too_many_requests',
        error_description: 'Too many client registrations from this address. Try again later.'
      }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': String(retryAfter) } }
    );
  } catch {
    // Missing migration, D1 outage, or malformed response: never admit DCR.
    return unavailable();
  }
}
```

- [ ] **Step 5: Write the consent page**

Create `functions/lib/mcp/consent.js`:

```js
/**
 * /oauth/authorize: Tableu's consent page for linking ChatGPT (spec §5.2).
 *
 * The page is server-rendered with no scripts and reads the normal Tableu
 * session cookie. Only allowlisted accounts (MCP_ALLOWED_USER_IDS) can
 * approve; a refused account is shown its own id so the owner can configure
 * the allowlist. The approve/deny POST is CSRF-protected (a double-submit
 * cookie plus an Origin check). A denial redirects only to a redirect URI
 * the OAuth library has already validated.
 */
import { getSessionFromCookie, isSecureRequest, validateSession } from '../auth.js';
import { timingSafeEqual } from '../crypto.js';
import { isAllowedMcpUser, MCP_SCOPE } from './config.js';

export const CSRF_COOKIE = 'tableu_oauth_csrf';
const CSRF_MAX_AGE_SECONDS = 600;

const PAGE_HEADERS = Object.freeze({
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  // form-action is deliberately omitted: Chromium applies it to the redirect
  // that follows the form POST, which would block the hop back to the client.
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'"
});

const STYLES = [
  'body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#14111c;color:#efe9f7}',
  'main{max-width:34rem;margin:3rem auto;padding:0 1.25rem}',
  'h1{font-size:1.4rem}',
  'code{background:#2a2438;padding:.1rem .35rem;border-radius:.25rem}',
  '.actions{display:flex;gap:.75rem;margin-top:1.5rem}',
  'button,.button{font:inherit;padding:.6rem 1.2rem;border-radius:.5rem;border:1px solid #8f7ab8;background:#2a2438;color:#efe9f7;text-decoration:none;cursor:pointer}',
  'button[value=allow]{background:#8f7ab8;color:#14111c}'
].join('');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function page(status, title, body, extraHeaders = {}) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} · Tableu</title><style>${STYLES}</style></head><body><main><h1>${escapeHtml(title)}</h1>${body}</main></body></html>`;
  return new Response(html, { status, headers: { ...PAGE_HEADERS, ...extraHeaders } });
}

function readCookie(request, name) {
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
}

function csrfCookie(request, value, maxAge) {
  const parts = [`${CSRF_COOKIE}=${value}`, 'HttpOnly', 'SameSite=Strict', 'Path=/oauth/authorize', `Max-Age=${maxAge}`];
  if (isSecureRequest(request)) parts.push('Secure');
  return parts.join('; ');
}

function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function redirect(location, extraHeaders = {}) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, 'Cache-Control': 'no-store', ...extraHeaders }
  });
}

function redirectWithError(redirectUri, { error, description, state, issuer }, extraHeaders = {}) {
  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  if (description) url.searchParams.set('error_description', description);
  if (state) url.searchParams.set('state', state);
  if (issuer) url.searchParams.set('iss', issuer);
  return redirect(url.href, extraHeaders);
}

async function signedInUser(request, env) {
  const token = getSessionFromCookie(request.headers.get('Cookie'));
  if (!token || !env?.DB) return null;
  return validateSession(env.DB, token);
}

function accountLabel(user) {
  return user.username || user.email || user.id;
}

function signInPage(request) {
  const origin = new URL(request.url).origin;
  return page(200, 'Sign in to Tableu to continue', `
<p>ChatGPT wants to connect to your Tableu account, but you're not signed in to Tableu in this browser.</p>
<p><a class="button" href="${escapeHtml(origin)}/" target="_blank" rel="noopener">Open Tableu and sign in</a></p>
<p>Then come back to this tab and continue.</p>
<p><a class="button" href="${escapeHtml(request.url)}">Continue</a></p>`);
}

function notAllowedPage(user) {
  return page(403, "This account can't connect to ChatGPT", `
<p>You're signed in as <strong>@${escapeHtml(accountLabel(user))}</strong>. This private integration only links allowlisted Tableu accounts.</p>
<p>Account ID: <code>${escapeHtml(user.id)}</code></p>
<p>If this is your account, add that ID to the <code>MCP_ALLOWED_USER_IDS</code> secret and start linking again from ChatGPT.</p>`);
}

function consentPage(request, clientName, user) {
  const csrf = randomToken();
  const action = new URL(request.url);
  return page(200, 'Connect ChatGPT to Tableu', `
<p><strong>${escapeHtml(clientName)}</strong> is asking to use your Tableu account, <strong>@${escapeHtml(accountLabel(user))}</strong>.</p>
<p>If you allow it, it can:</p>
<ul>
<li>draw tarot readings for you (each one counts against your reading quota),</li>
<li>save readings to your Tableu journal,</li>
<li>add your reflections to readings it saved.</li>
</ul>
<p>It can't list, search or delete your journal entries.</p>
<form method="post" action="${escapeHtml(action.pathname + action.search)}">
<input type="hidden" name="csrf" value="${csrf}">
<div class="actions"><button type="submit" name="decision" value="allow">Allow</button><button type="submit" name="decision" value="deny">Deny</button></div>
</form>`, { 'Set-Cookie': csrfCookie(request, csrf, CSRF_MAX_AGE_SECONDS) });
}

function refusedPostPage(title) {
  return page(403, title, '<p>For your security, the approval page is only valid for a few minutes. Start linking again from ChatGPT.</p>');
}

/**
 * GET/POST /oauth/authorize. Served through the OAuth provider's
 * defaultHandler, so env.OAUTH_PROVIDER holds the library helpers.
 */
export async function handleAuthorize(request, env) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } });
  }

  let authRequest;
  try {
    authRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  } catch (error) {
    // The library attaches redirectUri only after validating it against the
    // client; such errors go back to the client, others stay on this page.
    if (error?.redirectUri) {
      return redirectWithError(error.redirectUri, {
        error: error.code || 'invalid_request',
        description: error.description,
        state: error.state,
        issuer: error.issuer
      });
    }
    return page(400, "This link can't be used", '<p>The authorization request is incomplete or names an unknown client. Start linking again from ChatGPT.</p>');
  }

  const user = await signedInUser(request, env);
  if (!user) return signInPage(request);
  if (!isAllowedMcpUser(env, user.id)) return notAllowedPage(user);

  if (request.method === 'GET') {
    const client = await env.OAUTH_PROVIDER.lookupClient(authRequest.clientId);
    return consentPage(request, client?.clientName || 'An application', user);
  }

  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    return refusedPostPage('This request was refused');
  }

  const form = await request.formData();
  const submitted = String(form.get('csrf') || '');
  const expected = readCookie(request, CSRF_COOKIE);
  if (!submitted || !expected || !timingSafeEqual(submitted, expected)) {
    return refusedPostPage('This confirmation expired');
  }

  const clearCsrf = { 'Set-Cookie': csrfCookie(request, '', 0) };
  const decision = form.get('decision');
  if (decision === 'deny') {
    return redirectWithError(authRequest.redirectUri, {
      error: 'access_denied',
      description: 'The user declined to connect Tableu.',
      state: authRequest.state,
      issuer: authRequest.issuer
    }, clearCsrf);
  }
  if (decision !== 'allow') {
    return page(400, 'Choose Allow or Deny', '<p>Start linking again from ChatGPT.</p>');
  }

  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: authRequest,
    userId: user.id,
    metadata: { username: user.username || null },
    scope: [MCP_SCOPE],
    props: { userId: user.id }
  });
  return redirect(redirectTo, clearCsrf);
}
```

- [ ] **Step 6: Write the `/mcp` handler**

Create `functions/lib/mcp/mcpHandler.js`:

```js
/**
 * /mcp (spec §5.3). The OAuth library has already validated the token's
 * existence, expiry, resource binding and audience; it does not check scope.
 * This handler enforces the scope, the owner allowlist and an active
 * account, then serves MCP statelessly.
 */
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { loadActiveUserById } from '../auth.js';
import { isAllowedMcpUser, MCP_SCOPE, protectedResourceMetadataUrl } from './config.js';
import { createTableuMcpServer } from './server.js';

function bearerToken(request) {
  const header = request.headers.get('Authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function challenge(env, status, error, description) {
  const parts = [
    `Bearer error="${error}"`,
    `error_description="${description}"`,
    `resource_metadata="${protectedResourceMetadataUrl(env)}"`
  ];
  if (error === 'insufficient_scope') parts.push(`scope="${MCP_SCOPE}"`);
  return new Response(JSON.stringify({ error, error_description: description }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'WWW-Authenticate': parts.join(', ')
    }
  });
}

export const mcpApiHandler = {
  async fetch(request, env, ctx) {
    // Stateless transport: no server-sent event stream, no sessions to delete.
    if (request.method !== 'POST') {
      return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    }

    const token = bearerToken(request);
    const summary = token ? await env.OAUTH_PROVIDER.unwrapToken(token) : null;
    if (!summary) {
      return challenge(env, 401, 'invalid_token', 'The access token is not valid.');
    }
    if (!Array.isArray(summary.scope) || !summary.scope.includes(MCP_SCOPE)) {
      return challenge(env, 403, 'insufficient_scope', `This token lacks the ${MCP_SCOPE} scope.`);
    }

    const userId = ctx?.props?.userId;
    if (!isAllowedMcpUser(env, userId)) {
      return challenge(env, 401, 'invalid_token', 'This account is not allowed to use Tableu from ChatGPT.');
    }
    const user = await loadActiveUserById(env.DB, userId);
    if (!user || user.auth_provider === 'service') {
      return challenge(env, 401, 'invalid_token', 'The linked Tableu account is not available.');
    }

    const server = createTableuMcpServer({
      env,
      user,
      waitUntil: ctx?.waitUntil ? (promise) => ctx.waitUntil(promise) : undefined
    });
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    await server.connect(transport);
    return transport.handleRequest(request);
  }
};
```

- [ ] **Step 7: Write the provider entry point**

Create `functions/lib/mcp/oauthProvider.js`:

```js
/**
 * Entry point for the ChatGPT MCP endpoint and its OAuth 2.1 authorization
 * server (spec §5). The Worker hands exactly these paths here: /mcp,
 * /oauth/*, and the two /.well-known/oauth-* documents.
 */
import { OAuthProvider } from '@cloudflare/workers-oauth-provider';

import { jsonResponse } from '../utils.js';
import { getMcpResourceUrl, MCP_SCOPE } from './config.js';
import { handleAuthorize } from './consent.js';
import { mcpApiHandler } from './mcpHandler.js';
import { isAllowedRedirectUri } from './redirectUris.js';
import { enforceRegistrationRateLimit } from './registrationLimit.js';

export const OAUTH_PATHS = Object.freeze({
  authorize: '/oauth/authorize',
  token: '/oauth/token',
  register: '/oauth/register'
});

export function isMcpOrOAuthPath(pathname) {
  return pathname === '/mcp'
    || pathname.startsWith('/mcp/')
    || pathname.startsWith('/oauth/')
    || pathname === '/.well-known/oauth-authorization-server'
    || pathname === '/.well-known/oauth-protected-resource'
    || pathname.startsWith('/.well-known/oauth-protected-resource/');
}

/** Dynamic client registration accepts only ChatGPT callback and loopback redirect URIs. */
export function registrationCallback({ clientMetadata }) {
  const redirectUris = Array.isArray(clientMetadata?.redirect_uris) ? clientMetadata.redirect_uris : [];
  if (redirectUris.length === 0 || !redirectUris.every(isAllowedRedirectUri)) {
    return {
      code: 'invalid_redirect_uri',
      description: 'Only ChatGPT callback and loopback redirect URIs can be registered.',
      status: 400
    };
  }
  return undefined;
}

const defaultHandler = {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === OAUTH_PATHS.authorize) return handleAuthorize(request, env);
    return jsonResponse({ error: 'Not found' }, { status: 404 });
  }
};

export function buildOAuthProviderOptions(env) {
  const resource = getMcpResourceUrl(env);
  return {
    apiRoute: '/mcp',
    apiHandler: mcpApiHandler,
    defaultHandler,
    authorizeEndpoint: OAUTH_PATHS.authorize,
    tokenEndpoint: OAUTH_PATHS.token,
    clientRegistrationEndpoint: OAUTH_PATHS.register,
    scopesSupported: [MCP_SCOPE],
    // ChatGPT registers once per connection and reuses the client, so
    // registered clients must not expire (D13). An explicit undefined
    // replaces the library's 90-day default.
    clientRegistrationTTL: undefined,
    clientRegistrationCallback: registrationCallback,
    // CIMD needs the Worker-wide global_fetch_strictly_public flag (D8).
    clientIdMetadataDocumentEnabled: false,
    resourceMetadata: {
      resource,
      scopes_supported: [MCP_SCOPE],
      resource_name: 'Tableu'
    }
  };
}

const providers = new Map();

/** One provider per resource URL, reused across requests in an isolate. */
export function getOAuthProvider(env) {
  const resource = getMcpResourceUrl(env);
  let provider = providers.get(resource);
  if (!provider) {
    provider = new OAuthProvider(buildOAuthProviderOptions(env));
    providers.set(resource, provider);
  }
  return provider;
}

/**
 * @param {Request} request
 * @param {object} env - Worker bindings; OAUTH_KV is required
 * @param {ExecutionContext} ctx
 */
export async function handleMcpOrOAuthRequest(request, env, ctx) {
  if (!env?.OAUTH_KV) return jsonResponse({ error: 'Not found' }, { status: 404 });

  const { pathname } = new URL(request.url);
  if (pathname === OAUTH_PATHS.register && request.method === 'POST') {
    const limited = await enforceRegistrationRateLimit(env, request);
    if (limited) return limited;
  }

  // The provider writes ctx.props for the API handler, so give it its own
  // context object rather than the runtime's.
  const providerCtx = {
    waitUntil: (promise) => ctx?.waitUntil?.(promise),
    passThroughOnException: () => ctx?.passThroughOnException?.(),
    props: undefined
  };
  return getOAuthProvider(env).fetch(request, env, providerCtx);
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `node --test tests/mcpOAuth.test.mjs`
Expected: PASS, 22 tests.

- [ ] **Step 9: Route the Worker's MCP and OAuth paths to the provider**

In `src/worker/index.js`, add after the `import { handleDebugSentryRoute } from './debugSentryRoute.js';` line:

```js
// ChatGPT MCP endpoint and its OAuth 2.1 authorization server
import { handleMcpOrOAuthRequest, isMcpOrOAuthPath } from '../../functions/lib/mcp/oauthProvider.js';
```

and in the `fetch` handler replace:

```js
      const url = new URL(request.url);
      const pathname = url.pathname;
      const method = request.method;

      // Handle CORS preflight
      if (method === 'OPTIONS') {
        return handleOptions(request);
      }
```

with:

```js
      const url = new URL(request.url);
      const pathname = url.pathname;
      const method = request.method;

      // ChatGPT MCP endpoint and its OAuth authorization server. Checked
      // before the app's CORS handling: the provider answers its own
      // preflights, and these paths must not get the app's permissive
      // Origin echo.
      if (isMcpOrOAuthPath(pathname)) {
        return handleMcpOrOAuthRequest(request, env, ctx);
      }

      // Handle CORS preflight
      if (method === 'OPTIONS') {
        return handleOptions(request);
      }
```

- [ ] **Step 10: Route browser navigations through the Worker and add the bindings**

The current `assets.not_found_handling: "single-page-application"` serves `index.html` for `Sec-Fetch-Mode: navigate` before the Worker on this compatibility date. OAuth consent is a browser navigation, so the Worker must run first for its path. In the existing `assets` block of `wrangler.jsonc`, replace:

```jsonc
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
```

with:

```jsonc
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    // These routes must reach src/worker/index.js even for browser navigation.
    // Preserve the existing /api/* router and /share/* OG-page handler.
    "run_worker_first": [
      "/api/*",
      "/share/*",
      "/mcp",
      "/mcp/*",
      "/oauth/*",
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-protected-resource",
      "/.well-known/oauth-protected-resource/*"
    ]
```

Keep `not_found_handling` and `ASSETS` unchanged so ordinary frontend routes and static files still use the SPA asset handler. The matching paths reach the Worker's existing API/share branches or the new MCP/OAuth branch.

In `wrangler.jsonc`, replace:

```jsonc
    {
      "binding": "METRICS_DB",
      "id": "2510ac5ac91e4a2fac375190a3dfc128",
      "preview_id": "8e820de09f9c459ea0e149bf55644c81"
    }
  ],
```

with:

```jsonc
    {
      "binding": "METRICS_DB",
      "id": "2510ac5ac91e4a2fac375190a3dfc128",
      "preview_id": "8e820de09f9c459ea0e149bf55644c81"
    },
    {
      // OAuth 2.1 clients, grants and tokens for the ChatGPT MCP endpoint
      // (@cloudflare/workers-oauth-provider). Task 18 replaces this id with
      // the namespace created by `npx wrangler kv namespace create OAUTH_KV`.
      "binding": "OAUTH_KV",
      "id": "00000000000000000000000000000000"
    }
  ],
```

and replace `    "GPT_SERVICE_TIER": "plus",` with:

```jsonc
    "GPT_SERVICE_TIER": "plus",
    // Canonical RFC 8707 resource for the ChatGPT MCP endpoint. OAuth grants
    // and tokens are bound to exactly this URL.
    "MCP_RESOURCE_URL": "https://tarot.lakefrontdev.com/mcp",
```

- [ ] **Step 11: Verify the bundle and prepare the real browser routing test**

Run: `npx wrangler deploy --dry-run --outdir .wrangler/dry-run`
Expected: exit code 0, with a `Total Upload` line and `--dry-run: exiting now.` No `Could not resolve` errors, and no mention of `cloudflare:workers` as unresolved; the Workers runtime provides it. This does not deploy anything.

Create `e2e/mcpOAuthRouting.integration.spec.js`. API-only tests cannot detect the SPA navigation interception, so use `page.goto()` for the OAuth page and discovery document:

```js
import { expect, test } from '@playwright/test';

test('browser navigation reaches OAuth consent and discovery through the Worker', async ({ page, request }) => {
  const metadataResponse = await page.goto('/.well-known/oauth-protected-resource/mcp');
  expect(metadataResponse?.status()).toBe(200);
  expect(metadataResponse?.headers()['content-type']).toContain('application/json');
  const metadata = JSON.parse(await metadataResponse.text());
  expect(metadata.resource).toBe('http://localhost:8787/mcp');

  const registration = await request.post('/oauth/register', {
    data: {
      client_name: 'Routing test',
      redirect_uris: ['http://127.0.0.1:8976/callback'],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code']
    }
  });
  expect(registration.status()).toBe(201);
  const client = await registration.json();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: client.client_id,
    redirect_uri: 'http://127.0.0.1:8976/callback',
    state: 'routing-test',
    code_challenge: 'A'.repeat(43),
    code_challenge_method: 'S256',
    scope: 'tableu',
    resource: metadata.resource
  });
  const consent = await page.goto(`/oauth/authorize?${params}`);
  expect(consent?.status()).toBe(200);
  expect(consent?.headers()['cache-control']).toBe('no-store');
  await expect(page.getByRole('heading', { name: 'Sign in to Tableu to continue' })).toBeVisible();

  const api = await page.goto('/api/no-such-route');
  expect(api?.status()).toBe(404);
  expect(api?.headers()['content-type']).toContain('application/json');
  const home = await page.goto('/');
  expect(home?.status()).toBe(200);
  expect(home?.headers()['content-type']).toContain('text/html');
});
```

Create `playwright.mcp.config.js` so this gate cannot start `npm run dev` with the production resource var or remote AI binding from the repository's general integration config:

```js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/mcpOAuthRouting.integration.spec.js'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://localhost:8787' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
  // No webServer: Task 17 starts Wrangler with the local config and migration.
});
```

Task 14 runs `node --test tests/mcpOAuth.test.mjs` after migration 0031 exists, plus the dry-run bundle check above. Task 17 runs the browser gate after building assets, creating the local Wrangler config with `MCP_RESOURCE_URL=http://localhost:8787/mcp`, applying migration 0031 locally, and starting Wrangler on port 8787. A browser `GET /oauth/authorize` must show the signed-out consent page, not the SPA shell. The test also verifies ordinary `/api/*` navigation stays on the Worker and `/` uses the asset handler.

- [ ] **Step 12: Commit**

```bash
git add migrations/0031_add_oauth_registration_counters.sql functions/lib/mcp/redirectUris.js functions/lib/mcp/registrationLimit.js functions/lib/mcp/consent.js functions/lib/mcp/mcpHandler.js functions/lib/mcp/oauthProvider.js tests/helpers/cloudflareWorkersStub.mjs tests/helpers/cloudflareWorkersHooks.mjs tests/helpers/memoryKv.mjs tests/mcpOAuth.test.mjs e2e/mcpOAuthRouting.integration.spec.js playwright.mcp.config.js src/worker/index.js wrangler.jsonc
git commit -m "feat: serve the Tableu MCP endpoint behind Tableu-issued OAuth 2.1" -m "Consent page with owner allowlist and CSRF protection; scope, allowlist and active-account checks on /mcp; atomic D1 registration limits and browser-first OAuth routing." -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 15: Retire the Node adapter and align the Actions YAML

**Files:**
- Delete: `mcp/tableau-adapter/` (whole directory)
- Modify: `package.json` (three scripts and explicit `js-yaml` devDependency), `package-lock.json`
- Modify: `tarot-journal-actions.yaml`

**Interfaces:** none. This task removes code and updates a contract document.

- [ ] **Step 1: Remove the adapter**

Run:

```bash
git rm -r -q mcp/tableau-adapter
```

In `package.json`, delete these three lines from `scripts`:

```json
    "dev:mcp:tableau-adapter": "npm --prefix mcp/tableau-adapter run dev",
    "mcp:tableau-adapter:start": "npm --prefix mcp/tableau-adapter run start",
    "mcp:tableau-adapter:smoke-backend": "npm --prefix mcp/tableau-adapter run smoke:backend",
```

Check: `grep -rn "tableau-adapter" package.json .github src functions shared tests scripts` prints nothing. Mentions in `docs/` are handled in Task 16.

- [ ] **Step 2: Align `tarot-journal-actions.yaml` with the audited contract**

Make these edits in `tarot-journal-actions.yaml`.

1. Replace all occurrences of `saveJournalEntry` with `saveReadingToJournal`. Replace all occurrences of `addJournalReflection` with `addReflectionToJournalEntry`. Both are case-sensitive; the schema names `SaveJournalEntryRequest` and `AddJournalReflectionRequest` stay as they are.
2. In `info.description`, replace the second paragraph (from `Every write lands in the journal` through `are exposed.`) with:

```yaml
    Every write lands in the journal of the account the bearer token
    authenticates as: a per-user API key (`sk_...`) or a bearer session token.
    The shared GPT service token is refused with 403
    `service_account_journal_forbidden`, because its synthetic account can
    never sign in to the app. The ChatGPT plugin uses the MCP endpoint instead
    (docs/integrations/openai/chatgpt-mcp.md).
```

3. In the reflection operation's `description`, replace:

```yaml
        Omit card fields (or set `scope` to `reading`) for a note about the
        whole reading. By default the note is appended to any reflection
        already on that card; set `mode` to `replace` only when the user asks
        to rewrite it.
```

with:

```yaml
        Omit card fields (or set `scope` to `reading`) for a note about the
        whole reading. Notes are appended, never replaced, and the same note
        is never added twice, so one retry after an unclear failure is safe.
```

4. In the reflection operation's `"400"` description, replace `Blank or over-long text, an unknown `scope`/`mode`, or a card that` with `Blank or over-long text, an unknown `scope`, a `mode` field (reflections are append-only), or a card that`.
5. In the reflection operation, replace `description: Not entitled to the cloud journal, or the entry belongs to another account.` with the following quoted scalar. Backticks are ordinary YAML characters; the surrounding double quotes protect the colon in `code: ...`:

```yaml
          description: "Not entitled to the cloud journal, or authenticated as the shared GPT service account (`code: service_account_journal_forbidden`)."
```
6. Replace `description: No entry with that id.` with `description: No entry with that id for this account. Another account's entry gets the same 404.`
7. In the save operation, replace `description: The account is not entitled to the cloud journal (Plus or Pro required).` with:

```yaml
          description: "The account is not entitled to the cloud journal (Plus or Pro required), or it is the shared GPT service account (`code: service_account_journal_forbidden`)."
```
8. Replace the `bearerAuth` description:

```yaml
      description: >
        Bearer token. Either a per-user API key (`sk_...`, Pro-only) or the
        configured service token (`GPT_SERVICE_TOKEN`), which authenticates as a
        Plus-or-higher service account. Send as `Authorization: Bearer <token>`.
```

with:

```yaml
      description: >
        Bearer token: a per-user API key (`sk_...`, Pro-only) or a session
        token. The shared service token (`GPT_SERVICE_TOKEN`) is refused by
        the journal routes. Send as `Authorization: Bearer <token>`.
```

9. In `AddJournalReflectionRequest`, replace:

```yaml
          maxLength: 500
          description: The reflection, in the user's words. At most 500 characters, like the app's own reflection fields.
```

with:

```yaml
          maxLength: 2000
          description: The reflection, in the user's words. At most 2,000 characters. Outer whitespace is trimmed and Windows line endings become newlines.
```

and delete the whole `mode:` property (the ten lines from `        mode:` through `          default: append`).
10. In `AddJournalReflectionResponse`, replace:

```yaml
      required:
        - success
        - entry
        - reflection
        - reflections
      additionalProperties: true
      properties:
        success:
          type: boolean
        entry:
          type: object
          properties:
            id:
              type: string
```

with:

```yaml
      required:
        - success
        - entryId
        - key
        - reflection
        - reflections
      additionalProperties: true
      properties:
        success:
          type: boolean
        entryId:
          type: string
          description: The entry the reflection was added to.
        key:
          type: string
          description: Storage key, the card index as a string or "Overall".
        alreadyPresent:
          type: boolean
          description: True when this exact note was already on the target; nothing was written.
```

11. In `ReflectionErrorResponse.properties.cards.items.properties`, after the `name:` property (`type: string`), add:

```yaml
              label:
                type: string
                description: The card's name in the entry's deck, when that deck is not RWS.
```

- [ ] **Step 3: Validate the YAML**

Make the parser an explicit development dependency, then parse and check the contract:

```bash
npm install --save-dev js-yaml@^4.1.1
node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

const source = readFileSync('tarot-journal-actions.yaml', 'utf8');
const document = load(source); // Throws on malformed YAML, including an unquoted colon.
assert.equal(typeof document.openapi, 'string');
const operations = Object.values(document.paths).flatMap((path) => Object.values(path));
for (const name of ['saveReadingToJournal', 'addReflectionToJournalEntry']) {
  assert.ok(operations.some((operation) => operation?.operationId === name), `${name} is present`);
}
const schemas = document.components.schemas;
assert.equal(schemas.AddJournalReflectionRequest.properties.text.maxLength, 2000);
assert.equal(Object.hasOwn(schemas.AddJournalReflectionRequest.properties, 'mode'), false);
assert.ok(schemas.AddJournalReflectionResponse.required.includes('entryId'));
assert.ok(schemas.AddJournalReflectionResponse.required.includes('key'));
assert.doesNotMatch(source, /mode:|maxLength: 500|saveJournalEntry|operationId: addJournalReflection/);
console.log('Actions YAML parses and matches the updated contract');
NODE
```

Expected: exit code 0 and `Actions YAML parses and matches the updated contract`.
These checks validate YAML syntax and the edited fields; they do not replace a full OpenAPI validator.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS, with 0 failures.

- [ ] **Step 5: Commit**

```bash
git add -A mcp/tableau-adapter package.json package-lock.json tarot-journal-actions.yaml
git commit -m "chore: retire the Node MCP adapter and align the journal Actions contract" -m "The adapter's four reading-job tools now live in the Worker's /mcp endpoint." -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Runbook, plugin files and repository docs

**Files:**
- Create: `docs/integrations/openai/chatgpt-mcp.md`
- Create: `docs/integrations/openai/plugin/README.md`
- Create: `docs/integrations/openai/plugin/SKILL.md`
- Create: `docs/integrations/openai/plugin/references/actions-contract.md`
- Create: `docs/integrations/openai/plugin/.app.json.template`
- Modify: `docs/integrations/openai/tableau-backend-chatgpt-app-integration.md`, `docs/integrations/openai/chatgpt-gpt-actions-setup.md`, `CLAUDE.md`

**Interfaces:** documentation only.

- [ ] **Step 1: Write the runbook**

Create `docs/integrations/openai/chatgpt-mcp.md`:

````markdown
# ChatGPT MCP endpoint (owner-only)

Type: runbook
Status: active
Last reviewed: 2026-09-23

The Tableu ChatGPT plugin reaches the backend through an MCP endpoint on the
main Worker, `https://tarot.lakefrontdev.com/mcp`, protected by OAuth 2.1 that
Tableu issues itself. This version is private: only accounts listed in the
`MCP_ALLOWED_USER_IDS` secret can link, and every write lands in the linked
account's own journal.

Design: `docs/superpowers/specs/2026-09-22-chatgpt-mcp-journal-design.md`.

## How it fits together

- **Routing.** `src/worker/index.js` hands `/mcp`, `/oauth/*` and the
  `/.well-known/oauth-*` documents to `functions/lib/mcp/oauthProvider.js`,
  which wraps `@cloudflare/workers-oauth-provider`. Every other path is
  unchanged.
- **Consent.** `/oauth/authorize` is the consent page (`consent.js`). It uses
  the normal Tableu session cookie and only lets allowlisted accounts approve.
- **`/mcp`.** `mcpHandler.js` checks the token's `tableu` scope, the
  allowlist, and that the account is active. Then it serves the tools
  statelessly.
- **Service layer.** The tools call service functions with that user:
  `readingJobs.js`, `journalEntries.js` and `journalReflections.js`.
- **Reading jobs.** Readings run as jobs in the `ReadingJob` Durable Object,
  under an in-Worker principal. Jobs started from ChatGPT are readable only
  through `/mcp` and are kept for 24 hours.

## Tools

| Tool | What it does |
|---|---|
| `get_profile` | Shows which Tableu account the connection acts as |
| `draw_tarot_reading` | Server draws the cards for one of the six spreads; returns them at once with a job reference |
| `start_tarot_reading` | Starts a reading from cards the user supplies |
| `wait_for_tarot_reading` | Waits up to 45 s for the reading, then returns its status and narrative |
| `get_tarot_reading_status` | Checks a reading once |
| `cancel_tarot_reading` | Cancels a running reading |
| `save_reading_to_journal` | Saves a finished reading from its job, verbatim and idempotently; accepts the audited payload after the job expires |
| `add_reflection_to_journal_entry` | Appends the user's exact words to the whole reading or one card; idempotent |

## Configuration

| Name | Kind | Value |
|---|---|---|
| `OAUTH_KV` | KV binding | OAuth clients, grants and tokens. Id in `wrangler.jsonc`. |
| `MCP_RESOURCE_URL` | var | `https://tarot.lakefrontdev.com/mcp`. Tokens are bound to exactly this resource. |
| `MCP_ALLOWED_USER_IDS` | secret | Comma-separated Tableu user ids allowed to link. Unset means nobody can link. |
| Migration `0030` | D1 | `journal_entries.idempotency_key` plus its partial unique index. Applied by the deploy script. |
| Migration `0031` | D1 | `oauth_registration_counters` for atomic per-address hourly DCR admission on `DB`. Applied by the deploy script; missing storage makes registration return 503. |

## First deployment

### Before merge

1. Create the KV namespace:
   `npx wrangler kv namespace create OAUTH_KV`. Replace the zeros in the
   `OAUTH_KV` entry of `wrangler.jsonc` with the printed id, and commit.
2. Open the PR. CI runs the unit tests and Playwright.

### Merge

CI deploys with `scripts/deploy.js`, which applies migrations `0030` and `0031`
before the new Worker. OAuth grants and clients use `OAUTH_KV`; registration
admission uses D1. Counters retain the current and previous hourly buckets,
with older buckets removed on the next registration attempt. While
`MCP_ALLOWED_USER_IDS` is unset, the endpoint is live but nobody can link.
Never deploy from a working tree with uncommitted `wrangler.jsonc` changes.

### After deploy

1. **Find your user id.** Sign in to Tableu in your browser. Run
   `npx @modelcontextprotocol/inspector`, choose **Streamable HTTP**, and enter
   `https://tarot.lakefrontdev.com/mcp`, then start the OAuth flow. The consent
   page refuses you, because the allowlist is empty, and shows your
   **Account ID**. Run `npx wrangler secret put MCP_ALLOWED_USER_IDS` and paste
   the ID.
2. **Link.** Link again from MCP Inspector, then choose **Allow**. List the
   tools (there are eight) and call `get_profile`; it returns your id.
3. **Connect ChatGPT.**
   - Turn on **Developer mode** under Settings → Security and login.
   - Go to [ChatGPT Plugins](https://chatgpt.com/plugins), press **+**, and
     create an app with the MCP server URL
     `https://tarot.lakefrontdev.com/mcp` and OAuth authentication.
   - Link it: sign in to Tableu if asked, then choose **Allow**.
   - Copy the app's id from the browser URL; it starts with `plugin_asdk_app_`.
4. **Update the plugin** to 0.28.0 with the files in
   [plugin/](plugin/README.md).

## Verify the account

1. `get_profile` in ChatGPT, the id on the consent page, and the allowlist
   entry must match.
2. After the first save, run
   `npx wrangler d1 execute mystic-tarot-db --remote --command "SELECT user_id FROM journal_entries WHERE id = '<entry id>'"`.
   It must print the same id.

## End-to-end check from ChatGPT

1. Ask for a three-card reading. The cards appear; then the narrative.
2. Say "save this". The reply names an entry id.
3. Add a note about one card, and one about the whole reading.
4. Repeat one of the notes. The reply says it was already attached.
5. Open the entry in the Tableu app. The narrative should match word for word,
   with the cards and orientations as drawn. The reflections should be
   labelled like "Past · The Hermit" and "Whole reading", each in its own
   paragraph.

## Kill switch and rollback

- `npx wrangler secret delete MCP_ALLOWED_USER_IDS` stops all linking and
  rejects existing tokens on the next request.
- To roll back the code, revert the PR. Migrations 0030 and 0031 are additive;
  leave them in place.

## Local development

1. `npm run build`, so the assets directory exists.
2. Create a config copy without the remote-only `ai` binding and with a local
   OAuth resource. Keep the `assets.run_worker_first` routes from Task 14.
   The command refuses to overwrite an existing local config:

   ```bash
   node --input-type=module <<'NODE'
   import { readFileSync, writeFileSync } from 'node:fs';

   let config = readFileSync('wrangler.jsonc', 'utf8');
   const edits = [
     [/\r?\n\s*"ai": \{\s*"binding": "AI"\s*\},?/, ''],
     [/("MCP_RESOURCE_URL":\s*)"[^"]*"/, '$1"http://localhost:8787/mcp"']
   ];
   for (const [pattern, replacement] of edits) {
     if (!pattern.test(config)) throw new Error(`Expected config field missing: ${pattern}`);
     config = config.replace(pattern, replacement);
   }
   writeFileSync('wrangler.dev-local.jsonc', config, { flag: 'wx' });
   console.log('Local OAuth resource: http://localhost:8787/mcp');
   NODE
   ```

   If a local config already exists, inspect and update those two fields in
   that file instead. If `.dev.vars` or the shell already overrides
   `MCP_RESOURCE_URL`, set that override to the same localhost URL as well.
3. Apply the migrations locally:
   `npx wrangler d1 migrations apply mystic-tarot-db --local --config wrangler.dev-local.jsonc`.
4. Start the server: `npx wrangler dev --config wrangler.dev-local.jsonc --port 8787`.
   Register or sign in at `http://localhost:8787`.
5. Run MCP Inspector against `http://localhost:8787/mcp` and start OAuth.
   Confirm discovery advertises `resource: http://localhost:8787/mcp` and
   localhost authorization/token endpoints. The browser's consent navigation
   must show the Tableu consent or account-refusal page, not the React app shell.
   Find your local account id on the refusal page. Add or update only
   `MCP_ALLOWED_USER_IDS=<id>` in `.dev.vars`, preserving other local values,
   and restart Wrangler.
6. Give this test account an active Plus subscription **in local D1 only**.
   Registration defaults to Free, which cannot save to the cloud journal.
   Substitute the account id from the local consent page:

   ```bash
   npx wrangler d1 execute mystic-tarot-db --local --config wrangler.dev-local.jsonc --command "UPDATE users SET subscription_tier = 'plus', subscription_status = 'active' WHERE id = '<LOCAL_USER_ID>' RETURNING id, subscription_tier, subscription_status;"
   ```

   Expected: exactly that account id, `plus`, and `active`. Never change this
   fixture command to `--remote`. Refresh the app's session view by signing out
   and in again before checking journal rendering.
7. Reconnect Inspector, approve consent, and call `get_profile`; the id must
   match the local account. Exercise draw, wait, save and reflection against
   localhost. Local tokens and account ids must not be used against production.

When you're done, delete `wrangler.dev-local.jsonc`, and never commit it or
`.dev.vars`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| The consent page asks you to sign in | No Tableu session in that browser | Sign in, then **Continue** |
| 403 "This account can't connect to ChatGPT" | The account isn't allowlisted | Add its id to `MCP_ALLOWED_USER_IDS` |
| ChatGPT keeps asking to link again | Allowlist changed, account deactivated, or token lacks `tableu` | Check the allowlist and account, then link again |
| `invalid_redirect_uri` on registration | Redirect URI isn't a ChatGPT callback or loopback | Register from ChatGPT or a local tool |
| 429 on `/oauth/register` | More than 10 registrations an hour from one address | Wait for the next hour |
| 503 on `/oauth/register` | D1 admission unavailable, including a missing migration 0031 | Check the DB binding and migration status; restore admission storage before retrying |
| "Reading job not found." | Wrong jobId/jobToken, or another account's job | Start a new reading |
| "…job has expired…" when saving | MCP jobs are kept for 24 h | Save with the reading fields, as the tool describes |
| Journal routes answer 403 `service_account_journal_forbidden` | Called with the shared GPT service token | Use a personal credential |
````

- [ ] **Step 2: Write the plugin files**

Create `docs/integrations/openai/plugin/README.md`:

```markdown
# Tableu plugin 0.28.0: files to apply

These files update the Tableu ChatGPT plugin (0.27.3, downloaded from ChatGPT)
so that it uses the live MCP tools. The rest of the package, including its
reference guides and assets, is not stored in this public repository.

1. Unzip the 0.27.3 package.
2. Replace `skills/instructions/SKILL.md` with [SKILL.md](SKILL.md).
3. Replace `skills/instructions/references/actions-contract.md` with
   [references/actions-contract.md](references/actions-contract.md).
4. Copy [.app.json.template](.app.json.template) to the package root as
   `.app.json`, and set `id` to the registered app's id: the `plugin_asdk_app_…`
   value from the ChatGPT URL, without the leading `plugin_`. Validation
   requires ids that start with `asdk_app_`. If validation rejects the id,
   ask `@plugin-creator` in ChatGPT to write the mapping for that app id.
5. Update both manifests, `plugin.json` and `.codex-plugin/plugin.json`:
   - set `version` to `0.28.0`;
   - reference the app mapping: `"apps": "./.app.json"` under
     `extensions.com.openai` in `plugin.json`, and top-level `"apps": "./.app.json"`
     in `.codex-plugin/plugin.json`;
   - set `description` and `interface.longDescription` to "Tarot readings drawn
     and interpreted by Tableu, saved to your Tableu journal with your
     reflections.";
   - set `interface.capabilities` to `["Read", "Write"]`.
6. Zip the package and upload it in ChatGPT Plugins (developer mode). Start a
   new chat to test.
```

Create `docs/integrations/openai/plugin/.app.json.template`:

```json
{
  "apps": {
    "tableu": {
      "id": "asdk_app_REPLACE_WITH_REGISTERED_APP_ID"
    }
  }
}
```

Create `docs/integrations/openai/plugin/SKILL.md`:

```markdown
---
description: Default instructions for the Tableu plugin. Use this skill whenever this
  plugin is invoked.
name: instructions
---

You are Tableu, a reflective tarot reader. Read warmly, calmly, and concretely. Tarot is guidance, not fixed prediction. The reference file "Tableu — GPT Knowledge Base" explains spreads, card meanings, and reading ethics. It was written for the former GPT, so treat its Action instructions and product claims as historical, not as evidence of tools or current app features. A live tool's schema and response always take precedence.

REFERENCE ROUTING
Before a backend reading or a journal write, read references/actions-contract.md and follow the live tool schema. references/migration-audit.md and references/migration-source/ are history: the gaps they describe are closed by the connected Tableu tools.

CAPABILITY CHECK
This plugin connects to Tableu through an app with eight tools: get_profile, draw_tarot_reading, start_tarot_reading, wait_for_tarot_reading, get_tarot_reading_status, cancel_tarot_reading, save_reading_to_journal, and add_reflection_to_journal_entry. Promise a live operation only when the matching tool is available in this conversation. If the tools are not connected, say so briefly: you can explain spreads, interpret cards the user supplies, and help draft a reflection, but you can't draw through Tableu or save to its journal here. Point them to the Tableu app. Never claim backend access, a seed, account history, quota, or a saved entry without the tool response that shows it.

ACCOUNT
The connection is private. It acts as the one Tableu account that linked it, and saves land in that account's journal. When the user asks which account is connected, or before a first save if it's unclear, call get_profile and name the account (nickname or name). Never describe the connection as shared or per-user. Never ask for passwords, tokens, or other secrets.

CONVERSATIONAL FLOW
Treat this plugin as a conversational guide to Tableu. Before a reading, offer at most one useful choice when it matters: deck style, reversals, or spread depth. When the user gives no preference, default to RWS 1909, reversals on, and threeCard. A word, number, cut, or short intention becomes a seed only if you pass it to draw_tarot_reading.

Shape questions toward open-ended, agency-centered wording. Recommend one spread plus one alternative: single for a quick pulse; threeCard for most questions; fiveCard for depth; decision for two named options; relationship for two-person dynamics; celtic for a wanted deep dive. Establish Path A and Path B before a decision draw.

READINGS
Use draw_tarot_reading when Tableu should draw and the user has not supplied cards. Always send spreadInfo with the display name and the canonical key: single, threeCard, fiveCard, decision, relationship, or celtic. Never invent cards or simulate a shuffle.

Use start_tarot_reading for cards the user supplies from a physical deck, a photo, or an earlier draw. Keep their cards, positions, and orientations exactly. Write a concise, position-aware meaning only when the user gave none.

Both tools return a jobId and jobToken at once; keep those to yourself. Show the drawn cards when you have them, then call wait_for_tarot_reading. If it reports running, call it again with the same jobId and jobToken; never start a second reading for the same request. Present a backend narrative only after the job reports complete and returns one. If the reading fails, say so plainly and never pretend cards were drawn or a reading was written. Each reading uses the user's quota: allow at most one corrective retry, and only after an explicit validation error. Use cancel_tarot_reading only when the user asks to cancel.

JOURNAL
Both write tools need explicit consent. Never save because a reading seemed important, because the user reacted strongly, or because they kept talking about a card. Offer rather than assume: "Want me to keep this one?" is better than saving silently.

Use save_reading_to_journal only when the user asks to save, journal, keep, archive, or remember the reading, or gives an unambiguous yes right after you offer. Send the reading's jobId and jobToken. The server copies the narrative and cards exactly; don't resend them. Add context (love, career, self, spiritual, wellbeing, decision, or general) only when the question clearly belongs to one. If the tool reports that the job has expired, send the reading fields exactly as its message lists them, copying the narrative and cards as the reading returned them.

Keep the returned entry id for the rest of the conversation. The outcome tells you what happened:
- saved: a new entry was created;
- already_saved: the reading was already in the journal, and nothing changed;
- seedShared: another saved reading uses the same seed, so this one was stored without it.

Use add_reflection_to_journal_entry only when the user asks to save, attach, journal, or note something they just said, or gives an unambiguous yes right after you offer. Send their words verbatim, up to 2,000 characters. If a passage is longer, ask them to choose a shorter one; never summarize or split it. Use scope reading for the whole spread. Use scope card with the card's name as the reading showed it, and add the position when that card appears more than once. Use only an entry id that save_reading_to_journal returned in this conversation; never guess one. already_present means that note was already attached. Repeated notes on the same card are added, never replaced.

Retrying once after an unclear failure is safe for both tools. If the retry also fails, say the save could not be confirmed and suggest checking the Tableu app. Never say "saved" unless the tool returned success. When a result says "Not saved" or "Not added", say so and why, and fix only the stated problem, once. On a tier or quota error, explain it plainly and stop.

There are no journal read tools. Use only data shared or returned in this conversation. Do not list past entries, search the journal, or report cross-session recurrence or archetype history; point to the app for history. A saved entry does not update archetype tracking.

REFLECTIONS IN CONVERSATION
When users react to cards, treat those reactions as meaningful context and reuse them in conversation. Pass them in reflectionsText only when starting another backend reading the user wants. Do not persist them without consent. If a card recurs within the current conversation, call it out.

READING CRAFT
Position first: every card answers its position. Only reference cards actually on the table. Use one reversal lens throughout a reading. Weight clusters of Major Arcana. Name genuine suit, court, elemental, dyad, triad, or Fool's Journey patterns; never force them. Synthesize the central tension, its roots, and one or two practical steps. Difficult cards are honest information plus a workable next step, never threats.

PRESENTATION
State the spread, then each card as "Position — Card (orientation)" in order. When the backend returned a narrative, make it the centerpiece; otherwise write a concise interpretation of the user's cards without implying a backend call. Follow with a short synthesis and one reflective question. Mention a seed only if a tool returned it. After a reading, mention at most one or two relevant next steps that are actually available here, such as saving the reading or noting a reflection.

EDUCATION AND APP FEATURES
For meanings, symbolism, history, spreads, reversals, or deck differences, answer from the reference material without a tool, unless the user wants a backend reading. The reference describes the journal, ritual draws, archetype journey, voice narration, physical-spread capture, sharing and export, and the RWS 1909, Thoth, and Marseille deck styles as of its 2026-07-31 review. Check current app evidence before promising a feature, tier, price, or quota. Do not turn features into a sales pitch.

ETHICS
No medical, legal, financial, or mental-health directives. For high-stakes topics, keep tarot reflective and point to qualified professionals. In a crisis or immediate danger, set tarot aside and prioritize safety. Preserve agency: no fixed outcomes, exact dates, diagnoses, verdicts, or commands such as "leave them." Do not surveil or diagnose absent third parties. Use non-shaming language. Never expose credentials or backend internals, including job tokens.
```

Create `docs/integrations/openai/plugin/references/actions-contract.md`:

```markdown
# Tableu tools contract

Reviewed 2026-09-23 for plugin 0.28.0. Source of truth: the live tool schemas.
The backend is described in `docs/integrations/openai/chatgpt-mcp.md` in
henryperkins/tarot.

These tools come from the Tableu app (`https://tarot.lakefrontdev.com/mcp`,
OAuth). Use a tool only when it is actually exposed. The four historical GPT
Actions (createTarotReading, drawTarotReading, saveReadingToJournal,
addReflectionToJournalEntry) are superseded; `migration-source/` keeps them as
history.

## Account

`get_profile` returns `{ id, name?, nickname? }` for the Tableu account the
connection acts as. The connection is private to that one account.

## Readings

| Tool | Input | Returns |
|---|---|---|
| `draw_tarot_reading` | `spreadInfo { name, key }`; optional `userQuestion`, `reflectionsText`, `deckStyle` (rws-1909, thoth-a1, marseille-classic), `allowReversals`, `seed`, `personalization` | `jobId`, `jobToken`, `status: running`, `spreadInfo`, `cardsInfo`, `seed`, `deckStyle` |
| `start_tarot_reading` | `spreadInfo { name, key }`, `cardsInfo[] { position, card, orientation, meaning }`, and the optional reading fields above | `jobId`, `jobToken`, `status: running` |
| `wait_for_tarot_reading` | `jobId`, `jobToken`, optional `timeoutSeconds` (1–45, default 40) | status (below), plus `timedOut` when still running |
| `get_tarot_reading_status` | `jobId`, `jobToken` | status (below) |
| `cancel_tarot_reading` | `jobId`, `jobToken` | `status`: `cancelled`, or `complete` / `error` when already finished |

- **Spread keys** are exactly `single`, `threeCard`, `fiveCard`, `decision`,
  `relationship` and `celtic`.
- **Cards** have the shape
  `{ position, card, orientation (Upright or Reversed), meaning, number, suit, rank, rankValue }`.
  `card` is the name in the chosen deck, for example Thoth "Prince of Wands".
  The metadata comes from the card catalog. The returned cards are the ground
  truth.
- **Status** is `{ jobId, status (running, complete or error), spreadInfo, cardsInfo, seed? }`.
  When complete it adds `reading`, `provider`, `requestId`, `themes` and, when
  present, `gateBlocked`/`gateReason`. When it failed it adds `error`.
- **Tokens.** `jobId` and `jobToken` are private handles; never show them to
  the user.
- **Waiting.** Wait again if a reading is still running, and never start a
  second reading for the same request.
- **Replay.** Reuse the returned decimal `seed` unchanged with the same spread,
  deck and reversal setting to reproduce the draw. MCP treats decimal seed
  strings as unsigned 32-bit values; nonnumeric words or phrases are hashed.
  The existing HTTP draw API retains its original string-hashing behavior.
- **Timing.** Every tool returns within about 45 seconds.

## Saving: `save_reading_to_journal`

Consent is required: an explicit request, or an unambiguous yes right after an
offer.

- **Preferred:** `{ jobId, jobToken, context? }`. The server copies the
  narrative, cards, spread, question, deck, personalization and seed exactly.
  `context` is one of love, career, self, spiritual, wellbeing, decision or
  general, and is sent only when clearly supported.
- **After the job expires (24 h):** the reading fields `spread`, `spreadKey`,
  `cards`, `personalReading` and `requestId`, plus optional `question`,
  `themes`, `context`, `provider`, `sessionSeed`, `deckId` and
  `userPreferences`.
  - Each card is `{ position, name, orientation }`, where `name` is the card's
    name as the reading returned it (`cardsInfo[].card`). It also carries its
    identity: `number` for a Major Arcana card, or `suit` and `rankValue` for a
    Minor Arcana card, exactly as returned.
  - `personalReading` is the complete narrative, verbatim.
- **Never both:** don't send a job reference and reading fields together.
- **Canonical names:** cards are stored under their canonical names, which is
  how the app stores them; Thoth "Prince of Wands" is stored as "Knight of
  Wands". The app shows canonical names.
- **Outcomes:**
  - `saved`: a new entry, returned as `entry.id`;
  - `already_saved`: this reading was already stored, nothing changed, and
    `entry.id` is its id;
  - `seedShared`: another reading already uses the seed, so this one was
    stored without it.
- **Errors:** "Not saved: …" names the reason. "Could not confirm …" means the
  outcome is unknown, so suggest checking the app.

## Reflections: `add_reflection_to_journal_entry`

Consent is required: an explicit request, or an unambiguous yes right after an
offer.

- **Input:** `{ entryId, text, scope (reading or card), card?, position? }`.
  `entryId` must come from a save in this conversation.
- **Text:** the user's exact words, 1–2,000 characters. Never summarize or
  split them.
- **Card scope:** send `card` as the reading showed it, plus `position` when
  that card appears twice. A card that isn't in the entry is rejected, and the
  error lists the entry's cards.
- **Returned target:** `target.card` is also the entry deck's label, so it can
  be reused with `target.position` for another note. Stored journal cards keep
  their canonical names; a Thoth Prince target remains "Prince of Wands" in
  reflection results even though its stored canonical name is "Knight of Wands".
- **Appending:** notes are appended, never replaced. The same note on the same
  target is never added twice; the outcome is then `already_present`.
- **Other errors:** "Not added: no saved entry with that id…" means the entry
  is missing or belongs to another account. Don't guess another id.

## Retries and errors

- **Retries:** a save or a reflection may be retried once after an unclear
  failure. Both are idempotent.
- **Explicit rejections** ("Not saved", "Not added", "Not started"): fix only
  the stated problem, once.
- **Tier or quota errors:** explain them and stop.
- **Honesty:** never report success without a successful tool result.

## Not available

- There are no journal read, list, search or delete tools.
- There is no cross-session history, and archetype tracking is not updated by
  saves.
- Point to the Tableu app for history.
```

- [ ] **Step 3: Point the older docs at the new runbook**

In `docs/integrations/openai/tableau-backend-chatgpt-app-integration.md`, replace:

```markdown
Type: guide
Status: active reference
Last reviewed: 2026-04-23
```

with:

```markdown
Type: guide
Status: superseded
Last reviewed: 2026-09-23

> **Superseded.** The Node adapter this guide describes (`mcp/tableau-adapter/`) was
> retired. The MCP endpoint now runs on the main Worker behind OAuth that Tableu
> issues; see [chatgpt-mcp.md](chatgpt-mcp.md).
```

In `docs/integrations/openai/chatgpt-gpt-actions-setup.md`, replace:

```markdown
This setup uses GPT Actions with your existing Worker API.
```

with:

```markdown
> **Journal writes moved to MCP (2026-09-23).** The journal routes now refuse the
> shared `GPT_SERVICE_TOKEN` (403 `service_account_journal_forbidden`): its synthetic
> account can never sign in, so entries saved with it were invisible in the app. The
> ChatGPT plugin saves through the OAuth-protected MCP endpoint instead; see
> [chatgpt-mcp.md](chatgpt-mcp.md). The reading Actions below are unchanged.

This setup uses GPT Actions with your existing Worker API.
```

- [ ] **Step 4: Update `CLAUDE.md`**

In `CLAUDE.md`:

1. After the line ``- `lib/scheduled.js` — Cron tasks: KV→R2 archival, session cleanup``, add:

```markdown
- `lib/mcp/` — ChatGPT MCP endpoint: OAuth provider wiring (`oauthProvider.js`), consent page (`consent.js`), `/mcp` handler, tools (`tools/`), journal mapping
- `lib/journalEntries.js`, `lib/journalReflections.js`, `lib/readingJobs.js` — Journal save/reflection and reading-job services shared by the app routes and the MCP tools
```

2. Replace:

```markdown
**Journal**:
- `GET|POST /api/journal` — List/save entries
- `GET|DELETE /api/journal/:id` — Single entry
```

with:

```markdown
**Journal**:
- `GET|POST /api/journal` — List/save entries
- `GET|DELETE /api/journal/:id` — Single entry
- `POST /api/journal/:id/reflections` — Append a reflection (append-only, idempotent)
```

3. Replace ``**Health**: `GET /api/health/tarot-reading`, `GET /api/health/tts` `` with:

```markdown
**ChatGPT MCP** (OAuth 2.1 issued by Tableu, owner allowlist; see `docs/integrations/openai/chatgpt-mcp.md`):
- `POST /mcp` — MCP endpoint (stateless Streamable HTTP)
- `GET|POST /oauth/authorize` — Consent page
- `POST /oauth/token`, `POST /oauth/register` — Token exchange and dynamic client registration
- `GET /.well-known/oauth-authorization-server`, `GET /.well-known/oauth-protected-resource[/mcp]` — Discovery

**Health**: `GET /api/health/tarot-reading`, `GET /api/health/tts`
```

4. After the bindings row ``| `ASSETS` | Assets | Static frontend files |``, add:

```markdown
| `OAUTH_KV` | KV | OAuth clients, grants and tokens for the ChatGPT MCP endpoint |
```

5. After the `GPT_OWNER_TOKEN` bullet in **Secrets**, add:

```markdown
- `MCP_ALLOWED_USER_IDS` — Comma-separated Tableu user ids allowed to link ChatGPT to `/mcp`. Unset means nobody can link (kill switch). The var `MCP_RESOURCE_URL` pins the OAuth resource.

The journal routes refuse `GPT_SERVICE_TOKEN` and `GPT_OWNER_TOKEN` (403 `service_account_journal_forbidden`).
```

6. Replace ``Key files: `deck.test.mjs`, `narrativeBuilder.*.test.mjs`, `narrativeSpine.test.mjs`, `evaluation.test.mjs` `` with:

```markdown
Key files: `deck.test.mjs`, `narrativeBuilder.*.test.mjs`, `narrativeSpine.test.mjs`, `evaluation.test.mjs`. Journal and MCP tests run against real SQLite via `tests/helpers/d1Sqlite.mjs` (`sql.js`, every migration applied); OAuth tests stub `cloudflare:workers` with `tests/helpers/cloudflareWorkersHooks.mjs`.
```

- [ ] **Step 5: Check the docs**

Run: `npm run lint:cloudflare && grep -rn "tableau-adapter" docs --include=*.md | grep -v "Superseded\|retired" ; echo done`
Expected: `lint:cloudflare` passes. Any remaining `tableau-adapter` matches are inside the superseded guide's body, which is kept as history, and `done` prints.

- [ ] **Step 6: Commit**

```bash
git add docs/integrations/openai/chatgpt-mcp.md docs/integrations/openai/plugin docs/integrations/openai/tableau-backend-chatgpt-app-integration.md docs/integrations/openai/chatgpt-gpt-actions-setup.md CLAUDE.md
git commit -m "docs: ChatGPT MCP runbook, plugin 0.28.0 files, and pointers" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: Full verification

**Files:** none are changed, unless a check fails. A failure goes back to the task that owns the code.

- [ ] **Step 1: Run the full automated checks**

Run each command and record its summary line:

```bash
npm test
npm run test:deploy
npm run lint
npm run lint:cloudflare
npm run build
npx wrangler deploy --dry-run --outdir .wrangler/dry-run
```

Expected:
- `npm test`: every file passes, with a count line such as `# fail 0`.
- `npm run test:deploy`: passes.
- `npm run lint`: 0 errors (warnings are allowed).
- `npm run build` and the dry run: both succeed, and the dry run exits without uploading.

- [ ] **Step 2: Walk through the flow locally with MCP Inspector**

1. Create `wrangler.dev-local.jsonc` using the command in `docs/integrations/openai/chatgpt-mcp.md` under Local development. It removes the `ai` block, sets `MCP_RESOURCE_URL` to `http://localhost:8787/mcp`, and preserves the Worker-first asset routes. Check that no `.dev.vars` or shell override resets the resource to production.
2. Run `npx wrangler d1 migrations apply mystic-tarot-db --local --config wrangler.dev-local.jsonc`.
3. Start the server: `npx wrangler dev --config wrangler.dev-local.jsonc --port 8787`.
4. Open `http://localhost:8787` in the browser and register a test account.
5. Run `npx @modelcontextprotocol/inspector`. Connect with **Streamable HTTP** to `http://localhost:8787/mcp`, and start OAuth. Verify the discovered resource and authorization/token endpoints all use localhost. Verify the browser navigation reaches the OAuth account-refusal page, not the React app shell; it shows your local account id.
6. Add or update `MCP_ALLOWED_USER_IDS=<that id>` in `.dev.vars`, preserving other values, then restart `wrangler dev`.
7. Set the new test account's entitlement in **local D1 only**:

   ```bash
   npx wrangler d1 execute mystic-tarot-db --local --config wrangler.dev-local.jsonc --command "UPDATE users SET subscription_tier = 'plus', subscription_status = 'active' WHERE id = '<LOCAL_USER_ID>' RETURNING id, subscription_tier, subscription_status;"
   ```

   Substitute the id from step 5. Verify the returned row is that id with `plus`/`active`. The registered account otherwise defaults to Free and must be denied a cloud-journal save. Sign out and in again in the app to refresh its entitlement view. This fixture change must never use `--remote`.
8. Connect Inspector again and choose **Allow**. Then check each of these:
   - tools/list shows 8 tools;
   - `get_profile` returns the same local id from steps 5 and 7, proving an authenticated MCP call succeeds with the local resource;
   - `draw_tarot_reading` with `{ "spreadInfo": { "name": "Three-Card Story (Past · Present · Future)", "key": "threeCard" } }` returns three cards;
   - `wait_for_tarot_reading` eventually returns `complete`. Without provider keys, the local composer writes the narrative.
   - `save_reading_to_journal` with the job reference returns `saved`, and repeating it returns `already_saved`;
   - `add_reflection_to_journal_entry` with scope `card` (a drawn card's name) and with scope `reading` both return `added`, and repeating one returns `already_present`.

Expected: every call behaves as listed. If a call fails, capture the tool result and the `wrangler dev` log, and fix the task that owns that code.

With that same local Worker still running, run the browser routing regression
created in Task 14 from a second terminal:

```bash
npx playwright test --config playwright.mcp.config.js
```

Expected: the routing test passes using real `page.goto()` navigation through
Wrangler. It verifies localhost discovery, the signed-out OAuth page, an API
404 and the frontend home page. The dedicated config does not start a server,
so it cannot silently fall back to the production resource configuration.
Record this result separately from the frontend-only Playwright CI suite,
which excludes `*.integration.spec.js` files.

- [ ] **Step 3: Check that the entry renders in the app**

In the browser signed in to the local app, open the journal and expand the entry you saved. Confirm:
- the narrative matches the `reading` text word for word;
- the three cards show real card images (not the card back) with the drawn orientations;
- the reflections are labelled like "Past · The Hermit" and "Whole reading", with repeated notes in separate paragraphs.

Take a screenshot for the PR description.

- [ ] **Step 4: Clean up**

Stop `wrangler dev`, then run `rm wrangler.dev-local.jsonc`, and keep `.dev.vars` out of git. Check: `git status --short` shows no untracked files other than ignored ones.

---

### Task 18: Pre-merge infrastructure and the PR (owner-confirmed)

These steps create a Cloudflare resource and publish the branch to GitHub. **Ask the owner before each step and wait for a yes.**

**Files:**
- Modify: `wrangler.jsonc` (the `OAUTH_KV` id)

- [ ] **Step 1: Create the KV namespace** (after the owner confirms)

Run: `npx wrangler kv namespace create OAUTH_KV`
Expected: the output prints an `id` of 32 hex characters.

Replace `"id": "00000000000000000000000000000000"` in the `OAUTH_KV` entry of `wrangler.jsonc` with that id.

```bash
git add wrangler.jsonc
git commit -m "chore: bind the OAUTH_KV namespace for the ChatGPT MCP endpoint" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 2: Push the branch and open the PR** (after the owner confirms)

The branch also carries the earlier local commit `4f0e125`, which the PR includes on purpose.

```bash
git push -u origin feat/chatgpt-mcp-journal
gh pr create --base master --head feat/chatgpt-mcp-journal --title "ChatGPT MCP: owner-only readings, journal saves and reflections" --body-file .wrangler/pr-body.md
```

Before running `gh pr create`, write `.wrangler/pr-body.md` with these sections:
- **Summary:** one paragraph.
- **What changed:** grouped by task.
- **Review fixes:** a table copied from spec §13.
- **Test evidence:** the `npm test` summary line, the dry-run `Total Upload` line, and the Task 17 screenshot.
- **Deployment requirements:** copied from the First deployment and Verify the account sections of `docs/integrations/openai/chatgpt-mcp.md`.
- **Out of scope:** copied from spec §11.

End the body with the line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

Expected: `gh` prints the PR URL.

- [ ] **Step 3: Stop**

Merging deploys to production through CI, and the post-deploy steps need the owner's accounts: the Cloudflare secret, ChatGPT developer mode, and the plugin upload. Report the PR URL and hand over the runbook's After deploy section.
