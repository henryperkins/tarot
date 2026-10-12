# Reading Aligner Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare an independently releasable, inference-free visual companion that connects drawn-card identities and supported English RWS literal imagery to ordinary readings and saved readings, while keeping the original question and optional notes reachable.

**Architecture:** Retain the current renderer, exact-source aligner, lazy gesture runtime and journal ownership boundaries. Separate presentation activation from model-request consent; the aligner lane never requests annotations. Add one shared personal-context disclosure to live and restored companions; semantic interpretations, balance and grounded returns belong to the separate model lane.

**Tech Stack:** React 19, Vite, existing Markdown/remark source mapping, existing motion adapter, Node tests and Playwright Chromium/WebKit; no new runtime dependency.

**Spec:** [Intent closure and lane dependencies](2026-10-11-reading-intent-closure.md), [original imagery/motion intent](../specs/2026-10-08-reading-imagery-motion.md), [post-reading model plan](2026-10-11-reading-post-reading-model.md), [current acceptance](../reviews/2026-10-11-reading-ui-acceptance.md).

**Status:** Owner approved execution on October 11. The accepted source is checkpointed and remotely backed up; Tasks 1–5 are implemented and independently reviewed. Ordinary-route coverage is an explicit 180-retained-plus-four-corrected composite over byte-identical frontend output; both failed native runs remain retained. Physical/device and production release gates remain open. See the [execution record](../reviews/2026-10-11-reading-aligner-release.md). The prior local owner acceptance remains closed with two explicitly approved browser exceptions; its native automation remains RED. Model inference is not authorized by this aligner work.

**Use this as the single aligner execution checklist:** preserve/checkpoint source and resolve edition/cargo choices → separate UI/model flags → add exact context and no-binding saved restoration → verify affected ordinary routes → close physical gates → release. The parent owns decisions, and old task/status documents retain history. Do not create another parallel checklist or repeat a full browser/picture cycle for unchanged code; map each change to affected checks and retain the required final repository gates.

## Global Constraints

- “Preserve its current prose, headings, section structure, and interpretive depth.” Keep exact raw source and existing narration offsets; never rewrite prose to improve matching.
- “Reflections are optional.” Keep question, general reflection and card-position notes distinct; never manufacture context or infer personal meaning from word overlap.
- “Do not force scrolling or assume text arrival proves gaze position.” Preserve source-order turns and the approved 1,800 ms active phase, explicit holds, visible-source eligibility and independent prose delivery.
- Preserve immediate inspection of already-revealed shelf cards, including untranslated/unmatched prose; automatic cues cannot reveal undrawn cards.
- Live reduced-motion readings keep source-order automatic static turns with zero animation. Restored readings have no arrival sequence or turn deadlines and retain static visible-source/manual associations. Preserve exact binding, deletion fencing, account isolation, pending recovery and cached accepted cues.
- The lane provides lexical identity, conservative English RWS literal matches and name-only whole-card pairs. It does not supply interpretation, balance, personal-context links or semantic returns; do not restore memorized Star/five-card rules.
- Other languages, unsupported editions and other decks keep correct whole-card inspection/card links without borrowing RWS coordinates. Model configuration is not an aligner release prerequisite.
- “Inference-free” means no annotation-provider calls, registration, retry or background model transport. Existing narrative generation is unchanged; all planned automated acceptance uses recorded prose and makes zero provider calls.
- Preserve beta ports 8787/5175/8789/9235, the primary checkout and every other worktree. The consolidation checkout remains source authority; builds/browser work use owned isolated validation snapshots, disjoint ports and private artifacts under the approved workflow.
- Preserve owner-approved journal exceptions and historical evidence. New failures remain failures; no repeated runs until green, blanket retries, weakened native input, timing windows or visibility assertions.

## Review Focus

1. A plus/pro account with configured model variables must still make zero annotation requests in the aligner lane; pin this in Tasks 1 and 5.
2. Duplicate cards, absent notes, long questions and account switches must preserve exact optional context and clear stale disclosure state; pin this in Task 2.
3. Rapid/buffered prose, a later negation and same-spread replacement must not invent, retract or misbind an active literal; pin this in Task 4.
4. Saved readings with no visual result, old cached cues or expired private handles must remain readable and static without automatic retry; pin this in Tasks 1, 3 and 5.
5. A production build, native touch and spoken VoiceOver can differ from fixture/emulated evidence; pin actual source/build identity and retain separate physical gates in Tasks 5–7.

