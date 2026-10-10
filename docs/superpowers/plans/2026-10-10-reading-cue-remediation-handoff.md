# Reading-cue remediation: resume prompt

Updated on 2026-10-10 after the user selected **Show both briefly**. The execution ledger has advanced beyond the original 04:18 UTC handoff snapshot: reviewed changes have been integrated and visible turn-taking is being tested. Read the current `W/progress.md` table and latest dated entry first; historical run results below retain their original scope. Do not interrupt another session’s active tests or change their frozen source.

Continue the local/offline implementation and verification of the 16-task checklist. The user previously said **Resume**; the latest request was **Provide a hand off prompt**. Resume the existing work, preserve unrelated edits and historical evidence, and finish all independent authorized work. Report required external gates plainly; do not manufacture full qualification.

## Checkout and first reads

Work in **`/home/ubuntu/.codex/worktrees/d970/tarot`**, branch `codex/reading-cue-qualification-20261009`, HEAD `f24487d089748c60716d61fe5f8b6c3056ca6eb9`. The primary `/home/ubuntu/tarot` checkout is heavily dirty and must be preserved. Do not move this work there or create a new plan from scratch.

Read the [16-task checklist](2026-10-10-reading-cue-remediation-checklist.md), repository `AGENTS.md`, and execution workspace:

`W=/home/ubuntu/.codex/worktrees/d970/tarot/.superpowers/sdd/2026-10-10-reading-cue-remediation-checklist`

Read `W/progress.md`, `W/global-constraints.md`, task briefs, final task reports/reviews and dependency records. Earlier dated progress sections are history; the current table and latest dated ledger entry supersede the original 04:18 UTC handoff snapshot. Relevant static audits are under W. Apply the existing Superpowers subagent implementation/review workflow with fresh implementers and independent reviewers, four concurrent slots maximum. Use scratch mirrors for independent work and exact before-hash validation when integrating.

## Authorization and invariant boundaries

- Local implementation, read-only research, controlled offline tests and reversible fixes are authorized. **No new live provider calls/spending, real reviewer login, private tunnel, physical-device claims, commit, push, production migration or deployment** is authorized by this handoff. The historical 183-attempt round is permanently closed. Pilot16calls/$3 and comparison600calls/$15 are proposals, not spending authorization.
- Preserve the original beta `/home/ubuntu/tarot/.worktrees/reading-gestures-react-bridge`, ports8787/5175/8789/9235, pre-existing dirty files, private credentials and historical output. Own only fresh isolated resources; never broad pkill, clean, reset or staging.
- Keep exact raw UTF16 prose/hash, ordered card occurrences/orientations, question and every per-card/Overall/legacy note context. Never rewrite/throttle reading text, force scrolling, add hidden cue backlog, relax the scorer or reuse frozen identities for changed source.
- Reduced-motion and restored/reannotated readings have zero automatic motion. Static illumination is intentional, not a missing animation.
- `VISUAL_CUE_PROVIDER` is unset in production; gesture/provider/release gates and migration0036/DO rollout remain closed. Migration0037 is local preparation only.
- Narrative/release QA uses the owner's Claude subscription at Opus5.5/xhigh with no paid API fallback. GitHub Actions billing lock is permanent and not a release prerequisite. Do not invoke a narrative-generating live gate merely to obtain green local checks.
- Filesystem permissions are unrestricted, approval policy never: do not pass `sandbox_permissions`.

## Approved playback decision

The user explicitly answered **Show both briefly (Recommended)** to: “For the Star example, should the illustration briefly show both the pool and land connections when their sentences are on screen together?” This resolves the earlier unanswered policy question. The illustration should give both still-visible connections a brief turn, while reading text continues normally. The current contract implements visible connections in source order using the existing full active phase; explicit held inspection takes precedence. Selection derives from current visibility, with no stored hidden backlog or later replay of passages already passed. Reduced-motion turns retain static meaning; restored readings retain zero automatic motion. No scorer, reader pace, text or provider-budget relaxation follows from this decision.

The current implementation and detailed contract are in `docs/superpowers/reviews/2026-10-10-reading-cue-playback-contract-decision.md` and the Task3 policy revision. The ledger records98 focused checks passing and strict browser controls running at the latest observed entry. This is implementation/testing progress, not complete accompaniment or live qualification. Preserve historical failed-run evidence under the earlier policy.

## Current status

