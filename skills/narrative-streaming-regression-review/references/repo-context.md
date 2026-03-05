# Repo Context

## Primary Files

- `src/components/StreamingNarrative.jsx`
- `src/components/ReadingDisplay.jsx`
- `functions/lib/narrativeBackends.js`

## Supporting Tests

- `tests/narrativeBackends.test.mjs`
- `tests/sourceUsageSummary.test.mjs`
- `tests/narrativeBuilder.promptCompliance.test.mjs`
- `tests/reasoning.test.mjs`
- `tests/sceneOrchestrator.test.mjs`
- `e2e/tarot-reading.spec.js`

## Architecture Notes

- Streaming narrative uses `visibleCount`, chunked reveal step, and delay heuristics.
- Mobile paths may suppress progressive typing until opt-in.
- Completion and narration triggers depend on refs and timing effects.
- Narrative backend emits `promptMeta.graphRAG` and `promptMeta.sourceUsage` telemetry for downstream quality checks.

## Constraints

- Preserve deterministic completion semantics.
- Keep mobile behavior intentional and explicit.
- Do not break source-usage metadata schema expected by tests.