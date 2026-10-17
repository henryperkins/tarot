# Post-reading model annotations implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add qualified, source-bound interpretation and personal-context annotations after a reading finishes, without delaying prose or the independent aligner release.

**Architecture:** The existing reading model remains unchanged. An explicitly eligible web reading can submit one immutable accepted final source to the independent visual job; validated results become static, revisitable associations. Durable admission, reservations and recovery remain separate from narrative delivery and from the deterministic aligner's live accompaniment.

**Tech Stack:** React/Vite, ESM contracts, Cloudflare Worker/Durable Object, D1, existing Workers AI adapter, Node tests and controlled Playwright lanes.

**Spec:** [Intent closure](2026-10-11-reading-intent-closure.md), [original imagery purpose](../specs/2026-10-08-reading-imagery-motion.md#purpose), [readiness and approved owner answers 5–6](../reviews/2026-10-10-reading-cue-readiness.md), and [independent annotation contracts](2026-10-09-reading-visual-cue-handoff.md#handoff-contracts). The sibling [aligner release plan](2026-10-11-reading-aligner-release.md) can finish independently.

## Global constraints

- This document authorizes planning for the model lane only. The subsequent aligner execution approval does not authorize model implementation, provider calls, model preview resources, migration or activation. The shared presentation/request gates and original-context interface are now implemented in the [aligner candidate](../reviews/2026-10-11-reading-aligner-release.md); they do not implement this post-reading scheduler or qualify any model.
- Preserve the selected candidate: full `@cf/zai-org/glm-5.3`, high reasoning, post-reading only. Do not substitute Flash or change the narrative model/provider/prompt to obtain cues.
- Preserve the future round's **$10 hard held-cost/spend ceiling**, including failures and unknown usage. The direction is approved; an actual round still needs a separate go-ahead and a finite call ceiling.
- **180 seconds is a proposed deadline**, not implemented or a promised service level. Current provider code defaults to 30 seconds and caps at 60 seconds.
- Eligibility is authenticated **plus/pro** in an explicit server allowlist, trusted web-reading origin/route and declared display capability. Guest/free, MCP, service principals and machine-authorized requests receive no new model work.
- The all-tier aligner lane makes zero annotation calls and does not wait for this plan, semantic qualification or preview model resources.
- Keep prose, exact UTF-16 source spans, supplied question/reflections, spread occurrence, edition and reversal intact. Missing/uncertain associations leave readable prose and manual inspection.
- Preserve the closed 183-dispatch round, its immutable artifacts, unknown-cost holds and `qualified: false`. Never reset its ledger or reuse its identity/output directory.
- Keep original live thresholds and failed results intact. A new post-reading scope cannot be called live accompaniment or silently inherit live qualification.
- Preserve dirty primary/beta/qualification worktrees and ports 8787/5175/8789/9235. Use explicit owned paths, isolated state, exact source/output identities and zero test retries.
- Future implementation records reviewed changes per task; commits and external release actions require the later checkpoint/release scope. Planning creates none of the proposed files below.

## Review focus

1. A late or substituted terminal result must annotate only the accepted final prose; no prefix dispatch or stale attachment (Task 4).
2. Concurrent initial/replay work, restart, deletion and limit rollover must not reset or double-spend the shared allowance (Tasks 2–3).
3. Model results arriving during held inspection or native text selection must not jump focus, scroll, replace prose or replay automatic gestures (Task 5).
4. Familiar card words, negation, another person's reflection and unsupported editions must not create plausible but false associations (Task 6).
5. Account/tier/config changes between admission and adapter invocation must stop work without leaking source or refunding uncertain dispatches (Tasks 3–4).

---

## Current boundary and file map

The consolidated checkout contains tier/display admission, initial reservations, exact-source recovery and static journal restoration. It still schedules live-prefix annotations when enabled. Current replay revocation scrubs prose/capabilities but retains `admission_scope`/`aggregate_scope` containing `user:${userId}` and `visual_owner_revocations.user_id`; complete identifier deletion is **not** implemented. See [retention finding](../reviews/2026-10-10-reading-cue-readiness.md#2026-10-11-replay-retention-checked-against-current-deletion-code).

| Responsibility | Existing paths | Proposed additions |
| --- | --- | --- |
| Approved policy and qualification record | `docs/superpowers/reviews/2026-10-10-reading-cue-readiness.md` | `docs/superpowers/specs/2026-10-11-reading-post-reading-model-policy.md`; `docs/superpowers/reviews/2026-10-11-reading-post-reading-model.md` |
| Request bounds and durable budgets | `functions/lib/readingVisualAdmission.js`, `readingVisualRetry.js`; `scripts/evaluation/lib/visualCueEvaluationBudget.mjs` | `shared/reading/visualCueCost.js`; `functions/lib/readingVisualBudget.js`; proposed `migrations/0039_reading_visual_post_reading.sql` |
| Final-source scheduling and adapter | `src/worker/readingJob.js`, `readingVisualJob.js`; `functions/lib/visualCueObserver.js`, `visualCueProvider.js`, `readingVisualJobs.js`, `readingVisualWebAdmission.js` | `functions/lib/postReadingVisualSource.js` |
| Source-bound static presentation | `src/lib/narrativeGestureSource.js`, `generatedNarrativePassages.js`; `src/hooks/useReadingVisualJob.js`; `src/components/journal/entry-card/RestoredReadingGestures.jsx` | `e2e/reading-post-reading-model.spec.js` |
| Evaluation and frozen evidence | `scripts/evaluation/runReadingCueQualificationRound.mjs`, `lib/readingCueQualification.mjs`, `lib/visualCueEvaluationHarness.mjs`, `shared/generation/visualCuePrompt.js` | `scripts/evaluation/fixtures/readingCueQualification.post-reading-development-20261011.json`; corresponding `post-reading-regression-20261011.json` |

All new names/interfaces below are proposals to implement in their owning task. Verify migration 0039 is unused at execution; if occupied, select the next number and update every manifest/runbook reference before review. Never edit migrations 0036–0038 to retrofit the design.

### Task 1: Freeze the post-reading product, deadline and retention contract

**Depends on:** Parent scope and owner answers; does not depend on shipping the aligner.

**Files:** Create the policy and review documents named above; modify only their current-status pointers in readiness.

**Interfaces:** Produce a reviewed policy object with `mode: 'post-reading'`, candidate/model/effort, `deadlineMs`, `outputTokenLimit: 8192`, `roundCapMicrousd: 10000000`, finite `maxCalls`, pricing identity, retention/reset rules and post-reading latency acceptance criteria.

- [ ] Record selected choices separately from proposals: full GLM/high, post-reading, plus/pro and $10 are preserved owner decisions; deadline, latency SLO, limit windows/reset and identifier retention remain design gates.
- [ ] Propose a **180000 ms dispatch deadline** for later benchmarking, while measuring queue wait, provider duration and final-source-to-usable-association latency separately. Require owner approval of deadline and p95/maximum readiness targets before scoring; do not infer an SLO from the timeout.
- [ ] Specify terminal-source semantics: no requests before accepted narrative `done`; exactly one initial dispatch per immutable final binding/fingerprint; optional existing bounded retry requires explicit eligible user action.
- [ ] Recommend durable budget epochs with explicit operator-selected boundaries, never automatic reset on restart/deletion/new reading IDs. Define per-owner/global rate, count and held-cost limits across initial and replay paths.
- [ ] Recommend keyed pseudonymous owner accounting keys and bounded retention with a documented key-rotation/epoch transition that cannot reset active limits. Decide treatment of existing raw replay scopes, revocation fences and expired guest claims before migration; do not claim hashing anonymizes retained identifiers.
- [ ] Obtain independent accounting/privacy review and the outstanding owner decisions. Record retention periods, purge trigger, late-write fence, rollover procedure and exact public wording; unresolved fields keep model activation closed.

**Acceptance:** A concrete reviewed policy exists; no provider/deadline/retention claim is promoted from proposed to approved without its recorded decision. The aligner release remains independent.

### Task 2: Prove actual-request reservation bounds offline

**Depends on:** Task 1's accounting design; no live calls required.

**Files:** Create `shared/reading/visualCueCost.js`, `tests/visualCueCost.test.mjs`; modify `scripts/evaluation/lib/visualCueEvaluationBudget.mjs`, `tests/readingCueEvaluation.test.mjs` and `tests/readingCueQualificationRound.test.mjs`.

**Interfaces:** `estimateVisualCueReservation({ requestBytes, chatTemplateMarginTokens, outputTokenLimit, pricing }) -> { inputTokenBound, outputTokenBound, reservedMicrousd, pricingId }`; integer USD micro-units, upward rounding, invalid/unknown inputs rejected.

- [ ] Write RED assertions that reservation includes exact UTF-8 serialized request bytes, approved fixed chat-template margin and all 8192 completion tokens, including reasoning usage where billed. Multibyte Spanish/emoji, long context, repeated literals and schema/tool overhead must be counted.
- [ ] Build a private read-only provenance table for **all 148 accepted historical calls**: exact sent bytes, usage fields, model/pricing identity and resulting bound. Missing original request bytes are explicit unknowns and prevent a proven-bound claim.
- [ ] Run `node --test tests/visualCueCost.test.mjs tests/readingCueEvaluation.test.mjs tests/readingCueQualificationRound.test.mjs`; record meaningful bound/rounding failures before implementation.
- [ ] Implement the estimator and compare every available historical usage record. Require bound ≥ measured billable input for every call; preserve the wider context-window reservation if proof or provider tokenization overhead remains incomplete.
- [ ] Freeze the chosen margin and price snapshot; before later live use verify current provider limits, high-effort usage accounting, pricing and caching semantics against official documentation. Never assume caching discounts in the hard reserve.
- [ ] Rerun the named tests; independently review the historical coverage table and all underbound/unknown cases. Keep raw prose/requests private and publish only aggregate evidence and hashes.

**Acceptance:** Conservative input/output/cost bounds are justified and reproducible. The historical `$0.0545485` known estimate is not a complete bill; no extrapolated cheap 74-trial promise is made.

### Task 3: Implement one durable admission and settlement budget

**Depends on:** Approved Task 1 policy and accepted Task 2 estimator.

**Files:** Create `functions/lib/readingVisualBudget.js`, proposed migration 0039 and `tests/readingVisualBudget.test.mjs`; modify `readingVisualAdmission.js`, `readingVisualRetry.js`, `readingVisualResults.js`, `src/worker/readingVisualJob.js`, evaluator budget/harness and their matching tests; update `public/privacy.html` only to approved actual behavior.

**Interfaces:** `reserveVisualDispatch({ db, policy, epochId, ownerKey, sourceFingerprint, dispatchId, reservedMicrousd }) -> admission | denied`; `settleVisualDispatch({ db, dispatchId, outcome, verifiedUsage }) -> settlement`. Initial/replay adapters and evaluator phases use the same invariants and shared persistent round identity.

- [ ] Write RED tests for simultaneous last-slot reservations, initial-plus-replay overlap, multiple cases/phases, process restart, duplicate dispatch IDs, expiry, deletion, new result IDs, epoch rollover, SQL failure and mutable provider/limits configuration.
- [ ] Run `node --test tests/readingVisualBudget.test.mjs tests/readingVisualAdmission.test.mjs tests/readingVisualRetry.test.mjs tests/readingVisualResults.test.mjs tests/readingCueQualificationRound.test.mjs`; retain failures before repair.
- [ ] Implement atomic count/rate/cost admission before adapter entry. Reject if **settled known cost + unresolved/unknown holds + next reservation > 10000000 microusd** for the future evaluation round; do not count known settlement twice.
- [ ] Permit releasing a reservation only with durable proof of zero dispatch; settle known billable usage once. Timeout, cancellation, connection loss, unknown usage or crash after possible dispatch retains the conservative hold and exhausted one-shot claim.
- [ ] Enforce per-owner and global budgets across initial and replay calls. Refused admission creates no provider call; retries do not reset counters or manufacture a new allowance. A cap change or rollover needs an explicit audited policy transition.
- [ ] Apply approved identifier minimization/purge while preserving non-content fences; migrate existing raw `user:${userId}` scopes deliberately. Test deletion during dispatch and late completion after purge without restoring prose, credentials, raw identifiers or allowance.
- [ ] Rerun the named suites and independent concurrency/crash probes; reconcile all attempts to outcomes, active reservations and unknown holds. Review migration forward/rollback behavior before any workerd or preview apply.

**Acceptance:** No unaccounted dispatch, overspend, implicit allowance reset or false complete-deletion claim. Unknown usage prevents cost qualification even when the cap remains protected.

### Task 4: Schedule one final-source annotation without touching narrative generation

**Depends on:** Tasks 1–3; preserve already implemented web/tier gate.

**Files:** Create `functions/lib/postReadingVisualSource.js`, `tests/postReadingVisualSource.test.mjs`; modify observer, both job classes, visual initialization/provider, `shared/contracts/visualCueBatches.js` envelope definitions, and `tests/visualCueObserver.test.mjs`, `readingJob.test.mjs`, `readingVisualJob.test.mjs`, `visualCueProvider.test.mjs`, `readingVisualWebAdmission.test.mjs`.

**Interfaces:** `buildPostReadingVisualObservation({ binding, raw, complete, deliveredEventId, acceptedAt }) -> observation | null`; accepted observation contains immutable exact final raw and application-owned `visualCueMode: 'post-reading'`. Carry that mode through trusted initialization, public visual envelopes and SourceFrame; model output cannot set it. Proposed activation config: `VISUAL_CUE_MODE=post-reading`.

- [ ] Write RED cases: zero annotations through arbitrary deltas; accepted `done` dispatches once; duplicate/reconnected done is idempotent; a final safe-fallback/non-prefix replacement annotates only replacement text; an error/cancelled narrative dispatches nothing.
- [ ] Add source substitution, stale revision, changed question/reflection/edition and completed-source-growth rejections; denied guest/free/MCP/service/machine requests and spoofed display header cause zero reservations and zero calls.
- [ ] Run `node --test tests/postReadingVisualSource.test.mjs tests/visualCueObserver.test.mjs tests/readingJob.test.mjs tests/readingVisualJob.test.mjs tests/visualCueProvider.test.mjs tests/readingVisualWebAdmission.test.mjs` and preserve RED evidence.
- [ ] Implement terminal-only dispatch **after accepted outgoing delivery**, without awaiting it in narrative completion/save. Retain exact fingerprint, cumulative validated ledger, monotonic revisions, stale-epoch rejection and the existing literal dependency checks.
- [ ] Recheck authenticated allowed tier, trusted web display capability, source ownership and immutable budget/provider settings after asynchronous work and immediately before dispatch. Client flags/headers alone never mint authority.
- [ ] Implement the reviewed deadline only after Task 1 approval; test fake-clock expiry, cancellation and unknown settlement at that exact value. Current 60-second cap must be changed explicitly; setting an environment value alone does not implement 180 seconds.
- [ ] Rerun the named tests and diff narrative prompt/backend files against the input checkpoint: this task changes no reading-model generation, provider selection, narrative prose or SSE pacing.

**Acceptance:** One owned final reading yields at most one initial annotation attempt; prose completes independently even while annotation remains unresolved. No new call is possible without all mode, tier, capability, provider and budget gates.

### Task 5: Make post-reading results static and keep the aligner independent

**Depends on:** Task 4 mode contract; consume the sibling plan's `readingGesturesEnabled(env)` and `readingVisualRequestsEnabled(env)` interfaces after its flag task, or implement that exact shared contract once under coordinated ownership.

**Files:** Modify `src/lib/narrativeGestureSource.js`, `generatedNarrativePassages.js`, `readingVisualStorage.js`, `readingVisualStream.js`, `src/hooks/useReadingVisualJob.js`, `src/contexts/ReadingContext.jsx`, and restored reading wrapper; create `e2e/reading-post-reading-model.spec.js`; extend matching source/state/storage tests.

**Interfaces:** `readingVisualRequestsEnabled(env)` requires presentation plus explicit `VITE_READING_MODEL_ANNOTATIONS=true`; it expresses client intent, not authorization. Application-owned `visualCueMode: 'post-reading'` makes model associations `automatic: false`; cached results remain inspectable when new requests are disabled. Add `mergePostReadingAssociations({ aligner, model, active, held, nativeSelection }) -> { associations, deferred }` in `generatedNarrativePassages.js`; deferred replacement is source-bound and discarded on source change.

Reuse the aligner candidate's implemented `buildReadingPersonalContext({ question, reflections, cards })` from `src/lib/readingPersonalContext.js` and `NarrativePersonalContext` disclosure without rewriting supplied notes. Its implemented `src/lib/savedReadingGestureSource.js` exports `reconcileSavedGestureSource({ previous, entry, restored, fallbackRunId })`; preserve validated `visualCueMode`/ledger when present, otherwise use its local static hydrate identity without inventing a server binding.

- [ ] Write RED tests proving deterministic live cues continue during pending post-reading work; accepted model cues add exact-source revisit targets but never automatic turns, even when the corresponding passage is still visible.
- [ ] Preserve an active aligner turn, exact held association, native text selection, keyboard focus, scroll and prose across metadata arrival. If a source-safe annotation replacement would disturb an active interaction, defer that DOM replacement until interaction clears; never invent an association to preserve appearance.
- [ ] Pin complete and restored behavior: metadata received ahead of rendered final prose waits for exact adoption; reload/reconnect/equal revisions never replay; reduced motion runs zero animations; late updates patch existing matching entries only.
- [ ] Run `node --test tests/narrativeGestureSource.test.mjs tests/generatedNarrativePassages.test.mjs tests/narrativeGestureState.test.mjs tests/readingVisualStorage.test.mjs tests/readingVisualStream.test.mjs`; record RED then implement the mode-specific projection.
- [ ] Keep original live-mode fallback suppression separate: only the new post-reading mode permits independent aligner autoplay while its model job is pending. Disabling model requests stops new work/subscriptions/retry controls while valid cached cues remain readable and static.
- [ ] Add controlled paid eligible/denied tier, hidden-tab, quotation selection, held-modal, reload, deletion and account-switch browser cases. Assert zero automatic model adoptions and no automatic scroll/selection/reveal/modal callback.

**Acceptance:** Post-reading annotations enhance deliberate revisit without impersonating live accompaniment. The aligner-only flag never sends model display capability, polls/resumes model jobs or starts replay.

### Task 6: Freeze a semantic rubric that measures the original meaning

**Depends on:** Task 1 scope; labels can be prepared independently of runtime implementation.

**Files:** Create the development/regression manifests in the file map; modify qualification loader/harness/runner and `scripts/evaluation/evaluateReadingCueModel.mjs` argument parsing, `shared/generation/visualCuePrompt.js` only if a separate prompt revision is justified, and `tests/readingCueQualification.test.mjs`, `tests/readingCueQualificationRound.test.mjs`, `tests/visualCuePrompt.test.mjs`.

**Interfaces:** New manifests declare `qualificationScope: 'post-reading'`, candidate `glm-5.3-high`, exact source/prompt/schema/catalog/price/policy pins and separate semantic, readiness-latency and static-revisit gates. Historical manifests remain byte-identical.

- [ ] Label original Star six distinct opportunities, all 25 five-card opportunities and the complete Celtic Hermit → Wands → lantern return → relationship against unchanged original Markdown. Require literal establishment before interpretive reuse, exact target ownership and independently justified optional context.
- [ ] Add independently authored **unseen** negation, metaphor-only card names, wrong owner/reflection, empty notes, question-only, duplicate occurrences, reversed interpretation, Spanish and unsupported Thoth/Marseille detail traps. Preserve the old reserved set as regression, not newly unseen data.
- [ ] Retain semantic thresholds: cue and target precision **≥0.95**, required recall **≥0.80** overall/reserved English RWS, central Star/five-card recall **1.0**, zero integrity failures and zero invented literals in the existing 22 negatives. Add traps without removing those 22; apply the same Spanish/question-only thresholds or explicitly restrict the qualified scope to identity-only there.
- [ ] Preserve continuity requirements: valid literal dependencies, zero source/owner crossing, zero fabricated context, zero reconnect restarts and zero held-focus changes while prose continues. Report identity, literal, interpretation, balance, relationship/return and personal-context support separately; a structurally valid envelope is not semantic correctness.
- [ ] Mark old **10-second receipt-p95 / 600ms automatic exposure** gates `NOT_APPLICABLE: post-reading scope`; retain original live failures and `qualified:false`. Replace them only with the explicitly approved readiness SLO from Task 1 and static/revisit tests, never a relaxed live pass.
- [ ] Add runner option `--mode post-reading`, restricted to this manifest/candidate; its `--phase all` schedules terminal-only semantic and readiness trials, never historical paced-prefix jobs. Dry run remains default and emits `modelCalls: 0`, planned calls/reservations, missing gates and `qualified:false`. Preserve the legacy scorer/mode; no `fullyQualified` verdict from fixtures or unresolved latency/accounting.
- [ ] Run `node --test tests/readingCueQualification.test.mjs tests/readingCueQualificationRound.test.mjs tests/visualCuePrompt.test.mjs`; review labels and frozen holdout separation independently before any prompt tuning or dispatch.

**Acceptance:** The rubric measures the original interpretive/personal connections, not merely card-name detection or image presentation. Changed product scope and unchanged semantic standards are explicit.

### Task 7: Close local controlled verification on one identified revision

**Depends on:** Tasks 2–6; provider calls remain disabled.

**Files:** Modify `output/reading-motion/reading-cue-remediation.playwright.config.mjs`, `scripts/lib/readingCueValidationSource.json`, `e2e/helpers/journalVisualRecoveryBridge.mjs`; update the model review record with exact source/output/run identities.

- [ ] Register the new browser spec in the owned offline fixture lane, extend the explicit source allowlist and fake provider adapter, and use actual request handlers plus durable admission/recovery state. Never reuse protected beta origins or real credentials.
- [ ] Freeze all affected bytes once; run `npm test`, `npm run lint`, `npm run build`, `npm run test:a11y`, and `npx wrangler deploy --dry-run --config wrangler.jsonc`. A bundle-only dry run applies no remote schema and proves no production behavior.
- [ ] In the existing owned validation harness, set `CUE_VALIDATION_LANE=fixture`, `CUE_VALIDATION_MANIFEST` to its fresh absolute private runtime manifest and `CUE_VALIDATION_EVIDENCE_ROOT` to a new absolute evidence directory. Run `npx playwright test --config output/reading-motion/reading-cue-remediation.playwright.config.mjs e2e/reading-post-reading-model.spec.js e2e/journal-visual-restoration.spec.js` across all eight Chromium/WebKit viewport/motion projects with zero retries.
- [ ] Record network isolation, modelCalls=0, exact identities, every failure/skip, cleanup and protected-state hashes. Review changed pictures under the parent's approved comparison rule; unchanged pixels never substitute for behavior tests.
- [ ] Independently review the complete diff, budget SQL/migration, source lifecycle and report accuracy. Resolve failures or retain explicit owner exceptions; do not transplant the two existing UI exceptions to new model cases.
- [ ] Attribute the retained duplicate-tab and rejected-successor exceptions to their existing paid model-recovery scenarios, including the shared reload-entry foreground/click failure point. New budget/retry/source changes require affected recovery checks; this model-specific evidence is not a prerequisite for A's separate no-model release.

**Acceptance:** Controlled local implementation is reviewable and reproducible; live semantics, pricing, latency, real account, device and preview columns remain NOT_RUN. No commit or release follows automatically.

### Task 8: Prepare, then separately authorize the new $10 qualification round

**Depends on:** Tasks 1–7 accepted, verified current provider access/pricing and a concrete finite call plan.

**Files:** Existing round runner, private new round ledger/output directory, new frozen regression manifest and the model review record. Never write historical round directories.

- [ ] Produce a dry-run packet: exact candidate/model/high effort, approved deadline, frozen inputs, call schedule, repeat policy, maximal reservations, adjudicator, latency SLO and total shared **$10** cap. Include proposed benchmark, semantic and any corroboration calls in the same allowance; reserve headroom before starting.
- [ ] If the planned full regression cannot fit, stop before dispatch and present its missing coverage. A smaller pilot can remain exploratory; no threshold, denominator, repeat or call count silently changes to obtain qualification.
- [ ] Obtain the separate live go-ahead against that exact packet. It must identify the new round ID, ledger, private provider config, finite max-calls and **no automatic retries/second allowance**. Neither this plan nor the previous $15/183-call round grants permission.
- [ ] After that authorization only, populate the task-prefixed variables below from the approved packet and execute the reviewed command. `--mode post-reading` is implemented in Task 6 before use; `--live` remains forbidden during planning/local implementation.

```bash
node scripts/evaluation/runReadingCueQualificationRound.mjs --live --mode post-reading --phase all \
  --candidate glm-5.3-high --max-estimated-usd 10 --max-calls "$CUE_POST_READING_MAX_CALLS" \
  --manifest "$CUE_POST_READING_MANIFEST" --round-id "$CUE_POST_READING_ROUND_ID" \
  --round-budget "$CUE_POST_READING_BUDGET" --private-config "$CUE_POST_READING_PRIVATE_CONFIG" \
  --output "$CUE_POST_READING_OUTPUT"
```

- [ ] Independently blind and score every output: remove model/effort/usage/latency/provider fields and reversible identifiers; retain a private randomized join. Count failed, missing, cancelled and budget-prevented trials in the declared denominators.
- [ ] Reconcile every dispatch, measured usage, unknown hold and readiness sample. Report semantic eligibility, approved post-reading SLO, cost completeness and static browser behavior separately; a timeout increase does not guarantee successful results.

**Acceptance:** Only a complete independently adjudicated run can qualify the stated post-reading scope. Any incomplete/failed dimension keeps model activation closed while aligner release remains available.

### Task 9: Prove real-account/preview operation, then request controlled activation

**Depends on:** Task 8 qualification and separate authorizations for real-Pro work, preview resources/migrations and release. Owner preview decision 7 and retention/privacy decision 9 remain gates.

**Files:** `scripts/lib/readingCueProProbe.mjs`, `e2e/reading-cue-pro-streaming.spec.js` (adapt its named scope truthfully or add post-reading cases); proposed `wrangler.preview.jsonc`; model review/runbook and approved privacy wording.

- [ ] Resolve harness I2 and I4/I5: derive eligibility from the exact adjudicated manifest/run, verify owned isolated frontend/API routing and existing shared allowance, and remove disabled-live scaffolds only through review. No asserted qualification boolean or protected-beta shortcut.
- [ ] Under separate account/model authorization, use the local reviewer procedure without printing credentials; prove a real plus/pro session completes prose first, obtains qualified static annotations, saves/reloads/retries within limits and logs out. Exercise guest/free/MCP/service rejection without model calls; do not reuse fixture auth as corroboration.
- [ ] Before provisioning, present a concrete preview Worker/D1 resource/cost/configuration plan or the owner's explicit gate redefinition. Current repository config has no preview environment; inventing a name does not create approval or infrastructure.
- [ ] In the approved isolated preview, apply **0036 → 0037 → 0038**, then any Task 3 migration, and the `ReadingVisualJob` class migration (`READING_VISUAL_JOBS` binding) in reviewed order. Verify migration status first; 0037 has non-repeatable ALTERs. Exercise actual workerd/D1/DO behavior, deletion, restart, duplicate dispatch and provider-disabled recovery before enabling a model.
- [ ] Complete model-lane physical Safari/VoiceOver/touch/200% text and handset checks on an approved reachable origin. Existing aligner device evidence carries only for unchanged behavior and exact source; new status/retry/late-arrival behavior needs affected checks.
- [ ] Request release against the exact reviewed candidate, qualified scope, chosen limits, privacy policy, preview receipt and rollback procedure. Required narrative/release gates use the owner's subscription; do not alter the reading model or substitute paid narrative credentials.
- [ ] Future activation sets reviewed provider/model/high effort, mode, allowed tiers, initial/replay budgets and separate presentation/model flags. Verify active Worker/version/traffic, schema, health/auth, real account behavior and assets independently after release.
- [ ] Demonstrate rollback by disabling new model admission/client requests: no new dispatch or retry, cancelled uncertain work retains its hold, valid saved cues remain static/revisitable, prose/aligner stay usable. Keep durable tables/class and revocation/accounting fences; do not delete the DO class as a disable switch.

**Acceptance:** Model activation is separately qualified, authorized and observable. Failed model gates never disable or delay a separately accepted aligner-only release.
