# QA and media reconciliation implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan inline, then request one whole-branch review.

**Goal:** Preserve unique work, port the missing QA safeguards and four narration fixes, refresh narrative evidence, and clean redundant Git worktrees and branches.

**Architecture:** Keep master's subscription-only evaluation policy. Share the production Claude prompt and request builder with an injected local CLI or private gateway transport. Port media changes individually onto the current implementation rather than merging older branches.

**Tech Stack:** React, Node test runner, Playwright, Cloudflare Worker, Claude Code subscription.

**Spec:** This document's Global Constraints records the approved inventory and implementation scope.

## Global Constraints

- Preserve both unique QA commits at `5c69417` on their own GitHub branch.
- Narrative qualification uses the owner's subscription; paid API overrides and fallback remain disabled.
- Pin model and effort per reading request, cap output at 32,000 tokens, disable the advisor tool, reject unexpected response models, and check local login before release checks.
- Local CLI and gateway evaluation must use the production `claude-api` prompt and request settings.
- Preserve monthly-limit messaging, route upgrades to `/pricing`, show elapsed time while stream duration is unknown, and warn about implausibly short audio pieces without logging reading text.
- Preserve the three existing QA runs, ignored evidence, loose plugin files, and unrelated `.impeccable` edit before cleanup.
- Retain `fix/media-followups`, the backed-up unique QA branch, `codex/narrative-remediation`, and the six open Dependabot PRs.
- Delete only merged branches at their recorded tips, and remove worktrees only after preservation is verified.
- Production deployment is outside this reconciliation scope.

## Review Focus

- Gateway model mismatches must fail as strictly as local CLI mismatches.
- Cancellation during CLI cleanup must never qualify a result.
- Unknown duration includes zero and non-finite values; assistive technology must not receive a fabricated completion percentage.
- Quota errors must survive queued narration teardown.
- Short-audio diagnostics must preserve existing charge/refund behavior and omit private text.

### Task 1: Preserve history and back up unique commits

**Files:** external private recovery bundle, archive, manifest, and logs.

**Interfaces:** Captures exact original refs and SHA-256 hashes; supplies preservation evidence to Task 4.

- [x] Create and verify an all-ref bundle and file archive.
- [x] Run `npm test` on the unique QA branch and replay its committed narrative gate.
- [x] Push the unique QA branch and verify the GitHub tip equals `5c69417`.

### Task 2: Subscription qualification safeguards

**Files:** `functions/lib/anthropicMessages.js`, `functions/lib/narrativeBackends.js`, `shared/inference/claudeCode.js`, `services/claude-code/runner.mjs`, `scripts/evaluation/lib/subscriptionNarrative.js`, `scripts/evaluation/runNarrativeSamples.js`, `scripts/evaluation/runReleaseChecks.js`, related tests and documentation.

**Interfaces:** `runSubscriptionNarrative(env, payload, requestId)` returns the existing narrative result; `verifySubscriptionLogin(options)` validates host login without generating text; request settings extend the existing gateway contract.

- [x] Add regression tests for request pins, advisor disabling, output cap, prompt parity, wrong-model rejection, and release-login preflight.
- [x] Run focused tests; confirm the new assertions fail before implementation.
- [x] Port shared request validation and runner changes; inject a subscription transport into the production Claude reading generator.
- [x] Preserve gateway exclusivity, existing cancellation handling, and paid-backend rejection.
- [x] Run focused tests; expect all assertions to pass.

### Task 3: Media fixes

**Files:** `src/components/ReadingDisplay.jsx`, `src/components/NarrationProgress.jsx`, `src/lib/audio.js`, `functions/api/tts.js`, `tests/audioReliability.test.mjs`, `tests/narrationReliability.test.mjs`, `e2e/media-narration-reliability.spec.js`.

**Interfaces:** Existing TTS state and accounting stay intact; diagnostic warnings contain piece index, byte count, and character count.

- [x] Add and run regressions for queued quota messages, short audio diagnostics, exact pricing navigation, and unknown-duration rendering.
- [x] Apply the four scoped fixes and run focused Node and rendered-browser checks.

### Task 4: Verification, evidence refresh, integration, and cleanup

**Files:** `data/evaluations/narrative-samples.json`, `data/evaluations/narrative-metrics.json`, scoped review report, private recovery manifest/logs.

**Interfaces:** Uses Task 1's preservation manifest and Task 2's qualified subscription path.

- [x] Retain the existing 19:46 run as historical evidence; generate a fresh run for the changed transport.
- [x] Run the full local release checks, build, scoped lint, docs checks, and Chromium/WebKit media verification.
- [x] Request whole-branch review, resolve material findings, and commit the reconciled changes.
- [x] Integrate the verified commit into local `master`, preserving loose files; keep publication distinct from reconciliation.
- [x] Verify archive hashes, clean merged worktrees, ancestry and exact tips before cleanup.
- [x] Remove redundant merged worktrees and local/remote branches; retain unique and archive refs.
- [x] Verify final Git inventory, recoverability, and loose-file preservation.

## Completion evidence

- Frozen source `14efa98` passed `ci:release-check`: 2,899 unit tests, 42 deployment tests, Cloudflare command validation, docs links, and 11 live subscription samples. Story spine and card coverage were 100%; no sample was flagged. Every response used the pinned `claude-opus-5-5` model.
- The qualified dataset was committed in `cb6af0f` and integrated into local `master`. The integrated checkout passed all 2,899 unit tests. Build, scoped lint, and ten Chromium/WebKit media cases passed; built Worker coverage included real local Pro authentication and mocked guest/Free/Plus quota cases.
- Whole-branch review found one mixed-model parser defect, fixed with failing-then-passing regressions for the parser, local CLI, and actual private gateway. No review findings remain.
- Nine original merged worktrees, eleven original merged local branches, and five merged GitHub branches were removed after preservation; approximately 6.3 GB was reclaimed. Both temporary verification worktrees and their merged branch were also removed.
- Two worktrees and three local branches remain: `master`, the backed-up unique QA branch, and `fix/media-followups`. The narrative archive and six Dependabot PRs remain on GitHub. The original `.impeccable` patch and all 30 loose plugin files match their backups.
- Vision photo qualification remains unrun because no held-out corpus was configured. Physical devices and live TTS-provider behavior were not tested. Local `master` was not published or deployed.