---

## Ownership, dependencies and file map

The starting source is the latest **working copy**, not just HEAD, of `/home/ubuntu/tarot/.worktrees/reading-review-consolidation-20261010`. Task 0 must reconcile any later changes against the [readiness record](../reviews/2026-10-10-reading-cue-readiness.md). Do not wholesale merge the dirty beta or treat old bridge checkboxes as current state.

| Responsibility | Existing files to modify or inspect | New files to create when executing |
| --- | --- | --- |
| Independent presentation/model flags | `src/lib/readingGestureSettings.js`, `src/contexts/ReadingContext.jsx`, `src/hooks/useJournal.js`, `src/components/journal/entry-card/RestoredReadingGestures.jsx`, `tests/readingGestureSettings.test.mjs` | None |
| Preserve trusted server admission | `functions/lib/readingVisualWebAdmission.js`, `functions/lib/readingJobs.js`, `tests/readingVisualWebAdmission.test.mjs`, `tests/readingJobVisualConfig.test.mjs` | None; runtime changes only if a reproduced boundary failure requires them |
| Persistent context | `src/components/reading/narrative/SpreadCompanion.jsx`, `NarrativeCardFocus.jsx` in the same directory, `src/components/NarrativePanel.jsx`, `src/hooks/useNarrativeReadingController.js`, `src/styles/narrative-card-touch.css`, restored wrapper above | `src/components/reading/narrative/NarrativePersonalContext.jsx`, `src/lib/readingPersonalContext.js`, `tests/readingPersonalContext.test.mjs`, `e2e/reading-personal-context.spec.js` |
| Saved readings without model bindings | `src/components/journal/entry-card/EntrySections/NarrativeSection.jsx`, restored wrapper above, `src/utils/journalStorage.js` | `src/lib/savedReadingGestureSource.js`, `tests/savedReadingGestureSource.test.mjs` |
| Source fidelity | `src/lib/narrativePassageAligner.js`, `src/lib/generatedNarrativePassages.js`, `tests/narrativePassageAlignment.test.mjs`, `tests/generatedNarrativePassages.test.mjs`, `e2e/reading-gestures-dynamic.spec.js` | No new matcher |
| Cross-surface artwork decision | `src/components/SpreadTable.jsx`, `src/lib/readingGestureSettings.js`, `src/hooks/narrativeReadingModelUtils.js`, `src/data/cardGestureAssets.js`, `shared/vision/deckAssets.js` | No new edition or assets unless parent D7 explicitly selects them |
| Production-route acceptance | `e2e/helpers/narrativeFixtures.js`, existing lazy-graph/browser tests, `e2e/journal-visual-restoration.spec.js` | `e2e/reading-aligner-release.spec.js`, `output/reading-motion/aligner-release.playwright.config.mjs`, `scripts/evaluation/runReadingAlignerAcceptance.mjs`, `tests/readingAlignerAcceptance.test.mjs` |
| Decision and release evidence | Current readiness, UI acceptance and physical checklist; `docs/dev-reading-gestures.md`, `output/reading-motion/README.md` | `docs/superpowers/reviews/2026-10-11-reading-aligner-release.md` |

Tasks 1 and 2 depend on Task 0 and may be implemented independently with disjoint ownership. Task 3 consumes both; integrate before Task 5. Task 4 reviews existing source behavior and adds only missing regressions or demonstrated repairs. Tasks 6–7 require the new candidate and actual real-service/device/release evidence; the execution approval does not substitute for any of those results. The model plan consumes Task 1 flags and Task 2 context interfaces; it is not a dependency for releasing this lane.

### Task 0: Freeze the actual candidate and preserve accepted scope

**Files:** Inspect the current readiness/UI acceptance records, Git state and the exact owned-path/served-source manifests referenced by them. Create the dated aligner release review listed above.

**Interface:** The review records `{ head, indexDigest, workingSourceDigest, ownedPaths, retainedEvidence, approvedExceptions, protectedPorts, proposedScope }`; paths and hashes come from actual observations, not copied historical values.

