# Independent Visual Cue Handoff Implementation Plan

> October 9 execution: the user authorized Tasks 1–2 only. Their ledger, source-prefix consumer and visibility-aware arrival behavior are implemented and verified; see the [execution record](../reviews/2026-10-09-reading-cue-ledger-arrival.md). Tasks 3–5 remain pending and production stays gated.

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to execute the tasks. Unchecked steps below are planned work, not completed implementation.

**Goal:** Make independent visual annotations accumulate, select the right visible passage, and survive reading completion and journal restoration without changing or delaying the narrative.

**Architecture:** The application observes accepted outgoing prose and submits immutable snapshots to a separate visual job. That job owns a cumulative cue ledger and publishes validated snapshots independently of the narrative stream. The browser reconciles cue arrival against actual passage visibility; saved entries reference a source-bound result and hydrate it statically.

**Tech Stack:** Existing Worker/Durable Object architecture, D1 journal persistence, shared Zod contracts and pure ESM utilities, React focus provider/reducer, Node tests and controlled Playwright routes. No new animation library is required.

**Spec:** The user-reviewed [two-model architecture](2026-10-09-reading-gestures-react-bridge.md#independent-visual-cue-model-production-direction), the four subsequent handoff findings, and the original [reading imagery spec](../specs/2026-10-08-reading-imagery-motion.md). This document is the next implementation milestone; the parent plan retains historical bridge tasks and evidence.

## Global constraints

- The reading model receives no visual-cue schema, catalog, routing instructions or tool calls. The visual model returns associations only and cannot rewrite prose.
- Annotation work cannot gate prose delivery, narrative completion or saving a completed narrative. “Save immediately” means without waiting for annotation work; normal storage writes still apply.
- Source offsets are absolute UTF-16 offsets in the exact delivered raw Markdown. Formatting, trimming, translation and TTS normalization are not source identity.
- One annotation request may be in flight and one latest source snapshot pending per visual job. Replacing pending work never replaces accepted cues.
- Held inspection wins. Automatic motion remains coalesced and visibility-gated, with existing finite active/settling durations. Reduced motion and restored readings have zero automatic arrival animations.
- Existing production feature gates stay off until the separated pipeline has passed its own latency, semantic and device checks. The historical joint-generated corpus does not qualify this pipeline.
- The visual provider/model is explicitly configured independently of the narrative provider. No implicit provider fallback or live request occurs when that configuration is absent. This plan defines the adapter seam; it does not select a model, authorize deployment or apply migrations.

## Review focus

1. A return in batch 2 references a literal accepted in batch 1, despite retries or replacement of pending batch work: Task 1.
2. An earlier currently visible cue arrives with a later offscreen cue, including while inspection is held: Task 2.
3. Buffered SSE or final-only JSON delivers the whole reading before annotation finishes; finalization can substitute different text: Task 3.
4. Save succeeds before any cues exist, then the browser closes and the restored entry obtains later cues: Task 4.
5. Duplicate saves, account changes, deletion, source replacement, expired guest jobs and restored motion cannot cross-attach results or resurrect a reading: Tasks 1, 3–5.

## Handoff contracts

### 1. Source identity, cumulative ledger and batch application

`readingResultId` is a server-issued opaque identity for one narrative attempt, issued before delivery. It survives narrative `done` and is distinct from tracing `requestId`, journal entry ID and deduplication `sessionSeed`. Use this identity as the stable gesture `runId` in live and restored sources; transport job IDs and private resume credentials remain separate. A new generation gets a new result ID; non-prefix replacement within an attempt increments `sourceRevision`. Ordinary appends do neither.

The application owns a binding `{ readingResultId, sourceRevision, spreadHash, contextHash, artworkEdition, catalogVersion }`. Hashes cover canonical spread occurrences/orientations and the supplied question/reflections. A visual request adds `{ batchId, requestSequence, analyzedEnd, analyzedHash, baseLedgerRevision }`. `analyzedHash` hashes exact `raw.slice(0, analyzedEnd)`; an accepted shorter prefix remains valid as prose grows. Do not accept source IDs, ownership or these hashes from model output. An edition/catalog/context change creates a new visual binding; a request against the previous binding cannot mutate the new one.

The visual model returns proposals with batch-local aliases, exact quotations/occurrences, kind, targets, optional context and literal references. References distinguish `{ acceptedCueId }` from `{ localAlias }`; prior accepted literals are supplied with their application IDs. The server resolves quotations to absolute spans and remaps local aliases only after validation.

The cumulative `CueLedger` contains the binding, monotonic `ledgerRevision`, immutable accepted cues, dependency IDs, introductions, applied batch receipts and the analyzed source boundary. Each cue retains its exact span/quote, kind, targets, validated context and provenance. The application assigns `cueId` as `vc:` plus SHA-256 of canonical JSON containing the binding, span, kind and canonical sorted targets; canonicalization sorts object keys and target/detail IDs. The growing full-text hash, batch position and model alias are excluded, so appends and retries retain IDs. Context stripping at presentation time does not rename the underlying cue.

Apply a batch under the visual job's serialized writer:

1. Verify ownership/binding and exact analyzed prefix against authoritative raw text. Require an application-issued request record; reject responses for unknown, cancelled or replaced requests.
2. The same `batchId` and payload digest is an idempotent no-op. A different payload for the same batch ID is a conflict. Equivalent proposals in another valid batch map to the existing cue ID without updating it or restarting playback. A stale base ledger is not itself fatal: validate against the current cumulative ledger rather than discarding safe prefix results merely because newer prose exists.
3. Validate returns against previously accepted literals plus earlier accepted literals in this batch. Every referenced literal must be in the same binding, occurrence and supported detail, and end no later than the return starts. Reject missing, future, cross-binding or rejected dependencies; keep unrelated valid proposals and all prior accepted cues.
4. Exact duplicate cues coalesce. A nonidentical overlap with an accepted span rejects the new proposal; it never evicts an accepted or held association. Within a new batch, process by `(start, end, proposalIndex)`, accepting the first valid candidate and rejecting later conflicts and dependent returns. The existing nonoverlap contract remains explicit; no silent replacement or annotation quota.
5. Commit accepted additions, aliases and batch receipt atomically before publishing the cumulative snapshot. Increment `ledgerRevision` only when public cue state changes. Recompilation uses the entire accepted ledger, or a compiler API with equivalent validated prior-literal support; compiling independent documents alone is insufficient.

All accepted cues remain discoverable for revisit even if they never played automatically. Ledger retention, pending model work and automatic playback history are separate concerns. Source replacement retires the old binding for the active reading; a separately saved old result remains attached to its own immutable prose.

### 2. Cue arrival and passage visibility

Add a dedicated `CUES_ARRIVED` transition with source binding, `ledgerRevision`, cumulative cues/introductions, added cue IDs and the current rendered source-range visibility snapshot. It must not advance raw, rendered or visible text progress. Duplicate/older ledger revisions cannot reset current focus, held state, phase or deadlines. A client missing updates fetches a cumulative snapshot instead of applying an incomplete delta.

Selection is deterministic:

1. Explicit held/modal inspection retains focus. An existing active, still-visible cue keeps its original finite deadline.
2. Otherwise choose at most one unconsumed eligible cue from **currently visible, fully delivered/rendered passages**. Within that visible set choose greatest passage end, then stable cue ID as a tie-break. A later offscreen cue cannot suppress an earlier visible cue. This is an ordering rule, not a claim to track gaze.
3. Keep at most one latest visible candidate pending while inspection or active motion blocks a transfer. Recompute on release, settlement and visibility changes; never play a captured queue.
4. Mark played or coalesced automatic candidates consumed for the mounted binding. Repeated metadata/progress/reconnect cannot restart a settled cue. Explicit revisit may intentionally activate it. Cues for passages already passed before their arrival remain available statically; unseen future passages may become eligible on first visibility.
5. New annotations may not yet have observed DOM spans. Resolve their exact ranges against existing rendered visibility measurements, or defer until their observer entries exist. Absence of visibility evidence never means visible. Recheck the snapshot after DOM registration.

For reduced motion or restored readings, arrival updates the static association and revisit registry without starting motion. A restore resets held state, pending playback and deadlines. A live reading that just emitted `done` is not a restored reading: useful late cues may still accompany its currently visible passage.

### 3. Observation and delivery timing

For the app job path, observe `ReadingJob.appendEvent` after accepted `delta`/`done` data has updated `textSoFar` and been committed to the outgoing event history. The JSON completion path also calls this boundary. Dispatch to the visual job without awaiting model work. Do not observe provider tokens, rejected candidates or text before `finalizeReading`; the observer must see any accepted safe-fallback substitution. If a final `fullText` replaces already delivered text, invalidate the previous binding before accepting further results.

Current `createReadingStream` chunks an already completed reading without pacing, and the Responses path buffers for checks. Treat paced SSE, burst SSE and final-only JSON as distinct delivery modes. Coalesce synchronous bursts into a latest snapshot; a complete reading may reach the client before the first annotation. Never slow prose or stage artificial chunks to conceal that latency. Direct non-job consumers retain existing behavior until they use this same accepted-result boundary; do not add an earlier provider-level observer as a shortcut.

Measure server `availableAt → annotationStartedAt → annotationFinishedAt → ledgerCommittedAt` and, separately on the client, passage receipt/render, visibility intervals and cue receipt/adoption. Attribute a batch to the latest event containing its analyzed prefix. Never subtract server timestamps from browser timestamps. Report model round-trip latency, passage-to-cue lag and how often cues arrive during a visible passage, after it, or only after completion. No live choreography claim follows from saved replay timing.

### 4. Independent visual completion, save and restore

The narrative job retains its existing completion/cleanup behavior. A separate `ReadingVisualJob` holds authoritative source binding, ledger, pending/in-flight request identity, cursor, recovery epoch and status (`pending`, `running`, `complete`, `failed`, `cancelled`, `expired`). Persist state before publication and recover the latest pending snapshot after eviction; abandoned requests from an older recovery epoch cannot commit. Expose a separately authenticated visual status/stream/cancel lifecycle. Cancelling visual work keeps accepted cues. Narrative `done` closes only the narrative stream.

The current app ReadingJob's one-hour retention is insufficient for saved cloud readings. Add durable D1 `reading_visual_results` records and `journal_visual_links` alongside existing `journal_entries`. The former stores owned result/binding, authoritative final raw/hash, ledger revision/snapshot and visual status; the latter links a journal entry to that exact result. Ownership is resolved from authenticated server context, never a caller field or bare result ID. Anonymous capability access remains distinct from ownership and must not become a public result lookup.

Cloud save persists prose immediately and validates any visual attachment against the authenticated owner and exact raw/spread/deck/question/reflection fingerprint. A valid reference pins the result independently of reading-job cleanup and later ledger commits update that result, not a browser-only copy. Restore joins the latest ledger. An absent, invalid or temporarily unavailable visual attachment cannot fail prose saving: record attachment state, preserve any validated snapshot, and allow bounded attachment/re-annotation retry from the saved exact prose. Do not claim pending attachment is complete. Session-seed deduplication must compare the actual saved fingerprint before attaching a new result.

For guest/local journals, save the accepted cue snapshot and source binding with the entry. Store resumable visual capability/cursor separately in private user-scoped storage, excluded from exports/shares. Reload hydrates the saved snapshot and resumes the visual job if available; late results patch only an existing entry with the same binding. Existing guest job retention remains bounded, so closing the browser past expiry cannot guarantee receipt of later cues. Preserve prose/cached cues and permit a bounded visual re-annotation of the saved source, without regenerating the narrative. An offline/quota error in optional cue storage must not break a prose save that otherwise succeeds.

Deleting an entry removes its link; deleting the last saved reference permits result cleanup and invalidates in-flight work before removal. Completion updates existing matching records only, never upserts a deleted result or recreates a journal entry. Account deletion and changes revoke/switch access; regeneration creates a different result. Saved cloud results outlive narrative-job expiry while linked. On restoration, an opt-in gesture wrapper is required around the journal narrative renderer, which currently uses plain ReactMarkdown; persisting JSON alone does not provide revisit interaction.

## Tasks and interfaces

### Task 1: Cumulative source-bound ledger

**Files:** create `shared/contracts/visualCueBatches.js`, `shared/reading/visualCueLedger.js`, `tests/visualCueLedger.test.mjs`; modify `shared/contracts/generatedPassageAnnotations.js` and `tests/generatedPassageAnnotations.test.mjs` only as needed for cumulative validation.

**Interface:** `createVisualCueLedger(binding) -> CueLedger`; `await applyVisualCueBatch({ ledger, issuedRequest, response, authoritativeRaw, validationContext }) -> { ledger, addedCueIds, rejected, duplicate }`. The apply operation is asynchronous for native SHA-256 hashing; creation remains synchronous. `response` is proposal-only model output. Context includes the exact spread, supported edition details, question/reflections. Persist receipts even if all proposals reject, so retries remain deterministic.

- [x] Write cases `cross_batch_literal_return`, `same_batch_retry`, `equivalent_new_batch`, `conflicting_retry`, `accepted_span_overlap`, `rejected_literal_dependency`, `growing_prefix_keeps_ids`, and `replaced_source_rejects_old_result`. Assert batch 2's return retains the batch 1 literal ID, identical retries add zero IDs and leave ledger revision unchanged, and rejection leaves prior cues byte-identical.
- [x] Run `node --test tests/visualCueLedger.test.mjs`; confirm the missing contract fails before implementation.
- [x] Implement the ledger, ID mapping, deterministic overlap handling and cumulative compilation specified in contract 1.
- [x] Run `node --test tests/visualCueLedger.test.mjs tests/generatedPassageAnnotations.test.mjs tests/readingPassageAssociationValidation.test.mjs`; require all pass, then commit this task's paths.

### Task 2: Visibility-aware cue arrival

**Files:** modify `src/components/reading/narrative/narrativeGestureState.js`, `NarrativeCardFocus.jsx` in the same directory, `src/components/StreamingNarrative.jsx`, `src/lib/generatedNarrativePassages.js`, `src/lib/narrativeGestureSource.js`; extend `tests/narrativeGestureState.test.mjs`, `tests/narrativeGestureSource.test.mjs`, `tests/generatedNarrativePassages.test.mjs`, and `e2e/reading-gestures-generated.spec.js`.

**Interface:** consume Task 1's cumulative snapshot and `addedCueIds`; dispatch `CUES_ARRIVED` with `{ binding, runId: binding.readingResultId, sourceRevision: binding.sourceRevision, ledgerRevision, associations, introductions, addedCueIds, visibilitySnapshot, now }`. Keep `SOURCE`/`PROGRESS` responsible for prose lifecycle. Accept a lagging analyzed prefix only through verified binding, not by flipping a string-prefix comparison alone.

- [x] Add the reproduced `[earlierVisible, laterOffscreen]` case: `current.id === earlierVisible.id`, with no offscreen pending cue. Add held arrival/release with changed visibility; duplicate-after-settlement preserving `activeUntil`; delayed observer registration; skipped older visible cues; source replacement; and static restored/reduced-motion cases.
- [x] Run the three Node test files above and confirm the new arrival assertions fail before implementation.
- [x] Implement contract 2 and bridge newly registered source ranges to current visibility. Preserve accepted/fallback held associations through registry changes until explicit release.
- [x] Run those Node files and the generated browser spec using the existing React-bridge Playwright config; require no focus theft, prose change, backlog or hydrated motion. Commit this task's paths.

### Task 3: Accepted-delivery observation and independent visual job

**Files:** create `functions/lib/visualCueObserver.js`, `src/worker/readingVisualJob.js`, `functions/lib/readingVisualJobs.js`, `functions/api/reading-visual-job.js`, `tests/visualCueObserver.test.mjs`, `tests/readingVisualJob.test.mjs`; modify `src/worker/readingJob.js`, `functions/api/tarot-reading-job-start.js`, `src/worker/index.js`, `wrangler.jsonc`; extend `tests/readingJob.test.mjs`. Create annotation-only `shared/generation/visualCuePrompt.js`; leave historical joint-generation evidence intact.

**Interfaces:** `observeDeliveredReading({ binding, raw, deliveredEventId, complete, availableAt })` submits a snapshot after contract 3's boundary; `runAnnotation({ prompt, responseSchema, signal }) -> proposalResponse` is an explicitly configured independent model adapter. `ReadingVisualJob` serializes Task 1 commits. New binding `READING_VISUAL_JOBS` and a distinct appended DO migration belong to this task; no deployment is part of it.

- [ ] Write accepted-vs-rejected/fallback source tests and burst-SSE/final-only cases. Hold a fake annotation promise unresolved and assert narrative deltas and `done` still finish. Assert one in-flight/one latest pending request; earlier accepted ledger entries survive coalescing.
- [ ] Add eviction recovery, duplicate callback, cancellation, old recovery-epoch response, non-prefix final replacement, missing model configuration, and owner/capability isolation tests; run `node --test tests/visualCueObserver.test.mjs tests/readingVisualJob.test.mjs tests/readingJob.test.mjs` to confirm missing behavior.
- [ ] Implement accepted-delivery observation and separate job state. Add `/api/tarot-reading/visuals/:readingResultId` GET snapshot, `/stream` GET resumable events, and `/cancel` POST routes in the new route handler. Authenticate each independently; result IDs alone are not credentials. Emit cumulative ledger snapshots so cursor gaps can recover safely. Narrative completion does not terminate this channel.
- [ ] Verify source/schema instructions reach only the visual adapter; implement annotation prompt tests in `tests/visualCuePrompt.test.mjs`. Run those plus the three job test files; require unchanged reading-only request snapshots and passing recovery tests. Commit this task's paths.

### Task 4: Save immediately, attach durably, restore statically

**Files:** create `migrations/0036_reading_visual_results.sql`, `functions/lib/readingVisualResults.js`, `src/lib/readingVisualStorage.js`, `src/hooks/useReadingVisualJob.js`, `tests/readingVisualResults.test.mjs`, `tests/readingVisualStorage.test.mjs`; modify `functions/lib/journalEntries.js`, `functions/api/journal/[id].js`, `functions/api/journal.js`, `functions/api/account/delete.js`, `src/contexts/ReadingContext.jsx`, `src/hooks/useSaveReading.js`, `src/hooks/useJournal.js`, `src/components/journal/entry-card/EntrySections/NarrativeSection.jsx`; extend `tests/journalEntriesService.test.mjs` and `e2e/journal-save.integration.spec.js`. Reserve/check migration numbering at execution against the then-current branch.

**Interfaces:** `commitVisualResult({ binding, expectedLedgerRevision, ledger, status })` conditionally updates an existing owned result; `attachJournalVisualResult({ userId, entryId, readingResultId, savedSource })` validates the complete fingerprint and returns attachment state without gating the prose save on a model; `loadJournalVisualResult({ userId, entryId })` returns the latest validated snapshot. `useReadingVisualJob({ binding, resumeHandle, enabled })` owns the visual subscription independently of the cleared narrative-job ref.

- [ ] Add database/service tests: save before first cue → complete visual work with client disconnected → restore newer ledger; duplicate session seed/different raw cannot attach; ownership mismatch, source revision conflict, deleted result and last-link deletion reject late updates. Use isolated test databases, not live migrations.
- [ ] Add local storage tests: snapshot saved before cues, separate private resume record, account namespace switch, existing-entry-only late patch, offline/quota/expired capability fallback, no capability in exported/shared entry. Confirm these fail before implementation.
- [ ] Implement contract 4, including durable cloud links, result retention, attachment retry state, local snapshot updates and journal restore rendering. Keep canonical prose and its source identity together; explicitly reset playback/held state when hydrating.
- [ ] Run `node --test tests/readingVisualResults.test.mjs tests/readingVisualStorage.test.mjs tests/journalEntriesService.test.mjs`; add controlled authenticated and local Playwright save/reload cases to the existing integration spec. Require immediate prose save, later cue recovery, no resurrected entries and zero automatic restored motion; commit this task's paths.

### Task 5: Separated-pipeline acceptance evidence

**Files:** create `scripts/evaluation/evaluateVisualCueHandoff.mjs`, `e2e/reading-visual-handoff.spec.js`; extend `output/reading-motion/react-bridge.playwright.config.mjs` and add a separately labelled evidence folder under `output/reading-motion/evidence/`.

**Interface:** replay immutable reading-only outputs through the independent visual adapter and Task 3's delivery boundary, then consume the same cumulative snapshots in the browser. Preserve source hashes, prompt/model provenance, per-batch timings, validation rejections and retention outcomes. Do not overwrite historical joint-generation results.

- [ ] Write end-to-end cases covering the five Review Focus conditions, plus fully translated identity fallback and whole-card-only unknown editions. Parameterize paced, burst and final-only delivery, delayed/out-of-order results, hidden/offscreen passages, held inspection, and reload while visual work remains pending.
- [ ] Run controlled tests first: `npx playwright test --config output/reading-motion/react-bridge.playwright.config.mjs e2e/reading-visual-handoff.spec.js`. Report actual failures and what is mocked; do not treat these as live model latency evidence.
- [ ] Once an independent visual model is explicitly configured, run the unchanged reading corpus through that adapter and report contract 3's timings and semantic findings, including misses. No joint prose+annotation generation or replay pacing may substitute for this measurement.
- [ ] Run appropriate root tests, build, modified-path lint and docs checks before publishing implementation. Narrative gates use the existing subscription-only policy; preserve the documented baseline evaluator failure if still present. Finish with a source/runtime review and keep production rollout gated on the actual separated-model evidence.

## Pre-implementation review evidence (`68ee6cf`)

Runtime at `68ee6cf` is unchanged from the reviewed `d0f2223`; only the parent plan changed between them. Fresh read-only probes reproduced the cross-batch reference rejection and late-visible selection issue. Source inspection verified accepted-response buffering, narrative job cleanup, omitted journal semantics and the plain journal renderer. `node --test tests/narrativeGestureSource.test.mjs tests/generatedPassageAnnotations.test.mjs tests/narrativeGestureState.test.mjs` passed 25 existing tests. Those tests do not cover the newly specified contracts; none of the unchecked implementation tasks above is claimed complete.


## Tasks 1–2 execution notes

The two fixes ship together with source/renderer integration and regressions. The ledger reuses the existing compiler with accepted literal dependencies; it does not modify the historical document compiler or its per-batch limit. Cumulative state retains exact analyzed `raw`, source binding, immutable cues, introductions and batch receipts. The host must look up active requests and serialize/durably commit the returned state before publication.

The development-only `sourceMode=visual-cues` fixture establishes its own application binding before prose, then accepts independent prose and ledger events through the real client helpers. Its controlled delivery tests do not implement or qualify the Task 3 server/model pipeline. SOURCE retains presentation reconciliation; CUES_ARRIVED handles metadata, and atomic renderer measurements gate selection. A shared latest-measurement reference prevents parent/child effect ordering from consuming an unplayed pending cue.

For exact commands, fresh results, observed failures and remaining boundaries, see the [execution record](../reviews/2026-10-09-reading-cue-ledger-arrival.md).
