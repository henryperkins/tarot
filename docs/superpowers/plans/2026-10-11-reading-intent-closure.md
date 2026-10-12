# Reading Intent Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining reading-experience gaps through an independently releasable deterministic aligner and a separately qualified post-reading semantic annotation feature.

**Architecture:** Keep the existing prose renderer, occurrence-bound focus engine, authored artwork and saved-reading contracts. The aligner supplies conservative live identity/literal associations without annotation inference. A separately admitted model may later enrich completed immutable readings; it never writes the reading or blocks its delivery, and it is not a dependency of the aligner release.

**Tech Stack:** React/Vite, remark, existing motion/WAAPI controls, Cloudflare Worker/Durable Objects/D1, Node tests and isolated Playwright validation.

**Spec:** [Original imagery intent](../specs/2026-10-08-reading-imagery-motion.md), [original bridge milestone](2026-10-09-reading-gestures-react-bridge.md), and the dated [owner decisions](../reviews/2026-10-10-reading-cue-readiness.md#2026-10-11-revised-owner-answers-16-and-local-execution). This document reconciles those authorities. The [aligner execution record](../reviews/2026-10-11-reading-aligner-release.md) tracks the subsequent implementation approval, checkpoint and verification; unchecked work remains pending.

Type: current program plan

Status: owner-approved aligner execution in progress; model execution remains separate and unauthorized

Last reviewed: 2026-10-11 (America/Chicago)

## Global Constraints

- Preserve current prose, headings, section structure and interpretive depth; do not rewrite a reading to fit imagery or add annotation instructions to its reading prompt.
- Preserve the approved source-order policy: every fully rendered, still-visible, eligible connection gets its existing 1,800 ms turn; no captured autoplay backlog, forced scrolling or artificial prose slowdown. Water settlement remains 1,500 ms.
- Preserve explicit inspection priority, continued source delivery, already-revealed shelf availability, exact source/occurrence/edition binding, and static restored/reduced-motion meaning. Do not restore obsolete latest-only coalescing or concealed actual-reading shelf cards.
- Preserve the original 97-, 183- and 904-word fixtures and their provenance. Authored demonstrations are not general semantic evidence. Static artwork treatment is intentional and allowed; this is not a request for 78 cinemagraphs.
- Aligner: all web tiers, live identity and conservative English RWS literal cues, safe card links/manual whole-card inspection elsewhere, zero annotation-model calls. It must be independently releasable.
- Model: future full GLM-5.3/high candidate, post-reading only, explicitly allowed Plus/Pro cookie-authenticated web readers who display cues; no guest/free, MCP/ChatGPT or service-principal annotation. Default model configuration remains disabled.
- The future model experiment has a $10 hard held-cost/spend ceiling and requires separate execution authorization. The proposed 180-second deadline is not an approved or implemented SLO. Preserve the closed 183-dispatch round as unqualified, including unknown-cost reservations.
- Preserve [local owner acceptance with two exceptions](../reviews/2026-10-11-reading-ui-acceptance.md): composite 254/256 behavior, retained 696/696 matrix and aggregate picture approval. Exceptions remain failures in native reports. Do not repeat unchanged acceptance to obtain a different result or invent per-picture verdicts.
- Work in `/home/ubuntu/tarot/.worktrees/reading-review-consolidation-20261010`, branch `codex/reading-review-consolidation-20261010`. Preserve primary, original beta, `d970`, all retained evidence and listener ownership on 8787/5175/8789/9235.
- The original request authorized planning/document reconciliation only. The owner subsequently approved the scoped aligner next steps. Preserve the recorded authorization and release evidence boundaries in the aligner execution record; model inference/spending is still separate, and a source checkpoint is not production acceptance.

## Review Focus

1. A cue-displaying guest/free client or MCP caller must never start annotation inference; Lane A Tasks 1 and 5 and Lane M admission work pin this boundary.
2. A new runtime mode must not replace selected/focused prose or start model recovery on a saved reading; Lane A gate and browser tests cover selection, focus and zero dispatch.
3. Personal-context access must use exact supplied question/notes, survive long text and owner/source changes, and never invent a reflection; Lane A context task owns these checks.
4. Post-reading cues must bind to the exact finalized source and remain static on restored readings even if results arrive late; Lane M source/scheduler and presentation tasks own these checks.
5. Deleted content, unknown usage or cancellation must not reset spending allowance or resurrect a saved association; Lane M accounting, retention and race tests own these checks.

---

## Current source and evidence boundary

The initial review branch was at checkpoint `2fa4d6f`, followed by accepted working-copy changes. Those 103 owned changes are now checkpointed and remotely backed up as `d1e5c4d`; aligner implementation continues on top. It contains observed remote master `58c8a33` and the original bridge, visual integration and cue-remediation ancestry. Refresh refs/source identity before execution; these SHAs describe this reconciliation, not a future merge.

The current accepted non-Markdown freeze is `7eb82527c028b7bc52066670c8c117a1168d517259c901ff3a319a3e74b5976e`, covering 2,795 files. Retained preflight is 4,110 Node passes, two opt-in skips, and passing lint/build/bundle/static accessibility. Fresh journal evidence is 174/176; 80 unchanged prior cases produce the composite 254/256. Neither the source HEAD alone nor a documentation edit creates fresh runtime evidence. Exact receipts remain in the [acceptance record](../reviews/2026-10-11-reading-ui-acceptance.md).

The two approved exceptions are WebKit desktop-normal duplicate-tab recovery and Chromium phone-reduced rejected-successor recovery. Both scenarios exercise paid model retry/recovery in `e2e/journal-visual-restoration.spec.js`; they are not failed deterministic cue-matching cases and do not create a model-qualification prerequisite for A. Their observed failures occur during reload-entry foreground/click handling shared with ordinary journal use, so “neither can affect the aligner” is too broad. Preserve their exact cases, source identities, diagnostics and owner disposition. A verifies its own no-model save/reload and cached-static paths; changes touching shared paths require affected verification, and the old exception is not a blanket waiver for a different failure.

The 2026-10-10 failed model round stays closed. No current model is semantically qualified. Optimized builds and emulated WebKit do not establish physical Safari, VoiceOver, device performance, preview schema or production status.

## Two independent delivery tracks

| Track | Deliverable | Its dependencies | Explicitly not a prerequisite |
| --- | --- | --- | --- |
| [A: aligner release](2026-10-11-reading-aligner-release.md) | A gated, accessible card companion with conservative live cues, persistent personal-context access and usable saved/manual inspection | Scoped source integration, independent UI/model-off policy, affected browser/asset checks, device/accessibility/performance, an authorized release route | A qualified visual model, model spending/retention redesign, a paid model pilot, model-specific Pro corroboration |
| [M: post-reading model](2026-10-11-reading-post-reading-model.md) | Qualified semantic enrichment of a completed immutable reading, including supported interpretation, authentic personal context, relationships and returns | Its own admission/accounting/retention decisions, terminal-source scheduler, offline semantic harness, separately authorized bounded qualification, real Pro and model preview/schema acceptance | Shipping Lane A first; model design/offline work can proceed independently, while its UI reuses the same accepted renderer |

Model code or existing migrations may remain in a reviewed integration candidate only when their dormant behavior and schema requirements are proven. If Lane A includes those server changes, its deployable artifact still needs its own actual migration/DO compatibility assessment. “No model dependency” does not mean “ignore schema changes included in the release.” Lane A must choose a scoped UI artifact or validate the included dormant server changes before release.

## Intent-to-task map

| Original intent or gap | Disposition preserving approved changes | Owning work |
| --- | --- | --- |
| Prose, companion, shelf, local illumination, orientation and held inspection | Retain implemented behavior; verify affected paths after integration | A gate/context/browser tasks; M source/attachment regressions |
| Pool → memory, land → reinvention, balanced payoff; five-card semantic returns | Remain absent from automatic deterministic matching. Recover them only from validated authored or qualified model associations; never memorize fixture wording | M semantic contract, corpus and blind qualification |
| Meaning develops alongside the new prose | Live identity/literal accompaniment belongs to A. The approved richer model direction is post-reading; document that changed promise rather than claiming the original live-semantic goal passed | A public scope; M terminal-source scheduling and SLO |
| All cards appear gradually with their introductions | Keep authored focus emergence and the approved immediate inspectability of already-revealed real-reading shelf cards | A presentation regression matrix; no shelf reconcealment |
| Latest pending cue wins | Superseded by source-order visible turns, full 1,800 ms phase, no offscreen backlog | Existing playback contract; A timing decision |
| Long readings retain their question/notes | Add the later recommended compact, closed-by-default exact-context disclosure; retain local cue quotations | A context task, reused by M |
| Saved readings retain the same companion without model use | The aligner candidate now hydrates a static local source without a server binding; ordinary save/reload is covered by the explicitly adjudicated browser composite in the execution record. Local presentation identity never grants server ownership | A Task 3, consumed by M for valid cached annotations |
| Tap a painted detail to revisit its connection | Phrase-based revisiting is implemented. Direct image detail targeting remains an explicit design disposition below; do not claim literal prototype parity | Decision D2, then only its approved targeted implementation |
| All-78 meaningful artwork | Retain 151 authored details and the accepted picture pack; affected captures follow the approved pixel-comparison policy | A artifact/geometry checks, M semantic target validity |
| The companion indicates the card the reader drew | Owner approved retaining the current 1909-scan spread and vector companion at 23:20 UTC on October 11; highlights remain bound to the vector edition | D7; A Tasks 0, 3 and 5; any model catalog change follows M's freeze rules |
| Native accessibility and handset behavior | Still requires physical evidence, separately labelled for deterministic and model-backed presentations | A physical gate; M extends it only for changed behavior |

## Decision register

These are reviewable choices to resolve during the named task, not unanswered permission requests for writing these documents. Record the chosen value, rationale, affected cases and owner approval where needed before dependent behavior changes.

| ID | Required decision and recommended starting point | Blocks |
| --- | --- | --- |
| D1 | **Retained for A by execution approval. B1 highlight start:** retain complete ordinary-quote visibility plus the implemented complete-exposed-line exception for oversized quotes. Measure missed eligible opportunities and frame gaps separately. Earlier starts require an explicit alternative contract and fresh affected evidence; do not alter reader speed/scoring merely to pass. | A timing acceptance; any later change to cue-start policy |
| D2 | **Deferred for A by execution approval. Direct artwork targeting:** retain the accepted phrase/shelf interface for the first aligner release, with an explicit deferred-parity entry. If the owner requires prototype tap-on-pool/land parity, implement targets only for existing validated associations and edition geometry, with keyboard-equivalent revisit and ambiguous-overlap behavior specified before coding. Do not infer personal meaning from a tapped region. | Only the direct-artwork enhancement unless made a release requirement; leaving this undecided is not a claim of parity |
| D3 | **Integration cargo:** the 103-path accepted checkpoint is complete and excludes unrelated WordPress edits. The combined release still includes 48 server/shared/schema/config/package paths plus independent provider/service work; migrations 0036–0038 and the ReadingVisualJob class require upgrade/rollback verification. A UI-only extraction is an alternative artifact, not the current branch. See the execution record. | A integration checkpoint and any combined server release |
| D4 | **Preview route:** A's restricted guest replay is published on its own HTTPS Worker under owner approval; exact version and expiry are in the execution record. A production topology and M's Worker/D1 schema/DO resources remain separate decisions. | Applicable physical/preview/release steps, not independent offline work |
| D5 | **Model deadline/SLO and accounting:** design the post-reading deadline, expiry, actual-request upper bound, settlement/reset/global limits and failure UI. Use 180 seconds only as a proposed experiment setting; retain the $10 future-round hard cap. | M runtime and live experiment |
| D6 | **Retention and identifiers:** decide expiry for undeleted/expired guest claims and anti-abuse metadata; replace or explicitly justify retained raw user-ID scopes, and align public wording with actual deletion behavior. No retention duration is invented here. | M activation; any included server/privacy behavior affected by a release |
| D7 | **Resolved — retain current artwork:** the owner explicitly approved the 1909-scan spread and vector companion at 23:20 UTC on October 11. Keep authored highlights bound to vector artwork; no asset/geometry change is required. Ordinary-route tests verify the actual mapping and reversal before and after save/reload. | Decision closed; affected A browser evidence still required. A later artwork/catalog change invalidates affected pictures and M semantic pins |

## Task P1: Preserve and identify the executable source

**Files:** Read [consolidation provenance](../reviews/2026-10-10-reading-review-consolidation.md), [acceptance](../reviews/2026-10-11-reading-ui-acceptance.md), `wrangler.jsonc`, `package.json` and current owned-source manifests. Create private before/after source and Git manifests; no credential/session file enters the repository.

**Interfaces:** Produces `source-manifest.json` with base HEAD, working branch, per-owned-path SHA-256, unrelated dirty-path hashes and accepted evidence references. Both tracks consume this identity; new code gets a new identity rather than relabelling the accepted freeze.

- [x] Refresh `git status --short`, `git worktree list --porcelain`, `git fetch --all --no-prune`, and `git rev-list --left-right --count origin/master...HEAD`; verify expected worktree and no concurrent owner of the intended source files.
- [x] Record explicit owned paths, including new files; preserve both unrelated WordPress files, primary Azure work and historical beta/qualification evidence. The implementation manifest contains 54 paths.
- [ ] Resolve D3 for the deployable artifact; source checkpointing does not select or qualify deployment cargo.
- [x] Prioritize a reviewed checkpoint/remote backup of the accepted owned source before expanding implementation, once commit/push is authorized. Record the frozen-path manifest, private-evidence retention and remote SHA separately. Verify actual Cloudflare Workers Builds production/preview branch triggers before asserting a branch push cannot deploy; the repository's manual GitHub workflow alone does not prove that external configuration.
- [x] Preserve the recorded Azure ordering: porting/removal is separate work; merge landed master first when available, while the authorized no-wait fallback permits local reading work to proceed. Whichever change integrates second gets a new combined source identity and verification of affected overlaps. Record the eventual release order instead of silently porting primary edits or blocking all local work.
- [x] Verify current source bytes against the accepted manifest before integrating. Record every purposeful divergence and its affected verification; do not silently transfer acceptance to changed source.
- [x] When separately authorized to checkpoint, stage only that reviewed manifest and record the commit/remote boundary. No blanket `git add .`, cleanup, worktree removal or branch reset.

**Done when:** another implementer can reproduce the exact starting source and knows which evidence carries, which paths are unrelated, and which checks later changes invalidate.

## Task P2: Execute and review the tracks independently

**Files:** The two linked lane plans and their eventual new review records under `docs/superpowers/reviews/`.

**Interfaces:** Each task produces its own source identity, test results, review outcome and outstanding gates. Shared UI contract changes originate in A and are versioned; M depends on their interface, not on A being deployed.

- [x] Start A's source/gate work under the subsequent owner implementation approval; disjoint paths were delegated and shared focus/storage integration was serialized. M's design/offline implementation remains outside that approval and has not started.
- [ ] Close each task with named regression evidence and independent review. Preserve failures/interrupted results separately and do not sum repeat runs into one passing suite.
- [ ] Before any relevant provider integration, run the repository-required subscription-backed narrative gate; no paid API fallback and no reliance on GitHub Actions billing. Vision gates apply only if vision behavior changes.
- [x] Freeze an integrated revision before acceptance. Reuse unchanged picture verdicts only with exact source/context and decoded-pixel provenance under the owner's established policy; changed/mandatory pictures receive the required review.
- [x] Use A's existing task list as its single execution checklist and one dated release evidence record. The execution record contains the change-to-test map and fresh affected ordinary-route matrix. Historical plans/logs remain references; repository-required final checks remain required, and documentation edits alone do not reopen runtime acceptance.
- [x] Publish a separate readiness verdict for A and M. A has implemented and locally verified source with physical/cargo/release gates open; M remains unauthorized and unqualified. A can be ready while M remains disabled/unqualified; a model-disabled release must prove zero annotation dispatch, not merely an empty environment file.

**Done when:** each lane has an independently assessable release or blocked-gate record, with no cross-lane implication that model qualification or local browser success establishes the other lane's completion.

## Task P3: Keep planning and evidence statements reconciled

**Files:** This roadmap, both lane plans, the [readiness log](../reviews/2026-10-10-reading-cue-readiness.md), [playback contract](../reviews/2026-10-10-reading-cue-playback-contract-decision.md), [device checklist](../reviews/2026-10-10-reading-iphone-voiceover-checklist.md), [study index](../../../output/reading-motion/README.md), original bridge/qualification/remediation plans and [documentation index](../../README.md).

**Interfaces:** This roadmap owns current scope/order. Lane plans own executable tasks. Acceptance/closeout records own historical results. Original study/spec content remains the original intent, with explicit later decisions linked rather than rewritten into shipped claims.

- [x] Add current navigation and historical-status boundaries to the maintained copies in this consolidation worktree; leave original study/beta worktrees and raw evidence unchanged.
- [x] Reconcile source-order turns, oversized-quote eligibility, pending-model fallback suppression and bounded decoration with current source; record B1 retained for the approved aligner execution; a different start policy remains a separate design change.
- [x] Separate aligner physical/release acceptance from semantic-model qualification and preserve the local two-exception acceptance record.
- [x] During execution, update only the relevant current task/status and add new dated evidence. Historical failures, source hashes, model budgets and original owner approvals remain intact.
- [x] For this documentation checkpoint run `npm run docs:check`, a separate local-link/anchor check for the changed `docs/superpowers` and `output/reading-motion` documents (excluded by that script), and scoped `git diff --check`. Repeat these checks after future documentation changes.

**Done when:** no current navigation tells an implementer to resume in `d970`, reapply an accepted V10 patch, reopen the closed model allowance or require semantic qualification before the independent aligner release.

## Execution order and next action

1. P1 source/cargo record, then A's gate/context work; M's design decisions and offline preparation may proceed independently.
2. A affected acceptance and physical checks, then its separately authorized release. Do not wait for a model candidate.
3. M offline scheduler/accounting/semantic preparation, then separately authorized bounded qualification, real-Pro and preview acceptance; activate only after that lane passes its own gates.
4. Keep the existing accepted local UI record closed. New source work receives an appropriately scoped new record; this plan is not an instruction to repeat the completed acceptance batch.

P1 source checkpoint/backup is complete at `d1e5c4d`; the 54-path aligner implementation is checkpointed and remotely backed up as `c3463f1`. Its ordinary-route composite and local service-worker checks passed. The owner subsequently authorized the restricted guest preview, which is now published for iPhone review; actual physical/device observations, deployment-cargo selection and production activation remain open. The next model deliverable remains its written deadline/accounting/retention contract, not a live provider call. The documentation-only verification below describes the earlier reconciliation, not the later implementation or publication.

## Documentation reconciliation verification — October 11

The three new plans and fourteen maintained documents received a documentation-only review. `npm run docs:check` passed for 193 maintained Markdown files. Supplemental checks passed for all 330 local links and 15 Markdown anchors in the seventeen owned documents, plus 19 incoming anchor links from other repository documents. Scoped whitespace checks passed. The before/after snapshot confirms unchanged HEAD, all 2,773 tracked non-Markdown files and all 88 unrelated dirty paths. Independent plan review resolved the reduced-motion/restored distinction and the owner-decision anchor; historical inventory and budget wording were reconciled. No application tests, lint, build, browser/device run, inference, migration, staging, commit, push or deployment ran for this documentation request; retained runtime evidence above was not rerun.

## Supplement to the independent progress review — October 11, 21:35 UTC report

The owner supplied a second review after the initial reconciliation. The following is the historical 21:35 supplement, before the subsequent implementation approval and checkpoint. It preserves the findings at that time; current source/publication state is in the execution record.

- **New edition decision:** the [spread](../../../src/components/SpreadTable.jsx) uses RWS 1909 scan images, while [gesture settings](../../../src/lib/readingGestureSettings.js) select the vector edition and the [companion model](../../../src/hooks/narrativeReadingModelUtils.js) substitutes vector WebP images. D7 now owns this unresolved cross-surface choice. Existing vector-routing tests prove implementation, not approval of the combination. No new licensing conclusion is drawn from this inspection. The owner subsequently resolved D7 at 23:20 UTC by retaining this combination; see the current decision row above.
- **Exception scope:** both retained failures occur in paid model-recovery scenarios, but the failed reload-entry controls are shared. They are neither failed aligner matching tests nor proof that the new no-binding journal route is unaffected. A now names narrow no-model reload/expand/static-inspection checks in the two affected engine/motion contexts; the historical exceptions stay closed.
- **Independent Node rerun:** retained `~/.cache/claude-review-20261011/npm-test2.log` records 4,112 tests / 521 suites / 4,110 pass / 0 fail / 2 skips / exit 0, SHA-256 `529c6e3f232044de6c2433e161a07b415ae978edf2e8829744536e3d3e1daa73`. The earlier `npm-test.log` retains 4,055 pass / 32 fail / 3 skips / exit 1, including missing-Git/source-identity setup failures, SHA-256 `be20a81ce596c79cb9053cc9c9bc6acb4c819ee6d0c6565fd716bcd8aa1a731b`. The tested copy is absent and no copy/build/source-digest receipt was retained there, so its byte identity remains reviewer-reported. This is corroborating log evidence, not a replacement for the bound acceptance receipts. Separately rehashing the current checkout against the accepted manifest passed all 2,795 files with zero mismatches.
- **Git and evidence custody:** 31 HEAD commits absent from all local remote-tracking refs, 49 commits ahead of `origin/master`, and 60 ahead of local `master` measure different sets. The snapshot has 78 modified and 27 untracked paths; refreshed remote heads still show master `58c8a33`, bridge `9250f4c`, and no consolidation branch. The 391 qualification artifacts verified in d970 are excluded from consolidation; that establishes their preserved location, not that no other backup exists. P1 prioritizes a scoped source checkpoint/remote backup and separate private-evidence custody. The report's live Worker version and external deployment triggers were not reverified in this supplement; production-mode source still disables the companion.
- **Integration and workload:** Azure-removal edits remain in primary, but the recorded owner decision includes a nonblocking fallback for local reading work. Preserve that qualification. Included migrations 0036–0038 and the `ReadingVisualJob` class still need artifact-specific deployment review even with model requests off. Use the existing A checklist and change-to-test mapping; do not create another program ledger or rerun unchanged multi-hour acceptance just to refresh a status report.
