# Spacefast integration status

Updated 2026-10-17 on `codex/spacefast-current-20261017`, integrating current master with the preserved prototype at `1150983b`. The original prototype remains recoverable. The reviewed application preview was rejected by the remote database migration broker; no application version is ready or live.

## Remote blocker

An exact clean build at `6557bc9c35c812dfaa45e23985b531f3e1672ff3` was uploaded as preview `ver_ab6da9baace849dc974346e81885602d` (`v3`). Finalization failed with `d1_migration_failed`: `D1_SQL_UNSUPPORTED: column type BIGINT.` The CLI accepted and packaged the Functions handler and five migrations, but the remote D1 migration path rejected the native MySQL schema. Local MySQL acceptance does not establish that this broker accepts native SQL.

A separate minimal, migration-free diagnostic Functions version `ver_56275694ca77422d8a51abd090d69369` (`v4`) reached ready state. Its private route remained inaccessible: direct requests returned 403, and the authenticated CLI fetch could not verify the version because it received 401. No runtime SQL probe ran. This diagnostic is not a working Tableu preview. Cleanup was also refused with 403 because the current machine credential lacks version-removal permission; it remains unpromoted and requires an authorized owner/admin to remove it. The fixed-query handler additionally requires a private canary bearer token.

The [platform documentation](https://spacefast.com/docs/database/) describes a D1-shaped binding over MySQL; it does not establish raw MySQL migration/query support. The next integration step is to establish a supported migration and query path preserving this adapter's transaction, counter, locking, collation, constraint, and trigger contracts, plus authorized preview access. Do not strip those constraints, bypass compatibility validation, promote the failed version, or treat an empty-schema shell as acceptance. This branch remains a draft, separate from Cloudflare master.

## Local compatibility work

The current port resolves the three source blockers found during reconciliation:

1. **Schema and SQL drift.** The native bootstrap includes Cloudflare migrations 0036–0038, retaining visual source records, claims, tombstones, foreign keys, and admission checks. The audit accounts for 312 prepared calls and 344 SQL variants, including consistent optional projections/joins. All compile and EXPLAIN on isolated MySQL 8.4. Native behavioral checks cover exact source matching, nullable JSON fields, journal attachment/deletion, owner revocation, concurrent initial reservations, one-dispatch replay, and stale-result rejection after a source edit.
2. **Scheduler.** Only the daily maintenance schedule is emitted. The authenticated historical video endpoint returns 410 without invoking maintenance or a provider. Cloudflare's retired cron remains a no-op; opt-in HTTP callers receive a structured skip.
3. **Job contracts and explicit feature scope.** Persisted prose jobs retain reading-result identity, visual binding, private initialization/token fields, and MCP error codes across restart/replay. The Spacefast feature profile supports prose and saved ledgers; model annotation dispatch and retry are explicitly disabled even if deployment variables opt in. The frontend uses the local prose/card aligner. A distributed `READING_VISUAL_JOBS` runner is outside this profile and has not been implemented.

Visual/source mutations share a transaction-scoped database lock, including journal edits and owner deletion. This deliberately favors correctness over concurrent write throughput. The same-connection transaction and result metadata contracts must be verified against the real Spacefast broker before release.

Local verification is recorded separately from remote readiness. A fresh native schema initializes successfully, the application artifact builds, and current native runtime tests cover registration, authentication, journal ownership/persistence, cancellation and restart. Controlled provider responses in tests do not establish live provider delivery.

Reading jobs remain disabled by default. Remote database metadata/rollback, trusted guest identity, provider credentials, background lifetime, and an exact ready preview remain release gates in [the runtime README](README.md). No Cloudflare deployment configuration or provider rollout is changed by this port.
