# Operating Procedure

## 1) Scope and Read

Run:

```bash
rg -n "deriveLegacyScene|useSceneOrchestrator|transitionMeta|setSceneState|useEffect|revealedCards" src/hooks/useSceneOrchestrator.js src/components/ReadingDisplay.jsx src/components/scenes/SceneShell.jsx
```

Then read the hook first, integration second, consumer callbacks third.

## 2) Scene Derivation Checks

- Verify `revealedCards` supports `Set`, array, and size-like objects.
- Verify all terminal states are reachable (`revealing` -> `interlude` -> `delivery` -> `complete`).
- Verify streaming gates use actual text availability, not only flag booleans.

## 3) React Lifecycle Checks

- Flag any state write in render path (`if (...) setState(...)` outside event/effect).
- Confirm effect dependencies include all values used in sync logic.
- Ensure callback refs (`transitionCallbacksRef`) are stable and cleanup paths exist.

## 4) Transition Metadata Checks

- Verify direction, duration, particle preset, and scene mappings are coherent.
- Check for noisy metadata churn (`Date.now()` loops) during rapid toggles.
- Confirm manual transitions can be reset safely.

## 5) Allowed Changes

- Hook logic, effect dependencies, and derivation helpers.
- Minimal consumer cleanup (remove unused destructures, adjust callbacks).
- Targeted tests in `tests/sceneOrchestrator.test.mjs` and nearby integration tests.

## 6) Avoid

- Full scene-architecture rewrites in review fixes.
- Introducing new global state stores for local transition bugs.
- Moving orchestration side effects into UI-only scene components.

## 7) Reporting Format

For each finding:

- Severity (`P1`, `P2`, `P3`)
- `file:line`
- Repro condition
- Risk in scene lifecycle
- Minimum fix
- Validation command