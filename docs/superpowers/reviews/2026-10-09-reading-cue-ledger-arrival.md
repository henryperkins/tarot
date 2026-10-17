# Cumulative cue ledger and visibility-aware arrival

The user authorized Tasks 1 and 2 of the [independent visual-cue handoff plan](../plans/2026-10-09-reading-visual-cue-handoff.md): repair cumulative cross-batch grounding and late visible-cue selection. The reading model, narrative prompts, Worker routes, journal persistence and production feature gate are unchanged.

## Implemented behavior

`shared/reading/visualCueLedger.js` accepts proposal-only batches against an application-issued request and exact source binding. It validates the analyzed prefix, resolves batch-local aliases and prior accepted literal IDs, and assigns stable SHA-256 cue IDs. Existing cues win overlaps; retries, conflicting receipts, unsupported details and rejected dependencies cannot replace them. Valid siblings survive individual proposal rejection. Ledger revision changes only when cues are added; deterministic receipts also record entirely rejected batches. Accepted cues can accumulate beyond the complete-document compiler's per-batch limit.

The application must retrieve the active request from its own registry, serialize calls and commit the returned ledger before publishing it. The pure library does not implement request ownership lookup, durable storage or a server writer. Those remain Task 3 and Task 4 responsibilities.

The client accepts `cueLedger` only alongside an independently supplied matching `visualBinding`, exact analyzed prefix and matching run/revision. Appended prose and live completion retain accepted prefix cues. Source replacement and binding changes invalidate old attachments; older or invalid snapshots cannot roll back the registry. Existing complete semantic documents keep their replay behavior.

`CUES_ARRIVED` reconciles a cumulative registry with measured passage visibility without advancing prose progress. An earlier visible cue can receive focus while a later cue is offscreen. Explicit inspection wins; existing visible active cues retain their finite deadline. Pending selection is recomputed from the current visible set, with played/coalesced cues retained for explicit revisit. Restored and reduced-motion readings update static associations without automatic animation.

The Markdown renderer measures registered spans atomically and reports newly registered ranges. The provider retains the latest measurement immediately, rather than reapplying a previous render's snapshot. Unplayed pending cues survive visibility corrections; passages measured above the viewport remain available for explicit revisit. Native observers also report positive intersection after edge adjacency and stop reporting after disconnect.

## Regression and review evidence

New tests failed before their implementations: missing ledger contract, rejected valid prefix attachment, missing cumulative interpretation resolution, and missing cue-arrival behavior. A fresh-context code review found a late modal-release deadline using the last prose timestamp; the added regression failed before the timestamp fix.

The first full browser run exposed an intermittent existing SSE hold/release failure. A temporary event trace showed a fresh `balance: true` measurement immediately overwritten by the parent's previous `balance: false` snapshot, incorrectly consuming the cue before playback. The trace instrumentation was removed after the fix. A held pending cue visibility-correction regression failed before its repair; the original SSE browser case then passed three consecutive runs.

## Fresh verification

| Check | Result |
| --- | --- |
| Six focused ledger/compiler/validator/source/resolver/focus files | 81 tests passed |
| `npm test` | 3,127 root tests across 515 suites passed; no skips |
| `npx playwright test --config output/reading-motion/react-bridge.playwright.config.mjs` | 37 passed: 30 desktop Chromium, 7 phone WebKit |
| Previously intermittent SSE case, isolated repetition | 3 consecutive passes after the visibility repair |
| `npm run build` | Passed |
| ESLint on 13 changed JS/JSX/test paths, `--max-warnings=0` | Passed with zero warnings |
| `npm run docs:check` | 180 maintained Markdown files passed |
| `git diff --check` | Passed |

The browser suite covers live completion before annotations, a visible earlier cue with a later offscreen cue, cross-batch literal/meaning continuity, held inspection while prose advances, duplicate snapshots, source replacement, phone layout and reduced motion, plus the existing bridge regressions. One existing Spanish phone case timed out in the first targeted development run; it passed in isolation and in the final full run without weakening its assertions. The clean final run had no failures or retries. Fixture/API behavior is controlled; this is not real authenticated Pro or production coverage.

The review repeated its modal deadline probe after repair and checked the final visibility changes. No confirmed findings remain in this scope.

To open the existing development study:

```bash
npm run dev:frontend -- --port 5174 --strictPort
```

Visit `http://localhost:5174/__e2e/reading-gestures`. The Playwright generated-cues spec uses `?associations=dynamic&sourceMode=visual-cues&reflection=off` and supplies controlled independent prose/cue events; that transport mode intentionally waits for its test driver.

## Remaining boundaries

The development fixture's `sourceMode=visual-cues` channel drives the real ledger/source/React components with controlled prose and cumulative results. It is not a production model service or proof of live annotation latency. The historical 15 joint-generated readings remain unchanged.

Tasks 3–5 remain pending: accepted-delivery observation, independent model/job/transport lifecycle, pending-save persistence and journal restoration, plus separate-model semantic/latency evaluation. No live model generation, narrative/vision gate, authenticated production review, migration or deployment was performed for this scoped repair. Prior narrative-gate results are not presented as newly green.
