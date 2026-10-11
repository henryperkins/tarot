# Reading activation and recovery repair — 2026-10-11

Step 2 is complete locally, including the independently reviewed browser account and individual-entry deletion fences: deleted visual payloads are scrubbed, initial visual spending is explicitly admitted, and unavailable saved-reading recovery shows truthful status while preserving prose and cached cues. The [consolidated review branch](2026-10-10-reading-review-consolidation.md) contains the repairs under the [bounded implementation plan](../plans/2026-10-10-reading-activation-recovery.md). Production and live qualification remain disabled.

## Source and scope

- Branch: `codex/reading-review-consolidation-20261010`.
- Worktree: `/home/ubuntu/tarot/.worktrees/reading-review-consolidation-20261010`.
- Step 2 base: `13fc7d618518a4b01d8d7b4901c664af85df4c09`.
- Evidence root: `/home/ubuntu/.cache/tableu-reading-step2-20261010/`, with a private parent directory. Source hashes, owned-path manifests, meaningful RED results, independent reviews and complete-run logs are retained separately from failed/interrupted attempts.
- Local implementation and controlled verification only. No real account login, live provider inference, live narrative generation, production migration, activation, push or deployment.

## Repairs

### Deleted source cleanup

Entry/account deletion captures owned original and replay transport identities inside the same D1 transaction that revokes work and scrubs retry-claim prose, saved fields, bindings, capabilities and parent/result/attempt identities. Account cleanup clears the direct owner column. Transport cancellation follows durable revocation, so a concurrent claim, late initializer or late commit cannot restore deleted source. Results still referenced by another saved entry remain available to that entry.

Initial capability admissions are removed and deleted result references are cleared from initial reservations. Non-content source fingerprints, scopes, revocation/version metadata, timestamps and aggregate count/cost accounting remain to prevent deleting and re-saving from resetting an allowance. Optional schema absence remains compatible; partial schema fails closed. Trusted original admissions saved before registration retain a verified expiry deadline in read-only detail/list projection.

### Initial spending admission

Original visual calls now require explicit `VISUAL_INITIAL_LIMITS`, pinned to the configured provider/model. Eight positive safe-integer fields bound scope/global rate, total calls and full conservative microUSD reservations. Every actual original call passes an atomic D1 reservation under trusted authenticated user or actual/trusted edge identity, independently of result IDs and guest-cookie churn.

All reservations stay held after failure, cancellation, timeout, rejected output, unknown usage or deletion. Captured immutable limits/provider settings and a final synchronous callback check prevent invocation under changed configuration. Missing SQL/configuration/attribution disables optional visuals while prose remains available; an asynchronous custom guest identity resolver is refused without waiting for its result. Restoration and transport reads do not schedule or reserve inference.

Migration `0038_reading_visual_initial_admission.sql` prepares the admission and reservation tables. Production allowances and provider/model activation remain unset in repository configuration. No remote migration was applied.

The evaluator exercises the production gate with explicitly labelled artificial offline fixture units. Future live evaluators require the complete private `initialAdmission` configuration before resources/provider work, bind it into source identity, and enforce retained initial accounting in the persistent round ledger across cases, models, phases and process restart. These bounds remain separate from the existing outer call/USD budget; successful usage settlement and trusted outer withdrawal cannot refund an initial hold. A trusted harness D1 adapter records the initial hold before the real production reservation SQL and links it to the later outer attempt without charging twice. Cancellation, lost configuration or SQL failure before provider entry retains that hold even after the case database closes. Historical qualification manifests and the closed round remain unchanged and unqualified.

### Configuration recovery

Cloud save/detail/list and explicit cloud/local refusal expose `configuration-unavailable` without repairing links, reserving inference or changing durable saved source/version. Failed, missing and expired states lose their retry action when configuration is unavailable. Existing valid pending/complete/exhausted/revoked work retains its stronger state and cached cues.

Pending work without a DO transport retains its attempt, attachment, fingerprint, version and snapshot, adds the configuration reason, and becomes status-only in the client. Explicit guarded refusal retires obsolete private handles; recovery classification, cloud polling and the component subscription guard suppress obsolete observation. Existing reserved work with its DO remains observable when only provider/new-call limits are missing. Reconfiguration restores fresh server availability; an available prepared claim carrying a historical configuration reason remains explicitly retryable.

Saved prose and accepted cached cues remain readable and statically inspectable throughout refusal and reload. An unavailable response can adopt valid same-source server cues only when the client lacks a cache. Stale owner/source/attempt updates remain fenced.

## Verification

This table records the completed Step 2 checkpoint `1e5c098`. Its 36 owned source/test/migration hashes were unchanged before and after that complete local pipeline. Logs and receipts are in `verification-final/` beneath the private evidence root. Later reading UI and browser storage changes have their own final-revision freeze and checks in the [current readiness record](2026-10-10-reading-cue-readiness.md).

