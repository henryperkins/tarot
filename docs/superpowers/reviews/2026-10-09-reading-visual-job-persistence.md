# Tasks 3–4 review and Task 5 acceptance start

> Subsequent implementation addresses these verified findings. See the [repair and verification record](2026-10-09-reading-visual-repairs.md). This review preserves the original failing evidence and is not the current implementation status.

Reviewed the uncommitted Task 3–4 handoff in `codex/reading-gestures-react-bridge`, based on `9250f4c27d0126d16fa3b455f0446ffdad74534f`. This record describes the working tree, not that commit alone. Task 3 and Task 4 are incomplete at their integration boundaries. Task 5 has begun with controlled acceptance checks; production rollout remains gated.

## Verified findings

1. **High: a known result ID can cross-attach another reading's cue source.** `attachJournalVisualResult` creates an owned placeholder for any supplied result ID; `commitVisualResult` permits a null-owner writer to replace its binding and source without a matching fingerprint. Public app starts do not resolve the visual owner. A controlled second user saved unrelated prose using a known job ID without its capability; the job's later completion exposed its different `ledger.raw` through that user's journal. This requires knowledge of the opaque ID; no enumeration or live-account access was attempted. Resolve ownership from authenticated server context, register the result before accepting attachments, and condition commits on the complete authoritative binding. Sources: [result persistence](../../../functions/lib/readingVisualResults.js), [app start](../../../functions/api/tarot-reading-job-start.js), [job initialization](../../../functions/lib/readingJobs.js).

2. **High: real start requests produce an empty visual spread and personal context.** Initialization reads `cards`, `question`, and `reflections`, while the validated request contains `cardsInfo`, `userQuestion`, and `reflectionsText`. The acceptance probe records no cards and blank context. Even after correcting these field names, the prompt needs occurrence indexes and supported detail IDs: actual request cards do not contain them. Normalize the validated spread, deck edition and optional context once, and use that representation for both fingerprints and prompt input. Visual initialization is also awaited before narrative startup; an unresponsive optional visual service can delay the reading. Sources: [start helper](../../../functions/lib/readingJobs.js), [request schema](../../../shared/contracts/readingSchema.js), [visual prompt](../../../shared/generation/visualCuePrompt.js).

3. **High: asynchronous job transitions can lose accepted state or restore an obsolete source.** Hashing yields before `inFlightRequest` is assigned. Three concurrent observations start three adapters and lose request receipts. Replacement during asynchronous batch application leaves the new binding at source revision 1 with a revision-0 ledger. An unregistered request can commit because the request registry is never checked. Cue and done events publish before durable persistence. Serialize state transitions and ledger commits, validate registered requests and the current binding after asynchronous work, and persist before publication. Source: [visual job](../../../src/worker/readingVisualJob.js).

4. **High: completion before save and deduplicated saves violate restore identity.** No durable result row exists until a save creates a placeholder; completion beforehand returns `not-found`, which the job ignores. Saving afterward restores pending revision 0 with no cues. For same-seed deduplication, the incoming source is validated while linking to an existing entry containing different prose. The probe restores old prose with the new result's `final_raw`. Register results through a trusted lifecycle before completion; validate attachments against the actual stored entry. Sources: [result persistence](../../../functions/lib/readingVisualResults.js), [journal save](../../../functions/lib/journalEntries.js), [visual completion](../../../src/worker/readingVisualJob.js).

5. **High: the application never connects the separate visual stream or restored gesture surface.** `useReadingVisualJob` has no application caller. Normal narrative `meta` replaces the result ID and visual credentials stored at start. The gesture source still uses a client run ID without the visual binding. The hook's ledger omits required source-prefix fields, and its polling path never invokes the batch callback. Journal list loading does not join visual results; journal rendering adds noninteractive cue labels rather than the static gesture/revisit wrapper. The two new journal storage helpers have no callers or private resume storage. Browser acceptance confirms that prose completes but no visual subscription opens. Sources: [ReadingContext](../../../src/contexts/ReadingContext.jsx), [visual hook](../../../src/hooks/useReadingVisualJob.js), [save hook](../../../src/hooks/useSaveReading.js), [journal list](../../../functions/api/journal.js), [journal narrative](../../../src/components/journal/entry-card/EntrySections/NarrativeSection.jsx), [storage helpers](../../../src/utils/journalStorage.js).

6. **Medium: deletion leaves a writable orphan result.** The real journal DELETE route removes the parent before visual cleanup; cascading deletion removes the link needed to discover the result. The route returns 200, but the result remains and accepts a later commit. Account deletion removes D1 rows without revoking the active DO capability or in-flight work. Capture the linked result before deletion, remove the final reference, and invalidate work/access in the authoritative job lifecycle. Sources: [journal deletion](../../../functions/api/journal/[id].js), [cleanup helper](../../../functions/lib/readingVisualResults.js), [account deletion](../../../functions/api/account/delete.js).

## Task 5 work begun

