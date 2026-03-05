# Operating Procedure

## 1) Scope and Search

Run:

```bash
rg -n "visibleCount|streamingActive|mobileStreamingOptIn|computeRevealStep|computeRevealDelay|onDone|promptMeta|sourceUsage|graphRAG" src/components/StreamingNarrative.jsx src/components/ReadingDisplay.jsx functions/lib/narrativeBackends.js
```

## 2) Streaming Logic Checklist

- Verify reset on text change clears timers and completion flags safely.
- Verify completion callback fires once per narrative.
- Verify chunk step and delay remain bounded and monotonic.
- Verify skip and mobile opt-in paths reset state consistently.

## 3) Mobile Behavior Checklist

- Confirm suppression criteria are explicit and user-visible.
- Confirm markdown and long-text paths avoid heavy per-token rendering.
- Confirm small-screen behavior does not silently disable expected controls.

## 4) Telemetry Consistency Checklist

- `promptMeta.graphRAG` fields remain internally consistent.
- `promptMeta.sourceUsage` reflects requested vs used sources accurately.
- Local composer return shape includes expected prompt metadata.

## 5) Allowed Changes

- Adjust reveal heuristics and callback guards.
- Tighten source-usage field derivation.
- Add focused tests around regressions.

## 6) Avoid

- Rewriting narrative backend selection for frontend streaming fixes.
- Introducing non-deterministic timing hacks without tests.

## 7) Reporting Format

- Severity, file line, regression symptom, root-cause branch, minimal fix, validation commands.