| Check | Result |
| --- | --- |
| `npm test` | 3,894 passed, 2 opt-in skips, 0 failures/cancellations across 521 suites; 3,896 tests total. |
| Scoped ESLint | Passed for all 35 owned JavaScript/JSX/module paths. |
| `npm run build` | Passed. |
| Worker `wrangler deploy --dry-run` | Passed; bundle only, no deployment or migration. |
| `npm run docs:check` | All local links resolve in 193 maintained Markdown files. |
| Additional superpowers document links | 50 documents, 221 links, 0 introduced missing links, including final report/plan/pointers. One unrelated inherited Windows checkout link remains. |
| Controlled journal recovery browser checks | 48/48 passed in one complete run: six cases × eight Chromium/WebKit, desktop/phone, normal/reduced-motion projects; one worker, zero retries. |
| Independent whole-change code/test review | Approved; all confirmed findings and the pre-adapter retention boundary closed. |
| Original checkout preservation | Primary 116 dirty paths, beta 133 and qualification 4,005: HEAD/branch/status/index and every recorded dirty path match the Step 1 snapshots. |
| Original beta listeners | Ports 8787, 5175, 8789 and 9235 retain their original ownership. |

Focused real-SQLite, route, DO and client regressions cover atomic purge races, expiry, trusted attribution, concurrent admission, immutable dispatch settings, cold/read-only paths, configuration refusal and historical-reason recovery. Six successful multi-case/resumed-phase evaluator regressions failed before persistent count/rate/cost enforcement; three D1 pre-adapter retention regressions failed in a private copy bypassing only that bridge. All passed with the complete repair. Separate focused runs are checkpoints within the repair, not additional tests to add to the full-suite total.

Browser evidence is in `browser-evidence-final/` with log `browser-final.log`. The owned frontend snapshot digest is `3c03f9007e02154cc8243a857dd20d4e7f913e7d52932102eb6ad9e024a998ec`. Tests use seeded guest/local and personal Plus account fixtures, actual route handlers, real SQLite and an in-process DO host; every refusal scenario asserts zero provider calls. Checks cover status/action/focus, exact saved prose/cues/version, obsolete private handles, reload and no automatic retry/transport activity. No real Pro session, provider, physical handset or production behavior was measured. Runtime cleanup confirms child exit, source/output integrity and private state removal; all four owned listeners are closed.

An earlier full Node attempt failed/incompletely finished because evaluator fixtures lacked the new admission, with two additional failures caused by the private wrapper's inherited restrictive umask. Those causes were repaired; logs are preserved. The earlier browser attempt exited 130: five completed tests failed on the disabled HMR client's socket, one was interrupted and 34 did not run. Its owned runtime cleanup succeeded. A narrow frozen-runtime transform now prevents that unused HMR connection while retaining client exports; strict page-error assertions remain intact.

## Remaining gates

- The [Step 3 reading UI repairs](2026-10-11-reading-ui-acceptance.md) are complete locally. Final integrated artwork recapture, every pictured-detail review and affected browser checks are tracked by Step 4 in readiness.
- A new source/runtime qualification freeze; the old development manifest is intentionally not refreshed or relabelled. Live model semantics, verified pricing, live accounting and real Pro corroboration need their own authorized scope and budget.
- Physical-device, VoiceOver/speech and handset performance evidence.
- Preview/workerd schema and Durable Object acceptance, then separately authorized production migration/deployment and live version/assets/account checks. The browser backend here runs actual handlers with real SQLite and an in-process DO host, not workerd.
- Retention periods for undeleted/expired guest claims and public privacy wording for retained anti-abuse metadata. Deleted reading content is scrubbed; these remaining policy decisions concern retained metadata and undeleted guest data.

Local fixture evidence does not satisfy those gates. Production visual UI/provider activation remains closed.

## Follow-up: browser account deletion

The 2026-10-11 local acceptance audit found that ordinary logout did not purge a non-cloud owner's saved browser journal. Confirmed account deletion now synchronously purges that owner's journals, caches, insights, coach reflections/stats, original/replay capabilities and shared narrative entries before auth refresh. Guest and other-owner values remain. A persistent non-content owner marker fences queued updates, native cross-tab writes, low-level persistence, legacy import and cloud migration. Ordinary logout remains unchanged. A storage failure reports that browser cleanup was incomplete while preserving the successful account-deletion result.

Independent review found and closed two additional stale legacy-import/migration paths. The actual hook tests cover pending GET/final POST completion, guest-bucket preservation and ordinary account switching. Focused deletion/recovery checks passed 64/64 cases; the controlled AccountPage confirmation and auth transition passed all eight Chromium/WebKit desktop/phone normal/reduced-motion profiles. These are mock Pro/guest browser states, not a real account deletion or Pro acceptance.

Private follow-up receipts are in `/home/ubuntu/.cache/tableu-reading-step2-20261010/account-local-purge-20261011/` and `/home/ubuntu/.cache/tableu-reading-acceptance-20261011/`. The latter freezes all current acceptance source and independently verifies primary, beta, qualification evidence and protected listener preservation. Fresh full-suite totals and the final revision belong to readiness; focused counts are not added to that total.

## Final acceptance follow-up: individual browser entries

Final review found a concrete browser race: a journal list response captured before successful entry deletion could settle later and restore that entry and its prose to browser storage. Server revocation remains correct. A namespace-specific entry fence now guards delayed list/pagination/save/detail/retry/search updates, original and replay handles, and derived cache writes. Failed deletion must leave the entry usable; surviving entries, shared result references, guest data and other owners must remain intact. The 13 source/test paths passed independent review and 235 distinct focused actual-hook/callback/SQLite checks. Cloud deletion now exposes the existing atomic retired-result IDs without an additional query or inference, preserving unseen surviving aliases; incomplete retirement receipts report cleanup uncertainty. The repaired V4 source is frozen and fresh full acceptance is running in the readiness record.