- [x] Record `git status --short`, `git worktree list --porcelain`, `git log -1 --format=%H` and the current diff before any source work; preserve unrelated generated-artwork, WordPress and provider changes.
- [ ] Reconcile current origin/master and merge cargo in a separately authorized integration step; review owned overlaps explicitly. Neither clean a10e nor original beta HEAD is the current source of truth.
- [x] Record both accepted browser exceptions verbatim from the latest receipt: WebKit desktop-normal duplicate-tab timeout and Chromium phone-reduced rejected-successor foreground failure. Preserve their failed native artifacts and owner decision.
- [x] Classify those as model-recovery scenarios whose observed failures occur in shared journal entry opening after reload. They do not block A on model qualification; cover A's actual no-model/cached-static reload behavior and recheck shared paths only when affected.
- [x] Resolve parent D7: at 23:20 UTC the owner explicitly approved retaining the `rws-1909` scan spread with the `rws-immanuelle-vector` companion and its authored highlights. No artwork change is required; ordinary-route verification still checks each surface against this mapping. Never substitute scans beneath vector masks.
- [x] Define affected evidence for the planned flags/disclosure/ordinary-route changes. Retain unchanged artwork acceptance by source/output/pixel identity; do not reopen the entire historical matrix solely because this plan exists.
- [x] Obtain the implementation go-ahead against this concrete scope before creating source commits or running any implementation commands below.

**Acceptance:** An executor can identify exactly which source and evidence are being changed, which acceptance is retained, and which external actions remain closed.

### Task 1: Separate the production aligner flag from annotation requests

**Files:** Flag and request-consumer files in the map; inspect `src/hooks/useReadingGestureRuntime.js`, `src/components/reading/narrative/NarrativeGestureGate.jsx`, `tests/readingGestureLazyGraph.test.mjs` and `tests/readingGestureLazyBrowser.test.mjs`.

**Interfaces:** Extend `readingGesturesEnabled(env = import.meta.env) -> boolean`: retain current development/`reading-cue-validation` behavior and permit ordinary production only with exact `VITE_READING_ALIGNER_ENABLED='true'`. Add `readingVisualRequestsEnabled(env = import.meta.env) -> boolean`, requiring presentation enabled **and** exact `VITE_READING_MODEL_ANNOTATIONS='true'`. Both new flags default off; neither sets server admission/model variables. Existing running-beta files are untouched.

- [x] Add `production aligner opt-in does not grant annotation consent`: vary DEV/mode, missing/false/malformed flags and all web tiers; assert the production UI flag alone never enables `readingVisualRequestsEnabled`.
- [x] Run `node --test tests/readingGestureSettings.test.mjs`; capture the expected missing-helper/production-opt-in failure before implementation.
- [x] Implement the helpers and use the model-request helper for `X-Reading-Cue-Display`, session visual resume, journal polling, transport subscriptions and explicit retry availability. Keep renderer loading, local source tracking, cached cue inspection and prose saves controlled by the presentation helper.
- [x] Preserve exact cached accepted cues when requests are disabled. Do not delete snapshots/private handles merely to suppress transport; account/deletion retirement remains the existing ownership code's responsibility.
- [x] Extend `readingJobVisualConfig`/web-admission tests: configured fake provider plus absent display header starts prose with zero visual registration/DO initialization/provider dispatch; guest/free and MCP/service principals cannot gain model capability from forged payload fields.
- [x] Run `node --test tests/readingGestureSettings.test.mjs tests/readingGestureLazyGraph.test.mjs tests/readingGestureLazyBrowser.test.mjs tests/readingJobVisualConfig.test.mjs tests/readingVisualWebAdmission.test.mjs`; require all assertions to pass. Label installed-browser skips if present.
- [x] Update controlled model fixtures/isolated runner configuration only where they intentionally exercise the model path, supplying the new explicit client flag; do not enable it in normal production or alter live beta configuration.

**Acceptance:** Ordinary production has a deliberate, off-by-default presentation flag independent of provider variables, paid tier and model qualification. With model consent off, passive viewing/saving/reloading and recovery UI cannot submit annotation work.

### Task 2: Keep the exact question and optional notes reachable

**Files:** Context files in the map; reuse `src/hooks/useModalA11y.js` and existing modal conventions. Leave `NarrativeQuestionAnchor.jsx` as the reading's original question presentation.

**Interfaces:** Create `buildReadingPersonalContext({ question, reflections, cards }) -> { question, notes }`, where notes are `{ id, spreadIndex: number | null, label, text }`. Preserve supplied text exactly; string reflections are general context, indexed notes belong to that spread occurrence, and supported card `userReflection` values retain their position. Create `NarrativePersonalContext({ question = '', reflections = null, cards = [] })`, reused by live and restored companions.

