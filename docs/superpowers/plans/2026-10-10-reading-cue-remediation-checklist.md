# Reading Cue Remediation Implementation Plan and Checklist

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all six follow-up issues with reproducible evidence: preserve the failed qualification round, establish meaningful playback, improve semantic selection and accounting, qualify a candidate, recover saved readings, and complete artwork and physical-device validation.

**Architecture:** Keep narrative generation independent of optional visual annotation. Reuse the existing accepted-source observer, cumulative ledger, visual Durable Object, journal persistence, and React companion. Separate controlled rendering, live model quality, real application streaming, and physical-device acceptance; each has its own completion gate.

**Tech Stack:** ESM, Node tests, React/Vite, Playwright, Zod, Workers AI, Cloudflare Durable Objects, D1, authored RWS artwork, Safari and VoiceOver.

**Spec:** [Imagery and motion](../specs/2026-10-08-reading-imagery-motion.md), [source/lifecycle contracts](2026-10-09-reading-visual-cue-handoff.md), [qualification contract](2026-10-09-reading-cue-model-qualification.md), and [React bridge/rollout plan](2026-10-09-reading-gestures-react-bridge.md). Read the [completed round decision](../reviews/2026-10-09-reading-cue-model-qualification.md) before execution.

**Status, 2026-10-10:** At checklist creation, every action below was unchecked. This document authorizes no inference, implementation, commit/push, production migration, or deployment. The qualification worktree is `/home/ubuntu/.codex/worktrees/d970/tarot`, branch `codex/reading-cue-qualification-20261009`, inspected HEAD `f24487d`; existing report/parent-plan changes and evidence are uncommitted.

**Current status, 2026-10-10 evening:** Tasks 1–14 are integrated in the uncommitted checkout; per-task state, evidence and open gates are in the [readiness record](../reviews/2026-10-10-reading-cue-readiness.md). Nothing is committed, deployed or remotely migrated, and no live inference ran. The execution update below is historical.

**Execution update, 2026-10-10:** Local/offline work resumed by user request. Tasks 1–2 are complete with independently reviewed archival/diagnostic evidence. Task 2 retains three strict playback failures. Reviewed Task 4 accounting and Task 9 durable state are integrated; broader verification found one internal recovery regression assigned to Task 10. Tasks 3, 10 and the Task 13 scaffold are running in isolated scratch/runtime copies. New live inference, physical acceptance and production release remain separately gated.

## Global Constraints

- Preserve the primary dirty checkout and original beta at `/home/ubuntu/tarot/.worktrees/reading-gestures-react-bridge`. Never reuse or stop its ports `8787`, `5175`, `8789`, or `9235`. Identify listeners by current ownership rather than old PID numbers.
- The reading model receives no cue schema, artwork catalog, animation instructions, or annotation tools. Visual work must never delay narrative delivery/completion/save or regenerate saved prose.
- Source spans are absolute UTF-16 offsets in exact delivered raw Markdown. Bind source revision/hash, ordered spread occurrences/orientations, artwork edition/catalog, question and all supplied reflections.
- Keep one annotation request in flight and one latest source snapshot pending. Accepted cues survive coalescing; explicit held inspection wins. Never force scroll or play a captured backlog.
- Reduced motion and restored readings have zero automatic arrival animations. Missing annotations preserve readable prose, cached cues and explicit inspection.
- Freeze prompts, labels, schemas, catalog/assets, candidate order, pricing and schedules before scoring. Changed bytes require a new run identity. Keep historical manifests/results immutable; tune only development/named diagnostic cases, never the reserved regression or outside-review partition.
- Retain the original gates: zero integrity violations and invented literal details in all 22 traps; cue and target precision each `>= 0.95`; required recall `>= 0.80` overall and on reserved RWS English readings; all six distinct Star opportunities; five-card introductions, Ace/Queen relationship and grounded returns; complete question-only variants without fabricated reflection references.
- Controlled availability requires `>= 0.80` of required opportunities before their first visible interval ends and browser receipt-lag p95 `<= 10000 ms`. Qualifying automatic exposures last `>= 600 ms`. Keep paced delivery at `25 words/second`, the independent reader at `180 words/minute`, full uncensored windows, and separate server/browser clock domains.
- Compare unchanged candidate settings within a scored round: temperature `0`, `max_completion_tokens: 8192`, deadline `60000 ms`. Prompt caching is an experiment only after provider support is verified; it has no assumed latency benefit.
- Every dispatched call, including timeout/rejection/cancellation, consumes an attempt. Unknown usage retains a conservative reservation and leaves cost qualification incomplete. Held allowance and known estimated cost must not be added together.
- A new live experiment needs its own explicitly invoked scope and persistent budget; the finished `183`-attempt round is closed. The existing evaluator allows at most `600` calls / `$15` per round. New pilot ceilings below are proposals, not renewed spending authorization.
- Independent reviewers must not have authored the prompt or tested the candidate. Output packets hide model/configuration, effort, latency, usage, prompts and alias joins. Independent agent review is separate from human usability review.
- Use isolated local databases and owned servers. Production `VISUAL_CUE_PROVIDER` stays unset; production gesture gates, migration `0036` and DO rollout stay closed.
- Follow [repository guidance](../../../AGENTS.md) and [private reviewer login/logout](../../local-reviewer-account.md). Subscription-generated narratives use the authorized subscription provider, with no paid narrative API fallback. GitHub Actions billing is not a release prerequisite.
- At execution, capture the exact starting HEAD/dirty paths; stage only owned paths after review when commit/push is requested. A checked task must link its actual result, revision, mocks, commands and limitations.

## Review Focus

1. A fast metadata receipt hides a missed painted detail, wrong literal dependency, truncated quote or fabricated context: Tasks 2–7 score actual targets, spans and exposure.
2. A censored window, frame gap, post-window arrival, explicit revisit or mixed clock makes automatic accompaniment look successful: Tasks 2–4 retain negative controls and independent clocks.
3. A reservation rejection masquerades as model failure, or unknown usage releases allowance: Tasks 1, 4 and 7 classify admission separately and preserve cost uncertainty.
4. Expiry, duplicate clicks/tabs, deletion, source replacement or account switch creates duplicate inference or resurrects private/deleted data: Tasks 9–11 require durable claims and checks at every asynchronous boundary.
5. Correct desktop geometry/DOM roles hide reversed/compact clipping, substituted spoken prose, real VoiceOver focus loss or handset decode problems: Tasks 12–15 require rendered matrices and physical observations.

---

## Issue coverage and execution order

| Issue | Work packages | Completion evidence |
| --- | --- | --- |
| 1. Preserve the completed round | Task 1 | Portable, sanitized archive; corrected statuses and complete accounting |
| 2. Fast cues still miss meaningful accompaniment | Tasks 2–3 | Positive paced Star/five-card controls plus unchanged negative/lifecycle controls |
| 3. Low recall, invented details, latency and unknown usage | Tasks 4–6 | Correct accounting; frozen prompt revision; independently adjudicated development pilot |
| 4. New qualification and skipped real Pro probes | Tasks 7–8 | Complete semantic/timing decision and eligible fresh real application corroboration |
| 5. Expiry/failed-attachment recovery | Tasks 9–11 | Durable retry state; bounded authorized replay; static restoration and race coverage |
| 6. Artwork and physical product validation | Tasks 12–15 | Complete artwork presentation matrix, measured delivery, accessible controls and physical iPhone results |
| Production remains gated | Task 16 | Exact-revision readiness packet; separately authorized release and live verification |

