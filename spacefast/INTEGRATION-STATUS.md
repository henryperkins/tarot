# Spacefast integration status

Updated 2026-10-17 on `codex/spacefast-current-20261017`, integrating current master with the preserved prototype at `1150983b`. The original prototype remains recoverable. This branch has not been deployed.

The current port resolves the three source blockers found during reconciliation:

1. **Schema and SQL drift.** The native bootstrap includes Cloudflare migrations 0036–0038, retaining visual source records, claims, tombstones, foreign keys, and admission checks. The audit accounts for 312 prepared calls and 344 SQL variants, including consistent optional projections/joins. All compile and EXPLAIN on isolated MySQL 8.4. Native behavioral checks cover exact source matching, nullable JSON fields, journal attachment/deletion, owner revocation, concurrent initial reservations, one-dispatch replay, and stale-result rejection after a source edit.
2. **Scheduler.** Only the daily maintenance schedule is emitted. The authenticated historical video endpoint returns 410 without invoking maintenance or a provider. Cloudflare's retired cron remains a no-op; opt-in HTTP callers receive a structured skip.
3. **Job contracts and explicit feature scope.** Persisted prose jobs retain reading-result identity, visual binding, private initialization/token fields, and MCP error codes across restart/replay. The Spacefast feature profile supports prose and saved ledgers; model annotation dispatch and retry are explicitly disabled even if deployment variables opt in. The frontend uses the local prose/card aligner. A distributed `READING_VISUAL_JOBS` runner is outside this profile and has not been implemented.

Visual/source mutations share a transaction-scoped database lock, including journal edits and owner deletion. This deliberately favors correctness over concurrent write throughput. The same-connection transaction and result metadata contracts must be verified against the real Spacefast broker before release.

Local verification is recorded separately from remote readiness. A fresh native schema initializes successfully, the application artifact builds, and current native runtime tests cover registration, authentication, journal ownership/persistence, cancellation and restart. Controlled provider responses in tests do not establish live provider delivery.

Reading jobs remain disabled by default. Remote database metadata/rollback, trusted guest identity, provider credentials, background lifetime, and an exact ready preview remain release gates in [the runtime README](README.md). No Cloudflare deployment configuration or provider rollout is changed by this port.
