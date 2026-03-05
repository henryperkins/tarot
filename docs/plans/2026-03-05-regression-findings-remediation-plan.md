# Regression Findings Remediation Plan (2026-03-05)

## Scope

This plan remediates both findings from the uncommitted-change regression review:

1. Auto-narration can fail to retrigger when a new narrative is generated without reshuffling.
2. Media prompt alignment block can grow unbounded and increase cost/latency risk.

## Goals

- Restore reliable auto-narration behavior across repeated narrative generations.
- Add deterministic prompt-size controls for media generation alignment prompts.
- Preserve current UX and prompt-quality behavior where possible.
- Add test coverage that fails before fix and passes after fix.

## Non-goals

- No broad refactor of narration architecture.
- No change to media model/provider selection.
- No redesign of story-art/video prompting strategy beyond size governance.

## Workstream A: Auto-narration retrigger reliability

### A1. Confirm and isolate root-cause path

1. Reproduce locally:
   - Generate a reading to completion.
   - Allow auto-narration to trigger once.
   - Trigger another narrative generation for the same reading identity (no reshuffle).
   - Verify auto-narration no longer starts automatically.
2. Add temporary debug logs (local only, not committed) around `readingKey`, `autoNarrationTriggered`, and `personalReading` reset transitions to validate stale keyed state.
3. Document the exact transition where `personalReading` becomes `null` but keyed trigger state remains `true`.

### A2. Implement minimal-risk fix

4. Update `useNarrationAutomation` reset handling:
   - In the `if (!personalReading)` effect, explicitly reset keyed trigger state in addition to refs/timeouts.
   - Keep existing timeout cleanup behavior.
5. Preserve current key strategy unless a reproducible secondary issue requires key-priority changes.
6. Ensure reset is idempotent (safe when called repeatedly during stream lifecycle changes).

### A3. Add focused tests

7. Extend `tests/useNarrationAutomation.test.mjs` (or add companion test file) to cover reset behavior when reading is cleared between runs.
8. Add one regression test that simulates:
   - initial trigger,
   - reading clear,
   - second eligible completion,
   - expected `canAutoNarrate === true` before second playback.
9. Keep tests deterministic and independent of timers where possible (or use fake-timer strategy if needed).

### A4. Verify end-to-end behavior

10. Manual validation pass:
    - Free-tier and plus/pro account paths.
    - Azure vs non-Azure narration providers.
    - Auto-narrate on/off combinations.
11. Confirm no duplicate narration start occurs during a single completion cycle.

## Workstream B: Media alignment prompt size and cost guardrails

### B1. Define prompt budget contract for media alignment

12. Establish explicit size limits for alignment payload components:
    - max chars/tokens for embedded system prompt excerpt,
    - max chars/tokens for embedded user prompt excerpt,
    - max total reference block size.
13. Set defaults conservative enough to protect latency/cost while preserving semantic alignment value.
14. Decide configuration source:
    - constants in `mediaPromptAlignment.js`,
    - optional env overrides for tuning without code changes.

### B2. Implement bounded alignment builder

15. Add truncation helpers in `functions/lib/mediaPromptAlignment.js`:
    - preserve high-value headers and contract lines,
    - trim long sections with explicit truncation marker,
    - avoid malformed block formatting.
16. Apply limits when composing `referenceBlock` so output length is always bounded.
17. Keep existing safety/agency instructions intact even when truncation occurs.

### B3. Wire optional endpoint-level control (if needed)

18. If story-art and video need distinct ceilings, add optional builder params and pass them from:
    - `functions/api/generate-story-art.js`,
    - `functions/api/generate-card-video.js`.
19. Keep defaults backward-compatible when params are omitted.

### B4. Add coverage and telemetry

20. Add unit tests for `buildMediaNarrativeReference`:
    - baseline case includes alignment block,
    - oversized input is truncated to budget,
    - truncation markers appear when expected,
    - required safety lines remain present.
21. Add/extend prompt-builder tests to assert bounded length for generated story/video prompts under long-input scenarios.
22. Add lightweight observability signal (log/metadata field) for truncation occurrence to monitor real-world frequency.

### B5. Validate quality does not regress

23. Run a golden-sample comparison across representative prompts (single, triptych, vignette, video) to ensure core thematic alignment remains.
24. Manually inspect outputs for:
    - retained question fidelity,
    - retained card context,
    - no break in no-determinism language.

## Cross-cutting quality gate

25. Run targeted test suites:
    - `npm test -- tests/useNarrationAutomation.test.mjs`
    - prompt/media-related unit tests touched by this work.
26. Run full `npm test`.
27. Run `npm run build`.
28. Run lint checks scoped to modified files if global lint includes unrelated repo issues.

## Rollout strategy

29. Ship in one PR with two commits:
    - Commit 1: auto-narration state fix + tests.
    - Commit 2: media prompt budget controls + tests.
30. Include before/after evidence in PR:
    - repro steps and fix confirmation for narration,
    - prompt length metrics before/after for media alignment.

## Rollback plan

31. If narration behavior regresses (duplicate/early triggers), revert Commit 1 only and keep media guardrails.
32. If media quality drops, revert Commit 2 or raise budget via env override while retaining truncation instrumentation.

## Acceptance criteria

- Repeated generation on same reading identity can auto-narrate again when eligible.
- No duplicate auto-narration during a single completion.
- Media alignment reference block length is bounded by policy.
- New tests cover both regression scenarios.
- Build and tests pass on the branch.