- [x] Add named tests `question survives without reflections`, `duplicate card notes stay with spread index`, `general context never becomes a card note`, and `Unicode and long context remain byte-identical`. Assert empty/absent notes produce no invented row or placeholder quote.
- [x] Run `node --test tests/readingPersonalContext.test.mjs`; retain the expected failure before implementing the normalizer.
- [x] Add a compact **Your question and notes** button in the existing companion, available independently of the current cue. It opens a closed-by-default accessible dialog using the existing modal/focus convention, with exact question and optional position-labelled notes in one bounded scroll region.
- [x] Use Escape, close and outside dismissal with focus return; opening never moves underlying prose, changes the source, dispatches inference, or resets a held cue. Connect dialog inspection to the existing `reportInspection` mechanism so automatic visual turns yield while prose keeps arriving.
- [x] Pass actual context through `NarrativePanel`/controller and the saved-entry wrapper. Keep the existing cue-specific quotation distinct from the full original-context disclosure; no model paraphrase and no text-length clipping.
- [x] Add `e2e/reading-personal-context.spec.js`: no-reflection/question-only, general note, duplicate-card notes, keyboard/native touch, 320px and 200% text, long scrolling text, Escape/focus return, held cue plus incoming prose, saved restore, account/source switch. Assert stale context closes/clears and accessible names do not replace reading prose.
- [x] Run the new Node tests and the Task 5 browser launcher after integration; inspect affected screenshots. Preserve same authored cue meaning under reduced motion and zero automatic saved playback.

**Acceptance:** Original supplied context remains reachable throughout a long reading and after restoration, even when the aligner emits no cue. This closes context access, not automatic personal-semantic association.

### Task 3: Restore the companion without a server visual binding

**Files:** Saved-source files in the map; extend `tests/savedReadingGestureSource.test.mjs` and Task 5's ordinary journal cases.

**Starting gap (implemented and covered by Task 5 composite evidence):** `NarrativeSection.jsx` mounted `RestoredReadingGestures` only when `hydrateEntryVisuals(entry).binding` exists. An ordinary aligner-only save has no server visual binding, so the production flag alone could not restore its companion. Task 3 adds local completed-source hydration; the new browser matrix must verify that behavior.

**Interface:** Create `reconcileSavedGestureSource({ previous, entry, restored, fallbackRunId }) -> SourceFrame` in `src/lib/savedReadingGestureSource.js`. `fallbackRunId` is a stable component-owned UUID for the current account/entry; never fabricate a server `readingResultId`, capability or `visualBinding`. Consume validated cached binding/ledger and application-owned presentation mode when present; otherwise hydrate exact saved `personalReading` locally using the existing source-transition helpers. The model plan's `visualCueMode: 'post-reading'` retains its static/revisit-only contract.

- [x] Add `unannotated saved reading has local completed source`, `unchanged entry preserves source identity`, `replaced saved prose invalidates held ranges`, and `cached foreign binding never replaces local prose`. Assert `kind: 'hydrate'`, completed state, correct revisions, no transport credentials and exact source equality.

- [x] Run `node --test tests/savedReadingGestureSource.test.mjs`; retain the expected missing-helper failures before implementing it.

- [x] Allow the opted-in narrative section to mount the restored companion for a saved reading with cards and readable prose even without model metadata. Preserve the existing plain-prose path when disabled or when usable cards/source are absent.

- [x] In the restored wrapper, use the explicit spread/companion edition mapping chosen in D7 for local fallback; preserve valid stored editions and non-RWS identity behavior. An unsupported or changed edition must not borrow vector geometry. Feed actual saved question/notes to Task 2, never a transient reading context.

- [x] Use the reconciled local source for fallback phrase matching and static inspection. Source replacement, entry/account changes and deletion clear old holds/disclosure state; mounting, scrolling or inspecting cannot create a model job or private resume record.

- [x] Run the saved-source tests with `node --test tests/savedReadingGestureSource.test.mjs tests/narrativeGestureSource.test.mjs tests/readingVisualStorage.test.mjs`; exercise no-binding local and controlled cloud restores through Task 5.

**Acceptance:** A normal no-model reading retains its companion, exact context and safe literal/identity revisit after save/reload. Its local presentation identity is never mistaken for trusted model-result ownership.

### Task 4: Qualify the real fallback's source boundaries and name its limits

