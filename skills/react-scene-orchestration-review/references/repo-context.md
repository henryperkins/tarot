# Repo Context

## Runtime and Framework

- Frontend: React + Vite (`src/`), functional components, hooks-heavy orchestration.
- Backend: Cloudflare Worker (`src/worker/index.js`) and route handlers in `functions/api/`.
- Tests: Node test runner (`tests/*.test.mjs`) and Playwright E2E (`e2e/*.spec.js`).

## Primary Files for This Skill

- `src/hooks/useSceneOrchestrator.js`
- `src/components/ReadingDisplay.jsx`
- `src/components/scenes/SceneShell.jsx`
- `tests/sceneOrchestrator.test.mjs`
- `tests/cinematicEnhancements.test.mjs`

## Key Architecture Notes

- `useSceneOrchestrator` maps between legacy scenes (`shuffling`, `drawing`, `delivery`) and canonical scenes (`ritual`, `reveal`, `narrative`).
- Scene derivation accepts both `Set` and array for `revealedCards` and uses streaming flags (`isReadingStreamActive`, `personalReading.isStreaming`).
- Transition callbacks are emitted through `onSceneTransition` with `transitionMeta`.
- `ReadingDisplay` integrates orchestrator state into `SceneShell` and scene components.

## Constraints

- Keep side effects in hooks or lib files, not presentational scene components.
- Preserve backward compatibility for legacy scene consumers.
- Avoid render-time state updates and non-deterministic transition churn.