Run Task 1 first. Tasks 2–3 and 4–6 are separate local work packages. Tasks 9–10 can progress with fake annotations. Complete Task 13's runtime/configuration scaffold before the non-qualification browser checks in Tasks 11–14; finish its measurements after the relevant artwork/UI repairs. Complete Tasks 2–6 and relevant runtime/artwork changes in Tasks 9–14, then freeze the selected revision before Task 7's final qualification. Artwork/catalog changes after scoring require new identity and affected qualification. Task 8 follows semantic eligibility and sufficient allowance; its new isolated launcher can reuse Task 13's runtime. Task 15 follows Tasks 7–14 for application acceptance; fixture-only device observations can be recorded earlier, clearly labelled. Task 16 follows every required acceptance gate. These are work dependencies, not instructions to spawn parallel agents.

### Task 1: Make the finished round portable and correct its completion claims

**Files:** Inspect the existing decision report, three parent plans and `output/reading-motion/evidence/cue-qualification/live-20261010-task6/`. Create `docs/superpowers/reviews/2026-10-10-reading-cue-round-closeout.md`, `docs/superpowers/reviews/2026-10-10-reading-visual-reannotation-audit.md`, and `docs/superpowers/reviews/2026-10-10-reading-iphone-voiceover-checklist.md`. Modify the decision/parent documents only to correct factual status and add portable references.

**Interfaces:** Consumes immutable round artifacts and the temporary preparation documents; produces an archive index with relative path, SHA-256, provenance, privacy classification and disposition for each retained artifact.

- [x] Record `git status --short --branch`, `git rev-parse HEAD` and existing dirty/staged paths. Keep historical round identity separate from the new documentation revision.
- [x] Inventory `/tmp/reading-cue-qualification-20261009-qp96bltd/` and repository evidence. Preserve the frozen driver/packet source and freeze hashes, plans, source/runtime identities, adjudications, scored semantic/timing results, final budget and cleanup records. Keep private joins, credentials, session state and any private raw prose outside Git in durable private storage with restricted permissions; never copy the temporary directory wholesale.
- [x] Copy the two preparation documents (`expiry-reannotation-audit.md` and `iphone-voiceover-validation-prep.md`) into the named repository review files. Remove machine-specific/private dependencies, retain historical inspected HEAD and preparation-only status, and link them from the closeout record.
- [x] Reconcile totals: `183` dispatches, `155` semantic + `28` timing, `148` accepted + `35` failed, `35` unknown-usage settlements, held `$13.7589453`, known token-derived estimate `$0.0545485`, measured cost incomplete, zero reserved attempts left. Confirm owned PID/state cleanup from artifacts; do not kill an old PID that could have been reused.
- [x] Correct the Full GLM distinction: seven semantic attempts, one accepted/completed trial out of 74 planned; budget prevented the remaining plan. No exercised negative traps is **unmeasured**, not a passing traps qualification. Classify zero-dispatch timing as budget-incomplete, while retaining missed opportunities in published denominators.
- [x] Reconcile per-session tables against `timing-scored-report.json`. Preserve the Flash High Star burst `1/6` receipt result; avoid replacing every Star session with the summary `0/6` shorthand. Distinguish provider latency, scheduler wait, browser receipt lag and rendered exposure.
- [x] Replace misleading completed fresh-probe claims with explicit `SKIPPED: semantic ineligibility / insufficient allowance`. Include per-kind/partition/language/edition/repeat numerators, denominators and Wilson intervals, or link the exact sanitized score artifact that contains them.
- [x] Verify the archive can be read without `/tmp`. Run `npm run docs:check` and `git diff --check`; separately validate local links in the new/modified superpowers documents because the maintained-doc checker excludes that directory.

**Acceptance:** Another engineer can reproduce the decision and identify private archival locations from a fresh checkout plus authorized private storage. The report remains `qualified: false`; “written locally,” “committed,” and “pushed” are recorded separately. Missing historical data remains explicitly missing.

**Result:** [Portable round closeout and verification](../reviews/2026-10-10-reading-cue-round-closeout.md), reviewed locally. Historical missing provenance/exit-code records remain explicit; no new inference or publication.

### Task 2: Reproduce playback failures and establish genuine positive controls

**Files:** Inspect/extend `e2e/reading-cue-qualification.spec.js`, `e2e/helpers/readingCueBrowserSession.mjs`, `readingCueBrowserCollector.mjs` and `readingCueBrowserScoring.mjs` in that helper directory; extend `tests/readingCueBrowserMeasurement.test.mjs`. Use `e2e/helpers/readingCueFrontend.mjs` for the existing owned, credential-free, HMR-disabled frontend.

**Interfaces:** Preserve `openCueBrowserSession({ page, frontend, caseData, candidate, aiAdapter, live, budget, deliveryMode, outputDir, viewport, motionPreference, lane, reader })` and `scoreCueBrowserReport({ report, opportunities, cues, matches, offline })`. Diagnostics join an opportunity's source receipt, visible interval, cue receipt/adoption and actual detail exposure.

- [x] Run the unchanged fast-adapter paced Star/five-card controls on the current revision. Record results by opportunity, not just a passing Playwright exit; existing tests intentionally allow an accompaniment failure.
- [x] Add `paced Star correct cues expose pours, return and balance` and `paced five-card correct cues expose introductions, Ace/Queen and return`. Assertions: `qualificationEligible === true`, `availability.passed === true`, `accompaniment.passed === true`, exact correct target sets and `minimumExposureMs === 600`. Mark these offline controls, never live semantic proof.
- [x] Add an ideal cue-arrival control separately from the existing fast production-scheduler control. Label its injection schedule explicitly; never slow prose or the reader to make a positive result pass.
- [x] Retain failing negative controls: balance-only exposure despite six timely receipts, missing cue, censored/invalid window, unobserved frame gap, post-window cue, wrong target, explicit-only revisit and reduced/restored lifecycle lanes.
- [x] Run `node --test tests/readingCueBrowserMeasurement.test.mjs`.
- [x] Run `npx playwright test --config output/reading-motion/react-bridge.playwright.config.mjs e2e/reading-cue-qualification.spec.js --grep 'independent Star passage timing|full five-card|correct cues'`. Keep retries zero and await complete reader endpoints; communicate progress while long tests run.
- [x] Write the root-cause record to `docs/superpowers/reviews/2026-10-10-reading-cue-playback-diagnosis.md` with event traces and screenshots. Classify each miss as source projection, late dispatch/receipt, selection/coalescing, renderer visibility, inadequate dwell or measurement defect.

**Execution evidence:** [Playback diagnosis](../reviews/2026-10-10-reading-cue-playback-diagnosis.md). Complete browser windows: 7 passed, 3 strict failures; measurement units 12/12 and scoped lint passed. Fresh source/evidence review approved. Diagnosis is complete; the feature remains unqualified pending Task 3.

**Acceptance:** Positive controls demonstrate useful exposures or reproduce a specific blocker. A green instrumentation test without positive accompaniment assertions does not close this task. A conflict between latest-visible coalescing and the paced experience is documented as a contract/design issue before any production fix.

### Task 3: Repair the reproduced playback defect without changing reading behavior