**Files:** Source-fidelity files in the map; inspect `src/components/reading/narrative/narrativeGestureState.js` and `shared/contracts/readingPassageAssociations.js` without replacing their approved contracts.

**Interfaces:** Preserve `alignReadingPassages(...)`, `resolveNarrativePassages({ source, cards, artworkEdition })`, run/revision identity and exact UTF-16 spans. No new semantic inference API belongs in this lane.

- [x] Add only missing cases: `opening roster stays identity-only`, `later negation cannot retract a published literal`, `same-spread replacement discards old detail`, `named pair has no inferred detail relationship`, `unsupported edition and translated prose retain inspection`, and `saved context cannot lend literal evidence`.
- [x] Preserve original-fixture tests asserting Star has literal pours without interpretation/balance/personalContext, and five-card next steps have no memorized detail returns. A richer authored demonstration is separate evidence.
- [x] Run `node --test tests/narrativePassageAlignment.test.mjs tests/generatedNarrativePassages.test.mjs tests/narrativeGestureState.test.mjs tests/narrativeGestureSource.test.mjs`; document actual new failures. If current behavior passes, record a regression-only task rather than inventing a RED history.
- [x] Repair only demonstrated source-boundary violations. Preserve closed-clause literal admission, safe abstention, source-order turns, the 1,800 ms phase and reader-controlled inspection; do not change B1 start timing or exposure policy through this task.
- [x] Run `node scripts/evaluation/evaluateGestureAlignment.mjs --output=/absolute/new-private-run/alignment.json` against the existing digest-pinned archive. The executor supplies a new owned path; never overwrite the historical default report. Retain per-case misses and denominators.
- [x] Record semantic limitations next to the measured result: literal/identity evidence cannot certify personalized interpretation, multilingual detail recognition, gaze, live model timing or full product fidelity. Do not lower semantic qualification thresholds to make this lane look equivalent.

**Acceptance:** The lane behaves conservatively on actual source text and fails safely on unsupported input. Each semantic limitation is explicit and the original richer experience remains assigned to the model plan.

### Task 5: Verify ordinary reading and journal routes with zero inference

**Files:** Create the acceptance script/config/spec/test listed in the map; reuse current source-identity helpers and controlled narrative fixtures. Do not inherit a configuration that starts or proxies to the beta.

**Interfaces:** Implemented `runReadingAlignerAcceptance.mjs --manifest=/absolute/owned/manifest.json --evidence-root=/absolute/new/private-root` builds and serves an isolated ordinary production candidate, then invokes the new Playwright configuration. The manifest pins source/output digests, owned loopback ports, `mode: 'production'`, `dev: false`, exact UI/model flags, browser projects and `apiMode: 'offline-fail-closed'`. Reuse identity hashing/isolation patterns without falsely labelling this build `reading-cue-validation` to satisfy the older harness. Reject protected/in-use ports, stale output, inherited provider credentials and external API origins before startup; clean up only processes it owns.