- [Server acceptance runner](../../../scripts/evaluation/evaluateVisualCueHandoff.mjs): actual start helper, reading delivery boundary, visual job and ledger with deterministic exact-quote proposals. Uses the unchanged 97-word Star excerpt from the 23:47 qualification run. Tests held annotation delivery, simultaneous observations, source replacement, request identity and publication ordering.
- [Persistence acceptance runner](../../../scripts/evaluation/evaluateVisualCuePersistence.mjs): actual save service, visual job, ledger, isolated SQLite and journal DELETE handler. Synthetic prose is labeled as a controlled fixture. Tests completion before save, ownership, deduplication and deletion.
- [Browser acceptance spec](../../../e2e/reading-visual-handoff.spec.js): real `ReadingContext` and gesture renderer with mock Pro authentication and separately controlled HTTP streams. It supplies no semantic metadata through the reading channel and never directly injects cues into client state. Paced, burst and done-only job SSE complete before visual release. The late-cue cases stop at the missing visual subscription; their subsequent cue/hold assertions are **not yet exercised**.

The [bridge browser config](../../../output/reading-motion/react-bridge.playwright.config.mjs) includes the new acceptance spec. These tests intentionally assert the required contract and return a failing exit code while the defects remain. They are not marked as expected failures. The complete bridge test command will therefore remain red until these prerequisites are repaired.

## Verification and evidence limits

Fresh existing focused tests: **29 passed** across the six handed-off prompt, observer, visual-job, narrative-job, persistence and journal integration files. This differs from the handoff's claim of 34; no fresh full-suite/build claim is made here.

Controlled server acceptance: **3 passed, 5 failed**. Reading completion while annotation is unresolved passes for paced SSE, burst SSE and final JSON. Controlled persistence acceptance: **0 passed, 4 failed**. Reports retain actual and expected values; the server report includes implementation hashes and fixture provenance.

Desktop Chromium: **1 new acceptance passed, 3 failed** at the missing visual subscription, after exact rendered prose and narrative completion passed. **3 existing generated-gesture integration cases passed** alongside them, covering existing semantic SSE, replacement and held fallback behavior. After strengthening request logging, the no-capability control was rerun alone and passed. These are not additional distinct passing cases. A test-authoring selector initially included the screen-reader completion status; it was corrected to the reading text container before these product findings were recorded.

ESLint passed on all five edited/new JavaScript test/config/runner paths; syntax checks and `git diff --check` passed. Maintained Markdown checking passed for 180 files. No production implementation files were changed during this review/acceptance work; the handed-off changes remain in the working tree.

Commands from the worktree root:

```sh
node --test tests/visualCuePrompt.test.mjs tests/visualCueObserver.test.mjs tests/readingVisualJob.test.mjs tests/readingJob.test.mjs tests/readingVisualResults.test.mjs tests/journalVisualIntegration.test.mjs
node scripts/evaluation/evaluateVisualCueHandoff.mjs --output output/reading-motion/evidence/visual-handoff-2026-10-09/server-acceptance.json
node scripts/evaluation/evaluateVisualCuePersistence.mjs --output output/reading-motion/evidence/visual-handoff-2026-10-09/persistence-acceptance.json
npx playwright test --config output/reading-motion/react-bridge.playwright.config.mjs e2e/reading-visual-handoff.spec.js --project=chromium
```

Evidence: [server](../../../output/reading-motion/evidence/visual-handoff-2026-10-09/server-acceptance.json), [persistence](../../../output/reading-motion/evidence/visual-handoff-2026-10-09/persistence-acceptance.json), [browser](../../../output/reading-motion/evidence/visual-handoff-2026-10-09/browser-acceptance.json), [no-capability control rerun](../../../output/reading-motion/evidence/visual-handoff-2026-10-09/browser-no-capability.json). The main browser report includes the three existing regression cases; its screenshot paths refer to temporary Playwright output, not retained visual-review artifacts.

No model, live database, deployment, paid API, real-account browser check, mobile check or latency measurement was performed. The visual adapter currently supports test injection only; setting provider/model configuration still throws an unimplemented-adapter error. Desktop controlled evidence cannot qualify live choreography. Cross-batch/visibility/held-arrival checks from Tasks 1–2 remain separate evidence; they bypass this missing application subscription. Browser reload while cues are pending, private local resume, multilingual/unknown-edition transport, and live semantic/device acceptance remain outstanding.

## Repair order before broader acceptance

1. Establish trusted ownership, normalized source binding and durable result registration; close attachment and deletion defects.
2. Serialize the visual job, enforce request/recovery identity, and persist cumulative state before publishing it.
3. Wire the independent client subscription, preserve result identity through narrative completion, and pass validated complete ledger snapshots to the focus engine.
4. Implement actual local/cloud restoration with static revisit; extend Task 5 to pending-save reload, account changes and expiry.
5. Qualify a separately configured visual model and handset behavior only after the controlled acceptance passes.