**Files:** Modify only implicated modules among `src/components/reading/narrative/narrativeGestureState.js`, `NarrativeCardFocus.jsx`, `SpreadCompanion.jsx`, `useCardGestureMotion.js`, `src/components/StreamingNarrative.jsx` and `src/lib/generatedNarrativePassages.js`. Extend `tests/narrativeGestureState.test.mjs`, `tests/generatedNarrativePassages.test.mjs`, `tests/cardGestureMotion.test.mjs` and Task 2's browser checks.

**Interfaces:** Preserve `reduceGestureFocus(state, event)`, `CUES_ARRIVED` source/ledger identity, visibility snapshots, and the shared occurrence/detail target contract. Preserve one latest pending candidate and existing held/consumed cue semantics.

- [ ] Add a failing regression for each Task 2 runtime cause before changing code. Assert the intended current cue/detail, source revision, unchanged held ID and non-restarted settled deadline; use actual render/exposure assertions for a visual cause.
- [ ] Apply the smallest fix in the responsible layer. Do not change scoring thresholds or manufacture visibility. If the accepted latest-visible/coalescing policy makes the paced gate impossible, document a focused contract decision first; keep the feature unqualified rather than implementing a hidden playback queue.
- [ ] Verify pool/land remain distinct, interpretation reuses an established detail, balance shows both, and five-card relationships preserve both occurrences/orientations.
- [ ] Cover metadata arriving before DOM registration, multiple visible passages, later offscreen candidates, held inspection through `done`, release after visibility changes, duplicate/reconnect, source replacement, hidden/offscreen motion and teardown.
- [ ] Assert exact raw prose/hash equality, zero unexpected scroll, zero companion-induced prose-start drift/overflow, and zero automatic restored/reduced-motion adoption.
- [ ] Run `node --test tests/narrativeGestureState.test.mjs tests/generatedNarrativePassages.test.mjs tests/cardGestureMotion.test.mjs tests/readingCueBrowserMeasurement.test.mjs` and the complete Task 2 browser spec on the fixed revision.
- [ ] Obtain source/runtime review of the task diff and publish the fixed-revision evidence. An intentionally coalesced burst/final-only case can remain limited; the paced central-experience controls must pass before another live accompaniment claim.

**Acceptance:** Correct paced Star/five-card playback passes without prose throttling, fabricated gaze, focus theft or backlog. All negative/lifecycle controls continue to reject misleading qualification.

### Task 4: Correct accounting, admission classification and round orchestration

**Files:** Modify `functions/lib/visualCueProvider.js` and `inferenceAttempts.js` as needed; `scripts/evaluation/lib/visualCueEvaluationBudget.mjs` and `visualCueEvaluationHarness.mjs`; extend `tests/visualCueProvider.test.mjs`, `tests/inferenceAttempts.test.mjs` and `tests/readingCueEvaluation.test.mjs`. Create `scripts/evaluation/runReadingCueQualificationRound.mjs` and `tests/readingCueQualificationRound.test.mjs`; never edit the frozen historical driver.

**Interfaces:** Preserve `openCueRoundBudget(...)`, `reserve`, `settle` and `snapshot`. Add `canReserve({ candidate, verifiedInputBound = null }) -> { allowed, reservedUsd, remainingUsd, reason }`; recheck admission atomically in `reserve`. Define `runCueQualificationRound({ live = false, phase = 'all', manifest, candidates, outputDir, roundId, roundBudgetPath, maxCalls, maxEstimatedUsd, explicitLiveConfiguration = null })`. Its CLI defaults offline; `--live --private-config <0600-file>` is the only standalone live configuration path. Support existing `--phase semantic|timing|all`, `--manifest`, `--candidate`, `--output`, `--round-id`, `--round-budget`, `--max-calls` and `--max-estimated-usd` flags with the same validation; a phase output directory is new/immutable, while its explicitly shared budget persists across phases.

- [ ] Add regressions `reservation rejection is admission-incomplete, not a dispatch`, `expensive blocked candidate does not falsely halt affordable candidates`, `same shared ledger survives process restart` and `terminal failure stops inappropriate new work`. Assert rejected admission increments neither dispatch count nor known cost.
- [ ] Add failed/malformed/rejected/cancelled response tests with and without provider usage. Assert exactly one attempt for each real call; unknown usage retains `heldUsd === reservedUsd` and `measuredCostComplete === false`.
- [ ] Capture trustworthy provider usage before parsing proposal JSON. Verify cache counts are input subsets and reasoning counts output subsets; never double-count or infer tokens from string length. Preserve sanitized metadata outside public cue snapshots.
- [ ] Persist admission outcomes separately from attempt outcomes and propagate budget-incomplete status through semantic/browser reports. Never infer that a valid reader window implies model evaluation completion.
- [ ] Allow a smaller input reservation only with a verified provider-compatible token upper bound covering system/user messages, templates, schema and request parameters; store tokenizer/count evidence and request digest. Otherwise retain the documented context-window bound. Recheck official availability/pricing at execution and freeze the snapshot.
- [ ] If later authoritative usage can reconcile an unknown attempt, append the evidence/correction rather than rewriting historical accounting. Without such evidence, keep the reservation and incomplete verdict.
- [ ] Implement versioned orchestration for shared semantic/timing/fresh-probe budgeting, preflight schedule bounds, skip reasons, immutable outputs, private blinded joins and explicit candidate order. Do not set `fullyQualified` until independent semantic, timing and accounting inputs are complete.
- [ ] Add graceful cancellation/interrupt/exception cleanup for owned browser/frontend/relay state; SIGTERM must not bypass accounting. Unknown interrupted dispatches remain reserved/unknown. Test owned cleanup without touching protected listeners.
- [ ] Run `node --test tests/visualCueProvider.test.mjs tests/inferenceAttempts.test.mjs tests/readingCueEvaluation.test.mjs tests/readingCueQualificationRound.test.mjs`; scoped lint must pass. Dry-run the new driver and assert `modelCalls === 0`, no credential discovery and no leaked private payloads.

**Acceptance:** Every call/admission is explainable across resume and cancellation. A budget-blocked candidate is incomplete, unknown usage cannot become free, and an unauthenticated/plain `--live` invocation fails before inference. No promise of complete cost measurement is made when provider evidence is unavailable.

### Task 5: Improve semantics and freeze a development experiment

**Files:** Modify `shared/generation/visualCuePrompt.js`; inspect `shared/contracts/visualCueBatches.js` and `shared/reading/visualCueLedger.js` without relaxing validation. Extend `tests/visualCuePrompt.test.mjs` and `tests/visualCueLedger.test.mjs`. Create `scripts/evaluation/fixtures/readingCueQualification.development-20261010.json` and `docs/superpowers/reviews/2026-10-10-reading-cue-development-experiment.md`.

**Interfaces:** Keep `buildVisualCuePrompt({ rawPrefix, cards, artworkEdition, priorAcceptedCues, question, reflections }) -> { systemPrompt, userPrompt }` and the strict `{ proposals }` output contract. Prompt changes alter run identity.