- [x] Add `readingAlignerAcceptance.test.mjs` assertions for protected ports, unpinned source, flag mismatch, unsafe proxy and reuse of prior evidence directories; use fake process/network adapters. Run `node --test tests/readingAlignerAcceptance.test.mjs` before and after launcher implementation.
- [x] Add normal-route guest/free/plus/pro cases in `reading-aligner-release.spec.js`, using controlled authentication/tier and narrative transport. Never navigate the gesture fixture as a substitute for ordinary reading generation, completion, save and journal reopen.
- [x] Record the parent's D1 disposition before new timing acceptance: retain the current complete-quote/exposed-line policy unless an alternative is explicitly approved. This does not reopen unchanged owner acceptance or authorize changing B1 start behavior.
- [x] Exercise partial paced SSE, synchronous burst, final-only completion, reconnect, source replacement and error with exact supplied raw text. Capture actual source/render/visibility/turn events on one browser clock; verify the existing 1,800 ms eligible turn, no forced scroll, no held-state theft and no artificial slow prose.
- [x] Verify immediate revealed shelf inspection before a matching introduction; ten-card positions, duplicate occurrences, unknown artwork, non-RWS and translated readings keep correct artwork/identity. No literal geometry or personal meaning is fabricated.
- [x] Add `RWS spread and companion follow the recorded edition decision` to the ordinary-route spec: assert both actual image URLs/editions against D7, bind overlays to their own edition, preserve reversal once, and repeat after save/reload. Review one upright/reversed pair on desktop/phone with both surfaces visible. If D7 changes assets or geometry, expand affected coverage and rebind model catalog evidence before claiming unchanged picture acceptance.
- [x] Save/reload entries with no visual metadata, cached accepted metadata and expired handles. Assert exact prose/notes, static restore in both motion preferences, zero automatic retry/annotation POSTs/subscriptions, and no misleading model-recovery action in the aligner-only lane.
- [x] In WebKit desktop-normal and Chromium phone-reduced, explicitly cover no-model journal reload → native entry expansion → static phrase/card inspection. These exercise the shared controls implicated by the two model-recovery exceptions without invoking retry or reopening their historical results. Preserve foreground predicates/native input and record any new failure on its own source identity.
- [x] Count intercepted annotation endpoints and fake server/provider dispatches separately; require zero. Test accidental server model configuration without client consent. Do not mistake zero intercepted network calls for a server dispatch proof.
- [x] Run the launcher once per approved candidate: `node scripts/evaluation/runReadingAlignerAcceptance.mjs --manifest=/absolute/owned/manifest.json --evidence-root=/absolute/new/private-root`. It must include `reading-aligner-release.spec.js` and `reading-personal-context.spec.js` in Chromium/WebKit, desktop/phone and normal/reduced profiles with one worker and zero retries.
- [x] Preserve every native failure and identify any affected historical exception. Unchanged accepted exceptions remain accepted exceptions; a newly affected failure needs a diagnosis or explicit owner decision, not silent carry-over. Record screenshots, source/output identity, actual auth mocks and cleanup.

