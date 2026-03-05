# Review Patterns

## Repeated Findings From PRs and Reviews

1. Collection type mismatch in scene derivation.
- PR #43 review identified `revealedCards` treated as array while production passed `Set`.
- Impact: scene stuck in `drawing` and never reached `interlude` or `delivery`.
- Follow-up: `deriveLegacyScene` now handles `Set`, array, and generic `.size`.

2. State update during render in orchestrator.
- PR #44 review flagged render-time `setSceneState` pattern.
- Impact: StrictMode re-render loops and unstable transitions.
- Fix landed in commit `3d1f69c` by moving sync into `useEffect`.

3. Unused orchestration outputs causing code scanning noise.
- PR #43 had repeated alerts for unused `currentScene` and `onSceneTransition` in `ReadingDisplay`.
- Pattern: over-destructuring orchestrator return values.

4. Transition metadata edge semantics.
- Review noted directional metadata can be ambiguous for same-scene transitions.
- Pattern: callback consumers may mis-handle `forward`/`backward` assumptions.

## Relevant Commits

- `5ce65f6` - Review feedback fixes across cinematic flow.
- `3d1f69c` - Render-loop fix in `useSceneOrchestrator`.
- `a32b731` - Follow-up trigger and loading logic refinement.