- [ ] Freeze an eight-case diagnostic manifest: `star-2347-excerpt`, `five-card-creative-project`, both corresponding `-question-only` variants, `star-land-observation`, `magician-wand-observation`, `star-reader-pour` and `magician-reader-metaphor`. Preserve original case/family provenance and labels; do not call these unseen examples.
- [ ] Add offline builder/ledger regressions for exact source preservation, prior-literal identity, supplied/absent/per-card context, supported catalog ownership and response-envelope validation. Assert no cues/schema/catalog enter narrative prompts and no RWS details are offered for unsupported editions. Record negation/metaphors, pool/land, downward hand/table tools and inadequate-span expectations as independently adjudicated cases in Tasks 6–7; prompt-string tests cannot prove model semantics.
- [ ] Revise instructions/few-shots using development material. Balance abstention examples with required positive progression and returns; omitting every cue cannot satisfy recall or the central experience.
- [ ] Reduce redundant prompt/schema explanations while preserving exact-source input, all drawn occurrences, supported detail ownership and prior accepted literal references. Keep the strict response contract, `8192` output cap and `60000 ms` deadline unchanged for the comparison.
- [ ] Treat caching as a separately named optional variant only after documented support is checked. Record uncached/cached usage and measured latency; do not claim a target speed from caching alone.
- [ ] Run `node --test tests/visualCuePrompt.test.mjs tests/visualCueLedger.test.mjs tests/visualCueProvider.test.mjs`. Refresh binding source/catalog pins in the new manifest through independent review; never edit `readingCueQualification.json` to erase historical provenance.
- [ ] Freeze the final prompt/runtime/schema/catalog hash, candidate configuration, manifest and success/failure rules before live dispatch. Record Spanish as identity-only until independently reviewed native-language detail evidence passes.

**Acceptance:** A reproducible revision addresses traps, detail mistakes, quote adequacy, dependency integrity and missed opportunities without weakening validation or rewriting prose. Reserved/outside-review samples were not used for tuning.

### Task 6: Run a small development pilot before a full comparison

**Files:** Use Tasks 4–5's driver/manifest. Create a unique pilot evidence directory and append results to the development-experiment review. Independent verdicts and reversible aliases are joined privately.

**Interfaces:** Pilot output records complete expected trials, adjudications, `scoreReadingCueRun` results, latency/usage and budget status. It always reports `qualified: false` for live accompaniment.

- [ ] After live execution is explicitly invoked, propose a pilot ceiling of `16` total visual calls / `$3`, including failures. Use Flash Low as the development test configuration because it had the highest observed recall, without calling it qualified. Preflight actual planned counts/reservations; reduce scope before dispatch if conservative bounds cannot fit.
- [ ] Dry-run the subset, then invoke the new driver with a new round ID/shared ledger and private configuration. The eight-case subset with existing repeat rules schedules `10` semantic evaluations: eight first trials plus second trials of the two recorded parents. Verify this rather than forcing a second repeat of every standalone/derived case.

After Task 4 implements the driver, the offline pilot command is:

```bash
node scripts/evaluation/runReadingCueQualificationRound.mjs --phase semantic --manifest scripts/evaluation/fixtures/readingCueQualification.development-20261010.json --candidate glm-5.3-flash-low --max-calls 16 --max-estimated-usd 3 --round-id NEW_PILOT_ID --round-budget output/reading-motion/evidence/cue-qualification/NEW_PILOT_ID/round-budget.json --output output/reading-motion/evidence/cue-qualification/NEW_PILOT_ID/semantic
```

Use a different new output/round identity for the explicitly invoked live pilot and add `--live --private-config "$CUE_PRIVATE_CONFIG"`; the variable contains only a private file path, never credential contents. The command above is not executable before Task 4 and does not itself authorize the live variant.
- [ ] Obtain blinded independent verdicts for every accepted cue/target/extra; classify incorrect targets as wrong-card/wrong-detail and truncated spans as inadequate. Missing or uncertain judgments remain incomplete.
- [ ] Publish development cue/target precision, required recall, per-case/kind denominators, exact Star recovery, question-only completeness, dependency failures, latencies and accounting. Inspect supported extras without retroactively enlarging recall labels.
- [ ] Require zero integrity/trap failures, both precision measures `>= 0.95`, required recall `>= 0.80`, and complete central/context cases before advancing. A latency change is only a measured pilot observation until browser timing is run.
- [ ] On failure, stop the pilot, keep the baseline gated and record the next hypothesis. Any prompt/configuration revision gets a new experiment identity; do not repeatedly spend under the finished pilot ledger or claim qualification from its small sample.
- [ ] Verify owned resource cleanup and zero unresolved reserved attempts; preserve any unknown usage as incomplete.

**Acceptance:** The next full comparison has a credible development candidate, or the failed hypothesis is recorded with no promotion. A successful pilot cannot substitute for reserved regression, live browser accompaniment or real Pro streaming evidence.

### Task 7: Requalify on frozen regression and controlled browser timing

**Files:** Create `scripts/evaluation/fixtures/readingCueQualification.regression-20261010.json`, a unique evidence directory, and `docs/superpowers/reviews/2026-10-10-reading-cue-requalification.md`. Use `readingCueQualification.mjs`, Task 4's driver and the real browser helpers; update parent plans with actual results afterward.

**Interfaces:** Semantic scoring uses `scoreReadingCueRun({ cases, ledgers, adjudications, gates, expectedTrials })`. Live browser scoring uses `scoreCueBrowserReport({ report, opportunities, cues, matches, offline: false })` with same-session independently adjudicated matches. Ranking passes the explicit frozen `manifest.candidateOrder`.

- [ ] Finish runtime/artwork changes relevant to this round, then freeze independent labels, all binding byte pins, source HEAD/dirty digest, schema/prompt/profile, price/catalog, schedules and candidate order. The prior reserved set remains a reserved regression set, not an unseen holdout.
- [ ] Predeclare the comparison and allocation before dispatch. The original three-configuration matrix plans `222` semantic evaluations and `18` browser sessions. Dry-run it with:

```bash
node scripts/evaluation/evaluateReadingCueModel.mjs --dry-run --phase all --manifest scripts/evaluation/fixtures/readingCueQualification.regression-20261010.json --repeats 2 --max-calls 600 --max-estimated-usd 15 --output output/reading-motion/evidence/cue-qualification/NEW_UNIQUE_DRY_RUN
```

- [ ] Use one newly authorized persistent budget for the entire live round, including failures, timing and Task 8. Reserve timing/corroboration headroom before dispatching the semantic plan. If conservative bounds cannot support a fair comparison, freeze a narrower explicitly labelled comparison or remain incomplete; do not increase/reset the allowance midway or call an untested reference worse.
- [ ] Run the complete frozen semantic plan, retain rejected/failed/zero-output/budget-prevented trials in denominators, and independently adjudicate every output. Publish repeat variation, kind/partition/language/edition counts and Wilson intervals.
- [ ] Require all integrity/trap/semantic/central/context gates, including native Spanish detail thresholds if detail support is claimed. Keep Spanish/non-RWS identity fallback explicit otherwise.
- [ ] Run Star/five-card × paced/burst/final-only phone timing through actual jobs/scheduler with no hidden per-session call cap. Score completed reader windows, first-visible intervals, correct adoption/exposure and browser receipt p95; report late/static/revisit and intentionally coalesced modes separately.
- [ ] Apply the accompaniment conditions to the paced central cases; report burst/final-only limitations under the original contract rather than inventing a required backlog. Run equivalent desktop/reduced-motion controls offline and label their mocks.
- [ ] Reconcile complete accounting and rank only fully eligible configurations. Publish pass/fail/incomplete/skip per gate, qualified scope and candidate selection; keep `qualified: false` if no configuration satisfies every required gate.
- [ ] Verify owned cleanup and obtain an independent source/runtime review of the joined decision.