The [execution record](../reviews/2026-10-11-reading-aligner-release.md#mobile-webkit-input-follow-up) maps candidate 14's 180 passing cases to four fresh supported-input passes, verifies all 590 output files are identical and retains the original four failures plus the failed first follow-up. This is not a single green 184-case run.

**Acceptance:** A normal production build with only the aligner flag offers the intended narrower experience across all web tiers without annotation inference. Controlled tier/browser evidence remains distinct from real authenticated deployment evidence.

### Task 6: Complete the separate physical and real-service gates

**Files:** Update [physical checklist](../reviews/2026-10-10-reading-iphone-voiceover-checklist.md), [physical results](../reviews/2026-10-10-reading-iphone-voiceover-results.md) and the new aligner release review with actual observations only.

- [x] Prepare an isolated HTTPS preview proposal covering final artifact pinning, no-model settings, operator/device fields, rollback and cleanup. The private proposal specifies a separate restricted replay-only Worker with no provider/D1/DO cargo; its subsequently authorized publication is recorded below.
- [x] After ordinary-route acceptance, bind the reviewed local preview package to the qualified frontend and verify actual local service-worker/CSP behavior. The [local preview evidence](../reviews/2026-10-11-reading-aligner-release.md#private-preview-preparation) records the complete Chromium/WebKit pass and all six retained failed setup attempts. The owner will operate the iPhone 14 Pro Max; its iOS version remains unspecified and no mid-range handset is available. Local preparation does not authorize external publication or device execution.
- [x] Obtain scoped external authorization and publish the concrete restricted preview for the owner's iPhone review. The [publication record](../reviews/2026-10-11-reading-aligner-release.md#restricted-preview-publication) pins the exact frontend/controller, real Access policy, active version and 24-hour expiry. Owner-operated guest testing is authorized; actual physical observations remain `NOT_RUN`. Production release, signed-in physical tiers and model work remain separate.
- [x] Verify local guest and real signed-in Pro reading/journal behavior, then log out using [the private reviewer workflow](../../local-reviewer-account.md). The [execution record](../reviews/2026-10-11-reading-aligner-release.md#real-local-authentication-boundary) records the fresh local Worker/D1 core run and separate native Save follow-ups: authentication and persistence are actual, narrative content is supplied. This closes the local guest/Pro scope only; deployed service, real Free/Plus accounts and physical devices remain unverified.
- [ ] On physical Safari/VoiceOver, test phrase speech and label-in-name, rotor/order, native tap/double-tap, current/held states, focus through append/completion, question/notes dialog, touch resize and static saved/reduced-motion behavior. Record actual spoken output and device/OS versions; emulated WebKit cannot close this gate.
- [ ] Measure cold/warm artwork decode, scrolling, touch response, memory and long-reading playback on an identified mid-range handset with a fixed workload. Preserve original timing/layout tolerances; classify qualitative video separately from instrumented data and resolve observed unreadable crops, covered prose or sustained stalls before release.
- [ ] Triage the inherited 174 × 994 px Thoth Star/Sun assets and the observed Star companion framing before release. Current unsupported-edition URL/decode and identity assertions do not establish visual artwork acceptance; retain the frozen assets until their provenance and any proposed correction are reviewed.
- [x] Keep the original direct-art pool/land revisit as an explicit design decision: current whole-card activation does not prove semantic hit regions. A proposed hit-region interaction needs its own approved detail-target contract, keyboard/VoiceOver alternative and source-grounding tests; do not silently add it to this lane.

**Acceptance:** Physical/device and real-auth rows contain supported outcomes or explicit open gates. Model qualification is not required for this lane; missing physical/accessibility evidence cannot be replaced by model success.

### Task 7: Prepare a scoped release decision and reconcile documentation

**Files:** New aligner release review, `docs/dev-reading-gestures.md`, `output/reading-motion/README.md`, current readiness and the parent intent-closure plan; follow the parent's historical-document reconciliation rules.

- [x] On the reviewed implementation run `npm test`, `npm run lint`, `npm run build`, `npm run test:a11y`, `npm run docs:check` and `git diff --check`. The execution record retains 4,157 passes/2 opt-in skips, static accessibility advisories, source identity and separate browser scopes. Refresh documentation checks after final status edits; retained browser exceptions remain historical failures.
- [x] Run `npx wrangler deploy --config wrangler.jsonc --dry-run --outdir /absolute/new-private-run/worker-bundle` only after confirming the local command is bundle-only. This does not apply migrations or prove deployed runtime behavior.
- [ ] If the selected deployable artifact includes provider/reading-generation changes from any ancestry, run the repository-required `npm run ci:narrative-check` under the owner's Claude subscription, never paid API fallback; bind it to that candidate and preserve generated historical outputs. The current combined branch contains such changes; a UI-only alternative has not been constructed. No narrative gate is needed merely to edit these documents.
- [x] Record shipped-versus-proposed wording: “card identity and supported literal imagery” for this lane; reserve “personalized interpretations, balance and grounded returns” for qualified model behavior. Keep original demos labelled authored and joint-generated experiments historical.
- [x] Prepare the explicit 54-path implementation checkpoint and private release manifest under the existing scoped commit/push approval. The manifest separates the qualified frontend, composite provenance, model flags remaining off, physical/auth gates, retained owner exceptions and unresolved deployment cargo. A feature-branch source backup does not authorize a merge, preview publication or production release.
- [ ] Resolve parent D3 for the actual deployable artifact: either select a reviewed UI-only artifact excluding dormant server changes, or assess every included server path, migrations 0036–0038 and the `ReadingVisualJob` class migration (`READING_VISUAL_JOBS` binding). Pure local alignment needs no model schema, but a bundled dormant server implementation may still require schema/DO compatibility, upgrade-order and rollback evidence on separately authorized resources. Do not bypass that artifact requirement by calling the product lane inference-free.
- [ ] Only after release authorization, enable `VITE_READING_ALIGNER_ENABLED=true` in the approved production build, retain `VITE_READING_MODEL_ANNOTATIONS` off and model activation variables unset, execute the approved repository release workflow, and verify active Worker version plus live asset/build identity and ordinary-route no-annotation behavior. Roll back with the UI flag off if the agreed acceptance fails.

**Completion:** The aligner lane is complete only when its scoped implementation, affected automation, context access, physical/real-service evidence and authorized production verification are recorded. Completion does not claim generalized personalized accompaniment or approve the [post-reading model lane](2026-10-11-reading-post-reading-model.md).

## Handoff evidence

The executor records these separately; one row cannot substitute for another:

| Evidence | Required statement |
| --- | --- |
| Source and Git | Exact working-source/commit identity, owned paths, remote parity if publication was authorized, and preserved unrelated work. |
| Local automated acceptance | Newly affected cases, retained unchanged evidence, unresolved failures and the two historical owner exceptions, each with provenance. |
| Human/device acceptance | Actual question/notes usability, native VoiceOver/touch results and measured handset limitations. |
| Release | Whether activation was authorized, flag values, deployed version, live asset identity and no-annotation verification. |
| Product boundary | Identity/literal accompaniment released or pending; personalized semantic annotation remains separately qualified and gated. |
