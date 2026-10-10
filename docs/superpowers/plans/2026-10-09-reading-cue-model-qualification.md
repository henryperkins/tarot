# Reading Cue Model Qualification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce reproducible evidence that an independent visual model connects authentic reading passages to the right artwork details accurately, promptly and at a measured cost, before selecting a development-beta candidate.

**Architecture:** Freeze reading-only inputs and independently reviewed expectations, then exercise the existing visual provider, prompt builder, cumulative ledger and visual-job scheduler. Compare three explicit model/effort configurations with the same inputs and scoring. Measure browser visibility separately from server inference, and corroborate controlled delivery with fresh subscription-generated readings through the normal application.

**Tech Stack:** Existing ESM/Zod contracts, Node test runner, Workers AI, `ReadingVisualJob`, React reading surface and Playwright. No segmentation service, new animation library or narrative prompt changes.

**Spec:** [Reading imagery and motion](../specs/2026-10-08-reading-imagery-motion.md), [independent handoff contracts](2026-10-09-reading-visual-cue-handoff.md#handoff-contracts), and [React bridge production direction](2026-10-09-reading-gestures-react-bridge.md#independent-visual-cue-model-production-direction). This implements the live-qualification continuation of handoff Task 5; it does not replace the full-deck/artwork and device work in bridge Task 8.

## Global Constraints

- The reading model receives no visual-cue schema, catalog, routing instructions or tool calls. The visual model returns associations only and cannot rewrite prose.
- Annotation work cannot gate prose delivery, narrative completion or saving a completed narrative. Source offsets are absolute UTF-16 offsets in the exact delivered raw Markdown.
- One annotation request may be in flight and one latest source snapshot pending per visual job. Replacing pending work never replaces accepted cues. Held inspection wins; motion remains coalesced and visibility-gated.
- Reduced motion and restored readings have zero automatic arrival animations. Static associations and explicit revisit remain available.
- Keep production gesture gates off. No production deployment, remote migration, real-account modification, paid narrative API fallback or full-deck animation authoring belongs to this milestone.
- Freeze prompts and labels before candidate comparison. A changed prompt/model/catalog/source requires a new run identity; never overwrite historical evidence or tune against the reserved partition during a scored round.
- This plan is approved documentation, not a record of completed qualification. Checked steps record local execution; unchecked steps remain pending. Live evaluation must be explicitly invoked; default execution performs no inference.

## Review Focus

1. A compiler-valid cue selects the wrong painted detail, merges distinct pours, or invents personal relevance: independent target/span/context adjudication in Task 3.
2. Missing provider configuration creates useless jobs; failures or unknown usage appear free: readiness and complete attempt accounting in Tasks 1–2 and 4.
3. Fast/buffered prose outruns annotation, or mixed clocks make latency look better: accepted-source replay, separate clock domains and visibility measurement in Tasks 4–5.
4. Cross-batch returns, retries, regeneration and held inspection corrupt continuity or restart settled motion: actual ledger/job use and focused lifecycle cases in Tasks 4–5.
5. A reused fixture masquerades as unseen evidence, Spanish receives English offsets, or another deck receives RWS detail geometry: source-family freezing and edition/language scoring in Tasks 3 and 6.

---

## Qualification Contract

### Corpus and provenance

Use the 11 complete readings in `data/evaluations/narrative-samples.json`, generated `2026-10-07T23:23:59.556Z`. Current file SHA-256 is `b30c506a81f7cb360fb457fc2bd4825059d558b3a1f8862d5f0ab23f383fbe49`. Hash UTF-8 text without trimming or normalization; store exact source field paths and spread/question/reflections/deck metadata.

| Partition | Recorded sample IDs |
| --- | --- |
| Development | `single-new-role`, `three-card-transition`, `five-card-creative-project`, `celtic-deep-shift`, `spiritual-thoth-ritual`, `wellbeing-marseille-reset` |
| Reserved regression | `relationship-checkin`, `decision-crossroads-long-reflections`, `relationship-hypothetical-collaborators`, `celtic-general-focused-week`, `non-english-spanish` |

Add the exact 97-word `fixtures/three-card-transition.json` excerpt under ID `star-2347-excerpt`, development only. Its source run is `2026-10-07T23-47-19.908Z-5eqpUm`; excerpt SHA-256 is `1b3ec02d1af7a4ed04c522ae44c512152e38a5524e51187542064ffb4e683265`. Its original full-reading hash is a separate provenance field. The five-card fixture is byte-identical to its 904-word corpus reading; the 183-word Celtic fixture is an excerpt of its corpus reading. Keep each with its source family and count neither as another independent reading.

The 11 recordings have prior development/review exposure. Call the partition a **reserved regression set**, never an unseen holdout. Use the 24 positive and 22 negative standalone cases in `scripts/evaluation/fixtures/gestureAlignmentCases.json`, plus both outside-review probes in `tests/fixtures/reading-gesture-review-probes.json`, as named regression cases. Their selected-detail labels are incomplete and cannot establish precision without reviewing additional outputs. Add two explicitly derived context cases: `star-2347-excerpt` and `five-card-creative-project` with `reflectionsText: null`; preserve the question and prose, and label these context variants rather than original recordings.

Exclude the historical co-generated annotations in `fixtures/generated-gesture-readings.json` from model input and ground truth. Authored `fixtures/gesture-sidecars.json` may seed the approved Star choreography and relationship expectations, but still requires independent review. Do not silently combine evaluation runs or normalize reversed cards to upright spread metadata.

### Semantic scoring

Each reviewed opportunity contains `{ id, caseId, kind, targets, anchors, establishedByOpportunityIds, personalContext, required, rationale }`. `targets` uses existing `{ spreadIndex, detailIds }`; `anchors` is one or more approved exact `{ start, end, quote }` spans in that case's raw UTF-16 text. Alternatives let equally meaningful quotes match without rewarding a paragraph-sized quotation. Context is the existing typed exact reference or `null`. Resolve anchors and dependency IDs before any model call.

Match accepted cues one-to-one to opportunities: kind and complete target set must agree, the cue's exact quote must be wholly contained in an approved anchor, and required earlier literals/context must agree. Independently adjudicate span adequacy even for matched cues: a fragment such as “the” does not describe a pour or communicate its interpretation. Only cues adjudicated `supported` may earn matches. Choose maximum-cardinality matching with opportunity/cue IDs as deterministic tie-breaks. One merged pool/land cue cannot earn two literal matches; duplicate IDs across batches count once. Separately score target precision across every emitted target, cue precision, required opportunity recall, and literal/interpretation/balance/relationship/context counts. Rejected proposals count as structural failures, not accepted semantic precision successes.

Before scoring, a reviewer who did not author the prompt freezes opportunity labels. After inference, give that reviewer randomized candidate aliases and every accepted cue with its exact source, spread, edition and supplied context; hide model names and configuration. Each adjudication is `{ cueId, verdict: 'supported' | 'incorrect' | 'uncertain', targetVerdicts, spanAdequate, contextSupported, rationale }`; target verdicts cover every `(spreadIndex, detailId)` or whole-card identity target. A supported unmatched cue is reported as an extra. Supported extras can improve precision but do not retroactively enlarge required recall. Missing adjudication or unresolved uncertainty makes the result incomplete. The tested model cannot grade itself; an independent agent review is not a human usability study.

### Candidate matrix and gates

Compare `@cf/zai-org/glm-5.3-flash` at `low` (current baseline), the same model at `high`, and `@cf/zai-org/glm-5.3` at `high` (quality reference). These IDs/effort controls are documented in the [Flash](https://developers.cloudflare.com/workers-ai/models/glm-5.3-flash/) and [full model](https://developers.cloudflare.com/workers-ai/models/glm-5.3/) references. Keep temperature `0`, the same prompt/schema/catalog, `max_completion_tokens: 8192`, and the same configured deadline of `60000` ms. Record actual returned model identity where available; unknown stays unknown. Recheck availability and [pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) at execution time.

The following are predeclared **milestone targets**, not previously validated product guarantees:

| Gate | Required result |
| --- | --- |
| Integrity | Zero prose mutation, source/ownership crossing, wrong-card acceptance, unsupported-detail acceptance, non-RWS detail leakage, or fabricated context quotation/relevance |
| Traps | All 22 negative passages produce zero invented literal-detail associations; correct identity cues are allowed |
| Semantic quality | Cue and target precision each at least `0.95`; required opportunity recall at least `0.80`, both overall and on reserved RWS English readings; publish numerator/denominator per kind and partition |
| Central experience | All six approved Star opportunities recovered distinctly; five-card introduction, Ace/Queen relationship and authored thematic returns recover their correct earlier details; abstention cannot satisfy these cases |
| Context and language | Question-only variants remain complete without fabricated reflection references. Publish Spanish precision/recall separately against native-language spans; detail qualification requires the same precision/recall thresholds, otherwise declare Spanish identity-only support |
| Continuity | Cross-batch references remain valid; duplicate/reconnect results never restart settled automatic motion; held focus remains unchanged while prose continues |
| Association availability | On each controlled paced, burst and final-only scenario, at least `0.80` of required eligible opportunities receive a cue before their first visible interval ends; browser passage-receipt-to-cue-receipt p95 at most `10000` ms. Missed cues remain in the denominator; report late/static/revisit outcomes separately |
| Meaningful automatic accompaniment | In the paced Star case, the rendered stage visibly exposes both literal pours distinctly, reuses at least one established pour during its interpretation, and holds both at balance. In the paced five-card case, it exposes at least three introduced cards, the Ace/Queen pair and one thematic return. Each qualifying exposure lasts at least `600` ms while its associated passage and artwork are visible. Count actual correct-detail exposure and cue adoption, not just metadata receipt. Burst/final-only arrivals may coalesce; report their actual limited accompaniment without requiring backlog playback |
| Accounting | Every dispatched attempt has a recorded outcome; known token usage and pricing support a token-derived cost estimate. Unknown usage is not zero and prevents a cost-qualified verdict |

Report category counts, per-run variability and 95% Wilson intervals for proportions; do not infer population accuracy from this small corpus. A category with no labelled opportunities is unqualified. Receipt-only success qualifies association availability, not meaningful automatic accompaniment. Failure of an accompaniment gate can still yield a useful static/revisit candidate; it cannot be called qualified live accompaniment. Rank candidates meeting every relevant gate by highest required-opportunity recall, then highest cue precision, then highest target precision, then lowest browser receipt-lag p95, then lowest estimated cost; exact ties use manifest candidate order. If none passes, retain the gated baseline and document the next bounded experiment rather than lowering thresholds after seeing results.

## File Responsibilities

| Files | Responsibility |
| --- | --- |
| `functions/lib/visualCueProvider.js`, `readingJobs.js`, `visualCueObserver.js` | Consistent readiness checks and proposal-preserving inference metadata |
| `functions/lib/inferenceAttempts.js`, `src/worker/readingVisualJob.js` | Token normalization and private per-batch attempt/timing accounting |
| New `scripts/evaluation/fixtures/readingCueQualification.json` | Frozen source manifest, candidate matrix, labelled opportunities and gates |
| New `scripts/evaluation/lib/readingCueQualification.mjs` | Manifest validation, deterministic semantic scoring and gate decisions |
| New `scripts/evaluation/lib/visualCueEvaluationHarness.mjs` | Actual visual-job code with isolated local storage and real/fake AI adapter, bounded scheduling and browser relay |
| New `scripts/evaluation/evaluateReadingCueModel.mjs` | Dry-run/live CLI, comparison orchestration, budget accounting and immutable evidence |
| New `tests/readingCueQualification.test.mjs`, `tests/readingCueEvaluation.test.mjs`; existing provider/observer/job/usage tests | Offline regressions for the contracts above |
| New `e2e/reading-cue-qualification.spec.js`; existing bridge Playwright config and fixture helpers | Visibility/timing probes through the real reading renderer with a live annotation relay |
| New `docs/superpowers/reviews/2026-10-09-reading-cue-model-qualification.md` | Evidence-backed decision and outstanding limits, created only after execution |

Paths in this table are relative to the bridge worktree; the original fixture references above are under `output/reading-motion/`. Evidence goes into a new run directory under `output/reading-motion/evidence/cue-qualification/`; capabilities, credentials and private fresh-reading payloads stay in Git-ignored private storage.

### Task 1: Gate optional visual work before job creation

**Files:** modify the three readiness files above; extend `tests/visualCueProvider.test.mjs`, `tests/visualCueObserver.test.mjs`, `tests/visualSourceIdentity.test.mjs`, and `tests/readingVisualJob.test.mjs`.

**Interface:** export `getVisualCueReadiness(env) -> { ready: boolean, reason: null | 'missing_provider' | 'missing_model' | 'unsupported_provider' | 'missing_ai_binding' | 'invalid_effort' }` from the provider module. It checks the same explicit configuration as inference; callers separately require `READING_VISUAL_JOBS`. No provider/model defaults or network probes. Preserve injected test adapters without relaxing real entry-point checks.

- [x] Write table-driven tests for absent/blank provider/model, unsupported provider, absent `AI.run`, invalid GLM effort, absent DO and fully configured readiness. Assert unavailable cases start the narrative and issue its stable result ID, but perform zero visual DO initialization, observation, D1 result registration or `AI.run` calls.
- [x] Run `node --test tests/visualCueProvider.test.mjs tests/visualCueObserver.test.mjs tests/visualSourceIdentity.test.mjs tests/readingVisualJob.test.mjs`; confirm new assertions fail against binding-only readiness.
- [x] Implement the helper and guard both creation and observation. Keep read/restore access to already accepted cues independent of current provider availability; configuration removal must not erase saved associations.
- [x] Rerun the same command; require readiness and existing persistence/adapter cases to pass. Update only fixtures that intentionally simulate configured inference.
- [x] Review the scoped diff and commit only this task's paths as `fix: gate optional visual jobs on provider readiness`.

**October 9 local execution:** Readiness gates and regression coverage are implemented. The baseline passed 40/40; new tests reproduced 34 missing-readiness failures before the fix. Final focused checks passed 80/80, the root suite passed 3,318 with two opt-in skips, modified-path lint passed, and controlled handoff/persistence checks passed 9/9 and 4/4. Independent review found no issues in the task-only delta. Existing model-enabled fixtures now declare explicit fake provider configuration; no runtime bypass or live inference was added. The existing implementation and tests were subsequently reconciled into `codex/reading-cue-qualification-20261009`, based on the committed visual integration and separate Codex provider. The reconciliation retained the integration branch's source/privacy gates and passed its focused readiness, observer, identity and visual-job checks. The live beta worktree was read only.

### Task 2: Retain inference metadata without changing the cue contract

**Files:** modify provider, usage and visual-job modules; extend `tests/visualCueProvider.test.mjs`, `tests/inferenceAttempts.test.mjs`, `tests/readingVisualJob.test.mjs`.

**Interfaces:** add `runVisualCueAnnotationWithMetadata({ env, prompt, signal }) -> Promise<{ response, metadata }>`; retain `runVisualCueAnnotation(...) -> Promise<{ proposals }>` as the compatibility wrapper. `metadata` contains `{ provider, requestedModel, returnedModel, reasoningEffort, usage, startedAtMs, finishedAtMs, outcome, reason }`; `outcome` is `accepted`, `rejected` or `failed`, and `reason` uses the existing inference-attempt reason vocabulary. Usage is the existing `normalizeInferenceUsage` result, identifiers/counts only. Make normalization idempotent for this normalized shape so the existing attempt recorder cannot erase it. Metadata stays outside the strict model proposal envelope and public cue snapshots. Failed calls attach sanitized `error.visualCueAttempt` for the job recorder without exposing response text or credentials.

- [x] Write assertions for standard Workers AI token fields, nested reasoning fields and Codex flat `cached_input_tokens`/`reasoning_output_tokens`; absent counts stay `null`, and normalizing normalized usage preserves it. Include malformed JSON after a billed response, timeout, cancellation, structurally rejected proposals, equivalent batch retry and metadata-free injected adapters. Assert every real dispatched call records one attempt; accepted cue count and provider-call success remain separate outcomes.
- [x] Run `node --test tests/visualCueProvider.test.mjs tests/inferenceAttempts.test.mjs tests/readingVisualJob.test.mjs`; expect new metadata assertions to fail.
- [x] Implement the new provider result and private job accounting. Add flat/nested cached-token aliases to the normalizer without double-counting cache or reasoning subsets. `ReadingVisualJob.executeAnnotation` unwraps new results and still accepts proposal-only test adapters; its ledger continues to receive only `response`.
- [x] Run the same focused tests; require unchanged strict proposal validation and complete failure accounting. Unknown adapter usage is explicitly `unknown`, never inferred from text length.
- [x] Commit only this task's paths as `feat: retain visual inference usage and attempt metadata`.

**October 9 Task 2 execution:** `d475fba` preserves proposal-only compatibility while returning private inference metadata and recording per-dispatch attempts. Focused red/green: 23 expected failures, then 80/80 including affected narrative-job fixtures. Final root suite: 3,402 passed, zero failures, two opt-in skips; modified-file lint passed. Independent spec/quality review approved. Existing D1 recording remains best effort and does not prove crash-safe billing; live usage/cost and browser accompaniment await later qualification tasks.

### Task 3: Freeze the corpus, independent labels and scorer

**Files:** create the qualification manifest/library/test specified above. Reuse existing source fixtures read-only.

**Interfaces:** `loadReadingCueCases({ root, manifest }) -> Case[]`, where a case is `{ id, familyId, partition, provenance, raw, rawSha256, cards, deckStyle, artworkEdition, question, reflections, opportunities }`; `scoreReadingCueRun({ cases, ledgers, adjudications, gates }) -> { counts, byKind, byPartition, byLanguage, hardFailures, incomplete, semanticPassed }`. Gate decisions must retain counts and reasons, not just a percentage.

- [x] Write failing tests for changed source hashes, a source family split across partitions, an excerpt's parent hash mistaken for its text hash, UTF-16 accents/emoji and repeated quotes, merged Star pours, duplicate cues, a valid-but-wrong target, a semantically empty matched quote, missing reflection, unreviewed extra cues, unknown categories and RWS detail leakage on Thoth/Marseille. Assert incomplete selected labels cannot certify precision, one accepted cue cannot satisfy two opportunities, legitimate same-family context variants are allowed without increasing independent-reading counts, and candidate ranking follows the declared tie-breaks.
- [x] Run `node --test tests/readingCueQualification.test.mjs`; expect the new library/manifest to be missing.
- [x] Implement source resolution, validation, matching, Wilson intervals and the predeclared gates. Preserve original `deckStyle`; only the validated RWS edition supplies detail geometry. Treat identity-only decks as a separate category rather than a failed literal-recall denominator.
- [x] Populate complete labels for the 12 primary cases, standalone regressions and two question-only variants. Independently review/freeze them before inference. Save reviewer identity/role, label revision and manifest digest; incomplete labels block live scoring. Require explicit opportunities for both Star pours, their separate returns and balance, the five-card relationships/returns, and supported Spanish imagery.
- [x] Run `node --test tests/readingCueQualification.test.mjs`; require all manifest/scoring assertions to pass. Commit only manifest/library/test paths as `test: freeze independent reading cue qualification cases`.

**Local execution (2026-10-09):** Independent r2 labels are frozen for 62 cases (11 complete recorded readings plus one Star excerpt, 46 standalone regressions, two probes and two question-only variants). The manifest/scorer supports 74 planned evaluations per candidate without inflating independent-reading counts. Independent review found and verified fixes for pooled question-only abstention and wrong-card extras; incorrect targets now require explicit blinded `wrong-card`/`wrong-detail` classification. Current covering suite: 36/36; prior full suite: 3,432 pass, zero fail, two opt-in skips. No candidate inference yet. Manifest digest: `42071738c05223979622457bbc918215ba7e455d3d06bac170d969ae5ad799c3`.

### Task 4: Build a bounded live-model comparison runner

**Files:** create the evaluation CLI/harness/test specified above; reuse production provider, prompt builder, ledger and `ReadingVisualJob`. Keep existing controlled handoff/persistence scripts unchanged.

**Interface:** `runReadingCueEvaluation({ manifest, phase, live, candidates, repeats, maxCalls, maxEstimatedUsd, outputDir, aiAdapter }) -> Promise<RunReport>`. `phase` is `semantic`, `timing`, or `all`; default `live: false` validates and runs fake-adapter checks only. All real dispatches pass through the production provider. The local harness may use isolated in-memory DO storage plus a Workers AI REST-backed `AI.run` adapter; explicitly label this **live inference/local job harness**, not a deployed Durable Object or real-auth test.

- [x] Write failing offline tests for missing live flag/configuration, accidental credential inheritance, budget reservation before dispatch, failed requests consuming attempt slots, unknown usage, stale-source responses, cross-batch literal returns, cumulative-prefix resends, deterministic run IDs and cancellation cleanup. Assert fake mode makes zero network calls and immutable reports distinguish rejected, failed, coalesced and accepted work.
- [x] Run `node --test tests/readingCueEvaluation.test.mjs`; expect the missing harness/runner to fail.
- [x] Implement the harness and CLI. Semantic comparison uses two independent full-input runs per primary case/candidate; standalone regressions and question-only variants run once per candidate. Fresh jobs prevent cross-candidate cue history contamination. Timing sessions use the real one-in-flight/latest-pending scheduler; no extra retry loops or artificial prose delay to hide latency.
- [x] Implement a loopback-only, ephemeral browser relay owned by the harness for fixture prose and independent cumulative cue SSE. Browser access is scoped to the selected case/run; no public production replay endpoint, model credential or raw provider response is exposed. Stop all relay/background work on cancellation or completion.
- [x] Record git HEAD and relevant dirty-file digests, exact prompt/schema/catalog/manifest hashes, source bindings, requested/returned model, effort, all issued requests and analyzed prefix sizes, timings, per-proposal rejection reasons, final ledgers and usage. Public reports contain recorded corpus data and sanitized metadata only; private fresh-reading payloads/auth state never enter maintained artifacts.
- [x] Add a pricing snapshot with source URL/date, documented context limit and input/output/cache rates. Calculate token-derived **estimated** cost, not an invoice: cached inputs are a subset of inputs and reasoning a subset of outputs. Reserve the next request's conservative upper estimate before dispatch, using the documented model context limit as the input-token upper bound unless a verified tokenizer supplies a tighter bound, plus the output limit. Do not invent token counts from character length. If the bound is unknown, stop before dispatch. If actual usage is unknown, retain the worst-case reservation, mark measured cost incomplete and continue only within the remaining bounded allowance. Do not apply free-tier credits as zero cost.
- [x] Run `node --test tests/readingCueQualification.test.mjs tests/readingCueEvaluation.test.mjs` and `node scripts/evaluation/evaluateReadingCueModel.mjs --dry-run --phase all --output output/reading-motion/evidence/cue-qualification/dry-run`; require zero model calls and complete manifest/config validation. Commit this task's paths as `feat: add bounded independent cue model evaluation`.

Execution record (2026-10-09): implemented in `cb1158e`, independently reviewed and corrected in `4fceeae`. Current focused scorer/runner checks: **67 passed**; scoped lint and whitespace checks clean. Offline dry-run exercised **222 semantic evaluations, 18 timing sessions and 252 fake dispatches with zero model calls**. That preserved historical artifact records its precommit snapshot; the reviewed follow-up expands dependency identity and closes encoded-client/cancellation-accounting gaps. Live inference, independently adjudicated quality and browser accompaniment remain Tasks 5–6.

### Task 5: Measure when useful cues reach the reading surface

**Files:** create `e2e/reading-cue-qualification.spec.js`; extend the existing bridge Playwright configuration and fixture helpers only as necessary. Reuse Task 4's relay and existing reading context/gesture renderer; production timing hooks, if needed, must be opt-in and exclude raw/private content.

**Interface:** browser reports `{ caseId, deliveryMode, viewport, motionPreference, narrativeEvents, passageIntervals, cueReceipts, cueAdoptions, detailExposures, heldIntervals, completionAt }` using one browser `performance.now()` origin. Each interval references an exact source span/cue ID. An exposure records the visible stage's spread occurrence/detail IDs, automatic versus explicit origin, and start/end, independently of cue receipt. Server `availableAt`, annotation start/finish and commit times use the server domain; never subtract server timestamps from browser timestamps.

- [x] Write controlled tests for paced SSE, synchronous burst SSE and final-only delivery, a late visible cue accompanied by a later offscreen cue, holding through text completion, duplicate reconnect, source replacement, static restore and reduced motion. Assert no force-scroll, source equality, finite coalesced playback, unchanged held focus and zero automatic restored/reduced-motion animations. Include all six Star cues arriving together: six timely receipts must not pass the accompaniment gate if only balance is exposed. Test the upstream JSON response consumed by `ReadingJob` separately; a done-only SSE case is not proof of that path. Direct `/api/tarot-reading` JSON consumers currently lack this observer and remain outside the qualified app-job path; record that boundary rather than silently extending production routes.
- [x] Run `npx playwright test --config output/reading-motion/react-bridge.playwright.config.mjs e2e/reading-cue-qualification.spec.js`; confirm new probes fail or are absent before implementation, then connect the relay and rerun with a fake adapter until they pass without spending.
- [x] Implement exact passage receipt/render/first-visible/exit and cue receipt/adoption measurements. Count metadata arriving after a passage as late/static/revisit evidence, not a successful live gesture. Visibility is viewport evidence, never gaze. Record model round-trip, scheduler wait, growing-prefix token resends, browser receipt lag and narrative completion independently.
- [x] Freeze reproducible delivery schedules for the Star excerpt and full five-card reading: sentence-boundary paced SSE at a documented `25` words/second, burst SSE in one turn, and done-only SSE. Script visible-passage dwell at `180` words/minute without rewinding or slowing prose; keep held/offscreen scenarios separate from automatic timing denominators. These are controlled delivery/reading scenarios with live annotation, not measured narrative-provider streaming.
- [x] Rerun controlled browser checks on desktop `1100 × 1000`, phone `390 × 844`, and reduced motion. Exercise one meaningful revisit and a paired relationship, verify no horizontal overflow or companion-induced prose jump, and report screenshot/layout evidence without calling emulation real-device coverage. Commit only task paths as `test: measure independent cue arrival against visible passages`.

**Local instrumentation verified (2026-10-09/10):** `b5cc0d3` passed the complete 18-case offline browser matrix and 50 focused tests. Independent review found that a censored automatic window could qualify; `270f0b0` closes that gate, with 10 focused tests and two covering browser checks passing and scoped re-review approved. Both qualification gates now require a valid completed fixed-reader window. The earlier 18-case matrix remains immutable evidence for its original source; it was not rerun after the gate-only correction. All six fast-adapter automatic scenarios passed availability but failed meaningful accompaniment. No model inference or live qualification is claimed by Task 5; Task 6 remains pending.

### Task 6: Execute comparison and publish a bounded decision

**Files:** create a unique evidence directory and the dated review document specified above; update the two parent plans with actual results and remaining gaps. Do not mark broader handoff Task 5 or full-deck Task 8 complete merely because a local comparison passes.

- [ ] Verify the cleanly identified source/dirty snapshot, frozen labels, model availability/pricing and private Workers AI authentication. Use the isolated beta credentials/configuration; never load the primary checkout's `.dev.vars`. A live qualification round is limited to `600` total visual calls and `$15` token-derived estimated cost, including failures and live browser probes; stop before either limit. These are proposed evaluation ceilings, not production cost targets or authorization for deployment.
- [ ] Run the semantic matrix: `node scripts/evaluation/evaluateReadingCueModel.mjs --live --phase semantic --repeats 2 --max-calls 600 --max-estimated-usd 15 --output output/reading-motion/evidence/cue-qualification/ROUND_ID`. Validate the dry-run call plan first: 72 primary calls, 6 outside-review probes, 138 standalone regressions and 6 question-only variants, totaling 222 planned calls. No unbounded retries. Reserve the remaining allowance for timing and corroboration; use one round-wide budget ledger across commands.
- [ ] Obtain blinded independent adjudication of every accepted cue/target and unresolved extra; then score. Run timing for all three candidates on Star/five-card × three delivery modes, one session each, on the phone viewport. Preflight each schedule's worst-case call count from accepted source events, including completion. Allow the actual production scheduler to dispatch naturally: faster models may finish more requests and cost more; a fixed three-call session cap would bias comparison toward slower models. Run equivalent desktop and reduced-motion layout cases with the fake adapter. If the round-wide budget interrupts a case, report that case incomplete rather than a model-quality failure.
- [ ] Select only a candidate meeting the predeclared semantic gates. Corroborate through the ordinary signed-in local Pro surface with two fresh, non-sensitive RWS questions after prompt freeze: one three-card and one five-card reading using `gpt-6.1-sol`/`high` with live passage delivery enabled. Use the selected visual configuration and actual scheduler within the round-wide budget. Preserve exact joined prose equality, multiple visible updates before completion, independent cue receipt and source binding. Record new high-effort timings; previous medium-effort evidence is not substituted. Respect the private reviewer login/logout workflow and avoid editing/rebuilding during measurement.
- [ ] Independently review the fresh readings and cues under the same rubric, with raw data private. They provide small unseen corroboration, not deck-wide generalization. Report actual authentication/tier, mocks, local versus real services, denominator counts, failures, unknown usage, estimates, viewport/device limits and every gate. Include the model comparison and recommendation in the review document; if no model passes, write the failed gate and one bounded follow-up experiment.
- [ ] Before any scoped commit/push requested later, run focused tests, `npm test`, modified-path lint, build and `npm run docs:check`. Run narrative/release gates only if a later runtime change requires them, under the repository's subscription-only policy. Commit only reviewed evaluation/task changes and sanitized evidence; preserve all pre-existing unrelated work. Publication/deployment and migration application remain outside this plan.

## Completion Boundary

This milestone is complete when the offline harness/tests, independently frozen labels, bounded live comparison, browser timing evidence and independent decision report exist with all gaps stated. A qualified development-beta candidate does not mean production launch approval. Full-deck artwork optimization, broader unseen readings, real handsets/screen readers, expiry/re-annotation and remaining rollout contracts stay visible in the parent plans. In particular, this work evaluates cue selection; it does not turn the existing 146 static detail treatments into living cinemagraphs.