| Task | State | Evidence / remaining gate |
| --- | --- | --- |
| 1 | Complete | Task 1 report/review; 385 originals, two projections; historical unknowns retained |
| 2 | Complete; diagnosis approved | 7 browser pass / 3 strict failures, complete windows; measurement12/12, lint; fresh review approved |
| 3 | Integrated (bounded repair + 3/13 merge); policy revision in progress | User decided 2026-10-10: skipped highlights are not acceptable. Visible turn-taking reducer revision: 98 focused Node pass; strict browser controls running; full25 rerun pending |
| 4 | Reviewed and integrated | 124 focused pass; review fixes approved; combined check225/224 pass with inherited Task9 recovery failure |
| 5 | Reviewed and integrated | 67 focused pass; dev manifest pins provisional and now stale after 3/10/13 integration (expected; refresh at Task 7 freeze) |
| 6 | Reviewed and integrated (doc only; evidence retained in mirror) | 10 trials/95 opportunities; zero calls/reservations; live acceptance NOT_RUN |
| 7 | Pending | Task acceptance not yet established |
| 8 | Pending | Task acceptance not yet established |
| 9 | Reviewed and integrated; recovery regression resolved by integrated Task10 | 75 prescribed pass; actual root suite green after Task10 and integration fixes; historical failure retained |
| 10 | Reviewed and integrated | 156 focused pass; root suite green after integration (readingVisualJob.test.mjs:502 resolved) |
| 11 | Mirror prepared; implementation pending | Dependencies and3+13 merge reviewed/integrated; refresh mirror for later policy/integration fixes before new implementation |
| 12 | Mirror/inventory prepared; implementation pending | 151 details/1208 presentations; captures/review NOT_RUN; overlays3/5/10/13 + clean overlap merge |
| 13 | Scaffold reviewed and integrated; root test fix pending review | Runtime test canary collided with tracked .npmrc in real checkout; fixed to never touch existing files; 14/14 in real checkout; measurements NOT_RUN |
| 14 | Pending | Task acceptance not yet established |
| 15 | Pending | Task acceptance not yet established |
| 16 | Pending | Task acceptance not yet established |

The table above reflects the latest ledger observed while recording this reply. Integration fixes, policy revision and browser completion still require their own final review/evidence; consult the ledger before resuming.

## Historical browser run closed for original handoff

Root-owned session91540 is **finished, exit130**. Do not poll or reuse it. The full25-case command stopped on user-requested handoff: **10passed,3strictfailed,1interrupted,11didnotrun**. The three completed strict failures are production-scheduler Star/five and source-active-phase five. Source-active Star passed. No thresholds, clocks, scheduler or prose were changed. The interrupted case was full-five-card paced reading.

Read:

- `task-3-full-browser-root.log`, `task-3-full-browser-root-exit.json`, `task-3-user-handoff-interruption.json`, `task-3-user-handoff-cleanup.json`.
- `task-3-browser-evidence/{fixed,red}` and `task-3-browser-evidence-hashes.json`:118 archived files. All1681 frozen runtime and mirror files were reverified with zero mismatches.
- All10 recorded owned frontend PIDs are absent and both listeners per owner are closed. One older interrupted worker has no cleanup receipt; independent absence is recorded without fabricating a receipt.
- The earlier subagent-owned run died during agent handoff after7 completed cases; its separate `task-3-handoff-interruption.json` and partial log remain historical. **Ending an agent turn with a running job did not preserve that process; keep the owning agent active until its jobs drain.**

Exact retained runtime directories:

`/home/ubuntu/.codex/worktrees/d970/tarot/output/reading-motion/task3-owned-runtime-s2j09ijn`

`/home/ubuntu/.codex/worktrees/d970/tarot/output/reading-motion/task3-owned-runtime-d717atbk`

At the original handoff, no runtime was active and that source/dirty-path freeze was released after verified shutdown. A later resumed session is testing the policy revision; check current ownership and freezes before editing source. The runtimes are retained for reproduction, not reusable final source identity. Old `task-3-running-handoff.md` claims RUNNING/session38234 and must not be followed as current state. Update Task3 report/command results with this interruption honestly. A future exact complete suite needs a new evidence identity and full reader windows; don't repeat long runs on each intermediate edit.

## Integration mechanics and shared-file merge

W contains `create_task_mirror.py`, `overlay_task_dependency.py`, `integrate_task_mirror.py`, immutable `.base-files` and `.baseline-index.json` in each `task-N-preparation`. Integration must validate actual before hashes and every owned path; preserve original snapshots/patches/review evidence. `.md.saved` scratch drafts map to real `.md` targets. The overlay helper supports `mirrorPath` and legacy `scratchPath`; Task3 manifest has now been normalized.

Tasks **1,2,3,4,5,6,9,10,13** now have their reviewed changes integrated; Task13 full performance acceptance remains open. The resumed session recorded39 guarded paths, zero before-hash conflicts and exact reviewed after-hashes in `root-integration-3-5-6-10-13/`. Task10 resolved the original recovery-provenance regression. Two actual-checkout integration defects were subsequently repaired: per-edition evaluation system-prompt admission and safe runtime-test canary handling. Those additional fixes require their own review. Do not reapply completed manifests or overwrite current policy changes.

Task3 and13 share `e2e/helpers/readingCueBrowserSession.mjs` and `e2e/reading-cue-qualification.spec.js`. Identical preserved common bases were verified. Root created a clean three-way merge at `W/task-3-13-combined/`, recorded in `task-3-13-combined-merge.json`:

