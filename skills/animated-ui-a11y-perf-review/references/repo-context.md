# Repo Context

## Primary Files

- `src/components/StreamingNarrative.jsx`
- `src/components/AtmosphericInterlude.jsx`
- `src/components/SpreadTable.jsx`
- `src/lib/colorScript.js`
- `src/styles/tarot.css`

## Supporting Tests

- `tests/cinematicEnhancements.test.mjs`
- `tests/spreadTablePresentation.test.mjs`
- `tests/mobileStableMode.test.mjs`
- `e2e/tarot-reading.spec.js`

## Architecture Notes

- Animation stack is mixed: CSS animations plus motion adapter (`src/lib/motionAdapter`).
- Reduced motion support exists via `useReducedMotion` and `@media (prefers-reduced-motion: reduce)`.
- Narrative streaming has chunked reveal logic with mobile suppression modes.
- Spread images are conditionally eager/lazy loaded based on reveal state.

## Constraints

- Keep motion graceful but optional for reduced-motion users.
- Prefer CSS/batched approaches over per-token JS animation loops.
- Keep focus order and ARIA semantics intact while adding motion.