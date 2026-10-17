# Tableu on Spacefast

This is a separate Functions deployment of the existing Tableu Worker. The
Cloudflare configuration, frontend, and SQLite migrations remain their existing
deployment inputs. Spacefast uses its own project profile, artifact, database
schema, and binding adapters.

## Build and publish a preview

Install shared dependencies at the repository root with `npm ci`, then run:

```sh
npm run build:spacefast
sf publish dist-spacefast --prebuilt --target preview --space SPACE_ID --json
```

The root `sf.jsonc` selects `spacefast/project` for repository builds. Its
supported Wrangler profile prevents Spacefast's pre-build check from importing
the Cloudflare-only bindings. [Project settings](project/README.md) must also
match any settings saved on the existing GitHub connection. Use an exact source
commit and a preview target when creating a remote repository build. A local
dry run does not prove that the server's checkout builds successfully.

`scripts/spacefast-build.mjs` builds the real Vite frontend, embeds its shell in
the existing Worker, and emits a supported Functions profile with `nodejs_compat`
and five native MySQL migrations. It retains Wrangler's entry declaration:
Spacefast CLI 0.5.0 drops its Node compatibility flags when an explicit
`runtime.entry` selects the entry instead. Generated output and build evidence
are ignored by Git. The Functions compiler consumes the server source and SQL
migrations; they are not published as public static files.

Exact assets are resolved by Spacefast before the Worker. The Worker owns API,
OAuth, MCP, and share paths. SPA navigation returns the embedded shell; missing
files with asset extensions return 404 rather than HTML. Share pages retain the
existing dynamic social metadata.

## Database and services

The native database requires MySQL 8.0.17 or newer, InnoDB, and the no-pad
`utf8mb4_0900_bin` collation. See [database contracts](database/README.md) for
the reviewed SQL translations, quota locking, migrations, and broker checks.
The original SQLite migrations are fingerprinted: source schema drift fails a
Spacefast build until its native port is reviewed. The build also audits the
application's SQL call sites for unresolved or unsupported statements.
Publishing initializes a
Spacefast database; it does not migrate existing Cloudflare users or data.

| Existing binding | Spacefast implementation | Configuration |
| --- | --- | --- |
| `DB` | Reviewed SQLite-to-MySQL statement adapter | Native `DB` binding from the supported profile |
| `RATELIMIT`, `FEEDBACK_KV`, `METRICS_DB`, `OAUTH_KV` | Namespaced MySQL KV with exact keys, TTL, metadata, and pagination | Native database |
| `READING_JOBS` | Persisted jobs, leases, cancellation, owner isolation, and SSE replay | Disabled until background and provider lifetime verification |
| `AI` | Cloudflare Workers AI HTTP adapter | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` |
| `EMAIL` | Existing Resend fallback | `RESEND_API_KEY` and the existing sender settings |
| `R2_LOGS` | R2 HTTP adapter with Web Crypto SigV4 | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`; optional `R2_BUCKET_NAME`, `R2_ENDPOINT` |

Existing narrative, speech, payment, OAuth, and media provider variables remain
required for their enabled features. Provision secrets through the platform's
secret interface; do not place them in `sf.jsonc`, build defaults, or source.
Set `APP_URL` and `MCP_RESOURCE_URL` explicitly for production; previews default
to their request origin. Paid guest inference also requires verification of
Spacefast's trusted client-IP header contract before relying on the existing
`CF-Connecting-IP` identity resolver.

## Maintenance and background verification

Native maintenance routes are GETs at
`/api/maintenance/spacefast/video` and `/api/maintenance/spacefast/daily`.
Manual requests require the existing `ADMIN_API_KEY` bearer credential.
Scheduled requests use a secret path suffix; header presence alone is rejected.
Maintenance returns 503 when its opt-in task report identifies a failure,
including failures the existing best-effort Cloudflare scheduler logs.

Configure a random `TABLEU_CRON_SECRET` of 32 to 128 URL-safe characters, then
build with `TABLEU_CRONS_ENABLED=true` to emit the two schedules. Their paths
use `{{ vars.TABLEU_CRON_SECRET }}` substitution at publish time. Schedules are
disabled in the default preview artifact. Expired KV and job rows are cleaned
by the daily route; unread expired data remains stored until cleanup runs.

`GET /api/health/runtime` reports basic database reachability, dialect, build
revision, and whether the execution context exposes `waitUntil`. These facts
alone do not establish quota transaction or background lifetime behavior.

With the same explicitly enabled canary authentication below,
`GET /api/health/runtime/database` checks engine, collation, and the application
table's storage engine. POST checks the broker's per-statement counter metadata,
batch connection affinity, commit, and rollback using disposable canary rows.
It reports failed contracts and cleans up its records. A passing probe is a
prerequisite for testing application quotas on the real platform.

To run the administrator-only background probe, explicitly set
`TABLEU_RUNTIME_CANARY_ENABLED=true` and a `TABLEU_RUNTIME_CANARY_TOKEN` of at
least 24 characters (or use an existing admin key of that length). Authenticated
POST `/api/health/runtime/background` returns 202 and a status location. Poll it
from later authenticated requests. A durable completion after the real 45-second
delay establishes only that probe's lifetime bound on the exact build; pending
is inconclusive. It makes no provider calls and never enables reading jobs.
Verify the real provider's longest supported operation before setting
`TABLEU_READING_JOBS_ENABLED=true`. See [job behavior](jobs/README.md).

## Verification and remaining release gates

`npm test` includes route precedence, maintenance authentication/failure,
database compiler, binding, job, and canary coverage. Provider HTTP tests use
mocked services; they do not prove credentials or live provider delivery.
Native suites require a disposable MySQL database initialized with the emitted
migrations. Tests must not target production data. Environment setup is in the
individual database and job READMEs.

The complete Worker graph has also been exercised in workerd against actual
MySQL through a test broker: registration, login/logout, entitlement enforcement,
journal persistence/deduplication/listing, and share metadata pass. This test
broker supplies the transaction and metadata contract; the real Spacefast
broker remains a separate release gate.

Before production, verify the exact ready preview's database engine, migration
state, atomic counter metadata and transactional rollback; authenticated
account/journal/MCP flows; trusted guest identity; provider credentials and
delivery; and background lifetime. Compare the exact desktop/mobile build with
current design standards. A ready artifact or a green local suite is not proof
of production readiness.

Platform references: [Functions](https://spacefast.com/docs/functions/),
[database](https://spacefast.com/docs/database/),
[crons](https://spacefast.com/docs/crons/).