**Acceptance:** Every qualified claim traces to frozen inputs, complete independent scoring, actual correct-detail browser exposure and complete measured accounting. A budget-incomplete reference or conditional probe does not become a pass or a model-quality failure.

### Task 8: Corroborate through the real Pro application, or record a separate static direction

**Files:** Create `e2e/reading-cue-pro-streaming.spec.js` for explicitly invoked real application probes; do not relabel existing controlled “live” fixtures as real-provider evidence. Extend `tests/readingGesturesDev.test.mjs`, `scripts/lib/readingGesturesDev.mjs` and `scripts/dev-reading-gestures.mjs` only for isolated configuration if needed. Record sanitized proof in the requalification report; fresh raw narratives/private sessions stay outside Git.

**Interfaces:** Preserve the ordinary login, reading job start/delta/done, independent visual status/stream and journal save paths. Add an isolated runtime launch option accepting explicit owned ports/private directory; keep the ordinary beta's defaults intact.

- [ ] Gate fresh probes on semantic eligibility and sufficient same-round allowance. Otherwise record the exact skip reason; skip does not count as complete streaming coverage.
- [ ] Provision an isolated runtime on free owned ports and isolated D1 state without reading the primary `.dev.vars` or touching the original beta. Verify the subscription executable/login for the eventual run; the earlier executable pin is historical, not permission to change global installations.
- [ ] Gate the runtime's actual visual provider dispatch through the same Task 7 budget/admission ledger using trusted issued-request registration. Normal application API/DO/scheduler paths stay in use; a separate unbudgeted Workers AI binding cannot bypass the allowance.
- [ ] Log in with the private local reviewer workflow and verify genuine Pro tier. Generate two new non-sensitive RWS readings, one three-card and one five-card, after prompt freeze using the plan's `gpt-6.1-sol` / `high` subscription configuration with live passage delivery. No forged auth, route-mocked provider success or paid narrative fallback.
- [ ] Record multiple visible prose updates before completion, exact joined raw equality, independent cue receipts/adoptions/source binding and actual scheduler/model timings. Independently adjudicate new cues using the frozen rubric, preserving unknown cost.
- [ ] Save/open the completed reading and inspect restored static cues; verify logout and delete private browser session artifacts according to the reviewer workflow.
- [ ] Run `node --test tests/readingGesturesDev.test.mjs tests/codexSubscriptionIsolation.test.mjs tests/codexSubscriptionStream.test.mjs` for the launch/transport changes. The real-probe browser command is `CUE_REAL_PRO_PROBES=true npx playwright test --config output/reading-motion/reading-cue-remediation.playwright.config.mjs e2e/reading-cue-pro-streaming.spec.js`, after Task 13's isolated runtime exists and explicit live scope/eligibility/budget preflight succeeds. Without the opt-in, private configuration or semantic eligibility record, the spec makes zero generation calls.
- [ ] If semantics passes but live accompaniment cannot qualify, create `docs/superpowers/specs/2026-10-10-reading-cue-static-revisit-direction.md` for product review. Define a separately labelled saved/revisit annotation scope, completion/status/retry behavior and semantic/accounting gates. Never relabel the failed live-accompaniment candidate as fully qualified.

**Acceptance:** Real Pro application corroboration is fresh, nonmocked and provenance-linked, or remains explicitly skipped/failed. Static/revisit is a distinct proposed direction, not an automatic production scope change.

### Task 9: Persist failed attachment and retry state with the saved source

**Files:** Modify `functions/lib/readingVisualResults.js`, `functions/lib/journalEntries.js`, `functions/api/journal.js`, `functions/api/journal/[id].js` and `functions/api/account/delete.js`. Create `migrations/0037_reading_visual_retry_state.sql` after checking numbering at execution. Extend `tests/readingVisualResults.test.mjs` and `tests/journalVisualIntegration.test.mjs`; update isolated D1 test fixtures to apply the new migration.

**Interfaces:** Define `fingerprintSavedVisualSource({ source, artworkEdition, catalogVersion }) -> Promise<string>`, `loadJournalVisualState({ db, userId, entryId }) -> Promise<PublicVisualRetryState|null>` and `persistJournalVisualState({ db, userId, entryId, sourceFingerprint, attachmentStatus, reason, validatedSnapshot })`. The full fingerprint is SHA-256 of canonical JSON containing `rawHash`, `spreadHash` and `contextHash` from `fingerprintVisualSource` plus the trusted `artworkEdition` and `catalogVersion`. `PublicVisualRetryState` is `{ attachmentStatus, retryStatus, sourceFingerprint, attemptId, stateVersion, reason, visualSnapshot }`; statuses are attachment `missing|pending|attached|failed|expired` and retry `available|pending|complete|exhausted|unavailable|revoked`. No resume token or transport credential enters this envelope.

- [ ] Add `failed cloud attachment survives save/list/get/reload`: immediate prose save succeeds, original failure reason and retry state are durable, validated cached cues remain inspectable and the restored state does not falsely say attached/complete.
- [ ] Reconstruct canonical raw Markdown, ordered cards/positions/orientations, deck/edition, question, overall and per-card reflections from the actual owned journal row. Use `fingerprintVisualSource(source)`; never accept replacement raw/owner/fingerprint from a retry body.
- [ ] Add a journal visual-state table keyed by entry with owner, complete source fingerprint, attachment/retry status, reason, validated fallback snapshot and state version. Add durable retry claims with a unique `(admission_scope, source_fingerprint)` key; link entries to that claim so changing an entry/transport ID cannot reset the same-source allowance within that admission scope.
- [ ] Persist attachment outcomes even when there is no successful `journal_visual_links` row. GET/list must return the durable state without requiring a live visual DO/provider.
- [ ] Store only server-validated owned fallback snapshots; a foreign/mismatched/unverified client sidecar cannot become authoritative cloud data. Preserve a still-valid local cached snapshot separately when cloud attachment cannot be proved.
- [ ] Keep same-seed retries bound to the stored row, not incoming replacement prose. Preserve old linked source snapshots if regeneration creates a new narrative/source revision.
- [ ] Extend entry/account deletion to remove state/links, revoke live replay attempts and prevent subsequent commits/upserts from recreating deleted data.
- [ ] Run `node --test tests/readingVisualResults.test.mjs tests/journalVisualIntegration.test.mjs tests/journalEntriesService.test.mjs tests/visualSourceIdentity.test.mjs` against isolated databases. Test migration from existing saved/linked/unlinked entries as well as an empty database.

**Acceptance:** Failed attachment is discoverable and recoverable after reload; saving prose remains independent of optional visual persistence. Existing saved cues remain available when configuration is absent. Production migrations are not applied by this task.

### Task 10: Add one authorized, idempotent saved-source replay

**Files:** Create `functions/lib/readingVisualRetry.js`, `functions/api/journal/[id]/visual-retry.js`, `functions/api/reading-visual-retry.js`, `functions/api/reading-visual-replay.js` and `tests/readingVisualRetry.test.mjs`. Modify `src/worker/index.js`, `src/worker/readingVisualJob.js`, `functions/lib/readingVisualJobs.js`, `readingVisualResults.js` and the Task 9 claim schema as needed. Extend `tests/readingVisualJob.test.mjs` and `tests/journalVisualIntegration.test.mjs`.