- Helper SHA256 `49fcadd754ac7d781d0cc93d74bef139a7d2df7313e74471658e11ea964e0c37`.
- Spec SHA256 `8e32b146dcbdb4de417e33c58991a713652a09e1003027814dc992748e599c91`.

These merged files are in Task11/12 source and preserved baseline indexes; dependency records list3/5/10/13. The resumed session independently reproduced/reviewed the clean merge and integrated it with guarded hashes. A borrowed-runtime provenance-label limitation is documented in the ledger; browser exercise of both helper paths was still pending. The hashes above identify that merge revision, not every subsequent policy/source revision. Preserve each task’s frozen evidence and refresh prepared mirrors to the final reviewed dependencies before implementing further tasks.

Task13's malformed EOF patch artifact was corrected without code changes. New patch SHA256 `2281abf269cc863723978f50c03803fbad9e95b5ba755b627e116a98617758ac`; GNU patch reproduced all17 exact final files. See `task-13-patch-m1-correction.json`; old patch/report retained. Current report hash updated.

## Next work

1. Read the latest ledger and active-run ownership first. Do not duplicate the completed integration. Complete independent review of actual-checkout integration fixes and the visible turn-taking policy revision, then collect complete strict browser evidence and fresh root verification on the final revision. Preserve the interrupted historical Task3 run as incomplete.
2. Delegate Task11 and12 to fresh implementers in their prepared mirrors with `task-11-dispatch-context.md` / `task-12-dispatch-context.md` and full briefs. They must not alter active measured snapshots. No implementer is currently running; all previous reviewers completed.
3. Task11: expose **Retry card connections** through the real journal parent/hook. No inference on mount/poll/reconnect/reload. Fence account namespace, existing entry, full source, state version and active attempt at every await. Keep private visualJobId/token/capabilities/bookkeeping out of DOM/events/export/share; preserve exact prose and cached valid cues through rejected successors/offline/quota. Never upsert deleted entries. Cover controlled guest/local/cloud/tier/race lanes and static manual literal/pair/identity/release in both motion preferences. Use Task13 owned runtime; fake auth/provider evidence must be labelled.
4. Task12: capture every151 detail × orientation2 × viewport2 × motion2 in Chromium/WebKit; distinguish1208 required presentations from engine repetitions. Exclusive unique evidence, source/build/browser/media/viewport hashes, originals retained. Assign independent review of **every promoted pictured region**; contact sheets are derivatives, not a representative substitute. Fix reproduced authored geometry only; preserve reversal once/common plane. Verify finite water1500ms/trace1800ms ownership, hidden/offscreen/unmounted/settled/held behavior and no replay. Include pairs and recorded3/5/10 returns; authored probes are not model qualification. Any new source paths require an explicitly revised/reviewed Task13 allowlist/version.
5. Complete Task13's authorized local optimized measurements after source/art/UI fixes; Task14 accessibility with actual controls; prepare Task8 fail-closed genuine-Pro launcher/contracts and Task15 physical packet. Do not execute real-auth/live/provider-dependent lanes.
6. Final Task7 freeze must follow all relevant source/art/UI/runtime changes, including Task8 launcher changes. Preserve original manifest/labels and development-used partitions. Offline600/$15 proposal rehearsal remains0calls/qualifiedfalse. The playback choice is resolved; keep implementation/browser acceptance, native Spanish, real model/accounting, real Pro and physical gates open until their required evidence exists.
7. Task16: inspect final diff, root Node/function tests as appropriate, scoped lint, build, docs links and whitespace; write exact readiness rows and obtain independent final review. Explain each tested/baseline/blocked/NOT_RUN scope. Features stay gated until required qualification and separate release authorization.

## Verification baseline and known failure

Initial actual-tree `npm test`:3481total/3479pass/2opt-in skipped/0fail. After integrated4/9:3563total/3560pass/1fail/2skipped; sole failure was `readingVisualJob.test.mjs:502` internal recovered cue provenance loss. Task10 is now integrated and the regression is resolved. After the two later integration fixes, the resumed session records3663total/3661pass/0fail/2opt-in skips in `root-fixes-after-integration/root-suite.log`. This green run preceded the current turn-taking revision; focused98 checks on that revision do not replace final root/browser verification. Latest ledger reports276 maintained docs passing; earlier242-file result is historical. Superpowers document links require explicit checking because the maintained-doc scanner excludes that directory. Partial mirrors omit unrelated dependencies: use prescribed focused suites, never broad `npm test` there. Do not treat setup/missing-fixture failures as product regressions or overwrite historical logs.

Keep the user informed at least every60seconds of active work. If missing input is required, ask a concise tool question while continuing independent work. Do not repeatedly seek authorization already given for local implementation, and do not ask to remove the GitHub billing lock. No relevant memory hit was used in this run; no memory citation is required for this handoff.
