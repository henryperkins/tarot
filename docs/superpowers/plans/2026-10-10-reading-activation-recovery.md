# Reading activation and recovery repair (Step 2)

Continue on `codex/reading-review-consolidation-20261010` in `/home/ubuntu/tarot/.worktrees/reading-review-consolidation-20261010`, starting at `13fc7d6`. This is the bounded Step 2 requested after the [consolidation report](../reviews/2026-10-10-reading-review-consolidation.md). The existing [remediation checklist](2026-10-10-reading-cue-remediation-checklist.md) supplies the source, ownership, retry and accounting invariants.

## Scope and constraints

Implement and verify locally. Preserve all original worktrees, beta listeners, raw evidence, exact saved prose, valid cached cues, source binding and narrative identity. Use controlled providers and seeded test identities only. No live inference, real account login, provider activation, production migration, push or deployment. Production visual gates remain closed. A new migration is local preparation, not rollout.

## Task 1: Scrub deleted visual payloads

Entry and account deletion must atomically revoke retry claims and remove reading text, saved fields, bindings and capability tokens. Retain only non-content tombstone metadata needed to prevent allowance reset. Capture owned original and replay transport IDs before scrubbing and cancel them after durable revocation. Late initialization, dispatch, hash and commit paths must fail their existing fences. Cover deletion and account cleanup, the concurrent claim-creation race, cancelled transports and same-source allowance retention with real SQLite tests.

## Task 2: Admit initial visual spending

Every original visual provider dispatch needs a durable atomic reservation under trusted user or edge identity and global limits. Provider configuration alone is insufficient. Require explicitly configured positive call/time limits and provider/model-pinned conservative integer USD reservations and ceilings. Missing/invalid configuration, untrusted identity and exhausted limits dispatch zero calls without delaying or failing prose. Result IDs and guest cookie churn cannot reset the scope. Retain full reservations for rejected, failed, timed-out or unknown-usage work; reconstruction and read paths cannot infer. Add schema preparation and controlled concurrency/DO/start regressions; leave production allowances unset.

## Task 3: Report unavailable retries

Cloud save/get/list and explicit local/cloud retries must report `retryStatus: unavailable`, `reason: configuration-unavailable` when replay configuration is absent. Preserve attachment state, exact source fingerprint, state version, attempt and cached snapshot; do not reserve or infer. Pending, complete, exhausted and revoked work keep their stronger state. Pending work without its DO transport also reports the configuration reason and stops client transport activity; existing reserved work with its transport remains observable when new spending configuration is absent. Client refusal removes the retry action, suppresses obsolete transport work and retains saved prose/cues. Cover expired cloud originals both when first loaded unconfigured and when configuration disappears before the click. Reconfiguration may restore availability on a fresh server projection without rewriting saved state.

## Interfaces and verification

Deletion and admission share only schema/cleanup metadata; coordinate their exact field names. Retry projection and client refusal share the public status/reason envelope. Implementers own separate code sections and test files; the controller integrates server projection and records evidence. Parallel ownership is scoped so unrelated original work remains untouched.

For each behavioral repair, observe a meaningful failing regression before the fix and a passing focused run afterward. Then inspect the whole diff, obtain independent review, run the root Node suite, scoped lint, frontend build, Worker dry-run, maintained and changed-document links, and controlled retry browser cases in an isolated owned runtime. Record exact test totals and evidence limits in the final repair report. Browser fixture evidence is not real Pro, live model, device or production qualification.

## Completion

All three tasks are implemented and independently approved locally. Fresh verification passed 3,894 Node tests (two opt-in skips), 48 controlled journal recovery browser checks, scoped lint, frontend build and Worker dry-run. The [Step 2 report](../reviews/2026-10-11-reading-activation-recovery.md) records source identity, complete evidence, preserved original worktrees and remaining gates. Step 3 playback/artwork acceptance and all live/device/production gates remain open.