**Interfaces:** `retryJournalVisuals({ env, userId, entryId })` derives an owned saved source; `retryLocalVisuals({ env, admission, savedSource })` admits fresh annotation of explicitly submitted local prose. Both return `{ state, resumeHandle }`. The private handle is `{ readingResultId, visualJobId, attemptId, visualJobToken, visualBinding, expiresAt }`. Add `claimVisualRetry({ db, admissionScope, sourceFingerprint, entryId = null, expectedStateVersion })` with atomic claim/version checking.

**Routes:** `POST /api/journal/:entryId/visual-retry` for cloud; `POST /api/tarot-reading/visual-retry` for local-source submission; independently authorized `GET /api/tarot-reading/visual-replays/:visualJobId`, `GET .../stream` and `POST .../cancel` for replay transport. Narrative `readingResultId` and source binding stay stable; a fresh server-issued `visualJobId` addresses the new DO.

- [ ] Add `double click/concurrent tabs claim one replay and dispatch once`, `expired old token cannot reopen old private state` and `foreign owner/guessed IDs cannot attach or inspect`. A complete existing valid attachment returns its state without new inference.
- [ ] Resolve owner from authenticated request context. Cloud retry loads the owned entry; local retry never uses an old opaque result ID/client snapshot as access to prior private work. For normalized-only historical local entries, treat the submitted saved prose as a new explicitly authorized source, not proof of the old raw binding.
- [ ] Give guests a server-issued admission principal and server-enforced claim, rate and total-inference limits. Authenticated users without cloud entitlement follow the local-source path with authenticated admission. Browser namespaces/flags cannot enforce budget or claim ownership; a new guest principal still passes server admission limits and gains no access to an old principal's work.
- [ ] Claim the explicit retry atomically before dispatch. Permit at most **one** inference dispatch for that saved full-source fingerprint under the claim; readiness/offline failure before dispatch preserves the slot, but timeout/rejection/malformed response after dispatch exhausts it. New source/transport IDs do not reset the claim.
- [ ] Try a valid same-owner attachment repair first without inference. For true expiry/absent registration, initialize a fresh replay transport with trusted source/context and validated prior cues, never resurrect the expired/revoked DO through `/init`.
- [ ] Bind every admission, request, result and D1 commit to `attemptId`/active replay version in addition to source/owner/revision. Old original jobs and older replay responses cannot replace the current replay or resurrect deleted results. Retain accepted cue IDs and cached cues until a validated successor can be conditionally attached.
- [ ] Persist the one-dispatch reservation before provider invocation. Eviction/crash recovery after an uncertain dispatch must not launch a second paid call. Use the configured provider timeout (existing default `30000 ms`, cap `60000 ms`), cancellation, and independent transport reconnect limits.
- [ ] Add tests for readiness absent → zero inference/cached access; same-source retry deduplication across reload/changed local entry IDs; timeout exhaustion; explicit cancellation/revocation blocked; source/deck/orientation/per-card-context mismatch; superseded replay; expiry, delete and account deletion at admission/init/inference/hash/commit boundaries.
- [ ] Run `node --test tests/readingVisualRetry.test.mjs tests/readingVisualJob.test.mjs tests/readingVisualResults.test.mjs tests/journalVisualIntegration.test.mjs tests/visualSourceIdentity.test.mjs` with fake external services and isolated D1/DO state.

**Acceptance:** Explicit retry can recover expired/failed saved visuals while exact prose and narrative identity remain stable. It cannot infer on restore/poll/readiness, perform unlimited retries, change ownership or reopen old private capabilities.

### Task 11: Expose recovery in the journal and verify every storage/race lane

**Files:** Modify `src/hooks/useJournal.js`, `src/hooks/useReadingVisualJob.js`, `src/lib/readingVisualStorage.js`, `src/lib/readingVisualStream.js`, `src/utils/journalStorage.js`, `src/hooks/useSaveReading.js`, `src/components/journal/entry-card/RestoredReadingGestures.jsx` and `EntrySections/NarrativeSection.jsx` in that entry-card directory. Extend `tests/readingVisualStorage.test.mjs`, `tests/readingVisualStream.test.mjs`, `tests/journal-export.test.mjs` and `e2e/journal-visual-restoration.spec.js`.

**Interfaces:** Consume Task 9 public state and Task 10 private resume handle. Add `retrySavedVisuals(entryId) -> Promise<PublicVisualRetryState>` to the journal hook; source submission comes from the existing scoped saved entry. Storage/subscription accepts optional `visualJobId`/`attemptId` without breaking original valid handles.

- [ ] Add explicit **Retry card connections** for eligible failed/expired/missing saved visuals. Pending work resumes normally; pending/exhausted/revoked/unavailable states do not offer another inference action.
- [ ] Use plain status copy such as **Your reading is saved. Card connections are unavailable.** Show pending/completed state and keep the action usable by keyboard/touch/AT. Do not expose model, binding or transport implementation details in the journal.
- [ ] Preserve canonical source and public cached snapshot together. Keep capabilities, replay identity and private bookkeeping in user-scoped private storage, excluded from exported/shared entry data and DOM/custom-event payloads.
- [ ] Persist the claim/status before UI completion; recheck current account/namespace, existing entry, source fingerprint, state version and active attempt at every asynchronous action/subscription completion. Late callbacks can patch only an existing matching entry.
- [ ] Preserve prose/cached cues during quota/offline/readiness errors, failed successor attempts and reload. Do not automatically submit replay on mount, account switch, polling or reconnect.
- [ ] Add browser cases: guest/local expiry → explicit retry → static cues; signed-in local entitlement lane; cloud failed attachment → reload → repair; save while original cues are pending; duplicate tabs/clicks; exhausted retry after reload; delete/account switch/source replacement while response is pending; no annotation configuration; offline/quota failure; snapshot preserved after rejected successor.
- [ ] Verify both motion preferences: `automaticAdoptions.length === 0` on every restored/re-annotated entry; literal/pair/identity manual inspection and release still work; raw prose/hash never changes.
- [ ] Run `node --test tests/readingVisualStorage.test.mjs tests/readingVisualStream.test.mjs tests/journal-export.test.mjs tests/readingVisualRetry.test.mjs`, then `npx playwright test --config output/reading-motion/reading-cue-remediation.playwright.config.mjs e2e/journal-visual-restoration.spec.js` after Task 13 provisions owned isolated servers. Record mocked auth/provider separately; real application/device lanes follow Tasks 8 and 15.

**Acceptance:** Saved-reading recovery works across cloud/local/guest cases with one server-enforced attempt, persistent status, no source mutation/resurrection/token export, and static restoration. A successful stream reconnect alone does not establish expiry recovery.

### Task 12: Complete artwork presentation and intentional treatment coverage

**Files:** Inspect/modify `src/data/cardGestureArtwork.js`, `src/data/cardGestureDetails/majors.js`, `wandsSwords.js` and `cupsPentacles.js` in that details directory; `src/components/reading/narrative/CardTouchArt.jsx`, `SpreadCompanion.jsx`, `useCardGestureMotion.js` and `src/styles/narrative-card-touch.css`. Extend `tests/cardGestureArtwork.test.mjs`, `tests/cardGestureMotion.test.mjs`, `tests/deckGestureExpansion.test.mjs`, `e2e/reading-gestures-deck.spec.js` and `e2e/reading-gestures-geometry.spec.js`. Update `output/reading-motion/deck-gesture-coverage.md` and register geometry tests in the isolated config.

**Interfaces:** Preserve `getVectorGestureDetails(canonicalName)`, `getVectorGestureFrames(canonicalName, detailIds, { paired })`, `projectGestureFrame(frame, reversed)` and the common occurrence/edition contract. Every detail has an authored crop/geometry and an intentional finite-motion or static treatment.

