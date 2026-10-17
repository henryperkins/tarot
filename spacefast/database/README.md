Tableu's Spacefast database port targets MySQL 8.0.17 or newer with InnoDB,
`utf8mb4_0900_bin`, generated columns, JSON_TABLE, and expression defaults.
The no-pad binary collation preserves case, non-ASCII distinctions, and trailing
spaces in SQLite equality/uniqueness. Unsupported engines must fail the native
migration rather than receive a weaker collation.

`createSpacefastDatabase(env.DB)` adapts the application binding. Retain the
original binding as `TABLEU_NATIVE_DB` for the KV and job adapters. The compiler
tokenizes SQL, keeps bound values separate, supports Tableu's reviewed conflict
targets, and rejects unsupported SQLite forms. Native errors are translated
only where existing application recovery depends on SQLite error text.

The native broker must provide these D1 contracts:

- `prepare(sql).bind(...).all()` with `success`, `results`, and `meta.changes`.
- `meta.last_row_id` from the same statement/connection for atomic
  `LAST_INSERT_ID(...)` quota counters. Missing metadata raises an error.
- `batch(statements)` must execute sequentially in one transaction and roll back
  all statements on failure, with one result per statement. MySQL's deadlock
  victims are retried as whole database-only transactions.

Follow-up admissions lock the user row. Feature admissions lock a hashed
identity/feature row. Narration triggers lock the monthly counter before testing
and reserving quota. Settlement and refunds happen in the transaction updating
the reservation. Ordinary updates count matched rows while holding row locks,
because SQLite counts unchanged matches and MySQL affected-row mode varies.
Bulk delete counts are retained. The real Spacefast broker still requires a
runtime probe: the public Functions documentation does not specify transaction
or metadata behavior. Local mysql2 tests demonstrate SQL/database semantics,
not the remote broker implementation.

Run `node scripts/spacefast-database-migrations.mjs` in the Spacefast build hook.
The isolated Wrangler profile points `migrations_dir` at `spacefast/migrations`.
The first migration creates the final application schema, later migrations
install the native triggers, and the build hook emits KV/job/canary tables. Publishing
applies the native migrations to the Space's database; it does not copy the
Cloudflare database. No application tables are initialized by a request.

`source-fingerprints.json` records every original Cloudflare migration. A build
fails when one changes or the inventory differs. To update the native port,
run `python3 scripts/spacefast-database-schema.py`, review the resulting MySQL
schema plus the handwritten triggers, and rerun the native tests. The compiler
applies the existing migrations to an in-memory SQLite database and introspects
the final schema. Indexed identifier fields use bounded native string types;
unindexed user content stays LONGTEXT. Partial unique indexes use nullable
generated columns, and quality dimension uniqueness uses a SHA-256 digest of
the exact JSON tuple (including the established NULL-to-empty normalization).

`node scripts/spacefast-database-audit.mjs` inventories every application
`prepare` call and SQL literal, checks representative dynamic fragments, and
rejects unresolved calls or compilation failures. With an isolated local MySQL
test instance, it also EXPLAINs the native statements:

```sh
TABLEU_TEST_MYSQL_PORT=13318 TABLEU_TEST_MYSQL_DATABASE=tableu_database_test \
TABLEU_MYSQL_DRIVER=/path/to/mysql2/promise.js \
node scripts/spacefast-database-audit.mjs

TABLEU_TEST_MYSQL_PORT=13318 TABLEU_TEST_MYSQL_DATABASE=tableu_database_test \
TABLEU_MYSQL_DRIVER=/path/to/mysql2/promise.js \
node --test tests/spacefastDatabase.test.mjs
```

The harness connects only to loopback. Use a disposable database initialized
with the checked-in native migrations. No production DSN or credentials are
required or returned by the application. Without the test port, the SQL/source
checks run and native integration cases are explicitly skipped.

Verification on 2026-10-09 used disposable MySQL 8.4. All five native database
tests passed, including concurrent quota admissions, follow-up turn allocation,
idempotent settlement/refunds, webhook claims, batch rollback, foreign-key
failures, exact string comparisons, and SQLite matched-row counts. The SQL
inventory accounted for 241 prepared calls and EXPLAINed 254 collected
statements with no unresolved calls or failures. Dynamic fragments use reviewed
representative values; this is not coverage of every runtime filter combination.
The generated artifact carries five migrations, 42 tables, and three triggers.
Remote Spacefast engine, metadata, and transactional batch contracts remain
unverified.

An administrator can test the published broker at
`/api/health/runtime/database` only after setting
`TABLEU_RUNTIME_CANARY_ENABLED=true` and a `TABLEU_RUNTIME_CANARY_TOKEN`
(or `ADMIN_API_KEY`) of at least 24 characters. Supply it as a Bearer token.
GET reads the engine, no-pad collation, and declared application table schema;
it never verifies transaction behavior. POST additionally inserts two disposable
UUIDs into the canary table, checks statement `last_row_id`, batch connection
affinity and commit, then deliberately fails a duplicate batch to verify
rollback. Both UUIDs are deleted in a finally block. Contract failures return
503 without database error details. The probe performs no provider calls and
does not enable reading jobs or other features. Record the returned build
revision with the result before treating a native broker contract as verified.

Runtime contracts: [Functions](https://spacefast.com/docs/functions/),
[Database](https://spacefast.com/docs/database/).
