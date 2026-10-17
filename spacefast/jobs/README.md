# Spacefast reading jobs

`createReadingJobsNamespace(env, ctx)` provides the `idFromName`, `get`, and
`fetch` interface used by the existing app and MCP reading-job routes. It uses
`env.TABLEU_NATIVE_DB` (or an unadapted `env.DB`) for MySQL queries. The table is
created lazily on the first operation; deployments can apply the exported
`READING_JOBS_SCHEMA` separately when DDL access is restricted.

Every job stores its result, metadata, bounded event history, text snapshot,
owner principal, job token, expiry, and revision in MySQL. App Authorization and
Cookie headers remain only in the active runner; they are never stored. Public
routes require the job token and conceal MCP jobs. MCP snapshot/cancel routes
require the owning principal and conceal all other jobs.

Unique-key admission starts one runner per job ID. Writes require its active
lease and the expected revision. Cancellation commits a terminal state before
returning; a different isolate's runner observes it on its next lease renewal,
aborts the provider, and cancels a blocked response reader. Completion and
cancellation compete through compare-and-swap, so a late response cannot
overwrite a cancelled or deleted job. SSE subscribers poll committed state,
including across isolates; their transport heartbeats do not enter replay
history. Finished jobs keep the original one-hour app or one-day MCP retention.

The function execution context must provide `waitUntil`. A missing capability
returns 503 before inserting a job. Persisted state does not restart provider
work: if a runner disappears, the next read after its lease expires records an
interruption and asks the user to start a new reading. This avoids silently
running generation and quota admission again. The default lease is 30 seconds,
renewed once per second; a deployment still needs to verify the platform's
background-execution lifetime for its real providers.

Spacefast job IDs are the logical job UUIDs, rather than Cloudflare's 64-character
object IDs. The Cloudflare maintenance route's object-ID validation does not
cover this table. A platform maintenance schedule must call the namespace's
`cleanupExpired()` to delete expired jobs that nobody reads again. The adapter
also deletes an expired job when its authorized status or snapshot is read;
without a maintenance schedule, unread expired data remains stored.

Run `node --test tests/spacefastJobs.test.mjs` for local SQL-backed behavioral
coverage. Its default SQLite harness only translates the MySQL table definition
and `INSERT IGNORE` for testing. Run the same suite against disposable MySQL with
`SPACEFAST_JOBS_TEST_MYSQL_URL` and, if needed,
`SPACEFAST_JOBS_TEST_MYSQL_DRIVER` set to an installed `mysql2/promise` module.
Use an isolated test database: the maintenance test intentionally deletes expired
reading-job rows. This does not verify Spacefast's remote DB or runtime itself.