- [ ] Reconcile the existing inventory: `78` cards / `151` details; `146` static details, two Star water recipes and three finite traces. Static illumination is a valid authored choice; the destination is not 78 mandatory cinemagraphs.
- [ ] Parameterize hardcoded historical capture paths in the affected specs, including `reading-gestures-geometry.spec.js`. Create a new per-run evidence directory and use exclusive writes plus source/build/browser identity; do not overwrite `live-beta-2026-10-09` or prior qualification screenshots/reports.
- [ ] Produce a per-detail evidence matrix with upright/reversed × desktop/compact phone × normal/reduced motion, including same-card two-detail and two-card relationships. Track reviewed masks/crops, visible requested details, context/orientation labels and provenance.
- [ ] Capture every registered detail in each required presentation, inspect its actual pictured region and independently review the captures. Structural roster tests or upright contact sheets do not certify reversed/compact geometry.
- [ ] Correct failed crops/masks/frames in the responsible authored data. Apply reversal once to the common artwork/overlay plane; keep water/rivulets, rays, tools and gestures aligned. Unsupported editions retain whole-card identity instead of borrowed geometry.
- [ ] Review the treatment choice per card/detail; author a bounded effect only where it clarifies the picture. Retain static meaning in reduced motion, including paired emphasis; mark an intentionally static decision rather than an animation missing by accident.
- [ ] Test hidden/offscreen/settled/unmounted and held/release ownership. Existing water settlement is `1500 ms` and finite traces `1800 ms`; verify bounded handles and no replay on append/reconnect/preference restoration.
- [ ] Exercise grounded returns and relationships on recorded three-/five-/ten-card material; authored literal probes remain labelled test copy, not natural-reading model evidence.
- [ ] Run `node --test tests/cardGestureArtwork.test.mjs tests/cardGestureMotion.test.mjs tests/deckGestureExpansion.test.mjs tests/cardGestureAssets.test.mjs` and `npx playwright test --config output/reading-motion/reading-cue-remediation.playwright.config.mjs e2e/reading-gestures-deck.spec.js e2e/reading-gestures-geometry.spec.js` after Task 13's runtime scaffold. Update every failed/unreviewed matrix cell honestly.

**Acceptance:** Every promoted registered detail has reviewed orientation/compact/reduced rendering and an intentional bounded/static treatment. Natural-language qualification remains separate. An unreviewed card/detail stays gated; no full-deck completion claim rests on representative examples.

### Task 13: Bound artwork delivery and provision a reproducible validation runtime

**Files:** Modify `src/data/cardGestureAssets.js`, `src/components/reading/narrative/CardTouchArt.jsx`, `SpreadCompanion.jsx` and `useCardGestureMotion.js` if measurements require it. Create `scripts/dev-reading-cue-validation.mjs`, `tests/readingCueValidationRuntime.test.mjs` and `output/reading-motion/reading-cue-remediation.playwright.config.mjs`; reuse safe isolation primitives from `scripts/lib/readingGesturesDev.mjs`. Create `docs/superpowers/reviews/2026-10-10-reading-cue-artwork-performance.md`.

**Interfaces:** `startReadingCueValidation({ host = '127.0.0.1', ports, privateDirectory, sourceHead, live = false, explicitProviders = null, budget = null })` returns `{ origins, buildIdentity, ownedResources, close }`. Offline mode makes no provider calls; live visual dispatch requires the explicit shared budget. The browser config covers the qualification, handoff, restoration, deck and geometry specs without reusing protected services; the real Pro spec requires the separate explicit opt-in from Task 8.

- [ ] Add runtime tests for explicit free ports, private isolated D1/state, no primary dotenv/deployment-secret inheritance, fail-closed unconfigured API access, immutable measured source, allowed/denied filesystem paths, and owned cleanup on exception/signal.
- [ ] Configure explicit Chromium and WebKit desktop/phone projects, normal/reduced motion through `use.contextOptions.reducedMotion`, service workers blocked for controlled fixtures, strict owned servers, zero retries and unique output paths. Read actual `matchMedia('(prefers-reduced-motion: reduce)').matches` in each lane; configuration labels alone are not evidence.
- [ ] Keep gesture fixtures on the owned development frontend where required; do not assume development-only routes exist in a production build. Use a separately identified optimized build for application/asset performance and real application/device lanes.
- [ ] Audit a cold built-page network trace: only drawn-spread/needed focus assets transfer, and no full 78-card registry/SVG collection is fetched. Record resource type/content/cache headers; Vite import URLs are not image byte evidence.
- [ ] Measure 3-, 5- and 10-card cold/warm transfers, decode/paint time, long-reading memory, active overlay/animation handles, held/offscreen work and layout stability. Preserve attributed WebP derivatives/source-vector provenance; tune loading/format/crops only against those measurements.
- [ ] Record numeric resource/performance budgets and test conditions in the performance review before final acceptance. Structural budget: undrawn-card downloads `0`, companion prose-start drift `0 px`, horizontal prose overflow `0 px`, automatic reduced/restored animations `0`, and hidden/offscreen motion handles `0`. Set measured transfer/decode/memory/frame budgets from explicit device baselines; do not invent universal limits.
- [ ] Profile the actual iPhone separately in Task 15 and a physical mid-range handset for the broader performance gate. If the latter is unavailable, mark it not run and keep broad performance qualification open.
- [ ] For physical access, provision an explicitly approved isolated HTTPS origin/private tunnel or equivalent device-reachable runtime. Verify secure-cookie/auth behavior, protect private assets/config, record exact source/build/data/proxy identity, and keep the original beta untouched.
- [ ] Run `node --test tests/cardGestureAssets.test.mjs tests/cardGestureMotion.test.mjs tests/readingCueValidationRuntime.test.mjs`. Run the chosen browser specs with `npx playwright test --config output/reading-motion/reading-cue-remediation.playwright.config.mjs` and the appropriate explicit spec list; record the real base URL/projects and zero retries.

**Acceptance:** Resource/render work stays scoped to the reading; numeric measurements and owned-runtime provenance support the acceptance. Successful emulation or a high-end handset cannot close an unmeasured mid-range performance gate.

### Task 14: Verify accessible prose, inspection and retry controls before device acceptance

**Files:** Inspect/modify `src/components/MarkdownRenderer.jsx`, `src/lib/narrativeCardLinks.js`, `src/components/StreamingNarrative.jsx`, `src/components/reading/narrative/SpreadCompanion.jsx` and Task 11's journal controls. Extend `tests/narrativeCardLinks.test.mjs`, `e2e/reading-gestures.spec.js`, `e2e/reading-gestures-lifecycle.spec.js` and `e2e/journal-visual-restoration.spec.js`; append intended semantics to the portable VoiceOver checklist.

**Interfaces:** Each complete supported phrase is one inspection control; Tab/focus exploration does not hold it, Enter/Space or activation toggles it, Escape/focus-card activation releases it. Accessible names preserve the visible phrase; shelf/focus controls identify position/card/orientation and current/held state.

