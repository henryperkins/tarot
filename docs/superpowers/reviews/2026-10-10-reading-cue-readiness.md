# Reading cue readiness record (Task 16)

Status: **not ready for release; production stays disabled.** This record maps every remediation task and gate to its evidence and its open limit on the candidate below. It authorizes no inference, spending, migration, deployment, commit or push.

This is the pre-consolidation candidate and evidence record. The user subsequently requested Step 1 consolidation; review-branch identity and integration checks are in the [consolidation report](2026-10-10-reading-review-consolidation.md). The subsequent [Step 2 repair report](2026-10-11-reading-activation-recovery.md) records local retention, admission and recovery changes. Findings below describe the historical snapshot; live, device and production acceptance remain open.

## Candidate identity

- **Source:** checkout `/home/ubuntu/.codex/worktrees/d970/tarot`, branch `codex/reading-cue-qualification-20261009`, HEAD `f24487d` (no upstream; nothing staged or committed by this work), plus the uncommitted remediation changes of Tasks 1–14.
- **Candidate snapshot:** byte-verified materialization `rt-final-candidate-3`, source digest `1bf34e18…` (2,255 files, 0 mismatches; `task-16-checks/final-candidate-3/materialize-receipt.json`). It differs from the earlier candidates `4d7a3fe0…` (used for `npm test` and `test:a11y`) and `695468a2…` (docs, links and diff checks) only in documentation and one test helper: the touch tap-point fix in `e2e/reading-gestures.spec.js`.
- **Evidence-run runtimes:** the complete qualification run (`86bd4f62…`), the journal recovery run (`86bd4f62…`) and the performance run (`8d4fe088…`) used runtime code byte-identical to the candidate; the snapshots differ only in documentation and test files (the final independent review compared them; later edits were test-only: the performance spec's warm-pass fixture fix, two lane guards, a projection unit test and a touch tap-point fix).
- **Qualification manifest:** `readingCueQualification.regression-20261010.json` (`manifestSha256` `a058bae0…`). All 207 binding pins match the candidate; the recorded dirty digest matches once five documented post-freeze test edits are reverted (`root-integration-11-12-13-7/verify-freeze-post-4.json`). See the [requalification record](2026-10-10-reading-cue-requalification.md).
- **Evidence workspace (W):** `.superpowers/sdd/2026-10-10-reading-cue-remediation-checklist/` (git-ignored). Evidence paths below are relative to W.

## Readiness dimensions

| Dimension | State | Source / run | Scope (auth, provider, device) | Evidence | Open limit |
| --- | --- | --- | --- | --- | --- |
| Semantic eligibility | **NOT_RUN** | frozen manifest `a058bae0…` | no provider; fake adapters | `post-integration/task7-dry-run/`: 222 planned semantic calls, 0 model calls, `qualified: false` | Live round needs a newly authorized budget, provider access and independent blinded adjudication |
| Live accompaniment | **NOT_RUN** | — | — | — | Real model receipt lag and semantics unmeasured |
| Playback contract (offline) | **Implemented; strict gates met in the final run; acceptance blocked on owner decisions** | runtime `86bd4f62…` | mocked auth; fixture cues through the production scheduler; emulated Chromium | `final-run/integrated-20261010/`: 25/25 (strict Star 6/6, five-card 25/25; nothing consumed unseen); Task 3 v5 review: Spec PASS, Quality APPROVED | B1 highlight start timing versus frame-gap sensitivity (v5 scored 19/25 under late gaps); B2 fallback-first duplicate introductions; B3 decorative atmosphere raster cost |
| Accounting / admission | **Offline contract only** | — | no provider | Tasks 4 and 6 reviews; Task 8 preflight approved for the offline scaffold | Live accounting NOT_RUN; Task 8 I2 residual (eligibility verdict still asserted) before any live procedure; replay limits unchosen |
| Saved recovery (journal) | **Accepted in automation** | Task 11 r2 + root r3 (approved together: Spec PASS, Quality APPROVED); runtime `86bd4f62…` | mocked visual provider receipts, seeded D1 accounts/sessions, in-process DO and handlers, emulated guest cookie; not real accounts | Node 115/115; `post-integration/journal-fixture-all/`: 136/136 across eight projects | Not browser-tested: cloud save while pending, cloud exhausted after reload, revoked replay; hook/component logic lacks Node coverage; review residuals R1–R3 and minors 6a, 6b, 6d, 6e and 7–12; expired entries keep a retry button that does nothing when replay is unconfigured |
| Artwork presentation | **Code approved; acceptance NOT MET** | Task 12 patch; captures on pre-integration snapshot `a5609b24…` | emulated Chromium and WebKit, fixture lane | `task-12-report.md`, `task-12-review.md` | B1 0 of 2,576 captures independently reviewed; B2 re-capture on the integrated revision; B3 five split and one paired composition predicted to clip (fix or gate); B4 narrow/short phone stages, text zoom, optimized build; B6 hidden/offscreen ownership lacks passing browser evidence across engines. (B5, the manifest re-pin, is resolved by the Task 7 freeze.) |
| Accessibility (automation) | **Chromium automation complete** | candidate `1bf34e18…` (eight-project gesture/lifecycle run) | emulated engines | `task-14-report.md`; `task-16-checks/final-candidate-3/` | WebKit streamed-prose lanes blocked by a pre-existing fixture limitation (controlled SSE does not stream in this WebKit build); physical speech is Task 15 |
| Physical accessibility / devices | **NOT_RUN** | — | — | Task 15 checklist and results template | No handset session, operator or approved device-reachable origin |
| Performance | **Structural budgets met in emulation** | runtime `8d4fe088…`, optimized lane | mocked auth/narrative transports; emulated engines | [performance review](2026-10-10-reading-cue-artwork-performance.md); `post-integration/performance-optimized-all-2/`: 24/24 | The whole detail registry (145 IDs) ships in the `MarkdownRenderer` chunk (about 159 KB; pre-existing), so "no full registry" is not established; decode, memory, handle and frame timing not measured even in emulation; Chromium desktop whole-flow layout shift 0.63–0.90 needs attribution; mid-range handset baseline NOT_RUN |
| Release authorization | **Not requested, not authorized** | — | — | — | See the runbook below |

## Task status

| Task | State | Evidence (commands and results) | Remaining gate | Next owner |
| --- | --- | --- | --- | --- |
| 1 | Complete | Task 1 report/review | — | — |
| 2 | Complete; diagnosis approved | Task 2 review | — | — |
| 3 | v5 approved; strict gates met in the final run; acceptance blocked | `task-3-report.md`, `task-3-policy-review.md` | Owner decisions B1–B3 ([playback contract](2026-10-10-reading-cue-playback-contract-decision.md)) | Owner (decisions), then root |
| 4 | Reviewed and integrated | Task 4 review | Live provider/pricing verification | Owner (authorize a live round) |
| 5 | Reviewed and integrated | Task 5 review | The development manifest is stale (14 of its 207 pins mismatch), so the Task 6 pilot command no longer loads it; regenerate it before any pilot | Root, before any pilot |
| 6 | Reviewed and integrated (documentation) | Task 6 review | Live pilot NOT_RUN | Owner (authorize) |
| 7 | Local freeze and offline dry run | requalification record | Live round NOT_RUN; a new freeze before any live round | Owner (authorize budget and provider), then root |
| 8 | Offline scaffold approved (r2); r2b follow-ups checked by the final review | `task-8-report.md`, `task-8-review.md`, `task-16-final-review.md` | I2 residual; isolated launcher disabled (I4/I5); live probes NOT_RUN | Root (I2, live mode), then owner authorization |
| 9 | Reviewed and integrated | Task 9 review | Migration 0037 local only | Owner (release) |
| 10 | Reviewed and integrated | Task 10 review | Replay limits (`VISUAL_REPLAY_LIMITS`) unchosen; recovery exercised only in-process (no workerd/wrangler run) | Owner (limits), root (workerd run) |
| 11 | Accepted in automation | `task-11-report.md`, `task-11-review.md` | See the saved-recovery row | Root (minors), device operator (speech) |
| 12 | Integrated; acceptance NOT MET | `task-12-report.md`, `task-12-review.md` | B1–B4, B6 | Root (B2–B4, B6), independent image reviewer (B1) |
| 13 | Structural budgets met in emulation | performance review | See the performance row | Root (measurements), device operator (handset) |
| 14 | Chromium automation complete; source change checked by the final review | `task-14-report.md`, `task-16-final-review.md` | Physical speech (Task 15) | Device operator |
| 15 | NOT_RUN | VoiceOver checklist and results | Device session | Owner (approve origin), device operator |
| 16 | This record | checks below; `task-16-final-review.md` | Owner decisions and the gates above | Owner |

## Candidate checks

| Check | Revision | Result | Evidence (W) |
| --- | --- | --- | --- |
| Root suite `npm test` | working checkout at `4d7a3fe0…` (differs from the candidate only in docs and an e2e spec the suite does not run) | 3,724 tests: 3,722 pass, 0 fail, 2 opt-in skips | `task-16-checks/final-candidate/npm-test.log` |
| Gesture and lifecycle specs, eight projects | candidate `1bf34e18…` | 143/184. Chromium phone 23/23 ×2; Chromium desktop 22/23 ×2 (only the phone-only `@mobile` test fails in desktop projects). WebKit desktop 13/23 ×2, WebKit phone 13/23 and 14/23: the same tests fail on the pre-policy baseline, which was run on `webkit-desktop-normal` only (controlled SSE does not stream in this WebKit build; CDP-only trace; `@mobile` in desktop projects); the phone projects show the same set plus one sporadic page error on WebKit phone, where WebKit blocked a Sentry error-reporting request and the spec's page-error check failed although the test body passed (3/3 on repeat). The touch tap-point helper was fixed for two WebKit races in the pre-existing 200% font phase (8/8 per WebKit phone project). | `task-16-checks/final-candidate-3/` (`gestures-fixture-all/`, `burst-repeat.log`); `task-16-checks/mobile-tap-fix*/` |
| Complete qualification spec (offline) | runtime `86bd4f62…` | 25/25 | `final-run/integrated-20261010/` |
| Journal recovery spec, eight projects | runtime `86bd4f62…` | 136/136 | `post-integration/journal-fixture-all/` |
| Artwork performance, eight projects (optimized lane) | runtime `8d4fe088…` | 24/24 | `post-integration/performance-optimized-all-2/` |
| Lane-guarded specs in their own lanes | candidate `1bf34e18…` | runtime-lane spec 1/1 (fixture lane); performance spec 3/3 (optimized lane, `chromium-phone-normal`); both skip outside their lanes | `task-16-checks/final-candidate-3/guard-*.log` |
| `npm run test:a11y` | working checkout at `4d7a3fe0…` (same `src/` as the candidate) | exit 0: contrast 24/24; WCAG analyzer 0 errors (1,138 pre-existing heuristic warnings) | `task-16-checks/final-candidate/test-a11y.log` |
| `npm run build` | fresh copy (`075a3bcd…`, runtime code as candidate) | exit 0 | `task-16-checks/build.log` |
| Scoped ESLint | working checkout | 97 changed source files listed, 95 linted (two `output/` Playwright configs are excluded by the ESLint ignore pattern): exit 0, 0 errors. That run predates the two lane guards and the tap-point helper; the three specs changed afterwards lint clean on their own (exit 0) | `task-16-checks/eslint-changed.log` |
| `functions/__tests__` | scratch copy (final review) | no suite imports a changed module (the final review ran `journalSearch`: 5/5) | `task-16-final-review.md` |
| `npm run docs:check` | candidate `1bf34e18…` | 183 maintained Markdown files, all local links resolve. (In the working checkout it also scans the git-ignored workspace, whose scratch copies of docs fail.) | `task-16-checks/final-candidate-3/docs-check.log` |
| Superpowers document links | candidate | 47 documents, 222 links, 1 failure, unchanged from the earlier baseline (a September plan links a Windows absolute path) | `task-16-checks/final-candidate-2/superpowers-links.json` |
| `git diff --check` | working checkout (tracked files only) | clean. Untracked files are not covered: among maintained ones only the 2026-10-09 round decision record has trailing whitespace (lines 3, 4, 6, 7; pre-existing); old runtime copies under `output/` inherit some | `task-16-checks/final-candidate-2/git-diff-check.log` |
| `ci:narrative-check`, `ci:vision-check`, `ci:release-check` | — | NOT_RUN: narrative-generating release gates are not invoked without a release request | — |

## Release runbook (prepared, not executed)

1. **Do not deploy this revision.** `npm run deploy` applies pending D1 migrations; this branch carries `0036_reading_visual_results.sql` (committed) and `0037_reading_visual_retry_state.sql` (local, untracked), plus the `READING_VISUAL_JOBS` Durable Object class migration (`reading-visual-jobs-v1`).
2. **Schema dependencies:** 0036 creates `reading_visual_results` and `journal_visual_links`. 0037 creates `visual_retry_claims`, `journal_visual_state`, `visual_owner_revocations`, `visual_result_revocations` and `visual_guest_principals`, then runs 12 `ALTER TABLE … ADD COLUMN` statements on `reading_visual_results` (4) and `visual_retry_claims` (8). It therefore depends on 0036, and it cannot be re-run once applied. Apply both in order, once, on a local or preview D1 first (`npm run migrations:apply:local`).
3. **Retention and privacy (release blocker until decided):** a retry claim stores the saved source (prose, question, reflections, cards) in `source_json`/`saved_fields_json`, its binding and a visual token. Deleting an entry or an account only marks claims `revoked` (account deletion also writes a `visual_owner_revocations` tombstone and deletes `journal_visual_state`). So a deleted account's reading text survives in `visual_retry_claims`, and no purge exists. Guest claims carry an aggregate scope derived from a hash of the client IP (`guest-edge:`) and a guest principal (`visual_guest_principals`). Choose a purge/retention policy and update `public/privacy.html` before enabling anything.
4. **Activation risks (release blockers):**
   - Configuring `VISUAL_CUE_PROVIDER` and `VISUAL_CUE_MODEL` with the `READING_VISUAL_JOBS` binding present makes every reading job — guests included — initialize a visual job with paid Workers AI inference, with no per-reading budget gate (`functions/lib/readingJobs.js`). Add an admission/budget gate first.
   - The gesture UI cannot be enabled in a production build without a code change: `readingGesturesEnabled` requires DEV or the `reading-cue-validation` mode plus `VITE_READING_GESTURES`.
   - Explicit saved-reading replay needs `VISUAL_REPLAY_LIMITS` chosen.
   - No model is qualified, so no `VISUAL_CUE_MODEL` can be chosen yet.
5. **Current configuration:** `wrangler.jsonc` sets neither `VISUAL_CUE_PROVIDER` nor `VISUAL_CUE_MODEL`; production secrets and dashboard variables were not inspected.
6. **Activation sequence (future, after every gate):** migrations in preview → Worker with the DO binding and the provider unset → verify saved-cue reads, journal recovery status, entry/account deletion and retention with the provider disabled → add the admission/budget gate → set the qualified model, provider and replay limits → verify live health, auth, a real Pro reading, accounting and asset parity.
7. **Rollback/disable:** unsetting `VISUAL_CUE_PROVIDER` stops new jobs; saved cues stay static and revisitable. Recovery is not purely status-only: an expired entry keeps a "Retry card connections" button that does nothing visible while replay is unconfigured — fix before relying on rollback. Keep the DO class (deleting it needs a `deleted_classes` migration).
8. **Release checks:** `ci:narrative-check`, `ci:vision-check` and `ci:release-check` use the owner's subscription and generate narratives; run them only for an actual release request.

## Local resources

Sixteen detached scratch worktrees under `/home/ubuntu/.cache/tableu-reading-cue-20261010/` (about 11 GB) are registered in the main repository's worktree list (`/home/ubuntu/tarot/.git`): `rt-task3-full`, `rt-task3-full-2`, `rt-task3-v3`, `rt-task3-v4`, `rt-task3-v5`, `rt-task14-v6`, `rt-int-preview`, `rt-int-preview-2`, `rt-final-integrated-20261010`, `rt-final-integrated-perf`, `rt-task16-checks`, `rt-final-candidate`, `rt-final-candidate-2`, `rt-final-candidate-3`, `wt-task11`, `wt-task12`. Some hold raw evidence (Task 12's matrix capture lives only in `wt-task12`). `rt-final-candidate` and `rt-final-candidate-2` received the tap-point helper fix after their receipts were written, so they no longer match those receipts; `rt-final-candidate-3` does. They are kept for reproduction; remove each with `git worktree remove --force <path>` when no longer needed.

## Disclosures

- **Browser runs were not network-isolated from Sentry.** `src/main.jsx` initializes Sentry with the production DSN and 10% trace sampling in every build, so the offline fixture, qualification, journal and optimized runs could send error events and sampled traces to the production Sentry project (one WebKit run surfaced a blocked envelope request as a page error). This predates the remediation; blocking the Sentry host in the validation configurations, or disabling Sentry in development and validation builds, is recommended before further runs.
- **The `@mobile` compact-relationship race appeared only after integration** (before: 3/3 passes; after: intermittent). The test-only helper fix addresses the measurement; physical text zoom remains Task 15 item P11.

## Not established

Live model semantics or qualification, live accompaniment, real Pro corroboration, physical iPhone/VoiceOver/touch, a mid-range handset baseline, production behavior, and any release.