- [ ] Inspect the actual authored, dynamic and independent-model phrase labels separately. Reproduce the authored label/visible-quote mismatch from the preparation audit; add a label-in-name regression and verify continuous prose is not replaced by unrelated card/detail labels.
- [ ] Prefer the visible phrase as the control name or include it verbatim in the accessible name; preserve Markdown/source offsets and complete text. Do not split into one button per word or expose future/unfinished phrases as controls.
- [ ] Test keyboard/shelf traversal, toggle/release, focus retention through prose append/late cues/completion and account/source changes, inert departing art and unavailable cards, current/pressed state and paired targets.
- [ ] Test status announcements and retry states for useful, restrained speech. The absence of unsolicited automatic detail announcements is not itself a defect; never make every arriving word/cue interrupt the reading.
- [ ] Cover 200% page/text zoom, portrait/landscape compact layout, multiline touch targets, readable context/orientation labels, visible focus and reachable retry/status controls.
- [ ] Verify motion preference changes preserve held focus/prose progress while cancelling motion; restored retry completion is static.
- [ ] Run `node --test tests/narrativeCardLinks.test.mjs tests/narrativeGestureState.test.mjs`, `npx playwright test --config output/reading-motion/reading-cue-remediation.playwright.config.mjs e2e/reading-gestures.spec.js e2e/reading-gestures-lifecycle.spec.js e2e/journal-visual-restoration.spec.js`, and `npm run test:a11y`. Record analyzer/browser scope; these checks do not establish actual VoiceOver speech.

**Acceptance:** Names/roles/states, prose continuity, keyboard/touch activation and responsive controls are correct in automation. Actual spoken output, rotor behavior and iOS focus survival remain Task 15 evidence.

### Task 15: Complete physical iPhone Safari/VoiceOver and real identity coverage

**Files:** Execute/update `docs/superpowers/reviews/2026-10-10-reading-iphone-voiceover-checklist.md` from Task 1. Create `docs/superpowers/reviews/2026-10-10-reading-iphone-voiceover-results.md` with sanitized evidence references and exact build/runtime identifiers.

**Interfaces:** Each physical observation records `{ checkId, result: PASS|FAIL|NOT_RUN, sourceLane, deliveryMode, identityTier, deviceOS, buildIdentity, proseHash, ledgerRevision, motionSetting, evidenceTimestamp, actualSpeech, notes }`. Device recordings/transcripts are separate from automated DOM/engine results.

- [ ] Confirm the physical iPhone 14 Pro Max, actual iOS/Safari version, approved isolated origin, exact immutable source/build, qualified model/run/manifest when testing model output, device/network/power/text settings and delivery/source lane. A controlled/authored fixture remains labelled fixture evidence.
- [ ] Run the portable P1–P14 checklist: natural scroll/Safari chrome, distinct Star pours/balance, hold/release through continued prose, Ace/Queen/reversed/return inspection, whole-card fallback, VoiceOver swipes/rotor/continuous reading, incomplete→complete phrase controls, double-tap toggle, shelf/focus state, restrained status/context speech, Reduce Motion, background/lock/back-forward, landscape/200% zoom, save/reload/retry/offline and long-reading cold-load responsiveness.
- [ ] Add the implemented retry action/status names to P12 and observe available/pending/exhausted/error/completed states. Verify no automatic restore/retry motion even with Reduce Motion off.
- [ ] Record actual VoiceOver words and navigation order with an audio-capable recording or timestamped contemporaneous transcript. Preserve failure clips; a silent video/DOM label does not establish announcements or continuous-reading integrity.
- [ ] Test guest and genuine signed-in Pro separately, including fresh qualified-output application cases and saved recovery. Cover affected free/Plus/local-versus-cloud entitlement paths separately; fixture identity cannot stand in for these tiers. Verify logout and remove private session artifacts afterward.
- [ ] Run Reduce Motion off/on, including toggling during a held cue, and distinguish touch from optional external-keyboard results. Check physical touch target accuracy and focus survival through appends, metadata, completion and replay status changes.
- [ ] Capture decode/painting/memory/frame evidence with Safari profiling when available, alongside qualitative pauses/stutter. Repeat Task 13's physical mid-range performance lane or explicitly keep that gate open.
- [ ] File every failure against the owning task, fix it in a new identified revision, rerun affected automation, then retest affected physical checks. Keep earlier pass/fail evidence immutable and list not-run cases.

**Acceptance:** All required physical checks pass on the final identified build with actual speech/touch/identity evidence. Without the handset/operator or reachable isolated origin, preparation can finish but physical acceptance remains pending.

### Task 16: Assemble final readiness evidence and preserve the production gate

**Files:** Create `docs/superpowers/reviews/2026-10-10-reading-cue-readiness.md`. Update the three parent plans and `output/reading-motion/deck-gesture-coverage.md` with scoped actual statuses. Inspect `wrangler.jsonc`, `migrations/0036_reading_visual_results.sql` and the new retry migration; do not apply production changes during checklist execution.

**Interfaces:** The readiness record maps every issue/gate to exact source/build/run, command/result, auth/provider/device scope, evidence path and unresolved limit. It separately records semantic eligibility, live accompaniment, accounting, saved recovery, artwork presentation, physical accessibility and release authorization.

- [ ] Review every task/coverage-table row. Mark complete only with its stated acceptance evidence; skipped, budget-incomplete, baseline-failing and physically untested lanes remain distinct.
- [ ] Run the appropriate focused suites and affected `functions/__tests__` suites, then `npm test`, scoped ESLint, `npm run build`, `npm run docs:check` and `git diff --check` on the exact candidate revision. Check superpowers document links explicitly. Record existing baseline failures without suppressing them or claiming a complete green.
- [ ] For applicable narrative/vision/runtime release scope, run the repository-required quality/release gates under subscription-only policy: `npm run ci:narrative-check`, `npm run ci:vision-check` and `npm run ci:release-check` as applicable. Missing required live evidence stays open; never substitute a bypass flag or paid narrative API.
- [ ] Obtain an independent source/runtime review covering actual source observation, strict proposals/ledger, scheduling, DO recovery, D1 migrations/CAS/deletion, retry authorization/accounting, client namespaces/storage, rendered artwork and final evidence claims.
- [ ] Prepare a migration/configuration/runbook with schema compatibility, local preview verification, data retention, chosen provider/model/effort, feature-gate activation sequence, rollback/disable behavior and saved-cue access with provider disabled. Do not enable the provider merely to obtain a green readiness record.
- [ ] If commit/push is later requested, stage only reviewed owned source/docs/sanitized evidence, inspect the staged diff and run required pre-push checks. Keep unrelated checkout changes and private artifacts untouched.
- [ ] Keep production disabled until all required gates and explicit release scope are satisfied. A production request must include fresh local release checks, verified migration/DO/configuration deployment, active Worker version/traffic, live health/auth and live asset parity; hosted GitHub Actions success is not required.
- [ ] If only a separately approved static/revisit scope can pass, publish readiness for exactly that scope with its own tests/device evidence and explicit absence of live accompaniment qualification.

**Acceptance:** Every requested issue has a complete, reviewable resolution or an explicit blocking gate with evidence. No production promotion/deployment/full-deck/live-accompaniment claim exceeds the validated scope.

## Tracking template

Use one row per task in the eventual readiness record:

| Task | Owner | State | Source/build/run | Commands and results | Evidence | Remaining gate |
| --- | --- | --- | --- | --- | --- | --- |
| 1–16, one row each | Assigned at execution | Pending / running / pass / fail / incomplete / skipped | Exact identities | Actual, with mocks and baseline failures | Repository/private index | Specific dependency or missing observation |

Checklist publication alone closes none of these runtime, inference, artwork, physical-device or production gates.
